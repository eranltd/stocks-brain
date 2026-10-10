// Geometry and wording for the candles chart (components/candles.jsx). Pure functions, tested in candles.test.js.
// Every price-like number here is percent from the last close (the last close is 0) and volume is a ratio to its own
// 20-period average, as published in data/market/candles/<SYMBOL>.json. Nothing in this file turns them back into prices.

import { fmtPct } from "./format.js";

/** The three windows: 3 months of days (the default), 6 months of days, about a year of weeks. */
export const RANGES = [
  { value: "3m", label: "3M", series: "daily", n: 63 },
  { value: "6m", label: "6M", series: "daily", n: 130 },
  { value: "w", label: "Weekly", series: "weekly", n: 52 },
];
export const RANGE_VALUES = RANGES.map((r) => r.value);

/** The overlays a reader can toggle, each tied to its checklist step. Order is the legend order. */
export const OVERLAYS = [
  { id: "volume", step: "volume", label: "Volume vs average" },
  { id: "ma20", step: "ma20", label: "20-day average" },
  { id: "gaps", step: "gaps", label: "Open gaps" },
  { id: "levels", step: "levels", label: "Support and resistance" },
  { id: "rsi", step: "rsi", label: "RSI" },
  { id: "risk", step: "risk_plan", label: "Risk plan" },
];
export const ALL_ON = Object.fromEntries(OVERLAYS.map((o) => [o.id, true]));

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const KEYS = ["dates", "o", "h", "l", "c", "vol_rel", "ma20", "rsi"];

/** The move from one close to the next, in percent, from two closes given as percent from the last close. */
export function moveBetween(prev, cur) {
  if (!isNum(prev) || !isNum(cur) || prev <= -100) return null;
  return ((100 + cur) / (100 + prev) - 1) * 100;
}

/**
 * The visible slice of a candles doc for a range: the series arrays cut to the window, plus each candle's move from
 * the close before it (computed on the full series, so the first visible candle still has one).
 */
export function windowOf(doc, range) {
  const r = RANGES.find((x) => x.value === range) ?? RANGES[0];
  const s = doc?.[r.series];
  if (!s?.dates?.length) return null;
  const all = s.c.map((c, i) => (i ? moveBetween(s.c[i - 1], c) : null));
  const from = Math.max(0, s.dates.length - r.n);
  const out = { range: r.value, series: r.series, weekly: r.series === "weekly", partial: r.series === "weekly" && Boolean(s.partial), from, n: s.dates.length - from };
  for (const k of KEYS) out[k] = (s[k] ?? []).slice(from);
  out.move = all.slice(from);
  return out;
}

/** A linear scale from [d0, d1] to [r0, r1]. */
export function scaleLinear(d0, d1, r0, r1) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

/** A "nice" step (1, 2, 2.5 or 5 times a power of ten) that cuts a span into about n parts. */
export function niceStep(span, n = 4) {
  const raw = Math.abs(span) / Math.max(1, n) || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw - 1e-12) ?? 10 * mag;
}

/** Round ticks inside [lo, hi]; 0 is always one of them when it is in range (it is a multiple of every step). */
export function niceTicks(lo, hi, n = 4) {
  const step = niceStep(hi - lo, n);
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6));
  return { step, ticks: out };
}

/** "+5%", "0%", "−10%", "+2.5%": a tick label with as many decimals as the step needs. */
export function tickLabel(v, step = 1) {
  const d = Number.isInteger(step) ? 0 : Number.isInteger(+(step * 10).toFixed(6)) ? 1 : 2;
  return v === 0 ? "0%" : fmtPct(v, d);
}

/**
 * The y domain of the price panel. The candles (and 0, the last close) always fit. Each overlay value is drawn in
 * place when it lies within `grow` times the candles' own span beyond them; one further out would squash the candles,
 * so it stays off the chart and is listed in `off`, to be shown as an arrow at the edge.
 */
