// "What the market did": a view of the last close built from data/market/derived.json (percent only, no prices).
// Every number is a day change or a distance computed in Python; this file only sorts, counts and averages them.

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The last close in plain numbers: the S&P 500 (context role "spx") and the benchmark's day moves, how many names rose
 * and fell, the three biggest risers and fallers, the average day move per sector, the S&P 500's distance from its
 * one-year high and the share of names above their fifty-day average. Older data without a day change gives nulls.
 */
export function marketDay(market, watchlist, bench, top = 3) {
  if (!market) return null;
  const members = new Set((watchlist?.symbols ?? []).map((s) => s.symbol));
  const sectorOf = Object.fromEntries((watchlist?.symbols ?? []).map((s) => [s.symbol, s.sector ?? "Other"]));
  const rows = (market.symbols ?? []).filter((r) => members.has(r.symbol));
  const moved = rows.filter((r) => num(r.change_1d_pct) != null).map((r) => ({ symbol: r.symbol, pct: r.change_1d_pct, sector: sectorOf[r.symbol] }));
  const spxRow = (market.context?.instruments ?? []).find((i) => i.role === "spx") ?? null;
  const benchRow = (market.symbols ?? []).find((r) => r.symbol === bench?.symbol) ?? null;

  const bySector = {};
  for (const m of moved) (bySector[m.sector] ??= []).push(m.pct);
  const sectors = Object.entries(bySector)
    .map(([sector, xs]) => ({ sector, n: xs.length, avg: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => b.avg - a.avg || a.sector.localeCompare(b.sector));

  const desc = [...moved].sort((a, b) => b.pct - a.pct || a.symbol.localeCompare(b.symbol));
  return {
    date: market.as_of,
    spx: spxRow ? { name: spxRow.name, pct: num(spxRow.change_1d_pct), fromHigh: num(spxRow.from_high_pct) } : null,
    bench: benchRow ? { symbol: benchRow.symbol, label: bench?.label ?? benchRow.symbol, pct: num(benchRow.change_1d_pct) } : null,
    names: rows.length,
    counted: moved.length,
    rose: moved.filter((m) => m.pct > 0).length,
    fell: moved.filter((m) => m.pct < 0).length,
    flat: moved.filter((m) => m.pct === 0).length,
    risers: desc.filter((m) => m.pct > 0).slice(0, top),
    fallers: desc.filter((m) => m.pct < 0).reverse().slice(0, top),
    sectors,
    breadth: num(market.breadth_above_sma50_pct),
  };
}

/** Short sector names for one compact line on a phone. */
const SHORT = {
  "Information Technology": "Tech",
  "Communication Services": "Communication",
  "Consumer Discretionary": "Discretionary",
  "Consumer Staples": "Staples",
  "Health Care": "Health care",
};
export const shortSector = (s) => SHORT[s] ?? s;
