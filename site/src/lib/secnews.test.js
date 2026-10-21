import test from "node:test";
import assert from "node:assert/strict";
import { headlineFor, newsRows, recentFilings, shortDay } from "./secnews.js";

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

test("recentFilings: current reports of our names in the last few days, newest per company", () => {
  const d = { companies: [
    doc.companies[0],
    { symbol: "BBB", filings: [{ date: "2026-10-08", form: "6-K", items: [], titles: ["Shared an update with investors"], kind: "update", url: "u4" }] },
    { symbol: "CCC", filings: [{ date: "2026-10-09", form: "10-Q", items: [], titles: ["Quarterly report"], kind: "report", url: "u5" }] },
    { symbol: "DDD", filings: [{ date: "2026-09-01", form: "8-K", items: ["5.02"], titles: ["Leadership change"], kind: "people", url: "u6" }] },
  ] };
  const r = recentFilings(d, { today: "2026-10-10" });
  assert.deepEqual(r.map((x) => [x.symbol, x.date, x.title]), [["AAA", "2026-10-09", "Shared an update with investors"], ["BBB", "2026-10-08", "Shared an update with investors"]]);
  assert.deepEqual(recentFilings(d, { today: "2026-10-10", symbols: ["BBB"] }).map((x) => x.symbol), ["BBB"]);
  assert.deepEqual(recentFilings(d, { today: "2026-10-20" }), []);
  assert.deepEqual(recentFilings(null, { today: "2026-10-10" }), []);
});

test("Hebrew: the badge word, the short day and the title", async () => {
  const { kindOf } = await import("./secnews.js");
  const h = headlineFor(doc, "AAA", "he");
  assert.equal(h.word, "תוצאות");
  assert.equal(h.day, "1 באוק׳");
  assert.equal(h.title, "תוצאות רבעוניות");
  assert.equal(h.tone, "accent");
  assert.equal(newsRows(doc, "AAA", 1, "he")[0].word, "עדכון");
  assert.equal(shortDay("2026-01-05", "he"), "5 בינו׳");
  assert.deepEqual(kindOf("nope", "he"), {});
});

test("Hebrew: the fixed filing titles by item code or form; unknown ones stay as published", async () => {
  const { titlesIn } = await import("./secnews.js");
  assert.deepEqual(titlesIn(doc.companies[0].filings[1], "he"), ["תוצאות רבעוניות", "עדכון למשקיעים"]);
  assert.deepEqual(titlesIn(doc.companies[0].filings[1]), ["Quarterly results", "Shared an update with investors"]);
  assert.deepEqual(titlesIn({ form: "10-K", items: [], titles: ["Yearly report"] }, "he"), ["דוח שנתי"]);
  assert.deepEqual(titlesIn({ form: "8-K/A", items: ["5.02"], titles: ["Correction to an earlier filing: a leadership change (an executive or board member)"] }, "he"),
    ["תיקון לדיווח קודם: שינוי בהנהלה (מנהל בכיר או חבר דירקטוריון)"]);
  assert.deepEqual(titlesIn({ form: "8-K", items: ["9.99"], titles: ["Something new"] }, "he"), ["Something new"]);
  assert.deepEqual(titlesIn({ form: "8-K", titles: ["No codes"] }, "he"), ["No codes"]);
  assert.equal(headlineFor(doc, "AAA", "he").title, "תוצאות רבעוניות");
  assert.equal(newsRows(doc, "AAA", 2, "he")[1].title, "תוצאות רבעוניות · עדכון למשקיעים");
  assert.equal(recentFilings(doc, { today: "2026-10-10", lang: "he" })[0].title, "עדכון למשקיעים");
});
