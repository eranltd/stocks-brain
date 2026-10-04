import { useMemo, useState } from "react";
import { dailyChange } from "../lib/data.js";
import { fmtDate, fmtNum, fmtPct, numWord } from "../lib/format.js";
import { Sparkline } from "../components/charts.jsx";
import { Accent, Container, CountUp, Reveal, SectionHead, Segmented, Strip } from "../components/ui.jsx";

export default function Watchlist({ data }) {
  const { watchlist, prices, bench, settings, regime, livePrices } = data;
  const [sort, setSort] = useState("list");
  const days = settings.site.sparkline_days;

  const rows = useMemo(() => {
    const list = watchlist.symbols.map((s, i) => ({ ...s, i, bars: prices[s.symbol]?.bars ?? [], chg: dailyChange(prices[s.symbol]?.bars) }));
    if (sort === "gainers") list.sort((a, b) => (b.chg?.pct ?? -1e9) - (a.chg?.pct ?? -1e9));
    if (sort === "losers") list.sort((a, b) => (a.chg?.pct ?? 1e9) - (b.chg?.pct ?? 1e9));
    if (sort === "symbol") list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return list;
  }, [watchlist, prices, sort]);
  const bm = { symbol: bench.symbol, name: bench.label, bars: prices[bench.symbol]?.bars ?? [], chg: dailyChange(prices[bench.symbol]?.bars) };
  const asOf = bm.chg?.date ?? rows.find((r) => r.chg)?.chg.date;
  const up = rows.filter((r) => r.chg?.pct > 0).length;

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={`Watchlist · ${asOf ? fmtDate(asOf) : "no prices yet"} · ${livePrices ? `live · ${data.manifest.price_provider}` : "sample prices"}`}
        title={<>{numWord(rows.length)} names, <Accent>one benchmark.</Accent></>}
        lede={`${up} of ${rows.length} closed higher on the day. The list lives in config/watchlist.json; scripts never hard-code a ticker.`}
        right={
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[{ value: "list", label: "List order" }, { value: "gainers", label: "Gainers" }, { value: "losers", label: "Losers" }, { value: "symbol", label: "A–Z" }]}
          />
        }
      />
      {regime && <Regime regime={regime} />}
      <div className="grid gap-3">
        <Row r={bm} i={0} days={days} bench />
        {rows.map((r, i) => <Row key={r.symbol} r={r} i={i + 1} days={days} />)}
      </div>
    </Container>
  );
}

function Row({ r, i, days, bench = false }) {
  const tone = (r.chg?.pct ?? 0) < 0 ? "down" : "accent";
  return (
    <Reveal
      delay={i * 45}
      className={`card card-hover grid grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_minmax(100px,.8fr)_minmax(130px,.9fr)] sm:gap-6 sm:px-7 sm:py-5 ${bench ? "border-dashed bg-transparent" : ""}`}
    >
      <div className="row-span-2 min-w-0 sm:row-span-1">
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-semibold tracking-[-0.03em]">{r.symbol}</span>
          {bench && <span className="pill hidden py-1 text-[10px] text-ink-3 sm:inline-flex">benchmark</span>}
        </div>
        <div className="truncate text-[13px] text-ink-3">{bench ? <span className="sm:hidden">Benchmark · </span> : null}{r.name}</div>
      </div>
      <div className="row-span-2 sm:row-span-1">
        {r.bars.length > 1 ? <Sparkline bars={r.bars.slice(-days)} tone={tone} delay={i * 60} /> : <span className="meta">no data</span>}
      </div>
      <div className="order-last text-right font-mono text-[14px] sm:order-none sm:text-[17px]">
        {r.chg ? <CountUp value={r.chg.last} decimals={2} /> : "—"}
      </div>
      <div className="flex justify-end">
        {r.chg && (
          <span className={`pill num ${r.chg.pct >= 0 ? "border-accent/25 bg-accent/12 text-accent" : "border-down/25 bg-down/12 text-down"}`}>
            <span aria-hidden="true" className="text-[9px]">{r.chg.pct >= 0 ? "▲" : "▼"}</span>
            {fmtPct(r.chg.pct)}
            <span className="hidden opacity-70 md:inline">{r.chg.abs >= 0 ? "+" : "−"}{fmtNum(Math.abs(r.chg.abs))}</span>
          </span>
        )}
      </div>
    </Reveal>
  );
}

const STATE_TONE = { calm: "accent", normal: "flat", stressed: "down" };
const TREND_TONE = { up: "accent", sideways: "flat", down: "down" };

function Regime({ regime }) {
  const m = regime.metrics;
  return (
    <div className="mb-10">
      <Strip
        cells={[
          { value: regime.state, label: `regime · ${regime.benchmark}`, tone: STATE_TONE[regime.state], desc: `As of ${fmtDate(regime.as_of)}. Computed by code from benchmark closes; the brain reads it as context.` },
          { value: regime.trend, label: `${regime.params.trend_sma_days}-day trend`, tone: TREND_TONE[regime.trend], desc: `Close ${fmtNum(m.close)} vs average ${fmtNum(m.sma)}; average ${m.sma_slope_pct >= 0 ? "rising" : "falling"} ${fmtPct(m.sma_slope_pct)} over ${regime.params.slope_days} days.` },
          { value: `${fmtNum(m.vol_ann_pct, 1)}%`, label: "annualised vol", tone: "flat", desc: `${regime.params.vol_days}-day realised volatility of daily returns.` },
          { value: fmtPct(m.drawdown_pct, 1), label: "from 1y high", tone: m.drawdown_pct < -10 ? "down" : "flat", desc: `Distance from the highest close in ${regime.params.drawdown_days} trading days.` },
        ]}
      />
    </div>
  );
}
