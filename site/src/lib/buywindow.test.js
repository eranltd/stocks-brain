import test from "node:test";
import assert from "node:assert/strict";
import { buyLine, buyWindow, buyWindowFor, dayWords, isCoreFundCard, lookState, mainListOf, nextLookMonth } from "./buywindow.js";

const names = { AAA: "Alpha Corp", BBB: "Beta Inc", CCC: "Gamma Co", DDD: "Delta Ltd" };
const FORBIDDEN = /buy signal|recommend|you should buy/i;

function contract(entry = {}, extra = {}) {
  const base = {
    eligible: true, rank: 3, of: 21, sector: "Information Technology", sector_leader: "AAA", held_now: false, would_hold_if_today: true,
    above_200: true, rising_200: true, dist_sma50_pct: 4.2, stretched: false, blockers: [],
  };
  return {
    as_of: "2026-10-14", sample: false, rule: "five_leaders", rule_label: "Five Leaders",
    next_review: "2026-11-02", next_review_quarterly: "2027-01-04", slots: 5, keep_rank: 10, stretch_limit_pct: 8.0,
    held_now: ["BBB"], would_hold_if_today: ["AAA"],
    names: { AAA: { ...base, ...entry } },
    ...extra,
  };
}
const setup = (over = {}) => ({ checks: { trend: true, rs_3m: true, rs_6m: true, calm: true }, passed: 4, stretched: false, dist_sma50_pct: 4.2, dist_long_pct: 15.1, as_of: "2026-10-14", ...over });
const ck = (rr = 2.6, basis = "resistance") => ({ symbol: "AAA", as_of: "2026-10-14", risk_plan: { stop_pct: 3, stop_basis: "support", tp1_pct: rr * 3, tp1_basis: basis, tp2_pct: 9, rr_tp1: rr, rr_tp2: 3, fits_house_rule: rr >= 2 } });
const cond = (a, id) => a.conditions.find((c) => c.id === id);
const say = (a) => [a.headline, a.realMoney, a.nextLook, ...a.waitFor, a.note, ...a.conditions.flatMap((c) => [c.label, c.now, c.need])].join(" ");

function honest(a) {
  assert.doesNotMatch(say(a), FORBIDDEN);
  assert.doesNotMatch(say(a), /undefined|null|NaN/);
  assert.match(a.note, /not a forecast/);
}

test("dates read as weekday, day and month", () => {
  assert.equal(dayWords("2026-11-02"), "Mon 2 Nov");
  assert.equal(dayWords("2027-01-04"), "Mon 4 Jan");
  assert.equal(dayWords(null), "");
});

test("a main-list name blocked by its group's leader names the leader and what to wait for", () => {
  const a = buyWindow({
    symbol: "BBB", onMainList: true, names,
    bw: { ...contract(), names: { BBB: { ...contract().names.AAA, rank: 7, sector_leader: "AAA", would_hold_if_today: false, blockers: ["sector_taken"], dist_sma50_pct: 5.95 } } },
    setup: setup({ dist_sma50_pct: 5.95 }), checklist: ck(0.82), stocksEarned: false,
  });
  honest(a);
  assert.equal(a.tone, "wait");
  assert.match(a.headline, /^Wait/);
  assert.match(a.realMoney, /not as a single stock today/);
  assert.match(a.realMoney, /already holds a small piece/);
  assert.match(a.nextLook, /Mon 2 Nov/);
  assert.match(a.nextLook, /Mon 4 Jan/);
  assert.equal(cond(a, "leader").ok, false);
  assert.match(cond(a, "leader").now, /Ranks 7 of 21.*Alpha Corp leads its group/);
  assert.equal(cond(a, "stretch").ok, true);
  assert.match(cond(a, "stretch").now, /6\.0% above/);
  assert.equal(cond(a, "reward").ok, false);
  assert.equal(cond(a, "reward").now, "0.8 to 1");
  assert.ok(a.waitFor.some((w) => /Alpha Corp leads its group/.test(w)));
  assert.ok(a.waitFor.some((w) => /nearest ceiling is close/.test(w)));
  assert.deepEqual(buyLine(a, "2026-10-15"), { text: "When to buy: wait (see why)", tone: "flat" });
});

