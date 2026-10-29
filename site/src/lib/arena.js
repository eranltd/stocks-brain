// The Arena (tabs/Arena.jsx, components/arena/*, components/motion.jsx): pure helpers, tested in arena.test.js.
// Everything here replays real, published history: the derived file's indexed series (100 = the start of its window),
// re-based to percent from the first day of the chosen window. Nothing invents a path, fills a day that did not happen
// or looks ahead of the replay's day. Numbers are percents and percent points; the one dollar figure is the paper
// basket, a clearly labelled "if you had split $100,000" example computed from the same percents.

import { moveBetween } from "./candles.js";
import { lerp } from "./replay.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/* ------------------------------------------------------------------ the clock */

/** Playback speeds. */
export const SPEEDS = [0.5, 1, 2, 4];
/** Milliseconds per trading day at 1×: the whole year (252 days) in under 3 minutes, slow enough to follow each day. */
export const DAY_MS = 650;
/** The longest step one frame may take: after a stalled frame or a background tab the replay never leaps ahead. */
export const MAX_FRAME_MS = 100;
/** The windows a reader can pick, in trading days (moves): about three months, six months and a year. */
export const WINDOWS = [
  { id: "3m", days: 63 },
  { id: "6m", days: 126 },
  { id: "1y", days: 252 },
];

/** Where a replay of n days is after `dt` more milliseconds at `speed` (0 to n - 1, fractions allowed). */
export function step(pos, dt, { n, speed = 1, dayMs = DAY_MS } = {}) {
  const last = Math.max(0, (n ?? 0) - 1);
  if (!last) return 0;
  const d = (Math.min(Math.max(0, dt), MAX_FRAME_MS) * speed) / dayMs;
  return Math.min(last, Math.max(0, pos + d));
}

/** How long a whole replay of n days takes at a speed, in milliseconds. */
export const replayMs = (n, speed = 1, dayMs = DAY_MS) => (Math.max(0, n - 1) * dayMs) / speed;

/* ------------------------------------------------------------------ the data */

/**
 * The race cut to its last `days` trading days and re-based so every line starts at 0 on the window's first day. A
 * shorter history is used as it is (never padded). `race` is lib/replay.js raceData's result.
 */
export function windowed(race, days) {
  if (!race?.n || !race.lines?.length) return null;
  const from = Math.max(0, race.n - 1 - Math.max(1, days));
  const cut = (l) => {
    const v0 = l.values[from];
    return { ...l, values: l.values.slice(from).map((v) => moveBetween(v0, v) ?? 0) };
  };
  const n = race.n - from;
  return { dates: race.dates.slice(from), n, days: n - 1, lines: race.lines.map(cut), bench: race.bench ? cut(race.bench) : null };
}

/** A line's own move on day k (percent from the close before), null on the first day. */
export function dayMove(values, k) {
  if (!values || k < 1 || k >= values.length) return null;
  return moveBetween(values[k - 1], values[k]);
}

/* ------------------------------------------------------------------ the bar race */

/**
 * Every bar at a position (fractions read between two days), highest first. Ties keep list order and the benchmark
 * (a ghost bar) sorts after the names it ties with. Each row: {symbol, name, value, ghost, slot (0-based place),
 * rank (1-based among the names; null for the ghost)}.
 */
export function ranking(race, pos) {
  const rows = race.lines.map((l, k) => ({ l, k, ghost: false }));
  if (race.bench) rows.push({ l: race.bench, k: race.lines.length, ghost: true });
  let r = 0;
  return rows
    .map(({ l, k, ghost }) => ({ symbol: l.symbol, name: l.name, value: lerp(l.values, pos) ?? 0, ghost, k }))
    .sort((a, b) => b.value - a.value || a.k - b.k)
    .map(({ k: _k, ...x }, slot) => ({ ...x, slot, rank: x.ghost ? null : ++r }));
}

/** {symbol: rank} of the names on whole day k (the ghost left out). */
export function ranksAt(race, k) {
  return Object.fromEntries(ranking(race, k).filter((x) => !x.ghost).map((x) => [x.symbol, x.rank]));
}

