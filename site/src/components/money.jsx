import { useId, useState } from "react";
import { HORIZONS, honestAction, lumpSum, moneyFacts } from "../lib/money.js";
import { InfoTip, Panel } from "./ui.jsx";
import dict from "../text/home.js";
import plan from "../text/plan.js";
import { strings } from "../lib/text.js";

// Real money, the honest action (lib/money.js). Texts: text/home.js ("moneyc.*", "money.*", "lump.*") and text/plan.js
// ("mon.*"). The kit's look: a Panel, the horizon as three tiles, the answer's steps numbered in mono, the why and the
// risk behind an (i).

const KEY = "sb:horizon";
const read = () => { try { return window.localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { window.localStorage.setItem(KEY, v); } catch { /* private mode or blocked storage */ } };

/** The reader's time horizon, remembered on this device only (it never leaves the browser). */
export function useHorizon() {
  const [h, setH] = useState(() => (HORIZONS.some((x) => x.id === read()) ? read() : null));
  return [h, (v) => { write(v); setH(v); }];
}

function Picker({ horizon, setHorizon }) {
  return (
    <div role="radiogroup" aria-label={strings(dict)("moneyc.when")} className="grid grid-cols-3 gap-2">
      {HORIZONS.map((h) => {
        const on = horizon === h.id;
        return (
          <button key={h.id} type="button" role="radio" aria-checked={on} onClick={() => setHorizon(h.id)}
            className={`relative min-h-[56px] overflow-hidden rounded-tile border px-2 py-2.5 text-center transition-[border-color,background-color,box-shadow] ${on ? "glow-brand border-desk bg-desk/10 text-ink" : "border-line-2 bg-surface-2 text-ink-2 hover:border-line-3 hover:text-ink"}`}>
            {on && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-desk" />}
            <span className="headline block text-[17px] leading-none tracking-[0.04em] sm:text-[19px]">{h.short}</span>
            <span className="mt-1 hidden text-[11.5px] leading-tight text-ink-3 sm:block">{h.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Numbered steps: 01, 02 ... in mono, the step in plain words. */
function Steps({ steps }) {
  return (
    <ol className="grid gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex gap-3 rounded-[10px] border border-line bg-surface-2/60 px-3 py-2.5 text-[14.5px] leading-snug text-ink">
          <span className="font-num shrink-0 pt-px text-[12px] font-bold text-desk">{String(i + 1).padStart(2, "0")}</span>
          <span className="min-w-0">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * "What should I do with my money?": the honest action for the reader's time horizon. The question comes first; the
 * answer follows. Stock picks are not part of it (docs/household.md): they would join only if a tested rule ever earns
 * a place, which today none has.
 */
export function MoneyAction({ data, compact = false, className = "" }) {
  const t = strings(dict);
  const p = strings(plan);
  const [horizon, setHorizon] = useHorizon();
  const a = horizon ? honestAction(horizon, moneyFacts(data)) : null;
  return (
    <Panel id="money-action" className={`scroll-mt-28 ${className}`} eyebrow={p("mon.kicker")} title={t("moneyc.title")}
      info={<span className="grid gap-2"><span>{t("moneyc.pick")}</span><span>{t("moneyc.general")} {t("moneyc.device")}</span></span>} infoLabel={p("mon.about")}>
      <p className="micro mb-2 text-ink-2">{t("moneyc.when")}</p>
      <Picker horizon={horizon} setHorizon={setHorizon} />
      {!a && <p className="mt-3 text-[13.5px] text-ink-3">{p("mon.pick")}</p>}
      {a && (
        <div className="mt-4">
          <p className="headline text-[clamp(22px,6vw,28px)] leading-[1.02] text-ink">{a.title}</p>
          <div className="mt-3"><Steps steps={a.steps} /></div>
          {!compact && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center"><span className="micro text-up">{p("mon.why")}</span><InfoTip label={t("moneyc.why")} align="start">{a.why}</InfoTip></span>
              <span className="inline-flex items-center"><span className="micro text-down">{p("mon.risk")}</span><InfoTip label={t("moneyc.risk")} align="start">{a.risk}</InfoTip></span>
            </div>
          )}
          <p className="mt-2 text-[12px] leading-snug text-ink-3">{t("moneyc.general")}</p>
        </div>
      )}
    </Panel>
  );
}

/** "Got a lump sum?": five steps for money already in hand, then the questions to settle before moving a big sum. */
export function LumpSum({ data, className = "" }) {
  const t = strings(dict);
  const p = strings(plan);
  const g = lumpSum(data.rulesResult, null);
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <Panel id="lump-sum" className={`scroll-mt-28 ${className}`} eyebrow={p("mon.kicker")} title={g.title} sub={t("moneyc.lumpKinds")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
        className={`headline flex min-h-[48px] w-full items-center justify-between gap-3 rounded-tile border px-3.5 text-[15px] tracking-[0.1em] transition-colors ${open ? "border-desk/60 text-desk" : "border-line-2 text-ink hover:border-line-3"}`}>
        {p(open ? "mon.lumpClose" : "mon.lumpOpen")}
        <svg viewBox="0 0 24 24" className={`size-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div id={id} className="mt-3">
          <Steps steps={g.steps} />
          <p className="micro mt-4 mb-2 text-ink-2">{t("moneyc.before")}</p>
          <ul className="grid gap-1.5">
            {g.before.map((b) => <li key={b} className="relative ps-4 text-[13.5px] leading-snug text-ink-2 before:absolute before:start-0 before:top-[0.65em] before:h-px before:w-2.5 before:bg-desk">{b}</li>)}
          </ul>
          <p className="mt-3 text-[13.5px] leading-snug text-ink">{g.adviser}</p>
          <p className="mt-2 text-[12px] leading-snug text-ink-3">{t("moneyc.general")}</p>
        </div>
      )}
    </Panel>
  );
}
