// "When would the rules allow a buy?": the answer this site's own rules give for one company or fund, in plain words.
// Pure functions, no React; tested in buywindow.test.js. Every number is computed in Python and read from published
// files: each stock rule's look (data/market/buy_window.json, contract version 2, written by the Nasdaq daily run for the
// main list only), the setup checks (derived.json) and the chart checklist's risk plan (checklist.json). This file only
// words them; the words are in i18n/stock.js ("bw.*") and every function that writes them takes `lang` ("en" by default).
//
// The plan acts weekly (docs/household.md 0.5.0). Real money: the whole-market fund (an S&P 500 fund) is bought every
// week; no single stock gets real money until THAT stock rule passes its history test AND the trust ladder reaches Small
// money (stocksEarned in lib/money.js). Pretend money: the weekly game (two weekly rules) and the monthly Five Leaders
// with its quarterly variant. So the answer always says what happens with real money first, then the weekly game, then
// the monthly rule; it never says a name is a buy for real money while that is not earned, and never uses the words
// "buy signal", "recommend" or "you should buy" (or their Hebrew).

import { readable } from "./brief.js";
import { rowFor } from "./checklist.js";
import { fmtList, translate } from "./i18n.js";
import { whenWords } from "./simple.js";
import { weeklyBuyDay, weeklyRule } from "./weekly.js";
import dict from "../i18n/stock.js";

const tr = (lang) => translate(dict, typeof lang === "string" ? lang : "en");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HE_DAY = new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Mon 2 Nov" ("יום ב׳, 2 בנוב׳") from "2026-11-02"; "" for anything else. */
export function dayWords(iso, lang = "en") {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (lang === "he") return HE_DAY.format(d);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}

/** The rules the card reads, in its order (scripts/buy_window.py RULE_ORDER), with their plain names in a language. */
const RULE_IDS = ["five_leaders_weekly", "weekly_swing", "five_leaders", "five_leaders_quarterly"];
export function cardRules(lang = "en") {
  const t = tr(lang);
  return RULE_IDS.map((id) => ({ id, name: weeklyRule(id, lang)?.name ?? t(`bw.rule.${id}`) }));
}
export const CARD_RULES = cardRules("en");
const ruleName = (id, rd, lang) => cardRules(lang).find((r) => r.id === id)?.name ?? rd?.label ?? id;

/** A percent distance with one decimal and no sign ("6.0%"). */
const pct1 = (v) => `${Math.abs(v).toFixed(1)}%`;
/** Reward-to-risk with one decimal ("0.8"). */
const times = (v, t) => (Number(v) < 0.05 ? t("bw.under01") : Number(v).toFixed(1));

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

/** "6.0% above it" / "below it", or the not-available words. */
const distNow = (dist, t) => (dist == null ? t("bw.na") : t(dist >= 0 ? "bw.now.pctAbove" : "bw.now.pctBelow", { pct: pct1(dist) }));

function stretchRow(dist, stretched, limit, t) {
  const ok = stretched != null ? !stretched : dist != null ? dist < limit : null;
  return {
    id: "stretch",
    label: t("bw.stretch.label", { limit: `${limit}%` }),
    ok,
    now: distNow(dist, t),
    need: t("bw.stretch.need", { limit: `${limit}%` }),
  };
}

function rrRow(rp, min, t) {
  const rr = num(rp?.rr_tp1);
  return {
    id: "reward",
    label: t("bw.rr.label", { min }),
    ok: rr == null ? null : rr >= min,
    // One decimal, or two when one would round a miss up to the bar ("1.96", never "2.0" next to a cross).
    now: rr == null ? t("bw.na") : t("bw.rr.now", { x: rr < min && Number(Number(rr).toFixed(1)) >= min && rr >= 0.05 ? rr.toFixed(2) : times(rr, t) }),
    need: t("bw.rr.need", { min }),
  };
}

function rrWait(rp, min, t) {
  const rr = num(rp?.rr_tp1);
  if (rr == null || rr >= min) return null;
  if (rp.tp1_basis === "resistance") return t("bw.rr.waitCeiling");
  return t("bw.rr.wait", { min });
}

