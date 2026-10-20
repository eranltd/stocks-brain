// View helpers for the technical checklist (config/checklist.json + data/market/checklist.json). Every number comes
// from scripts/market.py; this file only words them. Percent distances only: no prices, levels or raw volume.
// Every function that writes words takes `lang` last ("en" by default); the texts are in i18n/stock.js ("cl.*").

import { fmtDate, fmtPct } from "./format.js";
import { translate } from "./i18n.js";
import dict from "../i18n/stock.js";

const tr = (lang) => translate(dict, lang);

export const VERDICT = {
  lean_up: { word: "Leans up", short: "lean up", tone: "accent" },
  mixed: { word: "Mixed", short: "mixed", tone: "flat" },
  lean_down: { word: "Leans down", short: "lean down", tone: "down" },
};
/** VERDICT in a language. */
export function verdictWords(lang = "en") {
  const t = tr(lang);
  return Object.fromEntries(Object.entries(VERDICT).map(([k, v]) => [k, { ...v, word: t(`cl.verdict.${k}`), short: t(`cl.verdictShort.${k}`) }]));
}
export const LEAN_TONE = { bullish: "accent", bearish: "down", neutral: "flat" };
export const LEAN_WORD = { bullish: "bullish", bearish: "bearish", neutral: "neutral" };
export const STEP_IDS = ["candle", "trend", "volume", "ma20", "gaps", "levels", "rsi", "risk_plan"];

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const abs1 = (v) => `${Math.abs(v).toFixed(1)}%`;
const x2s = (v) => Number(v).toFixed(2).replace(/0$/, "");
const param = (cfg, id, key, dflt) => cfg?.steps?.find((s) => s.id === id)?.params?.[key] ?? dflt;

/** Notes in the data name their parameters ("every step_days trading days"); show the numbers instead. */
export function fillNote(text, obj) {
  return String(text ?? "").replace(/\b(step_days|horizon_days)\b/g, (k) => (obj?.[k] != null ? String(obj[k]) : k));
}

/** The checklist row for one symbol, or null. */
export function rowFor(checklist, symbol) {
  return (checklist?.symbols ?? []).find((s) => s.symbol === symbol) ?? null;
}

/** A candle pattern's name (scripts/market.py classify_candle) in a language; an unknown one stays as written. */
export function patternName(p, lang = "en") {
  if (lang === "en" || p == null) return p;
  const t = tr(lang), k = `cl.pattern.${String(p).replace(/\s+/g, "_")}`;
  return t.has(k) ? t(k) : p;
}

export function candleLine(c, lang = "en") {
  if (!c) return "";
  const t = tr(lang);
  const d = c.daily, w = c.weekly;
  const parts = [];
  if (d) {
    const p = num(d.close_in_range_pct);
    const where = p == null ? "none" : p >= 66 ? "high" : p <= 33 ? "low" : "mid";
    parts.push(t(`cl.daily.${where}`, { pattern: patternName(d.pattern, lang), pct: p == null ? null : `${Math.round(p)}%` }));
  }
  if (w) parts.push(t(w.partial ? "cl.week.partial" : "cl.week.last", { pattern: patternName(w.pattern, lang) }));
  if (d && w && d.lean !== "neutral" && w.lean !== "neutral" && d.lean !== w.lean) parts.push(t("cl.disagree"));
  return parts.join(" ");
}

export function trendLine(tr0, cfg, lang = "en") {
  if (!tr0) return "";
  const t = tr(lang);
  const slopeDays = param(cfg, "trend", "slope_days", 10);
  const signed = `${tr0.points > 0 ? "+" : tr0.points < 0 ? "−" : ""}${Math.abs(tr0.points)}`;
  const dir = t.has(`cl.dir.${tr0.direction}`) ? t(`cl.dir.${tr0.direction}`) : tr0.direction;
  const structure = t.has(`cl.structure.${String(tr0.structure).replace(/\s+/g, "_")}`) ? t(`cl.structure.${String(tr0.structure).replace(/\s+/g, "_")}`) : tr0.structure;
  const key = `cl.trend.${tr0.sma50_above_sma200 ? "above" : "below"}${tr0.slope50_pct >= 0 ? "Rising" : "Falling"}`;
  return t(key, {
    dir, points: signed, d50: fmtPct(tr0.dist_sma50_pct, 1, lang), slope: fmtPct(tr0.slope50_pct, 1, lang), days: slopeDays, structure,
  });
}