test("a stretched name waits until it is under the limit", () => {
  const a = buyWindow({
    symbol: "AAA", onMainList: true, names,
    bw: contract({ stretched: true, dist_sma50_pct: 11.3, would_hold_if_today: false, blockers: ["stretched"] }),
    setup: setup({ stretched: true, dist_sma50_pct: 11.3, passed: 3 }), checklist: ck(2.4),
  });
  honest(a);
  assert.equal(a.tone, "wait");
  assert.equal(cond(a, "stretch").ok, false);
  assert.match(cond(a, "stretch").now, /11\.3% above/);
  assert.ok(a.waitFor.includes("Wait until it is less than 8% above its 50-day line."));
});

test("below or under a falling 200-day line waits for the line", () => {
  const a = buyWindow({
    symbol: "AAA", onMainList: true, names,
    bw: contract({ above_200: false, rising_200: false, would_hold_if_today: false, blockers: ["below_200", "falling_200"] }),
    setup: setup(), checklist: ck(2.4),
  });
  honest(a);
  assert.equal(cond(a, "trend200").ok, false);
  assert.match(cond(a, "trend200").now, /Below it; the line is falling/);
  assert.ok(a.waitFor.some((w) => /back above its 200-day line/.test(w)));
  assert.ok(a.waitFor.some((w) => /line turns up again/.test(w)));
});

test("the rule would pick it, but a thin reward-to-risk still says wait", () => {
  const a = buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(1.4, "risk_multiple") });
  honest(a);
  assert.equal(a.tone, "wait");
  assert.match(a.headline, /house checks say wait/);
  assert.equal(cond(a, "reward").ok, false);
  assert.ok(a.waitFor.some((w) => /2 to 1 or more/.test(w)));
  const flat = buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(0.01) });
  assert.equal(cond(flat, "reward").now, "under 0.1 to 1");
});

test("all conditions met: pretend money only, real money still waits while stocks have not earned a place", () => {
  const a = buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(2.6), stocksEarned: false });
  honest(a);
  assert.equal(a.tone, "rules_allow");
  assert.ok(a.conditions.every((c) => c.ok === true));
  assert.match(a.headline, /on paper/);
  assert.match(a.headline, /Real money still waits/);
  assert.match(a.realMoney, /not as a single stock today/);
  const line = buyLine(a, "2026-10-15");
  assert.match(line.text, /On paper.*real money waits/);
  assert.doesNotMatch(line.text, /\d/);
  // Only once a rule has earned it does the answer speak of a small amount, still on the rule's date.
  const earned = buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(2.6), stocksEarned: true, ruleVerdict: "passes_history" });
  assert.match(earned.headline, /small amount on Mon 2 Nov, if nothing changes/);
  assert.doesNotMatch(buyLine(earned, "2026-10-15").text, /real money waits/);
});

test("another rule passing its history test never turns this rule's pick into a real-money answer", () => {
  // stocksEarned is true because SOME rule passed; this rule's own frozen verdict is still rejected (or unknown).
  for (const ruleVerdict of ["rejected", null]) {
    const a = buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(2.6), stocksEarned: true, ruleVerdict });
    honest(a);
    assert.equal(a.earned, false);
    assert.match(a.headline, /Real money still waits/);
    assert.match(a.realMoney, /not as a single stock today/);
    assert.match(buyLine(a, "2026-10-15").text, /real money waits/);
  }
  // Through the page adapter: the verdict is read for the contract's own rule id from market/rules.json.
  const derived = { symbols: [{ symbol: "AAA", last_date: "2026-10-14", setup: { checks: setup().checks, passed: 4, stretched: false, dist_sma50_pct: 4.2, dist_long_pct: 15.1 } }] };
  const other = { frozen: { satellite: { other_rule: { verdict: "passes_history" }, five_leaders: { verdict: "rejected" } } } };
  const mine = { frozen: { satellite: { five_leaders: { verdict: "passes_history" } } } };
  const ctx = { today: "2026-10-15", derived, bw: contract(), mainList: ["AAA"], stocksEarned: true, names };
  assert.equal(buyWindowFor("AAA", { ...ctx, rulesResult: other }).earned, false);
  assert.match(buyWindowFor("AAA", { ...ctx, rulesResult: other }).realMoney, /not as a single stock today/);
  assert.equal(buyWindowFor("AAA", { ...ctx, rulesResult: mine }).earned, true);
  assert.match(buyWindowFor("AAA", { ...ctx, rulesResult: mine }).realMoney, /only within the house limits/);
});

