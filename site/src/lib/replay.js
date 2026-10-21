// The replay on a Stock page (components/replay.jsx) and the race on Home (components/race.jsx): pure helpers, tested
// in replay.test.js. A replay plays back real, published history one trading day (or week) at a time; nothing here
// invents a path, fills in a day that did not happen or looks ahead. The candles come from
// data/market/candles/<SYMBOL>.json (percent from the last close) and the race from the derived file's indexed series
// (100 = the start of the window); both are turned into percent from the replay's first close, never into prices.
// Sentences take `lang` last ("en" by default): the replay's texts are in i18n/stock.js ("rp.*"), the race's in
// i18n/home.js ("race.*").

import { moveBetween } from "./candles.js";
import { isolate, ltr, translate } from "./i18n.js";
import stockDict from "../i18n/stock.js";
import homeDict from "../i18n/home.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const L = (lang) => (lang === "he" ? "he" : "en");

/** The speeds a reader can pick (1× plays the whole replay in REPLAY_MS, the race in RACE_MS). */
export const SPEEDS = [1, 2, 4];
export const REPLAY_MS = 12000;
export const RACE_MS = 15000;
/** The longest step one frame may take: after a stalled frame or a background tab the replay never leaps ahead. */
export const MAX_FRAME_MS = 100;
/** Days: the last six months of daily candles. Weeks: every published weekly candle (about fourteen months). */
export const MODES = [
  { value: "daily", n: 130 },
  { value: "weekly", n: 60 },
];
export const MODE_VALUES = MODES.map((m) => m.value);

/* ------------------------------------------------------------------ the replay of one name */

/**
 * The series a replay plays: the last `n` candles of a mode, re-based so the first close is 0 (percent from the first
 * close). Open, high, low, close and the 20-period average are moved together, so every shape stays exactly as
 * published. Null when the doc has no such series.
 */
export function replaySeries(doc, mode = "daily") {
  const m = MODES.find((x) => x.value === mode) ?? MODES[0];
  const s = doc?.[m.value];
  if (!s?.dates?.length || !s.c?.length) return null;
  const from = Math.max(0, s.dates.length - m.n);
  const c0 = s.c[from];
  if (!isNum(c0) || c0 <= -100) return null;
  const rebase = (v) => (isNum(v) ? ((100 + v) / (100 + c0) - 1) * 100 : null);
  const cut = (k) => (s[k] ?? []).slice(from);
  const out = {
    mode: m.value, weekly: m.value === "weekly", partial: m.value === "weekly" && Boolean(s.partial),
    n: s.dates.length - from, dates: cut("dates"),
  };
  for (const k of ["o", "h", "l", "c", "ma20"]) out[k] = cut(k).map(rebase);
  return out;
}

/** Where a replay is after `dt` more milliseconds at `speed`: a position in candles, 0 to n - 1, fractions allowed. */
export function advance(pos, dt, { n, speed = 1, totalMs = REPLAY_MS } = {}) {
  const steps = Math.max(0, (n ?? 0) - 1);
  if (!steps) return 0;
  const step = Math.min(Math.max(0, dt), MAX_FRAME_MS) * speed * (steps / totalMs);
  return Math.min(steps, Math.max(0, pos + step));
}

/** A value between two published points (for drawing a line up to where the replay is); null when either is missing. */
export function lerp(values, pos) {
  const k = Math.floor(pos), f = pos - k;
  const a = values[k], b = values[k + 1];
  if (!isNum(a)) return null;
  if (f < 1e-9 || !isNum(b)) return a;
  return a + (b - a) * f;
}

/** "accent" (up), "down" or "flat" for a percent change as it shows at `d` decimals. */
export const toneOf = (v, d = 1) => (!isNum(v) || Math.abs(v) < 0.5 / 10 ** d ? "flat" : v > 0 ? "accent" : "down");

/**
 * One frame of a replay: the newest whole candle `i`, how far the next one has faded in (`frac`), its date, the running
 * change since the first close and that candle's own move from the close before it (null on the first).
 */
export function frameAt(s, pos) {
  const i = Math.max(0, Math.min(s.n - 1, Math.floor(pos + 1e-9)));
  const move = i ? moveBetween(s.c[i - 1], s.c[i]) : null;
  return {
    i, frac: Math.max(0, Math.min(1, pos - i)), date: s.dates[i], change: s.c[i], move,
    tone: toneOf(s.c[i]), moveTone: toneOf(move), partial: s.partial && i === s.n - 1, last: i === s.n - 1,
  };
}

