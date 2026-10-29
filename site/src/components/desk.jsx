import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtPct, signTone } from "../lib/format.js";
import { todayISO } from "../lib/outlook.js";
import { weeklyBuyDay } from "../lib/weekly.js";
import { mainListOf } from "../lib/buywindow.js";
import { stocksEarned } from "../lib/money.js";
import { NOT_A_TRADE, plainName, usableWhy } from "../lib/why.js";
import { loadCandles } from "../lib/data.js";
import { miniGeometry, miniWindow } from "../lib/carousel.js";
import { useReducedMotion } from "../lib/motion.js";
import {
  AGENTS, PANEL_ORDER, REPORTERS, callCounts, deskCalls, execCandidates, freshness, houseLimits, newsCards, rrText, scannerRows,
  sortScanner, statTiles, strategyRows,
} from "../lib/desk.js";
import { trustStage } from "./trust.jsx";
import { CandleMark } from "./candles.jsx";
import { NotAdvice } from "./shell.jsx";
import {
  CallButton, CallChip, Chip, Connector, CrossIcon, CheckIcon, DataTable, Delta, EmptyState, HeroTitle, InfoTip, MiniSpark, Panel, PipelineStrip,
  SimBadge, Stamp, StatTile, StepMark,
} from "./ui.jsx";
import { todayCall } from "../tabs/Details.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";
import { BASKET, basketSeries, dayMove, raceTiles, windowed } from "../lib/arena.js";
import { raceData } from "../lib/replay.js";
import { HeatGrid, OrbitSphere, TickNumber } from "./motion.jsx";
import arenaDict from "../text/arena.js";

/*
 * The Desk: Home's default view and the kit's showcase (components/ui.jsx). Six agents in a pipeline, each a panel over
 * the same published data: the Boss's final call first (the one glowing hero panel), then Research, News, Strategy,
 * Execution and Risk, joined by orange connectors on iPad and desktop. Every call is made by plain code in lib/desk.js
 * (no AI decides anything here) and is pretend money: BUY is always "BUY (paper)", and the PAPER badge stays on screen
 * in the sticky pipeline strip. Percent changes only, never a price or raw volume.
 */

const NUM_AGENT = Object.fromEntries(AGENTS.map((a, i) => [a, i + 1]));
const TONE_TEXT = { accent: "text-up", down: "text-down", flat: "text-ink-2" };
/** A report's freshness as a step state: in (done), waiting (wait), missing (fail). */
const STEP = { fresh: "done", stale: "wait", missing: "fail" };
const CALL_TILE = {
  buy: "border-up/50 bg-up/10 text-up",
  wait: "border-wait/50 bg-wait/10 text-wait",
  reject: "border-down/50 bg-down/10 text-down",
};
const CALL_BAR = { buy: "bg-up", wait: "bg-wait", reject: "bg-down" };
const BOSS_ROWS_PHONE = 8;
const TICKETS = 4;
const BAR_N = 12;

