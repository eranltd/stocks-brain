// The home page's live feed: dated items built from published data only (percent moves, run records, the companies'
// outlook cards, people's logged calls and the technical checklist's day-to-day changes). Pure functions, no React:
// every item is {id, kind, date, title, body: [lines], to, tone, value?: {text, tone}, upcoming?}.
// `to` is where a tap goes: a tab id, "stock/<T>", "<route>#<section id>", or "filter:<kind>" for a digest.

// The words around the data are the site's own (text/home.js "feed.*"); text copied from data (a company card's
// highlight, the brain's summary, a checklist change) stays as published.

import { fmtPct, signTone } from "./format.js";
import { strings } from "./text.js";
import dict from "../text/home.js";

export const KINDS = ["market", "companies", "brain", "people", "checklist"];
export const KIND_LABEL = { all: "All", market: "Market", companies: "Companies", brain: "Brain", people: "People", checklist: "Checklist" };
// Market days shown (trading days back from the last close) and how unusual a single day must be to get its own item.
export const MARKET_DAYS = 15;
export const UNUSUAL = { lookback: 60, min_sd: 3, min_pct: 3 };

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const firstSentence = (t) => (String(t ?? "").match(/^.*?[.!?](\s|$)/) || [String(t ?? "")])[0].trim();
const toneOf = (v, d = 1) => signTone(v, d);
const KIND_ORDER = { market: 0, brain: 1, companies: 2, checklist: 3, people: 4 };

/* ------------------------------------------------------------------ market */

/**
 * Day moves of one row as {date: pct}, from its indexed series (pct = v[k]/v[k-1] - 1); the last close uses the
 * published change_1d_pct when the series ends on the row's last date, so the latest day matches the rest of the site.
 */
export function dayMoves(row) {
  const s = row?.series ?? row?.spark ?? [];
  const out = {};
  for (let k = 1; k < s.length; k++) {
    const a = num(s[k - 1].v), b = num(s[k].v);
    if (a && b != null) out[s[k].date] = (b / a - 1) * 100;
  }
  const last = s.at(-1)?.date;
  if (last && num(row.change_1d_pct) != null && (!row.last_date || row.last_date === last)) out[last] = row.change_1d_pct;
  return out;
}

/** The S&P 500's day moves by date: recent_days when the data has them, else only the last close (change_1d_pct). */
function spxMoves(market) {
  const spx = (market?.context?.instruments ?? []).find((i) => i.role === "spx");
  if (!spx) return { name: null, moves: {} };
  const moves = {};
  for (const d of spx.recent_days ?? []) if (num(d.change_pct) != null) moves[d.date] = d.change_pct;
  if (num(spx.change_1d_pct) != null && market.as_of && moves[market.as_of] == null) moves[market.as_of] = spx.change_1d_pct;
  return { name: spx.name ?? "S&P 500", moves };
}

/** One item per recent market close: the benchmark (and S&P 500) day move, how many names rose, the biggest mover. */
export function marketItems(market, watchlist, bench, names = {}, days = MARKET_DAYS) {
  if (!market) return [];
  const t = strings(dict);
  const members = (watchlist?.symbols ?? []).map((s) => s.symbol);
  const rows = Object.fromEntries((market.symbols ?? []).map((r) => [r.symbol, r]));
  const benchRow = rows[bench?.symbol] ?? null;
  const moves = Object.fromEntries(members.filter((s) => rows[s]).map((s) => [s, dayMoves(rows[s])]));
  const bm = benchRow ? dayMoves(benchRow) : {};
  const spx = spxMoves(market);
  const allDates = new Set([...Object.keys(bm), ...Object.values(moves).flatMap((m) => Object.keys(m))]);
  const dates = [...allDates].filter((d) => !market.as_of || d <= market.as_of).sort().slice(-days);
  const label = bench?.label ?? bench?.symbol ?? "Benchmark";
  return dates.map((date) => {
    const day = members.map((s) => ({ symbol: s, pct: moves[s]?.[date] })).filter((m) => num(m.pct) != null);
    const rose = day.filter((m) => m.pct > 0).length, fell = day.filter((m) => m.pct < 0).length;
    const top = [...day].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.symbol.localeCompare(b.symbol))[0] ?? null;
    const b = num(bm[date]), sp = num(spx.moves[date]);
    const lead = sp ?? b;
    // the S&P 500 leads, as the figure on the right
    const parts = [sp != null && `${spx.name} ${fmtPct(sp, 1)}`, b != null && `${label} ${fmtPct(b, 1)}`].filter(Boolean);
    const body = [];
    if (day.length) body.push(t("feed.rose", { rose, n: day.length, fell }));
    if (top) body.push(t(names[top.symbol] ? "feed.biggestNamed" : "feed.biggest", { sym: top.symbol, pct: fmtPct(top.pct, 1), name: names[top.symbol] }));
    return {
      id: `market:${date}`, kind: "market", date, latest: date === market.as_of,
      title: parts.length ? parts.join(", ") : t("feed.close"),
      body, to: "details#market-today", tone: toneOf(lead), value: lead != null ? { text: fmtPct(lead, 1), tone: toneOf(lead) } : null,
      stats: { rose, fell, counted: day.length, top },
    };
  });
}

