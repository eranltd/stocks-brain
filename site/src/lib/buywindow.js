// "When could we buy it?": the answer our own house rules give for one company or fund, in plain words. Pure functions,
// no React; tested in buywindow.test.js. Every number is computed in Python and read from published files: each stock
// rule's look (data/market/buy_window.json, contract version 2, written by the Nasdaq daily run for the main list only),
// the setup checks (derived.json) and the chart checklist's risk plan (checklist.json). This file only words them.
//
// The household acts weekly (docs/household.md 0.5.0). Real money: the whole-market fund (an S&P 500 fund) is bought
// every week; no single stock gets real money until THAT stock rule passes its history test AND the trust ladder reaches
// Small money (stocksEarned in lib/money.js). Pretend money: the weekly game (two weekly rules) and the monthly Five
// Leaders with its quarterly variant. So the answer always says what happens with real money first, then the weekly
// game, then the monthly rule; it never says a name is a buy for real money while that is not earned, and never uses
// the words "buy signal", "recommend" or "you should buy".

import { readable } from "./brief.js";
import { rowFor } from "./checklist.js";
import { whenWords } from "./simple.js";
import { weeklyBuyDay, WEEKLY_RULES } from "./weekly.js";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 2 Nov" from "2026-11-02"; "" for anything else. */
export function dayWords(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}

/** The rules the card reads, in its order (scripts/buy_window.py RULE_ORDER), with their plain names. */
const weeklyName = (id, fallback) => WEEKLY_RULES.find((r) => r.id === id)?.name ?? fallback;
export const CARD_RULES = [
  { id: "five_leaders_weekly", name: weeklyName("five_leaders_weekly", "Five Leaders, weekly") },
  { id: "weekly_swing", name: weeklyName("weekly_swing", "Weekly Swing") },
  { id: "five_leaders", name: "Five Leaders, monthly" },
  { id: "five_leaders_quarterly", name: "Five Leaders, every three months" },
];
const ruleName = (id, rd) => CARD_RULES.find((r) => r.id === id)?.name ?? rd?.label ?? id;

/** A percent distance with one decimal and no sign ("6.0%"). */
const pct1 = (v) => `${Math.abs(v).toFixed(1)}%`;
/** Reward-to-risk with one decimal ("0.8"). */
const times = (v) => (Number(v) < 0.05 ? "under 0.1" : Number(v).toFixed(1));

/** The rule blocks of a version-2 contract, in the card's order; [] for anything else. */
export function lookRules(bw) {
  if (!bw || bw.version !== 2 || !bw.rules || typeof bw.rules !== "object") return [];
  return CARD_RULES.filter((r) => bw.rules[r.id]?.names).map((r) => ({ id: r.id, ...bw.rules[r.id] }));
}

/**
 * Whether the rules' look can be used for a page whose setup data is from `setupAsOf`, seen on `today` (the New York
 * date): "ok", "missing" (no file, or not contract version 2), "stale" or "sample". A live look whose next review date
 * has already gone by is stale too (the daily runs stopped): the card must never name a past date as the next look.
 */
export function lookState(bw, setupAsOf = null, siteSample = false, today = null) {
  const rules = lookRules(bw);
  if (!rules.length) return "missing";
  if (bw.sample && !siteSample) return "sample";
  if (setupAsOf && bw.as_of && bw.as_of < setupAsOf) return "stale";
  if (!bw.sample && today && rules.some((r) => r.next_review && r.next_review < today)) return "stale";
  return "ok";
}

const NOTE = "This is what our own rules say, not a forecast. Prices can change a lot before the next look.";
const FUND_NOTE = "This is what our own plan says, not a forecast. Prices can change a lot from one week to the next.";

function stretchRow(dist, stretched, limit) {
  const ok = stretched != null ? !stretched : dist != null ? dist < limit : null;
  return {
    id: "stretch",
    label: `Not stretched: less than ${limit}% above its 50-day line`,
    ok,
    now: dist == null ? "Not available today" : `${pct1(dist)} ${dist >= 0 ? "above" : "below"} it`,
    need: `Under ${limit}% above`,
  };
}

