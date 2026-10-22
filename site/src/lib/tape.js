// The ticker tape under the header (components/shell.jsx TickerTape): the main list's day moves, in the list's order.
// Percent changes only: no price and no raw volume ever leaves this file. Pure functions, no React; tested in tape.test.js.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * One item per name on the main list that has a day move in the market numbers (derived.json `change_1d_pct`):
 * [{ticker, name, move}], in `members` order. Names without a move are left out.
 */
export function tapeItems({ market = null, members = [], names = {} } = {}) {
  const rows = Object.fromEntries((market?.symbols ?? []).map((s) => [s.symbol, s]));
  return members
    .filter((ticker) => isNum(rows[ticker]?.change_1d_pct))
    .map((ticker) => ({ ticker, name: names[ticker] ?? ticker, move: rows[ticker].change_1d_pct }));
}

/** Seconds for one full pass of the marquee: a steady reading pace whatever the list's length (at least 20 s). */
export const tapeSeconds = (n) => Math.max(20, Math.round(n * 3.2));
