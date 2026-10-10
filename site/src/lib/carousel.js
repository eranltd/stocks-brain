// The "Top stocks" carousel on the simple home: which names, the mini candle chart's window and geometry, and where the
// dots stand. Pure functions, no React; tested in carousel.test.js. Like candles.js, every price-like number here is
// percent from the last close, and the mini chart draws no numbers at all.

import { plainSummary } from "./brief.js";
import { bands, candleGeom, fitDomain, linePath, scaleLinear } from "./candles.js";
import { companiesToKnow } from "./simple.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** How many names the carousel shows at most, and how many daily candles make "the last month". */
export const TOP_MAX = 8;
export const MINI_DAYS = 22;

/**
 * The carousel's names: the same order as "Companies to know" (held on paper, then the brain's picks, then the day's
 * movers), carried on with more movers up to `max`. Each is a companiesToKnow item plus `plain` falling back to the
 * checklist's own summary in everyday words, `hasChart` (a candle file is published) and `candlesTo`, the Stock page's
 * checklist card (opened on its Candles view by the caller).
 */
export function topStocks({ max = TOP_MAX, candles = {}, ...args }) {
  const rows = Object.fromEntries((args.checklist?.symbols ?? []).map((s) => [s.symbol, s]));
  return companiesToKnow({ ...args, min: max, max }).map((c) => {
    const summary = rows[c.ticker]?.score?.summary;
    return {
      ...c,
      plain: c.plain ?? (summary ? plainSummary(summary) : null),
      hasChart: Boolean(candles?.[c.ticker]),
      candlesTo: `stock/${c.ticker}#checklist`,
    };
  });
}

/** The last `n` daily candles of a candles doc (data/market/candles/<SYMBOL>.json), or null without daily data. */
export function miniWindow(doc, n = MINI_DAYS) {
  const s = doc?.daily;
  if (!s?.dates?.length) return null;
  const from = Math.max(0, s.dates.length - n);
  const cut = (k) => (s[k] ?? []).slice(from);
  const win = { dates: cut("dates"), o: cut("o"), h: cut("h"), l: cut("l"), c: cut("c"), ma20: cut("ma20") };
  win.n = win.dates.length;
  // A candle needs all four of its values; a hole in the file is drawn as no candle, never as a zero.
  win.ok = win.dates.map((_, i) => [win.o[i], win.h[i], win.l[i], win.c[i]].every(isNum));
  return win.ok.some(Boolean) ? win : null;
}

/** Whether the month ended higher than it began: "up", "down" or "flat" (within a quarter of a percent), from closes. */
export function monthDirection(win) {
  const closes = (win?.c ?? []).filter(isNum);
  if (closes.length < 2) return null;
  const a = closes[0], b = closes.at(-1);
  const move = ((100 + b) / (100 + a) - 1) * 100;
  return Math.abs(move) < 0.25 ? "flat" : move > 0 ? "up" : "down";
}

/** One sentence for screen readers, in words only (no digits, like the rest of the simple home). */
export function miniSummary(name, win) {
  if (!win) return `${name}: no chart yet.`;
  const days = win.ok.filter(Boolean).length;
  const ups = win.ok.filter((ok, i) => ok && win.c[i] >= win.o[i]).length;
  const mix = ups > days / 2 + 1 ? "mostly up days" : ups < days / 2 - 1 ? "mostly down days" : "about as many up days as down days";
  const dir = { up: "ended the month higher than it began", down: "ended the month lower than it began", flat: "ended the month about where it began" }[monthDirection(win)];
  return `${name}: the last month of daily candles, ${mix}${dir ? `; it ${dir}` : ""}. A description of the chart, not a forecast.`;
}

/**
 * Pixel geometry of the mini chart, `w` by `h`: candles (body, wick, hollow when up), the 20-day average as a path and
 * the last candle's close as a marker. The candles always fit; the average is drawn where it fits and is clipped by
 * the caller beyond that (fitDomain keeps a far-off average from squashing the candles).
 */
export function miniGeometry(win, w, h, { padX = 6, padY = 10, maxBody = 13 } = {}) {
  if (!win || !(w > 0) || !(h > 0)) return null;
  const sub = { l: win.l.filter((_, i) => win.ok[i]), h: win.h.filter((_, i) => win.ok[i]) };
  const dom = fitDomain(sub, win.ma20, { pad: 0.04 });
  const y = scaleLinear(dom.lo, dom.hi, h - padY, padY);
  const layout = bands(win.n, padX, w - padX, { maxBody });
  const candles = [];
  for (let i = 0; i < win.n; i++) if (win.ok[i]) candles.push(candleGeom(win, i, y, layout));
  const last = candles.at(-1) ?? null;
  return {
    w, h, candles,
    ma: linePath(win.ma20, layout.cx, y),
    last: last ? { cx: last.cx, cy: y(win.c[last.i]), up: last.up, band: layout.band } : null,
  };
}

/**
 * The scroll positions the carousel can rest on: the start of each card while that is still short of the end, then
 * the end itself. `step` is one card plus the gap, `maxScroll` the scroller's scrollWidth minus clientWidth. When two
 * cards fit side by side, the last card never reaches the start, so there are fewer stops than cards.
 */
export function snapStops(count, step, maxScroll) {
  if (!(count > 0) || !(step > 0)) return [0];
  const end = Math.max(0, maxScroll);
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = i * step;
    if (x >= end - step * 0.1) break;
    out.push(Math.round(x));
  }
  out.push(Math.round(end));
  return out.length > 1 && out.at(-1) - out.at(-2) < 2 ? out.slice(0, -1) : out;
}

/** The dot to light for a scroll position: the nearest stop. */
export function dotIndex(scrollLeft, stops) {
  if (!stops?.length) return 0;
  let best = 0;
  stops.forEach((s, i) => { if (Math.abs(s - scrollLeft) < Math.abs(stops[best] - scrollLeft)) best = i; });
  return best;
}

/** The stop one step from the current one (dir -1 or +1), clamped. */
export function stepStop(stops, scrollLeft, dir) {
  const i = dotIndex(scrollLeft, stops);
  return stops[Math.max(0, Math.min(stops.length - 1, i + dir))] ?? 0;
}

/**
 * The cards to have charts for at a scroll position: those on screen plus `ahead` on each side, as [first, last]
 * indexes. The first two load at once; the rest as the reader scrolls near them.
 */
export function nearCards(scrollLeft, clientWidth, step, count, ahead = 1) {
  if (!(step > 0) || !(count > 0)) return [0, 0];
  const first = Math.max(0, Math.floor(scrollLeft / step) - ahead);
  const last = Math.min(count - 1, Math.floor((scrollLeft + Math.max(1, clientWidth) - 1) / step) + ahead);
  return [Math.min(first, last), last];
}
