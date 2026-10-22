import { useEffect, useState } from "react";
import { baseRateLine, edgeWords, fillNote, forwardWords, LEAN_TONE, riskPlan, rowFor, stepRows, VERDICT } from "../lib/checklist.js";
import dict from "../text/stock.js";
import { ArrowRight, Reveal, Segmented } from "./ui.jsx";
import { CandlesView, useStoredChoice } from "./candles.jsx";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";
import { fmtDate, fmtPct } from "../lib/format.js";

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

const Dot = ({ lean }) => <span className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${TONE_BG[LEAN_TONE[lean] ?? "flat"]}`} aria-hidden="true" />;

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
    <div className="min-w-0 rounded-2xl border border-line px-3 py-2.5">
      <div className="meta normal-case tracking-[0.04em]">{k}</div>
      <div className={`num mt-0.5 font-mono text-[17px] ${tone}`}>{v}</div>
      {sub && <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{sub}</div>}
    </div>
  );
}

/** Step 8: the written risk plan (paper only), with whether it meets this site's rule. */
function RiskPlan({ rp }) {
  const t = strings(dict);
  if (!rp) return <p className="text-[13.5px] text-ink-3">{t("ckc.risk.none")}</p>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <PlanCell k={t("ckc.risk.stop")} v={fmtPct(-rp.stop.pct, 1)} sub={rp.stop.basis} tone="text-down" />
        <PlanCell k={t("ckc.risk.rr")} v={`${Number(rp.rr1).toFixed(1)} · ${Number(rp.rr2).toFixed(1)}`} sub={t("ckc.risk.rrSub")} />
        <PlanCell k={t("ckc.risk.tp1")} v={fmtPct(rp.tp1.pct, 1)} sub={rp.tp1.short ?? rp.tp1.basis} tone="text-accent" />
        <PlanCell k={t("ckc.risk.tp2")} v={fmtPct(rp.tp2.pct, 1)} sub={rp.tp2.basis} tone="text-accent" />
      </div>
      <p className={`mt-2.5 flex items-start gap-2 text-[13.5px] leading-relaxed ${rp.fits ? "text-ink" : "text-ink-2"}`}>
        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${rp.fits ? "bg-accent/15 text-accent" : "bg-people/15 text-people"}`} aria-hidden="true">{rp.fits ? "✓" : "–"}</span>
        <span>
          {rich(t, "ckc.risk.fits", { min: rp.min, answer: <b className="font-semibold">{t(rp.fits ? "ckc.yes" : "ckc.no")}</b> })}
          {rp.tp1.byConstruction && ` ${t("ckc.risk.byConstruction")}`}
        </span>
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{t("ckc.risk.paper", { atr: `${rp.atr.toFixed(1)}%` })}</p>
    </div>
  );
}

/**
 * The Stock page card: eight rows, the verdict, the paper risk plan, and an honest footer; or, in the Candles view, the
 * same day's reading drawn on the symbol's candles. The page passes `view`/`onView` so the brief can open it on candles.
 */
