import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct, numWord } from "../lib/format.js";
import { Sparkline } from "../components/charts.jsx";
import { STATUS } from "../components/goal.jsx";
import { Accent, Container, Reveal, SectionHead, Segmented, Strip } from "../components/ui.jsx";
import { VerdictPill } from "../components/checklist.jsx";

export default function Watchlist({ data, go }) {
  const { watchlist, prices, bench, settings, regime, livePrices, market, longrun, checklist } = data;
  const ruleOf = Object.fromEntries((longrun?.now.status ?? []).map((x) => [x.symbol, x.status]));
  // Technical checklist reading per name (unproven): null until the first daily run that computes it.
  const ckOf = useMemo(() => Object.fromEntries((checklist?.symbols ?? []).map((x) => [x.symbol, x.score])), [checklist]);
  const [sort, setSort] = useState("list");
  const days = settings.site.sparkline_days;

  const rows = useMemo(() => {
    const list = watchlist.symbols.map((s, i) => ({ ...s, i, m: prices[s.symbol], ck: ckOf[s.symbol] ?? null }));
    const key = {
      gainers: (r) => -(r.m?.change_1d_pct ?? -1e9), losers: (r) => r.m?.change_1d_pct ?? 1e9, checks: (r) => -((r.m?.setup?.passed ?? -1) * 1000 + (r.m?.setup?.vs_bench_long_pct ?? 0)),
      checklist: (r) => -(r.ck?.net ?? -99) * 1000 + r.i, // highest net score first; list order breaks ties
    }[sort];
    if (key) list.sort((a, b) => key(a) - key(b));
    if (sort === "symbol") list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return list;
  }, [watchlist, prices, sort, ckOf]);
  const bm = { symbol: bench.symbol, name: bench.label, m: prices[bench.symbol] };
  const up = rows.filter((r) => r.m?.change_1d_pct > 0).length;

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={`Watchlist · ${market.as_of ? fmtDate(market.as_of) : "no prices yet"} · ${livePrices ? `live · ${market.provider}` : "sample prices"}`}
        title={<>{numWord(rows.length)} names, <Accent>one benchmark.</Accent></>}
        lede={`${up} of ${rows.length} closed higher on the day. Lines show the last ${days} trading days indexed to 100. The site publishes returns, not raw prices (provider licence).`}
        right={
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[{ value: "list", label: "List order" }, { value: "gainers", label: "Gainers" }, { value: "losers", label: "Losers" }, { value: "checks", label: "Checks" }, ...(checklist ? [{ value: "checklist", label: "Checklist" }] : []), { value: "symbol", label: "A–Z" }]}
          />
        }
      />
      {regime && <Regime regime={regime} above={rows.filter((r) => r.m?.above_sma50).length} total={rows.length} />}
      <div className="meta mb-3 hidden grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_minmax(100px,.8fr)_minmax(130px,.9fr)] gap-6 px-7 sm:grid">
        <span>Name</span><span>{days} days, indexed</span><span className="text-right">Checks · checklist · rule</span><span className="text-right">Today</span>
      </div>
      <div className="grid gap-3">
        <Row r={bm} i={0} bench go={go} />
        {rows.map((r, i) => <Row key={r.symbol} r={r} i={i + 1} go={go} rule={ruleOf[r.symbol]} ck={r.ck} hasChecklist={Boolean(checklist)} />)}
      </div>
      <p className="meta mt-6 normal-case tracking-[0.04em]">
        {checklist
          ? `Checklist: the eight-step technical checklist from the video, read by code${checklist.sample ? " from sample prices" : ""}. Unproven for us: a description of the chart, not a forecast. Open a name for its eight steps and risk plan.`
          : "Checklist verdicts (lean up, mixed, lean down) appear after the next daily run."}
      </p>
    </Container>
  );
}