/** "Wed, 21 Oct": a market day without its year. */
const noYear = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "–");
/** "21 Oct". */
const dayMonth = (iso) => (iso ? noYear(iso).replace(/^\w+,\s/, "") : "–");
const pct = (v, d = 1) => (typeof v === "number" && Number.isFinite(v) ? fmtPct(v, d) : "–");
const toneOf = (v, d = 1) => TONE_TEXT[signTone(v, d)] ?? "text-ink-2";
/** "+3", "−2", "0": the checklist's net score with a true minus sign. */
const signed = (n) => (n == null ? "–" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`);

/** Everything the panels show, from the loaded data (main list only). The Arena reads its BUY (paper) count. */
export function useDesk(data) {
  const todayIso = todayISO();
  return useMemo(() => {
    // A checklist or notes from sample prices on a live site are not a reading of the market.
    const checklist = data.checklist && (!data.checklist.sample || data.sample) ? data.checklist : null;
    const why = usableWhy(data.why, data.livePrices);
    const secNews = data.secNews && !(data.secNews.sample && data.livePrices) ? data.secNews : null;
    const market = data.market;
    const run = data.lastOk ?? null;
    const members = mainListOf(data);
    const names = data.names ?? {};
    const household = (data.docs ?? []).find((d) => d.name === "household")?.content ?? null;
    const earned = stocksEarned(data.rulesResult, trustStage(data).stage);
    const limits = houseLimits({ settings: data.settings, checklistCfg: data.checklistCfg, checklist, rulebook: data.rulebook, household, earned });
    const fresh = freshness({ market, checklist, why, secNews, run });
    const calls = deskCalls({ market, checklist, run, members, names, limits, received: fresh.received });
    const scan = scannerRows({ market, checklist, members, names });
    return {
      todayIso, checklist, run, limits, fresh, calls, scan,
      counts: callCounts(calls),
      tiles: statTiles(scan),
      news: newsCards({ why, secNews, outlook: data.outlook, market, members, today: todayIso, marketDate: fresh.marketDate }),
      strategy: strategyRows(calls, limits.minRR),
      candidates: execCandidates(calls, 4),
      bench: plainName(data.bench?.label ?? data.bench?.symbol ?? ""),
      buyDay: weeklyBuyDay(todayIso, data.buyWindow, data.sample),
    };
  }, [data, todayIso]);
}

/** The height of the site's sticky header, kept current (the strip sits right under it). */
function useHeaderHeight() {
  const [h, setH] = useState(64);
  useEffect(() => {
    const el = document.querySelector("header");
    if (!el) return;
    const on = () => setH(Math.round(el.getBoundingClientRect().height));
    on();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

/** The width of a box, kept current. */
function useBoxWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function Desk({ data, go, openTo }) {
  const t = strings(dict);
  const m = useDesk(data);
  const reduced = useReducedMotion();
  const headerH = useHeaderHeight();
  const strip = useRef(null);
  const [active, setActive] = useState("boss");
  const pinned = useRef(null); // the step last tapped: it wins over its neighbour when two panels share a row
  const open = useCallback((to) => (openTo ? openTo(to) : go(to.split("#")[0])), [openTo, go]);

  // The step whose panel is under the strip lights up. Two panels side by side (tablet) share a row: the one last
  // tapped in the strip, else the first of the row.
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = headerH + (strip.current?.offsetHeight ?? 0) + 32;
        const passed = PANEL_ORDER.map((a) => [a, document.getElementById(`desk-${a}`)?.getBoundingClientRect().top])
          .filter(([, top]) => top != null && top <= line);
        if (!passed.length) { setActive(PANEL_ORDER[0]); return; }
        const rowTop = Math.max(...passed.map(([, top]) => top));
        const row = passed.filter(([, top]) => Math.abs(top - rowTop) <= 1).map(([a]) => a);
        setActive(row.includes(pinned.current) ? pinned.current : row[0]);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [headerH]);

  const jump = (a) => {
    const el = document.getElementById(`desk-${a}`);
    if (!el) return;
    pinned.current = a;
    setActive(a);
    const y = el.getBoundingClientRect().top + window.scrollY - headerH - (strip.current?.offsetHeight ?? 0) - 10;
    window.scrollTo({ top: Math.max(0, y), behavior: reduced ? "auto" : "smooth" });
    document.getElementById(`desk-${a}-h`)?.focus({ preventScroll: true });
  };

  const total = REPORTERS.length;
  const steps = AGENTS.map((a) => ({
    id: a, label: t(`desk.a.${a}`),
    state: a === "boss" ? (m.fresh.received === total ? "done" : "wait") : STEP[m.fresh[a].state],
    stateLabel: t(`desk.state.${a === "boss" ? (m.fresh.received === total ? "fresh" : "stale") : m.fresh[a].state}`),
  }));

  return (
    <div className="pb-6">
      <DeskTop data={data} m={m} openTo={open} />
      <LiveStrip data={data} m={m} go={go} />
      <PipelineStrip ref={strip} sticky top={headerH} className="mt-6" label={t("desk.pipeline")} steps={steps} active={active} onStep={jump}
        lead={<SimBadge short />}
        trail={<span className="hidden font-num text-[12px] font-bold text-ink-2 sm:inline"><span className={m.fresh.received === total ? "text-desk" : "text-wait"}>{m.fresh.received}/{total}</span></span>} />
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-5 sm:px-8 sm:pt-8 lg:px-12">
        <div className="grid gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-10">
          <BossPanel m={m} go={go} />
          <ResearchPanel m={m} go={go} active={active === "research"} />
          <NewsPanel m={m} openTo={open} active={active === "news"} />
          <StrategyPanel m={m} openTo={open} active={active === "strategy"} />
          <ExecutionPanel m={m} data={data} go={go} active={active === "execution"} />
          <RiskPanel m={m} go={go} active={active === "risk"} />
        </div>
        <PipelineStrip variant="footer" className="mt-10" title={t("desk.simSystem")} label={t("desk.simSystem")}
          steps={steps.map((s) => ({ ...s }))}
          trail={<span className="font-num text-[11.5px] font-bold tracking-[0.08em] text-ink-2 uppercase"><span className="text-desk">{m.fresh.received}/{total}</span> {t("desk.received")}</span>} />
        <NotAdvice compact className="mx-auto mt-8 text-center" />
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ live strip */

/**
 * Home's live strip, a small door to the Arena: the paper basket's year as a big ticking number (it rolls from
 * $10,000 to where the even split ended, once it scrolls into view; clearly paper money from past data), the main list's
 * last day as a small heat grid, and the turning orbit with the desk's BUY (paper) calls as its core. Real past data
 * only; tap a tile to open that stock, or the strip's button to enter the Arena.
 */
function LiveStrip({ data, m, go }) {
  const ta = strings(arenaDict);
  const race = useMemo(() => {
    const r = raceData(data.market?.symbols, { order: mainListOf(data), bench: data.bench?.symbol, name: (x) => data.names?.[x] ?? x });
    return r ? windowed(r, 252) : null;
  }, [data]);
  const basket = useMemo(() => (race ? basketSeries(race) : []), [race]);
  const tiles = useMemo(() => (race ? raceTiles(race) : null), [race]);
  const names = useMemo(() => (race ? race.lines.map((l) => ({ symbol: l.symbol })) : []), [race]);
  const last = race ? race.n - 1 : 0;
  const moves = useMemo(() => (race ? Object.fromEntries(race.lines.map((l) => [l.symbol, dayMove(l.values, last)])) : null), [race, last]);
  const grid = useRef(null);
  const box = useRef(null);
  const reduced = useReducedMotion();
  // The tiles flip in once, when the strip first comes into view.
  useEffect(() => {
    const el = box.current;
    if (!el || reduced || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      grid.current?.setDay(Math.max(0, last - 1));
      setTimeout(() => grid.current?.setDay(last, { animate: true }), 60);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [last, reduced]);
  if (!race || race.n < 20 || !basket.length) return null;
  const end = basket.at(-1);
  const chg = (end / BASKET - 1) * 100;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 sm:px-8 lg:px-12">
      <section ref={box} aria-labelledby="live-strip-h" className="panel live-strip p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex items-center gap-2.5">
            <span className="arena-live"><span aria-hidden="true" className="arena-beacon" />{ta("arena.strip.kicker")}</span>
            <span id="live-strip-h" className="font-display text-[20px] leading-none font-extrabold tracking-[0.06em] text-ink uppercase">{ta("arena.strip.title")}</span>
          </p>
          <button type="button" onClick={() => go("arena")} aria-label={ta("arena.strip.aria")} className="arena-btn arena-btn-main hidden sm:inline-flex">
            {ta("arena.strip.enter")}<span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="live-strip-grid mt-3">
          <div className="live-strip-num min-w-0">
            <p className="text-[12.5px] leading-snug text-ink-2">{ta("arena.strip.basket", { amount: `$${BASKET.toLocaleString("en-US")}`, date: fmtDate(race.dates[0]) })}</p>
            <TickNumber value={end} from={BASKET} prefix="$" digits={5} base={BASKET} className="live-strip-tick mt-1.5" label={ta("arena.basket.title")}
              format={(v) => `$${Math.round(v).toLocaleString("en-US")}`} />
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`font-num text-[12.5px] font-bold ${chg >= 0 ? "text-up" : "text-down"}`}>{fmtPct(chg, 1)}</span>
              <span className="chip border-desk/55 bg-desk/10 text-desk">{ta("arena.strip.paper")}</span>
            </p>
            <MiniSpark values={basket} w={220} h={30} tone={chg >= 0 ? "up" : "down"} area fluid className="mt-2 max-w-[260px]" />
          </div>
          <div className="live-strip-heat min-w-0">
            <p className="micro mb-1.5 flex justify-between gap-2"><span>{ta("arena.strip.heat")}</span><span>{fmtDate(race.dates[last])}</span></p>
            <HeatGrid ref={grid} groups={tiles} day={last} labels={false} compact onOpen={(sym) => go(`stock/${sym}`)} style={{ "--heat-fade": "220ms" }} />
          </div>
          <div className="live-strip-orbit">
            <OrbitSphere names={names} moves={moves} core={m.counts.buy} cloud={130} labels={false} />
          </div>
        </div>
        <button type="button" onClick={() => go("arena")} aria-label={ta("arena.strip.aria")} className="arena-btn arena-btn-main mt-3 w-full sm:hidden">
          {ta("arena.strip.enter")}<span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ top */

function DeskTop({ data, m, openTo }) {
  const t = strings(dict);
  const call = todayCall(data);
  const sample = data.sample || Boolean(data.market?.sample);
  const state = call.stale ? "old" : sample ? "sample" : "live";
  const tone = { old: "down", sample: "wait", live: "up" }[state];
  const today = m.buyDay === m.todayIso;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 sm:px-8 sm:pt-10 lg:px-12">
      <div className="grid gap-6">
        <HeroTitle line1={t("desk.hero1")} line2={t("desk.hero2")} sub={t("desk.heroSub")} />
        <div className="grid gap-2.5 md:flex md:flex-wrap md:items-center md:justify-between md:gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={tone}>
              <span className="relative inline-flex size-1.5" aria-hidden="true">
                {state === "live" && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />}
                <span className="relative inline-block size-1.5 rounded-full bg-current" />
              </span>
              {state === "old" ? t("desk.old", { count: call.age }) : t(state === "sample" ? "desk.sample" : "desk.live")}
            </Chip>
            <Chip tone="neutral"><span className="text-ink-3">{rich(t, "desk.market", { date: <span className="text-ink">{noYear(m.fresh.marketDate)}</span> })}</span></Chip>
            <SimBadge />
            <InfoTip label={t("desk.paperWhat")} align="start">{t("desk.paperInfo")}</InfoTip>
          </div>
          <button type="button" onClick={() => openTo("verdicts#this-week")}
            className="group flex min-h-[48px] w-full items-center gap-3 rounded-tile border border-line-2 bg-surface-2/80 px-3.5 text-start transition-colors hover:border-line-3 md:w-auto md:min-w-[400px]">
            <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">{t("desk.weekly")}</span>
            <span className="font-num shrink-0 text-[12px] font-bold text-ink uppercase">{today ? t("desk.weeklyToday") : t("desk.weeklyNext", { day: noYear(m.buyDay) })}</span>
            <span aria-hidden="true" className="text-ink-3 transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- panel */

/** An agent's panel: the kit's Panel with "AGENT n · NAME", its one-line job, a freshness chip and the (i) text. */
function AgentPanel({ agent, state = null, date = null, wide = false, active = false, infoVars, connectors = null, className = "", children, ...rest }) {
  const t = strings(dict);
  return (
    <Panel id={`desk-${agent}`} agent={NUM_AGENT[agent]} title={t(`desk.a.${agent}`)} sub={t(`desk.tag.${agent}`)} active={active}
      className={`${wide ? "md:col-span-2" : ""} ${className}`} info={t(`desk.info.${agent}`, infoVars)} infoLabel={t("desk.info")}
      badge={state && <FreshChip state={state} date={date} />} {...rest}>
      {connectors}
      {children}
    </Panel>
  );
}

function FreshChip({ state, date }) {
  const t = strings(dict);
  return (
    <Chip tone="neutral" title={t(`desk.state.${state}`)}>
      <StepMark state={STEP[state]} label={t(`desk.state.${state}`)} />
      <span className="text-ink-2">{dayMonth(date)}</span>
    </Chip>
  );
}

/** "R:R 0.2 < 2": a reason in short. */
function whyText(t, x = {}) {
  const v = {
    rr: () => t("desk.why.rr", { rr: rrText(x.rr, x.min), min: x.min }),
    stop: () => t("desk.why.stop", { atr: x.atr?.toFixed(1), max: x.max }),
    stretch: () => t("desk.why.stretch", { pct: pct(x.pct), max: x.max }),
    confirm: () => t("desk.why.confirm", { n: x.n }),
    reports: () => t("desk.why.reports", { n: x.n, total: x.total }),
  }[x.id];
  return v ? v() : t(`desk.why.${x.id}`);
}

/** "Risk: R:R 0.2 < 2": who decided and why. */
const reasonText = (t, r) => `${t(`desk.by.${r.by}`)}: ${whyText(t, r.reason)}`;

/* ----------------------------------------------------------------- boss */

function BossPanel({ m, go }) {
  const t = strings(dict);
  const [all, setAll] = useState(false);
  const [only, setOnly] = useState(null);
  const total = REPORTERS.length;
  const { received } = m.fresh;
  const full = received === total;
  const rows = only ? m.calls.filter((r) => r.call === only) : m.calls;
  return (
    <Panel id="desk-boss" hero className="md:col-span-2" info={t("desk.info.boss")} infoLabel={t("desk.info")}
      badge={<FreshChip state={full ? "fresh" : "stale"} date={m.fresh.marketDate} />}
      head={<HeroTitle as="h2" id="desk-boss-h" size="sm" line1={`${t("desk.agent", { n: NUM_AGENT.boss })} · ${t("desk.a.boss")}`} line2={t("desk.boss.line2")} sub={t("desk.boss.sub")} />}>
      <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-8">
        <p className="flex items-end gap-3">
          <span className={`font-num text-[64px] leading-[0.8] font-bold tracking-[-0.05em] sm:text-[80px] ${full ? "text-desk text-glow" : "text-wait"}`}>
            {received}<span className="text-ink-3">/</span>{total}
          </span>
          <span className="spaced pb-1 leading-tight text-ink-2">{t("desk.received")}</span>
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label={t("desk.reportsShort", { n: received, total })}>
          {REPORTERS.map((a) => (
            <li key={a}>
              <Chip tone="neutral" className={m.fresh[a].state === "fresh" ? "text-ink" : ""}>
                <StepMark state={STEP[m.fresh[a].state]} label={t(`desk.state.${m.fresh[a].state}`)} />
                {t(`desk.a.${a}`)}
                {m.fresh[a].state !== "fresh" && <span className="font-medium tracking-normal text-ink-3 normal-case">{a === "strategy" && m.run?.date && m.run.date < (m.fresh.marketDate ?? "") ? t("desk.brainFrom", { date: dayMonth(m.run.date) }) : dayMonth(m.fresh[a].date)}</span>}
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label={t("desk.a.boss")}>
        {["buy", "wait", "reject"].map((c) => {
          const n = m.counts[c];
          const on = only === c;
          return (
            <button key={c} type="button" disabled={!n} aria-pressed={on} onClick={() => { setOnly(on ? null : c); setAll(false); }}
              aria-label={t("desk.filter", { call: t(`desk.call.${c}`) })}
              className={`relative min-w-0 overflow-hidden rounded-tile border px-2 pt-3 pb-2.5 text-center transition-[border-color,box-shadow,background-color] sm:px-3 sm:pt-4 ${n ? CALL_TILE[c] : "border-line bg-surface-2/60 text-ink-3"} ${on ? `glow-${c === "buy" ? "up" : c === "reject" ? "down" : "wait"}` : ""}`}>
              {n > 0 && <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${CALL_BAR[c]}`} />}
              <span className="font-num block text-[34px] leading-none font-bold tracking-[-0.04em] sm:text-[44px]">{n}</span>
              <span className="headline mt-2 block truncate text-[14px] tracking-[0.08em] sm:text-[17px]">{t(`desk.call.${c}`)}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-1.5 md:grid-cols-2 md:gap-2">
        {rows.map((r, i) => (
          <li key={r.ticker} className={!all && i >= BOSS_ROWS_PHONE ? "hidden md:block" : ""}>
            <button type="button" onClick={() => go(`stock/${r.ticker}`)}
              className="group flex min-h-[56px] w-full items-center gap-3 rounded-tile border border-line bg-surface-2/50 px-3 py-2 text-start transition-colors hover:border-line-3 hover:bg-surface-2">
              <span aria-hidden="true" className={`h-8 w-[3px] shrink-0 rounded-full ${CALL_BAR[r.call]}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="font-num text-[14.5px] font-bold text-ink">{r.ticker}</span>
                  <span className="truncate text-[12.5px] text-ink-3">{r.name}</span>
                </span>
                <span className="mt-0.5 block truncate font-num text-[11.5px] text-ink-2">{reasonText(t, r)}</span>
              </span>
              <AgentMarks r={r} />
              <CallChip call={r.call} label={t(`desk.call.${r.call}`)} className="min-w-[96px]" />
            </button>
          </li>
        ))}
      </ul>
      {rows.length > BOSS_ROWS_PHONE && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
          className="mt-2 min-h-[44px] w-full rounded-tile border border-line-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase hover:text-ink md:hidden">
          {all ? t("desk.showFewer") : t("desk.showAll", { n: rows.length })}
        </button>
      )}
    </Panel>
  );
}

/** Three tiny marks: the brain's lean (Strategy), Execution's confirmations, Risk's pass or fail. */
function AgentMarks({ r }) {
  const t = strings(dict);
  const lean = { up: "text-up", down: "text-down", flat: "text-ink-2" }[r.lean] ?? "text-ink-3";
  const ex = { enter: "text-up", wait: "text-wait", skip: "text-down" }[r.exec.call];
  return (
    <span className="hidden shrink-0 items-center gap-2.5 font-num text-[11px] font-bold min-[400px]:flex" aria-hidden="true">
      <span title={t("desk.a.strategy")} className="flex items-center gap-0.5"><span className="text-ink-3">S</span>
        <span className={lean}>{r.lean === "up" ? "▲" : r.lean === "down" ? "▼" : r.lean === "flat" ? "◆" : "–"}</span></span>
      <span title={t("desk.a.execution")} className="flex items-center gap-0.5"><span className="text-ink-3">E</span><span className={ex}>{r.exec.n}</span></span>
      <span title={t("desk.a.risk")} className="flex items-center gap-0.5"><span className="text-ink-3">R</span>
        <span className={r.risk.pass ? "text-up" : "text-down"}>{r.risk.pass ? <CheckIcon className="size-2.5" /> : <CrossIcon className="size-2.5" />}</span></span>
    </span>
  );
}

/* ------------------------------------------------------------- research */

function ResearchPanel({ m, go, active }) {
  const t = strings(dict);
  const [sort, setSort] = useState({ key: "score", dir: "desc" });
  const rows = useMemo(() => sortScanner(m.scan, sort.key, sort.dir), [m.scan, sort]);
  const by = (key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === "desc" ? "asc" : "desc") : key === "ticker" ? "asc" : "desc" }));
  const top = (k) => sortScanner(m.scan.filter((r) => typeof r[k] === "number"), k, "desc").slice(0, BAR_N).map((r) => r[k]);
  const lead = (k) => m.tiles[k];
  const momSpark = m.scan.find((r) => r.ticker === lead("momentum")?.ticker)?.spark;
  const tile = (id, x, value, extra) => (
    <StatTile key={id} label={t(`desk.tile.${id}`)} value={x ? value : "–"} sub={x?.ticker} note={extra.note} disabled={!x}
      onClick={() => x && go(`stock/${x.ticker}`)} {...extra} />
  );
  const cols = [
    { key: "ticker", label: t("desk.col.name"), sortable: true, firstDir: "asc", cell: (r) => (
      <span className="flex items-center gap-2">
        {r.unusual && <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-desk font-num text-[10px] font-bold text-bg shadow-[0_0_10px_var(--desk-glow)]" title={t("desk.unusual")} aria-label={t("desk.unusual")}>!</span>}
        <span className="min-w-0">
          <span className="block font-num text-[13.5px] font-bold text-ink">{r.ticker}</span>
          <span className="block max-w-[110px] truncate text-[11px] leading-tight text-ink-3">{r.name}</span>
        </span>
      </span>
    ) },
    { key: "spark", label: t("desk.col.spark"), cell: (r) => <MiniSpark values={r.spark} w={72} h={24} /> },
    { key: "day", label: t("desk.col.day"), sortable: true, num: true, className: (r) => `${toneOf(r.day)} ${r.unusual ? "font-bold" : ""}`, cell: (r) => pct(r.day) },
    { key: "d20", label: t("desk.col.d20"), sortable: true, num: true, className: (r) => toneOf(r.d20), cell: (r) => pct(r.d20) },
    { key: "volX", label: t("desk.col.volx"), sortable: true, num: true, className: (r) => (r.volX != null && r.volX >= 1.5 ? "font-bold text-ink" : "text-ink-2"), cell: (r) => (r.volX != null ? `${r.volX.toFixed(2)}×` : "–") },
    { key: "vol", label: t("desk.col.vol"), sortable: true, num: true, className: "text-ink-2", cell: (r) => (r.vol != null ? `${r.vol.toFixed(1)}%` : "–") },
    { key: "mom", label: t("desk.col.mom"), sortable: true, num: true, className: (r) => toneOf(r.mom), cell: (r) => pct(r.mom) },
    { key: "score", label: t("desk.col.score"), sortable: true, num: true, className: (r) => `font-bold ${r.score > 0 ? "text-up" : r.score < 0 ? "text-down" : "text-ink-2"}`, cell: (r) => signed(r.score) },
  ];
  return (
    <AgentPanel agent="research" wide active={active} state={m.fresh.research.state} date={m.fresh.research.date} infoVars={{ bench: m.bench }}
      connectors={<Connector shape="v" className="bottom-full left-1/2 hidden h-10 w-3 -translate-x-1/2 md:block" />}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tile("volume", lead("volume"), lead("volume") && `${lead("volume").value.toFixed(2)}×`,
          { delta: lead("volume") ? (lead("volume").value - 1) * 100 : null, deltaD: 0, bars: top("volX"), note: t("desk.tile.volumeNote") })}
        {tile("volatility", lead("volatility"), lead("volatility") && `${lead("volatility").value.toFixed(1)}%`,
          { bars: top("vol"), note: t("desk.tile.volatilityNote") })}
        {tile("momentum", lead("momentum"), lead("momentum") && <span className={toneOf(lead("momentum").value)}>{pct(lead("momentum").value)}</span>,
          { spark: momSpark, note: t("desk.tile.momentumNote", { bench: m.bench }) })}
      </div>
      <div className="mt-4">
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.ticker} sort={sort} onSort={by} minWidth={680}
          onRowClick={(r) => go(`stock/${r.ticker}`)} rowLabel={(r) => r.ticker} rowTone={(r) => (r.unusual ? "brand" : null)}
          scrollClassName="md:max-h-[560px] md:overflow-y-auto" caption={t("desk.a.research")} />
      </div>
    </AgentPanel>
  );
}

/* ----------------------------------------------------------------- news */

function NewsPanel({ m, openTo, active }) {
  const t = strings(dict);
  const { cards, counts } = m.news;
  const counters = [["up", "border-up/40 bg-up/8 text-up"], ["down", "border-down/40 bg-down/8 text-down"], ["watch", "border-wait/40 bg-wait/8 text-wait"]];
  const kindTone = { up: "text-up", down: "text-down", filing: "text-wait", results: "text-wait" };
  return (
    <AgentPanel agent="news" active={active} state={m.fresh.news.state} date={m.fresh.news.date}
      connectors={<>
        <Connector shape="v" className="bottom-full left-1/2 hidden h-10 w-3 -translate-x-1/2 md:block" />
        <Connector shape="h" className="top-1/2 left-full hidden h-3 w-8 -translate-y-1/2 md:block" />
      </>}>
      <div className="grid grid-cols-3 gap-2">
        {counters.map(([k, tone]) => (
          <div key={k} className={`tile px-2 py-2.5 text-center ${counts[k] ? tone : "text-ink-3"}`}>
            <div className="font-num text-[24px] leading-none font-bold">{counts[k]}</div>
            <div className="micro mt-1.5 text-current">{t(`desk.news.${k}`)}</div>
          </div>
        ))}
      </div>
      {cards.length ? (
        <ul className="mt-3 grid gap-1.5">
          {cards.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => openTo(c.to)}
                className="flex min-h-[56px] w-full items-start gap-3 rounded-tile border border-line bg-surface-2/50 px-3 py-2.5 text-start transition-colors hover:border-line-3 hover:bg-surface-2">
                <span className="w-[54px] shrink-0 pt-0.5">
                  <span className="block font-num text-[11.5px] text-ink-2">{dayMonth(c.date)}</span>
                  <span className={`micro block text-[9.5px] ${kindTone[c.kind]}`}>{t(`desk.news.kind.${c.kind}`)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-num text-[13px] font-bold text-ink">{c.ticker}</span>{" "}
                  <span className="text-[13.5px] leading-snug text-ink">{headline(t, c)}</span>
                  {(c.kind === "up" || c.kind === "down") && <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">{NOT_A_TRADE}</span>}
                </span>
                <Delta value={c.move} d={1} className="shrink-0 pt-0.5 text-[12.5px]" />
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState compact className="mt-3" title={t("desk.news.none")} />}
    </AgentPanel>
  );
}

function headline(t, c) {
  if (c.kind === "results") return t(c.confirmed ? "desk.news.results" : "desk.news.expected", { date: noYear(c.date) });
  if (c.kind === "filing") return `${c.headline}${c.form ? ` · ${c.form}` : ""}`;
  return c.headline;
}

/* ------------------------------------------------------------- strategy */

function StrategyPanel({ m, openTo, active }) {
  const t = strings(dict);
  const min = m.limits.minRR;
  const stance = { up: ["desk.stance.up", "up"], down: ["desk.stance.down", "down"], flat: ["desk.stance.flat", "neutral"] };
  const cols = [
    { key: "ticker", label: t("desk.col.name"), cell: (r) => <span className="font-num text-[13.5px] font-bold text-ink">{r.ticker}</span> },
    { key: "brain", label: t("desk.col.brain"), align: "start", cell: (r) => {
      const s = stance[r.lean];
      return s ? <Chip tone={s[1]} className="min-h-[22px] px-1.5 text-[10px]">{t(s[0])}</Chip> : <span className="text-ink-3">{t("desk.stance.none")}</span>;
    } },
    { key: "entry", label: t("desk.col.entry"), num: true, className: "text-ink-2", cell: (r) => pct(r.entry) },
    { key: "stop", label: t("desk.col.stop"), num: true, className: "text-down", cell: (r) => pct(-r.plan.stop_pct) },
    { key: "tp1", label: t("desk.col.tp1"), num: true, className: "text-up", cell: (r) => pct(r.plan.tp1_pct) },
    { key: "tp2", label: t("desk.col.tp2"), num: true, className: "text-up", cell: (r) => pct(r.plan.tp2_pct) },
    { key: "rr", label: t("desk.col.rr"), num: true, className: (r) => `font-bold ${r.fits ? "text-up" : "text-ink"}`, cell: (r) => rrText(r.rr, min) },
    { key: "fits", label: t("desk.col.fits", { min: min ?? 2 }), align: "center", cell: (r) => (
      <span className={`inline-flex ${r.fits ? "text-up" : "text-down"}`} role="img" aria-label={t(r.fits ? "desk.fits.yes" : "desk.fits.no")}>
        {r.fits ? <CheckIcon className="size-3.5" /> : <CrossIcon className="size-3.5" />}
      </span>
    ) },
  ];
  return (
    <AgentPanel agent="strategy" active={active} state={m.fresh.strategy.state} date={m.fresh.strategy.date}>
      {m.strategy.length ? (
        <div className="-mt-4 sm:-mt-5">
          <DataTable columns={cols} rows={m.strategy} rowKey={(r) => r.ticker} minWidth={540}
            onRowClick={(r) => openTo(`stock/${r.ticker}#checklist`)} rowLabel={(r) => r.ticker} caption={t("desk.a.strategy")} />
        </div>
      ) : <EmptyState compact title={t("desk.strategy.none")} />}
    </AgentPanel>
  );
}

