import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct, numWord } from "../lib/format.js";
import { Sparkline } from "../components/charts.jsx";
import { Accent, Container, Reveal, SectionHead, Segmented, Strip } from "../components/ui.jsx";

export default function Watchlist({ data, go }) {
  const { watchlist, prices, bench, settings, regime, livePrices, market } = data;
  const [sort, setSort] = useState("list");
  const days = settings.site.sparkline_days;

  const rows = useMemo(() => {
    const list = watchlist.symbols.map((s, i) => ({ ...s, i, m: prices[s.symbol] }));
    const key = { gainers: (r) => -(r.m?.change_1d_pct ?? -1e9), losers: (r) => r.m?.change_1d_pct ?? 1e9, rel: (r) => -(r.m?.vs_bench_20d_pct ?? -1e9) }[sort];
    if (key) list.sort((a, b) => key(a) - key(b));
    if (sort === "symbol") list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return list;
  }, [watchlist, prices, sort]);
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
            options={[{ value: "list", label: "List order" }, { value: "gainers", label: "Gainers" }, { value: "losers", label: "Losers" }, { value: "rel", label: `vs ${bench.symbol}` }, { value: "symbol", label: "A–Z" }]}
          />
        }
      />
      {regime && <Regime regime={regime} breadth={market.breadth_above_sma50_pct} />}
      <div className="meta mb-3 hidden grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_minmax(100px,.8fr)_minmax(130px,.9fr)] gap-6 px-7 sm:grid">
        <span>Name</span><span>{days} days, indexed</span><span className="text-right">20d vs {bench.symbol}</span><span className="text-right">Today</span>
      </div>
      <div className="grid gap-3">
        <Row r={bm} i={0} bench go={go} />
        {rows.map((r, i) => <Row key={r.symbol} r={r} i={i + 1} go={go} />)}
      </div>
    </Container>
  );
}

function Row({ r, i, bench = false, go }) {
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
      <div className="order-last text-right font-mono text-[13px] sm:order-none sm:text-[16px]" title={m ? `20-day return ${fmtPct(m.ret_20d_pct)}` : ""}>
        {m ? (bench
          ? <span className="num text-ink-2">{fmtPct(m.ret_20d_pct, 1)}</span>
          : <span className={`num ${m.vs_bench_20d_pct >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(m.vs_bench_20d_pct, 1)}</span>) : "—"}
        <span className="ml-1 hidden text-[11px] text-ink-3 sm:inline">{bench ? "20d" : "rel"}</span>
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

function Regime({ regime, breadth }) {
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
          ...(breadth != null ? [{ value: `${fmtNum(breadth, 0)}%`, label: "above 50-day", tone: breadth < 30 ? "down" : breadth > 70 ? "accent" : "flat", desc: "Share of the watchlist above its 50-day average: a small-scale breadth gauge (Insights S-001)." }] : []),
        ]}
      />
    </div>
  );
}
