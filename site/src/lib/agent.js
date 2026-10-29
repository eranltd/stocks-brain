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
 * The risk levels a reader can pick: how many names it holds, how many it shorts (bets on falling), how often it
 * moves, how far back it looks, and how much of the money it puts in (the rest stays in cash).
 */
export const AGENT_LEVELS = {
  easy: { hold: 6, short: 0, every: 10, lookback: 40, invest: 0.6 },
  medium: { hold: AGENT_HOLD, short: 1, every: AGENT_EVERY, lookback: AGENT_LOOKBACK, invest: 1 },
  hard: { hold: 2, short: 2, every: 3, lookback: 10, invest: 1 },
};
export const LEVEL_IDS = ["easy", "medium", "hard"];
export const levelOf = (id) => AGENT_LEVELS[id] ?? AGENT_LEVELS.medium;

/** The trade kinds: buy opens a holding, sell closes it; short opens a bet on a fall, cover closes it. */
export const SIDES = ["buy", "sell", "short", "cover"];

/** A line's level on day k (1 = where the window starts), from its percent-from-start values. */
const level = (line, k) => 1 + (line.values[Math.min(k, line.values.length - 1)] ?? 0) / 100;

/** What a short opened at `entry` with `cost` dollars is worth at level `lv`: it gains as the price falls, never below 0. */
const shortWorth = (cost, entry, lv) => Math.max(0, cost * (2 - lv / entry));

/**
 * Replay the demo rule over a race window ({n, dates, lines: [{symbol, name, values: % from the first day]}). On day 0
 * it holds cash. On every `every`-th day (never the last) it ranks the names by their move over the last `lookback`
 * days (fewer near the start). It keeps the `hold` best that rose and sells the others it holds; it shorts the `short`
 * worst that fell and covers the other shorts; then it splits `invest` of its money evenly over the new positions
 * (the rest stays cash). Trades fill at that day's close. Returns {start, equity: dollars per day, trades: [{day, side
 * (SIDES), symbol, name, amount, rank (its place that day), cold (its place from the bottom), move (the lookback move,
 * on opening), days, pnl (% on closing)}], held: [{side: "long" | "short", symbol, name, since, pnl}] at the end, wins,
 * closed, opts} or null.
 */
export function agentRun(race, { start = AGENT_START, hold = AGENT_HOLD, short = 0, every = AGENT_EVERY, lookback = AGENT_LOOKBACK, invest = 1 } = {}) {
  if (!race?.lines?.length || !(race.n > 1)) return null;
  const bySym = new Map(race.lines.map((l) => [l.symbol, l]));
  let cash = start;
  const longs = new Map();
  const shorts = new Map();
  const trades = [];
  const equity = new Array(race.n);
  const worth = (k) => [...longs].reduce((s, [sym, p]) => s + p.units * level(bySym.get(sym), k), 0)
    + [...shorts].reduce((s, [sym, p]) => s + shortWorth(p.cost, p.entry, level(bySym.get(sym), k)), 0);
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
      const bottom = short > 0 ? ranked.slice(-short).filter((r) => r.m < 0 && !want.has(r.l.symbol)).reverse() : [];
      const wantShort = new Set(bottom.map((r) => r.l.symbol));
      const close = (sym) => ({ rank: rankOf(sym), cold: ranked.length - rankOf(sym) + 1 });
      for (const [sym, p] of [...longs]) {
        if (want.has(sym)) continue;
        const value = p.units * level(bySym.get(sym), k);
        cash += value;
        trades.push({ day: k, side: "sell", symbol: sym, name: bySym.get(sym).name, amount: value, pnl: (value / p.cost - 1) * 100, ...close(sym) });
        longs.delete(sym);
      }
      for (const [sym, p] of [...shorts]) {
        if (wantShort.has(sym)) continue;
        const value = shortWorth(p.cost, p.entry, level(bySym.get(sym), k));
        cash += value;
        trades.push({ day: k, side: "cover", symbol: sym, name: bySym.get(sym).name, amount: value, pnl: (value / p.cost - 1) * 100, ...close(sym) });
        shorts.delete(sym);
      }
      const fresh = [
        ...top.filter((r) => !longs.has(r.l.symbol)).map((r) => ["buy", r]),
        ...bottom.filter((r) => !shorts.has(r.l.symbol)).map((r) => ["short", r]),
      ];
      const each = fresh.length ? Math.min(cash / fresh.length, ((cash + worth(k)) * invest) / (hold + short)) : 0;
      for (const [side, r] of fresh) {
        if (each < 1) break;
        const lv = level(r.l, k);
        if (side === "buy") longs.set(r.l.symbol, { units: each / lv, cost: each, since: k });
        else shorts.set(r.l.symbol, { cost: each, entry: lv, since: k });
        cash -= each;
        trades.push({ day: k, side, symbol: r.l.symbol, name: r.l.name, amount: each, move: r.m, days: lookback, ...close(r.l.symbol) });
      }
    }
    equity[k] = cash + worth(k);
  }
  const last = race.n - 1;
  const held = [
    ...[...longs].map(([sym, p]) => ({ side: "long", symbol: sym, name: bySym.get(sym).name, since: p.since, pnl: ((p.units * level(bySym.get(sym), last)) / p.cost - 1) * 100 })),
    ...[...shorts].map(([sym, p]) => ({ side: "short", symbol: sym, name: bySym.get(sym).name, since: p.since, pnl: (shortWorth(p.cost, p.entry, level(bySym.get(sym), last)) / p.cost - 1) * 100 })),
  ];
  const closes = trades.filter((x) => x.side === "sell" || x.side === "cover");
  return { start, equity, trades, held, wins: closes.filter((x) => x.pnl > 0).length, closed: closes.length, opts: { hold, short, every, lookback, invest } };
}