function rrRow(rp, min) {
  const rr = num(rp?.rr_tp1);
  return {
    id: "reward",
    label: `Reward-to-risk to the first target is ${min} or more (chart checklist)`,
    ok: rr == null ? null : rr >= min,
    // One decimal, or two when one would round a miss up to the bar ("1.96", never "2.0" next to a cross).
    now: rr == null ? "Not available today" : `${rr < min && Number(times(rr)) >= min ? rr.toFixed(2) : times(rr)} to 1`,
    need: `${min} to 1 or more`,
  };
}

function rrWait(rp, min) {
  const rr = num(rp?.rr_tp1);
  if (rr == null || rr >= min) return null;
  if (rp.tp1_basis === "resistance") return "The nearest ceiling is close. Reward-to-risk fits only after a dip toward support or a clean break above the ceiling.";
  return `Wait for a better reward-to-risk: ${min} to 1 or more.`;
}

/** What real money does with this name, and the weekly buy's date in words ("" when unknown). */
function realMoneyWords({ kind, sp500, earned, buy }) {
  const when = buy ? ` The next weekly buy is ${buy}.` : "";
  if (kind === "core") return `With real money: yes, for money we will not need for 5 years or more. This is the kind of fund our weekly buy goes into: the same amount every week, whatever the news. This one follows the S&P 500, like the fund our plan describes.${when}`;
  if (kind === "fund") return `With real money: our weekly buy goes into one whole-market fund (an S&P 500 fund), not this one. This fund is here to read about and compare.${when}`;
  if (earned) return `With real money: only within the house limits, only on the rule's review day, and only what that rule holds. Most of our money stays in the weekly buy of the whole-market fund.${when}`;
  const piece = sp500 === true ? "Our weekly buy of the whole-market fund (an S&P 500 fund) already buys a small piece of it."
    : sp500 === false ? "It is not in the S&P 500, so our weekly buy of the whole-market fund does not hold it. That weekly buy stays the plan."
    : "If this company is in the S&P 500, our weekly buy of the whole-market fund (an S&P 500 fund) already buys a small piece of it.";
  return `With real money: not as a single stock${kind === "main" ? " today" : ""}. ${piece}${when}`;
}

/** The first two reasons in words: a lone reason bare, two as full clauses (a plain string counts as both forms). */
function whyWords(why) {
  const two = why.slice(0, 2).map((w) => (Array.isArray(w) ? w : [w, w]));
  return two.length === 1 ? two[0][0] : two.map((w) => w[1]).join(" and ");
}

const RANK_WORDS = { rs_12_1: "past-year rise", rs_1m: "past-month rise against the market" };
const CHECK_ROW = {
  above_rising_200: { id: "trend200", label: "Above a rising 200-day line", need: "Above it, and the line rising", blocks: ["below_200", "falling_200"] },
  above_200: { id: "above200", label: "Above its 200-day line", need: "Above it", blocks: ["below_200"] },
  above_50: { id: "above50", label: "Above its 50-day line", need: "Above it", blocks: ["below_50"] },
};

/**
 * One rule's look at one name: {id, name, cadence, nextReview, held, would, earned, line, why, conditions, waitFor}.
 * `rd` is the rule's block of the contract, `n` its row for the name.
 */
