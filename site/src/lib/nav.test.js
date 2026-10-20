import test from "node:test";
import assert from "node:assert/strict";
import { bottomTap, GROUP_LABEL, hashFor, isRoute, menuGroups, pageOf, parseHash, ROUTES, subjectOf, SUBJECTS } from "./nav.js";

// Every route the site had before the three-subject menu; old links must keep opening the right page. NEW: added since.
const OLD = ["today", "details", "portfolio", "playbook", "people", "watchlist", "track", "kb", "insights", "learnings", "runs", "routines", "how", "admin"];
const NEW = ["verdicts", "quiz"];

test("three subjects hold every old route exactly once, each page with a label and a one-line what's this", () => {
  assert.deepEqual(SUBJECTS.map((s) => s.label), ["Today", "Brain's verdicts", "Experiments", "Learn"]);
  assert.deepEqual([...ROUTES].sort(), [...OLD, ...NEW].sort());
  assert.equal(new Set(ROUTES).size, ROUTES.length);
  for (const s of SUBJECTS) {
    assert.ok(s.what.length > 10 && s.what.endsWith("."), s.id);
    for (const p of s.pages) {
      assert.ok(p.label && p.what.endsWith("."), p.route);
      assert.doesNotMatch(p.what, /\n/);
    }
  }
  assert.equal(SUBJECTS[0].pages[0].route, "today"); // Home first in Today
  assert.equal(SUBJECTS[0].pages[0].label, "Home");
});

test("menu grouping: Learn ends with a small Behind the scenes group, the others have one group", () => {
  assert.deepEqual(menuGroups("today").map((g) => [g.id, g.label, g.pages.map((p) => p.label)]), [
    ["main", null, ["Home", "Stocks", "Market details", "People we learn from"]],
  ]);
  assert.deepEqual(menuGroups("plan")[0].pages.map((p) => p.route), ["portfolio", "playbook", "track"]);
  const learn = menuGroups("learn");
  assert.deepEqual(learn.map((g) => g.label), [null, GROUP_LABEL.behind]);
  assert.deepEqual(learn[0].pages.map((p) => p.label), ["Lessons", "Guess the candle", "Library", "What we learned", "How it works"]);
  assert.deepEqual(learn[1].pages.map((p) => p.route), ["runs", "routines", "admin"]);
  assert.deepEqual(menuGroups("nope"), []);
});

test("route to subject: every page, a stock page under Today (Stocks), unknown routes Home", () => {
  const want = { today: "today", watchlist: "today", details: "today", people: "today", portfolio: "plan", playbook: "plan", track: "plan",
    insights: "learn", quiz: "learn", kb: "learn", learnings: "learn", how: "learn", runs: "learn", routines: "learn", admin: "learn" };
  for (const [r, s] of Object.entries(want)) assert.equal(subjectOf(r), s, r);
  assert.equal(subjectOf("stock/TEVA"), "today");
  assert.equal(pageOf("stock/TEVA").route, "watchlist");
  assert.equal(pageOf("insights").label, "Lessons");
  assert.equal(subjectOf("nowhere"), "today");
  assert.equal(pageOf("nowhere"), null);
});

test("phone bottom bar: Today is one tap Home from elsewhere; inside Today, and for the others, it opens the sheet", () => {
  assert.deepEqual(bottomTap("today", "portfolio"), { go: "today" });
  assert.deepEqual(bottomTap("today", "insights"), { go: "today" });
  assert.deepEqual(bottomTap("today", "today"), { sheet: "today" });
  assert.deepEqual(bottomTap("today", "stock/NVDA"), { sheet: "today" });
  assert.deepEqual(bottomTap("plan", "today"), { sheet: "plan" });
  assert.deepEqual(bottomTap("learn", "runs"), { sheet: "learn" });
  assert.deepEqual(bottomTap("verdicts", "today"), { go: "verdicts" }); // its own tab: always one tap
  assert.deepEqual(bottomTap("verdicts", "verdicts"), { go: "verdicts" });
  assert.equal(subjectOf("verdicts"), "verdicts");
});

