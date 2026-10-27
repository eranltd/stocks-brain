import { daysBetween } from "../lib/stats.js";
import { ArrowRight, CheckIcon, Chip, Panel, StepMark } from "./ui.jsx";
import dict from "../text/plan.js";
import { strings } from "../lib/text.js";
import { fmtNum, fmtPct } from "../lib/format.js";

// Every text here is in text/plan.js ("trust.*").
const words = strings(dict);
/** Each trust stage's name, money line and blurb. */
export const STAGES = [0, 1, 2, 3].map((id) => ({
  id, name: words(`trust.stage.${id}.name`), money: words(`trust.stage.${id}.money`), blurb: words(`trust.stage.${id}.blurb`),
}));

/**
 * Trust stage for the thing that would move money: portfolio rule v1. Evidence (all computed by code):
 * the forward paper record (data/portfolio/paper.json), the ~9-year rule test (longrun.json) and the
 * base rates of the setup gate (derived.json). Samples never count. Thresholds: settings.trust.
 */
export function trustStage(data) {
  const t = data.settings.trust;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  const lr = data.longrun && !data.longrun.sample ? data.longrun : null;
  const gate = data.livePrices ? data.market.base_rates?.gate : null;
  const days = paper ? daysBetween(paper.started, paper.as_of) : 0;
  const last = paper?.track.at(-1);
  const vsCore = last ? last.v - last.core_v : null;
  const ruleVsAll = lr ? lr.stats.rule.cagr_pct - lr.stats.equal_weight.cagr_pct : null;

  const small = [
    { ok: days >= t.paper_min_days_small, text: words("trust.need.paperDays", { days, need: t.paper_min_days_small }) },
    { ok: vsCore != null && vsCore > 0, text: vsCore == null ? words("trust.need.vsCoreNone") : words("trust.need.vsCore", { since: paper.started, pct: fmtPct(vsCore, 1) }) },
    { ok: ruleVsAll != null && ruleVsAll > 0, text: ruleVsAll == null ? words("trust.need.ruleNone") : words(ruleVsAll > 0 ? "trust.need.ruleBeat" : "trust.need.ruleTrail", { years: fmtNum(lr.years, 1), pts: fmtNum(Math.abs(ruleVsAll), 1) }) },
    { ok: Boolean(gate && gate.pass.ci_low > 0), text: gate ? words("trust.need.gate", { bench: data.bench.symbol, mean: fmtPct(gate.pass.mean ?? 0, 2), lo: fmtPct(gate.pass.ci_low ?? 0, 2) }) : words("trust.need.gateNone") },
  ];
  const trusted = [
    { ok: days >= t.paper_min_days_trusted, text: words("trust.need.paperDays", { days, need: t.paper_min_days_trusted }) },
    { ok: vsCore != null && vsCore > 0, text: words("trust.need.ahead") },
  ];
  let stage = paper ? 1 : 0;
  if (stage === 1 && small.every((c) => c.ok)) stage = 2;
  if (stage === 2 && trusted.every((c) => c.ok)) stage = 3;
  const need = [[{ ok: false, text: words("trust.need.start") }], small, trusted, []][stage];
  return { stage, need, days, vsCore, small };
}

/**
 * The trust ladder in the kit's look: the current stage as a panel title, what the next stage needs as a checklist,
 * and the four stages as tiles (done ticked green, the current one lit orange, the later ones dim). `compact` drops the
 * door to this site's rules.
 */
export function TrustLadder({ data, go, compact = false }) {
  const t = strings(dict);
  const { stage, need } = trustStage(data);
  const cur = STAGES[stage];
  return (
    <Panel id="trust" eyebrow={t("trust.eyebrow")} title={t("trust.title", { stage, name: cur.name })} infoLabel={t("trust.about")}
      info={<span className="grid gap-2"><span>{cur.blurb}</span><span>{t("trust.tail")}</span></span>}
      badge={<Chip tone={stage >= 2 ? "up" : "neutral"}>{cur.money}</Chip>}>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {STAGES.map((s) => {
          const done = s.id < stage, on = s.id === stage;
          return (
            <li key={s.id} aria-current={on ? "step" : undefined}
              className={`relative min-w-0 overflow-hidden rounded-tile border px-3 pt-3 pb-2.5 ${on ? "glow-brand border-desk bg-desk/10" : done ? "border-up/40 bg-up/[0.06]" : "border-dashed border-line-2 opacity-70"}`}>
              {on && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-desk" />}
              <span className="flex items-center justify-between gap-2">
                <span className={`font-num text-[11px] font-bold ${on ? "text-desk" : "text-ink-3"}`}>{t("trust.level", { n: s.id })}</span>
                {done && <span className="text-up"><CheckIcon className="size-3.5" /></span>}
                {on && <span className="micro text-desk">{t("trust.here")}</span>}
              </span>
              <span className={`headline mt-2 block text-[20px] leading-none ${on ? "text-ink" : done ? "text-ink" : "text-ink-2"}`}>{s.name}</span>
              <span className="mt-1.5 block text-[11.5px] leading-snug text-ink-3">{s.money}</span>
            </li>
          );
        })}
      </ol>
      {need.length > 0 && (
        <div className="mt-4">
          <p className="micro mb-2 text-ink-2">{t("trust.toReach", { name: STAGES[stage + 1].name })}</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {need.map((n) => (
              <li key={n.text} className="flex items-start gap-2.5 rounded-[8px] border border-line bg-surface-2/60 px-2.5 py-2 text-[13px] leading-snug">
                <span className="pt-0.5"><StepMark state={n.ok ? "done" : "wait"} label={t(n.ok ? "trust.met" : "trust.notYet")} /></span>
                <span className={n.ok ? "text-ink" : "text-ink-2"}>{n.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && (
        <button type="button" onClick={() => go("admin")}
          className="group mt-4 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-tile border border-line-2 px-3.5 text-start transition-colors hover:border-line-3 sm:w-auto sm:min-w-[320px]">
          <span className="headline text-[15px] tracking-[0.1em] text-ink">{t("trust.rules")}</span>
          <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </Panel>
  );
}