export function volumeLine(v, cfg, lang = "en") {
  if (!v) return "";
  const t = tr(lang);
  const avg = param(cfg, "volume", "avg_days", 20), td = param(cfg, "volume", "trend_days", 10);
  const pct = fmtPct(v.move_pct, 1, lang);
  let head;
  if (v.rising_on_falling_volume) head = t("cl.vol.trap", { pct: abs1(v.move_pct), days: td });
  else if (v.verdict === "confirms") head = t(v.move === "falling" ? "cl.vol.backsFall" : "cl.vol.backsRise", { pct, days: td });
  else if (v.verdict === "weakening" && v.move === "falling") head = t("cl.vol.fadingFall", { pct, days: td });
  else if (v.verdict === "weakening") head = t("cl.vol.weakRise", { pct, days: td });
  else head = t(v.move === "flat" ? "cl.vol.flat" : "cl.vol.neither", { pct, days: td });
  const nums = [
    num(v.up_down_ratio_20d) != null && t("cl.vol.ratio", { x: x2s(v.up_down_ratio_20d), avg }),
    num(v.vs_avg20) != null && t("cl.vol.last", { x: x2s(v.vs_avg20), avg }),
    num(v.trend_pct) != null && t("cl.vol.trend", { pct: fmtPct(v.trend_pct, 0, lang), days: td }),
  ].filter(Boolean);
  if (!nums.length) return head;
  const tail = nums.join("; ");
  return `${head} ${lang === "en" ? tail.replace(/^./, (c) => c.toUpperCase()) : tail}.`;
}

export function ma20Line(m, cfg, lang = "en") {
  if (!m) return "";
  const sd = param(cfg, "ma20", "slope_days", 5);
  const key = `cl.ma20.${m.side === "above" ? "above" : "below"}${m.slope_pct >= 0 ? "Rising" : "Falling"}`;
  return tr(lang)(key, { dist: abs1(m.dist_pct), slope: fmtPct(m.slope_pct, 1, lang), days: sd });
}

export function gapsLine(g, cfg, lang = "en") {
  if (!g) return "";
  const t = tr(lang);
  const lb = param(cfg, "gaps", "lookback_days", 60);
  if (!g.above && !g.below) return t("cl.gaps.none", { days: lb });
  const n = g.nearest;
  const counts = t("cl.gaps.counts", { above: g.above, below: g.below });
  if (!n) return counts;
  const near = t(n.where === "below" ? "cl.gaps.nearBelow" : "cl.gaps.nearAbove", { size: abs1(n.size_pct), dist: abs1(n.dist_pct), count: n.days_open });
  return `${counts} ${near}${n.moving_toward ? t("cl.gaps.toward") : ""}.`;
}

export function levelsLine(l, lang = "en") {
  if (!l) return "";
  const t = typeof lang === "string" ? tr(lang) : tr("en");
  const lvl = (x) => t("cl.lvl.item", { dist: abs1(x.dist_pct), count: x.touches });
  const sup = l.support?.length ? t("cl.lvl.support", { list: l.support.map(lvl).join(", ") }, { bidi: false }) : t("cl.lvl.noSupport");
  const res = l.resistance?.length ? t("cl.lvl.resistance", { list: l.resistance.map(lvl).join(", ") }, { bidi: false }) : t("cl.lvl.noResistance");
  return `${sup} ${res}`;
}

export function rsiLine(r, cfg, lang = "en") {
  if (!r) return "";
  const ob = param(cfg, "rsi", "overbought", 70), os = param(cfg, "rsi", "oversold", 30);
  const zone = r.zone === "overbought" ? "overbought" : r.zone === "oversold" ? "oversold" : "neutral";
  // Whole numbers, except next to a threshold, where rounding could show "70" for a reading that is not overbought.
  const v = Number(r.value);
  const shown = [ob, os].some((x) => Math.abs(v - x) < 0.5) ? v.toFixed(1) : v.toFixed(0);
  return tr(lang)(`cl.rsi.${zone}`, { v: shown, ob, os });
}

const STOP_BASIS = { support: "cl.stop.support", atr: "cl.stop.atr", min_atr: "cl.stop.minAtr" };

/** The written risk plan in words, plus whether it meets this site's rule. */
export function riskPlan(rp, cfg, lang = "en") {
  if (!rp) return null;
  const t = tr(lang);
  const min = cfg?.house_rule?.min_reward_to_risk ?? 2;
  const mult = param(cfg, "risk_plan", "risk_multiple", 2);
  const byConstruction = rp.tp1_basis !== "resistance";
  const tp1Basis = byConstruction ? t("cl.tp1.risk", { mult }) : t("cl.tp1.res");
  const tp2Basis = t(rp.tp2_basis === "resistance" ? "cl.tp2.res" : "cl.tp2.risk");
  return {
    stop: { pct: rp.stop_pct, basis: STOP_BASIS[rp.stop_basis] ? t(STOP_BASIS[rp.stop_basis]) : rp.stop_basis },
    tp1: { pct: rp.tp1_pct, basis: tp1Basis, short: byConstruction ? t("cl.tp1.riskShort", { mult }) : tp1Basis, byConstruction },
    tp2: { pct: rp.tp2_pct, basis: tp2Basis },
    rr1: rp.rr_tp1, rr2: rp.rr_tp2, atr: rp.atr_pct, fits: Boolean(rp.fits_house_rule), min,
    text: t("cl.risk.text", { stop: abs1(rp.stop_pct), tp1: abs1(rp.tp1_pct), tp2: abs1(rp.tp2_pct), rr: Number(rp.rr_tp1).toFixed(1), min }),
  };
}

