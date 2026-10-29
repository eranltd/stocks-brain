import { useMemo } from "react";
import { BIG_MOVE_PCT, MIN_DROPS, alertsNow, dropStats } from "../lib/bigmoves.js";
import { fmtDate } from "../lib/format.js";
import { todayISO } from "../lib/outlook.js";
import { strings } from "../lib/text.js";
import dict from "../text/home.js";

/*
 * The alert bar at the top of Home: what deserves a loud flag right now. A list name that moved BIG_MOVE_PCT or more
 * on the latest day (tied to its results when it was a results day), with what the big-drop study says usually came
 * next; and companies reporting results today or in the next days ("big move possible"). Learned from Alphabet on
 * 29 Oct 2026, when the site knew the date and said nothing. Tapping opens the stock's page at the right section.
 */

const t = strings(dict);
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const day = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "");

export function AlertBar({ data, openTo, className = "" }) {
  const today = todayISO();
  const alerts = useMemo(() => alertsNow(data, today).slice(0, 4), [data, today]);
  const stats = dropStats(data?.dips, 20);
  if (!alerts.length) return null;
  const name = (sym) => data?.names?.[sym] ?? sym;
  return (
    <ul className={`alert-bar ${className}`} aria-label={t("alert.label")}>
      {alerts.map((a) => (
        <li key={`${a.kind}-${a.symbol}`}>
          {a.kind === "move" ? (
            <button type="button" className="alert-card" data-kind={a.move < 0 ? "drop" : "jump"} onClick={() => openTo(`stock/${a.symbol}#${a.move < 0 ? "big-drop" : "why-it-moved"}`)}>
              <span className="alert-head">
                <span className="alert-bolt" aria-hidden="true">⚡</span>
                <span className="alert-tag">{t("alert.big")}</span>
                <b>{a.symbol}</b>
                <span className="alert-move">{pct(a.move)}</span>
                <span className="ms-auto text-ink-3">{day(a.date)}</span>
              </span>
              <span className="alert-title">
                {t(a.move < 0 ? "alert.dropTitle" : "alert.jumpTitle", { name: name(a.symbol) })}
                {a.results ? ` ${t("alert.afterResults")}` : ""}
              </span>
              <span className="alert-line">
                {a.move < 0
                  ? (stats && stats.n >= MIN_DROPS ? t("alert.study", { n: stats.n, beat: Math.round(stats.beat), base: Math.round(stats.baseBeat ?? 50), drop: data.dips.drop_pct })
                    : stats ? t("alert.studyFew", { n: stats.n }) : t("alert.studySoon"))
                  : t("alert.jumpLine")}
              </span>
              <span className="alert-go">{t("alert.see")} <span aria-hidden="true">→</span></span>
            </button>
          ) : (
            <button type="button" className="alert-card" data-kind="results" onClick={() => openTo(`stock/${a.symbol}#whats-next`)}>
              <span className="alert-head">
                <span className="alert-bolt" aria-hidden="true">◷</span>
                <span className="alert-tag">{t(a.days === 0 ? "alert.resultsToday" : a.days === 1 ? "alert.resultsTomorrow" : "alert.resultsIn", { n: a.days })}</span>
                <b>{a.symbol}</b>
                <span className="ms-auto text-ink-3">{day(a.date)}</span>
              </span>
              <span className="alert-title">{t("alert.resultsTitle", { name: name(a.symbol) })}</span>
              <span className="alert-line">{t("alert.resultsLine", { pct: BIG_MOVE_PCT })}</span>
              <span className="alert-go">{t("alert.see")} <span aria-hidden="true">→</span></span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
