import test from "node:test";
import assert from "node:assert/strict";
import { buildDeck } from "./swipe.js";

test("the deck: my list first, each name once, biggest move first, with its facts", () => {
  const mine = { watchlist: { symbols: [{ symbol: "AAA", name: "Aaa" }, { symbol: "BBB", name: "Bbb" }] },
    market: { symbols: [{ symbol: "AAA", change_1d_pct: 1, spark: [{ v: 100 }, { v: 101 }] }, { symbol: "BBB", change_1d_pct: -7 }] } };
  const main = { watchlist: { symbols: [{ symbol: "AAA", name: "Other" }, { symbol: "CCC", name: "Ccc" }, { symbol: "DDD", name: "Ddd" }] },
    market: { symbols: [{ symbol: "AAA", change_1d_pct: 9 }, { symbol: "CCC", change_1d_pct: 3 }] } };
  const deck = buildDeck({
    lists: [mine, main],
    outlook: { companies: [{ ticker: "AAA", plain: "Makes things." }] },
    flows: { sample: false, symbols: [{ symbol: "BBB", analysts: { strong_buy: 2, buy: 3, n: 8 } }] },
    themes: { themes: [{ name: "Space", companies: [{ symbol: "CCC", moat: "dominant", note: "The leader." }] }] },
    companies: { AAA: "Makes widgets for everyone." },
  });
  assert.equal(deck.find((c) => c.symbol === "AAA").what, "Makes widgets for everyone.");
  assert.equal(deck.find((c) => c.symbol === "BBB").what, null);
  assert.deepEqual(deck.map((c) => c.symbol), ["BBB", "CCC", "AAA"]); // DDD has no numbers
  assert.equal(deck.find((c) => c.symbol === "AAA").name, "Aaa"); // my list's row wins
  assert.equal(deck.find((c) => c.symbol === "AAA").about, "Makes things.");
  assert.deepEqual(deck.find((c) => c.symbol === "AAA").spark, [100, 101]);
  assert.deepEqual(deck.find((c) => c.symbol === "BBB").analysts, { buy: 5, n: 8 });
  assert.deepEqual(deck.find((c) => c.symbol === "CCC").moat, { level: "dominant", theme: "Space" });
  assert.equal(deck.find((c) => c.symbol === "CCC").about, "The leader.");
});
