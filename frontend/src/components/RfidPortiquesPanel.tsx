"use client";

import { PortalInstallationSite, PortalPassageDirection } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FormActions,
  FormField,
  FormGrid,
  FormInput,
  FormSelect,
  ModalForm,
} from "@/components/forms/FormPrimitives";
import { AppIcon } from "@/components/icons/AppIcon";
import { PORTAL_PASSAGE_LABELS } from "@/lib/cdc-labels";
import {
  documentsSoughtForPortal,
  PORTAL_INSTALLATION_LABELS,
  type RfidScanAlert,
} from "@/lib/rfid-reading-equipment";
import type { RfidPortalStats } from "@/lib/rfid-portal-db";
import { parseTagCodesInput } from "@/lib/rfid-portal-scan";
import { playRfidAlertSound } from "@/lib/rfid-scan-alerts";

type WarehouseOption = { id: string; name: string; code: string };

type PortalRow = {
  id: string;
  code: string;
  label: string;
  locationHint: string | null;
  installationSite: PortalInstallationSite;
  passageDirection: PortalPassageDirection;
  active: boolean;
  lastScanAt: string | null;
  warehouseId: string;
  warehouse: { id: string; name: string; code: string; city: string | null };
  scanBatchCount: number;
};

const DIRECTIONS = Object.keys(PORTAL_PASSAGE_LABELS) as PortalPassageDirection[];

type RfidPortiquesPanelProps = {
  warehouses: WarehouseOption[];
};