/** What real money does with this name, and the weekly buy's date in words ("" when unknown). */
function realMoneyWords({ kind, sp500, earned, buy }, t) {
  const when = buy ? t("bw.rm.when", { buy }) : "";
  const say = (key, vars = {}) => t(key, { ...vars, when }, { bidi: false });
  if (kind === "core") return say("bw.rm.core");
  if (kind === "fund") return say("bw.rm.fund");
  if (earned) return say("bw.rm.earned");
  const piece = t(sp500 === true ? "bw.rm.pieceYes" : sp500 === false ? "bw.rm.pieceNo" : "bw.rm.pieceMaybe");
  return say(kind === "main" ? "bw.rm.notSingleToday" : "bw.rm.notSingle", { piece });
}

/** The first two reasons in words: a lone reason bare, two as full clauses (a plain string counts as both forms). */
function whyWords(why, t) {
  const two = why.slice(0, 2).map((w) => (Array.isArray(w) ? w : [w, w]));
  return two.length === 1 ? two[0][0] : two.length ? t("bw.and", { a: two[0][1], b: two[1][1] }, { bidi: false }) : "";
}

const RANK_KEY = { rs_12_1: "bw.rw.rs_12_1", rs_1m: "bw.rw.rs_1m" };
const CHECK_ROW = {
  above_rising_200: { id: "trend200", key: "bw.check.trend200", blocks: ["below_200", "falling_200"] },
  above_200: { id: "above200", key: "bw.check.above200", blocks: ["below_200"] },
  above_50: { id: "above50", key: "bw.check.above50", blocks: ["below_50"] },
};
/** A reason in its two forms ([bare, clause]) from "<key>" and "<key>.clause". */
const both = (t, key, vars) => [t(key, vars), t(`${key}.clause`, vars)];

/**
 * One rule's look at one name: {id, name, cadence, nextReview, held, would, earned, line, why, conditions, waitFor}.
 * `rd` is the rule's block of the contract, `n` its row for the name.
 */
