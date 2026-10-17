import { WeeklyGame } from "./weekly.jsx";
import { useState } from "react";
import { todayISO } from "../lib/outlook.js";
import { scorecard, steadyRuns, verdictHistory } from "../lib/verdict.js";
import { LumpSum, MoneyAction } from "./money.jsx";
import { ArrowRight, Reveal } from "./ui.jsx";

const TONE = { accent: "var(--accent)", down: "var(--down)", flat: "var(--ink-2)" };
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const RANK = { accent: 0, flat: 1, down: 2 };
const SURE_RANK = { "very sure": 0, "fairly sure": 1, "not very sure": 2 };
/** Strongest idea first: thumbs up before just watching before thumbs down, and surer before less sure. */
const rankRows = (rows) => [...rows].sort((a, b) => (RANK[a.tone] ?? 1) - (RANK[b.tone] ?? 1) || (SURE_RANK[a.sure] ?? 3) - (SURE_RANK[b.sure] ?? 3));
const COUNT = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

function opts(data) {
  return { outlook: data.outlook, names: data.names, today: todayISO() };
}

/** A stock's mood as a big, calm badge: thumbs up, thumbs down or just watching, and how sure. */
function Mood({ r }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[14px] font-medium"
      style={{ color: TONE[r.tone], borderColor: "var(--line-2)" }}>
      <span aria-hidden="true" className="text-[10px]">{r.mark}</span>{r.mood}
      <span className="font-normal text-ink-3">· {r.sure}</span>
    </span>
  );
}

/** One stock: its mood, the five-year-old words, and (on a tap) the grown-up reason and what would change its mind. */
function StockCard({ r, go }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card overflow-hidden">
      <div className="h-1" style={{ background: TONE[r.tone] }} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <button type="button" onClick={() => go(`stock/${r.ticker}`)} className="text-left text-[22px] font-semibold tracking-[-0.02em] text-ink hover:underline">{r.name}</button>
          <Mood r={r} />
        </div>
        <p className="mt-4 text-[18px] leading-relaxed text-ink">{r.eli5}</p>
        {!r.byBrain && r.why && <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2"><span className="text-ink-3">In the brain's words:</span> {r.why}</p>}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="meta mt-4 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
          {open ? "Hide" : "Show"} the grown-up reason <ArrowRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        {open && (
          <div className="mt-2 grid gap-3 rounded-2xl border border-line-2 bg-surface-2 p-4 text-[15px] leading-relaxed text-ink-2">
            <p>{r.thesis}</p>
            {r.risks.length > 0 && (
              <div>
                <div className="meta mb-1">What could go wrong</div>
                <ul className="grid gap-1">{r.risks.map((x) => <li key={x}>• {x}</li>)}</ul>
              </div>
            )}
            <p><span className="text-ink">It changes its mind if:</span> {r.wrongIf}</p>
          </div>
        )}
      </div>
    </li>
  );
}

/** The brain's letter to the family: what to do this week, in plain words. Paragraphs split on blank lines or sentences
 *  grouped in twos when the brain wrote one block. */
