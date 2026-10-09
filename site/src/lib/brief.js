// "<Company> in short": the one-stock brief at the top of the Stock page, worded from the household's eight-step
// checklist (config/checklist.json, data/market/checklist.json), the setup checks and the outlook card. Pure functions,
// no React. Every number comes from Python; this file only words it. Percent distances only, rounded to whole percents:
// never a price or a level. It never says "buy": a paper entry is either within the house rules or not, and why.

/** The checklist verdict as a big plain word. */
export const VERDICT_PLAIN = {
  lean_up: { word: "Going up", tone: "accent", mark: "up" },
  mixed: { word: "Mixed", tone: "flat", mark: "neutral" },
  lean_down: { word: "Going down", tone: "down", mark: "down" },
};
const MARK = { bullish: "up", bearish: "down", neutral: "neutral" };
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const BRIEF_FOOTER = "On paper only: no real money moves yet. These checks are unproven for us, and most of our money stays in the S&P 500 index fund.";
export const NO_CHECKLIST = "The checklist appears after the next daily run.";

/**
 * Whether a checklist row can be read for this name today: {ok, why}. A checklist from sample prices on a live site, or
 * a row from an older close than the one the page shows, is not today's reading.
 */
export function readable(checklist, row, lastClose = null, { sampleSite = false } = {}) {
  if (!checklist) return { ok: false, why: NO_CHECKLIST };
  if (checklist.sample && !sampleSite) return { ok: false, why: "The checklist here comes from sample prices, so it cannot count; it updates after the next daily run." };
  if (!row) return { ok: false, why: "No checklist for this name yet: not enough price history." };
  if (lastClose && row.as_of && row.as_of < lastClose) return { ok: false, why: "The checklist is from an older close; it updates after the next daily run." };
  return { ok: true, why: null };
}

// The checklist summary's few trader words (scripts/market.py PHRASE), said the way the eight checks below say them.
const EVERYDAY = [
  [/\bbullish candles\b/g, "buyers winning the last candles"],
  [/\bbearish candles\b/g, "sellers winning the last candles"],
  [/\bRSI oversold\b/g, "RSI says oversold"],
  [/\bRSI overbought\b/g, "RSI says overheated"],
  [/\bReward-to-risk fits the house rule\./g, "The possible gain is big enough for the risk."],
  [/\bReward-to-risk is below the house rule\./g, "The possible gain is too small for the risk."],
];

