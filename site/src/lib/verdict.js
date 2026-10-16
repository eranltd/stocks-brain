// The brain's verdict, explained like to a five-year-old: what one run decided, what changed since the run before, and
// how the brain has done so far. Pure functions, no React. Every input is published data: run files
// (runs/run.<date>.json), scored outcomes and settings. The brain writes its own five-year-old words (`eli5`, on runs
// from mid-October 2026 on); for older runs, and as a fallback, code builds simple words from the call itself.

import { joinNames, shortName, whenWords } from "./simple.js";

const MOOD = {
  bullish: { word: "Thumbs up", tone: "accent", mark: "▲" },
  bearish: { word: "Thumbs down", tone: "down", mark: "▼" },
  neutral: { word: "Can't tell", tone: "flat", mark: "◆" },
};
const SURE = { low: "not very sure", medium: "fairly sure", high: "very sure" };
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n) => COUNT[n] ?? String(n);

const firstSentence = (t) => (String(t ?? "").match(/^.*?[.!?](\s|$)/) || [t ?? ""])[0].trim();
const callOf = (p) => `${p.pick.stance}/${p.pick.conviction}`;

/** The headline for one run: what the brain decided, in one short line a child could say back. */
export function headline(run) {
  const picks = run?.picks ?? [];
  if (!run || run.status !== "ok") return "The brain did not finish this time, so it said nothing.";
  if (!picks.length) return "Do your weekly buy of the whole market. No single stock stands out.";
  const up = picks.filter((p) => p.pick.stance === "bullish").length;
  const down = picks.filter((p) => p.pick.stance === "bearish").length;
  if (!up && !down) return "Do your weekly buy of the whole market. No single stock stands out.";
  if (up && !down) return `It likes ${count(up)} ${up === 1 ? "stock" : "stocks"} a little, with pretend money only.`;
  if (down && !up) return `It is worried about ${count(down)} ${down === 1 ? "stock" : "stocks"}.`;
  return "It likes some stocks and is worried about others.";
}

/** The whole run in five-year-old words: the brain's own `eli5` when it wrote one, else built from the calls. */
export function runEli5(run, nameOf = (t) => t) {
  if (run?.eli5) return run.eli5;
  const picks = run?.picks ?? [];
  if (!run || run.status !== "ok") return "The brain started its homework but did not finish it, so there is no answer this time.";
  const names = joinNames(picks.map((p) => nameOf(p.pick.ticker)));
  if (!picks.length) return "The brain looked at every stock on our list and none looked good enough. So we keep buying the big fund that holds the whole market.";
  const up = picks.some((p) => p.pick.stance === "bullish");
  const down = picks.some((p) => p.pick.stance === "bearish");
  if (!up && !down) {
    return `The brain looked closely at ${names}. It cannot tell which of them will beat the others, like guessing which runner wins before the race. So we keep buying the big fund that holds the whole market, which owns them all.`;
  }
  return `The brain looked closely at ${names} and has a guess about where some may go. It is only a guess with pretend money, so nothing real changes yet.`;
}

/** One stock's call in five-year-old words: the brain's own `eli5` (runs from mid-October 2026 on), else one honest,
 *  simple line from its stance. Older runs show the brain's own first sentence under it. */
export function pickEli5(pick, name) {
  if (pick.eli5) return pick.eli5;
  if (pick.stance === "bullish") return `The brain thinks ${name} might do a little better than the whole market. It is only a guess, so it plays with pretend money first.`;
  if (pick.stance === "bearish") return `The brain thinks ${name} might do worse than the whole market, so it would rather stay away for now.`;
  return `${name}: the brain cannot tell if it will beat the whole market. We already own a little of it through the big fund.`;
}

