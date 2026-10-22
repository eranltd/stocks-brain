import { test } from "node:test";
import assert from "node:assert/strict";
import { betRecord, luckOdds, scoreBets, weeklyBets } from "./bets.js";

const bet = (best, worst) => ({ best, worst, why: "a plain reason for the ranking" });
const run = (date, b, status = "ok") => ({ date, status, ...(b ? { bets: b } : {}) });
const sym = (symbol, pts) => ({ symbol, series: Object.entries(pts).map(([date, v]) => ({ date, v })) });

test("the first bet of each week counts", () => {
  const runs = [run("2026-10-14", bet(["A", "B", "C"], ["D", "E", "F"])), run("2026-10-13"), run("2026-10-15", bet(["F", "E", "D"], ["C", "B", "A"])),
    run("2026-10-19", bet(["D", "E", "F"], ["A", "B", "C"])), run("2026-10-20", bet(["A", "B", "C"], ["D", "E", "F"]), "failed")];
  const w = weeklyBets(runs);
  assert.deepEqual(w.map((b) => b.date), ["2026-10-14", "2026-10-19"]);
  assert.deepEqual(w[0].best, ["A", "B", "C"]);
});

test("a week's score: best minus worst, from its run to the next bet", () => {
  const d = ["2026-10-14", "2026-10-19", "2026-10-21"];
  const up = (a, b, c) => ({ [d[0]]: a, [d[1]]: b, [d[2]]: c });
  const market = { as_of: d[2], symbols: [
    sym("A", up(100, 110, 100)), sym("B", up(100, 110, 100)), sym("C", up(100, 110, 100)),
    sym("D", up(100, 100, 100)), sym("E", up(100, 100, 100)), sym("F", up(100, 100, 100)), sym("IDX", up(100, 105, 100)),
  ] };
  const s = scoreBets([run(d[0], bet(["A", "B", "C"], ["D", "E", "F"])), run(d[1], bet(["D", "E", "F"], ["A", "B", "C"]))], market, "IDX");
  assert.equal(s.length, 2);
  assert.equal(s[1].open, false);
  assert.ok(Math.abs(s[1].spread - 10) < 1e-9);
  assert.equal(s[1].won, true);
  assert.ok(Math.abs(s[1].bestVsMarket - 5) < 1e-9);
  assert.equal(s[0].open, true); // still running: scored to the latest close
  assert.equal(s[0].won, true); // D–F flat, A–C fell
});

test("a missing series leaves the week unscored", () => {
  const s = scoreBets([run("2026-10-14", bet(["A", "B", "C"], ["D", "E", "F"]))], { as_of: "2026-10-15", symbols: [] }, "IDX");
  assert.equal(s[0].spread, null);
  assert.equal(s[0].won, null);
});

test("luck odds and the record in words", () => {
  assert.equal(luckOdds(0, 4), 100);
  assert.equal(luckOdds(4, 4), 6);
  assert.equal(luckOdds(10, 12), 2);
  assert.match(betRecord([]).line, /first week/);
  const weeks = (won, lost) => [...Array(won).fill({ open: false, won: true }), ...Array(lost).fill({ open: false, won: false })];
  assert.match(betRecord(weeks(3, 1)).line, /won 3 of 4 weeks.*Too early/);
  assert.match(betRecord(weeks(10, 2)).line, /2 times in 100: the first sign/);
  assert.match(betRecord(weeks(7, 5)).line, /within luck/);
});
