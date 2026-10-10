import test from "node:test";
import assert from "node:assert/strict";
import {
  candlesOf, costWords, defaultId, fundCard, marketData, marketNote, NASDAQ_ONLY, nasdaqData, nasdaqOnlyLine, NOT_YET, nounsFor, pickMarket,
  resolveSymbolMarket, roleIn, scopeOutlook, switchChoices, TLV_NOTE,
} from "./markets.js";
import { ROUTES } from "./nav.js";

const MARKETS = [
  { id: "nasdaq", label: "Nasdaq", name: "US leaders", kind: "stocks", default: true, available: true },
  { id: "tlv", label: "TLV", name: "Israeli companies (US listings)", kind: "stocks", default: false, available: true },
  { id: "ishares", label: "iShares", name: "iShares index funds", kind: "funds", default: false, available: false },
];
const view = (id, symbols, benchmark, extra = {}) => ({ id, benchmark, watchlist: { symbols: symbols.map((symbol) => ({ symbol })) }, ...extra });
const VIEWS = [view("nasdaq", ["AAA", "BBB"], "IDX"), view("tlv", ["TTT", "NNN"], "ISR"), view("ishares", ["FFF", "ISR"], "BMK")];

test("switch choices: three markets in config order, each with one plain line", () => {
  assert.deepEqual(switchChoices(MARKETS), [
    { id: "nasdaq", label: "Nasdaq", what: "US leaders", available: true },
    { id: "tlv", label: "TLV", what: "Israeli companies, US listings", available: true },
    { id: "ishares", label: "iShares", what: "Index funds", available: false },
  ]);
  assert.deepEqual(switchChoices([{ id: "lse", label: "LSE", name: "London" }]), [{ id: "lse", label: "LSE", what: "London", available: false }]);
});

test("market selection from the hash: a published market is kept, anything else falls back to the default", () => {
  assert.equal(pickMarket(MARKETS, "tlv"), "tlv");
  assert.equal(pickMarket(MARKETS, "ishares"), "ishares"); // not published yet still opens, with its "not yet" line
  assert.equal(pickMarket(MARKETS, null), "nasdaq");
  assert.equal(pickMarket(MARKETS, "lse"), "nasdaq");
  assert.equal(pickMarket([{ id: "a" }, { id: "b", default: true }], "zzz"), "b");
  assert.equal(defaultId([]), "nasdaq");
  assert.equal(pickMarket([], "tlv"), "nasdaq");
});

test("a stock page opens in the market that lists the symbol; the current market wins when it has it", () => {
  assert.equal(resolveSymbolMarket(VIEWS, "TTT", "nasdaq"), "tlv");
  assert.equal(resolveSymbolMarket(VIEWS, "AAA", "ishares"), "nasdaq");
  assert.equal(resolveSymbolMarket(VIEWS, "FFF", "nasdaq"), "ishares");
  // ISR: TLV's benchmark and an iShares fund. From TLV it stays (benchmark); from elsewhere it opens as a fund.
  assert.equal(resolveSymbolMarket(VIEWS, "ISR", "tlv"), "tlv");
  assert.equal(resolveSymbolMarket(VIEWS, "ISR", "nasdaq"), "ishares");
  assert.equal(resolveSymbolMarket(VIEWS, "ISR", "ishares"), "ishares");
  assert.equal(resolveSymbolMarket(VIEWS, "IDX", "tlv"), "nasdaq");
  assert.equal(resolveSymbolMarket(VIEWS, "BMK", "nasdaq"), "ishares");
  assert.equal(resolveSymbolMarket(VIEWS, "ZZZZ", "nasdaq"), null);
  assert.equal(resolveSymbolMarket([], "TTT", "tlv"), null);
  assert.equal(roleIn(VIEWS[1], "ISR"), "benchmark");
  assert.equal(roleIn(VIEWS[2], "ISR"), "member");
  assert.equal(roleIn(null, "ISR"), null);
});

