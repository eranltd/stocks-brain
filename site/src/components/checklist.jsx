import { useEffect, useState } from "react";
import { baseRateLine, edgeWords, fillNote, forwardWords, LEAN_TONE, riskPlan, rowFor, stepRows, VERDICT } from "../lib/checklist.js";
import dict from "../text/stock.js";
import { ArrowRight, Chip, StepMark } from "./ui.jsx";
import { useStoredChoice } from "./candles.jsx";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";
import { fmtPct } from "../lib/format.js";

/** The chart panel's two remembered views (per device): the eight checks in numbers, or the same reading on candles. */
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

const TONE_TEXT = { accent: "text-up", down: "text-down", flat: "text-ink-2" };
const LEAN_KEY = { bullish: "ckc.lean.up", bearish: "ckc.lean.down", neutral: "ckc.lean.none" };
const VERDICTS = ["lean_up", "mixed", "lean_down"];

/** "lean up" / "mixed" / "lean down" as a small pill; a dashed "–" when there is no reading. */
export function VerdictPill({ verdict, className = "" }) {
  const t = strings(dict);
  const v = VERDICT[verdict];
  if (!v) return <span className={`pill border-dashed py-0.5 text-[10.5px] text-ink-3 ${className}`} title={t("ckc.pill.none")}>–</span>;
  const cls = { accent: "border-accent/30 bg-accent/12 text-accent", down: "border-down/30 bg-down/12 text-down", flat: "border-line-2 text-ink-2" }[v.tone];
  return (
    <span className={`pill py-0.5 text-[10.5px] ${cls} ${className}`} title={t("ckc.pill.title")}>
      <span aria-hidden="true" className="text-[8px]">{v.tone === "accent" ? "▲" : v.tone === "down" ? "▼" : "◆"}</span>
      {v.short}
    </span>
  );
}

