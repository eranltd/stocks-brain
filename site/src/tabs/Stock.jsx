import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BigDrops } from "../components/bigdrop.jsx";
import { fmtPct, cap, signTone, fmtDate, fmtShort } from "../lib/format.js";
import dict from "../text/stock.js";
import { useInView, useReducedMotion } from "../lib/motion.js";
import {
  ArrowRight, CallButton, Chevron, Chip, Container, Conviction, Delta, EmptyState, HeroTitle, InfoTip, Panel, PipelineStrip, Segmented,
  MiniBars, MiniSpark, SimBadge, Skeleton, Stamp, StepMark,
} from "../components/ui.jsx";
import { NotAdvice } from "../components/shell.jsx";
import { STAGES, trustStage } from "../components/trust.jsx";
import { STATUS } from "../components/goal.jsx";
import { companyNumbers, fundamentalsWords } from "../lib/fundamentals.js";
import { newsRows } from "../lib/secnews.js";
import { notesForSymbol, noteView, plainName, usableWhy } from "../lib/why.js";
import { NoteSources, WhyFooter } from "../components/why.jsx";
import { CandleZoom } from "../components/zoom.jsx";
import { cardFor, daysUntil, growthWords, inDays, splitWhatsNext, staleness, todayISO, KIND_LABEL } from "../lib/outlook.js";
import { gateReason, riskPlan, rowFor, stepRows, VERDICT } from "../lib/checklist.js";
import { ChecksView, useChecklistView } from "../components/checklist.jsx";
import { CandlesView } from "../components/candles.jsx";
import { direction, eightChecks, readable, BRIEF_FOOTER } from "../lib/brief.js";
import { loadMarket } from "../lib/data.js";
import { candlesOf, costWords, fundCard, resolveSymbolMarket, NOT_YET } from "../lib/markets.js";
import { buyWindowFor, mainListOf, mainWatchlistOf, sp500Of } from "../lib/buywindow.js";
import { stocksEarned } from "../lib/money.js";
import { AGENTS, deskCalls, freshness, HARD_RISK, houseLimits, REPORTERS, rrText } from "../lib/desk.js";
import { BuyWindowBody, BW_TONE } from "../components/buywindow.jsx";
import { StockReplay } from "../components/replay.jsx";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

/*
 * One stock's (or fund's) page, laid out like a trading terminal: a header with the ticker, the day's move and the
 * paper badge; a sticky strip of the page's sections (each with a mark: the call, the checklist, the risk plan, the
 * rules); then thin panels with small "◆ NAME" heads. On an iPad the chart sits beside the Desk's call and the key
 * numbers, and the smaller panels run three to a row; on a phone everything stacks. Percent changes only, never a price
 * or raw volume. Every call here is pretend money ("BUY (paper)"), made by plain code (lib/desk.js), never a tip.
 * Long text sits behind an (i) or a "Read more"; the words are in text/stock.js.
 */

/** A trust stage's name (text/stock.js "st.stage.*", else components/trust.jsx STAGES). */
const stageName = (stage, t) => (t.has(`st.stage.${stage}`) ? t(`st.stage.${stage}`) : STAGES[stage].name);
/** A percent with `d` decimals and no sign ("12%"). */
const pctText = (v, d) => `${Number(v).toFixed(d)}%`;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const pct = (v, d = 1) => (isNum(v) ? fmtPct(v, d) : "–");
const TONE_TEXT = { accent: "text-up", down: "text-down", flat: "text-ink-2" };
const toneOf = (v, d = 1) => (isNum(v) ? TONE_TEXT[signTone(v, d)] : "text-ink-3");
/** "Wed, 21 Oct": a market day without its year. */
const noYear = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "–");
const DAY_ONLY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** "19 Nov 2026": a date without its weekday. */
const dayOnly = (iso) => DAY_ONLY.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
const ext = { target: "_blank", rel: "noopener noreferrer" };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

/* ------------------------------------------------------------------ the numbers' words */

/** Plain-language summary, assembled by code from the computed numbers (no model). */
function plainWords(row, checks, benchSymbol, benchLabel, liveClaims, settings, baseRate) {
  const t = strings(dict);
  const out = [];
  const p = (v) => `${Math.abs(v).toFixed(1)}%`;
  out.push(t(row.ret_20d_pct >= 0 ? "sp.pw.monthUp" : "sp.pw.monthDown", { symbol: row.symbol, pct: p(row.ret_20d_pct) }));
  if (row.vs_bench_20d_pct != null) {
    out.push(t(row.vs_bench_20d_pct >= 0 ? "sp.pw.better" : "sp.pw.worse", { pts: Math.abs(row.vs_bench_20d_pct).toFixed(1), bench: benchLabel }));
  }
  out.push(t(row.dist_sma50_pct > 0 ? "sp.pw.above" : "sp.pw.below"));
  if (row.dist_sma50_pct >= settings.setup.stretch_pct) out.push(t("sp.pw.stretched", { pct: p(row.dist_sma50_pct) }));
  else if (row.from_high_pct != null && row.from_high_pct > -2) out.push(t("sp.pw.nearHigh"));
  else if (row.from_high_pct != null && row.from_high_pct < -20) out.push(t("sp.pw.farBelow", { pct: p(row.from_high_pct) }));
  if (row.symbol !== benchSymbol) {
    const n = checks.filter((c) => c.pass).length;
    out.push(t(n === 4 ? "sp.pw.checks4" : n === 3 ? "sp.pw.checks3" : n === 2 ? "sp.pw.checks2" : "sp.pw.checksFew"));
    const rate = baseRate?.by_score.find((r) => r.passed === n);
    if (rate?.n) {
      out.push(t(rate.mean >= 0 ? "sp.pw.rateBetter" : "sp.pw.rateWorse", {
        from: baseRate.from.slice(0, 4), to: baseRate.to.slice(0, 4), n, pts: Math.abs(rate.mean).toFixed(1), days: baseRate.horizon_days, count: rate.n,
      }));
    }
  }
  if (liveClaims) out.push(t("sp.pw.claims", { count: liveClaims }));
  return out;
}

/** This site's rules applied to one stock: would they allow a pretend entry today? */
function actGate(data, row, checks) {
  const t = strings(dict);
  const { stage } = trustStage(data);
  const passed = checks.filter((c) => c.pass).length;
  const st = data.longrun?.now.status.find((x) => x.symbol === row.symbol);
  const held = st && (st.status === "kept" || st.status === "added");
  const stretched = row.setup?.stretched ?? !checks.find((c) => c.id === "calm").pass;
  const status = st ? STATUS[st.status].label : null;
  const reasons = [
    { ok: stage >= 2, text: t(stage >= 2 ? "sp.gate.trusted" : "sp.gate.untrusted", { stage, name: stageName(stage, t) }) },
    { ok: Boolean(held), text: st ? (held ? t("sp.gate.held") : t("sp.gate.left", { status: status.toLowerCase() })) : t("sp.gate.noRule") },
    { ok: passed >= 3 && !stretched, text: stretched ? t("sp.gate.stretched") : t("sp.gate.checks", { passed }) },
    // This site's rules, Before acting step 4: the checklist read and a written risk plan with reward-to-risk to TP1 of at least 2.
    gateReason(data.checklist, rowFor(data.checklist, row.symbol), data.checklistCfg, row.last_date),
  ];
  return { ok: reasons.every((r) => r.ok), reasons };
}

// The brain's lean and how sure it is, in everyday words (the data keeps bullish/bearish and low/medium/high).
const STANCE_KEY = { bullish: "sp.stance.bullish", bearish: "sp.stance.bearish", neutral: "sp.stance.neutral" };
const SURE_KEY = { low: "sp.sure.low", medium: "sp.sure.medium", high: "sp.sure.high" };

const RANGES = [21, 63, 126, 252]; // trading days; labels "sp.range.<n>"

/** Setup checks v2, computed in Python (derived.json `setup`; docs/methodology.md). Not a recommendation. */
export function setupChecks(row, bench, settings) {
  const t = strings(dict);
  const p = (v) => fmtPct(v, 1);
  const s = settings.setup;
  const st = row.setup;
  const c = st?.checks ?? {
    trend: row.dist_sma50_pct > 0, rs_3m: (row.vs_bench_60d_pct ?? 0) > 0, rs_6m: (row.vs_bench_120d_pct ?? 0) > 0, calm: row.dist_sma50_pct < s.stretch_pct,
  };
  return [
    { id: "trend", label: t("sp.setup.trend"), pass: c.trend, detail: st ? t("sp.setup.trendDetail", { d50: p(st.dist_sma50_pct), dLong: p(st.dist_long_pct), days: s.trend_long_days }) : t("sp.setup.trendDetail50", { d50: p(row.dist_sma50_pct) }) },
    { id: "rs_3m", label: t("sp.setup.rs3", { bench }), pass: c.rs_3m, detail: t("sp.setup.rsDetail", { pct: p(st?.vs_bench_short_pct ?? row.vs_bench_60d_pct ?? 0), days: s.rs_short_days }) },
    { id: "rs_6m", label: t("sp.setup.rs6", { bench }), pass: c.rs_6m, detail: t("sp.setup.rsDetail", { pct: p(st?.vs_bench_long_pct ?? row.vs_bench_120d_pct ?? 0), days: s.rs_long_days }) },
    { id: "calm", label: t("sp.setup.calm"), pass: c.calm, detail: t(s.veto_stretched ? "sp.setup.calmDetailVeto" : "sp.setup.calmDetail", { d50: p(row.dist_sma50_pct), limit: `+${s.stretch_pct}%` }) },
  ];
}