test("a look whose next review date has gone by is stale, never a past date as the next look", () => {
  assert.equal(lookState(contract(), "2026-10-14", false, "2026-11-02"), "ok");
  assert.equal(lookState(contract(), "2026-10-14", false, "2026-11-03"), "stale");
  const a = buyWindow({ today: "2026-11-05", symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(2.6) });
  honest(a);
  assert.equal(a.available, false);
  assert.doesNotMatch(a.nextLook, /Mon 2 Nov/);
});

test("a name the rule would hold is never marked down because another name in its group is also held", () => {
  const bw = contract({}, { would_hold_if_today: ["AAA", "BBB"], held_now: ["BBB"] });
  bw.names.BBB = { ...bw.names.AAA, rank: 1, held_now: true };
  const a = buyWindow({ symbol: "AAA", onMainList: true, names, bw, setup: setup(), checklist: ck(2.6) });
  assert.equal(cond(a, "leader").ok, true);
  assert.equal(a.tone, "rules_allow");
});

test("a held name that would be kept says so and never says buy", () => {
  const a = buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract({ held_now: true }), setup: setup(), checklist: ck(2.6) });
  honest(a);
  assert.equal(a.held, true);
  assert.match(a.headline, /holds it on paper/);
  assert.equal(cond(a, "leader").need, "Stay in the top 10");
});

test("a look-only name gets trend, stretch and checklist rows and the Nasdaq-only line", () => {
  const a = buyWindow({ symbol: "CCC", onMainList: false, names, bw: contract(), setup: setup({ checks: { trend: false }, dist_sma50_pct: -2.5, dist_long_pct: 3 }), checklist: ck(2.5) });
  honest(a);
  assert.equal(a.tone, "not_ours");
  assert.deepEqual(a.conditions.map((c) => c.id), ["trend", "stretch", "reward"]);
  assert.equal(cond(a, "trend").ok, false);
  assert.match(cond(a, "trend").now, /2\.5% below its 50-day line, 3\.0% above its 200-day line/);
  assert.match(a.headline, /reads the Nasdaq list only/);
  assert.match(a.nextLook, /^No date: our stock rule never looks at this list/);
  assert.match(a.realMoney, /If this company is in the S&P 500/);
  assert.equal(buyLine(a).text, "When to buy: not part of our plan (see why)");
});

test("a fund that is not the core gets a fund answer with no stock rows", () => {
  const a = buyWindow({ symbol: "DDD", isFund: true, isCoreFund: false, bw: contract(), setup: setup() });
  honest(a);
  assert.equal(a.tone, "not_ours");
  assert.equal(a.conditions.length, 0);
  assert.match(a.realMoney, /not this one/);
});

