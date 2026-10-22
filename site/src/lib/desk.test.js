import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bossCall, callCounts, deskCalls, execCandidates, execution, freshness, houseLimits, marketDateOf, newsCards, riskCheck, rrText,
  scannerRows, sortScanner, stanceFor, stanceLean, statTiles, strategyRows, unusualToday,
} from "./desk.js";
import { unusualItems } from "./feed.js";
import home from "../text/home.js";

// Made-up names only: AAA, BBB, CCC.

/** A checklist row that passes every Execution confirmation and every Risk limit. */
const good = (over = {}) => ({
  symbol: "AAA",
  candle: { lean: "bullish", daily: { lean: "bullish" } },
  trend: { direction: "up" },
  volume: { lean: "bullish", vs_avg20: 1.3 },
  levels: { support: [{ dist_pct: -1.0 }], resistance: [{ dist_pct: 6 }] },
  risk_plan: { atr_pct: 2, stop_pct: 3, tp1_pct: 6.5, tp2_pct: 9, rr_tp1: 2.17, fits_house_rule: true },
  score: { net: 4 },
  ...over,
});
const up = { symbol: "AAA", change_1d_pct: 1.2, dist_sma50_pct: 3, setup: { stretched: false } };
const LIMITS = { minRR: 2, stopAtrMax: 2, stretchPct: 8 };

/* ----------------------------------------------------------------- boss */

test("boss decision table: first match wins", () => {
  const pass = { pass: true, reasons: [] };
  const fail = { pass: false, reasons: [{ id: "rr", rr: 0.8, min: 2 }] };
  const enter = { call: "enter", n: 3 };
  const rows = [
    // stance, risk, exec, received -> call, by, reason
    [["bullish", pass, enter, 5], ["buy", "boss", "all"]],
    [["bullish", fail, enter, 5], ["wait", "risk", "rr"]],
    [["bearish", fail, enter, 5], ["reject", "strategy", "bearish"]],
    [["bullish", { pass: false, reasons: [{ id: "stretch", pct: 9, max: 8 }] }, enter, 5], ["wait", "risk", "stretch"]],
    [["bullish", { pass: false, reasons: [{ id: "rr", rr: 0.5, min: 2 }, { id: "stop", atr: 2.5, max: 2 }] }, enter, 5], ["reject", "risk", "stop"]],
    [["neutral", { pass: false, reasons: [{ id: "plan" }] }, enter, 5], ["reject", "risk", "plan"]],
    [["neutral", fail, { call: "skip", n: 1, downtrend: true }, 5], ["reject", "execution", "downtrend"]],
    [["bearish", pass, enter, 5], ["reject", "strategy", "bearish"]],
    [["neutral", pass, enter, 5], ["wait", "strategy", "neutral"]],
    [[null, pass, enter, 5], ["wait", "strategy", "noView"]],
    [["bullish", pass, { call: "wait", n: 2 }, 5], ["wait", "execution", "confirm"]],
    [["bullish", pass, { call: "skip", n: 0, downtrend: false }, 5], ["wait", "execution", "skip"]],
    [["bullish", pass, { call: "skip", n: 2, downtrend: true }, 5], ["reject", "execution", "downtrend"]],
    [["bullish", pass, enter, 4], ["wait", "boss", "reports"]],
    [["lean_up", pass, enter, 5], ["buy", "boss", "all"]],
    [["lean_down", pass, enter, 5], ["reject", "strategy", "bearish"]],
  ];
  for (const [[stance, risk, exec, received], [call, by, reason]] of rows) {
    const out = bossCall({ stance, risk, exec, received });
    assert.deepEqual([out.call, out.by, out.reason.id], [call, by, reason], `${stance} ${risk.pass} ${exec.call} ${received}`);
  }
  assert.equal(bossCall({ stance: "bullish", risk: { pass: true, reasons: [] }, exec: { call: "wait", n: 1 }, received: 5 }).reason.n, 1);
});