/** How many places each name moved between two rank maps: positive = climbed. Only the names that moved. */
export function rankChanges(before, after) {
  const out = {};
  for (const [sym, r] of Object.entries(after)) {
    const was = before?.[sym];
    if (isNum(was) && was !== r) out[sym] = was - r;
  }
  return out;
}

/** "▲2" / "▼1" / "" for a rank change. */
export const rankArrow = (d) => (!d ? "" : d > 0 ? `▲${d}` : `▼${-d}`);

/** The leading name on whole day k: {symbol, name, value}. */
export function leaderAt(race, k) {
  const top = ranking(race, k).find((x) => !x.ghost);
  return top ? { symbol: top.symbol, name: top.name, value: top.value } : null;
}

/** The name with the biggest move (either way) on day k: {symbol, name, move}; null on the first day. Ties: list order. */
export function biggestSwing(race, k) {
  let best = null;
  for (const l of race.lines) {
    const m = dayMove(l.values, k);
    if (isNum(m) && (!best || Math.abs(m) > Math.abs(best.move))) best = { symbol: l.symbol, name: l.name, move: m };
  }
  return best;
}

/** Up days in a row ending on day k (a day counts when it closed higher than the day before). */
export function combo(values, k) {
  let n = 0;
  for (let j = Math.min(k, (values?.length ?? 0) - 1); j >= 1; j--) {
    const m = dayMove(values, j);
    if (!(m > 0)) break;
    n++;
  }
  return n;
}

/** How many times the lead changed hands, day by day, and how many days each name led: {changes, days: {symbol: n}}. */
export function leadStats(race) {
  const days = {};
  let changes = 0, prev = null;
  for (let k = 0; k < race.n; k++) {
    const l = leaderAt(race, k);
    if (!l) continue;
    days[l.symbol] = (days[l.symbol] ?? 0) + 1;
    if (prev && prev !== l.symbol) changes++;
    prev = l.symbol;
  }
  return { changes, days };
}

/* ------------------------------------------------------------------ the duel */

/** Below this gap (in percent points) two lines count as level: it shows as 0.0. */
export const LEVEL_PTS = 0.05;

/** The gap between two lines at a position, in percent points: {a, b, gap (a - b), lead: "a" | "b" | null}. */
export function gapAt(a, b, pos) {
  const va = lerp(a, pos) ?? 0, vb = lerp(b, pos) ?? 0, gap = va - vb;
  return { a: va, b: vb, gap, lead: Math.abs(gap) < LEVEL_PTS ? null : gap > 0 ? "a" : "b" };
}

/** The days on which the lead changed hands (a level day changes nothing): a sorted list of day indexes. */
export function leadChangeDays(a, b) {
  const out = [];
  let side = 0;
  const n = Math.min(a?.length ?? 0, b?.length ?? 0);
  for (let k = 0; k < n; k++) {
    const g = a[k] - b[k];
    const s = Math.abs(g) < LEVEL_PTS ? 0 : Math.sign(g);
    if (!s) continue;
    if (side && s !== side) out.push(k);
    side = s;
  }
  return out;
}

/** How many of `days` are on or before day k. */
export const countUpTo = (days, k) => days.filter((d) => d <= k + 1e-9).length;

/** Whole days each side was in front up to day k: {a, b}. */
export function daysInFront(a, b, k = Math.min(a.length, b.length) - 1) {
  let x = 0, y = 0;
  for (let i = 1; i <= k; i++) {
    const g = a[i] - b[i];
    if (g >= LEVEL_PTS) x++;
    else if (g <= -LEVEL_PTS) y++;
  }
  return { a: x, b: y };
}

