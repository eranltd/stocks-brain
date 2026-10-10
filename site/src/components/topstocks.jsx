import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCandles } from "../lib/data.js";
import { useReducedMotion } from "../lib/motion.js";
import { dotIndex, miniGeometry, miniSummary, miniWindow, nearCards, snapStops, stepStop } from "../lib/carousel.js";
import { ArrowRight, Chevron } from "./ui.jsx";

/*
 * "Top stocks": the simple home's first thing, a carousel of big calm cards, one per name, each with a small candle
 * chart of the last month. Made for a reader who has never opened the Candles switch on a Stock page: the next card
 * peeks in so it plainly scrolls, dots show where you are, and a one-line hint says to swipe (until the first swipe).
 * The chart draws no numbers at all; the full chart, with its scale and hover, is one tap away ("See the candles").
 */

const HINT_KEY = "sb:top-swiped";
function readSwiped() {
  try { return window.localStorage.getItem(HINT_KEY) === "1"; } catch { return false; }
}
function saveSwiped() {
  try { window.localStorage.setItem(HINT_KEY, "1"); } catch { /* storage unavailable: the hint just stays */ }
}

const CHIP = {
  accent: "border-accent/45 bg-accent/12 text-accent",
  down: "border-down/45 bg-down/12 text-down",
  flat: "border-line-2 bg-surface-2 text-ink",
};
const CHIP_MARK = { accent: "▲", down: "▼", flat: "◆" };
const CHART_H = 150;
const GAP = 16;
// After a failed chart fetch, wait this long before trying that name again (and only when the reader scrolls near it).
const RETRY_MS = 20000;