function ruleLook(rd, n, { symbol, nameOf, earnedRule, lang }) {
  const t = tr(lang);
  const blockers = new Set(n.blockers ?? []);
  const held = Boolean(n.held_now);
  const would = Boolean(n.would_hold_if_today);
  const slots = num(rd.slots) ?? 5;
  const keep = num(rd.keep_rank);
  const limit = num(rd.stretch_limit_pct) ?? 8;
  const rw = t(RANK_KEY[rd.rank_by] ?? "bw.rw.other");
  const leader = n.sector_leader ?? null;
  const keptMode = held && keep != null;
  // Who holds its group's place if the look were today: another name in the same group that the rule would hold. A
  // name that fails another check is still told when its group's place is gone (a better-ranked name, or a held name
  // the rule keeps), so the row never shows a tick next to "another name leads its group".
  const taker = (rd.would_hold_if_today ?? []).find((x) => x !== symbol && rd.names?.[x] && rd.names[x].sector === n.sector) ?? null;
  const tk = taker ? rd.names[taker] : null;
  // A held name is kept (ahead of better-ranked newcomers) only while it ranks within the keep buffer; one that fell out
  // of it and is picked again won its place as a newcomer, by rank.
  const keptBy = (o) => Boolean(o?.held_now) && keep != null && num(o?.rank) != null && o.rank <= keep;
  const takerKept = keptBy(tk) && !(num(n.rank) != null && tk.rank < n.rank);
  const placeGone = Boolean(taker) && !would && (takerKept || (num(tk.rank) != null && num(n.rank) != null && tk.rank < n.rank));
  // A name that misses a check carries no group or place reason from the engine (it never got that far). It is still
  // told when, even passing every check, it would not win a place: the rule's places all go to names in other groups
  // that rank higher, or that a rule with a keep buffer keeps.
  const ahead = (rd.would_hold_if_today ?? []).filter((x) => {
    const o = x !== symbol ? rd.names?.[x] : null;
    if (!o || o.sector === n.sector) return false;
    return keptBy(o) || (num(o.rank) != null && num(n.rank) != null && o.rank < n.rank);
  });
  const slotsGone = !would && !placeGone && n.eligible !== false && !["sector_taken", "no_slot"].some((b) => blockers.has(b)) && ahead.length >= slots;
  const rankPart = n.eligible === false ? t("bw.rank.notEligible")
    : num(n.rank) != null ? t("bw.rank.of", { rank: n.rank, of: n.of, rw }) : t("bw.rank.none");
  const leadPart = n.eligible === false ? ""
    : taker && !would && !placeGone && leader === symbol ? t("bw.lead.leadsButMisses", { name: nameOf(taker) })
    : taker ? t(would ? "bw.lead.takerAlso" : "bw.lead.taker", { name: nameOf(taker) })
    : would ? t(held ? "bw.lead.keeps" : "bw.lead.wins")
    : slotsGone ? t("bw.lead.slotsGone", { slots })
    : leader === symbol ? t("bw.lead.leads")
    : leader && !blockers.has("sector_taken") ? t("bw.lead.leaderMisses", { name: nameOf(leader) })
    : leader ? t("bw.lead.leader", { name: nameOf(leader) }) : "";
  const rankBlocked = ["not_eligible", "rank_too_low", "sector_taken", "no_slot"].some((b) => blockers.has(b));
  const conditions = [{
    id: "leader",
    label: keptMode ? t("bw.leader.labelKept", { keep, rw }) : t("bw.leader.label", { rw, slots }),
    ok: !(rankBlocked || placeGone || slotsGone),
    now: `${rankPart}${leadPart}`,
    need: keptMode ? t("bw.leader.needKept", { keep }) : t("bw.leader.need", { slots }),
  }];
  // A held name the rule keeps is judged by what keeps it; every other name by what a newcomer needs.
  const checks = keptMode && would ? rd.keep_checks ?? [] : rd.entry_checks ?? [];
  for (const c of checks) {
    if (c === "not_stretched") {
      conditions.push(stretchRow(num(n.dist_sma50_pct), n.stretched ?? null, limit, t));
      continue;
    }
    const spec = CHECK_ROW[c];
    if (!spec) continue;
    const fact = c === "above_50" ? n.above_50 : n.above_200;
    const now = fact == null ? t("bw.na")
      : c === "above_50" ? (num(n.dist_sma50_pct) != null ? distNow(n.dist_sma50_pct, t) : t(fact ? "bw.now.above" : "bw.now.below"))
      : `${t(fact ? "bw.now.above" : "bw.now.below")}${c === "above_rising_200" && n.rising_200 != null ? t(n.rising_200 ? "bw.now.lineRising" : "bw.now.lineFalling") : ""}`;
    conditions.push({ id: spec.id, label: t(`${spec.key}.label`), ok: fact == null ? null : !spec.blocks.some((b) => blockers.has(b)), now, need: t(`${spec.key}.need`) });
  }

  const waitFor = [];
  // Each reason in two forms: bare when it stands alone ("would not pick it: stretched above its 50-day line"), and a
  // full clause when joined to another, so a second reason is never read as said of the other name ("Beta Inc ranks
  // higher in its group and it is below a falling 200-day line").
  const why = [];
  if (blockers.has("not_eligible")) { waitFor.push(t("bw.wait.notEligible")); why.push(both(t, "bw.why.notEligible")); }
  if (placeGone && takerKept) {
    waitFor.push(t("bw.wait.takerKept", { name: nameOf(taker), keep }));
    why.push(t("bw.why.takerKept", { name: nameOf(taker) }));
  } else if (placeGone) {
    waitFor.push(t("bw.wait.placeGone", { name: nameOf(taker), rw }));
    why.push(t("bw.why.placeGone", { name: nameOf(taker) }));
  } else if (blockers.has("sector_taken")) {
    waitFor.push(leader && leader !== symbol ? t("bw.wait.leader", { name: nameOf(leader), rw }) : t("bw.wait.another"));
    why.push(leader && leader !== symbol ? t("bw.why.leader", { name: nameOf(leader) }) : t("bw.why.another"));
  }
  if (blockers.has("rank_too_low")) { waitFor.push(t("bw.wait.rankLow", { rw, keep })); why.push(both(t, "bw.why.rankLow", { keep })); }
  if (blockers.has("no_slot") || slotsGone) { waitFor.push(t("bw.wait.noSlot", { slots, rw })); why.push(t("bw.why.noSlot")); }
  if (blockers.has("below_200") && blockers.has("falling_200")) { waitFor.push(t("bw.wait.below200Falling")); why.push(both(t, "bw.why.below200Falling")); }
  else if (blockers.has("below_200")) { waitFor.push(t("bw.wait.below200")); why.push(both(t, "bw.why.below200")); }
  else if (blockers.has("falling_200")) { waitFor.push(t("bw.wait.falling200")); why.push(t("bw.why.falling200")); }
  if (blockers.has("below_50")) { waitFor.push(t("bw.wait.below50")); why.push(both(t, "bw.why.below50")); }
  if (blockers.has("stretched")) { waitFor.push(t("bw.wait.stretched", { limit: `${limit}%` })); why.push(both(t, "bw.why.stretched")); }

  const line = t(would ? (held ? "bw.answer.keep" : "bw.answer.pick") : held ? "bw.answer.letGo" : "bw.answer.notPick");
  return {
    id: rd.id, name: ruleName(rd.id, rd, lang), cadence: rd.cadence, nextReview: rd.next_review ?? null, held, would,
    earned: Boolean(earnedRule(rd.id)), line, why: whyWords(why, t), conditions, waitFor,
  };
}

