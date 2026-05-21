"use client";

import { useEffect, useState } from "react";

import { AppIcon } from "@/components/icons/AppIcon";

type PhaseSpec = {
  phase: string;
  title: string;
  cdcStage: string;
  holderRole: string;
  order: number;
};

type CycleSpec = {
  ref: string;
  principle: string;
  phases: PhaseSpec[];
};

export function ResponsibilityCycleGuide({ className = "" }: { className?: string }) {
  const [spec, setSpec] = useState<CycleSpec | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/cdc/responsibility/cycle");
      if (res.ok && !cancelled) {
        setSpec((await res.json()) as CycleSpec);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!spec) return null;

  return (
    <section className={`trace-cycle-guide ${className}`.trim()}>
      <div className="trace-cycle-guide-hd">
        <AppIcon name="shield" size={18} />
        <div>
          <h2 className="trace-cycle-guide-title">Cycle de responsabilité</h2>
          <p className="trace-cycle-guide-sub fs12 text-muted">{spec.principle}</p>
        </div>
      </div>
      <ol className="trace-cycle-guide-steps">
        {spec.phases.map((p, i) => (
          <li key={p.phase} className="trace-cycle-guide-step">
            <span className="trace-cycle-guide-num">{p.order}</span>
            <div>
              <span className="trace-cycle-guide-stage">{p.title}</span>
              <span className="trace-cycle-guide-role fs12 text-muted">{p.holderRole}</span>
            </div>
            {i < spec.phases.length - 1 ? (
              <span className="trace-cycle-guide-arrow" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
