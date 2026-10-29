import { useCallback, useEffect, useState } from "react";
import { loadCandles } from "../lib/data.js";
import { useReducedMotion } from "../lib/motion.js";
import { makeQuestion, rng, scoreWords } from "../lib/quiz.js";
import dict from "../text/learn.js";
import { BigChart, slice } from "../components/zoom.jsx";
import { CallButton, CheckIcon, Chip, Container, EmptyState, InfoTip, Panel, Skeleton, Stamp, StepMark } from "../components/ui.jsx";
import { PageHero, TipText } from "../lib/learnkit.jsx";
import { strings } from "../lib/text.js";
import { SPOT_KINDS } from "../lib/spots.js";

/*
 * Guess the candle, as a game screen: a score HUD (candle names and next week, each beside what luck would score, and a
 * streak), a real chart from a stock on the list with one candle marked, and two questions with big answer buttons.
 * Answers turn into the kit's call buttons: green for right, red for a miss. The score stays on this device only.
 */

const KEY = "sb:quiz";
const readScore = () => { try { return JSON.parse(window.localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const saveScore = (s) => { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };
const dayLong = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const t = strings(dict);
const LETTERS = ["A", "B", "C", "D"];
const pctOf = (right, tried) => (tried ? `${Math.round((right / tried) * 100)}%` : "–");

export default function Quiz({ data }) {
  const reduced = useReducedMotion();
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

  /** Add to the score; `ok` moves the streak (one more when right, back to zero on a miss). */
  const bump = (patch, ok) => setScore((s) => {
    const v = { ...s };
    for (const [k, d] of Object.entries(patch)) v[k] = (v[k] ?? 0) + d;
    v.streak = ok ? (s.streak ?? 0) + 1 : 0;
    v.best = Math.max(s.best ?? 0, v.streak);
    saveScore(v);
    return v;
  });
  const answerKind = (k) => { if (kindPick) return; const ok = k === round.q.kind; setKindPick(k); bump({ kindTried: 1, kindRight: ok ? 1 : 0 }, ok); };
  const answerWeek = (w) => { if (weekPick) return; const ok = w === round.q.nextWeek; setWeekPick(w); bump({ weekTried: 1, weekRight: ok ? 1 : 0 }, ok); };

  const q = round?.q;
  const done = Boolean(weekPick);
  const view = q ? slice(round.daily, q.from, done ? q.toAfter : q.to) : null;
  const j = q ? q.i - q.from : 0;
  const right = KINDS[q?.kind] ?? null;
  const spots = q ? [{ i: q.i, j, n: kindPick ? "!" : "?", tone: kindPick ? right.tone : "flat", title: t("quiz.marked") }] : [];
  const kindOk = kindPick && kindPick === q?.kind;
  const weekOk = weekPick && weekPick === q?.nextWeek;

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("quiz.hero1")} line2={t("quiz.hero2")} sub={t("quiz.sub")} size="md"
        info={<TipText lead={t("quiz.about.lead")} more={t("quiz.about.more")} />} />

      <Hud score={score} round={n} />

      {state === "none" ? <EmptyState className="mt-4" title={t("quiz.none")} /> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          <Panel hero className="min-w-0" titleSize="sm"
            head={<div className="min-w-0">
              <p className="kicker">{t("quiz.hud.round")} {String(Math.max(1, n)).padStart(2, "0")}</p>
              <p className="headline mt-1 text-[22px] text-ink">{t("quiz.mystery")}</p>
            </div>}
            badge={<span className="flex gap-1">
              <Chip tone={kindPick ? (kindOk ? "up" : "down") : "brand"} className="min-h-[24px] px-1.5 text-[10px]">
                {kindPick ? <StepMark state={kindOk ? "done" : "fail"} /> : null}Q1
              </Chip>
              <Chip tone={weekPick ? (weekOk ? "up" : "down") : kindPick ? "brand" : "ghost"} className="min-h-[24px] px-1.5 text-[10px]">
                {weekPick ? <StepMark state={weekOk ? "done" : "fail"} /> : null}Q2
              </Chip>
            </span>}>
            {state === "loading" || !view ? (
              <div role="status" className="relative h-[300px]">
                <Skeleton className="h-full w-full rounded-2xl" />
                <span className="micro absolute inset-0 grid place-items-center">{t("quiz.loading")}</span>
              </div>
            ) : <BigChart key={`${n}-${done}`} view={view} spots={spots} chosen={j} reduced={reduced} onSpot={() => {}} name={t("quiz.mystery")} />}
          </Panel>

          {state === "ready" && q && (
            <div className="grid min-w-0 gap-4">
              <Panel title={t("quiz.q1")} eyebrow={t("quiz.step", { n: 1 })} titleSize="sm" active={!kindPick}>
                <div className="grid grid-cols-2 gap-2">
                  {q.choices.map((c, i) => {
                    const label = KINDS[c.kind]?.title ?? c.title;
                    if (!kindPick) {
                      return (
                        <button key={c.kind} type="button" data-quiz-kind onClick={() => answerKind(c.kind)}
                          className="group flex min-h-[56px] min-w-0 items-center gap-2.5 rounded-[12px] border border-line-3 bg-surface-2 px-2.5 text-start transition-colors hover:border-desk hover:bg-surface-3">
                          <span className="font-num grid size-7 shrink-0 place-items-center rounded-[7px] border border-line-3 text-[12px] font-bold text-ink-2 transition-colors group-hover:border-desk group-hover:text-desk">{LETTERS[i]}</span>
                          <span className="headline min-w-0 text-[17px] leading-[1.05] tracking-[0.04em] text-ink sm:text-[19px]">{label}</span>
                        </button>
                      );
                    }
                    const isRight = c.kind === q.kind, picked = kindPick === c.kind;
                    return (
                      <CallButton key={c.kind} call={isRight ? "enter" : "reject"} active={isRight || picked} label={label} disabled
                        className="min-h-[56px] w-full px-2 text-[16px] leading-[1.05] whitespace-normal sm:text-[18px]" />
                    );
                  })}
                </div>
                {kindPick && (
                  <p className="mt-3 animate-pop text-[14px] leading-snug text-ink-2 motion-reduce:animate-none" aria-live="polite">
                    <span className={`headline me-1.5 text-[17px] tracking-[0.06em] ${kindOk ? "text-up" : "text-down"}`}>{kindOk ? t("quiz.right") : t("quiz.itWas", { kind: right.title.toLowerCase() })}</span>
                    {right.why}
                  </p>
                )}
              </Panel>

              {kindPick && (
                <Panel title={t("quiz.q2")} eyebrow={t("quiz.step", { n: 2 })} titleSize="sm" active={!weekPick} className="animate-pop motion-reduce:animate-none">
                  <div className="grid grid-cols-2 gap-2">
                    {["higher", "lower"].map((w) => {
                      const isRight = w === q.nextWeek, picked = weekPick === w;
                      const word = t(w === "higher" ? "quiz.higher" : "quiz.lower");
                      return (
                        <div key={w} className="grid min-w-0 gap-1">
                          <CallButton call={w === "higher" ? "enter" : "reject"} size="lg"
                            label={weekPick && isRight ? <><CheckIcon className="size-4" />{word}</> : word}
                            onClick={weekPick ? undefined : () => answerWeek(w)} as={weekPick ? "span" : "button"} data-quiz-week={weekPick ? undefined : true}
                            active={!weekPick || isRight} className="w-full" />
                          {picked && <span className={`micro text-center ${isRight ? "text-up" : "text-down"}`}>{t("quiz.yourPick")}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {done && (
                    <div className="relative mt-4 animate-pop overflow-hidden rounded-tile border border-line-2 bg-surface-2 p-4 motion-reduce:animate-none" aria-live="polite">
                      <Stamp kind={weekOk ? "approved" : "rejected"} size="md" rotate={weekOk ? -6 : -8} className="mb-3">{weekOk ? t("quiz.right") : t("quiz.wrong")}</Stamp>
                      <p className="text-[15px] leading-snug text-ink">{t(`quiz.reveal.${q.nextWeek}`, { name: data.names?.[round.sym] ?? round.sym, date: dayLong(q.date) })}</p>
                      <p className="mt-1.5 flex items-center gap-1 text-[13px] leading-snug text-ink-3">{t("quiz.lesson")}<InfoTip label={t("quiz.hero2")}>{t("quiz.about.more")}</InfoTip></p>
                    </div>
                  )}
                  {done && (
                    <button type="button" data-quiz-next onClick={next}
                      className="btn btn-primary mt-3 min-h-[56px] w-full justify-center font-display text-[20px] font-extrabold tracking-[0.1em] uppercase">
                      {t("quiz.next")} <span aria-hidden="true">→</span>
                    </button>
                  )}
                </Panel>
              )}
            </div>
          )}
        </div>
      )}
    </Container>
  );
}

const Flame = ({ className = "size-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12.6 2.2c.3 2.6-.8 4.3-2.2 5.9C8.8 9.9 7 11.8 7 14.8 7 18.2 9.3 21 12.5 21s5.5-2.6 5.5-6c0-2.3-1-4-2.2-5.4-.3 1.3-1 2.3-2 2.8.6-3.6-.2-7.2-1.2-9.2Z" />
  </svg>
);

/** The score HUD: round, candle names and next week (each beside luck), and the streak. */
function Hud({ score, round }) {
  const { kindRight = 0, kindTried = 0, weekRight = 0, weekTried = 0, streak = 0, best = 0 } = score ?? {};
  const hot = streak >= 3;
  const cell = "flex min-w-0 flex-col px-2.5 py-2.5 sm:px-4 sm:py-3";
  return (
    <section aria-label={t("quiz.hud")} className="panel mt-5 grid grid-cols-4 divide-x divide-line overflow-hidden">
      <p className="sr-only" aria-live="polite">{scoreWords(score)}</p>
      <div className={cell}>
        <span className="micro text-desk">{t("quiz.hud.round")}</span>
        <span className="font-num mt-1 text-[22px] leading-none font-bold text-ink sm:text-[34px]">{String(Math.max(1, round)).padStart(2, "0")}</span>
        <span className="mt-1 hidden truncate text-[11px] text-ink-3 sm:block">{t("quiz.hud.thisDevice")}</span>
      </div>
      <ScoreCell label={t("quiz.hud.kind")} right={kindRight} tried={kindTried} luck="25%" />
      <ScoreCell label={t("quiz.hud.week")} right={weekRight} tried={weekTried} luck="50%" />
      <div className={`${cell} ${hot ? "bg-desk/8" : ""}`}>
        <span className={`micro ${hot ? "text-desk" : ""}`}>{t("quiz.hud.streak")}</span>
        <span className={`font-num mt-1 flex items-center gap-1 text-[22px] leading-none font-bold sm:gap-1.5 sm:text-[34px] ${streak ? "text-desk" : "text-ink-3"} ${hot ? "text-glow" : ""}`}>
          <Flame className={`size-4 sm:size-6 ${streak ? "" : "opacity-40"} ${hot ? "motion-safe:animate-[beacon_1.6s_ease-in-out_infinite]" : ""}`} />{streak}
        </span>
        <span className="font-num mt-1 text-[11px] text-ink-3">{t("quiz.hud.best", { n: best })}</span>
      </div>
    </section>
  );
}

function ScoreCell({ label, right, tried, luck }) {
  return (
    <div className="flex min-w-0 flex-col px-2.5 py-2.5 sm:px-4 sm:py-3">
      <span className="micro truncate">{label}</span>
      <span className="font-num mt-1 text-[22px] leading-none font-bold text-ink sm:text-[34px]">
        {right}<span className="text-[0.55em] text-ink-3">/{tried}</span>
      </span>
      <span className="font-num mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] sm:text-[11px]">
        <span className="font-bold text-ink-2">{pctOf(right, tried)}</span>
        <span className="truncate text-ink-3">{t("quiz.hud.luck", { pct: luck })}</span>
      </span>
    </div>
  );
}
