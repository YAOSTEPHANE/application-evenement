"use client";

import { OrderStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FormGrid, FormInput, FormSelect, FormTextarea, ModalForm } from "@/components/forms/FormPrimitives";
import { AppIcon } from "@/components/icons/AppIcon";
import { ORDER_STATUS_LABELS, ORDER_STATUS_SHORT_LABELS } from "@/lib/cdc-labels";
import { stashCdcBonsFlow } from "@/lib/cdc-bons-navigation";
import type { OrderWorkflowState } from "@/lib/cdc-order-workflow";
import {
  TRIO_PILLAR_LABELS,
  type OperationalTrioPillar,
  type TrioValidationState,
} from "@/lib/cdc-order-trio";
import { OrderInterdependencePanel } from "@/components/OrderInterdependencePanel";
import { OrderLifecycleBar } from "@/components/OrderLifecycleBar";
import { OrderTrioValidation } from "@/components/OrderTrioValidation";
import { ResponsibilityChain } from "@/components/ResponsibilityChain";
import { useToastContext } from "@/lib/toast/ToastProvider";

type EventSummary = {
  id: string;
  name: string;
  clientName: string;
  location: string;
  startsAt: string;
  endsAt: string;
  orderStatus: OrderStatus;
};

type OrderStats = {
  pending: number;
  inProgress: number;
  settled: number;
  total: number;
  upcoming: number;
  withMaterial: number;
};

type AvailabilityRow = {
  id: string;
  name: string;
  reference: string;
  emoji: string | null;
  categoryName: string;
  availableForPeriod: number;
  reservedOnPeriod: number;
};

type UserOption = { id: string; fullName: string; role: string };
type VehicleOption = { id: string; label: string; plateNumber: string; status: string };
type StaffOption = { id: string; fullName: string; category: string; userId: string };

type OrderDetail = {
  event: EventSummary & {
    notes: string | null;
    teamLeader: { id: string; fullName: string } | null;
    vehicle: { id: string; label: string; plateNumber: string } | null;
    commercial: { fullName: string } | null;
    owner: { fullName: string };
    eventItems: Array<{
      id: string;
      quantity: number;
      item: { name: string; reference: string; emoji: string | null };
    }>;
  };
  progress: {
    percent: number;
    hasAllocations: boolean;
    bsSigned: boolean;
    beRetSigned: boolean;
    teamLeaderSet: boolean;
    vehicleSet: boolean;
    crewCount: number;
  };
  assignments: Array<{ id: string; isTeamLeader: boolean; user: { fullName: string } }>;
  history: Array<{ at: string; label: string; detail?: string }>;
  orderStatusLabel: string;
  orderStatusShortLabel: string;
  orderStatusSignification: string;
  trio: TrioValidationState;
  workflow: OrderWorkflowState;
};

type OrdersModulePageProps = {
  onRefreshEvents?: () => void;
  onNavigateToBons?: (documentId?: string) => void;
};

function statusCardClass(status: OrderStatus): string {
  if (status === OrderStatus.SETTLED) return "orders-card--settled";
  if (status === OrderStatus.IN_PROGRESS) return "orders-card--progress";
  return "orders-card--pending";
}

function statusDrawerClass(status: OrderStatus): string {
  if (status === OrderStatus.SETTLED) return "orders-drawer-status--settled";
  if (status === OrderStatus.IN_PROGRESS) return "orders-drawer-status--progress";
  return "orders-drawer-status--pending";
}

function roughProgress(status: OrderStatus): number {
  if (status === OrderStatus.SETTLED) return 100;
  if (status === OrderStatus.IN_PROGRESS) return 55;
  return 18;
}

