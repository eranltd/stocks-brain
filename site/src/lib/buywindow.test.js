import test from "node:test";
import assert from "node:assert/strict";
import { buyLine, buyWindow, buyWindowFor, CARD_RULES, dayWords, isCoreFundCard, lookRules, lookState, mainListOf, sp500Of } from "./buywindow.js";

const names = { AAA: "Alpha Corp", BBB: "Beta Inc", CCC: "Gamma Co", DDD: "Delta Ltd" };
const FORBIDDEN = /buy signal|recommend|you should buy/i;

// Contract version 2 (scripts/buy_window.py): one block per rule, weekly first.
const FIVE = { label: "Five Leaders", cadence: "monthly", next_review: "2026-11-02", slots: 5, keep_rank: 10, rank_by: "rs_12_1", entry_checks: ["above_rising_200", "not_stretched"], keep_checks: ["above_200"], stretch_limit_pct: 8.0 };
const BASE = {
  five_leaders_weekly: { ...FIVE, label: "Five Leaders: reviewed every week", cadence: "weekly", next_review: "2026-10-19" },
  weekly_swing: { label: "Weekly Swing", cadence: "weekly", next_review: "2026-10-19", slots: 5, keep_rank: null, rank_by: "rs_1m", entry_checks: ["above_50", "not_stretched"], keep_checks: [], stretch_limit_pct: 8.0 },
  five_leaders: FIVE,
  five_leaders_quarterly: { ...FIVE, label: "Five Leaders: reviewed every three months", cadence: "quarterly", next_review: "2027-01-04" },
};
const row = (over = {}) => ({
  eligible: true, rank: 3, of: 21, sector: "Information Technology", sector_leader: "AAA", held_now: false, would_hold_if_today: true,
  above_200: true, rising_200: true, above_50: true, dist_sma50_pct: 4.2, stretched: false, blockers: [], ...over,
});
/** A rule block whose lists agree with its rows. `rows`: ticker -> overrides of row(). */
function rule(id, rows = { AAA: {} }) {
  const n = Object.fromEntries(Object.entries(rows).map(([t, o]) => [t, row(o)]));
  return { ...BASE[id], names: n, held_now: Object.keys(n).filter((t) => n[t].held_now), would_hold_if_today: Object.keys(n).filter((t) => n[t].would_hold_if_today) };
}
/** The whole contract: `per` maps a rule id to its rows (default: AAA picked by every rule). */
function contract(per = {}, top = {}) {
  return {
    as_of: "2026-10-16", sample: false, version: 2, next_weekly_buy: "2026-10-19",
    rules: Object.fromEntries(Object.keys(BASE).map((id) => [id, rule(id, per[id] ?? { AAA: {} })])),
    ...top,
  };
}
const setup = (over = {}) => ({ checks: { trend: true, rs_3m: true, rs_6m: true, calm: true }, passed: 4, stretched: false, dist_sma50_pct: 4.2, dist_long_pct: 15.1, as_of: "2026-10-16", ...over });
const ck = (rr = 2.6, basis = "resistance") => ({ symbol: "AAA", as_of: "2026-10-16", risk_plan: { stop_pct: 3, stop_basis: "support", tp1_pct: rr * 3, tp1_basis: basis, tp2_pct: 9, rr_tp1: rr, rr_tp2: 3, fits_house_rule: rr >= 2 } });
const cond = (a, id) => a.conditions.find((c) => c.id === id);
const game = (a, id) => [...a.games, ...a.monthly].find((g) => g.id === id);
const gcond = (a, rid, id) => game(a, rid).conditions.find((c) => c.id === id);
const say = (a) => [a.headline, a.realMoney, a.nextLook, ...a.waitFor, a.note, ...a.conditions.flatMap((c) => [c.label, c.now, c.need]),
  ...[...a.games, ...a.monthly].flatMap((g) => [g.name, g.line, g.why, ...g.waitFor, ...g.conditions.flatMap((c) => [c.label, c.now, c.need])])].join(" ");
