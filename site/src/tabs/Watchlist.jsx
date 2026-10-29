import { useMemo, useRef, useState } from "react";
import { STATUS } from "../components/goal.jsx";
import { trustStage } from "../components/trust.jsx";
import { CallChip, Chip, Container, DataTable, EmptyState, HeroTitle, InfoTip, MiniSpark, Panel, Segmented, SimBadge, SkeletonRows } from "../components/ui.jsx";
import { BreadthBar, Count, DeskHead, HeatTile, KpiStrip, toneText } from "../components/pulse.jsx";
import { BigBoard } from "../components/bigboard.jsx";
import { Floor, useFloorLoop } from "../components/floor.jsx";
import { Pairs } from "../components/pairs.jsx";
import { floorData } from "../lib/floor.js";
import { VERDICT } from "../lib/checklist.js";
import { marketNote, NOT_YET } from "../lib/markets.js";
import { deskCalls, freshness, houseLimits, unusualToday } from "../lib/desk.js";
import { mainListOf } from "../lib/buywindow.js";
import { stocksEarned } from "../lib/money.js";
import { plainName, usableWhy } from "../lib/why.js";
import dict from "../text/stock.js";
import homeDict from "../text/home.js";
import { strings } from "../lib/text.js";
import { fmtDate, fmtPct } from "../lib/format.js";

