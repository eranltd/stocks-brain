import { useId, useMemo, useState } from "react";
import { todayISO } from "../lib/outlook.js";
import { scorecard, steadyRuns, verdictHistory } from "../lib/verdict.js";
import { weeklyBuyDay } from "../lib/weekly.js";
import { scoreBets } from "../lib/bets.js";
import { ledgerStats, paperBets, stepTrack } from "../lib/ledger.js";
import { fmtDate } from "../lib/format.js";
import { BrainBet, WeeklyGame } from "./weekly.jsx";
import { LumpSum, MoneyAction } from "./money.jsx";
import { BetLedger, BrainKpis, FEW_CLOSED, StepTrack, SureMeter } from "./ledger.jsx";
import { ArrowRight, CallChip, Chip, EmptyState, HeroTitle, InfoTip, Panel, Reveal, SectionTitle, SimBadge } from "./ui.jsx";
import dict from "../text/plan.js";
import { strings } from "../lib/text.js";

// Every text code writes here is in text/plan.js ("vp.*"). The brain's own words (its eli5 when it wrote one, its
// reasons, risks, summary and letter) are data, shown as written. The page is the Brain section: the newest run first
// (the one glowing panel), every call as a paper call (BUY (paper), WAIT, AVOID (paper)) with a conviction meter, the
// weekly bet, the brain's score, the real-money week, and every earlier run as a compact timeline. Prose sits behind an
// (i) or a toggle; numbers and chips come first.

/** "Friday, October 16". */
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
/** "Wed, 21 Oct": a market day without its year. */
const noYear = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "–");
const RANK = { accent: 0, flat: 1, down: 2 };
const SURE_RANK = { high: 0, medium: 1, low: 2 };
/** Strongest idea first: up before just watching before down, and surer before less sure. */
const rankRows = (rows) => [...rows].sort((a, b) => (RANK[a.tone] ?? 1) - (RANK[b.tone] ?? 1) || (SURE_RANK[a.level] ?? 3) - (SURE_RANK[b.level] ?? 3));

/** The brain's stance as a paper call in the kit's colours: up = BUY (paper), can't tell = WAIT, down = AVOID (paper). */
const CALL_OF = { accent: "buy", flat: "wait", down: "reject" };
const CALL_KEY = { buy: "vp.call.buy", wait: "vp.call.wait", reject: "vp.call.avoid" };
const CALLS = ["buy", "wait", "reject"];
const CALL_BAR = { buy: "bg-up", wait: "bg-wait", reject: "bg-down" };
const CALL_TILE = { buy: "border-up/50 bg-up/10 text-up", wait: "border-wait/50 bg-wait/10 text-wait", reject: "border-down/50 bg-down/10 text-down" };
const callOf = (r) => CALL_OF[r.tone] ?? "wait";
const LEVEL = { low: 1, medium: 2, high: 3 };

function opts(data) {
  return { outlook: data.outlook, names: data.names, today: todayISO() };
}

const Caret = ({ open, className = "size-4" }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** How sure the brain is, as a three-step signal meter in the call's colour, with its word. */
export function ConvictionMeter({ level, call = "wait", showWord = true, className = "" }) {
  const t = strings(dict);
  const n = LEVEL[level] ?? 0;
  const word = t.has(`vp.conv.${level}`) ? t(`vp.conv.${level}`) : level;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={t("vp.convFull", { level: word })}>
      <span className="sr-only">{t("vp.convFull", { level: word })}</span>
      <span aria-hidden="true" className="flex items-end gap-[3px]">
        {[0, 1, 2].map((i) => <i key={i} className={`block w-[5px] rounded-[1.5px] ${i < n ? CALL_BAR[call] : "bg-line-3"}`} style={{ height: 6 + i * 4 }} />)}
      </span>
      {showWord && <span aria-hidden="true" className="micro text-ink-2">{word}</span>}
    </span>
  );
}

/** A paper call chip: BUY (paper), WAIT or AVOID (paper). */
function Call({ r, size = "md", className = "" }) {
  const t = strings(dict);
  const call = callOf(r);
  const sz = size === "lg" ? "h-10 min-w-[96px] px-3 text-[17px] sm:h-11 sm:text-[19px]" : size === "sm" ? "h-7 px-2 text-[12.5px]" : "";
  return <CallChip call={call} label={t(CALL_KEY[call])} className={`${sz} ${className}`} />;
}

