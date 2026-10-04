import { useId, useMemo, useRef, useState } from "react";
import { useInView } from "../lib/motion.js";
import { fmtDate, fmtNum, fmtPct, fmtShort, fmtUsd, fmtK } from "../lib/format.js";
import { Tip } from "./ui.jsx";

/* ---------------------------------------------------------------- sparkline */

export function Sparkline({ bars, tone = "accent", height = 48, delay = 0 }) {
  const [ref, inView] = useInView();
  const id = useId();
  const [hover, setHover] = useState(null);
  const W = 240, H = height, P = 3;
  const { d, area, pts, len } = useMemo(() => {
    const c = bars.map((b) => b.close);
    const lo = Math.min(...c), hi = Math.max(...c);
    const pts = c.map((v, i) => [P + (i / (c.length - 1)) * (W - 2 * P), P + (1 - (v - lo) / (hi - lo || 1)) * (H - 2 * P)]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { d, area: `${d}L${W - P},${H}L${P},${H}Z`, pts, len: Math.ceil(len) };
  }, [bars, H]);
  const color = tone === "down" ? "var(--down)" : "var(--accent)";
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (bars.length - 1));
    setHover(Math.max(0, Math.min(bars.length - 1, i)));
  };
  const hp = hover != null ? pts[hover] : null;
  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-12 w-full overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${bars.length}-day closing prices, from ${fmtNum(bars[0].close)} to ${fmtNum(bars.at(-1).close)}`}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} className="transition-opacity duration-[1200ms]" style={{ opacity: inView ? 1 : 0, transitionDelay: `${delay + 500}ms` }} />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={len}
          strokeDashoffset={inView ? 0 : len}
          style={{ transition: `stroke-dashoffset 1600ms cubic-bezier(.16,1,.3,1) ${delay}ms` }}
        />
        {hp && <line x1={hp[0]} x2={hp[0]} y1="0" y2={H} stroke="var(--line-2)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hp && (
        <>
          <span className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${(hp[0] / W) * 100}%`, top: `${(hp[1] / H) * 100}%`, background: color }} />
          <Tip tip={{ x: `${(hp[0] / W) * 100}%`, y: (hp[1] / H) * 48, content: <><div className="meta mb-1">{fmtShort(bars[hover].date)}</div><b className="num font-mono">{fmtNum(bars[hover].close)}</b></> }} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------- generic bar chart */

function useWidth() {
  const ref = useRef(null);
  return ref;
}

/**
 * Vertical bars around a zero baseline. Single series; color encodes sign and the
 * tooltip carries the exact value, so color is never the only signal.
 */
export function BarChart({ items, value, label, tooltip, refs = [], height = 380, format = (v) => v, colorOf, ariaLabel }) {
  const [ref, inView] = useInView();
  const [tip, setTip] = useState(null);
  const box = useWidth();
  const W = 1000, H = height, padL = 64, padR = 12, padT = 24, padB = 40;
  const vals = items.map(value);
  const max = Math.max(0, ...vals, ...refs.map((r) => r.value));
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const y = (v) => padT + ((max - v) / span) * (H - padT - padB);
  const bw = (W - padL - padR) / Math.max(1, items.length);
  const ticks = niceTicks(min, max, 4);
  const labelEvery = Math.ceil(items.length / 6);

  return (
    <div ref={ref} className="relative">
      <div ref={box} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--line-2)" : "var(--line)"} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[15px]">{format(t)}</text>
            </g>
          ))}
          {items.map((it, i) => {
            const v = vals[i];
            const top = Math.min(y(v), y(0));
            const h = Math.max(2, Math.abs(y(v) - y(0)));
            const x = padL + i * bw + bw * 0.18;
            const w = Math.max(2, bw * 0.64);
            return (
              <g key={i}>
                <rect
                  x={x} y={top} width={w} height={h} rx={Math.min(4, w / 2)}
                  fill={colorOf(it, v)}
                  opacity={tip && tip.i !== i ? 0.35 : 1}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: v >= 0 ? "50% 100%" : "50% 0%",
                    transform: inView ? "scaleY(1)" : "scaleY(0)",
                    transition: `transform 900ms cubic-bezier(.16,1,.3,1) ${200 + i * 14}ms, opacity 180ms`,
                  }}
                />
                <rect
                  x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent"
                  onPointerEnter={() => setTip({ i, x: ((padL + i * bw + bw / 2) / W) * 100, y: top })}
                  onPointerLeave={() => setTip(null)}
                />
                {i % labelEvery === 0 && (
                  <text x={padL + i * bw + bw / 2} y={H - 10} textAnchor="middle" className="fill-ink-3 font-mono text-[15px]">{label(it)}</text>
                )}
              </g>
            );
          })}
          {refs.map((r) => (
            <g key={r.label}>
              <line x1={padL} x2={W - padR} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeWidth="1.5" strokeDasharray="6 5" />
              <text x={W - padR} y={y(r.value) - 6} textAnchor="end" className="font-mono text-[15px] font-semibold" fill={r.color}>{r.label}</text>
            </g>
          ))}
        </svg>
        {tip && <Tip tip={{ x: `${tip.x}%`, y: `${(tip.y / H) * 100}%`, content: tooltip(items[tip.i]) }} />}
      </div>
    </div>
  );
}

