import test from "node:test";
import assert from "node:assert/strict";
import { companiesToKnow, joinNames, marketWords, newsLines, planWords, shortName, sizeWord, verdictChip, watchWhy, whenWords } from "./simple.js";

const TODAY = "2026-10-09"; // a Friday
// Words, not numbers: the only digits allowed are in the index fund's name, the household's own words for the core.
const noDigits = (s) => assert.doesNotMatch(String(s).replace("S&P 500", "S&P"), /\d/, `digits in: ${s}`);

const outlook = {
  companies: [
    { ticker: "AAA", name: "Microsoft Corporation", plain: "Microsoft: its cloud business is growing fast.", latest: { reported_on: "2026-07-29" }, next_earnings: { date: "2026-10-14", confirmed: true }, whats_next: [] },
    { ticker: "BBB", name: "PepsiCo, Inc.", plain: "PepsiCo: sales grew slowly and it plans more cost cuts.", latest: { reported_on: "2026-10-08" }, next_earnings: { date: null, confirmed: false }, whats_next: [] },
    { ticker: "CCC", name: "Meta Platforms, Inc.", plain: "Meta: ad sales grew strongly, but costs grew even faster.", latest: { reported_on: "2026-07-29" }, next_earnings: { date: null, confirmed: false },
      whats_next: [{ item: "Glasses launch.", status: "done", date: "2026-10-01" }] },
    { ticker: "DDD", name: "Gilead Sciences, Inc.", latest: { reported_on: "2026-08-04" }, next_earnings: { date: "2026-10-15", confirmed: false }, whats_next: [] },
  ],
};
const names = { AAA: "Microsoft", BBB: "PepsiCo", CCC: "Meta Platforms", DDD: "Gilead Sciences", EEE: "Apple", FFF: "NVIDIA", IDX: "Nasdaq-100" };
const day = (o = {}) => ({
  date: "2026-10-08", spx: { name: "S&P 500", pct: -0.42, fromHigh: -0.7 }, bench: { symbol: "IDX", label: "Nasdaq-100", pct: -0.5 },
  names: 21, counted: 21, rose: 13, fell: 8, flat: 0,
  risers: [{ symbol: "FFF", pct: 2.1 }], fallers: [{ symbol: "CCC", pct: -4.2 }], ...o,
});
const ck = (symbol, verdict, extra = {}) => ({ symbol, score: { verdict }, rsi: { zone: "neutral" }, trend: { direction: "up" }, volume: {}, ...extra });

test("dates in words, never digits", () => {
  assert.equal(whenWords("2026-10-09", TODAY), "today");
  assert.equal(whenWords("2026-10-08", TODAY), "yesterday");
  assert.equal(whenWords("2026-10-10", TODAY), "tomorrow");
  assert.equal(whenWords("2026-10-06", TODAY), "on Tuesday");
  assert.equal(whenWords("2026-10-14", TODAY), "next Wednesday");
  assert.equal(whenWords("2026-10-14", "2026-10-12"), "this Wednesday");
  assert.equal(whenWords("2026-10-28", TODAY), "in late October");
  assert.equal(whenWords("2026-11-02", TODAY), "in early November");
  assert.equal(whenWords("2026-09-15", TODAY), "in mid September");
  assert.equal(whenWords(null, TODAY), "");
  for (const d of ["2026-10-01", "2026-10-11", "2026-10-20", "2026-12-24"]) noDigits(whenWords(d, TODAY));
});

test("names: the plain summary's lead, then the watchlist, then the ticker; joined in English", () => {
  assert.equal(shortName("CCC", outlook, names), "Meta");
  assert.equal(shortName("DDD", outlook, names), "Gilead Sciences");
  assert.equal(shortName("ZZZ", outlook, names), "ZZZ");
  assert.equal(joinNames(["A"]), "A");
  assert.equal(joinNames(["A", "B"]), "A and B");
  assert.equal(joinNames(["A", "B", "C"]), "A, B and C");
  assert.equal(joinNames([]), "");
});

test("the size of a move in words, with a lower bar for the index", () => {
  assert.deepEqual([0.1, 0.4, -0.4, 0.9, -0.9, 1.5, -1.5].map((v) => sizeWord(v)), ["barely moved", "rose a little", "slipped", "rose", "fell", "jumped", "fell sharply"]);
  assert.deepEqual([0.2, 1, -2, 5, -5].map((v) => sizeWord(v, "stock")), ["barely moved", "rose a little", "fell", "jumped", "fell sharply"]);
  assert.equal(sizeWord(null), null);
});