function ringStyle(percent: number): React.CSSProperties {
  const p = Math.min(100, Math.max(0, percent));
  return {
    background: `conic-gradient(var(--gold) ${p * 3.6}deg, var(--surface3) 0deg)`,
  };
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const e = new Date(endsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return `${s} → ${e}`;
}

function KanbanColumn({
  variant,
  title,
  count,
  children,
}: {
  variant: "pending" | "progress" | "settled";
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`orders-kanban-col orders-kanban-col--${variant}`}>
      <div className="orders-kanban-col-hd">
        <span>{title}</span>
        <span className="orders-kanban-count">{count}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function OrdersModulePage({ onRefreshEvents, onNavigateToBons }: OrdersModulePageProps) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToastContext();
  const [listSearch, setListSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formSite, setFormSite] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [catalog, setCatalog] = useState<AvailabilityRow[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [catalogQ, setCatalogQ] = useState("");

  const [users, setUsers] = useState<UserOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [assignLeaderId, setAssignLeaderId] = useState("");
  const [assignVehicleId, setAssignVehicleId] = useState("");
  const [assignStaffId, setAssignStaffId] = useState("");
  const [trioValidating, setTrioValidating] = useState<OperationalTrioPillar | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/cdc/orders/stats");
    if (res.ok) setStats((await res.json()) as OrderStats);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        setEvents(
          rows.map((r) => ({
            id: r.id as string,
            name: r.name as string,
            clientName: r.clientName as string,
            location: r.location as string,
            startsAt: r.startsAt as string,
            endsAt: r.endsAt as string,
            orderStatus: (r.orderStatus as OrderStatus) ?? OrderStatus.PENDING,
          })),
        );
      }
      await loadStats();
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  const loadRefs = useCallback(async () => {
    const [uRes, vRes, sRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/hr/vehicles"),
      fetch("/api/hr/staff"),
    ]);
    if (uRes.ok) {
      const rows = (await uRes.json()) as UserOption[];
      setUsers(rows);
      if (!ownerId && rows[0]) setOwnerId(rows[0].id);
    }
    if (vRes.ok) setVehicles(await vRes.json());
    if (sRes.ok) {
      const rows = (await sRes.json()) as Array<{
        user: { id: string; fullName: string };
        category: string;
      }>;
      setStaff(
        rows.map((r) => ({
          id: r.user.id,
          userId: r.user.id,
          fullName: r.user.fullName,
          category: r.category,
        })),
      );
    }
  }, [ownerId]);

  useEffect(() => {
    void loadEvents();
    void loadRefs();
  }, [loadEvents, loadRefs]);

  const loadAvailability = useCallback(async () => {
    if (!formStart || !formEnd) return;
    const p = new URLSearchParams({
      startsAt: new Date(`${formStart}T00:00:00Z`).toISOString(),
      endsAt: new Date(`${formEnd}T23:59:59Z`).toISOString(),
    });
    const res = await fetch(`/api/orders/availability?${p}`);
    if (res.ok) setCatalog(await res.json());
  }, [formStart, formEnd]);

  useEffect(() => {
    if (createOpen && formStart && formEnd) void loadAvailability();
  }, [createOpen, formStart, formEnd, loadAvailability]);

  const openDetail = useCallback(async (eventId: string) => {
    setSelectedId(eventId);
    const res = await fetch(`/api/events/${eventId}/detail`);
    if (res.ok) {
      const d = (await res.json()) as OrderDetail;
      setDetail(d);
      setAssignLeaderId(d.event.teamLeader?.id ?? "");
      setAssignVehicleId(d.event.vehicle?.id ?? "");
    }
  }, []);

  async function validateTrioPillar(pillar: OperationalTrioPillar) {
    if (!selectedId) return;
    setTrioValidating(pillar);
    try {
      const res = await fetch(`/api/events/${selectedId}/operational-validation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast((data as { message?: string }).message ?? "Validation refusée");
        return;
      }
      showToast(`Validation ${TRIO_PILLAR_LABELS[pillar]} enregistrée.`);
      await openDetail(selectedId);
      await loadEvents();
    } finally {
      setTrioValidating(null);
    }
  }

  const filteredEvents = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (ev) =>
        ev.name.toLowerCase().includes(q) ||
        ev.clientName.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q),
    );
  }, [events, listSearch]);

  const kanban = useMemo(() => {
    const pending: EventSummary[] = [];
    const inProgress: EventSummary[] = [];
    const settled: EventSummary[] = [];
    for (const ev of filteredEvents) {
      if (ev.orderStatus === OrderStatus.SETTLED) settled.push(ev);
      else if (ev.orderStatus === OrderStatus.IN_PROGRESS) inProgress.push(ev);
      else pending.push(ev);
    }
    return { pending, inProgress, settled };
  }, [filteredEvents]);

  const cartTotal = useMemo(
    () => Object.values(cart).reduce((sum, n) => sum + (n > 0 ? n : 0), 0),
    [cart],
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogQ.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q) ||
        c.categoryName.toLowerCase().includes(q),
    );
  }, [catalog, catalogQ]);

  async function createOrder() {
    if (!formName.trim() || !formClient.trim() || !formSite.trim() || !formStart || !formEnd || !ownerId) {
      showToast("Nom, client, site, dates et responsable sont obligatoires.");
      return;
    }
    const allocations = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName.trim(),
        clientName: formClient.trim(),
        location: formSite.trim(),
        startsAt: new Date(`${formStart}T00:00:00Z`).toISOString(),
        endsAt: new Date(`${formEnd}T23:59:59Z`).toISOString(),
        ownerId,
        notes: formNotes.trim() || undefined,
        allocations,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((data as { message?: string }).message ?? "Création impossible");
      return;
    }
    showToast("Commande créée — Stock, Technique et Parc camion notifiés.");
    setCreateOpen(false);
    setCart({});
    await loadEvents();
    onRefreshEvents?.();
  }

  async function saveAssignments() {
    if (!selectedId) return;
    const res = await fetch(`/api/events/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamLeaderId: assignLeaderId || null,
        vehicleId: assignVehicleId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast((data as { message?: string }).message ?? "Mise à jour impossible");
      return;
    }
    showToast("Affectations enregistrées.");
    await openDetail(selectedId);
    await loadEvents();
    onRefreshEvents?.();
  }

  async function addCrewMember() {
    if (!selectedId || !assignStaffId) return;
    const res = await fetch("/api/hr/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: selectedId, userId: assignStaffId, isTeamLeader: false }),
    });
    if (res.ok) {
      showToast("Technicien affecté au projet.");
      setAssignStaffId("");
      await openDetail(selectedId);
    }
  }

  async function startLoading(eventId: string) {
    const res = await fetch(`/api/events/${eventId}/loading`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    showToast(
      res.ok
        ? `BS-EVT ${(data as { documentNumber?: string }).documentNumber ?? ""} généré — scan RFID puis signature (Mouvements de matériel).`
        : ((data as { message?: string }).message ?? "Chargement impossible"),
    );
    if (selectedId === eventId) await openDetail(eventId);
    await loadEvents();
    onRefreshEvents?.();
  }

  function navigateToStockDocument(documentId: string) {
    stashCdcBonsFlow({ openDocumentId: documentId });
    onNavigateToBons?.(documentId);
  }

  async function handleNextAction() {
    if (!detail?.workflow.nextAction) return;
    const { endpoint, method } = detail.workflow.nextAction;
    if (method === "POST" && endpoint.includes("/loading")) {
      await startLoading(detail.event.id);
      return;
    }
    if (method === "POST" && endpoint.includes("/return")) {
      await startReturn(detail.event.id);
      return;
    }
    const docMatch = /\/api\/stock-documents\/([^/]+)$/.exec(endpoint);
    if (docMatch?.[1]) {
      navigateToStockDocument(docMatch[1]);
      showToast("Ouverture du bon dans Mouvements de matériel.");
    }
  }

  async function startReturn(eventId: string) {
    const res = await fetch(`/api/events/${eventId}/return`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    showToast(
      res.ok
        ? `BE-RET ${(data as { documentNumber?: string }).documentNumber ?? ""} généré — scan RFID complet requis avant « Soldée ».`
        : ((data as { message?: string }).message ?? "Retour impossible"),
    );
    if (selectedId === eventId) await openDetail(eventId);
    await loadEvents();
    onRefreshEvents?.();
  }

  function exportPdf(eventId: string) {
    window.open(`/api/events/${eventId}/pdf`, "_blank", "noopener,noreferrer");
  }

  function renderCard(ev: EventSummary) {
    const pct = selectedId === ev.id && detail ? detail.progress.percent : roughProgress(ev.orderStatus);
    return (
      <div
        key={ev.id}
        className={`orders-card ${statusCardClass(ev.orderStatus)}${selectedId === ev.id ? " orders-card--active" : ""}`}
        onClick={() => void openDetail(ev.id)}
        onKeyDown={(e) => e.key === "Enter" && void openDetail(ev.id)}
        role="button"
        tabIndex={0}
      >
        <div className="orders-card-title">{ev.name}</div>
        <div className="orders-card-client">{ev.clientName}</div>
        <div className="orders-card-meta">
          <span className="orders-card-pill">{ev.location}</span>
          <span className="orders-card-pill" title={ORDER_STATUS_LABELS[ev.orderStatus]}>
            {ORDER_STATUS_SHORT_LABELS[ev.orderStatus]}
          </span>
        </div>
        <div className="orders-card-dates">{formatDateRange(ev.startsAt, ev.endsAt)}</div>
        <div className="orders-card-bar" aria-hidden>
          <div className="orders-card-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  function workflowStepClass(step: "pending" | "bs" | "progress" | "ret" | "settled"): string {
    if (!detail) return "";
    const { event, progress, workflow } = detail;
    if (step === "pending") {
      return event.orderStatus !== OrderStatus.PENDING ? "orders-step--ok" : "orders-step--active";
    }
    if (step === "bs") {
      if (progress.bsSigned) return "orders-step--ok";
      if (workflow.bsEvt) return "orders-step--active";
      return "";
    }
    if (step === "progress") {
      if (event.orderStatus === OrderStatus.IN_PROGRESS || event.orderStatus === OrderStatus.SETTLED) {
        return "orders-step--ok";
      }
      return "";
    }
    if (step === "ret") {
      if (progress.beRetSigned) return "orders-step--ok";
      if (workflow.beRet) return "orders-step--active";
      return "";
    }
    return event.orderStatus === OrderStatus.SETTLED ? "orders-step--ok" : "";
  }

  return (
    <div className="orders-premium">
      <header className="orders-hero">
        <div className="orders-hero-grid">
          <div>
            <h1 className="orders-hero-title">Commandes événement</h1>
          </div>
          <div className="orders-hero-actions">
            <button
              type="button"
              className="orders-hero-btn orders-hero-btn--ghost"
              disabled={loading}
              onClick={() => void loadEvents()}
            >
              <AppIcon name="sync" size={15} />
              Actualiser
            </button>
            <button
              type="button"
              className="orders-hero-btn orders-hero-btn--primary"
              onClick={() => setCreateOpen(true)}
            >
              <AppIcon name="plus" size={15} />
              Nouvelle commande
            </button>
          </div>
        </div>
      </header>

      <div className="orders-kpi-row">
        <div className="orders-kpi orders-kpi--pending">
          <div className="orders-kpi-icon">
            <AppIcon name="events" size={18} />
          </div>
          <div className="orders-kpi-val">{stats?.pending ?? kanban.pending.length}</div>
          <div className="orders-kpi-lbl">{ORDER_STATUS_SHORT_LABELS.PENDING}</div>
        </div>
        <div className="orders-kpi orders-kpi--progress">
          <div className="orders-kpi-icon">
            <AppIcon name="movements" size={18} />
          </div>
          <div className="orders-kpi-val">{stats?.inProgress ?? kanban.inProgress.length}</div>
          <div className="orders-kpi-lbl">{ORDER_STATUS_SHORT_LABELS.IN_PROGRESS}</div>
        </div>
        <div className="orders-kpi orders-kpi--settled">
          <div className="orders-kpi-icon">
            <AppIcon name="check" size={18} />
          </div>
          <div className="orders-kpi-val">{stats?.settled ?? kanban.settled.length}</div>
          <div className="orders-kpi-lbl">{ORDER_STATUS_SHORT_LABELS.SETTLED}</div>
        </div>
        <div className="orders-kpi">
          <div className="orders-kpi-icon">
            <AppIcon name="events" size={18} />
          </div>
          <div className="orders-kpi-val">{stats?.upcoming ?? "—"}</div>
          <div className="orders-kpi-lbl">À venir (actives)</div>
        </div>
        <div className="orders-kpi">
          <div className="orders-kpi-icon">
            <AppIcon name="package" size={18} />
          </div>
          <div className="orders-kpi-val">{stats?.withMaterial ?? "—"}</div>
          <div className="orders-kpi-lbl">Avec matériel réservé</div>
        </div>
      </div>

      <OrderLifecycleBar currentStatus={detail?.event.orderStatus} />

      <div className="orders-toolbar">
        <AppIcon name="search" size={16} />
        <input
          type="search"
          placeholder="Rechercher prestation, client, site…"
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          aria-label="Filtrer les commandes"
        />
        <span className="fs12 text-muted">
          {filteredEvents.length} commande{filteredEvents.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="orders-layout">
        <div className="orders-kanban">
          <KanbanColumn variant="pending" title={ORDER_STATUS_SHORT_LABELS.PENDING} count={kanban.pending.length}>
            {kanban.pending.length === 0 ? (
              <div className="orders-empty-kanban">Aucune commande en attente</div>
            ) : (
              kanban.pending.map(renderCard)
            )}
          </KanbanColumn>
          <KanbanColumn variant="progress" title={ORDER_STATUS_SHORT_LABELS.IN_PROGRESS} count={kanban.inProgress.length}>
            {kanban.inProgress.length === 0 ? (
              <div className="orders-empty-kanban">Aucune prestation en cours</div>
            ) : (
              kanban.inProgress.map(renderCard)
            )}
          </KanbanColumn>
          <KanbanColumn variant="settled" title={ORDER_STATUS_SHORT_LABELS.SETTLED} count={kanban.settled.length}>
            {kanban.settled.length === 0 ? (
              <div className="orders-empty-kanban">Aucune commande soldée</div>
            ) : (
              kanban.settled.map(renderCard)
            )}
          </KanbanColumn>
        </div>

        {detail ? (
          <aside className="orders-drawer">
            <div className="orders-drawer-hd">
              <h2 className="orders-drawer-title">{detail.event.name}</h2>
              <span
                className={`orders-drawer-status ${statusDrawerClass(detail.event.orderStatus)}`}
                title={detail.orderStatusSignification}
              >
                {detail.orderStatusLabel}
              </span>
              <p className="fs12 text-muted" style={{ marginTop: 8 }}>
                {detail.orderStatusSignification}
              </p>
              <p className="fs12 text-muted" style={{ marginTop: 10 }}>
                {detail.event.clientName} · {detail.event.location}
              </p>
              <p className="fs12" style={{ marginTop: 4 }}>
                {formatDateRange(detail.event.startsAt, detail.event.endsAt)}
              </p>
            </div>

            <div className="orders-drawer-body">
              <div className="orders-ring-wrap">
                <div className="orders-ring" style={ringStyle(detail.progress.percent)}>
                  <span style={{ background: "var(--surface)", borderRadius: "50%", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {detail.progress.percent}%
                  </span>
                </div>
                <div>
                  <p className="fs13 fw500">Avancement global</p>
                  <p className="fs12 text-muted">
                    {detail.progress.hasAllocations ? "Matériel réservé" : "Sans réservation"} ·{" "}
                    {detail.progress.crewCount} affectation{detail.progress.crewCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <OrderInterdependencePanel
                workflow={detail.workflow}
                onNavigateToBons={onNavigateToBons}
              />

              <div className="orders-stepper" aria-label="Workflow commande">
                <div className={`orders-step ${workflowStepClass("pending")}`}>
                  <span className="orders-step-num">1</span>
                  Non traitée
                </div>
                <div className={`orders-step ${workflowStepClass("bs")}`}>
                  <span className="orders-step-num">2</span>
                  BS-EVT
                </div>
                <div className={`orders-step ${workflowStepClass("progress")}`}>
                  <span className="orders-step-num">3</span>
                  Traitée
                </div>
                <div className={`orders-step ${workflowStepClass("ret")}`}>
                  <span className="orders-step-num">4</span>
                  BE-RET
                </div>
                <div className={`orders-step ${workflowStepClass("settled")}`}>
                  <span className="orders-step-num">5</span>
                  Soldée
                </div>
              </div>

              {detail.workflow.blockers.length > 0 ? (
                <ul className="orders-blockers">
                  {detail.workflow.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}

              <OrderTrioValidation
                orderStatus={detail.event.orderStatus}
                trio={detail.trio}
                validating={trioValidating}
                onValidate={validateTrioPillar}
              />

              <div className="orders-section">
                <p className="orders-section-title">Affectations</p>
                <div className="orders-assign-grid form-premium">
                  <div className="fg orders-field">
                    <label htmlFor="ord-leader">Chef d&apos;équipe</label>
                    <select
                      id="ord-leader"
                      className="fs"
                      value={assignLeaderId}
                      onChange={(e) => setAssignLeaderId(e.target.value)}
                    >
                      <option value="">— Non défini —</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.userId}>
                          {s.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="fg orders-field">
                    <label htmlFor="ord-vehicle">Véhicule</label>
                    <select
                      id="ord-vehicle"
                      className="fs"
                      value={assignVehicleId}
                      onChange={(e) => setAssignVehicleId(e.target.value)}
                    >
                      <option value="">— Aucun —</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label} ({v.plateNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-gold"
                  style={{ marginTop: 10 }}
                  onClick={() => void saveAssignments()}
                >
                  Enregistrer affectations
                </button>
                <div className="fg orders-field full" style={{ marginTop: 12 }}>
                  <label htmlFor="ord-crew">Ajouter un technicien</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      id="ord-crew"
                      className="fs"
                      value={assignStaffId}
                      onChange={(e) => setAssignStaffId(e.target.value)}
                    >
                      <option value="">Sélectionner…</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.userId}>
                          {s.fullName}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void addCrewMember()}>
                      Ajouter
                    </button>
                  </div>
                </div>
                {detail.assignments.length > 0 ? (
                  <ul className="orders-mat-list" style={{ marginTop: 10 }}>
                    {detail.assignments.map((a) => (
                      <li key={a.id}>
                        {a.user.fullName}
                        {a.isTeamLeader ? (
                          <span className="orders-card-pill" style={{ marginLeft: "auto" }}>
                            Chef
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="orders-section">
                <p className="orders-section-title">
                  Matériel ({detail.event.eventItems.length} ligne{detail.event.eventItems.length !== 1 ? "s" : ""})
                </p>
                <ul className="orders-mat-list">
                  {detail.event.eventItems.map((row) => (
                    <li key={row.id}>
                      <span>{row.item.emoji ?? "📦"}</span>
                      <span>
                        {row.item.name}
                        <span className="text-muted fs11"> ({row.item.reference})</span>
                      </span>
                      <span className="orders-mat-qty">{row.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <ResponsibilityChain eventId={detail.event.id} eventName={detail.event.name} />

              <div className="orders-section">
                <p className="orders-section-title">Historique</p>
                <ul className="orders-timeline">
                  {detail.history.slice(0, 10).map((h, i) => (
                    <li key={`${h.at}-${i}`}>
                      <time>{new Date(h.at).toLocaleString("fr-FR")}</time>
                      <br />
                      {h.label}
                      {h.detail ? ` · ${h.detail}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="orders-drawer-ft">
              {detail.workflow.nextAction ? (
                <button
                  type="button"
                  className="btn btn-sm btn-gold"
                  onClick={() => void handleNextAction()}
                >
                  {detail.workflow.nextAction.label}
                </button>
              ) : null}
              <button type="button" className="btn btn-sm btn-outline btn-icon" onClick={() => exportPdf(detail.event.id)}>
                <AppIcon name="fileExport" size={14} />
                PDF
              </button>
              {detail.workflow.canStartLoading ? (
                <button type="button" className="btn btn-sm btn-gold" onClick={() => void startLoading(detail.event.id)}>
                  Démarrer chargement
                </button>
              ) : null}
              {detail.workflow.canStartReturn ? (
                <button type="button" className="btn btn-sm btn-gold" onClick={() => void startReturn(detail.event.id)}>
                  Démarrer retour
                </button>
              ) : null}
              {detail.workflow.bsEvt && !detail.progress.bsSigned ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigateToStockDocument(detail.workflow.bsEvt!.id)}
                >
                  BS {detail.workflow.bsEvt.documentNumber}
                </button>
              ) : null}
              {detail.workflow.beRet && !detail.progress.beRetSigned ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigateToStockDocument(detail.workflow.beRet!.id)}
                >
                  BE {detail.workflow.beRet.documentNumber}
                </button>
              ) : null}
              {detail.workflow.canSettle ? (
                <span className="badge badge-ok fs11">Prête à solder (auto)</span>
              ) : null}
            </div>
          </aside>
        ) : (
          <aside className="orders-drawer orders-drawer--empty">
            <div>
              <AppIcon name="orders" size={40} />
              <p style={{ marginTop: 16 }}>Sélectionnez une commande pour le suivi temps réel, les affectations et la chaîne BS / BE.</p>
            </div>
          </aside>
        )}
      </div>

      <ModalForm
        isOpen={createOpen}
        icon="orders"
        title="Nouvelle commande"
        subtitle="Création commerciale — notification Stock, Technique et Parc camion"
        size="lg"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </button>
            <button type="button" className="btn btn-gold" onClick={() => void createOrder()}>
              Créer et notifier
            </button>
          </>
        }
      >
        <FormGrid>
          <div className="fg full">
            <label htmlFor="ord-form-name">Intitulé prestation *</label>
            <FormInput id="ord-form-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ord-form-client">Client *</label>
            <FormInput id="ord-form-client" value={formClient} onChange={(e) => setFormClient(e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ord-form-owner">Responsable commercial *</label>
            <FormSelect id="ord-form-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </FormSelect>
          </div>
          <div className="fg full">
            <label htmlFor="ord-form-site">Site de prestation *</label>
            <FormInput id="ord-form-site" value={formSite} onChange={(e) => setFormSite(e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ord-form-start">Date de début *</label>
            <FormInput id="ord-form-start" type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ord-form-end">Date de retour *</label>
            <FormInput id="ord-form-end" type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
          </div>
          <div className="fg full">
            <label htmlFor="ord-form-notes">Notes</label>
            <FormTextarea id="ord-form-notes" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
          </div>
        </FormGrid>

        <p className="form-section-title" style={{ marginTop: 20 }}>
          Catalogue — disponibilité sur la période
        </p>
        <FormInput
          placeholder="Rechercher article, référence, catégorie…"
          value={catalogQ}
          onChange={(e) => setCatalogQ(e.target.value)}
        />
        <div className="orders-catalog-table-wrap">
          <table className="data-table fs12">
            <thead>
              <tr>
                <th>Article</th>
                <th>Catégorie</th>
                <th>Dispo</th>
                <th>Qté</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.map((row) => {
                const qty = cart[row.id] ?? 0;
                const ok = row.availableForPeriod >= qty;
                return (
                  <tr key={row.id} className={!ok && qty > 0 ? "orders-row-warn" : ""}>
                    <td>
                      {row.emoji} {row.name}
                      <span className="text-muted"> ({row.reference})</span>
                    </td>
                    <td>{row.categoryName}</td>
                    <td>
                      <span className={row.availableForPeriod > 0 ? "badge badge-ok" : "badge badge-danger"}>
                        {row.availableForPeriod}
                      </span>
                      {row.reservedOnPeriod > 0 ? (
                        <span className="fs11 text-muted"> ({row.reservedOnPeriod} rés.)</span>
                      ) : null}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={row.availableForPeriod}
                        className="fi orders-qty-input"
                        value={qty || ""}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10) || 0;
                          setCart((prev) => ({ ...prev, [row.id]: n }));
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="orders-cart-summary">
          <span>
            Lignes panier : <strong>{Object.values(cart).filter((n) => n > 0).length}</strong>
          </span>
          <span>
            Unités : <strong>{cartTotal}</strong>
          </span>
        </div>
      </ModalForm>
    </div>
  );
}
