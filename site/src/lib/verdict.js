// The brain's verdict, explained like to a five-year-old: what one run decided, what changed since the run before, and
// how the brain has done so far. Pure functions, no React. Every input is published data: run files
// (runs/run.<date>.json), scored outcomes and settings. The brain writes its own five-year-old words (`eli5`, on runs
// from mid-October 2026 on); for older runs, and as a fallback, code builds simple words from the call itself.
// Every sentence code writes here is in i18n/plan.js ("v.*"); each function takes `lang` last (default English). The
// brain's own words (eli5, summary, thesis, letter) are data and stay in the language the brain wrote them in.

import { translate } from "./i18n.js";
import { joinNames, shortName, whenWords } from "./simple.js";
import dict from "../i18n/plan.js";

const MOOD = {
  bullish: { key: "up", tone: "accent", mark: "▲" },
  bearish: { key: "down", tone: "down", mark: "▼" },
  neutral: { key: "flat", tone: "flat", mark: "◆" },
};
const moodOf = (stance) => MOOD[stance] ?? MOOD.neutral;
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** English number words ("three"); Hebrew gets digits (its number words depend on the noun's gender). */
const count = (n, lang = "en") => (lang === "en" ? COUNT[n] ?? String(n) : String(n));
const sureWord = (t, conviction) => (t.has(`v.sure.${conviction}`) ? t(`v.sure.${conviction}`) : conviction);

const HE_DAY = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** A calendar date for a sentence: ISO in English (as before), "30 באוקטובר 2026" in Hebrew. */
const dayWords = (iso, lang) => (lang === "en" ? iso : HE_DAY.format(new Date(`${iso}T00:00:00Z`)));

const firstSentence = (t) => (String(t ?? "").match(/^.*?[.!?](\s|$)/) || [t ?? ""])[0].trim();
const callOf = (p) => `${p.pick.stance}/${p.pick.conviction}`;

/** The headline for one run: what the brain decided, in one short line a child could say back. */
export function headline(run, lang = "en") {
  const t = translate(dict, lang);
  const picks = run?.picks ?? [];
  if (!run || run.status !== "ok") return t("v.head.failed");
  if (!picks.length) return t("v.head.none");
  const up = picks.filter((p) => p.pick.stance === "bullish").length;
  const down = picks.filter((p) => p.pick.stance === "bearish").length;
  if (!up && !down) return t("v.head.none");
  if (up && !down) return t("v.head.likes", { count: up, n: count(up, lang) });
  if (down && !up) return t("v.head.worried", { count: down, n: count(down, lang) });
  return t("v.head.mixed");
}

/** The whole run in five-year-old words: the brain's own `eli5` when it wrote one, else built from the calls. */
export function runEli5(run, nameOf = (t) => t, lang = "en") {
  if (run?.eli5) return run.eli5;
  const t = translate(dict, lang);
  const picks = run?.picks ?? [];
  if (!run || run.status !== "ok") return t("v.eli5.failed");
  const names = joinNames(picks.map((p) => nameOf(p.pick.ticker)), lang);
  if (!picks.length) return t("v.eli5.none");
  const up = picks.some((p) => p.pick.stance === "bullish");
  const down = picks.some((p) => p.pick.stance === "bearish");
  if (!up && !down) return t("v.eli5.cannotTell", { names }, { bidi: false });
  return t("v.eli5.guess", { names }, { bidi: false });
}

/** One stock's call in five-year-old words: the brain's own `eli5` (runs from mid-October 2026 on), else one honest,
 *  simple line from its stance. Older runs show the brain's own first sentence under it. */
export function pickEli5(pick, name, lang = "en") {
  if (pick.eli5) return pick.eli5;
  const t = translate(dict, lang);
  if (pick.stance === "bullish") return t("v.pick.up", { name });
  if (pick.stance === "bearish") return t("v.pick.down", { name });
  return t("v.pick.flat", { name });
}

/** What changed from `prev` to `run`, in short sentences. */
export function changes(run, prev, nameOf = (t) => t, lang = "en") {
  const t = translate(dict, lang);
  if (!prev) return { line: t("v.chg.first"), same: false };
  const now = Object.fromEntries((run?.picks ?? []).map((p) => [p.pick.ticker, p]));
  const before = Object.fromEntries((prev.picks ?? []).map((p) => [p.pick.ticker, p]));
  const added = Object.keys(now).filter((x) => !before[x]);
  const dropped = Object.keys(before).filter((x) => !now[x]);
  const moved = Object.keys(now).filter((x) => before[x] && callOf(before[x]) !== callOf(now[x]));
  const parts = [];
  if (added.length) parts.push(t("v.chg.added", { names: joinNames(added.map(nameOf), lang) }, { bidi: false }));
  if (dropped.length) parts.push(t("v.chg.dropped", { names: joinNames(dropped.map(nameOf), lang) }, { bidi: false }));
  for (const x of moved) {
    const a = before[x].pick, b = now[x].pick;
    parts.push(a.stance !== b.stance
      ? t("v.chg.mind", { name: nameOf(x), from: t(`v.moodLower.${moodOf(a.stance).key}`), to: t(`v.moodLower.${moodOf(b.stance).key}`) })
      : t("v.chg.sure", { name: nameOf(x), now: sureWord(t, b.conviction), was: sureWord(t, a.conviction) }));
  }
  const same = !parts.length;
  return { line: same ? t("v.chg.same") : parts.join(" "), same };
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
export function scorecard(runs, outcomes = [], horizon = 20, today = null, lang = "en") {
  const t = translate(dict, lang);
  const scored = outcomes.filter((o) => o.verdict);
  if (scored.length) {
    const right = scored.filter((o) => o.verdict === "hit").length;
    return { scored: scored.length, right, next: null,
      line: t("v.score.sofar", { count: right, right: count(right, lang), total: count(scored.length, lang) }) };
  }
  const first = runs.filter((r) => r.status === "ok" && r.picks?.length).map((r) => r.date).sort()[0];
  if (!first) return { scored: 0, right: 0, line: t("v.score.noGuess"), next: null };
  const next = addTradingDays(first, horizon);
  const when = today ? whenWords(next, today, lang) : t("v.score.onDate", { date: dayWords(next, lang) });
  return { scored: 0, right: 0, next, line: t("v.score.early", { when }, { bidi: false }) };
}

/**
 * Everything one verdict shows: the date in words, the headline, the whole run in five-year-old words, what changed,
 * the brain's grown-up summary, and a row per stock (mood, how sure, five-year-old words, and the grown-up reason and
 * what would change its mind, for whoever wants them). `opts.lang` picks the language of the words code writes.
 */
export function verdictOf(run, prev, { outlook, names = {}, today, lang = "en" } = {}) {
  const t = translate(dict, lang);
  const nameOf = (x) => shortName(x, outlook, names);
  return {
    date: run.date,
    when: today ? whenWords(run.date, today, lang) : "",
    headline: headline(run, lang),
    eli5: runEli5(run, nameOf, lang),
    byBrain: Boolean(run.eli5),
    changes: changes(run, prev, nameOf, lang),
    summary: run.summary ?? "",
    letter: run.letter ?? null,
    rows: (run.picks ?? []).map(({ pick }) => {
      const name = nameOf(pick.ticker);
      const m = moodOf(pick.stance);
      return {
        ticker: pick.ticker, name, mood: t(`v.mood.${m.key}`), mark: m.mark, tone: m.tone,
        sure: sureWord(t, pick.conviction), level: pick.conviction,
        eli5: pickEli5(pick, name, lang), byBrain: Boolean(pick.eli5),
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
