import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { topSpots, SPOT_CAVEAT } from "../lib/spots.js";
import { SpotList, SPOT_TONE } from "./zoom.jsx";
import { loadMarketCandles } from "../lib/data.js";
import { useInView, useReducedMotion } from "../lib/motion.js";
import { advance } from "../lib/replay.js";
import { ALL_ON, bands, candleGeom, chartSummary, fitDomain, indexAt, keepClear, levelWeight, linePath, monthTicks, moveBetween, niceTicks, OVERLAYS, overlayLines, RANGES, RANGE_VALUES, scaleLinear, spreadLabels, tickLabel, volTop, windowOf } from "../lib/candles.js";
import dict from "../text/stock.js";
import { Segmented, Skeleton } from "./ui.jsx";
import { strings } from "../lib/text.js";
import { fmtDate, fmtPct } from "../lib/format.js";

/*
 * The candles chart on a Stock page: the name's real daily (or weekly) candles as percent from the last close, the day's
 * checklist numbers as toggleable overlays (dashed lines with a tag at the right edge), relative volume under the
 * candles, and a big readout above (the candle's move and its open / high / low / close against the close before).
 * On first view the last candles tick in one by one, like a live tape, then it stops; Replay plays that again. It is
 * end-of-day data only: nothing here streams, and nothing is ever a price.
 */

/* A per-device choice in localStorage. Storage can be missing or blocked (private mode): the control still works. */
export function useStoredChoice(key, initial, allowed) {
  const [v, setV] = useState(() => {
    try { const s = window.localStorage.getItem(key); return allowed.includes(s) ? s : initial; } catch { return initial; }
  });
  const set = useCallback((next) => {
    setV(next);
    try { window.localStorage.setItem(key, next); } catch { /* storage unavailable */ }
  }, [key]);
  return [v, set];
}

