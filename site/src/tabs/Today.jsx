import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtNum, relDays, numWord } from "../lib/format.js";
import { marketBrief } from "../components/brief.jsx";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { ago, buildFeed, byDay, filterFeed, KINDS, KIND_LABEL } from "../lib/feed.js";
import { ArrowRight, Chip, Container, EmptyState, HeroTitle, Panel, Segmented } from "../components/ui.jsx";
import { DeskHead, MarketPulse, MoversPanel, SectorHeat, usePulse, ValueChip } from "../components/pulse.jsx";
import { NotAdvice } from "../components/shell.jsx";
import { heldAndPicked, todayCall } from "./Details.jsx";
import { MarketRace } from "../components/race.jsx";
import { WeeklyGame } from "../components/weekly.jsx";
import { Desk } from "../components/desk.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

// Every text on this page is in text/home.js ("today.*", the Desk's "desk.*", the market panels' "pulse.*").
/** "Thu, 22 Oct": a date without its year. */
const noYear = (iso) => fmtDate(iso).replace(/\s\d{4}$/, "");
// Each kind has its own glyph; market moves and checklist changes take the colour of their direction.
const KIND_META = {
  market: { glyph: "↕", color: null },
  companies: { glyph: "▤", color: "var(--ink)" },
  brain: { glyph: "✦", color: "var(--ai)" },
  people: { glyph: "☺", color: "var(--people)" },
  checklist: { glyph: "✓", color: null },
};
const TONE_VAR = { accent: "var(--up)", down: "var(--down)", flat: "var(--ink-2)" };
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
 * (components/desk.jsx); "Details" is the market overview and the live feed, one tap away for this visit only. Both read
 * the main list only.
 */
export default function Today(props) {
  const t = strings(dict);
  const [view, setView] = useState("desk");
  useEffect(forgetOldView, []);
  const pickView = (v) => { setView(v); window.scrollTo({ top: 0 }); };
  return (
    <>
      {/* Both views are wide, left-aligned pages: the switch lines up with them. */}
      <div className="mx-auto flex w-full max-w-[1280px] justify-start px-4 pt-4 sm:px-8 sm:pt-6 lg:px-12">
        <Segmented tall label={t("today.howMuch")} value={view} onChange={pickView}
          options={[{ value: "desk", label: t("today.desk") }, { value: "details", label: t("today.details") }]} />
      </div>
      {view === "desk" ? <Desk {...props} openTo={(to) => openAt(props.go, to)} /> : <LiveFeed {...props} />}
    </>
  );
}

/**
 * Details: a market overview dashboard over the main list. The index moves and breadth, the biggest movers and the
 * industries, today's facts, results coming up, what the tests showed, the year's race, this week's plan and the feed.
 */