test("stances: the run's values read as up, down or flat", () => {
  assert.equal(stanceLean("bullish"), "up");
  assert.equal(stanceLean("bearish"), "down");
  assert.equal(stanceLean("neutral"), "flat");
  assert.equal(stanceLean(null), null);
  const run = { date: "2026-01-05", picks: [{ pick: { ticker: "AAA", stance: "bullish" } }, { pick: { ticker: "BBB", stance: "neutral" } }] };
  assert.equal(stanceFor(run, "AAA"), "bullish");
  assert.equal(stanceFor(run, "CCC"), null);
  assert.equal(stanceFor(null, "AAA"), null);
});

test("deskCalls: every listed name gets a call, BUY then WAIT then REJECT", () => {
  const checklist = { as_of: "2026-01-05", symbols: [
    good(),
    good({ symbol: "BBB", candle: { daily: { lean: "neutral" } } }), // 2 of 3: WAIT
    good({ symbol: "CCC", risk_plan: { atr_pct: 2, stop_pct: 3, tp1_pct: 1.5, rr_tp1: 0.5 } }), // thin R:R: WAIT (the house rule says wait)
  ] };
  const market = { as_of: "2026-01-05", symbols: [up, { ...up, symbol: "BBB" }, { ...up, symbol: "CCC" }] };
  const run = { date: "2026-01-05", picks: ["AAA", "BBB", "CCC"].map((x) => ({ pick: { ticker: x, stance: "bullish" } })) };
  const rows = deskCalls({ market, checklist, run, members: ["CCC", "BBB", "AAA"], limits: LIMITS, received: 5 });
  // Within WAIT, more confirmations first: CCC has all three but a thin reward-to-risk; BBB has two.
  assert.deepEqual(rows.map((r) => [r.ticker, r.call]), [["AAA", "buy"], ["CCC", "wait"], ["BBB", "wait"]]);
  assert.deepEqual(callCounts(rows), { buy: 1, wait: 2, reject: 0 });
  assert.deepEqual([rows[1].by, rows[1].reason.id], ["risk", "rr"]);
  assert.equal(rows[0].entry, -1);
  // A name the checklist has not read: no written plan, so Risk rejects it.
  const none = deskCalls({ market, checklist, run, members: ["DDD"], limits: LIMITS, received: 5 })[0];
  assert.deepEqual([none.call, none.by, none.reason.id], ["reject", "risk", "plan"]);
  // Fewer than five reports: the BUY waits.
  assert.equal(deskCalls({ market, checklist, run, members: ["AAA"], limits: LIMITS, received: 4 })[0].call, "wait");
});

/* -------------------------------------------------------------- execution */

test("execution confirmations: LEVEL, VOLUME, CLOSE and the call", () => {
  const all = execution(good(), up);
  assert.deepEqual([all.level, all.volume, all.close, all.n, all.call], [true, true, true, 3, "enter"]);
  // LEVEL: support further than one ATR below fails; nothing overhead (cleared resistance) passes.
  assert.equal(execution(good({ levels: { support: [{ dist_pct: -3 }], resistance: [{ dist_pct: 2 }] } }), up).level, false);
  assert.equal(execution(good({ levels: { support: [{ dist_pct: -3 }], resistance: [] } }), up).level, true);
  assert.equal(execution(good({ levels: { support: [], resistance: [{ dist_pct: 2 }] } }), up).level, false);
  // VOLUME: needs a rising day, volume at or above its average, and the volume step leaning bullish.
  assert.equal(execution(good(), { ...up, change_1d_pct: -0.4 }).volume, false);
  assert.equal(execution(good({ volume: { lean: "bullish", vs_avg20: 0.97 } }), up).volume, false);
  assert.equal(execution(good({ volume: { lean: "bullish", vs_avg20: 1 } }), up).volume, true);
  assert.equal(execution(good({ volume: { lean: "neutral", vs_avg20: 1.5 } }), up).volume, false);
  // CLOSE: the daily candle's lean.
  assert.equal(execution(good({ candle: { daily: { lean: "bearish" } } }), up).close, false);
  // Two of three: WAIT; none: SKIP; a downtrend: SKIP even with all three.
  assert.equal(execution(good({ candle: { daily: { lean: "neutral" } } }), up).call, "wait");
  const none = good({ candle: { daily: { lean: "neutral" } }, volume: { lean: "neutral", vs_avg20: 0.5 }, levels: { support: [{ dist_pct: -9 }], resistance: [{ dist_pct: 1 }] } });
  assert.equal(execution(none, up).call, "skip");
  assert.equal(execution(good({ trend: { direction: "down" } }), up).call, "skip");
  assert.equal(execution(null, up).call, "skip");
  assert.equal(execution(null, up).missing, true);
});