test("each market's pages see only their own companies' outlook cards", () => {
  const outlook = { version: "1", companies: [{ ticker: "AAA" }, { ticker: "TTT" }, { ticker: "NNN" }] };
  assert.deepEqual(scopeOutlook(outlook, ["TTT", "NNN"]).companies.map((c) => c.ticker), ["TTT", "NNN"]);
  assert.equal(scopeOutlook(null, ["X"]), null);
  const data = { markets: MARKETS, outlook, watchlist: { symbols: [{ symbol: "AAA" }], context: [{ symbol: "BMK" }] } };
  const base = nasdaqData(data);
  assert.deepEqual(base.outlook.companies.map((c) => c.ticker), ["AAA"]);
  assert.equal(base.marketId, "nasdaq");
  assert.equal(nasdaqData(base).outlookAll, outlook); // idempotent: the full file is kept for the other markets
  const tlv = marketData(base, { ...VIEWS[1], entry: { id: "tlv", label: "TLV", benchmark_label: "Israel stock market (ISR proxy)" }, names: { TTT: "Teva" }, prices: {}, groups: { TTT: "Health Care" }, market: { symbols: [] }, checklist: null, sample: false });
  assert.deepEqual(tlv.outlook.companies.map((c) => c.ticker), ["TTT", "NNN"]);
});

test("another market's data swaps in its list and benchmark and empties the Nasdaq-only parts", () => {
  const base = { markets: MARKETS, settings: { s: 1 }, kb: [{ id: 1 }], longrun: { x: 1 }, paper: { p: 1 }, people: { people: [] }, regime: { state: "calm" }, outlook: null, funds: { funds: [] }, sample: true };
  const v = { ...VIEWS[2], entry: { id: "ishares", kind: "funds", label: "iShares", benchmark_label: "S&P 500 (BMK proxy)" }, names: { FFF: "iShares Core S&P 500 ETF" }, prices: { FFF: {} },
    groups: { FFF: "US large companies" }, market: { as_of: "2026-10-02", symbols: [] }, checklist: { symbols: [] }, sample: true };
  const md = marketData(base, v);
  assert.equal(md.marketId, "ishares");
  assert.deepEqual(md.bench, { symbol: "BMK", label: "S&P 500 (BMK proxy)" });
  assert.equal(md.sectors.FFF, "US large companies");
  assert.equal(md.market.as_of, "2026-10-02");
  for (const k of ["longrun", "paper", "people", "regime", "core"]) assert.equal(md[k], null, k);
  assert.deepEqual(md.kb, []);
  assert.equal(md.settings, base.settings);
  assert.equal(md.livePrices, false);
  assert.equal(marketData(base, null), null);
});

test("candle files follow the market of the page's data", () => {
  const manifest = { candles: { AAA: "market/candles/AAA.json" }, markets: { nasdaq: { default: true, candles: { AAA: "x" } }, tlv: { default: false, candles: { TTT: "markets/tlv/candles/TTT.json" } }, ishares: { default: false, candles: null } } };
  assert.deepEqual(candlesOf({ manifest, marketId: "nasdaq" }), manifest.candles);
  assert.deepEqual(candlesOf({ manifest, marketId: "tlv" }), { TTT: "markets/tlv/candles/TTT.json" });
  assert.deepEqual(candlesOf({ manifest, marketId: "ishares" }), {});
  assert.deepEqual(candlesOf({ manifest: { candles: { A: "a" } } }), { A: "a" });
});

test("plain words: nouns, the TLV note, the not-yet line, the Nasdaq-only line, fund cards and yearly cost", () => {
  assert.deepEqual(nounsFor({ kind: "funds" }), { one: "fund", many: "funds" });
  assert.deepEqual(nounsFor(null), { one: "company", many: "companies" });
  assert.equal(marketNote({ id: "tlv" }), TLV_NOTE);
  assert.match(TLV_NOTE, /^Israeli companies that also trade in the US\. Tel Aviv-only companies such as the banks are not included/);
  assert.equal(marketNote({ id: "nasdaq" }), null);
  assert.equal(NOT_YET, "This market's numbers appear after the next nightly run.");
  assert.match(nasdaqOnlyLine("TLV"), /Nasdaq list only.*TLV is for looking/);
  for (const r of NASDAQ_ONLY) assert.ok(ROUTES.includes(r), r);
  assert.ok(!NASDAQ_ONLY.includes("watchlist") && !NASDAQ_ONLY.includes("today"));
  const funds = { funds: [{ ticker: "FFF", plain: "A low-cost way." }] };
  assert.equal(fundCard(funds, "FFF").plain, "A low-cost way.");
  assert.equal(fundCard(funds, "GGG"), null);
  assert.equal(fundCard(null, "FFF"), null);
  assert.equal(costWords(0.03), "0.03% a year");
  assert.equal(costWords(0.2), "0.2% a year");
  assert.equal(costWords(0.15), "0.15% a year");
  assert.equal(costWords(null), null);
});
