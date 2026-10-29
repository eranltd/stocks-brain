import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { avgPairCorr, basketSeries, daysBetween, goalPath, portfolioVol, weeklyStats, weightsFor } from "../lib/stats.js";
import { LABELS, STATUS, nextRebalance, statusLabel, universeConcentration } from "../components/goal.jsx";
import { LinesChart } from "../components/lines.jsx";
import { Kpi, KpiStrip, RangeMeter, pctFormat } from "../components/ledger.jsx";
import { MEASURES, bestChanges, halvesCheck, prepare, rank, scoreMix, searchMixes, standing } from "../lib/mix.js";
import { ArrowRight, Chip, Container, DataTable, EmptyState, HeroTitle, InfoTip, MiniSpark, Panel, Segmented, SimBadge, StatTile } from "../components/ui.jsx";
import dict from "../text/plan.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

// The pretend portfolio (Experiments). Numbers first: the paper record's KPI row, the honest test as an equity curve
// against the core fund and the whole market, seven years of past prices as tiles with yearly bars, every stock in one
// table, then the "pick up to 5" game as tiles. Percent and growth only, never a price. Every text is in text/plan.js
// ("pf.*"); the explanations sit behind an (i).

const SHORT = (s) => (s ?? "").replace("Information Technology", "Tech").replace("Communication Services", "Comms").replace("Consumer ", "Cons. ");
/** "62%": a whole percent. */
const wholePct = (v) => `${fmtNum(v, 0)}%`;
/** "Wed, 21 Oct": a day without its year. */
const noYear = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "–");
const dayMonth = (iso) => noYear(iso).replace(/^\w+,\s/, "");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const toneText = (v) => (!isNum(v) || Math.abs(v) < 0.05 ? "text-ink" : v > 0 ? "text-up" : "text-down");
/** The lines' colours: the paper portfolio and your mix in the brand orange, the core fund in ink, the market dimmer. */
const LINE = { paper: "var(--desk)", mix: "var(--desk)", rule: "var(--up)", core: "var(--ink)", bench: "var(--ink-3)", equal: "var(--ai)", goal: "var(--wait)" };

const KEY = "sb-portfolio-v1"; // this device only; never sent anywhere
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage may be unavailable */ } };

/**
 * Calendar-year growth (percent) of a series indexed to 100 on weekly dates: each year's last value against the year
 * before's (the first, part year against its first value). For the tiles' small bars only.
 */
function yearly(dates, values) {
  if (!dates?.length || !values?.length) return [];
  const out = [];
  let base = values[0];
  let year = dates[0].slice(0, 4);
  for (let i = 1; i < dates.length; i++) {
    const y = dates[i].slice(0, 4);
    if (y !== year) { out.push((values[i - 1] / base) * 100 - 100); base = values[i - 1]; year = y; }
  }
  out.push((values.at(-1) / base) * 100 - 100);
  return out;
}

