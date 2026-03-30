"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  fetchAuthMe,
  getResolvedApiBaseUrl,
  loginViaApi,
} from "@/lib/stock/api";
import { setSessionUserId } from "@/lib/stock/session";

function envApiBaseForHydration(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!raw) {
    return "http://localhost:3001";
  }
  return raw.replace(/\/+$/, "");
}

export default function ConnexionPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiDisplayUrl, setApiDisplayUrl] = useState(envApiBaseForHydration);

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
      setError(`Impossible de joindre l’API (${getResolvedApiBaseUrl()}).`);
    } finally {
      setCheckingSession(false);
    }
  }, [router]);

  useEffect(() => {
    setApiDisplayUrl(getResolvedApiBaseUrl());
  }, []);

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
      const { user } = await loginViaApi(id, password);
      setSessionUserId(user.id);
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
            Connectez-vous avec votre nom d’utilisateur ou votre adresse e-mail et votre mot de passe.
            Les administrateurs peuvent créer des comptes depuis l’onglet Utilisateurs.
          </p>

          <p className="auth-card-desc fs12 fc-3 auth-card-desc--tight">
            Comptes de démo après seed : identifiant <code>admin</code> — mot de passe défini par{" "}
            <code>SEED_DEMO_PASSWORD</code> sur le backend (souvent <code>Demo1234!</code>).
          </p>

          {error ? (
            <div className="auth-error" role="alert">
              {error}
            </div>
          ) : null}

          <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
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

          <p className="auth-empty fs12 auth-empty--api-hint">
            API : <code className="auth-code">{apiDisplayUrl}</code> — en cas d’erreur réseau, vérifiez{" "}
            <code className="auth-code">NEXT_PUBLIC_API_BASE_URL</code> et que le backend accepte les cookies
            (CORS avec credentials).
          </p>
        </section>
      </div>
    </div>
  );
}
