import { useMemo, useRef } from "react";
import { BASKET, basketSeries } from "../../lib/arena.js";
import { fmtDate, fmtPct } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { TickNumber, useSize } from "../motion.jsx";
import { useDayTick } from "./clock.jsx";

/*
 * The paper basket: "if you had split $10,000 evenly across the list on <the first day>", day by day with the replay,
 * from the same real percents as the race (lib/arena.js basketSeries: no trading, nothing invented). The one dollar
 * figure on the page, always labelled as paper money from past data, not a forecast. Below it, its curve so far.
 */

const t = strings(dict);
export const dollars = (v) => `$${Math.round(v).toLocaleString("en-US")}`;

export function Basket({ race, clock, benchName, className = "" }) {
  const series = useMemo(() => basketSeries(race), [race]);
  const num = useRef(null), chg = useRef(null), bench = useRef(null), clip = useRef(null), head = useRef(null);
  const box = useRef(null);
  const { w } = useSize(box);
  const H = 64;
  const geo = useMemo(() => {
    if (!series.length || !w) return null;
    let lo = Math.min(BASKET, ...series), hi = Math.max(BASKET, ...series);
    const pad = (hi - lo) * 0.1 || 1;
    lo -= pad; hi += pad;
    const x = (i) => (i / Math.max(1, series.length - 1)) * (w - 4) + 2;
    const y = (v) => 4 + (1 - (v - lo) / (hi - lo)) * (H - 8);
    const d = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return { x, y, d, base: y(BASKET) };
  }, [series, w]);

  useDayTick(clock, (k) => {
    const v = series[k];
    if (v == null) return;
    num.current?.set(v);
    if (chg.current) { chg.current.textContent = fmtPct((v / BASKET - 1) * 100, 1); chg.current.dataset.tone = v >= BASKET ? "up" : "down"; }
    if (bench.current && race.bench) {
      const b = race.bench.values[k] ?? 0;
      bench.current.textContent = fmtPct(b, 1);
      bench.current.dataset.tone = b >= 0 ? "up" : "down";
    }
    if (geo) {
      clip.current?.setAttribute("transform", `scale(${((geo.x(k) + 2) / w).toFixed(5)},1)`);
      if (head.current) head.current.style.transform = `translate3d(${geo.x(k).toFixed(1)}px,${geo.y(v).toFixed(1)}px,0)`;
    }
  }, [series, geo, race]);

  return (
    <section aria-labelledby="arena-basket-h" className={`panel overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 id="arena-basket-h" className="kicker">{t("arena.basket.title")}</h2>
        <span className="chip border-desk/55 bg-desk/10 text-desk">{t("arena.strip.paper")}</span>
      </div>
      <div className="p-4">
        <p className="text-[13px] leading-snug text-ink-2">{t("arena.basket.line", { amount: dollars(BASKET), date: fmtDate(race.dates[0]) })}</p>
        <div className="mt-2">
          <TickNumber ref={num} value={BASKET} prefix="$" digits={5} base={BASKET} className="arena-basket-num" label={t("arena.basket.title")} format={dollars} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-num text-[12px] uppercase">
          <span className="text-ink-3">{t("arena.basket.change")} <span ref={chg} className="arena-tone font-bold">+0.0%</span></span>
          {race.bench && <span className="text-ink-3">{benchName} <span ref={bench} className="arena-tone font-bold">+0.0%</span></span>}
        </div>
        <div ref={box} className="relative mt-3" style={{ height: H }} aria-hidden="true">
          {geo && (
            <>
              <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="absolute inset-0 block">
                <defs>
                  <clipPath id="basket-clip"><rect ref={clip} x="0" y="0" width={w} height={H} transform="scale(0,1)" /></clipPath>
                  <linearGradient id="basket-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--desk)" stopOpacity="0.22" /><stop offset="1" stopColor="var(--desk)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" x2={w} y1={geo.base} y2={geo.base} stroke="var(--line-2)" strokeDasharray="2 4" />
                <g clipPath="url(#basket-clip)">
                  <path d={`${geo.d}L${w - 2},${H}L2,${H}Z`} fill="url(#basket-fill)" />
                  <path d={geo.d} fill="none" stroke="var(--desk)" strokeWidth="1.6" strokeLinejoin="round" />
                </g>
              </svg>
              <span ref={head} className="arena-dot" />
            </>
          )}
        </div>
        <p className="mt-3 font-num text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{t("arena.basket.label")}</p>
      </div>
    </section>
  );
}
