import { strings } from "./text.js";
import text from "../text/shell.js";

// The site's menu: Today, the Brain's verdicts (one page, always one tap), Experiments and Learn, each opening into its pages, and the hash routes behind
// them. Pure functions, no React; tested in nav.test.js. Every old route keeps working (#insights still opens Lessons),
// and a market other than the default rides along in the hash (#today?m=tlv) so a link opens the same view.

/** The menu's shape: subjects in order, each with its pages (routes); the words live in text/shell.js ("nav.*"). */
const MENU = [
  { id: "today", pages: ["today", "watchlist", "details", "people", "arena"] },
  // One page, always one tap: what the daily brain decided, told simply. The bar shows it as its own tab.
  { id: "verdicts", direct: "verdicts", short: true, pages: ["verdicts"] },
  { id: "plan", pages: ["portfolio", "playbook", "track"] },
  { id: "learn", pages: ["insights", "quiz", "kb", "learnings", "how", { route: "runs", group: "behind" }, { route: "routines", group: "behind" }, { route: "admin", group: "behind" }] },
];

const t = strings(text);

/** The subjects in menu order; each page has a route (the hash), a label and a one-line "what's this". */
export const SUBJECTS = MENU.map((m) => ({
  id: m.id,
  label: t(`nav.s.${m.id}`),
  ...(m.short ? { short: t(`nav.s.${m.id}.short`) } : {}),
  ...(m.direct ? { direct: m.direct } : {}),
  what: t(`nav.s.${m.id}.what`),
  pages: m.pages.map((p) => {
    const { route, group } = typeof p === "string" ? { route: p } : p;
    return { route, label: t(`nav.p.${route}`), what: t(`nav.p.${route}.what`), ...(group ? { group } : {}) };
  }),
}));

export const GROUP_LABEL = { behind: t("nav.group.behind") };

/** Every page route, in menu order. */
export const ROUTES = SUBJECTS.flatMap((s) => s.pages.map((p) => p.route));

const STOCK = /^stock\/[A-Z][A-Z0-9.\-]{0,9}$/;
const MARKET_ID = /^[a-z0-9_-]{1,24}$/;

/** True for a page route or a stock page ("stock/NVDA"). */
export const isRoute = (r) => typeof r === "string" && (ROUTES.includes(r) || STOCK.test(r));

/** The menu entry of a route; a stock page belongs to Stocks. Null for an unknown route. */
export function pageOf(route) {
  const r = typeof route === "string" && route.startsWith("stock/") ? "watchlist" : route;
  for (const s of SUBJECTS) {
    const p = s.pages.find((x) => x.route === r);
    if (p) return { ...p, subject: s.id };
  }
  return null;
}

/** The subject a route sits under (a stock page is under Today, with Stocks); "today" for anything unknown. */
export const subjectOf = (route) => pageOf(route)?.subject ?? "today";

/** A subject's pages in groups for its menu: the main pages first (label null), then "Behind the scenes". */
export function menuGroups(subjectId) {
  const s = SUBJECTS.find((x) => x.id === subjectId);
  if (!s) return [];
  const out = [];
  for (const p of s.pages) {
    const id = p.group ?? "main";
    let g = out.find((x) => x.id === id);
    if (!g) out.push((g = { id, label: id === "main" ? null : GROUP_LABEL[id] ?? null, pages: [] }));
    g.pages.push(p);
  }
  return out.sort((a, b) => (a.id === "main" ? -1 : b.id === "main" ? 1 : 0));
}

/**
 * What a tap on a phone's bottom-bar subject does: Today goes straight Home from another subject (Home stays one tap);
 * tapping the subject you are already in, or Experiments or Learn, opens its sheet.
 */
export function bottomTap(subjectId, route) {
  const direct = SUBJECTS.find((s) => s.id === subjectId)?.direct;
  if (direct) return { go: direct };
  if (subjectId === "today" && subjectOf(route) !== "today") return { go: "today" };
  return { sheet: subjectId };
}

/** {route, market} from a location hash ("#today?m=tlv", "#stock/TEVA?m=tlv", "#insights"). Unknown routes open Home;
 * the market is a raw id (checked against the published markets by the caller) or null. */
export function parseHash(hash) {
  let raw = String(hash ?? "").replace(/^#/, "");
  try { raw = decodeURIComponent(raw); } catch { /* a malformed hash: read it as it is */ }
  const q = raw.indexOf("?");
  const path = q < 0 ? raw : raw.slice(0, q);
  const m = q < 0 ? null : new URLSearchParams(raw.slice(q + 1)).get("m");
  return { route: isRoute(path) ? path : "today", market: m && MARKET_ID.test(m) ? m : null };
}

/** The hash for a route in a market; the default market is left out, so old links and new ones look the same. */
export function hashFor(route, market = null, defaultMarket = "nasdaq") {
  return `#${route}${market && market !== defaultMarket ? `?m=${market}` : ""}`;
}