function niceTicks(min, max, n) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  if (!out.includes(0) && min <= 0 && max >= 0) out.push(0);
  return out;
}

/* ------------------------------------------------------------ presets */

export function ExcessChart({ outcomes }) {
  const items = [...outcomes].sort((a, b) => a.run_date.localeCompare(b.run_date) || a.ticker.localeCompare(b.ticker));
  return (
    <BarChart
      items={items}
      value={(o) => o.excess_pct}
      label={(o) => fmtShort(o.run_date)}
      format={(v) => `${v > 0 ? "+" : ""}${v}%`}
      colorOf={(o) => (o.verdict === "hit" ? "var(--accent)" : o.verdict === "miss" ? "var(--down)" : "var(--flat)")}
      ariaLabel="Excess return versus benchmark for each scored pick, oldest first"
      tooltip={(o) => (
        <>
          <div className="mb-1 flex items-center justify-between gap-3"><b className="font-mono">{o.ticker}</b><span className="meta">{o.stance}</span></div>
          <div className="text-ink-3">{fmtShort(o.run_date)} → {fmtShort(o.scored_date)}</div>
          <div className="mt-1 num font-mono">excess <b>{fmtPct(o.excess_pct)}</b></div>
          <div className="num font-mono text-ink-3">pick {fmtPct(o.return_pct)} · bench {fmtPct(o.benchmark_return_pct)}</div>
          <div className="mt-1 meta">{o.verdict}</div>
        </>
      )}
    />
  );
}

export function CostChart({ runs, cost }) {
  return (
    <BarChart
      items={runs}
      value={(r) => r.cost.usd}
      label={(r) => fmtShort(r.date)}
      format={(v) => `$${v}`}
      refs={[
        { value: cost.target_usd, label: `target ${fmtUsd(cost.target_usd)}`, color: "var(--accent)" },
        { value: cost.warn_usd, label: `warn ${fmtUsd(cost.warn_usd)}`, color: "var(--people)" },
      ]}
      colorOf={(r) => (r.status === "failed" ? "var(--down)" : r.cost.usd > cost.warn_usd ? "var(--people)" : "var(--ink-3)")}
      ariaLabel="Cost per run in US dollars with target and warning lines"
      tooltip={(r) => (
        <>
          <div className="mb-1 flex items-center justify-between gap-3"><b className="font-mono">{fmtDate(r.date)}</b></div>
          <div className="num font-mono">{fmtUsd(r.cost.usd)} · {fmtNum(r.duration_minutes, 1)} min</div>
          <div className="num font-mono text-ink-3">pack {fmtK(r.pack.tokens)} / {fmtK(r.pack.cap_tokens)} tokens</div>
          <div className="mt-1 meta">{r.status}{r.cost.usd > cost.warn_usd ? " · over warn" : ""}</div>
        </>
      )}
    />
  );
}