/** What changed from `prev` to `run`, in short sentences. */
export function changes(run, prev, nameOf = (t) => t) {
  if (!prev) return { line: "This is the brain's first answer, so there is nothing to compare yet.", same: false };
  const now = Object.fromEntries((run?.picks ?? []).map((p) => [p.pick.ticker, p]));
  const before = Object.fromEntries((prev.picks ?? []).map((p) => [p.pick.ticker, p]));
  const added = Object.keys(now).filter((t) => !before[t]);
  const dropped = Object.keys(before).filter((t) => !now[t]);
  const moved = Object.keys(now).filter((t) => before[t] && callOf(before[t]) !== callOf(now[t]));
  const parts = [];
  if (added.length) parts.push(`It started watching ${joinNames(added.map(nameOf))}.`);
  if (dropped.length) parts.push(`It stopped talking about ${joinNames(dropped.map(nameOf))}.`);
  for (const t of moved) {
    const a = before[t].pick, b = now[t].pick;
    parts.push(a.stance !== b.stance
      ? `It changed its mind on ${nameOf(t)}: from ${MOOD[a.stance].word.toLowerCase()} to ${MOOD[b.stance].word.toLowerCase()}.`
      : `It is now ${SURE[b.conviction]} about ${nameOf(t)} (it was ${SURE[a.conviction]}).`);
  }
  const same = !parts.length;
  return { line: same ? "Nothing changed since last time. Same stocks, same answers." : parts.join(" "), same };
}

/** How many runs in a row, ending with the newest, kept exactly the same calls. */
export function steadyRuns(runs) {
  const ok = runs.filter((r) => r.status === "ok").sort((a, b) => a.date.localeCompare(b.date));
  let n = 1;
  for (let i = ok.length - 1; i > 0; i--) {
    if (changes(ok[i], ok[i - 1]).same) n++;
    else break;
  }
  return ok.length ? n : 0;
}

/** Add `n` trading days (weekdays) to an ISO date. */
export function addTradingDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Has the brain been right? Its scored calls (outcomes) in plain words, or, before the first is scored, when that will
 * be: each call is checked a fixed number of trading days after it was made (settings.scoring.horizon_days).
 */
export function scorecard(runs, outcomes = [], horizon = 20, today = null) {
  const scored = outcomes.filter((o) => o.verdict);
  if (scored.length) {
    const right = scored.filter((o) => o.verdict === "hit").length;
    return { scored: scored.length, right, line: `So far ${count(right)} of its ${count(scored.length)} checked guesses ${right === 1 ? "was" : "were"} right.`, next: null };
  }
  const first = runs.filter((r) => r.status === "ok" && r.picks?.length).map((r) => r.date).sort()[0];
  if (!first) return { scored: 0, right: 0, line: "The brain has not made a guess yet.", next: null };
  const next = addTradingDays(first, horizon);
  return { scored: 0, right: 0, next,
    line: `Too early to tell. Each guess is checked about a month after it is made, so the first ones are marked right or wrong ${today ? whenWords(next, today) : `on ${next}`}.` };
}

/**
 * Everything one verdict shows: the date in words, the headline, the whole run in five-year-old words, what changed,
 * the brain's grown-up summary, and a row per stock (mood, how sure, five-year-old words, and the grown-up reason and
 * what would change its mind, for whoever wants them).
 */
export function verdictOf(run, prev, { outlook, names = {}, today } = {}) {
  const nameOf = (t) => shortName(t, outlook, names);
  return {
    date: run.date,
    when: today ? whenWords(run.date, today) : "",
    headline: headline(run),
    eli5: runEli5(run, nameOf),
    byBrain: Boolean(run.eli5),
    changes: changes(run, prev, nameOf),
    summary: run.summary ?? "",
    letter: run.letter ?? null,
    rows: (run.picks ?? []).map(({ pick }) => {
      const name = nameOf(pick.ticker);
      const m = MOOD[pick.stance] ?? MOOD.neutral;
      return {
        ticker: pick.ticker, name, mood: m.word, mark: m.mark, tone: m.tone, sure: SURE[pick.conviction] ?? pick.conviction,
        eli5: pickEli5(pick, name), byBrain: Boolean(pick.eli5),
        why: firstSentence(pick.thesis), thesis: pick.thesis, wrongIf: pick.invalidation, risks: pick.risks ?? [],
      };
    }),
  };
}

/** Every ok run, newest first, each with its verdict against the run before it. */
export function verdictHistory(runs, opts = {}) {
  const ok = runs.filter((r) => r.status === "ok").sort((a, b) => a.date.localeCompare(b.date));
  return ok.map((r, i) => verdictOf(r, ok[i - 1] ?? null, opts)).reverse();
}
