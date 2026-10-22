import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtNum, relDays, numWord } from "../lib/format.js";
import { marketBrief } from "../components/brief.jsx";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { ago, buildFeed, byDay, filterFeed, KINDS, KIND_LABEL } from "../lib/feed.js";
import { ArrowRight, Reveal, Segmented } from "../components/ui.jsx";
import { NotAdvice } from "../components/shell.jsx";
import { heldAndPicked, todayCall } from "./Details.jsx";
import { MarketRace } from "../components/race.jsx";
import { Desk } from "../components/desk.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

// Every text on this page is in text/home.js ("today.*", the Desk's "desk.*").
/** "Thu, 22 Oct": a date without its year. */
const noYear = (iso) => fmtDate(iso).replace(/\s\d{4}$/, "");
const TONE_VAR = { accent: "var(--accent)", down: "var(--down)", flat: "var(--ink-2)" };
const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink-2" };
// Each kind has its own glyph; market moves and checklist changes take the colour of their direction.
const KIND_META = {
  market: { glyph: "↕", color: null },
  companies: { glyph: "▤", color: "var(--ink)" },
  brain: { glyph: "✦", color: "var(--ai)" },
  people: { glyph: "☺", color: "var(--people)" },
  checklist: { glyph: "✓", color: null },
};
const PAGE = 30;
const SOON_DAYS = 14;

// The home always opens on the Desk. An older version remembered the last view on the device; forget it so nobody is
// left on "Details". (The words-only "Simple" view the Desk replaced had no route of its own: old links open Home.)
const OLD_VIEW_KEY = "sb:home-view";
function forgetOldView() {
  try { window.localStorage.removeItem(OLD_VIEW_KEY); } catch { /* private mode or blocked storage */ }
}

/**
 * Home. "Desk" (always the default) is six agents' panels over the main list with a paper call per name
 * (components/desk.jsx); "Details" is the live feed, one tap away for this visit only. Both read the main list only.
 */
export default function Today(props) {
  const t = strings(dict);
  const [view, setView] = useState("desk");
  useEffect(forgetOldView, []);
  const pickView = (v) => { setView(v); window.scrollTo({ top: 0 }); };
  return (
    <>
      {/* The Desk is a wide, left-aligned page; Details is a centred column: the switch lines up with each. */}
      <div className={`mx-auto flex w-full px-4 pt-4 sm:pt-6 ${view === "desk" ? "max-w-[1280px] justify-start sm:px-8 lg:px-12" : "max-w-[560px] justify-center"}`}>
        <Segmented tall label={t("today.howMuch")} value={view} onChange={pickView}
          options={[{ value: "desk", label: t("today.desk") }, { value: "details", label: t("today.details") }]} />
      </div>
      {view === "desk" ? <Desk {...props} openTo={(to) => openAt(props.go, to)} /> : <LiveFeed {...props} />}
    </>
  );
}

