import { test } from "node:test";
import assert from "node:assert/strict";
import { tapeItems, tapeSeconds } from "./tape.js";

const market = {
  as_of: "2026-10-21",
  symbols: [
    { symbol: "AAA", change_1d_pct: 1.25, close: 101.5 },
    { symbol: "BBB", change_1d_pct: -0.4 },
    { symbol: "CCC", change_1d_pct: null },
  ],
};

test("tapeItems: the list's day moves in list order, percent only", () => {
  const items = tapeItems({ market, members: ["BBB", "AAA", "CCC", "DDD"], names: { AAA: "Alpha" } });
  assert.deepEqual(items, [
    { ticker: "BBB", name: "BBB", move: -0.4 },
    { ticker: "AAA", name: "Alpha", move: 1.25 },
  ]);
  for (const x of items) assert.deepEqual(Object.keys(x).sort(), ["move", "name", "ticker"], "no price ever rides along");
});

test("tapeItems: nothing to show without numbers or a list", () => {
  assert.deepEqual(tapeItems(), []);
  assert.deepEqual(tapeItems({ market, members: [] }), []);
  assert.deepEqual(tapeItems({ market: null, members: ["AAA"] }), []);
});

test("tapeSeconds: a steady pace with a floor", () => {
  assert.equal(tapeSeconds(0), 20);
  assert.equal(tapeSeconds(20), 64);
});