/** One name of a run: its paper call, conviction, and (on a tap) the brain's words, reason and what would change its mind. */
function NameCard({ r, go }) {
  const t = strings(dict);
  const [open, setOpen] = useState(false);
  const id = useId();
  const call = callOf(r);
  return (
    <li className="tile overflow-hidden">
      <div className="flex items-center gap-2.5 py-2 ps-3 pe-1.5">
        <span aria-hidden="true" className={`h-11 w-[3px] shrink-0 rounded-full ${CALL_BAR[call]}`} />
        <button type="button" onClick={() => go(`stock/${r.ticker}`)} aria-label={t("vp.openStock", { name: r.name })}
          className="group min-h-[44px] min-w-0 flex-1 text-start">
          <span className="flex items-baseline gap-2">
            <span className="font-num text-[16px] font-bold text-ink group-hover:text-desk">{r.ticker}</span>
            <span className="min-w-0 truncate text-[12.5px] text-ink-3">{r.name}</span>
          </span>
          <ConvictionMeter level={r.level} call={call} className="mt-1" />
        </button>
        <Call r={r} size="lg" />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} aria-label={t("vp.whyFor", { name: r.name })}
          className={`grid size-11 shrink-0 place-items-center rounded-[10px] transition-colors hover:text-ink ${open ? "text-desk" : "text-ink-3"}`}>
          <Caret open={open} />
        </button>
      </div>
      {open && (
        <div id={id} className="grid gap-2.5 border-t border-line bg-surface/70 px-4 py-3.5 text-[13.5px] leading-relaxed text-ink-2">
          <p className="text-[14.5px] text-ink">{r.eli5}</p>
          {!r.byBrain && r.why && <p><span className="text-ink-3">{t("vp.inBrainWords")}</span> {r.why}</p>}
          {r.thesis && <p>{r.thesis}</p>}
          {r.risks.length > 0 && (
            <div>
              <p className="micro mb-1 text-down">{t("vp.wrong")}</p>
              <ul className="grid gap-1">{r.risks.map((x) => <li key={x} className="relative ps-3.5 before:absolute before:start-0 before:top-[0.7em] before:h-px before:w-2 before:bg-down/70">{x}</li>)}</ul>
            </div>
          )}
          {r.wrongIf && <p><span className="micro me-1 text-wait">{t("vp.changesIf")}</span> {r.wrongIf}</p>}
        </div>
      )}
    </li>
  );
}

