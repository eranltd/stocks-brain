import test from "node:test";
import assert from "node:assert/strict";
import { analystsWord, flowsFor, shortBars } from "./flows.js";

const doc = { sample: false, symbols: [{ symbol: "AAA", short: { history: Array.from({ length: 30 }, (_, i) => ({ d: `d${i}`, p: i })) }, analysts: null, insiders: null }] };

test("the row for a symbol; none for a sample file or an unknown name", () => {
  assert.equal(flowsFor(doc, "AAA").symbol, "AAA");
  assert.equal(flowsFor(doc, "BBB"), null);
  assert.equal(flowsFor({ ...doc, sample: true }, "AAA"), null);
  assert.equal(flowsFor(null, "AAA"), null);
});

test("analysts in one word", () => {
  const a = (sb, b, h, s, ss) => ({ strong_buy: sb, buy: b, hold: h, sell: s, strong_sell: ss, n: sb + b + h + s + ss, buy_pct: Math.round(((sb + b) / (sb + b + h + s + ss)) * 100) });
  assert.equal(analystsWord(a(25, 41, 2, 1, 0)), "strongBuy");
  assert.equal(analystsWord(a(5, 7, 6, 0, 0)), "buy");
  assert.equal(analystsWord(a(2, 3, 10, 1, 0)), "mixed");
  assert.equal(analystsWord(a(0, 1, 3, 4, 1)), "sell");
  assert.equal(analystsWord(null), null);
});

test("the short-sale bars: the last 20 days", () => {
  const bars = shortBars(doc.symbols[0].short);
  assert.equal(bars.length, 20);
  assert.equal(bars[19].p, 29);
  assert.deepEqual(shortBars(null), []);
});
