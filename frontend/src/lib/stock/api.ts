import { prismaRoleFromUi, uiRoleFromPrisma } from "@/lib/cdc-role-profiles";
import { proposeCategoryCode } from "@/lib/category-helpers";
import type { Role as PrismaRole } from "@prisma/client";
import {
  parseCustomFieldsText,
  parseListLines,
} from "@/lib/item-attribute-helpers";
import {
  EMPTY_STOCK_LEVELS,
  stockLevelsFromDb,
  stockLevelsToDb,
  type StockLevels,
} from "@/lib/stock-level-helpers";
import {
  movementSignedQty,
  movementTypeToUi,
  MOVEMENT_REASON_LABELS,
} from "@/lib/movement-helpers";
import type { MovementReason, MovementType as PrismaMovementType } from "@prisma/client";
import {
  parseSpecialConditionsText as parseWarehouseConditionsText,
  warehouseKindFromUi,
  type WarehouseKindUi,
} from "@/lib/warehouse-helpers";
import {
  fillStateFromUi,
  parseSpecialConditionsText as parseLocationConditionsText,
  type StorageLocationFillStateUi,
} from "@/lib/storage-location-helpers";
import {
  shelvingLevelFromUi,
  shelvingMaterialFromUi,
  type ShelvingLevelUi,
  type ShelvingMaterialUi,
} from "@/lib/shelving-helpers";
import {
  zoneAccessFromUi,
  zoneTypeFromUi,
  type StorageZoneAccessUi,
  type StorageZoneTypeUi,
} from "@/lib/warehouse-zone-helpers";
import { conditionFromUi, parseGalleryLines, type ArticleConditionUi } from "@/lib/item-shared";
import { parseStockTarget } from "@/lib/item-variant-helpers";

import { assertMongoApiId } from "./mongo-id";
import { clearSession } from "./session";
import type { EventStatus, Role, ReturnCondition, StockState } from "./types";

/**
 * Une chaîne vide dans .env (`NEXT_PUBLIC_API_BASE_URL=`) reste définie : `??` ne retombe pas sur le défaut,
 * ce qui produit des `fetch("/api/...")` vers le front (404) au lieu du backend.
 */
function getEnvApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!raw) {
    // Monolithe Next (API sous /api dans la même app) : fetch relatifs.
    // Pour un backend séparé en local : définir NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
    return "";
  }
  return raw.replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function effectivePort(url: URL): string {
  if (url.port) {
    return url.port;
  }
  return url.protocol === "https:" ? "443" : "80";
}

/**
 * URL réellement utilisée pour les `fetch` côté navigateur.
 * Si vous ouvrez le front via l’IP du réseau (ex. http://192.168.x.x:3000) alors que l’env pointe sur
 * localhost:3001, sans cette règle le navigateur appelle le localhost de **l’appareil client** → Failed to fetch.
 */
export function getResolvedApiBaseUrl(): string {
  let base = getEnvApiBaseUrl();
  if (typeof window === "undefined") {
    return base;
  }
  if (!base) {
    return "";
  }
  try {
    // En HTTPS, on évite le mixed-content uniquement si l'API cible est en HTTP.
    // Si la base API est déjà en HTTPS, on conserve l'URL absolue (pas de dépendance à une rewrite /api).
    if (window.location.protocol === "https:") {
      try {
        const secureApiUrl = new URL(base);
        if (secureApiUrl.protocol !== "https:") {
          return "";
        }
      } catch {
        return "";
      }
    }

    const apiUrl = new URL(base);
    const pageHost = window.location.hostname;
    const apiHost = apiUrl.hostname;
    if (!isLoopbackHost(pageHost) && isLoopbackHost(apiHost)) {
      apiUrl.hostname = pageHost;
      base = apiUrl.toString().replace(/\/+$/, "");
    }

    // Même hôte + même port que la page → les fetch /api/* partent sur Next (souvent 404), pas sur le backend.
    const pageUrl = new URL(window.location.href);
    const apiUrl2 = new URL(base);
    if (
      process.env.NODE_ENV === "development" &&
      apiUrl2.hostname === pageUrl.hostname &&
      effectivePort(apiUrl2) === effectivePort(pageUrl)
    ) {
      apiUrl2.port = "3001";
      base = apiUrl2.toString().replace(/\/+$/, "");
    }
  } catch {
    // URL invalide : on garde la valeur d’env
  }
  return base;
}

