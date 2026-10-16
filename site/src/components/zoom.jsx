import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bands, candleGeom, fitDomain, linePath, monthTicks, scaleLinear } from "../lib/candles.js";
import { loadMarketCandles } from "../lib/data.js";
import { useReducedMotion } from "../lib/motion.js";
import { SPOT_CAVEAT, topSpots, zoomAround } from "../lib/spots.js";

/*
 * The zoom view: a big candle chart that opens from a card's mini chart. The candles grow in one after another, the
 * ones worth noticing get a numbered, softly pulsing marker, and each is explained below in plain words. Tapping one
 * zooms in on it; "Show all" goes back. No numbers on the chart: the full chart with its scale is on the Stock page.
 */

const RANGES = [{ id: "1m", label: "1 month", n: 22 }, { id: "3m", label: "3 months", n: 63 }, { id: "6m", label: "6 months", n: 130 }];
const H = 300, PAD_X = 10, PAD_TOP = 34, PAD_BOT = 26;
const TONE = { up: "var(--accent)", down: "var(--down)", flat: "var(--ai)" };
const UP = "var(--accent)", DOWN = "var(--down)";

export function slice(s, from, to) {
  const keys = ["dates", "o", "h", "l", "c", "vol_rel", "ma20"];
  const w = Object.fromEntries(keys.map((k) => [k, (s[k] ?? []).slice(from, to)]));
  w.n = w.dates.length;
  return w;
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function CandleZoom({ it, manifest, marketId, onClose, openTo }) {
  const reduced = useReducedMotion();
  const [doc, setDoc] = useState(undefined);
  const [range, setRange] = useState("3m");
  const [focus, setFocus] = useState(null); // index (in the range window) of the spot zoomed in on
  const panel = useRef(null);

  useEffect(() => {
    let live = true;
    loadMarketCandles(manifest, marketId, it.ticker).then((d) => live && setDoc(d ?? null), () => live && setDoc(null));
    return () => { live = false; };
  }, [manifest, marketId, it.ticker]);

  // Esc closes; the page behind does not scroll; focus moves into the dialog and back to the card on close.
  useEffect(() => {
    const before = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; before?.focus?.(); };
  }, [onClose]);

  const r = RANGES.find((x) => x.id === range);
  const series = doc?.daily;
  const win = useMemo(() => (series?.dates?.length ? slice(series, Math.max(0, series.dates.length - r.n), series.dates.length) : null), [series, r.n]);
  const spots = useMemo(() => (win ? topSpots(win, 5) : []), [win]);
  const [from, to] = focus == null || !win ? [0, win?.n ?? 0] : zoomAround(focus, win.n, 15);
  const view = win ? slice(win, from, to) : null;
  const shown = spots.filter((s) => s.i >= from && s.i < to).map((s) => ({ ...s, j: s.i - from }));
  const chosen = focus == null ? null : spots.find((s) => s.i === focus);
  const pickRange = (id) => { setRange(id); setFocus(null); };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-safe:animate-[fade_200ms_ease-out]" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${it.name}: candles up close`}
        className="relative max-h-[94dvh] w-full max-w-[760px] overflow-y-auto rounded-t-[28px] border border-line-2 bg-surface p-5 shadow-2xl outline-none sm:rounded-[28px] sm:p-7 motion-safe:animate-[rise_380ms_cubic-bezier(.2,.8,.2,1)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="meta">Candles up close</p>
            <h2 className="mt-1 text-[clamp(24px,6.5vw,32px)] leading-tight font-bold tracking-[-0.02em] text-ink">{it.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full border border-line-2 text-[22px] text-ink-2 hover:text-ink">×</button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="How much to show">
          {RANGES.map((x) => (
            <button key={x.id} type="button" onClick={() => pickRange(x.id)} aria-pressed={range === x.id && focus == null}
              className={`min-h-[40px] rounded-full border px-4 text-[15px] font-medium transition-colors ${range === x.id && focus == null ? "border-transparent bg-ink text-bg" : "border-line-2 text-ink-2 hover:text-ink"}`}>
              {x.label}
            </button>
          ))}
          {focus != null && (
            <button type="button" onClick={() => setFocus(null)} className="min-h-[40px] rounded-full border border-accent/50 bg-accent/10 px-4 text-[15px] font-medium text-accent">
              ← Show all {r.label}
            </button>
          )}
        </div>

        <div className="mt-4">
          {doc === undefined && <p className="grid h-[300px] place-items-center rounded-2xl bg-surface-2 text-ink-2" role="status">Loading the candles…</p>}
          {doc !== undefined && !view && <p className="grid h-[300px] place-items-center rounded-2xl border border-dashed border-line-2 text-ink-2">No candles for this one yet.</p>}
          {view && <BigChart key={`${range}-${focus}`} view={view} spots={shown} chosen={chosen?.i - from} reduced={reduced} onSpot={(s) => setFocus(s.i)} name={it.name} />}
        </div>

        {view && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14.5px] text-ink-2">
            <span><span className="font-semibold" style={{ color: UP }}>Green</span>: closed higher than it opened</span>
            <span><span className="font-semibold" style={{ color: DOWN }}>Red</span>: closed lower</span>
            <span>Thin lines: the day's highest and lowest</span>
          </p>
        )}

        {view && (
          <section className="mt-6">
            <h3 className="text-[20px] font-bold tracking-[-0.01em] text-ink">Candles to notice</h3>
            {!spots.length && <p className="mt-2 text-[16.5px] leading-relaxed text-ink-2">Nothing stands out in this stretch: calm, ordinary days.</p>}
            <SpotList spots={spots} focus={focus} onPick={(s) => setFocus(focus === s.i ? null : s.i)} reduced={reduced} zoomWords />
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-3">{SPOT_CAVEAT} Our prices arrive once a day after the close, so this cannot see moves inside a trading day.</p>
            {openTo && (
              <button type="button" onClick={() => { onClose(); openTo(it.candlesTo); }} className="btn mt-4 min-h-[48px] justify-center">The full chart with numbers →</button>
            )}
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The numbered "candles to notice", each with its plain reason; tapping one calls onPick (zoom in, or point at it). */
export function SpotList({ spots, focus, onPick, reduced, zoomWords = false }) {
  return (
    <ol className="mt-3 grid gap-2.5">
      {spots.map((s, k) => {
        const on = focus === s.i;
        return (
          <li key={s.i} className="motion-safe:animate-[rise_420ms_ease-out_both]" style={{ animationDelay: reduced ? undefined : `${250 + k * 90}ms` }}>
            <button type="button" onClick={() => onPick(s)} aria-pressed={on}
              className={`flex w-full gap-3 rounded-2xl border p-4 text-left transition-colors ${on ? "border-accent/60 bg-accent/10" : "border-line-2 hover:border-ink-3"}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-bold text-bg" style={{ background: TONE[s.tone] }}>{s.n}</span>
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold text-ink">{s.title} <span className="font-normal text-ink-3">· {dayWords(s.date)}</span></span>
                <span className="mt-1 block text-[15.5px] leading-relaxed text-ink-2">{s.why}</span>
                <span className="mt-1.5 block text-[14px] font-medium text-accent">{zoomWords ? (on ? "Zoomed in · tap to go back" : "Tap to zoom in") : (on ? "Shown on the chart · tap to clear" : "Tap to see it on the chart")}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export const SPOT_TONE = TONE;

const dayWords = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function BigChart({ view, spots, chosen, reduced, onSpot, name }) {
  const [ref, w] = useWidth();
  const g = useMemo(() => {
    if (!w) return null;
    const ok = view.dates.map((_, i) => [view.o[i], view.h[i], view.l[i], view.c[i]].every((v) => Number.isFinite(v)));
    const sub = { l: view.l.filter((_, i) => ok[i]), h: view.h.filter((_, i) => ok[i]) };
    const dom = fitDomain(sub, view.ma20, { pad: 0.05 });
    const y = scaleLinear(dom.lo, dom.hi, H - PAD_BOT, PAD_TOP);
    const layout = bands(view.n, PAD_X, w - PAD_X, { maxBody: 22 });
    const candles = view.dates.map((_, i) => (ok[i] ? candleGeom(view, i, y, layout) : null));
    return { y, layout, candles, ma: linePath(view.ma20, layout.cx, y), ticks: monthTicks(view.dates, layout.cx, 48) };
  }, [view, w]);
  const step = reduced ? 0 : Math.min(28, 700 / Math.max(1, view.n));
  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl bg-surface-2" style={{ height: H }}>
      {g && (
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${name}: ${view.n} daily candles with ${spots.length} marked.`} className="block">
          {Number.isFinite(chosen) && g.candles[chosen] && (
            <rect x={g.candles[chosen].cx - g.layout.band * 1.4} y="0" width={g.layout.band * 2.8} height={H} fill="var(--accent)" opacity="0.12" className="motion-safe:animate-[fade_400ms_ease-out]" />
          )}
          {g.ticks.map((t) => (
            <g key={t.i}>
              <line x1={t.x} x2={t.x} y1={PAD_TOP - 8} y2={H - PAD_BOT} stroke="var(--line)" strokeDasharray="2 4" />
              <text x={t.x + 4} y={H - 8} fontSize="12" fill="var(--ink-3)">{t.label}</text>
            </g>
          ))}
          {g.candles.map((k, i) => {
            if (!k) return null;
            const col = k.up ? UP : DOWN;
            return (
              <g key={i} className="zoom-candle" style={{ animationDelay: `${i * step}ms` }}>
                <line x1={k.cx} x2={k.cx} y1={k.wickTop} y2={k.wickBot} stroke={col} strokeWidth="1.5" strokeLinecap="round" />
                <rect x={k.x} y={k.y} width={k.w} height={Math.max(1.5, k.h)} rx="1.5" fill={col} fillOpacity={k.up ? 0.9 : 1} />
              </g>
            );
          })}
          <path d={g.ma} fill="none" stroke="var(--ai)" strokeWidth="2" strokeOpacity="0.8" strokeLinecap="round" className={reduced ? "" : "zoom-line"} />
          {spots.map((s) => {
            const k = g.candles[s.j];
            if (!k) return null;
            const cy = Math.max(14, k.wickTop - 16);
            const col = TONE[s.tone];
            return (
              <g key={s.i} role="button" tabIndex={0} aria-label={`${s.n}: ${s.title}. Zoom in.`} onClick={() => onSpot(s)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSpot(s))} className="cursor-pointer outline-none">
                {!reduced && <circle cx={k.cx} cy={cy} r="11" fill={col} className="zoom-ping" style={{ animationDelay: `${600 + s.n * 150}ms` }} />}
                <circle cx={k.cx} cy={cy} r="11" fill={col} stroke="var(--surface)" strokeWidth="2" className="zoom-pop" style={{ animationDelay: reduced ? "0ms" : `${500 + s.n * 120}ms` }} />
                <text x={k.cx} y={cy + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--bg)" className="zoom-pop pointer-events-none" style={{ animationDelay: reduced ? "0ms" : `${500 + s.n * 120}ms` }}>{s.n}</text>
                <line x1={k.cx} x2={k.cx} y1={cy + 11} y2={k.wickTop - 2} stroke={col} strokeWidth="1.5" strokeDasharray="2 2" />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
