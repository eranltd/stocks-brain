import { useMemo } from "react";
import { summarize } from "../lib/data.js";
import { fmtNum, fmtPct } from "../lib/format.js";
import { todayISO } from "../lib/outlook.js";
import { ledgerStats, paperBets, stepTrack, sureLevels } from "../lib/ledger.js";
import { useInView } from "../lib/motion.js";
import { ExcessChart } from "../components/charts.jsx";
import { BetLedger, BrainKpis, StepTrack, SureChart } from "../components/ledger.jsx";
import { Chip, Container, Conviction, HeroTitle, InfoTip, Panel, SimBadge, StatTile } from "../components/ui.jsx";
import { TrustLadder } from "../components/trust.jsx";
import dict from "../text/plan.js";
import { strings } from "../lib/text.js";

// The brain's score: every daily call is checked against the whole market a fixed number of market days later, by plain
// code. Numbers first (a KPI row that counts up), then hits minus misses over time, whether "very sure" means right, each
// checked call against the market, and every call in one ledger. Every text here is in text/plan.js ("tr.*", "lg.*").

const CAL_TONE = { informative: "up", not_informative: "down", insufficient_data: "wait" };

/** Hits, flats and misses as one bar in three parts, with their counts. */
function Split({ s }) {
  const t = strings(dict);
  const [ref, inView] = useInView();
  const parts = [
    { k: "hit", v: s.hits, c: "bg-up" },
    { k: "flat", v: s.flats, c: "bg-ink-3" },
    { k: "miss", v: s.misses, c: "bg-down" },
  ];
  return (
    <div ref={ref}>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-[4px] bg-surface-3">
        {s.n > 0 && parts.map((p, i) => (
          <i key={p.k} className={`block h-full ${p.c} transition-[width] duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)]`}
            style={{ width: inView ? `${(p.v / s.n) * 100}%` : 0, transitionDelay: `${200 + i * 120}ms` }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {parts.map((p) => (
          <li key={p.k}><Chip tone={p.k === "hit" ? "up" : p.k === "miss" ? "down" : "neutral"} check={p.k === "hit"}>{t(`tr.${p.k}`)}<span className="text-ink">{p.v}</span></Chip></li>
        ))}
      </ul>
    </div>
  );
}

export default function TrackRecord({ data, go }) {
  const t = strings(dict);
  const { outcomes, settings, bench, calibration } = data;
  const days = settings.scoring.horizon_days;
  const today = todayISO();
  const book = useMemo(() => {
    const items = paperBets({ kb: data.kb, horizon: days });
    return { items, s: ledgerStats(items, today), points: stepTrack(items, today) };
  }, [data.kb, days, today]);
  const sum = summarize(outcomes);
  const levels = sureLevels(outcomes, calibration);
  const verdict = calibration?.conviction_verdict ?? "insufficient_data";
  const groups = ["bullish", "bearish", "neutral"].flatMap((st) =>
    ["high", "medium", "low"].map((cv) => ({ st, cv, ...summarize(outcomes.filter((o) => o.stance === st && o.conviction === cv)) })),
  ).filter((g) => g.n);

  return (
    <Container className="pb-24">
      <div className="grid gap-5 sm:gap-6">
        <div className="grid gap-5">
          <HeroTitle line1={t("tr.hero1")} line2={t("tr.hero2")} sub={t("tr.heroSub", { days, bench: bench.symbol })} />
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="neutral"><span className="text-ink-3">{t("tr.vs")}</span><span className="text-ink">{bench.symbol}</span></Chip>
            <Chip tone="neutral"><span className="text-ink-3">{t("tr.after")}</span><span className="text-ink">{t("tr.afterDays", { days })}</span></Chip>
            <SimBadge />
            <InfoTip label={t("tr.about")} align="start">{t("tr.lede", { bench: bench.label, days, band: `${settings.scoring.flat_band_pct}%` })}</InfoTip>
          </div>
          {data.sample && (
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <Chip tone="people" className="border-dashed">{t("tr.samplePill")}</Chip>{t("tr.sample")}
            </p>
          )}
        </div>

        <BrainKpis s={book.s} weekly={false} />

        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Panel id="track-line" title={t("tr.stepTitle")} sub={t("lg.track.sub")} info={t("lg.track.info")} infoLabel={t("lg.track.about")}>
            {book.points.length > 1 ? <StepTrack points={book.points} height={168} /> : null}
            <div className="mt-4"><Split s={sum} /></div>
            {sum.n > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <StatTile label={t("tr.avg")} value={<span className={sum.avgExcess >= 0 ? "text-up" : "text-down"}>{fmtPct(sum.avgExcess, 1)}</span>} sub={t("tr.avgSub")} />
                <StatTile label={t("tr.best")} value={<span className="text-up">{fmtPct(sum.best.excess_pct, 1)}</span>} sub={sum.best.ticker} />
                <StatTile label={t("tr.worst")} value={<span className="text-down">{fmtPct(sum.worst.excess_pct, 1)}</span>} sub={sum.worst.ticker} />
              </div>
            )}
          </Panel>

          <Panel id="sure" title={t("tr.calTitle")} sub={t("tr.calSub")} badge={<Chip tone={CAL_TONE[verdict] ?? "neutral"}>{t(`lg.cal.v.${verdict}`)}</Chip>}
            info={t.has(`tr.calib.${verdict}`) ? t(`tr.calib.${verdict}`, { min: calibration?.min_n ?? 10 }) : null} infoLabel={t("tr.calib.title")}>
            <SureChart levels={levels} />
            {groups.length > 0 && (
              <>
                <p className="micro mt-5 mb-2">{t("tr.byDir")}</p>
                <ul className="grid gap-1.5">
                  {groups.map((g) => (
                    <li key={g.st + g.cv} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[8px] border border-line bg-surface-2/60 px-2.5 py-1.5 text-[13px]">
                      <span className="flex items-center gap-2"><Chip kind={g.st} className="py-0.5 text-[10.5px]" /><Conviction level={g.cv} showLabel={false} /></span>
                      <span className="font-num text-ink-3">{g.n}×</span>
                      <span className="font-num w-12 text-end font-bold text-ink">{fmtNum(g.hitRate, 0)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>

        {sum.n > 0 && (
          <Panel id="each-call" title={t("tr.excessTitle")} sub={t("tr.excessSub", { bench: bench.symbol })}
            badge={<span className="hidden items-center gap-1.5 sm:flex">
              <Chip tone="up">{t("tr.hit")}</Chip><Chip tone="neutral">{t("tr.flat")}</Chip><Chip tone="down">{t("tr.miss")}</Chip>
            </span>}>
            <ExcessChart outcomes={outcomes} />
          </Panel>
        )}

        <Panel id="calls" title={t("tr.ledgerTitle")} sub={t("tr.ledgerSub", { days })} badge={<SimBadge short />} info={t("lg.aboutInfo")} infoLabel={t("lg.about")}>
          <BetLedger items={book.items} go={go} switchable={false} detail caption={t("tr.ledgerTitle")} />
        </Panel>

        <TrustLadder data={data} go={go} compact />
      </div>
    </Container>
  );
}
