// "Guess the candle": a real chart from a stock on the list with one notable candle marked. Round one: what kind of candle is
// it? Round two: did the next week end higher or lower? The score sits beside what plain luck would score, so the
// honest lesson shows itself. Pure functions, no React; tested in quiz.test.js. Every value is percent from the last
// close, as in the candle files, so no price is ever shown.

import { findSpots, SPOT_KINDS } from "./spots.js";
import { strings } from "./text.js";
import dict from "../text/learn.js";

export const BEFORE = 30; // candles shown before the marked one
export const AFTER = 5; // candles revealed after it (about a week)

/** A small seeded random number generator (mulberry32), so a round can be replayed in tests. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One question from a daily candle series: a notable candle with enough history before it and a week after it,
 * four answer choices (the right kind and three others), and what the next week did. Null when none fits.
 */
export function makeQuestion(daily, rand = Math.random) {
  if (!daily?.dates?.length) return null;
  const all = findSpots(daily).filter((s) => s.i >= BEFORE && s.i + AFTER < daily.dates.length);
  if (!all.length) return null;
  const spot = all[Math.floor(rand() * all.length)];
  const kinds = Object.keys(SPOT_KINDS).filter((k) => k !== spot.kind);
  const others = [];
  while (others.length < 3 && kinds.length) others.push(kinds.splice(Math.floor(rand() * kinds.length), 1)[0]);
  const choices = [spot.kind, ...others];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const c0 = daily.c[spot.i], c1 = daily.c[spot.i + AFTER];
  const move = ((100 + c1) / (100 + c0) - 1) * 100;
  return {
    i: spot.i, kind: spot.kind, date: daily.dates[spot.i],
    choices: choices.map((k) => ({ kind: k, title: SPOT_KINDS[k].title })),
    nextWeek: move >= 0 ? "higher" : "lower",
    from: spot.i - BEFORE, to: spot.i + 1, toAfter: spot.i + 1 + AFTER,
  };
}

/** The running score in words, beside what luck would get: a quarter on the candle name, half on the next week. */
export function scoreWords(score) {
  const t = strings(dict);
  const { kindRight = 0, kindTried = 0, weekRight = 0, weekTried = 0 } = score ?? {};
  if (!kindTried && !weekTried) return t("quiz.score.none");
  const parts = [];
  if (kindTried) parts.push(t("quiz.score.kind", { right: kindRight, tried: kindTried, luck: Math.round(kindTried / 4) }));
  if (weekTried) parts.push(t("quiz.score.week", { right: weekRight, tried: weekTried, luck: Math.round(weekTried / 2) }));
  return t("quiz.score.line", { parts: parts.join("; ") });
}
