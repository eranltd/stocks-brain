// The Stocks page's ARENA view, "the floor" (components/floor.jsx): one square per name that replays the last trading
// days again and again. Pure functions, no React; tested in floor.test.js. Day moves in percent from the published
// indexed closes, never prices.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Trading days the floor loops through, the bars each square's tape shows, the pace and the pause on the last day. */
export const LOOP_DAYS = 30;
export const TAPE = 16;
export const FLOOR_DAY_MS = 700;
export const HOLD_MS = 2000;

/**
 * The floor's days and squares. rows: [{symbol, name, series: [{date, v}], call?}]. The dates are the longest series'
 * last `days + tape + 1` closes: the loop runs over the last `days` of them, and each square's tape also shows the `tape`
 * days before. Each tile: {symbol, name, call, moves (day moves, oldest first; null where a
 * close is missing; `days + tape` of them), scale (the biggest move, for the tape's bar heights)}. Returns {loopDates, tiles} or null.
 */
export function floorData(rows, { days = LOOP_DAYS, tape = TAPE } = {}) {
  const usable = (rows ?? []).filter((r) => Array.isArray(r?.series) && r.series.length > 2);
  if (!usable.length) return null;
  const ref = usable.reduce((a, b) => (b.series.length > a.series.length ? b : a));
  const dates = ref.series.map((p) => p.date).slice(-(days + tape + 1));
  if (dates.length < 3) return null;
  // Short series: the loop keeps its days first; the tape gets what is left.
  const front = Math.max(0, Math.min(tape, dates.length - 1 - Math.min(days, dates.length - 1)));
  const tiles = usable.map((r) => {
    const at = new Map(r.series.map((p) => [p.date, p.v]));
    const moves = dates.slice(1).map((d, i) => {
      const a = at.get(dates[i]), b = at.get(d);
      return isNum(a) && isNum(b) && a > 0 ? (b / a - 1) * 100 : null;
    });
    const scale = Math.max(0.5, ...moves.filter(isNum).map(Math.abs));
    return { symbol: r.symbol, name: r.name ?? r.symbol, call: r.call ?? null, moves, scale };
  });
  return { loopDates: dates.slice(front + 1), tape: front, tiles };
}

/** A square's move on loop day k (0 = the first day of the loop). */
export const moveAt = (tile, k, tape) => tile.moves[k + tape] ?? null;

/** How many squares went up and down on loop day k. */
export function floorBreadth(tiles, k, tape) {
  let up = 0, down = 0;
  for (const t of tiles ?? []) {
    const m = moveAt(t, k, tape);
    if (!isNum(m)) continue;
    if (m > 0) up++; else if (m < 0) down++;
  }
  return { up, down };
}