/** The biggest fall from a high to a later low on the closes up to index `upTo`, as a positive percent. */
export function biggestDrop(c, upTo = c.length - 1) {
  let peak = -1, best = { pct: 0, peak: null, trough: null };
  for (let i = 0; i <= upTo && i < c.length; i++) {
    if (!isNum(c[i])) continue;
    if (peak < 0 || c[i] > c[peak]) peak = i;
    const fall = -moveBetween(c[peak], c[i]);
    if (fall > best.pct) best = { pct: fall, peak, trough: i };
  }
  return best;
}

/** How many months a series spans, rounded (for "the past 6 months"). */
export function monthsSpanned(dates) {
  if (!dates?.length) return 0;
  const ms = Date.parse(`${dates.at(-1)}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`);
  return Math.max(1, Math.round(ms / (30.44 * 86400000)));
}

/** A month's full name ("April", "אפריל"), with its year when asked ("September 2025"). */
export function monthWord(iso, lang = "en", withYear = false) {
  const name = translate(stockDict, L(lang))(`fu.month.${Number(String(iso).slice(5, 7)) - 1}`);
  return withYear ? `${name} ${String(iso).slice(0, 4)}` : name;
}

/** The first and last month of a series in words; both carry their year when the series crosses a new year. */
export function spanWords(dates, lang = "en") {
  const years = dates[0].slice(0, 4) !== dates.at(-1).slice(0, 4);
  return { from: monthWord(dates[0], lang, years), to: monthWord(dates.at(-1), lang, years) };
}

/** "since April" / "מאז אפריל": what the running counter counts from. */
export function sinceWords(dates, lang = "en") {
  return translate(stockDict, L(lang))("rp.since", { when: spanWords(dates, lang).from }, { bidi: false });
}

/** A percent without its sign ("18%", "4.3%", "9%"): whole percents from 10 up. Left to right inside a Hebrew line. */
export function pctWords(v, lang = "en") {
  const a = Math.abs(v);
  const s = `${a.toFixed(a >= 9.95 ? 0 : 1).replace(/\.0$/, "")}%`;
  return L(lang) === "he" ? ltr(s) : s;
}

/** The smallest drop the end line names; a smaller one is told as "no drop of 1% or more". */
export const DROP_FLOOR = 1;

/**
 * The one plain line at the end of a replay, from the data: what happened over the whole period and its biggest drop.
 * "From April to October AAA rose 18%, with its biggest drop of 9% in August."
 */
export function endSummary(s, name, lang = "en") {
  if (!s?.n) return "";
  const t = translate(stockDict, L(lang));
  const he = L(lang) === "he";
  const { from, to } = spanWords(s.dates, lang);
  const total = s.c.at(-1);
  const dir = toneOf(total, 0) === "flat" ? "flat" : total > 0 ? "up" : "down";
  const pct = dir === "flat" ? (he ? ltr(fmtSigned(total)) : fmtSigned(total)) : pctWords(total, lang);
  const drop = biggestDrop(s.c);
  let tail;
  if (drop.pct < DROP_FLOOR || drop.trough == null) tail = t("rp.end.noDrop", { pct: pctWords(DROP_FLOOR, lang) }, { bidi: false });
  else {
    const a = monthWord(s.dates[drop.peak], lang), b = monthWord(s.dates[drop.trough], lang);
    tail = a === b
      ? t("rp.end.dropIn", { pct: pctWords(drop.pct, lang), month: b }, { bidi: false })
      : t("rp.end.dropBetween", { pct: pctWords(drop.pct, lang), a, b }, { bidi: false });
  }
  // Every value is placed as it is: the percents are already isolated in Hebrew, the name is isolated here and the
  // month words and the tail are Hebrew themselves (an isolation mark inside "מאפריל" would not help it read).
  return t(`rp.end.${dir}`, { from, to, name: he ? isolate(name) : name, pct, tail }, { bidi: false });
}

const fmtSigned = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

/* ------------------------------------------------------------------ the race on Home */

/**
 * The race: each main-list name's indexed line over the window, re-based to percent from the first day (0 at the start),
 * on the benchmark's dates. A name without a value on the first day is left out (it could not start with the others);
 * a missing day later keeps the last close. `name(symbol)` gives a short name for the leaderboard.
 */
