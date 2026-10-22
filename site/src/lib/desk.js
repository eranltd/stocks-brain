// The Desk (Home's default view): six agents in a pipeline, Research -> News -> Strategy -> Execution -> Risk -> Boss,
// each a panel over the same published data. Pure functions, no React; tested in desk.test.js.
//
// Nothing here is new data or an AI's call: every number is read from published files (data/market/derived.json,
// data/market/checklist.json, data/market/why.json, data/market/sec_news.json, config/outlook.json and the brain's
// latest run), and every final call is made by the plain rules below. Percent changes only: no price and no raw volume
// ever leaves this file. The calls are pretend money ("BUY (paper)"); real money follows the weekly whole-market buy.
//
// Boss decision table (bossCall), first match wins. A hard limit or a broken setup is a REJECT; a limit the house rules
// tell us to wait out (docs/household.md: "if it is thinner, wait"; "never chase a stretched stock") is a WAIT:
//   Risk: no written plan, or the stop wider than the limit   -> REJECT, decided by Risk (its first hard reason)
//   the brain leans down (bearish)                             -> REJECT, decided by Strategy
//   Execution SKIP because the trend is down (setup invalid)   -> REJECT, decided by Execution
//   Risk: reward-to-risk under 2, or stretched above the 50-day -> WAIT,  decided by Risk (its first reason)
//   the brain is neutral or has no view                        -> WAIT,   decided by Strategy
//   Execution says WAIT or SKIP (no confirmation yet)          -> WAIT,   decided by Execution
//   fewer than five fresh reports                              -> WAIT,   decided by Boss
//   otherwise (up, passes, ENTER, 5/5)                         -> BUY (paper), decided by Boss
//
// Execution's three confirmations are unproven rules of thumb read from the checklist file (not a tested rule):
//   LEVEL  the close sits within one ATR above its nearest support, or nothing is overhead (it has cleared resistance)
//   VOLUME the day rose, volume ran at or above its 20-day average, and the checklist's volume step leans bullish
//   CLOSE  the daily candle leans bullish (it closed near the day's high)
//   ENTER = all three (and no downtrend); SKIP = none, or the trend is down; anything else WAIT.

import { dayMoves, UNUSUAL } from "./feed.js";
import { recentFilings } from "./secnews.js";
import { comingUp } from "./outlook.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const DAY = 86400000;
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const addDays = (iso, n) => new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);

/** The pipeline in order (the strip); the first five report to the Boss. */
export const AGENTS = ["research", "news", "strategy", "execution", "risk", "boss"];
export const REPORTERS = AGENTS.slice(0, 5);
/** The order the panels sit on the page: the answer first. */
export const PANEL_ORDER = ["boss", "research", "news", "strategy", "execution", "risk"];

/* ----------------------------------------------------------------- inputs */

/** Rows by symbol of a file with a `symbols` list (derived.json, checklist.json). */
export const bySymbol = (doc) => Object.fromEntries((doc?.symbols ?? []).map((s) => [s.symbol, s]));

/** The market date the Desk is about: the newest as_of of the market numbers and the checklist. */
export function marketDateOf({ market = null, checklist = null } = {}) {
  const d = [market?.as_of, checklist?.as_of].filter(isDate).sort();
  return d.at(-1) ?? null;
}

/** pick.schema.json allows bullish, bearish and neutral; the checklist's lean_up / lean_down read the same way. */
const UP = new Set(["bullish", "lean_up"]);
const DOWN = new Set(["bearish", "lean_down"]);
/** "up", "down", "flat" for a stance, or null when there is none. */
export function stanceLean(stance) {
  if (typeof stance !== "string" || !stance) return null;
  return UP.has(stance) ? "up" : DOWN.has(stance) ? "down" : "flat";
}

/** The brain's stance for a name in a run (picks[].pick.stance), or null when the run did not look at it. */
export function stanceFor(run, ticker) {
  return (run?.picks ?? []).find((p) => p?.pick?.ticker === ticker)?.pick?.stance ?? null;
}

/* -------------------------------------------------------------- freshness */

