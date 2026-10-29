// Pair stocks (components/pairs.jsx): names that move like a seesaw (one up, the other down) and names that move
// together, found from the published daily series of every list. Pure functions, no React; tested in pairs.test.js.
// Only past days: a pair can stop working any time, and the page says so.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** How many recent shared trading days the pairs are measured on, and how many the small chart shows. */
export const PAIR_DAYS = 120;
export const CHART_DAYS = 60;
/** Two names this alike are near-copies (two funds on one index, a fund and its twin), not an interesting pair. */
export const COPY_CORR = 0.95;
/** Two funds this alike most likely hold the same things. */
export const FUND_COPY_CORR = 0.9;

/** A series' day moves in percent, by date: {date: move}. A missing or zero close leaves that day out. */
export function dailyReturns(series) {
  const out = new Map();
  for (let i = 1; i < (series?.length ?? 0); i++) {
    const a = series[i - 1]?.v, b = series[i]?.v;
    if (isNum(a) && isNum(b) && a > 0) out.set(series[i].date, (b / a - 1) * 100);
  }
  return out;
}

/** The two names' day moves on the dates both have, oldest first, the last `days` of them: {dates, a, b}. */
export function alignReturns(ra, rb, days = PAIR_DAYS) {
  const dates = [...ra.keys()].filter((d) => rb.has(d)).sort().slice(-days);
  return { dates, a: dates.map((d) => ra.get(d)), b: dates.map((d) => rb.get(d)) };
}

/** Pearson correlation of two equal-length lists (null when there are fewer than 3 or either never moves). */
export function correlation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/**
 * On how many days the two went opposite ways (one up, one down) and on how many the same way, out of the days both
 * moved (a day either stood still is left out): {opposite, same, days}.
 */
export function wayShares(xs, ys) {
  let opposite = 0, same = 0;
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const a = Math.sign(xs[i]), b = Math.sign(ys[i]);
    if (!a || !b) continue;
    if (a === b) same++; else opposite++;
  }
  return { opposite, same, days: opposite + same };
}

/** A share as "n of 10", rounded (7 of 10). */
export const outOfTen = (part, whole) => (whole ? Math.round((part / whole) * 10) : 0);

/**
 * Every pair of names with enough shared days, measured: [{a, b, corr, opposite, same, days}]. names: [{symbol, name,
 * series, fund}] (each symbol once). `minDays` shared days are needed.
 */
export function measurePairs(names, { days = PAIR_DAYS, minDays = 40 } = {}) {
  const list = (names ?? []).map((n) => ({ ...n, r: dailyReturns(n.series) })).filter((n) => n.r.size >= minDays);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const { a, b } = alignReturns(list[i].r, list[j].r, days);
      if (a.length < minDays) continue;
      const corr = correlation(a, b);
      if (corr == null) continue;
      const w = wayShares(a, b);
      out.push({ a: list[i].symbol, b: list[j].symbol, fundA: Boolean(list[i].fund), fundB: Boolean(list[j].fund), corr, ...w });
    }
  }
  return out;
}

/** A near-copy: almost the same moves (two funds on one index, or anything at COPY_CORR or more). */
export const nearCopy = (p) => p.corr >= COPY_CORR || Boolean(p.fundA && p.fundB && p.corr >= FUND_COPY_CORR);

/**
 * The `n` pairs that move most opposite ("seesaw": lowest correlation first) or most together ("twins": highest
 * first, near-copies skipped). Any one name appears at most `maxPer` times, so the list stays varied.
 */
export function pickPairs(pairs, { kind = "seesaw", n = 6, maxPer = 2 } = {}) {
  const pool = (pairs ?? []).filter((p) => (kind === "seesaw" ? p.corr < 0 : p.corr > 0 && !nearCopy(p)))
    .sort((x, y) => (kind === "seesaw" ? x.corr - y.corr : y.corr - x.corr) || `${x.a}${x.b}`.localeCompare(`${y.a}${y.b}`));
  const used = new Map();
  const out = [];
  for (const p of pool) {
    if (out.length >= n) break;
    if ((used.get(p.a) ?? 0) >= maxPer || (used.get(p.b) ?? 0) >= maxPer) continue;
    out.push(p);
    used.set(p.a, (used.get(p.a) ?? 0) + 1);
    used.set(p.b, (used.get(p.b) ?? 0) + 1);
  }
  return out;
}

/**
 * What a pair card shows: the last `days` shared closes of both names re-based to percent (the small chart), and the
 * day moves of the last `loop` shared days (the squares the floor's clock steps through). {dates, lineA, lineB, movesA,
 * movesB, loopDates}.
 */
export function pairView(seriesA, seriesB, { days = CHART_DAYS, loop = 30 } = {}) {
  const at = (s) => new Map((s ?? []).filter((p) => isNum(p.v) && p.v > 0).map((p) => [p.date, p.v]));
  const A = at(seriesA), B = at(seriesB);
  const shared = [...A.keys()].filter((d) => B.has(d)).sort();
  const win = shared.slice(-days);
  const base = (m) => m.get(win[0]);
  const line = (m) => win.map((d) => (m.get(d) / base(m) - 1) * 100);
  const tail = shared.slice(-(loop + 1));
  const moves = (m) => tail.slice(1).map((d, i) => (m.get(d) / m.get(tail[i]) - 1) * 100);
  return { dates: win, lineA: line(A), lineB: line(B), movesA: moves(A), movesB: moves(B), loopDates: tail.slice(1) };
}
