import { useState } from "react";
import { HORIZONS, honestAction, lumpSum, moneyFacts } from "../lib/money.js";
import { Reveal } from "./ui.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";

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
    <div role="radiogroup" aria-label={strings(dict)("moneyc.when")} className="mt-4 grid gap-2 sm:grid-cols-3">
      {HORIZONS.map((h) => {
        const on = horizon === h.id;
        return (
          <button key={h.id} type="button" role="radio" aria-checked={on} onClick={() => setHorizon(h.id)}
            className={`min-h-[52px] rounded-2xl border px-4 py-3 text-start text-[16px] font-medium transition-colors ${on ? "border-transparent bg-ink text-bg" : "border-line-2 text-ink hover:border-ink-3"}`}>
            {h.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "What should I do with my money?": the honest action for the reader's time horizon. The question comes first; the
 * answer follows. Stock picks are not part of it (docs/household.md): they would join only if a tested rule ever earns
 * a place, which today none has.
 */
export function MoneyAction({ data, compact = false }) {
  const t = strings(dict);
  const [horizon, setHorizon] = useHorizon();
  const a = horizon ? honestAction(horizon, moneyFacts(data)) : null;
  return (
    <Reveal as="section" id="money-action" className="card scroll-mt-28 overflow-hidden">
      <div className="h-1.5" style={{ background: "var(--accent)" }} />
      <div className="p-6 sm:p-8">
        <h2 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-accent">{t("moneyc.title")}</h2>
        <p className="mt-3 text-[18px] font-semibold text-ink">{t("moneyc.when")}</p>
        <Picker horizon={horizon} setHorizon={setHorizon} />
        {!a && <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{t("moneyc.pick")}</p>}
        {a && (
          <>
            <p className="mt-6 text-[clamp(24px,6.5vw,32px)] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">{a.title}</p>
            <ol className="mt-4 grid gap-3">
              {a.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-[14px] font-semibold text-accent">{i + 1}</span>
                  <span className="min-w-0">{s}</span>
                </li>
              ))}
            </ol>
            {!compact && (
              <>
                <p className="mt-5 text-[16.5px] leading-relaxed text-ink-2"><span className="font-semibold text-ink">{t("moneyc.why")}</span> {a.why}</p>
                <p className="mt-3 text-[16.5px] leading-relaxed text-ink-2"><span className="font-semibold text-ink">{t("moneyc.risk")}</span> {a.risk}</p>
              </>
            )}
            <p className="mt-5 text-[14px] leading-relaxed text-ink-3">{t("moneyc.general")} {t("moneyc.device")}</p>
          </>
        )}
      </div>
    </Reveal>
  );
}

/** "Got a lump sum?": five steps for money already in hand, then the questions to settle before moving a big sum. */
export function LumpSum({ data }) {
  const t = strings(dict);
  const g = lumpSum(data.rulesResult, null);
  return (
    <details id="lump-sum" className="card scroll-mt-28 p-6 sm:p-8">
      <summary className="cursor-pointer text-[19px] font-semibold text-ink">{g.title} <span className="font-normal text-ink-3">{t("moneyc.lumpKinds")}</span></summary>
      <ol className="mt-5 grid gap-3">
        {g.steps.map((s, i) => (
          <li key={s} className="flex gap-3 text-[17px] leading-relaxed text-ink">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-[14px] font-semibold text-accent">{i + 1}</span>
            <span className="min-w-0">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[16px] font-semibold text-ink">{t("moneyc.before")}</p>
      <ul className="mt-2 grid gap-2">
        {g.before.map((b) => <li key={b} className="text-[16px] leading-relaxed text-ink-2">• {b}</li>)}
      </ul>
      <p className="mt-4 text-[16px] leading-relaxed text-ink">{g.adviser}</p>
      <p className="mt-4 text-[14px] leading-relaxed text-ink-3">{t("moneyc.general")}</p>
    </details>
  );
}
