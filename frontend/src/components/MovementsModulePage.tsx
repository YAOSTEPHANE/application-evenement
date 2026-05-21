"use client";

import {
  BeSubtype,
  BsSubtype,
  BtSubtype,
  StockDocumentKind,
  StockDocumentStatus,
} from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { btTransitPhaseLabel } from "@/lib/cdc-bt-document";
import { archiveRetentionLabel } from "@/lib/cdc-stock-document-rules";
import { CdcDocumentWizard } from "@/components/CdcDocumentWizard";
import { CdcPageHeader } from "@/components/CdcPageHeader";
import { AppIcon } from "@/components/icons/AppIcon";
import { ModalStockDocument } from "@/components/ModalStockDocument";
import {
  BE_SUBTYPE_LABELS,
  BS_SUBTYPE_LABELS,
  BT_SUBTYPE_LABELS,
  DOC_KIND_LABELS,
  DOC_STATUS_LABELS,
} from "@/lib/cdc-labels";
import { documentLinesRfidComplete } from "@/lib/cdc-order-workflow";
import { useToastContext } from "@/lib/toast/ToastProvider";
import { documentSignPlan, totalSignaturesRequired } from "@/lib/cdc-validation-matrix";
import { listWizardPresets } from "@/lib/cdc-wizard-config";
import type { StockDocumentsKpis } from "@/lib/stock-document-kpis";

type DocLine = {
  id: string;
  itemId: string;
  expectedQty: number;
  scannedQty: number;
  receivedQty: number;
  designation: string | null;
  lineCondition?: string | null;
};

type UserOption = { id: string; fullName: string };

type StockDocumentRow = {
  id: string;
  documentNumber: string;
  kind: keyof typeof DOC_KIND_LABELS;
  status: keyof typeof DOC_STATUS_LABELS;
  beSubtype?: keyof typeof BE_SUBTYPE_LABELS | null;
  bsSubtype?: keyof typeof BS_SUBTYPE_LABELS | null;
  btSubtype?: keyof typeof BT_SUBTYPE_LABELS | null;
  btTransitPhase?: string | null;
  btEmittedAt?: string | null;
  btReceptionScannedAt?: string | null;
  transferDisputeDeadline?: string | null;
  archivedAt?: string | null;
  archive?: { retentionUntil: string; contentHash: string } | null;
  correctsDocument?: { documentNumber: string } | null;
  rectificatoryOf?: Array<{ id: string; documentNumber: string; status: string }>;
  notes?: string | null;
  anomalyNotes?: string | null;
  createdAt: string;
  signedAt?: string | null;
  event?: { id: string; name: string; clientName: string; orderStatus: string } | null;
  fromWarehouse?: { name: string; code: string } | null;
  toWarehouse?: { name: string; code: string } | null;
  lines: DocLine[];
  signatures: Array<{ user: { fullName: string; role: string } }>;
  scanBatches?: Array<{ scannedAt: string; source: string; tagCodes: string[] }>;
  sourceReference?: string | null;
  shipper?: UserOption | null;
  receiver?: UserOption | null;
  driverUserId?: string | null;
};

type MovementsModulePageProps = {
  warehouses: Array<{ id: string; label: string }>;
  events: Array<{ id: string; label: string }>;
  items: Array<{ id: string; label: string }>;
};

type TabId = "all" | "BE" | "BS" | "BT" | "disputes";

function subtypeLabel(doc: StockDocumentRow): string {
  if (doc.beSubtype) return BE_SUBTYPE_LABELS[doc.beSubtype];
  if (doc.bsSubtype) return BS_SUBTYPE_LABELS[doc.bsSubtype];
  if (doc.btSubtype) return BT_SUBTYPE_LABELS[doc.btSubtype];
  return DOC_KIND_LABELS[doc.kind];
}

function lineArticleLabel(
  line: DocLine,
  itemOptions: MovementsModulePageProps["items"],
): string {
  if (line.designation) return line.designation;
  const found = itemOptions.find((i) => i.id === line.itemId);
  return found?.label ?? line.itemId;
}

