import { todayISO } from "../lib/outlook.js";
import { gameRow, historyWords, nextBuyDay, scoreLine, WEEKLY_RULES } from "../lib/weekly.js";
import { betRecord, scoreBets } from "../lib/bets.js";
import { Reveal } from "./ui.jsx";

const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;

/** The brain's weekly bet: its three best and three worst names, scored every week against luck (lib/bets.js). */
function BrainBet({ data, go, compact }) {
  const scored = data.sample ? [] : scoreBets(data.runs, data.market, data.bench?.symbol);
  const now = scored[0];
  const rec = betRecord(scored);
  const chips = (xs, tone) => xs.map((t) => (
    <button key={t} type="button" onClick={() => go(`stock/${t}`)} className="rounded-full border px-3 py-1 text-[14.5px] font-medium text-ink hover:border-ink-3" style={{ borderColor: tone }}>{data.names?.[t] ?? t}</button>
  ));
  return (
    <li className="rounded-2xl border border-line-2 p-4">
      <p className="text-[18px] font-bold tracking-[-0.01em] text-ink">The brain's bet</p>
      {!compact && <p className="mt-0.5 text-[14.5px] text-ink-3">Each week the brain must take sides: the three names it expects to do best and the three it expects to do worst. It wins the week if its best three beat its worst three.</p>}
      {now ? (
        <>
          <p className="mt-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-accent">Best three</p>
          <div className="mt-1.5 flex flex-wrap gap-2">{chips(now.best, "var(--accent)")}</div>
          <p className="mt-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-down">Worst three</p>
          <div className="mt-1.5 flex flex-wrap gap-2">{chips(now.worst, "var(--down)")}</div>
          {!compact && now.why && <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{now.why}</p>}
          {now.spread !== null && <p className="mt-3 text-[15.5px] leading-relaxed text-ink">So far this week: best three {signed(now.spread)} points against the worst three.</p>}
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink">{rec.line}</p>
          {!compact && scored.filter((b) => !b.open && b.won !== null).length > 0 && (
            <ul className="mt-3 grid gap-1">
              {scored.filter((b) => !b.open && b.won !== null).slice(0, 8).map((b) => (
                <li key={b.date} className="text-[14.5px] text-ink-2"><span className={b.won ? "text-accent" : "text-down"}>{b.won ? "Won" : "Lost"}</span> the week of {dayLong(b.date)}: {signed(b.spread)} points</li>
              ))}
            </ul>
          )}
        </>
      ) : <p className="mt-3 text-[15.5px] leading-relaxed text-ink">The first bet comes with the brain's next run. Then it is scored every week.</p>}
    </li>
  );
}

const dayLong = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * "This week": the household acts weekly. Real money: the weekly buy of the whole-market fund. Pretend money: the
 * weekly game, two weekly rules recorded forward and checked against random picks. Nothing here is a reason to trade
 * real money in single stocks; that waits until a rule passes history and its paper record.
 */
export function WeeklyGame({ data, go, compact = false }) {
  const today = todayISO();
  const buy = nextBuyDay(today);
  const ledger = data.ledger && !data.ledger.sample ? data.ledger : null;
  return (
    <Reveal as="section" id="this-week" className="card scroll-mt-28 overflow-hidden">
      <div className="h-1.5" style={{ background: "var(--people)" }} />
      <div className="p-6 sm:p-8">
        <h2 className="text-[15px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--people)" }}>This week</h2>

        <div className="mt-4 rounded-2xl border border-line-2 p-4">
          <p className="meta normal-case tracking-[0.04em] text-accent">Real money</p>
          <p className="mt-1 text-[19px] font-semibold leading-snug text-ink">{buy === today ? "Today" : dayLong(buy)}: your weekly buy.</p>
          <p className="mt-1 text-[16px] leading-relaxed text-ink-2">{compact ? "The same amount into the whole-market fund, whatever the news." : "Put this week's amount into the whole-market fund, the same amount every week, whatever the news. Long-term money only. In our test on past prices, buying weekly did a little better than monthly, as long as the broker's fee per order is tiny."}</p>
        </div>

        <p className="mt-6 meta normal-case tracking-[0.04em]" style={{ color: "var(--people)" }}>Pretend money: the weekly game</p>
        {!compact && <p className="mt-1 text-[15.5px] leading-relaxed text-ink-2">The brain's own weekly bet and two weekly trading rules play on paper. Every week they pick their names; every week we see whether they beat luck and the whole market. Real money joins only if one beats plain luck, first on past prices and then for months on paper.</p>}
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
                    )) : <span className="text-[15px] text-ink-2">This week it holds only the whole-market fund: nothing passed its checks.</span>}
                  </div>
                ) : null}
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink">{scoreLine(row)}</p>
                {!compact && <p className={`mt-1 text-[14.5px] leading-relaxed ${hist.tested && !hist.passed ? "text-down" : "text-ink-3"}`}>{hist.line}</p>}
              </li>
            );
          })}
        </ul>
        {compact
          ? <button type="button" onClick={() => go("verdicts")} className="mt-4 text-[15px] font-medium text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">The full scoreboard and how the game works</button>
          : <p className="mt-4 text-[13.5px] leading-relaxed text-ink-3">Prices arrive once a day after the close, so the game decides on the first trading day of each week and fills at the next close. General guidance from evidence, not personal financial advice.</p>}
      </div>
    </Reveal>
  );
}
