import { useMemo, useState } from "react";
import dict from "../text/learn.js";
import { Chip, Container, DataTable, EmptyState, Panel, Segmented, StatTile, StepMark } from "../components/ui.jsx";
import { PageHero, TipText } from "../lib/learnkit.jsx";
import { strings } from "../lib/text.js";
import { fmtShort, fmtUsd, fmtNum, fmtK } from "../lib/format.js";

/*
 * Runs: the brain's time sheet as an ops console. Headline tiles (cost, minutes, runs stopped safely), one bar chart
 * that switches between pack size against its cap, minutes and cost, and every run in a table. Tap a bar or a row to
 * read that morning's own plain summary (or why it stopped). Costs are the AI's running cost in dollars, not prices.
 */

const t = strings(dict);
const METRICS = ["pack", "minutes", "cost"];
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const packPct = (r) => (r.pack?.cap_tokens ? (r.pack.tokens / r.pack.cap_tokens) * 100 : null);

export default function Runs({ data }) {
  const { shownRuns: runs, settings } = data;
  const ok = runs.filter((r) => r.status === "ok");
  const total = runs.reduce((a, r) => a + r.cost.usd, 0);
  const avg = ok.length ? ok.reduce((a, r) => a + r.cost.usd, 0) / ok.length : 0;
  const mins = ok.length ? ok.reduce((a, r) => a + r.duration_minutes, 0) / ok.length : 0;
  const over = ok.filter((r) => r.cost.usd > settings.cost.warn_usd).length;
  const failed = runs.length - ok.length;
  const [metric, setMetric] = useState("pack");
  const [sel, setSel] = useState(runs.at(-1)?.run_id ?? null);
  const run = runs.find((r) => r.run_id === sel) ?? null;
  const pick = (r) => { setSel(r.run_id); document.getElementById("runs-chart")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("runs.hero1")} line2={t("runs.hero2")} sub={t("runs.sub", { n: runs.length })}
        info={<TipText lead={t("runs.about.lead")} more={t("runs.about.more")} />}
        chips={<Chip tone={failed ? "wait" : "up"}><StepMark state={failed ? "wait" : "done"} />{ok.length}/{runs.length} {t("runs.status.ok")}</Chip>} />

      {runs.length === 0 ? <EmptyState className="mt-7" title={t("runs.none.title")}>{t("runs.none.body")}</EmptyState> : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <StatTile label={t("runs.s.avg")} value={fmtUsd(avg)} sub={t("runs.s.avgSub", { usd: fmtUsd(settings.cost.target_usd) })} bars={total > 0 ? runs.slice(-14).map((r) => r.cost.usd) : null} barsHi={-1} />
            <StatTile label={t("runs.s.total", { n: runs.length })} value={fmtUsd(total)} sub={t("runs.s.over", { count: over, usd: fmtUsd(settings.cost.warn_usd) })} tone="flat" />
            <StatTile label={t("runs.s.mins")} value={fmtNum(mins, 1)} sub={t("runs.s.minsSub")} bars={ok.slice(-14).map((r) => r.duration_minutes)} barsHi={Math.min(14, ok.length) - 1} tone="flat" />
            <StatTile label={t("runs.s.stopped")} value={<span className={failed ? "text-down" : "text-ink"}>{failed}</span>} sub={t("runs.s.stoppedSub")} tone="flat" />
          </div>

          <Panel id="runs-chart" hero className="mt-4 md:mt-8" title={t("runs.chart.title")} info={t("runs.chart.info")}>
            <div className="mb-7 flex justify-end">
              <Segmented label={t("runs.chart.title")} value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m, label: t(`runs.m.${m}`) }))} />
            </div>
            <RunBars runs={runs} metric={metric} sel={sel} onPick={pick} warn={settings.cost.warn_usd} />
            {run && <RunDetail r={run} warn={settings.cost.warn_usd} />}
          </Panel>

          <Panel className="mt-4 md:mt-8" title={t("runs.table.title")} sub={t("runs.table.sub")}
            badge={<span className="font-num text-[12px] font-bold text-ink-2">{runs.length}</span>}>
            <div className="-mt-4 -mb-4 sm:-mt-5 sm:-mb-5">
              <RunsTable runs={runs} warn={settings.cost.warn_usd} sel={sel} onPick={pick} />
            </div>
          </Panel>
        </>
      )}
    </Container>
  );
}