function statusBadgeClass(status: keyof typeof DOC_STATUS_LABELS): string {
  if (status === "SIGNED") return "badge badge-ok";
  if (status === "DISPUTED") return "badge badge-danger";
  if (status === "CANCELLED") return "badge badge-gray";
  if (status === "PENDING_SIGNATURE") return "badge badge-warn";
  return "badge badge-info";
}

export function MovementsModulePage({ warehouses, events, items }: MovementsModulePageProps) {
  const [kpis, setKpis] = useState<StockDocumentsKpis | null>(null);
  const [documents, setDocuments] = useState<StockDocumentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockDocumentRow | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToastContext();
  const [tab, setTab] = useState<TabId>("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [search, setSearch] = useState("");
  const [scanTags, setScanTags] = useState("");
  const [portiquePortalId, setPortiquePortalId] = useState("");
  const [handheldDeviceId, setHandheldDeviceId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [shipperId, setShipperId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [driverId, setDriverId] = useState("");
  const [portals, setPortals] = useState<
    Array<{ id: string; code: string; label: string; warehouseId: string }>
  >([]);
  const [handhelds, setHandhelds] = useState<
    Array<{ id: string; code: string; label: string }>
  >([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docPreset, setDocPreset] = useState<{
    kind?: "BE" | "BS" | "BT";
    beSubtype?: keyof typeof BE_SUBTYPE_LABELS;
    bsSubtype?: keyof typeof BS_SUBTYPE_LABELS;
    eventId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
  } | null>(null);

  const loadKpis = useCallback(async () => {
    const res = await fetch("/api/cdc/movements/kpis");
    if (res.ok) setKpis(await res.json());
  }, []);

  const loadPortals = useCallback(async () => {
    const res = await fetch("/api/rfid-portals?active=1");
    if (res.ok) {
      const rows = (await res.json()) as Array<{
        id: string;
        code: string;
        label: string;
        warehouseId: string;
      }>;
      setPortals(rows);
    }
  }, []);

  const loadHandhelds = useCallback(async () => {
    const res = await fetch("/api/rfid-handhelds?active=1");
    if (res.ok) {
      setHandhelds(
        (await res.json()) as Array<{ id: string; code: string; label: string }>,
      );
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (tab === "BE" || tab === "BS" || tab === "BT") p.set("kind", tab);
      if (tab === "disputes") p.set("status", StockDocumentStatus.DISPUTED);
      else if (statusFilter) p.set("status", statusFilter);
      if (eventFilter) p.set("eventId", eventFilter);
      if (search.trim()) p.set("search", search.trim());
      const res = await fetch(`/api/stock-documents?${p}`);
      if (res.ok) setDocuments(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter, eventFilter, search]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    const res = await fetch(`/api/stock-documents/${id}`);
    if (res.ok) {
      const d = (await res.json()) as StockDocumentRow;
      setDetail(d);
      setShipperId(d.shipper?.id ?? "");
      setReceiverId(d.receiver?.id ?? "");
      setSourceRef(d.sourceReference ?? "");
      setDriverId(d.driverUserId ?? "");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const rows = (await res.json()) as UserOption[];
      setUsers(rows);
    }
  }, []);

  async function resolveBtDispute(id: string) {
    const notes = window.prompt("Notes d'arbitrage (optionnel) :", "");
    if (notes === null) return;
    const res = await fetch(`/api/stock-documents/${id}/resolve-transfer-dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Arbitrage impossible");
      return;
    }
    showToast("Litige de transfert tranché — BT signé.");
    await openDetail(id);
    await loadDocuments();
  }

  async function saveBsMeta() {
    if (!detail) return;
    const res = await fetch(`/api/stock-documents/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverUserId: driverId || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Enregistrement impossible");
      return;
    }
    showToast("Chauffeur BS enregistré.");
    await openDetail(detail.id);
  }

  async function saveBeMeta() {
    if (!detail) return;
    const res = await fetch(`/api/stock-documents/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipperUserId: shipperId || null,
        receiverUserId: receiverId || null,
        sourceReference: sourceRef.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Enregistrement impossible");
      return;
    }
    showToast("Informations BE enregistrées.");
    await openDetail(detail.id);
  }

  async function setLineCondition(lineId: string, lineCondition: string) {
    if (!detail) return;
    const res = await fetch(`/api/stock-documents/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId, lineCondition }),
    });
    if (res.ok) await openDetail(detail.id);
  }

  useEffect(() => {
    void loadKpis();
    void loadDocuments();
    void loadPortals();
    void loadHandhelds();
    void loadUsers();
  }, [loadKpis, loadDocuments, loadPortals, loadHandhelds, loadUsers]);

  const filteredDocs = useMemo(() => documents, [documents]);

  const signatureMeta = useMemo(() => {
    if (!detail) return null;
    const slots = documentSignPlan(detail.kind as StockDocumentKind, {
      bsSubtype: detail.bsSubtype as BsSubtype | null,
      beSubtype: detail.beSubtype as BeSubtype | null,
      btSubtype: detail.btSubtype as BtSubtype | null,
      btTransitPhase: detail.btTransitPhase as import("@prisma/client").BtTransitPhase | null,
    });
    const needed = totalSignaturesRequired(detail.kind as StockDocumentKind, {
      bsSubtype: detail.bsSubtype as BsSubtype | null,
      beSubtype: detail.beSubtype as BeSubtype | null,
      btSubtype: detail.btSubtype as BtSubtype | null,
    });
    const rfidOk = documentLinesRfidComplete(detail.lines);
    return { slots, needed, signed: detail.signatures.length, rfidOk };
  }, [detail]);

  async function scanDocument(id: string) {
    const tagCodes = scanTags
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagCodes.length === 0) {
      showToast("Saisissez au moins un tag RFID.");
      return;
    }
    const scanUrl = handheldDeviceId
      ? "/api/handheld/scan"
      : `/api/stock-documents/${id}/scan`;
    const scanBody = handheldDeviceId
      ? { tagCodes, documentId: id, handheldId: handheldDeviceId }
      : { tagCodes, source: "HANDHELD" };
    const res = await fetch(scanUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scanBody),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Scan refusé");
      return;
    }
    showToast(`Scan enregistré — statut ${(data as { status?: string }).status ?? ""}`);
    setScanTags("");
    await openDetail(id);
    await loadDocuments();
    await loadKpis();
  }

  async function signDocument(id: string) {
    const res = await fetch(`/api/stock-documents/${id}/sign`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Signature refusée");
      return;
    }
    showToast(`Signature enregistrée — ${(data as { status?: string }).status ?? ""}`);
    await openDetail(id);
    await loadDocuments();
    await loadKpis();
  }

  async function cancelDocument(id: string) {
    const res = await fetch(`/api/stock-documents/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Annulation utilisateur" }),
    });
    if (res.ok) {
      showToast("Bon annulé.");
      await loadDocuments();
      await loadKpis();
      if (selectedId === id) setDetail(null);
    }
  }

  async function rectifyDocument(id: string) {
    const reason = window.prompt("Motif du bon rectificatif (obligatoire) :");
    if (!reason || reason.trim().length < 3) return;
    const res = await fetch(`/api/stock-documents/${id}/rectify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    showToast(
      res.ok
        ? `Rectificatif créé : ${(data as { documentNumber?: string }).documentNumber ?? ""}`
        : ((data as { message?: string }).message ?? "Rectificatif refusé"),
    );
    if (res.ok) {
      await loadDocuments();
      await loadKpis();
      const newId = (data as { id?: string }).id;
      if (newId) await openDetail(newId);
    }
  }

  async function reverseDocument(id: string) {
    const reason = window.prompt("Motif de contre-passation (obligatoire) :");
    if (!reason || reason.trim().length < 3) return;
    const res = await fetch(`/api/stock-documents/${id}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    showToast(
      res.ok
        ? `Contre-passation : ${(data as { documentNumber?: string }).documentNumber ?? "créé"}`
        : ((data as { message?: string }).message ?? "Contre-passation refusée"),
    );
    await loadDocuments();
    await loadKpis();
  }

  async function portiqueScan() {
    const tagCodes = scanTags
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagCodes.length === 0) {
      showToast("Tags requis pour le portique.");
      return;
    }
    const res = await fetch("/api/portique/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagCodes,
        portalId: portiquePortalId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    showToast(
      res.ok
        ? (data as { message?: string }).message ?? "Scan portique OK"
        : ((data as { message?: string }).message ?? "Scan portique refusé"),
    );
    if (res.ok) {
      setScanTags("");
      await loadDocuments();
      await loadKpis();
      const docId = (data as { documentId?: string }).documentId;
      if (docId) await openDetail(docId);
    }
  }

  function openPdf(id: string) {
    window.open(`/api/stock-documents/${id}/pdf`, "_blank", "noopener,noreferrer");
  }

  const wizardPresets = listWizardPresets();

  return (
    <>
      <CdcDocumentWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          void loadDocuments();
          void loadKpis();
        }}
        warehouses={warehouses}
        events={events}
        items={items}
        initialKind={docPreset?.kind ?? "BS"}
        initialSubtype={
          docPreset?.bsSubtype ?? docPreset?.beSubtype ?? "BS_EVT"
        }
      />
      <ModalStockDocument
        isOpen={docModalOpen}
        onClose={() => {
          setDocModalOpen(false);
          setDocPreset(null);
        }}
        onCreated={() => {
          void loadDocuments();
          void loadKpis();
        }}
        warehouses={warehouses}
        events={events}
        items={items}
        preset={docPreset ?? undefined}
      />

      <CdcPageHeader
        icon="documents"
        title="Mouvements de matériel"
        actions={
          <>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-icon"
              onClick={() => setWizardOpen(true)}
            >
              <AppIcon name="plus" size={14} />
              Assistant CDC
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-icon"
              onClick={() => setDocModalOpen(true)}
            >
              <AppIcon name="documents" size={14} />
              Bon rapide
            </button>
            <button
              type="button"
              className="btn btn-gold btn-sm btn-icon"
              disabled={loading}
              onClick={() => {
                void loadDocuments();
                void loadKpis();
              }}
            >
              <AppIcon name="sync" size={14} />
              Actualiser
            </button>
          </>
        }
      />

      {kpis ? (
        <div className="movements-kpi-row">
          <div className="movements-kpi">
            <span className="movements-kpi-val">{kpis.open}</span>
            <span className="movements-kpi-lbl">Bons ouverts</span>
          </div>
          <div className="movements-kpi">
            <span className="movements-kpi-val">{kpis.pendingSignatures}</span>
            <span className="movements-kpi-lbl">À signer</span>
          </div>
          <div className="movements-kpi">
            <span className="movements-kpi-val">{kpis.scanning}</span>
            <span className="movements-kpi-lbl">Scan en cours</span>
          </div>
          <div className="movements-kpi movements-kpi--warn">
            <span className="movements-kpi-val">{kpis.disputed}</span>
            <span className="movements-kpi-lbl">Litiges RFID</span>
          </div>
          <div className="movements-kpi">
            <span className="movements-kpi-val">{kpis.scansToday}</span>
            <span className="movements-kpi-lbl">Scans aujourd&apos;hui</span>
          </div>
          <div className="movements-kpi">
            <span className="movements-kpi-val">{kpis.signed}</span>
            <span className="movements-kpi-lbl">Signés (total)</span>
          </div>
        </div>
      ) : null}

      <div className="movements-tabs">
        {(
          [
            ["all", "Tous"],
            ["BE", "Entrées"],
            ["BS", "Sorties"],
            ["BT", "Transferts"],
            ["disputes", "Litiges"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`movements-tab${tab === id ? " movements-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "BE" && kpis ? ` (${kpis.byKind.BE})` : ""}
            {id === "BS" && kpis ? ` (${kpis.byKind.BS})` : ""}
            {id === "BT" && kpis ? ` (${kpis.byKind.BT})` : ""}
            {id === "disputes" && kpis ? ` (${kpis.disputed})` : ""}
          </button>
        ))}
      </div>

      <div className="movements-filters card card-pad">
        <input
          className="form-input"
          placeholder="N° de bon, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          disabled={tab === "disputes"}
        >
          <option value="">Tous statuts</option>
          {(Object.keys(DOC_STATUS_LABELS) as Array<keyof typeof DOC_STATUS_LABELS>).map((s) => (
            <option key={s} value={s}>
              {DOC_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="form-input" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="">Toutes commandes</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-gold" onClick={() => void loadDocuments()}>
          Filtrer
        </button>
      </div>

      <div className="card card-pad movements-scan-panel">
        <h4 className="fs13 fw500">
          Scan RFID (douchette ou portique)
          {detail?.kind === "BT" && detail.btTransitPhase === "IN_TRANSIT"
            ? " — réception"
            : detail?.kind === "BT"
              ? " — émission"
              : ""}
        </h4>
        <div className="movements-scan-actions" style={{ marginBottom: 8 }}>
          <select
            className="form-input"
            value={handheldDeviceId}
            onChange={(e) => setHandheldDeviceId(e.target.value)}
            aria-label="Douchette"
          >
            <option value="">Douchette (optionnel)</option>
            {handhelds.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label} ({h.code})
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="form-input movements-scan-input"
          rows={2}
          value={scanTags}
          onChange={(e) => setScanTags(e.target.value)}
          placeholder="TAG-001 TAG-002 …"
        />
        <div className="movements-scan-actions">
          <select
            className="form-input"
            value={portiquePortalId}
            onChange={(e) => setPortiquePortalId(e.target.value)}
            aria-label="Portique RFID"
          >
            <option value="">— Portique (recommandé) —</option>
            {portals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.code})
              </option>
            ))}
          </select>
          {detail && detail.status !== "SIGNED" && detail.status !== "CANCELLED" ? (
            <button
              type="button"
              className="btn btn-sm btn-gold"
              onClick={() => void scanDocument(detail.id)}
            >
              Scan sur bon sélectionné
            </button>
          ) : null}
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void portiqueScan()}>
            Scan portique (BS ouvert)
          </button>
        </div>
      </div>

      <div className="movements-layout">
        <div className="movements-list-wrap">
          {filteredDocs.length === 0 ? (
            <div className="empty-state">Aucun bon pour ces critères.</div>
          ) : (
            <ul className="movements-doc-list">
              {filteredDocs.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className={`movements-doc-btn${selectedId === doc.id ? " movements-doc-btn--active" : ""}`}
                    onClick={() => void openDetail(doc.id)}
                  >
                    <span className="fw500">{doc.documentNumber}</span>
                    <span className="fs12 text-muted">{subtypeLabel(doc)}</span>
                    <span className={statusBadgeClass(doc.status)}>{DOC_STATUS_LABELS[doc.status]}</span>
                    {doc.event ? (
                      <span className="fs11 text-muted">{doc.event.name}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {detail ? (
          <aside className="movements-detail card card-pad">
            <div className="movements-detail-hd">
              <div>
                <h3 className="fw500">{detail.documentNumber}</h3>
                <p className="fs12 text-muted">{subtypeLabel(detail)}</p>
              </div>
              <span className={statusBadgeClass(detail.status)}>{DOC_STATUS_LABELS[detail.status]}</span>
            </div>

            {detail.event ? (
              <p className="fs12">
                Commande : <strong>{detail.event.name}</strong> — {detail.event.clientName}
              </p>
            ) : null}
            {detail.fromWarehouse || detail.toWarehouse ? (
              <p className="fs12 text-muted">
                {detail.fromWarehouse ? `De ${detail.fromWarehouse.name}` : ""}
                {detail.fromWarehouse && detail.toWarehouse ? " → " : ""}
                {detail.toWarehouse ? `Vers ${detail.toWarehouse.name}` : ""}
              </p>
            ) : null}
            {detail.anomalyNotes ? (
              <p className="fs12 movements-anomaly">{detail.anomalyNotes}</p>
            ) : null}

            {detail.status === "SIGNED" ? (
              <p className="fs12 doc-immutable-note" role="note">
                Bon signé — lecture seule. Correction : bon rectificatif ; annulation : contre-passation.
                {detail.archive?.retentionUntil
                  ? ` Archive jusqu'au ${new Date(detail.archive.retentionUntil).toLocaleDateString("fr-FR")}.`
                  : detail.signedAt
                    ? ` Conservation prévue jusqu'au ${archiveRetentionLabel(detail.signedAt)}.`
                    : ""}
              </p>
            ) : null}
            {detail.correctsDocument ? (
              <p className="fs12 text-muted">
                Rectificatif de <strong>{detail.correctsDocument.documentNumber}</strong>
              </p>
            ) : null}
            {detail.rectificatoryOf && detail.rectificatoryOf.length > 0 ? (
              <p className="fs12 text-muted">
                Rectificatifs liés :{" "}
                {detail.rectificatoryOf.map((r) => r.documentNumber).join(", ")}
              </p>
            ) : null}

            {detail.kind === "BE" && detail.beSubtype ? (
                <div className="be-detail-meta form-premium">
                  <p className="fs12 fw500">Référence et responsables</p>
                  <div className="fg">
                    <label htmlFor="be-source-ref">Référence source (BL, BT, commande)</label>
                    <input
                      id="be-source-ref"
                      className="fi"
                      value={sourceRef}
                      onChange={(e) => setSourceRef(e.target.value)}
                    />
                  </div>
                  <div className="fg">
                    <label htmlFor="be-shipper">Livreur</label>
                    <select
                      id="be-shipper"
                      className="fs"
                      value={shipperId}
                      onChange={(e) => setShipperId(e.target.value)}
                    >
                      <option value="">— Sélectionner —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="fg">
                    <label htmlFor="be-receiver">Réceptionnaire</label>
                    <select
                      id="be-receiver"
                      className="fs"
                      value={receiverId}
                      onChange={(e) => setReceiverId(e.target.value)}
                    >
                      <option value="">— Sélectionner —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => void saveBeMeta()}>
                    Enregistrer livreur / réceptionnaire
                  </button>
                </div>
            ) : null}

            {detail.kind === "BT" && detail.btSubtype ? (
              <>
                {detail.btTransitPhase === "IN_TRANSIT" && detail.status !== "DISPUTED" ? (
                  <p className="bt-transit-banner" role="status">
                    {btTransitPhaseLabel(detail.btTransitPhase, detail.status)} — scannez à
                    l&apos;arrivée puis signez la réception.
                  </p>
                ) : null}
                {detail.status === "DISPUTED" && detail.transferDisputeDeadline ? (
                  <div className="bt-dispute-banner" role="alert">
                    Litige transfert — écart expédié/reçu. Arbitrage administrateur avant le{" "}
                    {new Date(detail.transferDisputeDeadline).toLocaleString("fr-FR")}.
                    <button
                      type="button"
                      className="btn btn-sm btn-gold"
                      style={{ marginTop: 8 }}
                      onClick={() => void resolveBtDispute(detail.id)}
                    >
                      Trancher le litige (admin)
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {detail.kind === "BS" && detail.bsSubtype ? (
              <>
                {detail.bsSubtype === "BS_EVT" ? (
                  <div className="bs-detail-meta form-premium">
                    <p className="fs12 fw500">Chauffeur</p>
                    <div className="fg">
                      <label htmlFor="bs-driver">Chauffeur / transport</label>
                      <select
                        id="bs-driver"
                        className="fs"
                        value={driverId}
                        onChange={(e) => setDriverId(e.target.value)}
                      >
                        <option value="">— Sélectionner —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void saveBsMeta()}>
                      Enregistrer chauffeur
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {signatureMeta ? (
              <div className="movements-sig-block">
                <p className="fs12 fw500">
                  Signatures {signatureMeta.signed}/{signatureMeta.needed}
                  {!signatureMeta.rfidOk ? (
                    <span className="badge badge-danger" style={{ marginLeft: 8 }}>
                      Scan RFID incomplet
                    </span>
                  ) : (
                    <span className="badge badge-ok" style={{ marginLeft: 8 }}>
                      Scan RFID OK
                    </span>
                  )}
                </p>
                <ul className="fs12 movements-sig-slots">
                  {signatureMeta.slots.map((slot, i) => (
                    <li key={slot.label} className={i < signatureMeta.signed ? "ok" : ""}>
                      {slot.label}
                      {detail.signatures[i] ? ` — ${detail.signatures[i].user.fullName}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <h4 className="fs13 fw500 mt12">Lignes</h4>
            <div className="table-wrap">
              <table className="data-table fs12">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Attendu</th>
                    <th>Reçu</th>
                    <th>Scanné</th>
                    {detail.kind === "BE" ? <th>État</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => (
                    <tr
                      key={line.id}
                      className={line.scannedQty < line.expectedQty ? "movements-line-warn" : ""}
                    >
                      <td>{lineArticleLabel(line, items)}</td>
                      <td>{line.expectedQty}</td>
                      <td>{line.receivedQty}</td>
                      <td>{line.scannedQty}</td>
                      {detail.kind === "BE" ? (
                        <td>
                          <select
                            className="fs fs12"
                            value={line.lineCondition ?? "OK"}
                            onChange={(e) => void setLineCondition(line.id, e.target.value)}
                            disabled={detail.status === "SIGNED" || detail.status === "CANCELLED"}
                          >
                            <option value="OK">Bon</option>
                            <option value="DAMAGED">Endommagé</option>
                            <option value="MISSING">Manquant</option>
                          </select>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detail.scanBatches && detail.scanBatches.length > 0 ? (
              <>
                <h4 className="fs13 fw500 mt12">Derniers scans</h4>
                <ul className="fs12 movements-scans">
                  {detail.scanBatches.map((b, i) => (
                    <li key={`${b.scannedAt}-${i}`}>
                      {new Date(b.scannedAt).toLocaleString("fr-FR")} — {b.source} (
                      {b.tagCodes.length} tags)
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="movements-detail-actions">
              {detail.status !== "SIGNED" && detail.status !== "CANCELLED" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-gold"
                    onClick={() => void signDocument(detail.id)}
                    disabled={signatureMeta ? !signatureMeta.rfidOk : false}
                    title={
                      signatureMeta && !signatureMeta.rfidOk
                        ? "Scan RFID complet requis avant signature finale"
                        : undefined
                    }
                  >
                    Signer
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void cancelDocument(detail.id)}
                  >
                    Annuler
                  </button>
                </>
              ) : null}
              <button type="button" className="btn btn-sm btn-outline btn-icon" onClick={() => openPdf(detail.id)}>
                <AppIcon name="fileExport" size={14} />
                PDF
              </button>
              {detail.status === "SIGNED" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void rectifyDocument(detail.id)}
                  >
                    Bon rectificatif
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void reverseDocument(detail.id)}
                  >
                    Contre-passation
                  </button>
                </>
              ) : null}
            </div>

            <details className="movements-presets mt12">
              <summary className="fs12 fw500">Créer un autre type de bon</summary>
              <div className="movements-preset-grid">
                {wizardPresets.map((p) => (
                  <button
                    key={`${p.kind}-${p.subtype}`}
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setDocPreset({
                        kind: p.kind,
                        ...(p.kind === "BE"
                          ? { beSubtype: p.subtype as keyof typeof BE_SUBTYPE_LABELS }
                          : p.kind === "BS"
                            ? { bsSubtype: p.subtype as keyof typeof BS_SUBTYPE_LABELS }
                            : {}),
                        eventId: detail.event?.id,
                      });
                      setWizardOpen(true);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </details>
          </aside>
        ) : (
          <aside className="movements-detail card card-pad movements-detail--empty">
            <p className="fs13 text-muted">Sélectionnez un bon pour scan, signatures et PDF.</p>
          </aside>
        )}
      </div>
    </>
  );
}
