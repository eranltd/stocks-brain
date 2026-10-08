import { fmtDate, fmtNum, fmtPct, numWord, relDays } from "../lib/format.js";
import { marketBrief } from "../components/brief.jsx";
import { STAGES } from "../components/trust.jsx";
import { nextRebalance } from "../components/goal.jsx";
import { ArrowRight, Reveal } from "../components/ui.jsx";
import { todayCall } from "./Details.jsx";

const STANCE = {
  bullish: { word: "Leaning up", tone: "var(--accent)" },
  bearish: { word: "Leaning down", tone: "var(--down)" },
  neutral: { word: "Just watching", tone: "var(--flat)" },
};
const CONFIDENCE = { low: "low confidence", medium: "medium confidence", high: "high confidence" };

const firstSentence = (t) => (t.match(/^.*?[.!?](\s|$)/) || [t])[0].trim();
const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * Home: one short, plain-language post. Hi, today is X, the last run was Y, here is what the market did,
 * what we learned, and what we should do. Everything is computed or copied from the data; the full
 * dashboard (old home page) lives under "Full dashboard".
 */
export default function Today({ data, go }) {
  const call = todayCall(data);
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  const todayIso = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-24 pt-6 sm:pt-10">
      <PostHeader data={data} todayIso={todayIso} />
      <div className="mt-5 grid gap-5">
        <Hello data={data} call={call} run={run} todayIso={todayIso} />
        <WhatToDo data={data} call={call} />
        <MarketToday data={data} />
        <Learned data={data} call={call} brief={brief} run={run} />
        {run && run.picks.length > 0 && <BrainNotes data={data} run={run} />}
      </div>
      <Reveal className="mt-8 grid gap-3 text-center">
        <button type="button" onClick={() => go("details")} className="btn btn-primary justify-center">See the full dashboard <ArrowRight /></button>
        <button type="button" onClick={() => go("portfolio")} className="btn justify-center">The portfolio <ArrowRight /></button>
        <p className="meta mt-6 normal-case tracking-[0.04em]">A research notebook for one household, not financial advice. Every number here is computed by code from public market data.</p>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ post chrome */

function PostHeader({ data, todayIso }) {
  return (
    <header className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-accent/60 bg-surface font-mono text-[15px] font-medium text-accent" aria-hidden="true">sb</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-tight font-semibold">stocks·brain</div>
        <div className="meta normal-case tracking-[0.04em]">{data.sample ? "Sample data" : "Daily note"}</div>
      </div>
      <time dateTime={todayIso} className="meta shrink-0">{fmtDate(todayIso)}</time>
    </header>
  );
}

/** One square-ish "slide" of the post: a kicker, a big line, then the body. */
function Slide({ n, of, kicker, tone = "var(--accent)", delay = 0, children }) {
  return (
    <Reveal delay={delay} as="article" className="card overflow-hidden" style={{ "--tone": tone }}>
      <div className="h-1.5" style={{ background: tone }} />
      <div className="p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <span className="meta" style={{ color: tone }}>{kicker}</span>
          <span className="meta">{n} / {of}</span>
        </div>
        {children}
      </div>
    </Reveal>
  );
}

const Big = ({ children }) => <h2 className="display text-[clamp(30px,8vw,40px)] leading-[1.05] tracking-[-0.03em]">{children}</h2>;
const Para = ({ children, className = "" }) => <p className={`text-[16.5px] leading-relaxed text-ink-2 ${className}`}>{children}</p>;
const Ink = ({ children }) => <span className="text-ink">{children}</span>;

function Fact({ label, value, note }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-3 first:border-0 first:pt-0">
      <div className="min-w-0">
        <div className="text-[15px] text-ink">{label}</div>
        {note && <div className="meta mt-0.5 normal-case tracking-[0.03em]">{note}</div>}
      </div>
      <div className="shrink-0 text-right text-[15px] font-medium text-ink">{value}</div>
    </div>
  );
}

const SLIDES = 5;

/* ------------------------------------------------------------------ 1. hello */

