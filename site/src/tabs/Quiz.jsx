import { useCallback, useEffect, useState } from "react";
import { loadCandles } from "../lib/data.js";
import { useReducedMotion } from "../lib/motion.js";
import { makeQuestion, rng, scoreWords } from "../lib/quiz.js";
import dict from "../text/learn.js";
import { BigChart, slice } from "../components/zoom.jsx";
import { Container } from "../components/ui.jsx";
import { strings } from "../lib/text.js";
import { SPOT_KINDS } from "../lib/spots.js";

/*
 * Guess the candle: a real chart from a stock on the list, one candle marked. First guess what kind of candle it is, then
 * whether the next week ended higher or lower. The score is kept on this device only, next to what luck would score.
 */

const KEY = "sb:quiz";
const readScore = () => { try { return JSON.parse(window.localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const saveScore = (s) => { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };
const dayLong = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function Quiz({ data }) {
  const reduced = useReducedMotion();
  const t = strings(dict);
  const KINDS = SPOT_KINDS;
  const [round, setRound] = useState(null); // {sym, daily, q}
  const [state, setState] = useState("loading"); // loading | none | ready
  const [kindPick, setKindPick] = useState(null);
  const [weekPick, setWeekPick] = useState(null);
  const [score, setScore] = useState(readScore);
  const [n, setN] = useState(0);

  const symbols = Object.keys(data.manifest?.candles ?? {}).filter((s) => s !== data.bench?.symbol);

  const next = useCallback(async () => {
    setState("loading"); setKindPick(null); setWeekPick(null);
    const rand = rng((Date.now() ^ (n * 7919)) >>> 0);
    for (let tries = 0; tries < 6 && symbols.length; tries++) {
      const sym = symbols[Math.floor(rand() * symbols.length)];
      try {
        const doc = await loadCandles(data.manifest, sym);
        const q = makeQuestion(doc?.daily, rand);
        if (q) { setRound({ sym, daily: doc.daily, q }); setState("ready"); setN((x) => x + 1); return; }
      } catch { /* try another stock */ }
    }
    setState("none");
  }, [data.manifest, n, symbols.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { next(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bump = (patch) => setScore((s) => { const v = { ...s }; for (const [k, d] of Object.entries(patch)) v[k] = (v[k] ?? 0) + d; saveScore(v); return v; });
  const answerKind = (k) => { if (kindPick) return; setKindPick(k); bump({ kindTried: 1, kindRight: k === round.q.kind ? 1 : 0 }); };
  const answerWeek = (w) => { if (weekPick) return; setWeekPick(w); bump({ weekTried: 1, weekRight: w === round.q.nextWeek ? 1 : 0 }); };

  const q = round?.q;
  const done = Boolean(weekPick);
  const view = q ? slice(round.daily, q.from, done ? q.toAfter : q.to) : null;
  const j = q ? q.i - q.from : 0;
  const right = KINDS[q?.kind] ?? null;
  const spots = q ? [{ i: q.i, j, n: kindPick ? "!" : "?", tone: kindPick ? right.tone : "flat", title: t("quiz.marked") }] : [];

  return (
    <Container className="pb-10 pt-10">
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-[clamp(30px,8vw,44px)] leading-[1.05] font-bold tracking-[-0.03em] text-ink">{t("quiz.title")}</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">{t("quiz.intro")}</p>
        <p className="mt-3 text-[15px] text-ink-3" aria-live="polite">{scoreWords(score)}</p>

        <div className="mt-5">
          {state === "loading" && <p className="grid h-[300px] place-items-center rounded-2xl bg-surface-2 text-ink-2" role="status">{t("quiz.loading")}</p>}
          {state === "none" && <p className="grid h-[300px] place-items-center rounded-2xl border border-dashed border-line-2 text-ink-2">{t("quiz.none")}</p>}
          {state === "ready" && view && <BigChart key={`${n}-${done}`} view={view} spots={spots} chosen={j} reduced={reduced} onSpot={() => {}} name={t("quiz.mystery")} />}
        </div>

        {state === "ready" && (
          <div className="mt-6 grid gap-6">
            <section>
              <h2 className="text-[20px] font-bold text-ink">{t("quiz.q1")}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.choices.map((c) => {
                  const isRight = c.kind === q.kind, picked = kindPick === c.kind;
                  const tone = kindPick ? (isRight ? "border-accent bg-accent/12 text-accent" : picked ? "border-down bg-down/10 text-down" : "border-line-2 text-ink-3") : "border-line-2 text-ink hover:border-ink-3";
                  return <button key={c.kind} type="button" onClick={() => answerKind(c.kind)} disabled={Boolean(kindPick)} className={`min-h-[52px] rounded-2xl border px-4 text-start text-[16.5px] font-semibold transition-colors ${tone}`}>{KINDS[c.kind]?.title ?? c.title}</button>;
                })}
              </div>
              {kindPick && (
                <p className="mt-3 text-[16px] leading-relaxed text-ink">
                  <span className={`font-bold ${kindPick === q.kind ? "text-accent" : "text-down"}`}>{kindPick === q.kind ? t("quiz.right") : t("quiz.itWas", { kind: right.title.toLowerCase() })}</span> {right.why}
                </p>
              )}
            </section>

            {kindPick && (
              <section>
                <h2 className="text-[20px] font-bold text-ink">{t("quiz.q2")}</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {["higher", "lower"].map((w) => {
                    const isRight = w === q.nextWeek, picked = weekPick === w;
                    const tone = weekPick ? (isRight ? "border-accent bg-accent/12 text-accent" : picked ? "border-down bg-down/10 text-down" : "border-line-2 text-ink-3") : "border-line-2 text-ink hover:border-ink-3";
                    return <button key={w} type="button" onClick={() => answerWeek(w)} disabled={Boolean(weekPick)} className={`min-h-[56px] rounded-2xl border px-4 text-[18px] font-bold capitalize transition-colors ${tone}`}>{t(w === "higher" ? "quiz.higher" : "quiz.lower")}</button>;
                  })}
                </div>
                {done && (
                  <div className="mt-4 rounded-2xl border border-line-2 bg-surface-2 p-4 text-[16px] leading-relaxed text-ink">
                    <p><span className="font-bold">{weekPick === q.nextWeek ? t("quiz.right") : t("quiz.notThisTime")}</span> {t(`quiz.reveal.${q.nextWeek}`, { name: data.names?.[round.sym] ?? round.sym, date: dayLong(q.date) })}</p>
                    <p className="mt-2 text-ink-2">{t("quiz.lesson")}</p>
                  </div>
                )}
              </section>
            )}

            {done && <button type="button" onClick={next} className="btn btn-primary min-h-[56px] justify-center text-[18px]">{t("quiz.next")}</button>}
          </div>
        )}
      </div>
    </Container>
  );
}
