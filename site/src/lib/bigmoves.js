// Big moves, results coming up, and the big-drop study (data/market/dips.json). Learned from Alphabet on 29 Oct 2026:
// the site knew its results date and that it was already far below its high, but said nothing before or after. These
// pure helpers find what deserves a loud flag: a list name that moved BIG_MOVE_PCT or more on the latest day, a name
// reporting results today or in the next days, and what the past says about drops like it. Percents only.
import { daysUntil } from "./outlook.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** A one-day move this big (either way) gets a flag. */
export const BIG_MOVE_PCT = 7;
/** Results this many days ahead (or today) get a "big move possible" flag. */
export const RESULTS_SOON_DAYS = 2;

/** Names on the main list that moved BIG_MOVE_PCT or more on the latest day, biggest first: [{symbol, move, date}]. */
export function bigMoves(market, { min = BIG_MOVE_PCT, bench = null } = {}) {
  return (market?.symbols ?? [])
    .filter((s) => s.symbol !== bench && isNum(s.change_1d_pct) && Math.abs(s.change_1d_pct) >= min)
    .map((s) => ({ symbol: s.symbol, move: s.change_1d_pct, date: s.last_date ?? market.as_of ?? null }))
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move) || a.symbol.localeCompare(b.symbol));
}

/** Companies reporting results today or within `days` days: [{symbol, name, date, days, confirmed}], soonest first. */
export function resultsSoon(outlook, today, days = RESULTS_SOON_DAYS) {
  return (outlook?.companies ?? [])
    .map((c) => ({ symbol: c.ticker, name: c.name, date: c.next_earnings?.date ?? null, confirmed: Boolean(c.next_earnings?.confirmed) }))
    .map((r) => ({ ...r, days: daysUntil(r.date, today) }))
    .filter((r) => r.days != null && r.days >= 0 && r.days <= days)
    .sort((a, b) => a.days - b.days || a.symbol.localeCompare(b.symbol));
}

/** The company's latest results date when it is the market day of the move or the day before (a move "after its results"). */
export function afterResults(outlook, symbol, moveDate) {
  const c = (outlook?.companies ?? []).find((x) => x.ticker === symbol);
  const dates = [c?.latest?.reported_on, c?.next_earnings?.date].filter(Boolean);
  return dates.find((d) => { const k = daysUntil(d, moveDate); return k != null && k >= -1 && k <= 0; }) ?? null;
}

/** Fewer drops than this and the study says "too few to tell" instead of a share. */
export const MIN_DROPS = 10;

/** The study's numbers at a horizon (trading days): {n, beat, avg, baseBeat, baseAvg} or null without data. */
export function dropStats(dips, h = 20) {
  const s = dips?.summary?.[String(h)];
  const b = dips?.base?.[String(h)];
  if (!s?.n) return null;
  return { h, n: s.n, beat: s.beat_pct, avg: s.avg_excess_pct, median: s.median_excess_pct, worst: s.worst_pct, best: s.best_pct,
    baseBeat: b?.beat_pct ?? null, baseAvg: b?.avg_excess_pct ?? null };
}

/** One name's drops in the study, newest first. */
export const dropsFor = (dips, symbol) => (dips?.events ?? []).filter((e) => e.symbol === symbol);

/**
 * Everything worth a loud flag right now, loudest first: big moves on the latest day (each tied to its results day when
 * it was one), then results coming up. [{kind: "move" | "results", symbol, ...}].
 */
export function alertsNow(data, today) {
  const moves = bigMoves(data?.market, { bench: data?.bench?.symbol }).map((m) => ({ kind: "move", ...m, results: afterResults(data?.outlook, m.symbol, m.date) }));
  const soon = resultsSoon(data?.outlook, today).filter((r) => !moves.some((m) => m.symbol === r.symbol)).map((r) => ({ kind: "results", ...r }));
  return [...moves, ...soon];
}
