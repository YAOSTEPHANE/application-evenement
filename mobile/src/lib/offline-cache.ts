import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "cdc_offline_field_cache_v1";

export type CachedDocument = {
  id: string;
  documentNumber: string;
  kind: string;
  status: string;
  /** Bon créé localement, en attente de sync. */
  offline?: boolean;
  clientTempId?: string;
};

export type CachedAssignment = {
  id: string;
  isTeamLeader: boolean;
  event: {
    id: string;
    name: string;
    location: string;
    clientName: string;
    startsAt: string;
    endsAt: string;
    orderStatus: string;
  };
};

export type CachedDevice = { id: string; code: string; label: string };

export type FieldCacheSnapshot = {
  documents: CachedDocument[];
  assignments: CachedAssignment[];
  leaderEvents: CachedAssignment["event"][];
  portals: CachedDevice[];
  handhelds: CachedDevice[];
  cachedAt: string;
};

export async function loadFieldCache(): Promise<FieldCacheSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FieldCacheSnapshot;
  } catch {
    return null;
  }
}

export async function saveFieldCache(snapshot: Omit<FieldCacheSnapshot, "cachedAt">): Promise<void> {
  const existing = (await loadFieldCache()) ?? {
    documents: [],
    assignments: [],
    leaderEvents: [],
    portals: [],
    handhelds: [],
    cachedAt: new Date().toISOString(),
  };
  const offlineDrafts = existing.documents.filter((d) => d.offline);
  const mergedDocs = [
    ...offlineDrafts,
    ...snapshot.documents.filter((d) => !offlineDrafts.some((o) => o.id === d.id)),
  ];
  const payload: FieldCacheSnapshot = {
    ...snapshot,
    documents: mergedDocs,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

export async function addOfflineDraftDocument(doc: CachedDocument): Promise<void> {
  const cache = (await loadFieldCache()) ?? {
    documents: [],
    assignments: [],
    leaderEvents: [],
    portals: [],
    handhelds: [],
    cachedAt: new Date().toISOString(),
  };
  if (cache.documents.some((d) => d.id === doc.id)) return;
  cache.documents = [doc, ...cache.documents];
  cache.cachedAt = new Date().toISOString();
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function replaceOfflineDraftId(tempId: string, serverDoc: CachedDocument): Promise<void> {
  const cache = await loadFieldCache();
  if (!cache) return;
  cache.documents = cache.documents.map((d) =>
    d.id === tempId || d.clientTempId === tempId
      ? { ...serverDoc, offline: false }
      : d,
  );
  cache.cachedAt = new Date().toISOString();
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}
