import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate } from "../lib/format.js";
import { sureScore } from "../lib/ledger.js";
import { CallChip, Chip, ClockIcon, CountUp, CrossIcon, DataTable, Delta, InfoTip, Segmented } from "./ui.jsx";
import dict from "../text/plan.js";
import { strings } from "../lib/text.js";

/*
 * The brain's paper bets, the way a trading terminal shows an agent's book (Brain page and Brain's score page):
 *   BrainKpis   the numbers on top in big mono digits that count up: bets made, hits, misses, hit rate, open, days
 *               running, with a plain note when too few bets have closed to mean much.
 *   StepTrack   hits minus misses, adding up over time, as a step line ("paper · past calls").
 *   SureMeter   how sure the brain is about today's calls, out of 10, as a segmented meter.
 *   BetLedger   every paper bet in a dense table: who made it, the name, the call, how sure, the result.
 * The numbers come from lib/ledger.js (runs and their checked outcomes only). Texts: text/plan.js ("lg.*").
 */

/** "21 Oct". */
const dayMonth = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "").replace(/^\w+,\s/, "") : "–");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** "+1.4", "−2", "0.0": a sign only when the rounded number is not zero, a true minus. */
const signed = (v, d = 1) => {
  const r = Math.abs(v).toFixed(d);
  return `${Number(r) === 0 ? "" : v > 0 ? "+" : "−"}${r}`;
};
/** Fewer closed bets than this and the hit rate is mostly luck: the page says so. */
export const FEW_CLOSED = 20;

const STANCE_CALL = { bullish: "buy", neutral: "wait", bearish: "reject" };
const CALL_KEY = { buy: "vp.call.buy", wait: "vp.call.wait", reject: "vp.call.avoid" };
const CALL_BAR = { buy: "bg-up", wait: "bg-wait", reject: "bg-down" };
const LEVEL = { low: 1, medium: 2, high: 3 };

/** The brain's mark: a small round avatar with its initial, the "who" of every bet. */
export function BrainAvatar({ className = "" }) {
  const t = strings(dict);
  return (
    <span title={t("lg.brain")} className={`grid size-6 shrink-0 place-items-center rounded-full border border-ai/50 bg-ai/15 font-display text-[12px] leading-none font-extrabold text-ai ${className}`}>
      <span aria-hidden="true">{t("lg.brainInitial")}</span><span className="sr-only">{t("lg.brain")}</span>
    </span>
  );
}

/** Three ascending bars in the call's colour: low, medium, high. */
function SureBars({ level, call }) {
  const n = LEVEL[level] ?? 0;
  return (
    <span aria-hidden="true" className="flex items-end gap-[3px]">
      {[0, 1, 2].map((i) => <i key={i} className={`block w-[5px] rounded-[1.5px] ${i < n ? CALL_BAR[call] : "bg-line-3"}`} style={{ height: 6 + i * 4 }} />)}
    </span>
  );
}

/* ------------------------------------------------------------------ KPIs */

/** One number of the row: a mono label, the number counting up once in view, a short plain note. */
function Kpi({ label, value, decimals = 0, suffix = "", tone = "text-ink", note, noteTone = "text-ink-3" }) {
  return (
    <div className="min-w-0 bg-surface px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="micro truncate">{label}</p>
      <p className={`font-num mt-1.5 text-[26px] leading-none font-bold tracking-[-0.04em] sm:text-[36px] ${tone}`}>
        {isNum(value) ? <CountUp value={value} decimals={decimals} suffix={suffix} className="font-num" /> : "–"}
      </p>
      {note && <p className={`mt-1.5 text-[11.5px] leading-tight font-medium ${noteTone}`}>{note}</p>}
    </div>
  );
}

