import { test } from "node:test";
import assert from "node:assert/strict";
import { floorBreadth, floorData, moveAt } from "./floor.js";

const day = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
const fromMoves = (moves) => {
  const out = [{ date: day(0), v: 100 }];
  moves.forEach((m, i) => out.push({ date: day(i + 1), v: out.at(-1).v * (1 + m / 100) }));
  return out;
};
const close = (a, b) => Math.abs(a - b) < 1e-9;

test("floorData: the loop's days, each square's moves and the tape's days before", () => {
  const f = floorData([
    { symbol: "AAA", series: fromMoves([1, 2, 3, 4, 5, 6]), call: "buy" },
    { symbol: "BBB", series: fromMoves([-1, -2, -3, -4, -5, -6]) },
  ], { days: 3, tape: 2 });
  assert.deepEqual(f.loopDates, [day(4), day(5), day(6)]);
  assert.equal(f.tape, 2);
  const a = f.tiles.find((t) => t.symbol === "AAA");
  assert.equal(a.call, "buy");
  assert.equal(a.moves.length, 5, "the loop's 3 days and the tape's 2 days before");
  assert.ok(close(moveAt(a, 0, f.tape), 4), "loop day 0 is the move into its date");
  assert.ok(close(moveAt(a, 2, f.tape), 6));
  assert.ok(close(a.scale, 6));
});

test("floorData copes with short series and missing closes", () => {
  const f = floorData([{ symbol: "AAA", series: fromMoves([1, 2, 3]) }, { symbol: "BBB", series: [{ date: day(2), v: 5 }, { date: day(3), v: 6 }] }], { days: 30, tape: 16 });
  assert.equal(f.loopDates.at(-1), day(3));
  const b = f.tiles.find((t) => t.symbol === "BBB");
  assert.equal(b, undefined, "a series of two closes is too short");
  assert.equal(floorData([]), null);
  const g = floorData([{ symbol: "AAA", series: fromMoves([1, 2, 3]) }, { symbol: "CCC", series: [{ date: day(0), v: 1 }, { date: day(1), v: null }, { date: day(2), v: 2 }, { date: day(3), v: 2 }] }]);
  assert.equal(g.tiles.find((t) => t.symbol === "CCC").moves[0], null, "no move across a missing close");
});

test("floorBreadth counts the squares up and down on a loop day", () => {
  const f = floorData([
    { symbol: "AAA", series: fromMoves([1, 1, 1, 1]) },
    { symbol: "BBB", series: fromMoves([-1, -1, -1, -1]) },
    { symbol: "CCC", series: fromMoves([1, 1, 1, 0]) },
  ], { days: 2, tape: 1 });
  assert.deepEqual(floorBreadth(f.tiles, 0, f.tape), { up: 2, down: 1 });
  assert.deepEqual(floorBreadth(f.tiles, 1, f.tape), { up: 1, down: 1 }, "a still day counts as neither");
});
