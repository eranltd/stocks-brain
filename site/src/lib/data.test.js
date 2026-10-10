import test from "node:test";
import assert from "node:assert/strict";
import { loadCandles } from "./data.js";

test("loadCandles fetches one symbol's file on demand, once, and null when none is listed", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ symbol: "XYZ", basis: "percent from the last close" }) };
  };
  try {
    const manifest = { candles: { XYZ: "market/candles/XYZ.json" } };
    assert.equal(await loadCandles(manifest, "ABC"), null);
    assert.equal(await loadCandles({ candles: null }, "XYZ"), null);
    assert.equal(await loadCandles({}, "XYZ"), null);
    const a = await loadCandles(manifest, "XYZ");
    const b = await loadCandles(manifest, "XYZ");
    assert.equal(a.symbol, "XYZ");
    assert.equal(a, b);
    assert.deepEqual(calls, ["./data/market/candles/XYZ.json"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("loadCandles retries after a failed fetch", async () => {
  const realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => (++n === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ symbol: "QRS" }) });
  try {
    const manifest = { candles: { QRS: "market/candles/QRS.json" } };
    await assert.rejects(loadCandles(manifest, "QRS"), /HTTP 503/);
    assert.equal((await loadCandles(manifest, "QRS")).symbol, "QRS");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("loadCandles fetches again after a new build (the live page reloads its data in place after a daily run)", async () => {
  const realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ symbol: "LMN", n: ++n }) });
  try {
    const path = "market/candles/LMN.json";
    const day1 = { built_at: "2026-10-08T23:59:00Z", candles: { LMN: path } };
    const day2 = { built_at: "2026-10-09T23:59:00Z", candles: { LMN: path } };
    assert.equal((await loadCandles(day1, "LMN")).n, 1);
    assert.equal((await loadCandles(day1, "LMN")).n, 1);
    assert.equal((await loadCandles(day2, "LMN")).n, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

const MANIFEST = {
  built_at: "2026-10-10T03:00:00Z",
  market: "market/derived.json",
  checklist: "market/checklist.json",
  candles: { AAA: "market/candles/AAA.json" },
  markets: {
    nasdaq: { label: "Nasdaq", name: "US leaders", note: "main", kind: "stocks", benchmark: "BNCH", benchmark_label: "Nasdaq-100", default: true, sample: true,
      derived: "market/derived.json", checklist: "market/checklist.json", candles: { AAA: "market/candles/AAA.json" }, watchlist: "config/watchlist.json" },
    tlv: { label: "TLV", name: "Israeli companies (US listings)", note: "US listings only", kind: "stocks", benchmark: "ILBM", benchmark_label: "Israel", default: false, sample: true,
      derived: "markets/tlv/derived.json", checklist: "markets/tlv/checklist.json", candles: { TVA: "markets/tlv/candles/TVA.json" }, watchlist: "config/watchlists/tlv.json" },
    ishares: { label: "iShares", name: "iShares index funds", note: "funds", kind: "funds", benchmark: "BRD", benchmark_label: "S&P 500", default: false, sample: false,
      derived: null, checklist: null, candles: null, watchlist: "config/watchlists/ishares.json" },
  },
};
const CONFIG = { default: "nasdaq", markets: [{ id: "nasdaq", data: "data/market", watchlist: "config/watchlist.json" }, { id: "tlv" }, { id: "ishares" }] };

test("marketsFrom merges config order with the manifest entries and marks markets without data", async () => {
  const { marketsFrom, defaultMarket } = await import("./data.js");
  const ms = marketsFrom(MANIFEST, CONFIG);
  assert.deepEqual(ms.map((m) => m.id), ["nasdaq", "tlv", "ishares"]);
  assert.deepEqual(ms.map((m) => m.available), [true, true, false]);
  assert.equal(ms[1].benchmark, "ILBM");
  assert.equal(ms[0].data, undefined);
  assert.equal(defaultMarket(ms).id, "nasdaq");
  // A build from before markets existed: one default market from the manifest.
  const old = marketsFrom({ market: "market/derived.json", price_source: "live" });
  assert.equal(old.length, 1);
  assert.equal(old[0].default, true);
  assert.equal(old[0].sample, false);
});

test("loadMarket uses loadAll's data for the default market and fetches another market once", async () => {
  const { loadMarket, loadMarketCandles } = await import("./data.js");
  const calls = [];
  const realFetch = globalThis.fetch;
  const files = {
    "./data/markets/tlv/derived.json": { as_of: "2026-10-09", sample: true, benchmark: "ILBM", symbols: [{ symbol: "TVA", spark: [{ date: "2026-10-09", v: 101 }] }] },
    "./data/markets/tlv/checklist.json": { as_of: "2026-10-09", symbols: [] },
    "./data/config/watchlists/tlv.json": { symbols: [{ symbol: "TVA", name: "Teva", sector: "Health Care" }] },
    "./data/markets/tlv/candles/TVA.json": { symbol: "TVA" },
    "./data/config/watchlists/ishares.json": { symbols: [{ symbol: "FNDA", name: "Core S&P 500", category: "US large companies" }] },
  };
  globalThis.fetch = async (url) => {
    calls.push(url);
    return files[url] ? { ok: true, json: async () => files[url] } : { ok: false, status: 404 };
  };
  try {
    const data = { market: { as_of: "2026-10-09", benchmark: "BNCH", symbols: [] }, checklist: null, watchlist: { symbols: [] }, marketsConfig: CONFIG };
    const nas = await loadMarket(MANIFEST, "nasdaq", data);
    assert.equal(nas.market, data.market);
    assert.equal(calls.length, 0);
    const a = await loadMarket(MANIFEST, "tlv");
    const b = await loadMarket(MANIFEST, "tlv");
    assert.equal(a, b);
    assert.equal(a.available, true);
    assert.equal(a.names.TVA, "Teva");
    assert.equal(a.names.ILBM, "Israel");
    assert.equal(a.groups.TVA, "Health Care");
    assert.equal(a.prices.TVA.bars[0].close, 101);
    assert.equal(calls.length, 3);
    const none = await loadMarket(MANIFEST, "ishares");
    assert.equal(none.available, false);
    assert.equal(none.market, null);
    assert.equal(none.groups.FNDA, "US large companies");
    await assert.rejects(loadMarket(MANIFEST, "nope"), /not in the manifest/);
    assert.equal((await loadMarketCandles(MANIFEST, "tlv", "TVA")).symbol, "TVA");
    assert.equal(await loadMarketCandles(MANIFEST, "ishares", "FNDA"), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
