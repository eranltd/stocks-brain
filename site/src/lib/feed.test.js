import test from "node:test";
import assert from "node:assert/strict";
import { ago, brainItems, buildFeed, byDay, changeHeadline, checklistItems, collapseChecklist, companyItems, dayMoves, filterFeed, headlineChange, marketItems, peopleItems, unusualItems } from "./feed.js";

// An indexed series from day moves (percent), starting at 100 on 2026-01-01 and stepping one calendar day.
function series(moves, start = "2026-01-01") {
  const out = [{ date: start, v: 100 }];
  const d = new Date(`${start}T00:00:00Z`);
  for (const m of moves) {
    d.setUTCDate(d.getUTCDate() + 1);
    out.push({ date: d.toISOString().slice(0, 10), v: out.at(-1).v * (1 + m / 100) });
  }
  return out;
}
const iso = (k) => { const d = new Date("2026-01-01T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

const wl = { symbols: [{ symbol: "AAA" }, { symbol: "BBB" }, { symbol: "CCC" }] };
const bench = { symbol: "IDX", label: "Index" };
const calm = (n, a = 0.5) => Array.from({ length: n }, (_, i) => (i % 2 ? -a : a));

test("day moves come from the indexed series, and the last close uses the published day change", () => {
  const row = { symbol: "AAA", series: series([1, -2, 3]), last_date: iso(3), change_1d_pct: 3.01 };
  const m = dayMoves(row);
  assert.ok(Math.abs(m[iso(1)] - 1) < 1e-9);
  assert.ok(Math.abs(m[iso(2)] + 2) < 1e-9);
  assert.equal(m[iso(3)], 3.01);
  // A series that ends before the row's last date does not borrow the day change.
  assert.ok(Math.abs(dayMoves({ ...row, last_date: iso(9) })[iso(3)] - 3) < 1e-9);
});

test("market items: one per close, newest dates kept, counts and the biggest mover", () => {
  const market = {
    as_of: iso(20),
    symbols: [
      { symbol: "AAA", series: series([...calm(19), 2]) },
      { symbol: "BBB", series: series([...calm(19), -4]) },
      { symbol: "CCC", series: series([...calm(19), 0]) },
      { symbol: "IDX", series: series([...calm(19), 0.3]) },
    ],
    context: { instruments: [{ role: "spx", name: "S&P 500", change_1d_pct: 0.2 }] },
  };
  const items = marketItems(market, wl, bench, { BBB: "Bee" }, 15);
  assert.equal(items.length, 15);
  const last = items.at(-1);
  assert.equal(last.date, iso(20));
  assert.equal(last.title, "S&P 500 +0.2%, Index +0.3%");
  assert.deepEqual([last.stats.rose, last.stats.fell, last.stats.counted], [1, 1, 3]);
  assert.equal(last.stats.top.symbol, "BBB");
  assert.equal(last.body[1], "Biggest mover: BBB −4.0% (Bee).");
  assert.equal(last.value.tone, "accent"); // the S&P 500 leads when present
  // The S&P 500 shows only on the last close without recent_days.
  assert.equal(items[0].title.includes("S&P"), false);
});

test("market items use the S&P 500's recent_days when the data has them", () => {
  const market = {
    as_of: iso(2),
    symbols: [{ symbol: "AAA", series: series([1, 1]) }, { symbol: "IDX", series: series([1, -1]) }],
    context: { instruments: [{ role: "spx", name: "S&P 500", change_1d_pct: -0.5, recent_days: [{ date: iso(1), change_pct: 0.7 }, { date: iso(2), change_pct: -0.5 }] }] },
  };
  const items = marketItems(market, wl, bench);
  assert.equal(items[0].title, "S&P 500 +0.7%, Index +1.0%");
  assert.equal(items[1].value.tone, "down");
});

test("unusual moves need both several standard deviations and a minimum size", () => {
  const market = {
    as_of: iso(80),
    symbols: [
      { symbol: "AAA", series: series([...calm(79, 0.5), 6]) }, // 6% on a 0.5% name: flagged
      { symbol: "BBB", series: series([...calm(79, 0.5), 2.5]) }, // big in sd, under 3%: not flagged
      { symbol: "CCC", series: series([...calm(79, 3), 4]) }, // over 3%, but normal for this name
    ],
  };
  const items = unusualItems(market, wl, { AAA: "Aye" });
  assert.deepEqual(items.map((i) => i.id), [`move:AAA:${iso(80)}`]);
  assert.match(items[0].title, /^AAA jumped 6\.0% in a day$/);
  assert.match(items[0].body[0], /times its usual daily swing/);
  // Days with too little history before them are skipped.
  assert.deepEqual(unusualItems({ as_of: iso(5), symbols: [{ symbol: "AAA", series: series([0.1, 0.1, 0.1, 0.1, 20]) }] }, wl), []);
});

test("brain items: picks with stances, the first sentence of the summary, failed runs said plainly", () => {
  const runs = [
    { date: "2026-10-07", status: "ok", summary: "First thing. Second thing.", picks: [{ pick: { ticker: "AAA", stance: "neutral" } }, { pick: { ticker: "BBB", stance: "neutral" } }] },
    { date: "2026-10-08", status: "ok", summary: "Mixed day!", picks: [{ pick: { ticker: "AAA", stance: "bullish" } }, { pick: { ticker: "BBB", stance: "neutral" } }] },
    { date: "2026-10-09", status: "failed", picks: [] },
  ];
  const [a, b, c] = brainItems(runs);
  assert.equal(a.title, "The brain flagged 2 names, all just watching");
  assert.deepEqual(a.body, ["AAA · BBB", "First thing."]);
  assert.equal(b.title, "The brain flagged 2 names");
  assert.equal(b.body[0], "AAA leaning up · BBB just watching");
  assert.equal(c.title, "The brain's run failed");
  assert.equal(c.tone, "down");
});

const outlook = { companies: [
  {
    ticker: "AAA", name: "Aye Inc", latest: { period: "Q2", reported_on: "2026-09-01", revenue: "$1.0 billion", revenue_growth_yoy_pct: 12.4, highlights: ["Good quarter."] },
    next_earnings: { date: "2026-10-20", confirmed: true },
    whats_next: [{ item: "Launched a thing. More words.", when: "Sep 2026", date: "2026-09-15" }, { item: "A future thing.", date: "2026-10-12" }, { item: "Undated." }],
  },
  { ticker: "BBB", name: "Bee Co", latest: { period: "Q1", reported_on: "2026-07-01", revenue: "$2 billion" }, next_earnings: { date: "2026-10-01", confirmed: false }, whats_next: [] },
  { ticker: "CCC", name: "Cee", latest: { reported_on: "2026-08-01", revenue: "$3 billion" }, next_earnings: { date: "2027-03-01" }, whats_next: [] },
] };

test("company items: past reports and news in the feed, results dates and dated plans ahead", () => {
  const { items, ahead } = companyItems(outlook, "2026-10-09");
  const ids = items.map((i) => i.id).sort();
  assert.ok(ids.includes("report:AAA:2026-09-01"));
  assert.ok(ids.includes("results:BBB:2026-10-01")); // a passed results date: due for a refresh
  assert.equal(items.find((i) => i.id === "results:BBB:2026-10-01").title, "BBB's results were due");
  assert.equal(items.find((i) => i.id === "report:AAA:2026-09-01").title, "AAA reported results: revenue $1.0 billion, up 12% from a year earlier");
  assert.equal(items.find((i) => i.id.startsWith("next:AAA:2026-09-15")).title, "AAA: Launched a thing.");
  assert.deepEqual(ahead.map((a) => [a.date, a.days]), [["2026-10-12", 3], ["2026-10-20", 11]]); // 2027 is beyond the window
  assert.equal(ahead[1].title, "AAA reports results");
  assert.match(ahead[1].body[0], /date confirmed/);
  assert.ok(items.every((i) => !i.title.includes("Undated")));
});

test("people items: the call on its filing date, and the verdict on the day it was judged", () => {
  const cfg = {
    people: [{ id: "pat", name: "Pat Smith" }],
    calls: [
      { id: "c1", person: "pat", via: "Fund LLP", date: "2026-01-02", ticker: "AAA", stance: "bearish", what: "Sold it all.", source_kind: "13f" },
      { id: "c2", person: "pat", via: "Big Holdings Inc", date: "2026-09-01", ticker: "BBB", stance: "bullish", credit_person: false, source_kind: "13f" },
    ],
  };
  const scores = { calls: [{ id: "c1", scored: true, w26: { end_date: "2026-07-03", right: false, signed_excess_pct: -7.19 } }] };
  const items = peopleItems(cfg, scores);
  assert.deepEqual(items.map((i) => [i.id, i.date]), [["call:c1", "2026-01-02"], ["judged:c1", "2026-07-03"], ["call:c2", "2026-09-01"]]);
  assert.equal(items[0].title, "Pat Smith 13F filed: bearish on AAA");
  assert.equal(items[1].title, "Pat Smith's AAA call judged wrong at 26 weeks");
  assert.equal(items[1].body[0], "−7.2% for the call against the S&P 500 core.");
  assert.equal(items[2].title, "Big Holdings 13F filed: bullish on BBB"); // the firm's own call is never credited to the person
});

const checklist = { symbols: [
  { symbol: "AAA", history: [
    { date: "2026-10-07", verdict: "mixed", changes: [{ check: "candle", text: "Daily candle: doji", tone: "neutral" }] },
    { date: "2026-10-08", verdict: "lean_up", changes: [{ check: "candle", text: "Daily candle: hammer", tone: "bullish" }, { check: "score", text: "Verdict moved from mixed to lean up", tone: "bullish" }] },
  ] },
  { symbol: "BBB", history: [{ date: "2026-10-08", verdict: "mixed", changes: [{ check: "rsi", text: "RSI moved into overbought", tone: "bearish" }] }] },
  { symbol: "CCC", history: [{ date: "2026-10-08", verdict: "mixed", changes: [{ check: "volume", text: "Price rising on falling volume", tone: "bearish" }] }] },
] };

test("checklist items: one per name and day with a change worth a line; candles alone are not", () => {
  const items = checklistItems(checklist);
  assert.deepEqual(items.map((i) => i.id), ["check:AAA:2026-10-08", "check:BBB:2026-10-08", "check:CCC:2026-10-08"]);
  assert.equal(items[0].title, "AAA: verdict mixed to lean up");
  assert.deepEqual(items[0].body, ["Daily candle: hammer"]);
  assert.equal(items[0].value.text, "lean up");
  assert.equal(items[1].title, "BBB: RSI into overbought");
  assert.equal(items[1].tone, "down");
  assert.equal(items[2].to, "stock/CCC#checklist");
  assert.equal(headlineChange([{ check: "levels", text: "Closed above a resistance level" }]), null);
  assert.equal(changeHeadline({ text: "Trend changed from up to sideways" }), "trend up to sideways");
});

test("busy checklist days collapse into one digest in the All view, never in the Checklist view", () => {
  const items = checklistItems(checklist);
  const all = collapseChecklist(items, 2);
  assert.equal(all.length, 1);
  assert.equal(all[0].digest, true);
  assert.equal(all[0].title, "Checklist: 3 names changed");
  assert.equal(all[0].to, "filter:checklist");
  assert.equal(collapseChecklist(items, 3).length, 3);
});

test("the feed is newest first, nothing dated after today, brain runs left out for sample picks", () => {
  const data = {
    market: { as_of: "2026-01-03", symbols: [{ symbol: "AAA", series: series([1, 2]) }, { symbol: "IDX", series: series([1, 1]) }] },
    watchlist: wl, bench, names: {},
    runs: [{ date: "2026-01-03", status: "ok", summary: "S.", picks: [] }],
    sample: false, outlook, people: null, peopleScores: null, checklist,
  };
  const feed = buildFeed(data, "2026-10-09");
  const dates = feed.items.map((i) => i.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.ok(dates.every((d) => d <= "2026-10-09"));
  assert.ok(feed.items.some((i) => i.kind === "brain"));
  assert.equal(buildFeed({ ...data, sample: true }, "2026-10-09").items.some((i) => i.kind === "brain"), false);
  assert.ok(feed.ahead.length > 0);
  const { list, counts } = filterFeed(feed, "checklist");
  assert.equal(list.length, 3);
  assert.equal(counts.checklist, 3);
  assert.equal(counts.all, feed.items.length);
  assert.ok(filterFeed(feed, "all").list.length < feed.items.length); // the busy checklist day collapsed
  const days = byDay(feed.items);
  assert.equal(days[0].date, dates[0]);
  assert.equal(days.reduce((n, d) => n + d.items.length, 0), feed.items.length);
});

test("the feed survives missing files: no checklist, no outlook, no people", () => {
  const data = { market: { as_of: "2026-01-02", symbols: [] }, watchlist: wl, bench, names: {}, runs: [], sample: false, outlook: null, people: null, peopleScores: null, checklist: null };
  assert.deepEqual(buildFeed(data, "2026-10-09"), { items: [], ahead: [] });
});

test("ago: relative time in words", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  assert.equal(ago("2026-10-09T11:59:40Z", now), "just now");
  assert.equal(ago("2026-10-09T11:55:00Z", now), "5 minutes ago");
  assert.equal(ago("2026-10-09T11:00:00Z", now), "1 hour ago");
  assert.equal(ago("2026-10-08T09:00:00Z", now), "yesterday");
  assert.equal(ago("2026-10-05T09:00:00Z", now), "4 days ago");
  assert.equal(ago("not a date", now), "");
});

/* ------------------------------------------------------------------ Hebrew */

import { stripBidi } from "./i18n.js";
import { kindLabel, KIND_LABEL, verdictWord } from "./feed.js";
const S = (s) => stripBidi(s);

test("Hebrew: market and unusual items keep each number with its sign", () => {
  const market = {
    as_of: iso(80),
    symbols: [{ symbol: "AAA", series: series([...calm(79, 0.5), 6]) }, { symbol: "BBB", series: series([...calm(79, 0.5), -1]) }, { symbol: "IDX", series: series([...calm(79), 0.3]) }],
    context: { instruments: [{ role: "spx", name: "S&P 500", change_1d_pct: -0.2 }] },
  };
  const last = marketItems(market, wl, bench, { AAA: "Aye" }, 15, "he").at(-1);
  assert.equal(S(last.title), "S&P 500 −0.2%, Index +0.3%");
  assert.match(last.title, /⁦−0\.2%⁩/, "the sign stays in front of its number in a right-to-left line");
  assert.equal(S(last.body[0]), "1 מתוך 2 מניות עלו, 1 ירדו.");
  assert.equal(S(last.body[1]), "התנועה הגדולה ביותר: AAA +6.0% (Aye).");
  const u = unusualItems(market, wl, { AAA: "Aye" }, 15, undefined, "he");
  assert.equal(S(u[0].title), "AAA זינקה 6.0% ביום אחד");
  assert.match(S(u[0].body[0]), /^בערך פי \d+(\.\d)? מהתנודה היומית הרגילה שלה \(0\.5% ב-60 הימים שלפני כן\)\. Aye\.$/);
});

test("Hebrew: brain, company, people and checklist items", () => {
  const runs = [
    { date: "2026-10-07", status: "ok", summary: "First thing. Second.", picks: [{ pick: { ticker: "AAA", stance: "neutral" } }, { pick: { ticker: "BBB", stance: "neutral" } }] },
    { date: "2026-10-08", status: "ok", picks: [{ pick: { ticker: "AAA", stance: "bullish" } }, { pick: { ticker: "BBB", stance: "neutral" } }, { pick: { ticker: "CCC", stance: "bearish" } }] },
    { date: "2026-10-09", status: "ok", picks: [{ pick: { ticker: "AAA", stance: "bullish" } }] },
    { date: "2026-10-10", status: "failed" },
  ];
  const [a, b, c, d] = brainItems(runs, "he");
  assert.equal(a.title, "המוח סימן שתי מניות, שתיהן רק במעקב");
  assert.deepEqual(a.body, ["AAA · BBB", "First thing."], "the brain's own summary stays as written");
  assert.equal(S(b.title), "המוח סימן 3 מניות");
  assert.equal(b.body[0], "AAA בנטייה לעלייה · BBB רק במעקב · CCC בנטייה לירידה");
  assert.equal(c.title, "המוח סימן מניה אחת, בנטייה לעלייה");
  assert.equal(d.title, "הריצה של המוח נכשלה");

  const { items, ahead } = companyItems(outlook, "2026-10-09", 45, "he");
  assert.equal(S(items.find((i) => i.id === "report:AAA:2026-09-01").title), "AAA פרסמה תוצאות: הכנסות של $1.0 billion, עלייה של 12% לעומת שנה קודם");
  assert.equal(S(items.find((i) => i.id === "results:BBB:2026-10-01").title), "מועד התוצאות של BBB כבר עבר");
  assert.equal(S(ahead[1].title), "AAA מפרסמת תוצאות");
  assert.equal(S(ahead[1].body[0]), "Aye Inc, התאריך אושר.");

  const cfg = { people: [{ id: "pat", name: "Pat Smith" }], calls: [{ id: "c1", person: "pat", via: "Fund LLP", date: "2026-01-02", ticker: "AAA", stance: "bearish", source_kind: "13f" }] };
  const scores = { calls: [{ id: "c1", w26: { end_date: "2026-07-03", right: false, signed_excess_pct: -7.19 } }] };
  const people = peopleItems(cfg, scores, 26, "he");
  assert.equal(S(people[0].title), "Pat Smith, דיווח 13F: עמדה פסימית לגבי AAA");
  assert.equal(S(people[1].title), "התחזית של Pat Smith על AAA נבדקה אחרי 26 שבועות: טעתה");
  assert.equal(S(people[1].body[0]), "−7.2% לתחזית, בהשוואה לקרן הליבה על מדד S&P 500.");
  assert.equal(people[1].value.text, "טעתה");

  const checks = checklistItems(checklist, "he");
  assert.equal(checks[0].value.text, "נטייה לעלייה");
  assert.equal(checks[0].title, "AAA: verdict mixed to lean up", "the checklist's own change text stays as written");
  const digest = collapseChecklist(checks, 2, "he")[0];
  assert.equal(S(digest.title), "רשימת הבדיקה: 3 מניות השתנו");
  assert.equal(verdictWord("lean_down", "he"), "נטייה לירידה");
  assert.equal(verdictWord("odd", "he"), "odd");
  assert.equal(kindLabel("people", "he"), "אנשים");
  for (const k of Object.keys(KIND_LABEL)) assert.equal(kindLabel(k), KIND_LABEL[k]);
});

test("Hebrew: ago, with the dual forms", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  assert.equal(ago("2026-10-09T11:59:40Z", now, "he"), "ממש עכשיו");
  assert.equal(ago("2026-10-09T11:59:00Z", now, "he"), "לפני דקה");
  assert.equal(ago("2026-10-09T11:58:00Z", now, "he"), "לפני שתי דקות");
  assert.equal(S(ago("2026-10-09T11:55:00Z", now, "he")), "לפני 5 דקות");
  assert.equal(ago("2026-10-09T10:00:00Z", now, "he"), "לפני שעתיים");
  assert.equal(ago("2026-10-08T09:00:00Z", now, "he"), "אתמול");
  assert.equal(ago("2026-10-07T09:00:00Z", now, "he"), "לפני יומיים");
  assert.equal(S(ago("2026-10-05T09:00:00Z", now, "he")), "לפני 4 ימים");
});
