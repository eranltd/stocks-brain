import test from "node:test";
import assert from "node:assert/strict";
import {
  advance, biggestDrop, DROP_FLOOR, endSummary, frameAt, highlights, leaders, lerp, MAX_FRAME_MS, monthsSpanned, monthWord, MODES,
  pctWords, raceData, raceSummary, REPLAY_MS, replaySeries, sinceWords, spanWords, standings, tipLabel, toneOf,
} from "./replay.js";
import { hasHebrew, stripBidi } from "./i18n.js";

// Made-up names only: AAA, BBB, ... and an index IDX. Closes are percent from the last close, as published.
function series(closes, { start = "2026-04-01", step = 1, partial = false } = {}) {
  const dates = [], d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < closes.length; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + step);
  }
  const c = closes;
  return { dates, o: c.map((v) => v - 0.2), h: c.map((v) => v + 0.5), l: c.map((v) => v - 0.6), c, ma20: c.map((v) => v - 1), vol_rel: c.map(() => 1), rsi: c.map(() => 50), ...(partial ? { partial } : {}) };
}
// 140 daily closes: from -20% (vs the last close) up to 0, with a dip in the middle.
const daily = Array.from({ length: 140 }, (_, i) => (i === 139 ? 0 : -20 + (i / 139) * 20 - (i >= 60 && i < 75 ? 6 : 0)));
const doc = { symbol: "AAA", daily: series(daily), weekly: series(Array.from({ length: 60 }, (_, i) => -10 + i / 6), { start: "2025-09-05", step: 7, partial: true }) };

test("the replay series: the last 130 days (or all 60 weeks), re-based so the first close is 0", () => {
  const s = replaySeries(doc, "daily");
  assert.equal(s.n, 130);
  assert.equal(s.dates.length, 130);
  assert.equal(s.dates[0], doc.daily.dates[10]);
  assert.equal(s.c[0], 0);
  // From -20 + 10/139*20 (vs the last close) to 0 is the same rise whichever base it is told from.
  const c0 = doc.daily.c[10];
  assert.ok(Math.abs(s.c.at(-1) - ((100 / (100 + c0)) - 1) * 100) < 1e-9);
  for (const k of ["o", "h", "l", "c", "ma20"]) assert.equal(s[k].length, 130, k);
  // Every shape is kept: high stays above the close by the same ratio.
  assert.ok(s.h[5] > s.c[5] && s.l[5] < s.c[5]);
  const w = replaySeries(doc, "weekly");
  assert.equal(w.n, 60);
  assert.equal(w.weekly, true);
  assert.equal(w.partial, true);
  assert.equal(replaySeries(doc, "nonsense").mode, "daily");
  assert.equal(replaySeries({ daily: { dates: [] } }, "daily"), null);
  assert.equal(replaySeries(null), null);
  assert.deepEqual(MODES.map((m) => m.n), [130, 60]);
});

test("a short history replays as it is, never padded", () => {
  const s = replaySeries({ daily: series([-3, -1, 0]) }, "daily");
  assert.equal(s.n, 3);
  assert.equal(s.c[0], 0);
});

test("time-based steps: the whole replay takes REPLAY_MS at 1x, a quarter at 4x; a stalled frame never leaps ahead", () => {
  const n = 130;
  let pos = 0, t = 0;
  while (pos < n - 1 && t < 60000) { pos = advance(pos, 16, { n }); t += 16; }
  assert.ok(Math.abs(t - REPLAY_MS) <= 32, `took ${t} ms`);
  pos = 0; t = 0;
  while (pos < n - 1 && t < 60000) { pos = advance(pos, 16, { n, speed: 4 }); t += 16; }
  assert.ok(Math.abs(t - REPLAY_MS / 4) <= 32, `took ${t} ms at 4x`);
  // A background tab comes back after ten seconds: one step of at most MAX_FRAME_MS.
  assert.ok(advance(10, 10000, { n }) - 10 <= (MAX_FRAME_MS * (n - 1)) / REPLAY_MS + 1e-9);
  assert.equal(advance(128.9, 1000, { n, speed: 4 }), n - 1);
  assert.equal(advance(5, -20, { n }), 5);
  assert.equal(advance(0, 16, { n: 1 }), 0);
});

