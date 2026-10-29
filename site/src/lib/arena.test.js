import test from "node:test";
import assert from "node:assert/strict";
import {
  BASKET, DAY_MS, MAX_FRAME_MS, SPEEDS, WINDOWS, basketSeries, bestDuel, biggestSwing, breadth, combo, comeback, countUpTo, dayMove,
  daysInFront, duelResult, fibSphere, flowPath, gapAt, heat, leadChangeDays, leadStats, leaderAt, orbitRadius, project, raceSummary,
  raceTiles, rankArrow, rankChanges, ranking, ranksAt, replayMs, sectorFlows, step, turn, wallLists, wallTiles, wildestDay, windowed,
} from "./arena.js";

// Made-up names only (AAA, BBB, ...) and an index IDX. Values are percent from the first day, as lib/replay.js raceData gives.
const dates = (n, start = "2026-01-05") => {
  const out = [], d = new Date(`${start}T00:00:00Z`);
  while (out.length < n) {
    if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};
const race = (lines, bench = null) => {
  const n = lines[0][1].length;
  return {
    dates: dates(n), n,
    lines: lines.map(([symbol, values]) => ({ symbol, name: `${symbol} Inc`, values })),
    bench: bench ? { symbol: "IDX", name: "Index", values: bench, bench: true } : null,
  };
};
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("the clock: time-based steps, the whole replay in n-1 days of DAY_MS at 1x, never a leap after a stall", () => {
  assert.deepEqual(SPEEDS, [1, 2, 4, 8]);
  assert.deepEqual(WINDOWS.map((w) => w.days), [63, 126, 252]);
  const n = 253;
  let pos = 0, t = 0;
  while (pos < n - 1 && t < 1e6) { pos = step(pos, 16, { n }); t += 16; }
  assert.ok(Math.abs(t - replayMs(n)) <= 16, `took ${t}`);
  near(replayMs(n, 8), (252 * DAY_MS) / 8);
  pos = 0; t = 0;
  while (pos < n - 1 && t < 1e6) { pos = step(pos, 16, { n, speed: 8 }); t += 16; }
  assert.ok(Math.abs(t - replayMs(n, 8)) <= 16, `took ${t} at 8x`);
  // A background tab comes back after ten seconds: one capped step.
  near(step(10, 10000, { n }), 10 + MAX_FRAME_MS / DAY_MS);
  assert.equal(step(250, 1000, { n, speed: 8 }), n - 1);
  assert.equal(step(5, -20, { n }), 5);
  assert.equal(step(0, 16, { n: 1 }), 0);
});

test("windowed: the last N days re-based to 0, a short history kept as it is", () => {
  const r = race([["AAA", [0, 10, 21, 10]], ["BBB", [0, -10, -10, 8]]], [0, 5, 5, 5]);
  const w = windowed(r, 2);
  assert.equal(w.n, 3);
  assert.equal(w.days, 2);
  assert.deepEqual(w.dates, r.dates.slice(1));
  near(w.lines[0].values[0], 0);
  near(w.lines[0].values[1], 10); // 110 -> 121 is +10%
  near(w.lines[0].values[2], 0);
  near(w.lines[1].values[2], 20); // 90 -> 108 is +20%
  near(w.bench.values[2], 0);
  assert.equal(windowed(r, 999).n, 4);
  assert.equal(windowed(null, 5), null);
  near(dayMove([0, 10, 21], 2), 10);
  assert.equal(dayMove([0, 10], 0), null);
});

test("ranking: highest first, the ghost bar sorts among them without a rank, ties keep list order", () => {
  const r = race([["AAA", [0, 5, 1]], ["BBB", [0, 5, 9]], ["CCC", [0, -2, 9]]], [0, 6, 1]);
  const day1 = ranking(r, 1);
  assert.deepEqual(day1.map((x) => x.symbol), ["IDX", "AAA", "BBB", "CCC"]);
  assert.deepEqual(day1.map((x) => x.rank), [null, 1, 2, 3]);
  assert.deepEqual(day1.map((x) => x.slot), [0, 1, 2, 3]);
  // Day 0: everything at zero, list order with the ghost last.
  assert.deepEqual(ranking(r, 0).map((x) => x.symbol), ["AAA", "BBB", "CCC", "IDX"]);
  // Day 2: BBB and CCC tie at 9 (list order), the ghost ties AAA at 1 and sorts after it.
  assert.deepEqual(ranking(r, 2).map((x) => x.symbol), ["BBB", "CCC", "AAA", "IDX"]);
  // Fractions read between days.
  near(ranking(r, 1.5).find((x) => x.symbol === "CCC").value, 3.5);
  assert.deepEqual(ranksAt(r, 2), { BBB: 1, CCC: 2, AAA: 3 });
  assert.deepEqual(leaderAt(r, 1), { symbol: "AAA", name: "AAA Inc", value: 5 });
});

test("rank changes: places climbed are positive, only the names that moved, as arrows", () => {
  const r = race([["AAA", [0, 5, 1]], ["BBB", [0, 4, 9]], ["CCC", [0, -2, 9.5]]]);
  const d = rankChanges(ranksAt(r, 1), ranksAt(r, 2));
  assert.deepEqual(d, { CCC: 2, AAA: -2 });
  assert.equal(rankArrow(2), "▲2");
  assert.equal(rankArrow(-1), "▼1");
  assert.equal(rankArrow(0), "");
  assert.deepEqual(rankChanges(null, { AAA: 1 }), {});
});

test("biggest swing, combo and lead stats", () => {
  const r = race([["AAA", [0, 1, 2, 3, 2.5]], ["BBB", [0, -3, -2, 10, 12]]]);
  const s = biggestSwing(r, 3);
  assert.equal(s.symbol, "BBB");
  near(s.move, ((110 / 98) - 1) * 100);
  assert.equal(biggestSwing(r, 0), null);
  assert.equal(combo(r.lines[0].values, 3), 3);
  assert.equal(combo(r.lines[0].values, 4), 0);
  assert.equal(combo(r.lines[1].values, 4), 3);
  assert.equal(combo(r.lines[1].values, 0), 0);
  // Leaders by day: AAA (tie at 0: list order), AAA, AAA, BBB, BBB.
  assert.deepEqual(leadStats(r), { changes: 1, days: { AAA: 3, BBB: 2 } });
});

test("the duel: the gap in points, lead changes (a level day changes nothing), days in front, the result", () => {
  const a = [0, 2, 2, -1, -1, 4, 5];
  const b = [0, 1, 2, 0, -1.02, 3, 1];
  const g = gapAt(a, b, 1);
  assert.equal(g.lead, "a");
  near(g.gap, 1);
  near(gapAt(a, b, 0.5).gap, 0.5);
  assert.equal(gapAt(a, b, 2).lead, null);
  // a leads, level, b leads (day 3), level-ish (0.02 < LEVEL_PTS), a leads again (day 5).
  assert.deepEqual(leadChangeDays(a, b), [3, 5]);
  assert.equal(countUpTo([3, 5], 4), 1);
  assert.equal(countUpTo([3, 5], 5), 2);
  assert.deepEqual(daysInFront(a, b), { a: 3, b: 1 });
  assert.deepEqual(daysInFront(a, b, 3), { a: 1, b: 1 });
  const r = race([["AAA", a], ["BBB", b], ["CCC", a.map((_, i) => -3 * i)]]);
  const res = duelResult(r, "AAA", "BBB");
  assert.equal(res.draw, false);
  assert.equal(res.winner.symbol, "AAA");
  assert.equal(res.loser.symbol, "BBB");
  near(res.gap, 4);
  assert.equal(res.changes, 2);
  assert.equal(duelResult(r, "BBB", "AAA").winner.symbol, "AAA");
  assert.equal(duelResult(r, "AAA", "ZZZ"), null);
  const level = race([["AAA", [0, 1, 2]], ["BBB", [0, 2, 2.01]]]);
  assert.equal(duelResult(level, "AAA", "BBB").draw, true);
  assert.deepEqual(bestDuel(r), ["AAA", "BBB"]);
});

test("comeback: the biggest rise from a low after a real drop; a small dip does not count", () => {
  // 100 -> 120 (peak) -> 90 (low, -25%) -> 135 (+50% from the low) -> 130.
  const v = [0, 20, -10, 35, 30];
  const c = comeback(v);
  assert.equal(c.peak, 1);
  assert.equal(c.low, 2);
  assert.equal(c.high, 3);
  near(c.drop, -25);
  near(c.rise, 50);
  // A 2% dip before a big run is not a comeback.
  assert.equal(comeback([0, 10, 7.8, 40]), null);
  assert.equal(comeback([0, 5, 10]), null);
  assert.equal(comeback([0, 1]), null);
});

test("wildest day and the race summary", () => {
  const r = race([["AAA", [0, 20, -10, 35, 30]], ["BBB", [0, 1, 2, 3, 4]], ["CCC", [0, -1, -2, -3, -40]]], [0, 2, 3, 4, 5]);
  const w = wildestDay(r);
  assert.equal(w.symbol, "AAA");
  assert.equal(w.k, 3);
  near(w.move, 50);
  assert.equal(w.date, r.dates[3]);
  const s = raceSummary(r);
  assert.deepEqual(s.podium.map((x) => x.symbol), ["AAA", "BBB", "CCC"]);
  assert.equal(s.last.symbol, "CCC");
  assert.equal(s.comeback.symbol, "AAA");
  near(s.comeback.rise, 50);
  assert.equal(s.comeback.lowDate, r.dates[2]);
  assert.equal(s.wildest.symbol, "AAA");
  assert.equal(s.top.symbol, "AAA");
  assert.equal(s.bench.beat, 1);
  assert.equal(s.names, 3);
  assert.equal(s.days, 4);
  assert.equal(raceSummary(null), null);
});

test("the paper basket: an even split left alone, from the same percents", () => {
  const r = race([["AAA", [0, 10, 20]], ["BBB", [0, -10, 0]]]);
  const b = basketSeries(r);
  assert.equal(BASKET, 100000);
  near(b[0], 100000);
  near(b[1], 100000);
  near(b[2], 110000);
  near(basketSeries(r, 100)[2], 110);
  assert.deepEqual(basketSeries(null), []);
});

test("heat: the colour step of a day move", () => {
  assert.deepEqual(heat(null), { tone: "none", level: 0 });
  assert.deepEqual(heat(0.05), { tone: "flat", level: 0 });
  assert.deepEqual(heat(0.5), { tone: "up", level: 1 });
  assert.deepEqual(heat(-1), { tone: "down", level: 2 });
  assert.deepEqual(heat(2), { tone: "up", level: 3 });
  assert.deepEqual(heat(-7.5), { tone: "down", level: 4 });
});

test("the wall: every list member once, day moves on the given dates, gaps stay empty", () => {
  const d = ["2026-01-05", "2026-01-06", "2026-01-07"];
  const views = [
    { id: "one", available: true, entry: { label: "One" }, names: { AAA: "Aaa", BBB: "Bbb" }, watchlist: { symbols: [{ symbol: "AAA" }, { symbol: "BBB" }] },
      market: { symbols: [
        { symbol: "AAA", series: [{ date: d[0], v: 100 }, { date: d[1], v: 102 }, { date: d[2], v: 99.96 }] },
        { symbol: "BBB", series: [{ date: d[0], v: 100 }, { date: d[2], v: 110 }] },
        { symbol: "IDX", series: [{ date: d[0], v: 100 }] },
      ] } },
    { id: "two", available: true, entry: { label: "Two" }, names: { AAA: "Aaa", CCC: "Ccc" }, watchlist: { symbols: [{ symbol: "AAA" }, { symbol: "CCC" }] },
      market: { symbols: [{ symbol: "AAA", series: [] }, { symbol: "CCC", series: [{ date: d[1], v: 100 }, { date: d[2], v: 95 }] }] } },
    { id: "off", available: false },
  ];
  const lists = wallLists(views);
  assert.deepEqual(lists.map((l) => [l.id, l.label, l.symbols.map((s) => s.symbol)]), [["one", "One", ["AAA", "BBB"]], ["two", "Two", ["CCC"]]]);
  const groups = wallTiles(lists, d);
  assert.deepEqual(groups.map((g) => g.tiles.map((t) => t.symbol)), [["AAA", "BBB"], ["CCC"]]);
  const [aaa, bbb] = groups[0].tiles;
  assert.equal(aaa.moves[0], null);
  near(aaa.moves[1], 2);
  near(aaa.moves[2], -2);
  assert.equal(bbb.moves[1], null);
  assert.equal(bbb.moves[2], null); // no value the day before
  near(groups[1].tiles[0].moves[2], -5);
  const br = breadth(groups, 2);
  assert.equal(br.up, 0);
  assert.equal(br.down, 2);
  assert.equal(br.top.symbol, "CCC");
  const r = race([["AAA", [0, 10, 21]]]);
  const rt = raceTiles(r);
  assert.equal(rt[0].tiles[0].moves[0], null);
  near(rt[0].tiles[0].moves[2], 10);
});

test("the orbit: points on a sphere, a turn keeps their length, perspective grows what is near", () => {
  const pts = fibSphere(50, 0.8);
  assert.equal(pts.length, 50);
  for (const p of pts) {
    near(Math.hypot(...p), 1, 1e-9);
    assert.ok(Math.abs(p[1]) <= 0.8 + 1e-9);
  }
  const q = turn([1, 0, 0], Math.PI / 2);
  near(q[0], 0, 1e-12);
  near(q[2], -1, 1e-12);
  near(Math.hypot(...turn([0.3, 0.4, 0.5], 1.1, 0.3)), Math.hypot(0.3, 0.4, 0.5));
  const near1 = project([0, 0, 1], { cx: 100, cy: 100, R: 50 }), far = project([0, 0, -1], { cx: 100, cy: 100, R: 50 });
  assert.ok(near1.s > 1 && far.s < 1);
  assert.equal(project([1, 0, 0], { cx: 100, cy: 100, R: 50 }).x, 150);
  assert.equal(orbitRadius(null), 1);
  assert.ok(orbitRadius(2) > 1 && orbitRadius(-2) < 1);
  near(orbitRadius(40), 1.32);
  near(orbitRadius(-40), 0.68);
});

test("flow lines and sector cards", () => {
  assert.equal(flowPath([0, 10], [100, 50]), "M0,10 C50,10 50,50 100,50");
  assert.equal(flowPath([10, 0], [50, 100], true), "M10,0 C10,50 50,50 50,100");
  const r = race([["AAA", [0, 10]], ["BBB", [0, 20]], ["CCC", [0, -4]], ["DDD", [0, 2]], ["EEE", [0, 6]]]);
  const sectors = { AAA: "Tech", BBB: "Tech", CCC: "Health", DDD: "Health", EEE: "Energy" };
  const all = sectorFlows(r, sectors, 6);
  assert.deepEqual(all.map((c) => [c.id, c.members]), [["Health", ["CCC", "DDD"]], ["Tech", ["AAA", "BBB"]], ["Energy", ["EEE"]]]);
  near(all[1].values[1], 15);
  // At most two cards: the biggest group, then everything else pooled.
  const two = sectorFlows(r, sectors, 2);
  assert.deepEqual(two.map((c) => [c.id, c.members.length]), [["Health", 2], ["other", 3]]);
  assert.deepEqual(sectorFlows(null, sectors), []);
});
