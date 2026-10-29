import { useEffect, useId, useMemo, useRef, useState } from "react";
import { monthTicks, niceTicks, scaleLinear, tickLabel } from "../lib/candles.js";
import { assignSlots, boardData, DEFAULT_RANGE, extent, nearestIndex, pickHighlights, RANGE_KEYS, RANGES, smoothPath, toggleLit } from "../lib/bigboard.js";
import { fmtDate, fmtPct } from "../lib/format.js";
import { useWidth } from "./replay.jsx";
import { Count, toneText } from "./pulse.jsx";
import dict from "../text/stock.js";
import { strings } from "../lib/text.js";

/*
 * "The big board": the Stocks page's default view. One big chart of every name on the list, each line its percent
 * change since the first day of the chosen range (1M, 3M, 6M, 1Y), the benchmark dashed. A few lines are lit in fixed
 * colours (--race-1 … --race-8 in index.css, checked for colour-blind separation in both themes); the rest are thin grey.
 * Hover or drag shows every lit line's value on that day; tap a name (or a line) to light it up or dim it. Daily closes
 * only, never prices. Lines draw in from left to right when they appear (off under reduced motion). Words: "wl.bb.*".
 */

const SLOTS = 8;
const MAX_LIT = 8;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const pct = (v, d = 1) => (isNum(v) ? fmtPct(v, d) : "–");
const colorOf = (k) => `var(--race-${(k % SLOTS) + 1})`;
/** "27 Oct": a day without its weekday or year. */
const dayMonth = (iso) => fmtDate(iso).replace(/\s\d{4}$/, "").replace(/^\w+,\s/, "");

/**
 * rows: [{symbol, name, series}] (the names shown, after the page's filters); bench: {symbol, name, series} or null.
 * `closeDate` is the last close in the data.
 */
export function BigBoard({ rows, bench, benchName, closeDate }) {
  const t = strings(dict);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const input = useMemo(() => [...rows, ...(bench?.series ? [{ ...bench, bench: true }] : [])], [rows, bench]);
  const board = useMemo(() => boardData(input, RANGES[range]), [input, range]);
  const rowsKey = rows.map((r) => r.symbol).join(",");
  const boardKey = `${range}|${rowsKey}`;
  const defaults = useMemo(() => pickHighlights(board?.lines ?? []), [board]);
  // The reader's own choice of lit lines holds until the range or the list changes; then the defaults come back.
  const [picked, setPicked] = useState(null);
  const lit = picked?.key === boardKey ? picked.list : defaults;
  const prevSlots = useRef({});
  const slots = useMemo(() => assignSlots(prevSlots.current, lit, SLOTS), [lit]);
  useEffect(() => { prevSlots.current = slots; }, [slots]);
  const toggle = (symbol) => setPicked({ key: boardKey, list: toggleLit(lit, symbol, MAX_LIT) });

  const lines = board?.lines ?? [];
  const names = lines.filter((l) => !l.bench);
  const best = names.length ? names.reduce((a, b) => (b.last > a.last ? b : a)) : null;
  const worst = names.length ? names.reduce((a, b) => (b.last < a.last ? b : a)) : null;
  const benchLine = lines.find((l) => l.bench) ?? null;

  return (
    <div className="mt-2">
      <div className="grid gap-4 lg:flex lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <h3 className="headline text-[clamp(34px,9vw,52px)] leading-[0.9]">{t("wl.bb.title1")} <span className="text-desk hero-glow">{t("wl.bb.title2")}</span></h3>
          <p className="mt-2 font-mono text-[11.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{t("wl.bb.sub", { range: t(`wl.bb.range.${range}`) })}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[520px]">
          <Kpi key={`b${boardKey}`} label={t("wl.bb.best")} line={best} tone="text-up" />
          <Kpi key={`w${boardKey}`} label={t("wl.bb.worst")} line={worst} tone="text-down" />
          <Kpi key={`i${boardKey}`} label={benchName || t("wl.bench")} line={benchLine} tone={benchLine ? toneText(benchLine.last) : "text-ink"} />
        </dl>
      </div>

      <div className="mt-4">
        <div role="group" aria-label={t("wl.bb.ranges")} className="inline-flex rounded-[9px] border border-line-2 bg-surface-2 p-0.5">
          {RANGE_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}
              className={`relative min-h-[40px] min-w-[48px] rounded-[7px] px-3 font-num text-[12px] font-bold tracking-[0.06em] transition-colors ${range === k ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]" : "text-ink-3 hover:text-ink"}`}>
              {k}
              {range === k && <span aria-hidden="true" className="absolute inset-x-3 bottom-1 h-px bg-desk shadow-[0_0_8px_var(--desk)]" />}
            </button>
          ))}
        </div>
      </div>

      {board && board.dates.length > 1 ? (
        <>
          <Chart board={board} lit={lit} slots={slots} toggle={toggle} drawKey={boardKey} best={best} worst={worst} closeDate={closeDate} />
          <Legend lines={lines} lit={lit} slots={slots} toggle={toggle} benchName={benchName} />
        </>
      ) : (
        <p className="tile mt-3 grid h-[300px] place-items-center px-4 text-center text-[14px] text-ink-3 md:h-[440px]">{t("wl.bb.none")}</p>
      )}
    </div>
  );
}

