const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parse = (iso) => new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
export const fmtDate = (iso) => dateFmt.format(parse(iso));
export const fmtShort = (iso) => shortFmt.format(parse(iso));
export const fmtUsd = (v) => usd.format(v);
export const fmtNum = (v, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (v, d = 2) => { const r = Math.abs(v).toFixed(d); const z = Number(r) === 0; return `${z ? "" : v > 0 ? "+" : "−"}${r}%`; };
/** "accent" (up), "down" or "flat" for a percent change as it shows at `d` decimals: a fall never shows in the up colour. */
export const signTone = (v, d = 2) => (v == null || Math.abs(v) < 0.5 / 10 ** d ? "flat" : v > 0 ? "accent" : "down");
export const fmtK = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

export function relDays(iso, ref = new Date()) {
  const today = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  const days = Math.floor((today - parse(iso)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtShort(iso);
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
export const numWord = (n) => WORDS[n] ?? String(n);
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