test("frames: the newest whole candle, the fade of the next, the running change and that day's move", () => {
  const s = replaySeries(doc, "daily");
  const f0 = frameAt(s, 0);
  assert.equal(f0.i, 0);
  assert.equal(f0.change, 0);
  assert.equal(f0.move, null);
  assert.equal(f0.tone, "flat");
  const f = frameAt(s, 40.25);
  assert.equal(f.i, 40);
  assert.ok(Math.abs(f.frac - 0.25) < 1e-9);
  assert.equal(f.date, s.dates[40]);
  assert.equal(f.change, s.c[40]);
  assert.ok(f.change > 0 && f.tone === "accent");
  assert.ok(Number.isFinite(f.move));
  const end = frameAt(s, s.n - 1);
  assert.equal(end.last, true);
  assert.equal(end.frac, 0);
  const w = replaySeries(doc, "weekly");
  assert.equal(frameAt(w, w.n - 1).partial, true);
  assert.equal(frameAt(w, 3).partial, false);
  assert.equal(frameAt(s, 9999).i, s.n - 1);
});

test("lerp reads between two published points and never past a missing one", () => {
  assert.equal(lerp([0, 10, 20], 0.5), 5);
  assert.equal(lerp([0, 10, 20], 2), 20);
  assert.equal(lerp([0, null, 20], 0.5), 0);
  assert.equal(lerp([null, 1], 0), null);
});

test("tones follow the sign as it shows", () => {
  assert.equal(toneOf(0.04), "flat");
  assert.equal(toneOf(0.06), "accent");
  assert.equal(toneOf(-2), "down");
  assert.equal(toneOf(null), "flat");
  assert.equal(toneOf(0.4, 0), "flat");
});

test("the biggest drop: high to a later low, as a positive percent", () => {
  // 100 -> 110 -> 99 -> 120 -> 108: the biggest fall is 110 to 99 (10%), not 120 to 108 (10% too, but later and equal).
  const c = [0, 10, -1, 20, 8];
  const d = biggestDrop(c);
  assert.ok(Math.abs(d.pct - 10) < 1e-9);
  assert.equal(d.peak, 1);
  assert.equal(d.trough, 2);
  assert.deepEqual(biggestDrop([0, 1, 2, 3]), { pct: 0, peak: null, trough: null });
  assert.ok(Math.abs(biggestDrop([0, 10, -1, 20, 8], 1).pct) < 1e-9);
});

test("month words and the span, with years only when the span crosses a new year", () => {
  assert.equal(monthWord("2026-08-14"), "August");
  assert.equal(monthWord("2026-08-14", "he"), "אוגוסט");
  assert.equal(monthWord("2025-09-05", "en", true), "September 2025");
  assert.deepEqual(spanWords(["2026-04-16", "2026-10-20"]), { from: "April", to: "October" });
  assert.deepEqual(spanWords(["2025-09-05", "2026-10-20"]), { from: "September 2025", to: "October 2026" });
  assert.equal(sinceWords(["2026-04-16", "2026-10-20"]), "since April");
  assert.equal(sinceWords(["2026-04-16", "2026-10-20"], "he"), "מאז אפריל");
  assert.equal(monthsSpanned(["2026-04-16", "2026-10-20"]), 6);
  assert.equal(monthsSpanned(["2025-09-05", "2026-10-20"]), 13);
  assert.equal(monthsSpanned([]), 0);
});

test("percent words: no sign, whole from 10 up, left to right in Hebrew", () => {
  assert.equal(pctWords(18.24), "18%");
  assert.equal(pctWords(-9.06), "9.1%");
  assert.equal(pctWords(9.96), "10%");
  assert.equal(pctWords(4.01), "4%");
  assert.equal(stripBidi(pctWords(4.31, "he")), "4.3%");
  assert.notEqual(pctWords(4.31, "he"), "4.3%");
});

// A series that rises 18% from April to October with a 9% fall from a July high to an August low.
function story() {
  const dates = ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-20", "2026-08-10", "2026-09-01", "2026-10-01"];
  const c = [0, 4, 8, 10, 0.1, 9, 18];
  return { n: c.length, dates, c, o: c, h: c, l: c, ma20: c, weekly: false, partial: false, mode: "daily" };
}

