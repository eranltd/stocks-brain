import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { topSpots, spotCaveat } from "../lib/spots.js";
import { SpotList, SPOT_TONE } from "./zoom.jsx";
import { loadMarketCandles } from "../lib/data.js";
import { useReducedMotion } from "../lib/motion.js";
import {
  ALL_ON, bands, candleGeom, chartSummary, fitDomain, indexAt, keepClear, levelWeight, linePath, monthTicks, niceTicks, OVERLAYS,
  overlayLabel, overlayLines, RANGES, RANGE_VALUES, rangeLabel, scaleLinear, spreadLabels, tickLabel, tipRows, volTop, windowOf,
} from "../lib/candles.js";
import { patternName, stepLabel } from "../lib/checklist.js";
import { isolate } from "../lib/i18n.js";
import { useLang } from "../lib/lang.jsx";
import dict from "../i18n/stock.js";
import { Segmented } from "./ui.jsx";

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

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3, strokeLinejoin: "round" };
const LINE_COLOR = { stop: "var(--down)", tp: "var(--accent)", close: "var(--ink-2)", level: "var(--ink-2)" };
const LEAN_GLYPH = { bullish: "▲", bearish: "▼", neutral: "◆" };

/** The swatch beside each legend chip: it mirrors the mark on the chart. */
function Key({ id }) {
  const c = "var(--ink-2)";
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" className="shrink-0">
      {id === "ma20" && <path d="M1 10 C7 9, 10 4, 19 3" fill="none" stroke="var(--ai)" strokeWidth="2" strokeLinecap="round" />}
      {id === "levels" && <line x1="1" x2="19" y1="7" y2="7" stroke={c} strokeWidth="1.5" strokeDasharray="4 3" />}
      {id === "gaps" && <rect x="1" y="3" width="18" height="8" rx="1.5" fill="var(--people)" opacity="0.28" />}
      {id === "risk" && <><line x1="1" x2="19" y1="3" y2="3" stroke="var(--accent)" strokeWidth="1.5" /><line x1="1" x2="19" y1="7" y2="7" stroke={c} strokeWidth="1" /><line x1="1" x2="19" y1="11" y2="11" stroke="var(--down)" strokeWidth="1.5" /></>}
      {id === "rsi" && <><rect x="1" y="4" width="18" height="6" fill="var(--ink)" opacity="0.07" /><path d="M1 11 L6 6 L10 8 L14 3 L19 5" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></>}
      {id === "volume" && <><rect x="2" y="7" width="3" height="6" fill="var(--accent)" opacity="0.6" /><rect x="8" y="3" width="3" height="10" fill="var(--down)" opacity="0.6" /><rect x="14" y="6" width="3" height="7" fill="var(--accent)" opacity="0.6" /><line x1="0" x2="20" y1="7.5" y2="7.5" stroke={c} strokeWidth="1" /></>}
    </svg>
  );
}

/**
 * The checklist on candles: the symbol's indexed candles (percent from the last close), loaded the first time the view
 * opens, with the day's checklist numbers as toggleable overlays. Empty and error states are calm; nothing is fetched
 * from anywhere but the site's own data.
 */
