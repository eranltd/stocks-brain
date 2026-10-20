import test from "node:test";
import assert from "node:assert/strict";
import { baseRateLine, candleLine, edgeWords, fillNote, forwardWords, gapsLine, gateReason, levelsLine, ma20Line, patternName, riskPlan, rowFor, rsiLine, stepRows, trendLine, verdictWords, volumeLine } from "./checklist.js";
import { stripBidi } from "./i18n.js";

const cfg = {
  steps: [
    { id: "candle", n: 1, name: "Candle pattern" },
    { id: "trend", n: 2, name: "Trend", params: { slope_days: 10 } },
    { id: "volume", n: 3, name: "Volume", params: { avg_days: 20, trend_days: 10 } },
    { id: "ma20", n: 4, name: "Moving average 20", params: { slope_days: 5 } },
    { id: "gaps", n: 5, name: "Gaps", params: { lookback_days: 60 } },
    { id: "levels", n: 6, name: "Support and resistance" },
    { id: "rsi", n: 7, name: "RSI", params: { overbought: 70, oversold: 30 } },
    { id: "risk_plan", n: 8, name: "Risk management and exit", params: { risk_multiple: 2 } },
  ],
  house_rule: { min_reward_to_risk: 2 },
};

const row = {
  symbol: "XYZ",
  candle: { lean: "bullish", daily: { lean: "bullish", pattern: "bullish engulfing", close_in_range_pct: 79.1 }, weekly: { lean: "bullish", pattern: "up week", partial: true } },
  trend: { direction: "up", lean: "bullish", points: 4, dist_sma50_pct: 6.23, sma50_above_sma200: true, slope50_pct: 2.25, structure: "higher highs and higher lows" },
  volume: { verdict: "confirms", lean: "bullish", move: "rising", move_pct: 3.27, vs_avg20: 0.84, up_down_ratio_20d: 1.65, trend_pct: -17.5, rising_on_falling_volume: false },
  ma20: { side: "above", dist_pct: 4.17, slope_pct: 1.65, lean: "bullish" },
  gaps: { verdict: "none", lean: "neutral", above: 0, below: 0, nearest: null, unfilled: [] },
  levels: { lean: "bullish", support: [{ dist_pct: -1.01, touches: 2 }, { dist_pct: -7.37, touches: 1 }], resistance: [] },
  rsi: { value: 62.9, zone: "neutral", lean: "neutral" },
  risk_plan: { atr_pct: 2.43, stop_pct: 2.43, stop_basis: "min_atr", tp1_pct: 4.86, tp1_basis: "risk_multiple", tp2_pct: 7.29, tp2_basis: "risk_multiple", rr_tp1: 2.0, rr_tp2: 3.0, fits_house_rule: true },
  score: { net: 5, verdict: "lean_up", leans: { candle: "bullish", trend: "bullish", volume: "bullish", ma20: "bullish", gaps: "neutral", levels: "bullish", rsi: "neutral" } },
};

test("eight rows in order, with Hebrew names, leans, and no lean on the risk plan", () => {
  const rows = stepRows(row, cfg);
  assert.deepEqual(rows.map((r) => r.id), ["candle", "trend", "volume", "ma20", "gaps", "levels", "rsi", "risk_plan"]);
  assert.equal(rows[0].name_he, undefined);
  assert.equal(rows[0].text, "Daily: bullish engulfing, closing near the high (79% up the range). Week so far: up week (partial).");
  assert.equal(rows[6].lean, "neutral");
  assert.equal(rows[7].lean, null);
  assert.ok(rows.every((r) => r.text.length > 0));
});

