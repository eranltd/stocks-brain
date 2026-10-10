// View helpers for the technical checklist (config/checklist.json + data/market/checklist.json). Every number comes
// from scripts/market.py; this file only words them. Percent distances only: no prices, levels or raw volume.

import { fmtDate, fmtPct } from "./format.js";

export const VERDICT = {
  lean_up: { word: "Leans up", short: "lean up", tone: "accent" },
  mixed: { word: "Mixed", short: "mixed", tone: "flat" },
  lean_down: { word: "Leans down", short: "lean down", tone: "down" },
};
export const LEAN_TONE = { bullish: "accent", bearish: "down", neutral: "flat" };
export const LEAN_WORD = { bullish: "bullish", bearish: "bearish", neutral: "neutral" };
export const STEP_IDS = ["candle", "trend", "volume", "ma20", "gaps", "levels", "rsi", "risk_plan"];

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const abs1 = (v) => `${Math.abs(v).toFixed(1)}%`;
const x2 = (v) => `${Number(v).toFixed(2).replace(/0$/, "")}×`;
const param = (cfg, id, key, dflt) => cfg?.steps?.find((s) => s.id === id)?.params?.[key] ?? dflt;

/** Notes in the data name their parameters ("every step_days trading days"); show the numbers instead. */
export function fillNote(text, obj) {
  return String(text ?? "").replace(/\b(step_days|horizon_days)\b/g, (k) => (obj?.[k] != null ? String(obj[k]) : k));
}

/** The checklist row for one symbol, or null. */
export function rowFor(checklist, symbol) {
  return (checklist?.symbols ?? []).find((s) => s.symbol === symbol) ?? null;
}

function closeWords(c) {
  const p = num(c?.close_in_range_pct);
  if (p == null) return "";
  return p >= 66 ? `, closing near the high (${Math.round(p)}% up the range)` : p <= 33 ? `, closing near the low (${Math.round(p)}% up the range)` : `, closing mid-range (${Math.round(p)}%)`;
}

export function candleLine(c) {
  if (!c) return "";
  const d = c.daily, w = c.weekly;
  const parts = [];
  if (d) parts.push(`Daily: ${d.pattern}${closeWords(d)}.`);
  if (w) parts.push(`${w.partial ? "Week so far" : "Last week"}: ${w.pattern}${w.partial ? " (partial)" : ""}.`);
  if (d && w && d.lean !== "neutral" && w.lean !== "neutral" && d.lean !== w.lean) parts.push("They disagree, so neutral.");
  return parts.join(" ");
}

const DIRECTION = { up: "Uptrend", down: "Downtrend", sideways: "Sideways" };

export function trendLine(t, cfg) {
  if (!t) return "";
  const slopeDays = param(cfg, "trend", "slope_days", 10);
  const pts = `${t.points > 0 ? "+" : t.points < 0 ? "−" : ""}${Math.abs(t.points)} of 4 points`;
  return `${DIRECTION[t.direction] ?? t.direction} (${pts}): ${fmtPct(t.dist_sma50_pct, 1)} vs its 50-day average, which is ${t.sma50_above_sma200 ? "above" : "below"} the 200-day and ${t.slope50_pct >= 0 ? "rising" : "falling"} (${fmtPct(t.slope50_pct, 1)} over ${slopeDays} days); ${t.structure}.`;
}

export function volumeLine(v, cfg) {
  if (!v) return "";
  const avg = param(cfg, "volume", "avg_days", 20), td = param(cfg, "volume", "trend_days", 10);
  let head;
  if (v.rising_on_falling_volume) head = `Price up ${abs1(v.move_pct)} in ${td} days on falling volume: a possible bull trap.`;
  else if (v.verdict === "confirms") head = `Volume backs the ${v.move === "falling" ? "fall" : "rise"} (${fmtPct(v.move_pct, 1)} in ${td} days).`;
  else if (v.verdict === "weakening" && v.move === "falling") head = `Falling on fading volume: weakening, but we do not call bottoms (${fmtPct(v.move_pct, 1)} in ${td} days).`;
  else if (v.verdict === "weakening") head = `The rise is weakening: down-day volume leads (${fmtPct(v.move_pct, 1)} in ${td} days).`;
  else head = v.move === "flat" ? `Price about flat over ${td} days (${fmtPct(v.move_pct, 1)}).` : `Volume neither backs nor fades the move (${fmtPct(v.move_pct, 1)} in ${td} days).`;
  const nums = [
    num(v.up_down_ratio_20d) != null && `up-day volume ${x2(v.up_down_ratio_20d)} down-day volume over ${avg} days`,
    num(v.vs_avg20) != null && `last day ${x2(v.vs_avg20)} its ${avg}-day average`,
    num(v.trend_pct) != null && `${td}-day volume ${fmtPct(v.trend_pct, 0)} vs the ${td} before`,
  ].filter(Boolean);
  return nums.length ? `${head} ${nums.join("; ").replace(/^./, (c) => c.toUpperCase())}.` : head;
}

