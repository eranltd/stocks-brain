import test from "node:test";
import assert from "node:assert/strict";
import { BIG_MOVE_PCT, afterResults, alertsNow, bigMoves, dropStats, dropsFor, resultsSoon } from "./bigmoves.js";

const market = {
  as_of: "2026-10-29",
  symbols: [
    { symbol: "AAA", change_1d_pct: -12.4, last_date: "2026-10-29" },
    { symbol: "BBB", change_1d_pct: 7.5, last_date: "2026-10-29" },
    { symbol: "CCC", change_1d_pct: -6.9, last_date: "2026-10-29" },
    { symbol: "ZZZ", change_1d_pct: -9, last_date: "2026-10-29" },
  ],
};
const outlook = {
  companies: [
    { ticker: "AAA", name: "Aaa Inc.", next_earnings: { date: "2026-10-28", confirmed: true } },
    { ticker: "DDD", name: "Ddd Inc.", next_earnings: { date: "2026-10-30", confirmed: true } },
    { ticker: "EEE", name: "Eee Inc.", next_earnings: { date: "2026-11-20", confirmed: false } },
    { ticker: "FFF", name: "Fff Inc.", latest: { reported_on: "2026-10-29" }, next_earnings: { date: null } },
  ],
};

test("big moves: either way, at or above the bar, biggest first, never the benchmark", () => {
  assert.equal(BIG_MOVE_PCT, 7);
  assert.deepEqual(bigMoves(market, { bench: "ZZZ" }).map((m) => [m.symbol, m.move]), [["AAA", -12.4], ["BBB", 7.5]]);
  assert.deepEqual(bigMoves(null), []);
});

test("results soon: today up to two days ahead, soonest first", () => {
  assert.deepEqual(resultsSoon(outlook, "2026-10-29").map((r) => [r.symbol, r.days]), [["DDD", 1]]);
  assert.deepEqual(resultsSoon(outlook, "2026-10-28").map((r) => [r.symbol, r.days]), [["AAA", 0], ["DDD", 2]]);
});

test("a move is tied to results reported that day or the evening before", () => {
  assert.equal(afterResults(outlook, "AAA", "2026-10-29"), "2026-10-28");
  assert.equal(afterResults(outlook, "FFF", "2026-10-29"), "2026-10-29");
  assert.equal(afterResults(outlook, "AAA", "2026-11-05"), null);
});

test("alerts: big moves first, then results coming up, no name twice", () => {
  const data = { market, outlook: { companies: [...outlook.companies, { ticker: "BBB", next_earnings: { date: "2026-10-30" } }] }, bench: { symbol: "ZZZ" } };
  const a = alertsNow(data, "2026-10-29");
  assert.deepEqual(a.map((x) => [x.kind, x.symbol]), [["move", "AAA"], ["move", "BBB"], ["results", "DDD"]]);
  assert.equal(a[0].results, "2026-10-28");
});

test("the study: numbers at a horizon beside all days, and one name's drops", () => {
  const dips = {
    summary: { 20: { n: 30, beat_pct: 56.7, avg_excess_pct: 1.2, median_excess_pct: 0.8, worst_pct: -20, best_pct: 30 } },
    base: { 20: { n: 9000, beat_pct: 51.2, avg_excess_pct: 0.4 } },
    events: [{ symbol: "AAA", date: "2026-10-29" }, { symbol: "BBB", date: "2026-01-02" }, { symbol: "AAA", date: "2024-03-01" }],
  };
  assert.deepEqual(dropStats(dips, 20), { h: 20, n: 30, beat: 56.7, avg: 1.2, median: 0.8, worst: -20, best: 30, baseBeat: 51.2, baseAvg: 0.4 });
  assert.equal(dropStats(dips, 60), null);
  assert.deepEqual(dropsFor(dips, "AAA").map((e) => e.date), ["2026-10-29", "2024-03-01"]);
});
