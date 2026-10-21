// "<Company> in short": the one-stock brief at the top of the Stock page, worded from the site's eight-step chart
// checklist (config/checklist.json, data/market/checklist.json), the setup checks and the outlook card. Pure functions,
// no React. Every number comes from Python; this file only words it. Percent distances only, rounded to whole percents:
// never a price or a level. It never says "buy": a paper entry is either within this site's rules or not, and why.
// Every function that writes words takes `lang` ("en" by default); the texts are in i18n/stock.js ("br.*").

import { translate } from "./i18n.js";
import dict from "../i18n/stock.js";

const tr = (lang) => translate(dict, lang);

/** The checklist verdict as a big plain word (English; verdictPlain(lang) for another language). */
export const VERDICT_PLAIN = {
  lean_up: { word: "Going up", tone: "accent", mark: "up" },
  mixed: { word: "Mixed", tone: "flat", mark: "neutral" },
  lean_down: { word: "Going down", tone: "down", mark: "down" },
};
/** VERDICT_PLAIN in a language. */
export function verdictPlain(lang = "en") {
  const t = tr(lang);
  return Object.fromEntries(Object.entries(VERDICT_PLAIN).map(([k, v]) => [k, { ...v, word: t(`br.verdict.${k}`) }]));
}
const MARK = { bullish: "up", bearish: "down", neutral: "neutral" };
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const briefFooter = (lang = "en") => tr(lang)("br.footer");
export const noChecklist = (lang = "en") => tr(lang)("br.noChecklist");
export const BRIEF_FOOTER = briefFooter("en");
export const NO_CHECKLIST = noChecklist("en");

/**
 * Whether a checklist row can be read for this name today: {ok, why}. A checklist from sample prices on a live site, or
 * a row from an older close than the one the page shows, is not today's reading.
 */
export function readable(checklist, row, lastClose = null, { sampleSite = false, lang = "en" } = {}) {
  const t = tr(lang);
  if (!checklist) return { ok: false, why: noChecklist(lang) };
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

// scripts/market.py PHRASE: the summary is built from these few phrases only, so another language can say it whole.
const PHRASE_KEY = {
  "bullish candles": "candle.up", "bearish candles": "candle.down", "an uptrend": "trend.up", "a downtrend": "trend.down",
  "volume backs the rise": "volume.up", "volume does not back the move": "volume.down",
  "above a rising twenty-day average": "ma20.up", "below a falling twenty-day average": "ma20.down",
  "an open gap above": "gaps.up", "an open gap below": "gaps.down", "room up to resistance": "levels.up",
  "pressed under resistance": "levels.down", "RSI oversold": "rsi.up", "RSI overbought": "rsi.down",
};
const SUMMARY = /^(?:Leans up|Leans down|Mixed)(?::\s*([^;.]*))?(?:;\s*against it,\s*([^.]*))?\.\s*(?:Reward-to-risk (fits|is below) the house rule\.)?\s*$/;

/** The summary said whole in another language, from its known phrases; null when it holds anything else. */
function translatedSummary(summary, lang) {
  const m = SUMMARY.exec(String(summary ?? "").trim());
  if (!m) return null;
  const t = tr(lang);
  const say = (list) => {
    const xs = (list ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (xs.some((x) => !PHRASE_KEY[x])) return null;
    return xs.map((x) => t(`br.phrase.${PHRASE_KEY[x]}`));
  };
  const pro = say(m[1]), con = say(m[2]);
  if (!pro || !con) return null;
  const parts = [];
  if (pro.length && con.length) parts.push(t("br.sum.both", { pro: pro.join(", "), con: con.join(", ") }, { bidi: false }));
  else if (pro.length) parts.push(t("br.sum.pro", { pro: pro.join(", ") }, { bidi: false }));
  else if (con.length) parts.push(t("br.sum.con", { con: con.join(", ") }, { bidi: false }));
  if (m[3]) parts.push(t(m[3] === "fits" ? "br.sum.rrFits" : "br.sum.rrBelow"));
  return parts.join(" ");
}

/**
 * The checklist's own summary without its leading verdict word (the brief shows the verdict big above it), in everyday
 * words. In another language it is said whole when it is made of the known phrases, else it stays English.
 */
export function plainSummary(summary, lang = "en") {
  if (lang !== "en" && summary) {
    const s = translatedSummary(summary, lang);
    if (s != null) return s;
  }
  let s = String(summary ?? "").replace(/^(Leans up|Leans down|Mixed)\s*[:.]\s*/, "").trim();
  for (const [re, to] of EVERYDAY) s = s.replace(re, to);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** "Going up or down?": {word, tone, mark, summary}, or null without a reading. */
export function direction(row, lang = "en") {
  const v = verdictPlain(lang)[row?.score?.verdict];
  return v ? { ...v, summary: plainSummary(row.score.summary, lang) } : null;
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

/** A step's name: the config's (English), or this site's own words for it in another language. */
export function stepName(s, lang = "en") {
  const t = tr(lang);
  return lang !== "en" && t.has(`step.${s.id}`) ? t(`step.${s.id}`) : s.name;
}

/** "The eight checks": [{id, n, name, mark: up|down|neutral, text, note?}] in the checklist's order. */
export function eightChecks(row, cfg, lang = "en") {
  const t = tr(lang);
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
    const base = { id, n: s.n ?? i + 1, name: stepName(s, lang) };
    return id === "risk_plan" ? { ...base, ...risk } : { ...base, mark: MARK[lean(id)] ?? "neutral", text: text[id] };
  });
}

/** A percent distance as a rounded whole number for the brief: "about 4%", or "less than 1%". */
export function aboutPct(v, lang = "en") {
  const x = Math.abs(Number(v));
  if (!Number.isFinite(x)) return "";
  const t = typeof lang === "string" ? tr(lang) : tr("en"); // also safe as a .map() callback
  return x < 0.5 ? t("br.lessThan1") : t("br.aboutPct", { pct: `${Math.round(x)}%` });
}

/** "about 2.4": reward-to-risk, one decimal below ten, whole above. */
export function aboutTimes(v, lang = "en") {
  const x = Number(v);
  if (!Number.isFinite(x)) return "";
  const t = typeof lang === "string" ? tr(lang) : tr("en");
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
export function wherePaper({ row, setup, read = { ok: true }, min = 2, benchLabel = "the Nasdaq-100", lang = "en" }) {
  const t = tr(lang);
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
        t("br.plan.stop", { pct: aboutPct(rp.stop_pct, lang), why: t(STOP_WHY[rp.stop_basis] ?? "br.stopWhy.entry") }, { bidi: false }),
        t(rp.tp1_basis === "resistance" ? "br.plan.tp1Res" : "br.plan.tp1Risk", { pct: aboutPct(rp.tp1_pct, lang) }, { bidi: false }),
        t("br.plan.tp2", { pct: aboutPct(rp.tp2_pct, lang) }, { bidi: false }),
        t("br.plan.rr", { x: aboutTimes(rp.rr_tp1, lang) }, { bidi: false }),
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
