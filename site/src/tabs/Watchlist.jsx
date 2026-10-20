import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct, numWord } from "../lib/format.js";
import { Sparkline } from "../components/charts.jsx";
import { STATUS } from "../components/goal.jsx";
import { Accent, Container, Reveal, SectionHead, Segmented, Strip } from "../components/ui.jsx";
import { VerdictPill } from "../components/checklist.jsx";
import { marketNote, NOT_YET, nounsFor } from "../lib/markets.js";

/** The Stocks page: the chosen market's list (the header switch), or a calm line while it loads or before its numbers. */
export default function Watchlist({ data, market: mk, go }) {
  if (mk && !mk.isDefault && mk.state !== "ready") return <MarketWaitPage market={mk} />;
  return <List data={mk && !mk.isDefault ? mk.data : data} go={go} />;
}

function MarketWaitPage({ market }) {
  const label = market.entry?.label ?? market.id;
  const note = marketNote(market.entry);
  return (
    <Container className="pt-20">
      <SectionHead eyebrow={`Stocks · ${label}`} title={<>{label}: <Accent>{market.choices.find((c) => c.id === market.id)?.what ?? market.entry?.name}.</Accent></>} lede={note ?? undefined} />
      <div className="card p-6 sm:p-8" role={market.state === "loading" ? "status" : undefined}>
        {market.state === "loading" && <p className="text-[18px] text-ink-2">Loading {label}…</p>}
        {market.state === "none" && <p className="text-[19px] leading-relaxed text-ink">{NOT_YET}</p>}
        {market.state === "error" && (
          <>
            <p className="text-[18px] text-ink">{label} could not load just now.</p>
            <button type="button" onClick={market.retry} className="btn mt-4 min-h-[52px] justify-center">Try again</button>
          </>
        )}
      </div>
    </Container>
  );
}

function List({ data, go }) {
  const { watchlist, prices, bench, settings, regime, livePrices, market, longrun, checklist, sectors } = data;
  const entry = data.marketEntry ?? null;
  const nouns = nounsFor(entry);
  const note = marketNote(entry);
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
        eyebrow={`${entry?.label ?? "Nasdaq"} · ${market.as_of ? fmtDate(market.as_of) : "no prices yet"} · ${livePrices ? `live · ${market.provider}` : "sample prices"}`}
        title={<>{numWord(rows.length)} {nouns.many === "funds" ? "funds" : "names"}, <Accent>one whole market to compare with.</Accent></>}
        lede={`In simple words: these are the companies we keep an eye on, and how each did lately. ${note ? `${note} ` : ""}${up} of ${rows.length} ended the day higher. Each small line shows the last ${days} trading days, starting at 100 so they are easy to compare. We only watch and learn here with pretend money; this is not a shopping list. The site shows how much things went up or down, not raw prices (the price provider's rule).`}
        right={
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[{ value: "list", label: "List order" }, { value: "gainers", label: "Gainers" }, { value: "losers", label: "Losers" }, { value: "checks", label: "Quick checks" }, ...(checklist ? [{ value: "checklist", label: "Checklist" }] : []), { value: "symbol", label: "A–Z" }]}
          />
        }
      />
      {regime && <Regime regime={regime} above={rows.filter((r) => r.m?.above_sma50).length} total={rows.length} />}
      <div className="meta mb-3 hidden grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_minmax(100px,.8fr)_minmax(130px,.9fr)] gap-6 px-7 sm:grid">
        <span>{nouns.many === "funds" ? "Fund · category" : "Name · sector"}</span><span>{days} days, indexed</span><span className="text-end">Quick checks · chart checklist · rule</span><span className="text-end">Today</span>
      </div>
      <div className="grid gap-3">
        <Row r={bm} i={0} bench go={go} />
        {rows.map((r, i) => <Row key={r.symbol} r={r} i={i + 1} go={go} rule={ruleOf[r.symbol]} ck={r.ck} hasChecklist={Boolean(checklist)} group={sectors?.[r.symbol] ?? r.sector ?? r.category} />)}
      </div>
      <p className="meta mt-6 normal-case tracking-[0.04em]">
        {checklist
          ? `Quick checks: four yes-or-no questions, like a report card (out of 4). Chart checklist: eight steps from a trading video, read by a program${checklist.sample ? " from sample prices" : ""}. Unproven for us: it describes the chart, it does not predict. Rule: what our pretend-money practice rule does with it. Open a name to see more.`
          : "Quick checks: four yes-or-no questions, like a report card (out of 4). Chart checklist leans (up, mixed, down) appear after the next daily update."}
      </p>
    </Container>
  );
}

function Row({ r, i, bench = false, go, rule, ck, hasChecklist, group = null }) {
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
          {bench && <span className="pill hidden py-1 text-[11px] text-ink-3 sm:inline-flex">whole market</span>}
        </div>
        <div className="line-clamp-3 text-[13px] leading-snug text-ink-3 sm:line-clamp-none sm:truncate">{bench ? <span className="sm:hidden">Whole market · </span> : null}{r.name}</div>
        {group && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-3 sm:mt-0 sm:truncate">{group}</div>}
      </div>
      <div className="row-span-2 sm:row-span-1">
        {m?.bars?.length > 1 ? <Sparkline bars={m.bars} tone={tone} delay={i * 60} indexed /> : <span className="meta">no data</span>}
      </div>
      <div className="order-last text-end text-[13px] sm:order-none" title={m?.setup ? `${m.setup.passed} of 4 quick checks pass` : ""}>
        {bench ? <span className="num font-mono text-ink-2 sm:text-[16px]">{m ? fmtPct(m.ret_20d_pct, 1) : "—"}<span className="ms-1 text-[11px] text-ink-3">20 days</span></span> : (
          <>
            <span className="num font-mono sm:text-[16px]">{m?.setup ? `${m.setup.passed}/4` : "—"}</span>
            {m?.setup?.stretched && <span className="ms-1.5 text-[11px] text-people" title="It ran up too fast">ran up fast</span>}
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
          { value: regime.state, label: `market mood · ${regime.benchmark}`, tone: STATE_TONE[regime.state], desc: `Like a weather report for the whole market (${regime.benchmark}): calm, normal or stormy. As of ${fmtDate(regime.as_of)}, worked out by a program from the whole market's closing values.` },
          { value: regime.trend, label: `direction · ${regime.params.trend_sma_days} days`, tone: TREND_TONE[regime.trend], desc: `The whole market is ${fmtPct(m.dist_sma_pct, 1)} from its usual level lately (its ${regime.params.trend_sma_days}-day average), and that level is ${m.sma_slope_pct >= 0 ? "rising" : "falling"} ${fmtPct(m.sma_slope_pct)} over ${regime.params.slope_days} days.` },
          { value: `${fmtNum(m.vol_ann_pct, 1)}%`, label: "how much it jumps around", tone: "flat", desc: `How bumpy the whole market's daily moves were over the last ${regime.params.vol_days} days, scaled to a year (its volatility). Higher means a bumpier ride.` },
          { value: fmtPct(m.drawdown_pct, 1), label: "from its high", tone: m.drawdown_pct < -10 ? "down" : "flat", desc: `How far the whole market is below its highest close of the last ${regime.params.drawdown_days} trading days.` },
          ...(total ? [{ value: `${above} of ${total}`, label: "above their usual level", tone: "flat", desc: "How many of our names sit above their usual level lately (their 50-day average). Only our names: the wider picture is on Today." }] : []),
        ]}
      />
    </div>
  );
}
