import { assertMongoApiId } from "./mongo-id";
import { clearSession } from "./session";
import type { Role, ReturnCondition, StockState } from "./types";

/**
 * Une chaîne vide dans .env (`NEXT_PUBLIC_API_BASE_URL=`) reste définie : `??` ne retombe pas sur le défaut,
 * ce qui produit des `fetch("/api/...")` vers le front (404) au lieu du backend.
 */
function getEnvApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!raw) {
    return "http://localhost:3001";
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

type BackendUserRole = "ADMIN" | "MANAGER" | "STOREKEEPER" | "VIEWER";
type BackendMovementType = "OUTBOUND" | "RETURN" | "ADJUSTMENT";
type BackendReturnCondition = "OK" | "DAMAGED" | "MISSING";

function roleToBackend(role: Role): BackendUserRole {
  switch (role) {
    case "Administrateur":
      return "ADMIN";
    case "Gestionnaire":
      return "MANAGER";
    case "Magasinier":
      return "STOREKEEPER";
    default:
      return "VIEWER";
  }
}

function roleFromBackend(role: BackendUserRole): Role {
  switch (role) {
    case "ADMIN":
      return "Administrateur";
    case "MANAGER":
      return "Gestionnaire";
    case "STOREKEEPER":
      return "Magasinier";
    default:
      return "Lecture seule";
  }
}

function movementTypeFromBackend(type: BackendMovementType): StockState["mouvements"][number]["type"] {
  switch (type) {
    case "OUTBOUND":
      return "Sortie";
    case "RETURN":
      return "Retour";
    default:
      return "Réception";
  }
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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const apiBase = getResolvedApiBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
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
      throw new Error(
        `Impossible de contacter l’API (${apiBase}) : ${err.message}. Démarrez le backend (npm run dev:backend, port 3001) et contrôlez NEXT_PUBLIC_API_BASE_URL.${hint}`,
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
      message =
        "API introuvable (404). Vérifiez NEXT_PUBLIC_API_BASE_URL (ex. http://localhost:3001) et que le backend tourne sur ce port.";
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export type CategoryDto = { id: string; name: string; slug: string };

export type CategoryWithCount = CategoryDto & { itemCount: number };

type CategoryApiRow = CategoryDto & { _count?: { items: number } };
type ItemDto = {
  id: string;
  name: string;
  reference: string;
  categoryId?: string | null;
  unitValue: number;
  totalQuantity: number;
  allocatedQty: number;
  minThreshold: number;
  photoUrl?: string | null;
};
type EventDto = {
  id: string;
  name: string;
  clientName: string;
  startsAt: string;
  endsAt: string;
  location: string;
  owner?: { fullName?: string } | null;
};
type MovementDto = {
  id: string;
  movementType: BackendMovementType;
  itemId: string;
  quantity: number;
  eventId?: string | null;
  actor?: { fullName?: string } | null;
  returnCondition?: BackendReturnCondition | null;
  notes?: string | null;
  createdAt: string;
};
type UserDto = {
  id: string;
  username?: string | null;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role: BackendUserRole;
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

export async function loginViaApi(identifier: string, password: string): Promise<{ user: AuthMeUser }> {
  const apiBase = getResolvedApiBaseUrl();
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  const ct = response.headers.get("content-type") ?? "";
  if (!response.ok) {
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
    }
    throw new Error(message);
  }
  return (await response.json()) as { user: AuthMeUser };
}

export async function logoutViaApi(): Promise<void> {
  const apiBase = getResolvedApiBaseUrl();
  await fetch(`${apiBase}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

/** Session cookie (sans effet de bord si 401). */
export async function fetchAuthMe(): Promise<AuthMeUser | null> {
  const apiBase = getResolvedApiBaseUrl();
  const response = await fetch(`${apiBase}/api/auth/me`, { credentials: "include" });
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
      actif: true,
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

  const categoriesById = new Map(categories.map((category) => [category.id, category.name]));

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
      actif: true,
    };
  });

  const fallbackCurrentUser = nextUsers[0]?.id ?? previous.currentUser;

  return {
    ...previous,
    articles: items.map((item) => ({
      id: item.id,
      nom: item.name,
      ref: item.reference,
      cat:
        (item.categoryId ? categoriesById.get(item.categoryId) : undefined) ?? "Autre",
      qtyTotal: item.totalQuantity,
      qtyAff: item.allocatedQty,
      valUnit: item.unitValue,
      seuilMin: item.minThreshold,
      emoji: "📦",
      notes: item.photoUrl ?? "",
    })),
    evenements: events.map((event) => ({
      id: event.id,
      nom: event.name,
      client: event.clientName,
      debut: event.startsAt.slice(0, 10),
      fin: event.endsAt.slice(0, 10),
      lieu: event.location,
      resp: event.owner?.fullName ?? "",
      statut: "Planifié",
      notes: "",
    })),
    mouvements: movements.map((movement) => ({
      id: movement.id,
      type: movementTypeFromBackend(movement.movementType),
      articleId: movement.itemId,
      qty: movement.quantity,
      evId: movement.eventId ?? "",
      operateur: movement.actor?.fullName ?? "",
      etat: movement.returnCondition ?? "",
      note: movement.notes ?? "",
      date: movement.createdAt,
    })),
    utilisateurs: nextUsers,
    currentUser: nextUsers.some((user) => user.id === previous.currentUser)
      ? previous.currentUser
      : fallbackCurrentUser,
  };
}

async function resolveCategoryId(cat: string): Promise<string> {
  const categories = await apiFetch<CategoryDto[]>("/api/categories");
  const normalized = cat.trim().toLowerCase();
  const existing = categories.find(
    (category) => category.name.trim().toLowerCase() === normalized || category.slug.trim().toLowerCase() === normalized,
  );
  if (existing) {
    return existing.id;
  }

  const slug = normalized.replace(/\s+/g, "-");
  const created = await apiFetch<CategoryDto>("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name: cat.trim(), slug }),
  });
  return created.id;
}

export async function saveArticleViaApi(payload: {
  id?: string;
  nom: string;
  ref: string;
  cat: string;
  qtyTotal: number;
  valUnit: number;
  seuilMin: number;
}) {
  const categoryId = await resolveCategoryId(payload.cat || "Autre");
  const body = {
    name: payload.nom.trim(),
    reference: payload.ref.trim() || `ART-${Date.now()}`,
    categoryId,
    unitValue: payload.valUnit,
    totalQuantity: payload.qtyTotal,
    minThreshold: payload.seuilMin,
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
  assertMongoApiId(payload.artId, "Article");
  if (payload.evId) {
    assertMongoApiId(payload.evId, "Événement");
  }
  await apiFetch("/api/movements", {
    method: "POST",
    body: JSON.stringify({
      movementType: "OUTBOUND",
      itemId: payload.artId,
      eventId: payload.evId || undefined,
      quantity: payload.qty,
      notes: "Affectation événement",
    }),
  });
  return "Affectation enregistrée";
}

export async function saveSortieViaApi(payload: { artId: string; evId: string; qty: number; note: string }) {
  assertMongoApiId(payload.artId, "Article");
  if (payload.evId) {
    assertMongoApiId(payload.evId, "Événement");
  }
  await apiFetch("/api/movements", {
    method: "POST",
    body: JSON.stringify({
      movementType: "OUTBOUND",
      itemId: payload.artId,
      eventId: payload.evId || undefined,
      quantity: payload.qty,
      notes: payload.note || undefined,
    }),
  });
  return "Sortie enregistrée";
}

export async function saveRetourViaApi(payload: {
  artId: string;
  evId: string;
  qty: number;
  etat: ReturnCondition;
  note: string;
}) {
  assertMongoApiId(payload.artId, "Article");
  if (payload.evId) {
    assertMongoApiId(payload.evId, "Événement");
  }
  await apiFetch("/api/movements", {
    method: "POST",
    body: JSON.stringify({
      movementType: "RETURN",
      itemId: payload.artId,
      eventId: payload.evId || undefined,
      quantity: payload.qty,
      returnCondition: returnConditionToBackend(payload.etat),
      notes: payload.note || undefined,
    }),
  });
  return "Retour enregistré";
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

export async function fetchCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const rows = await apiFetch<CategoryApiRow[]>("/api/categories");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    itemCount: row._count?.items ?? 0,
  }));
}

export async function createCategoryViaApi(body: { name: string; slug: string }): Promise<CategoryDto> {
  return apiFetch<CategoryDto>("/api/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCategoryViaApi(
  categoryId: string,
  body: { name?: string; slug?: string },
): Promise<CategoryDto> {
  assertMongoApiId(categoryId, "Catégorie");
  return apiFetch<CategoryDto>(`/api/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteCategoryViaApi(categoryId: string): Promise<void> {
  assertMongoApiId(categoryId, "Catégorie");
  await apiFetch(`/api/categories/${categoryId}`, { method: "DELETE" });
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
        body: JSON.stringify({ name: row.cat.trim() || "Autre", slug }),
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

