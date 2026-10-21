import test from "node:test";
import assert from "node:assert/strict";
import { stripBidi } from "./i18n.js";
import { callerName, callStatus, callsTouching, edgarUrl, groupPeople, isFirmCall, joinCalls, ownLinks, recordLine, shortVia, statusPhrase } from "./people.js";

test("shortVia drops legal suffixes and 'Capital/Investment Management'", () => {
  assert.equal(shortVia("Pershing Square Capital Management, L.P."), "Pershing Square");
  assert.equal(shortVia("Berkshire Hathaway Inc"), "Berkshire Hathaway");
  assert.equal(shortVia("ARK Investment Management LLC"), "ARK");
  assert.equal(shortVia("Fundsmith LLP"), "Fundsmith");
});

test("groupPeople: principles only, then investors by kind, then teachers, educators and writers", () => {
  const g = groupPeople([
    { id: "a", kind: "investor", status: "following", holdings_13f: { cik: "0000000001" } },
    { id: "b", kind: "writer", status: "following", holdings_13f: null },
    { id: "c", kind: "teacher", status: "principles_only", holdings_13f: null },
    { id: "d", kind: "teacher", status: "following", holdings_13f: { cik: "0000000002" } },
  ]);
  assert.deepEqual([g.investors.map((p) => p.id), g.teachers.map((p) => p.id), g.principles.map((p) => p.id)], [["a"], ["b", "d"], ["c"]]);
});

test("a firm's own call names the fund, never the person", () => {
  const p = { name: "Some One" };
  assert.equal(callerName({ via: "Berkshire Hathaway Inc", credit_person: false }, p), "Berkshire Hathaway");
  assert.equal(callerName({ via: "Pershing Square Capital Management, L.P." }, p), "Some One");
  assert.equal(isFirmCall({ credit_person: false }), true);
  assert.equal(isFirmCall({}), false);
  const firm = [{ via: "Berkshire Hathaway Inc" }, { via: "Berkshire Hathaway Inc" }];
  assert.equal(recordLine({ status: "following" }, undefined, 26, 10, firm), "2 Berkshire Hathaway calls logged, scored as the firm's, not as personal picks.");
});

