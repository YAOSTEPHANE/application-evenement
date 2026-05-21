"use client";

import type { RfidTagType } from "@prisma/client";

import { AppIcon } from "@/components/icons/AppIcon";
import { RFID_TAG_TYPOLOGY } from "@/lib/rfid-tag-typology";

type Props = {
  selectedType?: RfidTagType | null;
  onSelectType?: (type: RfidTagType) => void;
  compact?: boolean;
};

export function RfidTagTypologyPanel({ selectedType, onSelectType, compact }: Props) {
  return (
    <section className="rfid-typology" aria-labelledby="rfid-typology-title">
      <header className="rfid-typology-hd">
        <h2 id="rfid-typology-title" className="rfid-typology-title">
          <AppIcon name="rfid" size={18} />
          Typologie des supports RFID
        </h2>
        <p className="rfid-typology-lead">
          Cinq catégories de tags selon les contraintes physiques du matériel — choix obligatoire à
          l&apos;association article / unité.
        </p>
      </header>
      <div className={`rfid-typology-grid${compact ? " rfid-typology-grid--compact" : ""}`}>
        {RFID_TAG_TYPOLOGY.map((entry) => {
          const active = selectedType === entry.type;
          const interactive = Boolean(onSelectType);
          return (
            <article
              key={entry.type}
              className={`rfid-typology-card${active ? " rfid-typology-card--active" : ""}${interactive ? " rfid-typology-card--click" : ""}`}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onSelectType?.(entry.type) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectType?.(entry.type);
                      }
                    }
                  : undefined
              }
            >
              <div className="rfid-typology-card-hd">
                <span className="rfid-typology-type">{entry.title}</span>
                <code className="rfid-typology-code">{entry.type}</code>
              </div>
              <p className="rfid-typology-materials">
                <strong>Matériel</strong> — {entry.materials}
              </p>
              <p className="rfid-typology-part">{entry.particularities}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
