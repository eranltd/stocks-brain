import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_ON, bands, candleGeom, chartSummary, fitDomain, indexAt, keepClear, levelWeight, linePath, monthTicks, moveBetween, niceStep,
  niceTicks, overlayLines, RANGES, scaleLinear, spreadLabels, tickLabel, tipRows, volTop, volWords, windowOf,
} from "./candles.js";

// A small doc in the published shape: percent from the last close, last close 0.
function mkSeries(n, { start = "2026-01-02", weekly = false } = {}) {
  const dates = [], o = [], h = [], l = [], c = [], vol = [], ma = [], rsi = [];
  const d = new Date(start + "T00:00:00Z");
  for (let i = 0; i < n; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + (weekly ? 7 : 1));
    const close = i === n - 1 ? 0 : -(n - 1 - i) * 0.5;
    c.push(close); o.push(close - 0.3); h.push(close + 0.6); l.push(close - 0.8);
    vol.push(i < 20 ? null : 1 + (i % 3) * 0.2); ma.push(i < 19 ? null : close - 2); rsi.push(i < 14 ? null : 55);
  }
  return { dates, o, h, l, c, vol_rel: vol, ma20: ma, rsi };
}
const doc = {
  symbol: "XYZ", as_of: "2026-06-30", sample: true, basis: "percent from the last close",
  daily: mkSeries(130), weekly: { ...mkSeries(60, { weekly: true }), partial: true },
  overlays: {
    support: [{ pct: -1.01, touches: 2 }, { pct: -7.37, touches: 1 }], resistance: [{ pct: 3.2, touches: 3 }],
    gaps: [{ from_pct: -6, to_pct: -4.5, where: "below", since_date: "2026-05-01" }],
    stop_pct: 2.43, tp1_pct: 4.86, tp2_pct: 7.29, rr_tp1: 2, fits_house_rule: true,
  },
};

test("windows: 3M is the last 63 days, 6M all of them, weekly about a year; arrays stay aligned", () => {
  const w3 = windowOf(doc, "3m"), w6 = windowOf(doc, "6m"), ww = windowOf(doc, "w");
  assert.equal(w3.n, 63); assert.equal(w3.from, 67); assert.equal(w3.dates.length, 63); assert.equal(w3.c.at(-1), 0);
  assert.equal(w6.n, 130); assert.equal(w6.from, 0);
  assert.equal(ww.n, 52); assert.equal(ww.weekly, true); assert.equal(ww.partial, true);
  for (const w of [w3, w6, ww]) for (const k of ["o", "h", "l", "c", "vol_rel", "ma20", "rsi", "move"]) assert.equal(w[k].length, w.n, k);
  // The first visible candle still has a move: it is computed on the full series.
  assert.ok(Number.isFinite(w3.move[0]));
  assert.equal(w6.move[0], null);
  assert.equal(windowOf(doc, "nonsense").range, "3m");
  assert.equal(windowOf({ daily: { dates: [] } }, "3m"), null);
});

test("a short history is shown as it is, never padded", () => {
  const short = { ...doc, daily: mkSeries(40) };
  assert.equal(windowOf(short, "3m").n, 40);
  assert.equal(windowOf(short, "6m").n, 40);
});

test("moves between closes given as percent from the last close", () => {
  assert.equal(moveBetween(0, 0), 0);
  assert.ok(Math.abs(moveBetween(-10, 0) - 11.111) < 0.001); // from 90 to 100
  assert.ok(Math.abs(moveBetween(10, 0) + 9.0909) < 0.001); // from 110 to 100
  assert.equal(moveBetween(null, 0), null);
});

test("nice steps and ticks; 0 is a tick whenever it is in range", () => {
  assert.equal(niceStep(10, 4), 2.5);
  assert.equal(niceStep(33, 4), 10);
  assert.equal(niceStep(0.8, 4), 0.2);
  const { ticks, step } = niceTicks(-31.8, 1.1, 4);
  assert.equal(step, 10);
  assert.deepEqual(ticks, [-30, -20, -10, 0]);
  assert.ok(niceTicks(-0.7, 0.4, 4).ticks.includes(0));
  assert.equal(tickLabel(0, 5), "0%");
  assert.equal(tickLabel(-10, 5), "−10%");
  assert.equal(tickLabel(2.5, 2.5), "+2.5%");
  assert.equal(tickLabel(0.2, 0.2), "+0.2%");
});

