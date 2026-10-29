// The Stocks page's big chart ("the big board", components/bigboard.jsx): every name's indexed daily closes re-based to
// percent change from the start of a range, the lines to light up, stable colour slots, the nearest day to a pointer and
// a smooth path. Pure functions, no React; tested in bigboard.test.js. Percent only: the published series are indexed
// closes (100 = the start of the year), never prices.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Trading days back from the last close for each range chip (a year of closes is about 252; the data keeps 260). */
export const RANGES = { "1M": 21, "3M": 63, "6M": 126, "1Y": 259 };
export const RANGE_KEYS = Object.keys(RANGES);
export const DEFAULT_RANGE = "3M";

/**
 * Every line on one shared run of dates, as percent change from the first close in the range.
 * rows: [{symbol, name, series: [{date, v}], bench?}]. The dates are the reference series' (the benchmark's when it has
 * one, else the longest), its last `days + 1` closes. A line missing a date gets null there; a line whose first close in
 * the range is missing is re-based to its first close inside the range. Lines with fewer than two closes are dropped.
 * Returns {dates, lines: [{symbol, name, bench, values, last}]} or null when there is nothing to draw.
 */
export function boardData(rows, days = RANGES[DEFAULT_RANGE]) {
  const usable = (rows ?? []).filter((r) => Array.isArray(r?.series) && r.series.length > 1);
  if (!usable.length) return null;
  const ref = usable.find((r) => r.bench) ?? usable.reduce((a, b) => (b.series.length > a.series.length ? b : a));
  const dates = ref.series.map((p) => p.date).slice(-(Math.max(1, days) + 1));
  if (dates.length < 2) return null;
  const lines = usable.map((r) => {
    const at = new Map(r.series.map((p) => [p.date, p.v]));
    const raw = dates.map((d) => (isNum(at.get(d)) ? at.get(d) : null));
    const base = raw.find((v) => v != null && v > 0);
    if (base == null) return null;
    const values = raw.map((v) => (v == null ? null : (v / base - 1) * 100));
    const known = values.filter((v) => v != null);
    if (known.length < 2) return null;
    return { symbol: r.symbol, name: r.name ?? r.symbol, bench: Boolean(r.bench), values, last: lastKnown(values) };
  }).filter(Boolean);
  return lines.length ? { dates, lines } : null;
}

/** The last value that is not null (the line's change over the range). */
export function lastKnown(values) {
  for (let i = values.length - 1; i >= 0; i--) if (isNum(values[i])) return values[i];
  return null;
}

/** The lines lit by default: the `top` best and `bottom` worst over the range (the benchmark is always drawn apart). */
export function pickHighlights(lines, top = 3, bottom = 2) {
  const ranked = (lines ?? []).filter((l) => !l.bench && isNum(l.last)).sort((a, b) => b.last - a.last || a.symbol.localeCompare(b.symbol));
  const best = ranked.slice(0, top).map((l) => l.symbol);
  const worst = ranked.slice(Math.max(top, ranked.length - bottom)).map((l) => l.symbol);
  return [...best, ...worst];
}

/**
 * A colour slot (0..slots-1) for each lit line. Lines lit before keep their slot (colour follows the line, not its
 * rank); a newly lit line takes the lowest free slot. Lines beyond `slots` are left out (the caller keeps at most that).
 */
export function assignSlots(prev = {}, lit = [], slots = 8) {
  const out = {};
  const taken = new Set();
  for (const s of lit) {
    const k = prev[s];
    if (Number.isInteger(k) && k >= 0 && k < slots && !taken.has(k)) { out[s] = k; taken.add(k); }
  }
  for (const s of lit) {
    if (s in out) continue;
    let k = 0;
    while (taken.has(k) && k < slots) k++;
    if (k >= slots) continue;
    out[s] = k;
    taken.add(k);
  }
  return out;
}

/**
 * Light or unlight a line. At most `max` lines stay lit: lighting one more drops the one lit longest ago.
 */
export function toggleLit(lit = [], symbol, max = 8) {
  if (lit.includes(symbol)) return lit.filter((s) => s !== symbol);
  const next = [...lit, symbol];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The index of the date nearest to a pointer at `x`, for points spread evenly from x0 to x1. */
export function nearestIndex(x, x0, x1, n) {
  if (n <= 1 || x1 <= x0) return 0;
  const i = Math.round(((x - x0) / (x1 - x0)) * (n - 1));
  return Math.max(0, Math.min(n - 1, i));
}

/** The lowest and highest value over the lines (always including 0, so the baseline shows). */
export function extent(lines) {
  let lo = 0, hi = 0;
  for (const l of lines ?? []) for (const v of l.values) if (isNum(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

/**
 * A smooth SVG path through points [[x, y] | null] (null breaks the line): monotone cubic between points, so the curve
 * never overshoots a high or a low that was not in the data.
 */
export function smoothPath(points) {
  const runs = [];
  let cur = [];
  for (const p of points) {
    if (p && isNum(p[0]) && isNum(p[1])) cur.push(p);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs.map(monotone).join("");
}

const f = (v) => Math.round(v * 10) / 10;

function monotone(pts) {
  const n = pts.length;
  if (n === 1) return `M${f(pts[0][0])},${f(pts[0][1])}`;
  if (n === 2) return `M${f(pts[0][0])},${f(pts[0][1])}L${f(pts[1][0])},${f(pts[1][1])}`;
  const dx = [], s = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    s[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0;
  }
  // Fritsch-Carlson tangents.
  const m = [s[0]];
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  m[n - 1] = s[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / s[i], b = m[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * s[i]; m[i + 1] = t * b * s[i]; }
  }
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += `C${f(x0 + h)},${f(y0 + m[i] * h)},${f(x1 - h)},${f(y1 - m[i + 1] * h)},${f(x1)},${f(y1)}`;
  }
  return d;
}
