import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtPct } from "../lib/format.js";
import { useInView } from "../lib/motion.js";

/**
 * Multi-line chart of series indexed to 100 on a shared date grid. Log scale by default, so a
 * steady +20% a year is a straight line and long histories stay readable.
 * series: [{ key, label, values, color, dash?, width? }]
 */
export function LinesChart({ dates, series, log = true, height, ariaLabel }) {
  const [ref, inView] = useInView();
  const box = useRef(null);
  const svg = useRef(null);
  const [W, setW] = useState(1000);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 640;
  const H = height ?? (narrow ? 280 : 420), L = narrow ? 40 : 52, R = narrow ? 58 : 72, T = 14, B = 28;
  const f = (v) => (log ? Math.log(v) : v);
  const all = series.flatMap((s) => s.values).filter((v) => v > 0);
  const lo = f(Math.min(...all)), hi = f(Math.max(...all));
  const pad = (hi - lo) * 0.06 || 1;
  const n = dates.length;
  const x = (i) => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const y = (v) => T + (1 - (f(v) - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const minV = Math.min(...all), maxV = Math.max(...all);
  const ticks = log ? niceLogTicks(minV, maxV) : [minV, (minV + maxV) / 2, maxV].map(Math.round);
  const years = [...new Set(dates.map((d) => d.slice(0, 4)))];
  const yearIdx = years.map((yr) => dates.findIndex((d) => d.startsWith(yr))).filter((i, k) => k > 0 || i > 0);
  const every = Math.ceil(yearIdx.length / (narrow ? 4 : 8));

  // End labels, nudged apart so they do not overlap.
  const ends = series.map((s) => ({ s, y: y(s.values.at(-1)) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;

  const onMove = (e) => {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };
  const h = hover;

  return (
    <div ref={ref}>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <i className="w-5" style={{ borderTop: `${s.width ?? 2}px ${s.dash ? "dashed" : "solid"} ${s.color}` }} />{s.label}
          </span>
        ))}
      </div>
      <div ref={box} className="relative">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y overflow-visible" role="img" aria-label={ariaLabel}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 100 ? "var(--line-2)" : "var(--line)"} strokeDasharray={t === 100 ? "2 4" : undefined} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11.5px]">{fmtTick(t)}</text>
            </g>
          ))}
          {yearIdx.map((i, k) => k % every === 0 && (
            <text key={i} x={Math.max(L + 14, x(i))} y={H - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[11.5px]">{dates[i].slice(0, 4)}</text>
          ))}
          {series.map((s, k) => (
            <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash ? "6 5" : undefined}
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
              style={{ opacity: inView ? 1 : 0, transition: `opacity 900ms cubic-bezier(.16,1,.3,1) ${k * 120}ms` }} />
          ))}
          {ends.map(({ s, y: yy }) => (
            <text key={s.key} x={W - R + 8} y={yy + 4} className="font-mono text-[12px] font-semibold" fill={s.color}>{fmtMult(s.values.at(-1))}</text>
          ))}
          {h != null && (
            <g>
              <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="var(--line-2)" />
              {series.map((s) => <circle key={s.key} cx={x(h)} cy={y(s.values[h])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
            </g>
          )}
        </svg>
        {h != null && (
          <div className="pointer-events-none absolute top-0 z-10 min-w-[190px] rounded-xl border border-line-2 bg-surface px-3 py-2 text-[12.5px] shadow-xl"
            style={{ left: `clamp(0px, calc(${(x(h) / W) * 100}% - 95px), calc(100% - 190px))` }}>
            <div className="meta mb-1">{fmtDate(dates[h])}</div>
            {series.map((s) => (
              <div key={s.key} className="flex justify-between gap-4"><span style={{ color: s.color }}>{s.label}</span><b className="num font-mono">{fmtPct(s.values[h] - 100, 0)}</b></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const fmtMult = (v) => (v >= 200 ? `×${(v / 100).toFixed(1)}` : fmtPct(v - 100, 0));
const fmtTick = (t) => (t >= 1000 ? `${(t / 100).toFixed(0)}×` : String(Math.round(t)));

function niceLogTicks(lo, hi) {
  const cands = [25, 50, 75, 100, 150, 200, 300, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const inside = cands.filter((c) => c >= lo * 0.98 && c <= hi * 1.02);
  if (inside.length <= 5) return inside.length ? inside : [Math.round(lo), Math.round(hi)];
  const step = Math.ceil(inside.length / 5);
  return inside.filter((_, i) => i % step === 0);
}