export function CandlesView({ data, symbol, row, cfg }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
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
      <div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-line-2 px-5 py-8 text-center">
        <div className="max-w-[40ch]">
          {state.status === "loading" && <p className="text-[14px] text-ink-3" role="status">{t("cdv.loading")}</p>}
          {state.status === "none" && (
            <>
              <p className="text-[16px] text-ink">{t("cdv.none")}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{t("cdv.noneWhy")}</p>
            </>
          )}
          {state.status === "error" && (
            <>
              <p className="text-[15px] text-ink-2">{t("cdv.error")}</p>
              <button type="button" onClick={() => setAttempt((a) => a + 1)} className="pill mt-3 min-h-[40px] text-ink hover:border-ink-3">{t("cdv.retry")}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  const doc = state.doc;
  const win = windowOf(doc, range);
  const pattern = win?.weekly ? row?.candle?.weekly : row?.candle?.daily;
  const spots = win ? topSpots(win, 5, lang) : [];
  return (
    <div>
      <Segmented label={t("cdv.window")} value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: rangeLabel(r, lang) }))} />
      {doc.as_of !== row?.as_of && row?.as_of && (
        <p className="mt-3 text-[13px] text-people">{t("cdv.older", { candles: fmt.date(doc.as_of), checklist: fmt.date(row.as_of) })}</p>
      )}
      <div className="mt-4">
        {win ? <CandleChart key={range} win={win} doc={doc} on={on} pattern={pattern} symbol={symbol} rsiCfg={step("rsi").params} spots={spots} sel={sel} onSpot={pickSpot} /> : <p className="text-[14px] text-ink-3">{t("cdv.noWindow")}</p>}
      </div>

      {win && (
        <section className="mt-5">
          <h4 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{t("cdv.spots.title")}</h4>
          {spots.length ? <p className="mt-1 text-[14.5px] text-ink-2">{t("cdv.spots.lede")}</p>
            : <p className="mt-1 text-[15px] text-ink-2">{t("cdv.spots.none")}</p>}
          <SpotList spots={spots} focus={sel} onPick={pickSpot} reduced={false} />
          {spots.length > 0 && <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">{spotCaveat(lang)}</p>}
        </section>
      )}

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">{t("cdv.chips")}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {OVERLAYS.map((o) => {
          const s = step(o.step);
          const pressed = on[o.id];
          return (
            <button key={o.id} type="button" aria-pressed={pressed} onClick={() => toggle(o.id)}
              className={`flex min-h-[48px] min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-start transition duration-200 ${pressed ? "border-line-2 bg-surface-2" : "border-line opacity-55 hover:opacity-80"}`}>
              <Key id={o.id} />
              <span className="min-w-0">
                <span className="block text-[12.5px] leading-tight text-ink"><span className="num me-1 font-mono text-[11px] text-ink-3">{s.n}</span>{o.step === "risk_plan" ? overlayLabel(o, lang) : stepLabel(s, lang)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
        {t("cdv.footer")}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- the chart */

function CandleChart({ win, doc, on, pattern, symbol, rsiCfg, spots = [], sel = null, onSpot = () => {} }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  // Words drawn inside this left-to-right chart: in Hebrew each is isolated, so it reads right to left on its own.
  const say = (s) => (lang === "en" ? s : isolate(s));
  const box = useRef(null);
  const svg = useRef(null);
  const [W, setW] = useState(340);
  const [hi, setHi] = useState(null);
  // A focus ring for keyboard focus only: a tap focuses the chart too, and a ring there would be noise.
  const [kbd, setKbd] = useState(false);
  const byPointer = useRef(false);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (reduced) return setShown(true);
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [reduced]);
  useEffect(() => setHi(null), [win.range]);
  useEffect(() => { if (sel != null) setHi(sel); }, [sel]);

  const narrow = W < 560;
  const L = 2, R = narrow ? 46 : 56, T = 26;
  const PH = narrow ? 210 : 300;
  const GAP = 18; // room for each lower panel's label
  const RSI_H = on.rsi ? (narrow ? 56 : 72) : 0;
  const VOL_H = on.volume ? (narrow ? 44 : 60) : 0;
  const rsiTop = T + PH + GAP;
  const volTopY = rsiTop + (RSI_H ? RSI_H + GAP : 0);
  const plotBottom = volTopY + (VOL_H || -GAP);
  const H = plotBottom + 20;
  const x1 = W - R;

  const ov = doc.overlays;
  const { lines, bands: gapBands } = overlayLines(ov, on, lang);
  const extras = [...lines.map((l) => l.v), ...gapBands.flatMap((b) => [b.from, b.to]), ...(on.ma20 ? win.ma20 : [])];
  const dom = fitDomain(win, extras);
  const y = scaleLinear(dom.lo, dom.hi, T + PH, T);
  const lay = bands(win.n, L, x1);
  const { step, ticks } = niceTicks(dom.lo, dom.hi, narrow ? 4 : 6);
  const months = monthTicks(win.dates, lay.cx, narrow ? 34 : 44, lang);
  const inDom = (v) => v >= dom.lo && v <= dom.hi;

  // Value tags in the right gutter (lines in view, plus arrows for the ones off the chart) and names inside the plot.
  const shownLines = lines.filter((l) => inDom(l.v));
  const offLines = lines.filter((l) => !inDom(l.v));
  const tags = spreadLabels([
    ...shownLines.map((l) => ({ id: l.id, y: y(l.v), text: l.tag, kind: l.kind })),
    ...offLines.map((l) => ({ id: l.id, y: l.v > dom.hi ? T + 4 : T + PH - 4, text: `${l.v > dom.hi ? "↑" : "↓"}${l.tag}`, kind: l.kind, off: true })),
  ], 12, T + 4, T + PH - 2);
  const names = keepClear([
    ...shownLines.map((l) => ({ ...l, y: y(l.v) })),
    ...gapBands.filter((b) => inDom(b.to) || inDom(b.from)).map((b, k) => ({ id: b.id, y: (y(Math.min(dom.hi, b.to)) + y(Math.max(dom.lo, b.from))) / 2, name: say(t(b.where === "below" ? "cd.line.gapBelow" : "cd.line.gapAbove")), prio: 10 + k, kind: "gap" })),
  ], 12);
  const gridTicks = ticks.filter((t) => tags.every((g) => Math.abs(g.ty - y(t)) >= 11));

  const geoms = useMemo(() => win.c.map((_, i) => candleGeom(win, i, y, lay)), [win, dom.lo, dom.hi, W]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = geoms.at(-1);

  const yR = scaleLinear(0, 100, rsiTop + RSI_H, rsiTop);
  const ob = rsiCfg?.overbought ?? 70, os = rsiCfg?.oversold ?? 30;
  const vTop = volTop(win.vol_rel);
  const yV = scaleLinear(0, vTop, volTopY + VOL_H, volTopY);
  const xi = (i) => lay.cx(i);
  const sinceX = (d) => { const k = win.dates.findIndex((x) => x >= d); return k <= 0 ? L : lay.cx(k) - lay.band / 2; };

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
  const tip = hi != null ? tipRows(win, hi, lang) : null;
  const tipLeft = hi != null && xi(hi) > (L + x1) / 2;

  const lastRsi = [...win.rsi].reverse().find((v) => v != null);
  const lastVol = win.vol_rel.at(-1);
  const soFar = t("cdv.weekSoFar");
  const patternText = pattern
    ? `${LEAN_GLYPH[pattern.lean] ?? ""} ${say(win.partial ? t("cdv.weekPattern", { pattern: patternName(pattern.pattern, lang) }, { bidi: false }) : patternName(pattern.pattern, lang))}`
    : win.partial ? say(soFar) : null;

  return (
    <div ref={box} dir="ltr" className="relative select-none">
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full touch-pan-y" tabIndex={0}
        style={{ outline: kbd ? "2px solid var(--accent)" : "none", outlineOffset: 4, borderRadius: 8 }}
        onFocus={() => { if (!byPointer.current) setKbd(true); }}
        role="img" aria-label={chartSummary(symbol, win, lang)}
        onPointerDown={onDown} onPointerMove={onMove} onPointerLeave={(e) => e.pointerType === "mouse" && setHi(null)}
        onKeyDown={onKey} onBlur={() => { byPointer.current = false; setKbd(false); setHi(null); }}>
        <defs>
          <clipPath id="cd-price"><rect x={L} y={T} width={x1 - L} height={PH} /></clipPath>
        </defs>

        {/* price grid and the gutter's tick labels */}
        {ticks.map((t) => <line key={t} x1={L} x2={x1} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} stroke="var(--line)" />)}
        {gridTicks.map((t) => <text key={t} x={W - 2} y={y(t) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10.5px]">{tickLabel(t, step)}</text>)}

        <g clipPath="url(#cd-price)">
          {/* step 5: open gaps, shaded from the day that opened them */}
          {gapBands.map((b) => (
            <rect key={b.id} x={sinceX(b.since)} width={x1 - sinceX(b.since)} y={y(b.to)} height={Math.max(1, y(b.from) - y(b.to))} fill="var(--people)" opacity="0.16" />
          ))}
          {/* steps 6 and 8: levels dashed, the risk plan solid */}
          {shownLines.map((l) => (
            <line key={l.id} x1={L} x2={x1 + 4} y1={y(l.v)} y2={y(l.v)} stroke={LINE_COLOR[l.kind]}
              strokeWidth={l.kind === "level" ? levelWeight(l.touches) : l.kind === "close" ? 1 : 1.5}
              strokeDasharray={l.kind === "level" ? "5 4" : undefined} opacity={l.kind === "close" ? 0.7 : 1} />
          ))}

          {/* the candles: up hollow in the up colour, down filled in the down colour */}
          <g style={{ opacity: shown ? 1 : 0, transition: reduced ? "none" : "opacity 500ms cubic-bezier(.16,1,.3,1)" }}>
            {geoms.map((g) => {
              const col = g.up ? "var(--accent)" : "var(--down)";
              const partial = win.partial && g.i === win.n - 1;
              const wx = Math.round(g.cx) + 0.5;
              const bx = Math.round(g.cx) - Math.floor(g.w / 2);
              return (
                <g key={g.i} opacity={hi != null && hi !== g.i ? 0.55 : 1}>
                  <line x1={wx} x2={wx} y1={g.wickTop} y2={g.wickBot} stroke={col} strokeWidth="1" />
                  {g.hollow || partial
                    ? <rect x={bx + 0.5} y={g.y + 0.5} width={Math.max(0.5, g.w - 1)} height={Math.max(0.5, g.h - 1)} fill="var(--surface)" stroke={col} strokeWidth="1" strokeDasharray={partial ? "2 1.5" : undefined} />
                    : <rect x={bx} y={g.y} width={g.w} height={g.h} fill={col} />}
                </g>
              );
            })}
          </g>

          {/* step 4: the 20-period average */}
          {on.ma20 && <path d={linePath(win.ma20, xi, y)} fill="none" stroke="var(--ai)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        </g>

        {/* names inside the plot (dropped, not stacked, when they would collide) */}
        {names.map((nm) => (
          <g key={nm.id}>
            {/* a surface plate breaks the line under the name (a glyph halo alone leaves the line showing between letters) */}
            <rect x={0} y={nm.y - 7} width={Math.ceil(nm.name.length * 5.3) + L + 7} height={14} rx={3} fill="var(--surface)" opacity="0.92" />
            <text x={L + 4} y={nm.y} dominantBaseline="central" className="fill-ink-2 text-[10.5px]">{nm.name}</text>
          </g>
        ))}
        {/* the numbered candles to notice (listed in simple words under the chart) */}
        {spots.map((sp) => {
          const g = geoms[sp.i];
          if (!g) return null;
          const cy = Math.max(10, g.wickTop - 13);
          const col = SPOT_TONE[sp.tone];
          const on1 = sel === sp.i;
          return (
            <g key={`spot${sp.i}`} className="cursor-pointer" role="button" aria-label={`${sp.n}: ${sp.title}`}
              onPointerDown={(e) => { e.stopPropagation(); onSpot(sp); }}>
              {!reduced && <circle cx={g.cx} cy={cy} r="9" fill={col} className="zoom-ping" style={{ animationDelay: `${400 + sp.n * 150}ms` }} />}
              <circle cx={g.cx} cy={cy} r={on1 ? 10.5 : 9} fill={col} stroke={on1 ? "var(--ink)" : "var(--surface)"} strokeWidth="2" className="zoom-pop" style={{ animationDelay: reduced ? "0ms" : `${300 + sp.n * 120}ms` }} />
              <text x={g.cx} y={cy + 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--bg)" className="zoom-pop pointer-events-none" style={{ animationDelay: reduced ? "0ms" : `${300 + sp.n * 120}ms` }}>{sp.n}</text>
            </g>
          );
        })}

        {/* value tags in the gutter, with a short leader when a tag had to move */}
        {tags.map((g) => (
          <g key={g.id}>
            {!g.off && Math.abs(g.ty - g.y) > 1.5 && <path d={`M${x1 + 4},${g.y} L${x1 + 7},${g.ty}`} stroke={LINE_COLOR[g.kind]} fill="none" />}
            <text x={W - 2} y={g.ty + 3.5} textAnchor="end" className="num fill-ink-2 font-mono text-[10.5px] font-medium">{g.text}</text>
          </g>
        ))}

        {/* step 1 on the latest candle: the checklist's pattern name */}
        {patternText && last && (
          <text x={Math.min(x1, last.cx + lay.body / 2 + 1)} y={14} textAnchor="end" className="fill-ink text-[11px] font-medium" style={HALO}>{patternText}</text>
        )}

        {/* step 7: RSI with the 70/30 band */}
        {on.rsi && (
          <g>
            <rect x={L} y={yR(ob)} width={x1 - L} height={yR(os) - yR(ob)} fill="var(--ink)" opacity="0.045" />
            {[ob, os].map((v) => (
              <g key={v}>
                <line x1={L} x2={x1} y1={Math.round(yR(v)) + 0.5} y2={Math.round(yR(v)) + 0.5} stroke="var(--line-2)" />
                <text x={W - 2} y={yR(v) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10.5px]">{v}</text>
              </g>
            ))}
            <line x1={L} x2={x1} y1={rsiTop + 0.5} y2={rsiTop + 0.5} stroke="var(--line)" />
            <path d={linePath(win.rsi, xi, yR)} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinejoin="round" />
            <text x={L} y={rsiTop - 5} className="fill-ink-3 text-[10.5px]">{say(t(win.weekly ? "cdv.rsiWeeks" : "cdv.rsiDays"))}{lastRsi != null ? ` · ${lastRsi.toFixed(1)}` : ""}</text>
          </g>
        )}

        {/* step 3: volume as a ratio to its 20-period average; 1× is average */}
        {on.volume && (
          <g>
            {geoms.map((g) => {
              const v = win.vol_rel[g.i];
              if (v == null) return null;
              const top = yV(Math.min(v, vTop));
              return <rect key={g.i} x={Math.round(g.cx) - Math.floor(g.w / 2)} y={top} width={g.w} height={Math.max(0.5, yV(0) - top)}
                fill={g.up ? "var(--accent)" : "var(--down)"} opacity={hi != null && hi !== g.i ? 0.3 : 0.6} />;
            })}
            <line x1={L} x2={x1} y1={Math.round(yV(1)) + 0.5} y2={Math.round(yV(1)) + 0.5} stroke="var(--ink-3)" />
            <line x1={L} x2={x1} y1={Math.round(yV(0)) + 0.5} y2={Math.round(yV(0)) + 0.5} stroke="var(--line-2)" />
            <text x={W - 2} y={yV(1) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10.5px]">1×</text>
            <text x={L} y={volTopY - 5} className="fill-ink-3 text-[10.5px]">{say(t(win.weekly ? "cdv.volWeeks" : "cdv.volDays"))}{lastVol != null ? ` · ${lastVol.toFixed(2)}×` : ""}</text>
          </g>
        )}

        {/* x axis: a few month labels */}
        <line x1={L} x2={x1} y1={plotBottom + 0.5} y2={plotBottom + 0.5} stroke="var(--line-2)" />
        {months.map((m) => <text key={m.i} x={m.x} y={H - 5} textAnchor="middle" className="fill-ink-3 font-mono text-[10.5px]">{m.label}</text>)}

        {/* crosshair */}
        {hi != null && <line x1={Math.round(xi(hi)) + 0.5} x2={Math.round(xi(hi)) + 0.5} y1={T - 4} y2={plotBottom} stroke="var(--ink-3)" strokeWidth="1" pointerEvents="none" />}
      </svg>

      {tip && (
        <div role="status" dir="auto" className="pointer-events-none absolute top-1 z-10 w-[176px] rounded-xl border border-line-2 bg-surface px-3 py-2 text-[12px] shadow-[0_20px_40px_-12px_rgb(0_0_0/0.45)]"
          style={tipLeft ? { left: 4 } : { right: R + 4 }}>
          <div className="meta mb-1 normal-case tracking-[0.04em]">{fmt.date(tip.date)}{tip.partial ? ` · ${soFar}` : ""}</div>
          <div className="text-[10.5px] text-ink-3">{t("cdv.tip.from")}</div>
          <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-3">
            {tip.ohlc.flatMap(([k, v]) => [<dt key={`k${k}`} className="text-ink-3">{k}</dt>, <dd key={`v${k}`} className="num text-end font-mono font-semibold text-ink">{v}</dd>])}
          </dl>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 border-t border-line pt-1.5">
            <dt className="text-ink-3">{tip.moveLabel}</dt>
            <dd className={`num text-end font-mono font-semibold ${tip.move ? { accent: "text-accent", down: "text-down", flat: "text-ink" }[tip.move.tone] : "text-ink-3"}`}>{tip.move?.text ?? "–"}</dd>
            <dt className="text-ink-3">{t("cdv.tip.volume")}</dt>
            <dd className="num text-end font-mono text-ink"><bdi>{tip.vol ? t("cdv.tip.avg", { x: tip.vol }) : "–"}</bdi></dd>
            <dt className="text-ink-3">RSI</dt>
            <dd className="num text-end font-mono text-ink">{tip.rsi ?? "–"}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