function ruleLook(rd, n, { symbol, nameOf, earnedRule }) {
  const blockers = new Set(n.blockers ?? []);
  const held = Boolean(n.held_now);
  const would = Boolean(n.would_hold_if_today);
  const slots = num(rd.slots) ?? 5;
  const keep = num(rd.keep_rank);
  const limit = num(rd.stretch_limit_pct) ?? 8;
  const rw = RANK_WORDS[rd.rank_by] ?? "rise";
  const leader = n.sector_leader ?? null;
  const keptMode = held && keep != null;
  // Who holds its group's place if the look were today: another name in the same group that the rule would hold. A
  // name that fails another check is still told when its group's place is gone (a better-ranked name, or a held name
  // the rule keeps), so the row never shows a tick next to "another name leads its group".
  const taker = (rd.would_hold_if_today ?? []).find((t) => t !== symbol && rd.names?.[t] && rd.names[t].sector === n.sector) ?? null;
  const tk = taker ? rd.names[taker] : null;
  // A held name is kept (ahead of better-ranked newcomers) only while it ranks within the keep buffer; one that fell out
  // of it and is picked again won its place as a newcomer, by rank.
  const keptBy = (o) => Boolean(o?.held_now) && keep != null && num(o?.rank) != null && o.rank <= keep;
  const takerKept = keptBy(tk) && !(num(n.rank) != null && tk.rank < n.rank);
  const placeGone = Boolean(taker) && !would && (takerKept || (num(tk.rank) != null && num(n.rank) != null && tk.rank < n.rank));
  // A name that misses a check carries no group or place reason from the engine (it never got that far). It is still
  // told when, even passing every check, it would not win a place: the rule's places all go to names in other groups
  // that rank higher, or that a rule with a keep buffer keeps.
  const ahead = (rd.would_hold_if_today ?? []).filter((t) => {
    const o = t !== symbol ? rd.names?.[t] : null;
    if (!o || o.sector === n.sector) return false;
    return keptBy(o) || (num(o.rank) != null && num(n.rank) != null && o.rank < n.rank);
  });
  const slotsGone = !would && !placeGone && n.eligible !== false && !["sector_taken", "no_slot"].some((b) => blockers.has(b)) && ahead.length >= slots;
  const rankPart = n.eligible === false ? "Not a full year of prices yet"
    : num(n.rank) != null ? `Ranks ${n.rank} of ${n.of} by ${rw}` : "No rank today";
  const leadPart = n.eligible === false ? ""
    : taker && !would && !placeGone && leader === symbol ? `; leads its group, but ${nameOf(taker)} gets the place while this one misses a check`
    : taker ? `; ${nameOf(taker)} ${would ? "also " : ""}holds its group's place`
    : would ? (held ? "; keeps its group's place" : "; wins its group's place")
    : slotsGone ? `; all ${slots} places go to stronger names`
    : leader === symbol ? "; leads its group"
    : leader && !blockers.has("sector_taken") ? `; ${nameOf(leader)} ranks higher in its group but misses a check, so the group's place is open`
    : leader ? `; ${nameOf(leader)} leads its group` : "";
  const rankBlocked = ["not_eligible", "rank_too_low", "sector_taken", "no_slot"].some((b) => blockers.has(b));
  const conditions = [{
    id: "leader",
    label: keptMode ? `Keeps its place: still in the top ${keep} of our names by ${rw}` : `Strongest ${rw} in its group (one per group, ${slots} places in all)`,
    ok: !(rankBlocked || placeGone || slotsGone),
    now: `${rankPart}${leadPart}`,
    need: keptMode ? `Stay in the top ${keep}` : `Lead its group and win one of the ${slots} places`,
  }];
  // A held name the rule keeps is judged by what keeps it; every other name by what a newcomer needs.
  const checks = keptMode && would ? rd.keep_checks ?? [] : rd.entry_checks ?? [];
  for (const c of checks) {
    if (c === "not_stretched") {
      conditions.push(stretchRow(num(n.dist_sma50_pct), n.stretched ?? null, limit));
      continue;
    }
    const spec = CHECK_ROW[c];
    if (!spec) continue;
    const fact = c === "above_50" ? n.above_50 : n.above_200;
    const now = fact == null ? "Not available today"
      : c === "above_50" ? (num(n.dist_sma50_pct) != null ? `${pct1(n.dist_sma50_pct)} ${n.dist_sma50_pct >= 0 ? "above" : "below"} it` : fact ? "Above it" : "Below it")
      : `${fact ? "Above" : "Below"} it${c === "above_rising_200" && n.rising_200 != null ? `; the line is ${n.rising_200 ? "rising" : "falling"}` : ""}`;
    conditions.push({ id: spec.id, label: spec.label, ok: fact == null ? null : !spec.blocks.some((b) => blockers.has(b)), now, need: spec.need });
  }

  const waitFor = [];
  // Each reason in two forms: bare when it stands alone ("would not pick it: stretched above its 50-day line"), and a
  // full clause when joined to another, so a second reason is never read as said of the other name ("Beta Inc ranks
  // higher in its group and it is below a falling 200-day line").
  const why = [];
  if (blockers.has("not_eligible")) { waitFor.push("It needs a full year of unbroken prices before our rules can rank it."); why.push(["under a year of prices", "it has under a year of prices"]); }
  if (placeGone && takerKept) {
    waitFor.push(`${nameOf(taker)} already holds its group's place on paper and keeps it while it stays in the top ${keep}. Our rules take one per group.`);
    why.push(`${nameOf(taker)} keeps its group's place`);
  } else if (placeGone) {
    waitFor.push(`${nameOf(taker)} holds its group's place, because it ranks higher by ${rw} and passes the checks. Our rules take one per group, so this one would need a bigger ${rw} than ${nameOf(taker)}.`);
    why.push(`${nameOf(taker)} ranks higher in its group`);
  } else if (blockers.has("sector_taken")) {
    waitFor.push(leader && leader !== symbol
      ? `${nameOf(leader)} leads its group by ${rw}. Our rules take one per group, so this one would need a bigger ${rw} than ${nameOf(leader)}.`
      : "Another name in its group ranks higher. Our rules take one per group.");
    why.push(leader && leader !== symbol ? `${nameOf(leader)} leads its group` : "another name leads its group");
  }
  if (blockers.has("rank_too_low")) { waitFor.push(`Wait until its ${rw} is back in the top ${keep} of our names.`); why.push([`out of the top ${keep}`, `it is out of the top ${keep}`]); }
  if (blockers.has("no_slot") || slotsGone) { waitFor.push(`All ${slots} places go to names that rank higher by ${rw} or that the rule already holds.`); why.push("the places go to stronger names"); }
  if (blockers.has("below_200") && blockers.has("falling_200")) { waitFor.push("Wait until it is back above its 200-day line and that line turns up again."); why.push(["below a falling 200-day line", "it is below a falling 200-day line"]); }
  else if (blockers.has("below_200")) { waitFor.push("Wait until it is back above its 200-day line."); why.push(["below its 200-day line", "it is below its 200-day line"]); }
  else if (blockers.has("falling_200")) { waitFor.push("Wait until its 200-day line turns up again."); why.push("its 200-day line is falling"); }
  if (blockers.has("below_50")) { waitFor.push("Wait until it is back above its 50-day line."); why.push(["below its 50-day line", "it is below its 50-day line"]); }
  if (blockers.has("stretched")) { waitFor.push(`Wait until it is less than ${limit}% above its 50-day line.`); why.push(["stretched above its 50-day line", "it is stretched above its 50-day line"]); }

  const line = would ? (held ? "would keep it" : "would pick it") : held ? "would let it go" : "would not pick it";
  return {
    id: rd.id, name: ruleName(rd.id, rd), cadence: rd.cadence, nextReview: rd.next_review ?? null, held, would,
    earned: Boolean(earnedRule(rd.id)), line, why: whyWords(why), conditions, waitFor,
  };
}

