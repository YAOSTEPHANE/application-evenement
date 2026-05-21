"use client";

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
import type { RfidHandheldStats } from "@/lib/rfid-handheld-db";
import { parseTagCodesInput } from "@/lib/rfid-portal-scan";

type WarehouseOption = { id: string; name: string; code: string };
type UserOption = { id: string; fullName: string; email: string };

type HandheldRow = {
  id: string;
  code: string;
  label: string;
  serialNumber: string | null;
  batteryAutonomyHours: number;
  lastSyncAt: string | null;
  active: boolean;
  lastScanAt: string | null;
  warehouseId: string | null;
  warehouse: { id: string; name: string; code: string; city: string | null } | null;
  assignedUserId: string | null;
  assignedUser: { id: string; fullName: string; email: string; role: string } | null;
  scanBatchCount: number;
};

type DocOption = { id: string; documentNumber: string; kind: string; status: string };

type RfidHandheldsPanelProps = {
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

export function RfidHandheldsPanel({ warehouses }: RfidHandheldsPanelProps) {
  const [devices, setDevices] = useState<HandheldRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [openDocs, setOpenDocs] = useState<DocOption[]>([]);
  const [stats, setStats] = useState<RfidHandheldStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HandheldRow | null>(null);
  const [testTags, setTestTags] = useState("");
  const [testDocId, setTestDocId] = useState("");

  const [formCode, setFormCode] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formUserId, setFormUserId] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formBatteryHours, setFormBatteryHours] = useState(24);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes, usersRes, docsRes] = await Promise.all([
        fetch("/api/rfid-handhelds"),
        fetch("/api/rfid-handhelds/stats"),
        fetch("/api/users"),
        fetch("/api/stock-documents"),
      ]);
      if (listRes.ok) setDevices((await listRes.json()) as HandheldRow[]);
      if (statsRes.ok) setStats((await statsRes.json()) as RfidHandheldStats);
      if (usersRes.ok) {
        const rows = (await usersRes.json()) as Array<{ id: string; fullName: string; email: string }>;
        setUsers(rows.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email })));
      }
      if (docsRes.ok) {
        const rows = (await docsRes.json()) as DocOption[];
        setOpenDocs(
          rows.filter((d) => d.status !== "SIGNED" && d.status !== "CANCELLED").slice(0, 40),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => (selectedId ? devices.find((d) => d.id === selectedId) ?? null : null),
    [devices, selectedId],
  );

  function openCreate() {
    setEditing(null);
    setFormCode("");
    setFormLabel("");
    setFormSerial("");
    setFormWarehouseId(warehouses[0]?.id ?? "");
    setFormUserId("");
    setFormBatteryHours(24);
    setFormActive(true);
    setModalOpen(true);
  }

  function openEdit(row: HandheldRow) {
    setEditing(row);
    setFormCode(row.code);
    setFormLabel(row.label);
    setFormSerial(row.serialNumber ?? "");
    setFormWarehouseId(row.warehouseId ?? "");
    setFormUserId(row.assignedUserId ?? "");
    setFormBatteryHours(row.batteryAutonomyHours);
    setFormActive(row.active);
    setModalOpen(true);
  }

  async function saveDevice() {
    const payload = {
      code: formCode,
      label: formLabel,
      serialNumber: formSerial || null,
      batteryAutonomyHours: formBatteryHours,
      warehouseId: formWarehouseId || null,
      assignedUserId: formUserId || null,
      active: formActive,
    };
    const res = await fetch(editing ? `/api/rfid-handhelds/${editing.id}` : "/api/rfid-handhelds", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage((data as { message?: string }).message ?? "Enregistrement impossible");
      return;
    }
    setMessage(editing ? "Douchette mise à jour." : "Douchette créée.");
    setModalOpen(false);
    await load();
  }

  async function runTestScan(device: HandheldRow) {
    const tagCodes = parseTagCodesInput(testTags);
    if (tagCodes.length === 0 || !testDocId) {
      setMessage("Tags et bon ouvert requis pour le test.");
      return;
    }
    const res = await fetch("/api/handheld/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagCodes, documentId: testDocId, handheldId: device.id }),
    });
    const data = await res.json();
    setMessage((data as { message?: string }).message ?? (res.ok ? "Scan OK" : "Scan refusé"));
    if (res.ok) await load();
  }

  const webhookBase = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="rfid-handhelds">
      {stats ? (
        <div className="rfid-portals-kpi">
          <article className="rfid-portals-kpi-card">
            <strong>{stats.total}</strong>
            <span>Douchettes</span>
          </article>
          <article className="rfid-portals-kpi-card rfid-portals-kpi-card--ok">
            <strong>{stats.active}</strong>
            <span>Actives</span>
          </article>
          <article className="rfid-portals-kpi-card">
            <strong>{stats.assigned}</strong>
            <span>Affectées</span>
          </article>
          <article className="rfid-portals-kpi-card">
            <strong>{stats.scannedLast24h}</strong>
            <span>Utilisées 24 h</span>
          </article>
        </div>
      ) : null}

      <div className="rfid-portals-toolbar">
        <button type="button" className="btn btn-gold btn-sm" onClick={openCreate}>
          <AppIcon name="plus" size={14} />
          Nouvelle douchette
        </button>
      </div>

      <div className={`rfid-portals-layout${selected ? " rfid-portals-layout--drawer" : ""}`}>
        <div className="rfid-portals-list">
          {loading ? (
            <p className="fs13 fc-3">Chargement…</p>
          ) : devices.length === 0 ? (
            <div className="rfid-portals-empty">
              <AppIcon name="scan" size={32} />
              <p>Aucune douchette configurée.</p>
              <button type="button" className="btn btn-gold" onClick={openCreate}>
                Créer une douchette
              </button>
            </div>
          ) : (
            <div className="rfid-portals-grid">
              {devices.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`rfid-portal-card rfid-handheld-card${!d.active ? " rfid-portal-card--off" : ""}${
                    selectedId === d.id ? " rfid-portal-card--on" : ""
                  }`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <div className="rfid-portal-card-hd">
                    <span className="rfid-portal-card-code">{d.code}</span>
                    <span className={`badge ${d.active ? "badge-ok" : "badge-gray"}`}>
                      {d.active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <h3>{d.label}</h3>
                  <p className="rfid-portal-card-meta">
                    {d.assignedUser?.fullName ?? "Non affectée"}
                    {d.warehouse ? ` · ${d.warehouse.name}` : ""}
                  </p>
                  <p className="rfid-portal-card-scan">
                    Sync : {formatLastScan(d.lastSyncAt)} · {d.batteryAutonomyHours} h autonomie
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
                <dt>Opérateur</dt>
                <dd>{selected.assignedUser?.fullName ?? "—"}</dd>
              </div>
              <div>
                <dt>Entrepôt de rattachement</dt>
                <dd>{selected.warehouse?.name ?? "—"}</dd>
              </div>
              {selected.serialNumber ? (
                <div>
                  <dt>N° série</dt>
                  <dd>{selected.serialNumber}</dd>
                </div>
              ) : null}
              <div>
                <dt>Autonomie cible</dt>
                <dd>{selected.batteryAutonomyHours} h (CDC ≥ 24 h)</dd>
              </div>
              <div>
                <dt>Dernière synchro</dt>
                <dd>{formatLastScan(selected.lastSyncAt)}</dd>
              </div>
              <div>
                <dt>Scans enregistrés</dt>
                <dd>{selected.scanBatchCount}</dd>
              </div>
              <div>
                <dt>URL matériel (POST JSON)</dt>
                <dd className="rfid-portal-url">
                  {webhookBase}/api/rfid-handhelds/by-code/{selected.code}/scan
                  <br />
                  <span className="fs11 fc-3">Corps : documentId, tagCodes[]</span>
                </dd>
              </div>
            </dl>

            <label className="form-label" htmlFor="hh-test-doc">
              Bon ouvert (test)
            </label>
            <select
              id="hh-test-doc"
              className="form-input"
              value={testDocId}
              onChange={(e) => setTestDocId(e.target.value)}
              aria-label="Bon pour test douchette"
            >
              <option value="">— Choisir un bon —</option>
              {openDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.documentNumber} ({d.kind}) — {d.status}
                </option>
              ))}
            </select>
            <label className="form-label mt8" htmlFor="hh-test-tags">
              Tags lus
            </label>
            <textarea
              id="hh-test-tags"
              className="form-input"
              rows={2}
              value={testTags}
              onChange={(e) => setTestTags(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-gold btn-sm mt8"
              onClick={() => void runTestScan(selected)}
            >
              <AppIcon name="scan" size={14} />
              Simuler scan
            </button>

            <div className="rfid-portal-drawer-ft">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(selected)}>
                Modifier
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  const res = await fetch(`/api/rfid-handhelds/${selected.id}`, { method: "DELETE" });
                  if (res.ok) {
                    setSelectedId(null);
                    await load();
                  }
                }}
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
        title={editing ? "Modifier la douchette" : "Nouvelle douchette"}
        subtitle="Lecteur portable — inventaire et contrôle"
        icon="scan"
        onClose={() => setModalOpen(false)}
        footer={
          <FormActions>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Annuler
            </button>
            <button type="button" className="btn btn-gold" onClick={() => void saveDevice()}>
              Enregistrer
            </button>
          </FormActions>
        }
      >
        <FormGrid>
          <FormField label="Code (ex. DOUCHETTE-STOCK-01)" required>
            <FormInput value={formCode} onChange={(e) => setFormCode(e.target.value)} />
          </FormField>
          <FormField label="Libellé" required>
            <FormInput value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
          </FormField>
          <FormField label="N° série">
            <FormInput value={formSerial} onChange={(e) => setFormSerial(e.target.value)} />
          </FormField>
          <FormField label="Autonomie cible (heures)">
            <FormInput
              type="number"
              min={8}
              max={72}
              value={formBatteryHours}
              onChange={(e) => setFormBatteryHours(Number(e.target.value) || 24)}
              aria-label="Autonomie batterie en heures"
            />
          </FormField>
          <FormField label="Entrepôt (optionnel)">
            <FormSelect
              value={formWarehouseId}
              onChange={(e) => setFormWarehouseId(e.target.value)}
              aria-label="Entrepôt"
            >
              <option value="">— Aucun —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Opérateur affecté">
            <FormSelect
              value={formUserId}
              onChange={(e) => setFormUserId(e.target.value)}
              aria-label="Opérateur"
            >
              <option value="">— Non affectée —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
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
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </FormSelect>
          </FormField>
        </FormGrid>
      </ModalForm>
    </div>
  );
}
