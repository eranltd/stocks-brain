// Statistics computed in the browser from published numbers (never by the LLM).
// Definitions match docs/methodology.md; the Python side computes the published ones.

/** Excess in the direction of the call: bullish +x, bearish -x, neutral -|x|. */
export const signedExcess = (o) => (o.stance === "bullish" ? o.excess_pct : o.stance === "bearish" ? -o.excess_pct : -Math.abs(o.excess_pct));

/** Wilson score interval lower bound (percent) for k successes out of n. */
export function wilsonLow(k, n, z = 1.645) {
  if (!n) return 0;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return ((c - r) / d) * 100;
}

const DAY = 864e5;
export const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / DAY);

/** Non-overlapping picks per ticker: a pick counts only if it starts after the previous counted one ended. */
export function effectivePicks(outcomes, horizonDays) {
  const byTicker = {};
  for (const o of [...outcomes].sort((a, b) => a.ref_date.localeCompare(b.ref_date))) (byTicker[o.ticker] ??= []).push(o);
  const out = [];
  const gap = Math.ceil((horizonDays * 7) / 5); // trading -> calendar days
  for (const list of Object.values(byTicker)) {
    let last = null;
    for (const o of list) {
      if (!last || daysBetween(last.ref_date, o.ref_date) >= gap) { out.push(o); last = o; }
    }
  }
  return out;
}

/** Track-record statistics for the brain's scored picks (Track record tab). */
export function trackStats(outcomes, horizonDays, z = 1.645) {
  const eff = effectivePicks(outcomes, horizonDays);
  const hits = eff.filter((o) => o.verdict === "hit").length;
  const decided = eff.filter((o) => o.verdict !== "flat").length;
  const signed = eff.map(signedExcess);
  const dates = outcomes.map((o) => o.scored_date).sort();
  return {
    n: outcomes.length, nEff: eff.length, hits, decided,
    hitRate: decided ? (hits / decided) * 100 : 0,
    hitLow: wilsonLow(hits, decided, z),
    avgSigned: signed.length ? signed.reduce((a, b) => a + b, 0) / signed.length : 0,
    spanDays: dates.length ? daysBetween(dates[0], dates.at(-1)) : 0,
  };
}

// ---------------------------------------------------------------- portfolio math

export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Weights for a basket: equal, or inverse 1-year volatility (each name contributes similar risk). */
export function weightsFor(symbols, mode, volOf) {
  if (!symbols.length) return {};
  if (mode === "vol") {
    const inv = symbols.map((s) => 1 / Math.max(5, volOf(s) ?? 30));
    const t = inv.reduce((a, b) => a + b, 0);
    return Object.fromEntries(symbols.map((s, i) => [s, inv[i] / t]));
  }
  return Object.fromEntries(symbols.map((s) => [s, 1 / symbols.length]));
}

/** Portfolio volatility from weights, 1-year vols and the 1-year correlation matrix. */
export function portfolioVol(weights, volOf, corr) {
  const syms = Object.keys(weights);
  const ix = Object.fromEntries(corr.symbols.map((s, i) => [s, i]));
  let v = 0;
  for (const a of syms) for (const b of syms) {
    const r = a === b ? 1 : corr.m[ix[a]]?.[ix[b]] ?? 0.5;
    v += weights[a] * weights[b] * (volOf(a) / 100) * (volOf(b) / 100) * r;
  }
  return Math.sqrt(Math.max(v, 0)) * 100;
}

export function avgPairCorr(symbols, corr) {
  const ix = Object.fromEntries(corr.symbols.map((s, i) => [s, i]));
  const xs = [];
  symbols.forEach((a, i) => symbols.slice(i + 1).forEach((b) => { const r = corr.m[ix[a]]?.[ix[b]]; if (r != null) xs.push(r); }));
  return xs.length ? mean(xs) : null;
}

/** Weekly indexed basket, rebalanced to `weights` every `every` weeks (about monthly). */
export function basketSeries(weekly, weights, every = 4) {
  const syms = Object.keys(weights);
  if (!syms.length) return [];
  const s = syms.map((x) => weekly.members[x]);
  let v = 100, pos = syms.map((x) => weights[x] * v);
  const out = [v];
  for (let k = 1; k < weekly.dates.length; k++) {
    pos = pos.map((p, i) => p * (s[i][k] / s[i][k - 1]));
    v = pos.reduce((a, b) => a + b, 0);
    if (k % every === 0) pos = syms.map((x) => weights[x] * v);
    out.push(v);
  }
  return out;
}

/** Long-run numbers for a weekly series (52 weeks = 1 year). */
export function weeklyStats(series, goalPct) {
  const n = series.length;
  if (n < 2) return null;
  const years = (n - 1) / 52;
  let peak = series[0], dd = 0;
  for (const v of series) { peak = Math.max(peak, v); dd = Math.min(dd, (v / peak - 1) * 100); }
  const r12 = [];
  for (let k = 52; k < n; k++) r12.push((series[k] / series[k - 52] - 1) * 100);
  const sorted = [...r12].sort((a, b) => a - b);
  return {
    years,
    cagr: years > 0 ? ((series.at(-1) / series[0]) ** (1 / years) - 1) * 100 : null,
    maxDD: dd,
    hitGoal: r12.length ? (r12.filter((x) => x >= goalPct).length / r12.length) * 100 : null,
    loss12: r12.length ? (r12.filter((x) => x < 0).length / r12.length) * 100 : null,
    worst12: sorted[0] ?? null,
    median12: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
  };
}

/** The goal path: +g% a year compounding from 100, on the same weekly grid. */
export const goalPath = (n, goalPct) => Array.from({ length: n }, (_, k) => 100 * (1 + goalPct / 100) ** (k / 52));
