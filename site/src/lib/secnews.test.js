import test from "node:test";
import assert from "node:assert/strict";
import { headlineFor, newsRows, shortDay } from "./secnews.js";

const doc = { companies: [{ symbol: "AAA", filings: [
  { date: "2026-10-09", form: "8-K", items: ["7.01"], titles: ["Shared an update with investors"], kind: "update", url: "u1" },
  { date: "2026-10-01", form: "8-K", items: ["2.02", "7.01"], titles: ["Quarterly results", "Shared an update with investors"], kind: "results", url: "u2" },
  { date: "2026-08-01", form: "10-Q", items: [], titles: ["Quarterly report"], kind: "report", url: "u3" },
] }] };

test("headlineFor prefers results within two weeks of the newest filing", () => {
  const h = headlineFor(doc, "AAA");
  assert.equal(h.title, "Quarterly results");
  assert.equal(h.day, "Oct 1");
  assert.equal(h.word, "Results");
  assert.equal(headlineFor(doc, "ZZZ"), null);
});

test("newsRows joins titles and keeps the newest first", () => {
  const r = newsRows(doc, "AAA", 2);
  assert.equal(r.length, 2);
  assert.equal(r[1].title, "Quarterly results · Shared an update with investors");
  assert.equal(shortDay("2026-01-05"), "Jan 5");
});
