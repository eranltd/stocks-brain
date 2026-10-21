/**
 * The language of the page for React: a provider, a hook and three small helpers. The pure parts (translate, the
 * formatters, plural rules, detection) are in lib/i18n.js; read the top of that file first.
 *
 *   <LangProvider> (wraps the app in main.jsx): picks the first language (a remembered choice, else the device's),
 *     keeps <html lang dir> in step, and remembers a choice made with the switch (localStorage "sb:lang"; the site
 *     works without storage).
 *
 *   const { lang, dir, he, setLang, t, fmt } = useLang();
 *     lang  "en" | "he";  dir "ltr" | "rtl";  he  true in Hebrew;  setLang("he")  (the header switch uses it)
 *     t(dict) -> the translate function for one area dictionary (cached, so it is stable between renders):
 *         import dict from "../i18n/home.js";
 *         const { t: tr, fmt } = useLang(); const t = tr(dict);
 *         t("title"); t("rose", { pct: fmt.pct(4.1, 1) }); t("days", { count: 3 });
 *         t.rich("lead", { name: <strong>AAA</strong> })  -> React nodes (values may be elements)
 *     fmt   the formatters bound to the language: fmt.num, fmt.pct, fmt.usd, fmt.k, fmt.date, fmt.short, fmt.rel,
 *           fmt.numWord, fmt.list (see lib/i18n.js).
 *   const t = useT(dict)   the same as useLang().t(dict), when that is all a component needs.
 *
 *   A pure lib function that writes sentences takes `lang` as its last argument (default "en", so tests and old
 *   callers keep English) and builds its own: `const t = translate(dict, lang)`; formatters: fmtPct(v, 1, lang).
 *
 *   <Bdi>{ticker or number}</Bdi>  inline isolation for a ticker, number or name sitting inside a sentence (needed
 *     around JSX values; t() already isolates the values it fills in).
 *   <En>…</En>  a block of English that comes from data (company cards, the brain's letters, why notes, docs): rendered
 *     lang="en" dir="ltr" so it reads correctly inside a Hebrew page. <En as="span"> for inline text; <En note> puts
 *     the one-line "written in English for now" note above it in Hebrew (once per area, not on every card).
 *   <Auto>…</Auto>  text that may be either language (a name, a title from data): dir="auto".
 *   <EnglishNote />  just the note (shows only in Hebrew).
 *   <Ltr>…</Ltr>  a left-to-right island for charts, candles and any time or value axis (time runs left to right in
 *     Hebrew finance pages too). Charts already sit in one; use it for any new chart.
 */
import { createContext, createElement, Fragment, isValidElement, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, detectLang, dirOf, formatters, saveLang, translate } from "./i18n.js";
import shell from "../i18n/shell.js";

const safeStorage = () => {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
};
const navLanguages = () => {
  try { return typeof navigator !== "undefined" ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : []; } catch { return []; }
};

/** Bind translate() to a language and add t.rich for React. Cached per dictionary and language. */
const cache = { en: new WeakMap(), he: new WeakMap() };
function bound(dict, lang) {
  const m = cache[lang] ?? cache.en;
  let t = m.get(dict);
  if (!t) {
    t = translate(dict, lang);
    t.rich = (key, vars, opts) => createElement(Fragment, null, ...t.parts(key, vars, opts).map((p) =>
      lang === "he" && isValidElement(p) ? createElement("bdi", null, p) : p));
    m.set(dict, t);
  }
  return t;
}

function value(lang, setLang) {
  return { lang, dir: dirOf(lang), he: lang === "he", setLang, t: (dict) => bound(dict, lang), fmt: formatters(lang) };
}

const LangContext = createContext(value(DEFAULT_LANG, () => {}));

export function LangProvider({ children, initial }) {
  const [lang, setState] = useState(() => initial ?? detectLang(safeStorage(), navLanguages()));
  const setLang = useCallback((next) => { saveLang(safeStorage(), next); setState(next); }, []);
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = dirOf(lang);
  }, [lang]);
  const v = useMemo(() => value(lang, setLang), [lang, setLang]);
  return <LangContext.Provider value={v}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = (dict) => useContext(LangContext).t(dict);

/* --------------------------------------------------------------- helpers */

/** Inline isolation for a ticker, number or name inside a sentence. */
export const Bdi = ({ children, className }) => <bdi className={className}>{children}</bdi>;

/** Text that may be in either language (a name or title from data): its own first letter sets its direction. */
export function Auto({ as: Tag = "span", children, ...rest }) {
  return <Tag dir="auto" {...rest}>{children}</Tag>;
}

/** The one-line note above English content, in Hebrew only (its text is "englishNote" in i18n/shell.js). */
export function EnglishNote({ className = "" }) {
  const { lang, t } = useLang();
  if (lang !== "he") return null;
  return <p className={`mb-2 text-[13.5px] leading-snug text-ink-3 ${className}`}>{t(shell)("englishNote")}</p>;
}

/** A block of English from data, kept left to right inside a Hebrew page. */
export function En({ as: Tag = "div", note = false, className, children, ...rest }) {
  const el = <Tag lang="en" dir="ltr" className={className} {...rest}>{children}</Tag>;
  if (!note) return el;
  return <><EnglishNote />{el}</>;
}

/** A left-to-right island: charts, candles, time and value axes. */
export function Ltr({ as: Tag = "div", children, ...rest }) {
  return <Tag dir="ltr" {...rest}>{children}</Tag>;
}