/*
 * The Stocks page: a market scanner for the market chosen in the header (or in the page's own market tabs). The hero
 * names the market; a strip of big numbers picks out the day's top gainer, top loser, most unusual volume and the
 * up/down split; the main list adds its market regime. The scanner opens on the floor (ARENA, the default: one square
 * per name replaying the last 30 trading days again and again, components/floor.jsx); it also shows the big board
 * (CHART: one line per name over 1M to 1Y, components/bigboard.jsx) and every name as a dense table (LIST: percent
 * moves, never a price or raw volume; the quick checks; the chart checklist; on the main list the Desk's paper call as
 * a coloured edge and a chip) or as a heat grid (HEAT: one tile per name, coloured by the day's move). Filters are chips;
 * long words sit behind (i) buttons. Under the scanner, pair stocks from every list (components/pairs.jsx), stepped by
 * the floor's clock. Words in text/stock.js ("wl.*"); the Desk's calls in its own words (text/home.js).
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const num = (v) => (isNum(v) ? v : null);
const pct = (v, d = 1) => (isNum(v) ? fmtPct(v, d) : "–");
/** "+3", "−2", "0": a net score with a true minus sign. */
const signed = (n) => (n == null ? "–" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`);
const CALL_RANK = { buy: 2, wait: 1, reject: 0 };
const VERDICT_CHIP = { accent: "up", down: "down", flat: "neutral" };
const UNUSUAL_VOLUME = 1.5;
// The scanner's view (ARENA | CHART | LIST | HEAT), remembered on this device only; ARENA when nothing is stored.
const VIEW_KEY = "sb:stocks-view";
const VIEWS = ["arena", "chart", "list", "heat"];
function readView() {
  try { const v = window.localStorage.getItem(VIEW_KEY); return VIEWS.includes(v) ? v : "arena"; } catch { return "arena"; }
}
function saveView(v) {
  try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* private mode or blocked storage */ }
}

/** The Stocks page: the chosen market's scanner, or a calm panel while it loads or before its numbers. */
export default function Watchlist({ data, market: mk, go }) {
  if (mk && !mk.isDefault && mk.state !== "ready") return <MarketWaitPage market={mk} />;
  return <Scanner data={mk && !mk.isDefault ? mk.data : data} base={data} market={mk} go={go} />;
}

/** The page's market tabs: the same choice as the header's switch. */
function MarketTabs({ market }) {
  const t = strings(dict);
  if (!market?.choices?.length) return null;
  return (
    <div className="mt-5 max-w-full">
      <Segmented label={t("wl.markets")} value={market.id} onChange={(id) => id !== market.id && market.choose(id)}
        options={market.choices.map((c) => ({ value: c.id, label: c.label }))} />
    </div>
  );
}

function MarketWaitPage({ market }) {
  const t = strings(dict);
  const label = market.entry?.label ?? market.id;
  const what = market.choices.find((c) => c.id === market.id)?.what ?? market.entry?.name;
  const note = marketNote(market.entry);
  return (
    <Container className="pt-8 pb-6">
      <HeroTitle line1={t("wl.hero1")} line2={label} sub={what} />
      {note && <p className="mt-3 max-w-[64ch] text-[13px] leading-snug text-ink-3">{note}</p>}
      <MarketTabs market={market} />
      <Panel id="wl-wait" className="mt-5" head={<DeskHead id="wl-wait-h" title={t("wl.panel.scan")} sub={market.state === "loading" ? t("wl.wait.loading", { label }) : t("wl.wait.title")} />}>
        <div role={market.state === "loading" ? "status" : undefined}>
          {market.state === "loading" && <SkeletonRows rows={7} />}
          {market.state === "none" && <EmptyState compact title={label}>{NOT_YET}</EmptyState>}
          {market.state === "error" && (
            <EmptyState compact title={t("wl.wait.error", { label })}
              action={<button type="button" onClick={market.retry} className="btn min-h-[48px] justify-center">{t("cdv.retry")}</button>} />
          )}
        </div>
      </Panel>
    </Container>
  );
}

/**
 * The Desk's call for each name on the main list ({ticker: "buy" | "wait" | "reject"}), worked out exactly as Home's Desk
 * does (components/desk.jsx useDesk): the same reports, limits and freshness, so the two pages always agree.
 */
function deskCallMap(data) {
  const checklist = data.checklist && (!data.checklist.sample || data.sample) ? data.checklist : null;
  const why = usableWhy(data.why, data.livePrices);
  const secNews = data.secNews && !(data.secNews.sample && data.livePrices) ? data.secNews : null;
  const market = data.market;
  const run = data.lastOk ?? null;
  const members = mainListOf(data);
  const household = (data.docs ?? []).find((d) => d.name === "household")?.content ?? null;
  const earned = stocksEarned(data.rulesResult, trustStage(data).stage);
  const limits = houseLimits({ settings: data.settings, checklistCfg: data.checklistCfg, checklist, rulebook: data.rulebook, household, earned });
  const fresh = freshness({ market, checklist, why, secNews, run });
  const calls = deskCalls({ market, checklist, run, members, names: data.names ?? {}, limits, received: fresh.received });
  return Object.fromEntries(calls.map((r) => [r.ticker, r.call]));
}

/** One scanner row from the published numbers (percent only). */
function rowOf(symbol, name, m, c, extra = {}) {
  return {
    symbol, name,
    spark: (m?.spark ?? []).map((p) => p.v).filter(isNum),
    series: m?.series ?? null,
    day: num(m?.change_1d_pct), d20: num(m?.ret_20d_pct), d60: num(m?.ret_60d_pct), y1: num(m?.ret_250d_pct ?? m?.risk?.ret_1y_pct),
    vol: num(m?.vol20_pct), volX: num(c?.volume?.vs_avg20),
    checks: m?.setup ? m.setup.passed : null, stretched: Boolean(m?.setup?.stretched),
    net: num(c?.score?.net), verdict: c?.score?.verdict ?? null,
    unusual: m ? Boolean(unusualToday(m)) : false,
    ...extra,
  };
}

const FILTERS = {
  all: () => true,
  up: (r) => r.day > 0,
  down: (r) => r.day < 0,
  unusual: (r) => r.volX != null && r.volX >= UNUSUAL_VOLUME,
  leanUp: (r) => r.verdict === "lean_up",
  leanDown: (r) => r.verdict === "lean_down",
  buy: (r) => r.call === "buy",
};
const FILTER_TONE = { up: "up", down: "down", unusual: "brand", leanUp: "up", leanDown: "down", buy: "up" };
const missing = (v) => v == null || (typeof v === "number" && !Number.isFinite(v));

function Scanner({ data, base, market: mk, go }) {
  const t = strings(dict);
  const th = strings(homeDict);
  const { watchlist, prices, bench, settings, regime, livePrices, market, longrun, checklist, sectors } = data;
  const entry = data.marketEntry ?? mk?.entry ?? null;
  const funds = entry?.kind === "funds";
  const main = !mk || mk.isDefault;
  const note = marketNote(entry);
  const days = settings.site.sparkline_days;
  const label = entry?.label ?? "";
  const what = mk?.choices?.find((c) => c.id === mk.id)?.what ?? entry?.name ?? "";
  const benchName = plainName(bench.label ?? bench.symbol);

  const calls = useMemo(() => (main && data.market ? deskCallMap(data) : null), [main, data]);
  const rows = useMemo(() => {
    const cl = Object.fromEntries((checklist?.symbols ?? []).map((x) => [x.symbol, x]));
    const ruleOf = Object.fromEntries((longrun?.now.status ?? []).map((x) => [x.symbol, x.status]));
    return watchlist.symbols.map((s, i) => rowOf(s.symbol, data.names?.[s.symbol] ?? s.name ?? s.symbol, prices[s.symbol], cl[s.symbol], {
      i, group: sectors?.[s.symbol] ?? s.sector ?? s.category ?? null, rule: ruleOf[s.symbol] ?? null, call: calls?.[s.symbol] ?? null,
    }));
  }, [watchlist, prices, checklist, longrun, sectors, calls, data.names]);
  const benchRow = useMemo(() => (prices[bench.symbol] ? rowOf(bench.symbol, benchName, prices[bench.symbol], null, { bench: true, i: -1 }) : null),
    [prices, bench.symbol, benchName]);

  // The floor and the pair cards share one looping clock; it runs while the scanner or the pairs are on screen.
  const floor = useMemo(() => floorData(rows), [rows]);
  const watch = useRef(null);
  const loop = useFloorLoop({ n: floor?.loopDates.length ?? 1, watch, resetKey: `${mk?.id ?? ""}|${floor?.loopDates[0] ?? ""}` });
  const [view, setViewState] = useState(readView);
  const setView = (v) => { setViewState(v); saveView(v); };
  const [filter, setFilter] = useState("all");
  const [group, setGroup] = useState(null);
  const [sort, setSort] = useState(null); // null: the list's own order
  const groups = useMemo(() => {
    const n = {};
    for (const r of rows) if (r.group) n[r.group] = (n[r.group] ?? 0) + 1;
    const list = Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    // Chips only help with two to twelve groups, one of them holding more than one name.
    return list.length >= 2 && list.length <= 12 && list.some(([, k]) => k > 1) ? list : [];
  }, [rows]);

  const columns = useMemo(() => scanColumns({ t, th, days, main, hasRule: rows.some((r) => r.rule), hasChecklist: Boolean(checklist), funds }),
    [t, th, days, main, rows, checklist, funds]);
  const shown = useMemo(() => {
    const keep = rows.filter((r) => FILTERS[filter](r) && (!group || r.group === group));
    // The heat grid reads best strongest-up first, unless a column sort was chosen.
    const s = sort ?? (view === "heat" ? { key: "day", dir: "desc" } : null);
    if (!s) return keep;
    const val = columns.find((c) => c.key === s.key)?.sortValue ?? ((r) => r[s.key]);
    const sign = s.dir === "asc" ? 1 : -1;
    return [...keep].sort((a, b) => {
      const x = val(a), y = val(b);
      if (missing(x) || missing(y)) return missing(x) === missing(y) ? a.i - b.i : missing(x) ? 1 : -1;
      return sign * (typeof x === "string" ? x.localeCompare(String(y)) : x - y) || a.i - b.i;
    });
  }, [rows, filter, group, sort, columns, view]);
  const onSort = (key) => setSort((s) => (s?.key === key
    ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
    : { key, dir: columns.find((c) => c.key === key)?.firstDir ?? "desc" }));
  const tableRows = benchRow && filter === "all" && !group ? [benchRow, ...shown] : shown;

  const counts = Object.fromEntries(Object.keys(FILTERS).map((k) => [k, rows.filter(FILTERS[k]).length]));
  const filters = ["all", "up", "down", "unusual", ...(checklist ? ["leanUp", "leanDown"] : []), ...(calls ? ["buy"] : [])];
  const total = rows.length;
  const info = `${t("wl.table.info")}${calls ? ` ${t("wl.table.callInfo")}` : ""} ${checklist ? t(checklist.sample ? "wl.foot.sample" : "wl.foot.live") : t("wl.foot.none")}`;
  const clear = () => { setFilter("all"); setGroup(null); };

  return (
    <Container className="pt-8 pb-6">
      <div className="grid gap-4">
        <HeroTitle line1={t("wl.hero1")} line2={label} sub={t(funds ? "wl.sub.funds" : "wl.sub.names", { count: total, what, bench: benchName })} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={livePrices ? "up" : "wait"}>
            <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current" />
            {livePrices ? t("wl.chip.live", { provider: market.provider }) : t("wl.chip.sample")}
          </Chip>
          <Chip tone="neutral"><span className="text-ink-2">{market.as_of ? t("wl.chip.close", { date: fmtDate(market.as_of) }) : t("wl.noPrices")}</span></Chip>
          {calls && <SimBadge />}
          <InfoTip label={t("wl.about")} align="start">{t("wl.lede", { note: note ? `${note} ` : "", up: counts.up, n: total, days })}</InfoTip>
        </div>
        {note && <p className="-mt-1 max-w-[64ch] text-[13px] leading-snug text-ink-3">{note}</p>}
      </div>
      <MarketTabs market={mk} />

      <Tiles rows={rows} up={counts.up} down={counts.down} total={total} go={go} />

      <div ref={watch}>
      <Panel id="wl-table" className="mt-4 scroll-mt-28" info={info} infoLabel={t("wl.about")}
        head={<div className="max-[440px]:sr-only"><DeskHead id="wl-table-h" title={t("wl.panel.scan")} /></div>}
        badge={<ViewSwitch view={view} setView={setView} />}>
        <div className="-mt-2 sm:-mt-3">
          <div role="group" aria-label={t("wl.filter")} className="no-scrollbar rail-fade -mx-1 flex gap-1 overflow-x-auto px-1">
            {filters.map((f) => (
              <FilterChip key={f} on={filter === f} count={f === "all" ? total : counts[f]} disabled={f !== "all" && !counts[f]} tone={FILTER_TONE[f]}
                onClick={() => setFilter(f === filter ? "all" : f)}>{t(`wl.f.${f}`)}</FilterChip>
            ))}
            {sort && <FilterChip on={false} onClick={() => setSort(null)} icon="↺">{t("wl.f.listOrder")}</FilterChip>}
          </div>
          {groups.length > 0 && (
            <div role="group" aria-label={t("wl.group")} className="no-scrollbar rail-fade -mx-1 -mt-1.5 flex gap-1 overflow-x-auto px-1">
              {groups.map(([g, n]) => <FilterChip key={g} on={group === g} count={n} quiet onClick={() => setGroup(group === g ? null : g)}>{g}</FilterChip>)}
            </div>
          )}
        </div>
        {!shown.length ? (
          <EmptyState compact className="mt-3" title={t("wl.none.title")}
            action={<button type="button" onClick={clear} className="btn min-h-[44px] justify-center">{t("wl.none.clear")}</button>}>
            {t("wl.none.body")}
          </EmptyState>
        ) : view === "arena" && floor ? (
          <Floor floor={floor} show={filter === "all" && !group ? null : new Set(shown.map((r) => r.symbol))} loop={loop} go={go} />
        ) : view === "chart" || view === "arena" ? (
          <BigBoard rows={shown} bench={benchRow} benchName={benchName} closeDate={market.as_of} />
        ) : view === "heat" ? (
          <HeatGrid rows={shown} calls={Boolean(calls)} go={go} />
        ) : (
          <div className="mt-2">
            <DataTable columns={columns} rows={tableRows} rowKey={(r) => (r.bench ? `bench:${r.symbol}` : r.symbol)} sort={sort} onSort={onSort}
              minWidth={columns.reduce((a, c) => a + (c.w ?? 80), 0)} onRowClick={(r) => go(`stock/${r.symbol}`)} rowLabel={(r) => t("wl.open", { symbol: r.symbol })}
              rowTone={(r) => (r.bench ? "brand" : null)} className="scan-table" scrollClassName="md:max-h-[640px] md:overflow-y-auto"
              caption={t(funds ? "wl.table.funds" : "wl.table.names", { n: total })} />
          </div>
        )}
      </Panel>
      {floor && <Pairs base={base ?? data} loop={loop} n={floor.loopDates.length} go={go} />}
      </div>
      {regime && main && <Regime regime={regime} benchName={benchName} above={rows.filter((r) => prices[r.symbol]?.above_sma50).length} total={total} />}
    </Container>
  );
}

/** ARENA | CHART | LIST | HEAT. */
function ViewSwitch({ view, setView }) {
  const t = strings(dict);
  return (
    <div role="group" aria-label={t("wl.view")} className="-my-1 inline-flex rounded-[9px] border border-line-2 bg-surface-2 p-0.5">
      {VIEWS.map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
          className={`relative min-h-[36px] rounded-[7px] px-2.5 font-mono text-[11px] font-semibold tracking-[0.1em] uppercase sm:px-3 sm:tracking-[0.14em] transition-colors ${view === v ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]" : "text-ink-3 hover:text-ink"}`}>
          {t(`wl.view.${v}`)}
          {view === v && <span aria-hidden="true" className="absolute inset-x-2.5 bottom-1 h-px bg-desk" />}
        </button>
      ))}
    </div>
  );
}