/** How many names got each call: three tiles, the way the Desk counts its calls. */
function CallCounts({ rows }) {
  const t = strings(dict);
  const n = Object.fromEntries(CALLS.map((c) => [c, rows.filter((r) => callOf(r) === c).length]));
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-3">
      {CALLS.map((c) => (
        <li key={c} className={`relative overflow-hidden rounded-tile border px-1.5 pt-3 pb-2.5 text-center sm:pt-4 ${n[c] ? CALL_TILE[c] : "border-line bg-surface-2/60 text-ink-3"}`}>
          {n[c] > 0 && <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${CALL_BAR[c]}`} />}
          <span className="font-num block text-[34px] leading-none font-bold tracking-[-0.04em] sm:text-[44px]">{n[c]}</span>
          <span className="headline mt-2 block truncate text-[13.5px] tracking-[0.06em] sm:text-[16px]">{t(CALL_KEY[c])}</span>
        </li>
      ))}
    </ul>
  );
}

/** The brain's weekly letter, in plain words. Paragraphs split on blank lines, or sentences grouped in twos when the
 *  brain wrote one block. */
function Letter({ text, date }) {
  const t = strings(dict);
  const parts = text.includes("\n") ? text.split(/\n+/).filter(Boolean)
    : (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).reduce((acc, s, i) => { if (i % 2 === 0) acc.push(s.trim()); else acc[acc.length - 1] += ` ${s.trim()}`; return acc; }, []);
  return (
    <Reveal as="section" id="letter" aria-labelledby="letter-h" className="panel scroll-mt-28 overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 pt-3.5 pb-3 sm:px-5">
        <SectionTitle id="letter-h" eyebrow={t("vp.letterKicker")} title={longDate(date)} />
        <InfoTip label={t("vp.letterAbout")}>{t("vp.letterNote")}</InfoTip>
      </div>
      <div className="mx-auto grid max-w-[68ch] gap-3.5 px-5 py-6 font-serif text-[17.5px] leading-[1.7] text-ink sm:px-8 sm:py-8 sm:text-[18.5px]">
        {parts.map((p, i) => <p key={i}>{p}</p>)}
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
  return <LatestCard go={go} v={v} />;
}

function LatestCard({ go, v }) {
  const t = strings(dict);
  return (
    <Panel as="article" id="brain-verdict" eyebrow={t("vp.latestTitle", { when: v.when || longDate(v.date) })} title={v.headline} badge={<SimBadge short />}>
      <p className="text-[15px] leading-relaxed text-ink-2">{v.eli5}</p>
      <button type="button" onClick={() => go("verdicts")} className="btn btn-primary mt-4 justify-center">{t(v.letter ? "vp.readLetter" : "vp.openFull")} <ArrowRight /></button>
    </Panel>
  );
}

/** "Real money · weekly whole-market buy · NEXT MON 26 OCT →": jumps to the week's panel below. */
function WeeklyPill({ data }) {
  const t = strings(dict);
  const today = todayISO();
  const day = weeklyBuyDay(today, data.buyWindow, data.sample);
  const jump = () => document.getElementById("this-week")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <button type="button" onClick={jump}
      className="group flex min-h-[48px] w-full items-center gap-3 rounded-tile border border-line-2 bg-surface-2/80 px-3.5 text-start transition-colors hover:border-line-3 md:w-auto md:min-w-[400px]">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-up shadow-[0_0_8px_var(--up-glow)]" />
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">{t("vp.weeklyPill")}</span>
      <span className="font-num shrink-0 text-[12px] font-bold text-ink uppercase">{day === today ? t("vp.weeklyToday") : t("vp.weeklyNext", { day: noYear(day) })}</span>
      <span aria-hidden="true" className="text-ink-3 transition-transform group-hover:translate-y-0.5">↓</span>
    </button>
  );
}

/** The page's top: THE BRAIN / TODAY'S CALL, the paper badge, and the real-money week one tap away. */
function Top({ data, v }) {
  const t = strings(dict);
  return (
    <div className="grid gap-6">
      <HeroTitle line1={t("vp.hero1")} line2={t("vp.hero2")} sub={t("vp.heroSub")} />
      <div className="grid gap-2.5 md:flex md:flex-wrap md:items-center md:justify-between md:gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {v && (
            <Chip tone="neutral">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-desk shadow-[0_0_8px_var(--desk)]" />
              <span className="text-ink-3">{t("vp.runChip")}</span><span className="text-ink">{noYear(v.date)}</span>
            </Chip>
          )}
          <SimBadge />
          <InfoTip label={t("vp.about")} align="start">{t("vp.aboutInfo")}</InfoTip>
        </div>
        <WeeklyPill data={data} />
      </div>
    </div>
  );
}

/** The newest run: the page's one glowing panel. */
function TodaysCall({ v, steady, go, letterOpen, setLetterOpen }) {
  const t = strings(dict);
  const rows = rankRows(v.rows);
  return (
    <Panel id="todays-call" hero className="scroll-mt-28"
      head={<SectionTitle id="todays-call-h" eyebrow={t("vp.run")} title={longDate(v.date)} size="md" />}
      badge={v.when ? <Chip tone="neutral" className="hidden sm:inline-flex">{v.when}</Chip> : null}
      info={<span className="grid gap-2"><span>{v.eli5}</span>{v.summary && <span className="text-ink-3"><span className="micro me-1 text-ink-2">{t("vp.summary")}</span>{v.summary}</span>}</span>}
      infoLabel={t("vp.notes")}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-8">
        {rows.length > 0 ? <CallCounts rows={rows} /> : null}
        <div className="min-w-0">
          <p className="headline text-[22px] leading-[1.05] text-ink sm:text-[26px]">{v.headline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip tone={v.changes.same ? "neutral" : "brand"} title={v.changes.line}>{t(v.changes.same ? "vp.same" : "vp.changed")}</Chip>
            {steady > 1 && <Chip tone="neutral">{t("vp.steadyChip", { count: steady })}</Chip>}
            <InfoTip label={t("vp.changedTitle")} align="start">{v.changes.line}</InfoTip>
          </div>
          <SureMeter convictions={v.rows.map((r) => r.level)} className="mt-3" />
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="mt-4 grid gap-2 md:grid-cols-2" aria-label={t("vp.callsLabel")}>
          {rows.map((r) => <NameCard key={r.ticker} r={r} go={go} />)}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {v.letter && (
          <button type="button" onClick={() => setLetterOpen((o) => !o)} aria-expanded={letterOpen} aria-controls="letter"
            className={`headline inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border px-4 text-[16px] tracking-[0.08em] transition-colors ${letterOpen ? "border-desk bg-desk/10 text-desk" : "border-line-2 text-ink hover:border-line-3"}`}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
            {t(letterOpen ? "vp.letterClose" : "vp.letterOpen")}
          </button>
        )}
        <SimBadge short className="ms-auto" />
      </div>
    </Panel>
  );
}

/** The track record: hits minus misses over time (paper), how many are closed, and a door to every scored call. */
function Track({ data, points, s, go }) {
  const t = strings(dict);
  const score = scorecard(data.runs, data.outcomes ?? [], data.settings.scoring.horizon_days, todayISO());
  const closed = s.closed;
  return (
    <Panel id="brain-track" title={t("lg.track.title")} sub={t("lg.track.sub")} infoLabel={t("lg.track.about")}
      info={<span className="grid gap-2"><span>{t("lg.track.info")}</span><span>{score.line}</span><span>{t("vp.rightNote")}</span></span>}
      badge={<Chip tone={closed < FEW_CLOSED ? "wait" : "neutral"}>{closed ? t("lg.kpi.closedChip", { count: closed }) : t("lg.kpi.none")}</Chip>}>
      {points.length > 1 ? <StepTrack points={points} height={164} /> : <EmptyState compact title={t("lg.track.emptyTitle")} />}
      <ul className="mt-3 flex flex-wrap items-center gap-1.5">
        <li><Chip tone="up" check>{t("lg.track.hits", { count: s.hits })}</Chip></li>
        <li><Chip tone="down">{t("lg.track.misses", { count: s.misses })}</Chip></li>
        {s.flats > 0 && <li><Chip tone="neutral">{t("lg.track.flats", { count: s.flats })}</Chip></li>}
        {s.nextCheck && <li className="ps-1 text-[12.5px] text-ink-3">{t("lg.track.next", { day: noYear(s.nextCheck) })}</li>}
      </ul>
      <button type="button" onClick={() => go("track")}
        className="group mt-4 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-tile border border-line-2 px-3.5 text-start transition-colors hover:border-line-3">
        <span className="headline text-[15px] tracking-[0.1em] text-ink">{t("vp.everyGuess")}</span>
        <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </button>
    </Panel>
  );
}

/** Every paper bet in one dense table, like a trading agent's book. */
function Ledger({ items, go }) {
  const t = strings(dict);
  return (
    <Panel id="ledger" className="scroll-mt-28" title={t("lg.title")} sub={t("lg.sub")} badge={<SimBadge short />}
      info={t("lg.aboutInfo")} infoLabel={t("lg.about")}>
      <BetLedger items={items} go={go} />
    </Panel>
  );
}

/** Every earlier run, newest first, as a compact timeline: date, the calls as small chips, changed or not; a tap opens it. */
function Earlier({ history }) {
  const t = strings(dict);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (d) => setOpen((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  return (
    <Panel id="earlier" title={t("vp.earlier")} badge={<Chip tone="neutral">{t("vp.earlierCount", { count: history.length })}</Chip>} flush>
      <ol className="relative py-1">
        <span aria-hidden="true" className="absolute top-6 bottom-6 start-[20px] w-px bg-line-2 sm:start-[24px]" />
        {history.map((p) => {
          const isOpen = open.has(p.date);
          const id = `run-${p.date}`;
          return (
            <li key={p.date} className="relative">
              <button type="button" onClick={() => toggle(p.date)} aria-expanded={isOpen} aria-controls={id}
                className="group flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-surface-2 sm:px-5">
                <span aria-hidden="true" className={`relative z-10 size-[9px] shrink-0 rounded-full border-2 ${p.changes.same ? "border-line-3 bg-surface" : "border-desk bg-desk shadow-[0_0_8px_var(--desk-glow)]"}`} />
                <span className="w-[52px] shrink-0 font-num text-[12px] font-bold text-ink uppercase sm:w-[96px] sm:text-[12.5px]">
                  <span className="sm:hidden">{noYear(p.date).replace(/^\w+,\s/, "")}</span><span className="hidden sm:inline">{noYear(p.date)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {rankRows(p.rows).map((r) => (
                    <span key={r.ticker} className={`chip min-h-[22px] px-1.5 text-[10.5px] ${{ buy: "border-up/40 text-up", wait: "border-wait/40 text-wait", reject: "border-down/40 text-down" }[callOf(r)]}`}>
                      {r.ticker}<span className="sr-only">: {t(CALL_KEY[callOf(r)])}</span>
                    </span>
                  ))}
                  {!p.rows.length && <span className="text-[12.5px] text-ink-3">{t("vp.noNames")}</span>}
                </span>
                <span className={`micro hidden shrink-0 sm:inline ${p.changes.same ? "" : "text-desk"}`}>{t(p.changes.same ? "vp.same" : "vp.changed")}</span>
                <Caret open={isOpen} className={`size-4 ${isOpen ? "text-desk" : "text-ink-3"}`} />
              </button>
              {isOpen && (
                <div id={id} className="grid gap-3 border-y border-line bg-surface-2/60 px-4 py-4 ps-11 sm:px-5 sm:ps-[52px]">
                  <p className="headline text-[18px] leading-[1.05] text-ink">{p.headline}</p>
                  <p className="text-[14px] leading-relaxed text-ink-2">{p.eli5}</p>
                  <p className="text-[13px] leading-relaxed text-ink-3"><span className={`micro me-1.5 ${p.changes.same ? "" : "text-desk"}`}>{t(p.changes.same ? "vp.same" : "vp.changed")}</span>{p.changes.line}</p>
                  {p.rows.length > 0 && (
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {rankRows(p.rows).map((r) => (
                        <li key={r.ticker} className="flex items-center gap-2.5 rounded-[8px] border border-line bg-surface px-2.5 py-1.5">
                          <span className="font-num text-[13px] font-bold text-ink">{r.ticker}</span>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{r.name}</span>
                          <ConvictionMeter level={r.level} call={callOf(r)} showWord={false} />
                          <Call r={r} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/**
 * The Brain page: the newest run as the glowing hero (every name's paper call, how sure, the letter one tap away), the
 * weekly bet and the brain's score side by side, the real-money week, the honest money action, and every earlier run.
 */
export function VerdictPage({ data, go }) {
  const t = strings(dict);
  const history = data.sample ? [] : verdictHistory(data.runs, opts(data));
  const [letterOpen, setLetterOpen] = useState(false);
  const v = history[0] ?? null;
  const steady = v ? steadyRuns(data.runs) : 0;
  const today = todayISO();
  // Every paper bet (daily calls and weekly bets), from the runs and their checked outcomes only.
  const book = useMemo(() => {
    if (data.sample) return null;
    const items = paperBets({ kb: data.kb, bets: scoreBets(data.runs, data.market, data.bench?.symbol), horizon: data.settings.scoring.horizon_days });
    return { items, s: ledgerStats(items, today), points: stepTrack(items, today) };
  }, [data, today]);
  return (
    <div className="grid gap-5 sm:gap-6">
      <Top data={data} v={v} />
      {v ? (
        <>
          {book && <BrainKpis s={book.s} />}
          <TodaysCall v={v} steady={steady} go={go} letterOpen={letterOpen} setLetterOpen={setLetterOpen} />
          {v.letter && letterOpen && <Letter text={v.letter} date={v.date} />}
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
            <BrainBet data={data} go={go} />
            {book && <Track data={data} points={book.points} s={book.s} go={go} />}
          </div>
          {book && book.items.length > 0 && <Ledger items={book.items} go={go} />}
        </>
      ) : (
        <EmptyState title={t("vp.emptyTitle")}>{t("vp.empty")}</EmptyState>
      )}
      <WeeklyGame data={data} go={go} />
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:items-start">
        <MoneyAction data={data} />
        <LumpSum data={data} />
      </div>
      {history.length > 1 && <Earlier history={history.slice(1)} />}
      <p className="micro mt-1 normal-case tracking-[0.04em]">{t("vp.foot")}</p>
    </div>
  );
}
