import test from "node:test";
import assert from "node:assert/strict";
import { cardFor, comingUp, daysUntil, growthWords, inDays, isStale } from "./outlook.js";

const card = (ticker, date, confirmed = true) => ({ ticker, name: `${ticker} Inc`, next_earnings: { date, confirmed } });

test("days until a date, in words", () => {
  assert.equal(daysUntil("2026-10-20", "2026-10-08"), 12);
  assert.equal(daysUntil("2026-10-01", "2026-10-08"), -7);
  assert.equal(daysUntil(null, "2026-10-08"), null);
  assert.deepEqual([0, 1, -1, 5, -3, null].map(inDays), ["today", "tomorrow", "yesterday", "in 5 days", "3 days ago", ""]);
});

test("an empty or partial file never breaks a lookup", () => {
  assert.equal(cardFor(null, "AAA"), null);
  assert.equal(cardFor({ companies: [] }, "AAA"), null);
  assert.equal(cardFor({ companies: [card("AAA", null)] }, "AAA").ticker, "AAA");
  assert.deepEqual(comingUp(null, "2026-10-08"), []);
  assert.deepEqual(comingUp({ companies: [] }, "2026-10-08"), []);
});

test("a card is stale once its next earnings date has passed", () => {
  assert.equal(isStale(card("AAA", "2026-10-07"), "2026-10-08"), true);
  assert.equal(isStale(card("AAA", "2026-10-08"), "2026-10-08"), false);
  assert.equal(isStale(card("AAA", null), "2026-10-08"), false);
  assert.equal(isStale(null, "2026-10-08"), false);
});

test("coming up: the next thirty days, held or picked names first, then by date", () => {
  const o = { companies: [card("AAA", "2026-10-30"), card("BBB", "2026-10-10", false), card("CCC", "2026-11-30"), card("DDD", "2026-10-01"), card("EEE", "2026-10-08"), card("FFF", null)] };
  const rows = comingUp(o, "2026-10-08", 30, ["AAA"]);
  assert.deepEqual(rows.map((r) => r.ticker), ["AAA", "EEE", "BBB"]);
  assert.deepEqual(rows.map((r) => [r.days, r.confirmed, r.first]), [[22, true, true], [0, true, false], [2, false, false]]);
});

test("growth in words", () => {
  assert.equal(growthWords(62.4), "up 62% from a year earlier");
  assert.equal(growthWords(-3.25), "down 3.3% from a year earlier");
  assert.equal(growthWords(null), "");
});
