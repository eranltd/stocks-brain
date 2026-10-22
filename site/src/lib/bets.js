// The brain's weekly bet (runs/run.<date>.json `bets`): three names it expects to do best over the coming week and three
// it expects to do worst. The first run of each ISO week counts (later runs that week repeat it); each bet is scored
// from its run's close to the next bet's run, or to the latest close while it is open, on the published indexed series
// (data/market/derived.json symbols[].series: 100 = start of window, so ratios are returns and no price is published).
// Pure functions, no React; tested in bets.test.js. The pack's copy for the brain is scripts/build_pack.py bets_block.
// The record's sentence is in text/plan.js ("bets.*").

import { strings } from "./text.js";
import dict from "../text/plan.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function isoWeek(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week names its year
  const y = d.getUTCFullYear();
  return `${y}-${Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)}`;
}

/** One bet per ISO week: the first ok run of the week that carries one, oldest first. */
export function weeklyBets(runs) {
  const seen = new Set();
  const out = [];
  for (const r of [...(runs ?? [])].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.status !== "ok" || r.sample || !r.bets) continue;
    const wk = isoWeek(r.date);
    if (seen.has(wk)) continue;
    seen.add(wk);
    out.push({ date: r.date, best: r.bets.best, worst: r.bets.worst, why: r.bets.why });
  }
  return out;
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Percent move of `sym` from close `a` to close `b`, or null when the series lacks either. */
export function move(series, sym, a, b) {
  const pts = series?.[sym];
  if (!pts) return null;
  const x = pts.get(a);
  const y = pts.get(b);
  return isNum(x) && isNum(y) && x > 0 ? (y / x - 1) * 100 : null;
}

/** symbol -> Map(date -> indexed close), from the derived market file. */
export function seriesOf(market) {
  return Object.fromEntries((market?.symbols ?? []).map((s) => [s.symbol, new Map((s.series ?? []).map((p) => [p.date, p.v]))]));
}

/**
 * Every weekly bet with its score, newest first. spread: average move of the three best minus that of the three worst
 * (above zero = the brain's ranking was right that week). bestVsMarket: the three best against the benchmark.
 */
export function scoreBets(runs, market, bench) {
  const bets = weeklyBets(runs);
  const series = seriesOf(market);
  const last = market?.as_of;
  return bets.map((b, k) => {
    const open = k === bets.length - 1;
    const end = open ? last : bets[k + 1].date;
    const best = b.best.map((t) => move(series, t, b.date, end));
    const worst = b.worst.map((t) => move(series, t, b.date, end));
    const ok = end && end > b.date && [...best, ...worst].every(isNum);
    const spread = ok ? mean(best) - mean(worst) : null;
    const m = ok ? move(series, bench, b.date, end) : null;
    return { ...b, end, open, spread, won: isNum(spread) ? spread > 0 : null, bestVsMarket: isNum(m) ? mean(best) - m : null };
  }).reverse();
}

/** How often luck alone would win at least `won` of `n` coin-flip weeks, out of 100. */
export function luckOdds(won, n) {
  let c = 1;
  let p = 0;
  for (let k = 0; k <= n; k++) {
    if (k >= won) p += c;
    c = (c * (n - k)) / (k + 1);
  }
  return Math.round((p / 2 ** n) * 100);
}

export const MIN_WEEKS = 12; // under a quarter of weekly results, a coin does as well too often to tell

/** The scoreboard in words: weeks won, against luck. */
export function betRecord(scored) {
  const t = strings(dict);
  const done = scored.filter((b) => !b.open && b.won !== null);
  const won = done.filter((b) => b.won).length;
  const n = done.length;
  if (!n) return { n, won, line: t("bets.first") };
  const odds = luckOdds(won, n);
  const base = t("bets.base", { count: n, won, n });
  if (n < MIN_WEEKS) return { n, won, odds, line: `${base} ${t("bets.early", { min: MIN_WEEKS })}` };
  return { n, won, odds, line: `${base} ${t(odds <= 5 ? "bets.skill" : "bets.luck", { odds })}` };
}