function LiveFeed({ data, market, go, live, checkNow }) {
  const t = strings(dict);
  // The details feed reads the main list only: show that list in the header's switch rather than a notice.
  useEffect(() => { if (market && !market.isDefault) market.choose(market.defaultId); }, [market?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const call = todayCall(data);
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  const todayIso = todayISO(); // New York date: market days follow its calendar
  const feed = useMemo(() => buildFeed(data, todayIso), [data, todayIso]);
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const feedTop = useRef(null);
  const pick = (f) => { setFilter(f); setShown(PAGE); };
  const open = (to) => {
    if (to.startsWith("filter:")) {
      pick(to.slice(7));
      feedTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    openAt(go, to);
  };
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-24 pt-6">
      <PostHeader data={data} todayIso={todayIso} live={live} checkNow={checkNow} stale={call.stale} age={call.age} />
      <div className="mt-5 grid gap-4">
        <TodayCard data={data} call={call} run={run} todayIso={todayIso} go={go} />
        <ComingStrip data={data} ahead={feed.ahead} todayIso={todayIso} go={go} />
        <Learned data={data} call={call} brief={brief} run={run} />
      </div>
      {/* The race: the main list's past year replayed day by day, only when the reader presses Play. */}
      <div className="mt-4"><MarketRace data={data} /></div>
      <Feed feed={feed} filter={filter} pick={pick} shown={shown} setShown={setShown} open={open} data={data} feedTop={feedTop} />
      <Reveal className="mt-10 grid gap-3 text-center">
        <button type="button" onClick={() => go("details")} className="btn btn-primary justify-center">{t("today.marketDetails")} <ArrowRight /></button>
        <button type="button" onClick={() => go("portfolio")} className="btn justify-center">{t("today.portfolio")} <ArrowRight /></button>
        <NotAdvice compact className="mx-auto mt-6" />
        <p className="meta normal-case tracking-[0.04em]">{t("today.computed")}</p>
      </Reveal>
    </div>
  );
}

/**
 * Open a route, then scroll to a section of it ("stock/NVDA#checklist", "details#market-today"). The page mounts after
 * the tab swap (inside a view transition when motion is on), so look for the section for a moment.
 */
export function openAt(go, to) {
  const [route, id] = to.split("#");
  go(route);
  if (!id) return;
  let tries = 0;
  const seek = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
    else if (++tries < 40) setTimeout(seek, 50);
  };
  setTimeout(seek, 50);
}

/** Re-render every minute so "updated 5 minutes ago" stays true while the page is open. */
function useNow(ms = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/* ------------------------------------------------------------------ header */

function PostHeader({ data, todayIso, live, checkNow, stale, age }) {
  const t = strings(dict);
  const now = useNow();
  const built = data.manifest.built_at;
  const tone = stale ? "var(--down)" : data.sample ? "var(--people)" : "var(--accent)";
  const label = stale ? t("today.dataOld", { count: age }) : t(data.sample ? "today.sampleData" : "today.live");
  return (
    <header>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-accent/60 bg-surface font-mono text-[15px] font-medium text-accent" aria-hidden="true">sb</span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight font-semibold"><span>stocks·brain</span></div>
          <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-2">
            <span className="relative inline-flex size-2 shrink-0" aria-hidden="true">
              {!stale && !data.sample && <span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: tone }} />}
              <span className="relative inline-block size-2 rounded-full" style={{ background: tone }} />
            </span>
            <span className="min-w-0 truncate"><span style={{ color: tone }}>{label}</span> · {t("today.updated", { when: built ? ago(built, now) : "–" })}</span>
          </div>
        </div>
        <time dateTime={todayIso} className="meta shrink-0">{noYear(todayIso)}</time>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ps-14 text-[12.5px] text-ink-3">
        <span>{t("today.nextUpdate")}</span>
        <button type="button" onClick={checkNow} disabled={live?.checking} className="min-h-[32px] underline decoration-line-2 underline-offset-2 hover:text-ink disabled:no-underline">
          {live?.checking ? t("today.checking") : live?.checkedAt ? t("today.checked", { when: ago(live.checkedAt.toISOString(), now) }) : t("today.checkNow")}
        </button>
      </div>
      {live?.fresh && <p role="status" className="pill mt-3 ms-14 border-accent/40 bg-accent/10 normal-case tracking-[0.04em] text-accent">{t("today.fresh")}</p>}
      {live?.reload && (
        <button type="button" onClick={() => window.location.reload()} className="pill mt-3 ms-14 min-h-[36px] border-accent/50 bg-accent/12 normal-case tracking-[0.04em] text-accent">
          {t("today.reload")}
        </button>
      )}
    </header>
  );
}

/* ---------------------------------------------------------- pinned cards */

const Pin = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
  </svg>
);

