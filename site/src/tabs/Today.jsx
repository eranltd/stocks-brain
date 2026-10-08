import { Fragment } from "react";
import { fmtDate, fmtNum, fmtPct, numWord, relDays, signTone } from "../lib/format.js";
import { marketBrief } from "../components/brief.jsx";
import { STAGES } from "../components/trust.jsx";
import { nextRebalance } from "../components/goal.jsx";
import { marketDay } from "../lib/marketday.js";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { ArrowRight, Reveal } from "../components/ui.jsx";
import { heldAndPicked, todayCall } from "./Details.jsx";

const STANCE = {
  bullish: { word: "Leaning up", tone: "var(--accent)" },
  bearish: { word: "Leaning down", tone: "var(--down)" },
  neutral: { word: "Just watching", tone: "var(--flat)" },
};
const CONFIDENCE = { low: "low confidence", medium: "medium confidence", high: "high confidence" };

const firstSentence = (t) => (t.match(/^.*?[.!?](\s|$)/) || [t])[0].trim();
const plural = (n, one, many) => (n === 1 ? one : many);
const noYear = (iso) => fmtDate(iso).replace(/\s\d{4}$/, ""); // "Thu, 22 Oct"
const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink" };
/** A day move coloured as it shows at `d` decimals: a fall never shows in the up colour. */
const Move = ({ v, d = 2 }) => <span className={`num ${TONE_TEXT[signTone(v, d)]}`}>{v == null ? "–" : fmtPct(v, d)}</span>;

/**
 * Home: one short, plain-language post. Hi, today is X, the last run was Y, here is what the market did,
 * what is coming up, what we learned, and what we should do. Everything is computed or copied from the data;
 * the full dashboard (old home page) lives under "Full dashboard".
 */