function Row({ r, i, bench = false, go, rule, ck, hasChecklist }) {
  const m = r.m;
  const tone = (m?.ret_20d_pct ?? 0) < 0 ? "down" : "accent";
  return (
    <Reveal
      delay={i * 45}
      role="link"
      tabIndex={0}
      aria-label={`Open ${r.symbol}`}
      onClick={() => go(`stock/${r.symbol}`)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go(`stock/${r.symbol}`))}
      className={`card card-hover grid cursor-pointer grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_minmax(100px,.8fr)_minmax(130px,.9fr)] sm:gap-6 sm:px-7 sm:py-5 ${bench ? "border-dashed bg-transparent" : ""}`}
    >
      <div className="row-span-2 min-w-0 sm:row-span-1">
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-semibold tracking-[-0.03em]">{r.symbol}</span>
          {bench && <span className="pill hidden py-1 text-[11px] text-ink-3 sm:inline-flex">benchmark</span>}
        </div>
        <div className="truncate text-[13px] text-ink-3">{bench ? <span className="sm:hidden">Benchmark · </span> : null}{r.name}</div>
      </div>
      <div className="row-span-2 sm:row-span-1">
        {m?.bars?.length > 1 ? <Sparkline bars={m.bars} tone={tone} delay={i * 60} indexed /> : <span className="meta">no data</span>}
      </div>
      <div className="order-last text-right text-[13px] sm:order-none" title={m?.setup ? `${m.setup.passed} of 4 setup checks` : ""}>
        {bench ? <span className="num font-mono text-ink-2 sm:text-[16px]">{m ? fmtPct(m.ret_20d_pct, 1) : "—"}<span className="ml-1 text-[11px] text-ink-3">20d</span></span> : (
          <>
            <span className="num font-mono sm:text-[16px]">{m?.setup ? `${m.setup.passed}/4` : "—"}</span>
            {m?.setup?.stretched && <span className="ml-1.5 text-[11px] text-people">stretched</span>}
            {hasChecklist && <div className="mt-1"><VerdictPill verdict={ck?.verdict} /></div>}
            {rule && <div className={`hidden truncate text-[11.5px] sm:block ${STATUS[rule].tone}`}>{STATUS[rule].label}</div>}
          </>
        )}
      </div>
      <div className="flex justify-end">
        {m && (
          <span className={`pill num ${m.change_1d_pct >= 0 ? "border-accent/25 bg-accent/12 text-accent" : "border-down/25 bg-down/12 text-down"}`}>
            <span aria-hidden="true" className="text-[9px]">{m.change_1d_pct >= 0 ? "▲" : "▼"}</span>
            {fmtPct(m.change_1d_pct)}
          </span>
        )}
      </div>
    </Reveal>
  );
}

const STATE_TONE = { calm: "accent", normal: "flat", stressed: "down" };
const TREND_TONE = { up: "accent", sideways: "flat", down: "down" };

function Regime({ regime, above, total }) {
  const m = regime.metrics;
  return (
    <div className="mb-10">
      <Strip
        dense
        cells={[
          { value: regime.state, label: `regime · ${regime.benchmark}`, tone: STATE_TONE[regime.state], desc: `As of ${fmtDate(regime.as_of)}. Computed by code from benchmark closes; the brain reads it as context.` },
          { value: regime.trend, label: `${regime.params.trend_sma_days}-day trend`, tone: TREND_TONE[regime.trend], desc: `${fmtPct(m.dist_sma_pct, 1)} vs its ${regime.params.trend_sma_days}-day average, which is ${m.sma_slope_pct >= 0 ? "rising" : "falling"} ${fmtPct(m.sma_slope_pct)} over ${regime.params.slope_days} days.` },
          { value: `${fmtNum(m.vol_ann_pct, 1)}%`, label: "annualised vol", tone: "flat", desc: `${regime.params.vol_days}-day realised volatility of daily returns.` },
          { value: fmtPct(m.drawdown_pct, 1), label: "from 1y high", tone: m.drawdown_pct < -10 ? "down" : "flat", desc: `Distance from the highest close in ${regime.params.drawdown_days} trading days.` },
          ...(total ? [{ value: `${above} of ${total}`, label: "above 50-day", tone: "flat", desc: "Watchlist names above their 50-day average. Only our names: real market breadth is on Today (equal-weight vs cap-weight funds)." }] : []),
        ]}
      />
    </div>
  );
}
