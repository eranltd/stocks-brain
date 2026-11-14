import { analystsWord, flowsFor, shortBars } from "../lib/flows.js";
import { fmtDate } from "../lib/format.js";
import { strings } from "../lib/text.js";
import dict from "../text/stock.js";
import { Panel } from "./ui.jsx";

/*
 * "Who is betting what" on the stock page (id flows): three free signals, in plain words (lib/flows.js). How much of
 * the trading was short selling (bets on a drop) on the latest day against this name's usual level, with the last 20
 * days as bars; what analysts say; whether insiders bought or sold. Nobody publishes "85% bought, 15% sold" for free
 * (every share bought is a share sold); the panel says what these numbers are and are not.
 */

const t = strings(dict);
const day = (iso) => (iso ? fmtDate(iso).replace(/^\w+,\s/, "").replace(/\s\d{4}$/, "") : "");
const month = (ym) => (ym ? new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }) : "");
const big = (n) => Math.abs(n).toLocaleString("en-US");

export function FlowsPanel({ flows, symbol, className = "" }) {
  const row = flowsFor(flows, symbol);
  if (!row || (!row.short && !row.analysts && !row.insiders)) return null;
  const { short: s, analysts: a, insiders: ins } = row;
  const bars = shortBars(s);
  const top = Math.max(60, ...bars.map((b) => b.p));
  const aw = analystsWord(a);
  return (
    <Panel id="flows" className={`scroll-mt-32 ${className}`} title={t("sp.flows.title")} sub={t("sp.flows.sub")}
      info={t("sp.flows.how")} infoLabel={t("sp.info")}>
      <div className="flows">
        {s && (
          <section className="flows-block" data-level={s.level ?? "none"}>
            <p className="micro">{t("sp.flows.short.h", { day: day(s.date) })}</p>
            <p className="flows-big">{Math.round(s.pct)}%</p>
            <p className="flows-line">
              {s.level ? t(`sp.flows.short.${s.level}`, { base: Math.round(s.base_pct), diff: Math.abs(Math.round(s.diff)) }) : t("sp.flows.short.new")}
            </p>
            <div className="flows-bars" role="img" aria-label={t("sp.flows.short.bars", { n: bars.length })}>
              {bars.map((b, i) => (
                <i key={b.d} style={{ height: `${Math.max(6, (b.p / top) * 100)}%` }} data-last={i === bars.length - 1 ? "1" : "0"} title={`${day(b.d)}: ${b.p}%`} />
              ))}
            </div>
            <p className="flows-note">{t("sp.flows.short.note")}</p>
          </section>
        )}
        {a && (
          <section className="flows-block" data-word={aw}>
            <p className="micro">{t("sp.flows.analysts.h")}</p>
            <p className="flows-big">{t("sp.flows.analysts.big", { buy: a.strong_buy + a.buy, n: a.n })}</p>
            <p className="flows-line">{t(`sp.flows.analysts.${aw}`)}</p>
            <div className="flows-split" aria-hidden="true">
              <i data-k="buy" style={{ flexGrow: a.strong_buy + a.buy }} />
              <i data-k="hold" style={{ flexGrow: a.hold }} />
              <i data-k="sell" style={{ flexGrow: a.sell + a.strong_sell }} />
            </div>
            <p className="flows-note">{t("sp.flows.analysts.counts", { buy: a.strong_buy + a.buy, hold: a.hold, sell: a.sell + a.strong_sell, month: month(a.period.slice(0, 7)) })}</p>
          </section>
        )}
        {ins && (
          <section className="flows-block" data-side={ins.side}>
            <p className="micro">{t("sp.flows.insiders.h")}</p>
            <p className="flows-big">{t(`sp.flows.insiders.${ins.side}`)}</p>
            <p className="flows-line">
              {ins.side === "none" ? t("sp.flows.insiders.noneLine") : t("sp.flows.insiders.line", { n: big(ins.net_shares), side: t(`sp.flows.insiders.verb.${ins.side}`), months: ins.months })}
            </p>
            <p className="flows-note">{t("sp.flows.insiders.note", { month: month(ins.last_month) })}</p>
          </section>
        )}
      </div>
    </Panel>
  );
}
