import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtNum, numWord, relDays } from "../lib/format.js";
import { marketBrief } from "../components/brief.jsx";
import { STAGES } from "../components/trust.jsx";
import { nextRebalance } from "../components/goal.jsx";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { ago, buildFeed, byDay, filterFeed, KIND_LABEL, KINDS } from "../lib/feed.js";
import { ArrowRight, Reveal, Segmented } from "../components/ui.jsx";
import { heldAndPicked, todayCall } from "./Details.jsx";
import { marketDay } from "../lib/marketday.js";
import { companiesToKnow, marketWords, newsLines, planWords } from "../lib/simple.js";
import { topStocks } from "../lib/carousel.js";
import { TopStocks } from "../components/topstocks.jsx";
import { requestChecklistView } from "../components/checklist.jsx";
import { candlesOf, fundCard, MARKET_WHO, marketNote, nasdaqOnlyLine, NOT_YET, nounsFor } from "../lib/markets.js";

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
// The home always opens on "Simple": the household asked that a first look is never the numbers view. An older version
// remembered the last choice on the device; forget it so nobody is left on "Details".
const OLD_VIEW_KEY = "sb:home-view";
function forgetOldView() {
  try { window.localStorage.removeItem(OLD_VIEW_KEY); } catch { /* private mode or blocked storage */ }
}

/**
 * Home. "Simple" (always the default) is four calm cards in words for a reader with no time for numbers; "Details" is
 * the live feed, one tap away for this visit only.
 */
export default function Today(props) {
  const [view, setView] = useState("simple");
  useEffect(forgetOldView, []);
  const pickView = (v) => { setView(v); window.scrollTo({ top: 0 }); };
  return (
    <>
      <div className="mx-auto flex w-full max-w-[560px] justify-center px-4 pt-6 sm:pt-10">
        <Segmented label="How much to show" value={view} onChange={pickView}
          options={[{ value: "simple", label: "Simple" }, { value: "details", label: "Details" }]} />
      </div>
      {view === "simple" ? <SimpleHome {...props} showDetails={() => pickView("details")} /> : <LiveFeed {...props} />}
    </>
  );
}