/* ------------------------------------------------------------------- risk */

test("risk: rejections and their reasons, in order", () => {
  assert.deepEqual(riskCheck(good(), up, LIMITS), { pass: true, reasons: [] });
  const thin = riskCheck(good({ risk_plan: { atr_pct: 2, stop_pct: 3, tp1_pct: 2.4, rr_tp1: 0.8 } }), up, LIMITS);
  assert.deepEqual(thin.reasons, [{ id: "rr", rr: 0.8, min: 2 }]);
  const wide = riskCheck(good({ risk_plan: { atr_pct: 1, stop_pct: 3, tp1_pct: 9, rr_tp1: 3 } }), up, LIMITS);
  assert.equal(wide.reasons[0].id, "stop");
  assert.equal(wide.reasons[0].atr, 3);
  // Exactly at the limit passes.
  assert.equal(riskCheck(good({ risk_plan: { atr_pct: 1.5, stop_pct: 3, tp1_pct: 9, rr_tp1: 3 } }), up, LIMITS).pass, true);
  const stretched = riskCheck(good(), { ...up, dist_sma50_pct: 9.1, setup: { stretched: true } }, LIMITS);
  assert.deepEqual(stretched.reasons, [{ id: "stretch", pct: 9.1, max: 8 }]);
  const both = riskCheck(good({ risk_plan: { atr_pct: 2, stop_pct: 3, tp1_pct: 2.4, rr_tp1: 0.8 } }), { ...up, dist_sma50_pct: 12 }, LIMITS);
  assert.deepEqual(both.reasons.map((r) => r.id), ["rr", "stretch"]);
  assert.deepEqual(riskCheck(null, up, LIMITS).reasons.map((r) => r.id), ["plan"]);
  // A limit that is written nowhere is not checked.
  assert.equal(riskCheck(good({ risk_plan: { atr_pct: 2, stop_pct: 3, tp1_pct: 2.4, rr_tp1: 0.8 } }), up, {}).pass, true);
});

test("house limits come from config and the house rules, or not at all", () => {
  const household = "Then at most **10%** of investable savings, in equal slots of **2%**. Today none qualifies.";
  const lim = houseLimits({
    settings: { setup: { stretch_pct: 8, veto_stretched: true } },
    checklistCfg: { house_rule: { min_reward_to_risk: 2 }, steps: [{ id: "risk_plan", params: { stop_atr_max: 2 } }] },
    rulebook: { not_supported: [{ name: "Borrowing, options, short selling" }] },
    household, earned: false,
  });
  assert.deepEqual(lim, { minRR: 2, stopAtrMax: 2, stretchPct: 8, potPct: 10, slotPct: 2, noBorrowing: true, earned: false });
  const bare = houseLimits({});
  assert.deepEqual(bare, { minRR: null, stopAtrMax: null, stretchPct: null, potPct: null, slotPct: null, noBorrowing: false, earned: false });
  // The data file's own copy of the house rule is a fallback.
  assert.equal(houseLimits({ checklist: { house_rule: { min_reward_to_risk: 3 } } }).minRR, 3);
});

test("rrText never shows a thin ratio as the limit itself", () => {
  assert.equal(rrText(0.84, 2), "0.8");
  assert.equal(rrText(1.96, 2), "1.96");
  assert.equal(rrText(2.4, 2), "2.4");
  assert.equal(rrText(null, 2), "–");
});

/* --------------------------------------------------------------- research */

