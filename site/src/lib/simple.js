// The simple home: four calm cards in words, not numbers (the market, the news, companies to know, our plan). Pure
// functions, no React. Every input is published data; this file only turns it into short sentences. Its output has no
// digits: dates become weekday or month words ("yesterday", "next Wednesday", "in late October").

import { VERDICT_PLAIN } from "./brief.js";

const DAY = 86400000;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const days = (iso, today) => Math.round((utc(iso) - utc(today)) / DAY);
const weekday = (iso) => WEEKDAYS[new Date(utc(iso)).getUTCDay()];
const weekStart = (iso) => { const d = new Date(utc(iso)); return utc(iso) - ((d.getUTCDay() + 6) % 7) * DAY; }; // Monday
const partOfMonth = (iso) => { const d = new Date(utc(iso)); const n = d.getUTCDate(); return `${n <= 10 ? "early" : n <= 20 ? "mid" : "late"} ${MONTHS[d.getUTCMonth()]}`; };

/** A past or future market date in words, relative to `today` (both YYYY-MM-DD): "yesterday", "next Wednesday", "in late October". */
export function whenWords(iso, today) {
  if (!iso || !today) return "";
  const n = days(iso, today);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  const weeks = Math.round((weekStart(iso) - weekStart(today)) / (7 * DAY));
  if (n > 0 && weeks === 0) return `this ${weekday(iso)}`;
  if (n > 0 && weeks === 1) return `next ${weekday(iso)}`;
  if (n < 0 && n >= -6) return `on ${weekday(iso)}`;
  return `in ${partOfMonth(iso)}`;
}

