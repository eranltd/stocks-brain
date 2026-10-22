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
import { todayCall } from "../tabs/Details.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

/*
 * The Desk: Home's default view, a trading-platform look over the same published data. Six agents in a pipeline, each a
 * panel: the Boss's final call first, then Research, News, Strategy, Execution and Risk. Every call is made by plain code
 * in lib/desk.js (no AI decides anything here) and is pretend money: BUY is always "BUY (paper)", and the PAPER badge
 * stays on screen in the sticky pipeline strip. Percent changes only, never a price or raw volume.
 */

const NUM_AGENT = Object.fromEntries(AGENTS.map((a, i) => [a, i + 1]));
const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink-2" };
const CALL_TONE = {
  buy: "border-accent/60 bg-accent/12 text-accent",
  wait: "border-wait/60 bg-wait/12 text-wait",
  reject: "border-down/60 bg-down/12 text-down",
};
const CALL_SOLID = { buy: "bg-accent text-bg border-accent", wait: "bg-wait text-bg border-wait", reject: "bg-down text-bg border-down" };
const EXEC_SOLID = { enter: CALL_SOLID.buy, wait: CALL_SOLID.wait, skip: CALL_SOLID.reject };
const STATE_TONE = { fresh: "text-accent", stale: "text-wait", missing: "text-down" };
const STATE_MARK = { fresh: "✓", stale: "◷", missing: "✕" };
const BOSS_ROWS_PHONE = 8;
const TICKETS = 4;