/**
 * The rules' wait lines in one list. With two or more rules, a line that only some of them need names them ("Weekly
 * Swing: wait until it is back above its 50-day line."), so a check one rule does not have is never read as needed for
 * all; a line every rule needs stays bare, once.
 */
function ruleWaits(looks, lang) {
  if (looks.length < 2) return looks.flatMap((l) => l.waitFor);
  const out = [];
  for (const w of [...new Set(looks.flatMap((l) => l.waitFor))]) {
    const who = looks.filter((l) => l.waitFor.includes(w)).map((l) => l.name);
    if (who.length === looks.length) { out.push(w); continue; }
    // English lowers the line's first word after the rule's name; Hebrew has no capitals.
    const line = lang === "en" && /^(Wait|It|All|Another)\b/.test(w) ? w[0].toLowerCase() + w.slice(1) : w;
    out.push(`${lang === "en" ? who.join(" and ") : fmtList(who, lang)}: ${line}`); // "<rule>: <line>" reads the same in both languages
  }
  return out;
}

/**
 * The answer for one name: {headline, tone ("wait" | "rules_allow" | "not_ours"), realMoney, nextBuy (the next weekly
 * buy, YYYY-MM-DD or null), nextLook, games (the weekly rules' looks), monthly (Five Leaders monthly and quarterly),
 * conditions (the site's checks, or the only checks of a name the rules do not read: [{id, label, ok (true | false |
 * null), now, need}]), waitFor, note, kind ("main" | "look" | "fund" | "core"), nextReview (the weekly game's next look,
 * or null), held (a weekly rule holds it on paper now), earned, available (the rules' look was read)}.
 *
 * `setup`: the derived.json setup of the name ({checks, passed, stretched, dist_sma50_pct, dist_long_pct}) plus `as_of`
 * (its last close); `checklist`: today's checklist row (with risk_plan), or null when it cannot be read; `bw`: the
 * buy_window.json contract; `verdicts`: rule id -> its frozen history verdict; `sp500`: true / false / null (unknown);
 * `names`: ticker -> name; `lang`: the language of the words ("en" by default).
 */