test("trend, volume, gaps, levels and RSI read in plain words with percent only", () => {
  assert.equal(trendLine(row.trend, cfg), "Uptrend (+4 of 4 points): +6.2% vs its 50-day average, which is above the 200-day and rising (+2.3% over 10 days); higher highs and higher lows.");
  assert.equal(volumeLine(row.volume, cfg), "Volume backs the rise (+3.3% in 10 days). Up-day volume 1.65× down-day volume over 20 days; last day 0.84× its 20-day average; 10-day volume −18% vs the 10 before.");
  assert.match(volumeLine({ ...row.volume, verdict: "weakening", rising_on_falling_volume: true }, cfg), /^Price up 3\.3% in 10 days on falling volume: a possible bull trap\./);
  assert.match(volumeLine({ ...row.volume, verdict: "weakening", move: "falling", move_pct: -4 }, cfg), /this site does not call bottoms/);
  assert.equal(gapsLine(row.gaps, cfg), "No open gaps in the last 60 trading days.");
  assert.equal(gapsLine({ above: 1, below: 0, nearest: { where: "above", size_pct: 1.3, dist_pct: 2.1, days_open: 12, moving_toward: true } }, cfg),
    "1 open above, 0 below. Nearest: a 1.3% gap above, 2.1% away, open 12 days; price is moving toward it.");
  assert.equal(levelsLine(row.levels), "Support 1.0% (2 touches), 7.4% (1 touch) below. No resistance overhead in the past year.");
  assert.equal(rsiLine({ value: 72.4, zone: "overbought" }, cfg), "RSI 72: overbought, which leans bearish (overbought at 70 or more, oversold at 30 or less).");
  assert.match(rsiLine({ value: 69.6, zone: "neutral" }, cfg), /^RSI 69\.6: neutral/); // not "RSI 70: neutral"
});

test("no text carries a price: only percents, ratios and counts", () => {
  for (const r of stepRows(row, cfg)) assert.doesNotMatch(r.text, /\$/);
});

test("risk plan: targets set from the risk say so, and the rule is checked on TP1", () => {
  const rp = riskPlan(row.risk_plan, cfg);
  assert.equal(rp.fits, true);
  assert.equal(rp.tp1.byConstruction, true);
  assert.match(rp.tp1.basis, /by construction/);
  assert.match(rp.tp2.basis, /no second resistance/);
  assert.equal(rp.text, "Stop 2.4% below, TP1 4.9% above, TP2 7.3% above: reward-to-risk 2.0 to TP1 (need 2 or more).");
  assert.equal(riskPlan({ ...row.risk_plan, tp1_basis: "resistance" }, cfg).tp1.basis, "at the nearest resistance");
  assert.equal(riskPlan(null, cfg), null);
});

test("gate reason: missing file, by-construction targets and a real resistance read differently", () => {
  const ck = { symbols: [row] };
  assert.deepEqual(gateReason(null, null, cfg), { ok: false, text: "Risk plan: the technical checklist appears after the next daily run" });
  assert.equal(gateReason(ck, null, cfg).ok, false);
  const bc = gateReason(ck, row, cfg);
  assert.equal(bc.ok, true);
  assert.match(bc.text, /by construction/);
  const real = gateReason(ck, { ...row, risk_plan: { ...row.risk_plan, tp1_basis: "resistance", rr_tp1: 1.4, fits_house_rule: false } }, cfg);
  assert.deepEqual(real, { ok: false, text: "Risk plan: reward-to-risk to TP1 is 1.4 (need 2 or more)" });
  assert.deepEqual(gateReason({ ...ck, sample: true }, row, cfg), { ok: false, text: "Risk plan: computed from sample prices here, so it cannot count" });
  // A plan from an older close than the one shown never counts; the same close does.
  const old = gateReason(ck, { ...row, as_of: "2026-10-01" }, cfg, "2026-10-02");
  assert.equal(old.ok, false);
  assert.match(old.text, /older than the last close/);
  assert.equal(gateReason(ck, { ...row, as_of: "2026-10-02" }, cfg, "2026-10-02").ok, bc.ok);
  assert.equal(rowFor(ck, "XYZ"), row);
  assert.equal(rowFor(null, "XYZ"), null);
});

const br = {
  horizon_days: 20,
  all: { n: 1407, mean: 0.694 },
  by_verdict: [
    { verdict: "lean_up", n: 231, mean: 1.143, ci_low: 0.205, ci_high: 2.082 },
    { verdict: "mixed", n: 978, mean: 0.775, ci_low: 0.27, ci_high: 1.28 },
    { verdict: "lean_down", n: 198, mean: -0.232, ci_low: -1.358, ci_high: 0.894 },
  ],
};