function Letter({ text, date }) {
  const parts = text.includes("\n") ? text.split(/\n+/).filter(Boolean)
    : (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).reduce((acc, s, i) => { if (i % 2 === 0) acc.push(s.trim()); else acc[acc.length - 1] += ` ${s.trim()}`; return acc; }, []);
  return (
    <Reveal as="section" id="letter" className="card overflow-hidden">
      <div className="h-1.5" style={{ background: "var(--ai)" }} />
      <div className="p-6 sm:p-8">
        <p className="meta" style={{ color: "var(--ai)" }}>The brain's letter to the family · {longDate(date)}</p>
        <div className="mt-4 grid gap-3 font-serif text-[18.5px] leading-[1.7] text-ink">
          {parts.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <p className="mt-5 text-[14px] leading-relaxed text-ink-3">Written by the brain in the spirit of a patient long-term owner's letter. It is not Warren Buffett and does not speak for him. General guidance from evidence, not personal financial advice.</p>
      </div>
    </Reveal>
  );
}

/**
 * The newest brain run, short, for the home page: what it decided, in five-year-old words, and whether to do anything.
 * Shown only on live picks (sample runs are not the brain).
 */
export function LatestVerdict({ data, go }) {
  if (data.sample) return null;
  const v = verdictHistory(data.runs, opts(data))[0];
  if (!v) return null;
  return <LatestCard data={data} go={go} v={v} />;
}

function LatestCard({ data, go, v }) {
  return (
    <Reveal as="article" id="brain-verdict" className="card overflow-hidden">
      <div className="h-1" style={{ background: "var(--ai)" }} />
      <div className="p-6 sm:p-7">
        <h2 className="meta mb-4" style={{ color: "var(--ai)" }}>The brain's verdict · {v.when || longDate(v.date)}</h2>
        <p className="text-[clamp(22px,6vw,27px)] leading-snug font-semibold tracking-[-0.015em] text-ink">{v.headline}</p>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{v.eli5}</p>
        {v.letter && <p className="mt-4 text-[16px] leading-relaxed text-ink-2"><span className="font-semibold text-ink">This week's letter:</span> {v.letter.split(/(?<=[.!?])\s/)[0]}</p>}
        <button type="button" onClick={() => go("verdicts")} className="btn btn-primary mt-5 justify-center">{v.letter ? "Read the brain's letter" : "Open the brain's full answer"} <ArrowRight /></button>
      </div>
    </Reveal>
  );
}

/**
 * The Brain's verdicts page: the most valuable page for a plain reader. The newest answer told like to a five-year-old,
 * a straight "do I need to do anything?", a card per stock, what changed, whether the brain has been right so far,
 * and every earlier answer below.
 */
export function VerdictPage({ data, go }) {
  const history = data.sample ? [] : verdictHistory(data.runs, opts(data));
  const [openPast, setOpenPast] = useState(() => new Set());
  if (!history.length) {
    return <p className="card p-6 text-[18px] leading-relaxed text-ink-2">The brain's answers appear here once it has made its first real call.</p>;
  }
  const v = history[0];
  const steady = steadyRuns(data.runs);
  const score = scorecard(data.runs, data.outcomes ?? [], data.settings.scoring.horizon_days, todayISO());
  const togglePast = (d) => setOpenPast((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  return (
    <div className="grid gap-6">
      {/* The answer */}
      <Reveal as="section" className="card overflow-hidden">
        <div className="h-1.5" style={{ background: "var(--ai)" }} />
        <div className="p-6 sm:p-8">
          <p className="meta" style={{ color: "var(--ai)" }}>The newest answer · {longDate(v.date)}{v.when ? ` (${v.when})` : ""}</p>
          <h2 className="display mt-3 text-[clamp(30px,8vw,46px)] leading-[1.05] tracking-[-0.03em] text-ink">{v.headline}</h2>
          <p className="mt-5 text-[19px] leading-relaxed text-ink">{v.eli5}</p>
          {steady > 1 && <p className="mt-4 text-[15.5px] text-ink-3">{COUNT[steady] ?? steady} answers in a row have been the same.</p>}
        </div>
      </Reveal>

      {v.letter && <Letter text={v.letter} date={v.date} />}

      <MoneyAction data={data} />
      <LumpSum data={data} />
      <WeeklyGame data={data} go={go} />

      {v.rows.length > 0 && (
        <section>
          <h3 className="mb-1 px-1 text-[22px] font-semibold tracking-[-0.02em]">Top stocks to hold this year</h3>
          <p className="mb-4 px-1 text-[15.5px] leading-relaxed text-ink-2">The brain's best ideas, strongest first. It tests them with pretend money before trusting them: none has beaten the whole market yet, so keep your main money in the answer above.</p>
          <ul className="grid gap-4">{rankRows(v.rows).map((r) => <StockCard key={r.ticker} r={r} go={go} />)}</ul>
        </section>
      )}

      <Reveal as="section" className="card p-6 sm:p-8">
        <h3 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-ink-2">What changed since last time?</h3>
        <p className="mt-2 text-[18px] leading-relaxed text-ink">{v.changes.line}</p>
      </Reveal>

      <Reveal as="section" className="card p-6 sm:p-8">
        <h3 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-ink-2">Has the brain been right?</h3>
        <p className="mt-2 text-[18px] leading-relaxed text-ink">{score.line}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-3">The brain is a careful machine, not a fortune teller. On past prices, its rules did not beat picking at random, so it never asks for real money on a single stock. Its weekly bet, above, is how we find out if its ranking has any skill.</p>
        <button type="button" onClick={() => go("track")} className="meta mt-3 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">Every scored guess <ArrowRight className="size-3.5" /></button>
      </Reveal>

      {v.summary && (
        <details className="card p-6 sm:p-8">
          <summary className="cursor-pointer text-[16px] font-semibold text-ink">The brain's grown-up summary</summary>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{v.summary}</p>
        </details>
      )}

      {history.length > 1 && (
        <section>
          <h3 className="mb-3 mt-4 px-1 text-[22px] font-semibold tracking-[-0.02em]">Earlier answers</h3>
          <ol className="grid gap-3">
            {history.slice(1).map((p) => {
              const isOpen = openPast.has(p.date);
              return (
                <li key={p.date} className="card overflow-hidden">
                  <button type="button" onClick={() => togglePast(p.date)} aria-expanded={isOpen}
                    className="flex w-full min-h-[56px] items-center justify-between gap-3 px-5 py-4 text-left sm:px-6">
                    <span className="min-w-0">
                      <span className="meta block" style={{ color: "var(--ai)" }}>{longDate(p.date)}</span>
                      <span className="mt-1 block text-[17px] leading-snug text-ink">{p.headline}</span>
                      {!isOpen && <span className="mt-1 block text-[14.5px] text-ink-3">{p.changes.same ? "Same as the answer before." : "Something changed: open to see."}</span>}
                    </span>
                    <ArrowRight className={`size-4 shrink-0 text-ink-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="grid gap-3 border-t border-line px-5 pb-6 pt-4 sm:px-6">
                      <p className="text-[16.5px] leading-relaxed text-ink">{p.eli5}</p>
                      <p className="text-[15px] leading-relaxed text-ink-2">{p.changes.line}</p>
                      <ul className="grid gap-2">
                        {p.rows.map((r) => (
                          <li key={r.ticker} className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
                            <span className="font-semibold">{r.name}</span><Mood r={r} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <p className="meta mt-2 normal-case tracking-[0.04em]">A notebook for one household, not personal financial advice. The brain's stock guesses use pretend money.</p>
    </div>
  );
}
