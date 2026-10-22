import { test } from "node:test";
import assert from "node:assert/strict";
import { englishTitle } from "./format.js";

test("englishTitle keeps the English part of a Hebrew (English) title", () => {
  assert.equal(englishTitle("הגרף הזה (Did this graph signal a bottom?)"), "Did this graph signal a bottom?");
  assert.equal(englishTitle("Plain English title"), "Plain English title");
  assert.equal(englishTitle("Title with (a note)"), "Title with (a note)");
});

test("englishTitle drops Hebrew when there is no English part", () => {
  assert.equal(englishTitle("AI מניות 2026"), "AI 2026");
  assert.equal(englishTitle("מניות"), "Untitled source");
  assert.equal(englishTitle(undefined), "");
});

test("the formatters print what the site always printed", async () => {
  const format = await import("./format.js");
  assert.deepEqual(["2026-10-16", "2026-01-01", "2026-10-16T13:30:00Z"].map((d) => format.fmtDate(d)), ["Fri, 16 Oct 2026", "Thu, 1 Jan 2026", "Fri, 16 Oct 2026"]);
  assert.deepEqual(["2026-10-16", "2026-03-05"].map((d) => format.fmtShort(d)), ["16 Oct", "5 Mar"]);
  assert.deepEqual([0, 1234.5, -3.333, 0.004].map((v) => format.fmtUsd(v)), ["$0.00", "$1,234.50", "-$3.33", "$0.00"]);
  assert.deepEqual([format.fmtNum(1234.567), format.fmtNum(0.5, 0), format.fmtNum(-2.345, 1), format.fmtNum(1e6, 2)], ["1,234.57", "1", "-2.3", "1,000,000.00"]);
  assert.deepEqual([[4.1], [-4.1], [0], [-0.001], [0.004, 2], [12.345, 1], [-0.04, 1], [3, 0]].map((a) => format.fmtPct(...a)),
    ["+4.10%", "−4.10%", "0.00%", "0.00%", "0.00%", "+12.3%", "0.0%", "+3%"]);
  assert.deepEqual([999, 1000, 12345].map((v) => format.fmtK(v)), ["999", "1.0k", "12.3k"]);
  const ref = new Date("2026-10-18T12:00:00Z");
  assert.deepEqual(["2026-10-18", "2026-10-17", "2026-10-10", "2026-08-01", "2026-10-19"].map((d) => format.relDays(d, ref)), ["today", "yesterday", "8 days ago", "1 Aug", "today"]);
  assert.deepEqual([0, 1, 10, 11].map((n) => format.numWord(n)), ["No", "One", "Ten", "11"]);
  assert.equal(format.fmtList(["AAA", "BBB", "CCC"]), "AAA, BBB and CCC");
  // Callers that pass a formatter straight to .map() (index as a later argument) get the same output.
  assert.deepEqual(["2026-10-16"].map(format.fmtShort), ["16 Oct"]);
  assert.deepEqual([1000].map(format.fmtK), ["1.0k"]);
});
