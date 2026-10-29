import { useEffect, useMemo, useRef, useState } from "react";
import { holdingsAt, scoreAt } from "../../lib/agent.js";
import { BASKET, basketSeries } from "../../lib/arena.js";
import { fmtDate } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { InfoTip } from "../ui.jsx";
import { useAgentLevel, useFeedSwitch } from "../agentfeed.jsx";
import { useDayTick } from "./clock.jsx";

/*
 * The agent panel: the demo trader agent (lib/agent.js) playing along with the replay. Its paper money glides every
 * frame; what it holds, its last trades and its score step with each day. Paper money from past data, a demo rule that
 * was never tested, and the panel says so. The pop-up switch for the whole app sits here too.
 */

const t = strings(dict);
const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const shortDay = (iso) => (iso ? fmtDate(iso).replace(/^\w+,\s/, "").replace(/\s\d{4}$/, "") : "");
const tone = (v) => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");

export function AgentPanel({ race, run, clock, go, className = "" }) {
  const [on, setOn] = useFeedSwitch();
  const [level] = useAgentLevel();
  const basket = useMemo(() => basketSeries(race), [race]);
  const bySym = useMemo(() => new Map(race.lines.map((l) => [l.symbol, l])), [race]);
  const num = useRef(null), even = useRef(null);
  const [k, setK] = useState(0);

  // Every frame: the agent's money between two days, so the count runs like a ticker.
  useEffect(() => clock.subscribe((p) => {
    const eq = run.equity;
    const i = Math.max(0, Math.min(eq.length - 1, Math.floor(p)));
    const j = Math.min(eq.length - 1, i + 1);
    const f = Math.max(0, Math.min(1, p - i));
    const v = eq[i] + (eq[j] - eq[i]) * f;
    if (num.current) {
      num.current.textContent = money(v);
      num.current.dataset.tone = v > run.start + 0.5 ? "up" : v < run.start - 0.5 ? "down" : "flat";
    }
    if (even.current && basket.length) even.current.textContent = money(basket[i] + (basket[j] - basket[i]) * f);
    return false;
  }), [clock.subscribe, run, basket]); // eslint-disable-line react-hooks/exhaustive-deps

  useDayTick(clock, (day) => setK(day), []);

  const levelAt = (sym, d) => 1 + (bySym.get(sym)?.values[d] ?? 0) / 100;
  const held = holdingsAt(run, k).map((h) => ({ ...h, pnl: (levelAt(h.symbol, k) / levelAt(h.symbol, h.since) - 1) * 100 }));
  const log = run.trades.filter((x) => x.day <= k).slice(-5).reverse();
  const made = run.trades.filter((x) => x.day <= k).length;
  const score = scoreAt(run, k);

  return (
    <section aria-labelledby="arena-agent-h" className={`panel agent-panel overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 id="arena-agent-h" className="kicker flex items-center gap-2"><span className="agent-live-dot" aria-hidden="true" />{t("agent.title")}</h2>
        <div className="flex items-center gap-1.5">
          <span className="chip border-desk/55 bg-desk/10 text-desk">{t("agent.chip")}</span>
          <InfoTip label={t("agent.about")}>{t("agent.rule", { hold: run.opts.hold, days: run.opts.lookback, every: run.opts.every, invest: Math.round(run.opts.invest * 100) })}</InfoTip>
        </div>
      </div>
      <div className="p-4">
        <span className="sr-only">{t("agent.title")}</span>
        <span ref={num} data-tone="flat" className="tick-num arena-basket-num">{money(run.start)}</span>
        <p className="mt-1.5 font-num text-[12px] text-ink-3 uppercase">{t("agent.vs")} <span ref={even} className="font-bold text-ink-2">{money(BASKET)}</span></p>
        <p className="agent-level-say" data-level={level}>{t(`agent.level.say.${level}`)}</p>

        <dl className="mt-3 grid grid-cols-2 gap-2">
          <div className="tile px-3 py-2"><dt className="micro">{t("agent.trades")}</dt><dd className="font-num mt-1 text-[20px] leading-none font-bold text-ink">{made}</dd></div>
          <div className="tile px-3 py-2"><dt className="micro">{t("agent.wins")}</dt><dd className="font-num mt-1 text-[20px] leading-none font-bold text-ink">{score.wins}<span className="text-[13px] text-ink-3">/{score.closed}</span></dd></div>
        </dl>

        <p className="micro mt-3">{t("agent.holds")}</p>
        <div className="mt-1.5 flex min-h-[32px] flex-wrap gap-1.5">
          {held.length ? held.map((h) => (
            <button key={h.symbol} type="button" onClick={() => go(`stock/${h.symbol}`)} className="agent-hold" data-tone={tone(h.pnl)}>
              <span className="font-bold text-ink">{h.symbol}</span> {pct(h.pnl)}
            </button>
          )) : <span className="font-num text-[12px] text-ink-3 uppercase">{t("agent.cash")}</span>}
        </div>

        <p className="micro mt-3">{t("agent.log")}</p>
        {log.length ? (
          <ul className="agent-log mt-1.5">
            {log.map((x, i) => (
              <li key={`${x.day}-${x.side}-${x.symbol}-${i}`} data-side={x.side}>
                <span className="text-ink-3">{shortDay(race.dates[x.day])}</span>
                <span className="agent-log-side">{t(x.side === "buy" ? "agent.buy" : "agent.sell")}</span>
                <span className="font-bold text-ink">{x.symbol}</span>
                <span className="ms-auto">{x.side === "sell" ? <span data-tone={tone(x.pnl)} className="arena-tone">{pct(x.pnl)}</span> : money(x.amount)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1.5 text-[12.5px] text-ink-3">{t("agent.none")}</p>}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="font-num text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{t("agent.popups")}</span>
          <button type="button" role="switch" aria-checked={on} onClick={() => setOn(!on)} className="agent-switch" data-on={on ? "1" : "0"}>
            <span aria-hidden="true" className="agent-switch-knob" />{on ? t("agent.on") : t("agent.off")}
          </button>
        </div>
      </div>
    </section>
  );
}
