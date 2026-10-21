import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectLang, deviceLang, dirOf, fmtDate, fmtList, fmtNum, fmtPct, fmtShort, fmtUsd, formatters, interpolate, LANG_KEY,
  isolate, plural, pluralForm, readLang, relDays, saveLang, stripBidi, translate,
} from "./i18n.js";
import * as format from "./format.js";

const store = (init = {}) => {
  const m = { ...init };
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m };
};
const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };

test("detectLang: a remembered choice, else the device's first language, else English", () => {
  assert.equal(detectLang(store({ [LANG_KEY]: "he" }), ["en-US"]), "he");
  assert.equal(detectLang(store({ [LANG_KEY]: "en" }), ["he-IL"]), "en");
  assert.equal(detectLang(store(), ["he-IL", "en-US"]), "he");
  assert.equal(detectLang(store(), ["he"]), "he");
  assert.equal(detectLang(store(), ["iw-IL"]), "he");
  assert.equal(detectLang(store(), ["en-US", "he-IL"]), "en");
  assert.equal(detectLang(store(), ["hr-HR"]), "en");
  assert.equal(detectLang(store({ [LANG_KEY]: "fr" }), []), "en");
  assert.equal(detectLang(null, undefined), "en");
  assert.equal(detectLang(throwing, "he-IL"), "he");
  assert.equal(deviceLang("he"), "he");
});

test("saveLang remembers only real languages and never throws", () => {
  const s = store();
  saveLang(s, "he");
  assert.equal(s.m[LANG_KEY], "he");
  saveLang(s, "xx");
  assert.equal(s.m[LANG_KEY], "he");
  assert.doesNotThrow(() => saveLang(throwing, "en"));
  assert.doesNotThrow(() => saveLang(null, "en"));
  assert.equal(readLang(throwing), null);
});

test("dirOf", () => {
  assert.equal(dirOf("he"), "rtl");
  assert.equal(dirOf("en"), "ltr");
  assert.equal(dirOf(undefined), "ltr");
});

const DICT = {
  en: { hi: "Hello {name}", up: "Up {pct} today", days: { one: "{count} day", other: "{count} days" }, onlyEn: "Only English", none: { zero: "No picks", one: "One pick", other: "{count} picks" } },
  he: { hi: "שלום {name}", up: "עלתה {pct} היום", days: { one: "יום אחד", two: "יומיים", other: "{count} ימים" }, none: { zero: "אין בחירות", one: "בחירה אחת", other: "{count} בחירות" } },
};

test("translate: English is plain, Hebrew isolates every filled-in value", () => {
  const en = translate(DICT, "en"), he = translate(DICT, "he");
  assert.equal(en("hi", { name: "AAA" }), "Hello AAA");
  assert.equal(he("hi", { name: "AAA" }), "שלום ⁨AAA⁩");
  assert.equal(stripBidi(he("up", { pct: fmtPct(4.1, 1, "he") })), "עלתה +4.1% היום");
  assert.equal(he("hi", { name: "AAA" }, { bidi: false }), "שלום AAA");
  assert.equal(en("hi"), "Hello {name}", "a missing value stays visible");
});

test("translate: plurals, Hebrew two-form, zero, and English fallback for a missing Hebrew key", () => {
  const en = translate(DICT, "en"), he = translate(DICT, "he");
  assert.deepEqual([1, 2, 5].map((count) => en("days", { count })), ["1 day", "2 days", "5 days"]);
  assert.deepEqual([1, 2, 5].map((count) => stripBidi(he("days", { count }))), ["יום אחד", "יומיים", "5 ימים"]);
  assert.equal(en("none", { count: 0 }), "No picks");
  assert.equal(he("none", { count: 0 }), "אין בחירות");
  assert.equal(he("onlyEn"), "Only English");
  assert.equal(he("nope"), "[nope]");
  assert.equal(he.has("hi"), true);
  assert.equal(he.lang, "he");
  assert.equal(translate(DICT, "xx").lang, "en");
});

test("t.parts keeps raw values for rich text", () => {
  const el = { type: "strong" };
  assert.deepEqual(translate(DICT, "en").parts("hi", { name: el }), ["Hello ", el]);
  assert.deepEqual(translate(DICT, "he").parts("hi", { name: "AAA" }), ["שלום ", "⁨AAA⁩"]);
});

test("plural helpers", () => {
  assert.equal(pluralForm("he", 2), "two");
  assert.equal(pluralForm("en", 2), "other");
  assert.equal(pluralForm("he", 1), "one");
  assert.equal(plural("he", 2, { one: "a", other: "b" }), "b", "no two form: other");
  assert.equal(plural("en", 0, { one: "a", other: "b" }), "b", "no zero form: other");
  assert.equal(interpolate("{a}-{b}", { a: 1, b: "x" }, "en"), "1-x");
});

test("English formatters print exactly what the site always printed", () => {
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
  // Callers that pass a formatter straight to .map() (index as a later argument) still get English.
  assert.deepEqual(["2026-10-16"].map(format.fmtShort), ["16 Oct"]);
  assert.deepEqual([1000].map(format.fmtK), ["1.0k"]);
});

test("Hebrew formatters: isolated numbers, Hebrew dates, Hebrew relative words", () => {
  assert.equal(fmtPct(-4.1, 1, "he"), "⁦−4.1%⁩");
  assert.equal(stripBidi(fmtPct(4.1, 1, "he")), "+4.1%");
  assert.equal(stripBidi(fmtNum(1234.5, 1, "he")), "1,234.5");
  assert.equal(stripBidi(fmtUsd(2, "he")), "$2.00");
  assert.equal(fmtDate("2026-10-16", "he"), "יום ו׳, 16 באוקטובר 2026");
  assert.equal(fmtShort("2026-10-16", "he"), "16 באוק׳");
  const ref = new Date("2026-10-18T12:00:00Z");
  assert.deepEqual(["2026-10-18", "2026-10-17", "2026-10-16", "2026-10-10"].map((d) => relDays(d, ref, "he")), ["היום", "אתמול", "לפני יומיים", "לפני 8 ימים"]);
  assert.equal(fmtList(["AAA", "BBB", "CCC"], "he"), "AAA, BBB ו-CCC");
  assert.equal(fmtList(["AAA", "BBB", "CCC"], "en"), "AAA, BBB and CCC");
  const f = formatters("he");
  assert.equal(f.lang, "he");
  assert.equal(stripBidi(f.pct(0)), "0.00%");
  assert.equal(f.numWord(3), "3");
  assert.equal(formatters("en").date("2026-10-16"), "Fri, 16 Oct 2026");
});

test("isolate: a value with letters follows its first letter, a letterless one reads left to right", () => {
  assert.equal(isolate("AAA"), "⁨AAA⁩");
  assert.equal(isolate("+4"), "⁦+4⁩");
  assert.equal(isolate("-3.0"), "⁦-3.0⁩");
  assert.equal(translate({ en: { k: "score {n}" }, he: { k: "ציון {n}" } }, "he")("k", { n: "+4" }), "ציון ⁦+4⁩");
});
