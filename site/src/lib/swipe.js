// Swipe mode (components/swipe.jsx): the day as a deck of cards, one at a time: swipe up for the next. The deck and the plain
// facts on each card, from data the site already has. Pure functions, tested in swipe.test.js. Moves only, never a price.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * The deck: the owner's own list first (when loaded), then the main list, each name once, biggest move today first.
 * Each card: {symbol, name, move, spark (index values), about (one line), analysts ({buy, n}) | null, moat | null}.
 */
export function buildDeck({ lists = [], outlook = null, flows = null, themes = null, funds = null }) {
  const seen = new Map();
  for (const l of lists) {
    const rows = new Map((l?.market?.symbols ?? []).map((r) => [r.symbol, r]));
    for (const s of l?.watchlist?.symbols ?? []) {
      if (seen.has(s.symbol)) continue;
      const r = rows.get(s.symbol);
      if (!r || !isNum(r.change_1d_pct)) continue;
      seen.set(s.symbol, { symbol: s.symbol, name: s.name ?? s.symbol, move: r.change_1d_pct, spark: Array.isArray(r.spark) ? r.spark.map((p) => p.v) : null });
    }
  }
  const plain = new Map((outlook?.companies ?? []).map((c) => [c.ticker, c.plain]));
  const fundPlain = new Map((funds?.funds ?? []).map((f) => [f.ticker, f.plain]));
  const moat = new Map();
  for (const th of themes?.themes ?? []) for (const c of th.companies) if (!moat.has(c.symbol)) moat.set(c.symbol, { moat: c.moat, note: c.note, theme: th.name });
  const fl = new Map((flows && !flows.sample ? flows.symbols : []).map((r) => [r.symbol, r]));
  return [...seen.values()].map((c) => {
    const a = fl.get(c.symbol)?.analysts ?? null;
    const m = moat.get(c.symbol) ?? null;
    return { ...c, about: plain.get(c.symbol) ?? m?.note ?? fundPlain.get(c.symbol) ?? null,
      analysts: a ? { buy: a.strong_buy + a.buy, n: a.n } : null, moat: m ? { level: m.moat, theme: m.theme } : null };
  }).sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
}
