// Official company news (data/market/sec_news.json, from the SEC's filings index) in plain words for the Stock page and
// the home's cards. Pure functions, no React; tested in secnews.test.js. Titles are fixed plain words chosen by code
// (scripts/sec_news.py), never text from the filings, so they can be shown as they are.

import { fmtShort, translate } from "./i18n.js";
import dict from "../i18n/home.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 9" ("9 באוק׳" in Hebrew). */
export const shortDay = (iso, lang = "en") => {
  if (lang !== "en") return fmtShort(iso, lang);
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

/** How each kind of news is shown: a word for the badge (English; other languages: kindOf) and a tone. */
export const NEWS_KIND = {
  results: { word: "Results", tone: "accent" },
  report: { word: "Report", tone: "flat" },
  warning: { word: "Heads-up", tone: "down" },
  people: { word: "People", tone: "people" },
  deal: { word: "Deal", tone: "ai" },
  money: { word: "Money", tone: "ai" },
  update: { word: "Update", tone: "flat" },
  other: { word: "Other", tone: "flat" },
};

/** A kind's badge word and tone in a language. */
export function kindOf(kind, lang = "en") {
  if (!NEWS_KIND[kind]) return {};
  return { ...NEWS_KIND[kind], word: lang === "en" ? NEWS_KIND[kind].word : translate(dict, lang)(`sec.kind.${kind}`) };
}

const FORM_KEY = { "10-Q": "q", "10-K": "y", "20-F": "y", "40-F": "y", "6-K": "6k" };

/**
 * A filing's plain titles in a language. English: as published. Other languages: the same fixed titles looked up by
 * the 8-K item codes or the form (i18n/home.js "sec.item.*", "sec.form.*"); when a code or form is unknown, the
 * published English titles.
 */
export function titlesIn(f, lang = "en") {
  const en = f?.titles ?? [];
  if (lang === "en" || !en.length) return en;
  const t = translate(dict, lang);
  const form = String(f.form ?? ""), base = form.replace(/\/A$/, "");
  const codes = Array.isArray(f.items) ? f.items : null;
  const keys = base === "8-K" ? (!codes ? null : codes.length ? codes.map((c) => `sec.item.${c}`) : ["sec.item.none"])
    : FORM_KEY[base] ? [`sec.form.${FORM_KEY[base]}`] : null;
  if (!keys || keys.length !== en.length || !keys.every((k) => t.has(k))) return en;
  const out = keys.map((k) => t(k));
  if (form.endsWith("/A")) out[0] = t("sec.amend", { title: out[0] }, { bidi: false });
  return out;
}

/** A company's filings, newest first (as published), or []. */
export function newsFor(doc, symbol) {
  return (doc?.companies ?? []).find((c) => c.symbol === symbol)?.filings ?? [];
}

/** The newest filing worth a line on a card: quarterly results or a heads-up first if within two weeks of the newest. */
export function headlineFor(doc, symbol, lang = "en") {
  const f = newsFor(doc, symbol);
  if (!f.length) return null;
  const newest = f[0].date;
  const near = (x) => (new Date(`${newest}T00:00:00Z`) - new Date(`${x.date}T00:00:00Z`)) / 864e5 <= 14;
  const top = f.find((x) => near(x) && (x.kind === "results" || x.kind === "warning")) ?? f[0];
  return { ...top, title: titlesIn(top, lang)[0], day: shortDay(top.date, lang), ...kindOf(top.kind, lang) };
}

/** Rows for the Stock page's list: the fixed titles of scripts/sec_news.py, in `lang` when known (titlesIn). */
export function newsRows(doc, symbol, max = 6, lang = "en") {
  return newsFor(doc, symbol).slice(0, max).map((f) => ({ ...f, title: titlesIn(f, lang).join(" · "), day: shortDay(f.date, lang), ...kindOf(f.kind, lang) }));
}

/**
 * Current reports (8-K, or 6-K for a company abroad) filed by the given names within `days` of `today`, newest first,
 * one per company (its newest): {symbol, date, form, title, titles, kind, url}, titles in `lang` (titlesIn). Quarterly and yearly reports are left
 * out: they are on each Stock page. Filings dated after `today` (a clock behind the data) are kept.
 */
export function recentFilings(doc, { symbols = null, today, days = 3, max = 2, lang = "en" } = {}) {
  if (!doc || !today) return [];
  const keep = symbols ? new Set(symbols) : null;
  const from = Date.parse(`${today}T00:00:00Z`) - days * 864e5;
  const out = [];
  for (const c of doc.companies ?? []) {
    if (keep && !keep.has(c.symbol)) continue;
    const f = (c.filings ?? []).find((x) => /^(8|6)-K/.test(x.form ?? "") && x.date && Date.parse(`${x.date}T00:00:00Z`) >= from && x.titles?.length);
    if (!f) continue;
    const titles = titlesIn(f, lang);
    out.push({ symbol: c.symbol, date: f.date, form: f.form, title: titles[0], titles, kind: f.kind, url: f.url });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol)).slice(0, max);
}
