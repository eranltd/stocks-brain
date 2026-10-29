import { Fragment, useMemo, useState } from "react";
import { agentMind } from "../../lib/agent.js";
import { fmtDate } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { InfoTip } from "../ui.jsx";
import { useDayTick } from "./clock.jsx";

/*
 * The agent's plan: what the demo trader agent (lib/agent.js) is thinking on the day the replay shows. Every name
 * ranked by its move over the last 20 days, with the buy zone (the top 4 that rose) marked; what it holds; what it
 * wants to buy and to sell at its next move; and a countdown to that move. On a trading day it shows what it just did.
 * Steps with the replay, one day at a time.
 */

const t = strings(dict);
const SHOW = 8;
const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const shortDay = (iso) => (iso ? fmtDate(iso).replace(/^\w+,\s/, "").replace(/\s\d{4}$/, "") : "");

export function AgentPlan({ race, run, clock, go, className = "" }) {
  const [k, setK] = useState(0);
  useDayTick(clock, (day) => setK(day), []);
  const mind = useMemo(() => agentMind(race, run, k), [race, run, k]);
  if (!mind) return null;
  const { hold, every, lookback, invest } = run.opts;
  const top = mind.ranked.slice(0, SHOW);
  const extra = mind.ranked.slice(SHOW).filter((r) => r.held);
  const scale = Math.max(1, ...mind.ranked.map((r) => Math.abs(r.m)));
  const acting = mind.nextIn === 0;

  const row = (r) => {
    const status = r.held ? (r.zone ? "hold" : "sell") : r.zone ? "buy" : null;
    return (
      <li key={r.symbol} className="plan-row" data-zone={r.zone ? "1" : "0"}>
        <span className="plan-rank">{String(r.rank).padStart(2, "0")}</span>
        <button type="button" onClick={() => go(`stock/${r.symbol}`)} className="plan-sym">{r.symbol}</button>
        <span className="plan-bar" aria-hidden="true">
          <i data-tone={r.m >= 0 ? "up" : "down"} style={{ width: `${Math.max(2, (Math.abs(r.m) / scale) * 100)}%` }} />
        </span>
        <span className="plan-pct" data-tone={r.m > 0 ? "up" : r.m < 0 ? "down" : "flat"}>{pct(r.m)}</span>
        <span className="plan-tag" data-kind={status ?? "none"}>{status ? t(`plan.tag.${status}`) : ""}</span>
      </li>
    );
  };

  return (
    <section aria-labelledby="arena-plan-h" className={`panel plan-panel overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 id="arena-plan-h" className="kicker flex items-center gap-2">
          <span className="agent-live-dot" aria-hidden="true" />{t("plan.title")}<span className="text-ink-3">· {shortDay(race.dates[k])}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="plan-next" data-now={acting ? "1" : "0"}>
            {mind.nextIn == null ? t("plan.next.none") : acting ? t("plan.next.now") : t(mind.nextIn === 1 ? "plan.next.one" : "plan.next.in", { n: mind.nextIn })}
          </span>
          <InfoTip label={t("agent.about")}>{t("plan.how", { hold, days: lookback, every, invest: Math.round(invest * 100) })}</InfoTip>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="micro">{t("plan.rank", { days: lookback })}</p>
          <ol className="plan-list mt-1.5">
            {top.map((r) => (
              <Fragment key={r.symbol}>
                {row(r)}
                {r.rank === hold && <li className="plan-cut" aria-hidden="true"><span>{t("plan.zone", { n: hold })}</span></li>}
              </Fragment>
            ))}
            {extra.length > 0 && <li className="plan-gap" aria-hidden="true">···</li>}
            {extra.map(row)}
          </ol>
        </div>

        <div className="grid min-w-0 content-start gap-3">
          {acting && mind.today.length > 0 ? (
            <div className="plan-box" data-kind="now">
              <p className="micro text-desk">{t("plan.did")}</p>
              <ul className="mt-1.5 grid gap-1">
                {mind.today.map((x) => (
                  <li key={`${x.side}-${x.symbol}`} className="plan-did" data-side={x.side}>
                    <b>{t(x.side === "buy" ? "agent.buy" : "agent.sell")}</b> {x.symbol}
                    <span className="ms-auto">{x.side === "buy" ? money(x.amount) : pct(x.pnl)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="plan-box" data-kind="buy">
                <p className="micro">{t("plan.wantBuy")}</p>
                {mind.wantBuy.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {mind.wantBuy.map((r) => <span key={r.symbol} className="plan-chip" data-kind="buy"><b>{r.symbol}</b> #{r.rank} · {pct(r.m)}</span>)}
                  </div>
                ) : <p className="plan-quiet">{t("plan.noBuy")}</p>}
              </div>
              <div className="plan-box" data-kind="sell">
                <p className="micro">{t("plan.wantSell")}</p>
                {mind.wantSell.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {mind.wantSell.map((r) => <span key={r.symbol} className="plan-chip" data-kind="sell"><b>{r.symbol}</b> {t("plan.fell", { n: r.rank })}</span>)}
                  </div>
                ) : <p className="plan-quiet">{t("plan.noSell")}</p>}
              </div>
            </>
          )}
          <p className="text-[12px] leading-snug text-ink-3">{t("plan.note")}</p>
        </div>
      </div>
    </section>
  );
}
