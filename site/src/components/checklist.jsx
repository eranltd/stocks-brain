import { fmtDate, fmtPct } from "../lib/format.js";
import { baseRateLine, edgeWords, fillNote, forwardWords, LEAN_TONE, riskPlan, rowFor, stepRows, VERDICT } from "../lib/checklist.js";
import { ArrowRight, Reveal } from "./ui.jsx";

const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink-2" };
const TONE_BG = { accent: "bg-accent", down: "bg-down", flat: "bg-flat" };
const LEAN_LABEL = { bullish: "bullish", bearish: "bearish", neutral: "neutral" };
const VERDICTS = ["lean_up", "mixed", "lean_down"];

/** "lean up" / "mixed" / "lean down" as a small pill; a dashed "–" when there is no reading. */
export function VerdictPill({ verdict, className = "" }) {
  const v = VERDICT[verdict];
  if (!v) return <span className={`pill border-dashed py-0.5 text-[10.5px] text-ink-3 ${className}`} title="Technical checklist: appears after the next daily run">–</span>;
  const cls = { accent: "border-accent/30 bg-accent/12 text-accent", down: "border-down/30 bg-down/12 text-down", flat: "border-line-2 text-ink-2" }[v.tone];
  return (
    <span className={`pill py-0.5 text-[10.5px] ${cls} ${className}`} title="Technical checklist verdict (unproven)">
      <span aria-hidden="true" className="text-[8px]">{v.tone === "accent" ? "▲" : v.tone === "down" ? "▼" : "◆"}</span>
      {v.short}
    </span>
  );
}

