/**
 * The swing setup (config/swing.json, computed by scripts/market.py swing_at into each checklist row's `swing`, and its
 * history and forward record into the checklist document's `swing`): pure functions for the Stock page's card and the
 * Stocks page's strip. Percent distances from the last close only, never prices. Words in text/swing.js.
 */
import { strings } from "./text.js";
import { daysUntil } from "./outlook.js";
import { fmtPct } from "./format.js";
import dict from "../text/swing.js";

const t = strings(dict);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const SWING_CHECKS = ["uptrend", "pullback", "trigger", "risk_ok"];
/** The state's chip tone and its nav-strip state. */
export const SWING_TONE = { setup: "up", watch: "wait", none: "neutral" };
export const SWING_NAV = { setup: "done", watch: "wait", none: "idle" };

/** The swing part of a checklist document, or null (older files have none). */
export const swingDoc = (checklist) => checklist?.swing ?? null;

/** One name's swing setup from a checklist document, or null. */
export function swingOf(checklist, symbol) {
  return (checklist?.symbols ?? []).find((r) => r.symbol === symbol)?.swing ?? null;
}

/** Calendar days a trade can stay open: the next day's entry plus time_stop_days trading days, weekends included. */
export function windowDays(params) {
  const n = isNum(params?.time_stop_days) ? params.time_stop_days : 10;
  return Math.ceil(((n + 1) * 7) / 5);
}

/**
 * The company's next results date when it falls inside a new trade's window ({date, days, confirmed}), else null.
 * `card` is the company's outlook card (lib/outlook.js cardFor); a date already past is ignored.
 */
export function earningsInWindow(card, today, params) {
  const ne = card?.next_earnings;
  const days = daysUntil(ne?.date, today);
  if (days == null || days < 0 || days > windowDays(params)) return null;
  return { date: ne.date, days, confirmed: Boolean(ne.confirmed) };
}

/** "+1.2R", "−0.4R" (a true minus sign). */
export const rText = (v, d = 2) => (isNum(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}R` : "–");

/**
 * The card's reading of one name: the state, the four checks in words, the plan (stop, target, the recent high) and the
 * warnings that stop a trade even when the chart says setup (earnings inside the window, a recent high nearer than the
 * target). `earnings` from earningsInWindow.
 */
export function swingView(sw, params, { earnings = null } = {}) {
  if (!sw) return null;
  const c = sw.checks ?? {};
  const checks = SWING_CHECKS.map((id) => ({ id, ok: Boolean(c[id]), text: checkText(id, sw, params, Boolean(c[id])) }));
  const warnings = [];
  if (earnings) warnings.push({ id: "earnings", text: t("sw.warn.earnings", { date: earnings.date, count: earnings.days }) });
  if (sw.state !== "none" && isNum(sw.rr_high) && isNum(params?.target_r) && sw.rr_high < params.target_r) {
    warnings.push({ id: "high", text: t("sw.warn.high", { high: fmtPct(sw.high_pct, 1), rr: sw.rr_high.toFixed(1) }) });
  }
  const state = sw.state === "setup" && earnings ? "watch" : sw.state;
  return {
    state, raw: sw.state, tone: SWING_TONE[state] ?? "neutral",
    word: t(`sw.state.${state}`), line: t(`sw.line.${sw.state}${sw.state === "setup" && earnings ? ".earnings" : ""}`),
    checks, warnings,
    stop: sw.stop_pct, target: sw.target_pct, high: sw.high_pct, rrHigh: sw.rr_high, depth: sw.depth_pct,
  };
}

function checkText(id, sw, params, ok) {
  const p = params ?? {};
  if (id === "uptrend") {
    return t(ok ? "sw.ck.uptrend.ok" : "sw.ck.uptrend.no", { dist: fmtPct(sw.dist_trend_avg_pct, 1), days: p.trend_sma_days ?? 50 });
  }
  if (id === "pullback") {
    return t(ok ? "sw.ck.pullback.ok" : "sw.ck.pullback.no", { depth: fmtPct(-Math.abs(sw.depth_pct), 1), days: p.pullback_sma_days ?? 20,
      count: sw.days_since_low });
  }
  if (id === "trigger") return t(ok ? "sw.ck.trigger.ok" : "sw.ck.trigger.no");
  return t(ok ? "sw.ck.risk.ok" : "sw.ck.risk.no", { stop: fmtPct(-sw.stop_pct, 1), max: p.max_stop_pct ?? 8 });
}

/** The day's setups and watch names of a checklist document (the benchmark left out), best reward-to-recent-high first. */
export function swingList(checklist) {
  const bench = checklist?.benchmark;
  const rows = (checklist?.symbols ?? []).filter((r) => r.swing && r.symbol !== bench);
  const by = (a, b) => (b.swing.rr_high ?? 0) - (a.swing.rr_high ?? 0) || a.symbol.localeCompare(b.symbol);
  return {
    setup: rows.filter((r) => r.swing.state === "setup").sort(by).map((r) => ({ symbol: r.symbol, ...r.swing })),
    watch: rows.filter((r) => r.swing.state === "watch").sort(by).map((r) => ({ symbol: r.symbol, ...r.swing })),
  };
}

/** The history in one line, or null: the setup's trades against the same exits on any uptrend day. */
export function historyLine(doc) {
  const br = doc?.base_rates;
  if (!br?.setup?.n) return null;
  const s = br.setup, u = br.uptrend;
  return t("sw.hist", {
    from: br.from?.slice(0, 4) ?? "", n: s.n.toLocaleString("en-US"), win: Math.round(s.hit_pct), avg: rText(s.mean),
    lo: rText(s.ci_low), hi: rText(s.ci_high), base: u?.n ? rText(u.mean) : "–",
  });
}

/** The forward record in one line: how many setups so far, how many still running, and the average of the finished ones. */
export function forwardLine(doc) {
  const fw = doc?.forward;
  if (!fw) return null;
  const n = fw.signals?.length ?? 0;
  if (!n) return t("sw.fwd.none", { date: fw.started });
  const done = fw.stats?.n ?? 0;
  return t("sw.fwd.some", { count: n, running: fw.running ?? 0, done, avg: done ? rText(fw.stats.mean) : "–", date: fw.started });
}