/** A step's name: the config's (English), or this site's own words for it in another language (i18n/stock.js). */
export function stepLabel(s, lang = "en") {
  const t = tr(lang);
  return lang !== "en" && t.has(`step.${s.id}`) ? t(`step.${s.id}`) : s.name;
}

/** The eight rows of the card: {id, n, name, lean, text}. The risk plan has no lean. */
export function stepRows(row, cfg, lang = "en") {
  const step = (id) => cfg?.steps?.find((s) => s.id === id) ?? { id, name: id };
  const text = {
    candle: candleLine(row.candle, lang), trend: trendLine(row.trend, cfg, lang), volume: volumeLine(row.volume, cfg, lang), ma20: ma20Line(row.ma20, cfg, lang),
    gaps: gapsLine(row.gaps, cfg, lang), levels: levelsLine(row.levels, lang), rsi: rsiLine(row.rsi, cfg, lang), risk_plan: riskPlan(row.risk_plan, cfg, lang)?.text ?? "",
  };
  return STEP_IDS.map((id, i) => ({
    id, n: step(id).n ?? i + 1, name: stepLabel(step(id), lang),
    lean: id === "risk_plan" ? null : row.score?.leans?.[id] ?? row[id]?.lean ?? "neutral",
    text: text[id],
  }));
}

/**
 * One sentence for a verdict's history: "When it read lean up, the name beat the Nasdaq-100 by 1.1 points on average over
 * the next 20 trading days (231 cases, 90% range −0.2 to +2.1)". Null without cases.
 */
export function baseRateLine(br, verdict, benchLabel = "benchmark", lang = "en") {
  const r = br?.by_verdict?.find((x) => x.verdict === verdict);
  if (!r || !r.n || num(r.mean) == null) return null;
  const t = tr(lang);
  const range = num(r.ci_low) != null ? t("cl.br.range", { lo: fmtPct(r.ci_low, 1, lang), hi: fmtPct(r.ci_high, 1, lang) }) : "";
  return t(r.mean >= 0 ? "cl.br.beat" : "cl.br.trailed", {
    v: verdictWords(lang)[verdict]?.short ?? verdict, bench: benchLabel, pts: Math.abs(r.mean).toFixed(1), days: br.horizon_days, count: r.n, range,
  });
}

/** Whether a verdict's history beats "every snapshot" with a range clear of it: almost never, and the site says so. */
export function edgeWords(br, lang = "en") {
  const up = br?.by_verdict?.find((x) => x.verdict === "lean_up");
  const all = br?.all;
  if (!up?.n || !all?.n || num(up.ci_low) == null) return null;
  const t = tr(lang);
  if (up.ci_low > all.mean) return t("cl.edge.clear");
  if (up.mean > all.mean) return t("cl.edge.noise", { pct: fmtPct(all.mean, 1, lang) });
  return t("cl.edge.none", { pct: fmtPct(all.mean, 1, lang) });
}

/** Forward record in words: snapshots written, scored so far, when the first scores arrive. */
export function forwardWords(fwd, lang = "en") {
  const t = tr(lang);
  if (!fwd) return t("cl.fwd.none");
  const recs = fwd.records?.length ?? 0;
  const scored = fwd.scored_records ?? 0;
  const head = t("cl.fwd.head", { since: lang === "en" || !fwd.started ? fwd.started : fmtDate(fwd.started, lang), count: recs, scored });
  return scored ? head : `${head} ${t("cl.fwd.first", { days: fwd.horizon_days })}`;
}

/** The fourth "Would the rules allow it?" reason: the site's written risk plan rule (Before acting, step 4). */
export function gateReason(checklist, row, cfg, lastClose = null, lang = "en") {
  const t = tr(lang);
  const min = cfg?.house_rule?.min_reward_to_risk ?? checklist?.house_rule?.min_reward_to_risk ?? 2;
  if (!checklist) return { ok: false, text: t("cl.gate.noFile") };
  if (!row?.risk_plan) return { ok: false, text: t("cl.gate.noRow") };
  if (checklist.sample) return { ok: false, text: t("cl.gate.sample") };
  // A plan written from an older close than the one shown is out of date (the checklist step failed or has not run yet).
  if (lastClose && row.as_of && row.as_of < lastClose) return { ok: false, text: t("cl.gate.older", { date: fmtDate(row.as_of, lang) }) };
  const rp = row.risk_plan;
  const rr = Number(rp.rr_tp1).toFixed(1);
  if (rp.tp1_basis !== "resistance") return { ok: Boolean(rp.fits_house_rule), text: t("cl.gate.byConstruction", { rr, min }) };
  return { ok: Boolean(rp.fits_house_rule), text: t("cl.gate.rr", { rr, min }) };
}