function LiveFeed({ data, market, go, live, checkNow }) {
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
      {market && !market.isDefault && (
        <p role="note" className="mt-4 rounded-2xl border border-line-2 bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink-2">{nasdaqOnlyLine(market.entry?.label ?? market.id)}</p>
      )}
      <div className="mt-5 grid gap-4">
        <TodayCard data={data} call={call} run={run} todayIso={todayIso} go={go} />
        <ComingStrip data={data} ahead={feed.ahead} todayIso={todayIso} go={go} />
        <Learned data={data} call={call} brief={brief} run={run} />
      </div>
      <Feed feed={feed} filter={filter} pick={pick} shown={shown} setShown={setShown} open={open} data={data} feedTop={feedTop} />
      <Reveal className="mt-10 grid gap-3 text-center">
        <button type="button" onClick={() => go("details")} className="btn btn-primary justify-center">Market details <ArrowRight /></button>
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

/* ------------------------------------------------------------------ simple */

const CHIP = {
  accent: "border-accent/40 bg-accent/12 text-accent",
  down: "border-down/40 bg-down/12 text-down",
  flat: "border-line-2 bg-surface-2 text-ink-2",
};
const CHIP_MARK = { accent: "▲", down: "▼", flat: "◆" };
const STEP_WORD = ["One", "Two", "Three"];
const weekdayOf = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

function SimpleCard({ kicker, tone = "var(--accent)", children, id }) {
  return (
    <Reveal as="article" id={id} className="card overflow-hidden">
      <div className="h-1" style={{ background: tone }} />
      <div className="p-6 sm:p-7">
        <h2 className="meta mb-4" style={{ color: tone }}>{kicker}</h2>
        {children}
      </div>
    </Reveal>
  );
}

function TapLine({ onClick, children, tone }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition hover:border-ink-3">
      {tone && <span className="size-2.5 shrink-0 rounded-full" style={{ background: TONE_VAR[tone] ?? "var(--ink-3)" }} aria-hidden="true" />}
      <span className="min-w-0 flex-1 text-[17px] leading-snug text-ink">{children}</span>
      <ArrowRight className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}

/**
 * The market-dependent part of the simple home, in words: the carousel's names, the market sentence, the news and the
 * companies (or funds) to know. The default market adds what we hold on paper and the brain's names; another market
 * has neither (they read Nasdaq only) and leads with its own benchmark ("The Israeli market").
 */
function homeWords(md, { isDefault, held = [], picked = [], todayIso, funds }) {
  const id = md.marketId;
  const entry = md.marketEntry ?? null;
  const nouns = nounsFor(entry);
  const day = marketDay(md.market, md.watchlist, md.bench);
  // A checklist from sample prices on a live site is not a reading of the market: no chips or reasons from it.
  const checklist = md.checklist && (!md.checklist.sample || md.sample) ? md.checklist : null;
  const benchRow = (md.market?.symbols ?? []).find((r) => r.symbol === md.bench.symbol);
  const market = isDefault
    ? marketWords(day, md.regime, todayIso)
    : marketWords(day, null, todayIso, { who: MARKET_WHO[id] ?? "Our benchmark", noun: nouns.many, fromHigh: benchRow?.from_high_pct });
  const news = newsLines({ outlook: md.outlook, day, people: isDefault ? md.people : null, today: todayIso, names: md.names });
  const pick = { held, picked, day, outlook: md.outlook, checklist, names: md.names, bench: md.bench.symbol, today: todayIso };
  // A fund has no company card: its plain sentence comes from config/funds.json.
  const withFund = (c) => ({ ...c, plain: fundCard(funds, c.ticker)?.plain ?? c.plain ?? null });
  const companies = companiesToKnow(pick).map(withFund);
  const top = topStocks({ ...pick, candles: candlesOf(md) }).map(withFund);
  return { nouns, checklist, market, news, companies, top, note: marketNote(entry) };
}

/** Where the market's words go while another market loads, fails or has no numbers yet. */
function MarketWait({ market }) {
  const label = market.entry?.label ?? market.id;
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-8">
      <div className="card p-6 sm:p-7" role={market.state === "loading" ? "status" : undefined}>
        {market.state === "loading" && <p className="text-[18px] leading-relaxed text-ink-2">Loading {label}…</p>}
        {market.state === "none" && <p className="text-[19px] leading-relaxed text-ink">{NOT_YET}</p>}
        {market.state === "error" && (
          <>
            <p className="text-[18px] leading-relaxed text-ink">{label} could not load just now.</p>
            <button type="button" onClick={market.retry} className="btn mt-4 min-h-[52px] justify-center">Try again</button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The simple home: the market, the news, companies to know and our plan, in words. No figures: every sentence comes
 * from lib/simple.js, which turns the same published data into words (dates as weekdays or month words). The header's
 * market switch changes the top stocks, the market, the news and the companies; our plan always reads Nasdaq.
 */
function SimpleHome({ data, market, go, showDetails }) {
  const call = todayCall(data);
  const todayIso = todayISO();
  const { held, picked } = heldAndPicked(data);
  const isDefault = !market || market.isDefault;
  const md = isDefault ? data : market.state === "ready" ? market.data : null;
  const words = md ? homeWords(md, { isDefault, held: isDefault ? held : [], picked: isDefault ? picked : [], todayIso, funds: data.funds }) : null;
  const nouns = nounsFor(market?.entry);
  const nasdaqChecklist = data.checklist && (!data.checklist.sample || data.sample) ? data.checklist : null;
  // "See the candles": the Stock page opens with its checklist card on the Candles view, as the brief's own link does.
  const seeCandles = (to) => { requestChecklistView("candles"); openAt(go, to); };
  const plan = planWords({ held, picked, checklist: nasdaqChecklist, outlook: data.outlook, names: data.names, stage: call.stage, nextCheck: nextRebalance(call.asOf), today: todayIso, bench: data.bench.symbol });
  const sample = md ? md.sample || (!isDefault && !md.livePrices) : data.sample;
  const status = call.stale ? "The data is old: the daily update may have failed." : sample ? "Sample data, not the market." : "Live: updated after each US close.";
  const statusTone = call.stale ? "var(--down)" : sample ? "var(--people)" : "var(--accent)";
  const label = market?.entry?.label ?? "Nasdaq";
  const top = words?.top ?? [];
  return (
    <>
    {/* As wide as the carousel under it, so the greeting and "Top stocks" line up on a tablet. */}
    <div className={`mx-auto w-full px-4 pt-8 ${top.length ? "max-w-[1040px]" : "max-w-[560px]"}`}>
      <header>
        <h1 className="display text-[clamp(32px,8.5vw,44px)] leading-[1.05] tracking-[-0.03em]">Hi! It's <span className="text-accent">{weekdayOf(todayIso)}.</span></h1>
        <p className="mt-3 flex items-center gap-2 text-[15px] text-ink-2">
          <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: statusTone }} aria-hidden="true" />
          <span style={{ color: call.stale ? statusTone : undefined }}>{status}</span>
        </p>
        {!isDefault && (
          <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Showing {label}:</span>{" "}
            {/* The market's own note already says what the list is (TLV); otherwise its one line from the switch. */}
            {words?.note ?? `${market.choices.find((c) => c.id === market.id)?.what ?? market.entry?.name}.`}
          </p>
        )}
      </header>

      {call.stale && (
        <p role="alert" className="mt-6 rounded-3xl border border-down/50 bg-down/10 p-5 text-[17px] leading-relaxed text-down">
          Please don't act on anything below until the daily update runs again.
        </p>
      )}
    </div>

    {!words && <MarketWait market={market} />}
    {words && (
      <TopStocks key={md.marketId ?? market?.id} items={top} manifest={data.manifest} marketId={md.marketId ?? market?.id} title={nouns.many === "funds" ? "Top funds" : "Top stocks"} one={nouns.one}
        fallback={nouns.many === "funds" ? "Its fund card appears with the next update." : undefined}
        openTo={(to) => openAt(go, to)} seeCandles={seeCandles} />
    )}

    <div className="mx-auto w-full max-w-[560px] px-4 pb-24">
      <div className="mt-10 grid gap-6">
        {words && (
          <>
            <SimpleCard kicker="The market" tone={TONE_VAR[words.market.tone] ?? "var(--accent)"}>
              <p className="text-[clamp(22px,6vw,27px)] leading-snug font-semibold tracking-[-0.015em] text-ink">{words.market.main}</p>
              {words.market.more && <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{words.market.more}</p>}
              {isDefault
                ? <button type="button" onClick={() => openAt(go, "details#market-today")} className="meta mt-5 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">What the market did <ArrowRight className="size-3.5" /></button>
                : <button type="button" onClick={() => go("watchlist")} className="meta mt-5 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">The whole {label} list <ArrowRight className="size-3.5" /></button>}
            </SimpleCard>

            <SimpleCard kicker="In the news" tone="var(--ink-2)">
              {words.news.length ? (
                <ul className="grid gap-2.5">
                  {words.news.map((n) => <li key={n.id}><TapLine onClick={() => openAt(go, n.to)} tone={n.tone}>{n.text}</TapLine></li>)}
                </ul>
              ) : <p className="text-[17px] leading-relaxed text-ink-2">Nothing new about our {words.nouns.many} this week.</p>}
            </SimpleCard>

            <SimpleCard kicker={words.nouns.many === "funds" ? "Funds to know" : "Companies to know"} tone="var(--people)">
              <ul className="grid gap-3">
                {words.companies.map((c) => (
                  <li key={c.ticker}>
                    <button type="button" onClick={() => openAt(go, c.to)}
                      className="block min-h-[52px] w-full rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-ink-3">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-[20px] font-semibold tracking-[-0.01em] text-ink">{c.name}</span>
                        {c.chip && (
                          <span className={`pill py-0.5 text-[12px] normal-case tracking-[0.02em] ${CHIP[c.chip.tone]}`}>
                            <span aria-hidden="true" className="text-[9px]">{CHIP_MARK[c.chip.tone]}</span>{c.chip.word}
                          </span>
                        )}
                      </span>
                      <span className="meta mt-1 block normal-case tracking-[0.04em]">{c.tag}</span>
                      <span className="mt-2 block text-[16px] leading-relaxed text-ink-2">{c.plain ?? (words.nouns.many === "funds" ? "Its fund card appears with the next update." : "Its short summary appears with the next company update.")}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-[14px] text-ink">In short <ArrowRight className="size-3.5" /></span>
                    </button>
                  </li>
                ))}
              </ul>
              {!words.companies.length && <p className="text-[17px] leading-relaxed text-ink-2">No {words.nouns.many} stand out today.</p>}
              {!words.checklist && <p className="mt-4 text-[14.5px] leading-relaxed text-ink-3">The going up or down chips appear after the next daily run.</p>}
            </SimpleCard>
          </>
        )}

        <SimpleCard kicker="Our plan: one, two, three" tone="var(--accent)">
          {!isDefault && <p className="mb-4 text-[15.5px] leading-relaxed text-ink-2">Our plan always follows the Nasdaq list; {label} is for looking, not part of it.</p>}
          <ol className="grid gap-4">
            {plan.steps.map((s, i) => (
              <li key={STEP_WORD[i]} className="flex gap-4">
                <span className="meta w-14 shrink-0 pt-1 text-accent">{STEP_WORD[i]}</span>
                <span className="min-w-0 text-[18px] leading-snug text-ink">{s}</span>
              </li>
            ))}
          </ol>
          {plan.next && <p className="mt-5 border-t border-line pt-4 text-[17px] text-ink">{plan.next}</p>}
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{plan.honest}</p>
          <button type="button" onClick={() => go("portfolio")} className="meta mt-4 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">The practice portfolio <ArrowRight className="size-3.5" /></button>
        </SimpleCard>
      </div>

      <Reveal className="mt-10 grid gap-3 text-center">
        <button type="button" onClick={showDetails} className="btn btn-primary justify-center">Show the details <ArrowRight /></button>
        <p className="meta mt-6 normal-case tracking-[0.04em]">A practice notebook for one household, not financial advice.</p>
      </Reveal>
    </div>
    </>
  );
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
        <button type="button" onClick={() => go("details")} className="meta mt-4 inline-flex min-h-[40px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">Market details <ArrowRight className="size-3.5" /></button>
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
