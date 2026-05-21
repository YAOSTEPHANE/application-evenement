"use client";

import { OrderStatus } from "@prisma/client";

import { AppIcon } from "@/components/icons/AppIcon";
import {
  TRIO_PILLAR_LABELS,
  type OperationalTrioPillar,
  type TrioValidationState,
} from "@/lib/cdc-order-trio";

type Props = {
  orderStatus: OrderStatus;
  trio: TrioValidationState;
  onValidate: (pillar: OperationalTrioPillar) => Promise<void>;
  validating?: OperationalTrioPillar | null;
};

const PILLARS: OperationalTrioPillar[] = ["stock", "technical", "fleet"];

export function OrderTrioValidation({ orderStatus, trio, onValidate, validating }: Props) {
  if (orderStatus !== OrderStatus.PENDING) {
    return trio.complete ? (
      <p className="fs12 text-muted orders-trio-done">
        <AppIcon name="check" size={14} />
        Trio opérationnel validé avant déploiement.
      </p>
    ) : null;
  }

  return (
    <div className="orders-trio">
      <p className="orders-section-title">Validation trio opérationnel</p>
      <p className="fs12 text-muted" style={{ marginBottom: 10 }}>
        Stock, Technique et Parc doivent valider avant le chargement (BS-EVT).
      </p>
      <div className="orders-trio-grid">
        {PILLARS.map((pillar) => {
          const ok = trio[pillar];
          return (
            <div
              key={pillar}
              className={`orders-trio-pill${ok ? " orders-trio-pill--ok" : ""}`}
            >
              <span>{TRIO_PILLAR_LABELS[pillar]}</span>
              {ok ? (
                <AppIcon name="check" size={14} />
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={validating !== null && validating !== pillar}
                  onClick={() => void onValidate(pillar)}
                >
                  {validating === pillar ? "…" : "Valider"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
