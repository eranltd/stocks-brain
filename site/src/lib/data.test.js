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
