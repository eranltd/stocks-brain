// "When could we buy it?": the answer our own house rules give for one company or fund, in plain words. Pure functions,
// no React; tested in buywindow.test.js. Every number is computed in Python and read from published files: the rule's
// look (data/market/buy_window.json, written by the Nasdaq daily run for the main list only), the setup checks
// (derived.json) and the chart checklist's risk plan (checklist.json). This file only words them.
//
// The household's plan binds the answer (docs/household.md): real money goes into a whole-market fund every month; no
// single stock gets real money until a tested rule passes its history test AND the trust ladder reaches Small money
// (stocksEarned in lib/money.js). The stock rule's picks are a pretend-money experiment. So the answer always says what
// happens with real money first, never says a name is a buy for real money while stocksEarned is false, and never
// uses the words "buy signal", "recommend" or "you should buy".

import { readable } from "./brief.js";
import { rowFor } from "./checklist.js";
import { whenWords } from "./simple.js";

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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/**
 * The month of the rule's next look seen from `iso`, the New York date: the next month ("November" for "2026-10-15").
 * "" in a month's first four days (the first trading day may still be ahead: a holiday and a weekend can push it to the
 * 4th) and for anything that is not a date, so the words never name a wrong month. Dates themselves come from Python.
 */
export function nextLookMonth(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m && Number(m[3]) > 4 ? MONTHS[Number(m[2]) % 12] : "";
}

/** A percent distance with one decimal and no sign ("6.0%"). */
const pct1 = (v) => `${Math.abs(v).toFixed(1)}%`;
/** Reward-to-risk with one decimal ("0.8"). */
const times = (v) => (Number(v) < 0.05 ? "under 0.1" : Number(v).toFixed(1));

/**
 * Whether the rule's look can be used for a page whose setup data is from `setupAsOf`, seen on `today` (the New York
 * date): "ok", "missing", "stale" or "sample". A look whose next review date has already gone by is stale too (the daily
 * runs stopped): the card must never name a past date as the next look.
 */
export function lookState(bw, setupAsOf = null, siteSample = false, today = null) {
  if (!bw || !bw.names) return "missing";
  if (bw.sample && !siteSample) return "sample";
  if (setupAsOf && bw.as_of && bw.as_of < setupAsOf) return "stale";
  if (today && bw.next_review && bw.next_review < today) return "stale";
  return "ok";
}

const NOTE = "This is what our own rules say, not a forecast. Prices can change a lot before the next review.";
const FUND_NOTE = "This is what our own plan says, not a forecast. Prices can change a lot from one month to the next.";

/** The stretch, trend and checklist rows both a main-list name and a look-only name get. */
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

/**
 * The answer for one name: {headline, tone ("wait" | "rules_allow" | "not_ours"), realMoney, nextLook, conditions:
 * [{id, label, ok (true | false | null), now, need}], waitFor: [strings], note, kind ("main" | "look" | "fund" |
 * "core"), nextReview (YYYY-MM-DD or null), held (the rule holds it on paper now), available (the rule's look was read)}.
 *
 * `setup`: the derived.json setup of the name ({checks, passed, stretched, dist_sma50_pct, dist_long_pct}) plus `as_of`
 * (its last close); `checklist`: today's checklist row (with risk_plan), or null when it cannot be read; `bw`: the
 * buy_window.json contract; `names`: ticker -> name.
 */
