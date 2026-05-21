"use client";

import { useEffect, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";
import { ORDER_STATUS_LABELS } from "@/lib/cdc-labels";

type CdcKpis = {
  orders: { pending: number; inProgress: number; settled: number };
  documents: {
    today: number;
    todayBe?: number;
    todayBs?: number;
    todayBt?: number;
    pendingSignature: number;
    disputed: number;
    transfersOver48h: number;
  };
  rfid: { traceabilityPct: number; taggedAssets: number };
  staff: { pct: number; occupied: number; total: number };
  sites?: {
    activeEventSites: number;
    warehouses: Array<{ id: string; name: string; code: string; kind: string; assetCount: number }>;
  };
  inventory?: { accuracyPct: number; gapPct: number; quarantineAssets: number };
  targets: { traceabilityPct: number; inventoryAccuracyPct: number; inventoryGapPct: number };
};

const KPI_ITEMS: Array<{
  key: string;
  label: string;
  icon: "orders" | "documents" | "rfid" | "team" | "alerts";
  getValue: (k: CdcKpis) => string | number;
  valueClass?: (k: CdcKpis) => string;
}> = [
  { key: "pending", label: ORDER_STATUS_LABELS.PENDING, icon: "orders", getValue: (k) => k.orders.pending },
  {
    key: "inProgress",
    label: ORDER_STATUS_LABELS.IN_PROGRESS,
    icon: "orders",
    getValue: (k) => k.orders.inProgress,
  },
  { key: "settled", label: ORDER_STATUS_LABELS.SETTLED, icon: "orders", getValue: (k) => k.orders.settled },
  {
    key: "sign",
    label: "Bons à signer",
    icon: "documents",
    getValue: (k) => k.documents.pendingSignature,
  },
  {
    key: "disputed",
    label: "Litiges RFID",
    icon: "alerts",
    getValue: (k) => k.documents.disputed,
    valueClass: (k) => (k.documents.disputed > 0 ? "cdc-kpi-value--danger" : ""),
  },
  {
    key: "trace",
    label: "Traçabilité RFID",
    icon: "rfid",
    getValue: (k) => `${k.rfid.traceabilityPct} %`,
    valueClass: (k) =>
      k.rfid.traceabilityPct >= k.targets.traceabilityPct ? "cdc-kpi-value--ok" : "cdc-kpi-value--warn",
  },
  {
    key: "staff",
    label: "Effectifs mobilisés",
    icon: "team",
    getValue: (k) => `${k.staff.pct} %`,
  },
  {
    key: "transfer",
    label: "Transferts > 48 h",
    icon: "documents",
    getValue: (k) => k.documents.transfersOver48h,
    valueClass: (k) => (k.documents.transfersOver48h > 0 ? "cdc-kpi-value--warn" : ""),
  },
  {
    key: "inv",
    label: "Fiabilité inventaire",
    icon: "rfid",
    getValue: (k) => `${k.inventory?.accuracyPct ?? k.targets.inventoryAccuracyPct} %`,
    valueClass: (k) =>
      (k.inventory?.accuracyPct ?? 100) >= k.targets.inventoryAccuracyPct
        ? "cdc-kpi-value--ok"
        : "cdc-kpi-value--warn",
  },
];

export function CdcDashboardSection() {
  const [kpis, setKpis] = useState<CdcKpis | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cdc/kpis");
        if (!res.ok) return;
        const data = (await res.json()) as CdcKpis;
        if (!cancelled) setKpis(data);
      } catch {
        /* silencieux sur dashboard */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!kpis) {
    return (
      <section className="cdc-panel" style={{ marginBottom: 20 }} aria-busy="true">
        <div className="cdc-panel-hd">
          <div>
            <h2>EVENT · RFID</h2>
            <p className="cdc-panel-sub">Chargement des indicateurs…</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cdc-panel" style={{ marginBottom: 20 }} aria-label="Indicateurs CDC RFID">
      <div className="cdc-panel-hd">
        <div>
          <h2>EVENT · RFID — Pilotage</h2>
          <p className="cdc-panel-sub">
            Objectif traçabilité {kpis.targets.traceabilityPct} % · {kpis.rfid.taggedAssets} tags actifs
          </p>
        </div>
        <AppIcon name="rfid" size={22} style={{ opacity: 0.85 }} />
      </div>
      <div className="cdc-panel-body">
        <div className="cdc-kpi-grid">
          {KPI_ITEMS.map((item) => (
            <article key={item.key} className="cdc-kpi">
              <div className="cdc-kpi-top">
                <span className="cdc-kpi-label">{item.label}</span>
                <span className="cdc-kpi-icon">
                  <AppIcon name={item.icon} size={16} />
                </span>
              </div>
              <div className={`cdc-kpi-value ${item.valueClass?.(kpis) ?? ""}`}>{item.getValue(kpis)}</div>
            </article>
          ))}
          <article className="cdc-kpi">
            <div className="cdc-kpi-top">
              <span className="cdc-kpi-label">Mouvements du jour</span>
              <span className="cdc-kpi-icon">
                <AppIcon name="documents" size={16} />
              </span>
            </div>
            <div className="cdc-kpi-value fs13" style={{ lineHeight: 1.4 }}>
              Entrées {kpis.documents.todayBe ?? 0} · Sorties {kpis.documents.todayBs ?? 0} ·
              Transferts {kpis.documents.todayBt ?? 0}
            </div>
          </article>
        </div>
        {kpis.sites && kpis.sites.warehouses.length > 0 ? (
          <div className="cdc-sites-grid" style={{ marginTop: 16 }}>
            <h3 className="fs13 fw500 mb8">Sites & entrepôts</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {kpis.sites.warehouses.map((w) => (
                <span key={w.id} className="badge badge-gray">
                  {w.name} — {w.assetCount} unités RFID
                </span>
              ))}
              <span className="badge badge-info">
                {kpis.sites.activeEventSites} chantier(s) actif(s)
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
