import test from "node:test";
import assert from "node:assert/strict";
import { dotIndex, MINI_DAYS, miniGeometry, miniSummary, miniWindow, monthDirection, nearCards, snapStops, stepStop, TOP_MAX, topStocks } from "./carousel.js";
import { companiesToKnow } from "./simple.js";

const outlook = {
  companies: [
    { ticker: "AAA", plain: "Microsoft: its cloud business is growing fast." },
    { ticker: "CCC", plain: "Meta: ad sales grew strongly, but costs grew even faster." },
  ],
};
const names = { AAA: "Microsoft", BBB: "PepsiCo", CCC: "Meta Platforms", EEE: "Apple", FFF: "NVIDIA", IDX: "Nasdaq-100" };
const movers = (n) => Array.from({ length: n }, (_, i) => ({ symbol: `M${String.fromCharCode(65 + i)}`, pct: 5 - i * 0.3 }));
const day = (o = {}) => ({ date: "2026-10-08", risers: [{ symbol: "FFF", pct: 2.1 }, ...movers(9)], fallers: [{ symbol: "CCC", pct: -4.2 }, { symbol: "IDX", pct: -9 }], ...o });
const checklist = { symbols: [
  { symbol: "AAA", score: { verdict: "lean_up", summary: "Leans up: bullish candles, an uptrend." } },
  { symbol: "EEE", score: { verdict: "mixed", summary: "Mixed: bullish candles; against it, RSI overbought. Reward-to-risk is below the house rule." } },
] };

test("top stocks: the companies-to-know order, carried on to eight", () => {
  const args = { held: ["AAA", "EEE"], picked: ["AAA", "CCC"], day: day(), outlook, checklist, names, bench: "IDX" };
  const top = topStocks({ ...args, candles: { AAA: "market/candles/AAA.json", CCC: "x" } });
  assert.equal(top.length, TOP_MAX);
  const know = companiesToKnow(args);
  assert.deepEqual(top.slice(0, know.length).map((c) => c.ticker), know.map((c) => c.ticker), "the same names first, in the same order");
  assert.deepEqual(top.slice(0, 4).map((c) => c.ticker), ["AAA", "EEE", "CCC", "MA"]);
  assert.ok(!top.some((c) => c.ticker === "IDX"), "never the benchmark");
  assert.deepEqual(top.map((c) => c.hasChart).slice(0, 3), [true, false, true]);
  assert.equal(top[0].to, "stock/AAA#brief");
  assert.equal(top[0].candlesTo, "stock/AAA#checklist");
  assert.equal(top[0].chip.word, "Going up");
  assert.equal(top[2].chip, null, "no chip without a checklist row");
  // the outlook's plain line first, else the checklist's own summary in everyday words
  assert.equal(top[0].plain, "Microsoft: its cloud business is growing fast.");
  assert.equal(top[1].plain, "Buyers winning the last candles; against it, RSI says overheated. The possible gain is too small for the risk.");
  assert.equal(top[3].plain, null);
  // fewer names than eight: all of them, nothing invented
  assert.equal(topStocks({ held: ["AAA"], picked: [], day: day({ risers: [], fallers: [] }), outlook, checklist: null, names }).length, 1);
  assert.equal(topStocks({ held: [], picked: [], day: null, outlook: null, checklist: null }).length, 0);
});