/** "Wed, 21 Oct": a market day without its year. */
const noYear = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "–");
/** "21 Oct". */
const dayMonth = (iso) => (iso ? noYear(iso).replace(/^\w+,\s/, "") : "–");
const pct = (v, d = 1) => (typeof v === "number" && Number.isFinite(v) ? fmtPct(v, d) : "–");
const toneOf = (v, d = 1) => TONE_TEXT[signTone(v, d)] ?? "text-ink-2";
/** "+3", "−2", "0": the checklist's net score with a true minus sign. */
const signed = (n) => (n == null ? "–" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`);

/** Everything the panels show, from the loaded data (main list only). */
function useDesk(data) {
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

  return (
    <div className="pb-24">
      <h1 className="sr-only">{t("desk.title")}</h1>
      <StatusBar data={data} m={m} openTo={open} />
      <PipelineStrip ref={strip} top={headerH} active={active} fresh={m.fresh} onJump={jump} reduced={reduced} />
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-4 sm:px-8 lg:px-12">
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <BossPanel m={m} go={go} />
          <ResearchPanel m={m} go={go} />
          <NewsPanel m={m} openTo={open} />
          <StrategyPanel m={m} openTo={open} />
          <ExecutionPanel m={m} data={data} go={go} />
          <RiskPanel m={m} go={go} />
        </div>
        <NotAdvice compact className="mx-auto mt-10 text-center" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- top bar */

function StatusBar({ data, m, openTo }) {
  const t = strings(dict);
  const call = todayCall(data);
  const sample = data.sample || Boolean(data.market?.sample);
  const state = call.stale ? "old" : sample ? "sample" : "live";
  const tone = { old: "border-down/60 text-down", sample: "border-wait/60 text-wait", live: "border-accent/50 text-accent" }[state];
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-3 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="desk-chip border-line-2 text-ink-3">{rich(t, "desk.market", { date: <span className="text-ink">{noYear(m.fresh.marketDate)}</span> })}</span>
        <span className={`desk-chip ${tone}`}>
          <span className="relative inline-flex size-1.5" aria-hidden="true">
            {state === "live" && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />}
            <span className="relative inline-block size-1.5 rounded-full bg-current" />
          </span>
          {state === "old" ? t("desk.old", { count: call.age }) : t(state === "sample" ? "desk.sample" : "desk.live")}
        </span>
        <span className="desk-chip border-desk/70 bg-desk/10 text-desk">{t("desk.paper")}</span>
      </div>
      <button type="button" onClick={() => openTo("verdicts#this-week")}
        className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-line-2 bg-surface px-3 text-start text-[13.5px] leading-snug text-ink transition-colors hover:border-ink-3">
        <span className="size-2 shrink-0 rounded-full bg-ink-2" aria-hidden="true" />
        <span className="min-w-0 flex-1">{m.buyDay === m.todayIso ? t("desk.realToday") : t("desk.real", { day: noYear(m.buyDay) })}</span>
        <span aria-hidden="true" className="text-ink-3">→</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------- pipeline strip */

function StateMark({ state, className = "" }) {
  const t = strings(dict);
  return <span className={`font-mono font-bold ${STATE_TONE[state]} ${className}`} role="img" aria-label={t(`desk.state.${state}`)}>{STATE_MARK[state]}</span>;
}

const PipelineStrip = ({ ref, top, active, fresh, onJump, reduced }) => {
  const t = strings(dict);
  const rail = useRef(null);
  // Keep the lit step in view on a narrow screen (the strip scrolls sideways inside itself, never the page).
  useEffect(() => {
    const el = rail.current?.querySelector(`[data-agent="${active}"]`);
    const box = rail.current;
    if (!el || !box) return;
    const l = el.offsetLeft - box.offsetLeft, r = l + el.offsetWidth;
    if (l < box.scrollLeft || r > box.scrollLeft + box.clientWidth) box.scrollTo({ left: Math.max(0, l - 24), behavior: reduced ? "auto" : "smooth" });
  }, [active, reduced]);
  const bossState = fresh.received === REPORTERS.length ? "fresh" : "stale";
  return (
    <nav ref={ref} aria-label={t("desk.pipeline")} style={{ top }}
      className="sticky z-30 mt-3 border-y border-line-2 bg-bg/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1280px] items-stretch gap-2 px-4 sm:px-8 lg:px-12">
        <span className="desk-chip my-2 shrink-0 self-center border-desk/70 bg-desk/10 text-desk" title={t("desk.paper")}>{t("desk.paperShort")}</span>
        <ol ref={rail} className="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto">
          {AGENTS.map((a, i) => {
            const on = a === active;
            const state = a === "boss" ? bossState : fresh[a].state;
            return (
              <li key={a} className="flex shrink-0 items-center">
                <button type="button" data-agent={a} onClick={() => onJump(a)} aria-current={on ? "step" : undefined}
                  className={`flex min-h-[44px] items-center gap-1.5 border-b-2 px-2 text-[11.5px] font-extrabold uppercase tracking-[0.12em] transition-colors ${on ? "border-desk text-desk" : "border-transparent text-ink-2 hover:text-ink"}`}>
                  <StateMark state={state} className="text-[11px]" />
                  {t(`desk.a.${a}`)}
                </button>
                {i < AGENTS.length - 1 && <span aria-hidden="true" className="px-0.5 text-[11px] text-ink-3">→</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
};

/* ---------------------------------------------------------------- panel */

function Panel({ agent, state = null, date = null, wide = false, infoVars, children }) {
  const t = strings(dict);
  const [info, setInfo] = useState(false);
  const h = `desk-${agent}-h`, tip = `desk-${agent}-info`;
  return (
    <section id={`desk-${agent}`} aria-labelledby={h} className={`desk-panel min-w-0 ${wide ? "md:col-span-2" : ""} ${agent === "boss" ? "border-desk/60" : ""}`}>
      <div className="flex items-start gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1 pt-1">
          <h2 id={h} tabIndex={-1} className="desk-title outline-none">{t("desk.agent", { n: NUM_AGENT[agent] })} · {t(`desk.a.${agent}`)}</h2>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{t(`desk.tag.${agent}`)}</p>
        </div>
        {state && (
          <span className={`desk-chip mt-0.5 shrink-0 border-line-2 ${STATE_TONE[state]}`} title={t(`desk.state.${state}`)}>
            <span aria-hidden="true">{STATE_MARK[state]}</span>
            <span className="sr-only">{t(`desk.state.${state}`)}</span>
            <span className="text-ink-2">{dayMonth(date)}</span>
          </span>
        )}
        <button type="button" aria-expanded={info} aria-controls={tip} aria-label={t("desk.info")} onClick={() => setInfo((v) => !v)}
          className="-my-1.5 -me-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink">
          <span className={`grid size-6 place-items-center rounded-full border font-serif text-[13px] italic leading-none ${info ? "border-desk text-desk" : "border-line-2"}`} aria-hidden="true">i</span>
        </button>
      </div>
      {info && <p id={tip} className="border-b border-line px-3 py-2 text-[13px] leading-snug text-ink-2 sm:px-4">{t(`desk.info.${agent}`, infoVars)}</p>}
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function CallChip({ call, className = "" }) {
  const t = strings(dict);
  return <span className={`desk-chip ${CALL_TONE[call]} ${className}`}>{t(`desk.call.${call}`)}</span>;
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
  const total = REPORTERS.length;
  const { received } = m.fresh;
  return (
    <Panel agent="boss" wide state={received === total ? "fresh" : "stale"} date={m.fresh.marketDate}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="flex items-baseline gap-2">
          <span className={`desk-num text-[34px] leading-none font-bold ${received === total ? "text-desk" : "text-wait"}`}>{received}/{total}</span>
          <span className="desk-label text-ink-2">{t("desk.received")}</span>
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label={t("desk.reportsShort", { n: received, total })}>
          {REPORTERS.map((a) => (
            <li key={a} className={`desk-chip border-line-2 ${m.fresh[a].state === "fresh" ? "text-ink" : "text-ink-2"}`}>
              <StateMark state={m.fresh[a].state} />
              {t(`desk.a.${a}`)}
              {m.fresh[a].state !== "fresh" && <span className="font-medium normal-case tracking-normal text-ink-3">{a === "strategy" && m.run?.date && m.run.date < (m.fresh.marketDate ?? "") ? t("desk.brainFrom", { date: dayMonth(m.run.date) }) : dayMonth(m.fresh[a].date)}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {["buy", "wait", "reject"].map((c) => (
          <div key={c} className={`rounded-lg border px-2 py-2.5 text-center ${m.counts[c] ? CALL_TONE[c] : "border-line-2 text-ink-3"}`}>
            <div className="desk-num text-[26px] leading-none font-bold">{m.counts[c]}</div>
            <div className="mt-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em]">{t(`desk.call.${c}`)}</div>
          </div>
        ))}
      </div>

      <ul className="mt-3 grid gap-1.5 md:grid-cols-2">
        {m.calls.map((r, i) => (
          <li key={r.ticker} className={!all && i >= BOSS_ROWS_PHONE ? "hidden md:block" : ""}>
            <button type="button" onClick={() => go(`stock/${r.ticker}`)}
              className="flex min-h-[52px] w-full items-center gap-2.5 rounded-lg border border-line px-3 py-1.5 text-start transition-colors hover:border-ink-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[14.5px] font-bold text-ink">{r.ticker}</span>
                  <span className="truncate text-[12.5px] text-ink-3">{r.name}</span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11.5px] text-ink-2">{reasonText(t, r)}</span>
              </span>
              <AgentMarks r={r} />
              <CallChip call={r.call} className="min-w-[94px] justify-center py-1.5" />
            </button>
          </li>
        ))}
      </ul>
      {m.calls.length > BOSS_ROWS_PHONE && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-line-2 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:text-ink md:hidden">
          {all ? t("desk.showFewer") : t("desk.showAll", { n: m.calls.length })}
        </button>
      )}
    </Panel>
  );
}

/** Three tiny marks: the brain's lean (Strategy), Execution's confirmations, Risk's pass or fail. */
function AgentMarks({ r }) {
  const t = strings(dict);
  const lean = { up: ["▲", "text-accent"], down: ["▼", "text-down"], flat: ["◆", "text-ink-2"] }[r.lean] ?? ["–", "text-ink-3"];
  const ex = { enter: "text-accent", wait: "text-wait", skip: "text-down" }[r.exec.call];
  return (
    <span className="hidden shrink-0 items-center gap-2 font-mono text-[11px] font-bold min-[400px]:flex" aria-hidden="true">
      <span title={t("desk.a.strategy")}><span className="text-ink-3">S</span><span className={lean[1]}>{lean[0]}</span></span>
      <span title={t("desk.a.execution")}><span className="text-ink-3">E</span><span className={ex}>{r.exec.n}</span></span>
      <span title={t("desk.a.risk")}><span className="text-ink-3">R</span><span className={r.risk.pass ? "text-accent" : "text-down"}>{r.risk.pass ? "✓" : "✕"}</span></span>
    </span>
  );
}

/* ------------------------------------------------------------- research */

const COLS = [
  { key: "ticker", label: "desk.col.name", align: "start" },
  { key: null, label: "desk.col.spark" },
  { key: "day", label: "desk.col.day" },
  { key: "d20", label: "desk.col.d20" },
  { key: "volX", label: "desk.col.volx" },
  { key: "vol", label: "desk.col.vol" },
  { key: "mom", label: "desk.col.mom" },
  { key: "score", label: "desk.col.score" },
];

function ResearchPanel({ m, go }) {
  const t = strings(dict);
  const [sort, setSort] = useState({ key: "score", dir: "desc" });
  const rows = useMemo(() => sortScanner(m.scan, sort.key, sort.dir), [m.scan, sort]);
  const by = (key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === "desc" ? "asc" : "desc") : key === "ticker" ? "asc" : "desc" }));
  const tiles = [
    ["volume", m.tiles.volume, (v) => `${v.toFixed(2)}×`, t("desk.tile.volumeNote")],
    ["volatility", m.tiles.volatility, (v) => `${v.toFixed(1)}%`, t("desk.tile.volatilityNote")],
    ["momentum", m.tiles.momentum, (v) => pct(v), t("desk.tile.momentumNote", { bench: m.bench })],
  ];
  return (
    <Panel agent="research" wide state={m.fresh.research.state} date={m.fresh.research.date} infoVars={{ bench: m.bench }}>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([id, x, f, note]) => (
          <button key={id} type="button" disabled={!x} onClick={() => x && go(`stock/${x.ticker}`)}
            className="min-w-0 rounded-lg border border-line-2 px-2.5 py-2 text-start transition-colors hover:border-ink-3 disabled:hover:border-line-2">
            <span className="desk-label block text-desk">{t(`desk.tile.${id}`)}</span>
            <span className="desk-num mt-1 block text-[20px] leading-tight font-bold text-ink">{x ? f(x.value) : "–"}</span>
            <span className="mt-0.5 block truncate font-mono text-[12px] font-bold text-ink-2">{x?.ticker ?? ""}</span>
            <span className="hidden truncate text-[11px] text-ink-3 sm:block">{note}</span>
          </button>
        ))}
      </div>
      <div className="no-scrollbar -mx-3 mt-3 overflow-x-auto sm:-mx-4">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {COLS.map((c, i) => (
                <th key={c.label} scope="col" aria-sort={c.key && sort.key === c.key ? (sort.dir === "desc" ? "descending" : "ascending") : undefined}
                  className={`desk-label px-1.5 py-0 font-semibold ${i === 0 ? "sticky left-0 z-10 bg-surface ps-3 text-start sm:ps-4" : "text-end"} ${i === COLS.length - 1 ? "pe-3 sm:pe-4" : ""}`}>
                  {c.key ? (
                    <button type="button" onClick={() => by(c.key)} aria-label={t("desk.sortBy", { col: t(c.label) })}
                      className={`inline-flex min-h-[44px] items-center gap-1 uppercase ${sort.key === c.key ? "text-desk" : "hover:text-ink"}`}>
                      {t(c.label)}<span aria-hidden="true" className="w-2">{sort.key === c.key ? (sort.dir === "desc" ? "↓" : "↑") : ""}</span>
                    </button>
                  ) : t(c.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} onClick={() => go(`stock/${r.ticker}`)}
                className={`h-11 cursor-pointer border-b border-line last:border-0 hover:bg-surface-2 ${r.unusual ? "bg-desk/8" : ""}`}>
                <th scope="row" className={`sticky left-0 z-10 py-1 ps-3 pe-2 text-start font-normal sm:ps-4 ${r.unusual ? "bg-[color-mix(in_srgb,var(--desk)_8%,var(--surface))]" : "bg-surface"}`}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); go(`stock/${r.ticker}`); }} className="flex min-h-[40px] items-center gap-1.5 text-start">
                    {r.unusual && <span className="grid size-4 shrink-0 place-items-center rounded-sm bg-desk font-mono text-[10px] font-bold text-bg" title={t("desk.unusual")} aria-label={t("desk.unusual")}>!</span>}
                    <span className="min-w-0">
                      <span className="block font-mono text-[13.5px] font-bold text-ink">{r.ticker}</span>
                      <span className="block max-w-[110px] truncate text-[11px] leading-tight text-ink-3">{r.name}</span>
                    </span>
                  </button>
                </th>
                <td className="px-1.5 text-end"><MiniSpark values={r.spark} /></td>
                <td className={`desk-num px-1.5 text-end ${toneOf(r.day)} ${r.unusual ? "font-bold" : ""}`}>{pct(r.day)}</td>
                <td className={`desk-num px-1.5 text-end ${toneOf(r.d20)}`}>{pct(r.d20)}</td>
                <td className={`desk-num px-1.5 text-end ${r.volX != null && r.volX >= 1.5 ? "font-bold text-ink" : "text-ink-2"}`}>{r.volX != null ? `${r.volX.toFixed(2)}×` : "–"}</td>
                <td className="desk-num px-1.5 text-end text-ink-2">{r.vol != null ? `${r.vol.toFixed(1)}%` : "–"}</td>
                <td className={`desk-num px-1.5 text-end ${toneOf(r.mom)}`}>{pct(r.mom)}</td>
                <td className={`desk-num px-1.5 pe-3 text-end font-bold sm:pe-4 ${r.score > 0 ? "text-accent" : r.score < 0 ? "text-down" : "text-ink-2"}`}>{signed(r.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** A tiny line of the last 60 closes (indexed, no prices): green when it ended higher than it began. */
function MiniSpark({ values, w = 64, h = 22 }) {
  if (!values || values.length < 2) return <span className="text-ink-3">–</span>;
  const lo = Math.min(...values), hi = Math.max(...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)},${(1 + (1 - (v - lo) / (hi - lo || 1)) * (h - 2)).toFixed(1)}`).join("");
  const up = values.at(-1) >= values[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-auto block" aria-hidden="true">
      <path d={d} fill="none" stroke={up ? "var(--accent)" : "var(--down)"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ----------------------------------------------------------------- news */

function NewsPanel({ m, openTo }) {
  const t = strings(dict);
  const { cards, counts } = m.news;
  const counters = [["up", "text-accent border-accent/50"], ["down", "text-down border-down/50"], ["watch", "text-wait border-wait/50"]];
  const kindTone = { up: "text-accent", down: "text-down", filing: "text-wait", results: "text-wait" };
  return (
    <Panel agent="news" state={m.fresh.news.state} date={m.fresh.news.date}>
      <div className="grid grid-cols-3 gap-2">
        {counters.map(([k, tone]) => (
          <div key={k} className={`rounded-lg border px-2 py-2 text-center ${counts[k] ? tone : "border-line-2 text-ink-3"}`}>
            <div className="desk-num text-[22px] leading-none font-bold">{counts[k]}</div>
            <div className="mt-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em]">{t(`desk.news.${k}`)}</div>
          </div>
        ))}
      </div>
      {cards.length ? (
        <ul className="mt-3 grid gap-1.5">
          {cards.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => openTo(c.to)}
                className="flex min-h-[52px] w-full items-start gap-2.5 rounded-lg border border-line px-3 py-2 text-start transition-colors hover:border-ink-3">
                <span className="w-[52px] shrink-0 pt-0.5">
                  <span className="desk-num block text-[11.5px] text-ink-2">{dayMonth(c.date)}</span>
                  <span className={`block font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] ${kindTone[c.kind]}`}>{t(`desk.news.kind.${c.kind}`)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-[13px] font-bold text-ink">{c.ticker}</span>{" "}
                  <span className="text-[13.5px] leading-snug text-ink">{headline(t, c)}</span>
                  {(c.kind === "up" || c.kind === "down") && <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">{NOT_A_TRADE}</span>}
                </span>
                <span className={`desk-num shrink-0 pt-0.5 text-[12.5px] font-bold ${toneOf(c.move)}`}>{pct(c.move)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-[13.5px] text-ink-2">{t("desk.news.none")}</p>}
    </Panel>
  );
}

function headline(t, c) {
  if (c.kind === "results") return t(c.confirmed ? "desk.news.results" : "desk.news.expected", { date: noYear(c.date) });
  if (c.kind === "filing") return `${c.headline}${c.form ? ` · ${c.form}` : ""}`;
  return c.headline;
}

/* ------------------------------------------------------------- strategy */

function StrategyPanel({ m, openTo }) {
  const t = strings(dict);
  const min = m.limits.minRR;
  const stance = { up: ["desk.stance.up", "text-accent border-accent/50"], down: ["desk.stance.down", "text-down border-down/50"], flat: ["desk.stance.flat", "text-ink-2 border-line-2"] };
  const heads = ["desk.col.name", "desk.col.brain", "desk.col.entry", "desk.col.stop", "desk.col.tp1", "desk.col.tp2", "desk.col.rr", "desk.col.fits"];
  return (
    <Panel agent="strategy" state={m.fresh.strategy.state} date={m.fresh.strategy.date}>
      {m.strategy.length ? (
        <div className="no-scrollbar -mx-3 overflow-x-auto sm:-mx-4">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {heads.map((h, i) => (
                  <th key={h} scope="col" className={`desk-label h-9 px-1.5 font-semibold ${i === 0 ? "sticky left-0 z-10 bg-surface ps-3 text-start sm:ps-4" : i === 1 ? "text-start" : "text-end"} ${i === heads.length - 1 ? "pe-3 text-center sm:pe-4" : ""}`}>
                    {t(h, { min: min ?? 2 })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.strategy.map((r) => {
                const s = stance[r.lean];
                return (
                  <tr key={r.ticker} onClick={() => openTo(`stock/${r.ticker}#checklist`)} className="h-11 cursor-pointer border-b border-line last:border-0 hover:bg-surface-2">
                    <th scope="row" className="sticky left-0 z-10 bg-surface ps-3 pe-2 text-start sm:ps-4">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openTo(`stock/${r.ticker}#checklist`); }} className="min-h-[40px] font-mono text-[13.5px] font-bold text-ink">{r.ticker}</button>
                    </th>
                    <td className="px-1.5">{s ? <span className={`desk-chip px-1.5 py-0.5 text-[10px] ${s[1]}`}>{t(s[0])}</span> : <span className="text-ink-3">{t("desk.stance.none")}</span>}</td>
                    <td className="desk-num px-1.5 text-end text-ink-2">{pct(r.entry)}</td>
                    <td className="desk-num px-1.5 text-end text-down">{pct(-r.plan.stop_pct)}</td>
                    <td className="desk-num px-1.5 text-end text-accent">{pct(r.plan.tp1_pct)}</td>
                    <td className="desk-num px-1.5 text-end text-accent">{pct(r.plan.tp2_pct)}</td>
                    <td className={`desk-num px-1.5 text-end font-bold ${r.fits ? "text-accent" : "text-ink"}`}>{rrText(r.rr, min)}</td>
                    <td className="pe-3 text-center sm:pe-4">
                      <span className={`font-mono text-[14px] font-bold ${r.fits ? "text-accent" : "text-down"}`} role="img" aria-label={t(r.fits ? "desk.fits.yes" : "desk.fits.no")}>{r.fits ? "✓" : "✕"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="text-[13.5px] text-ink-2">{t("desk.strategy.none")}</p>}
    </Panel>
  );
}

/* ------------------------------------------------------------ execution */

function ExecutionPanel({ m, data, go }) {
  const t = strings(dict);
  return (
    <Panel agent="execution" state={m.fresh.execution.state} date={m.fresh.execution.date}>
      {m.candidates.length ? (
        <ul className="grid grid-cols-2 gap-2">
          {m.candidates.map((r) => <li key={r.ticker} className="min-w-0"><ExecCard r={r} manifest={data.manifest} go={go} /></li>)}
        </ul>
      ) : <p className="text-[13.5px] text-ink-2">{t("desk.exec.none")}</p>}
    </Panel>
  );
}

function ExecCard({ r, manifest, go }) {
  const t = strings(dict);
  const conf = [["level", r.exec.level], ["volume", r.exec.volume], ["close", r.exec.close]];
  return (
    <button type="button" onClick={() => go(`stock/${r.ticker}`)} aria-label={`${r.ticker}: ${t("desk.exec.now", { call: t(`desk.exec.${r.exec.call}`) })}`}
      className="flex h-full w-full flex-col rounded-lg border border-line p-2 text-start transition-colors hover:border-ink-3">
      <span className="flex items-baseline gap-1.5 px-0.5">
        <span className="font-mono text-[13.5px] font-bold text-ink">{r.ticker}</span>
        <span className="min-w-0 truncate text-[11px] text-ink-3">{r.name}</span>
      </span>
      <MiniCandles ticker={r.ticker} name={r.name} manifest={manifest} />
      <span className="mt-1.5 grid gap-0.5 px-0.5">
        {conf.map(([k, ok]) => (
          <span key={k} className="flex items-center justify-between font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]">
            <span className="text-ink-2">{t(`desk.conf.${k}`)}</span>
            <span className={ok ? "text-accent" : "text-down"}>{ok ? "✓" : "✕"}</span>
          </span>
        ))}
      </span>
      <span className="mt-2 grid grid-cols-3 gap-1" aria-hidden="true">
        {["enter", "wait", "skip"].map((c) => (
          <span key={c} className={`grid h-8 place-items-center rounded-md border font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] ${r.exec.call === c ? EXEC_SOLID[c] : "border-line text-ink-3"}`}>
            {t(`desk.exec.${c}`)}
          </span>
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
    <span ref={ref} className="mt-1.5 block" style={{ height: MINI_H }}>
      {g ? (
        <svg width={w} height={MINI_H} viewBox={`0 0 ${w} ${MINI_H}`} role="img" aria-label={t("desk.exec.chart", { name, n: win.n })} className="block">
          {g.candles.map((k) => <CandleMark key={k.i} g={k} />)}
        </svg>
      ) : (
        <span className={`grid h-full place-items-center rounded-md bg-surface-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3 ${win === undefined ? "motion-safe:animate-pulse" : ""}`}>
          {win === null ? t("desk.exec.noChart") : ""}
        </span>
      )}
    </span>
  );
}

/* ----------------------------------------------------------------- risk */

function RiskPanel({ m, go }) {
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
    <Panel agent="risk" state={m.fresh.risk.state} date={m.fresh.risk.date}>
      <div className="rounded-lg border border-line-2">
        <p className="desk-label border-b border-line px-3 py-2 text-desk">{t("desk.lim.title")}</p>
        <dl className="divide-y divide-line">
          {limits.map(([id, v]) => (
            <div key={id} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt className="text-[12.5px] text-ink-2">{t(`desk.lim.${id}`)}</dt>
              <dd className="desk-num text-end text-[12.5px] font-bold text-ink">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            <dt className="text-[12.5px] text-ink-2">{t("desk.lim.earned")} <span className="text-ink-3">· {t("desk.lim.earnedV")}</span></dt>
            <dd className={`desk-chip shrink-0 ${L.earned ? "border-accent/50 text-accent" : "border-down/50 text-down"}`}>{t(L.earned ? "desk.lim.yes" : "desk.lim.notYet")}</dd>
          </div>
        </dl>
      </div>

      {rejected.length ? (
        <>
          <p className="desk-label mt-3">{t("desk.risk.count", { count: rejected.length })}</p>
          <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {shown.map((r) => (
              <li key={r.ticker} className="min-w-0">
                <button type="button" onClick={() => go(`stock/${r.ticker}`)}
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-dashed border-line-2 bg-surface-2/40 p-2.5 text-start transition-colors hover:border-ink-3">
                  <span className="desk-label">{t("desk.ticket")}</span>
                  <span className="font-mono text-[15px] font-bold text-ink">{r.ticker}</span>
                  {r.plan && (
                    <span className="mt-1 grid grid-cols-3 gap-1 font-mono text-[10.5px]">
                      <span><span className="block text-ink-3">{t("desk.col.stop")}</span><span className="desk-num text-down">{pct(-r.plan.stop_pct)}</span></span>
                      <span><span className="block text-ink-3">{t("desk.col.tp1")}</span><span className="desk-num text-accent">{pct(r.plan.tp1_pct)}</span></span>
                      <span><span className="block text-ink-3">{t("desk.col.rr")}</span><span className="desk-num text-ink">{rrText(r.plan.rr_tp1, m.limits.minRR)}</span></span>
                    </span>
                  )}
                  <span className="mt-1.5 grid gap-0.5">
                    {r.risk.reasons.map((x) => (
                      <span key={x.id} className="font-mono text-[11px] leading-snug text-down">✕ {whyText(t, x)}</span>
                    ))}
                  </span>
                  <span className="pointer-events-none absolute end-2 top-2.5 rotate-[-8deg] rounded-sm border-2 border-down px-1.5 py-0.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-down opacity-90">
                    {t("desk.rejected")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {rejected.length > TICKETS && (
            <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
              className="mt-2 min-h-[44px] w-full rounded-lg border border-line-2 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:text-ink">
              {all ? t("desk.showFewer") : t("desk.showAll", { n: rejected.length })}
            </button>
          )}
        </>
      ) : <p className="mt-3 text-[13.5px] text-ink-2">{t("desk.risk.none")}</p>}
    </Panel>
  );
}