/** Pour les messages (toasts) : URL de base affichable quand l’API est sur la même origine. */
export function getApiOriginForDisplay(): string {
  const b = getResolvedApiBaseUrl();
  if (b) {
    return b;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

/** URL absolue pour fetch : évite les chemins relatifs mal résolus (ex. /connexion/api/... → 404). */
function resolveApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getResolvedApiBaseUrl();
  if (!base) {
    if (typeof window !== "undefined") {
      return new URL(normalized, window.location.origin).href;
    }
    return normalized;
  }
  return `${base.replace(/\/+$/, "")}${normalized}`;
}

type BackendUserRole =
  | "ADMIN"
  | "MANAGER"
  | "COMMERCIAL"
  | "STOREKEEPER"
  | "TECHNICAL_MANAGER"
  | "FLEET_MANAGER"
  | "TECHNICIAN"
  | "VIEWER";
type BackendOrderStatus = "PENDING" | "IN_PROGRESS" | "SETTLED";
type BackendMovementType = PrismaMovementType;
type BackendMovementReason = MovementReason;
type BackendReturnCondition = "OK" | "DAMAGED" | "MISSING";
type BackendEventLifecycle = "PLANNED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

function eventLifecycleFromBackend(lifecycle: BackendEventLifecycle): EventStatus {
  switch (lifecycle) {
    case "PREPARING":
      return "En préparation";
    case "READY":
      return "Prêt";
    case "COMPLETED":
      return "Terminé";
    case "CANCELLED":
      return "Annulé";
    default:
      return "Planifié";
  }
}

function eventLifecycleToBackend(statut: EventStatus): BackendEventLifecycle {
  switch (statut) {
    case "En préparation":
      return "PREPARING";
    case "Prêt":
      return "READY";
    case "Terminé":
      return "COMPLETED";
    case "Annulé":
      return "CANCELLED";
    default:
      return "PLANNED";
  }
}

function roleToBackend(role: Role): BackendUserRole {
  return prismaRoleFromUi(role) as BackendUserRole;
}

function roleFromBackend(role: BackendUserRole): Role {
  return uiRoleFromPrisma(role as PrismaRole);
}

function movementTypeFromBackend(type: BackendMovementType): StockState["mouvements"][number]["type"] {
  return movementTypeToUi(type);
}

function returnConditionToBackend(condition: ReturnCondition): BackendReturnCondition {
  switch (condition) {
    case "Bon état":
      return "OK";
    case "Endommagé":
    case "À réparer":
      return "DAMAGED";
    default:
      return "MISSING";
  }
}

function returnConditionFromBackend(condition?: BackendReturnCondition | null): string {
  switch (condition) {
    case "OK":
      return "Bon état";
    case "DAMAGED":
      return "Endommagé";
    case "MISSING":
      return "Perdu";
    default:
      return "";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const apiBase = getResolvedApiBaseUrl();
  const url = resolveApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      const fromNetwork =
        typeof window !== "undefined" && !isLoopbackHost(window.location.hostname);
      const hint = fromNetwork
        ? ` Vous êtes sur ${window.location.host} : l’API doit être joignable à cette adresse (ex. ${window.location.protocol}//${window.location.hostname}:3001). Vérifiez aussi que le backend écoute sur toutes les interfaces, pas seulement 127.0.0.1.`
        : "";
      const baseHint = apiBase
        ? ` Démarrez le backend (npm run dev:backend, port 3001) et contrôlez NEXT_PUBLIC_API_BASE_URL.`
        : ` Lancez l’app Next (npm run dev dans frontend) : les routes /api sont dans la même app. Vérifiez DATABASE_URL.`;
      const origin =
        typeof window !== "undefined" ? window.location.origin : "(serveur)";
      throw new Error(
        `Impossible de contacter l’API (${apiBase || origin}) : ${err.message}.${baseHint}${hint}`,
      );
    }
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearSession();
    }
    const ct = response.headers.get("content-type") ?? "";
    let message = `Erreur HTTP ${response.status}`;
    if (ct.includes("application/json")) {
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) {
          message = body.message;
        }
      } catch {
        // no-op
      }
    } else if (response.status === 404) {
      message = apiBase
        ? "API introuvable (404). Vérifiez NEXT_PUBLIC_API_BASE_URL (ex. http://localhost:3001) et que le backend tourne sur ce port."
        : "API introuvable (404). Les routes /api doivent être servies par cette app Next (build avec Prisma).";
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export type CategoryParentRef = { id: string; name: string; code: string; level: number };

export type CategoryDto = {
  id: string;
  name: string;
  slug: string;
  code: string;
  description?: string | null;
  photoUrl?: string | null;
  icon?: string | null;
  metadata?: Record<string, unknown> | null;
  active: boolean;
  level: number;
  parentId?: string | null;
  parent?: CategoryParentRef | null;
};

export type CategoryWithCount = CategoryDto & {
  itemCount: number;
  childrenCount: number;
};

type CategoryApiRow = CategoryDto & {
  itemCount?: number;
  childrenCount?: number;
  _count?: { items: number; children: number };
};

export type CategoryFormPayload = {
  id?: string;
  name: string;
  slug: string;
  code: string;
  description?: string;
  photoUrl?: string;
  icon?: string;
  metadata?: Record<string, string | number | boolean>;
  active: boolean;
  parentId?: string | null;
};

export type CategoryParentPreset = {
  id: string;
  name: string;
  code: string;
  level: number;
};
type ItemDto = {
  id: string;
  name: string;
  reference: string;
  categoryId?: string | null;
  description?: string | null;
  photoUrl?: string | null;
  galleryUrls?: string[];
  emoji?: string | null;
  notes?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  barcode?: string | null;
  serialNumber?: string | null;
  lotNumber?: string | null;
  supplierName?: string | null;
  unitValue: number;
  rentalPrice?: number | null;
  salePrice?: number | null;
  usefulLifeMonths?: number | null;
  totalQuantity: number;
  allocatedQty: number;
  minThreshold: number;
  maxStockQty?: number;
  safetyStockQty?: number;
  optimalStockQty?: number;
  alertThresholdQty?: number;
  criticalThresholdQty?: number;
  condition?: string;
  conditionLabel?: ArticleConditionUi;
  hasVariants?: boolean;
  customFields?: Record<string, string | number | boolean> | null;
  technicalParams?: string | null;
  certifications?: string[];
  safetyStandards?: string[];
  specialInstructions?: string | null;
  variants?: Array<{
    id: string;
    reference: string;
    label?: string | null;
    size?: string | null;
    color?: string | null;
    modelName?: string | null;
    unitValue: number;
    rentalPrice?: number | null;
    salePrice?: number | null;
    totalQuantity: number;
    allocatedQty: number;
    minThreshold: number;
    maxStockQty?: number;
    safetyStockQty?: number;
    optimalStockQty?: number;
    alertThresholdQty?: number;
    criticalThresholdQty?: number;
    condition?: string;
    conditionLabel?: ArticleConditionUi;
    barcode?: string | null;
  }>;
};

function mapItemStockLevels(row: {
  minThreshold: number;
  maxStockQty?: number;
  safetyStockQty?: number;
  optimalStockQty?: number;
  alertThresholdQty?: number;
  criticalThresholdQty?: number;
}): StockLevels {
  return stockLevelsFromDb({
    minThreshold: row.minThreshold,
    maxStockQty: row.maxStockQty ?? 0,
    safetyStockQty: row.safetyStockQty ?? 0,
    optimalStockQty: row.optimalStockQty ?? 0,
    alertThresholdQty: row.alertThresholdQty ?? 0,
    criticalThresholdQty: row.criticalThresholdQty ?? 0,
  });
}

export type VariantSavePayload = {
  id?: string;
  sku: string;
  label?: string;
  size?: string;
  color?: string;
  modelName?: string;
  valUnit: number;
  rentalPrice?: number | null;
  salePrice?: number | null;
  qtyTotal: number;
  seuilMin: number;
  stockLevels: StockLevels;
  condition: ArticleConditionUi;
  barcode?: string;
};

export type ArticleSavePayload = {
  id?: string;
  nom: string;
  ref: string;
  cat: string;
  description?: string;
  photoUrl?: string;
  galleryText?: string;
  emoji?: string;
  notes?: string;
  brand?: string;
  model?: string;
  variant?: string;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  barcode?: string;
  serialNumber?: string;
  lotNumber?: string;
  supplierName?: string;
  valUnit: number;
  rentalPrice?: number | null;
  salePrice?: number | null;
  usefulLifeMonths?: number | null;
  qtyTotal: number;
  seuilMin: number;
  stockLevels: StockLevels;
  condition: ArticleConditionUi;
  hasVariants?: boolean;
  variants?: VariantSavePayload[];
  customFieldsText?: string;
  technicalParams?: string;
  certificationsText?: string;
  safetyStandardsText?: string;
  specialInstructions?: string;
};
type EventDto = {
  id: string;
  name: string;
  clientName: string;
  startsAt: string;
  endsAt: string;
  location: string;
  lifecycle?: BackendEventLifecycle;
  orderStatus?: BackendOrderStatus;
  notes?: string | null;
  owner?: { fullName?: string } | null;
  eventItems?: Array<{ itemId: string; quantity: number }>;
};
type MovementDto = {
  id: string;
  movementType: BackendMovementType;
  movementReason?: BackendMovementReason | null;
  itemId: string;
  quantity: number;
  eventId?: string | null;
  actor?: { fullName?: string } | null;
  returnCondition?: BackendReturnCondition | null;
  notes?: string | null;
  createdAt: string;
  fromLocation?: { code: string; label?: string | null; hierarchyCoordinate?: string | null } | null;
  toLocation?: { code: string; label?: string | null; hierarchyCoordinate?: string | null } | null;
};
type UserDto = {
  id: string;
  username?: string | null;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role: BackendUserRole;
  active?: boolean;
};

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { prenom: fullName.trim() || "User", nom: "" };
  }
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

export type AuthMeUser = {
  id: string;
  username?: string | null;
  fullName: string;
  email: string;
  role: BackendUserRole;
  avatarUrl?: string | null;
};

export type LoginApiResult =
  | { user: AuthMeUser; needsTwoFactor?: false }
  | { needsTwoFactor: true; user: { id: string; fullName: string; email: string } };

