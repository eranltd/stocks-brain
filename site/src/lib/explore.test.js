import test from "node:test";
import assert from "node:assert/strict";
import { HOLES, dayNumber, nextFor, stockOfDay, targetOf, totalMinutes } from "./explore.js";

test("there is about twenty minutes of rabbit holes", () => {
  assert.ok(totalMinutes() >= 20);
  for (const h of HOLES) assert.doesNotMatch(h.q, /\d/);
});

test("nextFor skips the current page, rotates by day and always gives three", () => {
  const a = nextFor("people", 0);
  assert.equal(a.length, 3);
  assert.ok(a.every((h) => h.to !== "people"));
  assert.notDeepEqual(nextFor("people", 0).map((h) => h.id), nextFor("people", 1).map((h) => h.id));
  assert.ok(nextFor("stock/AAA", 3).every((h) => !h.to.startsWith("stock")));
});

test("stock holes need a stock of the day", () => {
  const h = HOLES.find((x) => x.id === "candles");
  assert.equal(targetOf(h, "AAA"), "stock/AAA#checklist");
  assert.equal(targetOf(h, null), null);
  assert.equal(stockOfDay({ watchlist: { symbols: [{ symbol: "BBB" }] } }), "BBB");
  assert.equal(dayNumber("1970-01-02"), 1);
});

test("the rabbit holes' questions speak to any reader", () => {
  for (const h of HOLES) assert.doesNotMatch(h.q, /\bour\b|\bwe\b/i, h.id); // any reader, not "our"
});