/**
 * Whether each of the five reports is in for the market date: {agent: {state: "fresh" | "stale" | "missing", date}},
 * plus `received` (fresh ones) and `marketDate`.
 *   Research   the market numbers (derived.json as_of)
 *   News       the newer of the why-it-moved notes and the official filings (a quiet day records no note)
 *   Strategy   the checklist's risk plan and the brain's latest run, whichever is older
 *   Execution  the checklist
 *   Risk       the checklist and the market numbers (stretch), whichever is older
 */
export function freshness({ market = null, checklist = null, why = null, secNews = null, run = null, marketDate = null } = {}) {
  const md = marketDate ?? marketDateOf({ market, checklist });
  const newest = (...ds) => (ds.every((d) => !isDate(d)) ? null : ds.filter(isDate).sort().at(-1));
  const oldest = (...ds) => (ds.some((d) => !isDate(d)) ? null : [...ds].sort()[0]);
  const dates = {
    research: isDate(market?.as_of) ? market.as_of : null,
    news: newest(why?.as_of, secNews?.as_of),
    strategy: oldest(checklist?.as_of, run?.date),
    execution: isDate(checklist?.as_of) ? checklist.as_of : null,
    risk: oldest(checklist?.as_of, market?.as_of),
  };
  const out = { marketDate: md, received: 0 };
  for (const a of REPORTERS) {
    const date = dates[a];
    const state = !date ? "missing" : md && date >= md ? "fresh" : "stale";
    out[a] = { state, date };
    if (state === "fresh") out.received += 1;
  }
  return out;
}

/* --------------------------------------------------------------- research */

const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

/**
 * The newest day's move when it is unusual by the feed's own test (lib/feed.js UNUSUAL, the same one the why notes
 * use): at least `min_sd` standard deviations of the `lookback` days before it and at least `min_pct` percent.
 * {pct, times} or null.
 */
export function unusualToday(row, opts = UNUSUAL) {
  const m = dayMoves(row);
  const dates = Object.keys(m).sort();
  const k = dates.length - 1;
  if (k < 1) return null;
  const prev = dates.slice(Math.max(0, k - opts.lookback), k).map((d) => m[d]);
  if (prev.length < 20) return null;
  const s = sd(prev);
  const v = m[dates[k]];
  if (!s || Math.abs(v) < opts.min_pct || Math.abs(v) < opts.min_sd * s) return null;
  return { pct: v, times: Math.abs(v) / s };
}

/**
 * The scanner: one row per name on the main list, in percent only. {ticker, name, spark (indexed closes), day, d20,
 * volX (volume against its 20-day average), vol (20-day volatility), mom (against the benchmark over 60 days), score
 * (the checklist's net of seven), unusual}.
 */
export function scannerRows({ market = null, checklist = null, members = [], names = {} } = {}) {
  const dv = bySymbol(market), cl = bySymbol(checklist);
  return members.map((ticker) => {
    const d = dv[ticker], c = cl[ticker];
    const num = (v) => (isNum(v) ? v : null);
    return {
      ticker, name: names[ticker] ?? ticker,
      spark: (d?.spark ?? []).map((p) => p.v).filter(isNum),
      day: num(d?.change_1d_pct), d20: num(d?.ret_20d_pct), volX: num(c?.volume?.vs_avg20),
      vol: num(d?.vol20_pct), mom: num(d?.vs_bench_60d_pct), score: num(c?.score?.net),
      unusual: d ? unusualToday(d) : null,
    };
  });
}

export const SCAN_KEYS = ["ticker", "day", "d20", "volX", "vol", "mom", "score"];

/** The rows sorted by a column (missing values always last; ties by ticker). */
export function sortScanner(rows, key = "score", dir = "desc") {
  const k = SCAN_KEYS.includes(key) ? key : "score";
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (k === "ticker") return sign * a.ticker.localeCompare(b.ticker);
    const x = a[k], y = b[k];
    if (!isNum(x) || !isNum(y)) return (isNum(x) ? -1 : isNum(y) ? 1 : 0) || a.ticker.localeCompare(b.ticker);
    return sign * (x - y) || a.ticker.localeCompare(b.ticker);
  });
}

