// Loads the exported JSON (see scripts/build_site.py) and derives view models.
// All numbers shown on the dashboard are computed here or in Python, never by the LLM.

import { signedExcess } from "./stats.js";

const BASE = "./data/";

async function get(path) {
  const res = await fetch(BASE + path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return path.endsWith(".md") ? res.text() : res.json();
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
  const outcomes = manifest.kb.outcomes ? files[manifest.kb.outcomes].items : [];
  const library = manifest.kb.library ? files[manifest.kb.library] : null;
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
    outcomes, library, sources, routines, names, bench, kb, docs, regime, calibration, observations, opsLog, longrun, paper, sectors, core, rulebook, rulesResult, ledger, people, peopleScores, outlook,
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