export default function Today({ data, go }) {
  const call = todayCall(data);
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  const todayIso = todayISO(); // New York date: market days follow its calendar
  const soon = upcoming(data, todayIso);
  const notes = Boolean(run && run.picks.length > 0);
  // Slides that have nothing to say are left out, so number the ones shown.
  const shown = ["hello", "todo", "market", soon && "soon", "learned", notes && "notes"].filter(Boolean);
  const at = (k) => ({ n: shown.indexOf(k) + 1, of: shown.length, delay: shown.indexOf(k) * 60 });
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-24 pt-6 sm:pt-10">
      <PostHeader data={data} todayIso={todayIso} />
      <div className="mt-5 grid gap-5">
        <Hello {...at("hello")} data={data} call={call} run={run} todayIso={todayIso} notesAt={notes ? at("notes").n : null} />
        <WhatToDo {...at("todo")} data={data} call={call} />
        <MarketToday {...at("market")} data={data} go={go} />
        {soon && <ComingUp {...at("soon")} data={data} go={go} soon={soon} />}
        <Learned {...at("learned")} data={data} call={call} brief={brief} run={run} />
        {notes && <BrainNotes {...at("notes")} data={data} run={run} />}
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
        <div className="mb-5 flex items-start justify-between gap-3">
          <span className="meta min-w-0" style={{ color: tone }}>{kicker}</span>
          <span className="meta shrink-0 whitespace-nowrap">{n} / {of}</span>
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

/* ------------------------------------------------------------------ 1. hello */

function Hello({ n, of, delay, data, call, run, todayIso, notesAt }) {
  const lastRun = data.latest?.date ?? null;
  const asOf = call.asOf;
  return (
    <Slide n={n} of={of} delay={delay} kicker="Hello">
      <Big>Hi! Today is <span className="text-accent">{noYear(todayIso)}.</span></Big>
      <div className="mt-6">
        <Fact label="Last market close we have" value={noYear(asOf)} note={call.stale ? `${call.age} days old: the daily update may have failed` : relDays(asOf)} />
        <Fact label="Last time the brain ran" value={lastRun ? noYear(lastRun) : "Not yet"} note={lastRun ? relDays(lastRun) : null} />
        {run && <Fact label="What it flagged" value={`${numWord(run.picks.length).toLowerCase()} ${plural(run.picks.length, "name", "names")}`} note={notesAt ? `Details in note ${notesAt}` : null} />}
      </div>
      {call.stale && <Para className="mt-5 text-down">The data is stale. Please don't act on anything below until the daily update runs again.</Para>}
    </Slide>
  );
}

/* ------------------------------------------------------------------ 2. what to do */

function WhatToDo({ n, of, delay, data, call }) {
  const { stage, small, met, held, corePct, rec, lr, asOf, head, accent, stale } = call;
  const tone = stale ? "var(--down)" : "var(--accent)";
  const hasRule = Boolean(lr || rec);
  return (
    <Slide n={n} of={of} kicker="What should we do?" tone={tone} delay={delay}>
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

/**
 * Open the full dashboard at its market section. The dashboard mounts after the tab swap (inside a view transition when
 * motion is on), so look for the section for a moment and scroll to it once it exists.
 */
function openMarketDay(go) {
  go("details");
  let tries = 0;
  const seek = () => {
    const el = document.getElementById("market-today");
    if (el) el.scrollIntoView({ block: "start" });
    else if (++tries < 40) setTimeout(seek, 50);
  };
  setTimeout(seek, 50);
}

/** The day's biggest riser or faller on our list: tap to open its Stock page. */
function MoverButton({ label, m, name, go }) {
  return (
    <button type="button" onClick={() => go(`stock/${m.symbol}`)} className="min-h-[44px] min-w-0 rounded-2xl border border-line-2 bg-surface-2 p-3 text-left hover:border-ink-3">
      <div className="meta normal-case tracking-[0.04em]">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[17px] font-medium text-ink">{m.symbol}</span>
        <span className="font-mono text-[15px]"><Move v={m.pct} d={1} /></span>
      </div>
      <div className="truncate text-[12.5px] text-ink-3">{name}</div>
    </button>
  );
}

function MarketToday({ n, of, delay, data, go }) {
  const ctx = data.market.context;
  const d = marketDay(data.market, data.watchlist, data.bench);
  const riser = d?.risers[0] ?? null;
  const faller = d?.fallers[0] ?? null;
  const spx = ctx?.instruments?.find((i) => i.role === "spx");
  const part = ctx?.participation_spx ?? ctx?.participation_ndx;
  const reg = data.regime;
  const trendWord = reg ? (reg.trend === "up" ? "going up" : reg.trend === "down" ? "going down" : "moving sideways") : null;
  const calm = reg ? (reg.state === "normal" ? "calm" : reg.state === "stressed" ? "jumpy" : reg.state) : null;
  return (
    <Slide n={n} of={of} kicker={`The market · close of ${noYear(data.market.as_of)}`} tone="var(--ai)" delay={delay}>
      <Big>
        {reg ? <>The market is <span style={{ color: "var(--ai)" }}>{calm}, {trendWord}.</span></> : <>Here is the market <span style={{ color: "var(--ai)" }}>today.</span></>}
      </Big>
      <div className="mt-6">
        {d && (
          <>
            <Fact label={`${d.spx?.name ?? "S&P 500"}, last day`} value={<Move v={d.spx?.pct} />} note={d.spx?.pct == null ? "shows after the next daily run" : null} />
            {d.bench && <Fact label="Nasdaq-100, last day" value={<Move v={d.bench.pct} />} note={d.bench.pct == null ? "shows after the next daily run" : null} />}
          </>
        )}
        {spx && (
          <>
            <Fact label={`${spx.name}, past month`} value={fmtPct(spx.ret_20d_pct, 1)} />
            <Fact label={`${spx.name}, past year`} value={fmtPct(spx.ret_250d_pct, 1)} note={spx.from_high_pct >= -0.5 ? "right at its high" : `${fmtPct(spx.from_high_pct, 1)} from its high`} />
          </>
        )}
        {ctx?.cash_yield_pct != null && <Fact label="Cash in T-bills pays" value={`${fmtNum(ctx.cash_yield_pct, 1)}% a year`} note="the bar any stock idea has to beat" />}
      </div>
      {d?.counted > 0 && (
        <Para className="mt-5">
          Of our {d.names} names, <Ink>{d.rose} rose</Ink> and <Ink>{d.fell} fell</Ink>{d.flat ? `, ${d.flat} unchanged` : ""} on the day.
        </Para>
      )}
      {(riser || faller) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {riser && <MoverButton label="Biggest riser" m={riser} name={data.names[riser.symbol]} go={go} />}
          {faller && <MoverButton label="Biggest faller" m={faller} name={data.names[faller.symbol]} go={go} />}
        </div>
      )}
      {part && (
        <Para className="mt-5">
          {part.state === "narrow"
            ? <>A few giant companies are carrying the market. The average stock is <Ink>{fmtPct(part.eq_vs_cap_60d_pct, 1)}</Ink> against the index over 60 days, so the headline number looks stronger than most companies feel.</>
            : part.state === "broad"
              ? <>The rise is broad: the average stock is keeping up with the index, which is a healthier sign.</>
              : <>The average stock is roughly keeping pace with the index, so the picture is mixed.</>}
        </Para>
      )}
      {d && (
        <button type="button" onClick={() => openMarketDay(go)} className="btn mt-6 min-h-[44px] text-[14px]">The full market day <ArrowRight /></button>
      )}
    </Slide>
  );
}

/* ------------------------------------------------------------------ 4. coming up */

/** Results dates in the next thirty days, held or picked names first; null when there is nothing to say. */
function upcoming(data, todayIso) {
  const { held, picked } = heldAndPicked(data);
  const { ahead, undated } = comingUp(data.outlook, todayIso, 30, [...held, ...picked]);
  if (!ahead.length && !undated.length) return null;
  return { rows: [...ahead.filter((r) => r.first), ...ahead.filter((r) => !r.first)], undated, held };
}

const SOON_ROWS = 5;

function ComingUp({ n, of, delay, data, go, soon }) {
  const { rows, undated, held } = soon;
  const list = rows.slice(0, SOON_ROWS);
  const more = rows.length - list.length;
  const tag = (t) => (held.includes(t) ? "held" : "picked");
  return (
    <Slide n={n} of={of} kicker="Coming up · results" delay={delay}>
      <Big>
        {rows.length
          ? <>{numWord(rows.length)} {plural(rows.length, "company reports", "companies report")} <span className="text-accent">in the next 30 days.</span></>
          : <>No results days <span className="text-accent">in the next 30 days.</span></>}
      </Big>
      {list.length > 0 && (
        <ul className="mt-6 grid gap-2">
          {list.map((r) => (
            <li key={r.ticker}>
              <button type="button" onClick={() => go(`stock/${r.ticker}`)} className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl border border-line-2 bg-surface-2 px-4 py-3 text-left hover:border-ink-3">
                <span className="min-w-0">
                  <span className="font-mono text-[16px] font-medium text-ink">{r.ticker}</span>
                  {r.first && <span className="pill ml-2 whitespace-nowrap py-0.5 text-[10.5px] text-people">{tag(r.ticker)}</span>}
                  <span className="block truncate text-[12.5px] text-ink-3">{data.names[r.ticker] ?? r.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14.5px] text-ink">{noYear(r.date)}</span>
                  <span className="meta block normal-case tracking-[0.03em]">{inDays(r.days)}{r.confirmed ? "" : " · expected"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && (
        <button type="button" onClick={() => go("details")} className="meta mt-3 min-h-[44px] normal-case tracking-[0.04em] text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-ink">
          And {more} more on the full dashboard
        </button>
      )}
      {undated.length > 0 && (
        <Para className="mt-5 text-[15px]">
          No date announced yet for{" "}
          {undated.map((u, i) => (
            <Fragment key={u.ticker}>{i ? ", " : ""}<button type="button" onClick={() => go(`stock/${u.ticker}`)} className="font-mono text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink">{u.ticker}</button> ({tag(u.ticker)})</Fragment>
          ))}.
        </Para>
      )}
      <p className="meta mt-5 normal-case tracking-[0.04em]">A results day can move a stock a lot either way: event risk, not a signal. "Expected" means the company has not confirmed the date yet.</p>
    </Slide>
  );
}

/* ------------------------------------------------------------------ 5. what we learned */

function Learned({ n, of, delay, data, call, brief, run }) {
  const br = data.market.base_rates;
  const edge = br && br.gate.pass.ci_low != null && br.gate.pass.ci_low > 0;
  const better = br && br.gate.pass.mean != null && br.gate.fail.mean != null && br.gate.pass.mean > br.gate.fail.mean;
  const lesson = brief.lessons[0];
  const titleOf = (s) => (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1];
  return (
    <Slide n={n} of={of} kicker="What we learned" tone="var(--people)" delay={delay}>
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

/* ------------------------------------------------------------------ 6. the brain's notes */

function BrainNotes({ n, of, delay, data, run }) {
  const picks = run.picks;
  const watching = picks.filter((p) => p.pick.stance === "neutral").length;
  return (
    <Slide n={n} of={of} kicker={`The brain's notes · ${noYear(run.date)}`} delay={delay}>
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
