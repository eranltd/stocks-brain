import { useMemo } from "react";
import { COMEBACK_MIN_DROP, raceSummary } from "../../lib/arena.js";
import { pctWords } from "../../lib/replay.js";
import { fmtDate, fmtPct } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { HeroTitle } from "../ui.jsx";

/*
 * The end-of-replay card, game style: a podium for the top three, then the year's records, all from lib/arena.js
 * raceSummary over the replayed window: the biggest comeback (the biggest climb from a low after a real drop), the
 * wildest single day, how often the lead changed hands, who led the most days, and how many beat the benchmark.
 */

const t = strings(dict);
const PODIUM = [1, 0, 2]; // second, first, third: the winner in the middle
const HEIGHT = ["h-[92px] sm:h-[120px]", "h-[64px] sm:h-[84px]", "h-[46px] sm:h-[60px]"];

function Record({ label, value, tone, sub, line, i }) {
  return (
    <div className="arena-record" style={{ "--d": `${180 + i * 70}ms` }}>
      <span className="micro">{label}</span>
      <span className={`mt-1.5 block font-num text-[22px] leading-none font-bold tracking-[-0.03em] sm:text-[26px] ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink"}`}>{value}</span>
      {sub && <span className="mt-1.5 block truncate font-display text-[15px] font-bold tracking-[0.06em] text-ink uppercase">{sub}</span>}
      {line && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{line}</span>}
    </div>
  );
}

export function Summary({ race, benchName }) {
  const s = useMemo(() => raceSummary(race), [race]);
  if (!s) return null;
  const tone = (v) => (v >= 0 ? "up" : "down");
  return (
    <section aria-labelledby="arena-sum-h" className="panel arena-summary mt-4 overflow-hidden p-4 sm:p-6">
      <HeroTitle as="h2" id="arena-sum-h" size="sm" eyebrow={t("arena.sum.kicker")} line1={t("arena.sum.title1")} line2={t("arena.sum.title2", { name: s.podium[0].symbol })} glow={false} />
      <ol className="mt-5 grid grid-cols-3 items-end gap-2 sm:gap-3">
        {PODIUM.map((idx, i) => {
          const p = s.podium[idx];
          if (!p) return <li key={idx} />;
          return (
            <li key={p.symbol} className="arena-podium" data-place={idx + 1} style={{ "--d": `${i * 90}ms` }}>
              <span className="block truncate font-display text-[20px] leading-none font-extrabold tracking-[0.04em] uppercase sm:text-[26px]">{p.symbol}</span>
              <span className="mt-0.5 block truncate text-[12px] text-ink-2">{p.name}</span>
              <span className={`mt-1 block font-num text-[14px] font-bold sm:text-[16px] ${tone(p.value) === "up" ? "text-up" : "text-down"}`}>{fmtPct(p.value, 1)}</span>
              <span className={`arena-step mt-2 ${HEIGHT[idx]}`}>
                <span className="font-display text-[22px] font-extrabold sm:text-[28px]">{t(`arena.sum.place.${idx + 1}`)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {s.comeback ? (
          <Record i={0} label={t("arena.sum.comeback")} value={fmtPct(s.comeback.rise, 1)} tone="up" sub={s.comeback.symbol}
            line={t("arena.sum.comebackLine", { drop: pctWords(s.comeback.drop), rise: pctWords(s.comeback.rise) })} />
        ) : (
          <Record i={0} label={t("arena.sum.comeback")} value="–" line={t("arena.sum.noComeback", { pct: `${COMEBACK_MIN_DROP}%` })} />
        )}
        {s.wildest && (
          <Record i={1} label={t("arena.sum.wildest")} value={fmtPct(s.wildest.move, 1)} tone={tone(s.wildest.move)} sub={s.wildest.symbol}
            line={t("arena.sum.wildestLine", { move: fmtPct(s.wildest.move, 1), date: fmtDate(s.wildest.date) })} />
        )}
        <Record i={2} label={t("arena.sum.changes")} value={String(s.changes)} line={t("arena.sum.changesLine", { count: s.changes })} />
        {s.top && <Record i={3} label={t("arena.sum.top")} value={String(s.top.days)} sub={s.top.symbol} line={t("arena.sum.topLine", { count: s.top.days })} />}
        {s.bench && (
          <Record i={4} label={t("arena.sum.bench")} value={`${s.bench.beat}/${s.names}`}
            line={t("arena.sum.benchLine", { bench: benchName, pct: fmtPct(s.bench.value, 1) })} />
        )}
      </div>
      <p className="mt-4 font-num text-[11px] tracking-[0.06em] text-ink-3 uppercase">{`${fmtDate(race.dates[0])} → ${fmtDate(race.dates.at(-1))}`}</p>
    </section>
  );
}