/** A plain outline button in the kit's condensed type. */
function Door({ onClick, children, back = false }) {
  return (
    <button type="button" onClick={onClick}
      className="group inline-flex min-h-[48px] items-center gap-2.5 rounded-tile border border-line-2 px-4 font-display text-[15px] font-bold tracking-[0.1em] text-ink uppercase transition-colors hover:border-line-3">
      {back && <ArrowRight className="size-4 rotate-180 text-ink-3" />}{children}{!back && <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}

export default function Portfolio({ data, go }) {
  const t = strings(dict);
  const lr = data.longrun;
  const goal = data.settings.goal.annual_return_pct;
  const slots = data.settings.portfolio.slots;
  const minNames = data.settings.portfolio.target_min_names;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  // The rule's picks are what its forward paper record holds (the history test's path can keep older names).
  const rulePicks = paper?.rebalances.at(-1)?.holdings ?? lr?.now.holdings ?? [];
  const [picked, setPicked] = useState(() => load()?.picked?.filter((s) => data.sectors[s]) ?? rulePicks);
  const [mode, setMode] = useState(() => load()?.mode ?? "equal");
  const volOf = (s) => data.market.symbols.find((x) => x.symbol === s)?.risk?.vol_1y_pct ?? null;

  const toggle = (s) => {
    const next = picked.includes(s) ? picked.filter((x) => x !== s) : picked.length < slots ? [...picked, s] : picked;
    setPicked(next);
    save({ picked: next, mode });
  };
  const setM = (m) => { setMode(m); save({ picked, mode: m }); };
  const useMix = (names) => {
    setPicked(names);
    save({ picked: names, mode });
    document.getElementById("pick5")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const view = useMemo(() => {
    if (!lr || !picked.length) return null;
    const w = weightsFor(picked, mode, volOf);
    const series = basketSeries(lr.weekly, w);
    const vol = picked.every((s) => volOf(s) != null) ? portfolioVol(w, volOf, lr.corr_1y) : null;
    return { w, series, stats: weeklyStats(series, goal), vol, corr: avgPairCorr(picked, lr.corr_1y) };
  }, [lr, picked, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = (
    <div className="grid gap-5">
      <HeroTitle line1={t("pf.hero1")} line2={t("pf.hero2")} sub={lr ? t("pf.heroSub", { years: fmtNum(lr.years, 1), date: noYear(lr.as_of) }) : null} />
      <div className="flex flex-wrap items-center gap-1.5">
        <SimBadge />
        {lr && <Chip tone="neutral"><span className="text-ink-3">{t("pf.chip.prices")}</span><span className="text-ink">{lr.sample ? t("pf.samplePrices") : t("pf.realYears", { years: fmtNum(lr.years, 1) })}</span></Chip>}
        <InfoTip label={t("pf.about")} align="start">{t("pf.intro")} {t("pf.intro2", { slots, goal: `+${goal}%` })}</InfoTip>
      </div>
    </div>
  );

  if (!lr) {
    return (
      <Container className="pb-24">
        <div className="grid gap-6">{top}<EmptyState title={t("pf.next")}>{t("pf.emptyBody")}</EmptyState></div>
      </Container>
    );
  }

  return (
    <Container className="pb-24">
      <div className="grid gap-5 sm:gap-6">
        {top}
        <PaperKpis data={data} paper={paper} />
        <PaperRecord data={data} paper={paper} go={go} />
        <LongRun data={data} lr={lr} />
        <Stocks data={data} lr={lr} go={go} volOf={volOf} />
        <PickFive data={data} lr={lr} picked={picked} mode={mode} setM={setM} toggle={toggle} view={view} slots={slots} minNames={minNames}
          showRule={() => { setPicked(rulePicks); save({ picked: rulePicks, mode }); }} />
        <MixAndMatch data={data} lr={lr} picked={picked} useMix={useMix} slots={slots} minNames={minNames} go={go} />
        <Together data={data} lr={lr} picked={picked} />
        <Held lr={lr} />
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Door back onClick={() => go("today")}>{t("pf.nav.today")}</Door>
          <Door onClick={() => go("admin")}>{t("pf.nav.rules")}</Door>
        </div>
        <p className="micro normal-case tracking-[0.04em]">{t("pf.foot")}</p>
      </div>
    </Container>
  );
}

/* ----------------------------------------------------------- paper record */

/** The paper record's numbers on top: how the pretend portfolio, the core fund and the market grew since it began. */
function PaperKpis({ data, paper }) {
  const t = strings(dict);
  if (!paper || paper.track.length < 2) return null;
  const last = paper.track.at(-1);
  const days = daysBetween(paper.started, paper.as_of);
  const need = data.settings.trust.paper_min_days_small;
  const ahead = last.v - last.core_v;
  return (
    <KpiStrip label={t("pf.kpi.label")}>
      <Kpi label={t("pf.kpi.paper")} value={last.v - 100} format={pctFormat(1)} tone={toneText(last.v - 100)} note={t("pf.kpi.since", { day: dayMonth(paper.started) })} />
      <Kpi label={t("pf.kpi.core")} value={last.core_v - 100} format={pctFormat(1)} tone={toneText(last.core_v - 100)} note={t("pf.kpi.coreSub")} />
      <Kpi label={t("pf.kpi.market")} value={last.bench_v - 100} format={pctFormat(1)} tone={toneText(last.bench_v - 100)} note={data.bench.symbol} />
      <Kpi label={t("pf.kpi.ahead")} value={ahead} format={(v) => pctFormat(1)(v).replace("%", "")} tone={toneText(ahead)} note={t("pf.kpi.aheadSub")} />
      <Kpi label={t("pf.kpi.picks")} value={paper.rebalances.length} note={t("pf.kpi.picksSub")} />
      <Kpi label={t("pf.kpi.days")} value={days} note={days < need ? t("pf.kpi.daysFew", { need }) : t("pf.kpi.daysSub")} noteTone={days < need ? "text-wait" : "text-ink-3"} />
    </KpiStrip>
  );
}

/** The honest test: the paper portfolio's equity curve against the core fund and the whole market, what it holds now and
 *  how bumpy it is next to the core fund. */
function PaperRecord({ data, paper, go }) {
  const t = strings(dict);
  if (!paper || paper.track.length < 2) {
    return (
      <Panel id="paper" hero eyebrow={t("pf.paper.eyebrow")} title={t("pf.paper.title")} badge={<SimBadge short />} info={t("pf.paper.lede")} infoLabel={t("pf.paper.about")}>
        <EmptyState compact title={t(paper ? "pf.paper.today" : "pf.paper.next")}>{t("pf.paper.emptyBody")}</EmptyState>
      </Panel>
    );
  }
  const now = paper.rebalances.at(-1);
  const div = paper.diversification ?? null;
  const coreVol = data.market?.context?.core?.risk?.vol_1y_pct ?? null;
  const vol = div?.vol_1y_pct ?? null;
  const vsCore = isNum(vol) && isNum(coreVol) ? (Math.abs(vol - coreVol) < 1 ? "same" : vol < coreVol ? "calmer" : "bumpier") : null;
  return (
    <Panel id="paper" hero className="scroll-mt-28" eyebrow={t("pf.paper.eyebrowShort", { day: dayMonth(paper.started) })} title={t("pf.paper.title")}
      badge={<SimBadge short />} info={t("pf.paper.lede")} infoLabel={t("pf.paper.about")}>
      <LinesChart dates={paper.track.map((x) => x.date)} log={false} ariaLabel={t("pf.paper.aria")} height={260}
        series={[
          { key: "core", label: t("pf.paper.core"), values: paper.track.map((x) => x.core_v), color: LINE.core, width: 1.6 },
          { key: "bench", label: data.bench.symbol, values: paper.track.map((x) => x.bench_v), color: LINE.bench, dash: true, width: 1.6 },
          { key: "rule", label: t("pf.paper.rule"), values: paper.track.map((x) => x.v), color: LINE.paper, width: 2.6 },
        ]} />
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <p className="micro mb-1 text-ink-2">{t("pf.paper.holds", { day: dayMonth(now.date) })}</p>
          <div className="flex flex-wrap items-center gap-x-1.5">
            {now.holdings.length ? now.holdings.map((s) => (
              <button key={s} type="button" onClick={() => go(`stock/${s}`)} className="group grid min-h-[44px] place-items-center">
                <Chip tone="brand" className="font-num text-[12px] group-hover:bg-desk/20">{s}</Chip>
              </button>
            )) : null}
            {isNum(now.core_pct) && now.core_pct > 0 && <Chip tone="neutral">{t("pf.paper.corePct", { pct: wholePct(now.core_pct) })}</Chip>}
          </div>
        </div>
        {isNum(vol) && (
          <RangeMeter label={t("pf.meter.label")} value={vol} max={40} unit={t("pf.meter.unit")} marker={coreVol} markerLabel={t("pf.meter.marker", { pct: isNum(coreVol) ? `${fmtNum(coreVol, 1)}%` : "–" })}
            chip={vsCore ? t(`pf.meter.${vsCore}`) : null} chipTone={vsCore === "calmer" ? "up" : vsCore === "bumpier" ? "wait" : "neutral"}
            info={t("pf.meter.info", { core: isNum(coreVol) ? `${fmtNum(coreVol, 1)}%` : "–", month: isNum(div?.loss_95_20d_pct) ? fmtPct(div.loss_95_20d_pct, 1) : "–" })} infoLabel={t("pf.meter.about")} />
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- long run */

/** Seven years of past prices: the rule, every stock in equal shares, the core fund and the market, a tile each with
 *  its yearly growth as small bars. */
function LongRun({ data, lr }) {
  const t = strings(dict);
  const L = LABELS(data);
  const w = lr.weekly;
  const goal = data.settings.goal.annual_return_pct;
  const rows = [
    { k: "rule", label: L.rule, s: lr.stats.rule, values: w.rule },
    { k: "equal_weight", label: L.equal_weight, s: lr.stats.equal_weight, values: w.equal_weight },
    { k: "core", label: L.core, s: lr.stats.core, values: w.core },
    { k: "bench", label: L.bench, s: lr.stats.bench, values: w.bench },
  ].filter((r) => r.s && r.values);
  return (
    <Panel id="long-run" eyebrow={t("pf.long.eyebrow", { from: fmtDate(lr.from), to: fmtDate(lr.to) })} title={t("pf.long.title", { years: fmtNum(lr.years, 0) })}
      info={<span className="grid gap-2"><span>{t("pf.long.info", { goal: `+${goal}%` })}</span><span>{t("pf.mixNote")}</span></span>} infoLabel={t("pf.long.about")}>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {rows.map((r) => (
          <StatTile key={r.k} label={r.label} value={<span className={r.s.cagr_pct >= goal ? "text-up" : ""}>{fmtPct(r.s.cagr_pct, 1)}</span>}
            sub={t("pf.long.worst", { pct: fmtPct(r.s.worst_12m_pct, 0) })} note={t("pf.long.drop", { pct: fmtPct(r.s.max_dd_pct, 0) })}
            bars={yearly(w.dates, r.values)} barsHi={-1} />
        ))}
      </div>
      <p className="micro mt-3 normal-case tracking-[0.04em]">{t("pf.long.foot")}</p>
    </Panel>
  );
}

/* ----------------------------------------------------------------- stocks */

/** Every stock on the list, one row each: its own past growth and falls, and what the rule thinks of it today. */
function Stocks({ data, lr, go, volOf }) {
  const t = strings(dict);
  const goal = data.settings.goal.annual_return_pct;
  const status = Object.fromEntries(lr.now.status.map((x) => [x.symbol, x]));
  const spark = (s) => lr.weekly.members?.[s]?.slice(-52);
  const cols = [
    { key: "symbol", label: t("pf.th.stock"), sortable: true, firstDir: "asc", cell: (m) => (
      <span className="min-w-0">
        <span className="block font-num text-[13.5px] font-bold text-ink">{m.symbol}</span>
        <span className="block max-w-[96px] truncate text-[11px] leading-tight text-ink-3">{SHORT(m.sector)}</span>
      </span>
    ) },
    { key: "spark", label: t("pf.th.year1"), cell: (m) => <MiniSpark values={spark(m.symbol)} w={72} h={24} /> },
    { key: "cagr_pct", label: t("pf.th.year"), sortable: true, num: true, className: (m) => `font-bold ${m.cagr_pct >= goal ? "text-up" : "text-ink"}`, cell: (m) => fmtPct(m.cagr_pct, 1) },
    { key: "hit_goal_12m_pct", label: t("pf.th.yearsGoal", { goal: `+${goal}%` }), sortable: true, num: true, className: "text-ink-2", cell: (m) => wholePct(m.hit_goal_12m_pct) },
    { key: "worst_12m_pct", label: t("pf.row.worstYear"), sortable: true, num: true, firstDir: "asc", className: "text-down", cell: (m) => fmtPct(m.worst_12m_pct, 0) },
    { key: "max_dd_pct", label: t("pf.row.drop"), sortable: true, num: true, firstDir: "asc", className: "text-down", cell: (m) => fmtPct(m.max_dd_pct, 0) },
    { key: "vol", label: t("pf.th.bumpy"), sortable: true, num: true, sortValue: (m) => volOf(m.symbol), className: "text-ink-2", cell: (m) => (volOf(m.symbol) != null ? wholePct(volOf(m.symbol)) : "–") },
    { key: "held_pct", label: t("pf.th.held"), sortable: true, num: true, className: "text-ink-2", cell: (m) => wholePct(m.held_pct) },
    { key: "today", label: t("pf.th.today"), align: "start", sortable: true, sortValue: (m) => status[m.symbol]?.status ?? "~", firstDir: "asc", cell: (m) => {
      const s = status[m.symbol]?.status;
      return s && STATUS[s] ? <span className={`text-[12px] whitespace-nowrap ${STATUS[s].tone}`}>{statusLabel(s)}</span> : <span className="text-ink-3">–</span>;
    } },
  ];
  return (
    <Panel id="stocks" eyebrow={t("pf.each.eyebrow", { from: fmtDate(lr.from), to: fmtDate(lr.to) })} title={t("pf.each.titleShort")} info={t("pf.each.lede")} infoLabel={t("pf.each.about")}
      badge={<Chip tone="neutral">{t("pf.each.count", { count: lr.members.length })}</Chip>}>
      <DataTable columns={cols} rows={lr.members} rowKey={(m) => m.symbol} defaultSort={{ key: "cagr_pct", dir: "desc" }} minWidth={860}
        onRowClick={(m) => go(`stock/${m.symbol}`)} rowLabel={(m) => m.symbol} rowTone={(m) => (lr.now.holdings?.includes(m.symbol) ? "brand" : null)}
        scrollClassName="max-h-[520px] overflow-y-auto" caption={t("pf.each.titleShort")} />
    </Panel>
  );
}

/* --------------------------------------------------------------- the game */

/** "Pick up to 5": every stock as a tile with its last year as a small line; your picks glow. Then how your pretend mix
 *  would have done next to the rule and the core fund. */
function PickFive({ data, lr, picked, mode, setM, toggle, view, slots, minNames, showRule }) {
  const t = strings(dict);
  const L = LABELS(data);
  const goal = data.settings.goal.annual_return_pct;
  const goalText = `+${goal}%`;
  const range = `${minNames}–${slots}`;
  const status = Object.fromEntries(lr.now.status.map((x) => [x.symbol, x]));
  const bySector = {};
  picked.forEach((s) => { bySector[data.sectors[s]] = (bySector[data.sectors[s]] ?? 0) + 1; });
  const warnings = [
    picked.length < minNames && t("pf.warn.few", { count: picked.length, n: picked.length, range }),
    ...Object.entries(bySector).filter(([, n]) => n > lr.rule.max_per_sector).map(([sec, n]) => t("pf.warn.sector", { n, sector: sec, max: lr.rule.max_per_sector })),
    view?.corr != null && view.corr > 0.6 && t("pf.warn.corr", { score: fmtNum(view.corr, 2) }),
    ...picked.filter((s) => status[s]?.status === "stretched").map((s) => t("pf.warn.stretched", { s })),
    ...picked.filter((s) => status[s]?.status === "fails_checks").map((s) => t("pf.warn.fails", { s, passed: status[s].passed })),
  ].filter(Boolean);
  const full = picked.length >= slots;
  const ruleStats = weeklyStats(lr.weekly.rule, goal);
  const coreStats = weeklyStats(lr.weekly.core, goal);
  const compare = view ? [
    { k: "mix", label: t("pf.yourMix"), s: view.stats, you: true },
    { k: "rule", label: L.rule, s: ruleStats },
    { k: "core", label: L.core, s: coreStats },
  ] : [];
  const cols = [
    { key: "label", label: "", cell: (r) => <span className={`flex items-center gap-2 text-[13px] font-semibold ${r.you ? "text-desk" : "text-ink"}`}><i aria-hidden="true" className="h-[3px] w-4 rounded-full" style={{ background: LINE[r.k] }} />{r.label}</span> },
    { key: "cagr", label: t("pf.avgGrowthShort"), num: true, className: (r) => `font-bold ${r.s.cagr >= goal ? "text-up" : "text-ink"}`, cell: (r) => fmtPct(r.s.cagr, 1) },
    { key: "hit", label: t("pf.row.hitGoal", { goal: goalText }), num: true, className: "text-ink-2", cell: (r) => wholePct(r.s.hitGoal) },
    { key: "lost", label: t("pf.row.lost"), num: true, className: "text-ink-2", cell: (r) => wholePct(r.s.loss12) },
    { key: "worst", label: t("pf.row.worstYear"), num: true, className: (r) => (r.s.worst12 < 0 ? "text-down" : "text-ink"), cell: (r) => fmtPct(r.s.worst12, 0) },
    { key: "dd", label: t("pf.row.drop"), num: true, className: "text-down", cell: (r) => fmtPct(r.s.maxDD, 0) },
  ];
  return (
    <Panel id="pick5" className="scroll-mt-28" eyebrow={t("pf.game.eyebrow")} title={t("pf.game.title", { slots })} sub={t("pf.game.sub")}
      info={<span className="grid gap-2"><span>{t("pf.intro2", { slots, goal: goalText })}</span>{mode === "vol" && <span>{t("pf.calmNote")}</span>}</span>} infoLabel={t("pf.game.about")}
      badge={<Chip tone={picked.length ? "brand" : "neutral"}><span className="text-ink">{picked.length}</span>/{slots}</Chip>}>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label={t("pf.howMuch")} value={mode} onChange={setM} options={[{ value: "equal", label: t("pf.equal") }, { value: "vol", label: t("pf.calm") }]} />
        <button type="button" onClick={showRule}
          className="min-h-[44px] rounded-[10px] border border-line-2 px-3.5 font-display text-[14px] font-bold tracking-[0.08em] text-ink-2 uppercase transition-colors hover:border-line-3 hover:text-ink">{t("pf.showRule")}</button>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {data.watchlist.symbols.map((s) => {
          const on = picked.includes(s.symbol);
          const values = lr.weekly.members?.[s.symbol]?.slice(-52);
          return (
            <li key={s.symbol} className="min-w-0">
              <button type="button" onClick={() => toggle(s.symbol)} aria-pressed={on} disabled={!on && full}
                className={`relative flex h-full w-full flex-col overflow-hidden rounded-tile border px-2.5 pt-2 pb-2 text-start transition-[border-color,background-color,box-shadow,opacity] ${on ? "glow-brand border-desk bg-desk/10" : "border-line bg-surface-2 hover:border-line-3"} ${!on && full ? "opacity-40" : ""}`}>
                {on && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-desk" />}
                <span className="flex items-baseline justify-between gap-1.5">
                  <span className={`font-num text-[14px] font-bold ${on ? "text-desk" : "text-ink"}`}>{s.symbol}</span>
                  {on && view && <span className="font-num text-[11.5px] font-bold text-ink">{fmtNum(view.w[s.symbol] * 100, 0)}%</span>}
                </span>
                <span className="truncate text-[11px] text-ink-3">{SHORT(s.sector)}</span>
                <span className="mt-1.5 block">{values?.length > 1 ? <MiniSpark values={values} w={120} h={22} fluid /> : <span className="block h-[22px]" />}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {warnings.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {warnings.map((w) => <li key={w} className="flex gap-2 text-[12.5px] leading-snug text-wait"><span aria-hidden="true" className="font-num font-bold">!</span>{w}</li>)}
        </ul>
      )}
      {view && (
        <>
          <div className="mt-4">
            <DataTable columns={cols} rows={compare} rowKey={(r) => r.k} minWidth={560} rowTone={(r) => (r.you ? "brand" : null)} caption={t("pf.game.compare")} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [t("pf.row.bumpy"), view.vol != null ? `${fmtNum(view.vol, 0)}%` : "–", ""],
              [t("pf.row.badMonth"), view.vol != null ? fmtPct(-1.645 * view.vol * Math.sqrt(20 / 252), 0) : "–", "text-down"],
              [t("pf.row.together"), view.corr != null ? fmtNum(view.corr, 2) : "–", ""],
              [t("pf.row.kinds"), t("pf.kindsOf", { n: Object.keys(bySector).length, total: picked.length }), ""],
            ].map(([k, v, tone]) => (
              <div key={k} className="tile min-w-0 px-3 py-2.5">
                <dt className="micro truncate">{k}</dt>
                <dd className={`font-num mt-1 text-[18px] leading-none font-bold ${tone || "text-ink"}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="micro mt-2 normal-case tracking-[0.04em]">{t("pf.last12")}</p>
          <div className="mt-4">
            <LinesChart dates={lr.weekly.dates} ariaLabel={t("pf.chartAria")}
              series={[
                { key: "goal", label: t("pf.goalLine", { goal: goalText }), values: goalPath(lr.weekly.dates.length, goal), color: LINE.goal, dash: true, width: 1.5 },
                { key: "core", label: L.core, values: lr.weekly.core, color: LINE.core, width: 1.6 },
                { key: "rule", label: L.rule, values: lr.weekly.rule, color: LINE.rule, width: 2 },
                { key: "mix", label: t("pf.yourMix"), values: view.series, color: LINE.mix, width: 2.6 },
              ]} />
          </div>
        </>
      )}
    </Panel>
  );
}

/** A bold number or name list inside a sentence. */
function B({ children, className = "" }) {
  return <b className={`font-num ${className}`}>{children}</b>;
}

function MixChips({ names, sectors, picked }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((s) => (
        <Chip key={s} tone={picked.includes(s) ? "brand" : "neutral"} className="font-num">
          {s}<span className="font-sans text-[10px] font-medium tracking-normal text-ink-3 normal-case">{SHORT(sectors[s])}</span>
        </Chip>
      ))}
    </div>
  );
}

function MixAndMatch({ data, lr, picked, useMix, slots, minNames, go }) {
  const t = strings(dict);
  const [measure, setMeasure] = useState("profit");
  const [size, setSize] = useState(String(slots));
  const [limit, setLimit] = useState(true);
  const [on, setOn] = useState(false);
  const symbols = useMemo(() => Object.keys(lr.weekly.members), [lr]);
  const prep = useMemo(() => prepare(lr.weekly, symbols), [lr, symbols]);
  const cap = limit ? lr.rule.max_per_sector : null;
  const k = Number(size);
  const all = useMemo(() => (on ? searchMixes(prep, data.sectors, { k, cap }) : null), [on, prep, k, cap, data.sectors]);
  const halves = useMemo(() => (all ? halvesCheck(all) : null), [all]);
  const top = useMemo(() => (all ? rank(all, measure).slice(0, 5) : []), [all, measure]);
  const mine = useMemo(() => (picked.length ? scoreMix(prep, picked.map((s) => symbols.indexOf(s))) : null), [prep, picked, symbols]);
  const changes = useMemo(() => (on && picked.length ? bestChanges(prep, data.sectors, picked, { slots, cap, measure }) : null), [on, prep, picked, slots, cap, measure, data.sectors]);
  const solo = useMemo(() => symbols.map((_, i) => scoreMix(prep, [i]).cagr), [prep, symbols]);
  const withoutBest = (m) => {
    const best = m.idx.reduce((a, b) => (solo[b] > solo[a] ? b : a));
    return { name: symbols[best], score: scoreMix(prep, m.idx.filter((i) => i !== best)) };
  };
  const measureLabel = MEASURES[measure].label.toLowerCase();
  const sizes = Array.from({ length: slots - minNames + 1 }, (_, i) => String(minNames + i));
  const rejected = (data.rulesResult?.satellite?.rules ?? []).filter((r) => r.verdict === "rejected");
  const rejLo = rejected.length ? Math.min(...rejected.map((r) => r.percentile)) : null;
  const rejHi = rejected.length ? Math.max(...rejected.map((r) => r.percentile)) : null;
  const dates = lr.weekly.dates;
  const med = all ? rank(all, measure)[Math.floor(all.length / 2)] : null;
  const f = MEASURES[measure].pick;
  const delta = (s) => (mine ? s.cagr - mine.cagr : 0);
  const beat = all && mine && picked.length === k ? standing(all, measure, f(mine)) : null;
  const reality = all ? [
    ["pf.mm.r1b", t("pf.mm.r1", { n: fmtNum(all.length, 0) })],
    ["pf.mm.r2b", t("pf.mm.r2", { n: symbols.length, date: fmtDate(dates[prep.mid]), pct: fmtNum(halves.medianPercentile, 0), lo: "-1", hi: "1", corr: fmtNum(halves.rankCorrelation, 2) })],
    rejLo != null && ["pf.mm.r3b", t("pf.mm.r3", { lo: `${fmtNum(rejLo, 0)}%`, hi: `${fmtNum(rejHi, 0)}%` })],
    ["pf.mm.r4b", t("pf.mm.r4", { dd: fmtPct(top[0].dd, 0), wo: fmtPct(withoutBest(top[0]).score.cagr, 1), cagr: fmtPct(top[0].cagr, 1) })],
    ["pf.mm.r5b", t("pf.mm.r5", { years: fmtNum(lr.years, 1) })],
  ].filter(Boolean) : [];

  return (
    <Panel id="mix" eyebrow={t("pf.mm.eyebrow")} title={t("pf.mm.titleShort")} info={t("pf.mm.lede", { range: `${minNames}–${slots}`, n: symbols.length })} infoLabel={t("pf.mm.about")}>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label={t("pf.mm.sortBy")} value={measure} onChange={setMeasure} options={Object.keys(MEASURES).map((value) => ({ value, label: MEASURES[value].label }))} />
        {sizes.length > 1 && <Segmented label={t("pf.mm.inGroup")} value={size} onChange={setSize} options={sizes.map((s) => ({ value: s, label: t("pf.mm.nStocks", { n: s }) }))} />}
        <button type="button" aria-pressed={limit} onClick={() => setLimit(!limit)}
          className={`min-h-[44px] max-w-full rounded-[10px] border px-3 text-start text-[12.5px] font-semibold transition-colors ${limit ? "border-desk/50 bg-desk/10 text-desk" : "border-line-2 text-ink-2 hover:text-ink"}`}>
          {limit ? t("pf.mm.capOn", { max: lr.rule.max_per_sector }) : t("pf.mm.capOff")}
        </button>
      </div>
      {!on && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setOn(true)}
            className="glow-brand inline-flex min-h-[48px] items-center gap-2.5 rounded-tile border border-desk bg-desk px-5 font-display text-[16px] font-extrabold tracking-[0.1em] text-bg uppercase">
            {t("pf.mm.try")} <ArrowRight className="size-4" />
          </button>
          <span className="text-[12.5px] text-ink-3">{t("pf.mm.tryNote")}</span>
        </div>
      )}

      {on && all && (
        <>
          {mine && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div className="tile px-4 py-3">
                <p className="micro">{t("pf.mm.beatLabel")}</p>
                <p className="font-num mt-1.5 text-[36px] leading-none font-bold text-desk">{beat != null ? `${fmtNum(beat, 0)}%` : "–"}</p>
                <p className="mt-1 text-[11.5px] text-ink-3">{t("pf.mm.ofGroups", { n: fmtNum(all.length, 0) })}</p>
              </div>
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                {rich(t, "pf.mm.grew", { names: <B key="n" className="text-ink">{picked.join(" · ")}</B>, cagr: <B key="c" className="text-ink">{fmtPct(mine.cagr, 1)}</B>, dd: <B key="d" className="text-down">{fmtPct(mine.dd, 0)}</B> })}
                {" "}{picked.length === k ? t("pf.mm.beatShort", { measure: measureLabel }) : t("pf.mm.size", { n: picked.length, k })}
                {" "}{t("pf.mm.middle", { mid: fmtPct(med.cagr, 1), best: fmtPct(top[0].cagr, 1) })}
              </p>
            </div>
          )}

          <p className="micro mt-5 mb-2 text-ink-2">{t("pf.mm.topTitle", { measure: measureLabel })}</p>
          <ol className="grid gap-2 lg:grid-cols-2">
            {top.map((m, i) => {
              const names = m.idx.map((x) => symbols[x]);
              const wo = withoutBest(m);
              return (
                <li key={names.join("-")} className="tile p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-num text-[12px] font-bold text-desk">#{i + 1}</span>
                    <button type="button" onClick={() => useMix(names)}
                      className="min-h-[36px] rounded-[8px] border border-line-2 px-2.5 font-display text-[13px] font-bold tracking-[0.08em] text-ink-2 uppercase hover:border-line-3 hover:text-ink">{t("pf.mm.tryGroup")}</button>
                  </div>
                  <div className="mt-2"><MixChips names={names} sectors={data.sectors} picked={picked} /></div>
                  <dl className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      [t("pf.mm.growth"), fmtPct(m.cagr, 1), m.cagr >= data.settings.goal.annual_return_pct ? "text-up" : "text-ink"],
                      [t("pf.row.drop"), fmtPct(m.dd, 0), "text-down"],
                      [t("pf.mm.bumpy"), `${fmtNum(m.vol, 0)}%`, "text-ink"],
                      [t("pf.mm.without", { name: wo.name }), fmtPct(wo.score.cagr, 1), "text-ink-2"],
                    ].map(([kk, v, tone]) => (
                      <div key={kk} className="min-w-0"><dt className="micro truncate text-[9.5px]">{kk}</dt><dd className={`font-num mt-1 text-[14px] font-bold ${tone}`}>{v}</dd></div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ol>

          {changes && changes.changes.length > 0 && (
            <>
              <p className="micro mt-5 mb-2 text-ink-2">{t(picked.length < slots ? "pf.mm.bestAdd" : "pf.mm.bestSwap", { measure: measureLabel })}</p>
              <ul className="grid gap-2">
                {changes.changes.map((c) => (
                  <li key={c.names.join("-")} className="tile flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-num text-[14px] font-bold">{c.kind === "swap" ? <>{c.drop} <span className="text-ink-3">→</span> <span className="text-desk">{c.add}</span></> : <>+ <span className="text-desk">{c.add}</span></>} <span className="font-sans text-[11.5px] font-normal text-ink-3">{SHORT(data.sectors[c.add])}</span></p>
                      <p className="font-num mt-0.5 text-[12px] text-ink-2">{t("pf.mm.change", { cagr: fmtPct(c.score.cagr, 1), delta: fmtPct(delta(c.score), 1), dd: fmtPct(c.score.dd, 0) })}</p>
                    </div>
                    <button type="button" onClick={() => useMix(c.names)}
                      className="min-h-[36px] rounded-[8px] border border-line-2 px-2.5 font-display text-[13px] font-bold tracking-[0.08em] text-ink-2 uppercase hover:border-line-3 hover:text-ink">{t("pf.mm.tryIt")}</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 rounded-tile border border-wait/40 bg-wait/[0.06] p-3.5">
            <p className="kicker text-wait">{t("pf.mm.reality")}</p>
            <ul className="mt-2 grid gap-1">
              {reality.map(([head, body]) => (
                <li key={head} className="flex items-center gap-1 text-[13.5px] font-semibold text-ink">
                  <span className="min-w-0">{t(head)}</span>
                  <InfoTip label={t(head)} align="start">{body}{head === "pf.mm.r3b" && <> <button type="button" className="underline hover:text-ink" onClick={() => go("playbook")}>{t("pf.mm.r3link")}</button>.</>}</InfoTip>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------- together map */

function Together({ data, lr, picked }) {
  const t = strings(dict);
  const u = universeConcentration(data);
  return (
    <Panel id="together" eyebrow={t("pf.corr.eyebrow")} title={t("pf.corr.titleShort")} infoLabel={t("pf.corr.about")}
      info={<>{t("pf.corr.lede")} {u.concentrated ? t("pf.corr.concentrated", { count: u.sectors, n: u.sectors }) : ""}</>}>
      <div className="thin-scroll -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <CorrMap corr={lr.corr_1y} picked={picked} />
      </div>
    </Panel>
  );
}

function CorrMap({ corr, picked }) {
  const n = corr.symbols.length;
  const color = (v) => (v == null ? "transparent" : `color-mix(in oklab, var(--desk) ${Math.round(Math.max(0, Math.min(1, v)) * 62)}%, var(--surface-2))`);
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `52px repeat(${n}, minmax(0,1fr))`, minWidth: 52 + n * 40 }}>
      <span />
      {corr.symbols.map((s) => <span key={s} className={`micro text-center text-[9.5px] ${picked.includes(s) ? "text-desk" : ""}`}>{s}</span>)}
      {corr.m.map((row, i) => (
        <div key={corr.symbols[i]} className="contents">
          <span className={`micro self-center text-[9.5px] ${picked.includes(corr.symbols[i]) ? "text-desk" : ""}`}>{corr.symbols[i]}</span>
          {row.map((v, j) => {
            const both = picked.includes(corr.symbols[i]) && picked.includes(corr.symbols[j]) && i !== j;
            return (
              <span key={j} title={`${corr.symbols[i]} · ${corr.symbols[j]}: ${v ?? "–"}`}
                className={`font-num grid aspect-[1.3] place-items-center rounded-[4px] text-[10px] ${i === j ? "text-ink-3" : "text-ink"} ${both ? "ring-2 ring-desk" : ""}`}
                style={{ background: i === j ? "transparent" : color(v) }}>
                {i === j ? "·" : v != null ? v.toFixed(2).replace(/^(-?)0\./, "$1.") : "–"}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- held */

/** What the rule held each month on past prices (a replay, redone daily; the paper record above is never redone). */
function Held({ lr }) {
  const t = strings(dict);
  const rows = [...lr.rebalances].reverse();
  const cols = [
    { key: "date", label: t("pf.held.month"), num: true, className: "text-ink-2", cell: (r) => r.date.slice(0, 7) },
    { key: "holdings", label: t("pf.held.stocks"), align: "start", cell: (r) => (r.holdings.length
      ? <span className="flex flex-wrap gap-1 py-1.5">{r.holdings.map((s) => <Chip key={s} tone="neutral" className="min-h-[20px] px-1.5 font-num text-[10.5px]">{s}</Chip>)}</span>
      : <span className="text-ink-3">{t("pf.held.none")}</span>) },
    { key: "core", label: t("pf.held.core"), num: true, className: "text-ink-2", cell: (r) => wholePct(r.core_pct) },
    { key: "traded", label: t("pf.held.swapped"), num: true, className: "text-ink-3", cell: (r) => wholePct(r.traded_pct) },
  ];
  return (
    <Panel id="held" eyebrow={t("pf.held.eyebrow", { version: lr.rule.version, n: lr.rebalances_total, date: fmtDate(nextRebalance(lr.as_of)) })} title={t("pf.held.titleShort")}
      info={t("pf.held.lede", { avg: fmtNum(lr.avg_names_held, 1), turn: `${fmtNum(lr.traded_per_year_pct / 2, 0)}%`, bps: lr.rule.cost_bps })} infoLabel={t("pf.held.about")}>
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.date} minWidth={520} scrollClassName="max-h-[420px] overflow-y-auto" caption={t("pf.held.titleShort")} />
    </Panel>
  );
}
