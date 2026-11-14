import test from "node:test";
import assert from "node:assert/strict";
import { themeMarkets, themeRows, themeYear } from "./themes.js";

const theme = { id: "t", companies: [{ symbol: "AAA", market: "m1", moat: "dominant", note: "n" }, { symbol: "BBB", market: "m1", moat: "crowded", note: "n" },
  { symbol: "CCC", market: "m2", moat: "few_rivals", note: "n" }] };
const views = {
  m1: { names: { AAA: "Aaa Inc." }, market: { symbols: [{ symbol: "AAA", ret_250d_pct: 100, vs_bench_250d_pct: 80 }, { symbol: "BBB", ret_250d_pct: -50, vs_bench_250d_pct: -70 }] } },
  m2: { names: {}, market: { symbols: [{ symbol: "CCC", ret_250d_pct: null }] } },
};

test("rows join each company with its market's numbers", () => {
  const rows = themeRows(theme, views);
  assert.deepEqual(rows.map((r) => [r.symbol, r.name, r.row?.ret_250d_pct ?? null]), [["AAA", "Aaa Inc.", 100], ["BBB", "BBB", -50], ["CCC", "CCC", null]]);
  assert.equal(themeRows(theme, {})[0].row, null);
});

test("the year: winners and losers both count; names listed under a year are left out", () => {
  const y = themeYear(themeRows(theme, views));
  assert.equal(y.n, 2);
  assert.equal(y.short, 1);
  assert.equal(y.avg, 25);
  assert.equal(y.vsMarket, 5);
  assert.equal(y.best.symbol, "AAA");
  assert.equal(y.worst.symbol, "BBB");
  assert.equal(y.start, 2000);
  assert.equal(y.now, 2500);
  assert.equal(y.up, 1);
  assert.equal(themeYear([]).n, 0);
  assert.equal(themeYear(themeRows(theme, {})).short, 0); // no numbers yet is not "listed under a year"
});

test("the markets the themes read, once each", () => {
  assert.deepEqual(themeMarkets({ themes: [theme, { companies: [{ market: "m2" }] }] }), ["m1", "m2"]);
});
