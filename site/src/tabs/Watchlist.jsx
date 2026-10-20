import { useMemo, useState } from "react";
import { Sparkline } from "../components/charts.jsx";
import { STATUS } from "../components/goal.jsx";
import { Accent, Container, Reveal, SectionHead, Segmented, Strip } from "../components/ui.jsx";
import { VerdictPill } from "../components/checklist.jsx";
import { marketNote, notYet } from "../lib/markets.js";
import { ltr } from "../lib/i18n.js";
import { Auto, useLang } from "../lib/lang.jsx";
import dict from "../i18n/stock.js";

/** The Stocks page: the chosen market's list (the header switch), or a calm line while it loads or before its numbers. */
export default function Watchlist({ data, market: mk, go }) {
  if (mk && !mk.isDefault && mk.state !== "ready") return <MarketWaitPage market={mk} />;
  return <List data={mk && !mk.isDefault ? mk.data : data} go={go} />;
}

function MarketWaitPage({ market }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const label = market.entry?.label ?? market.id;
  const note = marketNote(market.entry, lang);
  return (
    <Container className="pt-20">
      <SectionHead eyebrow={t("wl.wait.eyebrow", { label })} title={<>{label}: <Accent>{market.choices.find((c) => c.id === market.id)?.what ?? market.entry?.name}.</Accent></>} lede={note ?? undefined} />
      <div className="card p-6 sm:p-8" role={market.state === "loading" ? "status" : undefined}>
        {market.state === "loading" && <p className="text-[18px] text-ink-2">{t("wl.wait.loading", { label })}</p>}
        {market.state === "none" && <p className="text-[19px] leading-relaxed text-ink">{notYet(lang)}</p>}
        {market.state === "error" && (
          <>
            <p className="text-[18px] text-ink">{t("wl.wait.error", { label })}</p>
            <button type="button" onClick={market.retry} className="btn mt-4 min-h-[52px] justify-center">{t("cdv.retry")}</button>
          </>
        )}
      </div>
    </Container>
  );
}

function List({ data, go }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  const { watchlist, prices, bench, settings, regime, livePrices, market, longrun, checklist, sectors } = data;
  const entry = data.marketEntry ?? null;
  const funds = entry?.kind === "funds";
  const note = marketNote(entry, lang);
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
        eyebrow={`${entry?.label ?? "Nasdaq"} · ${market.as_of ? fmt.date(market.as_of) : t("wl.noPrices")} · ${livePrices ? t("wl.live", { provider: market.provider }) : t("ckc.samplePrices")}`}
        title={<>{t(funds ? "wl.title.funds" : "wl.title.names", { n: fmt.numWord(rows.length) })} <Accent>{t("wl.title.accent")}</Accent></>}
        lede={t("wl.lede", { note: note ? `${note} ` : "", up, n: rows.length, days }, { bidi: false })}
        right={
          <Segmented
            label={t("wl.sort")}
            value={sort}
            onChange={setSort}
            options={[{ value: "list", label: t("wl.sort.list") }, { value: "gainers", label: t("wl.sort.gainers") }, { value: "losers", label: t("wl.sort.losers") }, { value: "checks", label: t("wl.sort.checks") }, ...(checklist ? [{ value: "checklist", label: t("wl.sort.checklist") }] : []), { value: "symbol", label: t("wl.sort.az") }]}
          />
        }
      />
      {regime && <Regime regime={regime} above={rows.filter((r) => r.m?.above_sma50).length} total={rows.length} />}
      <div className="meta mb-3 hidden grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_minmax(100px,.8fr)_minmax(130px,.9fr)] gap-6 px-7 sm:grid">
        <span>{t(funds ? "wl.col.fund" : "wl.col.name")}</span><span>{t("wl.col.days", { days })}</span><span className="text-end">{t("wl.col.checks")}</span><span className="text-end">{t("wl.col.today")}</span>
      </div>
      <div className="grid gap-3">
        <Row r={bm} i={0} bench go={go} />
        {rows.map((r, i) => <Row key={r.symbol} r={r} i={i + 1} go={go} rule={ruleOf[r.symbol]} ck={r.ck} hasChecklist={Boolean(checklist)} group={sectors?.[r.symbol] ?? r.sector ?? r.category} />)}
      </div>
      <p className="meta mt-6 normal-case tracking-[0.04em]">
        {checklist ? t(checklist.sample ? "wl.foot.sample" : "wl.foot.live") : t("wl.foot.none")}
      </p>
    </Container>
  );
}

