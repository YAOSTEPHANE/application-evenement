"use client";

import { Role } from "@prisma/client";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  ASSET_STATUS_LABELS,
  BE_SUBTYPE_LABELS,
  BS_SUBTYPE_LABELS,
  BT_SUBTYPE_LABELS,
  DOC_KIND_LABELS,
  RFID_TAG_LABELS,
} from "@/lib/cdc-labels";
import { CdcPageHeader } from "@/components/CdcPageHeader";
import { AppIcon } from "@/components/icons/AppIcon";
import { MovementsModulePage } from "@/components/MovementsModulePage";
import { OrdersModulePage } from "@/components/OrdersModulePage";
import { RfidIdentificationPage } from "@/components/RfidIdentificationPage";
import { HrModulePage } from "@/components/HrModulePage";
import { TraceabilityModulePage } from "@/components/TraceabilityModulePage";
import { ValidationModulePage } from "@/components/ValidationModulePage";
import { stashCdcBonsFlow } from "@/lib/cdc-bons-navigation";
import type { Article, Evenement } from "@/lib/stock/types";

export type CdcPageId = "bons" | "rfid" | "commandes" | "rh" | "traceabilite" | "validation";

type CdcModulePagesProps = {
  activePage: CdcPageId;
  evenements: Evenement[];
  articles: Article[];
  onRefreshEvents?: () => void;
  onNavigate?: (page: CdcPageId) => void;
};

type RfidRow = {
  id: string;
  tagCode: string;
  rfidTagType: keyof typeof RFID_TAG_LABELS;
  status: keyof typeof ASSET_STATUS_LABELS;
  item: { name: string; reference: string };
  currentWarehouse?: { name: string } | null;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const pageClass = (active: CdcPageId, page: CdcPageId) =>
  `page${active === page ? " active" : ""}`;

function DataTable<T>({
  rows,
  columns,
  renderRow,
  empty,
}: {
  rows: T[];
  columns: string[];
  renderRow: (row: T) => ReactNode;
  empty: string;
}) {
  if (rows.length === 0) {
    return <div className="empty-state">{empty}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card card-pad cdc-scan-card">
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

export function CdcModulePages({
  activePage,
  evenements,
  articles,
  onRefreshEvents,
  onNavigate,
}: CdcModulePagesProps) {
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [rfidAssets, setRfidAssets] = useState<RfidRow[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(false);
  const loadCdcData = useCallback(async () => {
    setLoading(true);
    try {
      const [rfidRes, whRes, catRes] = await Promise.all([
        fetch("/api/rfid-tags"),
        fetch("/api/warehouses"),
        fetch("/api/categories"),
      ]);
      if (whRes.ok) setWarehouses(await whRes.json());
      if (catRes.ok) {
        const cats = (await catRes.json()) as Array<{ id: string; name: string; code: string }>;
        setCategories(cats.map((c) => ({ id: c.id, name: c.name, code: c.code })));
      }
      if (rfidRes.ok) setRfidAssets(await rfidRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activePage === "rfid" || activePage === "bons") {
      void loadCdcData();
    }
  }, [activePage, loadCdcData]);

  const refreshBtn = (
    <button type="button" className="btn btn-gold btn-sm btn-icon" disabled={loading} onClick={() => void loadCdcData()}>
      <AppIcon name="sync" size={14} />
      Actualiser
    </button>
  );

  const warehouseOptions = warehouses.map((w) => ({
    id: w.id,
    label: `${w.name} (${w.code})`,
  }));
  const eventOptions = evenements.map((ev) => ({ id: ev.id, label: ev.nom }));
  const itemOptions = articles.map((a) => ({
    id: a.id,
    label: `${a.emoji} ${a.nom} (${a.ref})`,
  }));

  return (
    <>
      <div id="page-bons" className={pageClass(activePage, "bons")}>
        {activePage === "bons" ? (
          <MovementsModulePage
            warehouses={warehouseOptions}
            events={eventOptions}
            items={itemOptions}
          />
        ) : null}
      </div>

      {activePage === "rfid" ? (
        <RfidIdentificationPage
          articles={articles}
          warehouses={warehouses}
          categories={categories}
        />
      ) : null}

      <div id="page-commandes" className={pageClass(activePage, "commandes")}>
        <OrdersModulePage
          onRefreshEvents={onRefreshEvents}
          onNavigateToBons={
            onNavigate
              ? (documentId) => {
                  if (documentId) {
                    stashCdcBonsFlow({ openDocumentId: documentId });
                  }
                  onNavigate("bons");
                }
              : undefined
          }
        />
      </div>

      <div id="page-rh" className={pageClass(activePage, "rh")}>
        {activePage === "rh" ? <HrModulePage events={eventOptions} /> : null}
      </div>

      {activePage === "traceabilite" ? <TraceabilityModulePage /> : null}

      <div id="page-validation" className={pageClass(activePage, "validation")}>
        {activePage === "validation" ? (
          <ValidationModulePage
            onNavigateToBons={
              onNavigate
                ? (documentId) => {
                    stashCdcBonsFlow({ openDocumentId: documentId });
                    onNavigate("bons");
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </>
  );
}

export function CdcNotificationsPanel() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [counts, setCounts] = useState({ urgent: 0, warning: 0, unread: 0 });

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
    setCounts(data.counts ?? { urgent: 0, warning: 0, unread: 0 });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div>
      <div className="cdc-notif-summary">
        <span className="badge badge-danger">Urgent {counts.urgent}</span>
        <span className="badge badge-warn">Avert. {counts.warning}</span>
        <span className="badge badge-info">Non lues {counts.unread}</span>
      </div>
      {items.map((n) => (
        <div
          key={n.id}
          className={`cdc-notif-item${n.readAt ? " cdc-notif-item--read" : ""}`}
          onClick={() => void markRead(n.id)}
          onKeyDown={(e) => e.key === "Enter" && void markRead(n.id)}
          role="button"
          tabIndex={0}
        >
          <div className="cdc-notif-item-hd">
            <AppIcon name="alerts" size={16} />
            <div className="fw500">{n.title}</div>
          </div>
          <div className="fs12">{n.body}</div>
          <div className="fs11 text-muted">{new Date(n.createdAt).toLocaleString("fr-FR")}</div>
        </div>
      ))}
      {items.length === 0 ? <div className="empty-state">Aucune notification système</div> : null}
    </div>
  );
}