/** "Microsoft, Apple and Gilead". */
export function joinNames(list) {
  const xs = list.filter(Boolean);
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

/** The short company name the plain summary starts with ("Nvidia: ..."), else the watchlist name, else the ticker. */
export function shortName(ticker, outlook, names = {}) {
  const card = (outlook?.companies ?? []).find((c) => c.ticker === ticker);
  const lead = card?.plain?.match(/^([^:]{2,40}):/)?.[1];
  return lead ?? names[ticker] ?? ticker;
}

/** How big a day move was, in words. The index moves less than one company, so its bar is lower. */
export const SIZE = { index: [0.15, 0.6, 1.2], stock: [0.3, 1.5, 3.5] };
export function sizeWord(pct, kind = "index") {
  const v = num(pct);
  if (v == null) return null;
  const [flat, small, big] = SIZE[kind] ?? SIZE.index;
  const a = Math.abs(v);
  if (a < flat) return "barely moved";
  if (v > 0) return a < small ? "rose a little" : a < big ? "rose" : "jumped";
  return a < small ? "slipped" : a < big ? "fell" : "fell sharply";
}

/**
 * "The market": {main, more, tone}. `day` is marketDay() (lib/marketday.js), `regime` data/kb/regime.json, `today` the
 * New York date. The S&P 500 leads; older data has only the benchmark. Words only.
 */
export function marketWords(day, regime, today) {
  if (!day) return { main: "The market's last close appears after the next daily run.", more: "", tone: "flat" };
  const spx = num(day.spx?.pct), bench = num(day.bench?.pct);
  const lead = spx ?? bench;
  const who = spx != null ? "The market" : "Our benchmark"; // its label has digits (Nasdaq-100)
  const when = whenWords(day.date, today);
  const size = sizeWord(lead, "index");
  let main = size ? `${who} ${size} ${when}` : `${who}'s last close was ${when}`;
  const up = lead != null && lead > 0 && size !== "barely moved", down = lead != null && lead < 0 && size !== "barely moved";
  if (day.counted) {
    const most = day.rose > day.counted / 2 ? "rose" : day.fell > day.counted / 2 ? "fell" : null;
    const agree = !size || size === "barely moved" || (most === "rose" && up) || (most === "fell" && down);
    main += most ? `, ${agree ? "and" : "but"} most of our companies ${most}` : ", and our companies were split";
  }
  main += ".";
  const parts = [];
  const fromHigh = num(day.spx?.fromHigh) ?? (spx == null ? num(regime?.metrics?.drawdown_pct) : null);
  if (fromHigh != null) parts.push(fromHigh > -2 ? "It is close to its high for the year" : fromHigh > -10 ? "It is a little below its high for the year" : "It is well below its high for the year");
  const mood = { calm: "the mood is calm", normal: "the mood is steady", stressed: "the mood is nervous: bigger swings than usual" }[regime?.state];
  if (mood) parts.push(parts.length ? mood : mood.charAt(0).toUpperCase() + mood.slice(1));
  const more = parts.length ? `${parts.join(", and ")}.` : "";
  return { main, more, tone: up ? "accent" : down ? "down" : "flat" };
}

const STANCE = { bullish: "is upbeat on", bearish: "is wary of", neutral: "is on the fence about" };
const shortVia = (via) => String(via ?? "").replace(/,?\s+(Inc\.?|LLC|LLP|L\.P\.|LP)$/i, "").replace(/\s+(Capital|Investment)\s+Management$/i, "").trim();

/**
 * "In the news": up to `max` short lines, newest first: results coming in the next week (soonest first, on top), then
 * the latest company news from the outlook cards (its plain wording), the day's biggest mover and a recent people's call.
 * Each: {id, text, to, date, tone}.
 */
export function newsLines({ outlook, day, people, today, names = {}, max = 3, newsDays = 21, peopleDays = 14 }) {
  const name = (t) => shortName(t, outlook, names);
  const out = [];
  const soon = (outlook?.companies ?? [])
    .filter((c) => c.next_earnings?.date && days(c.next_earnings.date, today) >= 0 && days(c.next_earnings.date, today) <= 7)
    .sort((a, b) => a.next_earnings.date.localeCompare(b.next_earnings.date) || a.ticker.localeCompare(b.ticker));
  if (soon.length) {
    const c = soon[0], ne = c.next_earnings;
    const others = soon.length - 1;
    const verb = ne.confirmed ? "reports results" : "is expected to report results";
    const more = others ? `, and ${COUNT[others] ?? "several"} more ${others === 1 ? "company reports" : "companies report"} this coming week` : "";
    out.push({ id: `soon:${c.ticker}`, text: `${name(c.ticker)} ${verb} ${whenWords(ne.date, today)}${more}.`, to: `stock/${c.ticker}#whats-next`, date: ne.date, ahead: true, tone: "flat" });
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
  if (recent[0]) out.push({ id: `news:${recent[0].c.ticker}`, text: recent[0].c.plain, to: `stock/${recent[0].c.ticker}#whats-next`, date: recent[0].date, tone: "flat" });
  // The day's biggest mover on our list.
  const movers = [...(day?.risers ?? []), ...(day?.fallers ?? [])].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.symbol.localeCompare(b.symbol));
  const top = movers[0];
  if (top && day?.date) {
    const w = sizeWord(top.pct, "stock");
    if (w && w !== "barely moved") out.push({ id: `mover:${top.symbol}`, text: `${name(top.symbol)} ${w} ${whenWords(day.date, today)}.`, to: `stock/${top.symbol}#brief`, date: day.date, tone: top.pct > 0 ? "accent" : "down" });
  }
  // A people's call when recent.
  const who = Object.fromEntries((people?.people ?? []).map((p) => [p.id, p.name]));
  const call = [...(people?.calls ?? [])].filter((c) => c.date && c.date <= today && days(c.date, today) >= -peopleDays).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (call) {
    const by = call.credit_person === false || !who[call.person] ? shortVia(call.via) : who[call.person];
    out.push({ id: `call:${call.id}`, text: `${by} ${STANCE[call.stance] ?? "spoke about"} ${name(call.ticker)}.`, to: "people", date: call.date, tone: "flat" });
  }
  const ahead = out.filter((x) => x.ahead), past = out.filter((x) => !x.ahead).sort((a, b) => b.date.localeCompare(a.date));
  return [...ahead, ...past].slice(0, max);
}

/** The chip for a checklist verdict ("Going up" / "Mixed" / "Going down"), or null without a reading. */
export function verdictChip(checklist, ticker) {
  const row = (checklist?.symbols ?? []).find((s) => s.symbol === ticker);
  const v = VERDICT_PLAIN[row?.score?.verdict];
  return v ? { word: v.word, tone: v.tone } : null;
}

/**
 * "Companies to know": three to five names, those we hold on paper or the brain picked first, then the day's biggest
 * movers. Each: {ticker, name, plain, chip, tag, to}. The benchmark is never one of them.
 */
export function companiesToKnow({ held = [], picked = [], day, outlook, checklist, names = {}, bench = null, min = 3, max = 5 }) {
  const order = [];
  const tag = {};
  const add = (t, why) => { if (t && t !== bench && !order.includes(t)) { order.push(t); tag[t] = why; } };
  held.forEach((t) => add(t, "on paper"));
  picked.forEach((t) => add(t, "the brain is watching"));
  const movers = [...(day?.risers ?? []), ...(day?.fallers ?? [])].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.symbol.localeCompare(b.symbol));
  let added = 0; // up to two movers, more only to reach `min`
  for (const m of movers) {
    if (order.length >= max || (added >= 2 && order.length >= min)) break;
    const n = order.length;
    add(m.symbol, m.pct > 0 ? "one of the day's big risers" : "one of the day's big fallers");
    added += order.length - n;
  }
  return order.slice(0, max).map((t) => {
    const card = (outlook?.companies ?? []).find((c) => c.ticker === t);
    return { ticker: t, name: shortName(t, outlook, names), plain: card?.plain ?? null, chip: verdictChip(checklist, t), tag: tag[t], to: `stock/${t}#brief` };
  });
}