test("base rates in words, and an honest read of whether lean-up beats the average snapshot", () => {
  assert.equal(baseRateLine(br, "lean_up", "Nasdaq-100"), "When it read lean up, the name beat the Nasdaq-100 by 1.1 points on average over the next 20 trading days (231 cases, 90% range +0.2% to +2.1%).");
  assert.match(baseRateLine(br, "lean_down", "Nasdaq-100"), /trailed the Nasdaq-100 by 0\.2 points/);
  assert.equal(baseRateLine({ ...br, by_verdict: [{ verdict: "lean_up", n: 0, mean: null }] }, "lean_up"), null);
  assert.match(edgeWords(br), /within the noise/);
  assert.match(edgeWords({ ...br, by_verdict: [{ ...br.by_verdict[0], ci_low: 0.9 }] }), /even at the low end/);
  assert.equal(edgeWords(null), null);
});

test("forward record in words", () => {
  assert.equal(forwardWords(null), "The forward record starts with the next daily run.");
  assert.equal(forwardWords({ started: "2026-10-02", records: [{}], scored_records: 0, horizon_days: 20 }), "Forward record since 2026-10-02: 1 snapshot written, 0 scored. The first is scored 20 trading days after it was written.");
  assert.equal(forwardWords({ started: "2026-10-02", records: [{}, {}], scored_records: 1, horizon_days: 20 }), "Forward record since 2026-10-02: 2 snapshots written, 1 scored.");
});

test("notes show numbers, not parameter names", () => {
  assert.equal(fillNote("Samples every step_days trading days, scored horizon_days later.", { step_days: 20, horizon_days: 20 }), "Samples every 20 trading days, scored 20 later.");
  assert.equal(fillNote("No step_days here.", null), "No step_days here.");
  assert.equal(fillNote(undefined, {}), "");
});

/* ------------------------------------------------------------------------------------------------ Hebrew */

