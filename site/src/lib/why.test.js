import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIDENCE, NOT_A_TRADE, confidenceOf, dateOf, isBehind, noteDay, noteForMover, notesForDay, notesForSymbol, noteView,
  sectorOf, sourcesOf, usableWhy, whoOf, whyClause,
} from "./why.js";

const src = (published, publisher = "Example Wire") => ({ url: `https://github.com/example/${published}`, publisher, published });
const doc = {
  version: 1, as_of: "2026-10-09", sample: false,
  notes: [
    { key: "stock:AAA", kind: "stock", market: "main", market_date: "2026-10-09", symbols: ["AAA"], move_pct: -13.2,
      headline: "A rival agreed to buy airwaves that could make it a new competitor.", why: "A rival company agreed to buy phone airwaves.",
      confidence: "clear", sources: [src("2026-10-09", "Wire One"), src("2026-10-08")], researched_at: "2026-10-10T05:00:00Z" },
    { key: "fund:FFF", kind: "fund", market: "funds", market_date: "2026-10-09", symbols: ["FFF"], move_pct: 2.1,
      headline: "Lower interest rate hopes lifted the group", why: "", confidence: "likely", sources: [src("2026-10-09")] },
    { key: "sector:Utilities", kind: "sector", market: "main", market_date: "2026-10-09", symbols: ["BBB", "CCC"], move_pct: -3.1,
      headline: "Nothing clear", why: "We found no allow-listed source that explains this move.", confidence: "unclear", sources: [] },
    { key: "stock:AAA:old", kind: "stock", market: "main", market_date: "2026-09-20", symbols: ["AAA"], move_pct: 4,
      headline: "An older story", why: "", confidence: "mystery", sources: [] },
    { key: "stock:AAA:ancient", kind: "stock", market: "main", market_date: "2026-08-01", symbols: ["AAA"], move_pct: 5,
      headline: "A story from long ago", why: "", confidence: "clear", sources: [] },
    { key: "broken", kind: "stock", market: "main", symbols: ["AAA"], move_pct: 5, headline: "", why: "" },
  ],
};

test("usableWhy: absent or malformed is null; sample notes never show next to live prices", () => {
  assert.equal(usableWhy(null), null);
  assert.equal(usableWhy({ notes: "x" }), null);
  assert.equal(usableWhy(doc, true), doc);
  const sample = { ...doc, sample: true };
  assert.equal(usableWhy(sample, true), null);
  assert.equal(usableWhy(sample, false), sample);
});

test("dateOf and confidenceOf fall back safely", () => {
  assert.equal(dateOf({ market_date: "2026-10-01" }, doc), "2026-10-01");
  assert.equal(dateOf({}, doc), "2026-10-09");
  assert.equal(dateOf({}, {}), null);
  assert.equal(confidenceOf({ confidence: "likely" }), "likely");
  assert.equal(confidenceOf({ confidence: "certain" }), "unclear");
  assert.equal(noteDay("2026-10-09"), "Oct 9");
  assert.equal(noteDay("soon"), "");
});

test("notesForDay: biggest first; a sector note stays with its own market; broken notes drop", () => {
  assert.deepEqual(notesForDay(doc, "2026-10-09").map((n) => n.key), ["stock:AAA", "sector:Utilities", "fund:FFF"]);
  assert.deepEqual(notesForDay(doc, "2026-10-09", { market: "funds" }).map((n) => n.key), ["stock:AAA", "fund:FFF"]);
  assert.deepEqual(notesForDay(doc, "2026-10-08"), []);
  assert.deepEqual(notesForDay(null, "2026-10-09"), []);
  // a note without its own market_date takes the file's as_of
  const old = { as_of: "2026-10-02", notes: [{ key: "k", kind: "stock", symbols: ["AAA"], headline: "h", move_pct: 1 }] };
  assert.equal(notesForDay(old, "2026-10-02")[0].market_date, "2026-10-02");
});

test("notesForSymbol: that name's notes within thirty days, newest first, never a sector average", () => {
  assert.deepEqual(notesForSymbol(doc, "AAA", { today: "2026-10-17" }).map((n) => n.key), ["stock:AAA", "stock:AAA:old"]);
  assert.deepEqual(notesForSymbol(doc, "AAA", { today: "2026-10-17", days: 10 }).map((n) => n.key), ["stock:AAA"]);
  assert.deepEqual(notesForSymbol(doc, "BBB", { today: "2026-10-17" }), []);
  assert.equal(notesForSymbol(doc, "AAA").length, 3, "without a date, every note of the name");
});

test("noteForMover: only that name on that very day (an older note never explains a newer move)", () => {
  assert.equal(noteForMover(doc, { symbol: "AAA", date: "2026-10-09" }).key, "stock:AAA");
  assert.equal(noteForMover(doc, { symbol: "AAA", date: "2026-10-12" }), null);
  assert.equal(noteForMover(doc, { symbol: "BBB", date: "2026-10-09" }), null, "a sector note is not pinned on one name");
  assert.equal(noteForMover(null, { symbol: "AAA", date: "2026-10-09" }), null);
});

test("isBehind: the market has a newer day than the notes", () => {
  assert.equal(isBehind(doc, "2026-10-12"), true);
  assert.equal(isBehind(doc, "2026-10-09"), false);
  assert.equal(isBehind(null, "2026-10-12"), false);
});