/** The end of a duel: {draw, winner, loser ({symbol, name, value}), gap (points, >= 0), changes, front {a, b}}. */
export function duelResult(race, symA, symB) {
  const A = race.lines.find((l) => l.symbol === symA), B = race.lines.find((l) => l.symbol === symB);
  if (!A || !B) return null;
  const end = race.n - 1;
  const g = gapAt(A.values, B.values, end);
  const side = (l) => ({ symbol: l.symbol, name: l.name, value: l.values[end] });
  return {
    draw: g.lead == null, winner: side(g.lead === "b" ? B : A), loser: side(g.lead === "b" ? A : B), gap: Math.abs(g.gap),
    changes: leadChangeDays(A.values, B.values).length, front: daysInFront(A.values, B.values, end),
  };
}

/** The pair with the most lead changes (ties: the closer finish, then list order): [symA, symB] in list order. */
export function bestDuel(race) {
  let best = null;
  const L = race?.lines ?? [];
  for (let i = 0; i < L.length; i++) {
    for (let j = i + 1; j < L.length; j++) {
      const c = leadChangeDays(L[i].values, L[j].values).length;
      const gap = Math.abs(L[i].values.at(-1) - L[j].values.at(-1));
      if (!best || c > best.c || (c === best.c && gap < best.gap - 1e-9)) best = { c, gap, pair: [L[i].symbol, L[j].symbol] };
    }
  }
  return best?.pair ?? null;
}

/* ------------------------------------------------------------------ the summary */

/** A comeback counts only after a drop of at least this many percent. */
export const COMEBACK_MIN_DROP = 5;

/**
 * A line's biggest comeback: the biggest rise from a low that came after a drop (the line was below an earlier high by
 * at least COMEBACK_MIN_DROP percent) to the highest point after that low. {rise, drop (negative), peak, low, high}
 * (day indexes), or null when it never came back from such a drop.
 */
export function comeback(values) {
  const n = values?.length ?? 0;
  if (n < 3) return null;
  const sufMax = new Array(n);
  let mi = n - 1;
  for (let j = n - 1; j >= 0; j--) {
    if (values[j] > values[mi]) mi = j;
    sufMax[j] = mi;
  }
  let peak = 0, best = null;
  for (let j = 1; j < n - 1; j++) {
    if (values[j] >= values[peak]) { peak = j; continue; }
    const drop = moveBetween(values[peak], values[j]);
    if (!(drop <= -COMEBACK_MIN_DROP)) continue;
    const hi = sufMax[j + 1];
    const rise = moveBetween(values[j], values[hi]);
    if (rise > 0 && (!best || rise > best.rise + 1e-9)) best = { rise, drop, peak, low: j, high: hi };
  }
  return best;
}

/** The biggest single-day move (either way) of any name: {symbol, name, k, date, move}; ties keep the earlier one. */
export function wildestDay(race) {
  let best = null;
  for (const l of race.lines) {
    for (let k = 1; k < race.n; k++) {
      const m = dayMove(l.values, k);
      if (isNum(m) && (!best || Math.abs(m) > Math.abs(best.move) + 1e-12)) best = { symbol: l.symbol, name: l.name, k, date: race.dates[k], move: m };
    }
  }
  return best;
}

/**
 * The end of the race, for the summary card: {podium (top 3), last, comeback ({symbol, name, ...}) | null, wildest,
 * changes (lead changes), top ({symbol, name, days} most days in front), bench ({value, beat: names ahead of it}) |
 * null, names, days}.
 */
export function raceSummary(race) {
  if (!race?.lines?.length) return null;
  const end = race.n - 1;
  const ranked = ranking(race, end).filter((x) => !x.ghost);
  let cb = null;
  for (const l of race.lines) {
    const c = comeback(l.values);
    if (c && (!cb || c.rise > cb.rise + 1e-9)) cb = { symbol: l.symbol, name: l.name, ...c, lowDate: race.dates[c.low], highDate: race.dates[c.high] };
  }
  const lead = leadStats(race);
  const topSym = Object.entries(lead.days).sort((a, b) => b[1] - a[1] || race.lines.findIndex((l) => l.symbol === a[0]) - race.lines.findIndex((l) => l.symbol === b[0]))[0];
  const nameOf = (sym) => race.lines.find((l) => l.symbol === sym)?.name ?? sym;
  const pick = (x) => ({ symbol: x.symbol, name: x.name, value: x.value });
  const bv = race.bench ? race.bench.values[end] : null;
  return {
    podium: ranked.slice(0, 3).map(pick), last: pick(ranked.at(-1)), comeback: cb, wildest: wildestDay(race), changes: lead.changes,
    top: topSym ? { symbol: topSym[0], name: nameOf(topSym[0]), days: topSym[1] } : null,
    bench: race.bench ? { value: bv, beat: ranked.filter((x) => x.value > bv).length } : null,
    names: ranked.length, days: race.n - 1,
  };
}

