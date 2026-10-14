import { useEffect, useState } from "react";
import { fmtDate, fmtPct } from "../lib/format.js";
import { baseRateLine, edgeWords, fillNote, forwardWords, LEAN_TONE, riskPlan, rowFor, stepRows, VERDICT } from "../lib/checklist.js";
import { ArrowRight, Reveal, Segmented } from "./ui.jsx";
import { CandlesView, useStoredChoice } from "./candles.jsx";

/** The card's two views, remembered per device: the eight checks in words, or the same reading on candles. */
export const CHECKLIST_VIEW_KEY = "sb:checklist-view";
export const CHECKLIST_VIEWS = ["checks", "candles"];
// A view asked for by another page before it opens a Stock page (the home's "See the candles"): taken once, on mount.
let pendingView = null;
export function requestChecklistView(v) {
  if (CHECKLIST_VIEWS.includes(v)) pendingView = v;
}
export function useChecklistView() {
  const [view, setView] = useStoredChoice(CHECKLIST_VIEW_KEY, "candles", CHECKLIST_VIEWS);
  // Read during render, so the page and its card (both mount in one pass) each see the request.
  const [asked] = useState(() => pendingView);
  useEffect(() => {
    if (!asked) return;
    pendingView = null;
    setView(asked);
  }, [asked, setView]);
  return [view, setView];
}

const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink-2" };
const TONE_BG = { accent: "bg-accent", down: "bg-down", flat: "bg-flat" };
const LEAN_LABEL = { bullish: "leans up", bearish: "leans down", neutral: "no lean" };
const VERDICTS = ["lean_up", "mixed", "lean_down"];

/** "lean up" / "mixed" / "lean down" as a small pill; a dashed "–" when there is no reading. */
export function VerdictPill({ verdict, className = "" }) {
  const v = VERDICT[verdict];
  if (!v) return <span className={`pill border-dashed py-0.5 text-[10.5px] text-ink-3 ${className}`} title="Chart checklist: appears after the next daily update">–</span>;
  const cls = { accent: "border-accent/30 bg-accent/12 text-accent", down: "border-down/30 bg-down/12 text-down", flat: "border-line-2 text-ink-2" }[v.tone];
  return (
    <span className={`pill py-0.5 text-[10.5px] ${cls} ${className}`} title="What the chart checklist says (unproven)">
      <span aria-hidden="true" className="text-[8px]">{v.tone === "accent" ? "▲" : v.tone === "down" ? "▼" : "◆"}</span>
      {v.short}
    </span>
  );
}

const Dot = ({ lean }) => <span className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${TONE_BG[LEAN_TONE[lean] ?? "flat"]}`} aria-hidden="true" />;

/** The steps with their Hebrew names, as the video lists them. */
export function StepNames({ cfg }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {(cfg?.steps ?? []).map((s) => (
        <li key={s.id} className="flex items-baseline gap-2 text-[14.5px]">
          <span className="num w-5 shrink-0 font-mono text-[12px] text-ink-3">{s.n}</span>
          <span className="text-ink">{s.name}</span>
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
      <caption className="mb-2 text-left text-[12.5px] leading-relaxed text-ink-3">Looking back: after each reading, how much better or worse than the whole market (the {benchLabel}) the stock did over the next {br.horizon_days} trading days on average, how often it did better, and how many times we saw it. The past is a hint, not a promise.</caption>
      <thead className="meta normal-case tracking-[0.04em]"><tr className="border-b border-line"><th className="py-2 font-normal">Reading</th><th className="py-2 pl-2 text-right font-normal">Average</th><th className="hidden py-2 pl-2 text-right font-normal sm:table-cell">Likely range</th><th className="py-2 pl-2 text-right font-normal">Did better</th><th className="py-2 pl-2 text-right font-normal">Times</th></tr></thead>
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
  if (!rp) return <p className="text-[13.5px] text-ink-3">No safety plan: not enough data.</p>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <PlanCell k="Safety exit (stop-loss)" v={`−${rp.stop.pct.toFixed(1)}%`} sub={rp.stop.basis} tone="text-down" />
        <PlanCell k="Win vs lose (reward-to-risk)" v={`${Number(rp.rr1).toFixed(1)} · ${Number(rp.rr2).toFixed(1)}`} sub="to target 1 · to target 2" />
        <PlanCell k="Target 1 (TP1)" v={`+${rp.tp1.pct.toFixed(1)}%`} sub={rp.tp1.byConstruction ? `${rp.tp1.basis.split(":")[0]}: nothing overhead` : rp.tp1.basis} tone="text-accent" />
        <PlanCell k="Target 2 (TP2)" v={`+${rp.tp2.pct.toFixed(1)}%`} sub={rp.tp2.basis} tone="text-accent" />
      </div>
      <p className={`mt-2.5 flex items-start gap-2 text-[13.5px] leading-relaxed ${rp.fits ? "text-ink" : "text-ink-2"}`}>
        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${rp.fits ? "bg-accent/15 text-accent" : "bg-people/15 text-people"}`} aria-hidden="true">{rp.fits ? "✓" : "–"}</span>
        <span>
          Fits the house rule (you might win at least {rp.min} times what you might lose, up to target 1): <b className="font-semibold">{rp.fits ? "yes" : "no"}</b>.
          {rp.tp1.byConstruction && " There was no ceiling (resistance) above it in the past year, so target 1 was simply set at twice the possible loss. It fits by arithmetic, not because the stock is likely to get there."}
        </span>
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">Pretend money only: a written plan for a make-believe purchase at the last closing price, made before any pretend entry. On a normal day it moves about {rp.atr.toFixed(1)}% (its ATR).</p>
    </div>
  );
}