/** A filter as a chip with a 44px tap target; `count` after the label, `quiet` for the second row (groups). */
function FilterChip({ on, onClick, count, disabled = false, tone, quiet = false, icon, children }) {
  const lit = { up: "border-up/50 bg-up/12 text-up", down: "border-down/50 bg-down/12 text-down", brand: "border-desk/55 bg-desk/12 text-desk" }[tone]
    ?? "border-ink-3/60 bg-surface-3 text-ink";
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick} className="group inline-flex min-h-[44px] shrink-0 items-center disabled:opacity-40">
      <span className={`chip transition-colors ${quiet ? "min-h-[24px] text-[11px] tracking-[0.02em] normal-case" : ""} ${on ? lit : "border-line-2 bg-surface-2 text-ink-2 group-hover:border-line-3 group-hover:text-ink group-disabled:group-hover:border-line-2"}`}>
        {icon && <span aria-hidden="true">{icon}</span>}
        {children}
        {count != null && <span className={`font-num tracking-normal ${on ? "" : "text-ink-3"}`}>{count}</span>}
      </span>
    </button>
  );
}

const CALL_EDGE = { buy: "call-edge call-edge-buy", wait: "call-edge call-edge-wait", reject: "call-edge call-edge-reject" };

/** The table's columns. `w` is each column's share of the table's minimum width (px). */
function scanColumns({ t, th, days, main, hasRule, hasChecklist, funds }) {
  const numCol = (key, label, w = 66, d = 1) => ({ key, label, sortable: true, num: true, w, className: (r) => toneText(r[key], d), cell: (r) => pct(r[key], d) });
  return [
    { key: "symbol", label: t("wl.col.ticker"), sortable: true, firstDir: "asc", w: 150, sortValue: (r) => r.symbol, className: (r) => CALL_EDGE[r.call] ?? "", cell: (r) => (
      <span className="flex min-w-0 items-center gap-2" title={r.group ? `${r.name} · ${r.group}` : r.name}>
        {r.unusual && <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-desk font-num text-[10px] font-bold text-bg shadow-[0_0_10px_var(--desk-glow)]" title={t("wl.unusual")} aria-label={t("wl.unusual")}>!</span>}
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="font-num text-[13.5px] font-bold text-ink">{r.symbol}</span>
            {r.bench && <span className="micro rounded-[4px] border border-desk/50 px-1 py-px text-[9px] text-desk">{t("wl.bench")}</span>}
          </span>
          <span className="block max-w-[118px] truncate text-[11px] leading-tight text-ink-3 sm:max-w-[132px]">{r.name}</span>
        </span>
      </span>
    ) },
    { key: "spark", label: t("wl.col.spark", { days }), w: 82, cell: (r) => <MiniSpark values={r.spark} w={68} h={24} /> },
    { ...numCol("day", t("wl.col.day"), 70), className: (r) => `${toneText(r.day)} font-semibold` },
    numCol("d20", t("wl.col.d20")),
    numCol("d60", t("wl.col.d60")),
    numCol("y1", t("wl.col.y1"), 70),
    { key: "vol", label: t("wl.col.vol"), sortable: true, num: true, w: 84, className: "text-ink-2", cell: (r) => (isNum(r.vol) ? `${r.vol.toFixed(1)}%` : "–") },
    { key: "volX", label: t("wl.col.volx"), sortable: true, num: true, w: 70,
      className: (r) => (r.volX != null && r.volX >= UNUSUAL_VOLUME ? "font-bold text-desk" : "text-ink-2"), cell: (r) => (isNum(r.volX) ? `${r.volX.toFixed(2)}×` : "–") },
    { key: "checks", label: t("wl.col.quick"), sortable: true, num: true, w: 70, cell: (r) => (r.bench ? <span className="text-ink-3">–</span> : (
      <span className="inline-flex items-center gap-1" title={r.checks != null ? t("wl.checksTitle", { n: r.checks }) : undefined}>
        {r.stretched && <span className="text-[10px] text-people" title={t("wl.ranUpTitle")} aria-label={t("wl.ranUp")}>▲</span>}
        <span className={r.checks === 4 ? "font-bold text-up" : r.checks != null ? "text-ink" : "text-ink-3"}>{r.checks != null ? `${r.checks}/4` : "–"}</span>
      </span>
    )) },
    ...(hasChecklist ? [{ key: "net", label: t("wl.col.checklist"), sortable: true, w: 104, cell: (r) => {
      const v = VERDICT[r.verdict];
      if (!v) return <span className="font-num text-ink-3">–</span>;
      return (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className={`font-num font-bold ${r.net > 0 ? "text-up" : r.net < 0 ? "text-down" : "text-ink-2"}`}>{signed(r.net)}</span>
          <Chip tone={VERDICT_CHIP[v.tone]} className="min-h-[20px] px-1.5 text-[9.5px]">{v.short}</Chip>
        </span>
      );
    } }] : []),
    ...(hasRule && !funds ? [{ key: "rule", label: t("wl.col.rule"), align: "start", w: 104, cell: (r) => {
      if (!r.rule) return <span className="text-ink-3">–</span>;
      const word = t.has(`st.status.${r.rule}`) ? t(`st.status.${r.rule}`) : STATUS[r.rule]?.label ?? r.rule;
      return <span className={`block max-w-[108px] truncate text-[12px] ${STATUS[r.rule]?.tone ?? "text-ink-3"}`} title={word}>{word}</span>;
    } }] : []),
    ...(main ? [{ key: "call", label: t("wl.col.call"), sortable: true, w: 118, sortValue: (r) => (r.call ? CALL_RANK[r.call] : null), cell: (r) => (r.call
      ? <CallChip call={r.call} label={th(`desk.call.${r.call}`)} className="h-7 min-w-[88px] px-2 text-[12.5px]" />
      : <span className="text-ink-3">–</span>) }] : []),
  ];
}

/** HEAT: one tile per name, coloured by the day's move; a corner mark for the Desk's call on the main list. */
function HeatGrid({ rows, calls, go }) {
  const t = strings(dict);
  const th = strings(homeDict);
  return (
    <div className="mt-2">
      <ul className="grid grid-cols-3 gap-1.5 min-[560px]:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
        {rows.map((r, i) => (
          <li key={r.symbol} className="min-w-0">
            <HeatTile index={i} title={r.symbol} move={r.day} sub={r.name} call={r.call} callLabel={r.call ? th(`desk.call.${r.call}`) : undefined}
              onClick={() => go(`stock/${r.symbol}`)} label={`${t("wl.heat.tile", { symbol: r.symbol, pct: pct(r.day) })}${r.call ? ` · ${th(`desk.call.${r.call}`)}` : ""}`} />
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
        <span>{t(calls ? "wl.heat.legend" : "wl.heat.legendNoCall")}</span>
        {calls && ["buy", "wait", "reject"].map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-0 border-t-[9px] border-l-[9px] border-l-transparent ${{ buy: "border-t-up", wait: "border-t-wait", reject: "border-t-down" }[c]}`} />
            {th(`desk.call.${c}`)}
          </span>
        ))}
      </p>
    </div>
  );
}

/** Top gainer, top loser, most unusual volume and the up/down split, in one strip of big numbers. */
function Tiles({ rows, up, down, total, go }) {
  const t = strings(dict);
  const withDay = rows.filter((r) => isNum(r.day));
  const best = withDay.length ? withDay.reduce((a, b) => (b.day > a.day ? b : a)) : null;
  const worst = withDay.length ? withDay.reduce((a, b) => (b.day < a.day ? b : a)) : null;
  const withVol = rows.filter((r) => isNum(r.volX)).sort((a, b) => b.volX - a.volX);
  const loud = withVol[0] ?? null;
  const open = (r) => (r ? () => go(`stock/${r.symbol}`) : undefined);
  const subOf = (r) => (r ? `${r.symbol} · ${r.name}` : t("wl.tile.none"));
  const cells = [
    { key: "gainer", label: t("wl.tile.gainer"), value: best?.day ?? null, format: (v) => fmtPct(v, 1), tone: "auto", sub: subOf(best), spark: best?.spark, onClick: open(best),
      ariaLabel: best ? `${t("wl.tile.gainer")}: ${best.symbol} ${pct(best.day)}` : undefined },
    { key: "loser", label: t("wl.tile.loser"), value: worst?.day ?? null, format: (v) => fmtPct(v, 1), tone: "auto", sub: subOf(worst), spark: worst?.spark, onClick: open(worst),
      ariaLabel: worst ? `${t("wl.tile.loser")}: ${worst.symbol} ${pct(worst.day)}` : undefined },
    { key: "volume", label: t("wl.tile.volume"), value: loud?.volX ?? null, format: (v) => `${v.toFixed(2)}×`, sub: loud ? `${loud.symbol} · ${t("wl.tile.volumeShort")}` : t("wl.tile.none"),
      bars: withVol.slice(0, 12).map((r) => r.volX), onClick: open(loud), ariaLabel: loud ? `${t("wl.tile.volume")}: ${loud.symbol} ${loud.volX.toFixed(2)}×` : undefined },
    { key: "breadth", label: t("wl.tile.breadth"), node: <><span className="text-up"><Count value={up} /></span><span className="text-ink-3">/</span><span className="text-down"><Count value={down} /></span></>,
      sub: t("wl.tile.breadthOf", { n: total }), foot: <BreadthBar up={up} down={down} total={total} /> },
  ];
  return <KpiStrip cells={cells} label={t("wl.kpi")} className="mt-5" />;
}

const STATE_TONE = { calm: "text-up", normal: "text-ink", stressed: "text-down" };
const TREND_TONE = { up: "text-up", sideways: "text-ink", down: "text-down" };

/** The whole market's mood, direction, bumpiness and distance from its high, and how many names sit above their 50-day average. */
function Regime({ regime, benchName, above, total }) {
  const t = strings(dict);
  const m = regime.metrics;
  const p = regime.params;
  const word = (k) => (t.has(k) ? t(k) : k.split(".").pop());
  const cells = [
    { id: "mood", value: word(`wl.mood.${regime.state}`), label: t("wl.mood.label", { bench: benchName }), tone: STATE_TONE[regime.state], desc: t("wl.mood.desc", { bench: benchName, date: fmtDate(regime.as_of) }), word: true },
    { id: "dir", value: word(`wl.dir.${regime.trend}`), label: t("wl.dir.label", { days: p.trend_sma_days }), tone: TREND_TONE[regime.trend], word: true,
      desc: t(m.sma_slope_pct >= 0 ? "wl.dir.descRising" : "wl.dir.descFalling", { dist: fmtPct(m.dist_sma_pct, 1), days: p.trend_sma_days, slope: fmtPct(m.sma_slope_pct), slopeDays: p.slope_days }) },
    { id: "vol", value: `${m.vol_ann_pct.toFixed(1)}%`, label: t("wl.vol.label"), tone: "text-ink", desc: t("wl.vol.desc", { days: p.vol_days }) },
    { id: "dd", value: fmtPct(m.drawdown_pct, 1), label: t("wl.dd.label"), tone: m.drawdown_pct < -10 ? "text-down" : "text-ink", desc: t("wl.dd.desc", { days: p.drawdown_days }) },
    ...(total ? [{ id: "above", value: t("wl.above.value", { above, total }), label: t("wl.above.label"), tone: "text-ink", desc: t("wl.above.desc") }] : []),
  ];
  return (
    <Panel id="wl-regime" className="mt-4" head={<DeskHead id="wl-regime-h" title={t("wl.regime.title")} sub={t("wl.regime.sub", { bench: benchName })} />} infoLabel={t("wl.about")}
      info={<ul className="grid gap-1.5">{cells.map((c) => <li key={c.id}><span className="font-semibold text-ink">{c.label}:</span> {c.desc}</li>)}</ul>}>
      <dl className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-5">
        {cells.map((c, i) => (
          <div key={c.id} className={`tile min-w-0 px-3 py-2.5 ${i === cells.length - 1 && cells.length % 2 ? "col-span-2 md:col-span-1" : ""}`}>
            <dt className="micro truncate">{c.label}</dt>
            <dd className={`mt-1.5 truncate ${c.word ? "headline text-[24px] tracking-[0.04em]" : "font-num text-[20px] font-bold tracking-[-0.03em]"} ${c.tone}`}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
