// The header's market switch: the choices, which one is shown, which market a stock page belongs to, and the data the
// market-aware pages (Home, Stocks, a stock page) read for it. Pure functions, no React; tested in markets.test.js.
// loadMarket (lib/data.js) fetches a market's view; this file only picks and reshapes.

import { ltr, translate } from "./i18n.js";
import text from "../i18n/shell.js";

export const DEFAULT_MARKET = "nasdaq";
// Every sentence here takes `lang` last (default "en", so old callers and tests keep English); the words are in
// i18n/shell.js ("market.*"). Hebrew nouns (חברה/חברות, קרן/קרנות) are all feminine, and every Hebrew MARKET_WHO phrase
// is masculine singular (השוק הישראלי, תחום השבבים כולו, מדד Nasdaq-100), so a caller's template can agree with either.
const T = { en: translate(text, "en"), he: translate(text, "he") };
const tr = (lang) => T[lang] ?? T.en;
const MARKET_IDS = ["nasdaq", "tlv", "ishares", "chips", "tech", "energy", "sectors"];
const WHO_IDS = ["tlv", "ishares", "chips", "tech", "energy", "sectors"];
const byId = (ids, prefix, lang) => Object.fromEntries(ids.map((id) => [id, tr(lang)(`${prefix}.${id}`)]));

/** One line under each choice in the switch. */
export const SWITCH_WORDS = byId(MARKET_IDS, "market.what", "en");
const SWITCH_HE = byId(MARKET_IDS, "market.what", "he");

export const TLV_NOTE = T.en("market.tlvNote");
export const NOT_YET = T.en("market.notYet");
/** NOT_YET in a language. */
export const notYet = (lang = "en") => tr(lang)("market.notYet");

/** Pages that read the Nasdaq list only (the daily brain, the practice portfolio, the rules, the people, the record). */
export const NASDAQ_ONLY = ["details", "people", "portfolio", "playbook", "track", "kb", "learnings", "runs"];

/** The calm line such a page shows while another market is chosen. */
export const nasdaqOnlyLine = (label, lang = "en") => tr(lang)("market.nasdaqOnly", { label });

/** The switch's choices, in config order: {id, label, what, available}; `what` in `lang` (a market this file has no
 * words for falls back to its config name, which is English). */
export function switchChoices(markets = [], lang = "en") {
  const words = lang === "he" ? SWITCH_HE : SWITCH_WORDS;
  return markets.map((m) => ({ id: m.id, label: m.label ?? m.id, what: words[m.id] ?? m.name ?? "", available: Boolean(m.available) }));
}

/** The default market's id: the config default, else the first, else "nasdaq". */
export const defaultId = (markets = []) => (markets.find((m) => m.default) ?? markets[0])?.id ?? DEFAULT_MARKET;

/** The market to show: the wanted id (from the hash or the switch) when it is published, else the default. */
export function pickMarket(markets = [], wanted = null) {
  return wanted && markets.some((m) => m.id === wanted) ? wanted : defaultId(markets);
}

/** "company"/"companies" or, for a funds market, "fund"/"funds". */
/** In Hebrew: { one: "קרן", many: "קרנות" } or { one: "חברה", many: "חברות" } (both feminine). */
export function nounsFor(entry, lang = "en") {
  const t = tr(lang);
  return entry?.kind === "funds" ? { one: t("market.noun.fund"), many: t("market.noun.funds") } : { one: t("market.noun.company"), many: t("market.noun.companies") };
}

/** The market's own note in plain words, shown once on its pages (TLV only: what is and is not included). */
export const marketNote = (entry, lang = "en") => (entry?.id === "tlv" ? tr(lang)("market.tlvNote") : null);

/** Who "the market" is in the home's sentence, without digits: the benchmark of that market in everyday words. */
export const MARKET_WHO = byId(WHO_IDS, "market.who", "en");
const WHO_HE = byId(WHO_IDS, "market.who", "he");
/** MARKET_WHO in a language (Hebrew phrases are masculine singular: "השוק הישראלי"), or undefined for another id. */
export const marketWho = (id, lang = "en") => (lang === "he" ? WHO_HE : MARKET_WHO)[id];

