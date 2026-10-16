import test from "node:test";
import assert from "node:assert/strict";
import { gameRow, historyWords, nextBuyDay, scoreLine } from "./weekly.js";

test("nextBuyDay is the coming Monday", () => {
  assert.equal(nextBuyDay("2026-10-16"), "2026-10-19"); // Friday
  assert.equal(nextBuyDay("2026-10-19"), "2026-10-19"); // Monday
  assert.equal(nextBuyDay("2026-10-18"), "2026-10-19"); // Sunday
});

test("gameRow and scoreLine read the forward ledger", () => {
  const ledger = { dates: ["2026-10-01", "2026-10-02", "2026-10-09"], core: [100, 101, 102],
    rules: { weekly_swing: { started: "2026-10-02", rebalances: [{ date: "2026-10-05", holdings: ["AAA"] }, { date: "2026-10-12", holdings: ["BBB", "CCC"] }], values: [100, 103] } } };
  const r = gameRow(ledger, "weekly_swing", { BBB: "Beta" });
  assert.equal(r.weeks, 2);
  assert.deepEqual(r.holdings.map((h) => h.name), ["Beta", "CCC"]);
  assert.ok(Math.abs(r.market - (102 / 101 - 1) * 100) < 1e-9);
  assert.match(scoreLine(r), /After 2 weeks it is 2\.0 points ahead of the whole market/);
  assert.equal(gameRow(ledger, "five_leaders_weekly"), null);
  assert.match(scoreLine(null), /next weekly review/);
});

test("historyWords: not tested, rejected, passed", () => {
  assert.equal(historyWords(null, "x").tested, false);
  const rr = { satellite: { rules: [{ id: "a", percentile: 12.4, verdict: "rejected" }, { id: "b", percentile: 97, verdict: "passes_history" }] } };
  assert.match(historyWords(rr, "a").line, /beat only 12 out of 100/);
  assert.equal(historyWords(rr, "b").passed, true);
});