/** The three stat tiles: the day's biggest volume ratio, the highest volatility and the strongest momentum. */
export function statTiles(rows) {
  const top = (k) => {
    const r = sortScanner(rows.filter((x) => isNum(x[k])), k, "desc")[0];
    return r ? { ticker: r.ticker, name: r.name, value: r[k] } : null;
  };
  return { volume: top("volX"), volatility: top("vol"), momentum: top("mom") };
}

/* ------------------------------------------------------------------- news */

/**
 * The News panel's cards and counters. Why-it-moved notes of the last week of market days (newest first, at most
 * `maxNotes`), official current reports of the list's names filed within `filingDays` of today, and results due
 * within `resultDays`. Each card: {id, kind: "up" | "down" | "filing" | "results", date, ticker, headline, move, to,
 * url?, form?, confirmed?}; `move` is the day's percent move (the note's own, else the name's latest close).
 * counts: {up, down, watch} (watch = filings and results).
 */
export function newsCards({ why = null, secNews = null, outlook = null, market = null, members = [], today = null, marketDate = null,
  maxNotes = 4, noteDays = 7, filingDays = 3, resultDays = 7, maxFilings = 4 } = {}) {
  const dv = bySymbol(market);
  const dayMove = (x) => (isNum(dv[x]?.change_1d_pct) ? dv[x].change_1d_pct : null);
  const from = isDate(marketDate) ? addDays(marketDate, -noteDays) : null;
  const notes = (why?.notes ?? [])
    .map((n) => ({ ...n, market_date: isDate(n.market_date) ? n.market_date : isDate(why.as_of) ? why.as_of : null }))
    .filter((n) => n.market_date && typeof n.headline === "string" && n.headline.trim() && Array.isArray(n.symbols) && n.symbols.length)
    .filter((n) => !from || n.market_date >= from)
    .sort((a, b) => b.market_date.localeCompare(a.market_date) || Math.abs(b.move_pct ?? 0) - Math.abs(a.move_pct ?? 0))
    .slice(0, maxNotes)
    .map((n) => ({
      id: `why:${n.market_date}:${n.key ?? n.symbols.join(",")}`, kind: (n.move_pct ?? 0) < 0 ? "down" : "up", date: n.market_date,
      ticker: n.symbols[0], headline: n.headline.trim().replace(/[.;:,\s]+$/, ""), move: isNum(n.move_pct) ? n.move_pct : null,
      to: `stock/${n.symbols[0]}#why-it-moved`,
    }));
  const filings = recentFilings(secNews, { symbols: members, today, days: filingDays, max: maxFilings }).map((f) => ({
    id: `filing:${f.symbol}:${f.date}`, kind: "filing", date: f.date, ticker: f.symbol, headline: f.title, form: f.form, url: f.url,
    move: dayMove(f.symbol), to: `stock/${f.symbol}#official-news`,
  }));
  const keep = new Set(members);
  const results = today ? comingUp(outlook, today, resultDays).ahead.filter((r) => keep.has(r.ticker)).map((r) => ({
    id: `results:${r.ticker}:${r.date}`, kind: "results", date: r.date, ticker: r.ticker, confirmed: r.confirmed, days: r.days,
    move: dayMove(r.ticker), to: `stock/${r.ticker}#whats-next`,
  })) : [];
  return {
    cards: [...notes, ...filings, ...results],
    counts: { up: notes.filter((n) => n.kind === "up").length, down: notes.filter((n) => n.kind === "down").length, watch: filings.length + results.length },
  };
}

/* ----------------------------------------------------------------- limits */

const HOUSEHOLD_SIZE = /at most \*\*(\d+(?:\.\d+)?)%\*\* of investable savings, in equal slots of \*\*(\d+(?:\.\d+)?)%\*\*/i;

/**
 * The limits the Risk agent checks, read from config and the house rules; a limit that is written nowhere is null and
 * not shown. {minRR (config/checklist.json house_rule), stopAtrMax (its risk-plan step), stretchPct (config/settings.json
 * setup), potPct and slotPct (docs/household.md), noBorrowing (config/rules.json: borrowing is never supported),
 * earned (a stock rule has earned real money)}.
 */
