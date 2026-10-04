import { daysBetween } from "../lib/stats.js";
import { fmtNum, fmtPct } from "../lib/format.js";
import { Accent, ArrowRight, Reveal } from "./ui.jsx";

export const STAGES = [
  { id: 0, name: "Observe", money: "No money moves", blurb: "The rule is not on record yet. Read and learn." },
  { id: 1, name: "Paper", money: "No money moves", blurb: "The rule holds a paper portfolio, recorded forward and never edited." },
  { id: 2, name: "Small money", money: "Small satellite positions", blurb: "The paper record and the history both cleared the bar. Act within the house limits." },
  { id: 3, name: "Trusted", money: "Satellite within limits", blurb: "A full year of forward record, still ahead of the core." },
];

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
    { ok: days >= t.paper_min_days_small, text: `Paper record: ${days} of ${t.paper_min_days_small} days` },
    { ok: vsCore != null && vsCore > 0, text: vsCore == null ? "Paper portfolio ahead of the core (not measured yet)" : `Paper portfolio vs the core since ${paper.started}: ${fmtPct(vsCore, 1)} (need above 0)` },
    { ok: ruleVsAll != null && ruleVsAll > 0, text: ruleVsAll == null ? "Rule beats holding every name (history not computed yet)" : `Over ${fmtNum(lr.years, 1)} years the rule ${ruleVsAll > 0 ? "beat" : "trailed"} holding every name by ${fmtNum(Math.abs(ruleVsAll), 1)} pts a year` },
    { ok: Boolean(gate && gate.pass.ci_low > 0), text: gate ? `Names passing the gate beat ${data.bench.symbol}: ${fmtPct(gate.pass.mean ?? 0, 2)} per 20 days, 90% range from ${fmtPct(gate.pass.ci_low ?? 0, 2)} (need above 0)` : "Setup-gate base rates (not computed yet)" },
  ];
  const trusted = [
    { ok: days >= t.paper_min_days_trusted, text: `Paper record: ${days} of ${t.paper_min_days_trusted} days` },
    { ok: vsCore != null && vsCore > 0, text: "Still ahead of the core" },
  ];
  let stage = paper ? 1 : 0;
  if (stage === 1 && small.every((c) => c.ok)) stage = 2;
  if (stage === 2 && trusted.every((c) => c.ok)) stage = 3;
  const need = [[{ ok: false, text: "The paper portfolio starts with the next daily run" }], small, trusted, []][stage];
  return { stage, need, days, vsCore, small };
}

export function TrustLadder({ data, go, compact = false }) {
  const { stage, need } = trustStage(data);
  const cur = STAGES[stage];
  return (
    <Reveal className="card brackets overflow-hidden">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <div className="eyebrow mb-4">Can we trust it yet?</div>
          <h3 className="display text-[clamp(30px,4vw,48px)]">Stage {stage}: <Accent>{cur.name}.</Accent></h3>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
            {cur.blurb} <span className="text-ink">{cur.money}.</span> Trust is earned by the record, never by the story, and the site steps back down if the numbers slip.
          </p>
          {need.length > 0 && (
            <div className="mt-5">
              <div className="meta mb-2">To reach {STAGES[stage + 1].name}</div>
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
            <button type="button" onClick={() => go("admin")} className="btn mt-6 px-5 py-3 text-[14px]">Read the house rules <ArrowRight /></button>
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
                {on && <span className="meta ml-auto text-accent">you are here</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </Reveal>
  );
}
