// "<Company> in short": the one-stock brief at the top of the Stock page, worded from the site's eight-step chart
// checklist (config/checklist.json, data/market/checklist.json), the setup checks and the outlook card. Pure functions,
// no React. Every number comes from Python; this file only words it. Percent distances only, rounded to whole percents:
// never a price or a level. It never says "buy": a paper entry is either within this site's rules or not, and why.
// The texts are in text/stock.js ("br.*").

import { strings } from "./text.js";
import dict from "../text/stock.js";

const t = strings(dict);

/** The checklist verdict as a big plain word. */
export const VERDICT_PLAIN = {
  lean_up: { word: "Going up", tone: "accent", mark: "up" },
  mixed: { word: "Mixed", tone: "flat", mark: "neutral" },
  lean_down: { word: "Going down", tone: "down", mark: "down" },
};
const MARK = { bullish: "up", bearish: "down", neutral: "neutral" };
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const BRIEF_FOOTER = t("br.footer");
export const NO_CHECKLIST = t("br.noChecklist");

/**
 * Whether a checklist row can be read for this name today: {ok, why}. A checklist from sample prices on a live site, or
 * a row from an older close than the one the page shows, is not today's reading.
 */
export function readable(checklist, row, lastClose = null, { sampleSite = false } = {}) {
  if (!checklist) return { ok: false, why: NO_CHECKLIST };
  if (checklist.sample && !sampleSite) return { ok: false, why: t("br.read.sample") };
  if (!row) return { ok: false, why: t("br.read.noRow") };
  if (lastClose && row.as_of && row.as_of < lastClose) return { ok: false, why: t("br.read.older") };
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

function candleRow(c, t) {
  const d = c?.daily?.lean, w = c?.weekly?.lean;
  if (d && w && d !== "neutral" && w !== "neutral" && d !== w) return t("br.row.candle.disagree");
  return t({ bullish: "br.row.candle.up", bearish: "br.row.candle.down" }[c?.lean] ?? "br.row.candle.none");
}

function volumeRow(v, t) {
  if (v?.rising_on_falling_volume) return t("br.row.volume.trap");
  if (v?.verdict === "confirms") return t(v.move === "falling" ? "br.row.volume.backsFall" : "br.row.volume.backsMove");
  if (v?.verdict === "weakening") return t(v.move === "falling" ? "br.row.volume.sellingFades" : "br.row.volume.riseFades");
  return t(v?.move === "flat" ? "br.row.volume.flat" : "br.row.volume.none");
}

function ma20Row(m, t) {
  if (!m) return t("br.row.ma20.none");
  const rising = num(m.slope_pct) != null && m.slope_pct > 0;
  if (m.side === "above") return t(rising ? "br.row.ma20.aboveRising" : "br.row.ma20.aboveFalling");
  return t(rising ? "br.row.ma20.belowRising" : "br.row.ma20.belowFalling");
}

function gapsRow(g, t) {
  if (g?.lean === "bullish") return t("br.row.gaps.above");
  if (g?.lean === "bearish") return t("br.row.gaps.below");
  return t(g?.nearest ? "br.row.gaps.far" : "br.row.gaps.none");
}

function levelsRow(l, t) {
  const sup = l?.support?.length ?? 0, res = l?.resistance?.length ?? 0;
  if (l?.lean === "bullish") return t(res ? "br.row.levels.room" : "br.row.levels.nothingOver");
  if (l?.lean === "bearish") return t(sup ? "br.row.levels.close" : "br.row.levels.nothingUnder");
  return t("br.row.levels.between");
}

function rsiRow(r, t) {
  return t({ overbought: "br.row.rsi.hot", oversold: "br.row.rsi.oversold" }[r?.zone] ?? "br.row.rsi.normal");
}

function riskRow(rp, min, t) {
  if (!rp) return { mark: "neutral", text: t("br.row.risk.none") };
  if (!rp.fits_house_rule) return { mark: "down", text: t("br.row.risk.no"), note: t("br.row.risk.noNote", { min }) };
  if (rp.tp1_basis !== "resistance") return { mark: "up", text: t("br.row.risk.paper"), note: t("br.row.risk.paperNote") };
  return { mark: "up", text: t("br.row.risk.yes"), note: t("br.row.risk.yesNote", { min }) };
}

/** "The eight checks": [{id, n, name, mark: up|down|neutral, text, note?}] in the checklist's order. */
export function eightChecks(row, cfg) {
  const step = (id, i) => cfg?.steps?.find((s) => s.id === id) ?? { id, n: i + 1, name: id };
  const lean = (id) => row?.score?.leans?.[id] ?? row?.[id]?.lean ?? "neutral";
  const min = cfg?.house_rule?.min_reward_to_risk ?? 2;
  const risk = riskRow(row?.risk_plan, min, t);
  const text = {
    candle: candleRow(row?.candle, t),
    trend: t({ up: "br.row.trend.up", down: "br.row.trend.down" }[row?.trend?.direction] ?? "br.row.trend.side"),
    volume: volumeRow(row?.volume, t), ma20: ma20Row(row?.ma20, t), gaps: gapsRow(row?.gaps, t), levels: levelsRow(row?.levels, t), rsi: rsiRow(row?.rsi, t),
  };
  return ["candle", "trend", "volume", "ma20", "gaps", "levels", "rsi", "risk_plan"].map((id, i) => {
    const s = step(id, i);
    const base = { id, n: s.n ?? i + 1, name: s.name };
    return id === "risk_plan" ? { ...base, ...risk } : { ...base, mark: MARK[lean(id)] ?? "neutral", text: text[id] };
  });
}

/** A percent distance as a rounded whole number for the brief: "about 4%", or "less than 1%". */
export function aboutPct(v) {
  const x = Math.abs(Number(v));
  if (!Number.isFinite(x)) return "";
  return x < 0.5 ? t("br.lessThan1") : t("br.aboutPct", { pct: `${Math.round(x)}%` });
}

/** "about 2.4": reward-to-risk, one decimal below ten, whole above. */
export function aboutTimes(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "";
  return t("br.aboutTimes", { x: x < 10 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x)) });
}