export function ma20Line(m, cfg) {
  if (!m) return "";
  const sd = param(cfg, "ma20", "slope_days", 5);
  return `${abs1(m.dist_pct)} ${m.side} its 20-day average, which is ${m.slope_pct >= 0 ? "rising" : "falling"} (${fmtPct(m.slope_pct, 1)} over ${sd} days).`;
}

export function gapsLine(g, cfg) {
  if (!g) return "";
  const lb = param(cfg, "gaps", "lookback_days", 60);
  if (!g.above && !g.below) return `No open gaps in the last ${lb} trading days.`;
  const n = g.nearest;
  const counts = `${g.above} open above, ${g.below} below.`;
  if (!n) return counts;
  return `${counts} Nearest: a ${abs1(n.size_pct)} gap ${n.where}, ${abs1(n.dist_pct)} away, open ${n.days_open} days${n.moving_toward ? "; price is moving toward it" : ""}.`;
}

const lvl = (l) => `${abs1(l.dist_pct)} (${l.touches} ${l.touches === 1 ? "touch" : "touches"})`;

export function levelsLine(l) {
  if (!l) return "";
  const sup = l.support?.length ? `Support ${l.support.map(lvl).join(", ")} below.` : "No support below in the past year.";
  const res = l.resistance?.length ? `Resistance ${l.resistance.map(lvl).join(", ")} above.` : "No resistance overhead in the past year.";
  return `${sup} ${res}`;
}

export function rsiLine(r, cfg) {
  if (!r) return "";
  const ob = param(cfg, "rsi", "overbought", 70), os = param(cfg, "rsi", "oversold", 30);
  const zone = r.zone === "overbought" ? "overbought, which leans bearish" : r.zone === "oversold" ? "oversold, which leans bullish" : "neutral";
  // Whole numbers, except next to a threshold, where rounding could show "70" for a reading that is not overbought.
  const v = Number(r.value);
  const shown = [ob, os].some((t) => Math.abs(v - t) < 0.5) ? v.toFixed(1) : v.toFixed(0);
  return `RSI ${shown}: ${zone} (overbought at ${ob} or more, oversold at ${os} or less).`;
}

const STOP_BASIS = { support: "just under the nearest support", atr: "two ATRs below the close", min_atr: "one ATR, the closest allowed" };

/** The written risk plan in words, plus whether it meets the house rule. */
export function riskPlan(rp, cfg) {
  if (!rp) return null;
  const min = cfg?.house_rule?.min_reward_to_risk ?? 2;
  const mult = param(cfg, "risk_plan", "risk_multiple", 2);
  const tp1Basis = rp.tp1_basis === "resistance" ? "at the nearest resistance" : `at ${mult}× the risk: no resistance overhead in the past year, so it fits the rule by construction`;
  const tp2Basis = rp.tp2_basis === "resistance" ? "at the next resistance" : "set from the risk: no second resistance";
  return {
    stop: { pct: rp.stop_pct, basis: STOP_BASIS[rp.stop_basis] ?? rp.stop_basis },
    tp1: { pct: rp.tp1_pct, basis: tp1Basis, byConstruction: rp.tp1_basis !== "resistance" },
    tp2: { pct: rp.tp2_pct, basis: tp2Basis },
    rr1: rp.rr_tp1, rr2: rp.rr_tp2, atr: rp.atr_pct, fits: Boolean(rp.fits_house_rule), min,
    text: `Stop ${abs1(rp.stop_pct)} below, TP1 ${abs1(rp.tp1_pct)} above, TP2 ${abs1(rp.tp2_pct)} above: reward-to-risk ${Number(rp.rr_tp1).toFixed(1)} to TP1 (need ${min} or more).`,
  };
}