function PinnedCard({ kicker, tone = "var(--accent)", children, id }) {
  const t = strings(dict);
  return (
    <Reveal as="article" id={id} className="card overflow-hidden">
      <div className="h-1" style={{ background: tone }} />
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="meta min-w-0" style={{ color: tone }}>{kicker}</span>
          <span className="meta inline-flex shrink-0 items-center gap-1 normal-case tracking-[0.04em]"><Pin />{t("today.pinned")}</span>
        </div>
        {children}
      </div>
    </Reveal>
  );
}

const Para = ({ children, className = "" }) => <p className={`text-[15.5px] leading-relaxed text-ink-2 ${className}`}>{children}</p>;
const Ink = ({ children }) => <span className="text-ink">{children}</span>;

function Fact({ label, value, note }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-0 first:pt-0">
      <div className="min-w-0">
        <div className="text-[14.5px] text-ink">{label}</div>
        {note && <div className="meta mt-0.5 normal-case tracking-[0.03em]">{note}</div>}
      </div>
      <div className="shrink-0 text-end text-[14.5px] font-medium text-ink">{value}</div>
    </div>
  );
}

/** Hello and what to do, in one pinned card. */
function TodayCard({ data, call, run, todayIso, go }) {
  const t = strings(dict);
  const { asOf, stale } = call;
  const tone = stale ? "var(--down)" : "var(--accent)";
  const lastRun = data.latest?.date ?? null;
  return (
    <PinnedCard kicker={t("today.today")} tone={tone}>
      <h2 className="display text-[clamp(28px,7.4vw,36px)] leading-[1.05]">{rich(t, "today.hiDate", { date: <span className="text-accent">{noYear(todayIso)}.</span> })}</h2>
      <div className="mt-4">
        <Fact label={t("today.lastClose")} value={noYear(asOf)} note={stale ? t("today.closeOld", { count: call.age }) : relDays(asOf)} />
        <Fact label={t("today.lastRun")} value={lastRun ? noYear(lastRun) : t("today.notYet")} note={lastRun ? relDays(lastRun) : null} />
        {run && <Fact label={t("today.lookedClosely")} value={t("today.stocksN", { count: run.picks.length, word: numWord(run.picks.length).toLowerCase() })} note={t("today.inFeed")} />}
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <div className="meta mb-2" style={{ color: tone }}>{t("today.moneyQ")}</div>
        {stale
          ? <Para className="text-down">{t("today.staleMoney")}</Para>
          : <Para>{t("today.moneyA")}</Para>}
        <button type="button" onClick={() => go("verdicts")} className="btn btn-primary mt-4 justify-center">{t("today.brainAnswer")} <ArrowRight /></button>
      </div>
    </PinnedCard>
  );
}