/** A few words on why a name is watched rather than bought, from its checklist row; null when nothing stands out. */
export function watchWhy(row) {
  if (!row) return null;
  if (row.rsi?.zone === "overbought") return "overheated";
  if (row.trend?.direction === "down") return "falling";
  if (row.score?.verdict === "lean_down") return "leaning down";
  if (row.volume?.rising_on_falling_volume) return "rising on thin buying";
  return null;
}

/**
 * "Our plan: one, two, three": {steps: [three lines], next, honest}. `held` the paper record's names, `picked` the
 * brain's latest names, `stage` the trust stage, `nextCheck` the next rebalance date. Watching = the brain's names we
 * do not hold, then checklist names that lean down, run hot or fall (up to `maxWatch`), each with a few words why.
 */
export function planWords({ held = [], picked = [], checklist, outlook, names = {}, stage = 1, nextCheck = null, today, maxWatch = 3, bench = null }) {
  const name = (t) => shortName(t, outlook, names);
  const rows = Object.fromEntries((checklist?.symbols ?? []).map((s) => [s.symbol, s]));
  const step1 = "Keep most of our savings in the S&P 500 index fund.";
  const money = stage >= 2 ? "Small amounts only, within the house limits" : "Practise on paper, no real money yet";
  const step2 = held.length ? `${money}: ${joinNames(held.map(name))}.` : `${money}: no single companies held right now.`;
  const watch = [];
  const seen = new Set(held);
  const push = (t, why) => { if (t !== bench && !seen.has(t) && watch.length < maxWatch) { seen.add(t); watch.push(`${name(t)} (${why})`); } };
  picked.forEach((t) => push(t, watchWhy(rows[t]) ?? "the brain is just watching"));
  const rank = (s) => (s.score?.verdict === "lean_down" ? 0 : s.rsi?.zone === "overbought" ? 1 : s.trend?.direction === "down" ? 2 : 9);
  [...(checklist?.symbols ?? [])].filter((s) => rank(s) < 9).sort((a, b) => rank(a) - rank(b) || a.symbol.localeCompare(b.symbol))
    .forEach((s) => push(s.symbol, watchWhy(s)));
  const step3 = watch.length ? `Watching, not buying: ${joinNames(watch)}.` : "Watching, not buying: nothing stands out today.";
  return {
    steps: [step1, step2, step3],
    next: nextCheck ? `Next check: ${whenWords(nextCheck, today)}.` : null,
    honest: "This is a practice notebook, not advice. The checks are unproven for us, so nothing here says buy.",
  };
}
