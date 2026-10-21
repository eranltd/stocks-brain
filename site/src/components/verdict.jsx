import { WeeklyGame } from "./weekly.jsx";
import { useState } from "react";
import { todayISO } from "../lib/outlook.js";
import { scorecard, steadyRuns, verdictHistory } from "../lib/verdict.js";
import { LumpSum, MoneyAction } from "./money.jsx";
import { ArrowRight, Reveal } from "./ui.jsx";
import { Auto, En, EnglishNote, useLang } from "../lib/lang.jsx";
import dict from "../i18n/plan.js";

// Every text code writes here is in i18n/plan.js ("vp.*"). The brain's own words (its eli5 when it wrote one, its
// reasons, risks, summary and letter) are data in English for now: they sit in <En> blocks, with the one-line
// "written in English for now" note shown once per page in Hebrew.

const TONE = { accent: "var(--accent)", down: "var(--down)", flat: "var(--ink-2)" };
/** "Friday, October 16" (English, as before) or "יום שישי, 16 באוקטובר". */
const longDate = (iso, lang = "en") => new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const RANK = { accent: 0, flat: 1, down: 2 };
const SURE_RANK = { high: 0, medium: 1, low: 2 };
/** Strongest idea first: thumbs up before just watching before thumbs down, and surer before less sure. */
const rankRows = (rows) => [...rows].sort((a, b) => (RANK[a.tone] ?? 1) - (RANK[b.tone] ?? 1) || (SURE_RANK[a.level] ?? 3) - (SURE_RANK[b.level] ?? 3));

function opts(data, lang) {
  return { outlook: data.outlook, names: data.names, today: todayISO(), lang };
}

