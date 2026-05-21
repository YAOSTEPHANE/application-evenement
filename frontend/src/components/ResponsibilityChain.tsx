"use client";

import { useEffect, useState } from "react";

import {
  ChainAnomalyList,
  ResponsibilityChainGraph,
  type ChainAnomalyView,
} from "@/components/ResponsibilityChainGraph";
import { AppIcon } from "@/components/icons/AppIcon";

export type ChainStep = {
  phase: string;
  label: string;
  holderRole?: string;
  status: "done" | "active" | "pending";
  documentNumber?: string;
  documentId?: string;
  holderName?: string;
  at?: string;
  signatureValidated?: boolean;
};

type Props = {
  eventId: string;
  eventName?: string;
  /** Affichage compact (carte commande) ou détaillé (drawer traçabilité) */
  variant?: "compact" | "detailed";
  className?: string;
};

export function ResponsibilityChain({
  eventId,
  eventName,
  variant = "compact",
  className = "",
}: Props) {
  const [steps, setSteps] = useState<ChainStep[]>([]);
  const [anomalies, setAnomalies] = useState<ChainAnomalyView[]>([]);
  const [title, setTitle] = useState(eventName ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/cdc/responsibility/${eventId}`);
      if (!res.ok) {
        if (!cancelled) {
          setSteps([]);
          setAnomalies([]);
          setLoading(false);
        }
        return;
      }
      const data = (await res.json()) as {
        eventName: string;
        steps: ChainStep[];
        anomalies?: ChainAnomalyView[];
      };
      if (!cancelled) {
        setTitle(data.eventName);
        setSteps(data.steps);
        setAnomalies(data.anomalies ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (loading) {
    return <p className="trace-chain-loading fs12 text-muted">Chargement de la chaîne...</p>;
  }

  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.status === "done").length;

  if (variant === "detailed") {
    return (
      <div className={`trace-chain trace-chain--detailed ${className}`.trim()}>
        <div className="trace-chain-hd">
          <span className="trace-chain-pct">{Math.round((doneCount / steps.length) * 100)}%</span>
          <span className="fs12 text-muted">
            {doneCount}/{steps.length} étapes validées
            {anomalies.length > 0 ? ` · ${anomalies.length} anomalie(s)` : ""}
          </span>
        </div>
        <ChainAnomalyList anomalies={anomalies} />
        <ResponsibilityChainGraph steps={steps} anomalies={anomalies} />
        <details className="trace-chain-details">
          <summary className="fs12 text-muted">Vue liste</summary>
          <ol className="trace-chain-steps">
            {steps.map((s, i) => (
              <li key={s.phase} className={`trace-chain-step trace-chain-step--${s.status}`}>
                <div className="trace-chain-node" aria-hidden>
                  {s.status === "done" ? (
                    <AppIcon name="check" size={14} />
                  ) : s.status === "active" ? (
                    <span className="trace-chain-pulse" />
                  ) : (
                    <span className="trace-chain-num">{i + 1}</span>
                  )}
                </div>
                <div className="trace-chain-body">
                  <span className="trace-chain-label">{s.label}</span>
                  {s.holderRole ? (
                    <span className="trace-chain-role fs11 text-muted">{s.holderRole}</span>
                  ) : null}
                  <span className="trace-chain-meta">
                    {s.documentNumber ? <span className="mono">{s.documentNumber}</span> : null}
                    {s.holderName ? ` · ${s.holderName}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </details>
      </div>
    );
  }

  return (
    <div className={`trace-chain ${className}`.trim()}>
      <ResponsibilityChainGraph steps={steps} anomalies={anomalies} className="trace-chain-graph--compact" />
      <p className="trace-chain-foot fs11 text-muted">Chaîne — {title}</p>
    </div>
  );
}
