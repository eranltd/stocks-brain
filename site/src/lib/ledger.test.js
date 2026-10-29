import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerStats, paperBets, stepTrack, sureLevels, sureScore } from "./ledger.js";

const kb = [
  { id: "2026-10-01:AAA", date: "2026-10-01", ticker: "AAA", name: "Aaa", stance: "bullish", conviction: "low", verdict: "hit", outcome: { scored_date: "2026-10-29", excess_pct: 2.1 } },
  { id: "2026-10-01:BBB", date: "2026-10-01", ticker: "BBB", name: "Bbb", stance: "neutral", conviction: "low", verdict: "miss", outcome: { scored_date: "2026-10-29", excess_pct: -3 } },
  { id: "2026-10-02:AAA", date: "2026-10-02", ticker: "AAA", name: "Aaa", stance: "bearish", conviction: "high", verdict: "flat", outcome: { scored_date: "2026-10-30", excess_pct: 0.2 } },
  { id: "2026-10-05:BBB", date: "2026-10-05", ticker: "BBB", name: "Bbb", stance: "neutral", conviction: "medium", verdict: "pending", outcome: null },
];
const bets = [
  { date: "2026-10-12", best: ["AAA"], worst: ["BBB"], open: true, won: true, spread: 0.8, end: "2026-10-14" },
  { date: "2026-10-05", best: ["AAA"], worst: ["BBB"], open: false, won: false, spread: -1.8, end: "2026-10-12" },
];

test("paperBets: calls and weekly bets in one ledger, newest first, with results", () => {
  const xs = paperBets({ kb, bets, horizon: 20 });
  assert.equal(xs.length, 6);
  assert.deepEqual(xs.map((x) => x.id), ["bet:2026-10-12", "bet:2026-10-05", "2026-10-05:BBB", "2026-10-02:AAA", "2026-10-01:AAA", "2026-10-01:BBB"]);
  const open = xs.find((x) => x.id === "2026-10-05:BBB");
  assert.equal(open.result, "open");
  assert.equal(open.closed, null);
  assert.equal(open.check, "2026-11-02", "an open call is checked 20 market days later");
  assert.equal(xs[0].result, "open", "the running week is open even when ahead so far");
  assert.equal(xs[1].result, "miss");
  assert.equal(xs[1].closed, "2026-10-12");
});

test("ledgerStats: counts, hit rate of the closed bets only, days running, next check", () => {
  const s = ledgerStats(paperBets({ kb, bets }), "2026-10-31");
  assert.deepEqual([s.made, s.calls, s.weekly, s.hits, s.misses, s.flats, s.open, s.closed], [6, 4, 2, 1, 2, 1, 2, 4]);
  assert.equal(s.rate, 25);
  assert.equal(s.days, 30);
  assert.equal(s.nextCheck, "2026-11-02");
  assert.equal(ledgerStats([], "2026-10-31").rate, null);
});

test("stepTrack: hits minus misses, one step per checked day, flat to today", () => {
  const pts = stepTrack(paperBets({ kb, bets }), "2026-10-31");
  assert.deepEqual(pts.map((p) => [p.date, p.v]), [["2026-10-01", 0], ["2026-10-12", -1], ["2026-10-29", -1], ["2026-10-30", -1], ["2026-10-31", -1]]);
  assert.deepEqual(stepTrack([], "2026-10-31"), []);
});

test("sureLevels: hit rate per level of sureness, from calibration or counted", () => {
  const outcomes = [
    { conviction: "low", verdict: "hit" }, { conviction: "low", verdict: "miss" }, { conviction: "high", verdict: "hit" },
  ];
  assert.deepEqual(sureLevels(outcomes), [{ level: "low", n: 2, rate: 50 }, { level: "medium", n: 0, rate: null }, { level: "high", n: 1, rate: 100 }]);
  const cal = { by_conviction: [{ conviction: "low", n: 12, hit_rate_pct: 41.7 }, { conviction: "medium", n: 0, hit_rate_pct: null }] };
  assert.deepEqual(sureLevels(outcomes, cal)[0], { level: "low", n: 12, rate: 41.7 });
  assert.deepEqual(sureLevels(outcomes, cal)[1], { level: "medium", n: 0, rate: null });
});

test("sureScore: the average conviction out of 10", () => {
  assert.deepEqual(sureScore(["low", "low"]), { score: 3.3, level: "low" });
  assert.deepEqual(sureScore(["high", "medium"]), { score: 8.3, level: "high" });
  assert.equal(sureScore([]), null);
});
