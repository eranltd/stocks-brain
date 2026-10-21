import { WeeklyGame } from "../components/weekly.jsx";
import { QuickRead, RabbitHoles } from "../components/explore.jsx";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate } from "../lib/format.js";
import { hasHebrew, localeOf, translate } from "../lib/i18n.js";
import { Auto, En, EnglishNote, useLang } from "../lib/lang.jsx";
import { marketBrief } from "../components/brief.jsx";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { ago, buildFeed, byDay, filterFeed, kindLabel, KINDS } from "../lib/feed.js";
import { ArrowRight, Reveal, Segmented } from "../components/ui.jsx";
import { NotAdvice } from "../components/shell.jsx";
import { heldAndPicked, todayCall } from "./Details.jsx";
import { marketDay } from "../lib/marketday.js";
import { companiesToKnow, marketWords, newsLines } from "../lib/simple.js";
import { topStocks } from "../lib/carousel.js";
import { TopStocks } from "../components/topstocks.jsx";
import { SectorSpotlights } from "../components/spotlight.jsx";
import { requestChecklistView } from "../components/checklist.jsx";
import { LatestVerdict } from "../components/verdict.jsx";
import { MarketRace } from "../components/race.jsx";
import { candlesOf, fundCard, marketNote, marketWho, membersOf, notYet } from "../lib/markets.js";
import { buyLine, buyWindowFor, mainListOf, mainWatchlistOf, sp500Of } from "../lib/buywindow.js";
import { stocksEarned } from "../lib/money.js";
import { trustStage } from "../components/trust.jsx";
import { notATrade, usableWhy } from "../lib/why.js";
import dict from "../i18n/home.js";

// Every text on this page is in i18n/home.js ("today.*"), in English and Hebrew; the pure libs it calls take `lang` last.
/** "Thu, 22 Oct" ("יום ה׳, 22 באוקטובר"): a date without its year. */
const noYear = (iso, lang = "en") => fmtDate(iso, lang).replace(/\s\d{4}$/, "");
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
/** In Hebrew, a line with no Hebrew letters (English from data) reads left to right; otherwise it follows the page. */
const dirFor = (text, lang) => (lang === "he" && !hasHebrew(text) ? "ltr" : undefined);
const SOON_DAYS = 14;

/**
 * Home: a live feed that keeps the daily post's feel. The header says when the data was built and re-checks it while the
 * page is open; "Today", the next two weeks' results days and the latest lesson are pinned; under them, every dated
 * thing the data knows (market closes, unusual moves, brain runs, company news, people's calls, checklist changes),
 * newest first. Everything is computed or copied from published data; nothing is fetched from elsewhere.
 */
// The home always opens on "Simple": a first look is never the numbers view. An older version remembered the last
// choice on the device; forget it so nobody is left on "Details".
const OLD_VIEW_KEY = "sb:home-view";
function forgetOldView() {
  try { window.localStorage.removeItem(OLD_VIEW_KEY); } catch { /* private mode or blocked storage */ }
}

/**
 * Home. "Simple" (always the default) is four calm cards in words for a reader with no time for numbers; "Details" is
 * the live feed, one tap away for this visit only.
 */
export default function Today(props) {
  const t = useLang().t(dict);
  const [view, setView] = useState("simple");
  useEffect(forgetOldView, []);
  const pickView = (v) => { setView(v); window.scrollTo({ top: 0 }); };
  return (
    <>
      <div className="mx-auto flex w-full max-w-[560px] justify-center px-4 pt-6 sm:pt-10">
        <Segmented label={t("today.howMuch")} value={view} onChange={pickView}
          options={[{ value: "simple", label: t("today.simple") }, { value: "details", label: t("today.details") }]} />
      </div>
      {view === "simple" ? <SimpleHome {...props} showDetails={() => pickView("details")} /> : <LiveFeed {...props} />}
    </>
  );
}

