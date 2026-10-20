import { useEffect, useMemo, useRef, useState } from "react";
import { fmtPct, cap, signTone } from "../lib/format.js";
import { ltr, translate } from "../lib/i18n.js";
import { Auto, Bdi, En, EnglishNote, useLang } from "../lib/lang.jsx";
import dict from "../i18n/stock.js";
import shell from "../i18n/shell.js";
import { useInView } from "../lib/motion.js";
import { Accent, ArrowRight, Chip, Container, Conviction, Empty, Headline, Reveal, Segmented, Strip } from "../components/ui.jsx";
import { STAGES, trustStage } from "../components/trust.jsx";
import { STATUS } from "../components/goal.jsx";
import { companyNumbers, fundamentalsWords } from "../lib/fundamentals.js";
import { newsRows } from "../lib/secnews.js";
import { notesForSymbol, noteView, usableWhy } from "../lib/why.js";
import { WhyFooter, WhyNote } from "../components/why.jsx";
import { CandleZoom } from "../components/zoom.jsx";
import { cardFor, daysUntil, growthWords, inDays, kindLabel, splitWhatsNext, staleness, todayISO } from "../lib/outlook.js";
import { gateReason, rowFor } from "../lib/checklist.js";
import { ChecklistCard, useChecklistView, VerdictPill } from "../components/checklist.jsx";
import { briefFooter, direction, eightChecks, readable, setupState, stepName, wherePaper } from "../lib/brief.js";
import { shortName, whenWords } from "../lib/simple.js";
import { loadMarket } from "../lib/data.js";
import { candlesOf, costWords, fundCard, notYet, resolveSymbolMarket } from "../lib/markets.js";
import { buyWindowFor, mainListOf, mainWatchlistOf, sp500Of } from "../lib/buywindow.js";
import { stocksEarned } from "../lib/money.js";
import { BuyWindowCard } from "../components/buywindow.jsx";

/** A trust stage's name (components/trust.jsx STAGES, English there) in a language. */
const stageName = (stage, t) => (t.has(`st.stage.${stage}`) ? t(`st.stage.${stage}`) : STAGES[stage].name);
/** The practice portfolio rule's status (components/goal.jsx STATUS, English there) in a language. */
const statusLabel = (status, t) => (t.lang !== "en" && t.has(`st.status.${status}`) ? t(`st.status.${status}`) : STATUS[status].label);
/** A whole-number percent that reads left to right inside a Hebrew line ("12%"). */
const pctText = (v, d, lang) => { const s = `${Number(v).toFixed(d)}%`; return lang === "he" ? ltr(s) : s; };