export function buyWindow({ today = null, symbol, onMainList = false, isFund = false, isCoreFund = false, bw = null, setup = null, checklist = null, stocksEarned = false, ruleVerdict = null, names = {}, minRR = 2, stretchPct = 8, siteSample = false }) {
  const nameOf = (t) => names?.[t] ?? t;
  const rp = checklist?.risk_plan ?? null;

  if (isFund) {
    if (isCoreFund) {
      return {
        kind: "core", tone: "rules_allow", available: true, held: false, nextReview: null,
        headline: "This is the kind of fund our monthly plan buys.",
        realMoney: "With real money: yes, for money we will not need for 5 years or more. The same amount every month, whatever the news says. This one follows the S&P 500, like the fund our plan describes.",
        nextLook: "Every month: the same amount, on the same day, whatever the chart says.",
        conditions: [],
        waitFor: ["Nothing to wait for: the plan does not try to time the market. Buying when the index is at a high is normal; highs come in clusters."],
        note: FUND_NOTE,
      };
    }
    return {
      kind: "fund", tone: "not_ours", available: true, held: false, nextReview: null,
      headline: "Not part of our monthly plan.",
      realMoney: "With real money: our monthly plan buys one whole-market fund (an S&P 500 fund), not this one. This fund is here to read about and compare.",
      nextLook: "No date: it is not part of the plan, and our stock rule never looks at funds.",
      conditions: [],
      waitFor: [],
      note: FUND_NOTE,
    };
  }

  const limit = num(bw?.stretch_limit_pct) ?? stretchPct;

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
      kind: "look", tone: "not_ours", available: true, held: false, nextReview: null,
      headline: "Not part of our plan. Our stock rule reads the Nasdaq list only.",
      realMoney: "With real money: not as a single stock. Our real money goes into a whole-market fund every month. If this company is in the S&P 500, that fund already holds a small piece of it.",
      nextLook: "No date: our stock rule never looks at this list.",
      conditions, waitFor, note: NOTE,
    };
  }

  // A main-list name: the rule's own look, read from the contract. Real money is spoken of only when stocks have earned
  // a place (stocksEarned) AND it is THIS rule (bw.rule) whose frozen history verdict passed (`ruleVerdict`): another
  // rule passing must never turn this rule's pick into a real-money answer.
  const earned = Boolean(stocksEarned) && ruleVerdict === "passes_history";
  const realMoney = earned
    ? "With real money: only within the house limits, only on the rule's monthly date, and only what the rule holds. Most of our money stays in the monthly whole-market fund."
    : "With real money: not as a single stock today. Our monthly whole-market fund (an S&P 500 fund) already holds a small piece of it.";
  const state = lookState(bw, setup?.as_of ?? null, siteSample, today);
  const n = state === "ok" ? bw.names[symbol] ?? null : null;
  const setupRow = setup && num(setup.passed) != null
    ? { id: "setup", label: "At least 3 of our 4 quick checks pass", ok: setup.passed >= 3, now: `${setup.passed} of 4 pass`, need: "3 or more" }
    : null;

  if (!n) {
    const conditions = [
      stretchRow(num(setup?.dist_sma50_pct), setup?.stretched ?? null, limit),
      ...(setupRow ? [setupRow] : []),
      rrRow(rp, minRR),
    ];
    return {
      kind: "main", tone: "wait", available: false, held: false, nextReview: null,
      headline: "Wait. Our rule's look is not available yet.",
      realMoney,
      nextLook: `Our stock rule looks on the first trading day of each month${nextLookMonth(today) ? `, next in early ${nextLookMonth(today)}` : ""} (pretend money). Its look at this name appears after the next daily run.`,
      conditions,
      waitFor: [state === "stale" ? "The rule's look is from an older close than this page; wait for the next daily run." : "Wait for the next daily run, which writes the rule's look."],
      note: NOTE,
    };
  }

  const blockers = new Set(n.blockers ?? []);
  const leader = n.sector_leader ?? null;
  const held = Boolean(n.held_now);
  const slots = num(bw.slots) ?? 5;
  const keep = num(bw.keep_rank) ?? 10;
  // Who holds its group's place if the look were today: another name in the same group that the rule would hold. A
  // name that fails another check is still told when its group's place is gone (a better-ranked name, or a held name
  // the rule keeps), so the row never shows a tick next to "another name leads its group".
  const taker = (bw.would_hold_if_today ?? []).find((t) => t !== symbol && bw.names?.[t] && bw.names[t].sector === n.sector) ?? null;
  const tk = taker ? bw.names[taker] : null;
  const takerKept = Boolean(tk?.held_now) && !(num(tk?.rank) != null && num(n.rank) != null && tk.rank < n.rank);
  const placeGone = Boolean(taker) && !n.would_hold_if_today && (takerKept || (num(tk.rank) != null && num(n.rank) != null && tk.rank < n.rank));
  const rankPart = n.eligible === false ? "Not a full year of prices yet"
    : num(n.rank) != null ? `Ranks ${n.rank} of ${n.of} by past-year rise` : "No rank today";
  const leadPart = n.eligible === false ? ""
    : taker ? `; ${nameOf(taker)} ${n.would_hold_if_today ? "also " : ""}holds its group's place`
    : n.would_hold_if_today ? (held ? "; keeps its group's place" : "; wins its group's place")
    : leader === symbol ? "; leads its group"
    : leader ? `; ${nameOf(leader)} leads its group` : "";
  const rankBlocked = ["not_eligible", "rank_too_low", "sector_taken", "no_slot"].some((b) => blockers.has(b));
  const conditions = [
    {
      id: "leader",
      label: held
        ? `Keeps its place: still in the top ${keep} of our names by past-year rise`
        : `Strongest past-year rise in its group (our rule takes one per group, ${slots} places in all)`,
      ok: !(rankBlocked || placeGone),
      now: `${rankPart}${leadPart}`,
      need: held ? `Stay in the top ${keep}` : `Lead its group and win one of the ${slots} places`,
    },
    {
      id: "trend200",
      label: held ? "Above its 200-day line" : "Above a rising 200-day line",
      ok: n.above_200 == null ? null : !(blockers.has("below_200") || blockers.has("falling_200")),
      now: n.above_200 == null ? "Not available today"
        : `${n.above_200 ? "Above" : "Below"} it${n.rising_200 == null ? "" : `; the line is ${n.rising_200 ? "rising" : "falling"}`}`,
      need: held ? "Above it" : "Above it, and the line rising",
    },
    stretchRow(num(n.dist_sma50_pct) ?? num(setup?.dist_sma50_pct), n.stretched ?? setup?.stretched ?? null, limit),
    ...(setupRow ? [setupRow] : []),
    rrRow(rp, minRR),
  ];

  const waitFor = [];
  if (blockers.has("not_eligible")) waitFor.push("It needs a full year of unbroken prices before the rule can rank it.");
  if (placeGone && takerKept) waitFor.push(`${nameOf(taker)} already holds its group's place on paper and keeps it while it stays in the top ${keep}. Our rule takes one per group.`);
  else if (placeGone && taker === leader) waitFor.push(`${nameOf(taker)} leads its group by past-year rise. Our rule takes one per group, so this one would need a bigger past-year rise than ${nameOf(taker)}.`);
  else if (placeGone) waitFor.push(`${nameOf(taker)} holds its group's place: it ranks higher by past-year rise and passes the rule's checks. Our rule takes one per group, so this one would need a bigger past-year rise than ${nameOf(taker)}.`);
  else if (blockers.has("sector_taken") && leader && leader !== symbol) waitFor.push(`${nameOf(leader)} leads its group by past-year rise. Our rule takes one per group, so this one would need a bigger past-year rise than ${nameOf(leader)}.`);
  else if (blockers.has("sector_taken")) waitFor.push("Another name in its group ranks higher. Our rule takes one per group.");
  if (blockers.has("rank_too_low")) waitFor.push(held ? `Wait until its past-year rise is back in the top ${keep} of our names.` : "Wait until its past-year rise ranks among the strongest of our names.");
  if (blockers.has("no_slot")) waitFor.push(`All ${slots} places go to names that rank higher today or that the rule already holds.`);
  if (blockers.has("below_200") && blockers.has("falling_200")) waitFor.push("Wait until it is back above its 200-day line and that line turns up again.");
  else if (blockers.has("below_200")) waitFor.push("Wait until it is back above its 200-day line.");
  else if (blockers.has("falling_200")) waitFor.push("Wait until its 200-day line turns up again.");
  const stretchFail = conditions.find((c) => c.id === "stretch").ok === false;
  if (stretchFail) waitFor.push(`Wait until it is less than ${limit}% above its 50-day line.`);
  if (setupRow && !setupRow.ok) waitFor.push("Wait until at least 3 of the 4 quick checks pass.");
  const r = rrWait(rp, minRR);
  if (r) waitFor.push(r);

  const ruleWould = Boolean(n.would_hold_if_today);
  const houseOk = conditions.every((c) => c.ok !== false) && conditions.find((c) => c.id === "reward").ok === true;
  const allow = ruleWould && houseOk;
  const date = dayWords(bw.next_review);
  let headline;
  if (allow && held) headline = earned ? "Our rule holds it, and would keep it today." : "Our rule holds it on paper, and would keep it today. Real money still waits.";
  else if (allow) headline = earned ? `Our rules would allow a small amount on ${date}, if nothing changes.` : "Our rule would pick it on paper today. Real money still waits.";
  else if (ruleWould) headline = held ? "Our rule would keep it on paper, but the house checks say wait." : "Our rule would pick it today, but the house checks say wait.";
  else headline = held ? "Wait. Our rule holds it on paper, but would let it go today." : "Wait. Our rule would not pick it today.";
  if (allow) {
    waitFor.push(earned
      ? "Act only on the rule's monthly date, never between dates, and only within the house limits."
      : "Every check above passes, but only on paper. Real money still waits until a stock rule passes its history test and earns our trust; today none has.");
  }

  const q = bw.next_review_quarterly;
  const quarterly = q && q !== bw.next_review ? ` The every-three-months version looks next on ${dayWords(q)}.` : "";
  return {
    kind: "main", tone: allow ? "rules_allow" : "wait", available: true, held, earned, nextReview: bw.next_review ?? null,
    headline, realMoney,
    nextLook: date ? `Next look: ${date}, the rule's monthly date (pretend money).${quarterly}` : `Our stock rule looks on the first trading day of each month.${quarterly}`,
    conditions, waitFor, note: NOTE,
  };
}