/** The row of numbers on top of the Brain pages. `s` is lib/ledger.js ledgerStats. `weekly` false: calls only. */
export function BrainKpis({ s, weekly = true, className = "" }) {
  const t = strings(dict);
  const rateNote = !s.closed ? t("lg.kpi.none") : s.closed < FEW_CLOSED ? t("lg.kpi.few", { count: s.closed }) : t("lg.kpi.many", { count: s.closed });
  return (
    <section aria-label={t("lg.kpi.label")} className={`panel overflow-hidden ${className}`}>
      <div className="grid grid-cols-3 gap-px bg-line lg:grid-cols-6">
        <Kpi label={t("lg.kpi.made")} value={s.made} note={weekly ? t("lg.kpi.madeSub", { calls: s.calls, weekly: s.weekly }) : t("lg.kpi.madeCalls")} />
        <Kpi label={t("lg.kpi.hits")} value={s.hits} tone="text-up" note={t("lg.kpi.hitsSub")} />
        <Kpi label={t("lg.kpi.misses")} value={s.misses} tone="text-down" note={s.flats ? t("lg.kpi.missesFlat", { n: s.flats }) : t("lg.kpi.missesSub")} />
        <Kpi label={t("lg.kpi.rate")} value={s.rate != null ? Math.round(s.rate) : null} suffix="%" tone="text-desk" note={rateNote} noteTone={s.closed < FEW_CLOSED ? "text-wait" : "text-ink-3"} />
        <Kpi label={t("lg.kpi.open")} value={s.open} tone="text-wait" note={s.nextCheck ? t("lg.kpi.openSub", { day: dayMonth(s.nextCheck) }) : t("lg.kpi.openNone")} />
        <Kpi label={t("lg.kpi.days")} value={s.days} note={s.first ? t("lg.kpi.daysSub", { day: dayMonth(s.first) }) : ""} />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- meter */

const SURE_TONE = { low: "neutral", mid: "wait", high: "brand" };

/** How sure the brain is about today's calls, out of 10: "HOW SURE 3.3/10 [segments] LOW". */
export function SureMeter({ convictions, className = "" }) {
  const t = strings(dict);
  const s = sureScore(convictions ?? []);
  if (!s) return null;
  const lit = Math.round(s.score);
  return (
    <div className={`tile flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${className}`}>
      <p className="flex items-baseline gap-2">
        <span className="micro text-ink-2">{t("lg.sure.title")}</span>
        <span className="font-num text-[20px] leading-none font-bold text-ink">{s.score.toFixed(1)}<span className="text-[12px] text-ink-3">{t("lg.sure.of")}</span></span>
      </p>
      <span role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={s.score} aria-label={t("lg.sure.title")} className="flex min-w-[96px] flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={`block h-2 flex-1 rounded-[2px] ${i < lit ? (s.level === "high" ? "bg-desk" : s.level === "mid" ? "bg-wait" : "bg-ink-2") : "bg-line-2"}`} />
        ))}
      </span>
      <span className="flex items-center">
        <Chip tone={SURE_TONE[s.level]}>{t(`lg.sure.${s.level}`)}</Chip>
        <InfoTip label={t("lg.sure.about")}>{t("lg.sure.info")}</InfoTip>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ step track */

/** The width of a box, kept current. */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const DAY = 864e5;
const ms = (iso) => Date.parse(`${iso}T00:00:00Z`);

/**
 * Hits minus misses over time, as a step line (lib/ledger.js stepTrack): up one step for each hit, down one for each
 * miss, on the day the bet was checked. A zero line, a dot on every checked day, the latest total at the end; hover or
 * tap a dot for that day.
 */
export function StepTrack({ points, height = 132 }) {
  const t = strings(dict);
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const g = useMemo(() => {
    if (!w || points.length < 2) return null;
    const L = 30, R = 44, T = 14, B = 22, H = height;
    const x0 = ms(points[0].date), x1 = Math.max(x0 + DAY, ms(points.at(-1).date));
    const vs = points.map((p) => p.v);
    const lo = Math.min(-1, ...vs), hi = Math.max(1, ...vs);
    const x = (iso) => L + ((ms(iso) - x0) / (x1 - x0)) * (w - L - R);
    const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
    let d = `M${x(points[0].date).toFixed(1)},${y(points[0].v).toFixed(1)}`;
    for (let i = 1; i < points.length; i++) d += `H${x(points[i].date).toFixed(1)}V${y(points[i].v).toFixed(1)}`;
    const area = `${d}V${y(0).toFixed(1)}H${x(points[0].date).toFixed(1)}Z`;
    const dots = points.map((p, i) => ({ ...p, i, cx: x(p.date), cy: y(p.v) })).filter((p) => p.hits || p.misses || p.flats);
    return { L, R, T, B, H, x, y, lo, hi, d, area, dots };
  }, [w, points, height]);
  const last = points.at(-1);
  const tone = !last || last.v === 0 ? "var(--ink-2)" : last.v > 0 ? "var(--up)" : "var(--down)";
  const closed = points.reduce((n, p) => n + p.hits + p.misses + p.flats, 0);
  const tip = hover != null ? g?.dots.find((p) => p.i === hover) : null;
  return (
    <div ref={ref} className="relative">
      {g ? (
        <svg width={w} height={g.H} viewBox={`0 0 ${w} ${g.H}`} role="img" className="block overflow-visible"
          aria-label={t("lg.track.aria", { v: signed(last.v, 0), n: closed })} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="steptrack-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--desk)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--desk)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[g.hi, 0, g.lo].map((v) => (
            <g key={v}>
              <line x1={g.L} x2={w - g.R} y1={g.y(v)} y2={g.y(v)} stroke={v === 0 ? "var(--line-3)" : "var(--line)"} strokeDasharray={v === 0 ? "3 4" : undefined} />
              <text x={g.L - 8} y={g.y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[10.5px]">{signed(v, 0)}</text>
            </g>
          ))}
          <path d={g.area} fill="url(#steptrack-fill)" />
          <path d={g.d} fill="none" stroke="var(--desk)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {g.dots.map((p) => (
            <g key={p.date}>
              <circle cx={p.cx} cy={p.cy} r={hover === p.i ? 6 : 4.5} fill={p.hits > p.misses ? "var(--up)" : p.misses > p.hits ? "var(--down)" : "var(--ink-3)"} stroke="var(--surface)" strokeWidth="2" />
              <circle cx={p.cx} cy={p.cy} r="16" fill="transparent" onPointerEnter={() => setHover(p.i)} onPointerDown={() => setHover(p.i)} />
            </g>
          ))}
          <circle cx={g.x(last.date)} cy={g.y(last.v)} r="3.5" fill="var(--desk)" />
          <text x={g.x(last.date) + 8} y={g.y(last.v) + 4} className="font-num text-[13px] font-bold" fill={tone}>{signed(last.v, 0)}</text>
          <text x={g.L} y={g.H - 4} className="fill-ink-3 font-mono text-[10.5px] uppercase">{dayMonth(points[0].date)}</text>
          <text x={w - g.R} y={g.H - 4} textAnchor="end" className="fill-ink-3 font-mono text-[10.5px] uppercase">{dayMonth(last.date)}</text>
        </svg>
      ) : <div style={{ height }} />}
      {tip && (
        <div role="status" className="pointer-events-none absolute z-20 min-w-[140px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-[10px] border border-line-2 bg-surface-2 px-3 py-2 text-[12px] shadow-xl"
          style={{ left: Math.min(Math.max(tip.cx, 74), w - 74), top: tip.cy }}>
          <p className="micro mb-1">{dayMonth(tip.date)}</p>
          <p className="font-num text-ink">{[tip.hits && t("lg.track.hits", { count: tip.hits }), tip.misses && t("lg.track.misses", { count: tip.misses }), tip.flats && t("lg.track.flats", { count: tip.flats })].filter(Boolean).join(" · ")}</p>
          <p className="font-num text-ink-2">{t("lg.track.total", { v: signed(tip.v, 0) })}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- sure chart */

/**
 * Does "very sure" mean anything? One bar per level of sureness: the hit rate of its checked calls, against a dashed
 * line at 50% (a coin). `levels` is lib/ledger.js sureLevels. Hover or focus a row for its count.
 */
export function SureChart({ levels }) {
  const t = strings(dict);
  return (
    <div className="grid gap-2.5">
      {levels.map((l) => {
        const has = isNum(l.rate);
        return (
          <div key={l.level} className="grid grid-cols-[64px_minmax(0,1fr)_68px] items-center gap-3" title={t("lg.cal.rowTitle", { count: l.n })}>
            <span className="flex items-center gap-1.5">
              <SureBars level={l.level} call="wait" />
              <span className="micro text-ink-2">{t(`vp.conv.${l.level}`)}</span>
            </span>
            <span className="relative h-6 overflow-hidden rounded-[6px] bg-surface-3">
              {has && <span className="absolute inset-y-0 start-0 rounded-[6px] bg-desk/80" style={{ width: `${Math.max(2, Math.min(100, l.rate))}%` }} />}
              <span aria-hidden="true" className="absolute inset-y-0 start-1/2 border-s border-dashed border-ink-3" />
            </span>
            <span className="text-end">
              <span className="font-num block text-[15px] leading-none font-bold text-ink">{has ? `${Math.round(l.rate)}%` : "–"}</span>
              <span className="font-num mt-0.5 block text-[10.5px] text-ink-3">{t("lg.cal.n", { count: l.n })}</span>
            </span>
          </div>
        );
      })}
      <p className="grid grid-cols-[64px_minmax(0,1fr)_68px] gap-3">
        <span />
        <span className="micro relative h-3"><span className="absolute start-1/2 -translate-x-1/2 whitespace-nowrap">{t("lg.cal.coin")}</span></span>
        <span />
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- ledger */

/** A bet's result as a chip: open (with the day it is checked), hit / won, miss / lost, flat. */
function ResultChip({ x }) {
  const t = strings(dict);
  const weekly = x.kind === "weekly";
  if (x.result === "hit") return <Chip check tone="up">{t(weekly ? "lg.r.won" : "lg.r.hit")}</Chip>;
  if (x.result === "miss") return <Chip tone="down" icon={<CrossIcon />}>{t(weekly ? "lg.r.lost" : "lg.r.miss")}</Chip>;
  if (x.result === "flat") return <Chip tone="neutral" icon="–">{t("lg.r.flat")}</Chip>;
  if (x.result === "void") return <Chip tone="ghost">{t("lg.r.void")}</Chip>;
  return (
    <Chip tone="ghost" icon={<ClockIcon />} title={x.check ? t("lg.checkOn", { day: dayMonth(x.check) }) : undefined}>
      {t("lg.r.open")}{!weekly && x.check && <span className="text-ink-3">{dayMonth(x.check)}</span>}
    </Chip>
  );
}

/**
 * Every paper bet in a dense, terminal-style table: who made it (the brain), the name, the day, the paper call, how sure,
 * the result and how far it beat or trailed the market. `kinds` "all" adds a switch between calls and weekly bets.
 * A row opens its stock (a weekly bet scrolls to the weekly bet's panel, when there is one).
 */
export function BetLedger({ items, go, switchable = true, detail = false, maxHeight = "max-h-[460px] md:max-h-[520px]", caption }) {
  const t = strings(dict);
  const [kind, setKind] = useState("all");
  const rows = kind === "all" ? items : items.filter((x) => x.kind === kind);
  const counts = { all: items.length, call: items.filter((x) => x.kind === "call").length, weekly: items.filter((x) => x.kind === "weekly").length };
  const cols = [
    { key: "bet", label: t("lg.col.bet"), sortable: true, firstDir: "asc", sortValue: (x) => x.ticker ?? "~", cell: (x) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <BrainAvatar />
        {x.kind === "call" ? (
          <span className="min-w-0">
            <span className="block font-num text-[13.5px] font-bold text-ink">{x.ticker}</span>
            <span className="block max-w-[96px] truncate text-[11px] leading-tight text-ink-3">{x.name}</span>
          </span>
        ) : (
          <span className="min-w-0">
            <span className="block font-display text-[14px] font-bold tracking-[0.06em] text-desk uppercase">{t("lg.weekly")}</span>
            <span className="block max-w-[110px] truncate font-num text-[10.5px] leading-tight text-ink-3">{t("lg.threeVs")}</span>
          </span>
        )}
      </span>
    ) },
    { key: "date", label: t("lg.col.day"), sortable: true, num: true, sortValue: (x) => x.date, className: "text-ink-2 uppercase", cell: (x) => dayMonth(x.date) },
    { key: "call", label: t("lg.col.call"), align: "start", cell: (x) => {
      if (x.kind === "weekly") return <span className="font-num text-[11.5px] whitespace-nowrap"><span className="text-up">{x.best.join(" ")}</span> <span className="text-ink-3">{t("lg.vs")}</span> <span className="text-down">{x.worst.join(" ")}</span></span>;
      const call = STANCE_CALL[x.stance] ?? "wait";
      return <CallChip call={call} label={t(CALL_KEY[call])} className="h-7 px-2 text-[12.5px]" />;
    } },
    { key: "sure", label: t("lg.col.sure"), align: "start", cell: (x) => (x.kind === "call"
      ? <span className="flex items-center gap-1.5"><SureBars level={x.conviction} call={STANCE_CALL[x.stance] ?? "wait"} /><span className="micro">{t.has(`vp.conv.${x.conviction}`) ? t(`vp.conv.${x.conviction}`) : x.conviction}</span></span>
      : <span className="text-ink-3">–</span>) },
    { key: "result", label: t("lg.col.result"), align: "start", sortable: true, sortValue: (x) => ({ hit: 0, miss: 1, flat: 2, open: 3, void: 4 })[x.result], firstDir: "asc", cell: (x) => <ResultChip x={x} /> },
    ...(detail ? [
      { key: "ret", label: t("lg.col.stock"), num: true, sortable: true, sortValue: (x) => x.ret, cell: (x) => <Delta value={x.ret} d={1} className="font-normal" /> },
      { key: "mkt", label: t("lg.col.market"), num: true, sortable: true, sortValue: (x) => x.mkt, cell: (x) => <Delta value={x.mkt} d={1} className="font-normal opacity-75" /> },
    ] : []),
    { key: "vs", label: t("lg.col.vs"), num: true, sortable: true, sortValue: (x) => (x.kind === "call" ? x.excess : x.spread), cell: (x) => (x.kind === "call"
      ? (isNum(x.excess) ? <Delta value={x.excess} d={1} /> : <span className="text-ink-3">–</span>)
      : (isNum(x.spread) ? <span className={x.spread > 0 ? "text-up" : x.spread < 0 ? "text-down" : "text-ink-2"}>{signed(x.spread)}<span className="ms-0.5 text-[10.5px] text-ink-3">{t("lg.pts")}</span></span> : <span className="text-ink-3">–</span>)) },
  ];
  const open = (x) => {
    if (x.kind === "call") go(`stock/${x.ticker}`);
    else document.getElementById("weekly-bet")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div>
      {switchable && counts.weekly > 0 && (
        <div className="mb-3">
          <Segmented label={t("lg.f.label")} value={kind} onChange={setKind}
            options={[{ value: "all", label: t("lg.f.all"), count: counts.all }, { value: "call", label: t("lg.f.calls"), count: counts.call }, { value: "weekly", label: t("lg.f.weekly"), count: counts.weekly }]} />
        </div>
      )}
      <DataTable columns={cols} rows={rows} rowKey={(x) => x.id} defaultSort={{ key: "date", dir: "desc" }} minWidth={detail ? 760 : 640}
        onRowClick={open} rowLabel={(x) => (x.kind === "call" ? x.ticker : t("lg.weekly"))} rowTone={(x) => (x.result === "hit" ? "up" : x.result === "miss" ? "down" : null)}
        scrollClassName={`${maxHeight} overflow-y-auto`} caption={caption ?? t("lg.title")} />
    </div>
  );
}
