"use client";

import { useCallback, useEffect, useState } from "react";

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

const pageClass = (active: CdcPageId, page: CdcPageId) =>
  `page${active === page ? " active" : ""}`;

export function CdcModulePages({
  activePage,
  evenements,
  articles,
  onRefreshEvents,
  onNavigate,
}: CdcModulePagesProps) {
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(false);

  const loadCdcData = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, catRes] = await Promise.all([
        fetch("/api/warehouses"),
        fetch("/api/categories"),
      ]);
      if (whRes.ok) setWarehouses(await whRes.json());
      if (catRes.ok) {
        const cats = (await catRes.json()) as Array<{ id: string; name: string; code: string }>;
        setCategories(cats.map((c) => ({ id: c.id, name: c.name, code: c.code })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activePage === "rfid" || activePage === "bons") {
      void loadCdcData();
    }
  }, [activePage, loadCdcData]);

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
  const [items, setItems] = useState<
    Array<{ id: string; title: string; body: string; createdAt: string; readAt: string | null }>
  >([]);
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

  return (
    <div className="cdc-notif-panel">
      <CdcPageHeader
        icon="alerts"
        title="Notifications"
        actions={
          <button type="button" className="btn btn-gold btn-sm btn-icon" onClick={() => void load()}>
            <AppIcon name="sync" size={14} />
            Actualiser
          </button>
        }
      />
      <div className="cdc-notif-counts">
        <span className="cdc-notif-count cdc-notif-count--urgent">{counts.urgent} urgentes</span>
        <span className="cdc-notif-count">{counts.warning} alertes</span>
        <span className="cdc-notif-count">{counts.unread} non lues</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">Aucune notification.</div>
      ) : (
        <ul className="cdc-notif-list">
          {items.map((n) => (
            <li key={n.id} className={n.readAt ? "cdc-notif-item" : "cdc-notif-item cdc-notif-item--unread"}>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <time dateTime={n.createdAt}>
                {new Date(n.createdAt).toLocaleString("fr-FR")}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
