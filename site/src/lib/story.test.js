import test from "node:test";
import assert from "node:assert/strict";
import { comingOf, moveWord, storyOf, todayOf } from "./story.js";

const row = { symbol: "AAA", last_date: "2026-11-05", change_1d_pct: -2.2, ret_20d_pct: -18.9, ret_250d_pct: -0.5, from_high_pct: -29.7, vs_bench_20d_pct: -5.4, above_sma50: false };
const live = { sample: false, quotes_at: Date.parse("2026-11-06T15:00:00Z") / 1000, symbols: [{ symbol: "AAA", move_pct: 3.1 }],
  company_news: [{ symbol: "AAA", headline: "AAA bounces", url: "https://n/1", at: 9 }] };

test("move words", () => {
  assert.equal(moveWord(12), "jumped");
  assert.equal(moveWord(-18.9), "dropped");
  assert.equal(moveWord(-0.5), "flat");
  assert.equal(moveWord(null), null);
});

test("today: the fresh pulse first, else the last close", () => {
  assert.deepEqual(todayOf({ symbol: "AAA", row, live, now: new Date("2026-11-06T15:30:00Z") }), { move: 3.1, source: "live", headline: "AAA bounces", url: "https://n/1" });
  assert.equal(todayOf({ symbol: "AAA", row, live, now: new Date("2026-11-07T15:30:00Z") }).source, "close");
  assert.equal(todayOf({ symbol: "AAA", row, live: null }).move, -2.2);
});

test("coming: days to the next results, passed, or not set", () => {
  assert.deepEqual(comingOf({ next_earnings: { date: "2026-11-18", confirmed: true } }, "2026-11-06"), { date: "2026-11-18", days: 12, confirmed: true });
  assert.equal(comingOf({ next_earnings: { date: "2026-11-01" } }, "2026-11-06").passed, true);
  assert.equal(comingOf({ next_earnings: { date: null, note: "Late Nov" } }, "2026-11-06").note, "Late Nov");
  assert.equal(comingOf(null, "2026-11-06"), null);
});

test("the story: chapters in order, empty ones left out", () => {
  const notes = [{ headline: "Fell after results", date: "2026-11-05" }];
  const s = storyOf({ symbol: "AAA", row, live: null, notes, card: { plain: "Makes things." }, call: "wait", today: "2026-11-06" });
  assert.deepEqual(s.map((c) => c.id), ["today", "trend", "news", "system"]);
  assert.equal(s[0].why, "Fell after results");
  assert.deepEqual(storyOf({ symbol: "AAA", row: {} }).map((c) => c.id), []);
});
