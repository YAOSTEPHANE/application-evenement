"use client";

import type { OrderStatus } from "@prisma/client";

import { orderStatusSignification } from "@/lib/cdc-labels";
import { CDC_ORDER_LIFECYCLE } from "@/lib/cdc-order-lifecycle";

type Props = {
  currentStatus?: OrderStatus;
};

export function OrderLifecycleBar({ currentStatus }: Props) {
  return (
    <section className="orders-lifecycle" aria-label="Cycle de vie commande">
      <div className="orders-lifecycle-grid">
        {CDC_ORDER_LIFECYCLE.map((step) => {
          const active = currentStatus === step.status;
          const done =
            currentStatus !== undefined &&
            CDC_ORDER_LIFECYCLE.findIndex((s) => s.status === currentStatus) >
              CDC_ORDER_LIFECYCLE.findIndex((s) => s.status === step.status);
          return (
            <article
              key={step.status}
              className={`orders-lifecycle-step${active ? " orders-lifecycle-step--active" : ""}${
                done ? " orders-lifecycle-step--done" : ""
              }`}
              title={step.signification}
            >
              <div className="orders-lifecycle-num">{step.order}</div>
              <h3 className="orders-lifecycle-label">{step.label}</h3>
              <p className="orders-lifecycle-signification">{step.signification}</p>
              {active && currentStatus ? (
                <p className="orders-lifecycle-hint fs11 text-muted">
                  {orderStatusSignification(currentStatus)}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
