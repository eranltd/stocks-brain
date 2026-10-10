import { englishTitle } from "./format.js";
// Loads the exported JSON (see scripts/build_site.py) and derives view models.
// All numbers shown on the dashboard are computed here or in Python, never by the LLM.

import { signedExcess } from "./stats.js";

const BASE = "./data/";

async function get(path) {
  const res = await fetch(BASE + path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return path.endsWith(".md") ? res.text() : res.json();
}

/** Just the manifest: the live home page polls it and reloads the data when built_at changes. */
export const loadManifest = () => get("manifest.json");

/** The indexed candles of one symbol (data/market/candles/<SYMBOL>.json), fetched only when its chart is opened and kept
 * for the session; not part of loadAll, so the first load stays small. Resolves to null when the manifest lists no file
 * for the symbol (no live data yet, or the symbol was skipped). Every price-like number in it is percent from the last
 * close (the last close is 0) and volume is a ratio to its 20-period average: no prices are published. */
const candleCache = new Map();
export function loadCandles(manifest, symbol) {
  const path = manifest?.candles?.[symbol];
  if (!path) return Promise.resolve(null);
  // Keyed by the build too: the live page reloads its data in place after a daily run (same path, new day), and a chart
  // kept from the day before would no longer match the checklist beside it.
  const key = `${manifest.built_at ?? ""}|${path}`;
  if (!candleCache.has(key)) {
    const p = get(path).catch((e) => {
      candleCache.delete(key); // a failed fetch can be retried
      throw e;
    });
    candleCache.set(key, p);
  }
  return candleCache.get(key);
}

// ---------------------------------------------------------------- markets
// config/markets.json lists the markets the header switch can show; manifest.markets (scripts/build_site.py) adds each
// one's exported files: {id: {label, name, note, kind, benchmark, benchmark_label, default, sample, derived, checklist,
// candles: {SYMBOL: path} | null, watchlist}}. The default market (Nasdaq) is the one loadAll already loads; every other
// market's derived numbers, checklist and list are fetched only when it is opened (loadMarket). A market whose files
// are not published yet has derived: null (the site says "no data yet"; never sample numbers next to live ones).

/** The markets in config order, each its config entry merged with its manifest entry; `available` is true when its
 * derived numbers exist. A build from before markets existed gives one default market built from the manifest. */
export function marketsFrom(manifest, config = null) {
  const exported = manifest?.markets;
  if (!exported) {
    return [{
      id: "nasdaq", label: "Nasdaq", name: "US leaders", note: null, kind: "stocks", benchmark: null, benchmark_label: null,
      default: true, sample: manifest?.price_source === "sample", derived: manifest?.market ?? null,
      checklist: manifest?.checklist ?? null, candles: manifest?.candles ?? null, watchlist: "config/watchlist.json",
      available: Boolean(manifest?.market),
    }];
  }
  const order = config?.markets?.map((m) => m.id) ?? Object.keys(exported);
  const cfg = Object.fromEntries((config?.markets ?? []).map((m) => [m.id, m]));
  return order
    .filter((id) => exported[id])
    .map((id) => {
      const { watchlist: _wl, data: _data, ...fromConfig } = cfg[id] ?? {};
      const entry = { ...fromConfig, ...exported[id], id };
      return { ...entry, available: Boolean(entry.derived) };
    });
}

/** The market the site opens on (config default, else the first). */
export const defaultMarket = (markets) => markets.find((m) => m.default) ?? markets[0] ?? null;

function marketView(entry, derived, checklist, watchlist) {
  const names = Object.fromEntries((watchlist?.symbols ?? []).map((s) => [s.symbol, s.name]));
  if (entry.benchmark) names[entry.benchmark] ??= entry.benchmark_label ?? entry.benchmark;
  // A stocks market's list has GICS sectors, a funds market's a category (watchlist.schema.json).
  const groups = Object.fromEntries((watchlist?.symbols ?? []).map((s) => [s.symbol, s.sector ?? s.category ?? null]));
  const prices = derived
    ? Object.fromEntries(derived.symbols.map((s) => [s.symbol, { ...s, bars: s.spark.map((p) => ({ date: p.date, close: p.v })) }]))
    : {};
  return {
    id: entry.id, entry, market: derived, checklist, watchlist, names, groups, prices,
    benchmark: derived?.benchmark ?? entry.benchmark, asOf: derived?.as_of ?? null,
    sample: Boolean(derived?.sample ?? entry.sample), available: Boolean(derived),
  };
}

/** One market's view: {id, entry, market (its derived.json, or null before its first run), checklist, watchlist, names,
 * groups (symbol -> sector or fund category), prices (indexed sparklines as in loadAll), benchmark, asOf, sample,
 * available}. The default market comes from `data` (the loadAll result) when it is given, so nothing is fetched twice;
 * any other market is fetched on first use and kept for the session, keyed by the build like loadCandles. Rejects for a
 * market the manifest does not list. */
const marketCache = new Map();
export function loadMarket(manifest, id, data = null) {
  const entry = marketsFrom(manifest, data?.marketsConfig ?? null).find((m) => m.id === id);
  if (!entry) return Promise.reject(new Error(`market ${id}: not in the manifest`));
  if (entry.default && data) return Promise.resolve(marketView(entry, data.market, data.checklist, data.watchlist));
  const key = `${manifest.built_at ?? ""}|${id}`;
  if (!marketCache.has(key)) {
    const opt = (path) => (path ? get(path) : Promise.resolve(null));
    const p = Promise.all([opt(entry.derived), opt(entry.checklist), opt(entry.watchlist)])
      .then(([derived, checklist, watchlist]) => marketView(entry, derived, checklist, watchlist))
      .catch((e) => {
        marketCache.delete(key); // a failed fetch can be retried
        throw e;
      });
    marketCache.set(key, p);
  }
  return marketCache.get(key);
}

/** loadCandles for another market's symbol: its files are listed under manifest.markets[id].candles. */
export function loadMarketCandles(manifest, id, symbol) {
  const m = manifest?.markets?.[id];
  if (!m || m.default) return loadCandles(manifest, symbol);
  return loadCandles({ built_at: manifest.built_at, candles: m.candles }, symbol);
}

export async function loadAll(onProgress = () => {}) {
  const manifest = await get("manifest.json");
  const paths = [
    ...manifest.runs,
    manifest.market,
    ...(manifest.longrun ? [manifest.longrun] : []),
    ...(manifest.paper ? [manifest.paper] : []),
    ...(manifest.rules_result ? [manifest.rules_result] : []),
    ...(manifest.paper_rules ? [manifest.paper_rules] : []),
    ...Object.values(manifest.kb),
    ...manifest.docs.map((d) => d.file),
    ...(manifest.ops ? [manifest.ops] : []),
    ...(manifest.people_scores ? [manifest.people_scores] : []),
    // Technical checklist (data/market/checklist.json): null until the first daily run that computes it.
    ...(manifest.checklist ? [manifest.checklist] : []),
  ];
  let done = 0;
  const entries = await Promise.all(
    paths.map(async (p) => {
      const v = await get(p);
      onProgress(++done / paths.length);
      return [p, v];
    }),
  );
  return derive(manifest, Object.fromEntries(entries));
}

// The history verdict is read once (first real-data run of a registry); the daily recompute only updates the numbers.
// Every verdict the site shows is the frozen one; `verdict_today` keeps what today's recompute would say.
function withFrozenVerdicts(res) {
  const fz = res?.frozen;
  if (!fz) return res;
  const sat = res.satellite && { ...res.satellite, rules: res.satellite.rules.map((r) => ({ ...r, verdict_today: r.verdict, verdict: fz.satellite[r.id]?.verdict ?? r.verdict })) };
  const sav = res.savings && {
    ...res.savings,
    horizons: res.savings.horizons.map((h) => ({ ...h, rows: h.rows.map((r) => ({ ...r, verdict_today: r.verdict, verdict: fz.savings[`${h.weeks}:${r.id}`]?.verdict ?? r.verdict })) })),
  };
  return { ...res, satellite: sat, savings: sav };
}

export function derive(manifest, files) {
  const runs = manifest.runs.map((p) => files[p]).sort((a, b) => a.date.localeCompare(b.date));
  const market = files[manifest.market];
  // Goal check and portfolio rule (data/market/longrun.json) and the forward-only paper record.
  const longrun = manifest.longrun ? files[manifest.longrun] : null;
  const paper = manifest.paper ? files[manifest.paper] : null;
  // Rule registry (config/rules.json) and its backtests (data/market/rules.json).
  const rulesResult = withFrozenVerdicts(manifest.rules_result ? files[manifest.rules_result] : null);
  const ledger = manifest.paper_rules ? files[manifest.paper_rules] : null;
  // Indexed sparklines (100 = start of window). No absolute prices are published.
  const prices = Object.fromEntries(market.symbols.map((s) => [s.symbol, { ...s, bars: s.spark.map((p) => ({ date: p.date, close: p.v })) }]));
  const doc = (name) => manifest.docs.find((d) => d.name === name);
  const watchlist = files[doc("watchlist").file];
  const settings = files[doc("settings").file];
  const learnings = files[doc("learnings").file];
  const guardrails = files[doc("guardrails").file];
  const sources = files[doc("sources").file];
  const routines = files[doc("routines").file];
  const rulebook = doc("rules") ? files[doc("rules").file] : null;
  // People we learn from (config/people.json) and code's scores of their dated public calls (data/people/scores.json).
  const people = doc("people") ? files[doc("people").file] : null;
  const peopleScores = manifest.people_scores ? files[manifest.people_scores] : null;
  // Company outlook cards (config/outlook.json): researched, paraphrased and linked; may hold no companies yet.
  const outlook = doc("outlook") ? files[doc("outlook").file] : null;
  // The eight-step technical checklist: its steps and house rule (config/checklist.json) and code's daily reading of it.
  const checklistCfg = doc("checklist") ? files[doc("checklist").file] : null;
  const checklist = manifest.checklist ? files[manifest.checklist] ?? null : null;
  // Markets the header switch can show (config/markets.json + manifest.markets; see marketsFrom and loadMarket) and the
  // fund cards of the funds market (config/funds.json; may hold no funds yet).
  const marketsConfig = doc("markets") ? files[doc("markets").file] : null;
  const markets = marketsFrom(manifest, marketsConfig);
  const funds = doc("funds") ? files[doc("funds").file] : null;
  const outcomes = manifest.kb.outcomes ? files[manifest.kb.outcomes].items : [];
  // Library titles are shown in English only (the stored original stays the citation).
  const libraryRaw = manifest.kb.library ? files[manifest.kb.library] : null;
  const library = libraryRaw ? { ...libraryRaw, sources: (libraryRaw.sources ?? []).map((src) => ({ ...src, title: englishTitle(src.title) })) } : null;
  const regime = manifest.kb.regime ? files[manifest.kb.regime] : null;
  const observations = manifest.kb.observations ? files[manifest.kb.observations] : null;
  const opsLog = manifest.ops ? files[manifest.ops] : null;
  const calibration = manifest.kb.calibration ? files[manifest.kb.calibration] : null;
  const names = Object.fromEntries(watchlist.symbols.map((s) => [s.symbol, s.name]));
  const bench = settings.scoring.benchmark;
  names[bench.symbol] = bench.label;
  for (const c of watchlist.context ?? []) names[c.symbol] ??= c.name;
  const sectors = Object.fromEntries(watchlist.symbols.map((s) => [s.symbol, s.sector]));
  const core = watchlist.core ?? null;

  const outcomeById = Object.fromEntries(outcomes.map((o) => [o.pick_id, o]));
  const kb = runs
    .flatMap((r) =>
      r.picks.map((p) => ({
        ...p.pick,
        id: p.id,
        date: r.date,
        ref_price: p.ref_price,
        ref_date: p.ref_date,
        name: names[p.pick.ticker] ?? p.pick.ticker,
        outcome: outcomeById[p.id] ?? null,
        verdict: outcomeById[p.id]?.verdict ?? "pending",
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));

  const latest = runs.at(-1) ?? null;
  const lastOk = [...runs].reverse().find((r) => r.status === "ok") ?? null;
  const shownRuns = runs.slice(-manifest.runs_shown);

  const docs = manifest.docs.map((d) => ({ ...d, content: files[d.file] }));
  if (library) {
    docs.push({
      name: "library", file: manifest.kb.library, path: "data/kb/library.json",
      version: library.version, updated_at: library.updated_at, change_note: library.change_note, content: library,
    });
  }

  return {
    market, manifest, runs, shownRuns, latest, lastOk, prices, watchlist, settings, learnings, guardrails,
    outcomes, library, sources, routines, names, bench, kb, docs, regime, calibration, observations, opsLog, longrun, paper, sectors, core, rulebook, rulesResult, ledger, people, peopleScores, outlook, checklist, checklistCfg,
    markets, marketsConfig, funds,
    sample: manifest.source === "sample", livePrices: manifest.price_source === "live",
  };
}

// ---------------------------------------------------------------- stats helpers

// Averages use signed excess (in the direction of the call); raw excess would credit a wrong bearish
// call on a rallying stock. See lib/stats.js for effective N and the Wilson bound.
export function summarize(outcomes) {
  const n = outcomes.length;
  const count = (v) => outcomes.filter((o) => o.verdict === v).length;
  const hits = count("hit");
  const signed = outcomes.map(signedExcess);
  const avg = n ? signed.reduce((a, b) => a + b, 0) / n : 0;
  return {
    n, hits, misses: count("miss"), flats: count("flat"),
    hitRate: n ? (hits / n) * 100 : 0,
    avgExcess: avg,
    best: n ? outcomes.reduce((a, b) => (b.excess_pct > a.excess_pct ? b : a)) : null,
    worst: n ? outcomes.reduce((a, b) => (b.excess_pct < a.excess_pct ? b : a)) : null,
  };
}

export function dailyChange(bars) {
  if (!bars || bars.length < 2) return null;
  const a = bars.at(-2).close, b = bars.at(-1).close;
  return { last: b, abs: b - a, pct: (b / a - 1) * 100, date: bars.at(-1).date };
}

// Trading-day offset from the last known bar; used to project the scoring date for pending picks.
export function addTradingDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}
