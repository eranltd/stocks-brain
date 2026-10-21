// The simple home: four calm cards in words, not numbers (the market, the news, companies to know, our plan). Pure
// functions, no React. Every input is published data; this file only turns it into short sentences. Its output has no
// digits: dates become weekday or month words ("yesterday", "next Wednesday", "in late October").

import { VERDICT_PLAIN } from "./brief.js";
import { fmtList, hasHebrew, isolate, translate } from "./i18n.js";
import { shortSector } from "./marketday.js";
import { recentFilings } from "./secnews.js";
import { noteForMover, notesForDay, noteView, whyClause } from "./why.js";
import dict from "../i18n/home.js";

// Every sentence here can be written in English (the default) or Hebrew: pass `lang` last ("he"). Hebrew verbs agree
// with their subject, so a subject comes with a grammatical form: "m" (the market, an index), "f" (a company, a stock
// or a fund: חברה, מניה, קרן) or "fp" (a group of companies). English ignores it.

const DAY = 86400000;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
// Hebrew count words for a feminine noun (חברות, קרנות), used where the simple home shows no digits.
const COUNT_HE = ["", "אחת", "שתי", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר"];

// Subject, verb and time read in the same order in both languages ("Meta fell yesterday", "Meta ירדה אתמול"), so these
// few short sentences are joined here rather than kept as templates; a name is isolated so it keeps its own direction.
const own = (lang, s) => (lang === "he" ? isolate(s) : s);
const said = (lang, ...parts) => parts.filter(Boolean).join(" ");

const days = (iso, today) => Math.round((utc(iso) - utc(today)) / DAY);
const weekdayIdx = (iso) => new Date(utc(iso)).getUTCDay();
const weekStart = (iso) => { const d = new Date(utc(iso)); return utc(iso) - ((d.getUTCDay() + 6) % 7) * DAY; }; // Monday

/** A past or future market date in words, relative to `today` (both YYYY-MM-DD): "yesterday", "next Wednesday", "in late October". */
export function whenWords(iso, today, lang = "en") {
  if (!iso || !today) return "";
  const t = translate(dict, lang);
  const n = days(iso, today);
  if (n === 0) return t("when.today");
  if (n === 1) return t("when.tomorrow");
  if (n === -1) return t("when.yesterday");
  const day = t(`weekday.${weekdayIdx(iso)}`);
  const weeks = Math.round((weekStart(iso) - weekStart(today)) / (7 * DAY));
  if (n > 0 && weeks === 0) return t("when.thisWeek", { day }, { bidi: false });
  if (n > 0 && weeks === 1) return t("when.nextWeek", { day }, { bidi: false });
  if (n < 0 && n >= -6) return t("when.pastWeek", { day }, { bidi: false });
  const d = new Date(utc(iso)), dn = d.getUTCDate();
  const part = dn <= 10 ? "early" : dn <= 20 ? "mid" : "late";
  return t(`when.${part}`, { month: t(`month.${d.getUTCMonth()}`) }, { bidi: false });
}

/** "Microsoft, Apple and Gilead" (Hebrew: "Microsoft, Apple ו-Gilead", each name isolated so it keeps its direction). */
export function joinNames(list, lang = "en") {
  const xs = list.filter(Boolean);
  if (lang === "he") return xs.length <= 1 ? (xs[0] != null ? isolate(xs[0]) : "") : fmtList(xs.map(isolate), "he");
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

/** The short company name the plain summary starts with ("Nvidia: ..."), else the watchlist name, else the ticker. */
export function shortName(ticker, outlook, names = {}) {
  const card = (outlook?.companies ?? []).find((c) => c.ticker === ticker);
  const lead = card?.plain?.match(/^([^:]{2,40}):/)?.[1];
  return lead ?? names[ticker] ?? ticker;
}

/** How big a day move was, as a key: flat, upSmall, up, upBig, downSmall, down, downBig. The index moves less than one
 *  company, so its bar is lower. */
export const SIZE = { index: [0.15, 0.6, 1.2], stock: [0.3, 1.5, 3.5] };
export function sizeKey(pct, kind = "index") {
  const v = num(pct);
  if (v == null) return null;
  const [flat, small, big] = SIZE[kind] ?? SIZE.index;
  const a = Math.abs(v);
  if (a < flat) return "flat";
  if (v > 0) return a < small ? "upSmall" : a < big ? "up" : "upBig";
  return a < small ? "downSmall" : a < big ? "down" : "downBig";
}
/** The size of a move in words ("rose a little"); `g` is the subject's form in Hebrew (see the top of the file). */
export function sizeWord(pct, kind = "index", lang = "en", g = "m") {
  const k = sizeKey(pct, kind);
  return k ? translate(dict, lang)(`size.${k}.${g}`) : null;
}

/**
 * "The market": {main, more, tone}. `day` is marketDay() (lib/marketday.js), `regime` data/kb/regime.json, `today` the
 * New York date. The S&P 500 leads; older data has only the benchmark. Words only. Another market passes `who` (its
 * benchmark in words, "The Israeli market"), `g` (its form in Hebrew), `noun` ("funds") and `fromHigh` (its benchmark's
 * distance from the high).
 */
export function marketWords(day, regime, today, { who: whoWords = null, g: whoForm = null, noun = "companies", fromHigh: benchHigh = null, lang = "en" } = {}) {
  const t = translate(dict, lang);
  const plain = { bidi: false }; // Hebrew words joined into a Hebrew sentence need no isolation
  if (!day) return { main: t("mkt.none"), more: "", tone: "flat" };
  const spx = num(day.spx?.pct), bench = num(day.bench?.pct);
  const lead = spx ?? bench;
  const who = whoWords ?? (spx != null ? t("mkt.who.market") : t("mkt.who.whole")); // its label has digits (Nasdaq-100)
  const g = whoWords ? whoForm ?? "m" : "m";
  const when = whenWords(day.date, today, lang);
  const key = sizeKey(lead, "index");
  let main = key ? said(lang, who, t(`size.${key}.${g}`), when) : t("mkt.lastClose", { who, when }, plain);
  const moved = key && key !== "flat";
  const up = lead != null && lead > 0 && moved, down = lead != null && lead < 0 && moved;
  if (day.counted) {
    const most = day.rose > day.counted / 2 ? "Rose" : day.fell > day.counted / 2 ? "Fell" : null;
    const agree = !moved || (most === "Rose" && up) || (most === "Fell" && down);
    const nounWords = t(`noun.${noun === "funds" ? "funds" : "companies"}`);
    main += most ? t(`mkt.most${most}.${agree ? "and" : "but"}`, { noun: nounWords }, plain) : t("mkt.split", { noun: nounWords }, plain);
  }
  main += ".";
  const parts = [];
  const fromHigh = num(day.spx?.fromHigh) ?? (spx == null ? num(regime?.metrics?.drawdown_pct) ?? num(benchHigh) : null);
  if (fromHigh != null) parts.push(t(`high.${fromHigh > -2 ? "close" : fromHigh > -10 ? "little" : "well"}.${g}`));
  const mood = { calm: "calm", normal: "steady", stressed: "nervous" }[regime?.state];
  if (mood) {
    const m = t(`mood.${mood}`);
    parts.push(parts.length || lang === "he" ? m : m.charAt(0).toUpperCase() + m.slice(1));
  }
  const more = parts.length === 2 ? t("more.two", { a: parts[0], b: parts[1] }, plain) : parts.length ? `${parts[0]}.` : "";
  return { main, more, tone: up ? "accent" : down ? "down" : "flat" };
}

const shortVia = (via) => String(via ?? "").replace(/,?\s+(Inc\.?|LLC|LLP|L\.P\.|LP)$/i, "").replace(/\s+(Capital|Investment)\s+Management$/i, "").trim();
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * "In the news": up to `max` short lines, newest first: results coming in the next week (soonest first, on top), then
 * the latest company news from the outlook cards (its plain wording), the day's biggest mover (with why it moved when a
 * note for that very day exists, lib/why.js), other "why it moved" notes of that day, recent official filings of the
 * list's names (`secNews`, the last `filingDays`) and a recent people's call.
 * Each: {id, text, to, date, tone, why?: noteView, filing?: {url, form}, english?: true}. `english` marks a line whose
 * main words are English text from data (a company card, a note's headline, a filing's title). `why` is the notes file
 * after usableWhy; `members` the market's own names (filings and notes of other lists stay out), `groups` symbol to
 * sector or category, `market` the market id (a sector note belongs to one list).
 */
export function newsLines({ outlook, day, people, today, names = {}, max = 3, newsDays = 21, peopleDays = 14,
  why = null, secNews = null, members = null, groups = {}, market = null, filingDays = 3, maxNotes = 2, maxFilings = 2, lang = "en" }) {
  const t = translate(dict, lang);
  const name = (x) => shortName(x, outlook, names);
  const out = [];
  const soon = (outlook?.companies ?? [])
    .filter((c) => c.next_earnings?.date && days(c.next_earnings.date, today) >= 0 && days(c.next_earnings.date, today) <= 7)
    .sort((a, b) => a.next_earnings.date.localeCompare(b.next_earnings.date) || a.ticker.localeCompare(b.ticker));
  if (soon.length) {
    const c = soon[0], ne = c.next_earnings;
    const others = soon.length - 1;
    const more = others ? t("news.more", { count: others, n: (lang === "he" ? COUNT_HE : COUNT)[others] || t("news.several") }, { bidi: false }) : "";
    const text = t(ne.confirmed ? "news.reports" : "news.expected", { name: name(c.ticker), when: whenWords(ne.date, today, lang) }) + more + ".";
    out.push({ id: `soon:${c.ticker}`, text, to: `stock/${c.ticker}#whats-next`, date: ne.date, ahead: true, tone: "flat" });
  }
  // The newest company news: a results release or a "Recently" item, within `newsDays`, worded by the card's plain line.
  const recent = [];
  for (const c of outlook?.companies ?? []) {
    if (!c.plain) continue;
    const dates = [c.latest?.reported_on, ...(c.whats_next ?? []).filter((w) => w.date && (w.status === "done" || w.date < today)).map((w) => w.date)]
      .filter((d) => d && d <= today && days(d, today) >= -newsDays);
    if (dates.length) recent.push({ c, date: dates.sort().at(-1) });
  }
  recent.sort((a, b) => b.date.localeCompare(a.date) || a.c.ticker.localeCompare(b.c.ticker));
  if (recent[0]) out.push({ id: `news:${recent[0].c.ticker}`, text: recent[0].c.plain, to: `stock/${recent[0].c.ticker}#whats-next`, date: recent[0].date, tone: "flat", english: true });
  // The day's biggest mover on the list.
  const movers = [...(day?.risers ?? []), ...(day?.fallers ?? [])].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.symbol.localeCompare(b.symbol));
  const top = movers[0];
  // Known names only (shortened from the outlook cards); an unknown ticker falls back to the note's own recorded name.
  const view = (n) => noteView(n, { names: { ...names, ...Object.fromEntries((n.symbols ?? []).filter((x) => name(x) !== x).map((x) => [x, name(x)])) }, groups, short: shortSector, lang });
  const explained = new Set();
  if (top && day?.date) {
    const k = sizeKey(top.pct, "stock");
    const note = noteForMover(why, { symbol: top.symbol, date: day.date });
    if (k && k !== "flat") {
      const line = said(lang, own(lang, name(top.symbol)), t(`size.${k}.f`), whenWords(day.date, today, lang));
      if (note) explained.add(note.key);
      out.push({ id: `mover:${top.symbol}`,
        text: note ? `${line} — ${whyClause(note, lang)}.` : `${line}.`,
        to: `stock/${top.symbol}#${note ? "why-it-moved" : "brief"}`, date: day.date, tone: top.pct > 0 ? "accent" : "down", why: note ? view(note) : null, ...(note ? { english: true } : {}) });
    }
  }
  // Other notes of that day: another name on the list, a fund or one of the list's sectors that moved unusually.
  if (day?.date && why) {
    const mine = members ? new Set(members) : null;
    const extra = notesForDay(why, day.date, { market })
      .filter((n) => !explained.has(n.key) && (n.kind === "sector" ? (!market || n.market === market) : !mine || n.symbols.some((x) => mine.has(x))))
      .slice(0, maxNotes);
    for (const n of extra) {
      const v = view(n);
      const g = n.kind === "sector" ? "fp" : "f";
      const k = sizeKey(n.move_pct, "stock");
      const size = t(`size.${k && k !== "flat" ? k : n.move_pct > 0 ? "up" : "down"}.${g}`);
      const one = n.kind !== "sector" && n.symbols.length === 1 ? n.symbols[0] : null;
      out.push({ id: `why:${n.key}`, text: `${said(lang, n.kind === "sector" ? v.who : own(lang, v.who), size, whenWords(day.date, today, lang))} — ${whyClause(n, lang)}.`,
        to: one ? `stock/${one}#why-it-moved` : "details#market-today",
        date: day.date, tone: n.move_pct > 0 ? "accent" : n.move_pct < 0 ? "down" : "flat", why: v, english: true });
    }
  }
  // Official filings of the list's names in the last few days (fixed plain titles from scripts/sec_news.py, not copied text).
  for (const f of recentFilings(secNews, { symbols: members, today, days: filingDays, max: maxFilings, lang })) {
    const title = lang === "he" ? f.title : lowerFirst(f.title);
    out.push({ id: `filing:${f.symbol}:${f.date}`, text: t("news.filing", { name: name(f.symbol), when: whenWords(f.date, today, lang), title }), to: `stock/${f.symbol}#official-news`,
      date: f.date, tone: "flat", filing: { url: f.url, form: f.form }, english: lang === "en" || !hasHebrew(f.title) });
  }
  // A people's call when recent.
  const who = Object.fromEntries((people?.people ?? []).map((p) => [p.id, p.name]));
  const call = [...(people?.calls ?? [])].filter((c) => c.date && c.date <= today && days(c.date, today) >= -peopleDays).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (call) {
    const by = call.credit_person === false || !who[call.person] ? shortVia(call.via) : who[call.person];
    const stance = ["bullish", "bearish", "neutral"].includes(call.stance) ? call.stance : "other";
    out.push({ id: `call:${call.id}`, text: t(`news.call.${stance}`, { by, name: name(call.ticker) }), to: "people", date: call.date, tone: "flat" });
  }
  const ahead = out.filter((x) => x.ahead), past = out.filter((x) => !x.ahead).sort((a, b) => b.date.localeCompare(a.date));
  return [...ahead, ...past].slice(0, max);
}

