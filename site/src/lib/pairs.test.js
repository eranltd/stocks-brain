import { test } from "node:test";
import assert from "node:assert/strict";
import { alignReturns, correlation, dailyReturns, measurePairs, nearCopy, outOfTen, pairView, pickPairs, wayShares } from "./pairs.js";

const day = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
/** A series from day moves in percent, starting at 100. */
const fromMoves = (moves, start = 0) => {
  const out = [{ date: day(start), v: 100 }];
  moves.forEach((m, i) => out.push({ date: day(start + i + 1), v: out.at(-1).v * (1 + m / 100) }));
  return out;
};
const close = (a, b) => Math.abs(a - b) < 1e-9;

test("dailyReturns: day moves in percent by date, skipping a missing close", () => {
  const r = dailyReturns([{ date: day(0), v: 100 }, { date: day(1), v: 110 }, { date: day(2), v: null }, { date: day(3), v: 99 }]);
  assert.ok(close(r.get(day(1)), 10));
  assert.equal(r.has(day(2)), false);
  assert.equal(r.has(day(3)), false, "no move across a missing close");
  assert.equal(dailyReturns([]).size, 0);
});

test("alignReturns keeps the dates both have, the last few of them", () => {
  const ra = new Map([[day(1), 1], [day(2), 2], [day(3), 3]]);
  const rb = new Map([[day(2), -2], [day(3), -3], [day(4), -4]]);
  assert.deepEqual(alignReturns(ra, rb), { dates: [day(2), day(3)], a: [2, 3], b: [-2, -3] });
  assert.deepEqual(alignReturns(ra, rb, 1).dates, [day(3)]);
});

test("correlation: +1 together, −1 opposite, null when one never moves", () => {
  assert.ok(close(correlation([1, 2, 3, 4], [2, 4, 6, 8]), 1));
  assert.ok(close(correlation([1, 2, 3, 4], [4, 3, 2, 1]), -1));
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), null);
  assert.equal(correlation([1, 2], [2, 1]), null, "too few days");
});

test("wayShares counts opposite and same days and skips still days; outOfTen rounds", () => {
  assert.deepEqual(wayShares([1, -1, 2, 0, 3], [-1, 1, 2, 5, -0.5]), { opposite: 3, same: 1, days: 4 });
  assert.equal(outOfTen(7, 10), 7);
  assert.equal(outOfTen(2, 3), 7);
  assert.equal(outOfTen(0, 0), 0);
});

test("measurePairs measures each pair once, on shared days only", () => {
  const up = [1, -1, 2, -2, 1, -1, 2, -2, 1, -1];
  const names = [
    { symbol: "AAA", series: fromMoves(up) },
    { symbol: "BBB", series: fromMoves(up.map((m) => -m)) },
    { symbol: "CCC", series: fromMoves(up.map((m) => m * 2)) },
  ];
  const p = measurePairs(names, { minDays: 5 });
  assert.equal(p.length, 3);
  const ab = p.find((x) => x.a === "AAA" && x.b === "BBB");
  assert.ok(ab.corr < -0.99);
  assert.equal(ab.opposite, 10);
  const ac = p.find((x) => x.a === "AAA" && x.b === "CCC");
  assert.ok(ac.corr > 0.99);
  assert.equal(ac.same, 10);
  assert.equal(measurePairs(names, { minDays: 50 }).length, 0, "not enough days");
});

test("nearCopy: anything at 0.95 or more, or two funds at 0.9 or more", () => {
  assert.equal(nearCopy({ corr: 0.96 }), true);
  assert.equal(nearCopy({ corr: 0.92, fundA: true, fundB: true }), true);
  assert.equal(nearCopy({ corr: 0.92, fundA: true, fundB: false }), false);
  assert.equal(nearCopy({ corr: 0.5 }), false);
});

test("pickPairs: lowest for seesaw, highest for twins, skips near-copies, a name at most twice", () => {
  const P = (a, b, corr, extra = {}) => ({ a, b, corr, ...extra });
  const pairs = [
    P("AAA", "BBB", -0.6), P("AAA", "CCC", -0.55), P("AAA", "DDD", -0.5), P("BBB", "CCC", -0.4), P("EEE", "FFF", -0.1),
    P("GGG", "HHH", 0.99), P("GGG", "JJJ", 0.92, { fundA: true, fundB: true }), P("GGG", "KKK", 0.8), P("HHH", "KKK", 0.7),
  ];
  assert.deepEqual(pickPairs(pairs, { kind: "seesaw", n: 3 }).map((p) => `${p.a}-${p.b}`), ["AAA-BBB", "AAA-CCC", "BBB-CCC"]);
  assert.deepEqual(pickPairs(pairs, { kind: "twins", n: 6 }).map((p) => `${p.a}-${p.b}`), ["GGG-KKK", "HHH-KKK"]);
  assert.equal(pickPairs(pairs, { kind: "seesaw", n: 2 }).length, 2);
});

test("pairView: the small chart starts at zero and the loop holds the last days' moves", () => {
  const v = pairView(fromMoves([10, 0, -10, 5]), fromMoves([0, 0, 0, 1]), { days: 3, loop: 2 });
  assert.equal(v.dates.length, 3);
  assert.equal(v.lineA[0], 0);
  assert.ok(close(v.lineA[1], -10), "−10% from the window's start");
  assert.equal(v.movesA.length, 2);
  assert.ok(close(v.movesA[1], 5));
  assert.ok(close(v.movesB[1], 1));
  assert.equal(v.loopDates.length, 2);
});