const doc = (n, f = (i) => i - n) => {
  const dates = Array.from({ length: n }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  const c = dates.map((_, i) => f(i) - f(n - 1)); // percent from the last close: the last close is 0
  return { daily: { dates, o: c.map((v) => v - 0.5), h: c.map((v) => v + 1), l: c.map((v) => v - 1), c, ma20: c.map((v, i) => (i < 3 ? null : v - 0.2)) } };
};

test("mini window: the last month of days, holes stay holes", () => {
  const win = miniWindow(doc(40));
  assert.equal(win.n, MINI_DAYS);
  assert.equal(win.dates[0], "2026-09-19");
  assert.equal(win.c.at(-1), 0);
  assert.equal(miniWindow(doc(5)).n, 5, "a short history shows what there is");
  assert.equal(miniWindow(null), null);
  assert.equal(miniWindow({ daily: { dates: [] } }), null);
  const holed = doc(10);
  holed.daily.o[4] = null;
  const w = miniWindow(holed);
  assert.equal(w.ok[4], false);
  assert.equal(miniGeometry(w, 300, 120).candles.length, 9, "no candle drawn for a hole");
});

test("mini geometry: candles inside the box, the last close marked", () => {
  const win = miniWindow(doc(40));
  const g = miniGeometry(win, 320, 140);
  assert.equal(g.candles.length, MINI_DAYS);
  for (const k of g.candles) {
    assert.ok(k.x >= 0 && k.x + k.w <= 320, "inside horizontally");
    assert.ok(k.wickTop >= 0 && k.wickBot <= 140, "inside vertically");
    assert.ok(k.w % 2 === 1, "odd body widths centre on the wick");
  }
  assert.ok(g.candles.every((k, i, a) => !i || k.cx > a[i - 1].cx), "left to right in date order");
  assert.ok(g.candles.every((k) => k.up && k.hollow), "rising closes: hollow up candles");
  assert.equal(g.last.cx, g.candles.at(-1).cx);
  assert.ok(g.last.cy > 0 && g.last.cy < 140);
  assert.match(g.ma, /^M/);
  assert.equal(miniGeometry(win, 0, 140), null);
  assert.equal(miniGeometry(null, 300, 140), null);
});

test("mini chart in words: direction and a summary with no digits", () => {
  assert.equal(monthDirection(miniWindow(doc(30))), "up");
  assert.equal(monthDirection(miniWindow(doc(30, (i) => -i))), "down");
  assert.equal(monthDirection(miniWindow(doc(30, () => 0))), "flat");
  const s = miniSummary("Microsoft", miniWindow(doc(30)));
  assert.match(s, /mostly up days; it ended the month higher than it began/);
  assert.doesNotMatch(s, /\d/);
  assert.equal(miniSummary("Apple", null), "Apple: no chart yet.");
});

test("snap stops and dots: one per card, fewer when two fit side by side", () => {
  // phone: one card and a peek; eight cards of 300px + 12px gap; the scroller is 360 wide
  const step = 312, total = 8 * 300 + 7 * 12;
  const phone = snapStops(8, step, total - 360);
  assert.equal(phone.length, 8);
  assert.equal(phone[0], 0);
  assert.equal(phone.at(-1), total - 360, "the last stop is the end");
  // iPad: two cards and a peek, the scroller 760 wide: the last card never reaches the start
  const pad = snapStops(8, step, total - 760);
  assert.equal(pad.length, 7);
  assert.ok(pad.every((s, i) => !i || s > pad[i - 1]), "increasing");
  assert.deepEqual(snapStops(1, 312, 0), [0], "one card: one stop");
  assert.deepEqual(snapStops(0, 312, 0), [0]);
  // the lit dot is the nearest stop
  assert.equal(dotIndex(0, phone), 0);
  assert.equal(dotIndex(320, phone), 1);
  assert.equal(dotIndex(total - 361, phone), 7);
  assert.equal(dotIndex(150, [0]), 0);
  // arrows and keys move one stop, clamped
  assert.equal(stepStop(phone, 0, 1), 312);
  assert.equal(stepStop(phone, 0, -1), 0);
  assert.equal(stepStop(phone, phone.at(-1), 1), phone.at(-1));
});

test("charts load near the viewport", () => {
  assert.deepEqual(nearCards(0, 360, 312, 8), [0, 2], "the card, its peeking neighbour and one more");
  assert.deepEqual(nearCards(312 * 3, 360, 312, 8), [2, 5]);
  assert.deepEqual(nearCards(312 * 7, 360, 312, 8), [6, 7], "clamped at the end");
  assert.deepEqual(nearCards(0, 0, 0, 0), [0, 0]);
});
