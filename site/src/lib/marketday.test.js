import test from "node:test";
import assert from "node:assert/strict";
import { marketDay, shortSector } from "./marketday.js";

const wl = { symbols: [
  { symbol: "AAA", sector: "Information Technology" }, { symbol: "BBB", sector: "Information Technology" },
  { symbol: "CCC", sector: "Health Care" }, { symbol: "DDD", sector: "Utilities" }, { symbol: "EEE", sector: "Utilities" },
] };
const bench = { symbol: "IDX", label: "The index" };
const market = {
  as_of: "2026-10-07", breadth_above_sma50_pct: 60,
  symbols: [
    { symbol: "AAA", change_1d_pct: 2 }, { symbol: "BBB", change_1d_pct: -1 }, { symbol: "CCC", change_1d_pct: 3 },
    { symbol: "DDD", change_1d_pct: 0 }, { symbol: "EEE", change_1d_pct: -4 }, { symbol: "IDX", change_1d_pct: 0.5 },
  ],
  context: { instruments: [{ symbol: "BRD", role: "spx", name: "S&P 500", change_1d_pct: 0.25, from_high_pct: -1.5 }, { symbol: "CSH", role: "cash", name: "Cash" }] },
};

test("counts, movers and sectors come from the day changes of our names only", () => {
  const d = marketDay(market, wl, bench);
  assert.equal(d.date, "2026-10-07");
  assert.deepEqual([d.names, d.counted, d.rose, d.fell, d.flat], [5, 5, 2, 2, 1]);
  assert.deepEqual(d.risers.map((m) => m.symbol), ["CCC", "AAA"]);
  assert.deepEqual(d.fallers.map((m) => m.symbol), ["EEE", "BBB"]);
  assert.deepEqual(d.sectors.map((s) => [s.sector, s.avg, s.n]), [["Health Care", 3, 1], ["Information Technology", 0.5, 2], ["Utilities", -2, 2]]);
  assert.deepEqual(d.spx, { name: "S&P 500", pct: 0.25, fromHigh: -1.5 });
  assert.deepEqual(d.bench, { symbol: "IDX", label: "The index", pct: 0.5 });
  assert.equal(d.breadth, 60);
});

test("risers and fallers stop at three", () => {
  const many = { ...market, symbols: ["AAA", "BBB", "CCC", "DDD", "EEE"].map((s, i) => ({ symbol: s, change_1d_pct: i + 1 })) };
  const d = marketDay(many, wl, bench);
  assert.deepEqual(d.risers.map((m) => m.symbol), ["EEE", "DDD", "CCC"]);
  assert.deepEqual(d.fallers, []);
});

test("older data without a day change gives nulls, not zeros", () => {
  const old = { as_of: "2026-10-01", symbols: [{ symbol: "AAA" }], context: { instruments: [{ role: "spx", name: "S&P 500", from_high_pct: -2 }] } };
  const d = marketDay(old, wl, bench);
  assert.equal(d.counted, 0);
  assert.equal(d.spx.pct, null);
  assert.equal(d.spx.fromHigh, -2);
  assert.equal(d.bench, null);
  assert.deepEqual(d.sectors, []);
  assert.equal(marketDay(null, wl, bench), null);
  assert.equal(marketDay({ as_of: "2026-10-01", symbols: [] }, wl, bench).spx, null);
});

test("sector names shorten for one line on a phone", () => {
  assert.equal(shortSector("Information Technology"), "Tech");
  assert.equal(shortSector("Utilities"), "Utilities");
});
