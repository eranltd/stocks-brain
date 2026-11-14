// Who is betting what, per stock (data/market/flows.json, scripts/flows.py): the share of trading sold short against
// the name's usual level, analysts' buy/hold/sell counts and insiders' buying or selling, as plain-word keys for the
// stock page. Pure functions, tested in flows.test.js. Percents and counts only, never a price.

/** The row for one symbol, or null. */
export function flowsFor(doc, symbol) {
  if (!doc || doc.sample) return null;
  return (doc.symbols ?? []).find((r) => r.symbol === symbol) ?? null;
}

/** The analysts' mood in one key: "strongBuy" (80%+ say buy), "buy" (60%+), "mixed", or "sell" (more sell than buy). */
export function analystsWord(a) {
  if (!a || !a.n) return null;
  const sell = a.sell + a.strong_sell;
  if (sell > a.strong_buy + a.buy) return "sell";
  if (a.buy_pct >= 80) return "strongBuy";
  if (a.buy_pct >= 60) return "buy";
  return "mixed";
}

/** The last `n` days of short-sale share, oldest first, for a small bar chart: [{d, p}]. */
export function shortBars(short, n = 20) {
  return (short?.history ?? []).slice(-n);
}