test("ownLinks drops an EDGAR link that repeats the CIK link", () => {
  const p = { holdings_13f: { cik: "0001536411" }, links: [{ url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001536411&type=13F-HR" }, { url: "https://github.com/" }] };
  assert.deepEqual(ownLinks(p).map((l) => l.url), ["https://github.com/"]);
  assert.match(edgarUrl("0001536411"), /CIK=0001536411&type=13F-HR$/);
});

test("recordLine says too few to judge until enough calls have matured", () => {
  const p = { status: "following" };
  assert.equal(recordLine({ status: "principles_only" }, null), "Principles only: no calls to score.");
  assert.equal(recordLine(p, null), "No calls logged yet.");
  assert.equal(recordLine(p, { n: 3, matured_26w: 2, enough: false }), "3 calls logged, 2 half a year old: too few to judge (needs 10).");
  assert.equal(recordLine(p, { n: 12, matured_26w: 10, enough: true, right_26w_pct: 60, median_signed_excess_26w: -1.25 }),
    "12 calls logged, 10 half a year old: right 60% of the time, typical call −1.3% vs the core.");
});

test("callStatus reads the 26-week leg, else maturing, else the reason it is not scored", () => {
  assert.equal(callStatus({ scored: true, w26: { right: true } }).kind, "right");
  assert.equal(callStatus({ scored: true, w26: { right: false } }).kind, "wrong");
  assert.deepEqual(callStatus({ scored: true, w26: null, weeks_since: 19 }), { kind: "maturing", label: "maturing", detail: "19 of 26 weeks" });
  assert.equal(callStatus({ scored: false, reason: "not on our list" }).detail, "not on our list");
});

test("statusPhrase says how a judged call did, or how far a young one has to go", () => {
  assert.equal(statusPhrase({ scored: true, w26: { right: false, signed_excess_pct: -20.06 } }), "judged wrong at 26 weeks, −20.1% for the call vs the core");
  assert.equal(statusPhrase({ scored: true, w26: { right: true, signed_excess_pct: 4.32 } }), "judged right at 26 weeks, +4.3% for the call vs the core");
  assert.equal(statusPhrase({ scored: true, w26: null, weeks_since: 19 }), "maturing, 19 of 26 weeks");
  assert.equal(statusPhrase({ scored: false, reason: "not on our list" }), "not scored: not on our list");
});

test("joinCalls keeps the config note, adds scores by id, and sorts newest first", () => {
  const cfg = { calls: [
    { id: "2025-01-02-x-aaa", date: "2025-01-02", ticker: "AAA", note: "context" },
    { id: "2026-01-02-x-bbb", date: "2026-01-02", ticker: "BBB" },
    { id: "2026-03-02-x-ccc", date: "2026-03-02", ticker: "CCC" },
  ] };
  const scores = { calls: [
    { id: "2025-01-02-x-aaa", scored: true, w26: { right: true } },
    { id: "2026-01-02-x-bbb", scored: false, note: "not on our list" },
  ] };
  const out = joinCalls(cfg, scores);
  assert.deepEqual(out.map((c) => c.ticker), ["CCC", "BBB", "AAA"]);
  assert.equal(out[2].note, "context");
  assert.equal(out[1].reason, "not on our list");
  assert.equal(out[1].note, null);
  assert.equal(out[0].scored, false);
  assert.equal(out[0].reason, "not scored yet");
  assert.equal(joinCalls(cfg, null)[0].reason, "scored after the next daily run");
});

test("callsTouching matches tickers and sorts newest first", () => {
  const calls = [{ ticker: "AAA", date: "2026-05-15" }, { ticker: "BBB", date: "2026-05-15" }, { ticker: "CCC", date: "2026-02-17" }];
  assert.deepEqual(callsTouching(calls, ["CCC", "AAA", "DDD"]).map((c) => c.ticker), ["AAA", "CCC"]);
  assert.deepEqual(callsTouching(calls, []), []);
});

test("in Hebrew the record, status and phrase sentences are whole Hebrew templates with isolated numbers", () => {
  const p = { status: "following" };
  const s = (x) => stripBidi(x);
  assert.equal(s(recordLine({ status: "principles_only" }, null, 26, 10, [], "he")), "רעיונות בלבד: אין עמדות לנקד.");
  assert.equal(s(recordLine(p, null, 26, 10, [], "he")), "עדיין לא נרשמו עמדות.");
  assert.equal(s(recordLine(p, { n: 3, matured_26w: 2, enough: false }, 26, 10, [], "he")), "נרשמו 3 עמדות, 2 מהן בנות חצי שנה: מעט מדי כדי לשפוט (צריך 10).");
  assert.equal(s(recordLine(p, { n: 12, matured_26w: 10, enough: true, right_26w_pct: 60, median_signed_excess_26w: -1.25 }, 26, 10, [], "he")),
    "נרשמו 12 עמדות, 10 מהן בנות חצי שנה: צדקו ב-60% מהפעמים, עמדה טיפוסית −1.3% לעומת השוק כולו.");
  assert.equal(s(recordLine(p, { n: 4, matured_26w: 1, enough: false }, 13, 10, [], "he")), "נרשמו 4 עמדות, 1 מהן בנות 13 שבועות: מעט מדי כדי לשפוט (צריך 10).");
  const firm = [{ via: "Alpha Capital Management LLC" }, { via: "Alpha Capital Management LLC" }];
  assert.equal(s(recordLine(p, undefined, 26, 10, firm, "he")), "נרשמו 2 עמדות של Alpha, והן מנוקדות כשל הקרן, לא כבחירות אישיות.");
  // numbers and percents sit inside isolation marks, so they keep their direction in a right-to-left line
  assert.match(recordLine(p, { n: 12, matured_26w: 10, enough: true, right_26w_pct: 60, median_signed_excess_26w: -1.25 }, 26, 10, [], "he"), /⁦−1\.3%⁩/);
  assert.deepEqual(callStatus({ scored: true, w26: null, weeks_since: 19 }, 26, "he"), { kind: "maturing", label: "מבשילה", detail: "⁦19⁩ מתוך ⁦26⁩ שבועות" });
  assert.equal(callStatus({ scored: true, w26: { right: true } }, 26, "he").label, "צדקה");
  assert.equal(s(statusPhrase({ scored: true, w26: { right: false, signed_excess_pct: -20.06 } }, 26, "he")), "נשפטה אחרי 26 שבועות: טעתה, −20.1% לטובת העמדה לעומת השוק כולו");
  assert.equal(s(statusPhrase({ scored: true, w26: null, weeks_since: 19 }, 26, "he")), "מבשילה, 19 מתוך 26 שבועות");
  assert.equal(s(statusPhrase({ scored: false, reason: "not on the list" }, 26, "he")), "לא נוקדה: not on the list");
  assert.equal(s(statusPhrase({ scored: false }, 26, "he")), "לא נוקדה");
  const cfg = { calls: [{ id: "x", date: "2026-01-02", ticker: "AAA" }] };
  assert.equal(joinCalls(cfg, null, "he")[0].reason, "תנוקד אחרי הריצה היומית הבאה");
  assert.equal(joinCalls(cfg, { calls: [] }, "he")[0].reason, "עוד לא נוקדה");
});