test("the end line says what happened, from the data, in English", () => {
  assert.equal(endSummary(story(), "AAA"), "From April to October, AAA rose 18%, with its biggest drop of 9% between July and August.");
  const s = story();
  s.dates[3] = "2026-08-03";
  assert.equal(endSummary(s, "AAA"), "From April to October, AAA rose 18%, with its biggest drop of 9% in August.");
  const down = { ...story(), c: [0, -2, -5, -8, -12, -14, -15] };
  assert.equal(endSummary(down, "BBB"), "From April to October, BBB fell 15%, with its biggest drop of 15% between April and October.");
  const calm = { ...story(), c: [0, 0.1, 0.2, 0.3, 0.3, 0.2, 0.3] };
  assert.equal(endSummary(calm, "CCC"), "From April to October, CCC ended about where it started (+0.3%), without a drop of 1% or more along the way.");
  const years = { ...story(), dates: ["2025-09-05", ...story().dates.slice(1, 6), "2026-10-20"] };
  assert.match(endSummary(years, "AAA"), /^From September 2025 to October 2026, AAA rose 18%/);
  assert.equal(endSummary(null, "AAA"), "");
  assert.equal(DROP_FLOOR, 1);
});

test("the end line in Hebrew: the same facts, the numbers and the name keep their direction", () => {
  const he = endSummary(story(), "AAA", "he");
  assert.ok(hasHebrew(he));
  assert.equal(stripBidi(he), "מאפריל עד אוקטובר, AAA עלתה ב-18%, והירידה הגדולה ביותר שלה, 9%, הייתה בין יולי לאוגוסט.");
  assert.ok(he.includes("⁦"), "percents are isolated left to right");
  const s = story();
  s.dates[3] = "2026-08-03";
  assert.equal(stripBidi(endSummary(s, "AAA", "he")), "מאפריל עד אוקטובר, AAA עלתה ב-18%, והירידה הגדולה ביותר שלה, 9%, הייתה באוגוסט.");
  const down = { ...story(), c: [0, -2, -5, -8, -12, -14, -15] };
  assert.match(stripBidi(endSummary(down, "BBB", "he")), /BBB ירדה ב-15%/);
  const calm = { ...story(), c: [0, 0.1, 0.2, 0.3, 0.3, 0.2, 0.3] };
  assert.equal(stripBidi(endSummary(calm, "CCC", "he")), "מאפריל עד אוקטובר, CCC סיימה בערך באותה רמה שבה התחילה (+0.3%), בלי ירידה של 1% או יותר בדרך.");
});

test("the end line never uses advice words or price levels", () => {
  for (const lang of ["en", "he"]) {
    const s = endSummary(story(), "AAA", lang);
    assert.doesNotMatch(s, /buy|sell|recommend|should|\$|מומלץ|כדאי|המלצ/i);
  }
});

/* ---------------------------------------------------------------- the race */

function sym(symbol, values, start = "2025-10-08") {
  const d = new Date(`${start}T00:00:00Z`);
  return {
    symbol,
    series: values.map((v) => {
      const p = { date: d.toISOString().slice(0, 10), v };
      d.setUTCDate(d.getUTCDate() + 1);
      return p;
    }),
  };
}
const N = 12;
const ramp = (end) => Array.from({ length: N }, (_, i) => 100 + (end - 100) * (i / (N - 1)));
const market = [
  sym("AAA", ramp(150)), sym("BBB", ramp(80)), sym("CCC", ramp(120)), sym("DDD", ramp(105)),
  sym("EEE", ramp(95)), sym("FFF", ramp(130)), sym("IDX", ramp(110)),
  // Starts a day late: it cannot start with the others, so it is left out.
  sym("LATE", ramp(200).slice(1), "2025-10-09"),
];
const names = { AAA: "Alpha", BBB: "Bravo Industries Holdings", CCC: "Charlie", DDD: "Delta", EEE: "Echo", FFF: "Foxtrot", IDX: "Index" };
const race = raceData(market, { order: ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "LATE"], bench: "IDX", name: (s) => names[s] ?? s });

test("race data: list order, the benchmark apart, every line starting at 0 on the benchmark's dates", () => {
  assert.equal(race.n, N);
  assert.deepEqual(race.lines.map((l) => l.symbol), ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]);
  assert.equal(race.bench.symbol, "IDX");
  for (const l of [...race.lines, race.bench]) {
    assert.equal(l.values.length, N);
    assert.equal(l.values[0], 0);
  }
  assert.ok(Math.abs(race.lines[0].values.at(-1) - 50) < 1e-9);
  assert.ok(Math.abs(race.lines[1].values.at(-1) + 20) < 1e-9);
  assert.equal(race.lines[0].name, "Alpha");
  // A missing day keeps the last close; nothing is invented between.
  const gap = raceData([sym("IDX", ramp(110)), { symbol: "AAA", series: sym("AAA", ramp(150)).series.filter((_, i) => i !== 5) }], { order: ["AAA"], bench: "IDX" });
  assert.equal(gap.lines[0].values[5], gap.lines[0].values[4]);
  assert.equal(raceData([], {}), null);
  // No benchmark: the first member sets the dates.
  assert.equal(raceData(market.slice(0, 2), { order: ["AAA", "BBB"] }).bench, null);
});

