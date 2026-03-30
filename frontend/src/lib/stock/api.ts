import type { Role, ReturnCondition, StockState } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Erreur serveur";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // no-op
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

type CategoryDto = { id: string; name: string; slug: string };
type ItemDto = {
  id: string;
  name: string;
  reference: string;
  unitValue: number;
  totalQuantity: number;
  allocatedQty: number;
  minThreshold: number;
  photoUrl?: string | null;
  category: { id: string; name: string };
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

export async function loadStateFromBackend(previous: StockState): Promise<StockState> {
  const [categories, items, events, movements, users] = await Promise.all([
    apiFetch<CategoryDto[]>("/api/categories"),
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
      cat: item.category?.name ?? categoriesById.get(item.category.id) ?? "Autre",
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

export async function saveUserViaApi(payload: {
  id?: string;
  prenom: string;
  nom: string;
  email: string;
  avatarUrl?: string | null;
  role: Role;
}) {
  const body = {
    fullName: `${payload.prenom.trim()} ${payload.nom.trim()}`.trim(),
    email: payload.email.trim(),
    avatarUrl: payload.avatarUrl ?? undefined,
    role: roleToBackend(payload.role),
  };

  if (payload.id) {
    await apiFetch(`/api/users/${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return "Utilisateur mis à jour";
  }

  await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(body),
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
  await apiFetch(`/api/items/${articleId}`, { method: "DELETE" });
  return "Article supprimé";
}

export async function deleteEventViaApi(eventId: string) {
  await apiFetch(`/api/events/${eventId}`, { method: "DELETE" });
  return "Événement supprimé";
}

export async function deleteUserViaApi(userId: string) {
  await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
  return "Utilisateur supprimé";
}

