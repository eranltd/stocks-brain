// View helpers for the People tab (config/people.json + data/people/scores.json).
// Every number comes from scripts/people.py; nothing here computes a return. The words are in text/learn.js.

import { strings } from "./text.js";
import dict from "../text/learn.js";

/** "Pershing Square Capital Management, L.P." -> "Pershing Square"; "Berkshire Hathaway Inc" -> "Berkshire Hathaway". */
export function shortVia(via) {
  return String(via ?? "")
    .replace(/,?\s+(Inc\.?|LLC|LLP|L\.P\.|LP)$/i, "")
    .replace(/\s+(Capital|Investment)\s+Management$/i, "")
    .trim();
}

/** Investors followed, teachers (teacher, educator or writer, by their kind), and people whose principles are kept. */
export function groupPeople(people) {
  const groups = { investors: [], teachers: [], principles: [] };
  for (const p of people ?? []) {
    if (p.status === "principles_only") groups.principles.push(p);
    else if (p.kind === "investor") groups.investors.push(p);
    else groups.teachers.push(p);
  }
  return groups;
}

/** A call the config marks as the firm's own (credit_person false) is never credited to the person. */
export const isFirmCall = (c) => c?.credit_person === false;

/** Who made the call, as shown: the fund for the firm's own calls, else the person. */
export function callerName(c, person) {
  return isFirmCall(c) ? shortVia(c.via) : person?.name ?? c.person;
}

export const edgarUrl = (cik) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR`;

/** A person's own links, minus an EDGAR link that repeats the 13F link we build from the CIK. */
export function ownLinks(p) {
  const cik = p.holdings_13f?.cik;
  return (p.links ?? []).filter((l) => !(cik && /sec\.gov\/cgi-bin\/browse-edgar/.test(l.url) && l.url.includes(cik)));
}

const pct1 = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

/**
 * One plain line for a person's record, e.g. "3 calls logged, 2 half a year old: too few to judge (needs 10)".
 * firmCalls: calls on this person's fund that are the firm's own (scored for the fund, never for the person).
 */
export function recordLine(person, rec, judgeWeeks = 26, minMatured = 10, firmCalls = []) {
  const t = strings(dict);
  if (person.status === "principles_only") return t("rec.principlesOnly");
  if (!rec || !rec.n) {
    if (firmCalls.length) return t("rec.firm", { count: firmCalls.length, firm: shortVia(firmCalls[0].via) });
    return t("rec.none");
  }
  const head = judgeWeeks === 26
    ? t("rec.head26", { count: rec.n, matured: rec.matured_26w })
    : t("rec.headWeeks", { count: rec.n, matured: rec.matured_26w, weeks: judgeWeeks });
  if (!rec.enough) return head + t("rec.tooFew", { min: minMatured });
  return head + t("rec.enough", { pct: `${Math.round(rec.right_26w_pct)}%`, med: pct1(rec.median_signed_excess_26w) });
}

/** Where a scored call stands at the judging horizon: right, wrong, maturing, or not scored. */
export function callStatus(c, judgeWeeks = 26) {
  const t = strings(dict);
  if (!c.scored) return { kind: "unscored", label: t("status.unscored"), detail: c.reason ?? "" };
  const leg = c[`w${judgeWeeks}`];
  if (leg) return leg.right ? { kind: "right", label: t("status.right") } : { kind: "wrong", label: t("status.wrong") };
  return { kind: "maturing", label: t("status.maturing"), detail: t("status.weeksOf", { since: c.weeks_since ?? 0, judge: judgeWeeks }) };
}

/** Where a call stands, in words, e.g. "judged wrong at 26 weeks, −20.1% for the call vs the core". */
export function statusPhrase(c, judgeWeeks = 26) {
  const t = strings(dict);
  const st = callStatus(c, judgeWeeks);
  const leg = c[`w${judgeWeeks}`];
  if (st.kind === "right" || st.kind === "wrong")
    return t(st.kind === "right" ? "status.judgedRight" : "status.judgedWrong", { weeks: judgeWeeks, pct: pct1(leg.signed_excess_pct) });
  if (st.kind === "maturing") return t("status.maturingPhrase", { detail: st.detail });
  return st.detail ? t("status.notScoredPhrase", { detail: st.detail }) : st.label;
}

/** Logged calls on any of the given tickers, newest first. */
export function callsTouching(calls, tickers) {
  const set = new Set(tickers);
  return (calls ?? []).filter((c) => set.has(c.ticker)).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Join the config's calls with their scores (by id); a call without a score row still shows.
 * `note` stays the config's note (context about the call); `reason` is why code did not score it.
 */
export function joinCalls(cfg, scores) {
  const t = strings(dict);
  const byId = Object.fromEntries((scores?.calls ?? []).map((s) => [s.id, s]));
  return (cfg?.calls ?? [])
    .map((c) => {
      const s = byId[c.id];
      const reason = s ? (s.scored ? null : s.note ?? null) : scores ? t("reason.notYet") : t("reason.nextRun");
      return { ...c, ...(s ?? { scored: false }), note: c.note ?? null, reason };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));
}
