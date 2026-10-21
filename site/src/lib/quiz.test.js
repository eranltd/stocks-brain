import test from "node:test";
import assert from "node:assert/strict";
import { AFTER, BEFORE, makeQuestion, rng, scoreWords } from "./quiz.js";
import { findSpots, spotKinds } from "./spots.js";
import { hasHebrew, stripBidi } from "./i18n.js";

function series(n) {
  const d = { dates: [], o: [], h: [], l: [], c: [], vol_rel: [] };
  for (let i = 0; i < n; i++) {
    const b = -10 + i * 0.05;
    d.dates.push(`2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, "0")}`);
    d.o.push(b); d.c.push(b + (i % 2 ? 0.2 : -0.2)); d.h.push(b + 0.5); d.l.push(b - 0.5); d.vol_rel.push(1);
  }
  return d;
}

test("makeQuestion marks a real notable candle with room before and after", () => {
  const d = series(60);
  d.o[40] = -9; d.c[40] = -7; d.h[40] = -6.9; d.l[40] = -9.1; // a big green day
  const q = makeQuestion(d, rng(7));
  const spot = findSpots(d).find((s) => s.i === q.i);
  assert.ok(spot && spot.kind === q.kind);
  assert.ok(q.i >= BEFORE && q.i + AFTER < d.dates.length);
  assert.equal(q.from, q.i - BEFORE);
  assert.equal(q.toAfter, q.i + 1 + AFTER);
  assert.equal(q.choices.length, 4);
  assert.equal(new Set(q.choices.map((c) => c.kind)).size, 4);
  assert.ok(q.choices.some((c) => c.kind === q.kind));
  assert.ok(["higher", "lower"].includes(q.nextWeek));
});

test("no question without a notable candle that fits", () => {
  assert.equal(makeQuestion(series(20), rng(1)), null);
  assert.equal(makeQuestion(null), null);
});

test("scoreWords puts luck beside the score", () => {
  assert.match(scoreWords({ kindRight: 3, kindTried: 8, weekRight: 4, weekTried: 8 }), /3 of 8 \(luck: about 2\).*4 of 8 \(luck: about 4\)/);
  assert.match(scoreWords(null), /No guesses yet/);
});

test("scoreWords and the answer titles speak Hebrew when asked", () => {
  const he = stripBidi(scoreWords({ kindRight: 3, kindTried: 8, weekRight: 4, weekTried: 8 }, "he"));
  assert.equal(he, "הניקוד במכשיר הזה: שמות נרות: 3 מתוך 8 (מזל לבדו: בערך 2); השבוע הבא: 4 מתוך 8 (מזל לבדו: בערך 4).");
  assert.equal(scoreWords(null, "he"), "עדיין אין ניחושים במכשיר הזה.");
  assert.equal(scoreWords({ kindRight: 3, kindTried: 8, weekRight: 4, weekTried: 8 }), "Your score: candle names 3 of 8 (luck: about 2); next week 4 of 8 (luck: about 4).");
  const d = series(60);
  d.o[40] = -9; d.c[40] = -7; d.h[40] = -6.9; d.l[40] = -9.1;
  const en = makeQuestion(d, rng(7));
  const q = makeQuestion(d, rng(7), "he");
  assert.deepEqual(q.choices.map((c) => c.kind), en.choices.map((c) => c.kind));
  const titles = spotKinds("he");
  for (const c of q.choices) assert.equal(c.title, titles[c.kind].title);
  assert.ok(q.choices.every((c) => hasHebrew(c.title)));
});
