import { todayISO } from "../lib/outlook.js";
import { gameRow, historyWords, scoreLine, weeklyBuyDay, WEEKLY_RULES } from "../lib/weekly.js";
import { betRecord, scoreBets } from "../lib/bets.js";
import { Reveal } from "./ui.jsx";
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
    <button key={x} type="button" onClick={() => go(`stock/${x}`)} className="rounded-full border px-3 py-1 text-[14.5px] font-medium text-ink hover:border-ink-3" style={{ borderColor: tone }}>{data.names?.[x] ?? x}</button>
  ));
  return (
    <li className="rounded-2xl border border-line-2 p-4">
      <p className="text-[18px] font-bold tracking-[-0.01em] text-ink">{t("wkc.bet")}</p>
      {!compact && <p className="mt-0.5 text-[14.5px] text-ink-3">{t("wkc.betHow")}</p>}
      {now ? (
        <>
          <p className="mt-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-accent">{t("wkc.best")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">{chips(now.best, "var(--accent)")}</div>
          <p className="mt-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-down">{t("wkc.worst")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">{chips(now.worst, "var(--down)")}</div>
          {/* the brain's own reason */}
          {!compact && now.why && <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{now.why}</p>}
          {now.spread !== null && <p className="mt-3 text-[15.5px] leading-relaxed text-ink">{t("wkc.soFar", { spread: signed(now.spread) })}</p>}
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink">{rec.line}</p>
          {!compact && scored.filter((b) => !b.open && b.won !== null).length > 0 && (
            <ul className="mt-3 grid gap-1">
              {scored.filter((b) => !b.open && b.won !== null).slice(0, 8).map((b) => (
                <li key={b.date} className="text-[14.5px] text-ink-2"><span className={b.won ? "text-accent" : "text-down"}>{t(b.won ? "wkc.won" : "wkc.lost")}</span> {t("wkc.weekOf", { day: dayLong(b.date), spread: signed(b.spread) })}</li>
              ))}
            </ul>
          )}
        </>
      ) : <p className="mt-3 text-[15.5px] leading-relaxed text-ink">{t("wkc.firstBet")}</p>}
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
    <Reveal as="section" id="this-week" className="card scroll-mt-28 overflow-hidden">
      <div className="h-1.5" style={{ background: "var(--people)" }} />
      <div className="p-6 sm:p-8">
        <h2 className="text-[15px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--people)" }}>{t("wkc.title")}</h2>

        <div className="mt-4 rounded-2xl border border-line-2 p-4">
          <p className="meta normal-case tracking-[0.04em] text-accent">{t("wkc.real")}</p>
          <p className="mt-1 text-[19px] font-semibold leading-snug text-ink">{t("wkc.buyDay", { day: buy === today ? t("wkc.today") : dayLong(buy) })}</p>
          <p className="mt-1 text-[16px] leading-relaxed text-ink-2">{t(compact ? "wkc.buyShort" : "wkc.buyLong")}</p>
        </div>

        <p className="mt-6 meta normal-case tracking-[0.04em]" style={{ color: "var(--people)" }}>{t("wkc.pretend")}</p>
        {!compact && <p className="mt-1 text-[15.5px] leading-relaxed text-ink-2">{t("wkc.pretendHow")}</p>}
        <ul className="mt-4 grid gap-3">
          <BrainBet data={data} go={go} compact={compact} />
          {WEEKLY_RULES.map((r) => {
            const row = gameRow(ledger, r.id, data.names);
            const hist = historyWords(data.rulesResult, r.id);
            return (
              <li key={r.id} className="rounded-2xl border border-line-2 p-4">
                <p className="text-[18px] font-bold tracking-[-0.01em] text-ink">{r.name}</p>
                {!compact && <p className="mt-0.5 text-[14.5px] text-ink-3">{r.what}</p>}
                {row ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.holdings.length ? row.holdings.map((h) => (
                      <button key={h.ticker} type="button" onClick={() => go(`stock/${h.ticker}`)} className="rounded-full border border-line-2 px-3 py-1 text-[14.5px] font-medium text-ink hover:border-ink-3">{h.name}</button>
                    )) : <span className="text-[15px] text-ink-2">{t("wkc.onlyCore")}</span>}
                  </div>
                ) : null}
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink">{scoreLine(row)}</p>
                {!compact && <p className={`mt-1 text-[14.5px] leading-relaxed ${hist.tested && !hist.passed ? "text-down" : "text-ink-3"}`}>{hist.line}</p>}
              </li>
            );
          })}
        </ul>
        {compact
          ? <button type="button" onClick={() => go("verdicts")} className="mt-4 text-[15px] font-medium text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">{t("wkc.scoreboard")}</button>
          : <p className="mt-4 text-[13.5px] leading-relaxed text-ink-3">{t("wkc.howFills")}</p>}
      </div>
    </Reveal>
  );
}