/** The value a bar shows, and its label. */
function valueOf(r, metric) {
  if (metric === "pack") return packPct(r);
  if (metric === "minutes") return r.duration_minutes;
  return r.cost.usd;
}
const label = (v, metric) => (!isNum(v) ? "–" : metric === "pack" ? `${Math.round(v)}%` : metric === "minutes" ? fmtNum(v, 0) : fmtUsd(v));

/** One bar per morning; the pack view has a dashed line at the cap. Bars are buttons: tap one to read that run. */
function RunBars({ runs, metric, sel, onPick, warn }) {
  const vals = runs.map((r) => valueOf(r, metric));
  const max = Math.max(metric === "pack" ? 100 : 0, metric === "cost" ? warn : 0, ...vals.filter(isNum)) || 1;
  const tone = (r, v) => {
    if (r.status !== "ok") return "bg-down";
    if (metric === "pack" && v > 100) return "bg-down";
    if (metric === "cost" && v > warn) return "bg-wait";
    return "bg-ink-3/50 group-hover:bg-ink-3";
  };
  const every = Math.max(1, Math.ceil(runs.length / 7));
  return (
    <div>
      <div className="relative flex h-[168px] items-end gap-[3px] sm:gap-1.5">
        {metric === "pack" && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-down/60" style={{ bottom: `${(100 / max) * 100}%` }}>
            <span className="micro absolute -top-4 left-0 text-down">100%</span>
          </span>
        )}
        {metric === "cost" && warn > 0 && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-wait/60" style={{ bottom: `${(warn / max) * 100}%` }}>
            <span className="micro absolute -top-4 left-0 text-wait">{fmtUsd(warn)}</span>
          </span>
        )}
        {runs.map((r, i) => {
          const v = vals[i];
          const on = r.run_id === sel;
          return (
            <button key={r.run_id} type="button" onClick={() => onPick(r)} aria-pressed={on} aria-label={`${fmtShort(r.date)}: ${label(v, metric)}`}
              className="group relative flex h-full min-w-0 flex-1 items-end">
              <span className={`block w-full rounded-t-[3px] transition-[height,background-color] duration-500 ${on ? "bg-desk shadow-[0_0_14px_var(--desk-glow)]" : tone(r, v)}`}
                style={{ height: `${Math.max(2, ((isNum(v) ? v : 0) / max) * 100)}%` }} />
              {on && <span className="font-num absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap text-desk">{label(v, metric)}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] border-t border-line pt-1.5 sm:gap-1.5" aria-hidden="true">
        {runs.map((r, i) => (
          <span key={r.run_id} className="font-num min-w-0 flex-1 text-center text-[9.5px] whitespace-nowrap text-ink-3">{i % every === 0 || i === runs.length - 1 ? r.date.slice(8) : ""}</span>
        ))}
      </div>
    </div>
  );
}

function RunDetail({ r, warn }) {
  const pct = packPct(r);
  return (
    <div key={r.run_id} className="tile mt-4 grid animate-pop gap-2 p-3.5 motion-reduce:animate-none sm:p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="headline text-[22px] text-ink">{fmtShort(r.date)}</span>
        <Chip tone={r.status === "ok" ? "up" : "down"}><StepMark state={r.status === "ok" ? "done" : "fail"} />{t.has(`runs.status.${r.status}`) ? t(`runs.status.${r.status}`) : r.status}</Chip>
        <span className="font-num text-[12px] text-ink-2">{t("runs.pack", { pct: isNum(pct) ? `${Math.round(pct)}%` : "–" })}</span>
        <span className="font-num text-[12px] text-ink-2">{fmtNum(r.duration_minutes, 0)} {t("runs.th.minutes").toLowerCase()}</span>
        <span className={`font-num text-[12px] ${r.cost.usd > warn ? "text-wait" : "text-ink-2"}`}>{fmtUsd(r.cost.usd)}</span>
      </div>
      {r.status !== "ok" && r.failure_reason && <p className="text-[13.5px] leading-snug text-down"><span className="micro me-2 text-down">{t("runs.why")}</span>{r.failure_reason}</p>}
      {r.eli5 && <p className="text-[14px] leading-snug text-ink-2"><span className="micro me-2 text-desk">{t("runs.said")}</span>{r.eli5}</p>}
    </div>
  );
}

function RunsTable({ runs, warn, sel, onPick }) {
  const rows = useMemo(() => [...runs].reverse(), [runs]);
  const cols = [
    { key: "date", label: t("runs.th.morning"), sortable: true, sortValue: (r) => r.date, cell: (r) => <span className="font-num text-[13px] font-bold text-ink">{fmtShort(r.date)}</span> },
    { key: "status", label: t("runs.th.result"), align: "start", sortable: true, sortValue: (r) => r.status, cell: (r) => (
      <span className="inline-flex items-center gap-1.5 text-[12.5px]">
        <StepMark state={r.status === "ok" ? "done" : "fail"} />{t.has(`runs.status.${r.status}`) ? t(`runs.status.${r.status}`) : r.status}
        {r.repair_retries ? <Chip tone="wait" className="min-h-[20px] px-1 text-[9.5px]">{t("runs.retry")}</Chip> : null}
      </span>
    ) },
    { key: "cost", label: t("runs.th.cost"), sortable: true, num: true, sortValue: (r) => r.cost.usd, className: (r) => (r.cost.usd > warn ? "text-wait" : "text-ink-2"), cell: (r) => fmtUsd(r.cost.usd) },
    { key: "minutes", label: t("runs.th.minutes"), sortable: true, num: true, sortValue: (r) => r.duration_minutes, className: "text-ink-2", cell: (r) => fmtNum(r.duration_minutes, 0) },
    { key: "pack", label: t("runs.th.pack"), sortable: true, sortValue: packPct, cell: (r) => {
      const pct = packPct(r);
      return (
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-14 overflow-hidden rounded bg-line-2"><span className={`block h-full rounded ${pct > 100 ? "bg-down" : pct > 85 ? "bg-wait" : "bg-up"}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></span>
          <span className="font-num w-9 text-end text-[12px] text-ink-2" title={`${fmtK(r.pack.tokens)}/${fmtK(r.pack.cap_tokens)}`}>{isNum(pct) ? `${Math.round(pct)}%` : "–"}</span>
        </span>
      );
    } },
    { key: "picks", label: t("runs.th.guesses"), sortable: true, num: true, sortValue: (r) => r.picks.length, className: "text-ink", cell: (r) => r.picks.length },
    { key: "versions", label: t("runs.th.versions"), align: "start", className: "font-num text-[11px] text-ink-3 whitespace-nowrap",
      cell: (r) => `s${r.doc_versions.strategy} g${r.doc_versions.guardrails} m${r.doc_versions.methodology} l${r.doc_versions.learnings}` },
    { key: "hash", label: t("runs.th.fingerprint"), align: "start", className: "font-num text-[11px] text-ink-3", cell: (r) => r.pack.hash.slice(0, 10) },
  ];
  return (
    <DataTable columns={cols} rows={rows} rowKey={(r) => r.run_id} minWidth={820} onRowClick={onPick} rowLabel={(r) => fmtShort(r.date)}
      rowTone={(r) => (r.run_id === sel ? "brand" : r.status !== "ok" ? "down" : null)} scrollClassName="relative md:max-h-[520px] md:overflow-y-auto" caption={t("runs.table.title")} />
  );
}