/** A derived row whose series moves gently (±0.5%) and then by `last` percent on its newest day. */
function derivedRow(symbol, last, n = 70) {
  const series = [];
  let v = 100;
  for (let i = 0; i < n; i++) {
    const day = `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
    if (i) v *= 1 + (i === n - 1 ? last : i % 2 ? 0.005 : -0.004);
    series.push({ date: day, v: +v.toFixed(4) });
  }
  return { symbol, series, spark: series.slice(-60), last_date: series.at(-1).date, change_1d_pct: last * 100, ret_20d_pct: 1, vol20_pct: 10, vs_bench_60d_pct: 2 };
}

test("scanner: unusual flags use the feed's own test", () => {
  const market = { as_of: "2026-03-14", symbols: [derivedRow("AAA", 0.06), derivedRow("BBB", 0.004)] };
  const rows = scannerRows({ market, members: ["AAA", "BBB"], names: { AAA: "Alpha" } });
  assert.ok(rows[0].unusual && rows[0].unusual.pct > 5);
  assert.equal(rows[1].unusual, null);
  assert.equal(rows[0].name, "Alpha");
  assert.equal(rows[1].name, "BBB");
  // The same verdict as the feed's unusual items for the newest day.
  const feed = unusualItems(market, { symbols: [{ symbol: "AAA" }, { symbol: "BBB" }] }, {}, 1);
  assert.deepEqual(feed.map((i) => i.id.split(":")[1]), rows.filter((r) => r.unusual).map((r) => r.ticker));
  // Under 3% is never unusual, however calm the stock was.
  assert.equal(unusualToday(derivedRow("CCC", 0.025)), null);
});

test("scanner: sorting by any column, missing values last", () => {
  const rows = [
    { ticker: "AAA", day: 1, score: 2, volX: null },
    { ticker: "BBB", day: -3, score: 2, volX: 1.4 },
    { ticker: "CCC", day: 4, score: -1, volX: 0.8 },
  ];
  assert.deepEqual(sortScanner(rows, "day", "desc").map((r) => r.ticker), ["CCC", "AAA", "BBB"]);
  assert.deepEqual(sortScanner(rows, "day", "asc").map((r) => r.ticker), ["BBB", "AAA", "CCC"]);
  assert.deepEqual(sortScanner(rows, "score", "desc").map((r) => r.ticker), ["AAA", "BBB", "CCC"], "ties by ticker");
  assert.deepEqual(sortScanner(rows, "volX", "desc").map((r) => r.ticker), ["BBB", "CCC", "AAA"]);
  assert.deepEqual(sortScanner(rows, "volX", "asc").map((r) => r.ticker), ["CCC", "BBB", "AAA"], "missing stays last");
  assert.deepEqual(sortScanner(rows, "ticker", "asc").map((r) => r.ticker), ["AAA", "BBB", "CCC"]);
  assert.deepEqual(sortScanner(rows, "nope").map((r) => r.ticker), ["AAA", "BBB", "CCC"], "unknown key: score");
  const tiles = statTiles([...rows.map((r) => ({ ...r, vol: r.ticker === "CCC" ? 40 : 20, mom: r.ticker === "AAA" ? 9 : 1 }))]);
  assert.deepEqual([tiles.volume.ticker, tiles.volatility.ticker, tiles.momentum.ticker], ["BBB", "CCC", "AAA"]);
  assert.equal(statTiles([]).volume, null);
});

/* -------------------------------------------------------------- freshness */

test("freshness: each report is fresh for the market date, stale or missing", () => {
  const base = { market: { as_of: "2026-01-06" }, checklist: { as_of: "2026-01-06" }, why: { as_of: "2026-01-02" }, secNews: { as_of: "2026-01-07" }, run: { date: "2026-01-06" } };
  const all = freshness(base);
  assert.equal(all.marketDate, "2026-01-06");
  assert.equal(all.received, 5);
  assert.deepEqual(["research", "news", "strategy", "execution", "risk"].map((a) => all[a].state), ["fresh", "fresh", "fresh", "fresh", "fresh"]);
  // The brain has not run on the newest close yet: Strategy waits.
  const brainBehind = freshness({ ...base, run: { date: "2026-01-05" } });
  assert.equal(brainBehind.strategy.state, "stale");
  assert.equal(brainBehind.strategy.date, "2026-01-05");
  assert.equal(brainBehind.received, 4);
  // The checklist is a day behind the prices: Strategy, Execution and Risk wait; the market date is the newer one.
  const clBehind = freshness({ ...base, checklist: { as_of: "2026-01-05" } });
  assert.deepEqual([clBehind.research.state, clBehind.strategy.state, clBehind.execution.state, clBehind.risk.state], ["fresh", "stale", "stale", "stale"]);
  // News is fresh when either the notes or the filings cover the day (a quiet day records no note).
  assert.equal(freshness({ ...base, secNews: null, why: { as_of: "2026-01-06" } }).news.state, "fresh");
  assert.equal(freshness({ ...base, secNews: null, why: null }).news.state, "missing");
  assert.equal(freshness({ ...base, run: null }).strategy.state, "missing");
  assert.equal(marketDateOf({ market: { as_of: "2026-01-05" }, checklist: { as_of: "2026-01-06" } }), "2026-01-06");
  assert.equal(marketDateOf({}), null);
});

/* ------------------------------------------------------------------- news */

test("news: notes of the last week, recent filings and results due soon, with counters", () => {
  const why = { as_of: "2026-01-05", notes: [
    { market_date: "2026-01-05", key: "AAA", symbols: ["AAA"], headline: "AAA won a contract.", move_pct: 4.2 },
    { market_date: "2026-01-02", key: "BBB", symbols: ["BBB"], headline: "BBB cut its outlook", move_pct: -5.1 },
    { market_date: "2025-12-01", key: "CCC", symbols: ["CCC"], headline: "Old news", move_pct: 3.3 },
  ] };
  const secNews = { companies: [
    { symbol: "BBB", filings: [{ date: "2026-01-05", form: "8-K", titles: ["Quarterly results"], kind: "results", url: "https://www.sec.gov/x" }] },
    { symbol: "ZZZ", filings: [{ date: "2026-01-05", form: "8-K", titles: ["Other company news"], kind: "other", url: "https://www.sec.gov/y" }] },
  ] };
  const outlook = { companies: [
    { ticker: "CCC", next_earnings: { date: "2026-01-09", confirmed: true } },
    { ticker: "AAA", next_earnings: { date: "2026-01-30", confirmed: true } },
  ] };
  const market = { symbols: [{ symbol: "BBB", change_1d_pct: -1.5 }, { symbol: "CCC", change_1d_pct: 0.7 }] };
  const { cards, counts } = newsCards({ why, secNews, outlook, market, members: ["AAA", "BBB", "CCC"], today: "2026-01-06", marketDate: "2026-01-05" });
  assert.deepEqual(cards.map((c) => [c.kind, c.ticker]), [["up", "AAA"], ["down", "BBB"], ["filing", "BBB"], ["results", "CCC"]]);
  assert.equal(cards[0].headline, "AAA won a contract");
  assert.equal(cards[0].move, 4.2);
  assert.equal(cards[2].move, -1.5, "a filing carries the name's latest day move");
  assert.equal(cards[3].to, "stock/CCC#whats-next");
  assert.deepEqual(counts, { up: 1, down: 1, watch: 2 });
  assert.deepEqual(newsCards({}).cards, []);
});

/* --------------------------------------------------------------- strategy */

test("strategy rows: names with a plan, best reward-to-risk first; execution candidates follow the Boss", () => {
  const rows = [
    { ticker: "AAA", call: "wait", plan: { stop_pct: 3, rr_tp1: 0.5 }, exec: { n: 2, missing: false } },
    { ticker: "BBB", call: "reject", plan: { stop_pct: 2, rr_tp1: 2.5 }, exec: { n: 1, missing: false } },
    { ticker: "CCC", call: "reject", plan: null, exec: { n: 0, missing: true } },
  ];
  const s = strategyRows(rows, 2);
  assert.deepEqual(s.map((r) => [r.ticker, r.fits]), [["BBB", true], ["AAA", false]]);
  assert.deepEqual(execCandidates(rows, 4).map((r) => r.ticker), ["AAA", "BBB"]);
});

test("the desk's words never sound like advice, and BUY always says paper", () => {
  const desk = Object.entries(home).filter(([k]) => k.startsWith("desk."));
  assert.ok(desk.length > 20);
  for (const [k, v] of desk) assert.doesNotMatch(typeof v === "string" ? v : Object.values(v).join(" "), /buy signal|recommend|should buy/i, k);
  assert.match(home["desk.call.buy"], /paper/i);
});