/** The chip for a checklist verdict ("Going up" / "Mixed" / "Going down"), or null without a reading. */
export function verdictChip(checklist, ticker, lang = "en") {
  const row = (checklist?.symbols ?? []).find((s) => s.symbol === ticker);
  const v = VERDICT_PLAIN[row?.score?.verdict];
  return v ? { word: lang === "en" ? v.word : translate(dict, lang)(`chip.${row.score.verdict}`), tone: v.tone } : null;
}

/**
 * "Companies to know": three to five names, those held on paper or the brain picked first, then the day's biggest
 * movers (tagged with the day's move in words when `today` is given). Each: {ticker, name, plain, chip, tag, to}. The
 * benchmark is never one of them.
 */
export function companiesToKnow({ held = [], picked = [], day, outlook, checklist, names = {}, bench = null, today = null, min = 3, max = 5, lang = "en" }) {
  const t = translate(dict, lang);
  const order = [];
  const tag = {};
  const add = (x, why) => { if (x && x !== bench && !order.includes(x)) { order.push(x); tag[x] = why; } };
  held.forEach((x) => add(x, t("tag.held")));
  picked.forEach((x) => add(x, t("tag.picked")));
  const movers = [...(day?.risers ?? []), ...(day?.fallers ?? [])].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.symbol.localeCompare(b.symbol));
  let added = 0; // up to two movers, more only to reach `min`
  for (const m of movers) {
    if (order.length >= max || (added >= 2 && order.length >= min)) break;
    const n = order.length;
    // The day's move in words ("fell sharply yesterday"), so a "Going up" chip beside it reads as the chart, not the day.
    const k = sizeKey(m.pct, "stock");
    add(m.symbol, k && k !== "flat" && day?.date && today
      ? said(lang, t(`size.${k}.f`), whenWords(day.date, today, lang))
      : t(m.pct > 0 ? "tag.riser" : "tag.faller"));
    added += order.length - n;
  }
  return order.slice(0, max).map((x) => {
    const card = (outlook?.companies ?? []).find((c) => c.ticker === x);
    return { ticker: x, name: shortName(x, outlook, names), plain: card?.plain ?? null, chip: verdictChip(checklist, x, lang), tag: tag[x], to: `stock/${x}#brief` };
  });
}