test("standings and the leaderboard: by rise so far, highest first", () => {
  const end = leaders(race, N - 1);
  assert.equal(end.length, 5);
  assert.deepEqual(end.map((r) => r.symbol), ["AAA", "FFF", "CCC", "DDD", "EEE"]);
  assert.ok(end[0].rise > end[1].rise);
  // At the start everyone is level: list order breaks the tie.
  assert.deepEqual(standings(race, 0).map((r) => r.symbol), ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]);
  // Between two days the rise is read between them.
  const half = standings(race, 0.5).find((r) => r.symbol === "AAA");
  assert.ok(Math.abs(half.rise - 50 / (N - 1) / 2) < 1e-9);
});

test("highlights: the top and bottom movers over the whole window, in list order", () => {
  assert.deepEqual(highlights(race, 4), ["AAA", "BBB", "EEE", "FFF"]);
  assert.deepEqual(highlights(race, 3), ["AAA", "BBB", "FFF"]);
  assert.deepEqual(highlights(race, 8), ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]);
});

test("tip labels: the short name, or the ticker when the name is long", () => {
  assert.equal(tipLabel("Alpha", "AAA"), "Alpha");
  assert.equal(tipLabel("Bravo Industries Holdings", "BBB"), "BBB");
  assert.equal(tipLabel("Charlie", "CCC", 5), "CCC");
  assert.equal(tipLabel(null, "CCC"), "CCC");
});

test("the race's end line, in English and Hebrew", () => {
  const en = raceSummary(race, "Index");
  assert.equal(en, "From October to October, Alpha finished first (+50.0%) and Bravo Industries Holdings last (−20.0%). The benchmark, Index, rose 10%. 3 of the 6 companies finished ahead of it.");
  const he = stripBidi(raceSummary(race, "Index", "he"));
  assert.equal(he, "מאוקטובר עד אוקטובר, Alpha סיימה ראשונה (+50.0%) ו-Bravo Industries Holdings אחרונה (−20.0%). מדד הייחוס, Index, עלה ב-10%. 3 מתוך 6 החברות סיימו לפניו.");
  const one = raceData([sym("IDX", ramp(140)), sym("AAA", ramp(150)), sym("BBB", ramp(90))], { order: ["AAA", "BBB"], bench: "IDX" });
  assert.match(raceSummary(one, "Index"), /1 of the 2 companies finished ahead of it\.$/);
  assert.match(stripBidi(raceSummary(one, "Index", "he")), /חברה אחת מתוך 2 סיימה לפניו\.$/);
  const none = raceData([sym("IDX", ramp(160)), sym("AAA", ramp(150))], { order: ["AAA"], bench: "IDX" });
  assert.match(raceSummary(none, "Index"), /None of the 1 companies/);
  const fell = raceData([sym("IDX", ramp(90)), sym("AAA", ramp(150))], { order: ["AAA"], bench: "IDX" });
  assert.match(raceSummary(fell, "Index"), /The benchmark, Index, fell 10%\./);
  assert.match(stripBidi(raceSummary(fell, "Index", "he")), /מדד הייחוס, Index, ירד ב-10%\./);
  const noBench = raceData(market.slice(0, 2), { order: ["AAA", "BBB"] });
  assert.doesNotMatch(raceSummary(noBench, "Index"), /benchmark/);
  assert.equal(raceSummary(null, "Index"), "");
});

test("the race's dates cross a new year: the end line names the years", () => {
  const long = raceData([sym("IDX", ramp(110), "2025-12-25"), sym("AAA", ramp(150), "2025-12-25")], { order: ["AAA"], bench: "IDX" });
  assert.match(raceSummary(long, "Index"), /^From December 2025 to January 2026,/);
  assert.match(stripBidi(raceSummary(long, "Index", "he")), /^מדצמבר 2025 עד ינואר 2026,/);
});