/** The brain's own words when it wrote them (English data for now), else the line code wrote in the page's language. */
function BrainText({ by, as = "p", className, children }) {
  return by ? <En as={as} className={className}>{children}</En> : <Auto as={as} className={className}>{children}</Auto>;
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
  const t = useLang().t(dict);
  const [open, setOpen] = useState(false);
  return (
    <li className="card overflow-hidden">
      <div className="h-1" style={{ background: TONE[r.tone] }} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <button type="button" onClick={() => go(`stock/${r.ticker}`)} className="text-start text-[22px] font-semibold tracking-[-0.02em] text-ink hover:underline"><bdi>{r.name}</bdi></button>
          <Mood r={r} />
        </div>
        <BrainText by={r.byBrain} className="mt-4 text-[18px] leading-relaxed text-ink">{r.eli5}</BrainText>
        {!r.byBrain && r.why && <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2"><span className="text-ink-3">{t("vp.inBrainWords")}</span> <En as="span">{r.why}</En></p>}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="meta mt-4 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
          {t(open ? "vp.hideReason" : "vp.showReason")} <ArrowRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        {open && (
          <div className="mt-2 grid gap-3 rounded-2xl border border-line-2 bg-surface-2 p-4 text-[15px] leading-relaxed text-ink-2">
            <EnglishNote />
            <En as="p">{r.thesis}</En>
            {r.risks.length > 0 && (
              <div>
                <div className="meta mb-1">{t("vp.wrong")}</div>
                <En as="ul" className="grid gap-1">{r.risks.map((x) => <li key={x}>• {x}</li>)}</En>
              </div>
            )}
            <p><span className="text-ink">{t("vp.changesIf")}</span> <En as="span">{r.wrongIf}</En></p>
          </div>
        )}
      </div>
    </li>
  );
}

/** The brain's weekly letter, in plain words (English data for now). Paragraphs split on blank lines or sentences
 *  grouped in twos when the brain wrote one block. */
function Letter({ text, date }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const parts = text.includes("\n") ? text.split(/\n+/).filter(Boolean)
    : (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).reduce((acc, s, i) => { if (i % 2 === 0) acc.push(s.trim()); else acc[acc.length - 1] += ` ${s.trim()}`; return acc; }, []);
  return (
    <Reveal as="section" id="letter" className="card overflow-hidden">
      <div className="h-1.5" style={{ background: "var(--ai)" }} />
      <div className="p-6 sm:p-8">
        <p className="meta" style={{ color: "var(--ai)" }}>{t("vp.letterTitle", { date: longDate(date, lang) })}</p>
        <EnglishNote className="mt-4" />
        <En className="mt-4 grid gap-3 font-serif text-[18.5px] leading-[1.7] text-ink">
          {parts.map((p, i) => <p key={i}>{p}</p>)}
        </En>
        <p className="mt-5 text-[14px] leading-relaxed text-ink-3">{t("vp.letterNote")}</p>
      </div>
    </Reveal>
  );
}

/**
 * The newest brain run, short, for the home page: what it decided, in five-year-old words, and whether to do anything.
 * Shown only on live picks (sample runs are not the brain).
 */
export function LatestVerdict({ data, go }) {
  const { lang } = useLang();
  if (data.sample) return null;
  const v = verdictHistory(data.runs, opts(data, lang))[0];
  if (!v) return null;
  return <LatestCard go={go} v={v} />;
}

function LatestCard({ go, v }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  return (
    <Reveal as="article" id="brain-verdict" className="card overflow-hidden">
      <div className="h-1" style={{ background: "var(--ai)" }} />
      <div className="p-6 sm:p-7">
        <h2 className="meta mb-4" style={{ color: "var(--ai)" }}>{t("vp.latestTitle", { when: v.when || longDate(v.date, lang) })}</h2>
        <p className="text-[clamp(22px,6vw,27px)] leading-snug font-semibold tracking-[-0.015em] text-ink">{v.headline}</p>
        {(v.byBrain || v.letter) && <EnglishNote className="mt-3" />}
        <BrainText by={v.byBrain} className="mt-3 text-[17px] leading-relaxed text-ink-2">{v.eli5}</BrainText>
        {v.letter && <p className="mt-4 text-[16px] leading-relaxed text-ink-2"><span className="font-semibold text-ink">{t("vp.thisLetter")}</span> <En as="span">{v.letter.split(/(?<=[.!?])\s/)[0]}</En></p>}
        <button type="button" onClick={() => go("verdicts")} className="btn btn-primary mt-5 justify-center">{t(v.letter ? "vp.readLetter" : "vp.openFull")} <ArrowRight /></button>
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
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  const history = data.sample ? [] : verdictHistory(data.runs, opts(data, lang));
  const [openPast, setOpenPast] = useState(() => new Set());
  if (!history.length) {
    return <p className="card p-6 text-[18px] leading-relaxed text-ink-2">{t("vp.empty")}</p>;
  }
  const v = history[0];
  const steady = steadyRuns(data.runs);
  const score = scorecard(data.runs, data.outcomes ?? [], data.settings.scoring.horizon_days, todayISO(), lang);
  const steadyN = fmt.numWord(steady);
  const togglePast = (d) => setOpenPast((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  return (
    <div className="grid gap-6">
      {/* The answer */}
      <Reveal as="section" className="card overflow-hidden">
        <div className="h-1.5" style={{ background: "var(--ai)" }} />
        <div className="p-6 sm:p-8">
          <p className="meta" style={{ color: "var(--ai)" }}>{v.when ? t("vp.newestWhen", { date: longDate(v.date, lang), when: v.when }) : t("vp.newest", { date: longDate(v.date, lang) })}</p>
          <h2 className="display mt-3 text-[clamp(30px,8vw,46px)] leading-[1.05] tracking-[-0.03em] text-ink">{v.headline}</h2>
          {v.byBrain && <EnglishNote className="mt-5" />}
          <BrainText by={v.byBrain} className="mt-5 text-[19px] leading-relaxed text-ink">{v.eli5}</BrainText>
          {steady > 1 && <p className="mt-4 text-[15.5px] text-ink-3">{t("vp.steady", { count: steady, n: steadyN })}</p>}
        </div>
      </Reveal>

      {v.letter && <Letter text={v.letter} date={v.date} />}

      <MoneyAction data={data} />
      <LumpSum data={data} />
      <WeeklyGame data={data} go={go} />

      {v.rows.length > 0 && (
        <section>
          <h3 className="mb-1 px-1 text-[22px] font-semibold tracking-[-0.02em]">{t("vp.topTitle")}</h3>
          <p className="mb-4 px-1 text-[15.5px] leading-relaxed text-ink-2">{t("vp.topLede")}</p>
          <ul className="grid gap-4">{rankRows(v.rows).map((r) => <StockCard key={r.ticker} r={r} go={go} />)}</ul>
        </section>
      )}

      <Reveal as="section" className="card p-6 sm:p-8">
        <h3 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("vp.changedTitle")}</h3>
        <p className="mt-2 text-[18px] leading-relaxed text-ink">{v.changes.line}</p>
      </Reveal>

      <Reveal as="section" className="card p-6 sm:p-8">
        <h3 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-ink-2">{t("vp.rightTitle")}</h3>
        <p className="mt-2 text-[18px] leading-relaxed text-ink">{score.line}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{t("vp.rightNote")}</p>
        <button type="button" onClick={() => go("track")} className="meta mt-3 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">{t("vp.everyGuess")} <ArrowRight className="size-3.5" /></button>
      </Reveal>

      {v.summary && (
        <details className="card p-6 sm:p-8">
          <summary className="cursor-pointer text-[16px] font-semibold text-ink">{t("vp.summary")}</summary>
          <EnglishNote className="mt-3" />
          <En as="p" className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{v.summary}</En>
        </details>
      )}

      {history.length > 1 && (
        <section>
          <h3 className="mb-3 mt-4 px-1 text-[22px] font-semibold tracking-[-0.02em]">{t("vp.earlier")}</h3>
          <ol className="grid gap-3">
            {history.slice(1).map((p) => {
              const isOpen = openPast.has(p.date);
              return (
                <li key={p.date} className="card overflow-hidden">
                  <button type="button" onClick={() => togglePast(p.date)} aria-expanded={isOpen}
                    className="flex w-full min-h-[56px] items-center justify-between gap-3 px-5 py-4 text-start sm:px-6">
                    <span className="min-w-0">
                      <span className="meta block" style={{ color: "var(--ai)" }}>{longDate(p.date, lang)}</span>
                      <span className="mt-1 block text-[17px] leading-snug text-ink">{p.headline}</span>
                      {!isOpen && <span className="mt-1 block text-[14.5px] text-ink-3">{t(p.changes.same ? "vp.sameBefore" : "vp.somethingChanged")}</span>}
                    </span>
                    <ArrowRight className={`size-4 shrink-0 text-ink-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="grid gap-3 border-t border-line px-5 pb-6 pt-4 sm:px-6">
                      <BrainText by={p.byBrain} className="text-[16.5px] leading-relaxed text-ink">{p.eli5}</BrainText>
                      <p className="text-[15px] leading-relaxed text-ink-2">{p.changes.line}</p>
                      <ul className="grid gap-2">
                        {p.rows.map((r) => (
                          <li key={r.ticker} className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
                            <bdi className="font-semibold">{r.name}</bdi><Mood r={r} />
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
      <p className="meta mt-2 normal-case tracking-[0.04em]">{t("vp.foot")}</p>
    </div>
  );
}