const main = (over = {}) => buyWindow({ today: "2026-10-17", symbol: "AAA", onMainList: true, sp500: true, names, bw: contract(), setup: setup(), checklist: ck(2.6), ...over });

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

test("the card reads the rules weekly first, then monthly, and only a version-2 contract", () => {
  assert.deepEqual(CARD_RULES.map((r) => r.id), ["five_leaders_weekly", "weekly_swing", "five_leaders", "five_leaders_quarterly"]);
  assert.deepEqual(lookRules(contract()).map((r) => r.id), CARD_RULES.map((r) => r.id));
  assert.deepEqual(lookRules({ ...contract(), version: 1 }), []);
  assert.deepEqual(lookRules({ as_of: "2026-10-14", rule: "five_leaders", names: {} }), []); // the old contract
  const a = main();
  assert.deepEqual(a.games.map((g) => g.id), ["five_leaders_weekly", "weekly_swing"]);
  assert.deepEqual(a.monthly.map((g) => g.id), ["five_leaders", "five_leaders_quarterly"]);
  assert.equal(game(a, "weekly_swing").name, "Weekly Swing");
});

test("every check passes: the weekly game would pick it next week; real money still waits", () => {
  const a = main();
  honest(a);
  assert.equal(a.tone, "rules_allow");
  assert.equal(a.headline, "The weekly game would pick it on Mon 19 Oct if nothing changes. Real money still waits.");
  assert.match(a.realMoney, /^With real money: not as a single stock today\./);
  assert.match(a.realMoney, /weekly buy of the whole-market fund \(an S&P 500 fund\) already buys a small piece of it/);
  assert.match(a.realMoney, /next weekly buy is Mon 19 Oct/);
  assert.match(a.nextLook, /Next weekly look: Mon 19 Oct/);
  assert.equal(a.nextReview, "2026-10-19");
  assert.ok(a.games.every((g) => g.would && g.line === "would pick it"));
  assert.ok(a.waitFor.some((w) => /only on paper/.test(w)));
  const line = buyLine(a, "2026-10-17");
  assert.deepEqual(line, { text: "The weekly game would pick it next Monday if nothing changes", tone: "accent" });
  assert.doesNotMatch(line.text, /\d/);
});

test("not this week: each weekly rule says why, in its own rule's words", () => {
  const bw = contract({
    five_leaders_weekly: { AAA: { rank: 7, sector_leader: "BBB", would_hold_if_today: false, blockers: ["sector_taken"] }, BBB: { rank: 2, sector_leader: "BBB", would_hold_if_today: false, blockers: ["stretched"], stretched: true, dist_sma50_pct: 11 } },
    weekly_swing: { AAA: { rank: 4, above_50: false, dist_sma50_pct: -2.4, would_hold_if_today: false, blockers: ["below_50"] } },
  });
  const a = main({ bw });
  honest(a);
  assert.equal(a.tone, "wait");
  assert.equal(a.headline, "Not this week. The weekly game would not pick it.");
  const fl = game(a, "five_leaders_weekly");
  assert.equal(fl.line, "would not pick it");
  assert.equal(fl.why, "Beta Inc leads its group");
  assert.match(gcond(a, "five_leaders_weekly", "leader").now, /Ranks 7 of 21 by past-year rise; Beta Inc leads its group/);
  const sw = game(a, "weekly_swing");
  assert.equal(sw.why, "below its 50-day line");
  assert.deepEqual(sw.conditions.map((c) => c.id), ["leader", "above50", "stretch"]);
  assert.equal(gcond(a, "weekly_swing", "above50").ok, false);
  assert.equal(gcond(a, "weekly_swing", "above50").now, "2.4% below it");
  assert.match(gcond(a, "weekly_swing", "leader").now, /by past-month rise against the market/);
  assert.ok(a.waitFor.includes("Wait until it is back above its 50-day line."));
  assert.ok(a.waitFor.some((w) => /Beta Inc leads its group by past-year rise/.test(w)));
  // The monthly rule still picks it, folded away: it never decides the headline while the weekly game is there.
  assert.equal(game(a, "five_leaders").would, true);
  assert.deepEqual(buyLine(a, "2026-10-17"), { text: "When to buy: not this week (see why)", tone: "flat" });
});