/** Library principles matched to this stock's condition (same tag mechanism as the market brief). `why` is a key. */
function stockLessons(row, checks, library) {
  const conds = [
    !checks.find((c) => c.id === "calm").pass && { why: "sp.lesson.ranUp", tags: ["overextension", "mean_reversion"] },
    !checks.find((c) => c.id === "trend").pass && { why: "sp.lesson.below", tags: ["invalidation", "reversal", "breakouts"] },
    checks.find((c) => c.id === "rs_6m").pass && { why: "sp.lesson.better6", tags: ["momentum", "relative_strength"] },
    !checks.find((c) => c.id === "rs_6m").pass && { why: "sp.lesson.worse6", tags: ["relative_strength", "stance", "breadth"] },
    row.from_high_pct != null && row.from_high_pct > -2 && { why: "sp.lesson.high", tags: ["all_time_highs"] },
    row.from_high_pct != null && row.from_high_pct < -20 && { why: "sp.lesson.farBelow", tags: ["bottoms", "valuation"] },
  ].filter(Boolean);
  const all = (library?.sources ?? []).flatMap((s) => s.principles.map((p) => ({ ...p, source: s })));
  const used = new Set();
  return conds.map((c) => {
    const best = all.filter((p) => !used.has(p.id)).map((p) => ({ p, n: p.tags.filter((t) => c.tags.includes(t)).length }))
      .filter((x) => x.n).sort((a, b) => b.n - a.n || (b.p.source.published ?? "").localeCompare(a.p.source.published ?? ""))[0];
    if (!best) return null;
    used.add(best.p.id);
    return { why: c.why, p: best.p };
  }).filter(Boolean).slice(0, 3);
}

/* ------------------------------------------------------------------ small pieces of the page */

/** A percent that counts up from zero the first time it is seen (motion off: the value at once). `plain`: no sign. */
function CountPct({ value, d = 1, plain = false, className = "" }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!isNum(value)) return undefined;
    if (reduced) { setV(value); return undefined; }
    if (!inView) return undefined;
    let raf = 0;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      setV(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduced]);
  if (!isNum(value)) return <span className={`font-num text-ink-3 ${className}`}>–</span>;
  const say = (x) => (plain ? `${Math.abs(x).toFixed(d)}%` : fmtPct(x, d));
  return (
    <span ref={ref} className={`font-num ${className}`}>
      <span aria-hidden="true">{say(v)}</span>
      <span className="sr-only">{say(value)}</span>
    </span>
  );
}

/** A panel's head in the terminal style: its number, an orange diamond and a small uppercase name. */
function TermHead({ id, n, title, sub }) {
  return (
    <div className="min-w-0">
      <h2 id={id} tabIndex={-1} className="flex min-w-0 items-center gap-2 font-display text-[15px] leading-tight font-bold tracking-[0.14em] text-ink uppercase outline-none">
        {n != null && <span className="font-num text-[10px] font-semibold tracking-normal text-ink-3">{String(n).padStart(2, "0")}</span>}
        <span aria-hidden="true" className="size-[7px] shrink-0 rotate-45 bg-desk shadow-[0_0_8px_var(--desk-glow)]" />
        <span className="min-w-0 text-balance">{title}</span>
      </h2>
      {sub && <p className="mt-1 truncate font-num text-[11px] tracking-[0.04em] text-ink-3">{sub}</p>}
    </div>
  );
}

const CLAMP = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" };

/** A longer text cut to a few lines, with "Read more" to open it (only when it is long). */
function ReadMore({ text, lines = 3, min = 150, className = "", children }) {
  const t = strings(dict);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!text) return null;
  const long = String(text).length > min;
  return (
    <div className={className}>
      <p id={id} className={!open && long ? CLAMP[lines] : ""}>{text}{children}</p>
      {long && (
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}
          className="micro -mb-2 inline-flex min-h-[44px] items-center text-desk hover:text-ink">
          {t(open ? "sp.less" : "sp.more")}
        </button>
      )}
    </div>
  );
}

function Src({ url }) {
  const t = strings(dict);
  if (!url) return null;
  return <a href={url} {...ext} className="ms-1 whitespace-nowrap font-num text-[11px] text-ink-3 underline decoration-line-2 underline-offset-2 hover:text-ink">{host(url) ?? t("sp.source")} ↗</a>;
}

/** A small folded list: "<NAME> (n)" that opens in place. */
function Fold({ title, count, tone = "bg-desk", children }) {
  return (
    <details className="group rounded-tile border border-line">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className={`size-[6px] rotate-45 ${tone}`} />
        <span className="font-display text-[14px] font-bold tracking-[0.12em] text-ink uppercase">{title}</span>
        {count != null && <span className="font-num text-[11px] text-ink-3">{count}</span>}
        <span aria-hidden="true" className="ms-auto text-ink-3 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-line px-3 py-3">{children}</div>
    </details>
  );
}

/** The height of the site's sticky header, kept current (the page's strip sits right under it). */
function useHeaderHeight() {
  const [h, setH] = useState(64);
  useEffect(() => {
    const el = document.querySelector("header");
    if (!el) return undefined;
    const on = () => setH(Math.round(el.getBoundingClientRect().height));
    on();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

/** The section under the strip: the last one (in page order) whose top has passed the line. */
function useSpy(ids, line) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(",");
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = line();
        let cur = ids[0];
        for (const id of ids) {
          const top = document.getElementById(id)?.getBoundingClientRect().top;
          if (top != null && top <= y) cur = id;
        }
        setActive(cur);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [key, line]); // eslint-disable-line react-hooks/exhaustive-deps
  return [active, setActive];
}

/* ------------------------------------------------------------------ the Desk's call for this name */

const STEP = { fresh: "done", stale: "wait", missing: "fail" };
const CALL_STATE = { buy: "done", wait: "wait", reject: "fail" };

/**
 * The Desk's call for one name of the main list, made exactly as Home's Desk makes it (components/desk.jsx useDesk):
 * the same inputs, cleaned the same way, through lib/desk.js. {call (a deskCalls row), fresh} or null.
 */
function useDeskCall(data, symbol, on) {
  return useMemo(() => {
    if (!on) return null;
    // A checklist or notes from sample prices on a live site are not a reading of the market.
    const checklist = data.checklist && (!data.checklist.sample || data.sample) ? data.checklist : null;
    const why = usableWhy(data.why, data.livePrices);
    const secNews = data.secNews && !(data.secNews.sample && data.livePrices) ? data.secNews : null;
    const run = data.lastOk ?? null;
    const household = (data.docs ?? []).find((d) => d.name === "household")?.content ?? null;
    const earned = stocksEarned(data.rulesResult, trustStage(data).stage);
    const limits = houseLimits({ settings: data.settings, checklistCfg: data.checklistCfg, checklist, rulebook: data.rulebook, household, earned });
    const fresh = freshness({ market: data.market, checklist, why, secNews, run });
    const [call] = deskCalls({ market: data.market, checklist, run, members: [symbol], names: data.names ?? {}, limits, received: fresh.received });
    return call ? { call, fresh, limits } : null;
  }, [data, symbol, on]);
}

/** Each agent's mark for this name: passes (done), waits (wait) or says no (fail). */
function agentState(a, r, fresh) {
  if (a === "research" || a === "news") return STEP[fresh[a].state];
  if (a === "strategy") return r.lean === "up" ? "done" : r.lean === "down" ? "fail" : "wait";
  if (a === "execution") return r.exec.call === "enter" ? "done" : r.exec.call === "skip" ? "fail" : "wait";
  if (a === "risk") return r.risk.pass ? "done" : r.risk.reasons.some((x) => HARD_RISK.has(x.id)) ? "fail" : "wait";
  return CALL_STATE[r.call];
}

/** "R:R 1.0, needs 2+": a reason in short. */
function whyText(t, x = {}) {
  const v = {
    rr: () => t("sp.desk.why.rr", { rr: rrText(x.rr, x.min), min: x.min }),
    stop: () => t("sp.desk.why.stop", { atr: x.atr?.toFixed(1), max: x.max }),
    stretch: () => t("sp.desk.why.stretch", { pct: pct(x.pct), max: x.max }),
    confirm: () => t("sp.desk.why.confirm", { n: x.n }),
    reports: () => t("sp.desk.why.reports", { n: x.n, total: x.total }),
  }[x.id];
  return v ? v() : t(`sp.desk.why.${x.id}`);
}

function AgentCell({ title, children }) {
  return (
    <div className="tile min-w-0 px-2.5 py-2">
      <p className="micro truncate">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function DeskCall({ desk, go, n, className = "" }) {
  const t = strings(dict);
  const { call: r, fresh } = desk;
  const total = REPORTERS.length;
  const full = fresh.received === total;
  const steps = AGENTS.map((a) => {
    const state = agentState(a, r, fresh);
    return { id: a, label: t(`sp.desk.a.${a}`), state, stateLabel: t(`sp.desk.st.${state}`) };
  });
  const lean = { up: ["up", "sp.stance.bullish"], down: ["down", "sp.stance.bearish"], flat: ["neutral", "sp.stance.neutral"] }[r.lean] ?? ["ghost", "sp.desk.noView"];
  const exTone = { enter: "up", wait: "wait", skip: "down" }[r.exec.call];
  return (
    <Panel id="desk-call" hero className={`scroll-mt-32 ${className}`} info={t("sp.desk.info")} infoLabel={t("sp.info")}
      head={<TermHead id="desk-call-h" n={n} title={t("sp.desk.title")} sub={t("sp.desk.sub")} />}
      badge={<Chip tone="neutral" title={t("sp.desk.reportsTitle")}><StepMark state={full ? "done" : "wait"} label={t(full ? "sp.desk.st.done" : "sp.desk.st.wait")} /><span className="text-ink-2">{fresh.received}/{total}</span></Chip>}>
      <div className="@container">
        <div className="grid gap-4 @md:grid-cols-[auto_minmax(0,1fr)] @md:items-center @md:gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <CallButton call={r.call} size="lg" label={t(`sp.desk.call.${r.call}`)} className="min-w-[190px]" />
            <SimBadge short />
          </div>
          <div className="min-w-0">
            <p className="micro">{t("sp.desk.decided")}</p>
            <p className="headline mt-1 text-[28px] text-desk">{t(`sp.desk.by.${r.by}`)}</p>
            <p className="font-num mt-1 text-[12.5px] text-ink-2">{whyText(t, r.reason)}</p>
          </div>
        </div>
        <div className="tile mt-4 px-1">
          <PipelineStrip label={t("sp.desk.pipeline")} steps={steps} active={r.by} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 @2xl:grid-cols-4">
          <AgentCell title={t("sp.desk.a.strategy")}>
            <Chip tone={lean[0]}>{t(lean[1])}</Chip>
          </AgentCell>
          <AgentCell title={t("sp.desk.a.execution")}>
            <Chip tone={exTone}>{t(`sp.desk.exec.${r.exec.call}`)}</Chip>
            <span className="micro mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {[["level", r.exec.level], ["volume", r.exec.volume], ["close", r.exec.close]].map(([k, ok]) => (
                <span key={k} className="inline-flex items-center gap-0.5">
                  {t(`sp.desk.conf.${k}`)}<StepMark state={ok ? "done" : "fail"} label={t(ok ? "sp.desk.st.done" : "sp.desk.st.fail")} className="size-2.5" />
                </span>
              ))}
            </span>
          </AgentCell>
          <AgentCell title={t("sp.desk.a.risk")}>
            <Chip tone={r.risk.pass ? "up" : r.risk.reasons.some((x) => HARD_RISK.has(x.id)) ? "down" : "wait"}>{t(r.risk.pass ? "sp.desk.riskOk" : "sp.desk.riskNo")}</Chip>
            {!r.risk.pass && <span className="font-num mt-1.5 block truncate text-[11px] text-ink-2">{whyText(t, r.risk.reasons[0])}</span>}
          </AgentCell>
          <AgentCell title={t("sp.desk.reports")}>
            <span className={`font-num block text-[22px] leading-none font-bold ${full ? "text-ink" : "text-wait"}`}>{fresh.received}<span className="text-ink-3">/{total}</span></span>
            <span className="font-num mt-1 block text-[11px] text-ink-3">{noYear(fresh.marketDate)}</span>
          </AgentCell>
        </div>
        <button type="button" onClick={() => go("today")} className="micro mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-ink-2 hover:text-ink">
          {t("sp.desk.open")} <ArrowRight className="size-3.5" />
        </button>
      </div>
    </Panel>
  );
}

