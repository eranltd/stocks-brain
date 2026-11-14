import test from "node:test";
import assert from "node:assert/strict";
import { easyNews, lightOf, moveWord, myStocks, plainIndex } from "./easy.js";

test("the traffic light", () => {
  assert.deepEqual(lightOf({ mood: "selloff", fear: { level: "panic" } }), { light: "red", key: "selloff" });
  assert.deepEqual(lightOf({ mood: "flat", fear: { level: "panic" } }), { light: "red", key: "panic" });
  assert.deepEqual(lightOf({ mood: "down", fear: null }), { light: "yellow", key: "down" });
  assert.deepEqual(lightOf({ mood: "up", fear: { level: "calm" } }), { light: "green", key: "up" });
  assert.deepEqual(lightOf(null), { light: "green", key: "calm" });
});

test("moves in words", () => {
  assert.equal(moveWord(-6.5), "bigDrop");
  assert.equal(moveWord(-2), "down");
  assert.equal(moveWord(-0.5), "littleDown");
  assert.equal(moveWord(0.1), "same");
  assert.equal(moveWord(0.6), "littleUp");
  assert.equal(moveWord(3), "up");
  assert.equal(moveWord(12), "bigJump");
  assert.equal(moveWord(null), null);
  assert.equal(moveWord(8, "year"), "up");
  assert.equal(moveWord(30, "year"), "bigJump");
  assert.equal(moveWord(5.8, "month"), "up");
});

test("simple news: my names first, then the market; plain index names", () => {
  const live = { sample: false, company_news: [{ symbol: "AAA", headline: "A1", at: 2 }, { symbol: "ZZZ", headline: "Z1", at: 9 }],
    market_news: [{ headline: "M1", at: 5 }, { headline: "A1", at: 1 }] };
  assert.deepEqual(easyNews(live, ["AAA"]).map((n) => n.headline), ["A1", "M1"]);
  assert.deepEqual(easyNews(null, ["AAA"]), []);
  assert.equal(plainIndex("Nasdaq-100 (QQQ proxy)"), "Nasdaq-100");
});

test("my stocks: the pulse first, else the close; best first; the 3 biggest moves", () => {
  const watch = [{ symbol: "AAA", name: "Aaa" }, { symbol: "BBB", name: "Bbb" }, { symbol: "CCC", name: "Ccc" }, { symbol: "DDD", name: "Ddd" }];
  const close = [{ symbol: "AAA", change_1d_pct: 1 }, { symbol: "BBB", change_1d_pct: -9 }, { symbol: "CCC", change_1d_pct: 0.2 }];
  const s = myStocks(watch, close, [{ symbol: "AAA", move_pct: 4 }]);
  assert.deepEqual(s.rows.map((r) => [r.symbol, r.move]), [["AAA", 4], ["CCC", 0.2], ["BBB", -9]]);
  assert.deepEqual(s.top.map((r) => r.symbol), ["BBB", "AAA", "CCC"]);
  assert.deepEqual([s.up, s.down, s.n], [2, 1, 3]);
});
