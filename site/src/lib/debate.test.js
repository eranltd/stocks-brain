import test from "node:test";
import assert from "node:assert/strict";
import { debateFor, debates } from "./debate.js";

const strong = { above_sma50: true, ret_60d_pct: 12, vs_bench_60d_pct: 6, from_high_pct: -2, change_1d_pct: 1 };
const weak = { above_sma50: false, ret_60d_pct: -15, vs_bench_60d_pct: -9, from_high_pct: -35, change_1d_pct: -6 };

test("a strong name: the bull wins", () => {
  const d = debateFor({ row: strong, flows: { analysts: { n: 20, buy_pct: 90, strong_buy: 10, buy: 8 }, short: { level: "low", pct: 20, base_pct: 32 } }, moat: "dominant" });
  assert.equal(d.verdict, "bull");
  assert.deepEqual(d.bull.map((p) => p.id), ["uptrend", "beatsMarket", "analystsLike", "shortsLow", "leader"]);
  assert.deepEqual(d.bear, []);
});

test("a weak name: the bear wins, with every reason a fact", () => {
  const d = debateFor({ row: weak, flows: { short: { level: "high", pct: 60, base_pct: 45 }, insiders: { side: "sold", mspr: -80 } },
    card: { next_earnings: { date: "2026-11-18" } }, moat: "crowded", today: "2026-11-14" });
  assert.equal(d.verdict, "bear");
  assert.deepEqual(d.bear.map((p) => p.id), ["downtrend", "lagsMarket", "fallingKnife", "bigDrop", "shortsHigh", "insidersSold", "resultsSoon", "crowded"]);
  assert.equal(d.bear.find((p) => p.id === "resultsSoon").days, 4);
});

test("balanced, and nothing to say without data", () => {
  assert.equal(debateFor({ row: { above_sma50: true, ret_60d_pct: 2 }, moat: "crowded" }).verdict, "balanced");
  assert.deepEqual(debateFor({}), { bull: [], bear: [], verdict: "balanced" });
  // a few analysts are not enough to count; results that passed are not "soon"
  const d = debateFor({ flows: { analysts: { n: 3, buy_pct: 10, strong_buy: 0, buy: 0 } }, card: { next_earnings: { date: "2026-11-01" } }, today: "2026-11-14" });
  assert.deepEqual(d.bear, []);
});

test("many names at once", () => {
  const out = debates(["AAA", "BBB"], { market: { symbols: [{ symbol: "AAA", ...weak }] }, themes: { themes: [{ companies: [{ symbol: "BBB", moat: "dominant" }] }] } });
  assert.equal(out.AAA.verdict, "bear");
  assert.deepEqual(out.BBB.bull.map((p) => p.id), ["leader"]);
});
