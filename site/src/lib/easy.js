// Simple mode (components/easy.jsx): the market in words for anyone, built on Market now's pulse (lib/marketnow.js).
// A traffic light, moves in words, and what to do. Pure functions, tested in easy.test.js. Moves only, never a price.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** The traffic light: "red" (scared: a panic or a selloff), "yellow" (nervous: a down day or nervous fear), else
 * "green" (calm). Also the sentence key for it. */
export function lightOf(pulse) {
  const fear = pulse?.fear?.level ?? null;
  const mood = pulse?.mood ?? null;
  if (fear === "panic" || mood === "selloff") return { light: "red", key: mood === "selloff" ? "selloff" : "panic" };
  if (fear === "nervous" || mood === "down") return { light: "yellow", key: mood === "down" ? "down" : "nervous" };
  return { light: "green", key: mood === "rally" ? "rally" : mood === "up" ? "up" : "calm" };
}

/** A move in a few words: "bigJump" (5%+), "up" (1%+), "littleUp", "same" (under 0.3%), "littleDown", "down",
 * "bigDrop". */
const SCALE = { day: [0.3, 1, 5], month: [1, 3, 10], year: [2, 8, 25] }; // [about the same, a little, big]

export function moveWord(pct, span = "day") {
  if (!isNum(pct)) return null;
  const [same, little, big] = SCALE[span] ?? SCALE.day;
  const a = Math.abs(pct);
  if (a < same) return "same";
  if (pct > 0) return a >= big ? "bigJump" : a >= little ? "up" : "littleUp";
  return a >= big ? "bigDrop" : a >= little ? "down" : "littleDown";
}

/** The news for Simple mode: headlines about the owner's own names first (newest), then the market's. */
export function easyNews(live, symbols, max = 3) {
  if (!live || live.sample) return [];
  const mine = new Set(symbols ?? []);
  const own = (live.company_news ?? []).filter((n) => mine.has(n.symbol)).sort((a, b) => b.at - a.at);
  const seen = new Set();
  return [...own, ...(live.market_news ?? []).slice().sort((a, b) => b.at - a.at)]
    .filter((n) => !seen.has(n.headline) && seen.add(n.headline)).slice(0, max);
}

/** An index fund's name without the "(QQQ proxy)" part, for plain sentences. */
export const plainIndex = (name) => String(name ?? "").replace(/\s*\([^)]*proxy\)\s*/i, "").trim();

/**
 * The owner's stocks today, from a list's rows and the hourly pulse when fresh: {rows: [{symbol, name, move}] best
 * first, up, down, n, top: the 3 biggest moves either way}.
 */
export function myStocks(watch, closeRows, liveRows = null) {
  const live = new Map((liveRows ?? []).map((r) => [r.symbol, r.move_pct]));
  const close = new Map((closeRows ?? []).map((r) => [r.symbol, r.change_1d_pct]));
  const rows = (watch ?? []).map((s) => {
    const m = live.has(s.symbol) ? live.get(s.symbol) : close.get(s.symbol);
    return { symbol: s.symbol, name: s.name ?? s.symbol, move: isNum(m) ? m : null };
  }).filter((r) => r.move != null).sort((a, b) => b.move - a.move);
  const top = [...rows].sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, 3);
  return { rows, top, up: rows.filter((r) => r.move > 0).length, down: rows.filter((r) => r.move < 0).length, n: rows.length };
}
