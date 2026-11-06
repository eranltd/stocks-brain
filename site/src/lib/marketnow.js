// "Market now", the first screen: what the market is doing, how scared it is, where it is heading and what moved, in
// plain words, from the hourly pulse (data/market/live.json) when there is one and from the last close otherwise.
// Pure functions, tested in marketnow.test.js. Moves only, never a price.
import { noteView, usableWhy } from "./why.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** The pulse counts as fresh this long after it was written (it is written every hour while the market is open). */
export const FRESH_MIN = 90;

/** The market's mood in one word, from the main index fund's move and how many names rose (same rule as live.py). */
export function moodOf(up, down, indexMove) {
  const n = up + down;
  const share = n ? up / n : 0.5;
  if (!isNum(indexMove)) return "mixed";
  if (indexMove <= -2 || (indexMove <= -1 && share < 0.3)) return "selloff";
  if (indexMove < -0.3) return "down";
  if (indexMove >= 1.5 && share > 0.6) return "rally";
  if (indexMove > 0.3) return "up";
  return "flat";
}

/** Where the needle sits on the fear dial (0 calm to 1 panic), from the fear fund's move today. */
export function fearNeedle(move) {
  if (!isNum(move)) return null;
  return Math.max(0, Math.min(1, (move + 10) / 40));
}

/**
 * The pulse: {source: "live" | "close", at (ISO or date), fresh, indexes: [{symbol, name, move}], breadth: {up, down,
 * flat, n}, mood, fear: {level, move, symbol} | null, movers: [{symbol, name, move, list, headline, url}]}.
 */
export function pulseOf(data, now = new Date()) {
  // The pulse is used unless the nightly close is newer than it (yesterday's pulse after today's close came in).
  const live0 = data?.live && !data.live.sample ? data.live : null;
  const live = live0 && !(data?.market?.as_of && String(live0.as_of).slice(0, 10) < data.market.as_of) ? live0 : null;
  const names = data?.names ?? {};
  const ctx = data?.market?.context?.instruments ?? [];
  const nameOf = (s) => names[s] ?? ctx.find((c) => c.symbol === s)?.name ?? (s === data?.bench?.symbol ? data?.bench?.label : null) ?? s;
  if (live?.symbols?.length) {
    // Fresh means the quotes themselves are recent (a run at night still writes the day's last quotes).
    const ageMin = (now - (live.quotes_at ? live.quotes_at * 1000 : Date.parse(live.as_of))) / 60000;
    const head = new Map();
    for (const n of live.company_news ?? []) if (n.symbol && !head.has(n.symbol)) head.set(n.symbol, n);
    const movers = live.symbols.filter((r) => r.list !== "sectors").sort((a, b) => Math.abs(b.move_pct) - Math.abs(a.move_pct)).slice(0, 8)
      .map((r) => ({ symbol: r.symbol, name: nameOf(r.symbol), move: r.move_pct, list: r.list, headline: head.get(r.symbol)?.headline ?? null, url: head.get(r.symbol)?.url ?? null }));
    const b = live.breadth ?? { up: 0, down: 0, flat: 0 };
    return {
      source: "live", at: live.as_of, quotesAt: live.quotes_at ? new Date(live.quotes_at * 1000).toISOString() : null, fresh: ageMin <= FRESH_MIN,
      indexes: Object.entries(live.indexes ?? {}).map(([s, v]) => ({ symbol: s, name: nameOf(s), move: v.move_pct })),
      breadth: { ...b, n: b.up + b.down + b.flat }, mood: live.mood,
      fear: live.fear ? { level: live.fear.level, move: live.fear.move_pct, symbol: live.fear.symbol } : null,
      movers,
    };
  }
  const rows = (data?.market?.symbols ?? []).filter((s) => s.symbol !== data?.bench?.symbol && isNum(s.change_1d_pct));
  const up = rows.filter((r) => r.change_1d_pct > 0).length;
  const down = rows.filter((r) => r.change_1d_pct < 0).length;
  const bench = (data?.market?.symbols ?? []).find((s) => s.symbol === data?.bench?.symbol);
  const indexes = [...ctx.filter((c) => c.role === "spx" && isNum(c.change_1d_pct)).map((c) => ({ symbol: c.symbol, name: c.name, move: c.change_1d_pct })),
    ...(bench && isNum(bench.change_1d_pct) ? [{ symbol: bench.symbol, name: nameOf(bench.symbol), move: bench.change_1d_pct }] : [])];
  const why = usableWhy(data?.why, Boolean(data?.livePrices));
  const noteFor = (s) => (why?.notes ?? []).filter((n) => (n.symbols ?? [])[0] === s && n.market_date === data?.market?.as_of).map((n) => noteView(n, { names }))[0] ?? null;
  return {
    source: "close", at: data?.market?.as_of ?? null, quotesAt: null, fresh: false, indexes,
    breadth: { up, down, flat: rows.length - up - down, n: rows.length },
    mood: moodOf(up, down, bench?.change_1d_pct), fear: null,
    movers: [...rows].sort((a, b) => Math.abs(b.change_1d_pct) - Math.abs(a.change_1d_pct)).slice(0, 8)
      .map((r) => { const n = noteFor(r.symbol); return { symbol: r.symbol, name: nameOf(r.symbol), move: r.change_1d_pct, list: "nasdaq", headline: n?.headline ?? null, url: null }; }),
  };
}

/**
 * Where we are heading, from the market regime (the benchmark's trend and risk) and how many names sit above their
 * 50-day average: {trend: "up" | "down" | "sideways", risk: "low" | "normal" | "high", above50 (percent) | null}.
 */
export function headingOf(data) {
  const r = data?.regime;
  const risk = r?.state === "stressed" ? "high" : r?.state === "calm" ? "low" : "normal";
  return { trend: r?.trend ?? "sideways", risk, above50: isNum(data?.market?.breadth_above_sma50_pct) ? data.market.breadth_above_sma50_pct : null };
}

/** What to do with real money, in one key: a panic or a selloff says "do not sell", else "nothing to do". */
export function realMoneyKey(pulse, heading) {
  if (pulse?.fear?.level === "panic" || pulse?.mood === "selloff") return "noPanic";
  if (heading?.risk === "high" || pulse?.fear?.level === "nervous") return "steady";
  return "nothing";
}

/** The news to show: the pulse's market headlines when it has some, else the why-it-moved notes; newest first. */
export function newsOf(data, max = 12) {
  const live = data?.live && !data.live.sample ? data.live : null;
  if (live?.market_news?.length) return live.market_news.slice().sort((a, b) => b.at - a.at).slice(0, max).map((n) => ({ ...n, kind: "market" }));
  const why = usableWhy(data?.why, Boolean(data?.livePrices));
  return (why?.notes ?? []).map((n) => noteView(n, { names: data?.names ?? {} }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, max)
    .map((v) => ({ headline: v.headline, source: v.sources?.[0]?.publisher ?? "", url: v.sources?.[0]?.url ?? null, at: null, day: v.day, symbol: v.symbols?.[0] ?? null, kind: "why" }));
}