/** A few words on why a name is watched rather than bought, from its checklist row; null when nothing stands out. */
export function watchWhy(row, lang = "en") {
  if (!row) return null;
  const k = row.rsi?.zone === "overbought" ? "hot" : row.trend?.direction === "down" ? "falling" : row.score?.verdict === "lean_down" ? "leaningDown"
    : row.volume?.rising_on_falling_volume ? "thin" : null;
  return k ? translate(dict, lang)(`watch.${k}`) : null;
}

/**
 * The plan in three lines: {steps: [three lines], next, honest}. `held` the paper record's names, `picked` the brain's
 * latest names, `stage` the trust stage, `nextCheck` the next rebalance date. Watching = the brain's names not held,
 * then checklist names that lean down, run hot or fall (up to `maxWatch`), each with a few words why.
 */
export function planWords({ held = [], picked = [], checklist, outlook, names = {}, stage = 1, nextCheck = null, today, maxWatch = 3, bench = null, lang = "en" }) {
  const t = translate(dict, lang);
  const name = (x) => shortName(x, outlook, names);
  const rows = Object.fromEntries((checklist?.symbols ?? []).map((s) => [s.symbol, s]));
  const money = t(stage >= 2 ? "plan.small" : "plan.paper");
  const plain = { bidi: false };
  const step2 = held.length ? `${money}: ${joinNames(held.map(name), lang)}.` : t("plan.none", { money }, plain);
  const watch = [];
  const seen = new Set(held);
  const push = (x, why) => { if (x !== bench && !seen.has(x) && watch.length < maxWatch) { seen.add(x); watch.push(`${own(lang, name(x))} (${why})`); } };
  picked.forEach((x) => push(x, watchWhy(rows[x], lang) ?? t("plan.justWatching")));
  const rank = (s) => (s.score?.verdict === "lean_down" ? 0 : s.rsi?.zone === "overbought" ? 1 : s.trend?.direction === "down" ? 2 : 9);
  [...(checklist?.symbols ?? [])].filter((s) => rank(s) < 9).sort((a, b) => rank(a) - rank(b) || a.symbol.localeCompare(b.symbol))
    .forEach((s) => push(s.symbol, watchWhy(s, lang)));
  const step3 = watch.length ? t("plan.watching", { names: joinNames(watch, lang) }, plain) : t("plan.nothing");
  return {
    steps: [t("plan.core"), step2, step3],
    next: nextCheck ? t("plan.next", { when: whenWords(nextCheck, today, lang) }, plain) : null,
    honest: t("plan.honest"),
  };
}
