import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSlots, boardData, extent, lastKnown, nearestIndex, pickHighlights, RANGES, smoothPath, toggleLit } from "./bigboard.js";

const day = (i) => `2026-01-${String(i + 1).padStart(2, "0")}`;
const series = (vals) => vals.map((v, i) => ({ date: day(i), v }));

test("boardData re-bases every line to percent from the start of the range", () => {
  const b = boardData([
    { symbol: "AAA", series: series([100, 110, 121, 132]) },
    { symbol: "BBB", series: series([50, 50, 40, 45]) },
    { symbol: "IDX", series: series([200, 202, 204, 206]), bench: true },
  ], 2);
  assert.deepEqual(b.dates, [day(1), day(2), day(3)]);
  const aaa = b.lines.find((l) => l.symbol === "AAA");
  assert.equal(aaa.values[0], 0);
  assert.ok(Math.abs(aaa.last - 20) < 1e-9, "110 -> 132 is +20%");
  assert.ok(Math.abs(b.lines.find((l) => l.symbol === "BBB").last + 10) < 1e-9, "50 -> 45 is −10%");
  assert.equal(b.lines.find((l) => l.symbol === "IDX").bench, true);
});

test("boardData follows the benchmark's dates, leaves gaps as null and re-bases a late starter", () => {
  const b = boardData([
    { symbol: "AAA", series: [{ date: day(2), v: 10 }, { date: day(3), v: 12 }] },
    { symbol: "IDX", series: series([100, 100, 100, 100]), bench: true },
  ], 3);
  const aaa = b.lines.find((l) => l.symbol === "AAA");
  assert.deepEqual(aaa.values.slice(0, 2), [null, null]);
  assert.equal(aaa.values[2], 0);
  assert.ok(Math.abs(aaa.last - 20) < 1e-9);
});

test("boardData drops lines it cannot draw and returns null for nothing", () => {
  assert.equal(boardData([]), null);
  assert.equal(boardData([{ symbol: "AAA", series: [{ date: day(0), v: 1 }] }]), null);
  const b = boardData([{ symbol: "AAA", series: series([1, 2]) }, { symbol: "BBB", series: series([null, null]) }], 5);
  assert.deepEqual(b.lines.map((l) => l.symbol), ["AAA"]);
  assert.equal(RANGES["1Y"] > RANGES["6M"], true);
});

test("lastKnown and extent", () => {
  assert.equal(lastKnown([1, 2, null]), 2);
  assert.equal(lastKnown([null]), null);
  assert.deepEqual(extent([{ values: [3, null, 5] }, { values: [-2] }]), [-2, 5]);
  assert.deepEqual(extent([{ values: [3, 4] }]), [0, 4], "always includes zero");
});

test("pickHighlights: the best three and the worst two, never the benchmark, no repeats on a short list", () => {
  const lines = [["AAA", 9], ["BBB", 5], ["CCC", 1], ["DDD", -3], ["EEE", -8], ["FFF", 0], ["IDX", 50, true]]
    .map(([symbol, last, bench]) => ({ symbol, last, bench: Boolean(bench) }));
  assert.deepEqual(pickHighlights(lines), ["AAA", "BBB", "CCC", "DDD", "EEE"]);
  assert.deepEqual(pickHighlights(lines.slice(0, 4)), ["AAA", "BBB", "CCC", "DDD"]);
});

test("assignSlots keeps a line's colour while others come and go", () => {
  const a = assignSlots({}, ["AAA", "BBB", "CCC"]);
  assert.deepEqual(a, { AAA: 0, BBB: 1, CCC: 2 });
  const b = assignSlots(a, ["CCC", "DDD"]);
  assert.equal(b.CCC, 2, "a survivor keeps its colour");
  assert.equal(b.DDD, 0, "a newcomer takes the lowest free slot");
  assert.deepEqual(Object.keys(assignSlots({}, ["A", "B", "C"], 2)), ["A", "B"]);
});

test("toggleLit lights and unlights, keeping at most max", () => {
  assert.deepEqual(toggleLit(["AAA"], "BBB"), ["AAA", "BBB"]);
  assert.deepEqual(toggleLit(["AAA", "BBB"], "AAA"), ["BBB"]);
  assert.deepEqual(toggleLit(["AAA", "BBB"], "CCC", 2), ["BBB", "CCC"]);
});

test("nearestIndex snaps to the closest day and stays inside", () => {
  assert.equal(nearestIndex(0, 0, 100, 11), 0);
  assert.equal(nearestIndex(44, 0, 100, 11), 4);
  assert.equal(nearestIndex(46, 0, 100, 11), 5);
  assert.equal(nearestIndex(-20, 0, 100, 11), 0);
  assert.equal(nearestIndex(500, 0, 100, 11), 10);
  assert.equal(nearestIndex(5, 0, 100, 1), 0);
});

test("smoothPath draws curves, breaks at gaps and never overshoots a flat run", () => {
  assert.equal(smoothPath([[0, 0], [10, 5]]), "M0,0L10,5");
  const d = smoothPath([[0, 0], [10, 10], null, [30, 5], [40, 5], [50, 5]]);
  assert.equal((d.match(/M/g) ?? []).length, 2, "two pieces");
  const flat = smoothPath([[0, 5], [10, 5], [20, 5]]);
  for (const y of flat.match(/-?[\d.]+/g).filter((_, i) => i % 2 === 1)) assert.equal(Number(y), 5, "no wobble on a flat run");
});