export function houseLimits({ settings = null, checklistCfg = null, checklist = null, rulebook = null, household = null, earned = false } = {}) {
  const num = (v) => (isNum(v) ? v : null);
  const rp = (checklistCfg?.steps ?? []).find((s) => s.id === "risk_plan");
  const size = typeof household === "string" ? household.match(HOUSEHOLD_SIZE) : null;
  return {
    minRR: num(checklistCfg?.house_rule?.min_reward_to_risk) ?? num(checklist?.house_rule?.min_reward_to_risk),
    stopAtrMax: num(rp?.params?.stop_atr_max),
    stretchPct: settings?.setup?.veto_stretched === false ? null : num(settings?.setup?.stretch_pct),
    potPct: size ? Number(size[1]) : null,
    slotPct: size ? Number(size[2]) : null,
    noBorrowing: (rulebook?.not_supported ?? []).some((n) => /borrow/i.test(String(n?.name ?? ""))),
    earned: Boolean(earned),
  };
}

/* ------------------------------------------------------------------- risk */

/**
 * The Risk agent's check of one name: {pass, reasons: [{id, ...values}]}. Reasons, in order: "plan" (no written risk
 * plan), "rr" (reward-to-risk to TP1 under the house rule), "stop" (the stop is wider than the ATR limit), "stretch"
 * (too far above the 50-day average). A limit missing from config is not checked; the risk plan always is.
 */
export function riskCheck(cl, dv, limits = {}) {
  const reasons = [];
  const rp = cl?.risk_plan;
  if (!rp || !isNum(rp.stop_pct) || !isNum(rp.tp1_pct)) {
    reasons.push({ id: "plan" });
  } else {
    const rr = isNum(rp.rr_tp1) ? rp.rr_tp1 : rp.stop_pct > 0 ? rp.tp1_pct / rp.stop_pct : null;
    if (isNum(limits.minRR) && (!isNum(rr) || rr < limits.minRR)) reasons.push({ id: "rr", rr, min: limits.minRR });
    if (isNum(limits.stopAtrMax) && isNum(rp.atr_pct) && rp.atr_pct > 0) {
      const atr = rp.stop_pct / rp.atr_pct;
      if (atr > limits.stopAtrMax + 0.005) reasons.push({ id: "stop", atr, max: limits.stopAtrMax });
    }
  }
  if (isNum(limits.stretchPct)) {
    const dist = isNum(dv?.dist_sma50_pct) ? dv.dist_sma50_pct : dv?.setup?.dist_sma50_pct;
    if (dv?.setup?.stretched === true || (isNum(dist) && dist > limits.stretchPct)) reasons.push({ id: "stretch", pct: isNum(dist) ? dist : null, max: limits.stretchPct });
  }
  return { pass: reasons.length === 0, reasons };
}

/* -------------------------------------------------------------- execution */

/** Execution's three confirmations and its call for one name (see the top of the file). */
export function execution(cl, dv) {
  if (!cl) return { level: false, volume: false, close: false, n: 0, downtrend: false, call: "skip", missing: true };
  const sup = cl.levels?.support?.[0]?.dist_pct;
  const atr = cl.risk_plan?.atr_pct;
  const nearSupport = isNum(sup) && isNum(atr) && sup <= 0 && -sup <= atr;
  const cleared = Array.isArray(cl.levels?.resistance) && cl.levels.resistance.length === 0;
  const level = nearSupport || cleared;
  const v = cl.volume ?? {};
  const volume = v.lean === "bullish" && isNum(v.vs_avg20) && v.vs_avg20 >= 1 && isNum(dv?.change_1d_pct) && dv.change_1d_pct > 0;
  const close = cl.candle?.daily?.lean === "bullish";
  const n = [level, volume, close].filter(Boolean).length;
  const downtrend = cl.trend?.direction === "down";
  const call = n === 0 || downtrend ? "skip" : n === 3 ? "enter" : "wait";
  return { level, volume, close, n, downtrend, call, missing: false };
}

/* ------------------------------------------------------------------- boss */

export const CALL_ORDER = { buy: 0, wait: 1, reject: 2 };

/** Risk reasons that reject outright; the others (thin reward-to-risk, stretched) mean wait, as the house rules say. */
export const HARD_RISK = new Set(["plan", "stop"]);

/**
 * The Boss's final call for one name from the other agents' reports (the table at the top of the file):
 * {call: "buy" | "wait" | "reject", by: "risk" | "strategy" | "execution" | "boss", reason: {id, ...values}}.
 */
