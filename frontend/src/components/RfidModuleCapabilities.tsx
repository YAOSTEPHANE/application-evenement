"use client";

import { AppIcon } from "@/components/icons/AppIcon";
import { RFID_MODULE_FEATURES, type RfidModuleFeatureId } from "@/lib/rfid-module-features";

type TabId = "catalog" | "units" | "inventory" | "typology" | "portiques" | "douchettes";

type Props = {
  activeTab?: TabId;
  onNavigate?: (tab: TabId) => void;
};

const ICONS: Record<RfidModuleFeatureId, "package" | "rfid" | "shield" | "scan" | "search"> = {
  catalog: "package",
  unit_tracking: "rfid",
  quarantine: "shield",
  inventory_sample: "scan",
  search: "search",
};

export function RfidModuleCapabilities({ activeTab, onNavigate }: Props) {
  return (
    <section className="rfid-capabilities" aria-label="Fonctionnalités du module">
      <div className="rfid-capabilities-grid">
        {RFID_MODULE_FEATURES.map((f) => {
          const isActive = f.tab === activeTab;
          const clickable = Boolean(f.tab && onNavigate);
          return (
            <article
              key={f.id}
              className={`rfid-capability-card${isActive ? " rfid-capability-card--active" : ""}${
                clickable ? " rfid-capability-card--click" : ""
              }`}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={
                clickable && f.tab
                  ? () => onNavigate?.(f.tab as TabId)
                  : undefined
              }
              onKeyDown={
                clickable && f.tab
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onNavigate?.(f.tab as TabId);
                      }
                    }
                  : undefined
              }
            >
              <div className="rfid-capability-icon">
                <AppIcon name={ICONS[f.id]} size={18} />
              </div>
              <h3 className="rfid-capability-title">{f.title}</h3>
              <p className="rfid-capability-summary">{f.summary}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
