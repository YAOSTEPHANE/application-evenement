"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { logoutViaApi } from "@/lib/stock/api";
import { clearSession } from "@/lib/stock/session";

export default function DeconnexionPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Déconnexion en cours…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await logoutViaApi();
      } catch {
        if (!cancelled) {
          setMessage("Session locale effacée (l’API n’a pas répondu).");
        }
      } finally {
        if (!cancelled) {
          clearSession();
          router.replace("/connexion");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="auth-screen">
      <div className="auth-panel auth-panel--narrow">
        <p className="auth-signout-msg" role="status">
          {message}
        </p>
      </div>
    </div>
  );
}
