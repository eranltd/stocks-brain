// Two ways to use the site: a two-minute read for anyone in a hurry, and rabbit holes for anyone with twenty minutes.
// Pure functions, no React; tested in explore.test.js. Curiosity, not tricks: every hole is a real question the site
// can answer honestly, with a rough reading time.

import { strings } from "./text.js";
import text from "../text/shell.js";

const t = strings(text);

/**
 * The rabbit holes. `to` is a route, with an optional "#section"; "stock" asks for the stock of the day (chosen from
 * the data, so no ticker is written in code). Minutes are rough reading times. `q` is the question (text/shell.js
 * "hole.<id>").
 */
const SHAPE = [
  { id: "people", to: "people", minutes: 5 },
  { id: "weekly", to: "verdicts#this-week", minutes: 2 },
  { id: "right", to: "track", minutes: 3 },
  { id: "quiz", to: "quiz", minutes: 5 },
  { id: "candles", to: "stock#checklist", minutes: 4 },
  { id: "news", to: "stock#official-news", minutes: 3 },
  { id: "rules", to: "playbook", minutes: 6 },
  { id: "stocks", to: "watchlist", minutes: 4 },
  { id: "lessons", to: "insights", minutes: 8 },
  { id: "mistakes", to: "learnings", minutes: 5 },
  { id: "machine", to: "how", minutes: 6 },
];
export const HOLES = SHAPE.map((h) => ({ id: h.id, q: t(`hole.${h.id}`), to: h.to, minutes: h.minutes }));

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