test("the market sentence: the day, our companies and the mood, in words", () => {
  const w = marketWords(day(), { state: "calm" }, TODAY);
  assert.equal(w.main, "The market slipped yesterday, but most of our companies rose.");
  assert.equal(w.more, "It is close to its high for the year, and the mood is calm.");
  assert.equal(w.tone, "down");
  const agree = marketWords(day({ spx: { pct: 1.5, fromHigh: -12 }, rose: 18, fell: 3 }), { state: "stressed" }, TODAY);
  assert.equal(agree.main, "The market jumped yesterday, and most of our companies rose.");
  assert.match(agree.more, /^It is well below its high for the year, and the mood is nervous/);
  assert.equal(agree.tone, "accent");
  const flat = marketWords(day({ spx: { pct: 0.05, fromHigh: -5 }, rose: 10, fell: 10, counted: 21 }), { state: "normal" }, TODAY);
  assert.equal(flat.main, "The market barely moved yesterday, and our companies were split.");
  assert.equal(flat.more, "It is a little below its high for the year, and the mood is steady.");
  // older data without the S&P 500: the benchmark leads, the regime's drawdown stands in for the high
  const old = marketWords(day({ spx: null, bench: { label: "Nasdaq-100", pct: -2 } }), { state: "normal", metrics: { drawdown_pct: -1 } }, TODAY);
  assert.equal(old.main, "Our benchmark fell sharply yesterday, but most of our companies rose.");
  assert.equal(old.more, "It is close to its high for the year, and the mood is steady.");
  assert.equal(marketWords(day({ spx: null, bench: null, counted: 0 }), null, TODAY).main, "Our benchmark's last close was yesterday.");
  assert.match(marketWords(null, null, TODAY).main, /after the next daily run/);
  for (const x of [w, agree, flat, old]) { noDigits(x.main); noDigits(x.more); }
});

test("news: results this coming week on top, then company news, the biggest mover and a recent call, newest first", () => {
  const people = { people: [{ id: "cw", name: "Cathie Wood" }], calls: [{ id: "c1", person: "cw", via: "ARK Invest", date: "2026-10-07", ticker: "FFF", stance: "bullish" }] };
  const lines = newsLines({ outlook, day: day(), people, today: TODAY, names, max: 4 });
  assert.deepEqual(lines.map((l) => l.text), [
    "Microsoft reports results next Wednesday, and one more company reports this coming week.",
    "PepsiCo: sales grew slowly and it plans more cost cuts.",
    "Meta fell sharply yesterday.",
    "Cathie Wood is upbeat on NVIDIA.",
  ]);
  assert.deepEqual(lines.map((l) => l.to), ["stock/AAA#whats-next", "stock/BBB#whats-next", "stock/CCC#brief", "people"]);
  for (const l of lines) noDigits(l.text);
  assert.equal(newsLines({ outlook, day: day(), people, today: TODAY, names }).length, 3, "three lines at most by default");
});

test("news: an unconfirmed date says expected; old calls and tiny moves stay out; nothing at all is an empty list", () => {
  const one = { companies: [outlook.companies[3]] };
  const lines = newsLines({ outlook: one, day: day({ risers: [{ symbol: "FFF", pct: 0.1 }], fallers: [] }), people: { people: [], calls: [{ id: "x", via: "Some Fund LLC", date: "2026-05-15", ticker: "AAA", stance: "bearish" }] }, today: TODAY, names });
  assert.deepEqual(lines.map((l) => l.text), ["Gilead Sciences is expected to report results next Thursday."]);
  assert.deepEqual(newsLines({ outlook: null, day: null, people: null, today: TODAY }), []);
  // a "Recently" item counts as company news
  const meta = newsLines({ outlook: { companies: [outlook.companies[2]] }, day: null, today: TODAY, names });
  assert.deepEqual(meta.map((l) => l.text), ["Meta: ad sales grew strongly, but costs grew even faster."]);
});