/** Results days (and other dated company events) in the next two weeks, as a compact strip. */
function ComingStrip({ data, ahead, todayIso, go }) {
  const t = strings(dict);
  const { held, picked } = heldAndPicked(data);
  const mine = new Set([...held, ...picked]);
  const soon = ahead.filter((a) => a.days <= SOON_DAYS);
  const later = ahead.filter((a) => a.days > SOON_DAYS && a.results)[0] ?? null;
  const { undated } = comingUp(data.outlook, todayIso, SOON_DAYS, [...mine]);
  if (!data.outlook) return null;
  const tickerButton = (x, to) => <button type="button" onClick={() => openAt(go, to)} className="font-mono text-ink underline decoration-line-2 underline-offset-2">{x}</button>;
  return (
    <PinnedCard kicker={t("today.comingUp", { n: SOON_DAYS })}>
      {soon.length ? (
        <ul className="no-scrollbar -mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
          {soon.map((a) => (
            <li key={a.id} className="w-[148px] shrink-0 snap-start">
              <button type="button" onClick={() => openAt(go, `stock/${a.ticker}#whats-next`)} className="flex h-full min-h-[44px] w-full flex-col rounded-2xl border border-line-2 bg-surface-2 p-3 text-start hover:border-ink-3">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[15px] font-medium text-ink">{a.ticker}</span>
                  {mine.has(a.ticker) && <span className="pill py-0 text-[9.5px] text-people">{t(held.includes(a.ticker) ? "today.held" : "today.picked")}</span>}
                </span>
                <span className="mt-0.5 text-[12.5px] text-ink-2">{t(a.results ? "today.results" : "today.event")}</span>
                <span className="mt-auto pt-2 text-[13px] text-ink">{noYear(a.date)}</span>
                <span className="meta normal-case tracking-[0.03em]">{inDays(a.days)}{a.results && !a.confirmed ? t("today.expected") : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Para>{t("today.noResults", { n: SOON_DAYS })}</Para>
      )}
      {later && <p className="mt-3 text-[13.5px] text-ink-2">{rich(t, "today.after", { t: tickerButton(later.ticker, `stock/${later.ticker}#whats-next`), date: noYear(later.date), in: inDays(later.days) })}</p>}
      {undated.length > 0 && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
          {rich(t, "today.undated", { list: (
            <>{undated.map((u, i) => (
              <Fragment key={u.ticker}>{i ? ", " : ""}<button type="button" onClick={() => go(`stock/${u.ticker}`)} className="font-mono text-ink underline decoration-line-2 underline-offset-2">{u.ticker}</button></Fragment>
            ))}</>
          ) })}
        </p>
      )}
      <p className="meta mt-3 normal-case tracking-[0.04em]">{t("today.reportCard")}</p>
    </PinnedCard>
  );
}

/** The latest lesson from the tests, pinned under today. */
function Learned({ data, call, brief }) {
  const t = strings(dict);
  const br = data.market.base_rates;
  const edge = br && br.gate.pass.ci_low != null && br.gate.pass.ci_low > 0;
  const better = br && br.gate.pass.mean != null && br.gate.fail.mean != null && br.gate.pass.mean > br.gate.fail.mean;
  const lesson = brief.lessons[0];
  const titleOf = (s) => (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1];
  const head = edge ? "helped" : better ? "hint" : "luck";
  return (
    <PinnedCard kicker={t("today.learned")} tone="var(--people)">
      <div className="text-[22px] leading-snug font-semibold tracking-[-0.02em]">
        {t(`today.head.${head}.a`)} <span className="text-people">{t(`today.head.${head}.b`)}</span>
      </div>
      <Para className="mt-3">
        {call.v1res && <>{rich(t, "today.tested", { n: <Ink>{t("today.nOf100", { n: fmtNum(call.v1res.percentile, 0) })}</Ink> })} </>}
        {br && t(edge ? "today.br.edge" : better ? "today.br.better" : "today.br.none")}
      </Para>
      {lesson && (
        <figure className="mt-4 rounded-2xl border border-line-2 bg-surface-2 p-4">
          <figcaption className="meta mb-2 text-people">{t("today.lesson")} · <span>{lesson.why}</span></figcaption>
          {/* a library principle, quoted as written */}
          <blockquote className="text-[14.5px] leading-relaxed text-ink">{lesson.p.text}</blockquote>
          <div className="meta mt-2 truncate normal-case tracking-[0.04em]" title={lesson.p.source.title}>{titleOf(lesson.p.source)}</div>
        </figure>
      )}
    </PinnedCard>
  );
}

/* -------------------------------------------------------------------- feed */

const EMPTY = {
  checklist: (data) => (data.checklist ? "today.empty.checklist" : "today.empty.checklistLater"),
  brain: (data) => (data.sample ? "today.empty.brainSample" : "today.empty.brain"),
  people: () => "today.empty.people",
  companies: () => "today.empty.companies",
  market: () => "today.empty.market",
  all: () => "today.empty.all",
};

function Feed({ feed, filter, pick, shown, setShown, open, data, feedTop }) {
  const t = strings(dict);
  const { list, counts } = filterFeed(feed, filter);
  const days = byDay(list.slice(0, shown));
  const ahead = filter === "companies" ? feed.ahead : [];
  const sampleChecklist = Boolean(data.checklist?.sample) && !data.sample;
  return (
    <section ref={feedTop} aria-label={t("today.feedLabel")} className="mt-10 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{t("today.feed")}</h2>
        <span className="meta normal-case tracking-[0.04em]">{t("today.newestFirst")}</span>
      </div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{t("today.feedIntro")}</p>
      <div className="mt-4">
        <Segmented label={t("today.show")} value={filter} onChange={pick}
          options={["all", ...KINDS].map((k) => ({ value: k, label: KIND_LABEL[k], count: counts[k] }))} />
      </div>
      {sampleChecklist && (filter === "all" || filter === "checklist") && (
        <p className="mt-3 rounded-2xl border border-dashed border-people/60 px-4 py-2.5 text-[13px] text-people">{t("today.sampleChecklist")}</p>
      )}
      {ahead.length > 0 && (
        <div className="mt-6">
          <div className="meta mb-2 text-accent">{t("today.ahead")}</div>
          <ul className="grid gap-2">{ahead.map((it) => <FeedItem key={it.id} it={it} open={open} ahead />)}</ul>
        </div>
      )}
      {days.map((d) => (
        <div key={d.date} className="mt-6">
          <div className="meta mb-2 flex items-center gap-3">
            <span className="shrink-0">{noYear(d.date)}</span>
            <span className="h-px flex-1 bg-line" />
            <span className="shrink-0 normal-case tracking-[0.04em]">{relDays(d.date)}</span>
          </div>
          <ul className="grid gap-2">{d.items.map((it) => <FeedItem key={it.id} it={it} open={open} />)}</ul>
        </div>
      ))}
      {!list.length && !ahead.length && <p className="mt-6 rounded-2xl border border-dashed border-line-2 p-5 text-center text-[14px] text-ink-2">{t(EMPTY[filter](data))}</p>}
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn mt-6 w-full justify-center text-[15px]">
          {t("today.showMore")} <span className="num font-mono text-[13px] text-ink-3">{t("today.older", { n: list.length - shown })}</span>
        </button>
      )}
    </section>
  );
}

function FeedItem({ it, open, ahead = false }) {
  const t = strings(dict);
  const meta = KIND_META[it.kind];
  const color = it.unusual ? TONE_VAR[it.tone] : meta.color ?? TONE_VAR[it.tone] ?? "var(--ink-2)";
  const glyph = it.unusual ? "!" : meta.glyph;
  return (
    <li>
      <button type="button" onClick={() => open(it.to)}
        className={`flex min-h-[44px] w-full gap-3 rounded-2xl border bg-surface px-4 py-3 text-start transition hover:border-ink-3 ${it.latest ? "border-line-2" : "border-line"}`}>
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border text-[14px]" style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }} aria-hidden="true">{glyph}</span>
        <span className="min-w-0 flex-1">
          <span className="meta block normal-case tracking-[0.06em]">
            <span className="uppercase tracking-[0.14em]">{it.unusual ? t("today.unusual") : it.digest ? t("today.digest") : KIND_LABEL[it.kind]}</span>
            {it.latest && t("today.latestClose")}
            {ahead && <> · {noYear(it.date)} · {inDays(it.days)}</>}
          </span>
          <span className="mt-0.5 line-clamp-3 text-start text-[15px] leading-snug text-ink">{it.title}</span>
          {it.body.map((b, i) => <span key={i} className="mt-1 line-clamp-2 text-start text-[13.5px] leading-relaxed text-ink-2">{b}</span>)}
        </span>
        {it.value && <span className={`num mt-0.5 shrink-0 font-mono text-[13px] ${TONE_TEXT[it.value.tone] ?? "text-ink-2"}`}>{it.value.text}</span>}
      </button>
    </li>
  );
}