export function raceData(symbols, { order = null, bench = null, name = (sym) => sym } = {}) {
  const rows = Object.fromEntries((symbols ?? []).filter((s) => s?.series?.length).map((s) => [s.symbol, s]));
  const benchRow = bench ? rows[bench] : null;
  const ids = (order ?? Object.keys(rows)).filter((sym) => sym !== bench && rows[sym]);
  const grid = (benchRow ?? rows[ids[0]])?.series?.map((p) => p.date);
  if (!grid?.length) return null;
  const line = (sym) => {
    const by = new Map(rows[sym].series.map((p) => [p.date, p.v]));
    const v0 = by.get(grid[0]);
    if (!isNum(v0) || v0 <= 0) return null;
    let last = 0;
    const values = grid.map((d) => {
      const v = by.get(d);
      if (isNum(v)) last = (v / v0 - 1) * 100;
      return last;
    });
    return { symbol: sym, name: name(sym), values };
  };
  const lines = ids.map(line).filter(Boolean);
  if (!lines.length) return null;
  return { dates: grid, n: grid.length, lines, bench: benchRow ? { ...line(bench), bench: true } : null };
}

/** Every line's rise at a position (fractions read between two days), highest first; ties keep list order. */
export function standings(race, pos) {
  return race.lines
    .map((l, k) => ({ symbol: l.symbol, name: l.name, rise: lerp(l.values, pos) ?? 0, k }))
    .sort((a, b) => b.rise - a.rise || a.k - b.k)
    .map(({ k: _k, ...r }) => r);
}

/** The leaderboard: the top `k` by rise so far. */
export const leaders = (race, pos, k = 5) => standings(race, pos).slice(0, k);

/**
 * The lines drawn in colour: the top and the bottom movers over the whole window (half each, the top gets the odd one),
 * so the colours never swap during a replay. Returned in list order, which is the colour order: a colour follows its
 * name, never its rank.
 */
export function highlights(race, k = 8) {
  if (race.lines.length <= k) return race.lines.map((l) => l.symbol);
  const ranked = standings(race, race.n - 1);
  const top = Math.ceil(k / 2), bottom = Math.floor(k / 2);
  const keep = new Set([...ranked.slice(0, top), ...ranked.slice(ranked.length - bottom)].map((r) => r.symbol));
  return race.lines.filter((l) => keep.has(l.symbol)).map((l) => l.symbol);
}

/** A label short enough to ride at a line's tip: the short name, or the ticker when the name is longer than `max`. */
export const tipLabel = (name, ticker, max = 11) => (name && name.length <= max ? name : ticker);

/**
 * The race's line at the end: who finished first and last, where the benchmark ended and how many finished ahead of it.
 * `benchName` is the benchmark's plain name ("Nasdaq-100").
 */
export function raceSummary(race, benchName, lang = "en") {
  if (!race?.lines?.length) return "";
  const t = translate(homeDict, L(lang));
  const he = L(lang) === "he";
  const end = race.n - 1;
  const ranked = standings(race, end);
  const first = ranked[0], last = ranked.at(-1);
  const signed = (v) => (he ? ltr(fmtSigned(v)) : fmtSigned(v));
  const nm = (s) => (he ? isolate(s) : s);
  const { from, to } = raceSpan(race.dates, lang);
  const head = t("race.end.head", { from, to, first: nm(first.name), firstPct: signed(first.rise), last: nm(last.name), lastPct: signed(last.rise) }, { bidi: false });
  if (!race.bench) return head;
  const b = race.bench.values[end];
  const ahead = ranked.filter((r) => r.rise > b).length;
  const benchLine = t(toneOf(b, 0) === "flat" ? "race.end.benchFlat" : b > 0 ? "race.end.benchUp" : "race.end.benchDown",
    { bench: nm(benchName), pct: toneOf(b, 0) === "flat" ? signed(b) : pctWords(b, lang) }, { bidi: false });
  const aheadLine = t("race.end.ahead", { count: ahead, total: he ? ltr(ranked.length) : ranked.length }, { bidi: false });
  return `${head} ${benchLine} ${aheadLine}`;
}

/** The race's first and last month in words (home dictionary), years when it crosses a new year. */
function raceSpan(dates, lang) {
  const t = translate(homeDict, L(lang));
  const years = dates[0].slice(0, 4) !== dates.at(-1).slice(0, 4);
  const w = (iso) => `${t(`month.${Number(iso.slice(5, 7)) - 1}`)}${years ? ` ${iso.slice(0, 4)}` : ""}`;
  return { from: w(dates[0]), to: w(dates.at(-1)) };
}