/** The trades made on day k (in order: sells, covers, then new positions). */
export const tradesOn = (run, k) => (run?.trades ?? []).filter((x) => x.day === k);

/** What the agent holds after day k's trades: [{side: "long" | "short", symbol, name, since, cost}] in opening order. */
export function holdingsAt(run, k) {
  const out = new Map();
  for (const x of run?.trades ?? []) {
    if (x.day > k) break;
    if (x.side === "buy") out.set(`long:${x.symbol}`, { side: "long", symbol: x.symbol, name: x.name, since: x.day, cost: x.amount });
    else if (x.side === "short") out.set(`short:${x.symbol}`, { side: "short", symbol: x.symbol, name: x.name, since: x.day, cost: x.amount });
    else out.delete(`${x.side === "sell" ? "long" : "short"}:${x.symbol}`);
  }
  return [...out.values()];
}

/** Closed positions (sells and covers) up to day k: {wins, closed}. */
export function scoreAt(run, k) {
  const closes = (run?.trades ?? []).filter((x) => (x.side === "sell" || x.side === "cover") && x.day <= k);
  return { wins: closes.filter((x) => x.pnl > 0).length, closed: closes.length };
}

/** A holding's result at day k, in percent: a long gains as the price rises, a short as it falls. */
export function holdingPnl(race, h, k) {
  const line = race?.lines?.find((l) => l.symbol === h.symbol);
  if (!line) return 0;
  const ratio = level(line, k) / level(line, h.since);
  return h.side === "short" ? (1 - ratio) * 100 : (ratio - 1) * 100;
}

/**
 * What the agent is thinking on day k, for the "plan" panel: every name ranked by its move over the last `lookback`
 * days ({symbol, name, m, rank, cold, held, shorted, zone, low}), what it wants to buy (in the top `hold` and rose, not
 * held), sell (held, out of the top), short (in the bottom `short` and fell, not shorted) and cover (shorted, out of the
 * bottom), how many days until it next acts (0: it acts today; null: no more checks in the window), and today's trades.
 */
export function agentMind(race, run, k, opts = run?.opts ?? {}) {
  if (!race?.lines?.length || !run) return null;
  const { hold = AGENT_HOLD, short = 0, every = AGENT_EVERY, lookback = AGENT_LOOKBACK } = opts;
  const back = Math.max(0, k - lookback);
  const now = holdingsAt(run, k);
  const held = new Set(now.filter((h) => h.side === "long").map((h) => h.symbol));
  const shorted = new Set(now.filter((h) => h.side === "short").map((h) => h.symbol));
  const n = race.lines.length;
  const ranked = race.lines
    .map((l, i) => ({ symbol: l.symbol, name: l.name, i, m: (level(l, k) / level(l, back) - 1) * 100 }))
    .sort((a, b) => b.m - a.m || a.i - b.i)
    .map((r, j) => ({ ...r, rank: j + 1, cold: n - j, held: held.has(r.symbol), shorted: shorted.has(r.symbol) }));
  for (const r of ranked) {
    r.zone = r.rank <= hold && r.m > 0;
    r.low = short > 0 && r.cold <= short && r.m < 0 && !r.zone;
  }
  const acts = k > 0 && k % every === 0 && k < race.n - 1;
  const next = acts ? k : (Math.floor(k / every) + 1) * every;
  return {
    ranked,
    wantBuy: ranked.filter((r) => r.zone && !r.held),
    wantSell: ranked.filter((r) => r.held && !r.zone),
    wantShort: ranked.filter((r) => r.low && !r.shorted).reverse(),
    wantCover: ranked.filter((r) => r.shorted && !r.low),
    nextIn: next < race.n - 1 ? next - k : null,
    today: tradesOn(run, k),
    warming: k < 1,
  };
}