function Row({ r, i, bench = false, go, rule, ck, hasChecklist, group = null }) {
  const { fmt, t: tr } = useLang();
  const t = tr(dict);
  const m = r.m;
  const tone = (m?.ret_20d_pct ?? 0) < 0 ? "down" : "accent";
  return (
    <Reveal
      delay={i * 45}
      role="link"
      tabIndex={0}
      aria-label={t("wl.open", { symbol: r.symbol })}
      onClick={() => go(`stock/${r.symbol}`)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go(`stock/${r.symbol}`))}
      className={`card card-hover grid cursor-pointer grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[minmax(150px,1.1fr)_minmax(140px,2fr)_minmax(100px,.8fr)_minmax(130px,.9fr)] sm:gap-6 sm:px-7 sm:py-5 ${bench ? "border-dashed bg-transparent" : ""}`}
    >
      <div className="row-span-2 min-w-0 sm:row-span-1">
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-semibold tracking-[-0.03em]">{r.symbol}</span>
          {bench && <span className="pill hidden py-1 text-[11px] text-ink-3 sm:inline-flex">{t("wl.wholeMarket")}</span>}
        </div>
        <div className="line-clamp-3 text-[13px] leading-snug text-ink-3 sm:line-clamp-none sm:truncate">{bench ? <span className="sm:hidden">{t("wl.wholeMarketDot")}</span> : null}<Auto>{r.name}</Auto></div>
        {group && <div dir="auto" className="mt-0.5 text-[12.5px] leading-snug text-ink-3 sm:mt-0 sm:truncate">{group}</div>}
      </div>
      <div className="row-span-2 sm:row-span-1">
        {m?.bars?.length > 1 ? <Sparkline bars={m.bars} tone={tone} delay={i * 60} indexed /> : <span className="meta">{t("wl.noData")}</span>}
      </div>
      <div className="order-last text-end text-[13px] sm:order-none" title={m?.setup ? t("wl.checksTitle", { n: m.setup.passed }) : ""}>
        {bench ? <span className="num font-mono text-ink-2 sm:text-[16px]">{m ? fmt.pct(m.ret_20d_pct, 1) : "—"}<span className="ms-1 text-[11px] text-ink-3">{t("wl.20days")}</span></span> : (
          <>
            <span className="num font-mono sm:text-[16px]"><bdi>{m?.setup ? `${m.setup.passed}/4` : "—"}</bdi></span>
            {m?.setup?.stretched && <span className="ms-1.5 text-[11px] text-people" title={t("wl.ranUpTitle")}>{t("wl.ranUp")}</span>}
            {hasChecklist && <div className="mt-1"><VerdictPill verdict={ck?.verdict} /></div>}
            {rule && <div className={`hidden truncate text-[11.5px] sm:block ${STATUS[rule].tone}`}>{t.has(`st.status.${rule}`) ? t(`st.status.${rule}`) : STATUS[rule].label}</div>}
          </>
        )}
      </div>
      <div className="flex justify-end">
        {m && (
          <span className={`pill num ${m.change_1d_pct >= 0 ? "border-accent/25 bg-accent/12 text-accent" : "border-down/25 bg-down/12 text-down"}`}>
            <span aria-hidden="true" className="text-[9px]">{m.change_1d_pct >= 0 ? "▲" : "▼"}</span>
            {fmt.pct(m.change_1d_pct)}
          </span>
        )}
      </div>
    </Reveal>
  );
}

const STATE_TONE = { calm: "accent", normal: "flat", stressed: "down" };
const TREND_TONE = { up: "accent", sideways: "flat", down: "down" };

function Regime({ regime, above, total }) {
  const { he, t: tr, fmt } = useLang();
  const t = tr(dict);
  const m = regime.metrics;
  const p = regime.params;
  const word = (k) => (t.has(k) ? t(k) : k.split(".").pop());
  return (
    <div className="mb-10">
      <Strip
        dense
        cells={[
          { value: word(`wl.mood.${regime.state}`), label: t("wl.mood.label", { bench: regime.benchmark }), tone: STATE_TONE[regime.state], desc: t("wl.mood.desc", { bench: regime.benchmark, date: fmt.date(regime.as_of) }) },
          { value: word(`wl.dir.${regime.trend}`), label: t("wl.dir.label", { days: p.trend_sma_days }), tone: TREND_TONE[regime.trend], desc: t(m.sma_slope_pct >= 0 ? "wl.dir.descRising" : "wl.dir.descFalling", { dist: fmt.pct(m.dist_sma_pct, 1), days: p.trend_sma_days, slope: fmt.pct(m.sma_slope_pct), slopeDays: p.slope_days }) },
          { value: he ? ltr(`${m.vol_ann_pct.toFixed(1)}%`) : `${fmt.num(m.vol_ann_pct, 1)}%`, label: t("wl.vol.label"), tone: "flat", desc: t("wl.vol.desc", { days: p.vol_days }) },
          { value: fmt.pct(m.drawdown_pct, 1), label: t("wl.dd.label"), tone: m.drawdown_pct < -10 ? "down" : "flat", desc: t("wl.dd.desc", { days: p.drawdown_days }) },
          ...(total ? [{ value: t("wl.above.value", { above, total }), label: t("wl.above.label"), tone: "flat", desc: t("wl.above.desc") }] : []),
        ]}
      />
    </div>
  );
}
