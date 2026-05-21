"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import type { ChainStep } from "@/components/ResponsibilityChain";

export type ChainAnomalyView = {
  code: string;
  severity: "warning" | "critical";
  message: string;
  phase?: string;
};

type Props = {
  steps: ChainStep[];
  anomalies?: ChainAnomalyView[];
  className?: string;
};

export function ResponsibilityChainGraph({ steps, anomalies = [], className = "" }: Props) {
  const phasesWithAnomaly = new Set(
    anomalies.map((a) => a.phase).filter((p): p is string => Boolean(p)),
  );

  return (
    <div className={`trace-chain-graph ${className}`.trim()} role="img" aria-label="Chaîne de responsabilité">
      {steps.map((s, i) => (
        <div key={s.phase} className="trace-chain-graph-segment">
          <div
            className={`trace-chain-graph-node trace-chain-graph-node--${s.status}${phasesWithAnomaly.has(s.phase) ? " trace-chain-graph-node--anomaly" : ""}`}
            title={s.holderName ? `${s.label} — ${s.holderName}` : s.label}
          >
            <div className="trace-chain-graph-node-icon" aria-hidden>
              {s.status === "done" ? (
                <AppIcon name="check" size={16} />
              ) : s.status === "active" ? (
                <span className="trace-chain-pulse" />
              ) : (
                <span className="trace-chain-graph-node-num">{i + 1}</span>
              )}
            </div>
            <span className="trace-chain-graph-node-label">{s.label}</span>
            {s.holderRole ? (
              <span className="trace-chain-graph-node-role">{s.holderRole}</span>
            ) : null}
            {s.holderName ? (
              <span className="trace-chain-graph-node-holder">{s.holderName}</span>
            ) : null}
            {phasesWithAnomaly.has(s.phase) ? (
              <span className="trace-chain-graph-node-warn" title="Anomalie détectée">
                <AppIcon name="alert" size={12} />
              </span>
            ) : null}
          </div>
          {i < steps.length - 1 ? (
            <div
              className={`trace-chain-graph-edge${s.status === "done" ? " trace-chain-graph-edge--done" : ""}`}
              aria-hidden
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ChainAnomalyList({ anomalies }: { anomalies: ChainAnomalyView[] }) {
  if (anomalies.length === 0) return null;
  return (
    <ul className="trace-anomaly-list">
      {anomalies.map((a, idx) => (
        <li
          key={`${a.code}-${idx}`}
          className={`trace-anomaly-item trace-anomaly-item--${a.severity}`}
        >
          <AppIcon name="alert" size={14} />
          <span>{a.message}</span>
        </li>
      ))}
    </ul>
  );
}
