// The bull and the bear: before any BUY, two agents argue for and against the name from the data the site already has,
// the way TradingAgents (TauricResearch) has a bull and a bear researcher debate before its trader decides, and the way
// AI Hedge Fund's risk manager can stop a trade (docs/ai_traders.md). Each point is a fact, never a guess. A strong
// bear case holds a BUY at WAIT (lib/desk.js bossCall). Pure functions, tested in debate.test.js. Percents only.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const DAY = 86400000;

/**
 * The debate for one name: {bull: [{id, ...values}], bear: [{id, ...values}], verdict: "bull" | "bear" | "balanced"}.
 * `row`: its derived row; `flows`: its flows row (short selling, analysts, insiders); `card`: its outlook card (next
 * results); `moat`: the theme reading ("dominant" | "few_rivals" | "crowded"); `today`: YYYY-MM-DD.
 */
export function debateFor({ row = null, flows = null, card = null, moat = null, today = null } = {}) {
  const bull = [], bear = [];
  if (row) {
    const r60 = row.ret_60d_pct, above = row.above_sma50;
    if (above === true && isNum(r60) && r60 > 0) bull.push({ id: "uptrend", pct: r60 });
    if (above === false && isNum(r60) && r60 < 0) bear.push({ id: "downtrend", pct: r60 });
    if (isNum(row.vs_bench_60d_pct) && row.vs_bench_60d_pct >= 3) bull.push({ id: "beatsMarket", pct: row.vs_bench_60d_pct });
    if (isNum(row.vs_bench_60d_pct) && row.vs_bench_60d_pct <= -3) bear.push({ id: "lagsMarket", pct: row.vs_bench_60d_pct });
    if (isNum(row.from_high_pct) && row.from_high_pct <= -30) bear.push({ id: "fallingKnife", pct: row.from_high_pct });
    if (isNum(row.change_1d_pct) && row.change_1d_pct <= -5) bear.push({ id: "bigDrop", pct: row.change_1d_pct });
  }
  const a = flows?.analysts;
  if (a?.n >= 5) {
    if (a.buy_pct >= 80) bull.push({ id: "analystsLike", buy: a.strong_buy + a.buy, n: a.n });
    else if (a.buy_pct < 50) bear.push({ id: "analystsSplit", buy: a.strong_buy + a.buy, n: a.n });
  }
  const s = flows?.short;
  if (s?.level === "high") bear.push({ id: "shortsHigh", pct: s.pct, base: s.base_pct });
  if (s?.level === "low") bull.push({ id: "shortsLow", pct: s.pct, base: s.base_pct });
  const ins = flows?.insiders;
  if (ins?.side === "bought") bull.push({ id: "insidersBought" });
  if (ins?.side === "sold" && isNum(ins.mspr) && ins.mspr <= -50) bear.push({ id: "insidersSold" });
  const next = card?.next_earnings?.date;
  if (next && today) {
    const days = Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
    if (days >= 0 && days <= 7) bear.push({ id: "resultsSoon", days });
  }
  if (moat === "dominant") bull.push({ id: "leader" });
  if (moat === "crowded") bear.push({ id: "crowded" });
  const verdict = bear.length >= 3 && bear.length > bull.length ? "bear"
    : bear.length >= bull.length + 2 ? "bear"
    : bull.length >= bear.length + 2 ? "bull" : "balanced";
  return { bull, bear, verdict };
}

/** The debate inputs for many names at once, from the site's data: {symbol: debate}. */
export function debates(symbols, { market = null, flows = null, outlook = null, themes = null, today = null } = {}) {
  const rows = new Map((market?.symbols ?? []).map((r) => [r.symbol, r]));
  const fl = new Map((flows && !flows.sample ? flows.symbols : []).map((r) => [r.symbol, r]));
  const cards = new Map((outlook?.companies ?? []).map((c) => [c.ticker, c]));
  const moat = new Map();
  for (const th of themes?.themes ?? []) for (const c of th.companies) if (!moat.has(c.symbol)) moat.set(c.symbol, c.moat);
  return Object.fromEntries(symbols.map((s) => [s, debateFor({ row: rows.get(s), flows: fl.get(s), card: cards.get(s), moat: moat.get(s), today })]));
}
