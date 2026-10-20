// The site's formatters. They live in lib/i18n.js (lang-aware); these are the same functions with an optional `lang`
// as the last argument, English by default, so existing callers print exactly what they always did.
export { fmtDate, fmtShort, fmtUsd, fmtNum, fmtPct, fmtK, relDays, numWord, fmtList, formatters } from "./i18n.js";

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