function LiveFeed({ data, market, go, live, checkNow }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  // The details feed reads the main list only: show that list in the header's switch rather than a notice.
  useEffect(() => { if (market && !market.isDefault) market.choose(market.defaultId); }, [market?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const call = todayCall(data);
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  const todayIso = todayISO(); // New York date: market days follow its calendar
  const feed = useMemo(() => buildFeed(data, todayIso, lang), [data, todayIso, lang]);
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

/* ------------------------------------------------------------------ simple */

/** "Friday" ("יום שישי"). */
const weekdayOf = (iso, lang = "en") => new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "en" ? "en-US" : localeOf(lang), { weekday: "long", timeZone: "UTC" });

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

function TapLine({ onClick, children, tone, english = false }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-start transition hover:border-ink-3">
      {tone && <span className="size-2.5 shrink-0 rounded-full" style={{ background: TONE_VAR[tone] ?? "var(--ink-3)" }} aria-hidden="true" />}
      {/* A company card's own English line reads left to right; the site's own lines follow the page (a Hebrew line that
          starts with a ticker still reads right to left, so not dir="auto"). */}
      <span lang={english ? "en" : undefined} dir={english ? "ltr" : undefined} className="min-w-0 flex-1 text-start text-[17px] leading-snug text-ink">{children}</span>
      <ArrowRight className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}

/** Under a "why it moved" line: where it comes from, with the market day, as links. Nothing when an unclear note found
 *  no source (the line itself already says no clear cause was found). */
function WhySources({ v }) {
  const t = useLang().t(dict);
  if (!v.sources.length) return null;
  return (
    <p className="mt-1.5 px-4 text-[13.5px] leading-relaxed text-ink-3">
      {t(v.unclear ? "today.lookedAt" : "today.from")}{" "}
      {v.sources.map((s, i) => (
        <Fragment key={s.url}>{i ? " · " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line-2 underline-offset-2 hover:text-ink"><bdi>{s.publisher}</bdi>{s.day ? <>, <bdi>{s.day}</bdi></> : ""} ↗</a></Fragment>
      ))}
    </p>
  );
}

/**
 * The market-dependent part of the simple home, in words: the carousel's names, the market sentence, the news and the
 * companies (or funds) to know. The default market adds what is held on paper and the brain's names; another market
 * has neither (they read Nasdaq only) and leads with its own benchmark ("The Israeli market").
 */
function homeWords(md, { isDefault, held = [], picked = [], todayIso, funds, earned = false, rulesResult = null, lang = "en" }) {
  const t = translate(dict, lang); // plain code, not a component: the dictionary directly
  const id = md.marketId;
  const entry = md.marketEntry ?? null;
  const isFunds = entry?.kind === "funds";
  const noun = isFunds ? "funds" : "companies";
  const day = marketDay(md.market, md.watchlist, md.bench);
  // A checklist from sample prices on a live site is not a reading of the market: no chips or reasons from it.
  const checklist = md.checklist && (!md.checklist.sample || md.sample) ? md.checklist : null;
  const benchRow = (md.market?.symbols ?? []).find((r) => r.symbol === md.bench.symbol);
  // Another market's benchmark in words (lib/markets.js; its Hebrew phrases are all masculine singular, form "m").
  const market = isDefault
    ? marketWords(day, md.regime, todayIso, { lang })
    : marketWords(day, null, todayIso, { who: marketWho(id, lang) ?? t("today.benchmark"), g: "m", noun, fromHigh: benchRow?.from_high_pct, lang });
  // Why it moved (lib/why.js) and recent official filings of this market's own names; sample files never sit beside live
  // numbers.
  const live = Boolean(md.livePrices);
  const why = usableWhy(md.why, live);
  const secNews = md.secNews && !(md.secNews.sample && live) ? md.secNews : null;
  // Five lines at most, one extra note: room for the explained mover and a recent official filing next to the results
  // coming up and the latest company news.
  const news = newsLines({ outlook: md.outlook, day, people: isDefault ? md.people : null, today: todayIso, names: md.names, max: 5, maxNotes: 1,
    why, secNews, members: [...membersOf({ watchlist: md.watchlist }), ...(md.watchlist?.context ?? []).map((c) => c.symbol), md.bench.symbol],
    groups: md.sectors ?? {}, market: id ?? null, lang });
  const pick = { held, picked, day, outlook: md.outlook, checklist, names: md.names, bench: md.bench.symbol, today: todayIso, lang };
  // A fund has no company card: its plain sentence comes from config/funds.json, else its list's plain category (the
  // sector funds may not have cards yet). Both are English data for now.
  // A sector fund's category is just "Sector", so it says which industry from the plain part of its name ("Telecom
  // carriers (iShares US Telecommunications)" -> "One industry: telecom carriers.").
  const category = (x) => {
    const cat = isFunds ? md.sectors?.[x] : null;
    if (!cat) return null;
    if (cat !== "Sector") return `${cat}.`;
    const plain = String(md.names?.[x] ?? "").match(/^([^(]{3,60}?)\s*\(/)?.[1];
    return plain ? t("today.oneIndustry", { what: `${plain.charAt(0).toLowerCase()}${plain.slice(1)}` }) : null;
  };
  const withFund = (c) => ({ ...c, plain: fundCard(funds, c.ticker)?.plain ?? c.plain ?? category(c.ticker) });
  const companies = companiesToKnow(pick).map(withFund);
  // "When to buy": one short line per card from the Stock page's "When could it be bought?" (lib/buywindow.js; it takes
  // the language last once it speaks Hebrew).
  const bwCtx = {
    today: todayIso, derived: md.market, checklist: md.checklist, bw: md.buyWindow, mainList: mainListOf(md), stocksEarned: earned, rulesResult, names: md.names,
    siteSample: Boolean(md.market?.sample), minRR: md.checklistCfg?.house_rule?.min_reward_to_risk ?? 2, stretchPct: md.settings?.setup?.stretch_pct ?? 8,
  };
  const withBuy = (c) => ({
    ...c,
    buy: buyLine(buyWindowFor(c.ticker, { ...bwCtx, fund: isFunds ? fundCard(funds, c.ticker) ?? {} : null, sp500: sp500Of(c.ticker, md.watchlist, mainWatchlistOf(md)) }), todayIso, lang),
    buyTo: `stock/${c.ticker}#buy-window`,
  });
  const top = topStocks({ ...pick, candles: candlesOf(md) }).map(withFund).map(withBuy);
  return { isFunds, noun, checklist, market, news, companies, top, note: marketNote(entry, lang) };
}

/** Where the market's words go while another market loads, fails or has no numbers yet. */
function MarketWait({ market }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const label = market.entry?.label ?? market.id;
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-8">
      <div className="card p-6 sm:p-7" role={market.state === "loading" ? "status" : undefined}>
        {market.state === "loading" && <p className="text-[18px] leading-relaxed text-ink-2">{t("today.loading", { label })}</p>}
        {market.state === "none" && <p className="text-[19px] leading-relaxed text-ink">{notYet(lang)}</p>}
        {market.state === "error" && (
          <>
            <p className="text-[18px] leading-relaxed text-ink">{t("today.loadFailed", { label })}</p>
            <button type="button" onClick={market.retry} className="btn mt-4 min-h-[52px] justify-center">{t("today.retry")}</button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The simple home: the market, the news, companies to know and the plan, in words. No figures: every sentence comes
 * from lib/simple.js, which turns the same published data into words (dates as weekdays or month words). The header's
 * market switch changes the top stocks, the market, the news and the companies; the plan always reads Nasdaq.
 */
function SimpleHome({ data, market, go, showDetails }) {
  const { lang, he, t: tr } = useLang();
  const t = tr(dict);
  const call = todayCall(data);
  const todayIso = todayISO();
  const { held, picked } = heldAndPicked(data);
  const isDefault = !market || market.isDefault;
  const md = isDefault ? data : market.state === "ready" ? market.data : null;
  const earned = stocksEarned(data.rulesResult, trustStage(data).stage);
  const words = md ? homeWords(md, { isDefault, held: isDefault ? held : [], picked: isDefault ? picked : [], todayIso, funds: data.funds, earned, rulesResult: data.rulesResult, lang }) : null;
  const isFunds = market?.entry?.kind === "funds";
  // "See the candles": the Stock page opens with its checklist card on the Candles view, as the brief's own link does.
  const seeCandles = (to) => { requestChecklistView("candles"); openAt(go, to); };
  const sample = md ? md.sample || (!isDefault && !md.livePrices) : data.sample;
  const status = t(call.stale ? "today.status.old" : sample ? "today.status.sample" : "today.status.live");
  const statusTone = call.stale ? "var(--down)" : sample ? "var(--people)" : "var(--accent)";
  const label = market?.entry?.label ?? "Nasdaq";
  const top = words?.top ?? [];
  return (
    <>
    {/* As wide as the carousel under it, so the greeting and "Top stocks" line up on a tablet. */}
    <div className={`mx-auto w-full px-4 pt-8 ${top.length ? "max-w-[1040px]" : "max-w-[560px]"}`}>
      <header>
        <h1 className="display text-[clamp(32px,8.5vw,44px)] leading-[1.05] tracking-[-0.03em]">{t.rich("today.hi", { day: <span className="text-accent">{weekdayOf(todayIso, lang)}.</span> })}</h1>
        <p className="mt-3 flex items-center gap-2 text-[15px] text-ink-2">
          <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: statusTone }} aria-hidden="true" />
          <span style={{ color: call.stale ? statusTone : undefined }}>{status}</span>
        </p>
        {!isDefault && (
          <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">{t("today.showing", { label })}</span>{" "}
            {/* The market's own note already says what the list is (TLV); otherwise its one line from the switch. */}
            <Auto>{words?.note ?? `${market.choices.find((c) => c.id === market.id)?.what ?? market.entry?.name}.`}</Auto>
          </p>
        )}
      </header>

      {call.stale && (
        <p role="alert" className="mt-6 rounded-3xl border border-down/50 bg-down/10 p-5 text-[17px] leading-relaxed text-down">
          {t("today.staleAlert")}
        </p>
      )}
      {isDefault && <div className="mt-6"><QuickRead data={data} market={words?.market?.main ?? null} go={go} /></div>}
    </div>

    {!words && <MarketWait market={market} />}
    {words && (
      <TopStocks key={md.marketId ?? market?.id} items={top} manifest={data.manifest} news={data.secNews} marketId={md.marketId ?? market?.id}
        title={t(isFunds ? "today.topFunds" : "today.topStocks")} one={isFunds ? "fund" : "company"}
        fallback={isFunds ? t("today.fundFallback") : undefined} englishNote={top.some((c) => c.plain)}
        openTo={(to) => openAt(go, to)} seeCandles={seeCandles} />
    )}

    {isDefault && <SectorSpotlights data={data} earned={earned} openTo={(to) => openAt(go, to)} seeCandles={seeCandles} />}

    <div className="mx-auto w-full max-w-[560px] px-4 pb-24">
      <div className="mt-10 grid gap-6">
        {words && (
          <>
            {/* The default market's line is in the two-minute read; another market keeps its own card. */}
            {!isDefault && (
              <SimpleCard kicker={t("today.theMarket")} tone={TONE_VAR[words.market.tone] ?? "var(--accent)"}>
                <p className="text-[clamp(22px,6vw,27px)] leading-snug font-semibold tracking-[-0.015em] text-ink">{words.market.main}</p>
                {words.market.more && <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{words.market.more}</p>}
                {isDefault
                  ? <button type="button" onClick={() => openAt(go, "details#market-today")} className="meta mt-5 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">{t("today.whatMarketDid")} <ArrowRight className="size-3.5" /></button>
                  : <button type="button" onClick={() => go("watchlist")} className="meta mt-5 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">{t("today.wholeList", { label })} <ArrowRight className="size-3.5" /></button>}
              </SimpleCard>
            )}

            <SimpleCard kicker={t("today.news")} tone="var(--ink-2)">
              {he && words.news.some((n) => n.english) && <EnglishNote className="-mt-1" />}
              {words.news.length ? (
                <ul className="grid gap-2.5">
                  {words.news.map((n) => (
                    <li key={n.id}>
                      <TapLine onClick={() => openAt(go, n.to)} tone={n.tone} english={he && !hasHebrew(n.text)}>{n.text}</TapLine>
                      {n.why && <WhySources v={n.why} />}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[17px] leading-relaxed text-ink-2">{t("today.noNews", { noun: t(`noun.${words.noun}`) }, { bidi: false })}</p>}
              {words.news.some((n) => n.why || n.filing) && <p className="mt-4 text-[14.5px] leading-relaxed text-ink-3">{notATrade(lang)}</p>}
            </SimpleCard>

          </>
        )}

        <LatestVerdict data={data} go={go} />

        <WeeklyGame data={data} go={go} compact />

        <div className="mt-6"><RabbitHoles data={data} go={go} /></div>
      </div>

      <Reveal className="mt-10 grid gap-3 text-center">
        <button type="button" onClick={showDetails} className="btn btn-primary justify-center">{t("today.showDetails")} <ArrowRight /></button>
        <NotAdvice compact className="mx-auto mt-6" />
      </Reveal>
    </div>
    </>
  );
}

/* ------------------------------------------------------------------ header */

function PostHeader({ data, todayIso, live, checkNow, stale, age }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const now = useNow();
  const built = data.manifest.built_at;
  const tone = stale ? "var(--down)" : data.sample ? "var(--people)" : "var(--accent)";
  const label = stale ? t("today.dataOld", { count: age }) : t(data.sample ? "today.sampleData" : "today.live");
  return (
    <header>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-accent/60 bg-surface font-mono text-[15px] font-medium text-accent" aria-hidden="true">sb</span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight font-semibold"><bdi>stocks·brain</bdi></div>
          <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-2">
            <span className="relative inline-flex size-2 shrink-0" aria-hidden="true">
              {!stale && !data.sample && <span className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: tone }} />}
              <span className="relative inline-block size-2 rounded-full" style={{ background: tone }} />
            </span>
            <span className="min-w-0 truncate"><span style={{ color: tone }}>{label}</span> · {t("today.updated", { when: built ? ago(built, now, lang) : "–" }, { bidi: false })}</span>
          </div>
        </div>
        <time dateTime={todayIso} className="meta shrink-0">{noYear(todayIso, lang)}</time>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ps-14 text-[12.5px] text-ink-3">
        <span>{t("today.nextUpdate")}</span>
        <button type="button" onClick={checkNow} disabled={live?.checking} className="min-h-[32px] underline decoration-line-2 underline-offset-2 hover:text-ink disabled:no-underline">
          {live?.checking ? t("today.checking") : live?.checkedAt ? t("today.checked", { when: ago(live.checkedAt.toISOString(), now, lang) }, { bidi: false }) : t("today.checkNow")}
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
  const t = useLang().t(dict);
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
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  const { asOf, stale } = call;
  const tone = stale ? "var(--down)" : "var(--accent)";
  const lastRun = data.latest?.date ?? null;
  return (
    <PinnedCard kicker={t("today.today")} tone={tone}>
      <h2 className="display text-[clamp(28px,7.4vw,36px)] leading-[1.05] tracking-[-0.03em]">{t.rich("today.hiDate", { date: <span className="text-accent">{noYear(todayIso, lang)}.</span> })}</h2>
      <div className="mt-4">
        <Fact label={t("today.lastClose")} value={noYear(asOf, lang)} note={stale ? t("today.closeOld", { count: call.age }) : fmt.rel(asOf)} />
        <Fact label={t("today.lastRun")} value={lastRun ? noYear(lastRun, lang) : t("today.notYet")} note={lastRun ? fmt.rel(lastRun) : null} />
        {run && <Fact label={t("today.lookedClosely")} value={t("today.stocksN", { count: run.picks.length, word: fmt.numWord(run.picks.length).toLowerCase() })} note={t("today.inFeed")} />}
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
  const { lang, t: tr } = useLang();
  const t = tr(dict);
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
                  <bdi className="font-mono text-[15px] font-medium text-ink">{a.ticker}</bdi>
                  {mine.has(a.ticker) && <span className="pill py-0 text-[9.5px] text-people">{t(held.includes(a.ticker) ? "today.held" : "today.picked")}</span>}
                </span>
                <span className="mt-0.5 text-[12.5px] text-ink-2">{t(a.results ? "today.results" : "today.event")}</span>
                <span className="mt-auto pt-2 text-[13px] text-ink">{noYear(a.date, lang)}</span>
                <span className="meta normal-case tracking-[0.03em]">{inDays(a.days, lang)}{a.results && !a.confirmed ? t("today.expected") : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Para>{t("today.noResults", { n: SOON_DAYS })}</Para>
      )}
      {later && <p className="mt-3 text-[13.5px] text-ink-2">{t.rich("today.after", { t: tickerButton(later.ticker, `stock/${later.ticker}#whats-next`), date: noYear(later.date, lang), in: inDays(later.days, lang) })}</p>}
      {undated.length > 0 && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
          {t.rich("today.undated", { list: (
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
  const { t: tr, fmt } = useLang();
  const t = tr(dict);
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
        {call.v1res && <>{t.rich("today.tested", { n: <Ink>{t("today.nOf100", { n: fmt.num(call.v1res.percentile, 0) }, { bidi: false })}</Ink> })} </>}
        {br && t(edge ? "today.br.edge" : better ? "today.br.better" : "today.br.none")}
      </Para>
      {lesson && (
        <figure className="mt-4 rounded-2xl border border-line-2 bg-surface-2 p-4">
          <figcaption className="meta mb-2 text-people">{t("today.lesson")} · <bdi>{lesson.why}</bdi></figcaption>
          {/* a library principle, quoted as written (English) */}
          <EnglishNote />
          <En as="blockquote" className="text-[14.5px] leading-relaxed text-ink">{lesson.p.text}</En>
          <div dir="auto" className="meta mt-2 truncate normal-case tracking-[0.04em]" title={lesson.p.source.title}>{titleOf(lesson.p.source)}</div>
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
  const { lang, he, t: tr, fmt } = useLang();
  const t = tr(dict);
  const { list, counts } = filterFeed(feed, filter, lang);
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
      {he && list.some((it) => it.english) && <EnglishNote className="mt-2" />}
      <div className="mt-4">
        <Segmented label={t("today.show")} value={filter} onChange={pick}
          options={["all", ...KINDS].map((k) => ({ value: k, label: kindLabel(k, lang), count: counts[k] }))} />
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
            <span className="shrink-0">{noYear(d.date, lang)}</span>
            <span className="h-px flex-1 bg-line" />
            <span className="shrink-0 normal-case tracking-[0.04em]">{fmt.rel(d.date)}</span>
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
  const { lang, t: tr } = useLang();
  const t = tr(dict);
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
            <span className="uppercase tracking-[0.14em]">{it.unusual ? t("today.unusual") : it.digest ? t("today.digest") : kindLabel(it.kind, lang)}</span>
            {it.latest && t("today.latestClose")}
            {ahead && <> · {noYear(it.date, lang)} · {inDays(it.days, lang)}</>}
          </span>
          {/* A line with no Hebrew (English from data, a ticker and a number) reads left to right; the site's own Hebrew
              sentences follow the page even when they start with a ticker (so not dir="auto"). */}
          <span dir={dirFor(it.title, lang)} className="mt-0.5 line-clamp-3 text-start text-[15px] leading-snug text-ink">{it.title}</span>
          {it.body.map((b, i) => <span key={i} dir={dirFor(b, lang)} className="mt-1 line-clamp-2 text-start text-[13.5px] leading-relaxed text-ink-2">{b}</span>)}
        </span>
        {it.value && <span className={`num mt-0.5 shrink-0 font-mono text-[13px] ${TONE_TEXT[it.value.tone] ?? "text-ink-2"}`}>{it.value.text}</span>}
      </button>
    </li>
  );
}