test("whyClause: why, likely why, or an honest no clear cause; no trailing stop", () => {
  const [clear, fund, sector, old] = doc.notes;
  assert.equal(whyClause(clear), "why: A rival agreed to buy airwaves that could make it a new competitor");
  assert.equal(whyClause(fund), "likely why: Lower interest rate hopes lifted the group");
  assert.equal(whyClause(sector), "no clear cause has been found yet");
  assert.equal(whyClause(old), "no clear cause has been found yet", "an unknown confidence reads as unclear");
  assert.equal(whyClause(null), "");
  assert.equal(CONFIDENCE.unclear.lead, null);
  assert.match(NOT_A_TRADE, /not a reason to trade/);
});

test("sources: https only, publisher or host, short day", () => {
  const s = sourcesOf({ sources: [src("2026-10-09", "Wire One"), { url: "http://github.com/x", publisher: "Plain" }, { url: "https://github.com/y", published: "2026-10-08" }] });
  assert.deepEqual(s, [
    { url: "https://github.com/example/2026-10-09", publisher: "Wire One", day: "Oct 9" },
    { url: "https://github.com/y", publisher: "github.com", day: "Oct 8" },
  ]);
  assert.deepEqual(sourcesOf(null), []);
});

test("who: a name, names, or a sector of the list", () => {
  const names = { AAA: "Alpha", BBB: "Beta", CCC: "Gamma" };
  const groups = { BBB: "Utilities", CCC: "Utilities", AAA: "Information Technology" };
  assert.equal(whoOf(doc.notes[0], { names }), "Alpha");
  assert.equal(whoOf({ kind: "stock", symbols: ["AAA", "BBB", "CCC"] }, { names }), "Alpha", "the others are funds that moved with it");
  assert.equal(sectorOf({ key: "sector:Communication Services", symbols: ["BBB"] }, groups), "Communication Services");
  assert.equal(whoOf(doc.notes[2], { names, groups, short: (s) => s.slice(0, 4) }), "Util companies on the list");
  assert.equal(sectorOf({ sector: "Energy", symbols: ["BBB"] }, groups), "Energy");
  assert.equal(whoOf({ kind: "sector", symbols: ["ZZZ"] }, { groups }), "One group of companies on the list");
  assert.equal(whoOf({ kind: "fund", symbols: ["ZZZ"], name: "Zeta Fund" }, { names }), "Zeta Fund", "another list's fund by its recorded name");
  assert.equal(whoOf({ kind: "fund", symbols: ["ZZZ"] }, { names }), "ZZZ");
  assert.equal(whoOf({ kind: "fund", symbols: ["BBB"] }, { names: { BBB: "Beta-100 (BBB proxy)" } }), "Beta-100", "no provider suffix");
});

test("noteView: ready to show, unclear says so", () => {
  const v = noteView(notesForDay(doc, "2026-10-09")[1], { names: {}, groups: {} });
  assert.equal(v.key, "2026-10-09:sector:Utilities");
  assert.equal(v.who, "Utilities companies on the list");
  assert.equal(v.unclear, true);
  assert.equal(v.word, "No clear cause found");
  assert.equal(v.day, "Oct 9");
  assert.equal(v.headline, "Nothing clear");
  const c = noteView(notesForDay(doc, "2026-10-09")[0], { names: { AAA: "Alpha" } });
  assert.equal(c.headline, "A rival agreed to buy airwaves that could make it a new competitor");
  assert.equal(c.sources.length, 2);
  assert.equal(c.move_pct, -13.2);
});

/* ------------------------------------------------------------------ Hebrew */

import { stripBidi } from "./i18n.js";
import { notATrade, confidenceWord } from "./why.js";
import { shortSector } from "./marketday.js";

test("Hebrew: the clause, who, the day and the confidence word", () => {
  const [clear, fund, sector] = doc.notes;
  assert.equal(stripBidi(whyClause(clear, "he")), "הסיבה: A rival agreed to buy airwaves that could make it a new competitor");
  assert.match(whyClause(clear, "he"), /⁨A rival/, "the English headline keeps its own direction");
  assert.equal(stripBidi(whyClause(fund, "he")), "הסיבה הסבירה: Lower interest rate hopes lifted the group");
  assert.equal(whyClause(sector, "he"), "עדיין לא נמצאה סיבה ברורה");
  assert.equal(stripBidi(whoOf(sector, { groups: {}, short: shortSector, lang: "he" })), "חברות תשתיות ברשימה");
  assert.equal(whoOf({ kind: "sector", symbols: ["ZZZ"] }, { lang: "he" }), "קבוצת חברות אחת ברשימה");
  assert.equal(whoOf({ kind: "stock", symbols: [] }, { lang: "he" }), "מניה אחת ברשימה");
  assert.equal(whoOf(clear, { names: { AAA: "Alpha" }, lang: "he" }), "Alpha", "a name stays as it is");
  assert.equal(confidenceWord("likely", "he"), "סיבה סבירה");
  assert.equal(confidenceWord("mystery", "he"), "לא נמצאה סיבה ברורה");
  assert.equal(noteDay("2026-10-09", "he"), "9 באוק׳");
  assert.match(notATrade("he"), /לא סיבה לקנות או למכור/);
  assert.equal(notATrade(), NOT_A_TRADE);
  const v = noteView(notesForDay(doc, "2026-10-09")[1], { names: {}, groups: {}, short: shortSector, lang: "he" });
  assert.equal(v.word, "לא נמצאה סיבה ברורה");
  assert.equal(v.day, "9 באוק׳");
  assert.equal(v.headline, "Nothing clear", "the note's own text is left as written");
  assert.equal(sourcesOf({ sources: [src("2026-10-09")] }, "he")[0].day, "9 באוק׳");
});
