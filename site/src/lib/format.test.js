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
