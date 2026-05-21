import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch } from "@/lib/api";

const SPEC_KEY = "cdc_mobile_offline_spec_v1";

export type OfflineCriticalAction = {
  id: string;
  label: string;
  description: string;
};

export type MobileOfflineSpec = {
  ref: string;
  platforms: string[];
  principle: string;
  criticalActions: OfflineCriticalAction[];
  packagePath: string;
};

export async function loadCachedOfflineSpec(): Promise<MobileOfflineSpec | null> {
  try {
    const raw = await AsyncStorage.getItem(SPEC_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobileOfflineSpec;
  } catch {
    return null;
  }
}

export async function refreshOfflineSpec(): Promise<MobileOfflineSpec | null> {
  try {
    const res = await apiFetch("/api/cdc/mobile/offline");
    if (!res.ok) return loadCachedOfflineSpec();
    const spec = (await res.json()) as MobileOfflineSpec;
    await AsyncStorage.setItem(SPEC_KEY, JSON.stringify(spec));
    return spec;
  } catch {
    return loadCachedOfflineSpec();
  }
}