/** The checklist's own summary without its leading verdict word (the brief shows the verdict big above it), in everyday words. */
export function plainSummary(summary) {
  let s = String(summary ?? "").replace(/^(Leans up|Leans down|Mixed)\s*[:.]\s*/, "").trim();
  for (const [re, to] of EVERYDAY) s = s.replace(re, to);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** "Going up or down?": {word, tone, mark, summary}, or null without a reading. */
export function direction(row) {
  const v = VERDICT_PLAIN[row?.score?.verdict];
  return v ? { ...v, summary: plainSummary(row.score.summary) } : null;
}

function candleRow(c) {
  const d = c?.daily?.lean, w = c?.weekly?.lean;
  if (d && w && d !== "neutral" && w !== "neutral" && d !== w) return "Last candles: the day and the week disagree";
  return { bullish: "Last candle: buyers won the day", bearish: "Last candle: sellers won the day" }[c?.lean] ?? "Last candle: no clear winner";
}

function volumeRow(v) {
  if (v?.rising_on_falling_volume) return "Volume: rising on falling volume, careful";
  if (v?.verdict === "confirms") return v.move === "falling" ? "Volume: backs the fall" : "Volume: supports the move";
  if (v?.verdict === "weakening") return v.move === "falling" ? "Volume: the selling is fading" : "Volume: the rise is losing steam";
  return v?.move === "flat" ? "Volume: price about flat, nothing to confirm" : "Volume: no clear signal";
}

function ma20Row(m) {
  if (!m) return "20-day average: not available";
  const rising = num(m.slope_pct) != null && m.slope_pct > 0;
  if (m.side === "above") return rising ? "Above its 20-day average, which is rising" : "Above its 20-day average, but the average is falling";
  return rising ? "Below its 20-day average, but the average is rising" : "Below its 20-day average, which is falling";
}

function gapsRow(g) {
  if (g?.lean === "bullish") return "Open gap above: may get filled";
  if (g?.lean === "bearish") return "Open gap below: may get filled";
  return g?.nearest ? "Open gaps far away: not in play" : "No open gaps";
}

function levelsRow(l) {
  const sup = l?.support?.length ?? 0, res = l?.resistance?.length ?? 0;
  if (l?.lean === "bullish") return res ? "Room to rise before resistance" : "Nothing overhead: above every level of the past year";
  if (l?.lean === "bearish") return sup ? "Close to resistance: may stall" : "Nothing below to catch a fall";
  return "Between support and resistance";
}

function rsiRow(r) {
  return { overbought: "RSI: overheated", oversold: "RSI: oversold" }[r?.zone] ?? "RSI: not overheated";
}

function riskRow(rp, min) {
  if (!rp) return { mark: "neutral", text: "Risk plan: not available" };
  if (!rp.fits_house_rule) return { mark: "down", text: "Risk plan: not worth it", note: `the first target is less than ${min} times as far as the stop` };
  if (rp.tp1_basis !== "resistance") return { mark: "up", text: "Risk plan: worth it, on paper", note: "nothing overhead, so the target is set from the risk: arithmetic, not upside" };
  return { mark: "up", text: "Risk plan: worth it", note: `the first target is at least ${min} times as far as the stop` };
}

/** "The eight checks": [{id, n, name, name_he, mark: up|down|neutral, text, note?}] in the checklist's order. */
export function eightChecks(row, cfg) {
  const step = (id, i) => cfg?.steps?.find((s) => s.id === id) ?? { id, n: i + 1, name: id };
  const lean = (id) => row?.score?.leans?.[id] ?? row?.[id]?.lean ?? "neutral";
  const min = cfg?.house_rule?.min_reward_to_risk ?? 2;
  const risk = riskRow(row?.risk_plan, min);
  const text = {
    candle: candleRow(row?.candle), trend: { up: "Trend: going up", down: "Trend: going down" }[row?.trend?.direction] ?? "Trend: sideways, no clear direction",
    volume: volumeRow(row?.volume), ma20: ma20Row(row?.ma20), gaps: gapsRow(row?.gaps), levels: levelsRow(row?.levels), rsi: rsiRow(row?.rsi),
  };
  return ["candle", "trend", "volume", "ma20", "gaps", "levels", "rsi", "risk_plan"].map((id, i) => {
    const s = step(id, i);
    const base = { id, n: s.n ?? i + 1, name: s.name, name_he: s.name_he ?? null };
    return id === "risk_plan" ? { ...base, ...risk } : { ...base, mark: MARK[lean(id)] ?? "neutral", text: text[id] };
  });
}

/** A percent distance as a rounded whole number for the brief: "about 4%", or "less than 1%". */
export function aboutPct(v) {
  const x = Math.abs(Number(v));
  if (!Number.isFinite(x)) return "";
  return x < 0.5 ? "less than 1%" : `about ${Math.round(x)}%`;
}

/** "about 2.4": reward-to-risk, one decimal below ten, whole above. */
export function aboutTimes(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "";
  return `about ${x < 10 ? x.toFixed(1).replace(/\.0$/, "") : Math.round(x)}`;
}

const STOP_WHY = { support: "just under support", atr: "about two normal days' swings down", min_atr: "one normal day's swing down, the closest allowed" };

/**
 * "Where to invest (on paper)": whether a NEW paper entry is within the house rules today (setup checks: three of four
 * pass and not stretched; the checklist's risk plan: reward-to-risk to TP1 at least two) and the plan in whole percents,
 * or why not and what would change it. Inputs: the checklist row (or null), {passed, stretched} from the setup checks,
 * the checklist read state from readable(), the house minimum and the benchmark label. Never "buy now".
 * Returns {ok, head, plan: [lines], why: [lines], wait: [lines]}.
 */
export function wherePaper({ row, setup, read = { ok: true }, min = 2, benchLabel = "the Nasdaq-100" }) {
  const passed = setup?.passed ?? 0, stretched = Boolean(setup?.stretched);
  const rp = read.ok ? row?.risk_plan ?? null : null;
  const why = [], wait = [];
  if (stretched) { why.push("it has run too far above its trend"); wait.push("wait until it cools down"); }
  if (passed < 3) {
    why.push("fewer than three of the four setup checks pass");
    const c = setup?.checks ?? {};
    if (c.trend === false) wait.push("wait for the trend to turn up");
    if (c.rs_3m === false || c.rs_6m === false) wait.push(`wait until it does better than ${benchLabel} again`);
  }
  if (!rp) {
    why.push(read.ok ? "there is no written risk plan for it" : "the risk plan needs today's checklist");
    if (!read.ok) wait.push("wait for the next daily run");
  } else if (!rp.fits_house_rule) {
    why.push("the possible gain is too small for the risk");
    wait.push("wait for a pullback toward support, or a clean break above resistance");
  }
  if (read.ok && row?.rsi?.zone === "overbought" && !wait.includes("wait until it cools down")) wait.push("wait until it cools down");
  if (read.ok && row?.trend?.direction === "down" && !wait.includes("wait for the trend to turn up")) wait.push("wait for the trend to turn up");
  const ok = !why.length;
  const plan = ok
    ? [
        `Stop: sell if it falls ${aboutPct(rp.stop_pct)} (${STOP_WHY[rp.stop_basis] ?? "below the entry"})`,
        `First target: take some profit ${aboutPct(rp.tp1_pct)} higher${rp.tp1_basis === "resistance" ? " (at resistance)" : " (nothing overhead, so set at twice the risk)"}`,
        `Second target: ${aboutPct(rp.tp2_pct)} higher`,
        `You risk one to make ${aboutTimes(rp.rr_tp1)}`,
      ]
    : [];
  return {
    ok,
    head: ok ? "Within the house rules for a paper entry" : "Not within the house rules today",
    plan, why, wait: [...new Set(wait)],
    min,
  };
}

/** The setup gate's inputs from a derived.json row: {passed, stretched, checks}. */
export function setupState(row, stretchPct = 15) {
  const st = row?.setup;
  if (st?.checks) return { passed: st.passed ?? Object.values(st.checks).filter(Boolean).length, stretched: Boolean(st.stretched), checks: st.checks };
  const d = num(row?.dist_sma50_pct) ?? 0;
  const checks = { trend: d > 0, rs_3m: (row?.vs_bench_60d_pct ?? 0) > 0, rs_6m: (row?.vs_bench_120d_pct ?? 0) > 0, calm: d < stretchPct };
  return { passed: Object.values(checks).filter(Boolean).length, stretched: !checks.calm, checks };
}
