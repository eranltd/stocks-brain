import test from "node:test";
import assert from "node:assert/strict";
import { gameRow, historyWords, nextBuyDay, scoreLine, weeklyBuyDay } from "./weekly.js";

test("nextBuyDay is the coming Monday", () => {
  assert.equal(nextBuyDay("2026-10-16"), "2026-10-19"); // Friday
  assert.equal(nextBuyDay("2026-10-19"), "2026-10-19"); // Monday
  assert.equal(nextBuyDay("2026-10-18"), "2026-10-19"); // Sunday
});

test("weeklyBuyDay uses the published holiday-aware date while it is ahead, else the coming Monday", () => {
  const bw = (d, sample = false) => ({ next_weekly_buy: d, sample });
  assert.equal(weeklyBuyDay("2026-10-17", bw("2026-10-19")), "2026-10-19");
  assert.equal(weeklyBuyDay("2026-02-14", bw("2026-02-17")), "2026-02-17"); // Washington's Birthday: Tuesday
  assert.equal(weeklyBuyDay("2026-02-16", bw("2026-02-17")), "2026-02-17"); // on the holiday itself, not "today"
  assert.equal(weeklyBuyDay("2026-10-19", bw("2026-10-19")), "2026-10-19"); // the day itself
  assert.equal(weeklyBuyDay("2026-10-19", bw("2026-10-26")), "2026-10-26"); // after Monday's run
  assert.equal(weeklyBuyDay("2026-10-21", bw("2026-10-19")), "2026-10-26"); // an old file: the coming Monday
  assert.equal(weeklyBuyDay("2026-10-17", bw("2026-12-07")), "2026-10-19"); // too far ahead to be this week's
  assert.equal(weeklyBuyDay("2026-10-17", bw("2026-10-20", true)), "2026-10-19"); // a sample file on a live site
  assert.equal(weeklyBuyDay("2026-10-17", bw("2026-10-20", true), true), "2026-10-20");
  assert.equal(weeklyBuyDay("2026-10-17", null), "2026-10-19");
  assert.equal(weeklyBuyDay("2026-10-17", bw("soon")), "2026-10-19");
});

test("gameRow and scoreLine read the forward ledger", () => {
  const ledger = { dates: ["2026-10-01", "2026-10-02", "2026-10-09"], core: [100, 101, 102],
    rules: { weekly_swing: { started: "2026-10-02", rebalances: [{ date: "2026-10-05", holdings: ["AAA"] }, { date: "2026-10-12", holdings: ["BBB", "CCC"] }], values: [100, 103] } } };
  const r = gameRow(ledger, "weekly_swing", { BBB: "Beta" });
  assert.equal(r.weeks, 2);
  assert.deepEqual(r.holdings.map((h) => h.name), ["Beta", "CCC"]);
  assert.ok(Math.abs(r.market - (102 / 101 - 1) * 100) < 1e-9);
  assert.match(scoreLine(r), /After 2 weeks it is 2\.0 points ahead of the whole market/);
  assert.equal(gameRow(ledger, "five_leaders_weekly"), null);
  assert.match(scoreLine(null), /next weekly review/);
});

test("historyWords: not tested, rejected, passed", () => {
  assert.equal(historyWords(null, "x").tested, false);
  const rr = { satellite: { rules: [{ id: "a", percentile: 12.4, verdict: "rejected" }, { id: "b", percentile: 97, verdict: "passes_history" }] } };
  assert.match(historyWords(rr, "a").line, /beat only 12 out of 100/);
  assert.equal(historyWords(rr, "b").passed, true);
});

test("Hebrew: the scoreboard and history lines, with the dual for two weeks", async () => {
  const { stripBidi } = await import("./i18n.js");
  const { weeklyRule, WEEKLY_RULES } = await import("./weekly.js");
  assert.equal(scoreLine(null, "he"), "הציון יתחיל בסקירה השבועית הבאה.");
  assert.equal(stripBidi(scoreLine({ weeks: 1, ahead: null }, "he")), "שבוע 1: מוקדם מדי לתת ציון. הבדיקה חוזרת כל שבוע.");
  assert.match(stripBidi(scoreLine({ weeks: 2, ahead: 2 }, "he")), /^אחרי שבועיים הכלל מקדים את השוק כולו ב-2\.0 נקודות אחוז\./);
  assert.match(stripBidi(scoreLine({ weeks: 6, ahead: -1.34 }, "he")), /^אחרי 6 שבועות הכלל מפגר אחרי השוק כולו ב-1\.3 נקודות אחוז\./);
  assert.match(scoreLine({ weeks: 3, ahead: 0.2 }, "he"), /בערך שווה לשוק כולו/);
  const rr = { satellite: { rules: [{ id: "a", percentile: 12.4, verdict: "rejected" }, { id: "b", percentile: 97, verdict: "passes_history" }] } };
  assert.match(stripBidi(historyWords(rr, "a", "he").line), /ניצח רק 12 מתוך 100 בחירות אקראיות/);
  assert.match(stripBidi(historyWords(rr, "b", "he").line), /ניצח 97 מתוך 100/);
  assert.equal(weeklyRule("weekly_swing").name, WEEKLY_RULES[0].name);
  assert.equal(weeklyRule("weekly_swing", "he").name, "התנופה השבועית");
  assert.equal(weeklyRule("nope", "he"), null);
});
