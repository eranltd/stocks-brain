import test from "node:test";
import assert from "node:assert/strict";
import { lastCandle, spotlightItems, yearRise } from "./spotlight.js";

const row = (symbol, a, b) => ({ symbol, series: [{ date: "2025-10-01", v: a }, { date: "2026-10-01", v: b }] });

test("yearRise reads the series start and end", () => {
  assert.equal(yearRise(row("AAA", 100, 150)), 50);
  assert.equal(yearRise({ series: [] }), null);
});

test("spotlightItems ranks by the year's rise, in words, against the group", () => {
  const view = {
    id: "chips", benchmark: "GRP",
    market: { symbols: [row("AAA", 100, 120), row("BBB", 100, 180), row("CCC", 100, 90), row("GRP", 100, 140)] },
    watchlist: { symbols: [{ symbol: "AAA" }, { symbol: "BBB" }, { symbol: "CCC" }, { symbol: "DDD" }] },
    names: { AAA: "Alpha", BBB: "Beta" }, checklist: null,
  };
  const items = spotlightItems(view, { BBB: "x.json" });
  assert.deepEqual(items.map((x) => x.ticker), ["BBB", "AAA", "CCC", "DDD"]);
  assert.equal(items[0].tag, "Biggest rise of the past year");
  assert.equal(items[1].tag, "Second-biggest rise of the past year");
  assert.equal(items[2].tag, "lower than a year ago");
  assert.equal(items[3].tag, "no year of prices yet");
  assert.match(items[0].plain, /rose more than chip makers as a group/);
  assert.match(items[1].plain, /did worse than/);
  assert.equal(items[0].hasChart, true);
  assert.equal(items[1].hasChart, false);
  for (const it of items) assert.doesNotMatch(`${it.tag} ${it.plain ?? ""}`, /\d/);
});

test("lastCandle: green when the newest candle closed at or above its open", () => {
  assert.equal(lastCandle({ ok: [true, true, false], o: [0, -2, null], c: [1, -1, null] }), "green");
  assert.equal(lastCandle({ ok: [true], o: [1], c: [0] }), "red");
  assert.equal(lastCandle({ ok: [false], o: [null], c: [null] }), null);
});

test("Hebrew: ranks, tags and the year line in words", async () => {
  const { stripBidi } = await import("./i18n.js");
  const view = {
    id: "chips", benchmark: "GRP",
    market: { symbols: [row("AAA", 100, 120), row("BBB", 100, 180), row("CCC", 100, 90), row("GRP", 100, 140)] },
    watchlist: { symbols: [{ symbol: "AAA" }, { symbol: "BBB" }, { symbol: "CCC" }, { symbol: "DDD" }] },
    names: { AAA: "Alpha", BBB: "Beta" }, checklist: { symbols: [{ symbol: "BBB", score: { verdict: "lean_up" } }] },
  };
  const items = spotlightItems(view, {}, "he");
  assert.deepEqual(items.map((x) => x.tag), ["העלייה הגדולה ביותר בשנה האחרונה", "העלייה השנייה בגודלה בשנה האחרונה", "נמוכה יותר מלפני שנה", "עדיין אין מחירים של שנה שלמה"]);
  assert.equal(stripBidi(items[0].plain), "בשנה האחרונה היא עלתה יותר מאשר יצרניות השבבים כקבוצה. עלייה בעבר אינה מבטיחה עלייה בעתיד.");
  assert.match(items[1].plain, /הצליחה פחות מאשר/);
  assert.equal(items[0].chip.word, "נטייה לעלייה");
  for (const it of items) assert.doesNotMatch(`${it.tag} ${it.plain ?? ""}`, /\d/);
});