test("linear scale maps both ends and inverts for a y axis", () => {
  const y = scaleLinear(-10, 10, 200, 0);
  assert.equal(y(-10), 200); assert.equal(y(10), 0); assert.equal(y(0), 100);
  assert.equal(scaleLinear(1, 1, 0, 50)(1), 0);
});

test("domain: candles and 0 always fit; near overlays join, far ones go off the chart", () => {
  const win = windowOf(doc, "3m");
  const plain = fitDomain(win, []);
  assert.ok(plain.lo < Math.min(...win.l) && plain.hi > 0.6);
  const near = fitDomain(win, [4.86, -2.43]);
  assert.ok(near.hi > 4.86 && near.off.length === 0);
  const far = fitDomain(win, [400, -2.43]);
  assert.deepEqual(far.off, [400]);
  assert.ok(far.hi < 100);
});

test("overlay lines are the doc's numbers; the stop is drawn below the close", () => {
  const { lines, bands: b } = overlayLines(doc.overlays, ALL_ON);
  const by = Object.fromEntries(lines.map((l) => [l.id, l]));
  assert.equal(by.stop.v, -2.43); assert.equal(by.stop.tag, "−2.4%");
  assert.equal(by.tp1.v, 4.86); assert.equal(by.tp2.tag, "+7.3%");
  assert.equal(by.close.v, 0);
  assert.equal(by.s0.v, -1.01); assert.equal(by.s0.name, "Support · 2 touches");
  assert.equal(by.s1.name, "Support · 1 touch");
  assert.equal(by.r0.v, 3.2); assert.equal(by.r0.touches, 3);
  assert.deepEqual(b, [{ id: "g0", from: -6, to: -4.5, where: "below", since: "2026-05-01" }]);
  const off = overlayLines(doc.overlays, { ...ALL_ON, risk: false, levels: false, gaps: false });
  assert.deepEqual(off, { lines: [], bands: [] });
  assert.deepEqual(overlayLines(null), { lines: [], bands: [] });
  assert.deepEqual([1, 2, 3, 5].map(levelWeight), [1, 1.5, 2, 2]);
});

test("a target set at a resistance is one line named for both", () => {
  const ov = { ...doc.overlays, resistance: [{ pct: 4.86, touches: 2 }, { pct: 9.1, touches: 1 }] };
  const ids = (o) => overlayLines(ov, o).lines.map((l) => l.id);
  const { lines } = overlayLines(ov, ALL_ON);
  assert.equal(lines.find((l) => l.id === "tp1").name, "TP1 at resistance · 2 touches");
  assert.equal(lines.find((l) => l.id === "tp2").name, "TP2");
  assert.deepEqual(ids(ALL_ON).filter((i) => i.startsWith("r")), ["r1"]);
  // With the risk plan hidden, the resistance is drawn on its own again.
  assert.deepEqual(ids({ ...ALL_ON, risk: false }), ["s0", "s1", "r0", "r1"]);
  // With levels hidden, the target is just the target.
  assert.equal(overlayLines(ov, { ...ALL_ON, levels: false }).lines.find((l) => l.id === "tp1").name, "TP1");
});

test("candle bands: bodies leave a gap, are whole pixels, and are capped", () => {
  const phone3m = bands(63, 0, 258);
  assert.ok(phone3m.body >= 3 && phone3m.body < phone3m.band);
  const phone6m = bands(130, 0, 258);
  assert.equal(phone6m.body, 1);
  for (const n of [20, 52, 63, 130]) for (const w of [258, 330, 700]) assert.equal(bands(n, 0, w).body % 2, 1, `${n}@${w}`);
  const wide = bands(20, 0, 1000);
  assert.equal(wide.body, 11);
  assert.equal(wide.cx(0), 25);
});

test("candle geometry: wick spans high to low, body open to close, up candles hollow when wide enough", () => {
  const win = { o: [1, 2, 0.5], c: [2, 1, 0.5], h: [3, 2.5, 1], l: [0, 0.5, 0] };
  const y = scaleLinear(0, 4, 100, 0);
  const lay = bands(3, 0, 60);
  const up = candleGeom(win, 0, y, lay), down = candleGeom(win, 1, y, lay), doji = candleGeom(win, 2, y, lay);
  assert.equal(up.up, true); assert.equal(up.hollow, true);
  assert.equal(up.y, y(2)); assert.equal(up.h, y(1) - y(2));
  assert.equal(up.wickTop, y(3)); assert.equal(up.wickBot, y(0));
  assert.equal(down.up, false); assert.equal(down.hollow, false);
  assert.equal(doji.h, 1);
  assert.equal(candleGeom(win, 0, y, bands(3, 0, 6)).hollow, false); // too thin to be hollow
});

