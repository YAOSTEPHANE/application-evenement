import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch } from "@/lib/api";
import { replaceOfflineDraftId, type CachedDocument } from "@/lib/offline-cache";

const STORAGE_KEY = "cdc_offline_queue_v1";

export type OfflineActionType = "create_document" | "scan" | "sign" | "portique";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  /** Identifiant serveur ou temporaire (`temp_…`) pour scan/sign. */
  documentId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  /** Pour create_document : même valeur que documentId temporaire. */
  clientTempId?: string;
  lastError?: string;
  attempts?: number;
};

type FlushResult = {
  synced: number;
  failed: number;
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

export function newOfflineTempDocumentId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueOfflineAction(
  action: Omit<OfflineAction, "id" | "createdAt" | "attempts">,
): Promise<OfflineAction> {
  const entry: OfflineAction = {
    ...action,
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const q = await readQueue();
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

async function markActionFailed(id: string, error: string): Promise<void> {
  const q = await readQueue();
  const next = q.map((a) =>
    a.id === id
      ? { ...a, attempts: (a.attempts ?? 0) + 1, lastError: error.slice(0, 200) }
      : a,
  );
  await writeQueue(next);
}

function resolveDocumentId(
  documentId: string | undefined,
  idMap: Record<string, string>,
): string | undefined {
  if (!documentId) return undefined;
  return idMap[documentId] ?? documentId;
}

async function applyCreateDocument(
  action: OfflineAction,
  idMap: Record<string, string>,
): Promise<boolean> {
  const payload = action.payload;
  const res = await apiFetch("/api/terrain/documents", {
    method: "POST",
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
  const docId = resolveDocumentId(action.documentId, idMap);
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
  const res = await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
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
  const docId = resolveDocumentId(action.documentId, idMap);
  if (!docId) {
    await markActionFailed(action.id, "Bon introuvable après sync");
    return false;
  }
  const res = await apiFetch(`/api/stock-documents/${docId}/sign`, { method: "POST" });
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

/** Rejoue la file dans l'ordre FIFO ; les actions en échec restent en file. */
export async function flushOfflineQueue(): Promise<FlushResult> {
  const idMap: Record<string, string> = {};
  let synced = 0;
  let failed = 0;
  const queue = await readQueue();

  for (const action of queue) {
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
      const docId = a.documentId ? resolveDocumentId(a.documentId, idMap) : a.documentId;
      const clientTempId = a.clientTempId
        ? resolveDocumentId(a.clientTempId, idMap)
        : a.clientTempId;
      if (docId === a.documentId && clientTempId === a.clientTempId) return a;
      return { ...a, documentId: docId, clientTempId };
    });
    await writeQueue(remapped);
  }

  return { synced, failed, idMap };
}
