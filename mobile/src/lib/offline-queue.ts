import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch } from "@/lib/api";
import { replaceOfflineDraftId, type CachedDocument } from "@/lib/offline-cache";
import {
  newOfflineTempDocumentId,
  resolveOfflineDocumentId,
} from "@/lib/offline-id";

const STORAGE_KEY = "cdc_offline_queue_v1";

/** Au-delà de ce seuil, l’action reste en file mais n’est plus rejouée automatiquement. */
export const OFFLINE_MAX_ATTEMPTS = 8;

export type OfflineActionType =
  | "create_document"
  | "scan"
  | "sign"
  | "portique"
  | "incident"
  | "event_loading"
  | "event_be_ret";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  documentId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  clientTempId?: string;
  idempotencyKey: string;
  lastError?: string;
  attempts?: number;
};

type FlushResult = {
  synced: number;
  failed: number;
  skipped: number;
  idMap: Record<string, string>;
};

let queueListeners: Array<() => void> = [];

function notifyQueueChanged(): void {
  for (const fn of queueListeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  queueListeners.push(listener);
  return () => {
    queueListeners = queueListeners.filter((l) => l !== listener);
  };
}

async function readQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineAction[];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineAction[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notifyQueueChanged();
}

function buildIdempotencyKey(
  action: Omit<OfflineAction, "id" | "createdAt" | "attempts" | "idempotencyKey">,
): string {
  if (action.clientTempId) {
    return `${action.type}:${action.clientTempId}`;
  }
  if (action.documentId) {
    return `${action.type}:${action.documentId}`;
  }
  return `${action.type}:${JSON.stringify(action.payload).slice(0, 120)}`;
}

function apiHeadersForAction(action: OfflineAction): Record<string, string> {
  return { "Idempotency-Key": action.idempotencyKey };
}

export { newOfflineTempDocumentId } from "@/lib/offline-id";

export async function enqueueOfflineAction(
  action: Omit<OfflineAction, "id" | "createdAt" | "attempts" | "idempotencyKey">,
): Promise<OfflineAction> {
  const idempotencyKey = buildIdempotencyKey(action);
  const q = await readQueue();
  const existing = q.find((a) => a.idempotencyKey === idempotencyKey);
  if (existing) {
    return existing;
  }
  const entry: OfflineAction = {
    ...action,
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
    idempotencyKey,
  };
  q.push(entry);
  await writeQueue(q);
  return entry;
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  return readQueue();
}

export async function clearOfflineAction(id: string): Promise<void> {
  await writeQueue((await readQueue()).filter((a) => a.id !== id));
}

export async function resetOfflineActionAttempts(id: string): Promise<void> {
  const q = await readQueue();
  await writeQueue(
    q.map((a) => (a.id === id ? { ...a, attempts: 0, lastError: undefined } : a)),
  );
}

async function markActionFailed(id: string, error: string): Promise<void> {
  const q = await readQueue();
  const next = q.map((a) =>
    a.id === id
      ? { ...a, attempts: (a.attempts ?? 0) + 1, lastError: error.slice(0, 200) }
      : a,
  );
  await writeQueue(next);
}

async function applyCreateDocument(
  action: OfflineAction,
  idMap: Record<string, string>,
): Promise<boolean> {
  const payload = action.payload;
  const res = await apiFetch("/api/terrain/documents", {
    method: "POST",
    headers: apiHeadersForAction(action),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    id?: string;
    documentNumber?: string;
    kind?: string;
    status?: string;
    clientTempId?: string | null;
  };
  if (!res.ok) {
    await markActionFailed(action.id, data.message ?? `HTTP ${res.status}`);
    return false;
  }
  const tempId =
    action.clientTempId ??
    (typeof payload.clientTempId === "string" ? payload.clientTempId : undefined) ??
    action.documentId;
  if (tempId && data.id) {
    idMap[tempId] = data.id;
    const serverDoc: CachedDocument = {
      id: data.id,
      documentNumber: data.documentNumber ?? "—",
      kind: data.kind ?? "BS",
      status: data.status ?? "DRAFT",
    };
    await replaceOfflineDraftId(tempId, serverDoc);
  }
  await clearOfflineAction(action.id);
  return true;
}

async function applyScan(
  action: OfflineAction,
  idMap: Record<string, string>,
): Promise<boolean> {
  const docId = resolveOfflineDocumentId(action.documentId, idMap);
  if (!docId) {
    await markActionFailed(action.id, "Bon introuvable après sync");
    return false;
  }
  const handheldId = action.payload.handheldId;
  const url =
    typeof handheldId === "string" && handheldId
      ? "/api/handheld/scan"
      : `/api/stock-documents/${docId}/scan`;
  const body =
    typeof handheldId === "string" && handheldId
      ? { tagCodes: action.payload.tagCodes, documentId: docId, handheldId }
      : { ...action.payload, tagCodes: action.payload.tagCodes };
  const res = await apiFetch(url, {
    method: "POST",
    headers: apiHeadersForAction(action),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    await markActionFailed(action.id, data.message ?? `HTTP ${res.status}`);
    return false;
  }
  await clearOfflineAction(action.id);
  return true;
}

async function applySign(
  action: OfflineAction,
  idMap: Record<string, string>,
): Promise<boolean> {
  const docId = resolveOfflineDocumentId(action.documentId, idMap);
  if (!docId) {
    await markActionFailed(action.id, "Bon introuvable après sync");
    return false;
  }
  const res = await apiFetch(`/api/stock-documents/${docId}/sign`, {
    method: "POST",
    headers: apiHeadersForAction(action),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    await markActionFailed(action.id, data.message ?? `HTTP ${res.status}`);
    return false;
  }
  await clearOfflineAction(action.id);
  return true;
}

async function applyEventLifecycle(action: OfflineAction): Promise<boolean> {
  const eventId = action.payload.eventId;
  if (typeof eventId !== "string" || !eventId) {
    await markActionFailed(action.id, "Événement manquant");
    return false;
  }
  const path =
    action.type === "event_loading"
      ? `/api/events/${eventId}/loading`
      : `/api/events/${eventId}/be-ret`;
  const res = await apiFetch(path, {
    method: "POST",
    headers: apiHeadersForAction(action),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; documentNumber?: string };
  if (!res.ok) {
    await markActionFailed(action.id, data.message ?? `HTTP ${res.status}`);
    return false;
  }
  await clearOfflineAction(action.id);
  return true;
}

async function applyIncident(action: OfflineAction): Promise<boolean> {
  const res = await apiFetch("/api/terrain/incidents", {
    method: "POST",
    headers: apiHeadersForAction(action),
    body: JSON.stringify(action.payload),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    await markActionFailed(action.id, data.message ?? `HTTP ${res.status}`);
    return false;
  }
  await clearOfflineAction(action.id);
  return true;
}

async function applyPortique(action: OfflineAction): Promise<boolean> {
  const res = await apiFetch("/api/portique/scan", {
    method: "POST",
    headers: apiHeadersForAction(action),
    body: JSON.stringify(action.payload),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    await markActionFailed(action.id, data.message ?? `HTTP ${res.status}`);
    return false;
  }
  await clearOfflineAction(action.id);
  return true;
}

export async function flushOfflineQueue(): Promise<FlushResult> {
  const idMap: Record<string, string> = {};
  let synced = 0;
  let failed = 0;
  let skipped = 0;
  const queue = await readQueue();

  for (const action of queue) {
    if ((action.attempts ?? 0) >= OFFLINE_MAX_ATTEMPTS) {
      skipped += 1;
      continue;
    }
    try {
      let ok = false;
      if (action.type === "create_document") {
        ok = await applyCreateDocument(action, idMap);
      } else if (action.type === "scan") {
        ok = await applyScan(action, idMap);
      } else if (action.type === "sign") {
        ok = await applySign(action, idMap);
      } else if (action.type === "portique") {
        ok = await applyPortique(action);
      } else if (action.type === "incident") {
        ok = await applyIncident(action);
      } else if (action.type === "event_loading" || action.type === "event_be_ret") {
        ok = await applyEventLifecycle(action);
      } else {
        await markActionFailed(action.id, "Type d'action inconnu");
      }
      if (ok) synced += 1;
      else failed += 1;
    } catch (err) {
      await markActionFailed(
        action.id,
        err instanceof Error ? err.message : "Erreur réseau",
      );
      failed += 1;
    }
  }

  if (Object.keys(idMap).length > 0) {
    const remaining = await readQueue();
    const remapped = remaining.map((a) => {
      const docId = a.documentId ? resolveOfflineDocumentId(a.documentId, idMap) : a.documentId;
      const clientTempId = a.clientTempId
        ? resolveOfflineDocumentId(a.clientTempId, idMap)
        : a.clientTempId;
      if (docId === a.documentId && clientTempId === a.clientTempId) return a;
      return { ...a, documentId: docId, clientTempId };
    });
    await writeQueue(remapped);
  }

  return { synced, failed, skipped, idMap };
}