test("the core fund is the kind of fund the monthly plan buys", () => {
  const a = buyWindow({ symbol: "DDD", isFund: true, isCoreFund: true });
  honest(a);
  assert.equal(a.kind, "core");
  assert.equal(a.headline, "This is the kind of fund our monthly plan buys.");
  assert.match(buyLine(a).text, /every month/);
  assert.equal(isCoreFundCard({ index_tracked: "S&P 500 Index" }), true);
  assert.equal(isCoreFundCard({ index_tracked: "S&P SmallCap 600 Index" }), false);
  assert.equal(isCoreFundCard({ index_tracked: "S&P 500" }), true);
  for (const idx of ["S&P 500 Equal Weight Index", "S&P 500 Growth Index", "Daily 2x S&P 500", "S&P 500 Information Technology Index"]) {
    assert.equal(isCoreFundCard({ index_tracked: idx }), false, idx);
  }
  assert.equal(isCoreFundCard(null), false);
});

test("a missing, stale or sample contract falls back and says the look is not available yet", () => {
  for (const bw of [null, contract({}, { as_of: "2026-10-13" }), contract({}, { sample: true })]) {
    const a = buyWindow({ symbol: "AAA", onMainList: true, names, bw, setup: setup(), checklist: ck(2.6) });
    honest(a);
    assert.equal(a.available, false);
    assert.equal(a.tone, "wait");
    assert.match(a.headline, /not available yet/);
    assert.match(a.realMoney, /not as a single stock today/);
    assert.deepEqual(a.conditions.map((c) => c.id), ["stretch", "setup", "reward"]);
  }
  assert.equal(lookState(null), "missing");
  assert.equal(lookState(contract(), "2026-10-15"), "stale");
  assert.equal(lookState(contract({}, { sample: true }), null, true), "ok");
  // The fallback still names the month of the next look, from the New York date, but never in a month's first days.
  assert.match(buyWindow({ today: "2026-10-15", symbol: "AAA", onMainList: true, bw: null, setup: setup() }).nextLook, /next in early November/);
  assert.equal(nextLookMonth("2026-12-20"), "January");
  assert.equal(nextLookMonth("2026-11-02"), "");
  assert.doesNotMatch(buyWindow({ today: "2026-11-01", symbol: "AAA", onMainList: true, bw: null, setup: setup() }).nextLook, /early|undefined/);
  // A name the contract does not list falls back the same way.
  const a = buyWindow({ symbol: "ZZZ", onMainList: true, bw: contract(), setup: setup() });
  assert.equal(a.available, false);
});

test("buyWindowFor reads a page's files: main list, readable checklist, fund cards", () => {
  const derived = { as_of: "2026-10-14", symbols: [{ symbol: "AAA", last_date: "2026-10-14", dist_sma50_pct: 4.2, setup: setup() }] };
  const checklist = { as_of: "2026-10-14", sample: false, symbols: [ck(2.6)] };
  const a = buyWindowFor("AAA", { derived, checklist, bw: contract(), mainList: ["AAA", "BBB"], names });
  assert.equal(a.kind, "main");
  assert.equal(a.tone, "rules_allow");
  // An older checklist row cannot be read today: the reward row is unknown and the house checks do not pass.
  const old = { ...checklist, symbols: [{ ...ck(2.6), as_of: "2026-10-13" }] };
  const b = buyWindowFor("AAA", { derived, checklist: old, bw: contract(), mainList: ["AAA"], names });
  assert.equal(cond(b, "reward").ok, null);
  assert.equal(b.tone, "wait");
  assert.equal(buyWindowFor("AAA", { derived, checklist, fund: { index_tracked: "S&P 500 Index" } }).kind, "core");
  assert.equal(buyWindowFor("AAA", { derived, checklist, fund: {} }).kind, "fund");
  assert.equal(buyWindowFor("AAA", { derived, checklist, mainList: [] }).kind, "look");
  assert.deepEqual(mainListOf({ docs: [{ name: "watchlist", content: { symbols: [{ symbol: "AAA" }] } }], watchlist: { symbols: [{ symbol: "CCC" }] } }), ["AAA"]);
});

