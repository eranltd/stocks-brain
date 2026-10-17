import { todayISO } from "../lib/outlook.js";
import { dayNumber, HOLES, nextFor, stockOfDay, targetOf, totalMinutes } from "../lib/explore.js";
import { verdictHistory } from "../lib/verdict.js";
import { weeklyBuyDay } from "../lib/weekly.js";
import { ArrowRight, Reveal } from "./ui.jsx";

/** Open a route and scroll to its "#section" once it has rendered. */
function openAt(go, to) {
  const [route, id] = to.split("#");
  go(route);
  if (!id) return;
  let tries = 0;
  const seek = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
    else if (++tries < 40) setTimeout(seek, 50);
  };
  setTimeout(seek, 50);
}

const dayShort = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/**
 * The two-minute read at the top of Home: the brain's answer, this week's action and the market, one line each,
 * then a clear "that is all you need today" so a busy reader can leave informed.
 */
export function QuickRead({ data, market, go }) {
  const today = todayISO();
  const v = data.sample ? null : verdictHistory(data.runs, { today })[0];
  const buy = weeklyBuyDay(today, data.buyWindow, data.sample);
  const rows = [
    { k: "The brain", t: v ? v.headline : "No real answer yet.", to: "verdicts" },
    { k: "Your money", t: `${buy === today ? "Today" : dayShort(buy)}: the weekly buy into the whole-market fund. Money you need soon stays safe.`, to: "verdicts#money-action" },
    ...(market ? [{ k: "The market", t: market, to: "details" }] : []),
  ];
  return (
    <Reveal as="section" aria-labelledby="quick-read" className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
        <h2 id="quick-read" className="text-[15px] font-semibold uppercase tracking-[0.12em] text-accent">The two-minute read</h2>
        <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-[13px] text-ink-3">2 min</span>
      </div>
      <ol className="divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.k}>
            <button type="button" onClick={() => openAt(go, r.to)} className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2 sm:px-6">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-[14px] font-bold text-accent">{i + 1}</span>
              <span className="min-w-0">
                <span className="meta block normal-case tracking-[0.04em]">{r.k}</span>
                <span className="mt-0.5 block text-[17px] leading-snug text-ink">{r.t}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="border-t border-line px-5 py-3 text-[15px] text-ink-2 sm:px-6">That is all you need today. <span className="text-ink-3">Curious? There is more below.</span></p>
    </Reveal>
  );
}

function HoleCard({ hole, stock, go, big = false }) {
  const to = targetOf(hole, stock);
  if (!to) return null;
  return (
    <button type="button" onClick={() => openAt(go, to)}
      className={`group flex h-full w-full flex-col justify-between gap-3 rounded-2xl border border-line-2 bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-ink-3 motion-reduce:transform-none ${big ? "sm:p-5" : ""}`}>
      <span className={`block font-semibold leading-snug text-ink ${big ? "text-[18px]" : "text-[16.5px]"}`}>{hole.q}</span>
      <span className="flex items-center justify-between text-[14px] text-ink-3">
        <span>{hole.minutes} min</span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

/** The rabbit holes on Home: every question the site can answer, with reading times, for whoever has time. */
export function RabbitHoles({ data, go }) {
  const stock = stockOfDay(data);
  return (
    <Reveal as="section" aria-labelledby="rabbit-holes">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 id="rabbit-holes" className="text-[clamp(24px,6.4vw,30px)] leading-tight font-bold tracking-[-0.02em] text-ink">Got more time? Go down a rabbit hole</h2>
        <span className="text-[15px] text-ink-3">about {totalMinutes()} minutes in all</span>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {HOLES.map((h) => <li key={h.id}><HoleCard hole={h} stock={stock} go={go} big /></li>)}
      </ul>
    </Reveal>
  );
}

/** At the end of every page: three next questions, none from this page, changing day by day. */
export function KeepExploring({ data, route, go }) {
  const stock = stockOfDay(data);
  const next = nextFor(route, dayNumber(todayISO())).filter((h) => targetOf(h, stock));
  if (!next.length) return null;
  return (
    <section aria-labelledby="keep-exploring" className="mx-auto w-full max-w-[1040px] px-4 pb-28 pt-12">
      <h2 id="keep-exploring" className="text-[20px] font-bold tracking-[-0.01em] text-ink">Keep exploring</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {next.map((h) => <li key={h.id}><HoleCard hole={h} stock={stock} go={go} /></li>)}
      </ul>
    </section>
  );
}
