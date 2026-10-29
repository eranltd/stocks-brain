import { todayISO } from "../lib/outlook.js";
import { gameRow, historyWords, scoreLine, weeklyBuyDay, WEEKLY_RULES } from "../lib/weekly.js";
import { betRecord, scoreBets } from "../lib/bets.js";
import { Chip, Panel } from "./ui.jsx";
import { DeskHead } from "./pulse.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";

/** "+1.4" points, sign first. */
const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;

/** The brain's weekly bet: its three best and three worst names, scored every week against luck (lib/bets.js). */
function BrainBet({ data, go, compact }) {
  const t = strings(dict);
  const scored = data.sample ? [] : scoreBets(data.runs, data.market, data.bench?.symbol);
  const now = scored[0];
  const rec = betRecord(scored);
  const chips = (xs, tone) => xs.map((x) => (
    <button key={x} type="button" onClick={() => go(`stock/${x}`)} className="inline-flex min-h-[36px] items-center">
      <Chip tone={tone} className="text-[12px] tracking-[0.02em] normal-case hover:border-ink-3">{data.names?.[x] ?? x}</Chip>
    </button>
  ));
  return (
    <li className="tile p-3">
      <p className="headline text-[19px] tracking-[0.03em] text-ink">{t("wkc.bet")}</p>
      {!compact && <p className="mt-1 text-[13.5px] leading-snug text-ink-3">{t("wkc.betHow")}</p>}
      {now ? (
        <>
          <p className="micro mt-2.5 text-up">{t("wkc.best")}</p>
          <div className="mt-1 flex flex-wrap gap-x-1.5">{chips(now.best, "up")}</div>
          <p className="micro mt-2 text-down">{t("wkc.worst")}</p>
          <div className="mt-1 flex flex-wrap gap-x-1.5">{chips(now.worst, "down")}</div>
          {/* the brain's own reason */}
          {!compact && now.why && <p className="mt-2.5 text-[14px] leading-snug text-ink-2">{now.why}</p>}
          {now.spread !== null && <p className="mt-2.5 text-[13.5px] leading-snug text-ink">{t("wkc.soFar", { spread: signed(now.spread) })}</p>}
          <p className="mt-1.5 text-[13.5px] leading-snug text-ink-2">{rec.line}</p>
          {!compact && scored.filter((b) => !b.open && b.won !== null).length > 0 && (
            <ul className="mt-2.5 grid gap-1 border-t border-line pt-2.5">
              {scored.filter((b) => !b.open && b.won !== null).slice(0, 8).map((b) => (
                <li key={b.date} className="text-[13px] text-ink-2"><span className={`font-num font-bold ${b.won ? "text-up" : "text-down"}`}>{t(b.won ? "wkc.won" : "wkc.lost")}</span> {t("wkc.weekOf", { day: dayLong(b.date), spread: signed(b.spread) })}</li>
              ))}
            </ul>
          )}
        </>
      ) : <p className="mt-2.5 text-[13.5px] leading-snug text-ink">{t("wkc.firstBet")}</p>}
    </li>
  );
}

/** "Monday, October 19", read as a UTC calendar day. */
const dayLong = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * "This week": the plan acts weekly. Real money: the weekly buy of the whole-market fund. Pretend money: the weekly
 * game, two weekly rules recorded forward and checked against random picks. Nothing here is a reason to trade real
 * money in single stocks; that waits until a rule passes history and its paper record.
 */
export function WeeklyGame({ data, go, compact = false }) {
  const t = strings(dict);
  const today = todayISO();
  const buy = weeklyBuyDay(today, data.buyWindow, data.sample);
  const ledger = data.ledger && !data.ledger.sample ? data.ledger : null;
  return (
    <Panel id="this-week" className="scroll-mt-28" head={<DeskHead id="this-week-h" title={t("wkc.title")} sub={t("wkc.sub")} />}>
      <div className="tile relative overflow-hidden p-3 ps-4">
        <span aria-hidden="true" className="absolute inset-y-0 start-0 w-[3px] bg-up" />
        <p className="micro text-up">{t("wkc.real")}</p>
        <p className="headline mt-1.5 text-[21px] leading-[1.05] text-ink">{t("wkc.buyDay", { day: buy === today ? t("wkc.today") : dayLong(buy) })}</p>
        <p className="mt-1.5 text-[13.5px] leading-snug text-ink-2">{t(compact ? "wkc.buyShort" : "wkc.buyLong")}</p>
      </div>

      <p className="micro mt-4 text-people">{t("wkc.pretend")}</p>
      {!compact && <p className="mt-1 text-[14px] leading-snug text-ink-2">{t("wkc.pretendHow")}</p>}
      <ul className="mt-2 grid gap-2">
        <BrainBet data={data} go={go} compact={compact} />
        {WEEKLY_RULES.map((r) => {
          const row = gameRow(ledger, r.id, data.names);
          const hist = historyWords(data.rulesResult, r.id);
          return (
            <li key={r.id} className="tile p-3">
              <p className="headline text-[19px] tracking-[0.03em] text-ink">{r.name}</p>
              {!compact && <p className="mt-1 text-[13.5px] leading-snug text-ink-3">{r.what}</p>}
              {row ? (
                <div className="mt-1.5 flex flex-wrap gap-x-1.5">
                  {row.holdings.length ? row.holdings.map((h) => (
                    <button key={h.ticker} type="button" onClick={() => go(`stock/${h.ticker}`)} className="inline-flex min-h-[36px] items-center">
                      <Chip tone="neutral" className="text-[12px] tracking-[0.02em] text-ink normal-case hover:border-ink-3">{h.name}</Chip>
                    </button>
                  )) : <span className="py-1.5 text-[13.5px] text-ink-2">{t("wkc.onlyCore")}</span>}
                </div>
              ) : null}
              <p className="mt-1.5 text-[13.5px] leading-snug text-ink">{scoreLine(row)}</p>
              {!compact && <p className={`mt-1 text-[13px] leading-snug ${hist.tested && !hist.passed ? "text-down" : "text-ink-3"}`}>{hist.line}</p>}
            </li>
          );
        })}
      </ul>
      {compact
        ? <button type="button" onClick={() => go("verdicts")} className="mt-3 inline-flex min-h-[44px] items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.1em] text-desk uppercase hover:text-ink">{t("wkc.scoreboard")} <span aria-hidden="true">→</span></button>
        : <p className="mt-3 text-[12.5px] leading-snug text-ink-3">{t("wkc.howFills")}</p>}
    </Panel>
  );
}