const STOP_WHY = { support: "br.stopWhy.support", atr: "br.stopWhy.atr", min_atr: "br.stopWhy.minAtr" };

/**
 * "Where to invest (on paper)": whether a NEW paper entry is within this site's rules today (setup checks: three of four
 * pass and not stretched; the checklist's risk plan: reward-to-risk to TP1 at least two) and the plan in whole percents,
 * or why not and what would change it. Inputs: the checklist row (or null), {passed, stretched} from the setup checks,
 * the checklist read state from readable(), the site's minimum and the benchmark label. Never "buy now".
 * Returns {ok, head, plan: [lines], why: [lines], wait: [lines]}.
 */
export function wherePaper({ row, setup, read = { ok: true }, min = 2, benchLabel = "the Nasdaq-100" }) {
  const passed = setup?.passed ?? 0, stretched = Boolean(setup?.stretched);
  const rp = read.ok ? row?.risk_plan ?? null : null;
  const why = [], wait = [];
  const cool = t("br.wait.cool"), turn = t("br.wait.trendUp");
  if (stretched) { why.push(t("br.why.stretched")); wait.push(cool); }
  if (passed < 3) {
    why.push(t("br.why.fewChecks"));
    const c = setup?.checks ?? {};
    if (c.trend === false) wait.push(turn);
    if (c.rs_3m === false || c.rs_6m === false) wait.push(t("br.wait.beatBench", { bench: benchLabel }));
  }
  if (!rp) {
    why.push(t(read.ok ? "br.why.noPlan" : "br.why.needsChecklist"));
    if (!read.ok) wait.push(t("br.wait.nextRun"));
  } else if (!rp.fits_house_rule) {
    why.push(t("br.why.smallGain"));
    wait.push(t("br.wait.pullback"));
  }
  if (read.ok && row?.rsi?.zone === "overbought" && !wait.includes(cool)) wait.push(cool);
  if (read.ok && row?.trend?.direction === "down" && !wait.includes(turn)) wait.push(turn);
  const ok = !why.length;
  const plan = ok
    ? [
        t("br.plan.stop", { pct: aboutPct(rp.stop_pct), why: t(STOP_WHY[rp.stop_basis] ?? "br.stopWhy.entry") }),
        t(rp.tp1_basis === "resistance" ? "br.plan.tp1Res" : "br.plan.tp1Risk", { pct: aboutPct(rp.tp1_pct) }),
        t("br.plan.tp2", { pct: aboutPct(rp.tp2_pct) }),
        t("br.plan.rr", { x: aboutTimes(rp.rr_tp1) }),
      ]
    : [];
  return {
    ok,
    head: t(ok ? "br.head.ok" : "br.head.no"),
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
