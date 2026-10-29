import { useMemo } from "react";
import { todayISO } from "../lib/outlook.js";
import { gameRow, historyWords, scoreLine, weeklyBuyDay, WEEKLY_RULES } from "../lib/weekly.js";
import { MIN_WEEKS, betRecord, move, scoreBets, seriesOf } from "../lib/bets.js";
import { fmtDate } from "../lib/format.js";
import { Chip, Delta, EmptyState, InfoTip, Panel, SimBadge, Stamp, StatTile } from "./ui.jsx";
import home from "../text/home.js";
import plan from "../text/plan.js";
import { strings } from "../lib/text.js";

// The weekly pieces of the Brain page. Texts: text/plan.js ("wb.*", "wg.*") and the older card words in text/home.js
// ("wkc.*"). Percent moves only (from the published indexed series), never a price.

/** "+1.4": points, sign first, a true minus; "0.0" when it rounds to zero. */
const signed = (v) => {
  const r = Math.abs(v).toFixed(1);
  return `${Number(r) === 0 ? "" : v > 0 ? "+" : "−"}${r}`;
};
/** "Mon, 26 Oct": a day without its year. */
const noYear = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "–");
/** "26 Oct". */
const dayMonth = (iso) => noYear(iso).replace(/^\w+,\s/, "");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const TONE_TEXT = { up: "text-up", down: "text-down", flat: "text-ink-2" };
const toneOf = (v) => (!isNum(v) || Math.abs(v) < 0.05 ? "flat" : v > 0 ? "up" : "down");

/** A name chip that opens the stock: a 44px tap target around a compact chip. */
function NameChip({ ticker, name, go, tone = "neutral" }) {
  return (
    <button type="button" onClick={() => go(`stock/${ticker}`)} title={name} className="group grid min-h-[44px] place-items-center">
      <Chip tone={tone} className="font-num text-[11.5px] group-hover:border-line-3">{ticker}</Chip>
    </button>
  );
}