const He = ({ children }) => (children ? <span lang="he" dir="rtl" className="text-[12px] text-ink-3">{children}</span> : null);
const Dot = ({ lean }) => <span className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${TONE_BG[LEAN_TONE[lean] ?? "flat"]}`} aria-hidden="true" />;

/** The steps with their Hebrew names, as the video lists them. */
export function StepNames({ cfg }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {(cfg?.steps ?? []).map((s) => (
        <li key={s.id} className="flex items-baseline gap-2 text-[14.5px]">
          <span className="num w-5 shrink-0 font-mono text-[12px] text-ink-3">{s.n}</span>
          <span className="text-ink">{s.name}</span> <He>{s.name_he}</He>
        </li>
      ))}
    </ol>
  );
}

/** Base rates by verdict, next to "every snapshot", in a table that fits a phone. */
export function BaseRates({ br, benchLabel, highlight }) {
  if (!br) return null;
  const rows = [...VERDICTS.map((v) => ({ key: v, label: VERDICT[v].word, r: br.by_verdict?.find((x) => x.verdict === v) })), { key: "all", label: "Every snapshot", r: br.all }];
  return (
    <table className="w-full text-left text-[13.5px]">
      <caption className="mb-2 text-left text-[12.5px] leading-relaxed text-ink-3">Average excess return over the {benchLabel} in the next {br.horizon_days} trading days, how often the name beat it, and how many cases.</caption>
      <thead className="meta normal-case tracking-[0.04em]"><tr className="border-b border-line"><th className="py-2 font-normal">Reading</th><th className="py-2 pl-2 text-right font-normal">Average</th><th className="hidden py-2 pl-2 text-right font-normal sm:table-cell">90% range</th><th className="py-2 pl-2 text-right font-normal">Beat</th><th className="py-2 pl-2 text-right font-normal">Cases</th></tr></thead>
      <tbody>
        {rows.map(({ key, label, r }) => (
          <tr key={key} className={`border-b border-line last:border-0 ${key === highlight ? "bg-surface-2" : ""}`}>
            <td className={`whitespace-nowrap py-2 pr-2 ${key === "all" ? "text-ink-2" : "text-ink"}`}>{label}{key === highlight ? <span className="text-ink-3"> · now</span> : null}</td>
            <td className={`num py-2 pl-2 text-right font-mono ${r?.mean == null ? "text-ink-3" : r.mean >= 0 ? "text-accent" : "text-down"}`}>{r?.mean == null ? "–" : fmtPct(r.mean, 1)}</td>
            <td className="num hidden py-2 pl-2 text-right font-mono text-ink-3 sm:table-cell">{r?.ci_low == null ? "–" : `${fmtPct(r.ci_low, 1)} to ${fmtPct(r.ci_high, 1)}`}</td>
            <td className="num py-2 pl-2 text-right font-mono text-ink-2">{r?.hit_pct == null ? "–" : `${Math.round(r.hit_pct)}%`}</td>
            <td className="num py-2 pl-2 text-right font-mono text-ink-3">{r?.n ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlanCell({ k, v, sub, tone = "" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line px-3 py-2.5">
      <div className="meta normal-case tracking-[0.04em]">{k}</div>
      <div className={`num mt-0.5 font-mono text-[17px] ${tone}`}>{v}</div>
      {sub && <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{sub}</div>}
    </div>
  );
}

/** Step 8: the written risk plan (paper only), with whether it meets the house rule. */
function RiskPlan({ rp }) {
  if (!rp) return <p className="text-[13.5px] text-ink-3">No risk plan: not enough data.</p>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <PlanCell k="Stop-loss" v={`−${rp.stop.pct.toFixed(1)}%`} sub={rp.stop.basis} tone="text-down" />
        <PlanCell k="Reward-to-risk" v={`${Number(rp.rr1).toFixed(1)} · ${Number(rp.rr2).toFixed(1)}`} sub="to TP1 · to TP2" />
        <PlanCell k="TP1" v={`+${rp.tp1.pct.toFixed(1)}%`} sub={rp.tp1.byConstruction ? `${rp.tp1.basis.split(":")[0]}: nothing overhead` : rp.tp1.basis} tone="text-accent" />
        <PlanCell k="TP2" v={`+${rp.tp2.pct.toFixed(1)}%`} sub={rp.tp2.basis} tone="text-accent" />
      </div>
      <p className={`mt-2.5 flex items-start gap-2 text-[13.5px] leading-relaxed ${rp.fits ? "text-ink" : "text-ink-2"}`}>
        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${rp.fits ? "bg-accent/15 text-accent" : "bg-people/15 text-people"}`} aria-hidden="true">{rp.fits ? "✓" : "–"}</span>
        <span>
          Fits the house rule ({rp.min} or more to TP1): <b className="font-semibold">{rp.fits ? "yes" : "no"}</b>.
          {rp.tp1.byConstruction && " No resistance overhead in the past year, so TP1 was set at twice the risk and fits by arithmetic, not because of any upside."}
        </span>
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">Paper only: a plan for a long entry at the last close, written before any paper entry. Its daily range (ATR) is {rp.atr.toFixed(1)}%.</p>
    </div>
  );
}