/** Plain-language summary, assembled by code from the computed numbers (no model), in `lang`. */
function plainWords(row, checks, benchSymbol, benchLabel, liveClaims, settings, baseRate, lang = "en") {
  const t = translate(dict, lang);
  const out = [];
  const pct = (v) => `${Math.abs(v).toFixed(1)}%`;
  out.push(t(row.ret_20d_pct >= 0 ? "sp.pw.monthUp" : "sp.pw.monthDown", { symbol: row.symbol, pct: pct(row.ret_20d_pct) }));
  if (row.vs_bench_20d_pct != null) {
    out.push(t(row.vs_bench_20d_pct >= 0 ? "sp.pw.better" : "sp.pw.worse", { pts: Math.abs(row.vs_bench_20d_pct).toFixed(1), bench: benchLabel }));
  }
  out.push(t(row.dist_sma50_pct > 0 ? "sp.pw.above" : "sp.pw.below"));
  if (row.dist_sma50_pct >= settings.setup.stretch_pct) out.push(t("sp.pw.stretched", { pct: pct(row.dist_sma50_pct) }));
  else if (row.from_high_pct != null && row.from_high_pct > -2) out.push(t("sp.pw.nearHigh"));
  else if (row.from_high_pct != null && row.from_high_pct < -20) out.push(t("sp.pw.farBelow", { pct: pct(row.from_high_pct) }));
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
function actGate(data, row, checks, lang = "en") {
  const t = translate(dict, lang);
  const { stage } = trustStage(data);
  const passed = checks.filter((c) => c.pass).length;
  const st = data.longrun?.now.status.find((x) => x.symbol === row.symbol);
  const held = st && (st.status === "kept" || st.status === "added");
  const stretched = row.setup?.stretched ?? !checks.find((c) => c.id === "calm").pass;
  const status = st ? statusLabel(st.status, t) : null;
  const reasons = [
    { ok: stage >= 2, text: t(stage >= 2 ? "sp.gate.trusted" : "sp.gate.untrusted", { stage, name: stageName(stage, t) }) },
    { ok: Boolean(held), text: st ? (held ? t("sp.gate.held") : t("sp.gate.left", { status: lang === "en" ? status.toLowerCase() : status })) : t("sp.gate.noRule") },
    { ok: passed >= 3 && !stretched, text: stretched ? t("sp.gate.stretched") : t("sp.gate.checks", { passed }) },
    // This site's rules, Before acting step 4: the checklist read and a written risk plan with reward-to-risk to TP1 of at least 2.
    gateReason(data.checklist, rowFor(data.checklist, row.symbol), data.checklistCfg, row.last_date, lang),
  ];
  return { ok: reasons.every((r) => r.ok), reasons };
}

// The brain's lean and how sure it is, in everyday words (the data keeps bullish/bearish and low/medium/high).
const STANCE_KEY = { bullish: "sp.stance.bullish", bearish: "sp.stance.bearish", neutral: "sp.stance.neutral" };
const SURE_KEY = { low: "sp.sure.low", medium: "sp.sure.medium", high: "sp.sure.high" };

const RANGES = [21, 63, 126, 252]; // trading days; labels "sp.range.<n>"

/** Setup checks v2, computed in Python (derived.json `setup`; docs/methodology.md). Not a recommendation. */
export function setupChecks(row, bench, settings, lang = "en") {
  const t = translate(dict, lang);
  const p = (v) => fmtPct(v, 1, lang);
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

/**
 * A stock (or fund) page for a symbol of any market. The chosen market's data is used when it has the symbol; otherwise
 * the page finds the market that lists it (lib/markets.js resolveSymbolMarket) and moves the header switch there, so
 * stock/TEVA opens in TLV and stock/IVV in iShares from any link.
 */
export default function StockPage({ data, market, symbol, go }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
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
    <Container className="pt-20">
      {waiting ? <p role="status" className="text-[18px] text-ink-2">{t("sp.opening", { symbol })}</p>
        : market?.state === "error" ? (
          <Empty title={t("sp.loadError", { label })}>
            <button type="button" onClick={market.retry} className="btn mt-2 min-h-[52px] justify-center">{t("cdv.retry")}</button>
          </Empty>
        )
        : found.id && found.id === market?.id ? <Empty title={`${symbol} · ${label}`}>{market.state === "none" ? notYet(lang) : t("sp.nightly")}</Empty>
        : <Empty title={t("sp.notListed.title", { symbol })}>{t("sp.notListed.body")}</Empty>}
    </Container>
  );
}

function Stock({ data, symbol, go, market: mk }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  const chip = tr(shell);
  const code = (k) => (lang !== "en" && chip.has(`ui.chip.${k}`) ? chip(`ui.chip.${k}`) : k);
  const { market, bench, names, kb, observations, library, settings, sample, watchlist } = data;
  const isDefault = !mk || mk.isDefault;
  const entry = data.marketEntry ?? mk?.entry ?? null;
  const fund = entry?.kind === "funds" ? fundCard(data.funds, symbol) ?? {} : null;
  // The checklist card's view (Checks or Candles), remembered per device; the brief's "See it on the candles" sets it.
  const [ckView, setCkView] = useChecklistView();
  const [zoom, setZoom] = useState(false);
  const row = market.symbols.find((s) => s.symbol === symbol);
  const benchRow = market.symbols.find((s) => s.symbol === bench.symbol);
  if (!row) {
    return (
      <Container className="pt-20">
        <Empty title={t("sp.notOnList.title", { symbol })}>{t("sp.notOnList.body")}</Empty>
      </Container>
    );
  }
  const isBench = symbol === bench.symbol;
  const checks = setupChecks(row, bench.symbol, settings, lang);
  const passed = checks.filter((c) => c.pass).length;
  const aliases = [symbol, ...((watchlist.symbols ?? []).find((s) => s.symbol === symbol)?.aliases ?? [])];
  const today = todayISO();
  const claims = (observations?.items ?? []).filter((o) => o.tickers.some((x) => aliases.includes(x))).sort((a, b) => b.as_of.localeCompare(a.as_of));
  const liveClaims = claims.filter((c) => c.expires >= today);
  const picks = kb.filter((k) => k.ticker === symbol);
  const lessons = stockLessons(row, checks, library);
  const others = market.symbols.filter((s) => s.symbol !== bench.symbol);
  const words = plainWords(row, checks, bench.symbol, bench.label, liveClaims.length, settings, market.base_rates, lang);
  const gate = isBench || !isDefault ? null : actGate(data, row, checks, lang);
  const long = data.longrun?.members.find((m) => m.symbol === symbol);
  const goal = settings.goal.annual_return_pct;
  const idx = others.findIndex((s) => s.symbol === symbol);
  const ckRow = rowFor(data.checklist, symbol);
  // "When would the rules allow a buy?": this site's rules' answer for this name (lib/buywindow.js). The rules' look
  // covers the main list only; a main-list name opened from another list still gets it.
  const buy = isBench ? null : buyWindowFor(symbol, {
    today, derived: market, checklist: data.checklist, bw: data.buyWindow, mainList: mainListOf(data), fund,
    stocksEarned: stocksEarned(data.rulesResult, trustStage(data).stage), rulesResult: data.rulesResult, names, siteSample: Boolean(market.sample),
    sp500: sp500Of(symbol, watchlist, mainWatchlistOf(data)),
    minRR: data.checklistCfg?.house_rule?.min_reward_to_risk ?? 2, stretchPct: settings.setup.stretch_pct, lang,
  });
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const seeCandles = () => {
    setCkView("candles");
    requestAnimationFrame(() => jump("checklist"));
  };
  const prev = others[(idx - 1 + others.length) % others.length]?.symbol;
  const next = others[(idx + 1) % others.length]?.symbol;
  const pctNum = (v, d) => pctText(v, d, lang);

  return (
    <Container className="pt-14">
      <Reveal className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => go("watchlist")} className="meta inline-flex items-center gap-2 hover:text-ink">
          <ArrowRight className="size-3.5 rotate-180" /> {isDefault ? t("sp.back") : t("sp.backList", { label: entry?.label ?? t("sp.back") })}
        </button>
        {!isBench && idx >= 0 && (
          <span className="ms-auto flex gap-2">
            <button type="button" onClick={() => go(`stock/${prev}`)} className="pill text-ink-2 hover:text-ink">{lang === "he" ? "→" : "←"} <bdi>{prev}</bdi></button>
            <button type="button" onClick={() => go(`stock/${next}`)} className="pill text-ink-2 hover:text-ink"><bdi>{next}</bdi> {lang === "he" ? "←" : "→"}</button>
          </span>
        )}
      </Reveal>

      {!isBench && <StockBrief data={data} row={row} symbol={symbol} today={today} jump={jump} seeCandles={candlesOf(data)[symbol] ? seeCandles : null} isDefault={isDefault} fund={fund} />}
      {buy && <BuyWindowCard a={buy} go={go} />}

      {candlesOf(data)[symbol] && (
        <button type="button" onClick={() => setZoom(true)}
          className="mt-6 flex w-full items-center gap-4 rounded-3xl border border-line-2 bg-surface p-5 text-start transition hover:border-ink-3 active:scale-[0.99] sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 3v18M12 6v12M18 4v14" /><rect x="4.5" y="7" width="3" height="7" rx="1" fill="currentColor" /><rect x="10.5" y="9" width="3" height="5" rx="1" /><rect x="16.5" y="6" width="3" height="8" rx="1" fill="currentColor" /></svg>
          </span>
          <span className="min-w-0">
            <span className="block text-[19px] font-bold tracking-[-0.01em] text-ink">{t("zm.title")}</span>
            <span className="block text-[15px] text-ink-2">{t("sp.zoomLede")}</span>
          </span>
          <ArrowRight className="ms-auto size-5 shrink-0 text-ink-2" />
        </button>
      )}
      {zoom && <CandleZoom it={{ ticker: symbol, name: names?.[symbol] ?? symbol, candlesTo: `stock/${symbol}#checklist` }} manifest={data.manifest} marketId={data.marketId ?? "nasdaq"}
        onClose={() => setZoom(false)} openTo={() => seeCandles()} />}

      <div className={`flex flex-wrap items-end justify-between gap-6 ${isBench ? "" : "mt-12"}`}>
        <div className="min-w-0">
          <Reveal className="eyebrow mb-4"><Auto>{names[symbol]}</Auto> · {market.provider === "sample" ? t("ckc.samplePrices") : t("wl.live", { provider: market.provider })} · {fmt.date(row.last_date)}</Reveal>
          <Headline size="xl">{symbol} <span className={TONE_TEXT[signTone(row.change_1d_pct, 2)]}>{fmt.pct(row.change_1d_pct, 2)}</span></Headline>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.checklistCfg && (
              <button type="button" onClick={() => jump("checklist")} className="pill min-h-[40px] max-w-full text-ink hover:border-ink-3">
                {t("sp.checklistPill")} {ckRow ? <VerdictPill verdict={ckRow.score.verdict} className="ms-1" /> : null} <span aria-hidden="true">↓</span>
              </button>
            )}
            {!isBench && (
              <button type="button" onClick={() => jump(fund ? "whats-inside" : "whats-next")} className="pill min-h-[40px] max-w-full text-ink hover:border-ink-3">
                {t(fund ? "sp.inside" : "sp.next.title")} <span aria-hidden="true">↓</span>
              </button>
            )}
          </div>
        </div>
        {!isBench && (
          <Reveal delay={200} className="card px-6 py-5 text-end">
            <div className="meta">{t("sp.passedTitle")}</div>
            <div dir="ltr" className="display num mt-1 text-[48px] leading-none">{passed}<span className="text-ink-3">/4</span></div>
            <div className="meta mt-2 normal-case tracking-[0.04em]">{t("sp.reportCard")}</div>
          </Reveal>
        )}
      </div>

      <ChecklistCard data={data} symbol={symbol} go={go} view={ckView} onView={setCkView} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">{t("sp.plain.title")}</div>
          <p className="text-[clamp(17px,1.7vw,20px)] leading-relaxed">{words.join(" ")}</p>
          <p className="meta mt-4 normal-case tracking-[0.04em]">{t("sp.plain.foot")}</p>
        </Reveal>
        {gate && (
          <Reveal delay={100} className={`card p-6 sm:p-8 ${gate.ok ? "border-accent/50" : "border-people/40"}`}>
            <div className="eyebrow mb-4">{t("sp.gate.title")}</div>
            <div className={`display text-[clamp(34px,4vw,48px)] ${gate.ok ? "text-accent" : "text-people"}`}>{t(gate.ok ? "sp.gate.yes" : "sp.gate.no")}</div>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{t("sp.gate.lede")}</p>
            <ul className="mt-5 grid gap-2.5 text-[14.5px]">
              {gate.reasons.map((r) => (
                <li key={r.text} className="flex gap-3">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${r.ok ? "bg-accent/15 text-accent" : "bg-people/15 text-people"}`}>{r.ok ? "✓" : "–"}</span>
                  <span className={r.ok ? "" : "text-ink-2"}>{r.text}</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => go("admin")} className="meta mt-5 inline-flex items-center gap-1 hover:text-ink">{t("bwc.rules")} <ArrowRight className="size-3.5" /></button>
          </Reveal>
        )}
        {!isDefault && !isBench && (
          <Reveal delay={100} className="card p-6 sm:p-8">
            <div className="eyebrow mb-4">{t("sp.gate.titleOther")}</div>
            <div className="display text-[clamp(30px,4vw,42px)] text-ink-2">{t("sp.notPlan")}</div>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{t("sp.nasdaqOnly")}</p>
          </Reveal>
        )}
      </div>

      <div className="mt-6">
        <Strip
          dense
          cells={[
            { value: fmt.pct(row.ret_20d_pct, 1), label: t("sp.strip.20d"), tone: row.ret_20d_pct >= 0 ? "accent" : "down" },
            ...(isBench ? [] : [{ value: fmt.pct(row.vs_bench_20d_pct ?? 0, 1), label: t("sp.strip.vs", { bench: bench.symbol }), tone: (row.vs_bench_20d_pct ?? 0) >= 0 ? "accent" : "down" }]),
            { value: fmt.pct(row.ret_60d_pct, 1), label: t("sp.strip.60d"), tone: row.ret_60d_pct >= 0 ? "accent" : "down" },
            ...(row.risk ? [{ value: fmt.pct(row.risk.max_dd_1y_pct, 0), label: t("sp.strip.drop"), tone: "down" }] : []),
            { value: row.from_high_pct != null ? fmt.pct(row.from_high_pct, 1) : "—", label: t("sp.strip.fromHigh"), tone: "flat" },
            ...(row.vol20_pct != null ? [{ value: pctNum(row.vol20_pct, 0), label: t("sp.strip.vol"), tone: "flat" }] : []),
          ]}
        />
      </div>

      <Reveal className="card mt-6 p-5 sm:p-8">
        <StockChart row={row} bench={isBench ? null : benchRow} benchSymbol={bench.symbol} picks={sample ? [] : picks} />
      </Reveal>

      {!isBench && (fund ? <WhatsInside fund={fund} symbol={symbol} /> : <WhatsNext card={cardFor(data.outlook, symbol)} symbol={symbol} today={today} hasFile={Boolean(data.outlook)} />)}
      {!isBench && !fund && <CompanyNumbers c={companyNumbers(data.fundamentals, symbol)} />}
      <WhyItMoved notes={notesForSymbol(usableWhy(data.why, Boolean(data.livePrices)), symbol, { today })} names={names} />
      {!isBench && !fund && <OfficialNews rows={newsRows(data.secNews, symbol, 6, lang)} />}

      {long && (
        <Reveal className="card mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.long.title", { goal: `+${goal}%` })}</h3>
            <span className="meta">{t("sp.long.span", { from: fmt.date(data.longrun.from), to: fmt.date(data.longrun.to) })}</span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{t("sp.long.lede")}</p>
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["cagr", fmt.pct(long.cagr_pct, 1), t("sp.long.cagr"), long.cagr_pct >= goal ? "text-accent" : ""],
              ["hit", pctNum(long.hit_goal_12m_pct, 0), t("sp.long.hit", { goal: `+${goal}%` }), ""],
              ["loss", pctNum(long.loss_12m_pct, 0), t("sp.long.loss"), ""],
              ["worst", fmt.pct(long.worst_12m_pct, 0), t("sp.long.worst"), "text-down"],
              ["dd", fmt.pct(long.max_dd_pct, 0), t("sp.long.dd"), "text-down"],
              ["held", pctNum(long.held_pct, 0), t("sp.long.held"), ""],
            ].map(([k, v, l, tone]) => (
              <div key={k}>
                <div className={`display num text-[clamp(26px,3vw,36px)] leading-none ${tone}`}>{v}</div>
                <div className="mt-2 text-[12.5px] leading-snug text-ink-3">{l}</div>
              </div>
            ))}
          </div>
          {row.risk && <p className="mt-5 text-[14px] leading-relaxed text-ink-2">{t.rich("sp.long.risk", {
            vol: pctNum(row.risk.vol_1y_pct, 0), bench: bench.symbol, beta: lang === "he" ? ltr(`${row.risk.beta_1y ?? "–"}%`) : `${row.risk.beta_1y ?? "–"}%`,
            loss: <span className="text-down">{fmt.pct(row.risk.loss_95_20d_pct, 0)}</span>,
          })}</p>}
        </Reveal>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {!isBench && (
          <Reveal className="card p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.checks.title")}</h3>
              <span className="meta">{t("sp.checks.count", { passed })}</span>
            </div>
            <p className="mt-1 text-[14px] text-ink-3">{t("sp.checks.lede")}</p>
            <ul className="mt-5 grid gap-3">
              {checks.map((c) => (
                <li key={c.id} className="flex items-center gap-4 rounded-2xl border border-line px-4 py-3.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] ${c.pass ? "bg-accent/15 text-accent" : "bg-down/15 text-down"}`} aria-label={t(c.pass ? "sp.checks.pass" : "sp.checks.fail")}>{c.pass ? "✓" : "✕"}</span>
                  <div className="min-w-0">
                    <div className="font-semibold">{c.label}</div>
                    <div className="num text-[13.5px] text-ink-3">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.lessons.title")}</h3>
            <button type="button" onClick={() => go("insights")} className="meta inline-flex items-center gap-1 hover:text-ink">{t("mb.lessons.link")} <ArrowRight className="size-3.5" /></button>
          </div>
          <p className="mt-1 text-[14px] text-ink-3">{t("sp.lessons.lede")}</p>
          <ol className="mt-5 grid gap-5">
            {lessons.map(({ why, p }, i) => (
              <li key={p.id} className="border-t border-line pt-5 first:border-0 first:pt-0">
                <div className="meta text-accent">{t(why)}</div>
                <En note={i === 0} className="mt-2">
                  <p className="text-[15.5px] leading-relaxed">{p.text}</p>
                  <div className="meta mt-2 truncate normal-case tracking-[0.04em]" title={p.source.title}>{p.id} · {(p.source.title.match(/\(([^()]*)\)\s*$/) || [, p.source.title])[1]}</div>
                </En>
              </li>
            ))}
            {!lessons.length && <li className="text-ink-3">{t("sp.lessons.none")}</li>}
          </ol>
        </Reveal>
      </div>

      {!isBench && isDefault && (
        <section className="pt-20">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-3">{t("sp.guess.eyebrow")}</div>
              <h2 className="display text-[clamp(30px,4.4vw,52px)]">{sample ? <>{t("sp.guess.sampleA")} <Accent>M3.</Accent></>
                : picks.length ? <>{STANCE_KEY[picks[0].stance] ? t(STANCE_KEY[picks[0].stance]) : cap(picks[0].stance)}, <Accent>{SURE_KEY[picks[0].conviction] ? t(SURE_KEY[picks[0].conviction]) : t("sp.guess.conviction", { level: picks[0].conviction })}.</Accent></>
                : <>{t("sp.guess.noneA")} <Accent>{t("sp.guess.noneB")}</Accent></>}</h2>
            </div>
            {sample && <span className="pill border-dashed border-people/60 text-people">{t("sp.guess.samplePill")}</span>}
          </div>
          {sample && (
            <p className="mb-6 max-w-[64ch] text-ink-2">
              {t.rich("sp.guess.sample", { symbol, days: settings.scoring.horizon_days, made: <span className="text-ink">{t("sp.guess.made")}</span> })}
            </p>
          )}
          {picks.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {picks.slice(0, 4).map((k, i) => (
                <Reveal key={k.id} delay={i * 60} as="article" className={`card p-6 ${sample ? "border-dashed" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="meta">{k.id}</span>
                    <Conviction level={k.conviction} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Chip kind={k.stance} />
                    <Chip kind={k.verdict}>{k.verdict === "pending" ? code("pending") : <>{code(k.verdict)} {fmt.pct(k.outcome.excess_pct, 1)}</>}</Chip>
                  </div>
                  {i === 0 && <EnglishNote className="mt-4" />}
                  <En as="p" className="mt-4 text-[15px] leading-relaxed">{k.thesis}</En>
                  <div className="mt-4 text-[14px] text-ink-2"><span className="meta me-2">{t("sp.guess.wrongIf")}</span><En as="span">{k.invalidation}</En></div>
                </Reveal>
              ))}
            </div>
          ) : (
            <Empty title={t("sp.guess.emptyTitle")}>{t("sp.guess.emptyBody")}</Empty>
          )}
        </section>
      )}

      <section className="pt-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-3">{t("sp.people.eyebrow")}</div>
            <h2 className="display text-[clamp(30px,4.4vw,52px)]">{t("sp.people.titleA")} <Accent>{t("sp.people.titleB", { symbol })}</Accent></h2>
          </div>
          <span className="meta">{t("sp.people.counts", { live: liveClaims.length, old: claims.length - liveClaims.length })}</span>
        </div>
        {claims.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {claims.map((c, i) => {
              const expired = c.expires < today;
              return (
                <li key={c.id} className={`card p-6 ${expired ? "border-dashed opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="meta"><Bdi>{c.id} · {c.as_of}</Bdi></span>
                    <span className={`pill py-1 text-[11px] ${expired ? "text-ink-3" : "border-dashed border-people/60 text-people"}`}>{expired ? t("sp.people.tooOld") : t.has(`sp.claim.${c.status}`) ? t(`sp.claim.${c.status}`) : c.status}</span>
                  </div>
                  <En as="p" note={i === 0} className="mt-3 text-[15px] leading-relaxed">{c.text}</En>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title={t("sp.people.emptyTitle")}>{t("sp.people.emptyBody", { symbol })}</Empty>
        )}
      </section>

      <p className="meta mt-16 normal-case tracking-[0.04em]">{t("sp.foot")}</p>
    </Container>
  );
}

/* ------------------------------------------------------------------ brief */

const MARK = {
  up: { glyph: "▲", cls: "bg-accent/15 text-accent", label: "ckc.lean.up" },
  down: { glyph: "▼", cls: "bg-down/15 text-down", label: "ckc.lean.down" },
  neutral: { glyph: "◆", cls: "bg-surface-2 text-ink-3", label: "sp.neutral" },
};
const BRIEF_TONE = { accent: "text-accent", down: "text-down", flat: "text-ink" };

function BriefHead({ children }) {
  return <h3 className="meta mb-3 text-accent">{children}</h3>;
}

/**
 * "<Company> in short": the site's eight-step checklist in plain words, whether a new paper entry is within this site's
 * rules and the plan in whole percents, and what is happening at the company. Wording: lib/brief.js.
 */
function StockBrief({ data, row, symbol, today, jump, seeCandles, isDefault = true, fund = null }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const cfg = data.checklistCfg;
  const ck = data.checklist;
  const ckRow = rowFor(ck, symbol);
  const read = readable(ck, ckRow, row.last_date, { sampleSite: data.sample, lang });
  const reading = read.ok ? ckRow : null;
  const dir = direction(reading, lang);
  const checks = reading ? eightChecks(reading, cfg, lang) : null;
  const benchLabel = t("sp.benchThe", { label: data.bench.label.replace(/\s*\(.*\)$/, "") }, { bidi: false });
  const where = !isDefault ? null : wherePaper({ row: reading, setup: setupState(row, data.settings.setup.stretch_pct), read, min: cfg?.house_rule?.min_reward_to_risk ?? 2, benchLabel, lang });
  const card = cardFor(data.outlook, symbol);
  const name = shortName(symbol, data.outlook, data.names);
  const ne = card?.next_earnings;
  const next = !card ? null : !ne?.date ? t("sp.brief.nextNone") : ne.date < today ? t("sp.brief.nextOut")
    : t(ne.confirmed ? "sp.brief.next" : "sp.brief.nextExpected", { when: whenWords(ne.date, today, lang) }, { bidi: false });
  return (
    <Reveal as="section" id="brief" aria-label={t("sp.brief.aria", { name })} className="card scroll-mt-28 p-6 sm:p-8">
      <div className="eyebrow mb-3">{t("sp.brief.eyebrow", { symbol })}</div>
      <h2 className="display text-[clamp(32px,7.5vw,52px)] leading-[1.02]"><Auto>{name}</Auto> <Accent>{t("sp.brief.inShort")}</Accent></h2>

      <div className="mt-7">
        <BriefHead>{t("sp.brief.upDown")}</BriefHead>
        {dir ? (
          <>
            <div className={`display text-[clamp(40px,11vw,60px)] leading-none ${BRIEF_TONE[dir.tone]}`}>{dir.word}</div>
            {dir.summary && <p dir="auto" className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">{dir.summary}</p>}
            <p className="mt-2 text-[13.5px] text-ink-3">{t("sp.brief.notForecast")}</p>
            {seeCandles && (
              <button type="button" onClick={seeCandles} className="meta mt-2 inline-flex min-h-[40px] items-center gap-1.5 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
                {t("sp.brief.seeCandles")} <span aria-hidden="true">↓</span>
              </button>
            )}
          </>
        ) : (
          <p className="text-[17px] leading-relaxed text-ink-2">{read.why}</p>
        )}
      </div>

      <div className="mt-8">
        <BriefHead>{t("sp.brief.eight")}</BriefHead>
        {checks ? (
          <ol className="grid gap-2">
            {checks.map((c) => {
              const m = MARK[c.mark] ?? MARK.neutral;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => jump(`checklist-${c.id}`)}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-start transition hover:border-ink-3">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] ${m.cls}`} role="img" aria-label={t(m.label)}>{m.glyph}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] leading-snug text-ink">{c.text}</span>
                      {c.note && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{c.note}</span>}
                    </span>
                    <span className="shrink-0 text-ink-3" aria-hidden="true">↓</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <>
            <p className="text-[16px] leading-relaxed text-ink-2">{read.why} {t("sp.brief.eightLooks")}</p>
            <ol className="mt-3 grid gap-1.5 text-[15px] text-ink-2">
              {(cfg?.steps ?? []).map((s) => <li key={s.id}>{stepName(s, lang)}</li>)}
            </ol>
          </>
        )}
      </div>

      {!isDefault ? (
        <div className="mt-8 rounded-2xl border border-line-2 p-5">
          <BriefHead>{t("sp.brief.pretendOnly")}</BriefHead>
          <p className="text-[16px] leading-relaxed text-ink-2">{t("sp.nasdaqOnly")}</p>
        </div>
      ) : (
      <div className={`mt-8 rounded-2xl border p-5 ${where.ok ? "border-accent/50" : "border-people/40"}`}>
        <BriefHead>{t("sp.brief.allow")}</BriefHead>
        <div className={`text-[20px] leading-snug font-semibold tracking-[-0.01em] ${where.ok ? "text-accent" : "text-people"}`}>{where.head}.</div>
        {where.ok ? (
          <ul className="mt-3 grid gap-2 text-[16px] leading-relaxed text-ink">
            {where.plan.map((p) => <li key={p} className="relative ps-4 before:absolute before:start-0 before:top-[0.7em] before:h-px before:w-2 before:bg-ink-3">{p}.</li>)}
          </ul>
        ) : (
          <div className="mt-3 grid gap-2 text-[16px] leading-relaxed">
            <p className="text-ink-2"><span className="text-ink">{t("sp.brief.whyNot")}</span> {where.why.join("; ")}.</p>
            {where.wait.length > 0 && <p className="text-ink-2"><span className="text-ink">{t("sp.brief.change")}</span> {where.wait.join("; ")}.</p>}
          </div>
        )}
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">{t("sp.brief.rule", { min: where.min })}</p>
      </div>
      )}

      {fund ? (
        <div className="mt-8">
          <BriefHead>{t("sp.inside")}</BriefHead>
          {fund.plain ? <En as="p" note className="max-w-[62ch] text-[17px] leading-relaxed text-ink">{fund.plain}</En>
            : <p className="max-w-[62ch] text-[17px] leading-relaxed text-ink">{t("sp.brief.fundLater")}</p>}
          <button type="button" onClick={() => jump("whats-inside")} className="meta mt-3 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">{t("sp.inside")} <span aria-hidden="true">↓</span></button>
        </div>
      ) : (
      <div className="mt-8">
        <BriefHead>{t("sp.brief.company")}</BriefHead>
        {card ? (
          <>
            <En as="p" note className="max-w-[62ch] text-[17px] leading-relaxed text-ink">{card.plain ?? card.business}</En>
            {next && <p className="mt-2 text-[15.5px] text-ink-2">{next}</p>}
          </>
        ) : <p className="text-[16px] leading-relaxed text-ink-2">{t("sp.brief.noCard")}</p>}
        <button type="button" onClick={() => jump("whats-next")} className="meta mt-3 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">{t("sp.next.title")} <span aria-hidden="true">↓</span></button>
      </div>
      )}

      <p className="mt-6 border-t border-line pt-4 text-[14px] leading-relaxed text-ink-2">{briefFooter(lang)}</p>
    </Reveal>
  );
}

/* ------------------------------------------------------------ what's next */

const ext = { target: "_blank", rel: "noopener noreferrer" };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const DAY_ONLY = {
  en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
  he: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
};
/** "19 Nov 2026" / "19 בנובמבר 2026": a date without its weekday. */
const dayOnly = (iso, lang = "en") => (DAY_ONLY[lang] ?? DAY_ONLY.en).format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));

function Src({ url }) {
  const t = useLang().t(dict);
  if (!url) return null;
  return <a href={url} {...ext} dir="ltr" className="ms-1 whitespace-nowrap text-[12px] text-ink-3 underline decoration-line-2 underline-offset-2 hover:text-ink">{host(url) ?? t("sp.source")} ↗</a>;
}

const SubHead = ({ children }) => <div className="meta mb-3 text-accent">{children}</div>;
const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink-2" };

/** Why the card may be out of date, in words: firm only when the company confirmed the date that has passed. */
function staleWords(s, t, lang) {
  if (!s) return null;
  if (s.kind === "passed" && s.confirmed) return t("sp.stale.out");
  if (s.kind === "passed") return t("sp.stale.passed", { date: dayOnly(s.date, lang) });
  return t("sp.stale.probably");
}

/** A list of "what's next" items under a small label. */
function NextList({ label, items }) {
  const { lang } = useLang();
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <div className="meta mb-2 normal-case tracking-[0.04em] text-ink-2">{label}</div>
      <ul className="grid gap-3">
        {items.map((w) => (
          <li key={w.item} className="text-[14.5px] leading-relaxed">
            <div className="meta mb-0.5 normal-case tracking-[0.04em]"><span className="uppercase tracking-[0.14em]">{kindLabel(w.kind, lang)}</span> · <En as="span">{w.when}</En></div>
            <En as="span">{w.item}</En><Src url={w.source_url} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A fund's card (config/funds.json): what it holds, the index it follows, its yearly cost and a note, with its source. */
function WhatsInside({ fund, symbol }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const cost = costWords(fund.expense_ratio_pct, lang);
  return (
    <Reveal id="whats-inside" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.inside")}</h3>
        {fund.as_of && <span className="meta normal-case tracking-[0.04em]">{t("sp.inside.checked", { date: dayOnly(fund.as_of, lang) })}</span>}
      </div>
      {(fund.plain || fund.ticker) && <EnglishNote className="mt-4" />}
      {fund.plain ? <En as="p" className="mt-4 max-w-[62ch] text-[18px] leading-relaxed text-ink">{fund.plain}</En>
        : <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">{t("sp.inside.none", { symbol })}</p>}
      {fund.ticker && (
        <dl className="mt-6 grid gap-5 md:grid-cols-3 md:gap-8">
          <div className="min-w-0">
            <dt className="meta mb-1.5 text-accent">{t("sp.inside.holds")}</dt>
            <En as="dd" className="text-[15.5px] leading-relaxed text-ink">{fund.holds}</En>
          </div>
          <div className="min-w-0">
            <dt className="meta mb-1.5 text-accent">{t("sp.inside.index")}</dt>
            <En as="dd" className="text-[15.5px] leading-relaxed text-ink">{fund.index_tracked}{fund.category ? <span className="block text-[14px] text-ink-3">{fund.category}</span> : null}</En>
          </div>
          <div className="min-w-0">
            <dt className="meta mb-1.5 text-accent">{t("sp.inside.cost")}</dt>
            <dd className="text-[15.5px] leading-relaxed text-ink">{cost ?? t("sp.inside.notListed")}<span className="block text-[14px] leading-snug text-ink-3">{t("sp.inside.costWhat")}</span></dd>
          </div>
        </dl>
      )}
      {fund.top_note && <En as="p" className="mt-6 rounded-2xl border border-line-2 bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink-2">{fund.top_note}</En>}
      {fund.source_url && <p className="mt-4 text-[14.5px] text-ink-2">{t("sp.inside.from")}<Src url={fund.source_url} /></p>}
      <p className="meta mt-6 normal-case tracking-[0.04em]">{t("sp.inside.foot")}</p>
    </Reveal>
  );
}

/** The company's own story: the latest quarter, its guidance, what is coming up and what could change it. Paraphrased and linked. */
const NUM_TONE = { accent: "var(--accent)", down: "var(--down)" };

/** What the company itself reported to the SEC, in plain sentences (data/market/fundamentals.json). Hidden until the
 *  first SEC run has numbers for this name. It describes the business, not the stock. */
function CompanyNumbers({ c }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const w = fundamentalsWords(c, lang);
  if (!w || !w.lines.length) return null;
  return (
    <Reveal id="company-numbers" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.numbers.title")}</h3>
      <p className="mt-1 text-[14px] text-ink-3">{w.period}</p>
      {w.stale && <p className="mt-4 rounded-2xl border border-dashed border-people/60 px-4 py-3 text-[14px] text-people">{t("sp.numbers.stale")}</p>}
      <ul className="mt-5 grid gap-4">
        {w.lines.map((l) => (
          <li key={l.id ?? l.label} className="flex gap-3">
            <span className="mt-2 size-2.5 shrink-0 rounded-full" style={{ background: NUM_TONE[l.tone] }} aria-hidden="true" />
            <span className="min-w-0">
              <span className="meta block">{l.label}</span>
              <span className="mt-1 block text-[16px] leading-relaxed text-ink">{l.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[14px] leading-relaxed text-ink-3">{t("sp.numbers.foot")}</p>
    </Reveal>
  );
}

const KIND_COLOR = { accent: "var(--accent)", down: "var(--down)", people: "var(--people)", ai: "var(--ai)", flat: "var(--ink-3)" };

/** What the company itself announced lately, from its SEC filings (data/market/sec_news.json): date, plain title, link. */
function OfficialNews({ rows }) {
  const t = useLang().t(dict);
  if (!rows.length) return null;
  return (
    <Reveal id="official-news" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.news.title")}</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{t("sp.news.lede")}</p>
      <ul className="mt-5 grid gap-2">
        {rows.map((r) => (
          <li key={r.url}>
            <a href={r.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-2xl border border-line-2 p-4 transition hover:border-ink-3">
              <span className="mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold" style={{ color: KIND_COLOR[r.tone], borderColor: "var(--line-2)" }}>{r.word}</span>
              <span className="min-w-0">
                <Auto className="block text-[16px] leading-snug text-ink">{r.title}</Auto>
                <span className="mt-1 block text-[13.5px] text-ink-3">{t("sp.news.form", { day: r.day, form: r.form })}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[14px] leading-relaxed text-ink-3">{t("sp.news.foot")}</p>
    </Reveal>
  );
}

/** Why this name moved on its unusual days of the last month (data/market/why.json via lib/why.js), newest first. Hidden
 *  when there is no note. */
function WhyItMoved({ notes, names }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  if (!notes.length) return null;
  return (
    <Reveal id="why-it-moved" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.why.title")}</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{t("sp.why.lede")}</p>
      <EnglishNote className="mt-3" />
      <ul className="mt-5 grid gap-3">
        {notes.map((n) => { const v = noteView(n, { names, lang }); return <WhyNote key={v.key} v={v} lead={dayOnly(v.date, lang)} />; })}
      </ul>
      <WhyFooter className="mt-4" />
    </Reveal>
  );
}

function WhatsNext({ card, symbol, today, hasFile }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  if (!card) {
    return (
      <Reveal id="whats-next" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
        <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.next.title")}</h3>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          {hasFile ? t("sp.next.noCard", { symbol }) : t("sp.next.noCards")} {t("sp.next.how")}
        </p>
      </Reveal>
    );
  }
  const { latest: lt, guidance: g, next_earnings: ne } = card;
  const stale = staleWords(staleness(card, today), t, lang);
  const groups = splitWhatsNext(card.whats_next, today);
  const days = daysUntil(ne.date, today);
  const growth = growthWords(lt.revenue_growth_yoy_pct, lang);
  const reported = t("sp.next.reported", { date: dayOnly(lt.reported_on, lang) });
  return (
    <Reveal id="whats-next" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("sp.next.title")}</h3>
        <span className="meta normal-case tracking-[0.04em]">{t("sp.next.researched", { date: dayOnly(card.as_of, lang) })}</span>
      </div>
      {stale && (
        <p className="mt-4 rounded-2xl border border-dashed border-people/60 px-4 py-3 text-[14px] text-people">{stale}</p>
      )}
      <EnglishNote className="mt-4" />
      <En as="p" className="mt-4 max-w-[70ch] text-[15.5px] leading-relaxed text-ink-2">{card.business}</En>

      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="min-w-0">
          <SubHead>{t("sp.next.money", { period: lt.period })}</SubHead>
          <div className="text-[17px] font-semibold leading-snug">{t("sp.next.sales", { revenue: lt.revenue })}</div>
          <div className="mt-1 text-[13.5px] text-ink-3">{growth ? `${growth} · ` : ""}{reported}<Src url={lt.source_url} /></div>
          <En as="ul" className="mt-3 grid gap-1.5 text-[14.5px] leading-relaxed text-ink-2">
            {lt.highlights.map((h) => <li key={h} className="relative ps-4 before:absolute before:start-0 before:top-[0.75em] before:h-px before:w-2 before:bg-ink-3">{h}</li>)}
          </En>
          <div className="mt-4 rounded-2xl border border-line px-4 py-3">
            <div className="meta mb-1">{g.given && g.period ? t("sp.next.outlookPeriod", { period: g.period }) : t("sp.next.outlook")}</div>
            <p className="text-[14.5px] leading-relaxed"><En as="span" className={g.given ? "" : "text-ink-2"}>{g.text}</En><Src url={g.source_url} /></p>
          </div>
        </div>

        <div className="min-w-0">
          <SubHead>{t("sp.next.resultsNews")}</SubHead>
          <div className="rounded-2xl border border-line px-4 py-3">
            <div className="meta mb-1">{t("sp.next.results")}</div>
            {ne.date ? (
              <div className="flex flex-wrap items-center gap-2 text-[15px]">
                <span className="font-semibold">{fmt.date(ne.date)}</span>
                {days != null && <span className="text-ink-3">{inDays(days, lang)}</span>}
                {!ne.confirmed && <span className="pill border-dashed py-0.5 text-[10.5px] text-people">{t("sp.next.expected")}</span>}
              </div>
            ) : <div className="text-[15px] text-ink-2">{t("sp.next.notAnnounced")}</div>}
            {ne.note && <p className="mt-1 text-[13px] leading-relaxed text-ink-3"><En as="span">{ne.note}</En><Src url={ne.source_url} /></p>}
            {!ne.note && <Src url={ne.source_url} />}
          </div>
          <NextList label={t("sp.next.ahead")} items={groups.ahead} />
          <NextList label={t("sp.next.recently")} items={groups.recent} />
          <NextList label={t("sp.next.other")} items={groups.other} />
        </div>

        <div className="min-w-0">
          <SubHead>{t("sp.next.watch")}</SubHead>
          {card.watch.length ? (
            <ul className="grid gap-3">
              {card.watch.map((w) => <li key={w.item} className="text-[14.5px] leading-relaxed text-ink-2"><En as="span">{w.item}</En><Src url={w.source_url} /></li>)}
            </ul>
          ) : <p className="text-[14px] text-ink-3">{t("sp.next.noRisks")}</p>}
        </div>
      </div>
      <p className="meta mt-6 normal-case tracking-[0.04em]">{t("sp.next.foot")}</p>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ chart */

function StockChart({ row, bench, benchSymbol, picks }) {
  const { t: tr, fmt } = useLang();
  const t = tr(dict);
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
  const H = narrowW ? 260 : 400, L = narrowW ? 34 : 48, R = narrowW ? 54 : 68, T = 14, B = 28;
  const x = (i) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R);
  const pad = (hi - lo) * 0.08 || 1;
  const y = (v) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const path = (arr) => arr.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p}`).join("");
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v));
  const up = pts.at(-1) >= 100;
  const color = up ? "var(--accent)" : "var(--down)";
  const markers = picks.map((k) => ({ k, i: dates.indexOf(k.date) })).filter((m) => m.i >= 0);

  const onMove = (e) => {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };
  const h = hover;
  const labelEvery = Math.ceil(pts.length / (narrowW ? 3 : 5));

  return (
    <div ref={ref}>
      <p className="mb-4 text-[14px] leading-relaxed text-ink-3">{t("sp.chart.lede")}{bench ? ` ${t("sp.chart.ledeBench")}` : ""}</p>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[13px] text-ink-2">
          <span className="inline-flex items-center gap-2"><i className="h-[3px] w-5 rounded" style={{ background: color }} />{row.symbol}</span>
          {bench && <span className="inline-flex items-center gap-2"><i className="w-5 border-t-2 border-dashed border-ink-3" />{t("sp.chart.whole", { bench: benchSymbol })}</span>}
          <span className="inline-flex items-center gap-2"><i className="h-px w-5 bg-ink-2" />{t("sp.chart.usual")}</span>
        </div>
        <Segmented label={t("sp.chart.range")} value={range} onChange={setRange} options={RANGES.filter((n) => n <= Math.max(21, maxRange)).map((n) => ({ value: n, label: t(`sp.range.${n}`) }))} />
      </div>
      <div ref={box} dir="ltr" className="relative">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y overflow-visible" role="img"
          aria-label={t(bench ? "sp.chart.ariaBench" : "sp.chart.aria", { symbol: row.symbol, n, bench: benchSymbol })}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 100 ? "var(--line-2)" : "var(--line)"} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11.5px]">{t}</text>
            </g>
          ))}
          {lo < 100 && hi > 100 && <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} stroke="var(--line-2)" strokeDasharray="2 4" />}
          {dates.map((d, i) => i % labelEvery === 0 && (
            <text key={d} x={Math.max(L + 18, x(i))} y={H - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[11.5px]">{fmt.short(d)}</text>
          ))}
          <path d={path(spts)} fill="none" stroke="var(--ink-2)" strokeWidth="1.2" opacity="0.6" vectorEffect="non-scaling-stroke" />
          {bpts.length > 0 && <path d={path(bpts)} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          <path d={path(pts)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            style={{ opacity: inView ? 1 : 0, transition: "opacity 900ms cubic-bezier(.16,1,.3,1)" }} />
          {/* end labels */}
          <text x={W - R + 8} y={y(pts.at(-1)) + 4} className="font-mono text-[12px] font-semibold" fill={color}>{fmtPct(pts.at(-1) - 100, 1)}</text>
          {bpts.length > 0 && bpts.at(-1) != null && Math.abs(y(bpts.at(-1)) - y(pts.at(-1))) > 14 && (
            <text x={W - R + 8} y={y(bpts.at(-1)) + 4} className="fill-ink-3 font-mono text-[12px]">{fmtPct(bpts.at(-1) - 100, 1)}</text>
          )}
          {markers.map(({ k, i }) => (
            <circle key={k.id} cx={x(i)} cy={y(pts[i])} r="7" stroke="var(--surface)" strokeWidth="2"
              fill={k.stance === "bullish" ? "var(--accent)" : k.stance === "bearish" ? "var(--down)" : "var(--flat)"} />
          ))}
          {h != null && (
            <g>
              <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="var(--line-2)" />
              <circle cx={x(h)} cy={y(pts[h])} r="6" fill={color} stroke="var(--surface)" strokeWidth="2" />
              {bpts[h] != null && <circle cx={x(h)} cy={y(bpts[h])} r="5" fill="var(--ink-3)" stroke="var(--surface)" strokeWidth="2" />}
            </g>
          )}
        </svg>
        {h != null && (
          <div dir="auto" className="pointer-events-none absolute top-0 z-10 min-w-[170px] rounded-xl border border-line-2 bg-surface px-3 py-2 text-[12.5px] shadow-xl"
            style={{ left: `clamp(0px, calc(${(x(h) / W) * 100}% - 85px), calc(100% - 170px))` }}>
            <div className="meta mb-1">{fmt.date(dates[h])}</div>
            <div className="flex justify-between gap-4"><span>{row.symbol}</span><b className="num font-mono">{fmt.pct(pts[h] - 100, 1)}</b></div>
            {bpts[h] != null && <div className="flex justify-between gap-4 text-ink-3"><span>{benchSymbol}</span><span className="num font-mono">{fmt.pct(bpts[h] - 100, 1)}</span></div>}
          </div>
        )}
      </div>
      {!row.series && <p className="meta mt-3 normal-case tracking-[0.04em]">{t("sp.chart.short", { n: full.length })}</p>}
    </div>
  );
}
