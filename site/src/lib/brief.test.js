import test from "node:test";
import assert from "node:assert/strict";
import { aboutPct, aboutTimes, BRIEF_FOOTER, direction, eightChecks, NO_CHECKLIST, plainSummary, readable, setupState, wherePaper } from "./brief.js";

const cfg = {
  house_rule: { min_reward_to_risk: 2 },
  steps: [
    { id: "candle", n: 1, name: "Candle pattern" }, { id: "trend", n: 2, name: "Trend" },
    { id: "volume", n: 3, name: "Volume" }, { id: "ma20", n: 4, name: "Moving average 20" },
    { id: "gaps", n: 5, name: "Gaps" }, { id: "levels", n: 6, name: "Support and resistance" },
    { id: "rsi", n: 7, name: "RSI" }, { id: "risk_plan", n: 8, name: "Risk management and exit" },
  ],
};

const row = (o = {}) => ({
  symbol: "AAA", as_of: "2026-10-08",
  candle: { lean: "bullish", daily: { lean: "bullish" }, weekly: { lean: "neutral" } },
  trend: { direction: "up", lean: "bullish" },
  volume: { verdict: "confirms", move: "rising", lean: "bullish", rising_on_falling_volume: false },
  ma20: { side: "above", slope_pct: 0.8, lean: "bullish" },
  gaps: { lean: "neutral", nearest: null },
  levels: { lean: "bullish", support: [{ dist_pct: -3 }], resistance: [{ dist_pct: 9 }] },
  rsi: { zone: "neutral", lean: "neutral", value: 58 },
  risk_plan: { stop_pct: 3.4, stop_basis: "support", tp1_pct: 8.6, tp1_basis: "resistance", tp2_pct: 14.2, tp2_basis: "resistance", rr_tp1: 2.53, rr_tp2: 4.2, fits_house_rule: true },
  score: { verdict: "lean_up", net: 4, leans: { candle: "bullish", trend: "bullish", volume: "bullish", ma20: "bullish", gaps: "neutral", levels: "bullish", rsi: "neutral" },
    summary: "Leans up: bullish candles, an uptrend, volume backs the rise. Reward-to-risk fits the house rule." },
  ...o,
});
const setupOk = { passed: 4, stretched: false, checks: { trend: true, rs_3m: true, rs_6m: true, calm: true } };

test("going up or down: the verdict as a big word with the checklist's own summary", () => {
  assert.deepEqual(direction(row()), { word: "Going up", tone: "accent", mark: "up", summary: "Buyers winning the last candles, an uptrend, volume backs the rise. The possible gain is big enough for the risk." });
  assert.equal(plainSummary("Mixed: an uptrend; against it, bearish candles, RSI overbought. Reward-to-risk is below the house rule."),
    "An uptrend; against it, sellers winning the last candles, RSI says overheated. The possible gain is too small for the risk.");
  assert.equal(direction(row({ score: { verdict: "mixed", summary: "Mixed. Reward-to-risk is below the house rule." } })).word, "Mixed");
  assert.equal(direction(row({ score: { verdict: "lean_down", summary: "Leans down: a downtrend." } })).summary, "A downtrend.");
  assert.equal(direction(null), null);
  assert.equal(plainSummary(undefined), "");
});

test("readable: no checklist, no row, an older close, or today's reading", () => {
  assert.deepEqual(readable(null, null), { ok: false, why: NO_CHECKLIST });
  assert.match(readable({ symbols: [] }, null).why, /not enough price history/);
  assert.match(readable({}, row(), "2026-10-09").why, /older close/);
  assert.deepEqual(readable({}, row(), "2026-10-08"), { ok: true, why: null });
  assert.match(readable({ sample: true }, row(), "2026-10-08").why, /sample prices/);
  assert.deepEqual(readable({ sample: true }, row(), "2026-10-08", { sampleSite: true }), { ok: true, why: null });
});