export function fitDomain(win, extras = [], { grow = 0.6, pad = 0.06 } = {}) {
  let lo = Math.min(0, ...win.l.filter(isNum)), hi = Math.max(0, ...win.h.filter(isNum));
  const span0 = hi - lo || 1;
  const minV = lo - grow * span0, maxV = hi + grow * span0;
  const off = [];
  for (const v of extras) {
    if (!isNum(v)) continue;
    if (v < minV || v > maxV) off.push(v);
    else { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  const span = hi - lo || 1;
  return { lo: lo - span * pad, hi: hi + span * pad, off };
}

/**
 * The horizontal lines and bands each overlay adds, from the doc's overlays (that day's checklist numbers). A target
 * set at a resistance is one line, not two: it is drawn as the target and named "at resistance".
 */
export function overlayLines(ov, on = ALL_ON) {
  const lines = [], bands = [];
  if (!ov) return { lines, bands };
  const touch = (t) => `${t} ${t === 1 ? "touch" : "touches"}`;
  const same = (a, b) => isNum(a) && isNum(b) && Math.abs(a - b) < 0.05;
  const merged = new Set();
  if (on.risk) {
    // The stop is named first: when it sits close to the last close (a tight stop on a long window) the "Last close" name
    // is the one dropped, since the 0% tick already marks that line.
    lines.push({ id: "close", kind: "close", v: 0, name: "Last close = entry", tag: "0%", prio: 1 });
    if (isNum(ov.stop_pct)) lines.push({ id: "stop", kind: "stop", v: -ov.stop_pct, name: "Stop", tag: fmtPct(-ov.stop_pct, 1), prio: 0 });
    [["tp1", ov.tp1_pct, 2], ["tp2", ov.tp2_pct, 3]].forEach(([id, v, prio]) => {
      if (!isNum(v)) return;
      const k = on.levels ? (ov.resistance ?? []).findIndex((r) => !merged.has(r) && same(r.pct, v)) : -1;
      const r = k >= 0 ? ov.resistance[k] : null;
      if (r) merged.add(r);
      lines.push({ id, kind: "tp", v, name: `${id.toUpperCase()}${r ? ` at resistance · ${touch(r.touches)}` : ""}`, tag: fmtPct(v, 1), prio });
    });
  }
  if (on.levels) {
    (ov.support ?? []).forEach((s, i) => lines.push({ id: `s${i}`, kind: "level", v: s.pct, touches: s.touches, name: `Support · ${touch(s.touches)}`, tag: fmtPct(s.pct, 1), prio: 4 + i * 2 }));
    (ov.resistance ?? []).forEach((r, i) => !merged.has(r) && lines.push({ id: `r${i}`, kind: "level", v: r.pct, touches: r.touches, name: `Resistance · ${touch(r.touches)}`, tag: fmtPct(r.pct, 1), prio: 5 + i * 2 }));
  }
  if (on.gaps) (ov.gaps ?? []).forEach((g, i) => bands.push({ id: `g${i}`, from: g.from_pct, to: g.to_pct, where: g.where, since: g.since_date }));
  return { lines, bands };
}

/** Line weight for a support or resistance line: more touches, a heavier line. */
export const levelWeight = (touches) => (touches >= 3 ? 2 : touches === 2 ? 1.5 : 1);

/**
 * Horizontal layout of n candles between x0 and x1: one band per candle, the body narrower than the band so neighbours
 * keep a gap, capped so a few candles on a wide screen do not turn into blocks. Bodies are odd whole pixels.
 */
export function bands(n, x0, x1, { maxBody = 11 } = {}) {
  const band = (x1 - x0) / Math.max(1, n);
  let body = band >= 6 ? Math.min(maxBody, Math.max(3, Math.round(band * 0.66))) : Math.max(1, Math.floor(band - 1));
  if (body % 2 === 0) body -= 1; // odd widths centre on a 1px wick
  return { band, body, cx: (i) => x0 + (i + 0.5) * band };
}

/** The candle at index i: body and wick in pixels, whether it closed up, and whether it can be drawn hollow. */
export function candleGeom(win, i, y, layout) {
  const o = win.o[i], c = win.c[i], h = win.h[i], l = win.l[i];
  const up = c >= o;
  const top = y(Math.max(o, c)), bot = y(Math.min(o, c));
  const thin = bot - top < 1; // a doji: draw a 1px body centred on its open and close
  const cx = layout.cx(i);
  return {
    i, up, cx,
    x: cx - layout.body / 2, w: layout.body,
    y: thin ? (top + bot) / 2 - 0.5 : top, h: thin ? 1 : bot - top,
    wickTop: y(h), wickBot: y(l),
    // Up candles are drawn hollow so direction does not rest on colour alone; that needs a body at least 3px wide.
    hollow: up && layout.body >= 3,
  };
}

/** Index of the candle under a pixel x, clamped to the window. */
export function indexAt(px, x0, band, n) {
  if (!n) return null;
  return Math.max(0, Math.min(n - 1, Math.floor((px - x0) / band)));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Month labels for the x axis: the first candle of each new month, thinned so neighbours stay `minGap` pixels apart.
 * A January label carries its year ("Jan ’26"), so a year of weeks reads unambiguously.
 */
export function monthTicks(dates, cx, minGap = 34) {
  const out = [];
  let last = -Infinity;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].slice(0, 7) === dates[i - 1].slice(0, 7)) continue;
    const x = cx(i);
    if (x - last < minGap) continue;
    const m = Number(dates[i].slice(5, 7)) - 1;
    out.push({ i, x, label: m === 0 ? `Jan ’${dates[i].slice(2, 4)}` : MONTHS[m] });
    last = x;
  }
  return out;
}

