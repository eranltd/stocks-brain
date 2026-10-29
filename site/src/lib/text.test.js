import { test } from "node:test";
import assert from "node:assert/strict";
import { interpolate, placeholders, plural, strings, tableProblems } from "./text.js";
import shell from "../text/shell.js";
import home from "../text/home.js";
import stock from "../text/stock.js";
import plan from "../text/plan.js";
import learn from "../text/learn.js";
import arena from "../text/arena.js";

const TABLES = { shell, home, stock, plan, learn, arena };
const textOf = (v) => (typeof v === "string" ? v : Object.values(v).join(" "));

const TABLE = { hi: "Hello {name}", days: { one: "{count} day", other: "{count} days" }, picks: { zero: "No picks", one: "One pick", other: "{count} picks" } };

test("strings: fills placeholders, leaves a missing value visible, marks a missing key", () => {
  const t = strings(TABLE);
  assert.equal(t("hi", { name: "AAA" }), "Hello AAA");
  assert.equal(t("hi"), "Hello {name}");
  assert.equal(t("nope"), "[nope]");
  assert.equal(t.has("hi"), true);
  assert.equal(t.has("nope"), false);
  assert.equal(strings(TABLE), t, "the same table gives the same function");
});

test("strings: plurals pick zero, one or other by vars.count", () => {
  const t = strings(TABLE);
  assert.deepEqual([1, 2, 5].map((count) => t("days", { count })), ["1 day", "2 days", "5 days"]);
  assert.deepEqual([0, 1, 3].map((count) => t("picks", { count })), ["No picks", "One pick", "3 picks"]);
  assert.equal(t("days", { count: 0 }), "0 days", "no zero form: other");
  assert.equal(plural(1, { one: "a", other: "b" }), "a");
  assert.equal(interpolate("{a}-{b}", { a: 1, b: "x" }), "1-x");
  assert.deepEqual(placeholders("{a} and {b}"), ["a", "b"]);
});

test("t.parts keeps raw values for rich text", () => {
  const el = { type: "strong" };
  assert.deepEqual(strings(TABLE).parts("hi", { name: el }), ["Hello ", el]);
});

for (const [area, table] of Object.entries(TABLES)) {
  test(`${area}: every text is a non-empty string or plural, in English letters`, () => {
    assert.deepEqual(tableProblems(table), []);
    for (const [k, v] of Object.entries(table)) assert.doesNotMatch(textOf(v), /[\u0590-\u05FF]/, k);
  });
}

test("tableProblems catches the mistakes it is meant to catch", () => {
  const errs = tableProblems({ a: "", b: 3, c: { one: "x", two: "y", other: "z" } });
  assert.ok(errs.some((e) => /a is empty/.test(e)));
  assert.ok(errs.some((e) => /b is neither/.test(e)));
  assert.ok(errs.some((e) => /unknown plural form "two"/.test(e)));
});

test("the not-advice notice says what the owner asked for", () => {
  // The title is always shown with the body and with the compact line, so it counts as part of the notice.
  const all = `${shell["notAdvice.title"]} ${shell["notAdvice.body"]} ${shell["notAdvice.compact"]}`.toLowerCase();
  for (const w of ["educational research notebook", "not investment advice", "investment marketing", "portfolio management", "Israel Securities Authority", "Past results do not promise future results", "licensed"])
    assert.ok(all.includes(w.toLowerCase()), `the notice mentions "${w}"`);
  assert.doesNotMatch(all, /section|§/i, "no law section number");
});

test("no advice wording in any table", () => {
  for (const [area, table] of Object.entries(TABLES))
    for (const [k, v] of Object.entries(table)) assert.doesNotMatch(textOf(v), /buy signal|recommend|you should buy/i, `${area}.${k}`);
});
