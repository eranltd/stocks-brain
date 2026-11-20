import { Chip, EmptyState, Panel, StepMark } from "./ui.jsx";
import { fmtPct } from "../lib/format.js";
import { strings } from "../lib/text.js";
import { forwardLine, historyLine, swingList, swingView } from "../lib/swing.js";
import dict from "../text/swing.js";

/*
 * The swing setup (lib/swing.js): the Stock page's card (SwingPanel: the state, the four checks, the plan as percent
 * distances from the last close, the warnings, the history and the forward record) and the Stocks page's strip
 * (SwingStrip: the day's setups and watch names, each a button to its Stock page). Pretend money only.
 */

const MARK = { true: "done", false: "fail" };

function PlanCell({ k, v, sub, tone }) {
  return (
    <div className="min-w-0">
      <dt className="micro truncate">{k}</dt>
      <dd className={`font-num mt-0.5 text-[18px] leading-none font-bold ${tone}`}>{v}</dd>
      {sub && <dd className="mt-1 truncate text-[11px] text-ink-3" title={sub}>{sub}</dd>}
    </div>
  );
}

/** The Stock page's card. `sw` is the row's swing, `doc` the checklist document's swing, `earnings` from earningsInWindow. */
export function SwingPanel({ sw, doc, earnings, hasEarningsDate, head, className = "" }) {
  const t = strings(dict);
  const v = swingView(sw, doc?.params, { earnings });
  const hist = historyLine(doc);
  const fwd = forwardLine(doc);
  return (
    <Panel id="swing-setup" className={`scroll-mt-32 ${className}`} info={t("sw.info")} infoLabel={t("sw.title")} head={head}
      badge={v ? <Chip tone={v.tone}>{v.word}</Chip> : <Chip tone="ghost">{t("sw.paper")}</Chip>}>
      {v ? (
        <div className="grid gap-3">
          <p className="text-[13.5px] leading-snug text-ink">{v.line}</p>
          <ul className="divide-y divide-line rounded-tile border border-line">
            {v.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 px-3 py-2">
                <span className="pt-0.5"><StepMark state={MARK[c.ok]} label={t(c.ok ? "sw.yes" : "sw.no")} className="size-3.5" /></span>
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{c.text}</span>
              </li>
            ))}
          </ul>
          {v.raw !== "none" && (
            <div className="rounded-tile border border-dashed border-line-3 bg-surface-2/60 px-3.5 py-3">
              <dl className="grid grid-cols-3 gap-x-3">
                <PlanCell k={t("sw.plan.stop")} v={fmtPct(-v.stop, 1)} sub={t("sw.plan.stopSub")} tone="text-down" />
                <PlanCell k={t("sw.plan.target")} v={fmtPct(v.target, 1)} sub={t("sw.plan.targetSub")} tone="text-up" />
                <PlanCell k={t("sw.plan.high")} v={fmtPct(v.high, 1)} sub={t("sw.plan.highSub", { rr: (v.rrHigh ?? 0).toFixed(1) })} tone="text-ink" />
              </dl>
              <p className="mt-2 text-[11px] leading-snug text-ink-3">{t("sw.plan.note")}</p>
            </div>
          )}
          {(v.warnings.length > 0 || (v.raw !== "none" && !hasEarningsDate)) && (
            <ul className="grid gap-1.5">
              {v.warnings.map((w) => (
                <li key={w.id} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-2">
                  <span className="pt-0.5"><StepMark state="wait" className="size-3" /></span><span>{w.text}</span>
                </li>
              ))}
              {v.raw !== "none" && !hasEarningsDate && (
                <li className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-3">
                  <span className="pt-0.5"><StepMark state="idle" className="size-3" /></span><span>{t("sw.warn.noDate")}</span>
                </li>
              )}
            </ul>
          )}
          {(hist || fwd) && (
            <div className="grid gap-1 border-t border-line pt-2.5 text-[11.5px] leading-snug text-ink-3">
              {hist && <p>{hist}</p>}
              {fwd && <p>{fwd}</p>}
            </div>
          )}
        </div>
      ) : <EmptyState compact title={t("sw.title")}>{t("sw.none")}</EmptyState>}
    </Panel>
  );
}

const SHOW = 8;

function NameButtons({ rows, go, tone }) {
  const t = strings(dict);
  const shown = rows.slice(0, SHOW);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((r) => (
        <button key={r.symbol} type="button" onClick={() => go(`stock/${r.symbol}`)} aria-label={t("sw.strip.open", { symbol: r.symbol })}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-line-2 bg-surface-2 px-3 hover:border-line-3">
          <span className={`font-num text-[13px] font-bold ${tone}`}>{r.symbol}</span>
          <span className="font-num text-[11px] text-ink-3">{t("sw.strip.stop", { stop: fmtPct(-r.stop_pct, 1) })}</span>
        </button>
      ))}
      {rows.length > SHOW && <span className="micro inline-flex min-h-[44px] items-center px-1">{t("sw.strip.more", { count: rows.length - SHOW })}</span>}
    </div>
  );
}

/** The Stocks page's strip: the day's setups and watch names of the chosen market. Nothing without a swing reading. */
export function SwingStrip({ checklist, go, head, className = "" }) {
  const t = strings(dict);
  if (!checklist?.swing) return null;
  const { setup, watch } = swingList(checklist);
  const hist = historyLine(checklist.swing);
  return (
    <Panel id="wl-swing" className={`scroll-mt-28 ${className}`} info={`${t("sw.info")}${hist ? ` ${hist}` : ""}`} infoLabel={t("sw.strip.title")} head={head}
      badge={<Chip tone={setup.length ? "up" : "neutral"}>{setup.length}</Chip>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="micro text-desk">{t("sw.strip.setups")}</h3>
          <div className="mt-1.5">{setup.length ? <NameButtons rows={setup} go={go} tone="text-up" /> : <p className="text-[12.5px] text-ink-3">{t("sw.strip.noSetups")}</p>}</div>
        </div>
        <div>
          <h3 className="micro">{t("sw.strip.watch")}</h3>
          <div className="mt-1.5">{watch.length ? <NameButtons rows={watch} go={go} tone="text-ink" /> : <p className="text-[12.5px] text-ink-3">{t("sw.strip.noWatch")}</p>}</div>
        </div>
      </div>
    </Panel>
  );
}