/** An SVG path through the values, broken at nulls (warm-up periods are gaps, never zeros). */
export function linePath(values, x, y) {
  let d = "", pen = false;
  values.forEach((v, i) => {
    if (!isNum(v)) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/**
 * Spread labels vertically so none sits closer than `gap` pixels to the next, within [top, bottom]. Each item keeps its
 * own `y` and gets a `ty` (where its text goes); a label that moved is drawn with a short leader to its line.
 */
export function spreadLabels(items, gap, top, bottom) {
  const s = [...items].sort((a, b) => a.y - b.y).map((it) => ({ ...it, ty: Math.max(top, Math.min(bottom, it.y)) }));
  for (let k = 1; k < s.length; k++) if (s[k].ty - s[k - 1].ty < gap) s[k].ty = s[k - 1].ty + gap;
  const over = s.length ? s.at(-1).ty - bottom : 0;
  if (over > 0) {
    s[s.length - 1].ty -= over;
    for (let k = s.length - 2; k >= 0; k--) if (s[k + 1].ty - s[k].ty < gap) s[k].ty = s[k + 1].ty - gap;
  }
  return s;
}

/** Keep the highest-priority labels (lowest `prio`) that do not collide; the rest are dropped, not stacked. */
export function keepClear(items, gap) {
  const kept = [];
  for (const it of [...items].sort((a, b) => a.prio - b.prio)) if (kept.every((k) => Math.abs(k.y - it.y) >= gap)) kept.push(it);
  return kept;
}

/** Top of the relative-volume panel: at least 2× (so the 1× line sits mid-panel), at most 4×; taller bars are clipped. */
export function volTop(vols) {
  const m = Math.max(0, ...vols.filter(isNum));
  return Math.min(4, Math.max(2, Math.ceil(m * 2) / 2));
}

/** "0.84× its 20-day average" (or "20-week" for weeks); null during warm-up. */
export function volWords(v, weekly = false) {
  return isNum(v) ? `${v.toFixed(2)}× its 20-${weekly ? "week" : "day"} average` : null;
}

/** The tooltip's rows for candle i: values lead, all percent from the last close. */
export function tipRows(win, i) {
  const f = (v) => (isNum(v) ? (Math.abs(v) < 0.005 ? "0.00%" : fmtPct(v, 2)) : "–");
  const mv = win.move[i];
  return {
    date: win.dates[i],
    partial: win.partial && i === win.n - 1,
    ohlc: [["Open", f(win.o[i])], ["High", f(win.h[i])], ["Low", f(win.l[i])], ["Close", f(win.c[i])]],
    move: isNum(mv) ? { text: fmtPct(mv, 1), tone: Math.abs(mv) < 0.05 ? "flat" : mv > 0 ? "accent" : "down" } : null,
    moveLabel: win.weekly ? "Week's move" : "Day's move",
    vol: isNum(win.vol_rel[i]) ? `${win.vol_rel[i].toFixed(2)}×` : null,
    volLabel: win.weekly ? "Volume vs 20-week avg" : "Volume vs 20-day avg",
    rsi: isNum(win.rsi[i]) ? win.rsi[i].toFixed(1) : null,
  };
}

/** One sentence for screen readers: what the chart shows, ending on the latest candle. */
export function chartSummary(symbol, win) {
  if (!win) return "";
  const lo = Math.min(...win.l.filter(isNum)), hi = Math.max(...win.h.filter(isNum));
  const what = win.weekly ? `${win.n} weekly candles` : `${win.n} daily candles`;
  return `${symbol}: ${what} as percent from the last close, from ${win.dates[0]} to ${win.dates.at(-1)}. Range ${fmtPct(lo, 1)} to ${fmtPct(hi, 1)}. Use the left and right arrow keys to read each candle.`;
}