/** The symbols on a market view's list (not the benchmark). */
export const membersOf = (view) => (view?.watchlist?.symbols ?? []).map((s) => s.symbol);

/** How a symbol belongs to a market view: "member", "benchmark" or null. */
export function roleIn(view, symbol) {
  if (!view || !symbol) return null;
  if (membersOf(view).includes(symbol)) return "member";
  if (view.benchmark === symbol) return "benchmark";
  return null;
}

/**
 * The market a stock page opens in: the current one when the symbol is on its list or is its benchmark, else the
 * first market (config order) that lists it, else the first whose benchmark it is, else null. EIS is TLV's benchmark
 * and a fund on the iShares list: from iShares it stays there; from Nasdaq it opens as a fund.
 */
export function resolveSymbolMarket(views = [], symbol, current = null) {
  const here = views.find((v) => v?.id === current);
  if (roleIn(here, symbol)) return current;
  return views.find((v) => roleIn(v, symbol) === "member")?.id ?? views.find((v) => roleIn(v, symbol) === "benchmark")?.id ?? null;
}

/** The outlook file with only the cards of the given symbols (each market's pages show their own companies' news). */
export function scopeOutlook(outlook, symbols) {
  if (!outlook) return outlook;
  const keep = new Set(symbols);
  return { ...outlook, companies: (outlook.companies ?? []).filter((c) => keep.has(c.ticker)) };
}

/** The default market's data: loadAll's result with the outlook cut to its own list (other markets' cards live there
 * too); the whole file stays as `outlookAll` for marketData. */
export function nasdaqData(data) {
  if (!data) return data;
  const members = [...(data.watchlist?.symbols ?? []).map((s) => s.symbol), ...(data.watchlist?.context ?? []).map((c) => c.symbol)];
  return { ...data, marketId: defaultId(data.markets), outlookAll: data.outlookAll ?? data.outlook, outlook: scopeOutlook(data.outlookAll ?? data.outlook, members) };
}

/**
 * The data a market-aware page reads for another market: the loadAll result with that market's numbers, checklist,
 * list, names and benchmark in place, and the Nasdaq-only parts (paper portfolio, rule history, brain picks, people)
 * emptied so nothing from the Nasdaq list shows as if it were this market's.
 */
export function marketData(data, view) {
  if (!data || !view) return null;
  const entry = view.entry ?? {};
  const members = membersOf(view);
  return {
    ...data,
    marketId: view.id,
    marketEntry: entry,
    market: view.market,
    checklist: view.checklist,
    watchlist: view.watchlist ?? { symbols: [] },
    names: { ...view.names },
    prices: view.prices,
    sectors: view.groups,
    bench: { symbol: view.benchmark, label: entry.benchmark_label ?? view.benchmark },
    outlook: scopeOutlook(data.outlookAll ?? data.outlook, members),
    regime: null, longrun: null, paper: null, core: null, kb: [], people: null, peopleScores: null,
    livePrices: !view.sample,
  };
}

/** The candle files of the market a page's data belongs to. */
export function candlesOf(data) {
  const id = data?.marketId;
  const m = id ? data?.manifest?.markets?.[id] : null;
  return (m && !m.default ? m.candles : data?.manifest?.candles) ?? {};
}

/** A fund's card from config/funds.json, or null. */
export const fundCard = (funds, ticker) => (funds?.funds ?? []).find((f) => f.ticker === ticker) ?? null;

/** A fund's yearly cost in words: "0.03% a year" / "0.03% בשנה" (the share of the money the fund keeps each year). */
export function costWords(pct, lang = "en") {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  const p = `${pct.toFixed(2).replace(/0$/, "")}%`;
  // In Hebrew the percent is one left-to-right piece, so "%" stays on the number's right side.
  return tr(lang)("market.costYear", { pct: lang === "he" ? ltr(p) : p }, { bidi: false });
}