/** A name the Desk does not read (another list, a fund, a name off the main list): no call, only the reason. */
function LookOnly({ isDefault, n, className = "" }) {
  const t = strings(dict);
  return (
    <Panel id="desk-call" className={`scroll-mt-32 ${className}`} info={t(isDefault ? "sp.desk.notMain" : "sp.nasdaqOnly")} infoLabel={t("sp.info")}
      head={<TermHead id="desk-call-h" n={n} title={t("sp.desk.title")} />} badge={<Chip tone="ghost">{t("sp.desk.lookChip")}</Chip>}>
      <p className="headline text-[30px] text-ink-2">{t("sp.notPlan")}</p>
      <p className="mt-2 text-[13.5px] leading-snug text-ink-3">{t("sp.desk.lookLine")}</p>
      <div className="mt-3"><SimBadge /></div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ the page */

/**
 * A stock (or fund) page for a symbol of any market. The chosen market's data is used when it has the symbol; otherwise
 * the page finds the market that lists it (lib/markets.js resolveSymbolMarket) and moves the header switch there, so
 * stock/TEVA opens in TLV and stock/IVV in iShares from any link.
 */
export default function StockPage({ data, market, symbol, go }) {
  const t = strings(dict);
  const md = !market || market.isDefault ? data : market.state === "ready" ? market.data : null;
  const has = Boolean(md?.market?.symbols?.some((s) => s.symbol === symbol));
  const [found, setFound] = useState({ symbol: null, id: undefined });
  const busy = market && market.state === "loading";
  const look = !has && !busy && found.symbol !== symbol;
  useEffect(() => {
    if (!look) return;
    let live = true;
    Promise.all((data.markets ?? []).map((m) => loadMarket(data.manifest, m.id, data).catch(() => null)))
      .then((views) => {
        if (!live) return;
        const id = resolveSymbolMarket(views.filter(Boolean), symbol, market?.id ?? null);
        setFound({ symbol, id });
        if (id && market && id !== market.id) market.adopt(id);
      });
    return () => { live = false; };
  }, [look, symbol]);

  if (has) return <Stock data={md} symbol={symbol} go={go} market={market} />;
  const label = market?.entry?.label ?? t("sp.thisMarket");
  const waiting = busy || look || (found.id && market && found.id !== market.id);
  return (
    <Container className="pt-10 sm:pt-14">
      {waiting ? (
        <div role="status" className="grid gap-3">
          <p className="micro text-desk">{t("sp.opening", { symbol })}</p>
          <Skeleton className="h-14 w-48" />
          <Skeleton className="h-6 w-72 max-w-full" />
          <Skeleton className="mt-4 h-[300px] w-full rounded-panel" />
        </div>
      ) : market?.state === "error" ? (
        <EmptyState title={t("sp.loadError", { label })}
          action={<button type="button" onClick={market.retry} className="btn min-h-[48px] justify-center">{t("cdv.retry")}</button>} />
      ) : found.id && found.id === market?.id ? <EmptyState title={`${symbol} · ${label}`}>{market.state === "none" ? NOT_YET : t("sp.nightly")}</EmptyState>
        : <EmptyState title={t("sp.notListed.title", { symbol })}>{t("sp.notListed.body")}</EmptyState>}
    </Container>
  );
}

function Stock({ data, symbol, go, market: mk }) {
  const t = strings(dict);
  const row = data.market.symbols.find((s) => s.symbol === symbol);
  if (!row) {
    return (
      <Container className="pt-14">
        <EmptyState title={t("sp.notOnList.title", { symbol })}>{t("sp.notOnList.body")}</EmptyState>
      </Container>
    );
  }
  return <StockView data={data} row={row} symbol={symbol} go={go} mk={mk} />;
}

const VERDICT_STATE = { lean_up: "done", mixed: "wait", lean_down: "fail" };
const CHIP_OF = { accent: "up", down: "down", flat: "neutral" };

function StockView({ data, row, symbol, go, mk }) {
  const t = strings(dict);
  const { market, bench, names, kb, observations, library, settings, sample, watchlist } = data;
  const isDefault = !mk || mk.isDefault;
  const entry = data.marketEntry ?? mk?.entry ?? null;
  const fund = entry?.kind === "funds" ? fundCard(data.funds, symbol) ?? {} : null;
  // The chart panel's view: Candles or Checks (remembered per device), or Replay and the line against the market.
  const [ckView, setCkView] = useChecklistView();
  const [extra, setExtra] = useState(null);
  const [zoom, setZoom] = useState(false);
  const headerH = useHeaderHeight();
  const strip = useRef(null);
  const reduced = useReducedMotion();

  const isBench = symbol === bench.symbol;
  const today = todayISO();
  const checks = setupChecks(row, bench.symbol, settings);
  const passed = checks.filter((c) => c.pass).length;
  const hasCandles = Boolean(candlesOf(data)[symbol]);
  const onMain = isDefault && !isBench && mainListOf(data).includes(symbol);
  const desk = useDeskCall(data, symbol, onMain);
  const cfg = data.checklistCfg;
  const ckRow = rowFor(data.checklist, symbol);
  const read = readable(data.checklist, ckRow, row.last_date, { sampleSite: data.sample });
  const reading = read.ok ? ckRow : null;
  const rp = reading ? riskPlan(reading.risk_plan, cfg) : null;
  const aliases = [symbol, ...((watchlist.symbols ?? []).find((s) => s.symbol === symbol)?.aliases ?? [])];
  const claims = (observations?.items ?? []).filter((o) => o.tickers.some((x) => aliases.includes(x))).sort((a, b) => b.as_of.localeCompare(a.as_of));
  const liveClaims = claims.filter((c) => c.expires >= today);
  const picks = kb.filter((k) => k.ticker === symbol);
  const lessons = stockLessons(row, checks, library);
  const others = market.symbols.filter((s) => s.symbol !== bench.symbol);
  const idx = others.findIndex((s) => s.symbol === symbol);
  const words = plainWords(row, checks, bench.symbol, bench.label, liveClaims.length, settings, market.base_rates);
  const gate = isBench || !isDefault ? null : actGate(data, row, checks);
  const long = data.longrun?.members.find((m) => m.symbol === symbol);
  // "When could we buy it?": this site's rules' answer for this name (lib/buywindow.js). The rules' look covers the main
  // list only; a main-list name opened from another list still gets it.
  const buy = isBench ? null : buyWindowFor(symbol, {
    today, derived: market, checklist: data.checklist, bw: data.buyWindow, mainList: mainListOf(data), fund,
    stocksEarned: stocksEarned(data.rulesResult, trustStage(data).stage), rulesResult: data.rulesResult, names, siteSample: Boolean(market.sample),
    sp500: sp500Of(symbol, watchlist, mainWatchlistOf(data)),
    minRR: data.checklistCfg?.house_rule?.min_reward_to_risk ?? 2, stretchPct: settings.setup.stretch_pct,
  });
  const prev = idx >= 0 ? others[(idx - 1 + others.length) % others.length]?.symbol : null;
  const next = idx >= 0 ? others[(idx + 1) % others.length]?.symbol : null;

  // The chart panel's tabs: what this name has.
  const tabs = [hasCandles && "candles", cfg && "checks", hasCandles && "replay", "line"].filter(Boolean);
  const want = extra ?? ckView;
  const tab = tabs.includes(want) ? want : tabs[0];
  const pickTab = (v) => {
    if (v === "candles" || v === "checks") { setExtra(null); setCkView(v); } else setExtra(v);
  };

  // The sticky strip: the page's sections, each with its mark.
  const sections = [
    { id: "desk-call", label: t("sp.nav.call"), state: desk ? CALL_STATE[desk.call.call] : "idle" },
    { id: "checklist", label: t("sp.nav.chart"), state: "idle" },
    !isBench && { id: "ck-steps", label: t("sp.nav.steps"), state: reading ? VERDICT_STATE[reading.score.verdict] ?? "idle" : "idle" },
    !isBench && { id: "risk-plan", label: t("sp.nav.risk"), state: rp ? (rp.fits ? "done" : "wait") : "idle" },
    buy && { id: "buy-window", label: t("sp.nav.when"), state: buy.tone === "rules_allow" ? "done" : buy.tone === "wait" ? "wait" : "idle" },
    !isBench && { id: fund ? "whats-inside" : "whats-next", label: t(fund ? "sp.nav.inside" : "sp.nav.news"), state: "idle" },
  ].filter(Boolean).filter((s) => s.id !== "desk-call" || !isBench).map((s) => ({ ...s, stateLabel: t(`sp.nav.st.${s.state}`) }));
  const line = useCallback(() => headerH + (strip.current?.offsetHeight ?? 0) + 24, [headerH]);
  const [active, setActive] = useSpy(sections.map((s) => s.id), line);
  const jump = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    const y = el.getBoundingClientRect().top + window.scrollY - headerH - (strip.current?.offsetHeight ?? 0) - 10;
    window.scrollTo({ top: Math.max(0, y), behavior: reduced ? "auto" : "smooth" });
    document.getElementById(`${id}-h`)?.focus({ preventScroll: true });
  };
  const seeCandles = hasCandles ? () => { pickTab("candles"); requestAnimationFrame(() => jump("checklist")); } : null;

  let num = 0;
  const no = () => ++num;
  const name = plainName(names?.[symbol] ?? symbol);
  const group = data.sectors?.[symbol] ?? (fund ? fund.category : null);
  const right = "lg:col-span-4 lg:col-start-9";

  return (
    <>
      <Container className="pt-4 sm:pt-6">
        <StockHero data={data} row={row} symbol={symbol} name={name} group={group} entry={entry} isDefault={isDefault} fund={fund} isBench={isBench}
          prev={prev} next={next} go={go} />
      </Container>

      <PipelineStrip ref={strip} sticky top={headerH} className="mt-4" label={t("sp.nav.label", { symbol })} steps={sections} active={active} onStep={jump}
        lead={<span className="flex items-center gap-2"><SimBadge short /><span className="font-num text-[12.5px] font-bold text-ink">{symbol}</span></span>}
        trail={<span className="hidden sm:inline-flex"><Delta value={row.change_1d_pct} d={2} chip arrow /></span>} />

      <Container className="pt-4 sm:pt-6">
        {/* One grid. Phone: one column in this order. iPad portrait: two. iPad landscape and up: twelve, with the key
            numbers across the top, the chart beside the Desk's call and the checklist, then rows of three or 4 + 8. */}
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-flow-row-dense lg:grid-cols-12">
          {!isBench && (desk ? <DeskCall desk={desk} go={go} n={no()} className={`md:col-span-2 ${right} lg:row-start-2`} />
            : <LookOnly isDefault={isDefault} n={no()} className={`md:col-span-2 ${right} lg:row-start-2`} />)}
          <ChartPanel data={data} row={row} symbol={symbol} bench={bench} isBench={isBench} picks={sample ? [] : picks} reading={reading}
            tab={tab} tabs={tabs} onTab={pickTab} onZoom={() => setZoom(true)} n={no()}
            className={`md:col-span-2 lg:col-start-1 lg:row-start-2 ${isBench ? "lg:col-span-12" : "lg:col-span-8 lg:row-span-2"}`} />
          <KeyNumbers row={row} bench={bench} isBench={isBench} className="md:col-span-2 lg:col-span-12 lg:row-start-1" />
          {!isBench && <StepsPanel data={data} reading={reading} read={read} cfg={cfg} seeCandles={seeCandles} n={no()} className={`${right} lg:row-start-3`} />}
          {!isBench && <RiskTicket symbol={symbol} reading={reading} rp={rp} n={no()} className="lg:col-span-4" />}
          {buy && (
            <Panel id="buy-window" className="scroll-mt-32 md:col-span-2 lg:col-span-8" info={buy.note} infoLabel={t("sp.info")}
              head={<TermHead id="buy-window-h" n={no()} title={t("sp.when.title")} />}
              badge={<Chip tone={(BW_TONE[buy.tone] ?? BW_TONE.wait).chip}>{t((BW_TONE[buy.tone] ?? BW_TONE.wait).word)}</Chip>}>
              <BuyWindowBody a={buy} go={go} />
            </Panel>
          )}
          {!isBench && <QuickChecks checks={checks} passed={passed} gate={gate} go={go} n={no()} className="lg:col-span-4" />}
          {!isBench && (fund ? <WhatsInside fund={fund} symbol={symbol} n={no()} className="md:col-span-2 lg:col-span-8" />
            : <WhatsNext card={cardFor(data.outlook, symbol)} symbol={symbol} today={today} hasFile={Boolean(data.outlook)} n={no()} className="md:col-span-2 lg:col-span-8" />)}
          {!isBench && <WhyItMoved notes={notesForSymbol(usableWhy(data.why, Boolean(data.livePrices)), symbol, { today })} names={names} n={no()} className="lg:col-span-4" />}
          {!isBench && isDefault && <BigDrops dips={data.dips} symbol={symbol} move={row?.change_1d_pct ?? null} className="lg:col-span-4" />}
          {!isBench && !fund && <OfficialNews rows={newsRows(data.secNews, symbol, 6)} n={no()} className="lg:col-span-4" />}
          {!isBench && !fund && <CompanyNumbers c={companyNumbers(data.fundamentals, symbol)} n={no()} className="lg:col-span-4" />}
          {long && <LongRun long={long} data={data} row={row} bench={bench} n={no()} className="lg:col-span-4" />}
          <Panel className="lg:col-span-4" info={t("sp.plain.foot")} infoLabel={t("sp.info")} head={<TermHead n={no()} title={t("sp.plain.title")} />}>
            <ReadMore text={words.join(" ")} lines={4} className="text-[14.5px] leading-relaxed text-ink" />
          </Panel>
          <Lessons lessons={lessons} go={go} n={no()} className="lg:col-span-4" />
          {!isBench && isDefault && <Guess picks={picks} sample={sample} symbol={symbol} settings={settings} n={no()} className="lg:col-span-4" />}
          <People claims={claims} live={liveClaims.length} symbol={symbol} today={today} n={no()} className="md:col-span-2 lg:col-span-12" />
        </div>

        <div className="mt-8 grid gap-3 border-t border-line pt-5">
          <p className="max-w-[90ch] text-[12.5px] leading-snug text-ink-3">{BRIEF_FOOTER} {t("sp.foot")}</p>
          <NotAdvice compact />
        </div>
      </Container>

      {zoom && <CandleZoom it={{ ticker: symbol, name, candlesTo: `stock/${symbol}#checklist` }} manifest={data.manifest} marketId={data.marketId ?? "nasdaq"}
        onClose={() => setZoom(false)} openTo={() => seeCandles?.()} />}
    </>
  );
}

/* ------------------------------------------------------------------ header */

/** Days between two market dates (calendar days). */
const ageDays = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);