test("one weekly rule picking it is enough for the weekly line", () => {
  const a = main({ bw: contract({ weekly_swing: { AAA: { would_hold_if_today: false, blockers: ["stretched"], stretched: true, dist_sma50_pct: 9.5 } } }) });
  honest(a);
  assert.equal(a.tone, "rules_allow");
  assert.equal(game(a, "weekly_swing").why, "stretched above its 50-day line");
  assert.equal(gcond(a, "weekly_swing", "stretch").ok, false);
  assert.match(a.headline, /^The weekly game would pick it on Mon 19 Oct/);
});

test("the rule would pick it, but a thin reward-to-risk still says wait", () => {
  const a = main({ checklist: ck(1.4, "risk_multiple") });
  honest(a);
  assert.equal(a.tone, "wait");
  assert.equal(a.headline, "The weekly game would pick it, but the house checks say wait.");
  assert.deepEqual(a.conditions.map((c) => c.id), ["setup", "reward"]);
  assert.equal(cond(a, "reward").ok, false);
  assert.ok(a.waitFor.some((w) => /2 to 1 or more/.test(w)));
  assert.equal(cond(main({ checklist: ck(0.01) }), "reward").now, "under 0.1 to 1");
  assert.equal(cond(main({ checklist: ck(1.96) }), "reward").now, "1.96 to 1");
  assert.equal(cond(main({ checklist: ck(2.04) }), "reward").now, "2.0 to 1");
  assert.match(cond(main({ checklist: ck(0.82) }), "reward").now, /^0\.8 to 1$/);
  assert.ok(main({ checklist: ck(0.8, "resistance") }).waitFor.some((w) => /nearest ceiling is close/.test(w)));
  assert.equal(main({ setup: setup({ passed: 2 }) }).tone, "wait");
});

test("real money for a single stock only when the rule that picks it passed its own history test", () => {
  // stocksEarned is true because SOME rule passed; the picking rules' own frozen verdicts decide.
  for (const verdicts of [{}, { five_leaders: "passes_history" }, { weekly_swing: "rejected", five_leaders_weekly: null }]) {
    const a = main({ stocksEarned: true, verdicts });
    honest(a);
    assert.equal(a.earned, false);
    assert.match(a.headline, /Real money still waits/);
    assert.match(a.realMoney, /not as a single stock today/);
  }
  const yes = main({ stocksEarned: true, verdicts: { weekly_swing: "passes_history" } });
  assert.equal(yes.earned, true);
  assert.equal(yes.headline, "Our rules would allow a small amount on Mon 19 Oct, if nothing changes.");
  assert.match(yes.realMoney, /only within the house limits/);
  assert.equal(game(yes, "weekly_swing").earned, true);
  assert.equal(game(yes, "five_leaders_weekly").earned, false);
  // ... but not while the trust ladder says no, and not when that rule would not pick it.
  assert.equal(main({ stocksEarned: false, verdicts: { weekly_swing: "passes_history" } }).earned, false);
  const notPicked = contract({ weekly_swing: { AAA: { would_hold_if_today: false, blockers: ["below_50"], above_50: false, dist_sma50_pct: -1 } } });
  assert.equal(main({ bw: notPicked, stocksEarned: true, verdicts: { weekly_swing: "passes_history" } }).earned, false);
  // Through the page adapter: each verdict is read for its own rule id from market/rules.json.
  const derived = { symbols: [{ symbol: "AAA", last_date: "2026-10-16", setup: { checks: setup().checks, passed: 4, stretched: false, dist_sma50_pct: 4.2, dist_long_pct: 15.1 } }] };
  const checklist = { as_of: "2026-10-16", sample: false, symbols: [ck(2.6)] };
  const ctx = { today: "2026-10-17", derived, checklist, bw: contract(), mainList: ["AAA"], stocksEarned: true, names };
  assert.equal(buyWindowFor("AAA", { ...ctx, rulesResult: { frozen: { satellite: { other_rule: { verdict: "passes_history" } } } } }).earned, false);
  assert.equal(buyWindowFor("AAA", { ...ctx, rulesResult: { frozen: { satellite: { five_leaders_weekly: { verdict: "passes_history" } } } } }).earned, true);
});

