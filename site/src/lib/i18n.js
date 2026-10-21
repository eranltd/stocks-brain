/**
 * i18n: the site's small homegrown translation core (no library). Pure JavaScript, no React, so lib/ functions and the
 * node tests can use it directly. React components get the same things from useLang() in lib/lang.jsx.
 *
 * LANGUAGES
 *   LANGS = ["en", "he"]; DEFAULT_LANG = "en"; LANG_KEY = "sb:lang" (localStorage key of a choice made with the switch).
 *   detectLang(storage, navigatorLanguages) -> "en" | "he": a remembered choice first, else the device's first language
 *     ("he…" -> Hebrew), else English. Both arguments may be missing or throw; it never throws.
 *   saveLang(storage, lang): remember a choice (silently does nothing without storage).
 *   dirOf(lang) -> "ltr" | "rtl"; localeOf(lang) -> the Intl locale ("en-GB" / "he-IL").
 *
 * DICTIONARIES (one file per area in site/src/i18n/, each `export default { en: {...}, he: {...} }`, identical keys)
 *   A value is a string with {name} placeholders, or a plural object { zero?, one, two?, other } picked by vars.count
 *   (Hebrew uses "two" for 2 when given: "יומיים"; "zero" is optional in both languages; "other" is required).
 *   pluralForm(lang, n) and plural(lang, n, forms) do the same for code outside a dictionary.
 *
 *   const t = translate(dict, lang);
 *   t("key")                       -> the string
 *   t("key", { name: "AAA" })      -> "{name}" filled in. In Hebrew every filled-in value is wrapped in Unicode
 *                                     isolation marks (FSI…PDI), so tickers, numbers and percents inside a Hebrew
 *                                     sentence keep their own direction ("+4.1%" never turns into "4.1%+").
 *   t("days", { count: 3 })        -> the plural form for 3, with {count} filled in.
 *   t("key", vars, { bidi: false })-> no isolation marks (rarely needed: a value that is itself a whole Hebrew clause).
 *   t.parts("key", vars)           -> an array of the text pieces and the raw values (for rich text; lang.jsx's
 *                                     t.rich turns it into React nodes, so a value may be a <strong> element).
 *   t.has("key"), t.lang
 *   A missing Hebrew key falls back to the English text (and warns once in dev); a key missing in both returns the key
 *   itself in [brackets] so it is easy to spot on the page.
 *
 * FORMATTERS (English output is exactly what lib/format.js always printed)
 *   formatters(lang) -> { num(v, d=2), pct(v, d=2), usd(v), k(v), date(iso), short(iso), rel(iso, ref?), numWord(n),
 *                         list(items) }
 *   or the same functions one by one with lang last: fmtNum(v, d, lang), fmtPct(v, d, lang), fmtDate(iso, lang)…
 *   In Hebrew, numbers, percents, money and "1.2k" come wrapped in left-to-right isolation (LRI…PDI) so they read the
 *   same inside a right-to-left line; dates use Hebrew month and weekday names (Intl "he-IL"). Dates are read as
 *   calendar days in UTC, exactly as before (a "YYYY-MM-DD" market day stays that New York trading day).
 *   stripBidi(s) removes the isolation marks (for tests and comparisons).
 */

export const LANGS = ["en", "he"];
export const DEFAULT_LANG = "en";
export const LANG_KEY = "sb:lang";

export const isLang = (x) => LANGS.includes(x);
export const dirOf = (lang) => (lang === "he" ? "rtl" : "ltr");
export const localeOf = (lang) => (lang === "he" ? "he-IL" : "en-GB");

