"use client";

import { useCallback, useEffect, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";
import { clientFetch } from "@/lib/stock/api";

export function ProfileTwoFactor() {
  const [enabled, setEnabled] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    const res = await clientFetch("/api/auth/2fa/setup");
    if (res.ok) {
      const data = (await res.json()) as { enabled: boolean };
      setEnabled(data.enabled);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function beginSetup() {
    const res = await clientFetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "begin" }),
    });
    const data = await res.json();
    if (res.ok) {
      setSecret((data as { secret: string }).secret);
      setOtpauthUrl((data as { otpauthUrl: string }).otpauthUrl);
      setMessage("Scannez le secret dans votre application Authenticator.");
    }
  }

  async function confirmSetup() {
    const res = await clientFetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", code }),
    });
    if (res.ok) {
      setEnabled(true);
      setMessage("2FA activée.");
      setSecret("");
      setOtpauthUrl("");
    } else {
      const data = await res.json();
      setMessage((data as { message?: string }).message ?? "Code invalide");
    }
  }

  return (
    <div className="card card-pad profile-2fa-card" style={{ marginTop: 16 }}>
      <div className="profile-2fa-hd">
        <span className="icon-badge" aria-hidden>
          <AppIcon name="shield" size={20} />
        </span>
        <h3>Sécurité — double authentification (CDC)</h3>
      </div>
      <p className="fs12 text-muted" style={{ marginBottom: 12 }}>
        Obligatoire pour administrateur, stock, resp. technique et parc.
      </p>
      <p className="profile-2fa-status">
        <AppIcon name={enabled ? "check" : "alert"} size={16} />
        Statut : {enabled ? "Activée" : "Non configurée"}
      </p>
      {secret ? (
        <div className="profile-2fa-secret">
          <p className="fs12">
            Secret : <code className="mono">{secret}</code>
          </p>
          <p className="fs11 text-muted" style={{ wordBreak: "break-all" }}>
            {otpauthUrl}
          </p>
          <div className="fg full form-premium" style={{ marginTop: 8 }}>
            <label htmlFor="profile-2fa-code">Code à 6 chiffres</label>
            <input
              id="profile-2fa-code"
              className="fi"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-gold btn-sm btn-icon"
            style={{ marginTop: 8 }}
            onClick={() => void confirmSetup()}
          >
            <AppIcon name="check" size={14} />
            Valider 2FA
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-sm btn-icon"
          style={{ marginTop: 8 }}
          onClick={() => void beginSetup()}
        >
          <AppIcon name="shield" size={14} />
          Configurer 2FA
        </button>
      )}
      {message ? (
        <p className="fs12" style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <AppIcon name="alert" size={14} />
          {message}
        </p>
      ) : null}
    </div>
  );
}
