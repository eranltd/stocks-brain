import { todayISO } from "../lib/outlook.js";
import { dayNumber, holeQuestion, HOLES, nextFor, stockOfDay, targetOf, totalMinutes } from "../lib/explore.js";
import { verdictHistory } from "../lib/verdict.js";
import { weeklyBuyDay } from "../lib/weekly.js";
import { ArrowRight, Reveal } from "./ui.jsx";
import { En, useLang } from "../lib/lang.jsx";
import { localeOf } from "../lib/i18n.js";
import shellText from "../i18n/shell.js";

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

// The weekday's name ("Friday" / "יום שישי"), read as a UTC calendar day like every market day on the site.
const dayShort = (iso, lang) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "he" ? localeOf(lang) : "en-US", { weekday: "long", timeZone: "UTC" });

/**
 * The two-minute read at the top of Home: the brain's answer, this week's action and the market, one line each,
 * then a clear "that is all you need today" so a busy reader can leave informed.
 */
export function QuickRead({ data, market, go }) {
  const { lang, he, t: tr } = useLang();
  const t = tr(shellText);
  const today = todayISO();
  const v = data.sample ? null : verdictHistory(data.runs, { today })[0];
  const buy = weeklyBuyDay(today, data.buyWindow, data.sample);
  // The brain's headline is the brain's own words (English for now): kept left to right, with the one-line note in Hebrew.
  const brain = v
    ? (he ? <><En as="span" className="block">{v.headline}</En><span className="mt-0.5 block text-[13.5px] text-ink-3">{t("englishNote")}</span></> : v.headline)
    : t("explore.quickNoAnswer");
  const rows = [
    { id: "brain", k: t("explore.quickBrain"), t: brain, to: "verdicts" },
    { id: "plan", k: t("explore.quickPlan"), t: buy === today ? t("explore.quickBuyToday") : t("explore.quickBuyOn", { day: dayShort(buy, lang) }), to: "verdicts#money-action" },
    ...(market ? [{ id: "market", k: t("explore.quickMarket"), t: market, to: "details" }] : []),
  ];
  return (
    <Reveal as="section" aria-labelledby="quick-read" className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
        <h2 id="quick-read" className="text-[15px] font-semibold uppercase tracking-[0.12em] text-accent">{t("explore.quickTitle")}</h2>
        <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-[13px] text-ink-3">{t("explore.minutes", { n: 2 })}</span>
      </div>
      <ol className="divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button type="button" onClick={() => openAt(go, r.to)} className="flex w-full items-start gap-3 px-5 py-4 text-start transition-colors hover:bg-surface-2 sm:px-6">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-[14px] font-bold text-accent">{i + 1}</span>
              <span className="min-w-0">
                <span className="meta block normal-case tracking-[0.04em]">{r.k}</span>
                <span className="mt-0.5 block text-[17px] leading-snug text-ink">{r.t}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="border-t border-line px-5 py-3 text-[15px] text-ink-2 sm:px-6">{t("explore.quickDone")} <span className="text-ink-3">{t("explore.quickMore")}</span></p>
    </Reveal>
  );
}

function HoleCard({ hole, stock, go, big = false }) {
  const { lang, t: tr } = useLang();
  const t = tr(shellText);
  const to = targetOf(hole, stock);
  if (!to) return null;
  return (
    <button type="button" onClick={() => openAt(go, to)}
      className={`group flex h-full w-full flex-col justify-between gap-3 rounded-2xl border border-line-2 bg-surface p-4 text-start transition hover:-translate-y-0.5 hover:border-ink-3 motion-reduce:transform-none ${big ? "sm:p-5" : ""}`}>
      <span className={`block font-semibold leading-snug text-ink ${big ? "text-[18px]" : "text-[16.5px]"}`}>{holeQuestion(hole, lang)}</span>
      <span className="flex items-center justify-between text-[14px] text-ink-3">
        <span>{t("explore.minutes", { n: hole.minutes })}</span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
      </span>
    </button>
  );
}

/** The rabbit holes on Home: every question the site can answer, with reading times, for whoever has time. */
export function RabbitHoles({ data, go }) {
  const t = useLang().t(shellText);
  const stock = stockOfDay(data);
  return (
    <Reveal as="section" aria-labelledby="rabbit-holes">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 id="rabbit-holes" className="text-[clamp(24px,6.4vw,30px)] leading-tight font-bold tracking-[-0.02em] text-ink">{t("explore.holesTitle")}</h2>
        <span className="text-[15px] text-ink-3">{t("explore.holesTotal", { n: totalMinutes() })}</span>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {HOLES.map((h) => <li key={h.id}><HoleCard hole={h} stock={stock} go={go} big /></li>)}
      </ul>
    </Reveal>
  );
}

/** At the end of every page: three next questions, none from this page, changing day by day. */
export function KeepExploring({ data, route, go }) {
  const t = useLang().t(shellText);
  const stock = stockOfDay(data);
  const next = nextFor(route, dayNumber(todayISO())).filter((h) => targetOf(h, stock));
  if (!next.length) return null;
  return (
    <section aria-labelledby="keep-exploring" className="mx-auto w-full max-w-[1040px] px-4 pb-28 pt-12">
      <h2 id="keep-exploring" className="text-[20px] font-bold tracking-[-0.01em] text-ink">{t("explore.keepTitle")}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {next.map((h) => <li key={h.id}><HoleCard hole={h} stock={stock} go={go} /></li>)}
      </ul>
    </section>
  );
}