test("the eight checks, each with a mark, plain words and its Hebrew name", () => {
  const rows = eightChecks(row(), cfg);
  assert.deepEqual(rows.map((r) => r.id), ["candle", "trend", "volume", "ma20", "gaps", "levels", "rsi", "risk_plan"]);
  assert.deepEqual(rows.map((r) => r.mark), ["up", "up", "up", "up", "neutral", "up", "neutral", "up"]);
  assert.deepEqual(rows.map((r) => r.text), [
    "Last candle: buyers won the day", "Trend: going up", "Volume: supports the move", "Above its 20-day average, which is rising",
    "No open gaps", "Room to rise before resistance", "RSI: not overheated", "Risk plan: worth it",
  ]);
  assert.equal(rows[0].name_he, undefined);
  assert.equal(rows[7].n, 8);
});

test("the eight checks: the bearish and in-between wordings", () => {
  const r = eightChecks(row({
    candle: { lean: "neutral", daily: { lean: "bullish" }, weekly: { lean: "bearish" } },
    trend: { direction: "down" }, volume: { verdict: "weakening", move: "rising", rising_on_falling_volume: true },
    ma20: { side: "below", slope_pct: -0.3 }, gaps: { lean: "bullish", nearest: { where: "above" } },
    levels: { lean: "bearish", support: [{}], resistance: [{}] }, rsi: { zone: "overbought" },
    risk_plan: { ...row().risk_plan, fits_house_rule: false, rr_tp1: 1.2 },
    score: { verdict: "lean_down", leans: { candle: "neutral", trend: "bearish", volume: "bearish", ma20: "bearish", gaps: "bullish", levels: "bearish", rsi: "bearish" } },
  }), cfg);
  assert.deepEqual(r.map((x) => x.text), [
    "Last candles: the day and the week disagree", "Trend: going down", "Volume: rising on falling volume, careful", "Below its 20-day average, which is falling",
    "Open gap above: may get filled", "Close to resistance: may stall", "RSI: overheated", "Risk plan: not worth it",
  ]);
  assert.deepEqual(r.map((x) => x.mark), ["neutral", "down", "down", "down", "up", "down", "down", "down"]);
  const more = eightChecks(row({
    candle: { lean: "bearish" }, trend: { direction: "sideways" }, volume: { verdict: "weakening", move: "falling" },
    ma20: { side: "above", slope_pct: -0.1 }, gaps: { lean: "bearish", nearest: {} }, levels: { lean: "bearish", support: [], resistance: [{}] },
    rsi: { zone: "oversold" }, risk_plan: { ...row().risk_plan, tp1_basis: "risk_multiple" },
  }), cfg).map((x) => x.text);
  assert.deepEqual(more, [
    "Last candle: sellers won the day", "Trend: sideways, no clear direction", "Volume: the selling is fading", "Above its 20-day average, but the average is falling",
    "Open gap below: may get filled", "Nothing below to catch a fall", "RSI: oversold", "Risk plan: worth it, on paper",
  ]);
  const rest = eightChecks(row({ volume: { verdict: "confirms", move: "falling" }, ma20: { side: "below", slope_pct: 0.2 }, gaps: { lean: "neutral", nearest: {} }, levels: { lean: "neutral" }, risk_plan: null }), cfg);
  assert.deepEqual([rest[2].text, rest[3].text, rest[4].text, rest[5].text, rest[7].text], [
    "Volume: backs the fall", "Below its 20-day average, but the average is rising", "Open gaps far away: not in play", "Between support and resistance", "Risk plan: not available",
  ]);
  assert.equal(eightChecks(row({ levels: { lean: "bullish", support: [{}], resistance: [] } }), cfg)[5].text, "Nothing overhead: above every level of the past year");
  assert.equal(eightChecks(row({ volume: { verdict: "neutral", move: "flat" } }), cfg)[2].text, "Volume: price about flat, nothing to confirm");
  assert.equal(eightChecks(row({ volume: { verdict: "neutral", move: "rising" } }), cfg)[2].text, "Volume: no clear signal");
});

