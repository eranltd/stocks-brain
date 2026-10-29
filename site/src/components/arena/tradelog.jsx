import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SIDES, scoreAt } from "../../lib/agent.js";
import { fmtDate } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { useDayTick } from "./clock.jsx";

/*
 * The trade log: a window over the page with every move the demo agent made up to the day the replay shows (buy,
 * sell, short, cover), newest first, with a filter per kind, why it moved and how each closed position ended. It keeps
 * filling while the replay runs. Escape, the close button or a tap outside closes it; focus goes back where it was.
 */

const t = strings(dict);
const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const day = (iso) => (iso ? fmtDate(iso).replace(/^\w+,\s/, "").replace(/\s\d{4}$/, "") : "");
const tone = (v) => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");

function why(x) {
  const v = { rank: x.rank, cold: x.cold, move: pct(x.move ?? 0), days: x.days ?? "" };
  return t(`log.why.${x.side}`, v);
}

export function TradeLog({ open, onClose, race, run, clock, go }) {
  const [k, setK] = useState(0);
  const [kind, setKind] = useState("all");
  const box = useRef(null);
  const back = useRef(null);
  useDayTick(clock, (d) => setK(d), []);

  useEffect(() => {
    if (!open) return undefined;
    back.current = document.activeElement;
    box.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      back.current?.focus?.();
    };
  }, [open, onClose]);

  const done = useMemo(() => run.trades.filter((x) => x.day <= k), [run, k]);
  const counts = useMemo(() => Object.fromEntries(SIDES.map((s) => [s, done.filter((x) => x.side === s).length])), [done]);
  const rows = useMemo(() => (kind === "all" ? done : done.filter((x) => x.side === kind)).slice().reverse(), [done, kind]);
  if (!open) return null;
  const score = scoreAt(run, k);
  const kinds = ["all", ...SIDES.filter((s) => run.opts.short > 0 || (s !== "short" && s !== "cover") || counts[s])];

  return createPortal(
    <div className="log-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="log-h" tabIndex={-1} className="log-box">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="log-h" className="headline text-[26px] leading-none text-ink">{t("log.title")}</h2>
            <p className="mt-1 font-num text-[11px] tracking-[0.1em] text-ink-3 uppercase">{t("log.sub", { day: day(race.dates[k]) })}</p>
          </div>
          <button type="button" onClick={onClose} className="log-x" aria-label={t("agent.close")}>×</button>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 px-4 pt-3 sm:px-5">
          <div className="tile px-3 py-2"><p className="micro">{t("log.trades")}</p><p className="font-num mt-1 text-[20px] leading-none font-bold text-ink">{done.length}</p></div>
          <div className="tile px-3 py-2"><p className="micro">{t("log.won")}</p><p className="font-num mt-1 text-[20px] leading-none font-bold text-ink">{score.wins}<span className="text-[13px] text-ink-3">/{score.closed}</span></p></div>
          <div className="tile px-3 py-2"><p className="micro">{t("log.money")}</p><p className="font-num mt-1 text-[20px] leading-none font-bold" data-tone={tone(run.equity[k] - run.start)}>{money(run.equity[k])}</p></div>
        </div>

        <div role="group" aria-label={t("log.what")} className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-4 pt-3 pb-0.5 sm:px-5">
          {kinds.map((s) => (
            <button key={s} type="button" aria-pressed={kind === s} onClick={() => setKind(s)} className="log-filter" data-side={s}>
              {s === "all" ? t("log.all") : t(`agent.${s}`)}<span>{s === "all" ? done.length : counts[s]}</span>
            </button>
          ))}
        </div>

        <div className="log-scroll mt-3">
          {rows.length ? (
            <table className="log-table">
              <thead>
                <tr><th>{t("log.when")}</th><th>{t("log.what")}</th><th>{t("log.name")}</th><th className="text-end">{t("log.amount")}</th><th className="text-end">{t("log.result")}</th><th className="max-sm:hidden">{t("log.why")}</th></tr>
              </thead>
              <tbody>
                {rows.map((x, i) => (
                  <tr key={`${x.day}-${x.side}-${x.symbol}-${i}`} data-side={x.side}>
                    <td className="text-ink-3">{day(race.dates[x.day])}</td>
                    <td><span className="log-side">{t(`agent.${x.side}`)}</span></td>
                    <td><button type="button" className="font-bold text-ink hover:text-desk" onClick={() => { onClose(); go(`stock/${x.symbol}`); }}>{x.symbol}</button></td>
                    <td className="text-end">{money(x.amount)}</td>
                    <td className="text-end">{Number.isFinite(x.pnl) ? <span className="arena-tone font-bold" data-tone={tone(x.pnl)}>{pct(x.pnl)}</span> : <span className="text-ink-3">{t("log.stillOpen")}</span>}</td>
                    <td className="max-sm:hidden text-ink-2">{why(x)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="px-5 py-8 text-center text-[13px] text-ink-3">{t("log.none")}</p>}
        </div>
        <p className="shrink-0 border-t border-line px-4 py-2.5 font-num text-[10.5px] tracking-[0.1em] text-ink-3 uppercase sm:px-5">{t("log.foot")}</p>
      </div>
    </div>,
    document.body,
  );
}