export function bossCall({ stance = null, risk, exec, received = 0, total = REPORTERS.length }) {
  const lean = stanceLean(stance);
  const reasons = risk?.pass ? [] : risk?.reasons?.length ? risk.reasons : [{ id: "plan" }];
  const hard = reasons.find((r) => HARD_RISK.has(r.id));
  if (hard) return { call: "reject", by: "risk", reason: hard };
  if (lean === "down") return { call: "reject", by: "strategy", reason: { id: "bearish" } };
  if (exec?.call === "skip" && exec.downtrend) return { call: "reject", by: "execution", reason: { id: "downtrend", n: exec.n ?? 0 } };
  if (reasons.length) return { call: "wait", by: "risk", reason: reasons[0] };
  if (lean !== "up") return { call: "wait", by: "strategy", reason: { id: lean ? "neutral" : "noView" } };
  if (exec?.call !== "enter") return { call: "wait", by: "execution", reason: { id: exec?.call === "skip" ? (exec.downtrend ? "downtrend" : "skip") : "confirm", n: exec?.n ?? 0 } };
  if (received < total) return { call: "wait", by: "boss", reason: { id: "reports", n: received, total } };
  return { call: "buy", by: "boss", reason: { id: "all" } };
}

/**
 * Every name on the main list through the pipeline, sorted BUY, WAIT, REJECT (then more confirmations, a higher
 * checklist score, then ticker). Each: {ticker, name, stance, lean, risk, exec, score, plan (the checklist's risk plan or
 * null), entry (the nearest support, percent below), ...bossCall}.
 */
export function deskCalls({ market = null, checklist = null, run = null, members = [], names = {}, limits = {}, received = 0 } = {}) {
  const dv = bySymbol(market), cl = bySymbol(checklist);
  return members.map((ticker) => {
    const c = cl[ticker] ?? null, d = dv[ticker] ?? null;
    const stance = stanceFor(run, ticker);
    const risk = riskCheck(c, d, limits);
    const exec = execution(c, d);
    const sup = c?.levels?.support?.[0]?.dist_pct;
    return {
      ticker, name: names[ticker] ?? ticker, stance, lean: stanceLean(stance), risk, exec,
      score: isNum(c?.score?.net) ? c.score.net : null, plan: c?.risk_plan ?? null, entry: isNum(sup) ? sup : null,
      ...bossCall({ stance, risk, exec, received }),
    };
  }).sort((a, b) => CALL_ORDER[a.call] - CALL_ORDER[b.call] || b.exec.n - a.exec.n || (b.score ?? -99) - (a.score ?? -99) || a.ticker.localeCompare(b.ticker));
}

/** {buy, wait, reject} counts of deskCalls rows. */
export function callCounts(rows) {
  const out = { buy: 0, wait: 0, reject: 0 };
  for (const r of rows) out[r.call] += 1;
  return out;
}

/** Strategy's rows: names with a written risk plan, the best reward-to-risk first. */
export function strategyRows(rows, minRR = null) {
  const rrOf = (r) => (isNum(r.plan?.rr_tp1) ? r.plan.rr_tp1 : null);
  return rows.filter((r) => r.plan && isNum(r.plan.stop_pct))
    .map((r) => ({ ...r, rr: rrOf(r), fits: isNum(minRR) ? isNum(rrOf(r)) && rrOf(r) >= minRR : Boolean(r.plan.fits_house_rule) }))
    .sort((a, b) => (b.rr ?? -1) - (a.rr ?? -1) || a.ticker.localeCompare(b.ticker));
}

/** Execution's candidates: the Boss's order (BUY and WAIT first), the most confirmations first within each call. */
export function execCandidates(rows, n = 4) {
  return rows.filter((r) => !r.exec.missing).slice(0, n);
}

/** Reward-to-risk as shown: one decimal, two when one would round up to the limit ("1.96" never reads "2.0 < 2"). */
export function rrText(v, min = null) {
  if (!isNum(v)) return "–";
  const one = v.toFixed(1);
  return isNum(min) && v < min && Number(one) >= min ? v.toFixed(2) : one;
}