test("a held name the weekly game keeps says so, judged by what keeps it", () => {
  const bw = contract({ five_leaders_weekly: { AAA: { held_now: true } }, weekly_swing: { AAA: { held_now: true } } });
  const a = main({ bw });
  honest(a);
  assert.equal(a.held, true);
  assert.equal(a.headline, "The weekly game holds it on paper, and would keep it. Real money still waits.");
  const fl = game(a, "five_leaders_weekly");
  assert.equal(fl.line, "would keep it");
  assert.match(fl.conditions[0].label, /Keeps its place: still in the top 10 of our names by past-year rise/);
  assert.deepEqual(fl.conditions.map((c) => c.id), ["leader", "above200"]);
  // Weekly Swing has no keep buffer: a held name is judged like a newcomer.
  assert.deepEqual(game(a, "weekly_swing").conditions.map((c) => c.id), ["leader", "above50", "stretch"]);
  assert.match(game(a, "weekly_swing").conditions[0].label, /^Strongest past-month rise/);
  assert.match(buyLine(a, "2026-10-17").text, /The weekly game holds it on paper; real money waits/);
});

test("a held name the weekly game would let go says so", () => {
  const bw = contract({
    five_leaders_weekly: { AAA: { held_now: true, rank: 14, would_hold_if_today: false, blockers: ["rank_too_low", "no_slot"] } },
    weekly_swing: { AAA: { would_hold_if_today: false, blockers: ["no_slot"] } },
  });
  const a = main({ bw });
  honest(a);
  assert.equal(a.headline, "Not this week. The weekly game holds it on paper, but would let it go.");
  assert.equal(game(a, "five_leaders_weekly").line, "would let it go");
  assert.equal(game(a, "five_leaders_weekly").why, "it is out of the top 10 and the places go to stronger names");
  assert.ok(a.waitFor.includes("Wait until its past-year rise is back in the top 10 of our names."));
});

test("below or under a falling 200-day line reads as one wait line", () => {
  const off = { AAA: { above_200: false, rising_200: false, would_hold_if_today: false, blockers: ["below_200", "falling_200"] } };
  const a = main({ bw: contract({ five_leaders_weekly: off, weekly_swing: { AAA: { would_hold_if_today: false, blockers: ["no_slot"] } } }) });
  honest(a);
  assert.equal(gcond(a, "five_leaders_weekly", "trend200").ok, false);
  assert.match(gcond(a, "five_leaders_weekly", "trend200").now, /Below it; the line is falling/);
  assert.ok(a.waitFor.includes("Wait until it is back above its 200-day line and that line turns up again."));
  assert.equal(a.waitFor.filter((w) => /200-day/.test(w)).length, 1);
});

// A group: AAA and BBB share one; the rule would hold AAA. BBB is told who holds the group's place even when another
// check fails too, so a tick never sits next to "another name leads its group".
function group(id, aaa = {}, bbb = {}) {
  const base = { sector_leader: "CCC", dist_sma50_pct: 2 };
  return contract({
    [id]: {
      AAA: { ...base, rank: 4, held_now: true, ...aaa },
      BBB: { ...base, rank: 6, would_hold_if_today: false, blockers: ["stretched"], stretched: true, dist_sma50_pct: 9.1, ...bbb },
      CCC: { ...base, rank: 2, would_hold_if_today: false, blockers: ["stretched"], stretched: true, dist_sma50_pct: 12 },
    },
  });
}