test("hash: old links, stock pages and a market in the hash; anything unknown opens Home", () => {
  assert.deepEqual(parseHash("#insights"), { route: "insights", market: null });
  assert.deepEqual(parseHash(""), { route: "today", market: null });
  assert.deepEqual(parseHash("#today?m=tlv"), { route: "today", market: "tlv" });
  assert.deepEqual(parseHash("#stock/TEVA?m=tlv"), { route: "stock/TEVA", market: "tlv" });
  assert.deepEqual(parseHash("#stock/BRK.B"), { route: "stock/BRK.B", market: null });
  assert.deepEqual(parseHash("#watchlist?m=ishares&x=1"), { route: "watchlist", market: "ishares" });
  assert.deepEqual(parseHash("#nope?m=tlv"), { route: "today", market: "tlv" });
  assert.deepEqual(parseHash("#stock/lower"), { route: "today", market: null });
  assert.deepEqual(parseHash("#today?m=<script>"), { route: "today", market: null });
  assert.deepEqual(parseHash("#%E0%A4%A"), { route: "today", market: null }); // malformed escapes do not throw
  assert.equal(parseHash("#today%3Fm%3Dtlv").market, "tlv");
  for (const r of OLD) assert.ok(isRoute(r), r);
  assert.equal(isRoute("stock/TEVA"), true);
  assert.equal(isRoute("market"), false);
});

test("hashFor leaves the default market out and round-trips with parseHash", () => {
  assert.equal(hashFor("today", "nasdaq"), "#today");
  assert.equal(hashFor("today", null), "#today");
  assert.equal(hashFor("today", "tlv"), "#today?m=tlv");
  assert.equal(hashFor("stock/IVV", "ishares", "nasdaq"), "#stock/IVV?m=ishares");
  for (const [r, m] of [["watchlist", "tlv"], ["stock/EIS", "ishares"], ["kb", null]]) assert.deepEqual(parseHash(hashFor(r, m)), { route: r, market: m });
});

test("the menu in Hebrew: the same subjects, pages and routes, every word Hebrew; English stays the default", async () => {
  const { subjectsIn } = await import("./nav.js");
  const { hasHebrew } = await import("./i18n.js");
  assert.equal(subjectsIn(), SUBJECTS);
  assert.equal(subjectsIn("en"), SUBJECTS);
  const he = subjectsIn("he");
  assert.deepEqual(he.map((s) => [s.id, s.direct ?? null, s.pages.map((p) => [p.route, p.group ?? null])]),
    SUBJECTS.map((s) => [s.id, s.direct ?? null, s.pages.map((p) => [p.route, p.group ?? null])]));
  assert.deepEqual(he.map((s) => s.label), ["היום", "הכרעות המוח", "ניסויים", "למידה"]);
  assert.equal(he[1].short, "המוח");
  for (const s of he) {
    assert.ok(hasHebrew(s.label) && hasHebrew(s.what) && s.what.endsWith("."), s.id);
    for (const p of s.pages) assert.ok(hasHebrew(p.label) && hasHebrew(p.what) && p.what.endsWith("."), p.route);
  }
  // Short enough for the header row on a laptop (the core's note: keep the Hebrew menu labels short).
  for (const s of he) assert.ok(s.label.length <= 12, s.label);
  assert.equal(pageOf("insights", "he").label, "שיעורים");
  assert.equal(pageOf("stock/AAA", "he").route, "watchlist");
  assert.equal(pageOf("insights").label, "Lessons");
  const learn = menuGroups("learn", "he");
  assert.deepEqual(learn.map((g) => g.label), [null, "מאחורי הקלעים"]);
  assert.deepEqual(learn[1].pages.map((p) => p.route), ["runs", "routines", "admin"]);
  assert.deepEqual(menuGroups("nope", "he"), []);
});

test("the shell's words speak to any reader: no household phrasing and no advice, in either language", async () => {
  const { default: text } = await import("../i18n/shell.js");
  const all = (d) => Object.values(d).map((v) => (typeof v === "string" ? v : Object.values(v).join(" "))).join("\n");
  assert.doesNotMatch(all(text.en), /household|our family|the wife|\bour\b|what to do with your money|you should/i);
  assert.doesNotMatch(all(text.he), /משק הבית|המשפחה שלנו|האישה|שלנו|מומלץ|המלצ|כדאי לקנות|כדאי למכור/);
});
