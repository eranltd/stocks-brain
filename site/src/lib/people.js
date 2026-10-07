// View helpers for the People tab (config/people.json + data/people/scores.json).
// Every number comes from scripts/people.py; nothing here computes a return.

/** "Pershing Square Capital Management, L.P." -> "Pershing Square"; "Berkshire Hathaway Inc" -> "Berkshire Hathaway". */
export function shortVia(via) {
  return String(via ?? "")
    .replace(/,?\s+(Inc\.?|LLC|LLP|L\.P\.|LP)$/i, "")
    .replace(/\s+(Capital|Investment)\s+Management$/i, "")
    .trim();
}

/** Who shows their moves (a 13F filer we follow), who teaches, and whose principles we keep. */
export function groupPeople(people) {
  const groups = { investors: [], teachers: [], principles: [] };
  for (const p of people ?? []) {
    if (p.status === "principles_only") groups.principles.push(p);
    else if (p.holdings_13f) groups.investors.push(p);
    else groups.teachers.push(p);
  }
  return groups;
}

export const edgarUrl = (cik) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR`;

/** A person's own links, minus an EDGAR link that repeats the 13F link we build from the CIK. */
export function ownLinks(p) {
  const cik = p.holdings_13f?.cik;
  return (p.links ?? []).filter((l) => !(cik && /sec\.gov\/cgi-bin\/browse-edgar/.test(l.url) && l.url.includes(cik)));
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One plain line for a person's record, e.g. "3 calls logged, 2 half a year old: too few to judge (needs 10)". */
export function recordLine(person, rec, judgeWeeks = 26, minMatured = 10) {
  if (person.status === "principles_only") return "Principles only: no calls to score.";
  if (!rec || !rec.n) return "No calls logged yet.";
  const age = judgeWeeks === 26 ? "half a year old" : `${judgeWeeks} weeks old`;
  const head = `${plural(rec.n, "call")} logged, ${rec.matured_26w} ${age}`;
  if (!rec.enough) return `${head}: too few to judge (needs ${minMatured}).`;
  const med = rec.median_signed_excess_26w;
  return `${head}: right ${Math.round(rec.right_26w_pct)}% of the time, typical call ${med >= 0 ? "+" : "−"}${Math.abs(med).toFixed(1)}% vs the core.`;
}

/** Where a scored call stands at the judging horizon: right, wrong, maturing, or not scored. */
export function callStatus(c, judgeWeeks = 26) {
  if (!c.scored) return { kind: "unscored", label: "not scored", detail: c.reason ?? "" };
  const leg = c[`w${judgeWeeks}`];
  if (leg) return leg.right ? { kind: "right", label: "right" } : { kind: "wrong", label: "wrong" };
  return { kind: "maturing", label: "maturing", detail: `${c.weeks_since ?? 0} of ${judgeWeeks} weeks` };
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
  const byId = Object.fromEntries((scores?.calls ?? []).map((s) => [s.id, s]));
  return (cfg?.calls ?? [])
    .map((c) => {
      const s = byId[c.id];
      const reason = s ? (s.scored ? null : s.note ?? null) : scores ? "not scored yet" : "scored after the next daily run";
      return { ...c, ...(s ?? { scored: false }), note: c.note ?? null, reason };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));
}
