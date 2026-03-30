"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";

import { fmtNum } from "@/lib/stock/helpers";

export type SeriesPoint = {
  day: string;
  outbound: number;
  returns: number;
  other: number;
  total: number;
};

export type CategoryBreakdownRow = {
  name: string;
  count: number;
  value: number;
  qtyUnits: number;
};

const DONUT_COLORS = [
  "var(--navy2)",
  "var(--gold)",
  "var(--ok)",
  "var(--info)",
  "var(--warn)",
  "var(--danger)",
  "var(--text3)",
];

function shortDayLabel(isoDay: string): string {
  const [, m, d] = isoDay.split("-").map(Number);
  if (!m || !d) {
    return isoDay;
  }
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export function MovementMixBars({
  mix,
  loading,
}: {
  mix: Record<string, number>;
  loading: boolean;
}) {
  const rows = [
    { key: "OUTBOUND" as const, label: "Sorties", color: "var(--danger)" },
    { key: "RETURN" as const, label: "Retours", color: "var(--ok)" },
    { key: "ADJUSTMENT" as const, label: "Réceptions / ajustements", color: "var(--info)" },
  ];
  const total = Math.max(1, rows.reduce((s, r) => s + (mix[r.key] ?? 0), 0));
  return (
    <div className="an-mix">
      {loading ? (
        <div className="an-skeleton an-skeleton-chart" aria-hidden />
      ) : (
        rows.map((r, idx) => {
          const v = mix[r.key] ?? 0;
          const pct = Math.round((v / total) * 1000) / 10;
          return (
            <div key={r.key} className="an-mix-row" style={{ animationDelay: `${idx * 70}ms` }}>
              <div className="an-mix-meta">
                <span className="an-mix-dot" style={{ background: r.color }} />
                <span className="an-mix-label">{r.label}</span>
                <span className="an-mix-val">{fmtNum(v)} u.</span>
              </div>
              <div className="an-mix-track">
                <div className="an-mix-fill" style={{ width: `${pct}%`, background: r.color }} />
              </div>
              <span className="an-mix-pct">{pct}%</span>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Courbes + aires + axe Y + infobulle au survol */
export function ActivityAreaChart({ series, loading }: { series: SeriesPoint[]; loading: boolean }) {
  const uid = useId().replace(/:/g, "");
  const gradOut = `anGradOut-${uid}`;
  const gradRet = `anGradRet-${uid}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{
    idx: number;
    leftPct: number;
    day: string;
    outbound: number;
    returns: number;
    other: number;
  } | null>(null);

  const W = 560;
  const H = 176;
  const padL = 44;
  const padR = 14;
  const padT = 12;
  const padB = 30;

  const chartGeom = useMemo(() => {
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const n = series.length;
    const baseY = padT + innerH;
    if (n === 0) {
      return {
        innerW,
        innerH,
        n: 0,
        maxVal: 8,
        pathOut: "",
        pathRet: "",
        areaOut: "",
        areaRet: "",
        ticks: [] as { x: number; label: string }[],
        yTicks: [] as { y: number; label: string }[],
        baseY,
      };
    }
    const maxRaw = Math.max(
      4,
      ...series.map((s) => s.outbound),
      ...series.map((s) => s.returns),
      1,
    );
    const maxVal = maxRaw;
    const xAt = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v: number) => padT + innerH - (v / maxVal) * innerH;
    const ptsOut = series.map((s, i) => ({ x: xAt(i), y: yAt(s.outbound) }));
    const ptsRet = series.map((s, i) => ({ x: xAt(i), y: yAt(s.returns) }));

    const lineOut = ptsOut.map((p) => `${p.x},${p.y}`).join(" ");
    const lineRet = ptsRet.map((p) => `${p.x},${p.y}`).join(" ");

    const areaOut = `${ptsOut.map((p) => `${p.x},${p.y}`).join(" ")} ${ptsOut[ptsOut.length - 1]!.x},${baseY} ${ptsOut[0]!.x},${baseY}`;
    const areaRet = `${ptsRet.map((p) => `${p.x},${p.y}`).join(" ")} ${ptsRet[ptsRet.length - 1]!.x},${baseY} ${ptsRet[0]!.x},${baseY}`;

    const tickIndices = [0, 4, 7, 10, 13].filter((i) => i < n);
    if (!tickIndices.includes(n - 1)) {
      tickIndices.push(n - 1);
    }
    const ticks = tickIndices.map((i) => ({ x: xAt(i), label: shortDayLabel(series[i]!.day) }));

    const yTicks = [0, 0.5, 1].map((t) => {
      const v = Math.round(maxVal * t);
      return { y: yAt(v), label: fmtNum(v) };
    });

    return {
      innerW,
      innerH,
      n,
      maxVal,
      pathOut: lineOut,
      pathRet: lineRet,
      areaOut,
      areaRet,
      ticks,
      yTicks,
      baseY,
    };
  }, [series]);

  const onSvgMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || chartGeom.n === 0) {
        return;
      }
      const rect = svg.getBoundingClientRect();
      const vx = ((e.clientX - rect.left) / rect.width) * W;
      const rel = vx - padL;
      const frac = Math.max(0, Math.min(1, rel / chartGeom.innerW));
      const idx =
        chartGeom.n <= 1 ? 0 : Math.round(frac * (chartGeom.n - 1));
      const s = series[idx];
      if (!s) {
        return;
      }
      const leftPct = chartGeom.n <= 1 ? 50 : (idx / (chartGeom.n - 1)) * 100;
      setHover({
        idx,
        leftPct,
        day: s.day,
        outbound: s.outbound,
        returns: s.returns,
        other: s.other,
      });
    },
    [chartGeom.innerW, chartGeom.n, padL, series],
  );

  if (loading) {
    return <div className="an-skeleton an-skeleton-chart-lg" aria-hidden />;
  }

  if (series.length === 0) {
    return <p className="fs12 fc-3 an-chart-empty">Aucune donnée sur la période.</p>;
  }

  return (
    <div className="an-chart-interactive">
      <div className="an-chart-wrap">
        <svg
          ref={svgRef}
          className="an-chart-svg an-chart-svg-tall"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={onSvgMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradOut} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={gradRet} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--ok)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {chartGeom.yTicks.map((t, i) => (
            <text key={i} x={8} y={t.y + 4} className="an-chart-ytick">
              {t.label}
            </text>
          ))}
          {[0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + chartGeom.innerH * (1 - t);
            return (
              <line
                key={t}
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                className="an-chart-gridline"
              />
            );
          })}
          {chartGeom.areaOut ? (
            <polygon className="an-chart-area" fill={`url(#${gradOut})`} points={chartGeom.areaOut} stroke="none" />
          ) : null}
          {chartGeom.areaRet ? (
            <polygon className="an-chart-area" fill={`url(#${gradRet})`} points={chartGeom.areaRet} stroke="none" />
          ) : null}
          {chartGeom.pathOut ? (
            <polyline
              className="an-chart-curve an-chart-curve-out"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={chartGeom.pathOut}
            />
          ) : null}
          {chartGeom.pathRet ? (
            <polyline
              className="an-chart-curve an-chart-curve-ret"
              fill="none"
              stroke="var(--ok)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={chartGeom.pathRet}
            />
          ) : null}
          {hover && chartGeom.n > 0 ? (
            <line
              x1={padL + (chartGeom.n <= 1 ? chartGeom.innerW / 2 : (hover.idx / (chartGeom.n - 1)) * chartGeom.innerW)}
              y1={padT}
              x2={padL + (chartGeom.n <= 1 ? chartGeom.innerW / 2 : (hover.idx / (chartGeom.n - 1)) * chartGeom.innerW)}
              y2={padT + chartGeom.innerH}
              className="an-chart-cursor"
            />
          ) : null}
          {chartGeom.ticks.map((t) => (
            <text key={`${t.label}-${t.x}`} x={t.x} y={H - 8} textAnchor="middle" className="an-chart-tick">
              {t.label}
            </text>
          ))}
        </svg>
        {hover ? (
          <div
            className="an-chart-tooltip"
            style={{ left: `${hover.leftPct}%` }}
            role="status"
          >
            <div className="an-tip-day">{hover.day}</div>
            <div className="an-tip-row">
              <span className="an-tip-dot an-tip-out" /> Sorties <strong>{fmtNum(hover.outbound)}</strong>
            </div>
            <div className="an-tip-row">
              <span className="an-tip-dot an-tip-ret" /> Retours <strong>{fmtNum(hover.returns)}</strong>
            </div>
            {hover.other > 0 ? (
              <div className="an-tip-row">
                <span className="an-tip-dot an-tip-oth" /> Autres <strong>{fmtNum(hover.other)}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="an-chart-legend">
        <span>
          <i className="an-leg-dot an-leg-out" /> Sorties (qté)
        </span>
        <span>
          <i className="an-leg-dot an-leg-ret" /> Retours (qté)
        </span>
      </div>
    </div>
  );
}

/** Histogramme du volume total par jour */
export function DailyVolumeBars({ series, loading }: { series: SeriesPoint[]; loading: boolean }) {
  const W = 400;
  const H = 100;
  const pad = 8;
  const barGap = 2;
  const n = series.length || 1;
  const innerW = W - pad * 2;
  const barW = Math.max(2, (innerW - barGap * (n - 1)) / n);
  const maxTot = Math.max(1, ...series.map((s) => s.total));

  if (loading) {
    return <div className="an-skeleton an-skeleton-h100" aria-hidden />;
  }

  if (series.length === 0) {
    return null;
  }

  return (
    <div className="an-daily-bars-wrap">
      <div className="an-daily-bars-label">Volume total quotidien (tous flux)</div>
      <svg className="an-daily-bars-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {series.map((s, i) => {
          const h = (s.total / maxTot) * (H - pad - 18);
          const x = pad + i * (barW + barGap);
          const y = H - 16 - h;
          return (
            <rect
              key={s.day}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0)}
              rx={2}
              className="an-daily-bar an-daily-bar-anim"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function donutFromEntries(entries: Array<{ name: string; weight: number }>) {
  const total = entries.reduce((s, e) => s + e.weight, 0) || 1;
  let acc = 0;
  const segments = entries.map((e, i) => {
    const pct = (e.weight / total) * 100;
    const start = acc;
    acc += pct;
    return { ...e, pct, start, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  const gradient = segments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");
  return { segments, gradient, total };
}

export function CategoryDonut({ distribution }: { distribution: Record<string, number> }) {
  const entries = Object.entries(distribution)
    .map(([name, count]) => ({ name, weight: count }))
    .sort((a, b) => b.weight - a.weight);
  if (entries.length === 0) {
    return <div className="fs12 fc-3">Aucune catégorie</div>;
  }
  const { segments, gradient } = donutFromEntries(entries);
  const total = entries.reduce((s, e) => s + e.weight, 0);
  return (
    <div className="an-donut-layout">
      <div className="an-donut-ring-wrap">
        <div className="an-donut-ring" style={{ background: `conic-gradient(${gradient})` }} />
        <div className="an-donut-hole">
          <span className="an-donut-hole-label">Articles</span>
          <span className="an-donut-hole-val">{fmtNum(total)}</span>
        </div>
      </div>
      <ul className="an-donut-legend">
        {segments.map((s) => (
          <li key={s.name}>
            <span className="an-donut-swatch" style={{ background: s.color }} />
            <span className="an-donut-name">{s.name}</span>
            <span className="an-donut-pct">{Math.round(s.pct)}%</span>
            <span className="an-donut-n">({fmtNum(s.weight)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type CatMetric = "count" | "value" | "units";

export function CategoryDeepDive({
  rows,
  onManageCategories,
}: {
  rows: CategoryBreakdownRow[];
  onManageCategories?: () => void;
}) {
  const [metric, setMetric] = useState<CatMetric>("value");

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (metric === "count") {
      copy.sort((a, b) => b.count - a.count);
    } else if (metric === "units") {
      copy.sort((a, b) => b.qtyUnits - a.qtyUnits);
    } else {
      copy.sort((a, b) => b.value - a.value);
    }
    return copy.slice(0, 10);
  }, [rows, metric]);

  const maxBar = useMemo(() => {
    if (sorted.length === 0) {
      return 1;
    }
    if (metric === "count") {
      return Math.max(1, ...sorted.map((r) => r.count));
    }
    if (metric === "units") {
      return Math.max(1, ...sorted.map((r) => r.qtyUnits));
    }
    return Math.max(1, ...sorted.map((r) => r.value));
  }, [sorted, metric]);

  const donutEntries = useMemo(() => {
    return sorted.map((r) => ({
      name: r.name,
      weight: metric === "count" ? r.count : metric === "units" ? r.qtyUnits : r.value,
    }));
  }, [sorted, metric]);

  const donutCenter =
    metric === "count"
      ? fmtNum(sorted.reduce((s, r) => s + r.count, 0))
      : metric === "units"
        ? fmtNum(sorted.reduce((s, r) => s + r.qtyUnits, 0))
        : fmtNum(Math.round(sorted.reduce((s, r) => s + r.value, 0)));

  const { segments, gradient } =
    donutEntries.length > 0 ? donutFromEntries(donutEntries) : { segments: [], gradient: "" };

  return (
    <div className="an-cat-deep">
      <div className="an-cat-toolbar">
        <div className="an-seg">
          <button
            type="button"
            className={`an-seg-btn${metric === "value" ? " active" : ""}`}
            onClick={() => setMetric("value")}
          >
            Valeur (F CFA)
          </button>
          <button
            type="button"
            className={`an-seg-btn${metric === "count" ? " active" : ""}`}
            onClick={() => setMetric("count")}
          >
            Nb articles
          </button>
          <button
            type="button"
            className={`an-seg-btn${metric === "units" ? " active" : ""}`}
            onClick={() => setMetric("units")}
          >
            Unités stock
          </button>
        </div>
        {onManageCategories ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onManageCategories}>
            Gérer les catégories →
          </button>
        ) : null}
      </div>

      <div className="an-cat-split">
        <div className="an-cat-donut-side">
          {segments.length === 0 ? (
            <div className="fs12 fc-3">Aucune donnée</div>
          ) : (
            <div className="an-donut-layout an-donut-compact">
              <div className="an-donut-ring-wrap an-donut-sm">
                <div
                  className="an-donut-ring an-donut-ring-anim"
                  style={{ background: `conic-gradient(${gradient})` }}
                />
                <div className="an-donut-hole">
                  <span className="an-donut-hole-label">
                    {metric === "value" ? "Total F CFA" : metric === "count" ? "Articles" : "Unités"}
                  </span>
                  <span className="an-donut-hole-val">{donutCenter}</span>
                </div>
              </div>
              <ul className="an-donut-legend an-donut-legend-compact">
                {segments.slice(0, 6).map((s) => (
                  <li key={s.name}>
                    <span className="an-donut-swatch" style={{ background: s.color }} />
                    <span className="an-donut-name">{s.name}</span>
                    <span className="an-donut-pct">{Math.round(s.pct)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="an-cat-bars-side">
          {sorted.map((r, i) => {
            const v = metric === "count" ? r.count : metric === "units" ? r.qtyUnits : r.value;
            const pct = Math.round((v / maxBar) * 1000) / 10;
            return (
              <div key={r.name} className="an-hbar-row" style={{ animationDelay: `${i * 50}ms` }}>
                <span className="an-hbar-rank">{i + 1}</span>
                <span className="an-hbar-name">{r.name}</span>
                <div className="an-hbar-track">
                  <div
                    className="an-hbar-fill"
                    style={{
                      width: `${pct}%`,
                      background: DONUT_COLORS[i % DONUT_COLORS.length],
                    }}
                  />
                </div>
                <span className="an-hbar-val">
                  {metric === "value" ? `${fmtNum(Math.round(r.value))} F` : fmtNum(v)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