/** The Stock page card: eight rows, the verdict, the paper risk plan, and an honest footer. */
export function ChecklistCard({ data, symbol, go }) {
  const cfg = data.checklistCfg;
  const ck = data.checklist;
  const row = rowFor(ck, symbol);
  const head = (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Technical checklist</h3>
      <span className="flex flex-wrap gap-1.5">
        {ck?.sample && <span className="pill border-dashed border-people/60 py-0.5 text-[10.5px] text-people">sample prices</span>}
        <span className="pill border-dashed border-people/60 py-0.5 text-[10.5px] text-people">{ck?.status ?? cfg?.status ?? "unproven"}</span>
      </span>
    </div>
  );
  if (!cfg) return null;
  if (!ck || !row) {
    const skipped = ck?.skipped?.find((s) => (s.symbol ?? s) === symbol);
    return (
      <Reveal id="checklist" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
        {head}
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          {ck ? `No checklist for ${symbol}${skipped?.reason ? `: ${skipped.reason}` : ": not enough price history"}.` : "Appears after the next daily run."} Eight steps from a trading video the household liked, read by code from end-of-day bars:
        </p>
        <div className="mt-4"><StepNames cfg={cfg} /></div>
      </Reveal>
    );
  }
  const rows = stepRows(row, cfg);
  const v = VERDICT[row.score.verdict] ?? VERDICT.mixed;
  const rp = riskPlan(row.risk_plan, cfg);
  const br = ck.base_rates;
  const line = baseRateLine(br, row.score.verdict, data.bench.label);
  const edge = edgeWords(br);
  return (
    <Reveal id="checklist" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      {head}
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">Eight steps from a trading video the household liked, read by code from end-of-day bars to {fmtDate(row.as_of)}. A description of the chart, not a forecast.</p>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line-2 bg-surface-2 p-4">
        <div className="min-w-0">
          <div className="meta mb-1">Verdict · seven steps</div>
          <div className={`display text-[clamp(30px,7vw,40px)] ${TONE_TEXT[v.tone]}`}>{v.word}</div>
        </div>
        <div className="text-left text-[13px] text-ink-2 sm:text-right">
          <div className="num font-mono text-[15px] text-ink">net {row.score.net > 0 ? "+" : ""}{row.score.net} of 7</div>
          <div>{row.score.bullish} bullish · {row.score.bearish} bearish · {row.score.neutral} neutral</div>
        </div>
        {row.score.summary && <p className="w-full text-[14px] leading-relaxed text-ink-2">{row.score.summary}</p>}
      </div>

      <ol className="mt-5 grid gap-0">
        {rows.map((s) => (
          <li key={s.id} id={`checklist-${s.id}`} className="scroll-mt-28 border-t border-line py-3.5 first:border-0 first:pt-0">
            <div className="flex items-start gap-3">
              {s.lean ? <Dot lean={s.lean} /> : <span className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full border border-ink-3" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[15px] font-semibold"><span className="num mr-1.5 font-mono text-[12px] font-normal text-ink-3">{s.n}</span>{s.id === "risk_plan" ? "Risk plan (paper)" : s.name} <He>{s.name_he}</He></span>
                  {s.lean && <span className={`meta normal-case tracking-[0.04em] ${TONE_TEXT[LEAN_TONE[s.lean]]}`}>{LEAN_LABEL[s.lean]}</span>}
                </div>
                {s.id === "risk_plan" ? <div className="mt-2"><RiskPlan rp={rp} /></div> : <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{s.text}</p>}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {row.changes?.length > 0 && (
        <div className="mt-4">
          <div className="meta mb-2 normal-case tracking-[0.04em]">Since the close before</div>
          <ul className="flex flex-wrap gap-1.5">
            {row.changes.map((c) => <li key={c.text} className={`rounded-full border border-line px-2.5 py-1 text-[12px] ${TONE_TEXT[LEAN_TONE[c.tone]]}`}>{c.text}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-people/40 p-4 text-[13.5px] leading-relaxed text-ink-2">
        <div className="meta mb-2 text-people">Is it any good? Unproven.</div>
        {line ? <p>In our history, {line.charAt(0).toLowerCase() + line.slice(1)}</p> : <p>Its history appears after the next daily run.</p>}
        {edge && <p className="mt-2">{edge}</p>}
        {br?.note && <p className="mt-2 text-ink-3">{fillNote(br.note, br)}</p>}
        <p className="mt-2">{forwardWords(ck.forward)}</p>
        <p className="mt-2">The index core comes first, and the house rules (Before acting, step 1) still forbid discretionary adds, from a video or anywhere else: this checklist is read before a paper entry, never a reason for one.</p>
        <p className="mt-2 text-ink-3">5-minute candles: not available, daily data only. Distances are percent from the last close, never prices.</p>
        <button type="button" onClick={() => go("playbook")} className="meta mt-3 inline-flex min-h-[40px] items-center gap-1 normal-case tracking-[0.04em] hover:text-ink">How each step is computed <ArrowRight className="size-3.5" /></button>
      </div>
    </Reveal>
  );
}