/* ------------------------------------------------------------ execution */

function ExecutionPanel({ m, data, go, active }) {
  const t = strings(dict);
  return (
    <AgentPanel agent="execution" active={active} state={m.fresh.execution.state} date={m.fresh.execution.date}
      connectors={<>
        <Connector shape="down-left" className="bottom-full left-1/2 hidden h-10 w-[calc(100%+2rem)] md:block" />
        <Connector shape="h" className="top-1/2 left-full hidden h-3 w-8 -translate-y-1/2 md:block" />
      </>}>
      {m.candidates.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:gap-3">
          {m.candidates.map((r) => <li key={r.ticker} className="min-w-0"><ExecCard r={r} manifest={data.manifest} go={go} /></li>)}
        </ul>
      ) : <EmptyState compact title={t("desk.exec.none")} />}
    </AgentPanel>
  );
}

function ExecCard({ r, manifest, go }) {
  const t = strings(dict);
  const conf = [["level", r.exec.level], ["volume", r.exec.volume], ["close", r.exec.close]];
  return (
    <button type="button" onClick={() => go(`stock/${r.ticker}`)} aria-label={`${r.ticker}: ${t("desk.exec.now", { call: t(`desk.exec.${r.exec.call}`) })}`}
      className="tile flex h-full w-full flex-col p-2.5 text-start transition-colors hover:border-line-3 sm:p-3">
      <span className="flex items-baseline gap-1.5 px-0.5">
        <span className="font-num text-[14px] font-bold text-ink">{r.ticker}</span>
        <span className="min-w-0 truncate text-[11px] text-ink-3">{r.name}</span>
      </span>
      <MiniCandles ticker={r.ticker} name={r.name} manifest={manifest} />
      <span className="mt-2 grid gap-1 px-0.5">
        {conf.map(([k, ok]) => (
          <span key={k} className="micro flex items-center justify-between">
            <span className="text-ink-2">{t(`desk.conf.${k}`)}</span>
            <span className={ok ? "text-up" : "text-down"}>{ok ? <CheckIcon /> : <CrossIcon />}</span>
          </span>
        ))}
      </span>
      <span className="mt-2.5 grid grid-cols-3 gap-1" aria-hidden="true">
        {["enter", "wait", "skip"].map((c) => (
          <CallButton key={c} call={c} size="sm" active={r.exec.call === c} label={t(`desk.exec.${c}`)} className="h-10 min-w-0 px-0.5 text-[13px] sm:text-[15px]" />
        ))}
      </span>
    </button>
  );
}

