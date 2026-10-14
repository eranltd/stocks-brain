import test from "node:test";
import assert from "node:assert/strict";
import { HORIZONS, honestAction, moneyFacts, stocksEarned } from "./money.js";

const facts = { fundName: "the whole-market fund", cashName: "T-bills", cashYield: 3.65, cagr: 16.78, years: 7, maxDrop: -33.7, worstYear: -19.73 };

test("each horizon gets its own honest action, with today's numbers", () => {
  assert.deepEqual(HORIZONS.map((h) => h.id), ["long", "medium", "short"]);
  const long = honestAction("long", facts);
  assert.match(long.title, /whole market/);
  assert.match(long.why, /about 17% a year on average; over many decades the average is closer to 10% a year/);
  assert.match(long.risk, /fell 34% from its top/);
  const medium = honestAction("medium", facts);
  assert.match(medium.steps[0], /T-bills\. They pay about 3\.6% a year right now\./);
  assert.match(medium.risk, /lost 20%/);
  const short = honestAction("short", facts);
  assert.equal(short.title, "Keep it safe.");
  assert.match(short.steps[1], /not put money you need within a year into stocks/);
});

test("without data it still says something true", () => {
  const a = honestAction("long");
  assert.match(a.why, /about 10% a year/);
  assert.doesNotMatch(a.risk, /undefined|null/);
});

test("stocks earn a real-money place only after passing history AND reaching Small money", () => {
  const rejected = { frozen: { satellite: { a: { verdict: "rejected" } } } };
  const passed = { frozen: { satellite: { a: { verdict: "passes_history" } } } };
  assert.equal(stocksEarned(rejected, 3), false);
  assert.equal(stocksEarned(passed, 1), false);
  assert.equal(stocksEarned(passed, 2), true);
  assert.equal(stocksEarned(null, 3), false);
});

test("moneyFacts reads the data, names from config", () => {
  const f = moneyFacts({ core: { symbol: "IDX" }, market: { context: { cash_yield_pct: 3.5, instruments: [{ role: "cash", symbol: "CSH" }] } },
    longrun: { stats: { core: { cagr_pct: 10, years: 7, max_dd_pct: -30, worst_12m_pct: -15 } } } });
  assert.match(f.fundName, /like IDX/);
  assert.match(f.cashName, /like CSH/);
  assert.equal(f.cashYield, 3.5);
  assert.equal(moneyFacts({}).cagr, null);
});
