import { test } from "node:test";
import assert from "node:assert/strict";
import { dictProblems, hasHebrew, placeholders } from "../lib/i18n.js";
import { GLOSSARY, REQUIRED_TERMS } from "./glossary.js";
import shell from "./shell.js";
import home from "./home.js";
import stock from "./stock.js";
import plan from "./plan.js";
import learn from "./learn.js";

const AREAS = { shell, home, stock, plan, learn };
// Hebrew values allowed without Hebrew letters (a pure ticker, number or Latin name that reads the same in both
// languages), per area: { area: ["key", ...] }. Keep this list short and explicit.
const LATIN_OK = { shell: [], home: [], stock: [], plan: [], learn: [] };

for (const [area, dict] of Object.entries(AREAS)) {
  test(`${area}: en and he have the same keys, no empty texts, Hebrew in he only, matching placeholders`, () => {
    assert.ok(dict && typeof dict.en === "object" && typeof dict.he === "object", `${area} exports { en, he }`);
    assert.deepEqual(dictProblems(dict, { latinOk: LATIN_OK[area] }), []);
  });
}

test("the not-advice notice says what the owner asked for, in both languages", () => {
  const en = `${shell.en["notAdvice.body"]} ${shell.en["notAdvice.compact"]}`;
  for (const w of ["educational research notebook", "not investment advice", "investment marketing", "portfolio management", "Israel Securities Authority", "Past results do not promise future results", "licensed"])
    assert.ok(en.toLowerCase().includes(w.toLowerCase()), `en notice mentions "${w}"`);
  const he = `${shell.he["notAdvice.body"]} ${shell.he["notAdvice.compact"]}`;
  for (const w of ["מחברת מחקר לימודית", "ייעוץ השקעות", "שיווק השקעות", "ניהול תיקי השקעות", "רשות ניירות ערך", "תוצאות עבר אינן מבטיחות", "רישיון"])
    assert.ok(he.includes(w), `he notice mentions "${w}"`);
  assert.doesNotMatch(en + he, /section|סעיף|§/i, "no law section number");
});

test("no advice wording in any dictionary, in either language", () => {
  const bad = /buy signal|recommend|you should buy|מומלץ לקנות|כדאי לקנות|המלצ/i;
  for (const [area, dict] of Object.entries(AREAS)) {
    for (const lang of ["en", "he"]) {
      for (const [k, v] of Object.entries(dict[lang])) {
        const text = typeof v === "string" ? v : Object.values(v).join(" ");
        assert.doesNotMatch(text, bad, `${area}.${lang}.${k}`);
      }
    }
  }
});

test("the glossary covers every required term, once, with Hebrew for each", () => {
  const seen = new Set();
  for (const g of GLOSSARY) {
    assert.ok(g.en && g.he && g.note, `entry ${JSON.stringify(g)} is complete`);
    assert.ok(!seen.has(g.en), `"${g.en}" appears once`);
    seen.add(g.en);
    assert.ok(hasHebrew(g.he), `"${g.en}" has a Hebrew term`);
    assert.ok(!hasHebrew(g.en), `"${g.en}" is English`);
    if (g.pl) assert.ok(hasHebrew(g.pl), `"${g.en}" plural is Hebrew`);
    assert.doesNotMatch(g.he, /מומלץ|המלצ/, g.en);
  }
  for (const r of REQUIRED_TERMS) assert.ok(seen.has(r), `glossary has "${r}"`);
});

test("dictProblems catches the mistakes it is meant to catch", () => {
  const errs = dictProblems({
    en: { a: "Up {pct}", b: "x", c: "", d: "שלום", p: { one: "{count} day", other: "{count} days" } },
    he: { a: "עלתה {pc}", b: "x", c: "ג", p: "ימים", e: "חדש" },
  });
  const has = (re) => errs.some((e) => re.test(e));
  assert.ok(has(/he is missing "d"/));
  assert.ok(has(/en is missing "e"/));
  assert.ok(has(/en\.c is empty/));
  assert.ok(has(/en\.d contains Hebrew/));
  assert.ok(has(/he\.b has no Hebrew/));
  assert.ok(has(/"a" placeholders differ/));
  assert.ok(has(/"p" is a plural in one language only/));
  assert.deepEqual(placeholders("{a} and {b}"), ["a", "b"]);
});
