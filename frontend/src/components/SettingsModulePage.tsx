"use client";

import { Role } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

import { ProfileTwoFactor } from "@/components/ProfileTwoFactor";
import { AppIcon } from "@/components/icons/AppIcon";
import { FormField, FormGrid, FormInput, FormSelect } from "@/components/forms/FormPrimitives";
import { ROLE_LABELS } from "@/lib/cdc-labels";
import type { DirectingPrinciplePublic } from "@/lib/cdc-directing-principle";
import type { OrganizationSettings } from "@/lib/organization-settings";
import { clientFetch, getApiOriginForDisplay } from "@/lib/stock/api";
import { useToastContext } from "@/lib/toast/ToastProvider";
import type { PageId } from "@/components/Sidebar";

type WarehouseOption = { id: string; name: string; code: string };

type SettingsPayload = {
  organization: {
    id: string;
    name: string;
    settings: OrganizationSettings;
    updatedAt: string;
  };
  warehouses: WarehouseOption[];
  actor: { role: Role };
  system: {
    apiOrigin: string;
    directingPrinciple: DirectingPrinciplePublic;
  };
};

type SettingsModulePageProps = {
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onNavigate: (page: PageId) => void;
};

export function SettingsModulePage({
  themeMode,
  onToggleTheme,
  soundEnabled,
  onToggleSound,
  onNavigate,
}: SettingsModulePageProps) {
  const { showToast } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [orgName, setOrgName] = useState("");
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [varianceTarget, setVarianceTarget] = useState("2");

  const canEditOrg =
    data?.actor.role === Role.ADMIN || data?.actor.role === Role.MANAGER;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientFetch("/api/settings");
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        showToast(err.message ?? "Impossible de charger les paramètres", "danger");
        return;
      }
      const json = (await res.json()) as SettingsPayload;
      setData(json);
      setOrgName(json.organization.name);
      setDefaultWarehouseId(json.organization.settings.defaultWarehouseId ?? "");
      setVarianceTarget(String(json.organization.settings.inventoryVarianceTargetPct ?? 2));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveOrganization() {
    if (!canEditOrg) return;
    setSaving(true);
    try {
      const pct = Number.parseFloat(varianceTarget.replace(",", "."));
      const res = await clientFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName.trim(),
          settings: {
            defaultWarehouseId: defaultWarehouseId || null,
            inventoryVarianceTargetPct: Number.isFinite(pct) ? pct : 2,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        showToast(body.message ?? "Enregistrement impossible", "danger");
        return;
      }
      showToast("Paramètres organisation enregistrés.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const principle = data?.system.directingPrinciple;
  const apiOrigin = data?.system.apiOrigin || getApiOriginForDisplay();

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Paramètres</div>
          <div className="ph-sub">Préférences personnelles, organisation et conformité CDC</div>
        </div>
        <div className="ph-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
            ↻ Actualiser
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="card card-pad">
          <p className="fs12 text-muted">Chargement…</p>
        </div>
      ) : null}

      {data ? (
        <div className="settings-layout">
          <section className="card card-pad settings-section">
            <header className="settings-section-hd">
              <AppIcon name="profile" size={20} />
              <div>
                <h2 className="settings-section-title">Interface</h2>
                <p className="settings-section-desc">Affichage et retours sonores sur cette session</p>
              </div>
            </header>
            <div className="settings-toggles">
              <label className="settings-toggle">
                <span className="settings-toggle-label">
                  <AppIcon name={themeMode === "dark" ? "themeSun" : "themeMoon"} size={16} />
                  Thème {themeMode === "dark" ? "sombre" : "clair"}
                </span>
                <button type="button" className="btn btn-outline btn-sm" onClick={onToggleTheme}>
                  Basculer
                </button>
              </label>
              <label className="settings-toggle">
                <span className="settings-toggle-label">
                  {soundEnabled ? "🔊" : "🔇"} Sons de confirmation
                </span>
                <button type="button" className="btn btn-outline btn-sm" onClick={onToggleSound}>
                  {soundEnabled ? "Activés" : "Désactivés"}
                </button>
              </label>
            </div>
            <div className="settings-links">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate("profil")}>
                Mon profil (identité, mot de passe)
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate("validation")}>
                Validation &amp; droits
              </button>
            </div>
          </section>

          <section className="card card-pad settings-section">
            <header className="settings-section-hd">
              <AppIcon name="shield" size={20} />
              <div>
                <h2 className="settings-section-title">Sécurité — double authentification</h2>
                <p className="settings-section-desc">
                  Obligatoire pour certains profils sur les actions sensibles (signature, création de bon terrain).
                </p>
              </div>
            </header>
            <ProfileTwoFactor />
          </section>

          <section className="card card-pad settings-section">
            <header className="settings-section-hd">
              <AppIcon name="warehouse" size={20} />
              <div>
                <h2 className="settings-section-title">Organisation</h2>
                <p className="settings-section-desc">
                  {canEditOrg
                    ? "Réservé administrateur / manager"
                    : "Lecture seule — contactez un administrateur pour modifier"}
                </p>
              </div>
            </header>
            <FormGrid cols={2}>
              <FormField label="Nom de l'organisation" span="full">
                <FormInput
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!canEditOrg}
                />
              </FormField>
              <FormField label="Entrepôt par défaut" span="full">
                <FormSelect
                  value={defaultWarehouseId}
                  onChange={(e) => setDefaultWarehouseId(e.target.value)}
                  disabled={!canEditOrg}
                >
                  <option value="">— Aucun —</option>
                  {data.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField
                label="Cible écart inventaire RFID (%)"
                hint="Objectif CDC : écart théorique / physique inférieur à 2 %"
              >
                <FormInput
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={varianceTarget}
                  onChange={(e) => setVarianceTarget(e.target.value)}
                  disabled={!canEditOrg}
                />
              </FormField>
              <FormField label="Votre rôle">
                <FormInput value={ROLE_LABELS[data.actor.role] ?? data.actor.role} readOnly disabled />
              </FormField>
            </FormGrid>
            {canEditOrg ? (
              <div className="settings-section-ft">
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={saving}
                  onClick={() => void saveOrganization()}
                >
                  {saving ? "Enregistrement…" : "Enregistrer l'organisation"}
                </button>
              </div>
            ) : null}
          </section>

          <section className="card card-pad settings-section">
            <header className="settings-section-hd">
              <AppIcon name="documents" size={20} />
              <div>
                <h2 className="settings-section-title">Conformité mouvements (CDC)</h2>
                <p className="settings-section-desc">Principe directeur — configuration serveur</p>
              </div>
            </header>
            {principle ? (
              <div className="settings-compliance">
                <p className="settings-compliance-status">
                  Enforcement actif :{" "}
                  <span className={principle.enforced ? "badge badge-ok" : "badge badge-warn"}>
                    {principle.enforced ? "Oui" : "Non (mode assoupli)"}
                  </span>
                </p>
                <p className="fs12 fc-3">{principle.body}</p>
                <p className="fs11 text-muted">{principle.footnote}</p>
                <p className="fs11 text-muted">
                  Variable serveur : CDC_ENFORCE_DIRECTING_PRINCIPLE (false pour désactiver en développement).
                </p>
              </div>
            ) : null}
          </section>

          <section className="card card-pad settings-section">
            <header className="settings-section-hd">
              <AppIcon name="sync" size={20} />
              <div>
                <h2 className="settings-section-title">Système &amp; raccourcis</h2>
                <p className="settings-section-desc">Informations techniques et navigation rapide</p>
              </div>
            </header>
            <dl className="settings-dl">
              <dt>API</dt>
              <dd className="settings-mono">{apiOrigin || "—"}</dd>
              <dt>Organisation ID</dt>
              <dd className="settings-mono">{data.organization.id}</dd>
              <dt>Dernière mise à jour</dt>
              <dd>{new Date(data.organization.updatedAt).toLocaleString("fr-FR")}</dd>
            </dl>
            <div className="settings-links">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate("entrepots")}>
                Entrepôts &amp; zones
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate("utilisateurs")}>
                Utilisateurs
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate("rfid")}>
                Identification RFID
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate("alertes")}>
                Alertes
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
