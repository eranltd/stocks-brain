import { summarize } from "../lib/data.js";
import { fmtNum, fmtPct } from "../lib/format.js";
import { Accent, ArrowRight, Reveal } from "./ui.jsx";

export const STAGES = [
  { id: 0, name: "Observe", money: "No money moves", blurb: "The brain is not making real calls yet. Read and learn." },
  { id: 1, name: "Paper", money: "No money moves", blurb: "Real calls are made and scored by code, as if invested." },
  { id: 2, name: "Small money", money: "Small satellite positions", blurb: "The record has cleared the bar. Act within the house limits." },
  { id: 3, name: "Trusted", money: "Satellite within limits", blurb: "A longer record, and conviction has proven meaningful." },
];

/** Current trust stage from REAL outcomes only (samples never count). Thresholds: settings.trust. */
export function trustStage(data) {
  const t = data.settings.trust;
  const live = !data.sample;
  const realPicks = live ? data.kb.length : 0;
  const s = summarize(live ? data.outcomes : []);
  const calib = live ? data.calibration?.conviction_verdict : null;
  const metricsOk = s.n > 0 && s.hitRate >= t.min_hit_rate_pct && s.avgExcess >= t.min_avg_excess_pct;
  let stage = 0;
  if (realPicks > 0) stage = 1;
  if (stage === 1 && s.n >= t.paper_min_scored && metricsOk) stage = 2;
  if (stage === 2 && s.n >= t.small_min_scored && calib === "informative") stage = 3;
  const need = [
    ["The brain makes real, scored calls (milestone M3)"],
    [`${s.n}/${t.paper_min_scored} scored picks`, `hit rate ${fmtNum(s.hitRate, 0)}% (need ${t.min_hit_rate_pct}%)`, `average excess ${fmtPct(s.avgExcess, 1)} (need ${fmtPct(t.min_avg_excess_pct, 1)})`],
    [`${s.n}/${t.small_min_scored} scored picks`, `conviction ${calib ? calib.replaceAll("_", " ") : "not measured"} (need informative)`],
    [],
  ][stage];
  return { stage, s, need, realPicks };
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
            {cur.blurb} <span className="text-ink">{cur.money}.</span> Trust is earned by the scored record, never by the story, and the site steps back down if the numbers slip.
          </p>
          {need.length > 0 && (
            <div className="mt-5">
              <div className="meta mb-2">To reach {STAGES[stage + 1].name}</div>
              <ul className="grid gap-1.5 text-[14.5px]">
                {need.map((n) => <li key={n} className="flex gap-2"><span className="text-people">○</span>{n}</li>)}
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
