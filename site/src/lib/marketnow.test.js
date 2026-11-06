import test from "node:test";
import assert from "node:assert/strict";
import { fearNeedle, headingOf, moodOf, newsOf, pulseOf, realMoneyKey } from "./marketnow.js";

const live = {
  as_of: "2026-11-06T15:07:00Z", quotes_at: 1793977620, sample: false, mood: "selloff",
  indexes: { AAA: { move_pct: -4.4 }, BBB: { move_pct: -6.5 } },
  fear: { symbol: "FFF", move_pct: 29.7, level: "panic" },
  breadth: { up: 3, down: 18, flat: 0 },
  symbols: [{ symbol: "CCC", list: "nasdaq", move_pct: -2 }, { symbol: "DDD", list: "nasdaq", move_pct: -10.4 }, { symbol: "EEE", list: "energy", move_pct: 3 }, { symbol: "SSS", list: "sectors", move_pct: 20 }],
  company_news: [{ symbol: "DDD", headline: "DDD falls", url: "https://n/1", source: "Wire", at: 5 }, { symbol: "DDD", headline: "Older", url: "https://n/2", source: "Wire", at: 4 }],
  market_news: [{ headline: "Old", url: "https://m/1", source: "Wire", at: 1 }, { headline: "New", url: "https://m/2", source: "Wire", at: 9 }],
};

test("mood: a selloff, a rally, flat, mixed without an index", () => {
  assert.equal(moodOf(2, 19, -4.4), "selloff");
  assert.equal(moodOf(15, 6, 2), "rally");
  assert.equal(moodOf(10, 11, 0.1), "flat");
  assert.equal(moodOf(10, 11, null), "mixed");
});

test("the fear needle goes from calm to panic and stops at the ends", () => {
  assert.equal(fearNeedle(-10), 0);
  assert.equal(fearNeedle(30), 1);
  assert.equal(fearNeedle(50), 1);
  assert.equal(fearNeedle(null), null);
});

test("the hourly pulse: fresh within the hour, movers biggest first with their headline", () => {
  const data = { live, names: { DDD: "Ddd Inc." } };
  const p = pulseOf(data, new Date("2026-11-06T15:30:00Z"));
  assert.equal(p.source, "live");
  assert.equal(p.fresh, true);
  assert.equal(pulseOf(data, new Date("2026-11-06T18:30:00Z")).fresh, false);
  assert.deepEqual(p.movers.map((m) => [m.symbol, m.headline]), [["DDD", "DDD falls"], ["EEE", null], ["CCC", null]]);
  assert.equal(p.movers[0].name, "Ddd Inc.");
  assert.equal(p.fear.level, "panic");
  assert.equal(p.breadth.n, 21);
  // an old pulse gives way to a newer close
  assert.equal(pulseOf({ ...data, market: { as_of: "2026-11-09", symbols: [] } }).source, "close");
});

test("without the pulse: the last close, the index funds and the breadth from the daily data", () => {
  const data = {
    bench: { symbol: "BBB", label: "Index B" },
    market: { as_of: "2026-11-05", context: { instruments: [{ symbol: "AAA", role: "spx", name: "Index A", change_1d_pct: -4.4 }] },
      symbols: [{ symbol: "BBB", change_1d_pct: -6.5 }, { symbol: "CCC", change_1d_pct: 1 }, { symbol: "DDD", change_1d_pct: -10 }] },
  };
  const p = pulseOf(data);
  assert.equal(p.source, "close");
  assert.deepEqual(p.indexes.map((i) => [i.symbol, i.move]), [["AAA", -4.4], ["BBB", -6.5]]);
  assert.deepEqual(p.breadth, { up: 1, down: 1, flat: 0, n: 2 });
  assert.equal(p.mood, "selloff");
  assert.equal(p.fear, null);
});

test("heading and what to do with real money", () => {
  const h = headingOf({ regime: { state: "stressed", trend: "down" }, market: { breadth_above_sma50_pct: 33 } });
  assert.deepEqual(h, { trend: "down", risk: "high", above50: 33 });
  assert.equal(realMoneyKey({ mood: "selloff" }, h), "noPanic");
  assert.equal(realMoneyKey({ mood: "flat" }, h), "steady");
  assert.equal(realMoneyKey({ mood: "up" }, { risk: "normal" }), "nothing");
});

test("news: the pulse's headlines newest first", () => {
  assert.deepEqual(newsOf({ live }).map((n) => n.headline), ["New", "Old"]);
  assert.deepEqual(newsOf({}), []);
});
