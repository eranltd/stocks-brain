import test from "node:test";
import assert from "node:assert/strict";
import { earningsInWindow, forwardLine, historyLine, rText, swingList, swingOf, swingView, windowDays } from "./swing.js";
import { tableProblems } from "./text.js";
import dict from "../text/swing.js";

const params = { trend_sma_days: 50, pullback_sma_days: 20, max_stop_pct: 8, target_r: 2, time_stop_days: 10 };
const sw = (over = {}) => ({
  state: "setup", checks: { uptrend: true, pullback: true, trigger: true, risk_ok: true },
  dist_trend_avg_pct: 4.95, trend_avg_slope_pct: 1.2, dist_pullback_avg_pct: 0.4, depth_pct: 6.1, days_since_low: 2,
  stop_pct: 5.6, target_pct: 11.21, high_pct: 12.5, rr_high: 2.23, ...over,
});
const doc = {
  benchmark: "ZZB",
  symbols: [
    { symbol: "ZZA", swing: sw({ rr_high: 0.5 }) },
    { symbol: "ZZC", swing: sw() },
    { symbol: "ZZD", swing: sw({ state: "watch", checks: { uptrend: true, pullback: true, trigger: false, risk_ok: true } }) },
    { symbol: "ZZE", swing: sw({ state: "none" }) },
    { symbol: "ZZB", swing: sw() },
    { symbol: "ZZF" },
  ],
  swing: {
    params,
    base_rates: { from: "2017-01-03", to: "2026-11-02", names: 21, setup: { n: 1079, mean: 0.104, ci_low: 0.049, ci_high: 0.16, hit_pct: 48.1 },
      uptrend: { n: 2163, mean: 0.005 } },
    forward: { started: "2026-11-20", signals: [{ date: "2026-11-20", symbol: "ZZC", status: "running" }], running: 1, stats: { n: 0, mean: null } },
  },
};

test("the swing texts are well formed", () => {
  assert.deepEqual(tableProblems(dict), []);
});

test("swingOf and swingList read the document, leave the benchmark out, best room first", () => {
  assert.equal(swingOf(doc, "ZZC").state, "setup");
  assert.equal(swingOf(doc, "ZZF"), null);
  assert.equal(swingOf(null, "ZZC"), null);
  const l = swingList(doc);
  assert.deepEqual(l.setup.map((r) => r.symbol), ["ZZC", "ZZA"]);
  assert.deepEqual(l.watch.map((r) => r.symbol), ["ZZD"]);
});

test("swingView: four checks in words, the plan, and warnings", () => {
  const v = swingView(sw(), params);
  assert.equal(v.state, "setup");
  assert.equal(v.tone, "up");
  assert.deepEqual(v.checks.map((c) => c.ok), [true, true, true, true]);
  assert.match(v.checks[0].text, /50-day average/);
  assert.match(v.checks[1].text, /low 2 days ago/);
  assert.match(v.checks[3].text, /−5\.6%/);
  assert.deepEqual(v.warnings, []);
  assert.equal(v.stop, 5.6);
  const near = swingView(sw({ high_pct: 2.8, rr_high: 0.5 }), params);
  assert.deepEqual(near.warnings.map((w) => w.id), ["high"]);
  assert.match(near.warnings[0].text, /\+2\.8%/);
  const none = swingView(sw({ state: "none", rr_high: 0.1 }), params);
  assert.deepEqual(none.warnings, [], "no room warning when it is not a setup");
  assert.equal(swingView(null, params), null);
});

test("results inside the window turn a setup into a skip", () => {
  assert.equal(windowDays(params), 16);
  const card = { next_earnings: { date: "2026-12-01", confirmed: true } };
  const e = earningsInWindow(card, "2026-11-20", params);
  assert.deepEqual(e, { date: "2026-12-01", days: 11, confirmed: true });
  assert.equal(earningsInWindow(card, "2026-11-10", params), null, "17 days away: outside");
  assert.equal(earningsInWindow(card, "2026-12-02", params), null, "past");
  assert.equal(earningsInWindow(null, "2026-11-20", params), null);
  const v = swingView(sw(), params, { earnings: e });
  assert.equal(v.state, "watch");
  assert.equal(v.raw, "setup");
  assert.match(v.line, /results are due/);
  assert.match(v.warnings[0].text, /in 11 days/);
});

test("history and forward lines", () => {
  assert.equal(rText(0.104), "+0.10R");
  assert.equal(rText(-1), "−1.00R");
  assert.equal(rText(null), "–");
  const h = historyLine(doc.swing);
  assert.match(h, /since 2017: 1,079 setups traded, 48% winners, average \+0\.10R/);
  assert.match(h, /any uptrend day: \+0\.01R/);
  assert.equal(historyLine({ base_rates: null }), null);
  assert.match(forwardLine(doc.swing), /1 setup, 1 still running, 0 finished/);
  assert.match(forwardLine({ forward: { started: "2026-11-20", signals: [], stats: { n: 0 } } }), /no setups yet/);
  assert.equal(forwardLine(null), null);
});