/** One headline number: the line's change over the range, counting up when first seen; its ticker underneath. */
function Kpi({ label, line, tone }) {
  return (
    <div className="tile min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
      <dt className="micro truncate text-desk">{label}</dt>
      <dd className={`mt-1.5 truncate font-num text-[20px] leading-none font-bold tracking-[-0.03em] sm:text-[28px] ${tone}`}>
        {line ? <Count value={line.last} format={(v) => fmtPct(v, 1)} /> : "–"}
      </dd>
      <dd className="mt-1.5 truncate font-mono text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{line ? line.symbol : "–"}</dd>
    </div>
  );
}

/** The chart itself: grid, baseline, grey lines, the dashed benchmark, the lit lines, and the crosshair. */
function Chart({ board, lit, slots, toggle, drawKey, best, worst, closeDate }) {
  const t = strings(dict);
  const uid = useId().replace(/\W/g, "");
  const wrap = useRef(null);
  const W = Math.max(300, useWidth(wrap, 340));
  const narrow = W < 640;
  const H = narrow ? 300 : 440;
  const L = 6, R = narrow ? 44 : 54, T = 16, B = 26;
  const PH = H - T - B;
  const x1 = W - R;
  const n = board.dates.length;
  const [hover, setHover] = useState(null);

  const geo = useMemo(() => {
    let [lo, hi] = extent(board.lines);
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    const y = scaleLinear(lo, hi, T + PH, T);
    const x = (i) => L + (i / Math.max(1, n - 1)) * (x1 - L);
    const path = (vals) => smoothPath(vals.map((v, i) => (isNum(v) ? [x(i), y(v)] : null)));
    const { step, ticks } = niceTicks(lo, hi, narrow ? 4 : 6);
    const xs = n <= 30
      ? board.dates.map((d, i) => ({ i, x: x(i), label: dayMonth(d) })).filter((m, i, all) => i % Math.ceil(n / (narrow ? 4 : 7)) === 0 && m.x < x1 - 20)
      : monthTicks(board.dates, x, narrow ? 44 : 60);
    return { x, y, path, step, ticks, xs };
  }, [board, n, x1, PH, narrow]);

  const litSet = new Set(lit);
  const litLines = board.lines.filter((l) => litSet.has(l.symbol) && !l.bench);
  const benchLine = board.lines.find((l) => l.bench);
  const top = litLines.length ? litLines.reduce((a, b) => (b.last > a.last ? b : a)) : null;

  // The grey lines never change while the reader points: build them once per size and range.
  const grey = useMemo(() => board.lines.filter((l) => !l.bench && !litSet.has(l.symbol)).map((l) => ({ symbol: l.symbol, d: geo.path(l.values) })),
    [board, geo, lit]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointAt = (clientX) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setHover(nearestIndex(clientX - r.left, L, x1, n));
  };
  const onKey = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => Math.max(0, Math.min(n - 1, (h ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "Escape") setHover(null);
  };

  const i = hover;
  const readout = i == null ? [] : [...litLines, ...(benchLine ? [benchLine] : [])]
    .map((l) => ({ l, v: l.values[i] })).filter((r) => isNum(r.v)).sort((a, b) => b.v - a.v);

  return (
    <div className="relative mt-3">
      <div ref={wrap} tabIndex={0} role="group" onKeyDown={onKey}
        aria-label={t("wl.bb.aria", { count: board.lines.length, from: fmtDate(board.dates[0]), to: fmtDate(board.dates.at(-1)), best: best ? `${best.symbol} ${pct(best.last)}` : "–", worst: worst ? `${worst.symbol} ${pct(worst.last)}` : "–" })}
        className="bb-chart relative rounded-tile outline-none select-none focus-visible:ring-2 focus-visible:ring-desk"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => pointAt(e.clientX)} onPointerMove={(e) => pointAt(e.clientX)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)} onPointerCancel={() => setHover(null)} onBlur={() => setHover(null)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={top ? colorOf(slots[top.symbol] ?? 0) : "var(--desk)"} stopOpacity="0.26" />
              <stop offset="0.92" stopColor={top ? colorOf(slots[top.symbol] ?? 0) : "var(--desk)"} stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${uid}-reveal`}><rect className="bb-reveal" x="0" y="0" width={W} height={H} /></clipPath>
          </defs>

          {geo.ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={x1} y1={Math.round(geo.y(v)) + 0.5} y2={Math.round(geo.y(v)) + 0.5}
                stroke={v === 0 ? "var(--line-3)" : "var(--line)"} strokeWidth={v === 0 ? 1.25 : 1} strokeDasharray={v === 0 ? undefined : "2 4"} />
              <text x={x1 + 8} y={geo.y(v) + 3.5} className={`font-mono text-[10.5px] ${v === 0 ? "fill-ink-2" : "fill-ink-3"}`}>{tickLabel(v, geo.step)}</text>
            </g>
          ))}
          {geo.xs.map((m) => <text key={m.i} x={m.x} y={H - 7} textAnchor="middle" className="fill-ink-3 font-mono text-[10.5px] uppercase">{m.label}</text>)}

          <g key={drawKey}>
            {top && (
              <path className="bb-fade" fill={`url(#${uid}-fill)`}
                d={`${geo.path(top.values)}L${geo.x(n - 1)},${T + PH}L${geo.x(top.values.findIndex(isNum))},${T + PH}Z`} />
            )}
            <g clipPath={`url(#${uid}-reveal)`} fill="none" strokeLinejoin="round" strokeLinecap="round">
              {grey.map((g) => <path key={g.symbol} d={g.d} stroke="var(--ink-3)" strokeOpacity="0.32" strokeWidth="1.2" />)}
              {benchLine && <path d={geo.path(benchLine.values)} stroke="var(--ink)" strokeOpacity="0.8" strokeWidth="1.75" strokeDasharray="5 4" />}
            </g>
            <g fill="none" strokeLinejoin="round" strokeLinecap="round">
              {litLines.map((l) => {
                const c = colorOf(slots[l.symbol] ?? 0);
                const d = geo.path(l.values);
                return (
                  <g key={l.symbol} style={{ "--k": slots[l.symbol] ?? 0 }}>
                    <path className="bb-draw bb-glow" d={d} pathLength="1" stroke={c} strokeOpacity="0.16" strokeWidth="7" />
                    <path className="bb-draw" d={d} pathLength="1" stroke={c} strokeWidth="2.25" />
                  </g>
                );
              })}
            </g>
            {litLines.map((l) => {
              const k = l.values.length - 1 - [...l.values].reverse().findIndex(isNum);
              return <circle key={l.symbol} className="bb-fade" cx={geo.x(k)} cy={geo.y(l.values[k])} r="3.5" fill={colorOf(slots[l.symbol] ?? 0)} stroke="var(--surface)" strokeWidth="2" />;
            })}
          </g>

          {/* tap targets: a wide invisible stroke on every name's line */}
          <g fill="none" stroke="transparent" strokeWidth="14" style={{ pointerEvents: "stroke" }}>
            {board.lines.filter((l) => !l.bench).map((l) => (
              <path key={l.symbol} d={litSet.has(l.symbol) ? geo.path(l.values) : grey.find((g) => g.symbol === l.symbol)?.d} className="cursor-pointer"
                onClick={() => toggle(l.symbol)} />
            ))}
          </g>

          {i != null && (
            <g pointerEvents="none">
              <line x1={geo.x(i)} x2={geo.x(i)} y1={T - 6} y2={T + PH} stroke="var(--ink-2)" strokeOpacity="0.55" strokeDasharray="3 3" />
              {readout.map(({ l, v }) => (
                <circle key={l.symbol} cx={geo.x(i)} cy={geo.y(v)} r={l.bench ? 3.5 : 4.5} fill={l.bench ? "var(--ink)" : colorOf(slots[l.symbol] ?? 0)} stroke="var(--surface)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {closeDate && (
          <p className="pointer-events-none absolute top-0 left-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-3" />{t("wl.bb.close", { date: dayMonth(closeDate) })}
          </p>
        )}
        {i != null && <Tip date={board.dates[i]} rows={readout} slots={slots} narrow={narrow} x={geo.x(i)} W={W} />}
      </div>
      <p className="mt-1.5 font-mono text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">{t(narrow ? "wl.bb.hintTouch" : "wl.bb.hint")}</p>
    </div>
  );
}

/** The crosshair's card: the day, then each lit line and the benchmark by value. Pinned to the top on a phone. */
function Tip({ date, rows, slots, narrow, x, W }) {
  const flip = x > W * 0.58;
  const style = narrow ? undefined : flip ? { right: W - x + 14 } : { left: x + 14 };
  return (
    <div role="status" className={`bb-tip pointer-events-none absolute z-10 rounded-tile border border-line-2 bg-surface/95 p-2.5 shadow-2xl backdrop-blur-md ${narrow ? "inset-x-1 top-0" : "top-3 w-[210px]"}`} style={style}>
      <p className="font-num text-[11.5px] font-bold tracking-[0.04em] text-ink uppercase">{fmtDate(date)}</p>
      <ul className={`mt-1.5 grid gap-x-4 gap-y-1 ${narrow ? "grid-cols-2" : ""}`}>
        {rows.map(({ l, v }) => (
          <li key={l.symbol} className="flex min-w-0 items-center gap-2 text-[12px]">
            <svg width="14" height="6" aria-hidden="true" className="shrink-0">
              <line x1="1" x2="13" y1="3" y2="3" stroke={l.bench ? "var(--ink)" : colorOf(slots[l.symbol] ?? 0)} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={l.bench ? "3 2.5" : undefined} />
            </svg>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold tracking-[0.04em] text-ink-2 uppercase">{l.symbol}</span>
            <span className="shrink-0 font-num font-bold text-ink">{pct(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every line as a chip (colour, ticker, change): tap to light it up or dim it. The benchmark comes first and stays. */
function Legend({ lines, lit, slots, toggle, benchName }) {
  const t = strings(dict);
  const litSet = new Set(lit);
  const bench = lines.find((l) => l.bench);
  const rest = lines.filter((l) => !l.bench).sort((a, b) => Number(litSet.has(b.symbol)) - Number(litSet.has(a.symbol)) || b.last - a.last);
  return (
    <div className="mt-1">
      <ul className="no-scrollbar rail-fade -mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]">
        {bench && (
          <li className="shrink-0">
            <span className="inline-flex min-h-[44px] items-center">
              <span className="chip border-line-2 bg-surface-2 text-ink-2">
                <svg width="14" height="6" aria-hidden="true"><line x1="1" x2="13" y1="3" y2="3" stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 2.5" /></svg>
                <span className="text-ink">{benchName || bench.symbol}</span>
                <span className="font-num tracking-normal text-ink">{pct(bench.last)}</span>
              </span>
            </span>
          </li>
        )}
        {rest.map((l) => {
          const on = litSet.has(l.symbol);
          const c = on ? colorOf(slots[l.symbol] ?? 0) : null;
          return (
            <li key={l.symbol} className="shrink-0">
              <button type="button" aria-pressed={on} onClick={() => toggle(l.symbol)} className="group inline-flex min-h-[44px] items-center">
                <span className={`chip transition-colors ${on ? "bg-surface-3 text-ink" : "border-line-2 bg-surface-2 text-ink-3 group-hover:border-line-3 group-hover:text-ink"}`}
                  style={on ? { borderColor: `color-mix(in srgb, ${c} 65%, transparent)` } : undefined}>
                  <span aria-hidden="true" className="size-2 rounded-full" style={on ? { background: c, boxShadow: `0 0 8px ${c}` } : { border: "1.5px solid var(--ink-3)" }} />
                  {l.symbol}
                  <span className={`font-num tracking-normal ${on ? "text-ink" : ""}`}>{pct(l.last)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
