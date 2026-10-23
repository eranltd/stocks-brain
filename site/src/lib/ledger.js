// The brain's paper bets in one ledger: its daily calls (each checked against the whole market a fixed number of market
// days later; data.kb with its outcome) and its weekly bets (three best against three worst names, scored each week;
// lib/bets.js scoreBets). Pure functions, no React; tested in ledger.test.js. Pretend money only: a "bet" here is a call
// written down in advance and checked later, never an order. Percent moves only, never a price.

import { addTradingDays } from "./verdict.js";
import { daysBetween } from "./stats.js";

const RESULT = { hit: "hit", miss: "miss", flat: "flat", pending: "open" };
const CLOSED = new Set(["hit", "miss", "flat"]);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Every paper bet, newest first. A call: {kind: "call", id, date, ticker, name, stance, conviction, result (open | hit |
 * miss | flat), closed (the day it was checked, or null), check (that day, or when it will be), excess (its lead over
 * the market in percent, once checked)}. A weekly bet: {kind: "weekly", id, date, best, worst, result, closed, check,
 * spread (best three minus worst three, in points)}; a week without the prices to score it is "void".
 */
export function paperBets({ kb = [], bets = [], horizon = 20 } = {}) {
  const calls = kb.map((k) => {
    const result = RESULT[k.verdict] ?? "open";
    const closed = CLOSED.has(result) ? (k.outcome?.scored_date ?? null) : null;
    return {
      kind: "call", id: k.id, date: k.date, ticker: k.ticker, name: k.name ?? k.ticker, stance: k.stance, conviction: k.conviction,
      result, closed, check: closed ?? addTradingDays(k.date, horizon), excess: isNum(k.outcome?.excess_pct) ? k.outcome.excess_pct : null,
    };
  });
  const weekly = bets.map((b) => {
    const result = b.open ? "open" : b.won === true ? "hit" : b.won === false ? "miss" : "void";
    return {
      kind: "weekly", id: `bet:${b.date}`, date: b.date, best: b.best ?? [], worst: b.worst ?? [], result,
      closed: CLOSED.has(result) ? b.end : null, check: b.end ?? null, spread: isNum(b.spread) ? b.spread : null,
    };
  });
  return [...weekly, ...calls].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? (a.ticker ?? "").localeCompare(b.ticker ?? "") : a.kind === "weekly" ? -1 : 1));
}

/** The numbers on top: bets made, hits, misses, flats, hit rate (of the closed ones), open, days running, next check. */
export function ledgerStats(items, today) {
  const n = (r) => items.filter((x) => x.result === r).length;
  const hits = n("hit"), misses = n("miss"), flats = n("flat"), open = n("open");
  const closed = hits + misses + flats;
  const first = items.length ? items.map((x) => x.date).sort()[0] : null;
  const ahead = items.filter((x) => x.kind === "call" && x.result === "open" && x.check).map((x) => x.check).sort();
  return {
    made: items.length, calls: items.filter((x) => x.kind === "call").length, weekly: items.filter((x) => x.kind === "weekly").length,
    hits, misses, flats, open, closed, rate: closed ? (hits / closed) * 100 : null,
    first, days: first && today ? Math.max(0, daysBetween(first, today)) : 0,
    nextCheck: ahead.find((d) => !today || d >= today) ?? ahead.at(-1) ?? null,
  };
}

/**
 * The track-record line: hits minus misses, adding up over time, one step on each day bets were checked (flats leave it
 * where it was). Starts at 0 on the first bet's day and runs flat to `today`. [{date, v, hits, misses, flats}].
 */
export function stepTrack(items, today = null) {
  if (!items.length) return [];
  const first = items.map((x) => x.date).sort()[0];
  const byDay = new Map();
  for (const x of items) {
    if (!x.closed || !CLOSED.has(x.result)) continue;
    const d = byDay.get(x.closed) ?? { hits: 0, misses: 0, flats: 0 };
    d[{ hit: "hits", miss: "misses", flat: "flats" }[x.result]] += 1;
    byDay.set(x.closed, d);
  }
  const pts = [{ date: first, v: 0, hits: 0, misses: 0, flats: 0, start: true }];
  let v = 0;
  for (const date of [...byDay.keys()].sort()) {
    const d = byDay.get(date);
    v += d.hits - d.misses;
    if (date === first) pts[0] = { date, v, ...d };
    else pts.push({ date, v, ...d });
  }
  const last = pts.at(-1).date;
  if (today && today > last) pts.push({ date: today, v, hits: 0, misses: 0, flats: 0, end: true });
  return pts;
}

/** How sure the brain is about a run's calls, out of 10: the average of low 1, medium 2, high 3, scaled to 10. */
export function sureScore(convictions) {
  const map = { low: 1, medium: 2, high: 3 };
  const xs = convictions.map((c) => map[c]).filter(Boolean);
  if (!xs.length) return null;
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  const score = Math.round((avg / 3) * 100) / 10;
  return { score, level: avg < 1.5 ? "low" : avg < 2.5 ? "mid" : "high" };
}