/* ------------------------------------------------------------------ the paper basket */

/** The paper basket's starting amount, in dollars. */
export const BASKET = 100000;

/**
 * The paper basket: `amount` split evenly across the names on the window's first day and left alone (no trading), day
 * by day. Its value on day k is amount times the average of each name's growth since that day; a line that cannot
 * be read on a day keeps its last value. Past data only: it says what that split would have been worth, nothing more.
 */
export function basketSeries(race, amount = BASKET) {
  if (!race?.lines?.length) return [];
  const n = race.n, m = race.lines.length;
  return Array.from({ length: n }, (_, k) => (amount * race.lines.reduce((s, l) => s + (100 + (l.values[k] ?? 0)) / 100, 0)) / m);
}

/* ------------------------------------------------------------------ the heat grid / ticker wall */

/** Day moves (percent) at which a tile's colour steps up: 1 to 4 (0 below the first). */
export const HEAT_STEPS = [0.1, 0.75, 1.5, 3];

/** A move's heat: {tone: "up" | "down" | "flat" | "none", level 0-4}. */
export function heat(move) {
  if (!isNum(move)) return { tone: "none", level: 0 };
  const a = Math.abs(move);
  const level = HEAT_STEPS.filter((s) => a >= s).length;
  return { tone: level === 0 ? "flat" : move > 0 ? "up" : "down", level };
}

/**
 * The lists for the wall from the markets' views (lib/data.js loadMarket): [{id, label, symbols: [{symbol, name,
 * series}]}], members only (no benchmark or context funds), in market order.
 */
export function wallLists(views) {
  return (views ?? []).filter((v) => v?.available && v.market?.symbols?.length).map((v) => {
    const rows = Object.fromEntries(v.market.symbols.map((s) => [s.symbol, s]));
    const members = (v.watchlist?.symbols ?? []).map((s) => s.symbol).filter((sym) => rows[sym]?.series?.length);
    return { id: v.id, label: v.entry?.label ?? v.id, symbols: members.map((sym) => ({ symbol: sym, name: v.names?.[sym] ?? sym, series: rows[sym].series })) };
  });
}

/**
 * The wall's tiles: every name once (in the first list that has it), with its day move on each of `dates` (null on the
 * first day or when the name has no value on that day or the one before). [{id, label, tiles: [{symbol, name, moves}]}].
 */
export function wallTiles(lists, dates) {
  const seen = new Set();
  const out = [];
  for (const list of lists ?? []) {
    const tiles = [];
    for (const s of list.symbols) {
      if (seen.has(s.symbol)) continue;
      seen.add(s.symbol);
      const by = new Map(s.series.map((p) => [p.date, p.v]));
      const moves = dates.map((d, i) => {
        if (!i) return null;
        const a = by.get(dates[i - 1]), b = by.get(d);
        return isNum(a) && isNum(b) && a > 0 ? (b / a - 1) * 100 : null;
      });
      tiles.push({ symbol: s.symbol, name: s.name, moves });
    }
    if (tiles.length) out.push({ id: list.id, label: list.label, tiles });
  }
  return out;
}

/** The race's lines as wall tiles (one group): the main list's day moves, for the small grid on Home. */
export function raceTiles(race, id = "main", label = "") {
  return [{ id, label, tiles: race.lines.map((l) => ({ symbol: l.symbol, name: l.name, moves: l.values.map((_, k) => dayMove(l.values, k)) })) }];
}

