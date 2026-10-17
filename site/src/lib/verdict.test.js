import test from "node:test";
import assert from "node:assert/strict";
import { addTradingDays, changes, headline, pickEli5, runEli5, scorecard, steadyRuns, verdictHistory, verdictOf } from "./verdict.js";

const pick = (ticker, stance = "neutral", conviction = "low", eli5) => ({
  id: `x:${ticker}`, pick: { ticker, stance, conviction, thesis: `${ticker} first reason. Second reason.`, invalidation: "A close below its trend.", risks: ["r"], evidence: [], ...(eli5 ? { eli5 } : {}) },
});
const run = (date, ...picks) => ({ date, status: "ok", summary: "In its own words.", picks });

test("headline says what the brain decided, short", () => {
  assert.equal(headline(run("2026-10-12", pick("AAA"), pick("BBB"))), "Do your weekly buy of the whole market. No single stock stands out.");
  assert.equal(headline(run("2026-10-12")), "Do your weekly buy of the whole market. No single stock stands out.");
  assert.match(headline(run("2026-10-12", pick("AAA", "bullish"))), /likes one stock/);
  assert.match(headline(run("2026-10-12", pick("AAA", "bullish"), pick("BBB", "bearish"))), /likes some/);
  assert.match(headline({ date: "2026-10-12", status: "failed", picks: [] }), /did not finish/);
});

test("eli5: the brain's own words first, simple fallback words otherwise", () => {
  assert.equal(runEli5({ ...run("2026-10-12", pick("AAA")), eli5: "Own words for the run." }), "Own words for the run.");
  assert.match(runEli5(run("2026-10-12", pick("AAA"), pick("BBB")), (t) => t.toLowerCase()), /aaa and bbb.*which runner wins/);
  assert.equal(pickEli5(pick("AAA", "neutral", "low", "Kid words.").pick, "Alpha"), "Kid words.");
  assert.match(pickEli5(pick("AAA").pick, "Alpha"), /^Alpha: the brain cannot tell if it will beat the whole market/);

  for (const s of ["bullish", "bearish", "neutral"]) assert.doesNotMatch(pickEli5(pick("AAA", s).pick, "Alpha"), /\d/);
});

test("changes says what is new, gone and different", () => {
  const a = run("2026-10-08", pick("AAA"), pick("BBB"), pick("CCC"));
  const b = run("2026-10-09", pick("AAA", "bullish"), pick("BBB", "neutral", "medium"), pick("DDD"));
  const c = changes(b, a);
  assert.equal(c.same, false);
  assert.match(c.line, /started watching DDD/);
  assert.match(c.line, /stopped talking about CCC/);
  assert.match(c.line, /changed its mind on AAA: from can't tell to thumbs up/);
  assert.match(c.line, /now fairly sure about BBB \(it was not very sure\)/);
  assert.equal(changes(a, a).same, true);
  assert.match(changes(a, null).line, /first answer/);
});

test("steadyRuns counts the unchanged streak ending with the newest run", () => {
  const r = (d, s = "neutral") => run(d, pick("AAA", s));
  assert.equal(steadyRuns([r("2026-10-09"), r("2026-10-06", "bullish"), r("2026-10-07"), r("2026-10-08")]), 3);
  assert.equal(steadyRuns([]), 0);
});

test("scorecard: too early before any score, then right out of checked", () => {
  assert.equal(addTradingDays("2026-10-02", 20), "2026-10-30");
  const early = scorecard([run("2026-10-05", pick("AAA")), run("2026-10-02", pick("AAA"))], [], 20, "2026-10-13");
  assert.equal(early.next, "2026-10-30");
  assert.match(early.line, /Too early to tell/);
  const done = scorecard([], [{ verdict: "hit" }, { verdict: "miss" }, { verdict: "hit" }]);
  assert.equal(done.line, "So far two of its three checked guesses were right.");
});

test("verdictOf and verdictHistory: kid words first, grown-up reason kept, newest first", () => {
  const v = verdictOf(run("2026-10-12", pick("AAA", "neutral", "low", "Kid words.")), null, { names: { AAA: "Alpha Inc" }, today: "2026-10-13" });
  assert.equal(v.when, "yesterday");
  assert.equal(v.rows[0].eli5, "Kid words.");
  assert.equal(v.rows[0].byBrain, true);
  assert.equal(v.rows[0].mood, "Can't tell");
  assert.equal(v.rows[0].thesis, "AAA first reason. Second reason.");
  assert.equal(v.letter, null);
  assert.equal(verdictOf({ ...run("2026-10-12"), letter: "Dear family." }, null).letter, "Dear family.");
  const h = verdictHistory([run("2026-10-09", pick("AAA")), { date: "2026-10-10", status: "failed", picks: [] }, run("2026-10-12", pick("AAA"))]);
  assert.deepEqual(h.map((x) => x.date), ["2026-10-12", "2026-10-09"]);
  assert.equal(h[0].changes.same, true);
});
