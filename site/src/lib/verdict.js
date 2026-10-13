// The brain's verdict in plain words: what one run decided and what changed since the run before. Pure functions, no
// React. Every input is a published run file (runs/run.<date>.json); the stance and conviction words come from code, and
// the brain's own sentences (summary, thesis, invalidation) are shown as written.

import { joinNames, shortName, whenWords } from "./simple.js";

const STANCE = { bullish: "leaning up", bearish: "leaning down", neutral: "just watching" };
const SURE = { low: "not sure", medium: "fairly sure", high: "quite sure" };
const TONE = { bullish: "accent", bearish: "down", neutral: "flat" };

const firstSentence = (t) => (String(t ?? "").match(/^.*?[.!?](\s|$)/) || [t ?? ""])[0].trim();
const callOf = (p) => `${p.pick.stance}/${p.pick.conviction}`;

/** The headline for one run: what to do, in one line. */
export function headline(run) {
  const picks = run?.picks ?? [];
  if (!run || run.status !== "ok") return "The brain did not finish this run, so it made no call.";
  if (!picks.length) return "Nothing clears the bar: hold the plan, buy nothing.";
  const up = picks.filter((p) => p.pick.stance === "bullish");
  const down = picks.filter((p) => p.pick.stance === "bearish");
  if (!up.length && !down.length) return "Watch, don't act: no stock is worth a move right now.";
  if (up.length && !down.length) return `Leaning up on ${up.length === 1 ? "one name" : "a few names"}, on paper only.`;
  if (down.length && !up.length) return `Wary of ${down.length === 1 ? "one name" : "a few names"}, on paper only.`;
  return "Mixed: leaning up on some names, wary of others, on paper only.";
}

/** What changed from `prev` to `run`: new names, dropped names and changed calls, in words. */
export function changes(run, prev, nameOf = (t) => t) {
  if (!prev) return { line: "This is the first run on record, so there is nothing to compare yet.", same: false };
  const now = Object.fromEntries((run?.picks ?? []).map((p) => [p.pick.ticker, p]));
  const before = Object.fromEntries((prev.picks ?? []).map((p) => [p.pick.ticker, p]));
  const added = Object.keys(now).filter((t) => !before[t]);
  const dropped = Object.keys(before).filter((t) => !now[t]);
  const moved = Object.keys(now).filter((t) => before[t] && callOf(before[t]) !== callOf(now[t]));
  const parts = [];
  if (added.length) parts.push(`New on the list: ${joinNames(added.map(nameOf))}.`);
  if (dropped.length) parts.push(`No longer on it: ${joinNames(dropped.map(nameOf))}.`);
  for (const t of moved) {
    const a = before[t].pick, b = now[t].pick;
    const what = a.stance !== b.stance ? `from ${STANCE[a.stance]} to ${STANCE[b.stance]}` : `from ${SURE[a.conviction]} to ${SURE[b.conviction]}`;
    parts.push(`${nameOf(t)} moved ${what}.`);
  }
  const same = !parts.length;
  return { line: same ? "Same names and the same calls as the run before." : parts.join(" "), same };
}

/** How many runs in a row, ending with the newest, kept exactly the same calls. */
export function steadyRuns(runs) {
  const ok = runs.filter((r) => r.status === "ok");
  let n = 1;
  for (let i = ok.length - 1; i > 0; i--) {
    if (changes(ok[i], ok[i - 1]).same) n++;
    else break;
  }
  return ok.length ? n : 0;
}

/**
 * Everything the verdict card shows for one run: the date in words, the headline, what changed, the brain's summary and
 * one plain row per name (stance word, how sure, its first reason and what would prove it wrong).
 */
export function verdictOf(run, prev, { outlook, names = {}, today } = {}) {
  const nameOf = (t) => shortName(t, outlook, names);
  return {
    date: run.date,
    when: today ? whenWords(run.date, today) : "",
    headline: headline(run),
    changes: changes(run, prev, nameOf),
    summary: run.summary ?? "",
    rows: (run.picks ?? []).map(({ pick }) => ({
      ticker: pick.ticker,
      name: nameOf(pick.ticker),
      stance: STANCE[pick.stance] ?? pick.stance,
      sure: SURE[pick.conviction] ?? pick.conviction,
      tone: TONE[pick.stance] ?? "flat",
      why: firstSentence(pick.thesis),
      wrongIf: pick.invalidation,
    })),
  };
}

/** Every ok run, newest first, each with its verdict against the run before it. */
export function verdictHistory(runs, opts = {}) {
  const ok = runs.filter((r) => r.status === "ok").sort((a, b) => a.date.localeCompare(b.date));
  return ok.map((r, i) => verdictOf(r, ok[i - 1] ?? null, opts)).reverse();
}