test("rounded whole percents and reward-to-risk in words", () => {
  assert.deepEqual([3.4, 8.6, 0.3, -2.5, NaN].map(aboutPct), ["about 3%", "about 9%", "less than 1%", "about 3%", ""]);
  assert.deepEqual([2.53, 2.0, 12.4].map(aboutTimes), ["about 2.5", "about 2", "about 12"]);
});

test("where to invest on paper: within the rules, the plan in whole percents", () => {
  const w = wherePaper({ row: row(), setup: setupOk });
  assert.equal(w.ok, true);
  assert.equal(w.head, "Within the house rules for a paper entry");
  assert.deepEqual(w.plan, [
    "Stop: sell if it falls about 3% (just under support)",
    "First target: take some profit about 9% higher (at resistance)",
    "Second target: about 14% higher",
    "You risk one to make about 2.5",
  ]);
  assert.deepEqual([w.why, w.wait], [[], []]);
  const built = wherePaper({ row: row({ risk_plan: { ...row().risk_plan, tp1_basis: "risk_multiple", stop_basis: "atr" } }), setup: setupOk });
  assert.match(built.plan[0], /two normal days' swings/);
  assert.match(built.plan[1], /nothing overhead, so set at twice the risk/);
  for (const s of [...w.plan, w.head]) assert.doesNotMatch(s, /buy now/i);
});

test("where to invest on paper: why not, and what would change it", () => {
  const hot = wherePaper({ row: row({ rsi: { zone: "overbought" } }), setup: { passed: 3, stretched: true, checks: { trend: true, rs_3m: true, rs_6m: false, calm: false } } });
  assert.equal(hot.ok, false);
  assert.equal(hot.head, "Not within the house rules today");
  assert.deepEqual(hot.why, ["it has run too far above its trend"]);
  assert.deepEqual(hot.wait, ["wait until it cools down"]);
  assert.deepEqual(hot.plan, []);
  const weak = wherePaper({ row: row({ trend: { direction: "down" }, risk_plan: { ...row().risk_plan, fits_house_rule: false } }), setup: { passed: 1, stretched: false, checks: { trend: false, rs_3m: false, rs_6m: false, calm: true } }, benchLabel: "the Nasdaq-100" });
  assert.deepEqual(weak.why, ["fewer than three of the four setup checks pass", "the possible gain is too small for the risk"]);
  assert.deepEqual(weak.wait, ["wait for the trend to turn up", "wait until it does better than the Nasdaq-100 again", "wait for a pullback toward support, or a clean break above resistance"]);
  const noCk = wherePaper({ row: null, setup: setupOk, read: { ok: false, why: NO_CHECKLIST } });
  assert.deepEqual([noCk.ok, noCk.why, noCk.wait], [false, ["the risk plan needs today's checklist"], ["wait for the next daily run"]]);
  const noPlan = wherePaper({ row: row({ risk_plan: null }), setup: setupOk });
  assert.deepEqual(noPlan.why, ["there is no written risk plan for it"]);
  // a down trend in the checklist adds its own wait, even when the setup checks pass
  assert.deepEqual(wherePaper({ row: row({ trend: { direction: "down" }, risk_plan: { ...row().risk_plan, fits_house_rule: false } }), setup: setupOk }).wait,
    ["wait for a pullback toward support, or a clean break above resistance", "wait for the trend to turn up"]);
});

test("setup state from derived.json, with or without the computed block", () => {
  assert.deepEqual(setupState({ setup: { checks: { trend: true, rs_3m: false, rs_6m: true, calm: true }, passed: 3, stretched: false } }),
    { passed: 3, stretched: false, checks: { trend: true, rs_3m: false, rs_6m: true, calm: true } });
  assert.deepEqual(setupState({ dist_sma50_pct: 9, vs_bench_60d_pct: 1, vs_bench_120d_pct: -1 }, 8), { passed: 2, stretched: true, checks: { trend: true, rs_3m: true, rs_6m: false, calm: false } });
});

test("the footer says paper, unproven and the index fund", () => {
  assert.match(BRIEF_FOOTER, /On paper only/);
  assert.match(BRIEF_FOOTER, /unproven/);
  assert.match(BRIEF_FOOTER, /index fund/);
});
