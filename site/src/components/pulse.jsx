import { useMemo } from "react";
import { useCountUp, useInView } from "../lib/motion.js";
import { fmtPct, signTone } from "../lib/format.js";
import { marketDay, shortSector } from "../lib/marketday.js";
import { unusualToday } from "../lib/desk.js";
import { plainName } from "../lib/why.js";
import { DataTable, MiniBars, MiniSpark, Panel } from "./ui.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";

/*
 * The dense "terminal" pieces of the lists and of Home's Details view (the kit in ui.jsx stays the base):
 *   Count        a number that counts up once it scrolls into view (at once under reduced motion)
 *   DeskHead     a panel head in small mono capitals: "◆ TITLE · SUB" (pass it to Panel's `head`, with the Panel's id)
 *   KpiStrip     one panel of big numbers split by hairlines (two by two on a phone)
 *   HeatTile     one tile of a heat grid, coloured by a day's move; an optional corner mark for the Desk's call;
 *                `index` staggers its entrance (index.css, the lists block; off under reduced motion)
 *   BreadthBar   up / flat / down as one thin bar
 *   ValueChip    a percent already written as text ("+1.2%"), in its colour, boxed like the kit's Delta chip
 *   MarketPulse, MoversPanel, SectorHeat   the market's last close: index moves, breadth, biggest movers, industries
 * Percent changes only, never a price or raw volume. Words in text/home.js ("pulse.*").
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const TONE_TEXT = { accent: "text-up", down: "text-down", flat: "text-ink-2" };
export const toneText = (v, d = 1) => TONE_TEXT[signTone(v, d)] ?? "text-ink-2";
const pct = (v, d = 1) => (isNum(v) ? fmtPct(v, d) : "–");

/** A number that counts up from zero the first time it is seen. `format` writes it (percent, ratio, count). */
export function Count({ value, format = (v) => String(Math.round(v)), className = "" }) {
  const [ref, inView] = useInView({ threshold: 0.2, rootMargin: "0px" });
  const v = useCountUp(isNum(value) ? value : 0, inView, 1100);
  if (!isNum(value)) return <span className={className}>–</span>;
  return (
    <span ref={ref} className={`font-num ${className}`}>
      <span aria-hidden="true">{format(inView ? v : 0)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/** "◆ TITLE · SUB" in small mono capitals, the panel heads of a trading terminal. Give it the Panel's `${id}-h`. */
export function DeskHead({ id, title, sub, as: Tag = "h2" }) {
  return (
    <Tag id={id} tabIndex={-1} className="flex min-h-[22px] min-w-0 items-center gap-2 font-mono text-[11.5px] leading-tight font-semibold tracking-[0.12em] uppercase outline-none sm:tracking-[0.16em]">
      <span aria-hidden="true" className="text-[10px] text-desk">◆</span>
      <span className="shrink-0 text-ink">{title}</span>
      {sub && <><span aria-hidden="true" className="text-ink-3">·</span><span className="min-w-0 truncate text-desk">{sub}</span></>}
    </Tag>
  );
}

/**
 * One panel of big numbers split by hairlines: cells [{key, label, value (number), format, tone ("up" | "down" | "auto" |
 * null), sub, spark, bars, foot (a node at the bottom), onClick, ariaLabel}]. Two columns on a phone, one row from md.
 */
export function KpiStrip({ cells, label, className = "" }) {
  const n = cells.length;
  return (
    <section aria-label={label} className={`panel kpi-strip grid grid-cols-2 overflow-hidden md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))] ${className}`} style={{ "--n": n }}>
      {cells.map((c, i) => {
        const Tag = c.onClick ? "button" : "div";
        const tone = c.tone === "auto" ? toneText(c.value, c.d ?? 1) : c.tone === "up" ? "text-up" : c.tone === "down" ? "text-down" : "text-ink";
        return (
          <Tag key={c.key} type={c.onClick ? "button" : undefined} onClick={c.onClick} aria-label={c.ariaLabel} disabled={c.onClick ? c.disabled : undefined}
            className={`kpi-cell relative flex min-w-0 flex-col border-line px-3.5 py-3 text-start sm:px-4 sm:py-3.5 ${i % 2 === 0 ? "border-e" : ""} ${i < n - (n % 2 || 2) ? "border-b" : ""} md:border-b-0 ${i < n - 1 ? "md:border-e" : "md:border-e-0"} ${c.onClick ? "transition-colors hover:bg-surface-2 disabled:hover:bg-transparent" : ""}`}>
            <span className="micro truncate text-desk">{c.label}</span>
            <span className={`mt-2 block truncate font-num text-[24px] leading-none font-bold tracking-[-0.03em] sm:text-[30px] ${tone}`}>
              {c.node ?? <Count value={c.value} format={c.format} />}
            </span>
            {c.sub && <span className="mt-1.5 block truncate font-mono text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{c.sub}</span>}
            {(c.foot || c.spark?.length > 1 || c.bars?.length > 0) && (
              <span className="mt-auto block pt-2.5">
                {c.foot ?? (c.bars?.length ? <MiniBars values={c.bars} hi={c.barsHi ?? 0} h={24} /> : <MiniSpark values={c.spark} w={120} h={26} tone={c.sparkTone ?? "brand"} area fluid />)}
              </span>
            )}
          </Tag>
        );
      })}
    </section>
  );
}

/** Up / flat / down as one thin bar; decorative (the numbers sit beside it). */
export function BreadthBar({ up = 0, down = 0, total = 0, className = "" }) {
  const n = Math.max(total, up + down) || 1;
  const flat = Math.max(0, n - up - down);
  return (
    <span aria-hidden="true" className={`block ${className}`}>
      <span className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
        {up > 0 && <span className="h-full rounded-s-full bg-up shadow-[0_0_10px_var(--up-glow)]" style={{ width: `${(up / n) * 100}%` }} />}
        {flat > 0 && <span className="h-full bg-ink-3/40" style={{ width: `${(flat / n) * 100}%` }} />}
        {down > 0 && <span className="h-full rounded-e-full bg-down shadow-[0_0_10px_var(--down-glow)]" style={{ width: `${(down / n) * 100}%` }} />}
      </span>
    </span>
  );
}

const VALUE_TONE = { accent: "border-up/35 bg-up/10 text-up", down: "border-down/35 bg-down/10 text-down", flat: "border-line-2 bg-surface-3 text-ink-2" };

/** A percent already written as text, boxed in its colour (the kit's Delta chip look). */
export function ValueChip({ value, className = "" }) {
  if (!value?.text) return null;
  return <span className={`inline-flex items-center rounded-[6px] border px-1.5 py-[3px] font-num text-[11.5px] leading-none font-semibold whitespace-nowrap ${VALUE_TONE[value.tone] ?? VALUE_TONE.flat} ${className}`}>{value.text}</span>;
}

/** The background of a heat tile: stronger green or red the bigger the move (`scale` = a full-strength move, percent). */
export function heatStyle(move, scale = 3) {
  if (!isNum(move) || Math.abs(move) < 0.05) return { background: "var(--surface-2)" };
  const s = Math.min(1, Math.abs(move) / scale);
  const c = move > 0 ? "var(--up)" : "var(--down)";
  return {
    background: `color-mix(in srgb, ${c} ${Math.round(12 + s * 46)}%, var(--surface-2))`,
    borderColor: `color-mix(in srgb, ${c} ${Math.round(25 + s * 45)}%, transparent)`,
  };
}

const CALL_CORNER = { buy: "border-t-up", wait: "border-t-wait", reject: "border-t-down" };

/**
 * One tile of a heat grid: `title` (a ticker or an industry) top left, the move big in the middle, `sub` under it. `call`
 * (buy | wait | reject) adds a small coloured corner, its words in `callLabel` for screen readers and on hover.
 */
export function HeatTile({ title, move, sub, call, callLabel, onClick, label, scale = 3, index = 0, className = "" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-label={label} title={callLabel}
      className={`heat-tile relative flex h-full min-h-[78px] w-full min-w-0 flex-col overflow-hidden rounded-[8px] border border-line px-2.5 pt-2 pb-2 text-start transition-[transform,box-shadow] duration-200 ${onClick ? "hover:z-10 hover:-translate-y-px" : ""} ${className}`}
      style={{ ...heatStyle(move, scale), "--i": index }}>
      {call && CALL_CORNER[call] && <span aria-hidden="true" className={`absolute top-0 right-0 size-0 border-t-[13px] border-l-[13px] border-l-transparent ${CALL_CORNER[call]}`} />}
      <span className="truncate pe-3 font-num text-[11.5px] leading-tight font-bold tracking-[0.02em] text-ink">{title}</span>
      <span className="mt-auto block truncate font-num text-[17px] leading-none font-bold tracking-[-0.03em] text-ink sm:text-[19px]">{pct(move)}</span>
      {sub && <span className="mt-1 block truncate font-mono text-[10px] leading-tight tracking-[0.04em] text-ink-2">{sub}</span>}
      {callLabel && <span className="sr-only">{callLabel}</span>}
    </Tag>
  );
}

/* ------------------------------------------------------------- the market */

/** The cumulative path of day moves, indexed to 100: a tiny line for the S&P 500 (it publishes day moves only). */
const indexed = (moves) => moves.reduce((acc, m) => [...acc, acc.at(-1) * (1 + m / 100)], [100]);

/** Everything the market panels show, from the main list's published numbers. */
export function usePulse(data) {
  return useMemo(() => {
    const d = marketDay(data.market, data.watchlist, data.bench);
    if (!d) return null;
    const rows = Object.fromEntries((data.market?.symbols ?? []).map((r) => [r.symbol, r]));
    const spxRow = (data.market?.context?.instruments ?? []).find((i) => i.role === "spx") ?? null;
    const spxSpark = spxRow?.recent_days?.length ? indexed(spxRow.recent_days.map((x) => x.change_pct).filter(isNum)) : [];
    const benchSpark = (rows[data.bench?.symbol]?.spark ?? []).map((p) => p.v).filter(isNum).slice(-16);
    const members = (data.watchlist?.symbols ?? []).map((s) => s.symbol).filter((s) => rows[s]);
    const names = data.names ?? {};
    const movers = members.map((s) => {
      const r = rows[s];
      return {
        symbol: s, name: names[s] ?? s, day: isNum(r.change_1d_pct) ? r.change_1d_pct : null, d20: isNum(r.ret_20d_pct) ? r.ret_20d_pct : null,
        spark: (r.spark ?? []).map((p) => p.v).filter(isNum), unusual: Boolean(unusualToday(r)),
      };
    }).filter((r) => r.day != null);
    return { d, spxSpark, benchSpark, movers, benchName: plainName(data.bench?.label ?? data.bench?.symbol ?? "") };
  }, [data]);
}

/** The index moves and the list's breadth, in one strip. */
export function MarketPulse({ p, id }) {
  const t = strings(dict);
  if (!p) return null;
  const { d } = p;
  const spx = d.spx;
  const fmt = (v) => fmtPct(v, 2);
  const cells = [
    { key: "spx", label: spx?.name ?? "S&P 500", value: spx?.pct ?? null, format: fmt, tone: "auto", d: 2, spark: p.spxSpark,
      sub: spx?.pct == null ? t("pulse.later") : spx.fromHigh == null ? t("pulse.spxSub") : spx.fromHigh > -0.05 ? t("pulse.atHigh") : t("pulse.fromHigh", { pct: `${Math.abs(spx.fromHigh).toFixed(1)}%` }) },
    { key: "bench", label: p.benchName || d.bench?.symbol, value: d.bench?.pct ?? null, format: fmt, tone: "auto", d: 2, spark: p.benchSpark, sub: t("pulse.benchSub") },
    { key: "breadth", label: t("pulse.breadth"), node: d.counted ? <><span className="text-up"><Count value={d.rose} /></span><span className="text-ink-3">/</span><span className="text-down"><Count value={d.fell} /></span></> : "–",
      sub: d.flat ? t("pulse.breadthSubFlat", { up: d.rose, down: d.fell, flat: d.flat }) : t("pulse.breadthSub", { up: d.rose, down: d.fell }),
      foot: <BreadthBar up={d.rose} down={d.fell} total={d.counted} /> },
    { key: "above", label: t("pulse.above"), value: d.breadth, format: (v) => `${Math.round(v)}%`, sub: t("pulse.aboveSub"),
      foot: d.breadth == null ? null : <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-line-2"><span className="block h-full rounded-full bg-desk shadow-[0_0_10px_var(--desk-glow)]" style={{ width: `${Math.min(100, d.breadth)}%` }} /></span> },
  ];
  return <div id={id} className="scroll-mt-28"><KpiStrip cells={cells} label={t("pulse.kpi")} /></div>;
}

/** The biggest risers and fallers of the last close, in a sortable table. */
export function MoversPanel({ p, go, id = "movers", top = 4, className = "" }) {
  const t = strings(dict);
  const rows = useMemo(() => {
    if (!p) return [];
    const by = [...p.movers].sort((a, b) => b.day - a.day);
    const ups = by.filter((r) => r.day > 0).slice(0, top);
    const downs = by.filter((r) => r.day < 0).slice(-top);
    return [...ups, ...downs];
  }, [p, top]);
  if (!p) return null;
  const cols = [
    { key: "symbol", label: t("pulse.col.name"), sortable: true, firstDir: "asc", cell: (r) => (
      <span className="flex min-w-0 items-center gap-2">
        {r.unusual && <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-desk font-num text-[10px] font-bold text-bg" title={t("pulse.unusual")} aria-label={t("pulse.unusual")}>!</span>}
        <span className="min-w-0">
          <span className="block font-num text-[13.5px] font-bold text-ink">{r.symbol}</span>
          <span className="block max-w-[120px] truncate text-[11px] leading-tight text-ink-3">{r.name}</span>
        </span>
      </span>
    ) },
    { key: "spark", label: t("pulse.col.spark"), cell: (r) => <MiniSpark values={r.spark} w={64} h={22} /> },
    { key: "day", label: t("pulse.col.day"), sortable: true, num: true, className: (r) => `font-semibold ${toneText(r.day)}`, cell: (r) => pct(r.day) },
    { key: "d20", label: t("pulse.col.d20"), sortable: true, num: true, className: (r) => toneText(r.d20), cell: (r) => pct(r.d20) },
  ];
  return (
    <Panel id={id} className={`scroll-mt-28 overflow-hidden ${className}`} head={<DeskHead id={`${id}-h`} title={t("pulse.movers")} sub={t("pulse.moversSub")} />}
      info={t("pulse.moversInfo")} infoLabel={t("pulse.movers")} flush bodyClassName="px-4 sm:px-5">
      {rows.length ? (
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.symbol} defaultSort={{ key: "day", dir: "desc" }} minWidth={340}
          onRowClick={(r) => go(`stock/${r.symbol}`)} rowLabel={(r) => r.symbol} rowTone={(r) => (r.unusual ? "brand" : null)} caption={t("pulse.movers")} className="scan-table" />
      ) : <p className="py-5 text-[13.5px] text-ink-3">{t("pulse.none")}</p>}
    </Panel>
  );
}

/** Each industry's average day move as a coloured tile. */
export function SectorHeat({ p, id = "sectors", className = "" }) {
  const t = strings(dict);
  if (!p || !p.d.sectors.length) return null;
  return (
    <Panel id={id} className={`scroll-mt-28 ${className}`} head={<DeskHead id={`${id}-h`} title={t("pulse.sectors")} sub={t("pulse.sectorsSub")} />}
      info={t("pulse.sectorsInfo")} infoLabel={t("pulse.sectors")}>
      <ul className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3">
        {p.d.sectors.map((x, i) => (
          <li key={x.sector} className="min-w-0">
            <HeatTile title={shortSector(x.sector)} move={x.avg} sub={t("pulse.sectorN", { count: x.n })} scale={2.5} index={i} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
