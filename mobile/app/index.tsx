import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/context/AuthContext";
import { FieldAppScreen } from "@/screens/FieldAppScreen";
import { colors, spacing } from "@/theme";

export default function HomeScreen() {
  const { user, denied, signOut } = useAuth();

  if (denied) {
    return (
      <LinearGradient colors={[colors.navy2, colors.bg]} style={styles.root}>
        <View style={styles.denied}>
          <Text style={styles.deniedTitle}>Accès réservé</Text>
          <Text style={styles.deniedText}>
            Cette application est réservée aux profils terrain (technicien, magasinier, parc…).
          </Text>
          <Text style={styles.deniedUser}>{user?.fullName}</Text>
          <Pressable style={styles.deniedBtn} onPress={() => void signOut()}>
            <Text style={styles.deniedBtnText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.navy2, colors.bg, colors.bg]} style={styles.root}>
      <OfflineBanner />
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FieldAppScreen />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  denied: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  deniedTitle: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 12 },
  deniedText: { fontSize: 14, color: colors.text2, textAlign: "center", lineHeight: 22 },
  deniedUser: { marginTop: 16, fontSize: 13, color: colors.text3 },
  deniedBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  deniedBtnText: { color: colors.text2, fontWeight: "600" },
});
