import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { colors, radius, spacing } from "@/theme";

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <LinearGradient colors={[colors.gold, colors.gold2]} style={styles.logo}>
            <Ionicons name="radio-outline" size={24} color={colors.navy} />
          </LinearGradient>
          <View>
            <Text style={styles.title}>EVENT · RFID</Text>
            <Text style={styles.sub}>Terrain · exécution</Text>
          </View>
        </View>
        <Pressable style={styles.logout} onPress={() => void signOut()} accessibilityLabel="Déconnexion">
          <Ionicons name="log-out-outline" size={20} color={colors.text2} />
        </Pressable>
      </View>
      {user ? (
        <Text style={styles.user}>
          {user.fullName}
          {user.username ? ` · @${user.username}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text3,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  user: {
    marginTop: spacing.sm,
    marginLeft: 62,
    fontSize: 12,
    color: colors.text3,
  },
  logout: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});