/** The eight rows of the card: {id, n, name, lean, text}. The risk plan has no lean. */
export function stepRows(row, cfg) {
  const step = (id) => cfg?.steps?.find((s) => s.id === id) ?? { id, name: id };
  const text = {
    candle: candleLine(row.candle), trend: trendLine(row.trend, cfg), volume: volumeLine(row.volume, cfg), ma20: ma20Line(row.ma20, cfg),
    gaps: gapsLine(row.gaps, cfg), levels: levelsLine(row.levels), rsi: rsiLine(row.rsi, cfg), risk_plan: riskPlan(row.risk_plan, cfg)?.text ?? "",
  };
  return STEP_IDS.map((id, i) => ({
    id, n: step(id).n ?? i + 1, name: step(id).name,
    lean: id === "risk_plan" ? null : row.score?.leans?.[id] ?? row[id]?.lean ?? "neutral",
    text: text[id],
  }));
}

/**
 * One sentence for a verdict's history: "When it read lean up, the name beat the Nasdaq-100 by 1.1 points on average over
 * the next 20 trading days (231 cases, 90% range −0.2 to +2.1)". Null without cases.
 */
export function baseRateLine(br, verdict, benchLabel = "benchmark") {
  const r = br?.by_verdict?.find((x) => x.verdict === verdict);
  if (!r || !r.n || num(r.mean) == null) return null;
  const range = num(r.ci_low) != null ? `, 90% range ${fmtPct(r.ci_low, 1)} to ${fmtPct(r.ci_high, 1)}` : "";
  return `When it read ${VERDICT[verdict]?.short ?? verdict}, the name ${r.mean >= 0 ? "beat" : "trailed"} the ${benchLabel} by ${Math.abs(r.mean).toFixed(1)} points on average over the next ${br.horizon_days} trading days (${r.n} cases${range}).`;
}

/** Whether a verdict's history beats "every snapshot" with a range clear of it: almost never, and we say so. */
export function edgeWords(br) {
  const up = br?.by_verdict?.find((x) => x.verdict === "lean_up");
  const all = br?.all;
  if (!up?.n || !all?.n || num(up.ci_low) == null) return null;
  if (up.ci_low > all.mean) return "Lean-up readings did better than the average snapshot, even at the low end of their range. In-sample and on survivors, so still unproven.";
  if (up.mean > all.mean) return `Lean-up readings did a little better than the average snapshot (${fmtPct(all.mean, 1)}), but within the noise: not an edge we can trust.`;
  return `Lean-up readings did no better than the average snapshot (${fmtPct(all.mean, 1)}).`;
}

/** Forward record in words: snapshots written, scored so far, when the first scores arrive. */
export function forwardWords(fwd) {
  if (!fwd) return "The forward record starts with the next daily run.";
  const recs = fwd.records?.length ?? 0;
  const scored = fwd.scored_records ?? 0;
  const head = `Forward record since ${fwd.started}: ${recs} ${recs === 1 ? "snapshot" : "snapshots"} written, ${scored} scored.`;
  return scored ? head : `${head} The first is scored ${fwd.horizon_days} trading days after it was written.`;
}

/** The fourth "Can we act on this?" reason: the household's written risk plan rule (household.md, Before acting step 4). */
export function gateReason(checklist, row, cfg, lastClose = null) {
  const min = cfg?.house_rule?.min_reward_to_risk ?? checklist?.house_rule?.min_reward_to_risk ?? 2;
  if (!checklist) return { ok: false, text: "Risk plan: the technical checklist appears after the next daily run" };
  if (!row?.risk_plan) return { ok: false, text: "Risk plan: no checklist for this name (not enough data)" };
  if (checklist.sample) return { ok: false, text: "Risk plan: computed from sample prices here, so it cannot count" };
  // A plan written from an older close than the one shown is out of date (the checklist step failed or has not run yet).
  if (lastClose && row.as_of && row.as_of < lastClose) return { ok: false, text: `Risk plan: the checklist is from the ${fmtDate(row.as_of)} close, older than the last close; wait for it to update` };
  const rp = row.risk_plan;
  const rr = Number(rp.rr_tp1).toFixed(1);
  if (rp.tp1_basis !== "resistance") {
    return { ok: Boolean(rp.fits_house_rule), text: `Risk plan: no resistance in the past year, so TP1 sits at ${rr}× the risk by construction (need ${min} or more). It fits, but that is arithmetic, not upside` };
  }
  return { ok: Boolean(rp.fits_house_rule), text: `Risk plan: reward-to-risk to TP1 is ${rr} (need ${min} or more)` };
}