/**
 * The Stock page card: eight rows, the verdict, the paper risk plan, and an honest footer; or, in the Candles view, the
 * same day's reading drawn on the symbol's candles. The page passes `view`/`onView` so the brief can open it on candles.
 */
export function ChecklistCard({ data, symbol, go, view: viewProp, onView }) {
  const [ownView, setOwnView] = useChecklistView();
  const view = viewProp ?? ownView;
  const setView = onView ?? setOwnView;
  const cfg = data.checklistCfg;
  const ck = data.checklist;
  const row = rowFor(ck, symbol);
  const head = (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Chart checklist</h3>
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
          {ck ? `No checklist for ${symbol}${skipped?.reason ? `: ${skipped.reason}` : ": not enough price history"}.` : "Appears after the next daily update."} In simple words: eight things a trading video says to look at on a stock's chart. A program reads them from each day's closing prices. It is unproven: we use it to learn, not to decide. The eight steps:
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
  const switcher = (
    <div className="mt-4">
      <Segmented label="Checklist view" value={view} onChange={setView} options={[{ value: "candles", label: "Candles" }, { value: "checks", label: "Checks" }]} />
    </div>
  );
  if (view === "candles") {
    return (
      <Reveal id="checklist" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
        {head}
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">In simple words: the same eight steps, drawn on the chart up to {fmtDate(row.as_of)}. Each candle is one day. It describes what happened, like a diary, not a forecast. Unproven: we use it to learn, not to decide.</p>
        {switcher}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-line py-2.5">
          <span className="meta">What it says · seven steps</span>
          <span className={`text-[17px] font-semibold tracking-[-0.01em] ${TONE_TEXT[v.tone]}`}>{v.word}</span>
          <span className="num font-mono text-[13px] text-ink-2">score {row.score.net > 0 ? "+" : ""}{row.score.net} of 7</span>
        </div>
        <div className="mt-4"><CandlesView data={data} symbol={symbol} row={row} cfg={cfg} /></div>
      </Reveal>
    );
  }
  return (
    <Reveal id="checklist" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      {head}
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">In simple words: eight things a trading video says to look at on a stock's chart, read by a program from each day's closing prices up to {fmtDate(row.as_of)}. Seven of them say "up", "down" or "no lean"; the eighth is a safety plan. It describes the chart, like a weather report of the past weeks, not a forecast. Unproven: we use it to learn, not to decide.</p>
      {switcher}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line-2 bg-surface-2 p-4">
        <div className="min-w-0">
          <div className="meta mb-1">What it says · seven steps</div>
          <div className={`display text-[clamp(30px,7vw,40px)] ${TONE_TEXT[v.tone]}`}>{v.word}</div>
        </div>
        <div className="text-left text-[13px] text-ink-2 sm:text-right">
          <div className="num font-mono text-[15px] text-ink">score {row.score.net > 0 ? "+" : ""}{row.score.net} of 7</div>
          <div>{row.score.bullish} lean up · {row.score.bearish} lean down · {row.score.neutral} no lean</div>
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
                  <span className="text-[15px] font-semibold"><span className="num mr-1.5 font-mono text-[12px] font-normal text-ink-3">{s.n}</span>{s.id === "risk_plan" ? "Safety plan (pretend money)" : s.name}</span>
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
          <div className="meta mb-2 normal-case tracking-[0.04em]">What changed since the day before</div>
          <ul className="flex flex-wrap gap-1.5">
            {row.changes.map((c) => <li key={c.text} className={`rounded-full border border-line px-2.5 py-1 text-[12px] ${TONE_TEXT[LEAN_TONE[c.tone]]}`}>{c.text}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-people/40 p-4 text-[13.5px] leading-relaxed text-ink-2">
        <div className="meta mb-2 text-people">Is it any good? Unproven.</div>
        {line ? <p>Looking back at our history, {line.charAt(0).toLowerCase() + line.slice(1)}</p> : <p>Its history appears after the next daily update.</p>}
        {edge && <p className="mt-2">{edge}</p>}
        {br?.note && <p className="mt-2 text-ink-3">{fillNote(br.note, br)}</p>}
        <p className="mt-2">{forwardWords(ck.forward)}</p>
        <p className="mt-2">Our real money follows the Brain's verdicts page, usually one fund that holds the whole market. The house rules (Before acting, step 1) say no buying on a hunch, from a video or anywhere else. We only watch and learn: this checklist is read before a pretend entry, and is never a reason for one.</p>
        <p className="mt-2 text-ink-3">We only have one candle per day, not minute-by-minute. Distances are shown as percent from the last close, never as prices.</p>
        <button type="button" onClick={() => go("playbook")} className="meta mt-3 inline-flex min-h-[40px] items-center gap-1 normal-case tracking-[0.04em] hover:text-ink">How each step works <ArrowRight className="size-3.5" /></button>
      </div>
    </Reveal>
  );
}