/**
 * The rules' wait lines in one list. With two or more rules, a line that only some of them need names them ("Weekly
 * Swing: wait until it is back above its 50-day line."), so a check one rule does not have is never read as needed for
 * all; a line every rule needs stays bare, once.
 */
function ruleWaits(looks) {
  if (looks.length < 2) return looks.flatMap((l) => l.waitFor);
  const out = [];
  for (const w of [...new Set(looks.flatMap((l) => l.waitFor))]) {
    const who = looks.filter((l) => l.waitFor.includes(w)).map((l) => l.name);
    out.push(who.length === looks.length ? w : `${who.join(" and ")}: ${/^(Wait|It|All|Another)\b/.test(w) ? w[0].toLowerCase() + w.slice(1) : w}`);
  }
  return out;
}

/**
 * The answer for one name: {headline, tone ("wait" | "rules_allow" | "not_ours"), realMoney, nextBuy (the next weekly
 * buy, YYYY-MM-DD or null), nextLook, games (the weekly rules' looks), monthly (Five Leaders monthly and quarterly),
 * conditions (house checks, or the only checks of a name the rules do not read: [{id, label, ok (true | false | null),
 * now, need}]), waitFor, note, kind ("main" | "look" | "fund" | "core"), nextReview (the weekly game's next look, or
 * null), held (a weekly rule holds it on paper now), earned, available (the rules' look was read)}.
 *
 * `setup`: the derived.json setup of the name ({checks, passed, stretched, dist_sma50_pct, dist_long_pct}) plus `as_of`
 * (its last close); `checklist`: today's checklist row (with risk_plan), or null when it cannot be read; `bw`: the
 * buy_window.json contract; `verdicts`: rule id -> its frozen history verdict; `sp500`: true / false / null (unknown);
 * `names`: ticker -> name.
 */
