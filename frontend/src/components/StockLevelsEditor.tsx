"use client";

import { STOCK_LEVEL_FIELD_HINTS, type StockLevels } from "@/lib/stock-level-helpers";

type StockLevelsEditorProps = {
  levels: StockLevels;
  onChange: (levels: StockLevels) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function StockLevelsEditor({
  levels,
  onChange,
  disabled = false,
  idPrefix = "stock",
}: StockLevelsEditorProps) {
  function patch(key: keyof StockLevels, raw: string) {
    const value = Number.parseInt(raw, 10);
    onChange({ ...levels, [key]: Number.isFinite(value) && value >= 0 ? value : 0 });
  }

  return (
    <div className="form-grid stock-levels-grid">
      {STOCK_LEVEL_FIELD_HINTS.map(({ key, label, hint }) => (
        <div className="fg" key={key}>
          <label htmlFor={`${idPrefix}-${key}`}>{label}</label>
          <input
            id={`${idPrefix}-${key}`}
            className="fi"
            type="number"
            min={0}
            disabled={disabled}
            value={levels[key]}
            onChange={(e) => patch(key, e.target.value)}
          />
          <span className="fs11 fc-3">{hint}</span>
        </div>
      ))}
    </div>
  );
}
