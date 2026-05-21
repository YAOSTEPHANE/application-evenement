import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiBase, loginViaApi, verifyTwoFactorViaApi, type AuthMeUser } from "@/lib/api";
import { setSessionUserId } from "@/lib/auth-storage";
import { canUseFieldApp } from "@/lib/roles";
import { colors, radius, spacing } from "@/theme";

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2Fa, setNeeds2Fa] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finishLogin(user: AuthMeUser) {
    if (!canUseFieldApp(user.role)) {
      setError("Ce compte n'a pas accès à l'app mobile terrain.");
      return;
    }
    await setSessionUserId(user.id);
    await refresh();
    router.replace("/" as Href);
  }

  async function handleLogin() {
    setError(null);
    const id = identifier.trim();
    if (!id || !password) {
      setError("Saisissez un identifiant et un mot de passe.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await loginViaApi(id, password);
      if ("needsTwoFactor" in result && result.needsTwoFactor) {
        setNeeds2Fa(true);
        setPendingToken(result.pendingToken);
        return;
      }
      await finishLogin(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handle2Fa() {
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await verifyTwoFactorViaApi(totpCode, pendingToken);
      await finishLogin(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code invalide.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={[colors.navy2, colors.bg]}
          style={[styles.hero, { paddingTop: insets.top + 48 }]}
        >
          <LinearGradient colors={[colors.gold, colors.gold2]} style={styles.heroLogo}>
            <Ionicons name="radio-outline" size={36} color={colors.navy} />
          </LinearGradient>
          <Text style={styles.heroTitle}>EVENT · RFID</Text>
          <Text style={styles.heroSub}>Application terrain</Text>
        </LinearGradient>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}

          {needs2Fa ? (
            <>
              <Text style={styles.hint}>Code Authenticator à 6 chiffres.</Text>
              <Text style={styles.label}>Code 2FA</Text>
              <TextInput
                style={styles.input}
                value={totpCode}
                onChangeText={setTotpCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="000000"
                placeholderTextColor={colors.text3}
                editable={!submitting}
              />
              <Pressable
                style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                onPress={() => void handle2Fa()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.navy} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.navy} />
                    <Text style={styles.btnPrimaryText}>Valider</Text>
                  </>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>Identifiant ou e-mail</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoComplete="username"
                placeholder="nom@entreprise.fr"
                placeholderTextColor={colors.text3}
                editable={!submitting}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor={colors.text3}
                editable={!submitting}
              />
              <Pressable
                style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                onPress={() => void handleLogin()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.navy} />
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={18} color={colors.navy} />
                    <Text style={styles.btnPrimaryText}>Entrer sur le terrain</Text>
                  </>
                )}
              </Pressable>
            </>
          )}

          <Text style={styles.foot}>
            API : {apiBase()}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: "center",
    paddingBottom: 56,
    paddingHorizontal: spacing.md,
  },
  heroLogo: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    color: colors.text3,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 6,
  },
  card: {
    marginTop: -32,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  errBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errText: { flex: 1, color: colors.danger, fontSize: 13 },
  hint: { color: colors.text3, fontSize: 12, marginBottom: spacing.sm },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.text3,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.25)",
    minHeight: 52,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.lg,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
  },
  btnPrimaryText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: { opacity: 0.6 },
  foot: {
    marginTop: spacing.lg,
    textAlign: "center",
    fontSize: 11,
    color: colors.text3,
  },
});