test("hit-testing snaps to the candle under the pointer and clamps", () => {
  assert.equal(indexAt(0, 10, 4, 63), 0);
  assert.equal(indexAt(10 + 4 * 5.5, 10, 4, 63), 5);
  assert.equal(indexAt(9999, 10, 4, 63), 62);
  assert.equal(indexAt(5, 10, 4, 0), null);
});

test("month labels at the first candle of each month, thinned, with the year on January", () => {
  const dates = ["2025-12-29", "2025-12-30", "2026-01-02", "2026-01-05", "2026-02-02", "2026-02-03", "2026-03-02"];
  assert.deepEqual(monthTicks(dates, (i) => i * 20, 30).map((x) => x.label), ["Jan ’26", "Feb", "Mar"]);
  // At 50px apart, February (40px after January) is dropped; March (80px after) stays.
  assert.deepEqual(monthTicks(dates, (i) => i * 20, 50).map((x) => [x.i, x.label]), [[2, "Jan ’26"], [6, "Mar"]]);
});

test("line paths break at nulls instead of drawing zeros", () => {
  const d = linePath([null, 1, 2, null, 3], (i) => i, (v) => v);
  assert.equal(d, "M1.0,1.0L2.0,2.0M4.0,3.0");
});

test("labels spread to a minimum gap within bounds; colliding names are dropped by priority", () => {
  const s = spreadLabels([{ id: "a", y: 50 }, { id: "b", y: 52 }, { id: "c", y: 98 }], 12, 0, 100);
  const by = Object.fromEntries(s.map((x) => [x.id, x.ty]));
  assert.equal(by.a, 50); assert.equal(by.b, 62); assert.equal(by.c, 98);
  const tight = spreadLabels([{ id: "a", y: 95 }, { id: "b", y: 96 }], 12, 0, 100);
  assert.deepEqual(tight.map((x) => x.ty), [88, 100]);
  const kept = keepClear([{ id: "s", y: 50, prio: 4 }, { id: "stop", y: 55, prio: 1 }, { id: "tp", y: 20, prio: 2 }], 11);
  assert.deepEqual(kept.map((k) => k.id), ["stop", "tp"]);
});

test("relative volume: panel top between 2× and 4×, words with the right period", () => {
  assert.equal(volTop([0.5, 1.2]), 2);
  assert.equal(volTop([2.7]), 3);
  assert.equal(volTop([9]), 4);
  assert.equal(volWords(0.84), "0.84× its 20-day average");
  assert.equal(volWords(1.1, true), "1.10× its 20-week average");
  assert.equal(volWords(null), null);
});

test("tooltip rows: percent from the last close, the move, volume and RSI; the week so far is flagged", () => {
  const ww = windowOf(doc, "w");
  const t = tipRows(ww, ww.n - 1);
  assert.equal(t.partial, true);
  assert.deepEqual(t.ohlc.map((r) => r[0]), ["Open", "High", "Low", "Close"]);
  assert.equal(t.ohlc[3][1], "0.00%");
  assert.equal(t.moveLabel, "Week's move");
  assert.equal(t.move.tone, "accent");
  const w3 = windowOf(doc, "3m");
  const first = tipRows(windowOf(doc, "6m"), 0);
  assert.equal(first.move, null); assert.equal(first.vol, null); assert.equal(first.rsi, null);
  assert.equal(tipRows(w3, 0).moveLabel, "Day's move");
  assert.ok(chartSummary("XYZ", w3).startsWith("XYZ: 63 daily candles as percent from the last close"));
  assert.equal(RANGES.length, 3);
});

test("a stop close to the last close keeps its name; the last close's name gives way", () => {
  const { lines } = overlayLines({ support: [], resistance: [], gaps: [], stop_pct: 0.8, tp1_pct: 2, tp2_pct: 4, rr_tp1: 2.5, fits_house_rule: true });
  const y = (v) => 100 - v * 5;
  const kept = keepClear(lines.map((l) => ({ ...l, y: y(l.v) })), 12).map((l) => l.id);
  assert.ok(kept.includes("stop"));
  assert.ok(!kept.includes("close"));
});