/** A choice remembered on this device, or null (storage may be missing, blocked or throw). */
export function readLang(storage) {
  try {
    const v = storage?.getItem?.(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(storage, lang) {
  if (!isLang(lang)) return;
  try { storage?.setItem?.(LANG_KEY, lang); } catch { /* private mode or blocked storage: the choice lasts this visit */ }
}

/** The device's preferred language: Hebrew when its first language is Hebrew ("he", "he-IL"; old "iw" too). */
export function deviceLang(navigatorLanguages) {
  try {
    const list = Array.isArray(navigatorLanguages) ? navigatorLanguages : navigatorLanguages ? [navigatorLanguages] : [];
    const first = String(list[0] ?? "").toLowerCase();
    return /^(he|iw)(-|_|$)/.test(first) ? "he" : "en";
  } catch {
    return DEFAULT_LANG;
  }
}

/** First visit follows the device; a choice made with the switch wins after that. */
export function detectLang(storage, navigatorLanguages) {
  return readLang(storage) ?? deviceLang(navigatorLanguages);
}

/* ---------------------------------------------------------------- bidi */

export const HEBREW = /[֐-׿יִ-ﭏ]/;
export const hasHebrew = (s) => HEBREW.test(String(s ?? ""));
const LRI = "⁦", FSI = "⁨", PDI = "⁩";
/**
 * Isolate a value whose direction should come from its own first letter (tickers, names, mixed text). A value with no
 * letter at all ("+4", "-3.0", "8%", "2026-10-20") is isolated left to right: browsers resolve a letterless first-strong
 * isolate to the page's direction, which would show "+4" as "4+" in a Hebrew page.
 */
export const isolate = (s) => (/\p{L}/u.test(String(s)) ? FSI : LRI) + String(s) + PDI;
/** Isolate a value that always reads left to right (numbers, percents, money). */
export const ltr = (s) => LRI + String(s) + PDI;
export const stripBidi = (s) => String(s).replace(/[⁦-⁩‎‏]/g, "");

/* -------------------------------------------------------- translation */

const PLURAL_FORMS = ["zero", "one", "two", "other"];
const isPlural = (v) => v != null && typeof v === "object" && !Array.isArray(v) && typeof v.other === "string";
const rules = { en: new Intl.PluralRules("en"), he: new Intl.PluralRules("he") };

/** "zero" | "one" | "two" | "other" for a count, by the language's rules ("two" only exists in Hebrew). */
export function pluralForm(lang, n) {
  return (rules[lang] ?? rules.en).select(Math.abs(Number(n)));
}

/** Pick the right form of { zero?, one, two?, other } for n: "zero" for 0 when given, else the language's rule, else
 *  "other" (so an English object without "two" still works for 2, and an engine that says "many" gets "other"). */
export function plural(lang, n, forms) {
  if (Number(n) === 0 && forms.zero != null) return forms.zero;
  return forms[pluralForm(lang, n)] ?? forms.other;
}

const PH = /\{(\w+)\}/g;
/** Placeholder names in a template ({name} -> "name"), in order. */
export const placeholders = (s) => [...String(s).matchAll(PH)].map((m) => m[1]);

/** Split a template into text and values: ["Up ", 4.1, " today"]. A missing value leaves the {name} visible. */
function split(template, vars, wrap) {
  const out = [];
  let last = 0;
  for (const m of template.matchAll(PH)) {
    if (m.index > last) out.push(template.slice(last, m.index));
    const has = vars && Object.prototype.hasOwnProperty.call(vars, m[1]) && vars[m[1]] != null;
    out.push(has ? wrap(vars[m[1]]) : m[0]);
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

/** Fill {name} placeholders. In Hebrew each value is isolated (see the top of the file) unless bidi is false. */
export function interpolate(template, vars, lang = DEFAULT_LANG, { bidi = true } = {}) {
  const wrap = (v) => (lang === "he" && bidi && (typeof v === "string" || typeof v === "number") ? isolate(v) : String(v));
  return split(String(template), vars, wrap).join("");
}

const isDev = () => {
  try { return Boolean(import.meta.env?.DEV); } catch { return false; }
};
const warned = new Set();
function warnOnce(msg) {
  if (!isDev() || warned.has(msg)) return;
  warned.add(msg);
  console.warn(`[i18n] ${msg}`);
}

/** The text for a key in a language: the language's own, else English (dev warning), else null. */
function lookup(dict, lang, key) {
  const own = dict?.[lang]?.[key];
  if (own != null) return own;
  const en = dict?.en?.[key];
  if (en != null) { if (lang !== "en") warnOnce(`missing ${lang} text for "${key}" (showing English)`); return en; }
  warnOnce(`missing key "${key}"`);
  return null;
}

/** t(key, vars, opts) for one dictionary and language (see the top of the file). */
export function translate(dict, lang = DEFAULT_LANG) {
  const L = isLang(lang) ? lang : DEFAULT_LANG;
  const pick = (key, vars) => {
    const v = lookup(dict, L, key);
    if (v == null) return `[${key}]`;
    if (isPlural(v)) return plural(L, Number(vars?.count) || 0, v);
    return String(v);
  };
  const t = (key, vars, opts) => interpolate(pick(key, vars), vars, L, opts);
  t.parts = (key, vars, { bidi = true } = {}) => split(pick(key, vars), vars, (v) =>
    L === "he" && bidi && (typeof v === "string" || typeof v === "number") ? isolate(v) : v);
  t.has = (key) => dict?.[L]?.[key] != null || dict?.en?.[key] != null;
  t.lang = L;
  return t;
}

/** Every problem in an area dictionary (used by i18n.test.js): missing keys, empty texts, placeholder mismatches. */
export function dictProblems(dict, { latinOk = [] } = {}) {
  const errs = [];
  const en = dict?.en ?? {}, he = dict?.he ?? {};
  const forms = (v) => (isPlural(v) ? PLURAL_FORMS.filter((f) => v[f] != null).map((f) => v[f]) : [v]);
  for (const k of Object.keys(en)) if (!(k in he)) errs.push(`he is missing "${k}"`);
  for (const k of Object.keys(he)) if (!(k in en)) errs.push(`en is missing "${k}"`);
  for (const [lang, d] of [["en", en], ["he", he]]) {
    for (const [k, v] of Object.entries(d)) {
      if (typeof v !== "string" && !isPlural(v)) { errs.push(`${lang}.${k} is neither a string nor a plural object`); continue; }
      if (isPlural(v)) for (const f of Object.keys(v)) if (!PLURAL_FORMS.includes(f)) errs.push(`${lang}.${k} has an unknown plural form "${f}"`);
      for (const s of forms(v)) {
        if (typeof s !== "string" || !s.trim()) errs.push(`${lang}.${k} is empty`);
        else if (lang === "en" && hasHebrew(s)) errs.push(`en.${k} contains Hebrew letters`);
        else if (lang === "he" && !hasHebrew(s) && !latinOk.includes(k)) errs.push(`he.${k} has no Hebrew letters`);
      }
    }
  }
  for (const k of Object.keys(en)) {
    if (!(k in he)) continue;
    if (isPlural(en[k]) !== isPlural(he[k])) { errs.push(`"${k}" is a plural in one language only`); continue; }
    const set = (v) => [...new Set(forms(v).flatMap((s) => (typeof s === "string" ? placeholders(s) : [])))].sort().join(",");
    if (set(en[k]) !== set(he[k])) errs.push(`"${k}" placeholders differ: en {${set(en[k])}} he {${set(he[k])}}`);
  }
  return errs;
}

/* ---------------------------------------------------------- formatters */

const parse = (iso) => new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
const DATE = {
  en: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
  he: new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
};
const SHORT = {
  en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
  he: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "UTC" }),
};
const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const he = (lang) => lang === "he";

/** "Fri, 16 Oct 2026" / "יום ו׳, 16 באוקטובר 2026". */
export const fmtDate = (iso, lang = DEFAULT_LANG) => (DATE[lang] ?? DATE.en).format(parse(iso));
/** "16 Oct" / "16 באוק׳". */
export const fmtShort = (iso, lang = DEFAULT_LANG) => (SHORT[lang] ?? SHORT.en).format(parse(iso));
/** "$1,234.50" (US dollars read the same in both languages). */
export const fmtUsd = (v, lang = DEFAULT_LANG) => (he(lang) ? ltr(usdFmt.format(v)) : usdFmt.format(v));
/** "1,234.57": the same digits and separators in both languages. */
export const fmtNum = (v, d = 2, lang = DEFAULT_LANG) => {
  const s = v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  return he(lang) ? ltr(s) : s;
};
/** "+4.10%", "−4.10%" (a true minus sign) or "0.00%" when it rounds to zero; sign first in both languages. */
export const fmtPct = (v, d = 2, lang = DEFAULT_LANG) => {
  const r = Math.abs(v).toFixed(d);
  const z = Number(r) === 0;
  const s = `${z ? "" : v > 0 ? "+" : "−"}${r}%`;
  return he(lang) ? ltr(s) : s;
};
export const fmtK = (v, lang = DEFAULT_LANG) => {
  const s = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
  return he(lang) ? ltr(s) : s;
};

const REL = {
  en: { today: "today", yesterday: "yesterday", days: (n) => `${n} days ago` },
  he: { today: "היום", yesterday: "אתמול", days: (n) => (n === 2 ? "לפני יומיים" : `לפני ${n} ימים`) },
};
/** "today", "yesterday", "8 days ago", then a short date (UTC calendar days). */
export function relDays(iso, ref = new Date(), lang = DEFAULT_LANG) {
  const w = REL[lang] ?? REL.en;
  const today = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  const days = Math.floor((today - parse(iso)) / 86400000);
  if (days <= 0) return w.today;
  if (days === 1) return w.yesterday;
  if (days < 30) return w.days(days);
  return fmtShort(iso, lang);
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
/** English sentence-start words ("Three"); Hebrew number words depend on the noun's gender, so Hebrew gets digits. */
export const numWord = (n, lang = DEFAULT_LANG) => (he(lang) ? String(n) : WORDS[n] ?? String(n));

const LISTS = {};
/** "A, B and C" / "A, B ו-C". */
export function fmtList(items, lang = DEFAULT_LANG) {
  const L = isLang(lang) ? lang : DEFAULT_LANG;
  LISTS[L] ??= new Intl.ListFormat(L === "he" ? "he" : "en-GB", { style: "long", type: "conjunction" });
  return LISTS[L].format(items.map(String));
}

/** All formatters bound to one language (useLang() gives this as `fmt`). */
export function formatters(lang = DEFAULT_LANG) {
  const L = isLang(lang) ? lang : DEFAULT_LANG;
  return {
    lang: L,
    num: (v, d = 2) => fmtNum(v, d, L),
    pct: (v, d = 2) => fmtPct(v, d, L),
    usd: (v) => fmtUsd(v, L),
    k: (v) => fmtK(v, L),
    date: (iso) => fmtDate(iso, L),
    short: (iso) => fmtShort(iso, L),
    rel: (iso, ref = new Date()) => relDays(iso, ref, L),
    numWord: (n) => numWord(n, L),
    list: (items) => fmtList(items, L),
  };
}