function formatLastScan(iso: string | null): string {
  if (!iso) return "Jamais";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RfidPortiquesPanel({ warehouses }: RfidPortiquesPanelProps) {
  const [portals, setPortals] = useState<PortalRow[]>([]);
  const [stats, setStats] = useState<RfidPortalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalRow | null>(null);
  const [testTags, setTestTags] = useState("");
  const [lastScanAlert, setLastScanAlert] = useState<RfidScanAlert | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formHint, setFormHint] = useState("");
  const [formDirection, setFormDirection] = useState<PortalPassageDirection>("EXIT");
  const [formInstallation, setFormInstallation] =
    useState<PortalInstallationSite>("WAREHOUSE_GATE");
  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formActive, setFormActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch("/api/rfid-portals"),
        fetch("/api/rfid-portals/stats"),
      ]);
      if (listRes.ok) setPortals((await listRes.json()) as PortalRow[]);
      if (statsRes.ok) setStats((await statsRes.json()) as RfidPortalStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => (selectedId ? portals.find((p) => p.id === selectedId) ?? null : null),
    [portals, selectedId],
  );

  function openCreate() {
    setEditing(null);
    setFormCode("");
    setFormLabel("");
    setFormHint("");
    setFormDirection("EXIT");
    setFormInstallation("WAREHOUSE_GATE");
    setFormWarehouseId(warehouses[0]?.id ?? "");
    setFormActive(true);
    setModalOpen(true);
  }

  function openEdit(row: PortalRow) {
    setEditing(row);
    setFormCode(row.code);
    setFormLabel(row.label);
    setFormHint(row.locationHint ?? "");
    setFormDirection(row.passageDirection);
    setFormInstallation(row.installationSite);
    setFormWarehouseId(row.warehouseId);
    setFormActive(row.active);
    setModalOpen(true);
  }

  async function savePortal() {
    const payload = {
      code: formCode,
      label: formLabel,
      locationHint: formHint || null,
      installationSite: formInstallation,
      passageDirection: formDirection,
      warehouseId: formWarehouseId,
      active: formActive,
    };
    const res = await fetch(editing ? `/api/rfid-portals/${editing.id}` : "/api/rfid-portals", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage((data as { message?: string }).message ?? "Enregistrement impossible");
      return;
    }
    setMessage(editing ? "Portique mis à jour." : "Portique créé.");
    setModalOpen(false);
    await load();
  }

  async function toggleActive(row: PortalRow) {
    const res = await fetch(`/api/rfid-portals/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    if (res.ok) {
      setMessage(row.active ? "Portique désactivé." : "Portique activé.");
      await load();
    }
  }

  async function deletePortal(row: PortalRow) {
    const res = await fetch(`/api/rfid-portals/${row.id}`, { method: "DELETE" });
    const data = (await res.json()) as { deactivated?: boolean };
    if (res.ok) {
      setMessage(
        data.deactivated
          ? "Portique désactivé (historique de scans conservé)."
          : "Portique supprimé.",
      );
      setSelectedId(null);
      await load();
    }
  }

  async function runTestScan(portal: PortalRow) {
    const tagCodes = parseTagCodesInput(testTags);
    if (tagCodes.length === 0) {
      setMessage("Saisissez au moins un tag pour le test.");
      return;
    }
    const res = await fetch("/api/portique/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagCodes, portalId: portal.id }),
    });
    const data = (await res.json()) as {
      message?: string;
      alert?: RfidScanAlert;
    };
    if (data.alert) {
      setLastScanAlert(data.alert);
      playRfidAlertSound(data.alert.level);
    }
    setMessage(data.message ?? (res.ok ? "Passage enregistré" : "Scan refusé"));
    if (res.ok) await load();
  }

  const webhookBase =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="rfid-portals">
      {stats ? (
        <div className="rfid-portals-kpi">
          <article className="rfid-portals-kpi-card">
            <strong>{stats.total}</strong>
            <span>Portiques</span>
          </article>
          <article className="rfid-portals-kpi-card rfid-portals-kpi-card--ok">
            <strong>{stats.active}</strong>
            <span>Actifs</span>
          </article>
          <article className="rfid-portals-kpi-card">
            <strong>{stats.exitPortals}</strong>
            <span>Sortie (BS)</span>
          </article>
          <article className="rfid-portals-kpi-card">
            <strong>{stats.entryPortals}</strong>
            <span>Entrée (BE)</span>
          </article>
          <article className="rfid-portals-kpi-card">
            <strong>{stats.scannedLast24h}</strong>
            <span>Actifs 24 h</span>
          </article>
        </div>
      ) : null}

      <div className="rfid-portals-toolbar">
        <button type="button" className="btn btn-gold btn-sm" onClick={openCreate}>
          <AppIcon name="plus" size={14} />
          Nouveau portique
        </button>
      </div>

      <div className={`rfid-portals-layout${selected ? " rfid-portals-layout--drawer" : ""}`}>
        <div className="rfid-portals-list">
          {loading ? (
            <p className="fs13 fc-3">Chargement…</p>
          ) : portals.length === 0 ? (
            <div className="rfid-portals-empty">
              <AppIcon name="rfid" size={32} />
              <p>Aucun portique configuré.</p>
              <button type="button" className="btn btn-gold" onClick={openCreate}>
                Créer un portique
              </button>
            </div>
          ) : (
            <div className="rfid-portals-grid">
              {portals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rfid-portal-card${!p.active ? " rfid-portal-card--off" : ""}${
                    selectedId === p.id ? " rfid-portal-card--on" : ""
                  }`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="rfid-portal-card-hd">
                    <span className="rfid-portal-card-code">{p.code}</span>
                    <span className={`badge ${p.active ? "badge-ok" : "badge-gray"}`}>
                      {p.active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <h3>{p.label}</h3>
                  <p className="rfid-portal-card-meta">
                    {p.warehouse.name} · {PORTAL_INSTALLATION_LABELS[p.installationSite]} ·{" "}
                    {PORTAL_PASSAGE_LABELS[p.passageDirection]}
                  </p>
                  <p className="rfid-portal-card-scan">
                    Dernier scan : {formatLastScan(p.lastScanAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <aside className="rfid-portal-drawer">
            <div className="rfid-portal-drawer-hd">
              <div>
                <h2>{selected.label}</h2>
                <p className="mono fs12 fc-3">{selected.code}</p>
              </div>
              <button
                type="button"
                className="rfid-portal-drawer-close"
                onClick={() => setSelectedId(null)}
                aria-label="Fermer"
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>
            <dl className="rfid-portal-dl">
              <div>
                <dt>Site / entrepôt</dt>
                <dd>
                  {selected.warehouse.name} ({selected.warehouse.code})
                </dd>
              </div>
              <div>
                <dt>Installation</dt>
                <dd>{PORTAL_INSTALLATION_LABELS[selected.installationSite]}</dd>
              </div>
              <div>
                <dt>Passage</dt>
                <dd>{PORTAL_PASSAGE_LABELS[selected.passageDirection]}</dd>
              </div>
              <div>
                <dt>Bons recherchés</dt>
                <dd>
                  {documentsSoughtForPortal(
                    selected.passageDirection,
                    selected.installationSite,
                  )}
                </dd>
              </div>
              {selected.locationHint ? (
                <div>
                  <dt>Emplacement</dt>
                  <dd>{selected.locationHint}</dd>
                </div>
              ) : null}
              <div>
                <dt>Scans enregistrés</dt>
                <dd>{selected.scanBatchCount}</dd>
              </div>
              <div>
                <dt>URL matériel (POST JSON)</dt>
                <dd className="rfid-portal-url">
                  {webhookBase}/api/rfid-portals/by-code/{selected.code}/scan
                </dd>
              </div>
            </dl>

            <label className="form-label" htmlFor="portal-test-tags">
              Test — tags lus
            </label>
            <textarea
              id="portal-test-tags"
              className="form-input"
              rows={2}
              value={testTags}
              onChange={(e) => setTestTags(e.target.value)}
              placeholder="TAG-001 TAG-002"
            />
            <button
              type="button"
              className="btn btn-gold btn-sm mt8"
              onClick={() => void runTestScan(selected)}
            >
              <AppIcon name="scan" size={14} />
              Simuler passage automatique
            </button>
            {lastScanAlert ? (
              <div
                className={`rfid-scan-alert rfid-scan-alert--${lastScanAlert.level}`}
                role="alert"
              >
                <AppIcon
                  name={lastScanAlert.level === "ok" ? "check" : "shield"}
                  size={18}
                />
                <div>
                  <strong>{lastScanAlert.title}</strong>
                  <p className="fs12" style={{ margin: "4px 0 0" }}>
                    {lastScanAlert.detail}
                  </p>
                  {lastScanAlert.sound ? (
                    <span className="fs11 fc-3">Alerte sonore activée</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="rfid-portal-drawer-ft">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(selected)}>
                Modifier
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void toggleActive(selected)}>
                {selected.active ? "Désactiver" : "Activer"}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => void deletePortal(selected)}
              >
                Supprimer
              </button>
            </div>
          </aside>
        ) : null}
      </div>

      {message ? (
        <p className="rfid-portals-msg" role="status">
          {message}
        </p>
      ) : null}

      <ModalForm
        isOpen={modalOpen}
        title={editing ? "Modifier le portique" : "Nouveau portique"}
        subtitle="Lecteur fixe — passage entrée/sortie du site"
        icon="rfid"
        onClose={() => setModalOpen(false)}
        footer={
          <FormActions>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Annuler
            </button>
            <button type="button" className="btn btn-gold" onClick={() => void savePortal()}>
              Enregistrer
            </button>
          </FormActions>
        }
      >
        <FormGrid>
          <FormField label="Code matériel (ex. PORTIQUE-ABJ-NORD)" required>
            <FormInput value={formCode} onChange={(e) => setFormCode(e.target.value)} />
          </FormField>
          <FormField label="Libellé">
            <FormInput value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
          </FormField>
          <FormField label="Emplacement / passage">
            <FormInput
              value={formHint}
              onChange={(e) => setFormHint(e.target.value)}
              placeholder="Quai nord, portail A…"
            />
          </FormField>
          <FormField label="Type d'installation">
            <FormSelect
              value={formInstallation}
              onChange={(e) =>
                setFormInstallation(e.target.value as PortalInstallationSite)
              }
              aria-label="Type d'installation du portique"
            >
              {(Object.keys(PORTAL_INSTALLATION_LABELS) as PortalInstallationSite[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {PORTAL_INSTALLATION_LABELS[k]}
                  </option>
                ),
              )}
            </FormSelect>
          </FormField>
          <FormField label="Entrepôt / site">
            <FormSelect
              value={formWarehouseId}
              onChange={(e) => setFormWarehouseId(e.target.value)}
              aria-label="Entrepôt du portique"
            >
              <option value="">— Choisir —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Sens du passage">
            <FormSelect
              value={formDirection}
              onChange={(e) => setFormDirection(e.target.value as PortalPassageDirection)}
              aria-label="Sens du passage"
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {PORTAL_PASSAGE_LABELS[d]}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Statut">
            <FormSelect
              value={formActive ? "1" : "0"}
              onChange={(e) => setFormActive(e.target.value === "1")}
              aria-label="Statut actif"
            >
              <option value="1">Actif</option>
              <option value="0">Inactif</option>
            </FormSelect>
          </FormField>
        </FormGrid>
      </ModalForm>
    </div>
  );
}