function StockHero({ data, row, symbol, name, group, entry, isDefault, fund, isBench, prev, next, go }) {
  const t = strings(dict);
  const sample = data.sample || Boolean(data.market?.sample);
  const age = row.last_date ? ageDays(row.last_date, todayISO()) : 0;
  const state = age > 4 ? "old" : sample ? "sample" : "live";
  const tone = { old: "down", sample: "wait", live: "up" }[state];
  const kind = isBench ? t("sp.kind.bench") : fund ? t("sp.kind.fund") : t("sp.kind.stock");
  const eyebrow = [entry?.label ?? t("sp.kind.main"), group ?? kind].filter(Boolean).join(" · ");
  const long = name.length > 14;
  const navBtn = "inline-flex h-11 items-center gap-1 rounded-[10px] border border-line-2 bg-surface-2/80 px-2.5 font-num text-[12px] font-bold text-ink-2 transition-colors hover:border-line-3 hover:text-ink";
  return (
    <div id="brief" className="scroll-mt-32">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => go("watchlist")} className="micro inline-flex min-h-[44px] items-center gap-2 hover:text-ink">
          <ArrowRight className="size-3.5 rotate-180" /> {isDefault ? t("sp.back") : t("sp.backList", { label: entry?.label ?? t("sp.back") })}
        </button>
        {!isBench && prev && (
          <span className="ms-auto flex gap-1.5">
            <button type="button" onClick={() => go(`stock/${prev}`)} aria-label={t("sp.goPrev", { symbol: prev })} className={navBtn}><Chevron dir="left" />{prev}</button>
            <button type="button" onClick={() => go(`stock/${next}`)} aria-label={t("sp.goNext", { symbol: next })} className={navBtn}>{next}<Chevron /></button>
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8">
        <HeroTitle eyebrow={eyebrow} line1={symbol} line2={name}
          className={long ? "[&_h1]:text-[clamp(36px,10vw,64px)]" : "[&_h1]:text-[clamp(48px,13vw,80px)]"} />
        <div className="flex items-end gap-4 md:block md:text-end">
          <div>
            <p className="micro">{t("sp.hero.day")}</p>
            <p className={`mt-1 text-[clamp(34px,9vw,48px)] leading-none font-bold tracking-[-0.04em] ${toneOf(row.change_1d_pct, 2)}`}>
              <CountPct value={row.change_1d_pct} d={2} />
            </p>
          </div>
          <p className="font-num pb-1 text-[11.5px] text-ink-3 md:mt-1.5 md:pb-0">{noYear(row.last_date)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Chip tone={tone}>
          <span className="relative inline-flex size-1.5" aria-hidden="true">
            {state === "live" && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />}
            <span className="relative inline-block size-1.5 rounded-full bg-current" />
          </span>
          {state === "old" ? t("sp.old", { count: age }) : t(state === "sample" ? "sp.sampleData" : "sp.live")}
        </Chip>
        <Chip tone="neutral"><span className="text-ink-3">{rich(t, "sp.marketDay", { date: <span className="text-ink">{noYear(row.last_date)}</span> })}</span></Chip>
        <SimBadge />
        <InfoTip label={t("sp.paperWhat")} align="start">{t("sp.paperInfo")}</InfoTip>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ key numbers */

function KeyNumbers({ row, bench, isBench, n, className = "" }) {
  const t = strings(dict);
  const series = (row.series ?? row.spark ?? []).map((p) => p.v).filter(isNum);
  const moves = series.slice(-13).map((v, i, a) => (i ? (v / a[i - 1] - 1) * 100 : null)).slice(1);
  const risk = row.risk ?? null;
  const tiles = [
    { id: "1d", v: row.change_1d_pct, d: 2, bars: moves, barsHi: moves.length - 1 },
    { id: "20d", v: row.ret_20d_pct, spark: series.slice(-21) },
    { id: "60d", v: row.ret_60d_pct, spark: series.slice(-61) },
    { id: "1y", v: row.ret_250d_pct ?? risk?.ret_1y_pct, spark: series },
    { id: "vol", v: row.vol20_pct, plain: true, sub: isNum(risk?.vol_1y_pct) ? t("sp.tile.vol1y", { pct: pctText(risk.vol_1y_pct, 0) }) : null, tone: "text-ink" },
    { id: "high", v: row.from_high_pct },
    !isBench && { id: "vs", v: row.vs_bench_60d_pct, label: t("sp.tile.vs", { bench: bench.symbol }), sub: isNum(row.vs_bench_20d_pct) ? t("sp.tile.vs20", { pct: fmtPct(row.vs_bench_20d_pct, 1) }) : null },
    isNum(risk?.max_dd_1y_pct) && { id: "dd", v: risk.max_dd_1y_pct, d: 0, sub: isNum(risk.worst_20d_1y_pct) ? t("sp.tile.worst20", { pct: fmtPct(risk.worst_20d_1y_pct, 0) }) : null },
  ].filter(Boolean);
  // A strip of cells split by hairlines (the right and bottom edges of each cell; the box hides the outer ones).
  return (
    <Panel id="key-numbers" flush className={className} info={t("sp.tile.info")} infoLabel={t("sp.info")}
      head={<TermHead id="key-numbers-h" n={n} title={t("sp.tile.title")} />} badge={<Chip tone="ghost">{t("sp.tile.pctOnly")}</Chip>}>
      <div className="overflow-hidden rounded-b-panel">
        <dl className="-me-px -mb-px grid grid-cols-2 sm:grid-cols-4 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ "--n": tiles.length }}>
          {tiles.map((x) => (
            <div key={x.id} className="flex min-w-0 flex-col border-e border-b border-line px-3 pt-2.5 pb-2 sm:px-4">
              <dt className="micro truncate text-desk">{x.label ?? t(`sp.tile.${x.id}`)}</dt>
              <dd className="mt-1.5 text-[22px] leading-none font-bold tracking-[-0.03em] sm:text-[24px]">
                <CountPct value={x.v} d={x.d ?? 1} plain={x.plain} className={x.tone ?? toneOf(x.v, x.d ?? 1)} />
              </dd>
              <dd className="font-num mt-1 h-4 truncate text-[11px] text-ink-3">{x.sub ?? ""}</dd>
              <dd className="mt-auto pt-1.5" aria-hidden="true">
                {x.bars?.length ? <MiniBars values={x.bars} hi={x.barsHi} h={22} /> : x.spark?.length > 1 ? <MiniSpark values={x.spark} w={120} h={22} area fluid /> : <span className="block h-[22px]" />}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ the chart panel */

const ZoomIcon = () => (
  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
  </svg>
);

function ChartPanel({ data, row, symbol, bench, isBench, picks, reading, tab, tabs, onTab, onZoom, n, className = "" }) {
  const t = strings(dict);
  const cfg = data.checklistCfg;
  const v = reading ? VERDICT[reading.score.verdict] : null;
  const asOf = reading?.as_of ?? row.last_date;
  const info = {
    candles: `${t("ckc.candles.lede", { date: fmtDate(asOf) })} ${t("cdv.chips")} ${t("cdv.footer")}`,
    checks: t("ckc.checks.lede", { date: fmtDate(asOf) }),
    replay: `${t("rp.lede.daily")} ${t("rp.frame.daily")} ${t("rp.axis")}`,
    line: `${t("sp.chart.lede")}${isBench ? "" : ` ${t("sp.chart.ledeBench")}`}`,
  }[tab];
  const label = { candles: t("sp.tab.candles"), checks: t("sp.tab.checks"), replay: t("sp.tab.replay"), line: isBench ? t("sp.tab.lineAlone") : t("sp.tab.line", { bench: bench.symbol }) };
  return (
    <Panel id="checklist" className={`scroll-mt-32 ${className}`} info={info} infoLabel={t("sp.info")}
      head={<TermHead id="checklist-h" n={n} title={t("sp.chart.title", { symbol })} sub={t("sp.chart.sub", { date: noYear(asOf) })} />}
      badge={v && <Chip tone={CHIP_OF[v.tone]}>{v.short}</Chip>}>
      {tabs.length > 1 && (
        <div className="[&_button]:flex-1 [&_button]:justify-center [&_button]:px-2 [&>div]:flex [&>div]:w-full">
          <Segmented label={t("sp.tabs")} value={tab} onChange={onTab} options={tabs.map((x) => ({ value: x, label: label[x] }))} />
        </div>
      )}
      <div className={tabs.length > 1 ? "mt-4" : ""}>
        {tab === "candles" && (
          <CandlesView data={data} symbol={symbol} row={reading} cfg={cfg}
            tools={<button type="button" onClick={onZoom} aria-label={t("zm.title")} className="inline-flex h-11 items-center gap-1.5 rounded-[10px] border border-line-2 bg-surface-2 px-3 font-display text-[14px] font-bold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"><ZoomIcon />{t("sp.zoom")}</button>} />
        )}
        {tab === "checks" && <ChecksView data={data} symbol={symbol} go={null} />}
        {tab === "replay" && <StockReplay data={data} symbol={symbol} />}
        {tab === "line" && <StockChart row={row} bench={isBench ? null : data.market.symbols.find((s) => s.symbol === bench.symbol)} benchSymbol={bench.symbol} picks={picks} />}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ checklist, risk plan, quick checks */

const MARK_STATE = { up: "done", down: "fail", neutral: "idle" };
const MARK_BAR = { up: "bg-up", down: "bg-down", neutral: "bg-line-3" };
/** "Going up" from "Trend: going up": the check's plain words without its own name. */
const plainLine = (s) => { const x = String(s ?? "").replace(/^[^:]{1,24}:\s*/, ""); return x.charAt(0).toUpperCase() + x.slice(1); };

function StepsPanel({ data, reading, read, cfg, seeCandles, n, className = "" }) {
  const t = strings(dict);
  const checks = reading ? eightChecks(reading, cfg) : null;
  const detail = reading ? Object.fromEntries(stepRows(reading, cfg).map((s) => [s.id, s.text])) : {};
  const dir = direction(reading);
  const v = reading ? VERDICT[reading.score.verdict] : null;
  const net = reading ? `${reading.score.net > 0 ? "+" : reading.score.net < 0 ? "−" : ""}${Math.abs(reading.score.net)}` : null;
  return (
    <Panel id="ck-steps" className={`scroll-mt-32 ${className}`} infoLabel={t("sp.info")}
      info={<>{dir?.summary ? `${dir.summary} ` : ""}{t("sp.brief.notForecast")} {t("sp.ck.info")}</>}
      head={<TermHead id="ck-steps-h" n={n} title={t("sp.ck.title")} sub={v ? t("sp.ck.sub", { word: v.word, net }) : null} />}
      badge={v && <Chip tone={CHIP_OF[v.tone]}>{t("sp.ck.score", { net })}</Chip>}>
      {checks ? (
        <ol className="grid grid-cols-2 gap-1.5 @container sm:grid-cols-4 lg:grid-cols-2">
          {checks.map((c) => (
            <li key={c.id} className="tile relative flex min-h-[96px] flex-col px-2.5 pt-2 pb-2.5">
              <span aria-hidden="true" className={`absolute inset-x-3 -top-px h-[2px] rounded-full ${MARK_BAR[c.mark]}`} />
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-num text-[10px] text-ink-3">{String(c.n).padStart(2, "0")}</span>
                  <StepMark state={MARK_STATE[c.mark]} label={t(`sp.ck.mark.${c.mark}`)} className="size-3.5" />
                </span>
                <InfoTip label={c.name} className="-my-2.5 -me-2.5">
                  <span className="block font-semibold text-ink">{c.text}{c.note ? ` (${c.note})` : ""}.</span>
                  {detail[c.id] && <span className="font-num mt-1.5 block text-[12px] text-ink-2">{detail[c.id]}</span>}
                </InfoTip>
              </div>
              <p className="headline text-[16px] leading-none text-ink">{t.has(`sp.step.${c.id}`) ? t(`sp.step.${c.id}`) : c.name}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-2">{plainLine(c.text)}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div>
          <p className="text-[13.5px] leading-snug text-ink-2">{read.why}</p>
          <ol className="mt-2 flex flex-wrap gap-1.5">
            {(cfg?.steps ?? []).map((s) => <li key={s.id}><Chip tone="ghost"><span className="font-num">{s.n}</span> {t.has(`sp.step.${s.id}`) ? t(`sp.step.${s.id}`) : s.name}</Chip></li>)}
          </ol>
        </div>
      )}
      {seeCandles && checks && (
        <button type="button" onClick={seeCandles} className="micro mt-1.5 -mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-ink-2 hover:text-ink">
          {t("sp.brief.seeCandles")} <span aria-hidden="true">↑</span>
        </button>
      )}
    </Panel>
  );
}

/** The plan as a bar: the stop (red) to the left of the entry, the two targets (green) to the right, to scale. */
function RRBar({ stop, tp1, tp2 }) {
  const t = strings(dict);
  const total = stop + Math.max(tp1, tp2) || 1;
  const at = (v) => `${((stop + v) / total) * 100}%`;
  return (
    <div className="px-3.5 pb-3.5" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-surface-3">
        <span className="absolute inset-y-0 start-0 rounded-s-full bg-down/70" style={{ width: at(0) }} />
        <span className="absolute inset-y-0 bg-up/80" style={{ insetInlineStart: at(0), width: `${(tp1 / total) * 100}%` }} />
        <span className="absolute inset-y-0 rounded-e-full bg-up/35" style={{ insetInlineStart: at(tp1), width: `${(Math.max(0, tp2 - tp1) / total) * 100}%` }} />
        <span className="absolute -top-1 h-4 w-[2px] -translate-x-1/2 rounded bg-ink" style={{ insetInlineStart: at(0) }} />
      </div>
      <div className="relative mt-1.5 h-3 font-mono text-[9.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
        <span className="absolute start-0">{t("sp.ticket.stop")}</span>
        <span className="absolute -translate-x-1/2" style={{ insetInlineStart: at(0) }}>{t("sp.ticket.in")}</span>
        <span className="absolute end-0">{t("sp.ticket.tp2")}</span>
      </div>
    </div>
  );
}

function TicketRow({ k, v, sub, tone = "text-ink", className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="micro truncate">{k}</dt>
      <dd className={`font-num mt-0.5 text-[18px] leading-none font-bold ${tone}`}>{v}</dd>
      {sub && <dd className="mt-1 truncate text-[11px] text-ink-3" title={sub}>{sub}</dd>}
    </div>
  );
}

function RiskTicket({ symbol, reading, rp, n, className = "" }) {
  const t = strings(dict);
  const sup = reading?.levels?.support?.[0]?.dist_pct;
  return (
    <Panel id="risk-plan" className={`scroll-mt-32 ${className}`} infoLabel={t("sp.info")}
      info={rp ? `${t("ckc.risk.paper", { atr: `${rp.atr.toFixed(1)}%` })}${rp.tp1.byConstruction ? ` ${t("ckc.risk.byConstruction")}` : ""} ${t("sp.ticket.info", { min: rp.min })}` : t("sp.ticket.info", { min: 2 })}
      head={<TermHead id="risk-plan-h" n={n} title={t("sp.ticket.title")} />} badge={<Chip tone="ghost">{t("sp.ticket.paper")}</Chip>}>
      {rp ? (
        <div className="stock-ticket relative overflow-hidden rounded-tile border border-dashed border-line-3 bg-surface-2/60">
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-line-3 px-3.5 py-2">
            <span className="micro">{t("sp.ticket.kicker")}</span>
            <span className="font-num text-[11px] text-ink-3">{noYear(reading.as_of)}</span>
          </div>
          <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
            <div className="min-w-0">
              <p className="font-num text-[24px] leading-none font-bold text-ink">{symbol}</p>
              <p className="micro mt-1.5">{t("sp.ticket.side")}</p>
            </div>
            <Stamp kind={rp.fits ? "approved" : "wait"} size="md" rotate={-7} className="mt-1 me-1">{t(rp.fits ? "sp.ticket.approved" : "sp.ticket.wait")}</Stamp>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 px-3.5 py-3 sm:grid-cols-3 lg:grid-cols-2">
            <TicketRow className="col-span-2 sm:col-span-1 lg:col-span-2" k={t("sp.ticket.entry")}
              v={isNum(sup) && sup < 0 ? t("sp.ticket.entryV", { to: fmtPct(sup, 1) }) : t("sp.ticket.entryClose")} sub={t(isNum(sup) && sup < 0 ? "sp.ticket.entrySub" : "sp.ticket.entrySubNone")} />
            <TicketRow k={t("sp.ticket.stop")} v={fmtPct(-rp.stop.pct, 1)} sub={rp.stop.basis} tone="text-down" />
            <TicketRow k={t("sp.ticket.tp1")} v={fmtPct(rp.tp1.pct, 1)} sub={rp.tp1.short ?? rp.tp1.basis} tone="text-up" />
            <TicketRow k={t("sp.ticket.tp2")} v={fmtPct(rp.tp2.pct, 1)} sub={rp.tp2.basis} tone="text-up" />
            <TicketRow k={t("sp.ticket.rr")} v={rrText(rp.rr1, rp.min)} sub={t("sp.ticket.need", { min: rp.min })} tone={rp.fits ? "text-up" : "text-wait"} />
          </dl>
          <RRBar stop={rp.stop.pct} tp1={rp.tp1.pct} tp2={rp.tp2.pct} />
        </div>
      ) : <EmptyState compact title={t("sp.ticket.none")}>{t("ckc.risk.none")}</EmptyState>}
    </Panel>
  );
}

function QuickChecks({ checks, passed, gate, go, n, className = "" }) {
  const t = strings(dict);
  return (
    <Panel id="quick-checks" className={`scroll-mt-32 ${className}`} info={t("sp.checks.lede")} infoLabel={t("sp.info")}
      head={<TermHead id="quick-checks-h" n={n} title={t("sp.checks.title")} />}
      badge={<Chip tone={passed >= 3 ? "up" : "wait"}>{t("sp.checks.badge", { passed })}</Chip>}>
      <ul className="divide-y divide-line rounded-tile border border-line">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5 px-3 py-2">
            <span className="pt-0.5"><StepMark state={c.pass ? "done" : "fail"} label={t(c.pass ? "sp.checks.pass" : "sp.checks.fail")} className="size-3.5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-snug text-ink">{c.label}</span>
              <span className="font-num mt-0.5 block text-[11px] leading-snug text-ink-3">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {gate && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="micro text-desk">{t("sp.gate.title")}</h3>
            <Chip tone={gate.ok ? "up" : "wait"}>{t(gate.ok ? "sp.gate.yesShort" : "sp.gate.noShort")}</Chip>
          </div>
          <ul className="mt-1.5 grid gap-1.5">
            {gate.reasons.map((r) => (
              <li key={r.text} className="flex items-start gap-2 text-[12.5px] leading-snug">
                <span className="pt-0.5"><StepMark state={r.ok ? "done" : "wait"} label={t(r.ok ? "sp.checks.pass" : "sp.gate.notYet")} className="size-3" /></span>
                <span className={r.ok ? "text-ink" : "text-ink-2"}>{r.text}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => go("admin")} className="micro -mb-2 inline-flex min-h-[44px] items-center gap-1 text-ink-2 hover:text-ink">{t("bwc.rules")} <ArrowRight className="size-3.5" /></button>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ the company */

/** Why the card may be out of date, in words: firm only when the company confirmed the date that has passed. */
function staleWords(s, t) {
  if (!s) return null;
  if (s.kind === "passed" && s.confirmed) return t("sp.stale.out");
  if (s.kind === "passed") return t("sp.stale.passed", { date: dayOnly(s.date) });
  return t("sp.stale.probably");
}

/** One "what's next" item as a tight card: kind, when, the line and its link. */
function NewsItem({ w }) {
  return (
    <li className="tile px-3 py-2">
      <p className="micro flex flex-wrap gap-x-2"><span className="text-desk">{KIND_LABEL[w.kind] ?? w.kind}</span><span>{w.when}</span></p>
      <p className="mt-1 text-[13px] leading-snug text-ink">{w.item}<Src url={w.source_url} /></p>
    </li>
  );
}

function WhatsNext({ card, symbol, today, hasFile, n, className = "" }) {
  const t = strings(dict);
  if (!card) {
    return (
      <Panel id="whats-next" className={`scroll-mt-32 ${className}`} info={t("sp.next.how")} infoLabel={t("sp.info")}
        head={<TermHead id="whats-next-h" n={n} title={t("sp.next.title")} />}>
        <EmptyState compact title={hasFile ? t("sp.next.noCard", { symbol }) : t("sp.next.noCards")}>{t("sp.next.howShort")}</EmptyState>
      </Panel>
    );
  }
  const { latest: lt, guidance: g, next_earnings: ne } = card;
  const stale = staleWords(staleness(card, today), t);
  const groups = splitWhatsNext(card.whats_next, today);
  const items = [...groups.ahead, ...groups.recent, ...groups.other];
  const days = daysUntil(ne.date, today);
  const growth = growthWords(lt.revenue_growth_yoy_pct);
  return (
    <Panel id="whats-next" className={`scroll-mt-32 ${className}`} info={t("sp.next.foot")} infoLabel={t("sp.info")}
      head={<TermHead id="whats-next-h" n={n} title={t("sp.next.title")} sub={t("sp.next.researched", { date: dayOnly(card.as_of) })} />}
      badge={stale && <Chip tone="wait" title={stale}>{t("sp.next.maybeOld")}</Chip>}>
      {stale && <p className="mb-3 rounded-tile border border-dashed border-wait/50 px-3 py-2 text-[12.5px] leading-snug text-wait">{stale}</p>}
      <ReadMore text={card.business} lines={2} className="text-[13.5px] leading-snug text-ink-2" />
      <div className="mt-3 grid gap-1.5 @container md:grid-cols-3">
        <div className="tile px-3 py-2.5">
          <p className="micro text-desk">{t("sp.next.results")}</p>
          {ne.date ? (
            <>
              <p className="font-num mt-1.5 text-[22px] leading-none font-bold text-ink">{dayOnly(ne.date).replace(/\s\d{4}$/, "")}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {days != null && <Chip tone={days >= 0 && days <= 7 ? "brand" : "neutral"}>{inDays(days)}</Chip>}
                {!ne.confirmed && <Chip tone="ghost">{t("sp.next.expected")}</Chip>}
              </p>
            </>
          ) : <p className="mt-1.5 text-[13.5px] text-ink-2">{t("sp.next.notAnnounced")}</p>}
          {ne.note ? <ReadMore text={ne.note} lines={2} min={90} className="mt-1.5 text-[12px] leading-snug text-ink-3"><Src url={ne.source_url} /></ReadMore> : <Src url={ne.source_url} />}
        </div>
        <div className="tile px-3 py-2.5">
          <p className="micro text-desk">{t("sp.next.money", { period: lt.period })}</p>
          <p className="mt-1.5 text-[15px] leading-snug font-semibold text-ink">{t("sp.next.sales", { revenue: lt.revenue })}</p>
          <p className="font-num mt-1 text-[11.5px] text-ink-3">{growth ? `${growth} · ` : ""}{t("sp.next.reported", { date: dayOnly(lt.reported_on) })}<Src url={lt.source_url} /></p>
          {lt.highlights?.length > 0 && (
            <ul className="mt-2 grid gap-1 text-[12.5px] leading-snug text-ink-2">
              {lt.highlights.slice(0, 2).map((h) => <li key={h} className="flex gap-2"><span aria-hidden="true" className="mt-[6px] size-[5px] shrink-0 rotate-45 bg-ink-3" /><span className="line-clamp-2">{h}</span></li>)}
            </ul>
          )}
        </div>
        <div className="tile px-3 py-2.5">
          <p className="micro text-desk">{g.given && g.period ? t("sp.next.outlookPeriod", { period: g.period }) : t("sp.next.outlook")}</p>
          <ReadMore text={g.text} lines={4} min={140} className={`mt-1.5 text-[12.5px] leading-snug ${g.given ? "text-ink" : "text-ink-2"}`}><Src url={g.source_url} /></ReadMore>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-3">
          <h3 className="micro mb-1.5">{t("sp.next.other")}</h3>
          <ul className="grid gap-1.5 md:grid-cols-2">{items.slice(0, 4).map((w) => <NewsItem key={w.item} w={w} />)}</ul>
          {items.length > 4 && (
            <div className="mt-1.5"><Fold title={t("sp.next.moreNews")} count={items.length - 4}><ul className="grid gap-1.5 md:grid-cols-2">{items.slice(4).map((w) => <NewsItem key={w.item} w={w} />)}</ul></Fold></div>
          )}
        </div>
      )}
      <div className="mt-2">
        <Fold title={t("sp.next.watch")} count={card.watch.length} tone="bg-wait">
          {card.watch.length ? (
            <ul className="grid gap-1.5 text-[13px] leading-snug text-ink-2">
              {card.watch.map((w) => <li key={w.item} className="flex gap-2"><span aria-hidden="true" className="mt-[6px] size-[5px] shrink-0 rotate-45 bg-wait" /><span>{w.item}<Src url={w.source_url} /></span></li>)}
            </ul>
          ) : <p className="text-[13px] text-ink-3">{t("sp.next.noRisks")}</p>}
        </Fold>
      </div>
    </Panel>
  );
}

/** A fund's card (config/funds.json): what it holds, the index it follows, its yearly cost and a note, with its source. */
function WhatsInside({ fund, symbol, n, className = "" }) {
  const t = strings(dict);
  const cost = costWords(fund.expense_ratio_pct);
  return (
    <Panel id="whats-inside" className={`scroll-mt-32 ${className}`} info={`${t("sp.inside.foot")} ${t("sp.inside.costWhat")}`} infoLabel={t("sp.info")}
      head={<TermHead id="whats-inside-h" n={n} title={t("sp.inside")} sub={fund.as_of ? t("sp.inside.checked", { date: dayOnly(fund.as_of) }) : null} />}>
      {fund.plain ? <ReadMore text={fund.plain} lines={3} className="text-[14.5px] leading-snug text-ink" />
        : <p className="text-[13.5px] leading-snug text-ink-2">{t("sp.inside.noneShort", { symbol })}</p>}
      {fund.ticker && (
        <dl className="mt-3 grid gap-1.5 md:grid-cols-3">
          <div className="tile min-w-0 px-3 py-2.5">
            <dt className="micro text-desk">{t("sp.inside.holds")}</dt>
            <dd className="mt-1 text-[13px] leading-snug text-ink">{fund.holds}</dd>
          </div>
          <div className="tile min-w-0 px-3 py-2.5">
            <dt className="micro text-desk">{t("sp.inside.index")}</dt>
            <dd className="mt-1 text-[13px] leading-snug text-ink">{fund.index_tracked}{fund.category ? <span className="block text-[12px] text-ink-3">{fund.category}</span> : null}</dd>
          </div>
          <div className="tile min-w-0 px-3 py-2.5">
            <dt className="micro text-desk">{t("sp.inside.cost")}</dt>
            <dd className="font-num mt-1 text-[18px] leading-none font-bold text-ink">{cost ?? t("sp.inside.notListed")}</dd>
          </div>
        </dl>
      )}
      {fund.top_note && <ReadMore text={fund.top_note} lines={2} className="mt-3 rounded-tile border border-line px-3 py-2 text-[13px] leading-snug text-ink-2" />}
      {fund.source_url && <p className="mt-2 text-[12.5px] text-ink-3">{t("sp.inside.from")}<Src url={fund.source_url} /></p>}
    </Panel>
  );
}

const NUM_TONE = { accent: "bg-up", down: "bg-down" };

/** What the company itself reported to the SEC, in plain sentences (data/market/fundamentals.json). Hidden until the
 *  first SEC run has numbers for this name. It describes the business, not the stock. */
function CompanyNumbers({ c, n, className = "" }) {
  const t = strings(dict);
  const w = fundamentalsWords(c);
  if (!w || !w.lines.length) return null;
  return (
    <Panel id="company-numbers" className={`scroll-mt-32 ${className}`} info={`${w.period} ${t("sp.numbers.foot")}`} infoLabel={t("sp.info")}
      head={<TermHead id="company-numbers-h" n={n} title={t("sp.numbers.short")} />} badge={w.stale && <Chip tone="wait">{t("sp.numbers.old")}</Chip>}>
      <ul className="grid gap-1.5">
        {w.lines.map((l) => (
          <li key={l.id ?? l.label} className="tile flex gap-2.5 px-3 py-2">
            <span className={`mt-1.5 size-2 shrink-0 rotate-45 ${NUM_TONE[l.tone] ?? "bg-ink-3"}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="micro block">{l.label}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink">{l.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const KIND_TONE = { accent: "up", down: "down", people: "wait", ai: "ai", flat: "neutral" };

/** What the company itself announced lately, from its SEC filings (data/market/sec_news.json): date, plain title, link. */
function OfficialNews({ rows, n, className = "" }) {
  const t = strings(dict);
  if (!rows.length) return null;
  return (
    <Panel id="official-news" className={`scroll-mt-32 ${className}`} info={`${t("sp.news.lede")} ${t("sp.news.foot")}`} infoLabel={t("sp.info")}
      head={<TermHead id="official-news-h" n={n} title={t("sp.news.short")} />}>
      <ul className="grid gap-1.5">
        {rows.map((r) => (
          <li key={r.url}>
            <a href={r.url} {...ext} className="flex min-h-[44px] items-start gap-2.5 rounded-tile border border-line bg-surface-2/50 px-3 py-2 transition-colors hover:border-line-3">
              <Chip tone={KIND_TONE[r.tone] ?? "neutral"} className="mt-0.5 shrink-0">{r.word}</Chip>
              <span className="min-w-0">
                <span className="block text-[13px] leading-snug text-ink">{r.title}</span>
                <span className="font-num mt-0.5 block text-[11px] text-ink-3">{t("sp.news.form", { day: r.day, form: r.form })}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const CONF_TONE = { accent: "up", flat: "neutral", people: "wait" };

/** Why this name moved on its unusual days of the last month (data/market/why.json via lib/why.js), newest first. */
function WhyItMoved({ notes, names, n, className = "" }) {
  const t = strings(dict);
  if (!notes.length) return null;
  return (
    <Panel id="why-it-moved" className={`scroll-mt-32 ${className}`} info={t("sp.why.lede")} infoLabel={t("sp.info")}
      head={<TermHead id="why-it-moved-h" n={n} title={t("sp.why.title")} />} badge={<Chip tone="ghost">{t("sp.why.count", { count: notes.length })}</Chip>}>
      <ul className="grid gap-1.5">
        {notes.map((note) => {
          const v = noteView(note, { names });
          return (
            <li key={v.key} className="tile px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-num text-[11.5px] font-semibold text-ink-2">{dayOnly(v.date).replace(/\s\d{4}$/, "")}</span>
                {v.move_pct != null && <Delta value={v.move_pct} d={1} chip arrow />}
                <Chip tone={CONF_TONE[v.tone] ?? "neutral"} className="ms-auto">{v.word}</Chip>
              </div>
              <p className="mt-1.5 text-[14px] leading-snug font-semibold text-ink">{v.headline}.</p>
              {v.why && <ReadMore text={v.why} lines={2} min={120} className="mt-1 text-[12.5px] leading-snug text-ink-2" />}
              <div className="[&>p]:mt-1 [&>p]:text-[11.5px]"><NoteSources v={v} /></div>
            </li>
          );
        })}
      </ul>
      <WhyFooter className="mt-2 !text-[12px] leading-snug" />
    </Panel>
  );
}

function LongRun({ long, data, row, bench, n, className = "" }) {
  const t = strings(dict);
  const goal = data.settings.goal.annual_return_pct;
  const cells = [
    ["cagr", long.cagr_pct, false, t("sp.long.cagr"), long.cagr_pct >= goal ? "text-up" : "text-ink"],
    ["hit", long.hit_goal_12m_pct, true, t("sp.long.hit", { goal: `+${goal}%` }), "text-ink"],
    ["loss", long.loss_12m_pct, true, t("sp.long.loss"), "text-ink"],
    ["worst", long.worst_12m_pct, false, t("sp.long.worst"), "text-down"],
    ["dd", long.max_dd_pct, false, t("sp.long.dd"), "text-down"],
    ["held", long.held_pct, true, t("sp.long.held"), "text-ink"],
  ];
  return (
    <Panel id="long-run" className={className} infoLabel={t("sp.info")}
      info={<>{t("sp.long.lede")} {row.risk && rich(t, "sp.long.risk", {
        vol: pctText(row.risk.vol_1y_pct, 0), bench: bench.symbol, beta: `${row.risk.beta_1y ?? "–"}%`,
        loss: <span className="text-down">{fmtPct(row.risk.loss_95_20d_pct, 0)}</span>,
      })}</>}
      head={<TermHead id="long-run-h" n={n} title={t("sp.long.short", { goal: `+${goal}%` })} sub={t("sp.long.spanShort", { from: data.longrun.from.slice(0, 4), to: data.longrun.to.slice(0, 4) })} />}>
      <div className="grid grid-cols-3 gap-1.5">
        {cells.map(([k, v, plain, l, tone]) => (
          <div key={k} className="tile min-w-0 px-2.5 py-2">
            <p className={`text-[19px] leading-none font-bold ${tone}`}><CountPct value={v} d={0} plain={plain} /></p>
            <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{l}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ the notebook */

function Lessons({ lessons, go, n, className = "" }) {
  const t = strings(dict);
  return (
    <Panel className={className} info={t("sp.lessons.lede")} infoLabel={t("sp.info")} head={<TermHead n={n} title={t("sp.lessons.title")} />}
      badge={<button type="button" onClick={() => go("insights")} className="micro -my-2 inline-flex min-h-[44px] items-center gap-1 hover:text-ink">{t("mb.lessons.link")} <ArrowRight className="size-3" /></button>}>
      {lessons.length ? (
        <ol className="grid gap-1.5">
          {lessons.map(({ why, p }) => (
            <li key={p.id} className="tile px-3 py-2.5">
              <p className="micro text-desk">{t(why)}</p>
              <ReadMore text={p.text} lines={3} min={140} className="mt-1 text-[13px] leading-snug text-ink" />
              <p className="font-num mt-1 truncate text-[10.5px] text-ink-3" title={p.source.title}>{p.id} · {(p.source.title.match(/\(([^()]*)\)\s*$/) || [, p.source.title])[1]}</p>
            </li>
          ))}
        </ol>
      ) : <p className="text-[13px] text-ink-3">{t("sp.lessons.none")}</p>}
    </Panel>
  );
}

function Guess({ picks, sample, symbol, settings, n, className = "" }) {
  const t = strings(dict);
  const head = sample ? rich(t, "sp.guess.sampleHead", { m: <span className="text-desk">M3.</span> })
    : picks.length ? `${STANCE_KEY[picks[0].stance] ? t(STANCE_KEY[picks[0].stance]) : cap(picks[0].stance)}, ${SURE_KEY[picks[0].conviction] ? t(SURE_KEY[picks[0].conviction]) : t("sp.guess.conviction", { level: picks[0].conviction })}`
      : t("sp.guess.none");
  return (
    <Panel className={className} infoLabel={t("sp.info")}
      info={sample ? rich(t, "sp.guess.sample", { symbol, days: settings.scoring.horizon_days, made: <span className="text-ink">{t("sp.guess.made")}</span> }) : t("sp.guess.info")}
      head={<TermHead n={n} title={t("sp.guess.eyebrow")} />} badge={sample && <Chip tone="people">{t("sp.guess.samplePill")}</Chip>}>
      <p className="headline text-[22px] text-ink">{head}</p>
      {picks.length ? (
        <>
          <ul className="mt-2 grid gap-1.5"><PickCard k={picks[0]} sample={sample} /></ul>
          {picks.length > 1 && (
            <div className="mt-1.5">
              <Fold title={t("sp.guess.earlier")} count={Math.min(3, picks.length - 1)}>
                <ul className="grid gap-1.5">{picks.slice(1, 4).map((k) => <PickCard key={k.id} k={k} sample={sample} />)}</ul>
              </Fold>
            </div>
          )}
        </>
      ) : <p className="mt-1 text-[13px] text-ink-3">{t("sp.guess.emptyBody")}</p>}
    </Panel>
  );
}

/** One of the brain's guesses: its id, how sure, which way, how it went, the thesis and what would prove it wrong. */
function PickCard({ k, sample }) {
  const t = strings(dict);
  return (
    <li className={`tile px-3 py-2.5 ${sample ? "border-dashed" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-num truncate text-[10.5px] text-ink-3">{k.id}</span>
        <Conviction level={k.conviction} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Chip kind={k.stance} />
        <Chip kind={k.verdict}>{k.verdict === "pending" ? "pending" : <>{k.verdict} {fmtPct(k.outcome.excess_pct, 1)}</>}</Chip>
      </div>
      <ReadMore text={k.thesis} lines={2} min={110} className="mt-1.5 text-[13px] leading-snug text-ink" />
      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-2"><span className="micro me-1.5">{t("sp.guess.wrongIf")}</span>{k.invalidation}</p>
    </li>
  );
}

function People({ claims, live, symbol, today, n, className = "" }) {
  const t = strings(dict);
  return (
    <Panel className={className} info={t("sp.people.eyebrow")} infoLabel={t("sp.info")}
      head={<TermHead n={n} title={t("sp.people.title", { symbol })} />}
      badge={<Chip tone="ghost">{t("sp.people.counts", { live, old: claims.length - live })}</Chip>}>
      {claims.length ? (
        <ul className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
          {claims.map((c) => {
            const expired = c.expires < today;
            return (
              <li key={c.id} className={`tile px-3 py-2.5 ${expired ? "border-dashed opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-num truncate text-[10.5px] text-ink-3">{c.id} · {c.as_of}</span>
                  <Chip tone={expired ? "ghost" : "people"}>{expired ? t("sp.people.tooOld") : t.has(`sp.claim.${c.status}`) ? t(`sp.claim.${c.status}`) : c.status}</Chip>
                </div>
                <ReadMore text={c.text} lines={3} min={140} className="mt-1.5 text-[13px] leading-snug text-ink" />
              </li>
            );
          })}
        </ul>
      ) : <p className="text-[13px] text-ink-3">{t("sp.people.emptyBody", { symbol })}</p>}
    </Panel>
  );
}

/* ------------------------------------------------------------------ the line against the market */

function StockChart({ row, bench, benchSymbol, picks }) {
  const t = strings(dict);
  const [range, setRange] = useState(126);
  const [ref, inView] = useInView();
  const [hover, setHover] = useState(null);
  const svg = useRef(null);
  const box = useRef(null);
  // Draw at real pixel size so axis text stays readable on phones.
  const [W, setW] = useState(1000);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const full = row.series ?? row.spark.map((p) => ({ date: p.date, v: p.v }));
  const maxRange = full.length;
  const n = Math.min(range, maxRange);

  const { pts, bpts, spts, lo, hi, dates } = useMemo(() => {
    const s = full.slice(-n);
    const base = s[0].v;
    const bmap = bench ? Object.fromEntries((bench.series ?? bench.spark).map((p) => [p.date, p.v])) : {};
    const bbase = bench ? bmap[s[0].date] : null;
    const pts = s.map((p) => p.v / base * 100);
    const bpts = bench && bbase ? s.map((p) => (bmap[p.date] != null ? bmap[p.date] / bbase * 100 : null)) : [];
    const spts = s.map((p) => (p.sma50 != null ? p.sma50 / base * 100 : null));
    const all = [...pts, ...bpts.filter((v) => v != null), ...spts.filter((v) => v != null)];
    return { pts, bpts, spts, lo: Math.min(...all), hi: Math.max(...all), dates: s.map((p) => p.date) };
  }, [full, n, bench]);

  const narrowW = W < 640;
  const H = narrowW ? 260 : 360, L = narrowW ? 34 : 44, R = narrowW ? 54 : 64, T = 14, B = 28;
  const x = (i) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R);
  const pad = (hi - lo) * 0.08 || 1;
  const y = (v) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const path = (arr) => arr.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p}`).join("");
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v));
  const up = pts.at(-1) >= 100;
  const color = up ? "var(--up)" : "var(--down)";
  const markers = picks.map((k) => ({ k, i: dates.indexOf(k.date) })).filter((m) => m.i >= 0);

  const onMove = (e) => {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };
  const h = hover;
  const labelEvery = Math.ceil(pts.length / (narrowW ? 3 : 5));
  const at = h ?? pts.length - 1;

  return (
    <div ref={ref}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="micro"><span className="text-desk">{t("sp.chart.since")}</span> {fmtDate(dates[0]).replace(/\s\d{4}$/, "")} → {fmtDate(dates[at]).replace(/\s\d{4}$/, "")}</p>
          <p className={`font-num mt-1 text-[clamp(32px,8vw,44px)] leading-none font-bold tracking-[-0.04em] ${toneOf(pts[at] - 100)}`}>{fmtPct(pts[at] - 100, 1)}</p>
          {bpts[at] != null && <p className="font-num mt-1.5 text-[12px] text-ink-3">{benchSymbol} <span className={toneOf(bpts[at] - 100)}>{fmtPct(bpts[at] - 100, 1)}</span></p>}
        </div>
        <Segmented label={t("sp.chart.range")} value={range} onChange={setRange} options={RANGES.filter((r) => r <= Math.max(21, maxRange)).map((r) => ({ value: r, label: t(`sp.range.${r}`) }))} />
      </div>
      <div className="micro mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2"><i className="h-[3px] w-5 rounded" style={{ background: color }} />{row.symbol}</span>
        {bench && <span className="inline-flex items-center gap-2"><i className="w-5 border-t-2 border-dashed border-ink-3" />{t("sp.chart.whole", { bench: benchSymbol })}</span>}
        <span className="inline-flex items-center gap-2"><i className="w-5 border-t border-dashed border-ink-2" />{t("sp.chart.usual")}</span>
      </div>
      <div ref={box} className="relative mt-2">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y overflow-visible" role="img"
          aria-label={t(bench ? "sp.chart.ariaBench" : "sp.chart.aria", { symbol: row.symbol, n, bench: benchSymbol })}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 100 ? "var(--line-2)" : "var(--line)"} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[10.5px]">{v}</text>
            </g>
          ))}
          {lo < 100 && hi > 100 && <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} stroke="var(--line-2)" strokeDasharray="2 4" />}
          {dates.map((d, i) => i % labelEvery === 0 && (
            <text key={d} x={Math.max(L + 18, x(i))} y={H - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[10.5px]">{fmtShort(d)}</text>
          ))}
          <path d={path(spts)} fill="none" stroke="var(--ink-2)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" vectorEffect="non-scaling-stroke" />
          {bpts.length > 0 && <path d={path(bpts)} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          <path d={path(pts)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            style={{ opacity: inView ? 1 : 0, transition: "opacity 900ms cubic-bezier(.16,1,.3,1)" }} />
          {/* end tags */}
          <rect x={W - R + 4} y={y(pts.at(-1)) - 8} width={R - 6} height={16} rx={3} fill={color} />
          <text x={W - 6} y={y(pts.at(-1)) + 3.8} textAnchor="end" className="font-mono text-[10.5px] font-bold" fill="var(--bg)">{fmtPct(pts.at(-1) - 100, 1)}</text>
          {bpts.length > 0 && bpts.at(-1) != null && Math.abs(y(bpts.at(-1)) - y(pts.at(-1))) > 16 && (
            <text x={W - 6} y={y(bpts.at(-1)) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[10.5px]">{fmtPct(bpts.at(-1) - 100, 1)}</text>
          )}
          {markers.map(({ k, i }) => (
            <circle key={k.id} cx={x(i)} cy={y(pts[i])} r="6" stroke="var(--surface)" strokeWidth="2"
              fill={k.stance === "bullish" ? "var(--up)" : k.stance === "bearish" ? "var(--down)" : "var(--flat)"} />
          ))}
          {h != null && (
            <g>
              <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="var(--ink-3)" strokeDasharray="3 3" />
              <circle cx={x(h)} cy={y(pts[h])} r="5" fill={color} stroke="var(--surface)" strokeWidth="2" />
              {bpts[h] != null && <circle cx={x(h)} cy={y(bpts[h])} r="4" fill="var(--ink-3)" stroke="var(--surface)" strokeWidth="2" />}
            </g>
          )}
        </svg>
      </div>
      {!row.series && <p className="micro mt-2">{t("sp.chart.short", { n: full.length })}</p>}
    </div>
  );
}
