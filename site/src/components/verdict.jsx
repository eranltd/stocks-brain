import { useState } from "react";
import { numWord } from "../lib/format.js";
import { todayISO } from "../lib/outlook.js";
import { steadyRuns, verdictHistory } from "../lib/verdict.js";
import { ArrowRight, Reveal } from "./ui.jsx";

const TONE = { accent: "var(--accent)", down: "var(--down)", flat: "var(--ink-2)" };
const MARK = { accent: "▲", down: "▼", flat: "◆" };
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function opts(data) {
  return { outlook: data.outlook, names: data.names, today: todayISO() };
}

/** One run's verdict: the headline, what changed, a row per name and, folded, the brain's own summary. */
function VerdictBody({ v, big = true, withHeadline = true }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {withHeadline && <p className={`${big ? "text-[clamp(22px,6vw,27px)]" : "text-[20px]"} mb-3 leading-snug font-semibold tracking-[-0.015em] text-ink`}>{v.headline}</p>}
      <p className="text-[16.5px] leading-relaxed text-ink-2">{v.changes.line}</p>
      {v.rows.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {v.rows.map((r) => (
            <li key={r.ticker} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[18px] font-semibold tracking-[-0.01em] text-ink">{r.name}</span>
                <span className="pill py-0.5 text-[12px] normal-case tracking-[0.02em]" style={{ color: TONE[r.tone], borderColor: "var(--line-2)" }}>
                  <span aria-hidden="true" className="text-[9px]">{MARK[r.tone]}</span>{r.stance}, {r.sure}
                </span>
              </div>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{r.why}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3"><span className="text-ink-2">It would be wrong if:</span> {r.wrongIf}</p>
            </li>
          ))}
        </ul>
      )}
      {v.summary && (
        <div className="mt-4">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="meta inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
            {open ? "Hide" : "Read"} the brain's own summary <ArrowRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
          {open && <p className="mt-2 rounded-2xl border border-line-2 bg-surface-2 p-4 text-[15px] leading-relaxed text-ink-2">{v.summary}</p>}
        </div>
      )}
    </>
  );
}

/**
 * The newest brain run in plain words, for the home page. Each run is its own call: the headline says what to do, the
 * next line what changed since the run before, and each name gets its stance, how sure, one reason and what would
 * prove it wrong. Shown only on live picks (sample runs are not the brain).
 */
export function LatestVerdict({ data, go }) {
  if (data.sample) return null;
  const history = verdictHistory(data.runs, opts(data));
  const v = history[0];
  if (!v) return null;
  const steady = steadyRuns(data.runs);
  return (
    <Reveal as="article" id="brain-verdict" className="card overflow-hidden">
      <div className="h-1" style={{ background: "var(--ai)" }} />
      <div className="p-6 sm:p-7">
        <h2 className="meta mb-4" style={{ color: "var(--ai)" }}>The brain's verdict · {v.when || longDate(v.date)}</h2>
        <VerdictBody v={v} />
        {steady > 1 && <p className="mt-4 text-[15px] leading-relaxed text-ink-3">{numWord(steady)} runs in a row with the same calls.</p>}
        <p className="mt-4 text-[14.5px] leading-relaxed text-ink-3">On paper only: no money moves until the plan has earned trust.</p>
        <button type="button" onClick={() => go("verdicts")} className="meta mt-3 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
          Every run, in plain words <ArrowRight className="size-3.5" />
        </button>
      </div>
    </Reveal>
  );
}

/** Every brain run, newest first, each in plain words and compared with the run before it. */
export function VerdictHistory({ data }) {
  const history = data.sample ? [] : verdictHistory(data.runs, opts(data));
  const [open, setOpen] = useState(() => new Set(history.slice(0, 1).map((v) => v.date)));
  const toggle = (d) => setOpen((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  if (!history.length) {
    return <p className="card p-6 text-[17px] leading-relaxed text-ink-2">The brain's runs appear here once it has made its first live call.</p>;
  }
  return (
    <ol className="grid gap-4">
      {history.map((v) => {
        const isOpen = open.has(v.date);
        return (
          <li key={v.date} className="card overflow-hidden">
            <button type="button" onClick={() => toggle(v.date)} aria-expanded={isOpen}
              className="flex w-full min-h-[56px] items-center justify-between gap-3 px-5 py-4 text-left sm:px-6">
              <span className="min-w-0">
                <span className="meta block" style={{ color: "var(--ai)" }}>{longDate(v.date)}</span>
                <span className="mt-1 block text-[17px] leading-snug text-ink">{v.headline}</span>
                {!isOpen && <span className="mt-1 block text-[14.5px] text-ink-3">{v.changes.same ? "No change from the run before." : "Something changed: open to see what."}</span>}
              </span>
              <ArrowRight className={`size-4 shrink-0 text-ink-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>
            {isOpen && <div className="border-t border-line px-5 pb-6 pt-4 sm:px-6"><VerdictBody v={v} big={false} withHeadline={false} /></div>}
          </li>
        );
      })}
    </ol>
  );
}