const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

/**
 * A name's day move well beyond its normal range: at least `min_sd` standard deviations of its daily moves over the
 * `lookback` days before (that day excluded) and at least `min_pct` percent. Only for the last `days` closes.
 */
export function unusualItems(market, watchlist, names = {}, days = MARKET_DAYS, opts = UNUSUAL) {
  if (!market) return [];
  const t = strings(dict);
  const members = new Set((watchlist?.symbols ?? []).map((s) => s.symbol));
  const out = [];
  for (const row of market.symbols ?? []) {
    if (!members.has(row.symbol)) continue;
    const m = dayMoves(row);
    const dates = Object.keys(m).sort();
    const start = Math.max(0, dates.length - days);
    for (let k = start; k < dates.length; k++) {
      const prev = dates.slice(Math.max(0, k - opts.lookback), k).map((d) => m[d]);
      if (prev.length < 20) continue;
      const s = sd(prev);
      const v = m[dates[k]];
      if (!s || Math.abs(v) < opts.min_pct || Math.abs(v) < opts.min_sd * s) continue;
      const times = Math.abs(v) / s;
      out.push({
        id: `move:${row.symbol}:${dates[k]}`, kind: "market", date: dates[k], unusual: true,
        title: t(v > 0 ? "feed.jumped" : "feed.dropped", { sym: row.symbol, pct: `${Math.abs(v).toFixed(1)}%` }),
        body: [t(names[row.symbol] ? "feed.timesNamed" : "feed.times", { times: times >= 10 ? Math.round(times) : times.toFixed(1), sd: `${s.toFixed(1)}%`, n: prev.length, name: names[row.symbol] })],
        to: `stock/${row.symbol}`, tone: toneOf(v), value: { text: fmtPct(v, 1), tone: toneOf(v) },
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ brain */

const STANCES = ["bullish", "bearish", "neutral"];
const stanceKey = (s) => (STANCES.includes(s) ? s : "neutral");

/** One item per brain run: its picks with stances and the first sentence of its summary. */
export function brainItems(runs) {
  const t = strings(dict);
  return (runs ?? []).map((r) => {
    if (r.status !== "ok") {
      return { id: `run:${r.date}`, kind: "brain", date: r.date, title: t("feed.brain.failed"), body: [t("feed.brain.failedBody")], to: "runs", tone: "down" };
    }
    const picks = r.picks ?? [];
    const stances = new Set(picks.map((p) => p.pick.stance));
    const same = stances.size === 1 ? [...stances][0] : null;
    const stance = (s) => t(`feed.stance.${stanceKey(s)}`);
    const title = !picks.length
      ? t("feed.brain.none")
      : same
        ? t("feed.brain.same", { count: picks.length, stance: stance(same) })
        : t("feed.brain.mixed", { count: picks.length });
    const list = picks.map((p) => (same ? p.pick.ticker : `${p.pick.ticker} ${stance(p.pick.stance)}`)).join(" · ");
    return {
      id: `run:${r.date}`, kind: "brain", date: r.date, title,
      body: [list, firstSentence(r.summary)].filter(Boolean), to: "runs",
      tone: same === "bullish" ? "accent" : same === "bearish" ? "down" : "flat",
    };
  });
}

/* --------------------------------------------------------------- companies */

const growth = (pct, t) => (num(pct) == null ? "" : t(pct >= 0 ? "feed.growth.up" : "feed.growth.down", { pct: `${Math.abs(pct) < 10 ? Math.abs(pct).toFixed(1) : Math.round(Math.abs(pct))}%` }));

/**
 * From the outlook cards: each latest report, each dated "what's next" item and each next results date. Dated today or
 * earlier goes in `items`; later (within `windowDays`) goes in `ahead`, soonest first.
 */
export function companyItems(outlook, today, windowDays = 45) {
  const t = strings(dict);
  const items = [], ahead = [];
  const put = (it) => {
    if (!it.date) return;
    if (it.date <= today) items.push(it);
    else if (dayDiff(today, it.date) <= windowDays) ahead.push({ ...it, upcoming: true, days: dayDiff(today, it.date) });
  };
  for (const c of outlook?.companies ?? []) {
    const tk = c.ticker;
    const lt = c.latest;
    if (lt?.reported_on) {
      put({
        id: `report:${tk}:${lt.reported_on}`, kind: "companies", date: lt.reported_on, ticker: tk,
        title: t("feed.reported", { t: tk, revenue: lt.revenue }) + growth(lt.revenue_growth_yoy_pct, t),
        body: [lt.period, lt.highlights?.[0]].filter(Boolean), to: `stock/${tk}#whats-next`, tone: "flat",
      });
    }
    const ne = c.next_earnings;
    if (ne?.date) {
      put({
        id: `results:${tk}:${ne.date}`, kind: "companies", date: ne.date, ticker: tk, results: true, confirmed: Boolean(ne.confirmed),
        title: t(ne.date <= today ? "feed.due" : "feed.reports", { t: tk }),
        body: [ne.date <= today ? t("feed.refresh") : t(ne.confirmed ? "feed.confirmed" : "feed.expected", { name: c.name })],
        to: `stock/${tk}#whats-next`, tone: "flat",
      });
    }
    for (const w of c.whats_next ?? []) {
      if (!w.date) continue;
      put({
        id: `next:${tk}:${w.date}:${w.item.slice(0, 24)}`, kind: "companies", date: w.date, ticker: tk,
        title: `${tk}: ${firstSentence(w.item)}`, body: [w.when].filter(Boolean), to: `stock/${tk}#whats-next`, tone: "flat",
      });
    }
  }
  ahead.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { items, ahead };
}

function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/* ------------------------------------------------------------------ people */

const shortVia = (via) => String(via ?? "").replace(/,?\s+(Inc\.?|LLC|LLP|L\.P\.|LP)$/i, "").replace(/\s+(Capital|Investment)\s+Management$/i, "").trim();

/** Each logged call on its public (or 13F filing) date, and each call judged at `judgeWeeks` on the day it was judged. */
export function peopleItems(peopleCfg, scores, judgeWeeks = 26) {
  const t = strings(dict);
  const who = Object.fromEntries((peopleCfg?.people ?? []).map((p) => [p.id, p.name]));
  const scored = Object.fromEntries((scores?.calls ?? []).map((s) => [s.id, s]));
  const out = [];
  for (const c of peopleCfg?.calls ?? []) {
    const firm = c.credit_person === false;
    const name = firm || !who[c.person] ? shortVia(c.via) : who[c.person];
    const stance = STANCES.includes(c.stance) ? t(`feed.people.${c.stance}`) : c.stance;
    out.push({
      id: `call:${c.id}`, kind: "people", date: c.date, ticker: c.ticker,
      title: t(c.source_kind === "13f" ? "feed.people.filed" : "feed.people.said", { name, stance, t: c.ticker }),
      body: [c.what].filter(Boolean), to: "people",
      tone: c.stance === "bullish" ? "accent" : c.stance === "bearish" ? "down" : "flat",
    });
    const leg = scored[c.id]?.[`w${judgeWeeks}`];
    if (leg?.end_date) {
      const v = leg.signed_excess_pct;
      out.push({
        id: `judged:${c.id}`, kind: "people", date: leg.end_date, ticker: c.ticker,
        title: t(leg.right ? "feed.people.right" : "feed.people.wrong", { name, t: c.ticker, weeks: judgeWeeks }),
        body: [t("feed.people.vs", { pct: fmtPct(v, 1) })], to: "people",
        tone: leg.right ? "accent" : "down", value: { text: t(leg.right ? "feed.right" : "feed.wrong"), tone: leg.right ? "accent" : "down" },
      });
    }
  }
  return out;
}

/* --------------------------------------------------------------- checklist */

export const VERDICT_WORD = { lean_up: "lean up", mixed: "mixed", lean_down: "lean down" };
export const VERDICT_TONE = { lean_up: "accent", mixed: "flat", lean_down: "down" };
const TONE = { bullish: "accent", bearish: "down", neutral: "flat" };

/** A change worth its own feed item; the rest (daily candles, levels crossed, volume reads) ride along as body text. */
export function headlineChange(changes) {
  const rank = (c) => (c.check === "score" ? 0 : c.check === "rsi" ? 1 : c.check === "trend" ? 2 : c.check === "gaps" ? 3 : /falling volume/i.test(c.text) ? 4 : 9);
  const best = [...(changes ?? [])].sort((a, b) => rank(a) - rank(b))[0];
  return best && rank(best) < 9 ? best : null;
}

/** Plain short headline for a change: "Verdict moved from mixed to lean up" -> "verdict mixed to lean up". */
export function changeHeadline(c) {
  const t = c.text.replace(/^Verdict moved from /, "verdict ").replace(/^RSI moved into /, "RSI into ").replace(/^Trend changed from /, "trend ");
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; // keep "RSI"
}

/** One item per name and day whose checklist changed in a way worth a line (see headlineChange). */
export function checklistItems(checklist) {
  const out = [];
  for (const s of checklist?.symbols ?? []) {
    for (const h of s.history ?? []) {
      const head = headlineChange(h.changes);
      if (!head) continue;
      const rest = h.changes.filter((c) => c !== head).map((c) => c.text);
      out.push({
        id: `check:${s.symbol}:${h.date}`, kind: "checklist", date: h.date, ticker: s.symbol,
        title: `${s.symbol}: ${changeHeadline(head)}`, body: rest.length ? [rest.join(" · ")] : [],
        to: `stock/${s.symbol}#checklist`, tone: TONE[head.tone] ?? "flat",
        value: { text: VERDICT_WORD[h.verdict] ?? h.verdict, tone: VERDICT_TONE[h.verdict] ?? "flat" },
      });
    }
  }
  return out;
}

/**
 * For the "All" view: days with more than `max` checklist items collapse into one digest item that opens the
 * Checklist filter, so twenty names' daily flips do not bury the market and the brain.
 */
export function collapseChecklist(items, max = 2) {
  const t = strings(dict);
  const byDay = {};
  for (const it of items) if (it.kind === "checklist") (byDay[it.date] ??= []).push(it);
  const out = [];
  const done = new Set();
  for (const it of items) {
    if (it.kind !== "checklist" || byDay[it.date].length <= max) { out.push(it); continue; }
    if (done.has(it.date)) continue;
    done.add(it.date);
    const day = byDay[it.date];
    const shown = day.slice(0, 3).map((x) => x.title).join(" · ");
    out.push({
      id: `check-day:${it.date}`, kind: "checklist", date: it.date, digest: true, count: day.length,
      title: t("feed.digest", { count: day.length }), body: [day.length > 3 ? t("feed.digestMore", { shown, more: day.length - 3 }) : `${shown}.`],
      to: "filter:checklist", tone: "flat",
    });
  }
  return out;
}

/* ------------------------------------------------------------------- feed */

const byNewest = (a, b) => b.date.localeCompare(a.date) || (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || (a.unusual ? 1 : 0) - (b.unusual ? 1 : 0) || a.id.localeCompare(b.id);

/**
 * The whole feed: `items` newest first (today and earlier), `ahead` soonest first (company dates still to come).
 * `sample`: picks are sample data, so brain runs are left out.
 */
export function buildFeed(data, today) {
  const { market, watchlist, bench, names, runs, sample, outlook, people, peopleScores, checklist } = data;
  const comp = companyItems(outlook, today, 45);
  const items = [
    ...marketItems(market, watchlist, bench, names, MARKET_DAYS),
    ...unusualItems(market, watchlist, names, MARKET_DAYS, UNUSUAL),
    ...(sample ? [] : brainItems(runs)),
    ...comp.items,
    ...peopleItems(people, peopleScores, peopleScores?.judge_at_weeks ?? 26),
    ...checklistItems(checklist),
  ].filter((it) => it.date && it.date <= today).sort(byNewest);
  return { items, ahead: comp.ahead };
}

/** Items for one filter ("all" collapses busy checklist days), with a count per filter for the chips. */
export function filterFeed(feed, filter = "all") {
  const list = filter === "all" ? collapseChecklist(feed.items, 2) : feed.items.filter((it) => it.kind === filter);
  const counts = Object.fromEntries([["all", feed.items.length], ...KINDS.map((k) => [k, feed.items.filter((it) => it.kind === k).length])]);
  return { list, counts };
}

/** Group a list into days, keeping order: [{date, items}]. */
export function byDay(list) {
  const out = [];
  for (const it of list) {
    if (out.at(-1)?.date === it.date) out.at(-1).items.push(it);
    else out.push({ date: it.date, items: [it] });
  }
  return out;
}

/* ------------------------------------------------------------------- live */

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago" for an ISO timestamp. */
export function ago(iso, now = new Date()) {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const t = strings(dict);
  const min = Math.floor((now.getTime() - at) / 60000);
  if (min < 1) return t("ago.now");
  if (min < 60) return t("ago.min", { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("ago.hour", { count: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t("ago.yesterday") : t("ago.days", { count: d });
}
