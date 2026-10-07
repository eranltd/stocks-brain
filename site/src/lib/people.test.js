import test from "node:test";
import assert from "node:assert/strict";
import { callStatus, callsTouching, edgarUrl, groupPeople, joinCalls, ownLinks, recordLine, shortVia } from "./people.js";

test("shortVia drops legal suffixes and 'Capital/Investment Management'", () => {
  assert.equal(shortVia("Pershing Square Capital Management, L.P."), "Pershing Square");
  assert.equal(shortVia("Berkshire Hathaway Inc"), "Berkshire Hathaway");
  assert.equal(shortVia("ARK Investment Management LLC"), "ARK");
  assert.equal(shortVia("Fundsmith LLP"), "Fundsmith");
});

test("groupPeople: principles only, 13F filers we follow, then teachers", () => {
  const g = groupPeople([
    { id: "a", status: "following", holdings_13f: { cik: "0000000001" } },
    { id: "b", status: "following", holdings_13f: null },
    { id: "c", status: "principles_only", holdings_13f: null },
  ]);
  assert.deepEqual([g.investors.map((p) => p.id), g.teachers.map((p) => p.id), g.principles.map((p) => p.id)], [["a"], ["b"], ["c"]]);
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
