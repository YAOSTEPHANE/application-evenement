"use client";

import { StockDocumentKind } from "@prisma/client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

import { ProfileTwoFactor } from "@/components/ProfileTwoFactor";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  DOC_KIND_LABELS,
  DOC_STATUS_LABELS,
  ROLE_LABELS,
} from "@/lib/cdc-labels";
import { CDC_ROLE_PROFILES } from "@/lib/cdc-role-profiles";
import {
  canArbitrateDisputes,
  canCancelStockDocument,
  canConsultStock,
  canCreateStockDocument,
  canManageCommercialOrders,
  canManageFleet,
  canManageHrTeams,
  canManagePhysicalStock,
  canManageUsers,
  canUseFieldApp,
  isReadOnlyStockProfile,
  MATRIX_ROLES,
  SENSITIVE_ACTIONS,
  documentSignPlan,
  VALIDATION_DOC_SCENARIOS,
} from "@/lib/cdc-validation-matrix";
import type {
  PendingValidationDoc,
  ValidationArchiveRow,
  ValidationOverview,
  ValidationSecurityRow,
  ValidationStats,
} from "@/lib/validation-db";
import { clientFetch } from "@/lib/stock/api";
import { useToastContext } from "@/lib/toast/ToastProvider";

type TabId = "droits" | "signatures" | "file" | "archives" | "securite";

type ValidationModulePageProps = {
  onNavigateToBons?: (documentId: string) => void;
};

function permCell(allowed: boolean): string {
  return allowed ? "val-perm--yes" : "val-perm--no";
}

function statusClass(status: PendingValidationDoc["status"]): string {
  if (status === "DISPUTED") return "val-queue-card--dispute";
  if (status === "SCANNING") return "val-queue-card--scan";
  return "val-queue-card--sign";
}