export function ChecklistCard({ data, symbol, go, view: viewProp, onView }) {
  const t = strings(dict);
  const [ownView, setOwnView] = useChecklistView();
  const view = viewProp ?? ownView;
  const setView = onView ?? setOwnView;
  const cfg = data.checklistCfg;
  const ck = data.checklist;
  const row = rowFor(ck, symbol);
  const status = ck?.status ?? cfg?.status ?? "unproven";
  const head = (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t("ckc.title")}</h3>
      <span className="flex flex-wrap gap-1.5">
        {ck?.sample && <span className="pill border-dashed border-people/60 py-0.5 text-[10.5px] text-people">{t("ckc.samplePrices")}</span>}
        <span className="pill border-dashed border-people/60 py-0.5 text-[10.5px] text-people">{t.has(`ckc.status.${status}`) ? t(`ckc.status.${status}`) : status}</span>
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
          {!ck ? t("ckc.empty.later") : skipped?.reason ? t("ckc.empty.reason", { symbol, reason: skipped.reason }) : t("ckc.empty.history", { symbol })} {t("ckc.empty.what")}
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
  const net = `${row.score.net > 0 ? "+" : ""}${row.score.net}`;
  const switcher = (
    <div className="mt-4">
      <Segmented label={t("ckc.view.label")} value={view} onChange={setView} options={[{ value: "candles", label: t("ckc.view.candles") }, { value: "checks", label: t("ckc.view.checks") }]} />
    </div>
  );
  if (view === "candles") {
    return (
      <Reveal id="checklist" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
        {head}
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{t("ckc.candles.lede", { date: fmtDate(row.as_of) })}</p>
        {switcher}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-line py-2.5">
          <span className="meta">{t("ckc.says")}</span>
          <span className={`text-[17px] font-semibold tracking-[-0.01em] ${TONE_TEXT[v.tone]}`}>{v.word}</span>
          <span className="num font-mono text-[13px] text-ink-2">{t("ckc.score", { net })}</span>
        </div>
        <div className="mt-4"><CandlesView data={data} symbol={symbol} row={row} cfg={cfg} /></div>
      </Reveal>
    );
  }
  return (
    <Reveal id="checklist" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      {head}
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{t("ckc.checks.lede", { date: fmtDate(row.as_of) })}</p>
      {switcher}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line-2 bg-surface-2 p-4">
        <div className="min-w-0">
          <div className="meta mb-1">{t("ckc.says")}</div>
          <div className={`display text-[clamp(30px,7vw,40px)] ${TONE_TEXT[v.tone]}`}>{v.word}</div>
        </div>
        <div className="text-start text-[13px] text-ink-2 sm:text-end">
          <div className="num font-mono text-[15px] text-ink">{t("ckc.score", { net })}</div>
          <div>{t("ckc.counts", { up: row.score.bullish, down: row.score.bearish, none: row.score.neutral })}</div>
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
                  <span className="text-[15px] font-semibold"><span className="num me-1.5 font-mono text-[12px] font-normal text-ink-3">{s.n}</span>{s.id === "risk_plan" ? t("ckc.safetyPlan") : s.name}</span>
                  {s.lean && <span className={`meta normal-case tracking-[0.04em] ${TONE_TEXT[LEAN_TONE[s.lean]]}`}>{t(LEAN_KEY[s.lean] ?? "ckc.lean.none")}</span>}
                </div>
                {s.id === "risk_plan" ? <div className="mt-2"><RiskPlan rp={rp} /></div> : <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{s.text}</p>}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {row.changes?.length > 0 && (
        <div className="mt-4">
          <div className="meta mb-2 normal-case tracking-[0.04em]">{t("ckc.changes")}</div>
          {/* The changes are written by the daily run (scripts/market.py checklist_changes). */}
          <ul className="flex flex-wrap gap-1.5">
            {row.changes.map((c) => <li key={c.text} className={`rounded-full border border-line px-2.5 py-1 text-[12px] ${TONE_TEXT[LEAN_TONE[c.tone]]}`}>{c.text}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-people/40 p-4 text-[13.5px] leading-relaxed text-ink-2">
        <div className="meta mb-2 text-people">{t("ckc.good.title")}</div>
        {line ? <p>{t("ckc.good.lookBack", { line: line.charAt(0).toLowerCase() + line.slice(1) })}</p> : <p>{t("ckc.good.later")}</p>}
        {edge && <p className="mt-2">{edge}</p>}
        {br?.note && <p className="mt-2 text-ink-3">{fillNote(br.note, br)}</p>}
        <p className="mt-2">{forwardWords(ck.forward)}</p>
        <p className="mt-2">{t("ckc.good.realMoney")}</p>
        <p className="mt-2 text-ink-3">{t("ckc.good.daily")}</p>
        <button type="button" onClick={() => go("playbook")} className="meta mt-3 inline-flex min-h-[40px] items-center gap-1 normal-case tracking-[0.04em] hover:text-ink">{t("ckc.good.how")} <ArrowRight className="size-3.5" /></button>
      </div>
    </Reveal>
  );
}
