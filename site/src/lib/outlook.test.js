import test from "node:test";
import assert from "node:assert/strict";
import { cardFor, comingUp, daysUntil, growthWords, inDays, isStale, splitWhatsNext, staleness, todayISO } from "./outlook.js";
import { signTone } from "./format.js";

const card = (ticker, date, confirmed = true, reported_on = "2026-08-20") => ({ ticker, name: `${ticker} Inc`, latest: { reported_on }, next_earnings: { date, confirmed } });

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
  assert.deepEqual(comingUp(null, "2026-10-08"), { ahead: [], undated: [] });
  assert.deepEqual(comingUp({ companies: [] }, "2026-10-08", 30, ["AAA"]), { ahead: [], undated: [] });
  assert.deepEqual(splitWhatsNext(undefined, "2026-10-08"), { ahead: [], recent: [], other: [] });
});

test("a card is stale once its next earnings date has passed, firmly only when the company confirmed it", () => {
  assert.deepEqual(staleness(card("AAA", "2026-10-07"), "2026-10-08"), { kind: "passed", date: "2026-10-07", confirmed: true });
  assert.deepEqual(staleness(card("AAA", "2026-10-07", false), "2026-10-08"), { kind: "passed", date: "2026-10-07", confirmed: false });
  assert.equal(isStale(card("AAA", "2026-10-07"), "2026-10-08"), true);
  assert.equal(isStale(card("AAA", "2026-10-08"), "2026-10-08"), false);
  assert.equal(isStale(card("AAA", null), "2026-10-08"), false);
  assert.equal(isStale(null, "2026-10-08"), false);
});

test("a card with no date is probably stale a quarter and a week after its latest report", () => {
  assert.equal(staleness(card("AAA", null, false, "2026-07-03"), "2026-10-08"), null); // 97 days
  assert.deepEqual(staleness(card("AAA", null, false, "2026-07-02"), "2026-10-08"), { kind: "probably" }); // 98 days
  assert.equal(staleness(card("AAA", "2026-10-20", false, "2026-06-01"), "2026-10-08"), null); // a date still ahead wins
});

test("today is the New York date, not UTC", () => {
  assert.equal(todayISO(new Date("2026-10-20T01:00:00Z")), "2026-10-19"); // 9 pm in New York on the 19th
  assert.equal(todayISO(new Date("2026-10-20T05:00:00Z")), "2026-10-20");
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test("coming up: the next thirty days by date, held or picked marked, and their undated names listed", () => {
  const o = { companies: [card("AAA", "2026-10-30"), card("BBB", "2026-10-10", false), card("CCC", "2026-11-30"), card("DDD", "2026-10-01"), card("EEE", "2026-10-08"), card("FFF", null), card("GGG", null)] };
  const { ahead, undated } = comingUp(o, "2026-10-08", 30, ["AAA", "FFF", "ZZZ"]);
  assert.deepEqual(ahead.map((r) => r.ticker), ["EEE", "BBB", "AAA"]);
  assert.deepEqual(ahead.map((r) => [r.days, r.confirmed, r.first]), [[0, true, false], [2, false, false], [22, true, true]]);
  assert.deepEqual(undated, [{ ticker: "FFF", name: "FFF Inc" }]);
});

test("what's next splits into ahead and recently by date, else by status", () => {
  const w = (item, extra) => ({ item, when: "x", kind: "other", source_url: "", ...extra });
  const items = [w("a", { date: "2026-12-07" }), w("b", { status: "ahead" }), w("c", { date: "2026-10-20", status: "ahead" }), w("d", { date: "2026-09-01" }),
    w("e", { status: "done" }), w("f", { date: "2026-10-01", status: "ahead" }), w("g", {}), w("h", { date: "2026-10-08" })];
  const g = splitWhatsNext(items, "2026-10-08");
  assert.deepEqual(g.ahead.map((x) => x.item), ["h", "c", "a", "b"]);
  assert.deepEqual(g.recent.map((x) => x.item), ["f", "d", "e"]); // a date that has passed wins over "ahead"
  assert.deepEqual(g.other.map((x) => x.item), ["g"]);
});

test("a day move is coloured by its sign as shown", () => {
  assert.deepEqual([-0.74, 0.74, 0.004, -0.004, null].map((v) => signTone(v, 2)), ["down", "accent", "flat", "flat", "flat"]);
  assert.equal(signTone(-0.04, 1), "flat");
  assert.equal(signTone(-0.05, 1), "down");
});

test("growth in words", () => {
  assert.equal(growthWords(62.4), "up 62% from a year earlier");
  assert.equal(growthWords(-3.25), "down 3.3% from a year earlier");
  assert.equal(growthWords(null), "");
});