export function buyWindow({ today = null, symbol, onMainList = false, isFund = false, isCoreFund = false, sp500 = null, bw = null, setup = null, checklist = null, stocksEarned = false, verdicts = {}, names = {}, minRR = 2, stretchPct = 8, siteSample = false }) {
  const nameOf = (t) => names?.[t] ?? t;
  const rp = checklist?.risk_plan ?? null;
  const nextBuy = today ? weeklyBuyDay(today, bw, siteSample) : bw?.next_weekly_buy ?? null;
  const buy = dayWords(nextBuy);
  const empty = { games: [], monthly: [], held: false, earned: false, nextReview: null, nextBuy };

  if (isFund) {
    if (isCoreFund) {
      return {
        ...empty, kind: "core", tone: "rules_allow", available: true,
        headline: "This is the kind of fund our weekly buy goes into.",
        realMoney: realMoneyWords({ kind: "core", buy }),
        nextLook: "Every week: the same amount, on the first trading day, whatever the chart says.",
        conditions: [],
        waitFor: ["Nothing to wait for: the plan does not try to time the market. Buying when the index is at a high is normal; highs come in clusters."],
        note: FUND_NOTE,
      };
    }
    return {
      ...empty, kind: "fund", tone: "not_ours", available: true,
      headline: "Not part of our weekly plan.",
      realMoney: realMoneyWords({ kind: "fund", buy }),
      nextLook: "No date: it is not part of the plan, and our stock rules never look at funds.",
      conditions: [], waitFor: [], note: FUND_NOTE,
    };
  }

  const all = lookRules(bw);
  const limit = num(all.find((r) => r.cadence === "weekly")?.stretch_limit_pct) ?? num(all[0]?.stretch_limit_pct) ?? stretchPct;

  if (!onMainList) {
    const dist = num(setup?.dist_sma50_pct);
    const distLong = num(setup?.dist_long_pct);
    const trendOk = typeof setup?.checks?.trend === "boolean" ? setup.checks.trend : null;
    const conditions = [
      {
        id: "trend",
        label: "Heading up: above its 50-day line, which is above its 200-day line",
        ok: trendOk,
        now: dist == null ? "Not available today" : `${pct1(dist)} ${dist >= 0 ? "above" : "below"} its 50-day line${distLong == null ? "" : `, ${pct1(distLong)} ${distLong >= 0 ? "above" : "below"} its 200-day line`}`,
        need: "Above both, the 50-day over the 200-day",
      },
      stretchRow(dist, setup?.stretched ?? null, limit),
      rrRow(rp, minRR),
    ];
    const waitFor = [];
    if (trendOk === false) waitFor.push("Wait for the trend to turn up: back above its 50-day line, with that line above the 200-day.");
    if (conditions[1].ok === false) waitFor.push(`Wait until it is less than ${limit}% above its 50-day line.`);
    const r = rrWait(rp, minRR);
    if (r) waitFor.push(r);
    waitFor.push("It is here to read about and learn from, not to act on.");
    return {
      ...empty, kind: "look", tone: "not_ours", available: true,
      headline: "Not part of our plan. Our stock rules read the Nasdaq list only.",
      realMoney: realMoneyWords({ kind: "look", sp500, buy }),
      nextLook: "No date: neither the weekly game nor the monthly rule looks at this list.",
      conditions, waitFor, note: NOTE,
    };
  }

  // A main-list name: each rule's own look, read from the contract. Real money is spoken of only when stocks have earned
  // a place (stocksEarned) AND it is a rule that would pick this name whose OWN frozen history verdict passed: another
  // rule passing must never turn this rule's pick into a real-money answer.
  const earnedRule = (id) => Boolean(stocksEarned) && verdicts?.[id] === "passes_history";
  const state = lookState(bw, setup?.as_of ?? null, siteSample, today);
  const setupRow = setup && num(setup.passed) != null
    ? { id: "setup", label: "At least 3 of our 4 quick checks pass", ok: setup.passed >= 3, now: `${setup.passed} of 4 pass`, need: "3 or more" }
    : null;
  const house = [...(setupRow ? [setupRow] : []), rrRow(rp, minRR)];
  const houseWait = [];
  if (setupRow && !setupRow.ok) houseWait.push("Wait until at least 3 of the 4 quick checks pass.");
  const rw = rrWait(rp, minRR);
  if (rw) houseWait.push(rw);
  const looks = state === "ok" ? all.filter((r) => r.names[symbol]).map((r) => ruleLook(r, r.names[symbol], { symbol, nameOf, earnedRule })) : [];

  if (!looks.length) {
    return {
      ...empty, kind: "main", tone: "wait", available: false,
      headline: "Wait. Our rules' look is not available yet.",
      realMoney: realMoneyWords({ kind: "main", sp500, buy }),
      nextLook: `The weekly game looks on the first trading day of each week (pretend money)${buy ? `; the next one is ${buy}` : ""}. Its look at this name appears after the next daily run.`,
      conditions: [stretchRow(num(setup?.dist_sma50_pct), setup?.stretched ?? null, limit), ...house],
      waitFor: [state === "stale" ? "The rules' look is from an older close than this page; wait for the next daily run." : "Wait for the next daily run, which writes the rules' look.", ...houseWait],
      note: NOTE,
    };
  }

  const games = looks.filter((l) => l.cadence === "weekly");
  const monthly = looks.filter((l) => l.cadence !== "weekly");
  const lead = games.length ? games : monthly; // the weekly game decides the headline; the monthly rule only if it is alone
  const picking = lead.filter((l) => l.would);
  const houseOk = house.every((c) => c.ok !== false) && house.find((c) => c.id === "reward").ok === true;
  const allow = picking.length > 0 && houseOk;
  const earned = picking.some((l) => l.earned);
  // The weekly game looks on the weekly buy day (both are the first trading day of next week, scripts/buy_window.py):
  // one date from one source (weeklyBuyDay), so the card never names two different weeks, nor a past one on the sample
  // site, whose fixed sample close ends weeks ago. On a live look in date they are the same day.
  const nextReview = games.length && nextBuy ? nextBuy : lead[0].nextReview;
  const date = dayWords(nextReview);
  const who = games.length ? "The weekly game" : "Our monthly rule";
  const heldLead = lead.some((l) => l.held);
  let headline;
  if (allow && picking.every((l) => l.held)) headline = earned ? `${who} holds it, and would keep it.` : `${who} holds it on paper, and would keep it. Real money still waits.`;
  else if (allow) headline = earned ? `Our rules would allow a small amount on ${date}, if nothing changes.` : `${who} would pick it on ${date} if nothing changes. Real money still waits.`;
  else if (picking.length) headline = `${who} would pick it, but the house checks say wait.`;
  else headline = heldLead ? `Not this ${games.length ? "week" : "month"}. ${who} holds it on paper, but would let it go.` : `Not this ${games.length ? "week" : "month"}. ${who} would not pick it.`;

  const waitFor = [...new Set([...ruleWaits(lead), ...houseWait])];
  if (allow) {
    waitFor.push(earned
      ? "Act only on the rule's review day, never between review days, and only within the house limits."
      : "Every check passes, but only on paper. Real money still waits until a stock rule passes its history test and earns our trust; today none has.");
  }
  const nextLook = games.length
    ? `Next weekly look: ${date || "the first trading day of next week"}, the first trading day of the week (pretend money).`
    : `Next look: ${date}, the rule's ${lead[0].cadence === "quarterly" ? "quarterly" : "monthly"} date (pretend money).`;
  return {
    kind: "main", tone: allow ? "rules_allow" : "wait", available: true, held: heldLead, earned, nextReview, nextBuy,
    headline, realMoney: realMoneyWords({ kind: "main", sp500, earned, buy }), nextLook,
    games, monthly: games.length ? monthly : [], conditions: house, waitFor, note: NOTE,
  };
}

