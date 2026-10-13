import test from "node:test";
import assert from "node:assert/strict";
import { changes, headline, steadyRuns, verdictHistory, verdictOf } from "./verdict.js";

const pick = (ticker, stance = "neutral", conviction = "low") => ({
  id: `x:${ticker}`, pick: { ticker, stance, conviction, thesis: `${ticker} first reason. Second reason.`, invalidation: "A close below its trend.", risks: [], evidence: [] },
});
const run = (date, ...picks) => ({ date, status: "ok", summary: "In its own words.", picks });

test("headline says what to do in one line", () => {
  assert.match(headline(run("2026-10-12", pick("AAA"), pick("BBB"))), /Watch, don't act/);
  assert.match(headline(run("2026-10-12")), /Nothing clears the bar/);
  assert.match(headline(run("2026-10-12", pick("AAA", "bullish"))), /Leaning up on one name/);
  assert.match(headline(run("2026-10-12", pick("AAA", "bullish"), pick("BBB", "bearish"))), /Mixed/);
  assert.match(headline({ date: "2026-10-12", status: "failed", picks: [] }), /did not finish/);
});

test("changes names what is new, dropped and moved", () => {
  const a = run("2026-10-08", pick("AAA"), pick("BBB"), pick("CCC"));
  const b = run("2026-10-09", pick("AAA", "bullish"), pick("BBB", "neutral", "medium"), pick("DDD"));
  const c = changes(b, a);
  assert.equal(c.same, false);
  assert.match(c.line, /New on the list: DDD\./);
  assert.match(c.line, /No longer on it: CCC\./);
  assert.match(c.line, /AAA moved from just watching to leaning up\./);
  assert.match(c.line, /BBB moved from not sure to fairly sure\./);
  assert.equal(changes(a, a).same, true);
  assert.match(changes(a, null).line, /first run/);
});

test("steadyRuns counts the unchanged streak ending today", () => {
  const r = (d, s = "neutral") => run(d, pick("AAA", s));
  assert.equal(steadyRuns([r("2026-10-06", "bullish"), r("2026-10-07"), r("2026-10-08"), r("2026-10-09")]), 3);
  assert.equal(steadyRuns([]), 0);
});

test("verdictOf and verdictHistory: plain rows, newest first, each against the run before", () => {
  const v = verdictOf(run("2026-10-12", pick("AAA")), null, { names: { AAA: "Alpha Inc" }, today: "2026-10-13" });
  assert.equal(v.when, "yesterday");
  assert.deepEqual(v.rows[0], { ticker: "AAA", name: "Alpha Inc", stance: "just watching", sure: "not sure", tone: "flat",
    why: "AAA first reason.", wrongIf: "A close below its trend." });
  const h = verdictHistory([run("2026-10-09", pick("AAA")), { date: "2026-10-10", status: "failed", picks: [] }, run("2026-10-12", pick("AAA"))]);
  assert.deepEqual(h.map((x) => x.date), ["2026-10-12", "2026-10-09"]);
  assert.equal(h[0].changes.same, true);
});
