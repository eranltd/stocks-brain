// "Why it moved" notes (data/market/why.json) in plain words for the Home's news card, the Full dashboard's market day
// and each Stock page. Pure functions, no React; tested in why.test.js.
// The notes are written by a separate scheduled Claude session (not the stock-picking brain) from an allow-list of
// official sources and reputable outlets, in its own words, and checked by scripts/record_why.py before they are
// published. The size of each move (move_pct) and the names it covers (symbols) come from our own data, never from the
// model. A note explains a move after it happened; it is never a reason to trade and never enters the brain's pack.

import { fmtShort, translate } from "./i18n.js";
import dict from "../i18n/home.js";

/** The line every note carries wherever it is shown (config/rules.json: the plan does not buy on headlines). */
export const NOT_A_TRADE = "This explains a move; it is not a reason to trade.";
export const notATrade = (lang = "en") => translate(dict, lang)("why.notATrade");
/** How far back a Stock page lists a name's notes (why.json itself keeps about thirty days). */
export const WHY_DAYS = 30;

/** Each confidence in words (English): a short label for a chip and the word the news line uses before the headline.
 *  Other languages: confidenceWord(conf, lang). */
export const CONFIDENCE = {
  clear: { word: "Clear cause", lead: "why", tone: "accent" },
  likely: { word: "Likely cause", lead: "likely why", tone: "flat" },
  unclear: { word: "No clear cause found", lead: null, tone: "people" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const confidenceWord = (conf, lang = "en") => translate(dict, lang)(`why.conf.${CONFIDENCE[conf] ? conf : "unclear"}`);
/** "Oct 9" for a YYYY-MM-DD date ("9 באוק׳" in Hebrew). */
export const noteDay = (iso, lang = "en") => {
  if (!isDate(iso)) return "";
  if (lang !== "en") return fmtShort(iso, lang);
  const d = new Date(utc(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const trimEnd = (s) => String(s ?? "").trim().replace(/[.;:,\s]+$/, "");

/**
 * The notes file when it may be shown, else null: absent, malformed, or sample notes on a site with live prices (a
 * made-up note must never sit next to a real move).
 */
export function usableWhy(doc, livePrices = false) {
  if (!doc || !Array.isArray(doc.notes)) return null;
  if (doc.sample && livePrices) return null;
  return doc;
}

/** The market day a note is about: its own market_date, else the file's as_of (older files). */
export const dateOf = (note, doc = null) => (isDate(note?.market_date) ? note.market_date : isDate(doc?.as_of) ? doc.as_of : null);

/** A note's confidence, defaulting to "unclear" for anything unknown (never stronger than what was recorded). */
export const confidenceOf = (note) => (CONFIDENCE[note?.confidence] ? note.confidence : "unclear");

const bySize = (a, b) => Math.abs(num(b.move_pct) ?? 0) - Math.abs(num(a.move_pct) ?? 0) || String(a.key ?? "").localeCompare(String(b.key ?? ""));

/** Notes with their market day filled in, dropping any without a day or a headline. */
function dated(doc) {
  return (doc?.notes ?? [])
    .map((n) => ({ ...n, market_date: dateOf(n, doc), symbols: Array.isArray(n.symbols) ? n.symbols : [] }))
    .filter((n) => n.market_date && typeof n.headline === "string" && n.headline.trim());
}

/**
 * The notes about one market day, biggest move first. `market` keeps sector notes to that market's list (a sector
 * average is a property of one list); a note on a single name or fund is about that name wherever it is listed.
 */
export function notesForDay(doc, date, { market = null } = {}) {
  if (!doc || !isDate(date)) return [];
  return dated(doc)
    .filter((n) => n.market_date === date)
    .filter((n) => n.kind !== "sector" || !market || !n.market || n.market === market)
    .sort(bySize);
}

/**
 * One name's notes (stock or fund, not sector averages) within `days` of `today`, newest first. A note dated after
 * `today` (a clock behind the data) still shows.
 */
export function notesForSymbol(doc, symbol, { today = null, days = WHY_DAYS } = {}) {
  if (!doc || !symbol) return [];
  const from = isDate(today) ? utc(today) - days * DAY : null;
  return dated(doc)
    .filter((n) => n.kind !== "sector" && n.symbols.includes(symbol))
    .filter((n) => from == null || utc(n.market_date) >= from)
    .sort((a, b) => b.market_date.localeCompare(a.market_date) || bySize(a, b));
}

/**
 * The note for a mover line: a note on that very name (stock or fund) for that very day, else null. A note from an
 * older day never explains a newer move (stale), and a sector note is not pinned on one name.
 */
export function noteForMover(doc, { symbol, date }) {
  if (!doc || !symbol || !isDate(date)) return null;
  return dated(doc).find((n) => n.kind !== "sector" && n.market_date === date && n.symbols.includes(symbol)) ?? null;
}

/**
 * Whether the notes are behind the market: the latest market day is newer than the file's as_of. That day's notes may
 * still be on their way, or the day had no unusual move (a quiet day records nothing, so as_of stays put): never say
 * which. False when there is no file or no day.
 */
export function isBehind(doc, latestDate) {
  return Boolean(doc && isDate(doc.as_of) && isDate(latestDate) && doc.as_of < latestDate);
}

/**
 * The words a news line adds after the move: "why: SpaceX agreed to buy phone airwaves", "likely why: ...", or for an
 * unclear note "no clear cause has been found yet". No trailing full stop. The headline is the note's own (English)
 * text; in Hebrew it is isolated so it reads left to right inside the line.
 */
export function whyClause(note, lang = "en") {
  if (!note) return "";
  const conf = confidenceOf(note);
  const t = translate(dict, lang);
  return CONFIDENCE[conf].lead ? t(`why.lead.${conf}`, { headline: trimEnd(note.headline) }) : t("why.none");
}

/** A note's sources for display, in the order given: {url, publisher, day}. Only https links are kept. */
export function sourcesOf(note, lang = "en") {
  return (note?.sources ?? [])
    .filter((s) => typeof s?.url === "string" && /^https:\/\//.test(s.url))
    .map((s) => ({ url: s.url, publisher: String(s.publisher ?? "").trim() || hostOf(s.url), day: noteDay(s.published, lang) }));
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

/**
 * The group a sector note is about: from its key ("sector:Communication Services"), else a `sector` field, else the most
 * common group of its names (ties: first).
 */
export function sectorOf(note, groups = {}) {
  const fromKey = typeof note?.key === "string" && note.key.startsWith("sector:") ? note.key.slice(7).trim() : "";
  if (fromKey) return fromKey;
  if (typeof note?.sector === "string" && note.sector) return note.sector;
  const count = {};
  for (const s of note?.symbols ?? []) if (groups[s]) count[groups[s]] = (count[groups[s]] ?? 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Who a note is about, in words: the stock or fund itself (its first symbol; any others are funds that moved with it),
 * from `names`, else the note's own name (filled from the site's config by record_why, so funds of other lists read as
 * words too), else the ticker; "Communication companies on the list" for a sector average. `names` maps symbol to name,
 * `short(sector, lang)` shortens a sector name (lib/marketday.js shortSector), `lang` the language.
 */
export function whoOf(note, { names = {}, groups = {}, short = (s) => s, lang = "en" } = {}) {
  const t = translate(dict, lang);
  if (note?.kind === "sector") {
    const sector = sectorOf(note, groups);
    return sector ? t("why.who.sector", { sector: short(sector, lang) }) : t("why.who.group");
  }
  const first = note?.symbols?.[0];
  const named = (first && names[first]) || note?.name || first;
  return named ? plainName(named) : t("why.who.one");
}

/** A name without its data-provider suffix: "Nasdaq-100 (QQQ proxy)" becomes "Nasdaq-100". */
export const plainName = (s) => String(s ?? "").replace(/\s*\([A-Z0-9.^-]+ proxy\)\s*$/i, "").trim() || String(s ?? "");

/**
 * A note ready to show: {key, kind, date, day, who, headline, why, confidence, word, tone, sources, move_pct,
 * symbols}. `why` is the longer own-words explanation (may be empty, English like the headline); `word` the confidence
 * in words. `opts`: whoOf's options, with `lang` for the words the site writes (who, word, day).
 */
export function noteView(note, opts = {}) {
  const conf = confidenceOf(note);
  const lang = opts.lang ?? "en";
  return {
    key: `${note.market_date}:${note.key ?? (note.symbols ?? []).join(",")}`, // a name can have notes on several days
    kind: note.kind,
    market: note.market ?? null,
    date: note.market_date,
    day: noteDay(note.market_date, lang),
    who: whoOf(note, opts),
    headline: trimEnd(note.headline),
    why: String(note.why ?? "").trim(),
    confidence: conf,
    word: confidenceWord(conf, lang),
    tone: CONFIDENCE[conf].tone,
    unclear: conf === "unclear",
    sources: sourcesOf(note, lang),
    move_pct: num(note.move_pct),
    symbols: note.symbols ?? [],
  };
}
