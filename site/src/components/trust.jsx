import { daysBetween } from "../lib/stats.js";
import { Accent, ArrowRight, Reveal } from "./ui.jsx";
import dict from "../text/plan.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";
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

export function TrustLadder({ data, go, compact = false }) {
  const t = strings(dict);
  const { stage, need } = trustStage(data);
  const cur = STAGES[stage];
  return (
    <Reveal className="card brackets overflow-hidden">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <div className="eyebrow mb-4">{t("trust.eyebrow")}</div>
          <h3 className="display text-[clamp(30px,4vw,48px)]">{rich(t, "trust.title", { stage, name: <Accent>{cur.name}.</Accent> })}</h3>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
            {cur.blurb} <span className="text-ink">{cur.money}.</span> {t("trust.tail")}
          </p>
          {need.length > 0 && (
            <div className="mt-5">
              <div className="meta mb-2">{t("trust.toReach", { name: STAGES[stage + 1].name })}</div>
              <ul className="grid gap-2 text-[14.5px]">
                {need.map((n) => (
                  <li key={n.text} className="flex gap-2.5">
                    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${n.ok ? "bg-accent/15 text-accent" : "bg-people/15 text-people"}`}>{n.ok ? "✓" : "–"}</span>
                    <span className={n.ok ? "" : "text-ink-2"}>{n.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!compact && (
            <button type="button" onClick={() => go("admin")} className="btn mt-6 px-5 py-3 text-[14px]">{t("trust.rules")} <ArrowRight /></button>
          )}
        </div>
        <ol className="grid gap-2 self-center">
          {STAGES.map((s) => {
            const done = s.id < stage, on = s.id === stage;
            return (
              <li key={s.id} className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition ${on ? "border-accent/50 bg-accent/10" : "border-line"} ${s.id > stage ? "opacity-55" : ""}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-full border font-mono text-[13px] ${done ? "border-accent bg-accent text-bg" : on ? "border-accent text-accent" : "border-dashed border-line-2 text-ink-3"}`}>{done ? "✓" : s.id}</span>
                <div className="min-w-0">
                  <div className={`font-semibold ${on ? "text-accent" : ""}`}>{s.name}</div>
                  <div className="text-[13px] text-ink-3">{s.money}</div>
                </div>
                {on && <span className="meta ms-auto text-accent">{t("trust.here")}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </Reveal>
  );
}