test("a name that fails a check is still told its group's place is taken, and by whom", () => {
  const a = main({ symbol: "BBB", bw: group("five_leaders_weekly"), setup: setup({ stretched: true, dist_sma50_pct: 9.1 }) });
  honest(a);
  assert.equal(gcond(a, "five_leaders_weekly", "leader").ok, false);
  assert.match(gcond(a, "five_leaders_weekly", "leader").now, /Ranks 6 of 21.*Alpha Corp holds its group's place/);
  assert.ok(a.waitFor.some((w) => /^Alpha Corp/.test(w)));
  assert.ok(a.waitFor.includes("Wait until it is less than 8% above its 50-day line."));
});

test("a held name kept by the top-10 buffer holds the place against a better-ranked newcomer", () => {
  const bw = group("five_leaders_weekly", { rank: 8 }, { rank: 3, blockers: ["sector_taken"], stretched: false, dist_sma50_pct: 2 });
  const a = main({ symbol: "BBB", bw });
  honest(a);
  assert.equal(gcond(a, "five_leaders_weekly", "leader").ok, false);
  assert.ok(a.waitFor.some((w) => /Alpha Corp already holds its group's place on paper and keeps it while it stays in the top 10/.test(w)));
  const h = main({ bw });
  assert.equal(gcond(h, "five_leaders_weekly", "leader").ok, true);
  assert.match(gcond(h, "five_leaders_weekly", "leader").now, /keeps its group.s place/);
});

test("a name that ranks above the group's holder is not marked down for the group", () => {
  const a = main({ symbol: "BBB", bw: group("five_leaders_weekly", { held_now: false }, { rank: 3 }), setup: setup({ stretched: true, dist_sma50_pct: 9.1 }) });
  honest(a);
  assert.equal(gcond(a, "five_leaders_weekly", "leader").ok, true);
  assert.equal(gcond(a, "five_leaders_weekly", "stretch").ok, false);
  // Weekly Swing keeps nothing: a held name that ranks lower never "keeps" the place against a better-ranked one.
  const s = main({ symbol: "BBB", bw: group("weekly_swing", { rank: 8 }, { rank: 3 }), setup: setup({ stretched: true, dist_sma50_pct: 9.1 }) });
  assert.equal(gcond(s, "weekly_swing", "leader").ok, true);
  // The group's own leader that misses a check is told the place is someone else's only while it misses that check.
  const l = main({ symbol: "BBB", bw: group("weekly_swing", { rank: 8 }, { rank: 3, sector_leader: "BBB" }), setup: setup({ stretched: true, dist_sma50_pct: 9.1 }) });
  assert.match(gcond(l, "weekly_swing", "leader").now, /leads its group, but Alpha Corp gets the place while this one misses a check/);
});

test("two reasons read as two clauses, so the second is never said of the other name", () => {
  const bw = group("five_leaders_weekly", { rank: 2, held_now: false }, { rank: 6, blockers: ["below_200", "falling_200"], above_200: false, rising_200: false, stretched: false, dist_sma50_pct: 2 });
  const a = main({ symbol: "BBB", bw });
  assert.equal(game(a, "five_leaders_weekly").why, "Alpha Corp ranks higher in its group and it is below a falling 200-day line");
});

test("a name the rule would hold is never marked down because another name in its group is also held", () => {
  const a = main({ bw: contract({ five_leaders_weekly: { AAA: {}, BBB: { rank: 1, held_now: true } } }) });
  assert.equal(gcond(a, "five_leaders_weekly", "leader").ok, true);
  assert.equal(a.tone, "rules_allow");
});

test("a look whose next weekly look has gone by is stale, never a past date as the next look", () => {
  assert.equal(lookState(contract(), "2026-10-16", false, "2026-10-19"), "ok");
  assert.equal(lookState(contract(), "2026-10-16", false, "2026-10-20"), "stale");
  const a = main({ today: "2026-10-21" });
  honest(a);
  assert.equal(a.available, false);
  assert.doesNotMatch(say(a), /Mon 19 Oct/);
  assert.match(a.realMoney, /next weekly buy is Mon 26 Oct/); // the coming Monday, from the This week card's own rule
  // A sample file on the sample site keeps its own (past) dates: everything there is labelled sample.
  assert.equal(lookState(contract({}, { sample: true }), null, true, "2026-10-21"), "ok");
});

test("a missing, old-contract, stale or sample look falls back and says the look is not available yet", () => {
  const old = { as_of: "2026-10-16", sample: false, rule: "five_leaders", next_review: "2026-11-02", names: { AAA: row() } };
  for (const bw of [null, old, contract({}, { as_of: "2026-10-15" }), contract({}, { sample: true })]) {
    const a = main({ bw });
    honest(a);
    assert.equal(a.available, false);
    assert.equal(a.tone, "wait");
    assert.match(a.headline, /not available yet/);
    assert.match(a.realMoney, /not as a single stock today/);
    assert.match(a.nextLook, /first trading day of each week/);
    assert.deepEqual(a.conditions.map((c) => c.id), ["stretch", "setup", "reward"]);
    assert.deepEqual(buyLine(a, "2026-10-17"), { text: "When to buy: wait (see why)", tone: "flat" });
  }
  assert.equal(lookState(null), "missing");
  assert.equal(lookState(old), "missing");
  assert.equal(lookState(contract(), "2026-10-19"), "stale");
  assert.equal(lookState(contract({}, { sample: true })), "sample");
  assert.equal(lookState(contract({}, { sample: true }), null, true), "ok");
  assert.equal(main({ symbol: "ZZZ" }).available, false); // a name the contract does not list
});

test("the weekly buy day is the published, holiday-aware date while it is ahead", () => {
  const holiday = contract({}, { as_of: "2026-02-13", next_weekly_buy: "2026-02-17" });
  for (const r of Object.values(holiday.rules)) r.next_review = r.cadence === "weekly" ? "2026-02-17" : "2026-03-02";
  const a = main({ today: "2026-02-14", bw: holiday, setup: setup({ as_of: "2026-02-13" }) });
  assert.equal(a.nextBuy, "2026-02-17");
  assert.match(a.realMoney, /next weekly buy is Tue 17 Feb/);
  assert.match(a.headline, /Tue 17 Feb/);
});

test("real money for names the rules do not read: S&P 500 members only where true", () => {
  const look = (sp500) => buyWindow({ today: "2026-10-17", symbol: "CCC", onMainList: false, sp500, names, bw: contract(), setup: setup({ checks: { trend: false }, dist_sma50_pct: -2.5, dist_long_pct: 3 }), checklist: ck(2.5) });
  const a = look(true);
  honest(a);
  assert.equal(a.tone, "not_ours");
  assert.deepEqual(a.conditions.map((c) => c.id), ["trend", "stretch", "reward"]);
  assert.match(cond(a, "trend").now, /2\.5% below its 50-day line, 3\.0% above its 200-day line/);
  assert.match(a.headline, /read the Nasdaq list only/);
  assert.match(a.nextLook, /^No date/);
  assert.match(a.realMoney, /already buys a small piece of it/);
  assert.equal(a.games.length, 0);
  assert.match(look(false).realMoney, /It is not in the S&P 500, so our weekly buy of the whole-market fund does not hold it/);
  assert.doesNotMatch(look(false).realMoney, /small piece/);
  assert.match(look(null).realMoney, /If this company is in the S&P 500/);
  for (const sp of [true, false, null]) honest(look(sp));
  assert.equal(buyLine(a).text, "When to buy: not part of our plan (see why)");
  // A main-list name that is not in the S&P 500 is never told the fund holds it either.
  assert.match(main({ sp500: false }).realMoney, /not in the S&P 500/);
});

test("funds: the core fund is what the weekly buy goes into; any other fund is not part of the plan", () => {
  const core = buyWindow({ today: "2026-10-17", symbol: "DDD", isFund: true, isCoreFund: true, bw: contract() });
  honest(core);
  assert.equal(core.kind, "core");
  assert.equal(core.headline, "This is the kind of fund our weekly buy goes into.");
  assert.match(core.realMoney, /every week/);
  assert.match(core.realMoney, /next weekly buy is Mon 19 Oct/);
  assert.deepEqual(buyLine(core), { text: "When to buy: every week, in our plan", tone: "accent" });
  const other = buyWindow({ today: "2026-10-17", symbol: "DDD", isFund: true, isCoreFund: false, bw: contract(), setup: setup() });
  honest(other);
  assert.equal(other.tone, "not_ours");
  assert.equal(other.conditions.length, 0);
  assert.match(other.realMoney, /not this one/);
  assert.equal(isCoreFundCard({ index_tracked: "S&P 500 Index" }), true);
  assert.equal(isCoreFundCard({ index_tracked: "S&P 500" }), true);
  for (const idx of ["S&P SmallCap 600 Index", "S&P 500 Equal Weight Index", "S&P 500 Growth Index", "Daily 2x S&P 500", "S&P 500 Information Technology Index"]) {
    assert.equal(isCoreFundCard({ index_tracked: idx }), false, idx);
  }
  assert.equal(isCoreFundCard(null), false);
});

test("buyWindowFor reads a page's files: main list, readable checklist, fund cards, membership", () => {
  const derived = { as_of: "2026-10-16", symbols: [{ symbol: "AAA", last_date: "2026-10-16", dist_sma50_pct: 4.2, setup: setup() }] };
  const checklist = { as_of: "2026-10-16", sample: false, symbols: [ck(2.6)] };
  const a = buyWindowFor("AAA", { today: "2026-10-17", derived, checklist, bw: contract(), mainList: ["AAA", "BBB"], sp500: true, names });
  assert.equal(a.kind, "main");
  assert.equal(a.tone, "rules_allow");
  // An older checklist row cannot be read today: the reward row is unknown and the house checks do not pass.
  const old = { ...checklist, symbols: [{ ...ck(2.6), as_of: "2026-10-15" }] };
  const b = buyWindowFor("AAA", { today: "2026-10-17", derived, checklist: old, bw: contract(), mainList: ["AAA"], names });
  assert.equal(cond(b, "reward").ok, null);
  assert.equal(b.tone, "wait");
  assert.equal(buyWindowFor("AAA", { derived, checklist, fund: { index_tracked: "S&P 500 Index" } }).kind, "core");
  assert.equal(buyWindowFor("AAA", { derived, checklist, fund: {} }).kind, "fund");
  assert.equal(buyWindowFor("AAA", { derived, checklist, mainList: [] }).kind, "look");
  assert.deepEqual(mainListOf({ docs: [{ name: "watchlist", content: { symbols: [{ symbol: "AAA" }] } }], watchlist: { symbols: [{ symbol: "CCC" }] } }), ["AAA"]);
  const here = { symbols: [{ symbol: "AAA", sp500: false }, { symbol: "BBB" }] };
  const mainWl = { symbols: [{ symbol: "BBB", sp500: true }] };
  assert.equal(sp500Of("AAA", here, mainWl), false);
  assert.equal(sp500Of("BBB", here, mainWl), true);
  assert.equal(sp500Of("CCC", here, mainWl), null);
});