/** One side of the weekly bet: its three names, each with its move since the bet was placed. */
function Side({ kind, names, moves, label, go }) {
  const up = kind === "best";
  return (
    <div className={`min-w-0 overflow-hidden rounded-tile border ${up ? "border-up/35 bg-up/[0.05]" : "border-down/35 bg-down/[0.05]"}`}>
      <p className={`headline flex items-center gap-1.5 border-b px-2.5 py-2 text-[14px] tracking-[0.1em] sm:px-3 sm:text-[15px] ${up ? "border-up/25 text-up" : "border-down/25 text-down"}`}>
        <svg viewBox="0 0 10 10" className={`size-2 ${up ? "" : "rotate-180"}`} aria-hidden="true"><path d="M5 1.5 9 8.5H1Z" fill="currentColor" /></svg>
        {label}
      </p>
      <ul className="divide-y divide-line">
        {names.map((x, i) => (
          <li key={x}>
            <button type="button" onClick={() => go(`stock/${x}`)} className="flex min-h-[44px] w-full items-center justify-between gap-2 px-2.5 text-start transition-colors hover:bg-surface-2 sm:px-3">
              <span className="font-num text-[14px] font-bold text-ink">{x}</span>
              <Delta value={moves[i]} d={1} className="text-[12.5px]" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The brain's weekly bet (lib/bets.js): the three names it expects to do best against the three it expects to do worst,
 * each week, scored against luck. A face-off, the week so far, and its record against a coin.
 */
export function BrainBet({ data, go, className = "" }) {
  const t = strings(plan);
  const h = strings(home);
  const scored = useMemo(() => (data.sample ? [] : scoreBets(data.runs, data.market, data.bench?.symbol)), [data]);
  const series = useMemo(() => seriesOf(data.market), [data.market]);
  const now = scored[0];
  const rec = betRecord(scored);
  const done = scored.filter((b) => !b.open && b.won !== null);
  const movesOf = (xs) => xs.map((x) => (now?.end ? move(series, x, now.date, now.end) : null));
  const few = rec.n < MIN_WEEKS;
  return (
    <Panel id="weekly-bet" className={`scroll-mt-28 ${className}`} title={t("wb.title")} sub={now ? t("wb.sub", { day: dayMonth(now.date) }) : t("wb.subNone")}
      badge={<SimBadge short />} infoLabel={t("wb.about")}
      info={<span className="grid gap-2"><span>{h("wkc.betHow")}</span>{now?.why && <span className="text-ink-3">{now.why}</span>}<span>{rec.line}</span></span>}>
      {now ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
            <Side kind="best" names={now.best} moves={movesOf(now.best)} label={h("wkc.best")} go={go} />
            <span className="grid size-10 place-items-center rounded-full border border-desk/50 bg-desk/10 font-display text-[15px] font-extrabold tracking-[0.08em] text-desk uppercase shadow-[0_0_18px_-6px_var(--desk-glow)]">{t("wb.vs")}</span>
            <Side kind="worst" names={now.worst} moves={movesOf(now.worst)} label={h("wkc.worst")} go={go} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <StatTile label={t(now.open ? "wb.week" : "wb.lastWeek")} value={isNum(now.spread) ? <span className={TONE_TEXT[toneOf(now.spread)]}>{signed(now.spread)}</span> : "–"}
              unit={isNum(now.spread) ? t("wb.pts") : undefined} sub={t("wb.weekSub")} />
            <StatTile label={t("wb.record")} value={`${rec.won}–${rec.n - rec.won}`} sub={t("wb.recordSub")}
              bars={done.length ? [...done].reverse().map((b) => b.spread) : undefined} barsHi={-1} />
            <StatTile label={t("wb.coin")} value={rec.n ? rec.odds : "–"} unit={rec.n ? "%" : undefined}
              sub={few ? t("wb.coinEarly", { n: rec.n, min: MIN_WEEKS }) : t(rec.odds <= 5 ? "wb.coinSkill" : "wb.coinLuck")} />
          </div>
          {done.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("wb.past")}>
              {done.slice(0, 8).map((b) => (
                <li key={b.date}>
                  <Chip tone={b.won ? "up" : "down"} title={h("wkc.weekOf", { day: noYear(b.date), spread: signed(b.spread) })}>
                    {h(b.won ? "wkc.won" : "wkc.lost")}<span className="text-ink-2">{dayMonth(b.date)}</span>{signed(b.spread)}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : <EmptyState compact title={t("wb.firstTitle")}>{h("wkc.firstBet")}</EmptyState>}
    </Panel>
  );
}

/** One weekly rule of the game: this week's names, weeks played, how far ahead of the market, and its history test. */
function RuleTile({ r, data, go }) {
  const t = strings(plan);
  const ledger = data.ledger && !data.ledger.sample ? data.ledger : null;
  const row = gameRow(ledger, r.id, data.names);
  const hist = historyWords(data.rulesResult, r.id);
  const ahead = row && isNum(row.ahead) && row.weeks >= 2 ? row.ahead : null;
  const stats = [
    [t("wg.week"), row ? row.weeks : "–", "", null],
    [t("wg.vsMarket"), ahead != null ? signed(ahead) : "–", ahead != null ? TONE_TEXT[toneOf(ahead)] : "", ahead != null ? t("wb.pts") : null],
    [t("wg.vsRandom"), hist.tested ? hist.percentile : "–", hist.tested && !hist.passed ? "text-down" : hist.passed ? "text-up" : "", hist.tested ? "/100" : null],
  ];
  return (
    <div className="tile relative flex min-w-0 flex-col p-3 sm:p-4">
      <div className="flex items-start gap-1 pe-[92px]">
        <p className="headline min-w-0 pt-2.5 text-[19px] leading-none text-ink">{r.name}</p>
        <InfoTip label={t("wg.ruleAbout", { name: r.name })} align="start">
          <span className="grid gap-1.5"><span>{r.what}</span><span>{scoreLine(row)}</span><span>{hist.line}</span></span>
        </InfoTip>
      </div>
      {hist.tested && <Stamp kind={hist.passed ? "approved" : "rejected"} size="sm" className="pointer-events-none absolute end-3 top-4" />}
      <div className="mt-2 flex min-h-[44px] flex-wrap items-center gap-x-1.5">
        {row ? (row.holdings.length ? row.holdings.map((x) => <NameChip key={x.ticker} ticker={x.ticker} name={x.name} go={go} />)
          : <span className="micro">{t("wg.coreOnly")}</span>)
          : <span className="micro">{t("wg.start")}</span>}
      </div>
      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3">
        {stats.map(([k, v, tone, unit]) => (
          <div key={k} className="min-w-0">
            <dt className="micro truncate">{k}</dt>
            <dd className={`font-num mt-1 text-[19px] leading-none font-bold ${tone || "text-ink"}`}>{v}{unit && <span className="ms-0.5 text-[11px] font-semibold text-ink-3">{unit}</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * "This week": the plan acts weekly. Real money: the weekly buy of the whole-market fund. Pretend money: the weekly
 * game, two weekly rules recorded forward and checked against random picks. Nothing here is a reason to trade real
 * money in single stocks; that waits until a rule passes history and its paper record.
 */
export function WeeklyGame({ data, go, compact = false, className = "" }) {
  const t = strings(plan);
  const h = strings(home);
  const today = todayISO();
  const buy = weeklyBuyDay(today, data.buyWindow, data.sample);
  const isToday = buy === today;
  return (
    <Panel id="this-week" className={`scroll-mt-28 ${className}`} title={h("wkc.title")} sub={t("wg.sub")} info={h("wkc.howFills")} infoLabel={t("wg.about")}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="relative flex min-w-0 flex-col overflow-hidden rounded-tile border border-up/40 bg-up/[0.06] p-4">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-up" />
          <div className="flex items-center justify-between gap-2">
            <p className="kicker text-up">{h("wkc.real")}</p>
            <InfoTip label={t("wg.realAbout")}>{h("wkc.buyLong")}</InfoTip>
          </div>
          <p className="headline mt-1 text-[clamp(34px,9vw,46px)] leading-none text-ink">{isToday ? h("wkc.today") : noYear(buy)}</p>
          <p className="micro mt-2 text-ink-2">{t("wg.buyLabel")}</p>
          <p className="mt-3 text-[13.5px] leading-snug text-ink-2">{h("wkc.buyShort")}</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="kicker">{t("wg.paperKicker")}</p>
            <InfoTip label={t("wg.paperAbout")} align="start">{h("wkc.pretendHow")}</InfoTip>
          </div>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            {WEEKLY_RULES.map((r) => <RuleTile key={r.id} r={r} data={data} go={go} />)}
          </div>
        </div>
      </div>
      {compact && (
        <button type="button" onClick={() => go("verdicts")} className="mt-3 inline-flex min-h-[44px] items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.1em] text-desk uppercase hover:text-ink">
          {h("wkc.scoreboard")} <span aria-hidden="true">→</span>
        </button>
      )}
    </Panel>
  );
}
