import test from "node:test";
import assert from "node:assert/strict";
import { basketSeries, weeklyStats } from "./stats.js";
import { bestChanges, halvesCheck, prepare, rank, scoreMix, searchMixes, standing } from "./mix.js";

// Deterministic synthetic weekly history (indexed to 100): no data files needed.
function history(names = 9, weeks = 200, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const members = {};
  const sectors = {};
  for (let i = 0; i < names; i++) {
    const sym = `N${i}`;
    sectors[sym] = `S${i % 3}`;
    const v = [100];
    for (let k = 1; k < weeks; k++) v.push(v[k - 1] * (1 + 0.003 + 0.02 * (rnd() - 0.5) * (1 + i / 4)));
    members[sym] = v;
  }
  return { weekly: { dates: Array.from({ length: weeks }, (_, k) => `d${k}`), members }, sectors };
}

const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };

test("a mix scores exactly like basketSeries and weeklyStats (the Portfolio card)", () => {
  const { weekly } = history();
  const symbols = Object.keys(weekly.members);
  const prep = prepare(weekly, symbols);
  for (const names of [["N0", "N3", "N5"], ["N1", "N2", "N4", "N6", "N8"], ["N7"]]) {
    const w = Object.fromEntries(names.map((s) => [s, 1 / names.length]));
    const ref = weeklyStats(basketSeries(weekly, w), 20);
    const got = scoreMix(prep, names.map((s) => symbols.indexOf(s)));
    assert.ok(Math.abs(got.cagr - ref.cagr) < 1e-9, `cagr ${got.cagr} vs ${ref.cagr}`);
    assert.ok(Math.abs(got.dd - ref.maxDD) < 1e-9, `drop ${got.dd} vs ${ref.maxDD}`);
  }
});

test("the search tries every combination once, and the sector cap is respected", () => {
  const { weekly, sectors } = history();
  const symbols = Object.keys(weekly.members);
  const prep = prepare(weekly, symbols);
  const all = searchMixes(prep, sectors, { k: 4 });
  assert.equal(all.length, choose(9, 4));
  assert.equal(new Set(all.map((m) => m.idx.join(","))).size, all.length);
  const capped = searchMixes(prep, sectors, { k: 4, cap: 2 });
  assert.ok(capped.length < all.length && capped.length > 0);
  for (const m of capped) {
    const c = {};
    for (const i of m.idx) c[sectors[symbols[i]]] = (c[sectors[symbols[i]]] ?? 0) + 1;
    assert.ok(Math.max(...Object.values(c)) <= 2);
  }
});

test("ranking, standing and the halves check behave", () => {
  const { weekly, sectors } = history();
  const prep = prepare(weekly, Object.keys(weekly.members));
  const all = searchMixes(prep, sectors, { k: 3 });
  const best = rank(all, "profit")[0];
  assert.ok(all.every((m) => m.cagr <= best.cagr));
  assert.equal(standing(all, "profit", best.cagr), ((all.length - all.filter((m) => m.cagr >= best.cagr).length) / all.length) * 100);
  assert.ok(standing(all, "profit", -1e9) === 0 && standing(all, "profit", 1e9) === 100);
  const smooth = rank(all, "smooth")[0];
  assert.ok(all.every((m) => m.dd <= smooth.dd + 1e-12));
  const h = halvesCheck(all);
  assert.ok(h.medianPercentile >= 0 && h.medianPercentile <= 100 && h.rankCorrelation >= -1 && h.rankCorrelation <= 1);
});

test("best changes: add when there is room, swap when full, never break the cap", () => {
  const { weekly, sectors } = history();
  const symbols = Object.keys(weekly.members);
  const prep = prepare(weekly, symbols);
  const add = bestChanges(prep, sectors, ["N0", "N1"], { slots: 3, cap: 2, measure: "profit" });
  assert.ok(add.changes.length > 0 && add.changes.every((c) => c.kind === "add" && c.names.length === 3));
  const swap = bestChanges(prep, sectors, ["N0", "N1", "N2"], { slots: 3, cap: 1, measure: "profit" });
  assert.ok(swap.changes.every((c) => c.kind === "swap" && c.names.length === 3));
  for (const c of swap.changes) assert.equal(new Set(c.names.map((s) => sectors[s])).size, 3); // cap 1: one per sector
  const f = (c) => c.score.cagr;
  for (let i = 1; i < swap.changes.length; i++) assert.ok(f(swap.changes[i - 1]) >= f(swap.changes[i]));
});
