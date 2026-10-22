import test from "node:test";
import assert from "node:assert/strict";
import { findSpots, SPOT_KINDS, topSpots, zoomAround } from "./spots.js";

// Quiet days: small bodies, small ranges.
function quiet(n) {
  const w = { dates: [], o: [], h: [], l: [], c: [], vol_rel: [] };
  for (let i = 0; i < n; i++) {
    const base = -10 + i * 0.1;
    w.dates.push(`2026-09-${String(i + 1).padStart(2, "0")}`);
    w.o.push(base); w.c.push(base + (i % 2 ? 0.3 : -0.3)); w.h.push(base + 0.6); w.l.push(base - 0.6); w.vol_rel.push(1);
  }
  return w;
}
const set = (w, i, o, h, l, c) => { w.o[i] = o; w.h[i] = h; w.l[i] = l; w.c[i] = c; };

test("a big green day, a gap down and a busy day are found", () => {
  const w = quiet(20);
  set(w, 10, -9, -6.9, -9.1, -7); // body 2 vs median 0.3
  set(w, 15, -12, -11.6, -12.4, -11.9); // whole day below day 14's low
  w.vol_rel[5] = 2.6;
  const kinds = Object.fromEntries(findSpots(w).map((s) => [s.i, s.kind]));
  assert.equal(kinds[10], "big_green");
  assert.equal(kinds[15], "gap_down");
  assert.equal(kinds[5], "busy");
});

test("a hammer after a fall", () => {
  const w = quiet(12);
  for (let i = 4; i < 9; i++) set(w, i, -10 - i * 0.4, -10 - i * 0.4 + 0.5, -10 - i * 0.4 - 0.5, -10 - i * 0.4 - 0.3);
  set(w, 9, -13.6, -13.5, -15.5, -13.5); // long lower wick, tiny body at the top
  assert.equal(findSpots(w).find((s) => s.i === 9)?.kind, "hammer");
});

test("topSpots keeps the strongest few, numbered in date order, with words and no digits in the reasons", () => {
  const w = quiet(30);
  [3, 8, 13, 18, 23, 27].forEach((i) => set(w, i, -9, -6.9, -9.1, -7));
  const s = topSpots(w, 4);
  assert.equal(s.length, 4);
  assert.deepEqual(s.map((x) => x.n), [1, 2, 3, 4]);
  assert.ok(s.every((x, k) => k === 0 || x.i > s[k - 1].i));
  for (const k of Object.values(SPOT_KINDS)) assert.doesNotMatch(k.why, /\d/);
});

test("zoomAround stays inside the window", () => {
  assert.deepEqual(zoomAround(2, 60, 15), [0, 15]);
  assert.deepEqual(zoomAround(58, 60, 15), [45, 60]);
  assert.deepEqual(zoomAround(30, 60, 15), [23, 38]);
  assert.deepEqual(zoomAround(3, 8, 15), [0, 8]);
});
