// The site's formatters. Dates are read as calendar days in UTC (a "YYYY-MM-DD" market day stays that New York trading day).
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const listFmt = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

const parse = (iso) => new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
/** "Fri, 16 Oct 2026". */
export const fmtDate = (iso) => dateFmt.format(parse(iso));
/** "16 Oct". */
export const fmtShort = (iso) => shortFmt.format(parse(iso));
/** "$1,234.50". */
export const fmtUsd = (v) => usd.format(v);
/** "1,234.57". */
export const fmtNum = (v, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
/** "+4.10%", "−4.10%" (a true minus sign) or "0.00%" when it rounds to zero. */
export const fmtPct = (v, d = 2) => { const r = Math.abs(v).toFixed(d); const z = Number(r) === 0; return `${z ? "" : v > 0 ? "+" : "−"}${r}%`; };
export const fmtK = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

/** "today", "yesterday", "8 days ago", then a short date (UTC calendar days). */
export function relDays(iso, ref = new Date()) {
  const today = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  const days = Math.floor((today - parse(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtShort(iso);
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
/** Sentence-start number words ("Three"), digits past ten. */
export const numWord = (n) => WORDS[n] ?? String(n);
/** "A, B and C". */
export const fmtList = (items) => listFmt.format(items.map(String));


/** "accent" (up), "down" or "flat" for a percent change as it shows at `d` decimals: a fall never shows in the up colour. */
export const signTone = (v, d = 2) => (v == null || Math.abs(v) < 0.5 / 10 ** d ? "flat" : v > 0 ? "accent" : "down");
export const pad2 = (n) => String(n).padStart(2, "0");
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Hebrew letters (the library keeps some original video titles as "Hebrew (English)"). */
const HEBREW = /[\u0590-\u05FF]/;
/** The English form of a source title: the parenthesised English part of a "Hebrew (English)" title, or the title with
 *  any Hebrew removed. The app shows English only; the original title stays in the data as the citation. */
export function englishTitle(t) {
  if (!t || !HEBREW.test(t)) return t ?? "";
  const m = t.match(/\(([^()]*)\)\s*$/);
  if (m && !HEBREW.test(m[1])) return m[1].trim();
  const stripped = t.replace(/[\u0590-\u05FF\u05F3\u05F4]+/g, "").replace(/\s{2,}/g, " ").replace(/^[\s\-–—:?,.]+|[\s\-–—:,]+$/g, "").trim();
  return stripped || "Untitled source";
}