const MINI_DAYS = 30;
const MINI_H = 78;

/** About a month of daily candles (percent from the last close; no axis, no numbers). */
function MiniCandles({ ticker, name, manifest }) {
  const t = strings(dict);
  const [ref, w] = useBoxWidth();
  const [win, setWin] = useState(undefined); // undefined while loading, null when there is no chart
  useEffect(() => {
    let live = true;
    loadCandles(manifest, ticker).then((doc) => live && setWin(miniWindow(doc, MINI_DAYS)), () => live && setWin(null));
    return () => { live = false; };
  }, [manifest, ticker]);
  const g = useMemo(() => (win && w ? miniGeometry(win, w, MINI_H, { padX: 3, padY: 6, maxBody: 5 }) : null), [win, w]);
  return (
    <span ref={ref} className="mt-2 block" style={{ height: MINI_H }}>
      {g ? (
        <svg width={w} height={MINI_H} viewBox={`0 0 ${w} ${MINI_H}`} role="img" aria-label={t("desk.exec.chart", { name, n: win.n })} className="block">
          {g.candles.map((k) => <CandleMark key={k.i} g={k} />)}
        </svg>
      ) : (
        <span className={`grid h-full place-items-center rounded-[8px] font-mono text-[10px] tracking-[0.1em] text-ink-3 uppercase ${win === undefined ? "skeleton" : "bg-surface-3"}`}>
          {win === null ? t("desk.exec.noChart") : ""}
        </span>
      )}
    </span>
  );
}

