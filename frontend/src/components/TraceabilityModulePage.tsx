"use client";

import { OrderStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";
import { ResponsibilityChain } from "@/components/ResponsibilityChain";
import { ORDER_STATUS_LABELS, ASSET_STATUS_LABELS } from "@/lib/cdc-labels";
import type { CustodyLogRow, EventTraceRow, TraceabilityStats } from "@/lib/traceability-db";
import type { AssetFullHistory } from "@/lib/traceability-asset-history";
import type { UserFullHistory } from "@/lib/traceability-user-history";

type TabId = "commandes" | "unites" | "utilisateurs" | "journal";

type AssetRow = {
  id: string;
  tagCode: string;
  status: keyof typeof ASSET_STATUS_LABELS;
  item: { name: string; reference: string; emoji?: string | null };
  currentWarehouse?: { name: string; code: string } | null;
  custodian?: { fullName: string } | null;
};

type AssetDetail = AssetRow & {
  movementHistory: Array<{
    at: string;
    documentNumber: string;
    kind: string;
    status: string;
    scannedQty: number;
    expectedQty: number;
  }>;
  custodyHistory: Array<{
    id: string;
    phase: string;
    phaseTitle?: string;
    holderRole?: string;
    holderName?: string | null;
    startedAt: string;
    endedAt?: string | null;
    eventName?: string | null;
    documentNumber?: string | null;
  }>;
  currentCustodian?: {
    phaseTitle: string;
    holderRoleLabel: string;
    holderName: string | null;
    since: string;
    documentNumber?: string | null;
    signatureValidated: boolean;
  } | null;
  currentEvent?: { name: string; location: string; clientName: string } | null;
};

function statusOrderClass(status: OrderStatus): string {
  if (status === OrderStatus.SETTLED) return "trace-ev-card--settled";
  if (status === OrderStatus.IN_PROGRESS) return "trace-ev-card--progress";
  return "trace-ev-card--pending";
}

function formatRange(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const e = new Date(end).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return `${s} → ${e}`;
}

export function TraceabilityModulePage() {
  const [tab, setTab] = useState<TabId>("commandes");
  const [stats, setStats] = useState<TraceabilityStats | null>(null);
  const [events, setEvents] = useState<EventTraceRow[]>([]);
  const [custodyLogs, setCustodyLogs] = useState<CustodyLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [unitQ, setUnitQ] = useState("");
  const [units, setUnits] = useState<AssetRow[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [unitDetail, setUnitDetail] = useState<AssetDetail | null>(null);
  const [assetHistory, setAssetHistory] = useState<AssetFullHistory | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const [userQ, setUserQ] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; fullName: string; role: string; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<UserFullHistory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const activeQ = activeOnly ? "&active=1" : "";
      const [statsRes, dataRes] = await Promise.all([
        fetch("/api/cdc/traceability/stats"),
        fetch(`/api/cdc/traceability/events?logs=1${activeQ}`),
      ]);
      if (statsRes.ok) setStats((await statsRes.json()) as TraceabilityStats);
      if (dataRes.ok) {
        const data = (await dataRes.json()) as { events: EventTraceRow[]; custodyLogs: CustodyLogRow[] };
        setEvents(data.events);
        setCustodyLogs(data.custodyLogs);
        if (!selectedEventId && data.events[0]) setSelectedEventId(data.events[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchUnits = useCallback(async () => {
    const q = unitQ.trim();
    if (!q) {
      setUnits([]);
      return;
    }
    const res = await fetch(`/api/rfid-tags?q=${encodeURIComponent(q)}`);
    if (res.ok) setUnits(await res.json());
  }, [unitQ]);

  useEffect(() => {
    if (tab !== "unites") return;
    const t = setTimeout(() => void searchUnits(), 280);
    return () => clearTimeout(t);
  }, [tab, unitQ, searchUnits]);

  useEffect(() => {
    if (!selectedUnitId) {
      setUnitDetail(null);
      setAssetHistory(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [detailRes, histRes] = await Promise.all([
        fetch(`/api/rfid-tags/${selectedUnitId}`),
        fetch(`/api/cdc/traceability/assets/${selectedUnitId}/history`),
      ]);
      if (!cancelled) {
        if (detailRes.ok) setUnitDetail((await detailRes.json()) as AssetDetail);
        if (histRes.ok) setAssetHistory((await histRes.json()) as AssetFullHistory);
        else setAssetHistory(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUnitId]);

  const searchUsers = useCallback(async () => {
    const q = userQ.trim();
    const res = await fetch(
      q ? `/api/cdc/traceability/users?q=${encodeURIComponent(q)}` : "/api/cdc/traceability/users",
    );
    if (res.ok) setUsers(await res.json());
  }, [userQ]);

  useEffect(() => {
    if (tab !== "utilisateurs") return;
    const t = setTimeout(() => void searchUsers(), 280);
    return () => clearTimeout(t);
  }, [tab, userQ, searchUsers]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserHistory(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/cdc/traceability/users/${selectedUserId}/history`);
      if (res.ok && !cancelled) setUserHistory((await res.json()) as UserFullHistory);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (ev) =>
        ev.name.toLowerCase().includes(q) ||
        ev.clientName.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q),
    );
  }, [events, search]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  return (
    <div className="trace-premium">
      <header className="trace-hero">
        <div className="trace-hero-grid">
          <div>
            <h1 className="trace-hero-title">Traçabilité</h1>
          </div>
          <div className="trace-hero-actions">
            <button type="button" className="trace-hero-btn trace-hero-btn--ghost" disabled={loading} onClick={() => void load()}>
              <AppIcon name="sync" size={15} />
              Actualiser
            </button>
          </div>
        </div>
      </header>

      <div className="trace-kpi-row">
        <div className="trace-kpi trace-kpi--accent">
          <div className="trace-kpi-icon"><AppIcon name="rfid" size={18} /></div>
          <div className="trace-kpi-val">{stats ? `${stats.traceabilityPct} %` : "—"}</div>
          <div className="trace-kpi-lbl">Couverture RFID / catalogue</div>
        </div>
        <div className="trace-kpi">
          <div className="trace-kpi-val">{stats?.taggedUnits ?? "—"}</div>
          <div className="trace-kpi-lbl">Unités taguées</div>
        </div>
        <div className="trace-kpi">
          <div className="trace-kpi-val">{stats?.eventsActive ?? "—"}</div>
          <div className="trace-kpi-lbl">Commandes actives</div>
        </div>
        <div className="trace-kpi">
          <div className="trace-kpi-val">{stats?.openCustody ?? "—"}</div>
          <div className="trace-kpi-lbl">Gardes ouvertes</div>
        </div>
        <div className="trace-kpi trace-kpi--warn">
          <div className="trace-kpi-val">{stats?.disputedDocs ?? "—"}</div>
          <div className="trace-kpi-lbl">Bons en litige</div>
        </div>
        <div className="trace-kpi">
          <div className="trace-kpi-val">{stats?.onSiteUnits ?? "—"}</div>
          <div className="trace-kpi-lbl">Sur site</div>
        </div>
      </div>

      <div className="trace-tabs" role="tablist">
        {(
          [
            ["commandes", "Commandes", "orders"],
            ["unites", "Unités RFID", "rfid"],
            ["utilisateurs", "Utilisateurs", "team"],
            ["journal", "Journal garde", "documents"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`trace-tab${tab === id ? " trace-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            <AppIcon name={icon} size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "commandes" ? (
        <div className="trace-layout">
          <div className="trace-list-col">
            <div className="trace-toolbar">
              <AppIcon name="search" size={16} />
              <input
                type="search"
                placeholder="Prestation, client, site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label className="trace-filter-active">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                />
                Actives uniquement
              </label>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="trace-empty">Aucune commande — créez une commande pour démarrer la chaîne.</div>
            ) : (
              filteredEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`trace-ev-card ${statusOrderClass(ev.orderStatus)}${selectedEventId === ev.id ? " trace-ev-card--active" : ""}`}
                  onClick={() => setSelectedEventId(ev.id)}
                >
                  <div className="trace-ev-card-top">
                    <span className="trace-ev-title">{ev.name}</span>
                    <span className={`trace-ev-status trace-ev-status--${ev.orderStatus.toLowerCase()}`}>
                      {ORDER_STATUS_LABELS[ev.orderStatus]}
                    </span>
                  </div>
                  <p className="trace-ev-client">{ev.clientName}</p>
                  <p className="trace-ev-meta">{ev.location} · {formatRange(ev.startsAt, ev.endsAt)}</p>
                  <div className="trace-ev-bar">
                    <div className="trace-ev-bar-fill" style={{ width: `${ev.progressPct}%` }} />
                  </div>
                  {ev.currentPhase ? <p className="trace-ev-phase">{ev.currentPhase}</p> : null}
                </button>
              ))
            )}
          </div>

          <aside className="trace-drawer">
            {selectedEvent ? (
              <>
                <div className="trace-drawer-hd">
                  <h2>{selectedEvent.name}</h2>
                  <span className={`trace-ev-status trace-ev-status--${selectedEvent.orderStatus.toLowerCase()}`}>
                    {ORDER_STATUS_LABELS[selectedEvent.orderStatus]}
                  </span>
                  <p className="fs12 text-muted">{selectedEvent.clientName} · {selectedEvent.location}</p>
                  <div className="trace-drawer-pills">
                    {selectedEvent.teamLeaderName ? (
                      <span className="trace-pill">Chef : {selectedEvent.teamLeaderName}</span>
                    ) : null}
                    {selectedEvent.vehicleLabel ? (
                      <span className="trace-pill">{selectedEvent.vehicleLabel}</span>
                    ) : null}
                    {selectedEvent.bsNumber ? (
                      <span className="trace-pill mono">BS {selectedEvent.bsNumber}</span>
                    ) : null}
                    {selectedEvent.beRetNumber ? (
                      <span className="trace-pill mono">BE {selectedEvent.beRetNumber}</span>
                    ) : null}
                  </div>
                </div>
                <div className="trace-drawer-body">
                  <ResponsibilityChain eventId={selectedEvent.id} variant="detailed" />
                </div>
              </>
            ) : (
              <div className="trace-drawer-empty">
                <AppIcon name="shield" size={40} />
                <p>Sélectionnez une commande pour afficher la chaîne de responsabilité.</p>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "unites" ? (
        <div className="trace-layout">
          <div className="trace-list-col">
            <div className="trace-toolbar">
              <AppIcon name="search" size={16} />
              <input
                type="search"
                placeholder="Tag, article, référence, entrepôt..."
                value={unitQ}
                onChange={(e) => setUnitQ(e.target.value)}
              />
            </div>
            {units.length === 0 ? (
              <div className="trace-empty">Saisissez un critère pour rechercher une unité taguée.</div>
            ) : (
              units.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`trace-unit-card${selectedUnitId === u.id ? " trace-unit-card--active" : ""}`}
                  onClick={() => setSelectedUnitId(u.id)}
                >
                  <span className="trace-unit-tag mono">{u.tagCode}</span>
                  <span className="trace-unit-name">
                    {u.item.emoji ?? "📦"} {u.item.name}
                  </span>
                  <span className="trace-unit-meta">
                    {ASSET_STATUS_LABELS[u.status]}
                    {u.currentWarehouse ? ` · ${u.currentWarehouse.code}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
          <aside className="trace-drawer">
            {unitDetail ? (
              <>
                <div className="trace-drawer-hd">
                  <h2 className="mono">{unitDetail.tagCode}</h2>
                  <p className="fs13">{unitDetail.item.name} ({unitDetail.item.reference})</p>
                  {unitDetail.currentEvent ? (
                    <p className="fs12 text-muted">
                      Sur prestation : {unitDetail.currentEvent.name} — {unitDetail.currentEvent.clientName}
                    </p>
                  ) : null}
                </div>
                <div className="trace-drawer-body">
                  {unitDetail.currentCustodian ? (
                    <div className="trace-custodian-banner">
                      <p className="trace-section-title">Détenteur responsable</p>
                      <p className="trace-custodian-main">
                        <strong>{unitDetail.currentCustodian.phaseTitle}</strong>
                        {" — "}
                        {unitDetail.currentCustodian.holderName ?? "Non renseigné"}
                        <span className="fs12 text-muted">
                          {" "}
                          ({unitDetail.currentCustodian.holderRoleLabel})
                        </span>
                      </p>
                      <p className="fs11 text-muted">
                        Depuis{" "}
                        {new Date(unitDetail.currentCustodian.since).toLocaleString("fr-FR")}
                        {unitDetail.currentCustodian.documentNumber
                          ? ` · ${unitDetail.currentCustodian.documentNumber}`
                          : ""}
                        {unitDetail.currentCustodian.signatureValidated ? " · validé par signature" : ""}
                      </p>
                    </div>
                  ) : null}
                  <p className="trace-section-title">Mouvements documentés</p>
                  <ul className="trace-timeline">
                    {((assetHistory?.movements ?? unitDetail.movementHistory).length === 0) ? (
                      <li className="text-muted fs12">Aucun mouvement lié.</li>
                    ) : (
                      (assetHistory?.movements ?? unitDetail.movementHistory).map((m, i) => (
                        <li key={`${m.documentNumber}-${i}`}>
                          <time>{new Date(m.at).toLocaleString("fr-FR")}</time>
                          <br />
                          <span className="mono">{m.documentNumber}</span> ({m.kind}) — scan{" "}
                          {"scannedQty" in m ? m.scannedQty : 0}/{m.expectedQty}
                          {"eventName" in m && m.eventName ? ` · ${m.eventName}` : ""}
                        </li>
                      ))
                    )}
                  </ul>
                  <p className="trace-section-title">Détenteurs successifs</p>
                  <ul className="trace-timeline">
                    {(assetHistory?.custodyChain ?? unitDetail.custodyHistory).length === 0 ? (
                      <li className="text-muted fs12">Aucune garde enregistrée.</li>
                    ) : (
                      (assetHistory?.custodyChain ?? unitDetail.custodyHistory).map((c) => (
                        <li key={c.id}>
                          <time>{new Date(c.startedAt).toLocaleString("fr-FR")}</time>
                          {"endedAt" in c && c.endedAt ? (
                            <>
                              {" → "}
                              {new Date(c.endedAt).toLocaleString("fr-FR")}
                            </>
                          ) : !("endedAt" in c) || !c.endedAt ? (
                            <span className="trace-custody-open"> · en cours</span>
                          ) : null}
                          <br />
                          {"phaseTitle" in c ? c.phaseTitle : c.phase}
                          {c.holderName ? ` · ${c.holderName}` : ""}
                          {"holderRole" in c && c.holderRole ? ` (${c.holderRole})` : ""}
                          {c.eventName ? ` · ${c.eventName}` : ""}
                          {c.documentNumber ? ` · ${c.documentNumber}` : ""}
                        </li>
                      ))
                    )}
                  </ul>
                  <p className="trace-section-title">Commandes / prestations</p>
                  <ul className="trace-timeline">
                    {!assetHistory || assetHistory.events.length === 0 ? (
                      <li className="text-muted fs12">Aucune commande liée.</li>
                    ) : (
                      assetHistory.events.map((ev) => (
                        <li key={ev.id}>
                          <strong>{ev.name}</strong> — {ev.clientName}
                          <br />
                          <span className="fs12 text-muted">
                            {ev.location} · {ev.documentCount} bon(s) ·{" "}
                            {new Date(ev.firstAt).toLocaleDateString("fr-FR")} →{" "}
                            {new Date(ev.lastAt).toLocaleDateString("fr-FR")}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <div className="trace-drawer-empty">
                <AppIcon name="rfid" size={40} />
                <p>Recherchez et sélectionnez une unité pour voir sa traçabilité complète.</p>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "utilisateurs" ? (
        <div className="trace-layout">
          <div className="trace-list-col">
            <div className="trace-toolbar">
              <AppIcon name="search" size={16} />
              <input
                type="search"
                placeholder="Nom, e-mail..."
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
              />
            </div>
            {users.length === 0 ? (
              <div className="trace-empty">Recherchez un utilisateur pour voir ses responsabilités.</div>
            ) : (
              users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`trace-unit-card${selectedUserId === u.id ? " trace-unit-card--active" : ""}`}
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <span className="trace-unit-name">{u.fullName}</span>
                  <span className="trace-unit-meta">
                    {u.role} · {u.email}
                  </span>
                </button>
              ))
            )}
          </div>
          <aside className="trace-drawer">
            {userHistory ? (
              <div className="trace-drawer-body">
                <div className="trace-drawer-hd">
                  <h2>{userHistory.user.fullName}</h2>
                  <p className="fs12 text-muted">
                    {userHistory.user.role} · {userHistory.stats.signaturesCount} signature(s) ·{" "}
                    {userHistory.stats.openCustodies} garde(s) ouverte(s)
                  </p>
                </div>
                <p className="trace-section-title">Bons signés</p>
                <ul className="trace-timeline">
                  {userHistory.signatures.length === 0 ? (
                    <li className="text-muted fs12">Aucune signature.</li>
                  ) : (
                    userHistory.signatures.map((s) => (
                      <li key={s.id}>
                        <time>{new Date(s.signedAt).toLocaleString("fr-FR")}</time>
                        <br />
                        <span className="mono">{s.documentNumber}</span> ({s.documentKind}) — {s.roleAtSign}
                        {s.eventName ? ` · ${s.eventName}` : ""}
                      </li>
                    ))
                  )}
                </ul>
                <p className="trace-section-title">Responsabilités prises</p>
                <ul className="trace-timeline">
                  {userHistory.custodies.length === 0 ? (
                    <li className="text-muted fs12">Aucune garde.</li>
                  ) : (
                    userHistory.custodies.map((c) => (
                      <li key={c.id}>
                        <time>{new Date(c.startedAt).toLocaleString("fr-FR")}</time>
                        {!c.endedAt ? <span className="trace-custody-open"> · en cours</span> : null}
                        <br />
                        {c.phaseTitle}
                        {c.tagCode ? ` · ${c.tagCode}` : ""}
                        {c.eventName ? ` · ${c.eventName}` : ""}
                        {c.documentNumber ? ` · ${c.documentNumber}` : ""}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : (
              <div className="trace-drawer-empty">
                <AppIcon name="team" size={40} />
                <p>Sélectionnez un utilisateur pour l&apos;historique complet.</p>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "journal" ? (
        <div className="trace-journal card card-pad">
          <p className="trace-section-title">Dernières prises de responsabilité</p>
          {custodyLogs.length === 0 ? (
            <div className="trace-empty">Aucun journal — les bons signés créent des entrées automatiquement.</div>
          ) : (
            <ul className="trace-journal-list">
              {custodyLogs.map((log) => (
                <li key={log.id} className={`trace-journal-item${log.endedAt ? "" : " trace-journal-item--open"}`}>
                  <div className="trace-journal-dot" aria-hidden />
                  <div>
                    <div className="trace-journal-hd">
                      <span className="fw500">{log.phaseLabel}</span>
                      {!log.endedAt ? <span className="badge badge-warn">En cours</span> : null}
                    </div>
                    <p className="fs12 text-muted">
                      {new Date(log.startedAt).toLocaleString("fr-FR")} · {log.holderName}
                    </p>
                    <p className="fs12">
                      {log.tagCode ? <span className="mono">{log.tagCode}</span> : null}
                      {log.tagCode && log.itemName ? " — " : null}
                      {log.itemName ?? ""}
                      {log.eventName ? ` · ${log.eventName}` : ""}
                      {log.documentNumber ? ` · ${log.documentNumber}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