export function ValidationModulePage({ onNavigateToBons }: ValidationModulePageProps) {
  const { showToast } = useToastContext();
  const [tab, setTab] = useState<TabId>("file");
  const [signingId, setSigningId] = useState<string | null>(null);
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [pending, setPending] = useState<PendingValidationDoc[]>([]);
  const [archives, setArchives] = useState<ValidationArchiveRow[]>([]);
  const [security, setSecurity] = useState<ValidationSecurityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientFetch("/api/cdc/validation/overview");
      if (!res.ok) return;
      const data = (await res.json()) as ValidationOverview;
      setStats(data.stats);
      setPending(data.pending);
      setArchives(data.archives);
      setSecurity(data.security);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function signDocument(docId: string) {
    setSigningId(docId);
    try {
      const res = await clientFetch(`/api/stock-documents/${docId}/sign`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        showToast(data.message ?? "Signature refusée", "danger");
        return;
      }
      showToast("Signature enregistrée.");
      await load();
    } finally {
      setSigningId(null);
    }
  }

  const openCount =
    (stats?.pendingSignature ?? 0) + (stats?.scanning ?? 0) + (stats?.disputed ?? 0);

  return (
    <div className="val-premium">
      <section className="val-hero">
        <div className="val-hero-grid">
          <div>
            <h1 className="val-hero-title">Validation</h1>
          </div>
          <div className="val-hero-actions">
            <button
              type="button"
              className="val-hero-btn val-hero-btn--ghost"
              disabled={loading}
              onClick={() => void load()}
            >
              <AppIcon name="sync" size={14} />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <div className="val-kpi-row">
        <div className={`val-kpi${openCount > 0 ? " val-kpi--warn" : ""}`}>
          <div className="val-kpi-val">{openCount}</div>
          <div className="val-kpi-lbl">Bons à traiter</div>
          <div className="val-kpi-sub">
            {stats
              ? `${stats.pendingSignature} signature · ${stats.scanning} scan · ${stats.disputed} litige`
              : ""}
          </div>
        </div>
        <div className="val-kpi val-kpi--accent">
          <div className="val-kpi-val">{stats?.signedToday ?? "—"}</div>
          <div className="val-kpi-lbl">Signés aujourd&apos;hui</div>
        </div>
        <div className="val-kpi">
          <div className="val-kpi-val">{stats?.archivesTotal ?? "—"}</div>
          <div className="val-kpi-lbl">Archives légales</div>
          <div className="val-kpi-sub">Conservation 10 ans</div>
        </div>
        <div className={`val-kpi${stats && stats.users2faGap > 0 ? " val-kpi--warn" : ""}`}>
          <div className="val-kpi-val">{stats?.users2faGap ?? "—"}</div>
          <div className="val-kpi-lbl">Comptes sans 2FA</div>
          <div className="val-kpi-sub">Rôles sensibles</div>
        </div>
      </div>

      <div className="val-tabs" role="tablist">
        {(
          [
            ["file", "documents", "File d'attente"],
            ["droits", "users", "Droits"],
            ["signatures", "signature", "Signatures"],
            ["archives", "fileExport", "Archives"],
            ["securite", "shield", "Sécurité 2FA"],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id ? "true" : "false"}
            className={`val-tab${tab === id ? " val-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            <AppIcon name={icon} size={14} />
            {label}
            {id === "file" && openCount > 0 ? (
              <span className="val-tab-badge">{openCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <div className="val-panel">
          {pending.length === 0 ? (
            <p className="val-empty">Aucun bon en attente de scan, signature ou résolution de litige.</p>
          ) : (
            <div className="val-queue-grid">
              {pending.map((doc) => (
                <article key={doc.id} className={`val-queue-card ${statusClass(doc.status)}`}>
                  <div className="val-queue-top">
                    <span className="val-queue-num">{doc.documentNumber}</span>
                    <span className="val-queue-kind">{DOC_KIND_LABELS[doc.kind]}</span>
                  </div>
                  <p className="val-queue-status">{DOC_STATUS_LABELS[doc.status]}</p>
                  {doc.eventName ? <p className="val-queue-ev">{doc.eventName}</p> : null}
                  <div className="val-queue-progress">
                    <div
                      className="val-queue-bar"
                      style={
                        {
                          ["--val-sign-pct"]: `${Math.min(
                            100,
                            doc.signaturesRequired > 0
                              ? Math.round((doc.signaturesDone / doc.signaturesRequired) * 100)
                              : 0,
                          )}%`,
                        } as CSSProperties
                      }
                    />
                    <span className="val-queue-meta">
                      {doc.signaturesDone}/{doc.signaturesRequired} signature
                      {doc.signaturesRequired > 1 ? "s" : ""}
                    </span>
                  </div>
                  {doc.nextSignLabel ? (
                    <p className="val-queue-next">
                      <AppIcon name="signature" size={12} />
                      {doc.nextSignLabel}
                    </p>
                  ) : null}
                  <div className="val-queue-actions">
                    {onNavigateToBons ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-gold"
                        onClick={() => onNavigateToBons(doc.id)}
                      >
                        Ouvrir le bon
                      </button>
                    ) : null}
                    {doc.status === "PENDING_SIGNATURE" || doc.status === "SCANNING" ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        disabled={signingId === doc.id}
                        onClick={() => void signDocument(doc.id)}
                      >
                        {signingId === doc.id ? "…" : "Signer"}
                      </button>
                    ) : null}
                    {onNavigateToBons && doc.status === "SCANNING" ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => onNavigateToBons(doc.id)}
                      >
                        Scanner RFID
                      </button>
                    ) : null}
                    <a
                      className="btn btn-xs btn-outline btn-icon"
                      href={`/api/stock-documents/${doc.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <AppIcon name="documents" size={12} />
                      PDF
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "droits" ? (
        <div className="val-panel">
          <h2 className="val-section-title">Liste des profils</h2>
          <div className="val-profiles-wrap">
            <table className="val-profiles-table data-table">
              <thead>
                <tr>
                  <th scope="col">Profil</th>
                  <th scope="col">Rôle métier</th>
                  <th scope="col">Droits principaux</th>
                </tr>
              </thead>
              <tbody>
                {CDC_ROLE_PROFILES.map((p) => (
                  <tr key={p.role}>
                    <td className="fw500">{p.profileLabel}</td>
                    <td>{p.businessRole}</td>
                    <td>{p.mainRights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="val-section-title" style={{ marginTop: 28 }}>
            Matrice des droits
          </h2>
          <div className="val-matrix-wrap">
            <table className="val-matrix">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  {MATRIX_ROLES.map((role) => (
                    <th key={role} scope="col">
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="val-matrix-action">Gérer les utilisateurs</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canManageUsers(role))}>
                      {canManageUsers(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="val-matrix-action">Créer une commande</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canManageCommercialOrders(role))}>
                      {canManageCommercialOrders(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="val-matrix-action">Consultation stocks</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canConsultStock(role))}>
                      {isReadOnlyStockProfile(role) ? "Lecture" : canConsultStock(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="val-matrix-action">Gestion physique / validation BE·BS·BT</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canManagePhysicalStock(role))}>
                      {canManagePhysicalStock(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="val-matrix-action">RH — équipes & chefs</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canManageHrTeams(role))}>
                      {canManageHrTeams(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="val-matrix-action">Parc camion & planning</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canManageFleet(role))}>
                      {canManageFleet(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="val-matrix-action">App mobile terrain</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canUseFieldApp(role))}>
                      {canUseFieldApp(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="val-matrix-action">Arbitrage litiges</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canArbitrateDisputes(role))}>
                      {canArbitrateDisputes(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
                {VALIDATION_DOC_SCENARIOS.map((row) => (
                  <tr key={row.id}>
                    <td className="val-matrix-action">Créer {row.label}</td>
                    {MATRIX_ROLES.map((role) => (
                      <td key={role} className={permCell(canCreateStockDocument(role, row.kind))}>
                        {canCreateStockDocument(role, row.kind) ? "Oui" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="val-matrix-action">Annuler un bon</td>
                  {MATRIX_ROLES.map((role) => (
                    <td key={role} className={permCell(canCancelStockDocument(role))}>
                      {canCancelStockDocument(role) ? "Oui" : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "signatures" ? (
        <div className="val-panel">
          <div className="val-sign-grid">
            {VALIDATION_DOC_SCENARIOS.map((row) => {
              const slots = documentSignPlan(row.kind, {
                beSubtype: row.beSubtype ?? null,
                bsSubtype: row.bsSubtype ?? null,
                btSubtype: row.btSubtype ?? null,
              });
              const extra =
                row.kind === StockDocumentKind.BT
                  ? " · émission puis réception (transit max. 48 h)"
                  : "";
              return (
                <article key={row.id} className="val-sign-card">
                  <h3>{row.label}</h3>
                  <p className="val-sign-meta">
                    {slots.length} signature{slots.length > 1 ? "s" : ""}
                    {extra}
                  </p>
                  <ol className="val-sign-steps">
                    {slots.map((slot, i) => (
                      <li key={slot.label}>
                        <span className="val-sign-step-n">{i + 1}</span>
                        <span>
                          {slot.label}
                          <span className="val-sign-role"> ({ROLE_LABELS[slot.role]})</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "archives" ? (
        <div className="val-panel">
          {archives.length === 0 ? (
            <p className="val-empty">
              Aucune archive — les bons entièrement signés sont archivés automatiquement (empreinte
              SHA-256).
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table val-table">
                <thead>
                  <tr>
                    <th>Bon</th>
                    <th>Type</th>
                    <th>Signé le</th>
                    <th>Conservation jusqu&apos;au</th>
                    <th>Empreinte</th>
                  </tr>
                </thead>
                <tbody>
                  {archives.map((a) => (
                    <tr key={a.id}>
                      <td className="fw500">{a.documentNumber}</td>
                      <td>{DOC_KIND_LABELS[a.kind]}</td>
                      <td>
                        {a.signedAt
                          ? new Date(a.signedAt).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td>{new Date(a.retentionUntil).toLocaleDateString("fr-FR")}</td>
                      <td>
                        <code className="val-hash">{a.contentHash}…</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "securite" ? (
        <div className="val-panel val-panel--split">
          <section className="val-sec-block">
            <h2 className="val-sec-title">Actions sensibles</h2>
            <ul className="val-sensitive-list">
              {SENSITIVE_ACTIONS.map((action) => (
                <li key={action.id}>
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="val-sec-block">
            <h2 className="val-sec-title">État par rôle</h2>
            <div className="table-wrap">
              <table className="data-table val-table">
                <thead>
                  <tr>
                    <th>Rôle</th>
                    <th>2FA requis</th>
                    <th>Utilisateurs actifs</th>
                    <th>Sans 2FA</th>
                  </tr>
                </thead>
                <tbody>
                  {security.map((row) => (
                    <tr key={row.role}>
                      <td>{ROLE_LABELS[row.role]}</td>
                      <td>{row.requires2Fa ? "Oui" : "—"}</td>
                      <td>{row.activeUsers}</td>
                      <td>
                        {row.missing2fa > 0 ? (
                          <span className="val-badge val-badge--warn">{row.missing2fa}</span>
                        ) : (
                          <span className="val-badge val-badge--ok">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="val-sec-block val-sec-block--full">
            <h2 className="val-sec-title">Mon authentification 2FA</h2>
            <ProfileTwoFactor />
          </section>
        </div>
      ) : null}
    </div>
  );
}
