// Two ways to use the site: a two-minute read for anyone in a hurry, and rabbit holes for anyone with twenty minutes.
// Pure functions, no React; tested in explore.test.js. Curiosity, not tricks: every hole is a real question the site
// can answer honestly, with a rough reading time.

/**
 * The rabbit holes. `to` is a route, with an optional "#section"; "stock" asks for the stock of the day (chosen from
 * the data, so no ticker is written in code). Minutes are rough reading times.
 */
export const HOLES = [
  { id: "people", q: "Did famous investors beat the market with the calls we followed?", to: "people", minutes: 5 },
  { id: "weekly", q: "Who is winning the weekly game this week?", to: "verdicts#this-week", minutes: 2 },
  { id: "right", q: "Has the brain been right so far?", to: "track", minutes: 3 },
  { id: "candles", q: "Can you spot a hammer or a shooting star? Zoom into a real chart.", to: "stock#checklist", minutes: 4 },
  { id: "news", q: "What did one of our companies tell regulators lately?", to: "stock#official-news", minutes: 3 },
  { id: "rules", q: "Does buying every week beat buying every month? See the test.", to: "playbook", minutes: 6 },
  { id: "stocks", q: "Which of our stocks had the wildest month?", to: "watchlist", minutes: 4 },
  { id: "lessons", q: "What did the books and videos we read actually teach?", to: "insights", minutes: 8 },
  { id: "mistakes", q: "What did our own results teach us, with proof?", to: "learnings", minutes: 5 },
  { id: "machine", q: "How does a robot brain read the market every morning?", to: "how", minutes: 6 },
];

const routeOf = (to) => to.split("#")[0];

/** The stock of the day for "stock" holes: the first name the pretend portfolio holds, else the first on the list. */
export function stockOfDay(data) {
  const h = data?.paper?.rebalances?.at(-1)?.holdings?.[0];
  const held = typeof h === "string" ? h : h?.symbol ?? null;
  return held ?? data?.watchlist?.symbols?.[0]?.symbol ?? null;
}

/** A hole's real target route ("stock" filled in), or null when it cannot be opened. */
export function targetOf(hole, stock) {
  if (!hole.to.startsWith("stock")) return hole.to;
  return stock ? hole.to.replace(/^stock/, `stock/${stock}`) : null;
}

/** Three holes to show at the end of a page: none from the page itself, rotated by day so it changes daily. */
export function nextFor(route, day = 0, n = 3, holes = HOLES) {
  const here = typeof route === "string" && route.startsWith("stock/") ? "stock" : route;
  const pool = holes.filter((h) => routeOf(h.to) !== here);
  if (!pool.length) return [];
  const start = ((day % pool.length) + pool.length) % pool.length;
  return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
}

/** The total reading time of the holes, in minutes. */
export const totalMinutes = (holes = HOLES) => holes.reduce((a, h) => a + h.minutes, 0);

/** A day number for rotation (days since the epoch, UTC). */
export const dayNumber = (iso) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 864e5);