const OVERLAY_KEY = "sb:candles-off";
function readOff() {
  try { const a = JSON.parse(window.localStorage.getItem(OVERLAY_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3, strokeLinejoin: "round" };
const LINE_COLOR = { stop: "var(--down)", tp: "var(--up)", close: "var(--ink-2)", level: "var(--ink-3)" };
const LINE_DASH = { stop: "6 4", tp: "6 4", close: "2 3", level: "2 4" };
const LEAN_GLYPH = { bullish: "▲", bearish: "▼", neutral: "◆" };
const TONE_TEXT = { accent: "text-up", down: "text-down", flat: "text-ink" };
const tone = (v, d = 2) => (!isNum(v) || Math.abs(v) < 0.5 / 10 ** d ? "flat" : v > 0 ? "accent" : "down");
/** How many of the newest candles tick in on first view, and how long that takes. */
const TICK_N = 20;
const TICK_MS = 1700;

/** The swatch beside each overlay toggle: it mirrors the mark on the chart. */
function Key({ id }) {
  const c = "var(--ink-2)";
  return (
    <svg width="18" height="12" viewBox="0 0 20 14" aria-hidden="true" className="shrink-0">
      {id === "ma20" && <path d="M1 10 C7 9, 10 4, 19 3" fill="none" stroke="var(--ai)" strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round" />}
      {id === "levels" && <line x1="1" x2="19" y1="7" y2="7" stroke={c} strokeWidth="1.5" strokeDasharray="2 3" />}
      {id === "gaps" && <rect x="1" y="3" width="18" height="8" rx="1.5" fill="var(--people)" opacity="0.32" />}
      {id === "risk" && <><line x1="1" x2="19" y1="3" y2="3" stroke="var(--up)" strokeWidth="1.5" strokeDasharray="4 2" /><line x1="1" x2="19" y1="11" y2="11" stroke="var(--down)" strokeWidth="1.5" strokeDasharray="4 2" /></>}
      {id === "rsi" && <><rect x="1" y="4" width="18" height="6" fill="var(--ink)" opacity="0.08" /><path d="M1 11 L6 6 L10 8 L14 3 L19 5" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></>}
      {id === "volume" && <><rect x="2" y="7" width="3" height="6" fill="var(--up)" opacity="0.7" /><rect x="8" y="3" width="3" height="10" fill="var(--down)" opacity="0.7" /><rect x="14" y="6" width="3" height="7" fill="var(--up)" opacity="0.7" /></>}
    </svg>
  );
}

/**
 * The candles view: a window switch, the chart with its readout, the overlay toggles and the numbered candles to notice.
 * The candles file is loaded the first time the view opens; empty and error states are calm. `tools` sits beside the
 * window switch (the page's zoom button).
 */
export function CandlesView({ data, symbol, row, cfg, tools = null }) {
  const t = strings(dict);
  const [state, setState] = useState({ status: "loading", doc: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: "loading", doc: null });
    // The market the page's data belongs to (lib/markets.js marketData); the default market's own files otherwise.
    loadMarketCandles(data.manifest, data.marketId ?? "nasdaq", symbol).then(
      (doc) => live && setState({ status: doc ? "ok" : "none", doc }),
      () => live && setState({ status: "error", doc: null }),
    );
    return () => { live = false; };
  }, [data.manifest, data.marketId, symbol, attempt]);
  const [range, setRange] = useStoredChoice("sb:candles-range", "3m", RANGE_VALUES);
  const [off, setOff] = useState(readOff);
  const on = useMemo(() => Object.fromEntries(Object.keys(ALL_ON).map((k) => [k, !off.includes(k)])), [off]);
  const toggle = (id) => {
    const next = off.includes(id) ? off.filter((x) => x !== id) : [...off, id];
    setOff(next);
    try { window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const step = (id) => cfg?.steps?.find((s) => s.id === id) ?? { id, name: id };
  // The numbered "candle to notice" being pointed at (its index in the window), cleared when the window changes.
  const [sel, setSel] = useState(null);
  useEffect(() => setSel(null), [range, symbol]);
  const pickSpot = (sp) => setSel((cur) => (cur === sp.i ? null : sp.i));

  if (state.status !== "ok") {
    return (
      <div className="grid min-h-[300px] place-items-center rounded-tile border border-dashed border-line-2 px-5 py-8 text-center">
        {state.status === "loading" && (
          <div role="status" className="grid w-full gap-3">
            <span className="micro">{t("cdv.loading")}</span>
            <Skeleton className="h-[240px] w-full" />
          </div>
        )}
        {state.status === "none" && (
          <div className="max-w-[40ch]">
            <p className="headline text-[20px] text-ink">{t("cdv.none")}</p>
            <p className="mt-2 text-[13.5px] leading-snug text-ink-3">{t("cdv.noneWhy")}</p>
          </div>
        )}
        {state.status === "error" && (
          <div>
            <p className="text-[15px] text-ink-2">{t("cdv.error")}</p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="chip mt-3 min-h-[44px] border-line-2 px-4 text-ink hover:border-line-3">{t("cdv.retry")}</button>
          </div>
        )}
      </div>
    );
  }

  const doc = state.doc;
  const win = windowOf(doc, range);
  const pattern = win?.weekly ? row?.candle?.weekly : row?.candle?.daily;
  const spots = win ? topSpots(win, 5) : [];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label={t("cdv.window")} value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        {tools && <div className="flex items-center gap-2">{tools}</div>}
      </div>
      {doc.as_of !== row?.as_of && row?.as_of && (
        <p className="mt-3 text-[13px] text-wait">{t("cdv.older", { candles: fmtDate(doc.as_of), checklist: fmtDate(row.as_of) })}</p>
      )}
      <div className="mt-3">
        {win ? <CandleChart key={range} win={win} doc={doc} on={on} pattern={pattern} symbol={symbol} rsiCfg={step("rsi").params} spots={spots} sel={sel} onSpot={pickSpot} />
          : <p className="text-[14px] text-ink-3">{t("cdv.noWindow")}</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("cdv.toggles")}>
        {OVERLAYS.map((o) => {
          const s = step(o.step);
          const pressed = on[o.id];
          return (
            <button key={o.id} type="button" aria-pressed={pressed} onClick={() => toggle(o.id)} title={o.step === "risk_plan" ? o.label : s.name}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-chip border px-2.5 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors ${pressed ? "border-line-3 bg-surface-2 text-ink" : "border-line text-ink-3 hover:text-ink-2"}`}>
              <span className={pressed ? "" : "opacity-40"}><Key id={o.id} /></span>
              <span className="font-num text-[10px] text-ink-3">{s.n}</span>
              {t(`cdv.key.${o.id}`)}
            </button>
          );
        })}
      </div>

      {win && (
        <details className="group mt-3 rounded-tile border border-line">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="size-[6px] rotate-45 bg-desk" />
            <span className="font-display text-[14px] font-bold tracking-[0.12em] text-ink uppercase">{spots.length ? t("cdv.spots.summary", { count: spots.length }) : t("cdv.spots.title")}</span>
            <span aria-hidden="true" className="ms-auto text-ink-3 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="border-t border-line px-3 pb-3">
            {spots.length ? <p className="mt-2 text-[13px] text-ink-3">{t("cdv.spots.lede")}</p> : <p className="mt-2 text-[14px] text-ink-2">{t("cdv.spots.none")}</p>}
            <SpotList spots={spots} focus={sel} onPick={pickSpot} reduced={false} />
            {spots.length > 0 && <p className="mt-2 text-[12.5px] leading-snug text-ink-3">{SPOT_CAVEAT}</p>}
          </div>
        </details>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- the chart */

/**
 * One candle from candleGeom (lib/candles.js): up hollow in the up colour, down filled in the down colour, the week so
 * far (`partial`) dashed. Shared by the chart below, the replay (components/replay.jsx) and the Desk.
 */
export function CandleMark({ g, partial = false, opacity }) {
  const col = g.up ? "var(--accent)" : "var(--down)";
  const wx = Math.round(g.cx) + 0.5;
  const bx = Math.round(g.cx) - Math.floor(g.w / 2);
  return (
    <g opacity={opacity}>
      <line x1={wx} x2={wx} y1={g.wickTop} y2={g.wickBot} stroke={col} strokeWidth="1" />
      {g.hollow || partial
        ? <rect x={bx + 0.5} y={g.y + 0.5} width={Math.max(0.5, g.w - 1)} height={Math.max(0.5, g.h - 1)} fill="var(--surface)" stroke={col} strokeWidth="1" strokeDasharray={partial ? "2 1.5" : undefined} />
        : <rect x={bx} y={g.y} width={g.w} height={g.h} fill={col} />}
    </g>
  );
}

/**
 * The newest candles ticking in: a position from the first of the last TICK_N candles to the last, moved on by the
 * replay's own time-based step (lib/replay.js advance), so it runs at one pace at any frame rate. It starts once `start`
 * turns true; `replay()` plays it again. Under reduced motion the whole window shows and nothing moves.
 */
function useTickIn(n, { start, reduced }) {
  const last = Math.max(0, n - 1);
  const first = Math.max(0, n - TICK_N);
  const steps = last - first;
  const [pos, setPosState] = useState(reduced || !steps ? last : first);
  const posRef = useRef(pos);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const setPos = useCallback((v) => { posRef.current = v; setPosState(v); }, []);
  useEffect(() => {
    if (reduced) { setPlaying(false); setPos(last); return; }
    if (start && !started.current && steps) { started.current = true; setPos(first); setPlaying(true); }
  }, [start, reduced, first, last, steps, setPos]);
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0, prev = null;
    const tick = (now) => {
      const dt = prev == null ? 0 : now - prev;
      prev = now;
      const next = first + advance(posRef.current - first, dt, { n: steps + 1, totalMs: TICK_MS });
      setPos(next);
      if (next >= last - 1e-6) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, first, last, steps, setPos]);
  const replay = () => { if (reduced || !steps) return; started.current = true; setPos(first); setPlaying(true); };
  return { pos: Math.min(pos, last), playing, replay, can: !reduced && steps > 0, count: steps + 1 };
}

const ReplayIcon = () => (
  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3" /><path d="M3.2 2.5v2.8H6" />
  </svg>
);

function CandleChart({ win, doc, on, pattern, symbol, rsiCfg, spots = [], sel = null, onSpot = () => {} }) {
  const t = strings(dict);
  const box = useRef(null);
  const svg = useRef(null);
  const [W, setW] = useState(340);
  const [hi, setHi] = useState(null);
  // A focus ring for keyboard focus only: a tap focuses the chart too, and a ring there would be noise.
  const [kbd, setKbd] = useState(false);
  const byPointer = useRef(false);
  const reduced = useReducedMotion();
  const [seen, inView] = useInView({ threshold: 0.3 });
  const tick = useTickIn(win.n, { start: inView, reduced });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setHi(null), [win.range]);
  useEffect(() => { if (sel != null) setHi(sel); }, [sel]);

  const narrow = W < 560;
  const L = 2, R = narrow ? 50 : 60, T = 14;
  const PH = narrow ? 230 : 330;
  const GAP = 18; // room for each lower panel's label
  const RSI_H = on.rsi ? (narrow ? 52 : 66) : 0;
  const VOL_H = on.volume ? (narrow ? 46 : 62) : 0;
  const volTopY = T + PH + GAP;
  const rsiTop = volTopY + (VOL_H ? VOL_H + GAP : 0);
  const plotBottom = rsiTop + (RSI_H || -GAP);
  const H = plotBottom + 20;
  const x1 = W - R;

  const ov = doc.overlays;
  const { lines, bands: gapBands } = overlayLines(ov, on);
  const extras = [...lines.map((l) => l.v), ...gapBands.flatMap((b) => [b.from, b.to]), ...(on.ma20 ? win.ma20 : [])];
  const dom = fitDomain(win, extras);
  const y = scaleLinear(dom.lo, dom.hi, T + PH, T);
  const lay = bands(win.n, L, x1);
  const { step, ticks } = niceTicks(dom.lo, dom.hi, narrow ? 4 : 6);
  const months = monthTicks(win.dates, lay.cx, narrow ? 34 : 44);
  const inDom = (v) => v >= dom.lo && v <= dom.hi;

  // Value tags in the right gutter (lines in view, plus arrows for the ones off the chart) and names inside the plot.
  const shownLines = lines.filter((l) => inDom(l.v));
  const offLines = lines.filter((l) => !inDom(l.v));
  const tags = spreadLabels([
    ...shownLines.map((l) => ({ id: l.id, y: y(l.v), text: l.tag, kind: l.kind })),
    ...offLines.map((l) => ({ id: l.id, y: l.v > dom.hi ? T + 6 : T + PH - 6, text: `${l.v > dom.hi ? "↑" : "↓"}${l.tag}`, kind: l.kind, off: true })),
  ], 15, T + 6, T + PH - 4);
  const names = keepClear([
    ...shownLines.map((l) => ({ ...l, y: y(l.v) })),
    ...gapBands.filter((b) => inDom(b.to) || inDom(b.from)).map((b, k) => ({ id: b.id, y: (y(Math.min(dom.hi, b.to)) + y(Math.max(dom.lo, b.from))) / 2, name: t(b.where === "below" ? "cd.line.gapBelow" : "cd.line.gapAbove"), prio: 10 + k, kind: "gap" })),
  ], 13);
  const gridTicks = ticks.filter((v) => tags.every((g) => Math.abs(g.ty - y(v)) >= 12));

  const geoms = useMemo(() => win.c.map((_, i) => candleGeom(win, i, y, lay)), [win, dom.lo, dom.hi, W]); // eslint-disable-line react-hooks/exhaustive-deps
  // What the tick-in shows: whole candles up to k, the next one fading in.
  const k = Math.floor(tick.pos + 1e-9);
  const frac = tick.pos - k;
  const live = tick.playing || k < win.n - 1;
  const xi = (i) => lay.cx(i);
  const cut = (arr) => arr.slice(0, k + 1);

  const yR = scaleLinear(0, 100, rsiTop + RSI_H, rsiTop);
  const ob = rsiCfg?.overbought ?? 70, os = rsiCfg?.oversold ?? 30;
  const vTop = volTop(win.vol_rel);
  const yV = scaleLinear(0, vTop, volTopY + VOL_H, volTopY);
  const sinceX = (d) => { const j = win.dates.findIndex((x) => x >= d); return j <= 0 ? L : lay.cx(j) - lay.band / 2; };

  const pick = (e) => {
    const r = svg.current.getBoundingClientRect();
    return indexAt(((e.clientX - r.left) / r.width) * W, L, lay.band, win.n);
  };
  const onDown = (e) => {
    byPointer.current = true;
    setKbd(false);
    const i = pick(e);
    setHi((cur) => (e.pointerType !== "mouse" && cur === i ? null : i));
  };
  const onMove = (e) => { if (e.pointerType === "mouse" || e.buttons) setHi(pick(e)); };
  const onKey = (e) => {
    setKbd(true);
    const n = win.n;
    const at = hi ?? n - 1;
    const next = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: n - 1 }[e.key];
    if (e.key === "Escape") return setHi(null);
    if (next == null) return;
    e.preventDefault();
    setHi(Math.max(0, Math.min(n - 1, hi == null ? n - 1 : next)));
  };

  // The readout: the candle under the finger, else the newest one shown.
  const at = hi != null ? Math.min(hi, win.n - 1) : k;
  const prevC = at > 0 ? win.c[at - 1] : null;
  const rel = (v) => moveBetween(prevC, v);
  const mv = win.move[at];
  const ohlc = [["o", win.o[at]], ["h", win.h[at]], ["l", win.l[at]], ["c", win.c[at]]];
  const partialAt = win.partial && at === win.n - 1;
  const lastRsi = win.rsi[at];
  const lastVol = win.vol_rel[at];
  const soFar = t("cdv.weekSoFar");
  const patternText = pattern && !live
    ? `${LEAN_GLYPH[pattern.lean] ?? ""} ${win.partial ? t("cdv.weekPattern", { pattern: pattern.pattern }) : pattern.pattern}`
    : win.partial && !live ? soFar : null;
  const head = geoms[k];
  const nextG = frac > 0 && k + 1 < win.n ? geoms[k + 1] : null;
  const headTone = tone(win.move[k], 1);
  const maLast = [...cut(win.ma20)].reverse().find(isNum);

  return (
    <div ref={seen}>
      {/* the readout, like a trading terminal's: the move, then open / high / low / close against the close before */}
      <div role="status" aria-live={hi != null ? "polite" : "off"} className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="micro flex flex-wrap items-center gap-x-2">
            <span className="text-desk">{t(win.weekly ? "cdv.head.week" : "cdv.head.day")}</span>
            <span>{fmtDate(win.dates[at]).replace(/\s\d{4}$/, "")}{partialAt ? ` · ${soFar}` : ""}</span>
          </p>
          <p className={`font-num mt-1 text-[clamp(36px,9vw,52px)] leading-none font-bold tracking-[-0.04em] ${TONE_TEXT[tone(mv, 2)]}`}>
            {isNum(mv) ? fmtPct(mv, 2) : "–"}
          </p>
          <dl className="font-num mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px]">
            {ohlc.map(([key, v]) => {
              const r = rel(v);
              return (
                <div key={key} className="flex items-baseline gap-1">
                  <dt className="text-ink-3 uppercase">{t(`cdv.${key}`)}</dt>
                  <dd className={`font-semibold ${TONE_TEXT[tone(r, 2)]}`}>{isNum(r) ? fmtPct(r, 2) : "–"}</dd>
                </div>
              );
            })}
          </dl>
        </div>
        <div className="micro grid justify-items-end gap-1 text-end">
          {tick.can && (
            <button type="button" onClick={tick.replay} aria-label={t("cdv.replayAria", { n: tick.count })} className="-my-1.5 inline-flex min-h-[44px] items-center">
              <span className={`chip gap-1.5 border-line-2 bg-surface-2 ${live ? "border-desk/50 text-desk" : "text-ink-2 hover:text-ink"}`}>
                {live ? <span aria-hidden="true" className="size-1.5 rounded-full bg-desk shadow-[0_0_8px_var(--desk)] motion-safe:animate-[beacon_0.8s_ease-in-out_infinite]" /> : <ReplayIcon />}
                {t("cdv.replay")}
              </span>
            </button>
          )}
          <span>{t(win.weekly ? "cdv.head.vsWeek" : "cdv.head.vsDay")}</span>
          <span>{t("cdv.head.n", { count: win.n })}</span>
          {isNum(lastVol) && <span>{t("cdv.head.vol", { x: lastVol.toFixed(2) })}</span>}
          {isNum(lastRsi) && <span>{t("cdv.head.rsi", { v: lastRsi.toFixed(0) })}</span>}
        </div>
      </div>

      <div ref={box} className="relative mt-3 select-none">
        <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full touch-pan-y" tabIndex={0}
          style={{ outline: kbd ? "2px solid var(--ring)" : "none", outlineOffset: 4, borderRadius: 8 }}
          onFocus={() => { if (!byPointer.current) setKbd(true); }}
          role="img" aria-label={chartSummary(symbol, win)}
          onPointerDown={onDown} onPointerMove={onMove} onPointerLeave={(e) => e.pointerType === "mouse" && setHi(null)}
          onKeyDown={onKey} onBlur={() => { byPointer.current = false; setKbd(false); setHi(null); }}>
          <defs>
            <clipPath id="cd-price"><rect x={L} y={T} width={x1 - L} height={PH} /></clipPath>
          </defs>

          {/* price grid and the gutter's tick labels */}
          {ticks.map((v) => <line key={v} x1={L} x2={x1} y1={Math.round(y(v)) + 0.5} y2={Math.round(y(v)) + 0.5} stroke="var(--line)" />)}
          {gridTicks.map((v) => <text key={v} x={W - 4} y={y(v) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10.5px]">{tickLabel(v, step)}</text>)}

          <g clipPath="url(#cd-price)">
            {/* step 5: open gaps, shaded from the day that opened them */}
            {gapBands.map((b) => (
              <rect key={b.id} x={sinceX(b.since)} width={x1 - sinceX(b.since)} y={y(b.to)} height={Math.max(1, y(b.from) - y(b.to))} fill="var(--people)" opacity="0.14" />
            ))}
            {/* steps 6 and 8: levels dotted, the plan's stop and targets dashed */}
            {shownLines.map((l) => (
              <line key={l.id} x1={L} x2={x1} y1={y(l.v)} y2={y(l.v)} stroke={LINE_COLOR[l.kind]}
                strokeWidth={l.kind === "level" ? levelWeight(l.touches) : l.kind === "close" ? 1 : 1.25}
                strokeDasharray={LINE_DASH[l.kind]} opacity={l.kind === "close" ? 0.8 : 1} />
            ))}

            {/* the candles: up hollow in the up colour, down filled in the down colour */}
            {geoms.slice(0, k + 1).map((g) => (
              <CandleMark key={g.i} g={g} partial={win.partial && g.i === win.n - 1} opacity={hi != null && hi !== g.i ? 0.5 : 1} />
            ))}
            {nextG && <CandleMark g={nextG} partial={win.partial && nextG.i === win.n - 1} opacity={frac} />}

            {/* step 4: the 20-period average, dashed */}
            {on.ma20 && <path d={linePath(cut(win.ma20), xi, y)} fill="none" stroke="var(--ai)" strokeWidth="1.6" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />}
          </g>

          {/* the average's name at its newest point */}
          {on.ma20 && isNum(maLast) && inDom(maLast) && !live && (
            <text x={x1 - 4} y={y(maLast) - 6} textAnchor="end" className="fill-ai font-mono text-[10px] font-semibold" style={HALO}>{t("cdv.ma")}</text>
          )}

          {/* names inside the plot (dropped, not stacked, when they would collide) */}
          {names.map((nm) => (
            <g key={nm.id}>
              <rect x={0} y={nm.y - 7} width={Math.ceil(nm.name.length * 5.3) + L + 7} height={14} rx={3} fill="var(--surface)" opacity="0.9" />
              <text x={L + 4} y={nm.y} dominantBaseline="central" className="fill-ink-2 text-[10.5px]">{nm.name}</text>
            </g>
          ))}
          {/* the numbered candles to notice (listed under the chart) */}
          {!live && spots.map((sp) => {
            const g = geoms[sp.i];
            if (!g) return null;
            const cy = Math.max(10, g.wickTop - 13);
            const col = SPOT_TONE[sp.tone];
            const on1 = sel === sp.i;
            return (
              <g key={`spot${sp.i}`} className="cursor-pointer" role="button" aria-label={`${sp.n}: ${sp.title}`}
                onPointerDown={(e) => { e.stopPropagation(); onSpot(sp); }}>
                {!reduced && <circle cx={g.cx} cy={cy} r="8" fill={col} className="zoom-ping" style={{ animationDelay: `${400 + sp.n * 150}ms` }} />}
                <circle cx={g.cx} cy={cy} r={on1 ? 9.5 : 8} fill={col} stroke={on1 ? "var(--ink)" : "var(--surface)"} strokeWidth="2" className="zoom-pop" style={{ animationDelay: reduced ? "0ms" : `${200 + sp.n * 100}ms` }} />
                <text x={g.cx} y={cy + 3.8} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--bg)" className="zoom-pop pointer-events-none font-mono" style={{ animationDelay: reduced ? "0ms" : `${200 + sp.n * 100}ms` }}>{sp.n}</text>
              </g>
            );
          })}

          {/* value tags in the right gutter: a small box at the right edge of each dashed line */}
          {tags.map((g) => {
            const w = Math.min(R - 4, Math.ceil(g.text.length * 6.2) + 8);
            const col = LINE_COLOR[g.kind];
            const strong = g.kind === "stop" || g.kind === "tp";
            return (
              <g key={g.id}>
                {!g.off && Math.abs(g.ty - g.y) > 1.5 && <path d={`M${x1},${g.y} L${x1 + 4},${g.ty}`} stroke={col} fill="none" />}
                <rect x={W - w - 1} y={g.ty - 7} width={w} height={14} rx={3} fill="var(--surface-2)" stroke={col} strokeOpacity={strong ? 0.9 : 0.45} />
                <text x={W - 5} y={g.ty + 3.5} textAnchor="end" className="num font-mono text-[10px] font-semibold" fill={strong ? col : "var(--ink-2)"}>{g.text}</text>
              </g>
            );
          })}

          {/* the newest candle's close, while the tape ticks in: a dashed line and a filled tag at the right edge */}
          {live && head && (
            <g pointerEvents="none">
              <line x1={head.cx + 4} x2={x1} y1={y(win.c[k])} y2={y(win.c[k])} stroke={headTone === "down" ? "var(--down)" : "var(--up)"} strokeDasharray="2 3" />
              <rect x={W - R + 2} y={y(win.c[k]) - 8} width={R - 3} height={16} rx={3} fill={headTone === "down" ? "var(--down)" : "var(--up)"} />
              <text x={W - 5} y={y(win.c[k]) + 3.6} textAnchor="end" className="num font-mono text-[10px] font-bold" fill="var(--bg)">{fmtPct(win.c[k], 1)}</text>
            </g>
          )}

          {/* step 1 on the latest candle: the checklist's pattern name */}
          {patternText && geoms.at(-1) && (
            <text x={Math.min(x1, geoms.at(-1).cx + lay.body / 2 + 1)} y={T - 2} textAnchor="end" className="fill-ink text-[11px] font-medium" style={HALO}>{patternText}</text>
          )}

          {/* step 3: volume as a ratio to its 20-period average under the candles; 1× is average */}
          {on.volume && (
            <g>
              <line x1={L} x2={x1} y1={volTopY - 0.5} y2={volTopY - 0.5} stroke="var(--line)" />
              {geoms.slice(0, k + (nextG ? 2 : 1)).map((g) => {
                const v = win.vol_rel[g.i];
                if (v == null) return null;
                const top = yV(Math.min(v, vTop));
                const fade = g.i === k + 1 ? frac : 1;
                return <rect key={g.i} x={Math.round(g.cx) - Math.floor(g.w / 2)} y={top} width={g.w} height={Math.max(0.5, yV(0) - top)}
                  fill={g.up ? "var(--up)" : "var(--down)"} opacity={(hi != null && hi !== g.i ? 0.25 : 0.55) * fade} />;
              })}
              <line x1={L} x2={x1} y1={Math.round(yV(1)) + 0.5} y2={Math.round(yV(1)) + 0.5} stroke="var(--ink-3)" strokeDasharray="2 3" />
              <line x1={L} x2={x1} y1={Math.round(yV(0)) + 0.5} y2={Math.round(yV(0)) + 0.5} stroke="var(--line-2)" />
              <text x={W - 4} y={yV(1) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10px]">1×</text>
              <text x={L} y={volTopY - 5} className="fill-ink-3 font-mono text-[10px] tracking-[0.08em] uppercase">{t(win.weekly ? "cdv.volWeeks" : "cdv.volDays")}</text>
            </g>
          )}

          {/* step 7: RSI with the 70/30 band */}
          {on.rsi && (
            <g>
              <rect x={L} y={yR(ob)} width={x1 - L} height={yR(os) - yR(ob)} fill="var(--ink)" opacity="0.045" />
              {[ob, os].map((v) => (
                <g key={v}>
                  <line x1={L} x2={x1} y1={Math.round(yR(v)) + 0.5} y2={Math.round(yR(v)) + 0.5} stroke="var(--line-2)" />
                  <text x={W - 4} y={yR(v) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10px]">{v}</text>
                </g>
              ))}
              <line x1={L} x2={x1} y1={rsiTop + 0.5} y2={rsiTop + 0.5} stroke="var(--line)" />
              <path d={linePath(cut(win.rsi), xi, yR)} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinejoin="round" />
              <text x={L} y={rsiTop - 5} className="fill-ink-3 font-mono text-[10px] tracking-[0.08em] uppercase">{t(win.weekly ? "cdv.rsiWeeks" : "cdv.rsiDays")}</text>
            </g>
          )}

          {/* x axis: a few month labels */}
          <line x1={L} x2={x1} y1={plotBottom + 0.5} y2={plotBottom + 0.5} stroke="var(--line-2)" />
          {months.map((m) => <text key={m.i} x={m.x} y={H - 5} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">{m.label}</text>)}

          {/* crosshair */}
          {hi != null && <line x1={Math.round(xi(hi)) + 0.5} x2={Math.round(xi(hi)) + 0.5} y1={T - 4} y2={plotBottom} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none" />}
        </svg>
      </div>
    </div>
  );
}