/* ----------------------------------------------------------------- risk */

function RiskPanel({ m, go, active }) {
  const t = strings(dict);
  const [all, setAll] = useState(false);
  const L = m.limits;
  const limits = [
    L.noBorrowing && ["leverage", t("desk.lim.leverageV")],
    L.slotPct != null && ["slot", t("desk.lim.slotV", { pct: L.slotPct })],
    L.potPct != null && ["pot", t("desk.lim.potV", { pct: L.potPct })],
    L.stopAtrMax != null && ["stop", t("desk.lim.stopV", { n: L.stopAtrMax })],
    L.stretchPct != null && ["stretch", t("desk.lim.stretchV", { pct: L.stretchPct })],
    L.minRR != null && ["rr", t("desk.lim.rrV", { n: L.minRR })],
  ].filter(Boolean);
  const rejected = m.calls.filter((r) => !r.risk.pass);
  const shown = all ? rejected : rejected.slice(0, TICKETS);
  return (
    <AgentPanel agent="risk" active={active} state={m.fresh.risk.state} date={m.fresh.risk.date}>
      <div className="tile overflow-hidden">
        <p className="micro border-b border-line px-3 py-2.5 text-desk">{t("desk.lim.title")}</p>
        <dl className="divide-y divide-line">
          {limits.map(([id, v]) => (
            <div key={id} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <dt className="text-[12.5px] text-ink-2">{t(`desk.lim.${id}`)}</dt>
              <dd className="font-num text-end text-[12.5px] font-bold text-ink">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-[12.5px] text-ink-2">{t("desk.lim.earned")} <span className="text-ink-3">· {t("desk.lim.earnedV")}</span></dt>
            <dd className="shrink-0"><Chip tone={L.earned ? "up" : "down"}>{t(L.earned ? "desk.lim.yes" : "desk.lim.notYet")}</Chip></dd>
          </div>
        </dl>
      </div>

      {rejected.length ? (
        <>
          <p className="micro mt-4">{t("desk.risk.count", { count: rejected.length })}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {shown.map((r) => (
              <li key={r.ticker} className="min-w-0">
                <button type="button" onClick={() => go(`stock/${r.ticker}`)}
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-tile border border-dashed border-line-3 bg-surface-2/60 p-3 text-start transition-colors hover:border-ink-3">
                  <span className="micro">{t("desk.ticket")}</span>
                  <span className="font-num mt-0.5 text-[17px] font-bold text-ink">{r.ticker}</span>
                  {r.plan && (
                    <span className="mt-2 grid grid-cols-3 gap-1 font-num text-[11px]">
                      <span><span className="micro block text-[9.5px]">{t("desk.col.stop")}</span><span className="text-down">{pct(-r.plan.stop_pct)}</span></span>
                      <span><span className="micro block text-[9.5px]">{t("desk.col.tp1")}</span><span className="text-up">{pct(r.plan.tp1_pct)}</span></span>
                      <span><span className="micro block text-[9.5px]">{t("desk.col.rr")}</span><span className="text-ink">{rrText(r.plan.rr_tp1, m.limits.minRR)}</span></span>
                    </span>
                  )}
                  <span className="mt-2 grid gap-1">
                    {r.risk.reasons.map((x) => (
                      <span key={x.id} className="flex items-start gap-1.5 font-num text-[11px] leading-snug text-down"><CrossIcon className="mt-[2px] size-2.5" />{whyText(t, x)}</span>
                    ))}
                  </span>
                  <Stamp kind="rejected" size="sm" className="pointer-events-none absolute end-2.5 top-3">{t("desk.rejected")}</Stamp>
                </button>
              </li>
            ))}
          </ul>
          {rejected.length > TICKETS && (
            <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
              className="mt-2 min-h-[44px] w-full rounded-tile border border-line-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase hover:text-ink">
              {all ? t("desk.showFewer") : t("desk.showAll", { n: rejected.length })}
            </button>
          )}
        </>
      ) : <EmptyState compact className="mt-4" title={t("desk.risk.none")} />}
    </AgentPanel>
  );
}