/** The main list's tickers (config/watchlist.json), from the loaded docs; it survives the market switch. */
export function mainListOf(data) {
  const doc = (data?.docs ?? []).find((d) => d.name === "watchlist")?.content;
  return (doc?.symbols ?? data?.watchlist?.symbols ?? []).map((s) => s.symbol);
}

/** True for a fund that follows the S&P 500 (the kind of fund the household's monthly plan buys), from its fund card. */
// The plain index only: "S&P 500" or "S&P 500 Index". An equal-weight, growth, value, leveraged or sector version of the
// index is a different fund and must not be told it is the plan's fund.
export const isCoreFundCard = (card) => /^\s*S&P 500(\s+Index)?\s*$/i.test(String(card?.index_tracked ?? ""));

/**
 * buyWindow() for a symbol from a page's data: `derived` (that market's derived.json), `checklist` (its checklist.json),
 * `bw` (buy_window.json), `mainList` (tickers), `fund` (the fund card, {} for a fund without one, null for a stock),
 * `stocksEarned`, `rulesResult` (market/rules.json: the rule's own frozen verdict), `names`, `siteSample`, `minRR`,
 * `stretchPct`, `today` (the New York date, for the fallback's month and the stale check).
 */
export function buyWindowFor(symbol, { today = null, derived = null, checklist = null, bw = null, mainList = [], fund = null, stocksEarned = false, rulesResult = null, names = {}, siteSample = false, minRR = 2, stretchPct = 8 } = {}) {
  const row = (derived?.symbols ?? []).find((s) => s.symbol === symbol) ?? null;
  const st = row?.setup ?? null;
  const setup = row ? {
    checks: st?.checks ?? null, passed: st?.passed ?? null, stretched: st?.stretched ?? null,
    dist_sma50_pct: num(st?.dist_sma50_pct) ?? num(row.dist_sma50_pct), dist_long_pct: num(st?.dist_long_pct), as_of: row.last_date ?? null,
  } : null;
  const ck = rowFor(checklist, symbol);
  const read = readable(checklist, ck, row?.last_date ?? null, { sampleSite: siteSample });
  return buyWindow({
    today, symbol, onMainList: mainList.includes(symbol), isFund: fund != null, isCoreFund: fund != null && isCoreFundCard(fund),
    bw, setup, checklist: read.ok ? ck : null, stocksEarned, ruleVerdict: rulesResult?.frozen?.satellite?.[bw?.rule]?.verdict ?? null,
    names, minRR, stretchPct, siteSample,
  });
}

/**
 * The one short line on the home's company cards, in words only (no digits, like the rest of the simple home):
 * {text, tone}. `today` is the New York date (YYYY-MM-DD).
 */
export function buyLine(a, today) {
  if (!a) return null;
  if (a.kind === "core") return { text: "When to buy: every month, in our plan", tone: "accent" };
  if (a.kind === "fund" || a.kind === "look") return { text: "When to buy: not part of our plan (see why)", tone: "flat" };
  if (a.tone === "rules_allow") {
    const when = (a.nextReview && today ? whenWords(a.nextReview, today) : "") || "at its next look";
    if (a.earned) return { text: a.held ? "Our rule holds it, within the house limits (see why)" : `Our rules would allow a small amount ${when} if nothing changes`, tone: "accent" };
    if (a.held) return { text: "On paper, our rule holds it; real money waits (see why)", tone: "accent" };
    return { text: `On paper, our rule would pick it ${when} if nothing changes; real money waits`, tone: "accent" };
  }
  return { text: "When to buy: wait (see why)", tone: "flat" };
}