function LiveFeed({ data, market, go, live, checkNow }) {
  const t = strings(dict);
  // The details view reads the main list only: show that list in the header's switch rather than a notice.
  useEffect(() => { if (market && !market.isDefault) market.choose(market.defaultId); }, [market?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const call = todayCall(data);
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  const todayIso = todayISO(); // New York date: market days follow its calendar
  const feed = useMemo(() => buildFeed(data, todayIso), [data, todayIso]);
  const pulse = usePulse(data);
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
    <Container className="pt-6 pb-24 sm:pt-8">
      <OverviewTop data={data} pulse={pulse} todayIso={todayIso} live={live} checkNow={checkNow} stale={call.stale} age={call.age} />
      <MarketPulse p={pulse} id="hd-indices" />
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <MoversPanel p={pulse} go={go} id="hd-movers" />
        <SectorHeat p={pulse} id="hd-sectors" />
      </div>
      <div id="hd-pinned" className="mt-4 grid scroll-mt-28 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TodayPanel data={data} call={call} run={run} todayIso={todayIso} go={go} />
        <ComingPanel data={data} ahead={feed.ahead} todayIso={todayIso} go={go} />
        <LearnedPanel data={data} call={call} brief={brief} className="md:col-span-2 lg:col-span-1" />
      </div>
      {/* The race: the main list's past year replayed day by day, only when the reader presses Play. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        <MarketRace data={data} />
        <WeeklyGame data={data} go={go} compact />
      </div>
      <Feed feed={feed} filter={filter} pick={pick} shown={shown} setShown={setShown} open={open} data={data} feedTop={feedTop} />
      <div id="hd-end" className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
        <button type="button" onClick={() => go("details")} className="btn btn-primary justify-center">{t("today.marketDetails")} <ArrowRight /></button>
        <button type="button" onClick={() => go("portfolio")} className="btn justify-center">{t("today.portfolio")} <ArrowRight /></button>
      </div>
      <NotAdvice compact className="mt-6" />
      <p className="meta mt-2 tracking-[0.04em] normal-case">{t("today.computed")}</p>
    </Container>
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

/* ------------------------------------------------------------------ top */

function OverviewTop({ data, pulse, todayIso, live, checkNow, stale, age }) {
  const t = strings(dict);
  const now = useNow();
  const built = data.manifest.built_at;
  const tone = stale ? "down" : data.sample ? "wait" : "up";
  const label = stale ? t("today.dataOld", { count: age }) : t(data.sample ? "today.sampleData" : "today.live");
  const d = pulse?.d;
  return (
    <header className="mb-5 grid gap-4 md:flex md:items-end md:justify-between md:gap-8">
      <HeroTitle line1={t("today.ov.hero1")} line2={t("today.ov.hero2")}
        sub={d ? t("today.ov.sub", { date: noYear(d.date), count: d.names }) : t("today.ov.subNone")} />
      <div className="grid gap-1.5 md:justify-items-end" role="group" aria-label={t("today.ov.status")}>
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <Chip tone={tone}>
            <span className="relative inline-flex size-1.5" aria-hidden="true">
              {!stale && !data.sample && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />}
              <span className="relative inline-block size-1.5 rounded-full bg-current" />
            </span>
            {label}
          </Chip>
          <Chip tone="neutral"><span className="text-ink-2">{t("today.updated", { when: built ? ago(built, now) : "–" })}</span></Chip>
          <Chip tone="neutral"><time dateTime={todayIso} className="text-ink">{noYear(todayIso)}</time></Chip>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase md:justify-end">
          <span>{t("today.nextUpdate")}</span>
          <button type="button" onClick={checkNow} disabled={live?.checking}
            className="min-h-[44px] text-desk underline decoration-desk/40 underline-offset-4 hover:decoration-desk disabled:text-ink-3 disabled:no-underline">
            {live?.checking ? t("today.checking") : live?.checkedAt ? t("today.checked", { when: ago(live.checkedAt.toISOString(), now) }) : t("today.checkNow")}
          </button>
        </div>
        {live?.fresh && <p role="status"><Chip tone="up">{t("today.fresh")}</Chip></p>}
        {live?.reload && (
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-[44px] items-center">
            <Chip tone="brand">{t("today.reload")}</Chip>
          </button>
        )}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------- panels */

/** A fact as one dense row: label (and a note) on the left, the value in mono on the right. */
function Fact({ label, value, note }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2 first:border-0 first:pt-0">
      <div className="min-w-0">
        <div className="text-[13.5px] text-ink-2">{label}</div>
        {note && <div className="micro mt-0.5 tracking-[0.06em] normal-case">{note}</div>}
      </div>
      <div className="shrink-0 text-end font-num text-[13px] font-bold text-ink">{value}</div>
    </div>
  );
}

/** Hello and what to do. */
function TodayPanel({ data, call, run, todayIso, go }) {
  const t = strings(dict);
  const { asOf, stale } = call;
  const lastRun = data.latest?.date ?? null;
  return (
    <Panel id="hd-today" head={<DeskHead id="hd-today-h" title={t("today.today")} sub={noYear(todayIso)} />} active={stale}>
      <p className="headline text-[24px] leading-[1.05]">{rich(t, "today.hiDate", { date: <span className={stale ? "text-down" : "text-desk"}>{noYear(todayIso)}.</span> })}</p>
      <div className="mt-3">
        <Fact label={t("today.lastClose")} value={noYear(asOf)} note={stale ? t("today.closeOld", { count: call.age }) : relDays(asOf)} />
        <Fact label={t("today.lastRun")} value={lastRun ? noYear(lastRun) : t("today.notYet")} note={lastRun ? relDays(lastRun) : null} />
        {run && <Fact label={t("today.lookedClosely")} value={t("today.stocksN", { count: run.picks.length, word: numWord(run.picks.length).toLowerCase() })} note={t("today.inFeed")} />}
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <p className={`micro ${stale ? "text-down" : "text-desk"}`}>{t("today.moneyQ")}</p>
        <p className={`mt-1.5 text-[13.5px] leading-snug ${stale ? "text-down" : "text-ink-2"}`}>{t(stale ? "today.staleMoney" : "today.moneyA")}</p>
        <button type="button" onClick={() => go("verdicts")} className="btn btn-primary mt-3 min-h-[44px] w-full justify-center py-2 text-[14.5px]">{t("today.brainAnswer")} <ArrowRight /></button>
      </div>
    </Panel>
  );
}

/** Results days (and other dated company events) in the next two weeks, as dense rows. */
function ComingPanel({ data, ahead, todayIso, go }) {
  const t = strings(dict);
  const { held, picked } = heldAndPicked(data);
  const mine = new Set([...held, ...picked]);
  const soon = ahead.filter((a) => a.days <= SOON_DAYS);
  const later = ahead.filter((a) => a.days > SOON_DAYS && a.results)[0] ?? null;
  const { undated } = comingUp(data.outlook, todayIso, SOON_DAYS, [...mine]);
  if (!data.outlook) return null;
  const tickerButton = (x, to) => <button type="button" onClick={() => openAt(go, to)} className="font-num font-bold text-ink underline decoration-line-2 underline-offset-2">{x}</button>;
  return (
    <Panel id="hd-coming" head={<DeskHead id="hd-coming-h" title={t("today.ov.coming")} sub={t("today.ov.comingSub", { n: SOON_DAYS })} />}
      info={t("today.reportCard")} infoLabel={t("today.ov.coming")}>
      {soon.length ? (
        <ul className="-my-1 divide-y divide-line">
          {soon.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => openAt(go, `stock/${a.ticker}#whats-next`)}
                className="-mx-2 flex min-h-[48px] w-[calc(100%+16px)] items-center gap-3 rounded-[8px] px-2 py-1.5 text-start transition-colors hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-num text-[13.5px] font-bold text-ink">{a.ticker}</span>
                    {mine.has(a.ticker) && <Chip tone="people" className="min-h-[18px] px-1.5 text-[9.5px]">{t(held.includes(a.ticker) ? "today.held" : "today.picked")}</Chip>}
                  </span>
                  <span className="block text-[12px] text-ink-3">{t(a.results ? "today.results" : "today.event")}</span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block font-num text-[12.5px] font-bold text-ink">{noYear(a.date)}</span>
                  <span className="micro block tracking-[0.06em] normal-case">{inDays(a.days)}{a.results && !a.confirmed ? t("today.expected") : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState compact title={t("today.noResults", { n: SOON_DAYS })} />}
      {later && <p className="mt-3 text-[13px] leading-snug text-ink-2">{rich(t, "today.after", { t: tickerButton(later.ticker, `stock/${later.ticker}#whats-next`), date: noYear(later.date), in: inDays(later.days) })}</p>}
      {undated.length > 0 && (
        <p className="mt-2 text-[13px] leading-snug text-ink-2">
          {rich(t, "today.undated", { list: (
            <>{undated.map((u, i) => (
              <Fragment key={u.ticker}>{i ? ", " : ""}<button type="button" onClick={() => go(`stock/${u.ticker}`)} className="font-num font-bold text-ink underline decoration-line-2 underline-offset-2">{u.ticker}</button></Fragment>
            ))}</>
          ) })}
        </p>
      )}
    </Panel>
  );
}

/** The latest lesson from the tests. */
function LearnedPanel({ data, call, brief, className = "" }) {
  const t = strings(dict);
  const br = data.market.base_rates;
  const edge = br && br.gate.pass.ci_low != null && br.gate.pass.ci_low > 0;
  const better = br && br.gate.pass.mean != null && br.gate.fail.mean != null && br.gate.pass.mean > br.gate.fail.mean;
  const lesson = brief.lessons[0];
  const titleOf = (s) => (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1];
  const head = edge ? "helped" : better ? "hint" : "luck";
  return (
    <Panel id="hd-learned" className={className} head={<DeskHead id="hd-learned-h" title={t("today.ov.learned")} />}>
      <p className="headline text-[24px] leading-[1.05]">
        {t(`today.head.${head}.a`)} <span className={edge ? "text-up" : "text-people"}>{t(`today.head.${head}.b`)}</span>
      </p>
      <p className="mt-2.5 text-[13.5px] leading-snug text-ink-2">
        {call.v1res && <>{rich(t, "today.tested", { n: <span className="font-num font-bold text-ink">{t("today.nOf100", { n: fmtNum(call.v1res.percentile, 0) })}</span> })} </>}
        {br && t(edge ? "today.br.edge" : better ? "today.br.better" : "today.br.none")}
      </p>
      {lesson && (
        <figure className="tile mt-3 p-3">
          <figcaption className="micro mb-1.5 text-people">{t("today.lesson")} · <span className="tracking-[0.06em] normal-case">{lesson.why}</span></figcaption>
          {/* a library principle, quoted as written */}
          <blockquote className="text-[13.5px] leading-snug text-ink">{lesson.p.text}</blockquote>
          <div className="micro mt-1.5 truncate tracking-[0.04em] normal-case" title={lesson.p.source.title}>{titleOf(lesson.p.source)}</div>
        </figure>
      )}
    </Panel>
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
    <div ref={feedTop} className="mt-4 scroll-mt-28">
      <Panel id="hd-feed" head={<DeskHead id="hd-feed-h" title={t("today.feed")} sub={t("today.ov.feedSub")} />}
        info={t("today.feedIntro")} infoLabel={t("today.feedLabel")}>
        <div className="-mt-1">
          <Segmented label={t("today.show")} value={filter} onChange={pick}
            options={["all", ...KINDS].map((k) => ({ value: k, label: KIND_LABEL[k], count: counts[k] }))} />
        </div>
        {sampleChecklist && (filter === "all" || filter === "checklist") && (
          <p className="mt-3 rounded-tile border border-dashed border-people/60 px-3 py-2 text-[12.5px] text-people">{t("today.sampleChecklist")}</p>
        )}
        {ahead.length > 0 && (
          <div className="mt-4">
            <DayRule label={t("today.ahead")} tone="text-desk" />
            <ul className="divide-y divide-line">{ahead.map((it) => <FeedItem key={it.id} it={it} open={open} ahead />)}</ul>
          </div>
        )}
        {days.map((d) => (
          <div key={d.date} className="mt-4">
            <DayRule label={noYear(d.date)} right={relDays(d.date)} />
            <ul className="divide-y divide-line">{d.items.map((it) => <FeedItem key={it.id} it={it} open={open} />)}</ul>
          </div>
        ))}
        {!list.length && !ahead.length && <EmptyState compact className="mt-4" title={t(EMPTY[filter](data))} />}
        {list.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + PAGE)}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-tile border border-line-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase hover:text-ink">
            {t("today.showMore")} <span className="font-num text-[12px] tracking-normal text-ink-3 normal-case">{t("today.older", { n: list.length - shown })}</span>
          </button>
        )}
      </Panel>
    </div>
  );
}

/** A day's header inside the feed: the date, a hairline, how long ago. */
function DayRule({ label, right, tone = "text-ink-2" }) {
  return (
    <div className="micro mb-1 flex items-center gap-3">
      <span className={`shrink-0 ${tone}`}>{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line-2" />
      {right && <span className="shrink-0 tracking-[0.06em] normal-case">{right}</span>}
    </div>
  );
}

function FeedItem({ it, open, ahead = false }) {
  const t = strings(dict);
  const meta = KIND_META[it.kind];
  const color = it.unusual ? TONE_VAR[it.tone] : meta.color ?? TONE_VAR[it.tone] ?? "var(--ink-2)";
  const glyph = it.unusual ? "!" : meta.glyph;
  const kind = it.unusual ? t("today.unusual") : it.digest ? t("today.digest") : KIND_LABEL[it.kind];
  return (
    <li>
      <button type="button" onClick={() => open(it.to)}
        className="feed-row -mx-2 flex min-h-[52px] w-[calc(100%+16px)] items-start gap-3 rounded-[8px] px-2 py-2.5 text-start transition-colors hover:bg-surface-2">
        <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[7px] border font-num text-[12.5px] font-bold"
          style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>{glyph}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="micro" style={{ color }}>{kind}</span>
            {it.latest && <Chip tone="brand" className="min-h-[18px] px-1.5 text-[9px]">{t("today.ov.latest")}</Chip>}
            {ahead && <span className="micro tracking-[0.06em] normal-case">{noYear(it.date)} · {inDays(it.days)}</span>}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[14px] leading-snug text-ink">{it.title}</span>
          {it.body.map((b, i) => <span key={i} className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-ink-3">{b}</span>)}
        </span>
        <ValueChip value={it.value} className="mt-0.5 shrink-0" />
      </button>
    </li>
  );
}
