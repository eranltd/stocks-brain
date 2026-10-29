import { MIN_DROPS, dropStats, dropsFor } from "../lib/bigmoves.js";
import { fmtDate } from "../lib/format.js";
import { strings } from "../lib/text.js";
import dict from "../text/stock.js";
import { Panel } from "./ui.jsx";

/*
 * "Big drops" on the stock page (id big-drop): this name's one-day falls of 8% or more over the fetched history and
 * how each did against the market 5, 20 and 60 trading days later (bought at the next close), beside the study's
 * numbers for every name on the list and for any day. The newest drop is followed as it goes ("so far"). Learned from
 * Alphabet on 29 Oct 2026. A study on past data, never a reason to trade; the panel says so.
 */

const t = strings(dict);
const pct = (v) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`);
const day = (iso) => (iso ? fmtDate(iso).replace(/^\w+,\s/, "") : "");
const tone = (v) => (v == null ? "flat" : v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");

export function BigDrops({ dips, symbol, move = null, className = "" }) {
  const mine = dropsFor(dips, symbol);
  const s20 = dropStats(dips, 20);
  const s60 = dropStats(dips, 60);
  const fresh = move != null && move <= -(dips?.drop_pct ?? 8);
  if (!dips && !fresh) return null;
  if (dips && !mine.length && !fresh) return null;
  return (
    <Panel id="big-drop" className={`scroll-mt-32 ${className}`} title={t("sp.drop.title")} sub={t("sp.drop.sub", { drop: dips?.drop_pct ?? 8 })}
      info={t("sp.drop.how", { drop: dips?.drop_pct ?? 8, from: dips?.from ? fmtDate(dips.from) : "" })} infoLabel={t("sp.drop.about")}>
      {fresh && <p className="drop-now">{t("sp.drop.now", { move: pct(move) })}</p>}
      {s20 ? (
        <div className="grid grid-cols-2 gap-2">
          {[s20, s60].filter(Boolean).map((s) => (
            <div key={s.h} className="tile px-3 py-2.5">
              <p className="micro">{t("sp.drop.after", { h: s.h })}</p>
              <p className="font-num mt-1 text-[22px] leading-none font-bold" data-tone={s.n >= MIN_DROPS ? tone(s.beat - (s.baseBeat ?? 50)) : "flat"}>{Math.round(s.beat)}%</p>
              <p className="mt-1 text-[12px] leading-snug text-ink-2">{t("sp.drop.beat", { n: s.n, base: Math.round(s.baseBeat ?? 50), avg: pct(s.avg) })}</p>
              {s.n < MIN_DROPS && <p className="mt-1 text-[11.5px] font-semibold text-wait">{t("sp.drop.few")}</p>}
            </div>
          ))}
        </div>
      ) : <p className="text-[13px] text-ink-2">{t("sp.drop.soon")}</p>}
      {mine.length > 0 && (
        <>
          <p className="micro mt-3">{t("sp.drop.mine", { symbol })}</p>
          <table className="drop-table mt-1.5">
            <thead><tr><th>{t("sp.drop.day")}</th><th className="text-end">{t("sp.drop.fall")}</th><th className="text-end">5d</th><th className="text-end">20d</th><th className="text-end">60d</th></tr></thead>
            <tbody>
              {mine.slice(0, 8).map((e) => (
                <tr key={e.date}>
                  <td>{day(e.date)}</td>
                  <td className="text-end text-down">{pct(e.drop_pct)}%</td>
                  {["5", "20", "60"].map((h) => {
                    const v = e.excess?.[h];
                    const soFar = v == null && e.so_far_excess_pct != null && e.days_since < Number(h);
                    return <td key={h} className="text-end" data-tone={tone(soFar ? e.so_far_excess_pct : v)}>{soFar ? `${pct(e.so_far_excess_pct)}*` : pct(v)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[11.5px] text-ink-3">{t("sp.drop.legend")}</p>
        </>
      )}
      <p className="mt-2.5 text-[12px] leading-snug text-ink-3">{t("sp.drop.note")}</p>
    </Panel>
  );
}
