"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  fetchAuthMe,
  loginViaApi,
  verifyTwoFactorViaApi,
} from "@/lib/stock/api";
import { setSessionUserId } from "@/lib/stock/session";

export default function ConnexionPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needs2Fa, setNeeds2Fa] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  const verifyExistingSession = useCallback(async () => {
    setCheckingSession(true);
    setError(null);
    try {
      const me = await fetchAuthMe();
      if (me) {
        setSessionUserId(me.id);
        router.replace("/");
        return;
      }
    } catch {
      setError("Impossible de joindre le serveur. Réessayez dans un instant.");
    } finally {
      setCheckingSession(false);
    }
  }, [router]);

  useEffect(() => {
    void verifyExistingSession();
  }, [verifyExistingSession]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
        return;
      }
      setSessionUserId(result.user.id);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="auth-screen">
        <div className="auth-panel auth-panel--narrow">
          <p className="auth-signout-msg" role="status">
            Vérification de la session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <header className="auth-header">
          <div className="auth-logo-mark" aria-hidden="true">
            ◈
          </div>
          <h1 className="auth-title">StockEvent Pro</h1>
          <p className="auth-subtitle">Gestion de stock événementiel</p>
        </header>

        <section className="auth-card" aria-labelledby="auth-card-title">
          <h2 id="auth-card-title" className="auth-card-title">
            Connexion
          </h2>
          <p className="auth-card-desc">
            Connectez-vous avec votre identifiant (ou e-mail) et votre mot de passe.
          </p>

          {error ? (
            <div className="auth-error" role="alert">
              {error}
            </div>
          ) : null}

          {needs2Fa ? (
            <form
              className="auth-form form-premium"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setSubmitting(true);
                void verifyTwoFactorViaApi(totpCode)
                  .then(({ user }) => {
                    setSessionUserId(user.id);
                    router.replace("/");
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : "Code invalide"))
                  .finally(() => setSubmitting(false));
              }}
            >
              <p className="auth-card-desc">Saisissez le code de votre application Authenticator.</p>
              <div className="fg full">
                <label htmlFor="totp-code">Code à 6 chiffres</label>
                <input
                  id="totp-code"
                  className="fi"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <button className="btn btn-gold auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Vérification…" : "Valider"}
              </button>
            </form>
          ) : (
          <form className="auth-form form-premium" onSubmit={(e) => void handleSubmit(e)}>
            <div className="fg full">
              <label htmlFor="login-identifier">Identifiant (nom d’utilisateur ou e-mail)</label>
              <input
                id="login-identifier"
                className="fi"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={submitting}
                placeholder="ex. admin ou vous@agence.ci"
              />
            </div>
            <div className="fg full">
              <label htmlFor="login-password">Mot de passe</label>
              <input
                id="login-password"
                className="fi"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder="••••••••"
              />
            </div>
            <button className="btn btn-gold auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Connexion…" : "Se connecter"}
            </button>
          </form>
          )}
        </section>
      </div>
    </div>
  );
}
