// The site's menu: three subjects (Today, Our plan, Learn), each opening into its pages, and the hash routes behind
// them. Pure functions, no React; tested in nav.test.js. Every old route keeps working (#insights still opens Lessons),
// and a market other than the default rides along in the hash (#today?m=tlv) so a link opens the same view.

/** The subjects in menu order; each page has a route (the hash), a label and a one-line "what's this". */
export const SUBJECTS = [
  {
    id: "today",
    label: "Today",
    what: "The day in plain words, our stocks and the market.",
    pages: [
      { route: "today", label: "Home", what: "The day in plain words; the Details switch shows the live feed." },
      { route: "watchlist", label: "Stocks", what: "Every name on the chosen list, with its last few weeks." },
      { route: "details", label: "Market details", what: "The full dashboard: the market's day, the brain's call and the numbers." },
      { route: "people", label: "People we learn from", what: "Investors we follow, and how their public calls have done." },
    ],
  },
  {
    id: "plan",
    label: "Our plan",
    what: "What we hold on paper, the rules we follow and how it has gone.",
    pages: [
      { route: "portfolio", label: "Portfolio", what: "The practice portfolio on paper: what it holds and why." },
      { route: "playbook", label: "Our rules", what: "The house rules and plans, each tested on past prices." },
      { route: "track", label: "Track record", what: "How the daily brain's calls turned out, scored by code." },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    what: "Lessons, the library and how the site works.",
    pages: [
      { route: "insights", label: "Lessons", what: "Lasting lessons from the videos and articles we read, each with its source." },
      { route: "kb", label: "Library", what: "Every call the daily brain has made, and how each one ended." },
      { route: "learnings", label: "What we learned", what: "Lessons from our own scored results, each with its evidence." },
      { route: "how", label: "How it works", what: "How the data, the daily brain and the checks fit together." },
      { route: "runs", label: "Runs", what: "Each daily brain run, on the record.", group: "behind" },
      { route: "routines", label: "Routines", what: "What runs by itself, when, and what it writes.", group: "behind" },
      { route: "admin", label: "Admin", what: "The files the brain reads, and how to change them.", group: "behind" },
    ],
  },
];

export const GROUP_LABEL = { behind: "Behind the scenes" };

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
    if (!g) out.push((g = { id, label: GROUP_LABEL[id] ?? null, pages: [] }));
    g.pages.push(p);
  }
  return out.sort((a, b) => (a.id === "main" ? -1 : b.id === "main" ? 1 : 0));
}

/**
 * What a tap on a phone's bottom-bar subject does: Today goes straight Home from another subject (Home stays one tap);
 * tapping the subject you are already in, or Our plan or Learn, opens its sheet.
 */
export function bottomTap(subjectId, route) {
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
