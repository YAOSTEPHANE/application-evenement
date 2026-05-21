import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { flushOfflineQueue, getOfflineQueue } from "@/lib/offline-queue";
import { colors, radius, spacing } from "@/theme";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const state = await NetInfo.fetch();
      setOnline(state.isConnected ?? false);
      setPending((await getOfflineQueue()).length);
    };
    void refresh();
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected ?? false);
      void getOfflineQueue().then((q) => setPending(q.length));
    });
    return () => unsub();
  }, []);

  if (online && pending === 0) return null;

  return (
    <View style={[styles.banner, !online && styles.bannerOff]}>
      {!online ? (
        <View style={styles.row}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warn} />
          <Text style={styles.text}>Hors ligne — bons, scans et signatures en file</Text>
        </View>
      ) : null}
      {pending > 0 ? (
        <View style={styles.row}>
          <Ionicons name="sync-outline" size={16} color={online ? colors.warn : colors.danger} />
          <Text style={styles.text}>{pending} en attente</Text>
          <Pressable
            style={[styles.syncBtn, (!online || syncing) && styles.syncBtnDisabled]}
            disabled={!online || syncing}
            onPress={() => {
              setSyncing(true);
              void flushOfflineQueue().then(async () => {
                setPending((await getOfflineQueue()).length);
                setSyncing(false);
              });
            }}
          >
            <Text style={styles.syncBtnText}>{syncing ? "Sync…" : "Synchroniser"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warnBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(240,180,41,0.35)",
  },
  bannerOff: {
    backgroundColor: colors.dangerBg,
    borderBottomColor: "rgba(248,113,113,0.35)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  text: {
    color: colors.warn,
    fontSize: 12,
    fontWeight: "500",
  },
  syncBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },
  syncBtnText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: "700",
  },
});
