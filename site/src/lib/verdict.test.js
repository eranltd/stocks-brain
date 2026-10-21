import test from "node:test";
import assert from "node:assert/strict";
import { hasHebrew, stripBidi } from "./i18n.js";
import { addTradingDays, changes, headline, pickEli5, runEli5, scorecard, steadyRuns, verdictHistory, verdictOf } from "./verdict.js";

const pick = (ticker, stance = "neutral", conviction = "low", eli5) => ({
  id: `x:${ticker}`, pick: { ticker, stance, conviction, thesis: `${ticker} first reason. Second reason.`, invalidation: "A close below its trend.", risks: ["r"], evidence: [], ...(eli5 ? { eli5 } : {}) },
});
const run = (date, ...picks) => ({ date, status: "ok", summary: "In its own words.", picks });

test("headline says what the brain decided, short", () => {
  assert.equal(headline(run("2026-10-12", pick("AAA"), pick("BBB"))), "No single stock stands out. The plan stays the weekly buy of the whole market.");
  assert.equal(headline(run("2026-10-12")), "No single stock stands out. The plan stays the weekly buy of the whole market.");
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

/* ------------------------------------------------------------------ Hebrew */

const he = (s) => stripBidi(s);

test("Hebrew: the headline, whole sentences with a count in Hebrew grammar", () => {
  assert.equal(he(headline(run("2026-10-12"), "he")), "אף מניה לא בולטת. התוכנית לא משתנה: הקנייה השבועית בקרן על כל השוק.");
  assert.equal(he(headline(run("2026-10-12", pick("AAA", "bullish")), "he")), "יש מניה אחת שהמוח אוהב קצת, רק בכסף מדומה.");
  assert.equal(he(headline(run("2026-10-12", pick("AAA", "bullish"), pick("BBB", "bullish")), "he")), "יש שתי מניות שהמוח אוהב קצת, רק בכסף מדומה.");
  assert.equal(he(headline(run("2026-10-12", pick("AAA", "bearish"), pick("BBB", "bearish"), pick("CCC", "bearish")), "he")), "המוח מודאג מ-3 מניות.");
  assert.match(he(headline(run("2026-10-12", pick("AAA", "bullish"), pick("BBB", "bearish")), "he")), /^יש מניות שהמוח אוהב/);
  assert.match(he(headline({ date: "2026-10-12", status: "failed", picks: [] }, "he")), /לא סיים/);
  // the numbers sit in isolation marks so they keep their own direction inside the Hebrew line
  assert.notEqual(headline(run("2026-10-12", pick("AAA", "bearish"), pick("BBB", "bearish"), pick("CCC", "bearish")), "he"), "המוח מודאג מ-3 מניות.");
});

test("Hebrew: simple words for the run and each stock, tickers kept in Latin letters", () => {
  const r = run("2026-10-12", pick("AAA"), pick("BBB"));
  assert.equal(he(runEli5(r, (x) => x, "he")), "המוח בדק מקרוב את AAA ו-BBB. הוא לא יכול לדעת מי מהן תצליח יותר מהאחרות, כמו לנחש מי ינצח במרוץ לפני שהוא מתחיל. לכן התוכנית ממשיכה לקנות את הקרן הגדולה שמחזיקה את כל השוק, ובתוכה גם את כולן.");
  assert.match(he(runEli5(run("2026-10-12", pick("AAA", "bullish")), (x) => x, "he")), /^המוח בדק מקרוב את AAA, ויש לו ניחוש/);
  assert.equal(runEli5({ ...r, eli5: "Own words." }, (x) => x, "he"), "Own words.", "the brain's own words stay as written");
  assert.equal(he(pickEli5(pick("AAA", "bullish").pick, "Alpha", "he")), "המוח חושב ש-Alpha אולי תצליח קצת יותר מהשוק כולו. זה רק ניחוש, ולכן הוא בודק אותה קודם בכסף מדומה.");
  assert.match(he(pickEli5(pick("AAA", "bearish").pick, "Alpha", "he")), /^המוח חושב ש-Alpha אולי תצליח פחות/);
  assert.match(he(pickEli5(pick("AAA").pick, "Alpha", "he")), /^Alpha: המוח לא יכול לדעת/);
  assert.ok(pickEli5(pick("AAA").pick, "Alpha", "he").includes("\u2068Alpha\u2069"), "the name is isolated");
});

test("Hebrew: what changed, and the scorecard", () => {
  const a = run("2026-10-08", pick("AAA"), pick("BBB"), pick("CCC"));
  const b = run("2026-10-09", pick("AAA", "bullish"), pick("BBB", "neutral", "medium"), pick("DDD"));
  const c = he(changes(b, a, (x) => x, "he").line);
  assert.match(c, /המוח התחיל לעקוב אחרי DDD\./);
  assert.match(c, /המוח הפסיק לדבר על CCC\./);
  assert.match(c, /המוח שינה את דעתו על AAA: קודם קשה לדעת, עכשיו נטייה לעלייה\./);
  assert.match(c, /לגבי BBB: עכשיו ביטחון בינוני \(קודם ביטחון נמוך\)\./);
  assert.equal(he(changes(a, a, (x) => x, "he").line), "שום דבר לא השתנה מהפעם הקודמת. אותן מניות, אותן תשובות.");
  assert.match(he(changes(a, null, (x) => x, "he").line), /התשובה הראשונה/);

  assert.equal(he(scorecard([], [{ verdict: "hit" }, { verdict: "miss" }, { verdict: "hit" }], 20, null, "he").line), "עד עכשיו 2 מתוך 3 הניחושים שנבדקו היו נכונים.");
  assert.equal(he(scorecard([], [{ verdict: "hit" }, { verdict: "miss" }], 20, null, "he").line), "עד עכשיו ניחוש אחד מתוך 2 שנבדקו היה נכון.");
  assert.equal(he(scorecard([], [{ verdict: "miss" }], 20, null, "he").line), "עד עכשיו אף אחד מתוך 1 הניחושים שנבדקו לא היה נכון.");
  assert.equal(he(scorecard([], [], 20, null, "he").line), "למוח עוד אין אף ניחוש.");
  const early = scorecard([run("2026-10-02", pick("AAA"))], [], 20, null, "he");
  assert.equal(early.next, "2026-10-30");
  assert.match(he(early.line), /^מוקדם מדי לדעת\..* ב-30 באוקטובר 2026\.$/);
});

test("Hebrew: verdictOf words, while the brain's own text stays as written", () => {
  const v = verdictOf(run("2026-10-12", pick("AAA", "bearish", "high")), null, { names: { AAA: "Alpha Inc" }, today: "2026-10-13", lang: "he" });
  assert.equal(v.when, "אתמול");
  assert.equal(v.rows[0].mood, "נטייה לירידה");
  assert.equal(v.rows[0].sure, "ביטחון גבוה");
  assert.equal(v.rows[0].level, "high");
  assert.equal(v.rows[0].thesis, "AAA first reason. Second reason.");
  assert.equal(v.summary, "In its own words.");
  assert.ok(hasHebrew(v.headline) && hasHebrew(v.eli5) && hasHebrew(v.changes.line));
  for (const s of [v.headline, v.eli5, v.changes.line, v.rows[0].eli5]) assert.doesNotMatch(s, /מומלץ|המלצ|כדאי לקנות/);
});
