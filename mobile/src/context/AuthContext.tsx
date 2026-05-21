import { type Href, useRouter, useSegments } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, View } from "react-native";

import {
  fetchAuthMe,
  logoutViaApi,
  type AuthMeUser,
} from "@/lib/api";
import { setSessionUserId } from "@/lib/auth-storage";
import { canUseFieldApp } from "@/lib/roles";
import { colors } from "@/theme";

type AuthContextValue = {
  user: AuthMeUser | null;
  loading: boolean;
  denied: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthMeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchAuthMe();
      if (!me) {
        setUser(null);
        setDenied(false);
        return;
      }
      if (!canUseFieldApp(me.role)) {
        setUser(me);
        setDenied(true);
        return;
      }
      await setSessionUserId(me.id);
      setUser(me);
      setDenied(false);
    } catch {
      setUser(null);
      setDenied(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await logoutViaApi();
    setUser(null);
    setDenied(false);
    router.replace("/connexion" as Href);
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "connexion";
    if (!user && !inAuth) {
      router.replace("/connexion" as Href);
    } else if (user && !denied && inAuth) {
      router.replace("/" as Href);
    }
  }, [user, denied, loading, segments, router]);

  const value = useMemo(
    () => ({ user, loading, denied, refresh, signOut }),
    [user, loading, denied, refresh, signOut],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}
