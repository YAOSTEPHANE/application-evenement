"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import {
  HANDHELD_CDC_CAPABILITIES,
  HANDHELD_EQUIPMENT_DOC,
  PORTAL_CDC_CAPABILITIES,
  PORTAL_EQUIPMENT_DOC,
} from "@/lib/rfid-reading-equipment";

type Variant = "portal" | "handheld" | "both";

export function RfidReadingEquipmentGuide({ variant = "both" }: { variant?: Variant }) {
  return (
    <div className="rfid-reading-guide">
      {(variant === "portal" || variant === "both") && (
        <article className="rfid-reading-guide-block">
          <h3 className="rfid-reading-guide-title">
            <AppIcon name="warehouse" size={16} />
            {PORTAL_EQUIPMENT_DOC.title}
            <span className="rfid-reading-guide-ref">{PORTAL_EQUIPMENT_DOC.section}</span>
          </h3>
          <ul className="rfid-reading-guide-list">
            {PORTAL_EQUIPMENT_DOC.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="rfid-reading-guide-meta">
            Rapprochement temps réel : {PORTAL_CDC_CAPABILITIES.realtimeDocumentMatch.join(", ")}
            · Alertes écart : son + visuel
          </p>
        </article>
      )}
      {(variant === "handheld" || variant === "both") && (
        <article className="rfid-reading-guide-block">
          <h3 className="rfid-reading-guide-title">
            <AppIcon name="scan" size={16} />
            {HANDHELD_EQUIPMENT_DOC.title}
            <span className="rfid-reading-guide-ref">{HANDHELD_EQUIPMENT_DOC.section}</span>
          </h3>
          <ul className="rfid-reading-guide-list">
            {HANDHELD_EQUIPMENT_DOC.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="rfid-reading-guide-meta">
            Usages : {HANDHELD_CDC_CAPABILITIES.useCases.join(" · ")} · Sync immédiate · Autonomie
            min. {HANDHELD_CDC_CAPABILITIES.minBatteryAutonomyHours} h
          </p>
        </article>
      )}
    </div>
  );
}