export async function loginViaApi(identifier: string, password: string): Promise<LoginApiResult> {
  const response = await fetch(resolveApiUrl("/api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  const ct = response.headers.get("content-type") ?? "";
  const body = ct.includes("application/json")
    ? ((await response.json()) as LoginApiResult & { message?: string })
    : null;
  if (!response.ok) {
    throw new Error(body?.message ?? `Erreur HTTP ${response.status}`);
  }
  if (body && "needsTwoFactor" in body && body.needsTwoFactor) {
    return body;
  }
  return body as { user: AuthMeUser };
}

export async function verifyTwoFactorViaApi(code: string): Promise<{ user: AuthMeUser }> {
  const response = await fetch(resolveApiUrl("/api/auth/2fa/verify"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Code 2FA invalide");
  }
  return (await response.json()) as { user: AuthMeUser };
}

export async function logoutViaApi(): Promise<void> {
  await fetch(resolveApiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  });
}

/** Session cookie (sans effet de bord si 401). */
export async function fetchAuthMe(): Promise<AuthMeUser | null> {
  const response = await fetch(resolveApiUrl("/api/auth/me"), { credentials: "include" });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthMeUser;
}

/** Liste des utilisateurs de l’organisation (écran de choix de profil sur `/connexion`). */
export async function fetchUsersList(): Promise<StockState["utilisateurs"]> {
  const users = await apiFetch<UserDto[]>("/api/users");
  return users.map((user) => {
    const { prenom, nom } = splitFullName(user.fullName);
    return {
      id: user.id,
      username: user.username ?? null,
      prenom,
      nom,
      email: user.email,
      avatarUrl: user.avatarUrl ?? "",
      role: roleFromBackend(user.role),
      actif: user.active !== false,
    };
  });
}

export async function loadStateFromBackend(previous: StockState): Promise<StockState> {
  const [categories, items, events, movements, users] = await Promise.all([
    apiFetch<CategoryApiRow[]>("/api/categories"),
    apiFetch<ItemDto[]>("/api/items"),
    apiFetch<EventDto[]>("/api/events"),
    apiFetch<MovementDto[]>("/api/movements"),
    apiFetch<UserDto[]>("/api/users"),
  ]);

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryLabel = (categoryId: string | null | undefined) => {
    if (!categoryId) {
      return "Autre";
    }
    const parts: string[] = [];
    let current = categoriesById.get(categoryId);
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      parts.unshift(current.name);
      current = current.parentId ? categoriesById.get(current.parentId) : undefined;
    }
    return parts.join(" › ") || "Autre";
  };

  const nextUsers: StockState["utilisateurs"] = users.map((user) => {
    const { prenom, nom } = splitFullName(user.fullName);
    return {
      id: user.id,
      username: user.username ?? null,
      prenom,
      nom,
      email: user.email,
      avatarUrl: user.avatarUrl ?? "",
      role: roleFromBackend(user.role),
      actif: user.active !== false,
    };
  });

  const fallbackCurrentUser = nextUsers[0]?.id ?? previous.currentUser;

  return {
    ...previous,
    articles: items.map((item) => ({
      id: item.id,
      nom: item.name,
      ref: item.reference,
      hasVariants: Boolean(item.hasVariants),
      variants: (item.variants ?? []).map((v) => ({
        id: v.id,
        sku: v.reference,
        label: v.label ?? v.reference,
        size: v.size ?? "",
        color: v.color ?? "",
        modelName: v.modelName ?? "",
        qtyTotal: v.totalQuantity,
        qtyAff: v.allocatedQty,
        valUnit: v.unitValue,
        rentalPrice: v.rentalPrice ?? null,
        salePrice: v.salePrice ?? null,
        seuilMin: v.minThreshold,
        stockLevels: mapItemStockLevels(v),
        condition: (v.conditionLabel ?? "Bon") as ArticleConditionUi,
        barcode: v.barcode ?? "",
      })),
      cat: categoryLabel(item.categoryId),
      description: item.description ?? "",
      photoUrl: item.photoUrl ?? "",
      galleryUrls: item.galleryUrls ?? [],
      brand: item.brand ?? "",
      model: item.model ?? "",
      variant: item.variant ?? "",
      weightKg: item.weightKg ?? null,
      lengthCm: item.lengthCm ?? null,
      widthCm: item.widthCm ?? null,
      heightCm: item.heightCm ?? null,
      barcode: item.barcode ?? "",
      serialNumber: item.serialNumber ?? "",
      lotNumber: item.lotNumber ?? "",
      supplierName: item.supplierName ?? "",
      qtyTotal: item.totalQuantity,
      qtyAff: item.allocatedQty,
      valUnit: item.unitValue,
      rentalPrice: item.rentalPrice ?? null,
      salePrice: item.salePrice ?? null,
      usefulLifeMonths: item.usefulLifeMonths ?? null,
      seuilMin: item.minThreshold,
      stockLevels: mapItemStockLevels(item),
      emoji: item.emoji?.trim() || "📦",
      notes: item.notes ?? "",
      condition: (item.conditionLabel ?? "Bon") as ArticleConditionUi,
      customFields:
        item.customFields && typeof item.customFields === "object" && !Array.isArray(item.customFields)
          ? (item.customFields as Record<string, string | number | boolean>)
          : {},
      technicalParams: item.technicalParams ?? "",
      certifications: item.certifications ?? [],
      safetyStandards: item.safetyStandards ?? [],
      specialInstructions: item.specialInstructions ?? "",
    })),
    evenements: events.map((event) => ({
      id: event.id,
      nom: event.name,
      client: event.clientName,
      debut: event.startsAt.slice(0, 10),
      fin: event.endsAt.slice(0, 10),
      lieu: event.location,
      resp: event.owner?.fullName ?? "",
      statut: eventLifecycleFromBackend(event.lifecycle ?? "PLANNED"),
      orderStatus: event.orderStatus ?? "PENDING",
      notes: event.notes ?? "",
      itemsAffectes: (event.eventItems ?? []).reduce((sum, row) => sum + row.quantity, 0),
    })),
    mouvements: movements.map((movement) => {
      const etat = returnConditionFromBackend(movement.returnCondition);
      let type = movementTypeFromBackend(movement.movementType);
      if (movement.movementType === "RETURN" && movement.returnCondition === "MISSING") {
        type = "Perte/Casse";
      }
      const locLabel = (loc?: MovementDto["fromLocation"]) =>
        loc ? loc.hierarchyCoordinate || loc.code : "";
      return {
        id: movement.id,
        type,
        articleId: movement.itemId,
        qty: movement.quantity,
        signedQty: movementSignedQty(movement.movementType, movement.quantity),
        reason: movement.movementReason
          ? MOVEMENT_REASON_LABELS[movement.movementReason]
          : "",
        fromLabel: locLabel(movement.fromLocation),
        toLabel: locLabel(movement.toLocation),
        evId: movement.eventId ?? "",
        operateur: movement.actor?.fullName ?? "",
        etat,
        note: movement.notes ?? "",
        date: movement.createdAt,
      };
    }),
    utilisateurs: nextUsers,
    currentUser: nextUsers.some((user) => user.id === previous.currentUser)
      ? previous.currentUser
      : fallbackCurrentUser,
  };
}

function normalizeCategorySearch(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveCategoryId(cat: string): Promise<string> {
  const categories = await apiFetch<CategoryApiRow[]>("/api/categories");
  const normalized = normalizeCategorySearch(cat);
  const active = categories.filter((row) => row.active !== false);

  const existing = active.find((category) => {
    const name = category.name.trim().toLowerCase();
    const slug = category.slug.trim().toLowerCase();
    const code = category.code.trim().toLowerCase();
    const pathParts: string[] = [];
    let current: CategoryApiRow | undefined = category;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      pathParts.unshift(current.name);
      current = current.parentId
        ? active.find((row) => row.id === current!.parentId)
        : undefined;
    }
    const pathLabel = pathParts.join(" › ").toLowerCase();
    return (
      name === normalized ||
      slug === normalized ||
      code === normalized ||
      pathLabel === normalized
    );
  });
  if (existing) {
    return existing.id;
  }

  const slug = normalized.replace(/\s+/g, "-").replace(/›/g, "").replace(/\s+/g, "-");
  const created = await apiFetch<CategoryDto>("/api/categories", {
    method: "POST",
    body: JSON.stringify({
      name: cat.trim(),
      slug: slug || "autre",
      code: slug.replace(/-/g, "").toUpperCase().slice(0, 12) || "AUTRE",
      active: true,
    }),
  });
  return created.id;
}

export async function saveArticleViaApi(payload: ArticleSavePayload) {
  const categoryId = await resolveCategoryId(payload.cat || "Autre");
  const galleryUrls = payload.galleryText ? parseGalleryLines(payload.galleryText) : [];
  const photoUrl = payload.photoUrl?.trim() || galleryUrls[0] || undefined;
  const body = {
    name: payload.nom.trim(),
    reference: payload.ref.trim() || `ART-${Date.now()}`,
    categoryId,
    description: payload.description?.trim() || undefined,
    photoUrl,
    galleryUrls,
    emoji: payload.emoji?.trim() || "📦",
    notes: payload.notes?.trim() || undefined,
    brand: payload.brand?.trim() || undefined,
    model: payload.model?.trim() || undefined,
    variant: payload.variant?.trim() || undefined,
    weightKg: payload.weightKg ?? undefined,
    lengthCm: payload.lengthCm ?? undefined,
    widthCm: payload.widthCm ?? undefined,
    heightCm: payload.heightCm ?? undefined,
    barcode: payload.barcode?.trim() || undefined,
    serialNumber: payload.serialNumber?.trim() || undefined,
    lotNumber: payload.lotNumber?.trim() || undefined,
    supplierName: payload.supplierName?.trim() || undefined,
    unitValue: payload.valUnit,
    rentalPrice: payload.rentalPrice ?? undefined,
    salePrice: payload.salePrice ?? undefined,
    usefulLifeMonths: payload.usefulLifeMonths ?? undefined,
    totalQuantity: payload.qtyTotal,
    ...stockLevelsToDb(payload.stockLevels ?? { ...EMPTY_STOCK_LEVELS, min: payload.seuilMin }),
    condition: conditionFromUi(payload.condition),
    hasVariants: Boolean(payload.hasVariants && payload.variants?.length),
    variants: payload.variants?.map((v) => ({
      id: v.id,
      reference: v.sku.trim(),
      label: v.label?.trim() || undefined,
      size: v.size?.trim() || undefined,
      color: v.color?.trim() || undefined,
      modelName: v.modelName?.trim() || undefined,
      unitValue: v.valUnit,
      rentalPrice: v.rentalPrice ?? undefined,
      salePrice: v.salePrice ?? undefined,
      totalQuantity: v.qtyTotal,
      ...stockLevelsToDb(v.stockLevels ?? { ...EMPTY_STOCK_LEVELS, min: v.seuilMin }),
      condition: conditionFromUi(v.condition),
      barcode: v.barcode?.trim() || undefined,
    })),
    customFields: payload.customFieldsText
      ? parseCustomFieldsText(payload.customFieldsText)
      : undefined,
    technicalParams: payload.technicalParams?.trim() || undefined,
    certifications: payload.certificationsText
      ? parseListLines(payload.certificationsText)
      : undefined,
    safetyStandards: payload.safetyStandardsText
      ? parseListLines(payload.safetyStandardsText)
      : undefined,
    specialInstructions: payload.specialInstructions?.trim() || undefined,
  };

  if (payload.id) {
    assertMongoApiId(payload.id, "Article");
    await apiFetch(`/api/items/${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return "Article mis à jour";
  }

  await apiFetch("/api/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return "Article ajouté au catalogue";
}

export async function saveEventViaApi(payload: {
  id?: string;
  nom: string;
  client: string;
  debut: string;
  fin: string;
  lieu: string;
  ownerId: string;
  statut?: EventStatus;
  notes?: string;
}) {
  const startsAt = new Date(`${payload.debut}T00:00:00.000Z`).toISOString();
  const endsAt = new Date(`${(payload.fin || payload.debut) as string}T23:59:59.999Z`).toISOString();
  const body = {
    name: payload.nom.trim(),
    clientName: payload.client.trim(),
    location: payload.lieu.trim(),
    startsAt,
    endsAt,
    ownerId: payload.ownerId,
    lifecycle: eventLifecycleToBackend(payload.statut ?? "Planifié"),
    notes: payload.notes?.trim() || undefined,
    allocations: [],
  };

  if (payload.id) {
    assertMongoApiId(payload.id, "Événement");
    await apiFetch(`/api/events/${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return "Événement mis à jour";
  }

  await apiFetch("/api/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return "Événement créé";
}

export async function saveAffectationViaApi(payload: { artId: string; evId: string; qty: number }) {
  const { itemId, itemVariantId } = parseStockTarget(payload.artId);
  assertMongoApiId(itemId, "Article");
  if (itemVariantId) {
    assertMongoApiId(itemVariantId, "Variante");
  }
  if (!payload.evId) {
    throw new Error("Sélectionnez un événement pour l'affectation.");
  }
  assertMongoApiId(payload.evId, "Événement");
  await apiFetch(`/api/events/${payload.evId}/allocations`, {
    method: "POST",
    body: JSON.stringify({
      itemId,
      itemVariantId,
      quantity: payload.qty,
    }),
  });
  return "Affectation planifiée sur l'événement";
}

export async function saveMovementViaApi(payload: {
  movementType: PrismaMovementType;
  movementReason?: MovementReason;
  artId: string;
  qty: number;
  evId?: string;
  note?: string;
  etat?: ReturnCondition;
  fromLocationId?: string;
  toLocationId?: string;
  countedQty?: number;
  cdcCorrection?: boolean;
  cdcCorrectionNote?: string;
}) {
  const { itemId, itemVariantId } = parseStockTarget(payload.artId);
  assertMongoApiId(itemId, "Article");
  if (itemVariantId) {
    assertMongoApiId(itemVariantId, "Variante");
  }
  if (payload.evId) {
    assertMongoApiId(payload.evId, "Événement");
  }
  if (payload.fromLocationId) {
    assertMongoApiId(payload.fromLocationId, "Emplacement source");
  }
  if (payload.toLocationId) {
    assertMongoApiId(payload.toLocationId, "Emplacement destination");
  }

  await apiFetch("/api/movements", {
    method: "POST",
    body: JSON.stringify({
      movementType: payload.movementType,
      movementReason: payload.movementReason,
      itemId,
      itemVariantId,
      eventId: payload.evId || undefined,
      quantity: payload.qty,
      returnCondition: payload.etat ? returnConditionToBackend(payload.etat) : undefined,
      notes: payload.note?.trim() || undefined,
      fromStorageLocationId: payload.fromLocationId,
      toStorageLocationId: payload.toLocationId,
      countedQty: payload.countedQty,
      cdcCorrection: payload.cdcCorrection,
      cdcCorrectionNote: payload.cdcCorrectionNote,
    }),
  });

  return "Mouvement enregistré";
}

export async function fetchMovementLocationOptions(): Promise<Array<{ id: string; label: string }>> {
  const lines = await fetchLocationStockLines();
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string }> = [];
  for (const row of lines) {
    if (seen.has(row.storageLocationId)) {
      continue;
    }
    seen.add(row.storageLocationId);
    out.push({
      id: row.storageLocationId,
      label: `${row.warehouseName} · ${row.hierarchyCoordinate || row.locationCode}`,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export async function saveReceptionViaApi(payload: {
  artId: string;
  qty: number;
  note?: string;
}) {
  return saveMovementViaApi({
    movementType: "INBOUND",
    movementReason: "PURCHASE",
    artId: payload.artId,
    qty: payload.qty,
    note: payload.note?.trim() || "Réception stock",
  });
}

export async function toggleUserActiveViaApi(userId: string, active: boolean) {
  assertMongoApiId(userId, "Utilisateur");
  await apiFetch(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
  return active ? "Utilisateur réactivé" : "Utilisateur désactivé";
}

export async function saveSortieViaApi(payload: { artId: string; evId: string; qty: number; note: string }) {
  const { itemId, itemVariantId } = parseStockTarget(payload.artId);
  assertMongoApiId(itemId, "Article");
  if (itemVariantId) {
    assertMongoApiId(itemVariantId, "Variante");
  }
  if (payload.evId) {
    assertMongoApiId(payload.evId, "Événement");
  }
  return saveMovementViaApi({
    movementType: "OUTBOUND",
    movementReason: payload.evId ? "EVENT" : "SALE",
    artId: payload.artId,
    qty: payload.qty,
    evId: payload.evId,
    note: payload.note,
  });
}

export async function saveRetourViaApi(payload: {
  artId: string;
  evId: string;
  qty: number;
  etat: ReturnCondition;
  note: string;
}) {
  const { itemId, itemVariantId } = parseStockTarget(payload.artId);
  assertMongoApiId(itemId, "Article");
  if (itemVariantId) {
    assertMongoApiId(itemVariantId, "Variante");
  }
  if (payload.evId) {
    assertMongoApiId(payload.evId, "Événement");
  }
  return saveMovementViaApi({
    movementType: "RETURN",
    movementReason: "CUSTOMER_RETURN",
    artId: payload.artId,
    qty: payload.qty,
    evId: payload.evId,
    etat: payload.etat,
    note: payload.note,
  });
}

/** Identifiant de connexion dérivé de l’e-mail si le formulaire ne fournit pas de nom d’utilisateur. */
function defaultUsernameFromEmail(email: string): string {
  const local = email.trim().split("@")[0]?.toLowerCase() || "user";
  const safe = local
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const base = (safe.length >= 2 ? safe : `${safe || "u"}_id`).slice(0, 64);
  return base.length >= 2 ? base : "user_x";
}

export async function saveUserViaApi(payload: {
  id?: string;
  username?: string;
  prenom: string;
  nom: string;
  email: string;
  avatarUrl?: string | null;
  role: Role;
  password?: string;
  /** Réinitialisation mot de passe (admin, édition uniquement). */
  newPassword?: string;
}) {
  const fullName = `${payload.prenom.trim()} ${payload.nom.trim()}`.trim();
  const email = payload.email.trim();
  const usernameRaw = payload.username?.trim();
  const usernameResolved = (
    usernameRaw && usernameRaw.length >= 2 ? usernameRaw : defaultUsernameFromEmail(email)
  ).toLowerCase();

  if (payload.id) {
    assertMongoApiId(payload.id, "Utilisateur");
    const patchBody: Record<string, unknown> = {
      fullName,
      email,
      avatarUrl: payload.avatarUrl ?? undefined,
      role: roleToBackend(payload.role),
    };
    if (usernameRaw && usernameRaw.length >= 2) {
      patchBody.username = usernameResolved;
    }
    if (payload.newPassword && payload.newPassword.length > 0) {
      patchBody.password = payload.newPassword;
    }
    await apiFetch(`/api/users/${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify(patchBody),
    });
    return "Utilisateur mis à jour";
  }

  if (!payload.password || payload.password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify({
      username: usernameResolved,
      fullName,
      email: payload.email.trim(),
      avatarUrl: payload.avatarUrl ?? undefined,
      role: roleToBackend(payload.role),
      password: payload.password,
    }),
  });
  return "Utilisateur ajouté";
}

export async function saveProfileViaApi(payload: {
  prenom: string;
  nom: string;
  email: string;
  avatarUrl?: string | null;
  currentPassword?: string;
  newPassword?: string;
}) {
  const body = {
    fullName: `${payload.prenom.trim()} ${payload.nom.trim()}`.trim(),
    email: payload.email.trim(),
    avatarUrl: payload.avatarUrl ?? undefined,
    currentPassword: payload.currentPassword || undefined,
    newPassword: payload.newPassword || undefined,
  };

  await apiFetch("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return "Profil mis à jour";
}

export async function deleteArticleViaApi(articleId: string) {
  assertMongoApiId(articleId, "Article");
  await apiFetch(`/api/items/${articleId}`, { method: "DELETE" });
  return "Article supprimé";
}

export async function deleteEventViaApi(eventId: string) {
  assertMongoApiId(eventId, "Événement");
  await apiFetch(`/api/events/${eventId}`, { method: "DELETE" });
  return "Événement supprimé";
}

export async function deleteUserViaApi(userId: string) {
  assertMongoApiId(userId, "Utilisateur");
  await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
  return "Utilisateur supprimé";
}

function mapCategoryRow(row: CategoryApiRow): CategoryWithCount {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    description: row.description ?? null,
    photoUrl: row.photoUrl ?? null,
    icon: row.icon ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    active: row.active !== false,
    level: row.level ?? 0,
    parentId: row.parentId ?? null,
    parent: row.parent ?? null,
    itemCount: row.itemCount ?? row._count?.items ?? 0,
    childrenCount: row.childrenCount ?? row._count?.children ?? 0,
  };
}

export async function fetchCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const rows = await apiFetch<CategoryApiRow[]>("/api/categories");
  return rows.map(mapCategoryRow);
}

export async function createCategoryViaApi(body: CategoryFormPayload): Promise<CategoryDto> {
  return apiFetch<CategoryDto>("/api/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCategoryViaApi(
  categoryId: string,
  body: Partial<CategoryFormPayload>,
): Promise<CategoryDto> {
  assertMongoApiId(categoryId, "Catégorie");
  return apiFetch<CategoryDto>(`/api/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function toggleCategoryActiveViaApi(categoryId: string, active: boolean): Promise<CategoryDto> {
  return updateCategoryViaApi(categoryId, { active });
}

export async function deleteCategoryViaApi(categoryId: string): Promise<void> {
  assertMongoApiId(categoryId, "Catégorie");
  await apiFetch(`/api/categories/${categoryId}`, { method: "DELETE" });
}

export type { WarehouseKindUi };

export type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  kind: string;
  kindLabel: WarehouseKindUi;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  totalCapacity: number | null;
  capacityUnit: string | null;
  managerName: string | null;
  managerPhone: string | null;
  managerEmail: string | null;
  accessHours: string | null;
  specialConditions: string[];
  notes: string | null;
  active: boolean;
  zoneCount?: number;
};

export type WarehouseFormPayload = {
  id?: string;
  name: string;
  code: string;
  kind: WarehouseKindUi;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  totalCapacity?: number | null;
  capacityUnit?: string;
  managerName?: string;
  managerPhone?: string;
  managerEmail?: string;
  accessHours?: string;
  specialConditionsText?: string;
  notes?: string;
  active: boolean;
};

function warehouseBodyFromPayload(payload: WarehouseFormPayload) {
  return {
    name: payload.name.trim(),
    code: payload.code.trim().toUpperCase(),
    kind: warehouseKindFromUi(payload.kind),
    address: payload.address?.trim() || undefined,
    city: payload.city?.trim() || undefined,
    latitude: payload.latitude ?? undefined,
    longitude: payload.longitude ?? undefined,
    totalCapacity: payload.totalCapacity ?? undefined,
    capacityUnit: payload.capacityUnit?.trim() || undefined,
    managerName: payload.managerName?.trim() || undefined,
    managerPhone: payload.managerPhone?.trim() || undefined,
    managerEmail: payload.managerEmail?.trim() || undefined,
    accessHours: payload.accessHours?.trim() || undefined,
    specialConditions: payload.specialConditionsText
      ? parseWarehouseConditionsText(payload.specialConditionsText)
      : undefined,
    notes: payload.notes?.trim() || undefined,
    active: payload.active,
  };
}

export async function fetchWarehouses(): Promise<WarehouseRow[]> {
  return apiFetch<WarehouseRow[]>("/api/warehouses");
}

export async function createWarehouseViaApi(payload: WarehouseFormPayload): Promise<WarehouseRow> {
  return apiFetch<WarehouseRow>("/api/warehouses", {
    method: "POST",
    body: JSON.stringify(warehouseBodyFromPayload(payload)),
  });
}

export async function updateWarehouseViaApi(
  warehouseId: string,
  payload: Partial<WarehouseFormPayload>,
): Promise<WarehouseRow> {
  assertMongoApiId(warehouseId, "Entrepôt");
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.code !== undefined) body.code = payload.code.trim().toUpperCase();
  if (payload.kind !== undefined) body.kind = warehouseKindFromUi(payload.kind);
  if (payload.address !== undefined) body.address = payload.address.trim() || null;
  if (payload.city !== undefined) body.city = payload.city.trim() || null;
  if (payload.latitude !== undefined) body.latitude = payload.latitude;
  if (payload.longitude !== undefined) body.longitude = payload.longitude;
  if (payload.totalCapacity !== undefined) body.totalCapacity = payload.totalCapacity;
  if (payload.capacityUnit !== undefined) body.capacityUnit = payload.capacityUnit.trim() || null;
  if (payload.managerName !== undefined) body.managerName = payload.managerName.trim() || null;
  if (payload.managerPhone !== undefined) body.managerPhone = payload.managerPhone.trim() || null;
  if (payload.managerEmail !== undefined) body.managerEmail = payload.managerEmail.trim() || null;
  if (payload.accessHours !== undefined) body.accessHours = payload.accessHours.trim() || null;
  if (payload.specialConditionsText !== undefined) {
    body.specialConditions = parseWarehouseConditionsText(payload.specialConditionsText);
  }
  if (payload.notes !== undefined) body.notes = payload.notes.trim() || null;
  if (payload.active !== undefined) body.active = payload.active;
  return apiFetch<WarehouseRow>(`/api/warehouses/${warehouseId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function saveWarehouseViaApi(payload: WarehouseFormPayload): Promise<string> {
  if (payload.id) {
    await updateWarehouseViaApi(payload.id, payload);
    return "Site mis à jour";
  }
  await createWarehouseViaApi(payload);
  return "Entrepôt / magasin créé";
}

export async function toggleWarehouseActiveViaApi(
  warehouseId: string,
  active: boolean,
): Promise<WarehouseRow> {
  return updateWarehouseViaApi(warehouseId, { active });
}

export async function deleteWarehouseViaApi(warehouseId: string): Promise<void> {
  assertMongoApiId(warehouseId, "Entrepôt");
  await apiFetch(`/api/warehouses/${warehouseId}`, { method: "DELETE" });
}

export type { StorageZoneTypeUi, StorageZoneAccessUi };

export type StorageZoneRow = {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  zoneType: string;
  zoneTypeLabel: StorageZoneTypeUi;
  locationLabel: string | null;
  totalCapacity: number | null;
  capacityUnit: string | null;
  accessType: string;
  accessTypeLabel: StorageZoneAccessUi;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  shelvingCount?: number;
  locationCount?: number;
};

export type StorageZoneFormPayload = {
  id?: string;
  warehouseId: string;
  name: string;
  code: string;
  zoneType: StorageZoneTypeUi;
  locationLabel?: string;
  totalCapacity?: number | null;
  capacityUnit?: string;
  accessType: StorageZoneAccessUi;
  notes?: string;
  active: boolean;
};

function storageZoneBodyFromPayload(payload: StorageZoneFormPayload) {
  return {
    name: payload.name.trim(),
    code: payload.code.trim().toUpperCase(),
    zoneType: zoneTypeFromUi(payload.zoneType),
    locationLabel: payload.locationLabel?.trim() || undefined,
    totalCapacity: payload.totalCapacity ?? undefined,
    capacityUnit: payload.capacityUnit?.trim() || undefined,
    accessType: zoneAccessFromUi(payload.accessType),
    notes: payload.notes?.trim() || undefined,
    active: payload.active,
  };
}

export async function fetchStorageZones(warehouseId: string): Promise<StorageZoneRow[]> {
  assertMongoApiId(warehouseId, "Entrepôt");
  return apiFetch<StorageZoneRow[]>(`/api/warehouses/${warehouseId}/zones`);
}

export async function saveStorageZoneViaApi(payload: StorageZoneFormPayload): Promise<string> {
  assertMongoApiId(payload.warehouseId, "Entrepôt");
  const body = storageZoneBodyFromPayload(payload);
  if (payload.id) {
    assertMongoApiId(payload.id, "Zone");
    await apiFetch(`/api/warehouses/${payload.warehouseId}/zones/${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return "Zone mise à jour";
  }
  await apiFetch(`/api/warehouses/${payload.warehouseId}/zones`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return "Zone créée";
}

export async function deleteStorageZoneViaApi(warehouseId: string, zoneId: string): Promise<void> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  await apiFetch(`/api/warehouses/${warehouseId}/zones/${zoneId}`, { method: "DELETE" });
}

export async function toggleStorageZoneActiveViaApi(
  warehouseId: string,
  zoneId: string,
  active: boolean,
): Promise<StorageZoneRow> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  return apiFetch<StorageZoneRow>(`/api/warehouses/${warehouseId}/zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export type { ShelvingLevelUi, ShelvingMaterialUi };

export type ShelvingNodeRow = {
  id: string;
  storageZoneId: string;
  parentId: string | null;
  level: string;
  levelLabel: ShelvingLevelUi;
  code: string;
  label: string | null;
  coordinate: string;
  materialType: string | null;
  materialTypeLabel: ShelvingMaterialUi | null;
  weightCapacityKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  dimensionsLabel: string | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
};

export type ShelvingNodeFormPayload = {
  id?: string;
  warehouseId: string;
  storageZoneId: string;
  parentId?: string | null;
  level: ShelvingLevelUi;
  code: string;
  label?: string;
  materialType?: ShelvingMaterialUi | null;
  weightCapacityKg?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  depthCm?: number | null;
  notes?: string;
  active: boolean;
};

function shelvingBodyFromPayload(payload: ShelvingNodeFormPayload) {
  return {
    parentId: payload.parentId ?? null,
    level: shelvingLevelFromUi(payload.level),
    code: payload.code.trim().toUpperCase(),
    label: payload.label?.trim() || undefined,
    materialType: payload.materialType ? shelvingMaterialFromUi(payload.materialType) : undefined,
    weightCapacityKg: payload.weightCapacityKg ?? undefined,
    widthCm: payload.widthCm ?? undefined,
    heightCm: payload.heightCm ?? undefined,
    depthCm: payload.depthCm ?? undefined,
    notes: payload.notes?.trim() || undefined,
    active: payload.active,
  };
}

export async function fetchShelvingNodes(
  warehouseId: string,
  zoneId: string,
): Promise<ShelvingNodeRow[]> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  return apiFetch<ShelvingNodeRow[]>(
    `/api/warehouses/${warehouseId}/zones/${zoneId}/shelving`,
  );
}

export async function saveShelvingNodeViaApi(payload: ShelvingNodeFormPayload): Promise<string> {
  assertMongoApiId(payload.warehouseId, "Entrepôt");
  assertMongoApiId(payload.storageZoneId, "Zone");
  const body = shelvingBodyFromPayload(payload);
  if (payload.id) {
    assertMongoApiId(payload.id, "Élément");
    await apiFetch(
      `/api/warehouses/${payload.warehouseId}/zones/${payload.storageZoneId}/shelving/${payload.id}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    return "Élément mis à jour";
  }
  await apiFetch(
    `/api/warehouses/${payload.warehouseId}/zones/${payload.storageZoneId}/shelving`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return "Élément créé";
}

export async function deleteShelvingNodeViaApi(
  warehouseId: string,
  zoneId: string,
  nodeId: string,
): Promise<void> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  assertMongoApiId(nodeId, "Élément");
  await apiFetch(`/api/warehouses/${warehouseId}/zones/${zoneId}/shelving/${nodeId}`, {
    method: "DELETE",
  });
}

export async function toggleShelvingNodeActiveViaApi(
  warehouseId: string,
  zoneId: string,
  nodeId: string,
  active: boolean,
): Promise<ShelvingNodeRow> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  assertMongoApiId(nodeId, "Élément");
  return apiFetch<ShelvingNodeRow>(
    `/api/warehouses/${warehouseId}/zones/${zoneId}/shelving/${nodeId}`,
    { method: "PATCH", body: JSON.stringify({ active }) },
  );
}

export type { StorageLocationFillStateUi };

export type StorageLocationRow = {
  id: string;
  warehouseId: string;
  storageZoneId: string;
  shelvingNodeId: string | null;
  code: string;
  label: string | null;
  hierarchyCoordinate: string | null;
  latitude: number | null;
  longitude: number | null;
  maxWeightKg: number | null;
  maxVolumeM3: number | null;
  maxItemCount: number | null;
  fillState: string;
  fillStateLabel: StorageLocationFillStateUi;
  minTempC: number | null;
  maxTempC: number | null;
  humidityPercent: number | null;
  accessHeightCm: number | null;
  accessWidthCm: number | null;
  specialConditions: string[];
  notes: string | null;
  active: boolean;
  sortOrder: number;
};

export type StorageLocationFormPayload = {
  id?: string;
  warehouseId: string;
  storageZoneId: string;
  shelvingNodeId?: string | null;
  code: string;
  label?: string;
  hierarchyCoordinate?: string;
  latitude?: number | null;
  longitude?: number | null;
  maxWeightKg?: number | null;
  maxVolumeM3?: number | null;
  maxItemCount?: number | null;
  fillState: StorageLocationFillStateUi;
  minTempC?: number | null;
  maxTempC?: number | null;
  humidityPercent?: number | null;
  accessHeightCm?: number | null;
  accessWidthCm?: number | null;
  specialConditionsText?: string;
  notes?: string;
  active: boolean;
};

function storageLocationBodyFromPayload(payload: StorageLocationFormPayload) {
  return {
    shelvingNodeId: payload.shelvingNodeId ?? null,
    code: payload.code.trim().toUpperCase(),
    label: payload.label?.trim() || undefined,
    hierarchyCoordinate: payload.hierarchyCoordinate?.trim().toUpperCase() || undefined,
    latitude: payload.latitude ?? undefined,
    longitude: payload.longitude ?? undefined,
    maxWeightKg: payload.maxWeightKg ?? undefined,
    maxVolumeM3: payload.maxVolumeM3 ?? undefined,
    maxItemCount: payload.maxItemCount ?? undefined,
    fillState: fillStateFromUi(payload.fillState),
    minTempC: payload.minTempC ?? undefined,
    maxTempC: payload.maxTempC ?? undefined,
    humidityPercent: payload.humidityPercent ?? undefined,
    accessHeightCm: payload.accessHeightCm ?? undefined,
    accessWidthCm: payload.accessWidthCm ?? undefined,
    specialConditions: parseLocationConditionsText(payload.specialConditionsText ?? ""),
    notes: payload.notes?.trim() || undefined,
    active: payload.active,
  };
}

export async function fetchStorageLocations(
  warehouseId: string,
  zoneId: string,
): Promise<StorageLocationRow[]> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  return apiFetch<StorageLocationRow[]>(
    `/api/warehouses/${warehouseId}/zones/${zoneId}/locations`,
  );
}

export async function saveStorageLocationViaApi(
  payload: StorageLocationFormPayload,
): Promise<string> {
  assertMongoApiId(payload.warehouseId, "Entrepôt");
  assertMongoApiId(payload.storageZoneId, "Zone");
  const body = storageLocationBodyFromPayload(payload);
  if (payload.id) {
    assertMongoApiId(payload.id, "Emplacement");
    await apiFetch(
      `/api/warehouses/${payload.warehouseId}/zones/${payload.storageZoneId}/locations/${payload.id}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    return "Emplacement mis à jour";
  }
  await apiFetch(
    `/api/warehouses/${payload.warehouseId}/zones/${payload.storageZoneId}/locations`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return "Emplacement créé";
}

export async function deleteStorageLocationViaApi(
  warehouseId: string,
  zoneId: string,
  locationId: string,
): Promise<void> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  assertMongoApiId(locationId, "Emplacement");
  await apiFetch(
    `/api/warehouses/${warehouseId}/zones/${zoneId}/locations/${locationId}`,
    { method: "DELETE" },
  );
}

export async function toggleStorageLocationActiveViaApi(
  warehouseId: string,
  zoneId: string,
  locationId: string,
  active: boolean,
): Promise<StorageLocationRow> {
  assertMongoApiId(warehouseId, "Entrepôt");
  assertMongoApiId(zoneId, "Zone");
  assertMongoApiId(locationId, "Emplacement");
  return apiFetch<StorageLocationRow>(
    `/api/warehouses/${warehouseId}/zones/${zoneId}/locations/${locationId}`,
    { method: "PATCH", body: JSON.stringify({ active }) },
  );
}

export type StockQtyTotalsRow = {
  physicalQty: number;
  systemQty: number;
  availableQty: number;
  reservedQty: number;
  inTransitQty: number;
  varianceQty: number;
};

export type LocationStockLineRow = StockQtyTotalsRow & {
  id: string;
  itemId: string;
  itemVariantId: string | null;
  itemName: string;
  itemReference: string;
  itemEmoji: string;
  variantLabel: string | null;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  storageZoneId: string;
  zoneName: string;
  zoneCode: string;
  storageLocationId: string;
  locationCode: string;
  locationLabel: string | null;
  hierarchyCoordinate: string | null;
  updatedAt: string;
};

export type LocationStockSummaryResponse = {
  totals: StockQtyTotalsRow;
  catalogTotals: {
    totalQuantity: number;
    availableQty: number;
    reservedQty: number;
    repairQty: number;
  };
  unallocated: {
    availableQty: number;
    reservedQty: number;
    systemQty: number;
  };
  byWarehouse: Array<{ id: string; name: string; code: string; totals: StockQtyTotalsRow }>;
  byZone: Array<{ id: string; warehouseId: string; totals: StockQtyTotalsRow }>;
  byLocation: Array<{
    id: string;
    warehouseId: string;
    storageZoneId: string;
    totals: StockQtyTotalsRow;
  }>;
};

export type LocationStockFormPayload = {
  itemId: string;
  itemVariantId?: string | null;
  warehouseId: string;
  storageZoneId: string;
  storageLocationId: string;
  physicalQty: number;
  systemQty: number;
  availableQty: number;
  reservedQty: number;
  inTransitQty: number;
};

export async function fetchLocationStockSummary(
  warehouseId?: string,
): Promise<LocationStockSummaryResponse> {
  const q = new URLSearchParams({ summary: "1" });
  if (warehouseId) {
    q.set("warehouseId", warehouseId);
  }
  return apiFetch<LocationStockSummaryResponse>(`/api/stock/by-location?${q.toString()}`);
}

export async function fetchLocationStockLines(params?: {
  warehouseId?: string;
  storageZoneId?: string;
  storageLocationId?: string;
  itemId?: string;
}): Promise<LocationStockLineRow[]> {
  const q = new URLSearchParams();
  if (params?.warehouseId) {
    q.set("warehouseId", params.warehouseId);
  }
  if (params?.storageZoneId) {
    q.set("storageZoneId", params.storageZoneId);
  }
  if (params?.storageLocationId) {
    q.set("storageLocationId", params.storageLocationId);
  }
  if (params?.itemId) {
    q.set("itemId", params.itemId);
  }
  const qs = q.toString();
  return apiFetch<LocationStockLineRow[]>(`/api/stock/by-location${qs ? `?${qs}` : ""}`);
}

export async function saveLocationStockViaApi(
  payload: LocationStockFormPayload,
): Promise<LocationStockLineRow> {
  assertMongoApiId(payload.itemId, "Article");
  assertMongoApiId(payload.warehouseId, "Entrepôt");
  assertMongoApiId(payload.storageZoneId, "Zone");
  assertMongoApiId(payload.storageLocationId, "Emplacement");
  if (payload.itemVariantId) {
    assertMongoApiId(payload.itemVariantId, "Variante");
  }
  return apiFetch<LocationStockLineRow>("/api/stock/by-location", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLocationStockViaApi(balanceId: string): Promise<void> {
  assertMongoApiId(balanceId, "Ligne");
  await apiFetch(`/api/stock/by-location/${balanceId}`, { method: "DELETE" });
}

// --- APIs complémentaires (détail, recherche, journal, tableau de bord, import masse) ---

export type DashboardResponse = {
  metrics: {
    items: number;
    activeEvents: number;
    alerts: number;
    movements: number;
    stockValueEstimate: number;
    allocationRatePct: number;
  };
  alerts: Array<{
    id: string;
    name: string;
    availableQty: number;
    minThreshold: number;
    reference: string;
  }>;
  movementByType: Record<string, number>;
  movementsSeries14d: Array<{
    day: string;
    outbound: number;
    returns: number;
    other: number;
    total: number;
  }>;
};

export async function fetchDashboardFromApi(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/api/dashboard");
}

export type SearchResponse = {
  query: string;
  items: ItemDto[];
  events: EventDto[];
  users: UserDto[];
};

export async function searchViaApi(q: string): Promise<SearchResponse> {
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    return { query: trimmed, items: [], events: [], users: [] };
  }
  return apiFetch<SearchResponse>(`/api/search?q=${encodeURIComponent(trimmed)}`);
}

export type AuditLogsResponse = {
  total: number;
  take: number;
  skip: number;
  logs: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    payload: string | null;
    organizationId: string;
    actorId: string;
    createdAt: string;
    actor: { id: string; fullName: string; email: string };
  }>;
};

export async function fetchAuditLogsFromApi(options?: { take?: number; skip?: number }): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (options?.take != null) {
    params.set("take", String(options.take));
  }
  if (options?.skip != null) {
    params.set("skip", String(options.skip));
  }
  const qs = params.toString();
  return apiFetch<AuditLogsResponse>(`/api/audit-logs${qs ? `?${qs}` : ""}`);
}

type BulkItemRow = {
  name: string;
  reference: string;
  categoryId: string;
  unitValue: number;
  totalQuantity: number;
  minThreshold?: number;
};

const BULK_MAX = 150;

export async function importArticlesBulkViaApi(rows: BulkItemRow[]): Promise<{ count: number }> {
  if (rows.length === 0) {
    return { count: 0 };
  }
  let total = 0;
  for (let i = 0; i < rows.length; i += BULK_MAX) {
    const chunk = rows.slice(i, i + BULK_MAX);
    const res = await apiFetch<{ count: number }>("/api/items/bulk", {
      method: "POST",
      body: JSON.stringify({ items: chunk }),
    });
    total += res.count;
  }
  return { count: total };
}

/** Résout les catégories (création si besoin) puis envoie des paquets vers POST /api/items/bulk. */
export async function importCatalogueRowsViaApi(
  rows: Array<{
    nom: string;
    ref: string;
    cat: string;
    qtyTotal: number;
    valUnit: number;
    seuilMin: number;
  }>,
): Promise<{ count: number }> {
  const categories = await apiFetch<CategoryDto[]>("/api/categories");
  const catMap = new Map<string, string>();
  for (const c of categories) {
    catMap.set(c.name.trim().toLowerCase(), c.id);
    catMap.set(c.slug.trim().toLowerCase(), c.id);
  }

  const items: BulkItemRow[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const key = row.cat.trim().toLowerCase() || "autre";
    let categoryId = catMap.get(key);
    if (!categoryId) {
      const slug = (key.replace(/\s+/g, "-") || "autre").slice(0, 80);
      const created = await apiFetch<CategoryDto>("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: row.cat.trim() || "Autre",
          slug,
          code: proposeCategoryCode(slug),
          active: true,
        }),
      });
      categoryId = created.id;
      catMap.set(key, categoryId);
    }
    const reference = row.ref.trim() || `CSV-${Date.now()}-${i}`;
    items.push({
      name: row.nom.trim(),
      reference,
      categoryId,
      unitValue: row.valUnit,
      totalQuantity: Math.max(1, row.qtyTotal),
      minThreshold: row.seuilMin,
    });
  }

  return importArticlesBulkViaApi(items);
}