/** The main list's tickers (config/watchlist.json), from the loaded docs; it survives the market switch. */
export function mainListOf(data) {
  const doc = (data?.docs ?? []).find((d) => d.name === "watchlist")?.content;
  return (doc?.symbols ?? data?.watchlist?.symbols ?? []).map((s) => s.symbol);
}

/** Whether a company is in the S&P 500 (the watchlists' hand-checked `sp500`): true, false or null when no list says. */
export function sp500Of(symbol, ...lists) {
  for (const wl of lists) {
    const row = (wl?.symbols ?? []).find((s) => s.symbol === symbol);
    if (typeof row?.sp500 === "boolean") return row.sp500;
  }
  return null;
}

/** The main list's watchlist document, from the loaded docs. */
export const mainWatchlistOf = (data) => (data?.docs ?? []).find((d) => d.name === "watchlist")?.content ?? null;

/** True for a fund that follows the S&P 500 (the kind of fund the household's weekly plan buys), from its fund card. */
// The plain index only: "S&P 500" or "S&P 500 Index". An equal-weight, growth, value, leveraged or sector version of the
// index is a different fund and must not be told it is the plan's fund.
export const isCoreFundCard = (card) => /^\s*S&P 500(\s+Index)?\s*$/i.test(String(card?.index_tracked ?? ""));

