// Loads the exported JSON (see scripts/build_site.py) and derives view models.
// All numbers shown on the dashboard are computed here or in Python, never by the LLM.

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
    ...manifest.prices,
    ...Object.values(manifest.kb),
    ...manifest.docs.map((d) => d.file),
    ...(manifest.ops ? [manifest.ops] : []),
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

export function derive(manifest, files) {
  const runs = manifest.runs.map((p) => files[p]).sort((a, b) => a.date.localeCompare(b.date));
  const prices = Object.fromEntries(manifest.prices.map((p) => [files[p].symbol, files[p]]));
  const doc = (name) => manifest.docs.find((d) => d.name === name);
  const watchlist = files[doc("watchlist").file];
  const settings = files[doc("settings").file];
  const learnings = files[doc("learnings").file];
  const guardrails = files[doc("guardrails").file];
  const sources = files[doc("sources").file];
  const routines = files[doc("routines").file];
  const outcomes = manifest.kb.outcomes ? files[manifest.kb.outcomes].items : [];
  const library = manifest.kb.library ? files[manifest.kb.library] : null;
  const regime = manifest.kb.regime ? files[manifest.kb.regime] : null;
  const observations = manifest.kb.observations ? files[manifest.kb.observations] : null;
  const opsLog = manifest.ops ? files[manifest.ops] : null;
  const calibration = manifest.kb.calibration ? files[manifest.kb.calibration] : null;
  const names = Object.fromEntries(watchlist.symbols.map((s) => [s.symbol, s.name]));
  const bench = settings.scoring.benchmark;
  names[bench.symbol] = bench.label;

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
    manifest, runs, shownRuns, latest, lastOk, prices, watchlist, settings, learnings, guardrails,
    outcomes, library, sources, routines, names, bench, kb, docs, regime, calibration, observations, opsLog,
    sample: manifest.source === "sample", livePrices: manifest.price_source === "live",
  };
}

// ---------------------------------------------------------------- stats helpers

export function summarize(outcomes) {
  const n = outcomes.length;
  const count = (v) => outcomes.filter((o) => o.verdict === v).length;
  const hits = count("hit");
  const excess = outcomes.map((o) => o.excess_pct);
  const avg = n ? excess.reduce((a, b) => a + b, 0) / n : 0;
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