// A group: AAA and BBB share one; the rule would hold AAA. BBB is told who holds the group's place even when another
// check fails too, so a tick never sits next to "another name leads its group".
function group(aaa = {}, bbb = {}) {
  const row = { eligible: true, of: 21, sector: "Information Technology", sector_leader: "CCC", above_200: true, rising_200: true, dist_sma50_pct: 2, stretched: false };
  return contract({}, {
    held_now: ["AAA"], would_hold_if_today: ["AAA"],
    names: {
      AAA: { ...row, rank: 4, held_now: true, would_hold_if_today: true, blockers: [], ...aaa },
      BBB: { ...row, rank: 6, held_now: false, would_hold_if_today: false, blockers: ["stretched"], stretched: true, dist_sma50_pct: 9.1, ...bbb },
      CCC: { ...row, rank: 2, held_now: false, would_hold_if_today: false, blockers: ["stretched"], stretched: true, dist_sma50_pct: 12, ...{} },
    },
  });
}

test("a name that fails a check is still told its group's place is taken, and by whom", () => {
  const a = buyWindow({ symbol: "BBB", onMainList: true, names, bw: group(), setup: setup({ stretched: true, dist_sma50_pct: 9.1 }), checklist: ck(2.6) });
  honest(a);
  assert.equal(cond(a, "leader").ok, false);
  assert.match(cond(a, "leader").now, /Ranks 6 of 21.*Alpha Corp holds its group's place/);
  assert.ok(a.waitFor.some((w) => /^Alpha Corp leads its group|^Alpha Corp holds its group's place/.test(w)));
  assert.ok(a.waitFor.includes("Wait until it is less than 8% above its 50-day line."));
});

test("a held name kept by the top-10 buffer holds the place against a better-ranked newcomer", () => {
  const bw = group({ rank: 8 }, { rank: 3, blockers: ["sector_taken"], stretched: false, dist_sma50_pct: 2 });
  const a = buyWindow({ symbol: "BBB", onMainList: true, names, bw, setup: setup(), checklist: ck(2.6) });
  honest(a);
  assert.equal(cond(a, "leader").ok, false);
  assert.ok(a.waitFor.some((w) => /Alpha Corp already holds its group's place on paper and keeps it while it stays in the top 10/.test(w)));
  // The leader of the group by past-year rise is stretched; the held name says it holds the place, never "leads".
  const h = buyWindow({ symbol: "AAA", onMainList: true, names, bw, setup: setup(), checklist: ck(2.6) });
  assert.equal(cond(h, "leader").ok, true);
  assert.match(cond(h, "leader").label, /Keeps its place: still in the top 10/);
  assert.match(cond(h, "leader").now, /keeps its group.s place/);
});

test("a name that ranks above the group's holder is not marked down for the group", () => {
  const bw = group({ held_now: false }, { rank: 3 });
  bw.held_now = [];
  const a = buyWindow({ symbol: "BBB", onMainList: true, names, bw, setup: setup({ stretched: true, dist_sma50_pct: 9.1 }), checklist: ck(2.6) });
  honest(a);
  assert.equal(cond(a, "leader").ok, true);
  assert.equal(cond(a, "stretch").ok, false);
});

test("a reward-to-risk just under the bar never reads as the bar", () => {
  const a = buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(1.96) });
  assert.equal(cond(a, "reward").ok, false);
  assert.equal(cond(a, "reward").now, "1.96 to 1");
  assert.equal(cond(buyWindow({ symbol: "AAA", onMainList: true, names, bw: contract(), setup: setup(), checklist: ck(2.04) }), "reward").now, "2.0 to 1");
});

test("below a falling 200-day line reads as one wait line", () => {
  const a = buyWindow({
    symbol: "AAA", onMainList: true, names,
    bw: contract({ above_200: false, rising_200: false, would_hold_if_today: false, blockers: ["below_200", "falling_200"] }, { would_hold_if_today: [] }),
    setup: setup(), checklist: ck(2.4),
  });
  assert.ok(a.waitFor.includes("Wait until it is back above its 200-day line and that line turns up again."));
  assert.equal(a.waitFor.filter((w) => /200-day/.test(w)).length, 1);
});
