// The demo trader agent: one plain weekly rule replayed on the real past year, so the site can show what a trading
// agent's feed looks like (buys and sells popping up, its paper money moving). It is a demo, not one of the tested
// rules in the playbook: paper money, past data, not a forecast, and the page says so. Pure functions; the Arena and
// the pop-up feed (components/agentfeed.jsx) read them.
import { BASKET } from "./arena.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** The demo rule: every AGENT_EVERY trading days, hold the AGENT_HOLD names that rose most over AGENT_LOOKBACK days. */
export const AGENT_START = BASKET;
export const AGENT_HOLD = 4;
export const AGENT_EVERY = 5;
export const AGENT_LOOKBACK = 20;

/**
 * The risk levels a reader can pick: how many names it spreads over, how often it moves, how far back it looks, and
 * how much of the money it puts in (the rest stays in cash). Medium is the plain rule above.
 */
export const AGENT_LEVELS = {
  easy: { hold: 6, every: 10, lookback: 40, invest: 0.6 },
  medium: { hold: AGENT_HOLD, every: AGENT_EVERY, lookback: AGENT_LOOKBACK, invest: 1 },
  hard: { hold: 2, every: 3, lookback: 10, invest: 1 },
};
export const LEVEL_IDS = ["easy", "medium", "hard"];
export const levelOf = (id) => AGENT_LEVELS[id] ?? AGENT_LEVELS.medium;

/** A line's level on day k (1 = where the window starts), from its percent-from-start values. */
const level = (line, k) => 1 + (line.values[Math.min(k, line.values.length - 1)] ?? 0) / 100;

/**
 * Replay the demo rule over a race window ({n, dates, lines: [{symbol, name, values: % from the first day]}). On day 0
 * it holds cash. On every AGENT_EVERY-th day (never the last) it ranks the names by their move over the last
 * AGENT_LOOKBACK days (fewer near the start), keeps the AGENT_HOLD best that rose, sells the rest, and splits the money
 * evenly into the new ones (only `invest` of it; the rest stays cash). Trades fill at that day's close. Returns {start, equity: dollars per day, trades:
 * [{day, side: "buy" | "sell", symbol, name, amount, rank (its place that day), move (the 20-day move for a buy), pnl (% for
 * a sell)}],
 * held: [{symbol, name, since, pnl}] at the end, wins, closed} or null.
 */
export function agentRun(race, { start = AGENT_START, hold = AGENT_HOLD, every = AGENT_EVERY, lookback = AGENT_LOOKBACK, invest = 1 } = {}) {
  if (!race?.lines?.length || !(race.n > 1)) return null;
  const bySym = new Map(race.lines.map((l) => [l.symbol, l]));
  let cash = start;
  const pos = new Map();
  const trades = [];
  const equity = new Array(race.n);
  const worth = (k) => [...pos].reduce((s, [sym, p]) => s + p.units * level(bySym.get(sym), k), 0);
  for (let k = 0; k < race.n; k++) {
    if (k > 0 && k % every === 0 && k < race.n - 1) {
      const back = Math.max(0, k - lookback);
      const ranked = race.lines
        .map((l, i) => ({ l, i, m: (level(l, k) / level(l, back) - 1) * 100 }))
        .filter((r) => isNum(r.m))
        .sort((a, b) => b.m - a.m || a.i - b.i);
      const rankOf = (sym) => ranked.findIndex((r) => r.l.symbol === sym) + 1;
      const top = ranked.slice(0, hold).filter((r) => r.m > 0);
      const want = new Set(top.map((r) => r.l.symbol));
      for (const [sym, p] of [...pos]) {
        if (want.has(sym)) continue;
        const value = p.units * level(bySym.get(sym), k);
        cash += value;
        trades.push({ day: k, side: "sell", symbol: sym, name: bySym.get(sym).name, amount: value, pnl: (value / p.cost - 1) * 100, rank: rankOf(sym) });
        pos.delete(sym);
      }
      const fresh = top.filter((r) => !pos.has(r.l.symbol));
      const each = fresh.length ? Math.min(cash / fresh.length, ((cash + worth(k)) * invest) / hold) : 0;
      for (const r of fresh) {
        if (each < 1) break;
        pos.set(r.l.symbol, { units: each / level(r.l, k), cost: each, since: k });
        cash -= each;
        trades.push({ day: k, side: "buy", symbol: r.l.symbol, name: r.l.name, amount: each, move: r.m, rank: rankOf(r.l.symbol), days: lookback });
      }
    }
    equity[k] = cash + worth(k);
  }
  const last = race.n - 1;
  const held = [...pos].map(([sym, p]) => ({ symbol: sym, name: bySym.get(sym).name, since: p.since, pnl: ((p.units * level(bySym.get(sym), last)) / p.cost - 1) * 100 }));
  const sells = trades.filter((x) => x.side === "sell");
  return { start, equity, trades, held, wins: sells.filter((x) => x.pnl > 0).length, closed: sells.length, opts: { hold, every, lookback, invest } };
}

/** The trades made on day k (in order: sells, then buys). */
export const tradesOn = (run, k) => (run?.trades ?? []).filter((x) => x.day === k);

/** What the agent holds after day k's trades: [{symbol, name, since, cost, units}] in buy order. */
export function holdingsAt(run, k) {
  const out = new Map();
  for (const x of run?.trades ?? []) {
    if (x.day > k) break;
    if (x.side === "buy") out.set(x.symbol, { symbol: x.symbol, name: x.name, since: x.day, cost: x.amount });
    else out.delete(x.symbol);
  }
  return [...out.values()];
}

/** Sales up to day k: {wins, closed}. */
export function scoreAt(run, k) {
  const sells = (run?.trades ?? []).filter((x) => x.side === "sell" && x.day <= k);
  return { wins: sells.filter((x) => x.pnl > 0).length, closed: sells.length };
}

/**
 * What the agent is thinking on day k, for the "plan" panel: every name ranked by its move over the last `lookback`
 * days ({symbol, name, m, rank, held, zone}), the names it wants to buy (in the top `hold` and rose, not held) and to
 * sell (held, out of the top), how many days until it next acts (0: it acts today; null: no more checks in the
 * window), and the trades it made today.
 */
export function agentMind(race, run, k, opts = run?.opts ?? {}) {
  if (!race?.lines?.length || !run) return null;
  const { hold = AGENT_HOLD, every = AGENT_EVERY, lookback = AGENT_LOOKBACK } = opts;
  const back = Math.max(0, k - lookback);
  const held = new Set(holdingsAt(run, k).map((h) => h.symbol));
  const ranked = race.lines
    .map((l, i) => ({ symbol: l.symbol, name: l.name, i, m: (level(l, k) / level(l, back) - 1) * 100 }))
    .sort((a, b) => b.m - a.m || a.i - b.i)
    .map((r, j) => ({ ...r, rank: j + 1, held: held.has(r.symbol) }));
  for (const r of ranked) r.zone = r.rank <= hold && r.m > 0;
  const acts = k > 0 && k % every === 0 && k < race.n - 1;
  const next = acts ? k : (Math.floor(k / every) + 1) * every;
  return {
    ranked,
    wantBuy: ranked.filter((r) => r.zone && !r.held),
    wantSell: ranked.filter((r) => r.held && !r.zone),
    nextIn: next < race.n - 1 ? next - k : null,
    today: tradesOn(run, k),
    warming: k < 1,
  };
}