const HE = /[\u0590-\u05FF]/;
const ADVICE = /buy signal|recommend|you should buy|מומלץ לקנות|כדאי לקנות|המלצ/i;
function hebrew(s) {
  assert.match(s, HE, s);
  assert.doesNotMatch(s, /\[[a-z]+\.|undefined|null|NaN/, s);
  assert.doesNotMatch(s, ADVICE, s);
}

test("Hebrew: every step row in Hebrew, with Hebrew step names and candle pattern names", () => {
  const rows = stepRows(row, cfg, "he");
  assert.deepEqual(rows.map((r) => r.name), ["תבנית הנר", "מגמה", "מחזור מסחר", "ממוצע 20 הימים", "פערים", "תמיכה והתנגדות", "מדד RSI", "ניהול סיכון ויציאה"]);
  for (const r of rows) hebrew(r.text);
  assert.equal(stripBidi(rows[0].text), "יומי: בליעה עולה, סגירה קרוב לשיא של היום (79% מהטווח). השבוע עד עכשיו: שבוע עלייה (חלקי).");
  assert.equal(patternName("shooting star", "he"), "כוכב נופל");
  assert.equal(patternName("something new", "he"), "something new");
  assert.equal(patternName("doji"), "doji");
  assert.equal(stripBidi(candleLine({ daily: { lean: "bullish", pattern: "hammer", close_in_range_pct: 50 }, weekly: { lean: "bearish", pattern: "down week" } }, "he")),
    "יומי: פטיש, סגירה באמצע הטווח (50%). שבוע שעבר: שבוע ירידה. הם לא מסכימים, ולכן ניטרלי.");
  assert.deepEqual(Object.values(verdictWords("he")).map((v) => v.word), ["נטייה לעלייה", "מעורב", "נטייה לירידה"]);
});

test("Hebrew: numbers keep their sign and direction inside the sentence", () => {
  const tr = trendLine(row.trend, cfg, "he");
  assert.equal(stripBidi(tr), "מגמת עלייה (+4 מתוך 4 נקודות): +6.2% ביחס לממוצע 50 הימים, שנמצא מעל ממוצע 200 הימים ועולה (+2.3% ב-10 ימים); שיאים גבוהים יותר ושפלים גבוהים יותר.");
  // a signed percent sits in a left-to-right island, so "+6.2%" never reads "6.2%+"
  assert.ok(tr.includes("\u2066+6.2%\u2069"));
  assert.equal(stripBidi(volumeLine(row.volume, cfg, "he")),
    "מחזור המסחר תומך בעלייה (+3.3% ב-10 ימים). המחזור בימי עלייה פי 1.65 מהמחזור בימי ירידה, ב-20 ימים; ביום האחרון פי 0.84 מהממוצע של 20 ימים; המחזור ב-10 הימים האחרונים −18% לעומת 10 הימים שלפניהם.");
  assert.equal(stripBidi(ma20Line(row.ma20, cfg, "he")), "4.2% מעל ממוצע 20 הימים, והממוצע עולה (+1.6% ב-5 ימים).");
  assert.equal(stripBidi(gapsLine({ above: 1, below: 0, nearest: { where: "above", size_pct: 1.3, dist_pct: 2.1, days_open: 2, moving_toward: true } }, cfg, "he")),
    "פתוחים: 1 מעל, 0 מתחת. הקרוב ביותר: פער של 1.3% מעל, במרחק 2.1%, פתוח יומיים; המחיר נע לכיוונו.");
  assert.equal(stripBidi(levelsLine(row.levels, "he")), "תמיכה מתחת: 1.0% (שתי נגיעות), 7.4% (נגיעה אחת). אין רמת התנגדות מעל בשנה האחרונה.");
  assert.equal(stripBidi(rsiLine({ value: 72.4, zone: "overbought" }, cfg, "he")), "מדד RSI 72: קניית יתר, נטייה לירידה (קניית יתר מ-70 ומעלה, מכירת יתר מ-30 ומטה).");
  for (const s of [tr, volumeLine({ ...row.volume, rising_on_falling_volume: true }, cfg, "he"), volumeLine({ ...row.volume, verdict: "weakening", move: "falling", move_pct: -4 }, cfg, "he")]) hebrew(s);
});

test("Hebrew: risk plan, gate reason, base rates and the forward record", () => {
  const rp = riskPlan(row.risk_plan, cfg, "he");
  for (const s of [rp.stop.basis, rp.tp1.basis, rp.tp1.short, rp.tp2.basis, rp.text]) hebrew(s);
  assert.equal(stripBidi(rp.text), "נקודת יציאה 2.4% מתחת, יעד 1 4.9% מעל, יעד 2 7.3% מעל: יחס סיכוי-סיכון 2.0 עד יעד 1 (נדרש 2 או יותר).");
  const ck = { symbols: [row] };
  for (const g of [gateReason(null, null, cfg, null, "he"), gateReason(ck, null, cfg, null, "he"), gateReason({ ...ck, sample: true }, row, cfg, null, "he"),
    gateReason(ck, row, cfg, null, "he"), gateReason(ck, { ...row, as_of: "2026-10-01" }, cfg, "2026-10-02", "he")]) hebrew(g.text);
  assert.match(gateReason(ck, { ...row, as_of: "2026-10-01" }, cfg, "2026-10-02", "he").text, /באוקטובר 2026/);
  const line = baseRateLine(br, "lean_up", "Nasdaq-100", "he");
  hebrew(line);
  assert.equal(stripBidi(line), "כשהקריאה הייתה נטייה לעלייה, המניה עקפה את Nasdaq-100 ב-1.1 נקודות בממוצע ב-20 ימי המסחר שאחריה (231 מקרים, טווח של 90%: +0.2% עד +2.1%).");
  assert.match(baseRateLine(br, "lean_down", "Nasdaq-100", "he"), /פיגרה אחרי/);
  hebrew(edgeWords(br, "he"));
  hebrew(forwardWords(null, "he"));
  assert.equal(stripBidi(forwardWords({ started: "2026-10-02", records: [{}], scored_records: 0, horizon_days: 20 }, "he")),
    "תיעוד מכאן והלאה מאז 2 באוקטובר 2026: נכתבה תמונת מצב אחת, 0 כבר נבדקו. הראשונה נבדקת 20 ימי מסחר אחרי שנכתבה.");
  // English still reads the same as before
  assert.equal(forwardWords({ started: "2026-10-02", records: [{}, {}], scored_records: 1, horizon_days: 20 }), "Forward record since 2026-10-02: 2 snapshots written, 1 scored.");
});