test("companies to know: held, then picked, then the day's movers; three to five; chips from the checklist", () => {
  const checklist = { symbols: [ck("AAA", "lean_up"), ck("CCC", "lean_down"), ck("BBB", "mixed")] };
  const list = companiesToKnow({ held: ["AAA", "EEE"], picked: ["AAA", "CCC"], day: day(), outlook, checklist, names, bench: "IDX" });
  assert.deepEqual(list.map((c) => c.ticker), ["AAA", "EEE", "CCC", "FFF"]);
  assert.deepEqual(list.map((c) => c.tag), ["on paper", "on paper", "the brain is watching", "one of the day's big risers"]);
  // with today's date, a mover's tag is the day's move in words, so a "Going up" chip beside a fall reads as the chart
  const dated = companiesToKnow({ held: [], picked: [], day: day(), outlook, checklist, names, bench: "IDX", today: TODAY });
  assert.deepEqual(dated.map((c) => c.tag), ["fell sharply yesterday", "rose yesterday"]);
  dated.forEach((c) => noDigits(c.tag));
  assert.deepEqual(list.map((c) => c.chip?.word ?? null), ["Going up", null, "Going down", null]);
  assert.equal(list[0].plain, "Microsoft: its cloud business is growing fast.");
  assert.equal(list[0].to, "stock/AAA#brief");
  const none = companiesToKnow({ held: [], picked: [], day: day({ risers: [{ symbol: "FFF", pct: 2 }, { symbol: "IDX", pct: 3 }], fallers: [{ symbol: "CCC", pct: -4 }, { symbol: "BBB", pct: -1 }] }), outlook, checklist: null, names, bench: "IDX" });
  assert.deepEqual(none.map((c) => c.ticker), ["CCC", "FFF", "BBB"], "at least three, the benchmark never");
  assert.ok(none.every((c) => c.chip === null), "no chip before the checklist is published");
  const many = companiesToKnow({ held: ["A", "B", "C", "D"], picked: ["E", "F"], day: day(), outlook, checklist, names });
  assert.equal(many.length, 5);
  assert.equal(verdictChip({ symbols: [ck("BBB", "mixed")] }, "BBB").word, "Mixed");
});

test("watching: a few words why", () => {
  assert.equal(watchWhy(ck("A", "mixed", { rsi: { zone: "overbought" } })), "overheated");
  assert.equal(watchWhy(ck("A", "mixed", { trend: { direction: "down" } })), "falling");
  assert.equal(watchWhy(ck("A", "lean_down")), "leaning down");
  assert.equal(watchWhy(ck("A", "mixed", { volume: { rising_on_falling_volume: true } })), "rising on thin buying");
  assert.equal(watchWhy(ck("A", "lean_up")), null);
  assert.equal(watchWhy(null), null);
});

test("our plan in three steps, the next check in words and the honest line", () => {
  const checklist = { symbols: [ck("AAA", "lean_up"), ck("CCC", "mixed", { rsi: { zone: "overbought" } }), ck("BBB", "mixed", { trend: { direction: "down" } }), ck("GGG", "lean_down", { trend: { direction: "down" } }), ck("IDX", "lean_down")] };
  const p = planWords({ held: ["AAA", "DDD"], picked: ["AAA", "CCC"], checklist, outlook, names, stage: 1, nextCheck: "2026-11-02", today: TODAY, bench: "IDX" });
  assert.equal(p.steps[0], "Keep most of our savings in the S&P 500 index fund.");
  assert.equal(p.steps[1], "Practise on paper, no real money yet: Microsoft and Gilead Sciences.");
  assert.equal(p.steps[2], "Watching, not buying: Meta (overheated), GGG (falling) and PepsiCo (falling).");
  assert.equal(p.next, "Next check: in early November.");
  assert.match(p.honest, /practice notebook, not advice/);
  for (const s of [...p.steps, p.next, p.honest]) noDigits(s);
  const empty = planWords({ held: [], picked: ["ZZZ"], checklist: null, outlook: null, names: {}, today: TODAY });
  assert.equal(empty.steps[1], "Practise on paper, no real money yet: no single companies held right now.");
  assert.equal(empty.steps[2], "Watching, not buying: ZZZ (the brain is just watching).");
  assert.equal(empty.next, null);
  assert.equal(planWords({ held: [], picked: [], today: TODAY }).steps[2], "Watching, not buying: nothing stands out today.");
  assert.match(planWords({ held: ["AAA"], stage: 2, outlook, today: TODAY }).steps[1], /^Small amounts only, within the house limits: Microsoft\.$/);
});