/** The steps with their names, as the video lists them. */
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
  const t = strings(dict);
  if (!br) return null;
  const rows = [...VERDICTS.map((v) => ({ key: v, label: VERDICT[v].word, r: br.by_verdict?.find((x) => x.verdict === v) })), { key: "all", label: t("ckc.br.all"), r: br.all }];
  return (
    <table className="w-full text-start text-[13.5px]">
      <caption className="mb-2 text-start text-[12.5px] leading-relaxed text-ink-3">{t("ckc.br.caption", { bench: benchLabel, days: br.horizon_days })}</caption>
      <thead className="meta normal-case tracking-[0.04em]"><tr className="border-b border-line"><th className="py-2 font-normal">{t("ckc.br.reading")}</th><th className="py-2 ps-2 text-end font-normal">{t("ckc.br.average")}</th><th className="hidden py-2 ps-2 text-end font-normal sm:table-cell">{t("ckc.br.range")}</th><th className="py-2 ps-2 text-end font-normal">{t("ckc.br.better")}</th><th className="py-2 ps-2 text-end font-normal">{t("ckc.br.times")}</th></tr></thead>
      <tbody>
        {rows.map(({ key, label, r }) => (
          <tr key={key} className={`border-b border-line last:border-0 ${key === highlight ? "bg-surface-2" : ""}`}>
            <td className={`whitespace-nowrap py-2 pe-2 ${key === "all" ? "text-ink-2" : "text-ink"}`}>{label}{key === highlight ? <span className="text-ink-3">{t("ckc.br.now")}</span> : null}</td>
            <td className={`num py-2 ps-2 text-end font-mono ${r?.mean == null ? "text-ink-3" : r.mean >= 0 ? "text-accent" : "text-down"}`}>{r?.mean == null ? "–" : fmtPct(r.mean, 1)}</td>
            <td className="num hidden py-2 ps-2 text-end font-mono text-ink-3 sm:table-cell">{r?.ci_low == null ? "–" : t("ckc.br.rangeValue", { lo: fmtPct(r.ci_low, 1), hi: fmtPct(r.ci_high, 1) })}</td>
            <td className="num py-2 ps-2 text-end font-mono text-ink-2">{r?.hit_pct == null ? "–" : <span>{`${Math.round(r.hit_pct)}%`}</span>}</td>
            <td className="num py-2 ps-2 text-end font-mono text-ink-3">{r?.n ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlanCell({ k, v, sub, tone = "" }) {
  return (
    <div className="tile min-w-0 px-3 py-2">
      <div className="micro truncate">{k}</div>
      <div className={`font-num mt-1 text-[17px] leading-none font-bold ${tone}`}>{v}</div>
      {sub && <div className="mt-1 truncate text-[11.5px] leading-snug text-ink-3" title={sub}>{sub}</div>}
    </div>
  );
}

/** Step 8: the written risk plan (paper only), with whether it meets this site's rule. */
function RiskPlan({ rp }) {
  const t = strings(dict);
  if (!rp) return <p className="text-[13.5px] text-ink-3">{t("ckc.risk.none")}</p>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <PlanCell k={t("ckc.risk.stop")} v={fmtPct(-rp.stop.pct, 1)} sub={rp.stop.basis} tone="text-down" />
        <PlanCell k={t("ckc.risk.tp1")} v={fmtPct(rp.tp1.pct, 1)} sub={rp.tp1.short ?? rp.tp1.basis} tone="text-up" />
        <PlanCell k={t("ckc.risk.tp2")} v={fmtPct(rp.tp2.pct, 1)} sub={rp.tp2.basis} tone="text-up" />
        <PlanCell k={t("ckc.risk.rr")} v={`${Number(rp.rr1).toFixed(1)} · ${Number(rp.rr2).toFixed(1)}`} sub={t("ckc.risk.rrSub")} />
      </div>
      <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-ink-2">
        <StepMark state={rp.fits ? "done" : "wait"} className="mt-0.5 size-3.5" />
        <span>{rich(t, "ckc.risk.fits", { min: rp.min, answer: <b className="font-semibold text-ink">{t(rp.fits ? "ckc.yes" : "ckc.no")}</b> })}</span>
      </p>
    </div>
  );
}

const MARK_OF = { bullish: "done", bearish: "fail", neutral: "idle" };

/**
 * The Checks view of the Stock page's chart panel: the day's reading of the eight steps in numbers, the risk plan, what
 * changed since the day before and, folded away, how good the checklist has been. The page's panel gives the frame.
 */
export function ChecksView({ data, symbol, go }) {
  const t = strings(dict);
  const cfg = data.checklistCfg;
  const ck = data.checklist;
  const row = rowFor(ck, symbol);
  if (!cfg) return null;
  if (!ck || !row) {
    const skipped = ck?.skipped?.find((s) => (s.symbol ?? s) === symbol);
    return (
      <div>
        <p className="max-w-[62ch] text-[14px] leading-snug text-ink-2">
          {!ck ? t("ckc.empty.later") : skipped?.reason ? t("ckc.empty.reason", { symbol, reason: skipped.reason }) : t("ckc.empty.history", { symbol })}
        </p>
        <div className="mt-3"><StepNames cfg={cfg} /></div>
      </div>
    );
  }
  const rows = stepRows(row, cfg);
  const v = VERDICT[row.score.verdict] ?? VERDICT.mixed;
  const rp = riskPlan(row.risk_plan, cfg);
  const br = ck.base_rates;
  const line = baseRateLine(br, row.score.verdict, data.bench.label);
  const edge = edgeWords(br);
  const net = `${row.score.net > 0 ? "+" : row.score.net < 0 ? "−" : ""}${Math.abs(row.score.net)}`;
  return (
    <div>
      <div className="tile flex flex-wrap items-end justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <div className="micro flex flex-wrap items-center gap-2">{t("ckc.says")}{ck.sample && <Chip tone="people">{t("ckc.samplePrices")}</Chip>}</div>
          <div className={`headline mt-1 text-[clamp(28px,7vw,36px)] ${TONE_TEXT[v.tone]}`}>{v.word}</div>
        </div>
        <div className="text-start sm:text-end">
          <div className="font-num text-[15px] font-bold text-ink">{t("ckc.score", { net })}</div>
          <div className="font-num mt-1 flex flex-wrap gap-x-2.5 text-[11.5px] text-ink-3 sm:justify-end">
            <span className="text-up">▲ {row.score.bullish}</span><span className="text-down">▼ {row.score.bearish}</span><span>◆ {row.score.neutral}</span>
          </div>
        </div>
        {row.score.summary && <p className="w-full text-[13px] leading-snug text-ink-2">{row.score.summary}</p>}
      </div>

      <ol className="mt-2 divide-y divide-line">
        {rows.map((s) => (
          <li key={s.id} id={`checklist-${s.id}`} className="scroll-mt-32 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="font-num w-5 shrink-0 text-[10.5px] text-ink-3">{String(s.n).padStart(2, "0")}</span>
              {s.lean ? <StepMark state={MARK_OF[s.lean] ?? "idle"} label={t(LEAN_KEY[s.lean] ?? "ckc.lean.none")} className="size-3.5" /> : <span className="w-3.5" />}
              <span className="min-w-0 flex-1 font-display text-[15px] leading-tight font-bold tracking-[0.08em] text-ink uppercase">{s.id === "risk_plan" ? t("ckc.safetyPlan") : s.name}</span>
              {s.lean && <span className={`micro shrink-0 ${TONE_TEXT[LEAN_TONE[s.lean]]}`}>{t(LEAN_KEY[s.lean] ?? "ckc.lean.none")}</span>}
            </div>
            {s.id === "risk_plan" ? <div className="mt-2"><RiskPlan rp={rp} /></div> : <p className="font-num mt-1 ps-[50px] text-[12.5px] leading-snug text-ink-2">{s.text}</p>}
          </li>
        ))}
      </ol>

      {row.changes?.length > 0 && (
        <div className="mt-3">
          <div className="micro mb-1.5">{t("ckc.changes")}</div>
          {/* The changes are written by the daily run (scripts/market.py checklist_changes). */}
          <ul className="flex flex-wrap gap-1.5">
            {row.changes.map((c) => <li key={c.text} className={`chip border-line-2 normal-case tracking-normal ${TONE_TEXT[LEAN_TONE[c.tone]]}`}>{c.text}</li>)}
          </ul>
        </div>
      )}

      <details className="group mt-3 rounded-tile border border-line">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="size-[6px] rotate-45 bg-wait" />
          <span className="font-display text-[14px] font-bold tracking-[0.12em] text-ink uppercase">{t("ckc.good.title")}</span>
          <span aria-hidden="true" className="ms-auto text-ink-3 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="grid gap-2 border-t border-line px-3 py-3 text-[13px] leading-snug text-ink-2">
          {line ? <p>{t("ckc.good.lookBack", { line: line.charAt(0).toLowerCase() + line.slice(1) })}</p> : <p>{t("ckc.good.later")}</p>}
          {edge && <p>{edge}</p>}
          {br && <div className="thin-scroll overflow-x-auto"><BaseRates br={br} benchLabel={data.bench.label} highlight={row.score.verdict} /></div>}
          {br?.note && <p className="text-ink-3">{fillNote(br.note, br)}</p>}
          <p>{forwardWords(ck.forward)}</p>
          <p>{t("ckc.good.realMoney")}</p>
          <p className="text-ink-3">{t("ckc.good.daily")}</p>
          {go && (
            <button type="button" onClick={() => go("playbook")} className="micro inline-flex min-h-[44px] items-center gap-1 text-ink-2 hover:text-ink">
              {t("ckc.good.how")} <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
