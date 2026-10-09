import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtNum, numWord, relDays } from "../lib/format.js";
import { marketBrief } from "../components/brief.jsx";
import { STAGES } from "../components/trust.jsx";
import { nextRebalance } from "../components/goal.jsx";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { ago, buildFeed, byDay, filterFeed, KIND_LABEL, KINDS } from "../lib/feed.js";
import { ArrowRight, Reveal, Segmented } from "../components/ui.jsx";
import { heldAndPicked, todayCall } from "./Details.jsx";

const plural = (n, one, many) => (n === 1 ? one : many);
const noYear = (iso) => fmtDate(iso).replace(/\s\d{4}$/, ""); // "Thu, 22 Oct"
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

/**
 * Home: a live feed that keeps the daily post's feel. The header says when the data was built and re-checks it while the
 * page is open; "Today", the next two weeks' results days and the latest lesson are pinned; under them, every dated
 * thing the data knows (market closes, unusual moves, brain runs, company news, people's calls, checklist changes),
 * newest first. Everything is computed or copied from published data; nothing is fetched from elsewhere.
 */
export default function Today({ data, go, live, checkNow }) {
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
    <div className="mx-auto w-full max-w-[560px] px-4 pb-24 pt-6 sm:pt-10">
      <PostHeader data={data} todayIso={todayIso} live={live} checkNow={checkNow} stale={call.stale} age={call.age} />
      <div className="mt-5 grid gap-4">
        <TodayCard data={data} call={call} run={run} todayIso={todayIso} go={go} />
        <ComingStrip data={data} ahead={feed.ahead} todayIso={todayIso} go={go} />
        <Learned data={data} call={call} brief={brief} run={run} />
      </div>
      <Feed feed={feed} filter={filter} pick={pick} shown={shown} setShown={setShown} open={open} data={data} feedTop={feedTop} />
      <Reveal className="mt-10 grid gap-3 text-center">
        <button type="button" onClick={() => go("details")} className="btn btn-primary justify-center">See the full dashboard <ArrowRight /></button>
        <button type="button" onClick={() => go("portfolio")} className="btn justify-center">The portfolio <ArrowRight /></button>
        <p className="meta mt-6 normal-case tracking-[0.04em]">A research notebook for one household, not financial advice. Every number here is computed by code from public market data.</p>
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
  const now = useNow();
  const built = data.manifest.built_at;
  const tone = stale ? "var(--down)" : data.sample ? "var(--people)" : "var(--accent)";
  const label = stale ? `Data is ${age} days old` : data.sample ? "Sample data" : "Live";
  return (
    <header>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-accent/60 bg-surface font-mono text-[15px] font-medium text-accent" aria-hidden="true">sb</span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight font-semibold">stocks·brain</div>
          <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-2">
            <span className="relative inline-flex size-2 shrink-0" aria-hidden="true">
              {!stale && !data.sample && <span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: tone }} />}
              <span className="relative inline-block size-2 rounded-full" style={{ background: tone }} />
            </span>
            <span className="min-w-0 truncate"><span style={{ color: tone }}>{label}</span> · updated {built ? ago(built, now) : "–"}</span>
          </div>
        </div>
        <time dateTime={todayIso} className="meta shrink-0">{noYear(todayIso)}</time>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-14 text-[12.5px] text-ink-3">
        <span>Next update after the US close</span>
        <button type="button" onClick={checkNow} disabled={live?.checking} className="min-h-[32px] underline decoration-line-2 underline-offset-2 hover:text-ink disabled:no-underline">
          {live?.checking ? "Checking…" : live?.checkedAt ? `Checked ${ago(live.checkedAt.toISOString(), now)}` : "Check now"}
        </button>
      </div>
      {live?.fresh && <p role="status" className="pill mt-3 ml-14 border-accent/40 bg-accent/10 normal-case tracking-[0.04em] text-accent">New data loaded</p>}
      {live?.reload && (
        <button type="button" onClick={() => window.location.reload()} className="pill mt-3 ml-14 min-h-[36px] border-accent/50 bg-accent/12 normal-case tracking-[0.04em] text-accent">
          New data is out · tap to refresh
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
  return (
    <Reveal as="article" id={id} className="card overflow-hidden">
      <div className="h-1" style={{ background: tone }} />
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="meta min-w-0" style={{ color: tone }}>{kicker}</span>
          <span className="meta inline-flex shrink-0 items-center gap-1 normal-case tracking-[0.04em]"><Pin />pinned</span>
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
      <div className="shrink-0 text-right text-[14.5px] font-medium text-ink">{value}</div>
    </div>
  );
}

/** Hello and what to do, in one pinned card. */
function TodayCard({ data, call, run, todayIso, go }) {
  const { stage, small, met, held, corePct, rec, lr, asOf, head, accent, stale } = call;
  const tone = stale ? "var(--down)" : "var(--accent)";
  const lastRun = data.latest?.date ?? null;
  const hasRule = Boolean(lr || rec);
  return (
    <PinnedCard kicker="Today" tone={tone}>
      <h2 className="display text-[clamp(28px,7.4vw,36px)] leading-[1.05] tracking-[-0.03em]">Hi! Today is <span className="text-accent">{noYear(todayIso)}.</span></h2>
      <div className="mt-4">
        <Fact label="Last market close we have" value={noYear(asOf)} note={stale ? `${call.age} days old: the daily update may have failed` : relDays(asOf)} />
        <Fact label="Last time the brain ran" value={lastRun ? noYear(lastRun) : "Not yet"} note={lastRun ? relDays(lastRun) : null} />
        {run && <Fact label="What it flagged" value={`${numWord(run.picks.length).toLowerCase()} ${plural(run.picks.length, "name", "names")}`} note="in the feed below" />}
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <div className="meta mb-2" style={{ color: tone }}>What should we do?</div>
        <div className="text-[22px] leading-snug font-semibold tracking-[-0.02em]">{head} <span style={{ color: tone }}>{accent}</span></div>
        {stale && <Para className="mt-3 text-down">The data is stale. Please don't act on anything below until the daily update runs again.</Para>}
        {!stale && (
          <Para className="mt-3">
            {hasRule && (
              <>
                The practice portfolio holds <Ink>{held.length ? held.join(", ") : "no single stocks"}</Ink>
                {corePct > 0 ? <> and <Ink>{fmtNum(corePct, 0)}%</Ink> in a plain index fund</> : null}. It takes its next look on <Ink>{fmtDate(nextRebalance(asOf))}</Ink>.{" "}
              </>
            )}
            {stage >= 2
              ? <>We are at trust stage {stage}: {STAGES[stage].money.toLowerCase()}, within the house limits.</>
              : <>No real money moves yet: <Ink>{met} of {small.length}</Ink> conditions to trust the plan are met so far.</>}
          </Para>
        )}
        <div className="mt-4 rounded-2xl border border-line-2 bg-surface-2 p-4 text-[14px] leading-relaxed text-ink-2">
          <span className="text-ink">In short:</span> keep the savings in the index fund. Anything else is a practice run on paper.
        </div>
        <button type="button" onClick={() => go("details")} className="meta mt-4 inline-flex min-h-[40px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">The full dashboard <ArrowRight className="size-3.5" /></button>
      </div>
    </PinnedCard>
  );
}

/** Results days (and other dated company events) in the next two weeks, as a compact strip. */
function ComingStrip({ data, ahead, todayIso, go }) {
  const { held, picked } = heldAndPicked(data);
  const mine = new Set([...held, ...picked]);
  const soon = ahead.filter((a) => a.days <= SOON_DAYS);
  const later = ahead.filter((a) => a.days > SOON_DAYS && a.results)[0] ?? null;
  const { undated } = comingUp(data.outlook, todayIso, SOON_DAYS, [...mine]);
  if (!data.outlook) return null;
  return (
    <PinnedCard kicker={`Coming up · next ${SOON_DAYS} days`}>
      {soon.length ? (
        <ul className="no-scrollbar -mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
          {soon.map((a) => (
            <li key={a.id} className="w-[148px] shrink-0 snap-start">
              <button type="button" onClick={() => openAt(go, `stock/${a.ticker}#whats-next`)} className="flex h-full min-h-[44px] w-full flex-col rounded-2xl border border-line-2 bg-surface-2 p-3 text-left hover:border-ink-3">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[15px] font-medium text-ink">{a.ticker}</span>
                  {mine.has(a.ticker) && <span className="pill py-0 text-[9.5px] text-people">{held.includes(a.ticker) ? "held" : "picked"}</span>}
                </span>
                <span className="mt-0.5 text-[12.5px] text-ink-2">{a.results ? "Results" : "Company event"}</span>
                <span className="mt-auto pt-2 text-[13px] text-ink">{noYear(a.date)}</span>
                <span className="meta normal-case tracking-[0.03em]">{inDays(a.days)}{a.results && !a.confirmed ? " · expected" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Para>No results days in the next {SOON_DAYS} days.</Para>
      )}
      {later && <p className="mt-3 text-[13.5px] text-ink-2">After that: <button type="button" onClick={() => openAt(go, `stock/${later.ticker}#whats-next`)} className="font-mono text-ink underline decoration-line-2 underline-offset-2">{later.ticker}</button> reports {noYear(later.date)} ({inDays(later.days)}).</p>}
      {undated.length > 0 && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
          No date announced yet for{" "}
          {undated.map((u, i) => (
            <Fragment key={u.ticker}>{i ? ", " : ""}<button type="button" onClick={() => go(`stock/${u.ticker}`)} className="font-mono text-ink underline decoration-line-2 underline-offset-2">{u.ticker}</button></Fragment>
          ))}.
        </p>
      )}
      <p className="meta mt-3 normal-case tracking-[0.04em]">A results day can move a stock a lot either way: event risk, not a signal.</p>
    </PinnedCard>
  );
}

/** The latest "What we learned" note, pinned under today. */
function Learned({ data, call, brief }) {
  const br = data.market.base_rates;
  const edge = br && br.gate.pass.ci_low != null && br.gate.pass.ci_low > 0;
  const better = br && br.gate.pass.mean != null && br.gate.fail.mean != null && br.gate.pass.mean > br.gate.fail.mean;
  const lesson = brief.lessons[0];
  const titleOf = (s) => (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1];
  return (
    <PinnedCard kicker="What we learned" tone="var(--people)">
      <div className="text-[22px] leading-snug font-semibold tracking-[-0.02em]">
        {edge ? <>Our checks <span className="text-people">helped.</span></> : better ? <>A hint of help, <span className="text-people">nothing proven.</span></> : <>Our checks haven't <span className="text-people">beaten luck.</span></>}
      </div>
      <Para className="mt-3">
        {call.v1res && <>On past prices, our stock-picking rule beat only <Ink>{fmtNum(call.v1res.percentile, 0)}%</Ink> of random picks from the same list. </>}
        {br && (edge ? "Names that passed the checks did measurably better than the index afterwards." : better ? "Names that passed the checks did slightly better than the rest, but not by enough to trust." : "Names that passed the checks did no better than the ones that failed.")}
      </Para>
      {lesson && (
        <figure className="mt-4 rounded-2xl border border-line-2 bg-surface-2 p-4">
          <figcaption className="meta mb-2 text-people">A lesson that fits today · {lesson.why}</figcaption>
          <blockquote className="text-[14.5px] leading-relaxed text-ink">{lesson.p.text}</blockquote>
          <div className="meta mt-2 truncate normal-case tracking-[0.04em]" title={lesson.p.source.title}>{titleOf(lesson.p.source)}</div>
        </figure>
      )}
    </PinnedCard>
  );
}

/* -------------------------------------------------------------------- feed */

const EMPTY = {
  checklist: (data) => (data.checklist ? "No checklist changes worth a line yet." : "The technical checklist's day-to-day changes appear after the next daily run."),
  brain: (data) => (data.sample ? "Brain runs show here once its picks are real; this build uses sample picks." : "No brain runs yet."),
  people: () => "No logged public calls yet.",
  companies: () => "No dated company news yet.",
  market: () => "Market closes appear after the next daily run.",
  all: () => "Nothing in the feed yet.",
};

function Feed({ feed, filter, pick, shown, setShown, open, data, feedTop }) {
  const { list, counts } = filterFeed(feed, filter);
  const days = byDay(list.slice(0, shown));
  const ahead = filter === "companies" ? feed.ahead : [];
  const sampleChecklist = Boolean(data.checklist?.sample) && !data.sample;
  return (
    <section ref={feedTop} aria-label="Feed" className="mt-10 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">The feed</h2>
        <span className="meta normal-case tracking-[0.04em]">newest first</span>
      </div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">Every dated thing in our data: market closes, unusual moves, the brain's runs, company news, people's calls and checklist changes. Tap one to open it.</p>
      <div className="mt-4">
        <Segmented label="Show" value={filter} onChange={pick}
          options={["all", ...KINDS].map((k) => ({ value: k, label: KIND_LABEL[k], count: counts[k] }))} />
      </div>
      {sampleChecklist && (filter === "all" || filter === "checklist") && (
        <p className="mt-3 rounded-2xl border border-dashed border-people/60 px-4 py-2.5 text-[13px] text-people">Checklist items here come from sample prices, not the market.</p>
      )}
      {ahead.length > 0 && (
        <div className="mt-6">
          <div className="meta mb-2 text-accent">Ahead</div>
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
      {!list.length && !ahead.length && <p className="mt-6 rounded-2xl border border-dashed border-line-2 p-5 text-center text-[14px] text-ink-2">{EMPTY[filter](data)}</p>}
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn mt-6 w-full justify-center text-[15px]">
          Show more <span className="num font-mono text-[13px] text-ink-3">{list.length - shown} older</span>
        </button>
      )}
    </section>
  );
}

function FeedItem({ it, open, ahead = false }) {
  const meta = KIND_META[it.kind];
  const color = it.unusual ? TONE_VAR[it.tone] : meta.color ?? TONE_VAR[it.tone] ?? "var(--ink-2)";
  const glyph = it.unusual ? "!" : meta.glyph;
  return (
    <li>
      <button type="button" onClick={() => open(it.to)}
        className={`flex min-h-[44px] w-full gap-3 rounded-2xl border bg-surface px-4 py-3 text-left transition hover:border-ink-3 ${it.latest ? "border-line-2" : "border-line"}`}>
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border text-[14px]" style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }} aria-hidden="true">{glyph}</span>
        <span className="min-w-0 flex-1">
          <span className="meta block normal-case tracking-[0.06em]">
            <span className="uppercase tracking-[0.14em]">{it.unusual ? "Unusual move" : it.digest ? "Checklist digest" : KIND_LABEL[it.kind]}</span>
            {it.latest && " · latest close"}
            {ahead && ` · ${noYear(it.date)} · ${inDays(it.days)}`}
          </span>
          <span className="mt-0.5 line-clamp-3 text-[15px] leading-snug text-ink">{it.title}</span>
          {it.body.map((b, i) => <span key={i} className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{b}</span>)}
        </span>
        {it.value && <span className={`num mt-0.5 shrink-0 font-mono text-[13px] ${TONE_TEXT[it.value.tone] ?? "text-ink-2"}`}>{it.value.text}</span>}
      </button>
    </li>
  );
}