/**
 * buyWindow() for a symbol from a page's data: `derived` (that market's derived.json), `checklist` (its checklist.json),
 * `bw` (buy_window.json), `mainList` (tickers), `fund` (the fund card, {} for a fund without one, null for a stock),
 * `stocksEarned`, `rulesResult` (market/rules.json: each rule's own frozen verdict), `sp500` (true / false / null),
 * `names`, `siteSample`, `minRR`, `stretchPct`, `today` (the New York date, for the weekly buy day and the stale check).
 */
export function buyWindowFor(symbol, { today = null, derived = null, checklist = null, bw = null, mainList = [], fund = null, stocksEarned = false, rulesResult = null, sp500 = null, names = {}, siteSample = false, minRR = 2, stretchPct = 8 } = {}) {
  const row = (derived?.symbols ?? []).find((s) => s.symbol === symbol) ?? null;
  const st = row?.setup ?? null;
  const setup = row ? {
    checks: st?.checks ?? null, passed: st?.passed ?? null, stretched: st?.stretched ?? null,
    dist_sma50_pct: num(st?.dist_sma50_pct) ?? num(row.dist_sma50_pct), dist_long_pct: num(st?.dist_long_pct), as_of: row.last_date ?? null,
  } : null;
  const ck = rowFor(checklist, symbol);
  const read = readable(checklist, ck, row?.last_date ?? null, { sampleSite: siteSample });
  const verdicts = Object.fromEntries(Object.entries(rulesResult?.frozen?.satellite ?? {}).map(([id, v]) => [id, v?.verdict ?? null]));
  return buyWindow({
    today, symbol, onMainList: mainList.includes(symbol), isFund: fund != null, isCoreFund: fund != null && isCoreFundCard(fund),
    sp500, bw, setup, checklist: read.ok ? ck : null, stocksEarned, verdicts, names, minRR, stretchPct, siteSample,
  });
}

/**
 * The one short line on the home's company cards, in words only (no digits, like the rest of the simple home):
 * {text, tone}. `today` is the New York date (YYYY-MM-DD).
 */
export function buyLine(a, today) {
  if (!a) return null;
  if (a.kind === "core") return { text: "When to buy: every week, in our plan", tone: "accent" };
  if (a.kind === "fund" || a.kind === "look") return { text: "When to buy: not part of our plan (see why)", tone: "flat" };
  if (!a.available) return { text: "When to buy: wait (see why)", tone: "flat" };
  const who = a.games?.length ? "The weekly game" : "Our monthly rule";
  if (a.tone === "rules_allow") {
    const when = (a.nextReview && today ? whenWords(a.nextReview, today) : "") || "at its next look";
    if (a.earned) return { text: a.held ? "Our rule holds it, within the house limits (see why)" : `Our rules would allow a small amount ${when} if nothing changes`, tone: "accent" };
    if (a.held) return { text: `${who} holds it on paper; real money waits (see why)`, tone: "accent" };
    return { text: `${who} would pick it ${when} if nothing changes`, tone: "accent" };
  }
  return { text: `When to buy: not this ${a.games?.length ? "week" : "month"} (see why)`, tone: "flat" };
}
