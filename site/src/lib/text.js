/**
 * The site's texts. Each area's English texts sit in site/src/text/ (shell, home, stock, plan, learn), one plain table per
 * file, and strings(table) gives the function that reads them. Pure JavaScript, no React, so lib/ functions and the node
 * tests use it directly; components turn rich texts into React nodes with rich() in lib/rich.jsx.
 *
 *   const t = strings(table);
 *   t("key")                   -> the text
 *   t("key", { name: "AAA" })  -> "{name}" filled in (a missing value leaves "{name}" visible)
 *   t("days", { count: 3 })    -> the plural form for 3, with {count} filled in. A plural text is { zero?, one, other }:
 *                                 "zero" for 0 when given, "one" for 1, "other" for the rest.
 *   t.parts("key", vars)       -> the text pieces and the raw values in order, for rich text (a value may be an element)
 *   t.has("key")
 * A key that is missing returns itself in [brackets] (with a warning in dev), so it is easy to spot on the page. The
 * same table always gives the same function, so it is safe in a React hook's dependency list.
 */

const isPlural = (v) => v != null && typeof v === "object" && !Array.isArray(v) && typeof v.other === "string";
const rules = new Intl.PluralRules("en");

/** Pick the form of { zero?, one, other } for n ("zero" only when given). */
export function plural(n, forms) {
  if (Number(n) === 0 && forms.zero != null) return forms.zero;
  return forms[rules.select(Math.abs(Number(n)))] ?? forms.other;
}

const PH = /\{(\w+)\}/g;
/** Placeholder names in a text ({name} -> "name"), in order. */
export const placeholders = (s) => [...String(s).matchAll(PH)].map((m) => m[1]);

/** Split a text into pieces and values: ["Up ", 4.1, " today"]. A missing value leaves the {name} visible. */
function split(text, vars) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(PH)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const has = vars && Object.prototype.hasOwnProperty.call(vars, m[1]) && vars[m[1]] != null;
    out.push(has ? vars[m[1]] : m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Fill {name} placeholders. */
export const interpolate = (text, vars) => split(String(text), vars).map(String).join("");

const isDev = () => {
  try { return Boolean(import.meta.env?.DEV); } catch { return false; }
};
const warned = new Set();
function warnOnce(key) {
  if (!isDev() || warned.has(key)) return;
  warned.add(key);
  console.warn(`[text] missing key "${key}"`);
}

const cache = new WeakMap();
/** t(key, vars) for one table (see the top of the file). */
export function strings(table) {
  let t = cache.get(table);
  if (t) return t;
  const pick = (key, vars) => {
    const v = table?.[key];
    if (v == null) { warnOnce(key); return `[${key}]`; }
    return isPlural(v) ? plural(Number(vars?.count) || 0, v) : String(v);
  };
  t = (key, vars) => interpolate(pick(key, vars), vars);
  t.parts = (key, vars) => split(pick(key, vars), vars);
  t.has = (key) => table?.[key] != null;
  cache.set(table, t);
  return t;
}

/** Every problem in a table (used by text.test.js): a value that is neither a text nor a plural, or an empty one. */
export function tableProblems(table) {
  const errs = [];
  for (const [k, v] of Object.entries(table ?? {})) {
    if (typeof v !== "string" && !isPlural(v)) { errs.push(`${k} is neither a string nor a plural object`); continue; }
    if (isPlural(v)) for (const f of Object.keys(v)) if (!["zero", "one", "other"].includes(f)) errs.push(`${k} has an unknown plural form "${f}"`);
    for (const s of isPlural(v) ? Object.values(v) : [v]) if (typeof s !== "string" || !s.trim()) errs.push(`${k} is empty`);
  }
  return errs;
}
