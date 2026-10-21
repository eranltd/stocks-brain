import test from "node:test";
import assert from "node:assert/strict";
import { HORIZONS, honestAction, moneyFacts, stocksEarned, lumpSum } from "./money.js";

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

test("the lump-sum guide uses the savings history test when it exists", () => {
  const rulesResult = { savings: { horizons: [{ weeks: 52, rows: [
    { id: "windfall_lump_sum", windows: 103, worst_vs_paid_median_pct: -8.25 },
    { id: "windfall_spread_26w", windows: 103, vs_baseline_better_pct: 24.3, worst_vs_paid_median_pct: -4.04 },
  ] }] } };
  const g = lumpSum(rulesResult);
  assert.equal(g.steps.length, 5);
  assert.match(g.steps[2], /103 start dates.*76 times in 100.*4% down instead of 8%/);
  assert.match(lumpSum(null).steps[2], /usually beat spreading/);
  assert.equal(g.before.length, 3);
});

test("Hebrew: the honest action and the lump-sum steps, in infinitives, with the numbers kept whole", async () => {
  const { stripBidi, hasHebrew } = await import("./i18n.js");
  const { horizons } = await import("./money.js");
  const S = stripBidi;
  const f = moneyFacts({ core: { symbol: "IDX" }, market: { context: { cash_yield_pct: 3.65, instruments: [{ role: "cash", symbol: "CSH" }] } },
    longrun: { stats: { core: { cagr_pct: 16.78, years: 7, max_dd_pct: -33.7, worst_12m_pct: -19.73 } } } }, "he");
  assert.match(S(f.fundName), /כמו IDX\)$/);
  const medium = honestAction("medium", f, "he");
  assert.equal(S(medium.steps[0]), "לשים חלק בחיסכון ממשלתי לטווח קצר (T-bills, כמו CSH). התשואה כרגע היא בערך 3.6% בשנה.");
  assert.match(medium.steps[0], /⁦3\.6%⁩/, "the percent stays with its number");
  assert.match(S(medium.risk), /הפסיד 20%\.$/);
  const long = honestAction("long", {}, "he");
  assert.equal(long.title, "לקנות את השוק כולו, קצת בכל שבוע, ולא לגעת.");
  assert.match(long.why, /לאורך עשרות שנים היא צמחה בממוצע בערך 10% בשנה/);
  assert.equal(honestAction("short", {}, "he").title, "לשמור את הכסף במקום בטוח.");
  for (const h of ["long", "medium", "short"]) {
    const a = honestAction(h, f, "he");
    for (const s of [a.title, ...a.steps, a.why, a.risk]) { assert.ok(hasHebrew(s), s); assert.doesNotMatch(s, /undefined|null|מומלץ|המלצ|כדאי לקנות/); }
  }
  const rulesResult = { savings: { horizons: [{ weeks: 52, rows: [
    { id: "windfall_lump_sum", windows: 103, worst_vs_paid_median_pct: -8.25 },
    { id: "windfall_spread_26w", windows: 103, vs_baseline_better_pct: 24.3, worst_vs_paid_median_pct: -4.04 },
  ] }] } };
  const g = lumpSum(rulesResult, null, "he");
  assert.match(S(g.steps[2]), /^השאר נכנס בקנייה אחת אל הקרן על כל השוק\. במבחן של האתר על 103 תאריכי התחלה.*76 פעמים מתוך 100.*ירידה של 4% במקום 8%\)\.$/);
  assert.equal(g.before.length, 3);
  assert.deepEqual(horizons("he").map((h) => h.id), HORIZONS.map((h) => h.id));
  assert.equal(horizons("he")[2].label, "בתוך שנה");
  assert.equal(horizons(), HORIZONS);
});