export function buyWindow({ today = null, symbol, onMainList = false, isFund = false, isCoreFund = false, sp500 = null, bw = null, setup = null, checklist = null, stocksEarned = false, verdicts = {}, names = {}, minRR = 2, stretchPct = 8, siteSample = false, lang = "en" }) {
  const t = tr(lang);
  const nameOf = (x) => names?.[x] ?? x;
  const rp = checklist?.risk_plan ?? null;
  const nextBuy = today ? weeklyBuyDay(today, bw, siteSample) : bw?.next_weekly_buy ?? null;
  const buy = dayWords(nextBuy, lang);
  const empty = { games: [], monthly: [], held: false, earned: false, nextReview: null, nextBuy };
  const note = t("bw.note"), fundNote = t("bw.fundNote");

  if (isFund) {
    if (isCoreFund) {
      return {
        ...empty, kind: "core", tone: "rules_allow", available: true,
        headline: t("bw.core.headline"),
        realMoney: realMoneyWords({ kind: "core", buy }, t),
        nextLook: t("bw.core.nextLook"),
        conditions: [],
        waitFor: [t("bw.core.wait")],
        note: fundNote,
      };
    }
    return {
      ...empty, kind: "fund", tone: "not_ours", available: true,
      headline: t("bw.fund.headline"),
      realMoney: realMoneyWords({ kind: "fund", buy }, t),
      nextLook: t("bw.fund.nextLook"),
      conditions: [], waitFor: [], note: fundNote,
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
        label: t("bw.look.trendLabel"),
        ok: trendOk,
        now: dist == null ? t("bw.na")
          : t(dist >= 0 ? "bw.look.now50Above" : "bw.look.now50Below", { pct: pct1(dist) })
            + (distLong == null ? "" : t(distLong >= 0 ? "bw.look.now200Above" : "bw.look.now200Below", { pct: pct1(distLong) })),
        need: t("bw.look.trendNeed"),
      },
      stretchRow(dist, setup?.stretched ?? null, limit, t),
      rrRow(rp, minRR, t),
    ];
    const waitFor = [];
    if (trendOk === false) waitFor.push(t("bw.look.waitTrend"));
    if (conditions[1].ok === false) waitFor.push(t("bw.wait.stretched", { limit: `${limit}%` }));
    const r = rrWait(rp, minRR, t);
    if (r) waitFor.push(r);
    waitFor.push(t("bw.look.learn"));
    return {
      ...empty, kind: "look", tone: "not_ours", available: true,
      headline: t("bw.look.headline"),
      realMoney: realMoneyWords({ kind: "look", sp500, buy }, t),
      nextLook: t("bw.look.nextLook"),
      conditions, waitFor, note,
    };
  }

  // A main-list name: each rule's own look, read from the contract. Real money is spoken of only when stocks have earned
  // a place (stocksEarned) AND it is a rule that would pick this name whose OWN frozen history verdict passed: another
  // rule passing must never turn this rule's pick into a real-money answer.
  const earnedRule = (id) => Boolean(stocksEarned) && verdicts?.[id] === "passes_history";
  const state = lookState(bw, setup?.as_of ?? null, siteSample, today);
  const setupRow = setup && num(setup.passed) != null
    ? { id: "setup", label: t("bw.setup.label"), ok: setup.passed >= 3, now: t("bw.setup.now", { n: setup.passed }), need: t("bw.setup.need") }
    : null;
  const house = [...(setupRow ? [setupRow] : []), rrRow(rp, minRR, t)];
  const houseWait = [];
  if (setupRow && !setupRow.ok) houseWait.push(t("bw.setup.wait"));
  const rw = rrWait(rp, minRR, t);
  if (rw) houseWait.push(rw);
  const looks = state === "ok" ? all.filter((r) => r.names[symbol]).map((r) => ruleLook(r, r.names[symbol], { symbol, nameOf, earnedRule, lang })) : [];

  if (!looks.length) {
    return {
      ...empty, kind: "main", tone: "wait", available: false,
      headline: t("bw.main.notAvailable"),
      realMoney: realMoneyWords({ kind: "main", sp500, buy }, t),
      nextLook: buy ? t("bw.main.nextLookBuy", { buy }) : t("bw.main.nextLook"),
      conditions: [stretchRow(num(setup?.dist_sma50_pct), setup?.stretched ?? null, limit, t), ...house],
      waitFor: [t(state === "stale" ? "bw.main.waitStale" : "bw.main.waitRun"), ...houseWait],
      note,
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
  const date = dayWords(nextReview, lang);
  const who = t(games.length ? "bw.who.game" : "bw.who.monthly");
  const span = games.length ? "Week" : "Month";
  const heldLead = lead.some((l) => l.held);
  let headline;
  if (allow && picking.every((l) => l.held)) headline = t(earned ? "bw.head.holdsEarned" : "bw.head.holds", { who });
  else if (allow) headline = earned ? t("bw.head.allowEarned", { date }) : t("bw.head.pick", { who, date });
  else if (picking.length) headline = t("bw.head.pickButChecks", { who });
  else headline = t(heldLead ? `bw.head.letGo${span}` : `bw.head.notPick${span}`, { who });

  const waitFor = [...new Set([...ruleWaits(lead, lang), ...houseWait])];
  if (allow) waitFor.push(t(earned ? "bw.main.allowEarned" : "bw.main.allowPaper"));
  const nextLook = games.length
    ? t("bw.main.nextWeekly", { date: date || t("bw.main.nextWeekFallback") })
    : t(lead[0].cadence === "quarterly" ? "bw.main.nextQuarterly" : "bw.main.nextMonthly", { date });
  return {
    kind: "main", tone: allow ? "rules_allow" : "wait", available: true, held: heldLead, earned, nextReview, nextBuy,
    headline, realMoney: realMoneyWords({ kind: "main", sp500, earned, buy }, t), nextLook,
    games, monthly: games.length ? monthly : [], conditions: house, waitFor, note,
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

/** True for a fund that follows the S&P 500 (the kind of fund the plan's weekly buy goes into), from its fund card. */
// The plain index only: "S&P 500" or "S&P 500 Index". An equal-weight, growth, value, leveraged or sector version of the
// index is a different fund and must not be told it is the plan's fund.
export const isCoreFundCard = (card) => /^\s*S&P 500(\s+Index)?\s*$/i.test(String(card?.index_tracked ?? ""));

/**
 * buyWindow() for a symbol from a page's data: `derived` (that market's derived.json), `checklist` (its checklist.json),
 * `bw` (buy_window.json), `mainList` (tickers), `fund` (the fund card, {} for a fund without one, null for a stock),
 * `stocksEarned`, `rulesResult` (market/rules.json: each rule's own frozen verdict), `sp500` (true / false / null),
 * `names`, `siteSample`, `minRR`, `stretchPct`, `today` (the New York date, for the weekly buy day and the stale check),
 * `lang` (the language of the words).
 */
export function buyWindowFor(symbol, { today = null, derived = null, checklist = null, bw = null, mainList = [], fund = null, stocksEarned = false, rulesResult = null, sp500 = null, names = {}, siteSample = false, minRR = 2, stretchPct = 8, lang = "en" } = {}) {
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
    sp500, bw, setup, checklist: read.ok ? ck : null, stocksEarned, verdicts, names, minRR, stretchPct, siteSample, lang,
  });
}

/**
 * The one short line on the home's company cards, in words only (no digits, like the rest of the simple home):
 * {text, tone}. `today` is the New York date (YYYY-MM-DD).
 */
export function buyLine(a, today, lang = "en") {
  if (!a) return null;
  const t = tr(lang);
  if (a.kind === "core") return { text: t("bw.line.core"), tone: "accent" };
  if (a.kind === "fund" || a.kind === "look") return { text: t("bw.line.notPlan"), tone: "flat" };
  if (!a.available) return { text: t("bw.line.wait"), tone: "flat" };
  const who = t(a.games?.length ? "bw.who.game" : "bw.who.monthly");
  if (a.tone === "rules_allow") {
    const when = (a.nextReview && today ? whenWords(a.nextReview, today, lang) : "") || t("bw.line.nextLook");
    if (a.earned) return { text: a.held ? t("bw.line.earnedHeld") : t("bw.line.earned", { when }, { bidi: false }), tone: "accent" };
    if (a.held) return { text: t("bw.line.held", { who }), tone: "accent" };
    return { text: t("bw.line.pick", { who, when }, { bidi: false }), tone: "accent" };
  }
  return { text: t(a.games?.length ? "bw.line.notWeek" : "bw.line.notMonth"), tone: "flat" };
}