function Hello({ data, call, run, todayIso }) {
  const lastRun = data.latest?.date ?? null;
  const asOf = call.asOf;
  return (
    <Slide n={1} of={SLIDES} kicker="Hello">
      <Big>Hi! Today is <span className="text-accent">{fmtDate(todayIso).replace(/\s\d{4}$/, "")}.</span></Big>
      <div className="mt-6">
        <Fact label="Last market close we have" value={fmtDate(asOf).replace(/\s\d{4}$/, "")} note={call.stale ? `${call.age} days old: the daily update may have failed` : relDays(asOf)} />
        <Fact label="Last time the brain ran" value={lastRun ? fmtDate(lastRun).replace(/\s\d{4}$/, "") : "Not yet"} note={lastRun ? relDays(lastRun) : null} />
        {run && <Fact label="What it flagged" value={`${numWord(run.picks.length).toLowerCase()} ${plural(run.picks.length, "name", "names")}`} note="Details in note 5" />}
      </div>
      {call.stale && <Para className="mt-5 text-down">The data is stale. Please don't act on anything below until the daily update runs again.</Para>}
    </Slide>
  );
}

/* ------------------------------------------------------------------ 2. what to do */

function WhatToDo({ data, call }) {
  const { stage, small, met, held, corePct, rec, lr, asOf, head, accent, stale } = call;
  const tone = stale ? "var(--down)" : "var(--accent)";
  const hasRule = Boolean(lr || rec);
  return (
    <Slide n={2} of={SLIDES} kicker="What should we do?" tone={tone} delay={60}>
      <Big>{head} <span style={{ color: tone }}>{accent}</span></Big>
      {!stale && (
        <Para className="mt-5">
          {hasRule && (
            <>
              The practice portfolio holds <Ink>{held.length ? held.join(", ") : "no single stocks"}</Ink>
              {corePct > 0 ? <> and <Ink>{fmtNum(corePct, 0)}%</Ink> in a plain index fund</> : null}. It takes its next look on <Ink>{fmtDate(nextRebalance(asOf))}</Ink>.{" "}
            </>
          )}
          {stage >= 2
            ? <>We are at trust stage {stage}: {STAGES[stage].money.toLowerCase()}, within the house limits.</>
            : <>No real money moves yet. We first need <Ink>{numWord(small.length).toLowerCase()} conditions</Ink> met to trust the plan, and <Ink>{met} of {small.length}</Ink> are so far.</>}
        </Para>
      )}
      <div className="mt-6 rounded-2xl border border-line-2 bg-surface-2 p-4 text-[14px] leading-relaxed text-ink-2">
        <span className="text-ink">In short:</span> keep the savings in the index fund. Anything else is a practice run on paper.
      </div>
    </Slide>
  );
}

/* ------------------------------------------------------------------ 3. the market */

function MarketToday({ data }) {
  const ctx = data.market.context;
  const spx = ctx?.instruments?.find((i) => i.role === "spx");
  const part = ctx?.participation_spx ?? ctx?.participation_ndx;
  const reg = data.regime;
  const trendWord = reg ? (reg.trend === "up" ? "going up" : reg.trend === "down" ? "going down" : "moving sideways") : null;
  const calm = reg ? (reg.state === "normal" ? "calm" : reg.state === "stressed" ? "jumpy" : reg.state) : null;
  return (
    <Slide n={3} of={SLIDES} kicker={`The market · close of ${fmtDate(data.market.as_of).replace(/\s\d{4}$/, "")}`} tone="var(--ai)" delay={120}>
      <Big>
        {reg ? <>The market is <span style={{ color: "var(--ai)" }}>{calm}, {trendWord}.</span></> : <>Here is the market <span style={{ color: "var(--ai)" }}>today.</span></>}
      </Big>
      <div className="mt-6">
        {spx && (
          <>
            <Fact label={`${spx.name}, past month`} value={fmtPct(spx.ret_20d_pct, 1)} />
            <Fact label={`${spx.name}, past year`} value={fmtPct(spx.ret_250d_pct, 1)} note={spx.from_high_pct >= -0.5 ? "right at its high" : `${fmtPct(spx.from_high_pct, 1)} from its high`} />
          </>
        )}
        {ctx?.cash_yield_pct != null && <Fact label="Cash in T-bills pays" value={`${fmtNum(ctx.cash_yield_pct, 1)}% a year`} note="the bar any stock idea has to beat" />}
      </div>
      {part && (
        <Para className="mt-5">
          {part.state === "narrow"
            ? <>A few giant companies are carrying the market. The average stock is <Ink>{fmtPct(part.eq_vs_cap_60d_pct, 1)}</Ink> against the index over 60 days, so the headline number looks stronger than most companies feel.</>
            : part.state === "broad"
              ? <>The rise is broad: the average stock is keeping up with the index, which is a healthier sign.</>
              : <>The average stock is roughly keeping pace with the index, so the picture is mixed.</>}
        </Para>
      )}
    </Slide>
  );
}

/* ------------------------------------------------------------------ 4. what we learned */

function Learned({ data, call, brief, run }) {
  const br = data.market.base_rates;
  const edge = br && br.gate.pass.ci_low != null && br.gate.pass.ci_low > 0;
  const better = br && br.gate.pass.mean != null && br.gate.fail.mean != null && br.gate.pass.mean > br.gate.fail.mean;
  const lesson = brief.lessons[0];
  const titleOf = (s) => (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1];
  return (
    <Slide n={4} of={SLIDES} kicker="What we learned" tone="var(--people)" delay={180}>
      <Big>{edge ? <>Our checks <span style={{ color: "var(--people)" }}>helped.</span></> : better ? <>A hint of help, <span style={{ color: "var(--people)" }}>nothing proven.</span></> : <>Our checks haven't <span style={{ color: "var(--people)" }}>beaten luck.</span></>}</Big>
      <ul className="mt-6 grid gap-4 text-[16px] leading-relaxed text-ink-2">
        {call.v1res && (
          <li className="relative pl-5 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-3 before:bg-people">
            On past prices, our stock-picking rule beat only <Ink>{fmtNum(call.v1res.percentile, 0)}%</Ink> of random picks from the same list. That is a test on history, not a promise.
          </li>
        )}
        {br && (
          <li className="relative pl-5 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-3 before:bg-people">
            {edge ? "Names that passed the checks did measurably better than the index afterwards." : better ? "Names that passed the checks did slightly better than the rest, but not by enough to trust." : "Names that passed the checks did no better than the ones that failed."}
          </li>
        )}
        {run?.summary && (
          <li className="relative pl-5 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-3 before:bg-people">
            <span className="text-ink">The brain's own summary:</span> {run.summary}
          </li>
        )}
      </ul>
      {lesson && (
        <figure className="mt-6 rounded-2xl border border-line-2 bg-surface-2 p-4">
          <figcaption className="meta mb-2" style={{ color: "var(--people)" }}>A lesson that fits today · {lesson.why}</figcaption>
          <blockquote className="text-[15px] leading-relaxed text-ink">{lesson.p.text}</blockquote>
          <div className="meta mt-2 truncate normal-case tracking-[0.04em]" title={lesson.p.source.title}>{titleOf(lesson.p.source)}</div>
        </figure>
      )}
    </Slide>
  );
}

/* ------------------------------------------------------------------ 5. the brain's notes */

function BrainNotes({ data, run }) {
  const picks = run.picks;
  const watching = picks.filter((p) => p.pick.stance === "neutral").length;
  return (
    <Slide n={5} of={SLIDES} kicker={`The brain's notes · ${fmtDate(run.date).replace(/\s\d{4}$/, "")}`} delay={240}>
      <Big>
        {picks.length} {plural(picks.length, "name", "names")} on the list,{" "}
        <span className="text-accent">{watching === picks.length ? "none to chase." : `${watching} just ${plural(watching, "a watch", "watches")}.`}</span>
      </Big>
      <ul className="mt-6 grid gap-0">
        {picks.map(({ id, pick }) => {
          const s = STANCE[pick.stance];
          return (
            <li key={id} className="border-t border-line py-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[20px] font-medium" style={{ color: s.tone }}>{pick.ticker}</span>
                <span className="meta" style={{ color: s.tone }}>{s.word} · {CONFIDENCE[pick.conviction]}</span>
              </div>
              <div className="mt-0.5 text-[13.5px] text-ink-3">{data.names[pick.ticker]}</div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{firstSentence(pick.thesis)}</p>
            </li>
          );
        })}
      </ul>
    </Slide>
  );
}