/** How many tiles were up, down and flat on day k, and the biggest mover: {up, down, flat, top: {symbol, move} | null}. */
export function breadth(groups, k) {
  const out = { up: 0, down: 0, flat: 0, top: null };
  for (const g of groups ?? []) {
    for (const t of g.tiles) {
      const m = t.moves[k];
      if (!isNum(m)) continue;
      const h = heat(m);
      if (h.tone === "up") out.up++;
      else if (h.tone === "down") out.down++;
      else out.flat++;
      if (!out.top || Math.abs(m) > Math.abs(out.top.move)) out.top = { symbol: t.symbol, name: t.name, move: m };
    }
  }
  return out;
}

/* ------------------------------------------------------------------ the orbit and the flow lines */

/** n points spread evenly over a unit sphere (a Fibonacci spiral), kept within |y| <= band so they stay in view. */
export function fibSphere(n, band = 1) {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = (1 - (2 * (i + 0.5)) / n) * band;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    out.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]);
  }
  return out;
}

/** A point turned by `a` around the vertical axis, then tipped by `tilt` toward the viewer. */
export function turn([x, y, z], a, tilt = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  const x1 = x * c + z * s, z1 = -x * s + z * c;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  return [x1, y * ct - z1 * st, y * st + z1 * ct];
}

/** Perspective: a 3D point (unit-sphere space, z toward the viewer) to screen {x, y, s (scale), z}. `f` is the camera distance. */
export function project([x, y, z], { cx, cy, R, f = 3.2 }) {
  const s = f / (f - z);
  return { x: cx + x * R * s, y: cy - y * R * s, s, z };
}

/** How far out a stock's dot sits for a day move: 1 is the shell; up moves push it out, down moves pull it in. */
export const orbitRadius = (move, reach = 0.32, full = 4) => (isNum(move) ? 1 + Math.max(-1, Math.min(1, move / full)) * reach : 1);

/**
 * A smooth curve from a card to the sphere: a cubic Bézier that leaves the card level (horizontal) or straight down
 * (vertical) and arrives the same way. Returns an SVG path.
 */
export function flowPath([x0, y0], [x1, y1], vertical = false) {
  const f = (v) => +v.toFixed(1);
  if (vertical) {
    const my = (y0 + y1) / 2;
    return `M${f(x0)},${f(y0)} C${f(x0)},${f(my)} ${f(x1)},${f(my)} ${f(x1)},${f(y1)}`;
  }
  const mx = (x0 + x1) / 2;
  return `M${f(x0)},${f(y0)} C${f(mx)},${f(y0)} ${f(mx)},${f(y1)} ${f(x1)},${f(y1)}`;
}

/**
 * The flow cards: the main list grouped by sector (equal weight: the average of its names' change since the window's
 * first day), the biggest groups first, at most `max` cards; the names of smaller groups are pooled in one "other"
 * card. [{id (sector or "other"), members, values}].
 */
export function sectorFlows(race, sectors, max = 6) {
  if (!race?.lines?.length) return [];
  const by = new Map();
  for (const l of race.lines) {
    const s = sectors?.[l.symbol] ?? "other";
    if (!by.has(s)) by.set(s, []);
    by.get(s).push(l);
  }
  const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const keep = groups.length <= max ? groups : groups.slice(0, max - 1).filter(([s, ls]) => s !== "other" && ls.length > 1);
  const kept = new Set(keep.map(([s]) => s));
  const rest = groups.filter(([s]) => !kept.has(s)).flatMap(([, ls]) => ls);
  const all = [...keep, ...(rest.length ? [["other", rest]] : [])];
  return all.map(([id, ls]) => ({
    id, members: ls.map((l) => l.symbol),
    values: race.dates.map((_, k) => ls.reduce((s, l) => s + (l.values[k] ?? 0), 0) / ls.length),
  }));
}