/** The carousel. `items` from topStocks() (lib/carousel.js); `openTo(route)` opens a page and its section. */
export function TopStocks({ items, manifest, openTo, seeCandles }) {
  const reduced = useReducedMotion();
  const rail = useRef(null);
  const [geo, setGeo] = useState({ step: 0, stops: [0], left: 0, width: 0 });
  const [swiped, setSwiped] = useState(readSwiped);
  const [charts, setCharts] = useState({}); // ticker -> {state: "loading" | "ok" | "missing" | "error", win}
  const asked = useRef(new Set());
  const failedAt = useRef({}); // ticker -> time of the last failed fetch
  const raf = useRef(0);
  const count = items.length;

  const load = useCallback((from, to) => {
    for (let i = from; i <= to; i++) {
      const it = items[i];
      if (!it || asked.current.has(it.ticker)) continue;
      if (Date.now() - (failedAt.current[it.ticker] ?? -Infinity) < RETRY_MS) continue;
      asked.current.add(it.ticker);
      if (!it.hasChart) { setCharts((m) => ({ ...m, [it.ticker]: { state: "missing" } })); continue; }
      setCharts((m) => ({ ...m, [it.ticker]: { state: "loading" } }));
      loadCandles(manifest, it.ticker)
        .then((doc) => {
          const win = miniWindow(doc);
          setCharts((m) => ({ ...m, [it.ticker]: win ? { state: "ok", win } : { state: "missing" } }));
        })
        .catch(() => {
          asked.current.delete(it.ticker); // a later scroll past it tries again, not before RETRY_MS
          failedAt.current[it.ticker] = Date.now();
          setCharts((m) => ({ ...m, [it.ticker]: { state: "error" } }));
        });
    }
  }, [items, manifest]);

  // The first two at once; the rest as they come near.
  useEffect(() => { load(0, 1); }, [load]);

  const measure = useCallback(() => {
    const el = rail.current;
    const first = el?.firstElementChild;
    if (!el || !first) return;
    const step = first.getBoundingClientRect().width + GAP;
    const max = el.scrollWidth - el.clientWidth;
    const stops = snapStops(count, step, max), width = el.clientWidth;
    // Only a real change of size: a card growing or shrinking in height (a chart that loads or fails) must not count,
    // or every failed fetch would re-measure, retry and fail again.
    setGeo((g) => (g.step === step && g.width === width && g.stops.join() === stops.join() ? g : { step, stops, left: el.scrollLeft, width }));
  }, [count]);

  useEffect(() => {
    measure();
    const el = rail.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!geo.step || !geo.width) return;
    const [a, b] = nearCards(geo.left, geo.width, geo.step, count);
    load(a, b);
  }, [geo, count, load]);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = rail.current;
      if (!el) return;
      setGeo((g) => ({ ...g, left: el.scrollLeft }));
      if (!swiped && el.scrollLeft > 24) { setSwiped(true); saveSwiped(); }
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const goTo = (x) => rail.current?.scrollTo({ left: x, behavior: reduced ? "auto" : "smooth" });
  const step = (dir) => goTo(stepStop(geo.stops, geo.left, dir));
  const onKey = (e) => {
    if (e.target !== e.currentTarget) return; // keys inside a card's buttons stay theirs
    const to = { ArrowRight: () => step(1), ArrowLeft: () => step(-1), Home: () => goTo(0), End: () => goTo(geo.stops.at(-1)) }[e.key];
    if (to) { e.preventDefault(); to(); }
  };

  const active = dotIndex(geo.left, geo.stops);
  const atStart = active === 0, atEnd = active === geo.stops.length - 1;
  const cardAt = (stop) => Math.min(count - 1, geo.step ? Math.round(stop / geo.step) : 0);
  if (!count) return null;

  return (
    <section aria-labelledby="top-stocks-title" className="mx-auto w-full max-w-[1040px] px-4 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="top-stocks-title" className="text-[clamp(24px,6.4vw,30px)] leading-tight font-semibold tracking-[-0.02em] text-ink">Top stocks</h2>
        <p className={`flex items-center gap-2 text-[16px] text-ink-2 transition-opacity duration-500 ${swiped ? "invisible opacity-0" : ""}`} aria-hidden={swiped}>
          <span>Swipe<span className="hidden md:inline"> or use the arrows</span> to see more</span>
          <ArrowRight className="size-4 shrink-0 text-ink" />
        </p>
      </div>

      <div
        ref={rail}
        onScroll={onScroll}
        onKeyDown={onKey}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Top stocks. Use the left and right arrow keys to move between companies."
        className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-1"
      >
        {items.map((it, i) => (
          <StockCard key={it.ticker} it={it} i={i} n={count} chart={charts[it.ticker]} openTo={openTo} seeCandles={seeCandles} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <RoundButton label="Previous company" dir="left" onClick={() => step(-1)} disabled={atStart} />
        {geo.stops.length > 1 && (
          <div className="flex flex-wrap items-center justify-center" role="group" aria-label="Choose a company">
            {geo.stops.map((s, k) => (
              <button key={k} type="button" onClick={() => goTo(s)} aria-label={`Show ${items[cardAt(s)]?.name ?? "company"}`} aria-current={k === active ? "true" : undefined}
                className="grid size-11 place-items-center rounded-full">
                <span className={`block h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${k === active ? "w-7 bg-ink" : "w-2.5 bg-ink-3/70"}`} />
              </button>
            ))}
          </div>
        )}
        <RoundButton label="Next company" dir="right" onClick={() => step(1)} disabled={atEnd} />
      </div>
    </section>
  );
}

function RoundButton({ label, dir, onClick, disabled }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
      className="hidden size-12 shrink-0 place-items-center rounded-full border border-line-2 bg-surface text-ink transition hover:border-ink-3 disabled:opacity-30 md:grid">
      <Chevron dir={dir} />
    </button>
  );
}

function StockCard({ it, i, n, chart, openTo, seeCandles }) {
  const canCandles = it.hasChart && it.chip;
  return (
    <article role="group" aria-roledescription="slide" aria-label={`${it.name}, ${i + 1} of ${n}`}
      className="card top-card flex shrink-0 snap-start flex-col p-6 sm:p-7">
      <h3 className="line-clamp-2 text-[clamp(24px,6.6vw,28px)] leading-tight font-semibold tracking-[-0.02em] text-ink">{it.name}</h3>
      <p className="mt-1 text-[14.5px] text-ink-2"><span className="font-mono text-ink-3">{it.ticker}</span> · {it.tag}</p>
      {it.chip && (
        <p className={`mt-4 inline-flex items-center gap-2 self-start rounded-full border px-4 py-1.5 text-[19px] font-semibold tracking-[-0.01em] ${CHIP[it.chip.tone]}`}>
          <span aria-hidden="true" className="text-[13px]">{CHIP_MARK[it.chip.tone]}</span>{it.chip.word}
        </p>
      )}
      <div className="mt-5"><MiniCandles name={it.name} ticker={it.ticker} chart={chart} /></div>
      <p className="mt-4 text-[17px] leading-relaxed text-ink">{it.plain ?? "Its short summary appears with the next company update."}</p>
      <div className="mt-auto pt-5">
        <button type="button" onClick={() => openTo(it.to)} className="btn btn-primary min-h-[56px] w-full justify-center py-3 text-[18px]">
          See more <ArrowRight />
        </button>
        {canCandles && (
          <button type="button" onClick={() => seeCandles(it.candlesTo)} className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-[15.5px] text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">
            See the candles
          </button>
        )}
      </div>
    </article>
  );
}

/** The width of a box, kept current. */
function useBoxWidth() {
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

const UP = "var(--accent)", DOWN = "var(--down)", AVG = "var(--ai)";

/**
 * The mini chart: about a month of daily candles (up hollow, down filled, as on the full chart), the twenty-day
 * average and a dot on the newest close. No axes, no gridlines, no numbers. (No shaded band on the newest candle:
 * at the chart's right edge it read as a scrollbar.)
 */
function MiniCandles({ name, ticker, chart }) {
  const [ref, w] = useBoxWidth();
  const win = chart?.state === "ok" ? chart.win : null;
  const g = useMemo(() => (win && w ? miniGeometry(win, w, CHART_H) : null), [win, w]);
  const clip = `mini-${ticker.replace(/\W/g, "_")}`;
  let body;
  if (!chart || chart.state === "loading" || (win && !g)) {
    body = (
      <div className="relative h-full overflow-hidden rounded-2xl bg-surface-2" role="img" aria-label={`${name}: the chart is loading.`}>
        <div className="absolute inset-x-6 bottom-8 top-8 flex items-end gap-[6%] opacity-60 motion-safe:animate-pulse">
          {[38, 55, 46, 70, 58, 80, 64].map((h, k) => <span key={k} className="flex-1 rounded-sm bg-line-2" style={{ height: `${h}%` }} />)}
        </div>
      </div>
    );
  } else if (!win) {
    body = (
      <div className="grid h-full place-items-center rounded-2xl border border-dashed border-line-2 px-6 text-center text-[16px] leading-snug text-ink-2">
        {chart.state === "error" ? "The chart could not load just now." : "Chart after the next daily run"}
      </div>
    );
  } else {
    const last = g.last;
    body = (
      <svg width={w} height={CHART_H} viewBox={`0 0 ${w} ${CHART_H}`} role="img" aria-label={miniSummary(name, win)} className="block">
        <defs><clipPath id={clip}><rect x="0" y="0" width={w} height={CHART_H} /></clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          {g.candles.map((k) => {
            const col = k.up ? UP : DOWN;
            return (
              <g key={k.i}>
                <line x1={k.cx} x2={k.cx} y1={k.wickTop} y2={k.y} stroke={col} strokeWidth="1.5" strokeLinecap="round" />
                <line x1={k.cx} x2={k.cx} y1={k.y + k.h} y2={k.wickBot} stroke={col} strokeWidth="1.5" strokeLinecap="round" />
                {k.hollow
                  ? <rect x={k.x + 0.75} y={k.y + 0.75} width={Math.max(0.5, k.w - 1.5)} height={Math.max(0.5, k.h - 1.5)} rx="1" fill="var(--surface)" stroke={col} strokeWidth="1.5" />
                  : <rect x={k.x} y={k.y} width={k.w} height={Math.max(1, k.h)} rx="1" fill={col} />}
              </g>
            );
          })}
          <path d={g.ma} fill="none" stroke={AVG} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {last && <circle cx={last.cx} cy={last.cy} r="5" fill={last.up ? UP : DOWN} stroke="var(--surface)" strokeWidth="2" />}
      </svg>
    );
  }
  return (
    <figure>
      <div ref={ref} style={{ height: CHART_H }}>{body}</div>
      <figcaption className="mt-2.5">
        {chart?.state !== "missing" && chart?.state !== "error" && <span className="block text-[15px] text-ink-2">Last month: one candle a day.</span>}
        {win && (
          <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-ink-2" aria-hidden="true">
            <KeyItem mark="up">Up day</KeyItem>
            <KeyItem mark="down">Down day</KeyItem>
            <KeyItem mark="avg">Twenty-day average</KeyItem>
            <KeyItem mark="last">Newest day</KeyItem>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function KeyItem({ mark, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
        {mark === "up" && <><line x1="7" x2="7" y1="1" y2="13" stroke={UP} strokeWidth="1.5" /><rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1" fill="var(--surface)" stroke={UP} strokeWidth="1.5" /></>}
        {mark === "down" && <><line x1="7" x2="7" y1="1" y2="13" stroke={DOWN} strokeWidth="1.5" /><rect x="3" y="3" width="8" height="8" rx="1" fill={DOWN} /></>}
        {mark === "last" && <circle cx="7" cy="7" r="4.5" fill="var(--ink-2)" />}
        {mark === "avg" && <path d="M1 10 C5 9, 8 5, 13 4" fill="none" stroke={AVG} strokeWidth="2" strokeLinecap="round" />}
      </svg>
      {children}
    </span>
  );
}
