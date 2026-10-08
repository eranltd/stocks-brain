import { Fragment } from "react";
import { addTradingDays } from "../lib/data.js";
import { daysBetween } from "../lib/stats.js";
import { cap, fmtDate, fmtNum, fmtPct, pad2 } from "../lib/format.js";
import { BriefSections, marketBrief } from "../components/brief.jsx";
import { BaseRates, GoalSection, MarketContext, PortfolioNow, nextRebalance } from "../components/goal.jsx";
import { STAGES, TrustLadder, trustStage } from "../components/trust.jsx";
import { callsTouching, joinCalls, shortVia, statusPhrase } from "../lib/people.js";
import { marketDay, shortSector } from "../lib/marketday.js";
import { comingUp, inDays } from "../lib/outlook.js";
import { Accent, ArrowRight, Chip, Container, Conviction, Headline, Reveal, SectionHead, Strip } from "../components/ui.jsx";

const TONE = { bullish: "var(--accent)", bearish: "var(--down)", neutral: "var(--flat)" };

/**
 * Home: the decision first. Verdict (computed from the trust stage, data freshness and the rule),
 * then the goal check, the portfolio, market context, whether the rules work, and the trust ladder.
 */
export default function Today({ data, go }) {
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  return (
    <>
      <section className="relative isolate -mt-[76px] overflow-hidden pt-[76px]">
        {/* Decoration must not show fake calls: the wall shows real library principles. */}
        <HeroWall items={libraryWall(data.library)} />
        <Container className="flex min-h-[82vh] flex-col items-center justify-center py-20 text-center">
          <Verdict data={data} go={go} />
        </Container>
      </section>
      <Container>
        <MarketToday data={data} go={go} />
        <ComingUp data={data} go={go} />
        <GoalSection data={data} />
        <PortfolioNow data={data} go={go} />
        <PeopleNote data={data} go={go} />
        <MarketContext data={data} />
        <BaseRates data={data} />
        <div className="pt-24"><TrustLadder data={data} go={go} /></div>
        <BriefSections data={data} brief={brief} go={go} />
        {run && run.picks.length > 0 && (
          <section id="picks" className="scroll-mt-28 pt-24">
            <SectionHead eyebrow={`The brain · ${fmtDate(run.date)}`} title={<>What the brain <Accent>flagged.</Accent></>}
              lede="The brain runs by itself every market morning. Each pick is a stance, a thesis and the condition that would prove it wrong. Code scores it after the horizon." size="md" />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {run.picks.map((p, i) => <PickCard key={p.id} item={p} i={i} name={data.names[p.pick.ticker]} horizon={data.settings.scoring.horizon_days} />)}
            </div>
          </section>
        )}
        <p className="meta mt-20 normal-case tracking-[0.04em]">A research notebook for one household, not financial advice. Every number on this page is computed by code from public market data.</p>
      </Container>
    </>
  );
}

const jumpToMarket = (e) => { e.preventDefault(); document.getElementById("market-today")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
const upDown = (v) => (v == null ? "" : v >= 0.05 ? "text-accent" : v <= -0.05 ? "text-down" : "text-ink-2"); // as shown, to one decimal
const day = (iso) => fmtDate(iso).replace(/ \d{4}$/, ""); // "Thu, 22 Oct"

/** One of the day's biggest movers on our list: tap to open its Stock page. */
function Mover({ m, name, go }) {
  return (
    <li>
      <button type="button" onClick={() => go(`stock/${m.symbol}`)} className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left hover:border-ink-3">
        <span className="min-w-0">
          <span className="font-mono text-[14px] font-semibold">{m.symbol}</span>
          <span className="block truncate text-[12px] text-ink-3">{name}</span>
        </span>
        <span className={`num shrink-0 font-mono text-[14px] ${upDown(m.pct)}`}>{fmtPct(m.pct, 1)}</span>
      </button>
    </li>
  );
}

/** What the market did at the last close: index moves, our names' moves, sectors, and why the "why" is missing. */
function MarketToday({ data, go }) {
  const d = marketDay(data.market, data.watchlist, data.bench);
  if (!d || !d.names) return null;
  const lead = d.spx?.pct ?? d.bench?.pct ?? null;
  const who = d.spx?.pct != null ? "The market" : "The Nasdaq-100"; // the S&P 500 leads; older data has only the benchmark's move
  const verb = lead == null ? null : lead > 0.05 ? "rose" : lead < -0.05 ? "fell" : "barely moved";
  const verbTone = verb === "rose" ? "text-accent" : verb === "fell" ? "text-down" : "text-ink-2"; // a fall never shows in the up colour
  const pctOr = (v) => (v == null ? "–" : fmtPct(v, 2));
  const tone = (v) => (v == null || Math.abs(v) < 0.005 ? "flat" : v > 0 ? "accent" : "down"); // as shown, to two decimals
  return (
    <section id="market-today" className="scroll-mt-28 pt-16 sm:pt-24">
      <SectionHead eyebrow={`${data.livePrices ? "What the market did" : "Sample prices, not the market"} · ${fmtDate(d.date)}`} size="md"
        title={verb ? <>{who} <span className={verbTone}>{verb}.</span></> : <>The last <Accent>close.</Accent></>}
        lede={<>{d.counted ? <>Of our {d.names} names, <span className="text-ink">{d.rose} rose</span> and <span className="text-ink">{d.fell} fell</span>{d.flat ? `, ${d.flat} unchanged` : ""}.</> : <>Day moves of our names appear after the next daily run.</>} Day moves are percent changes from the close before; tap a name to open it.</>} />
      <Strip dense cells={[
        { value: pctOr(d.spx?.pct), label: d.spx?.name ?? "S&P 500", tone: tone(d.spx?.pct), desc: d.spx?.pct == null ? "Its day move appears after the next daily run." : "The broad US market, by size." },
        { value: pctOr(d.bench?.pct), label: d.bench ? `Nasdaq-100 (${d.bench.symbol})` : "Nasdaq-100", tone: tone(d.bench?.pct), desc: "Our benchmark: the hundred largest Nasdaq companies." },
        { value: d.counted ? `${d.rose}/${d.fell}` : "–", label: "our names up/down", tone: "flat", desc: `${d.counted} of ${d.names} names on our list.` },
        { value: d.breadth == null ? "–" : `${fmtNum(d.breadth, 0)}%`, label: "above 50-day avg", tone: "flat", desc: "Share of our names above their fifty-day average: a slow read of breadth." },
      ]} />
      {(d.risers.length > 0 || d.fallers.length > 0) && (
        <Reveal className="card mt-4 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div className="min-w-0">
              <div className="meta mb-2 text-accent">Biggest risers</div>
              <ul className="grid gap-2">{d.risers.map((m) => <Mover key={m.symbol} m={m} name={data.names[m.symbol]} go={go} />)}{!d.risers.length && <li className="text-[13px] text-ink-3">None rose.</li>}</ul>
            </div>
            <div className="min-w-0">
              <div className="meta mb-2 text-down">Biggest fallers</div>
              <ul className="grid gap-2">{d.fallers.map((m) => <Mover key={m.symbol} m={m} name={data.names[m.symbol]} go={go} />)}{!d.fallers.length && <li className="text-[13px] text-ink-3">None fell.</li>}</ul>
            </div>
          </div>
          {d.sectors.length > 0 && (
            <p className="mt-5 text-[13.5px] leading-relaxed text-ink-2">
              <span className="meta mr-2">By sector</span>
              {d.sectors.map((x, i) => (
                <Fragment key={x.sector}>{i ? " · " : ""}<span className="whitespace-nowrap">{shortSector(x.sector)} <span className={`num font-mono ${upDown(x.avg)}`}>{fmtPct(x.avg, 1)}</span></span></Fragment>
              ))}
            </p>
          )}
        </Reveal>
      )}
      <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
        {d.spx && d.spx.pct == null && <>The {d.spx.name}'s day move appears after the next daily run. </>}
        {d.spx?.fromHigh != null && <>The {d.spx.name} is {d.spx.fromHigh > -0.05 ? "at" : `${Math.abs(d.spx.fromHigh).toFixed(1)}% below`} its one-year high. </>}
        {d.breadth != null && <>{fmtNum(d.breadth, 0)}% of our names are above their fifty-day average. </>}
      </p>
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        Why it moved is not connected yet: news feeds cost money, so this shows what moved, not why. The US market closes at 4 pm New York time (20:00 UTC; 21:00 in winter) and our data arrives after the nightly run, so this updates overnight.
      </p>
    </section>
  );
}

/** Earnings dates for our names in the next thirty days, from the outlook cards; held or picked names first. Hidden when none. */
function ComingUp({ data, go }) {
  const today = new Date().toISOString().slice(0, 10);
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  const held = paper?.rebalances.at(-1)?.holdings ?? (data.livePrices ? data.longrun?.now.holdings : null) ?? [];
  const picked = data.sample ? [] : (data.lastOk?.picks ?? []).map((p) => p.pick.ticker);
  const rows = comingUp(data.outlook, today, 30, [...picked, ...held]);
  if (!rows.length) return null;
  return (
    <Reveal className="card mt-6 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="meta text-accent">Coming up · earnings</div>
        <span className="meta normal-case tracking-[0.04em]">next 30 days</span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.ticker}>
            <button type="button" onClick={() => go(`stock/${r.ticker}`)} className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-left hover:border-ink-3">
              <span className="min-w-0">
                <span className="font-mono text-[14px] font-semibold">{r.ticker}</span>
                <span className="ml-2 text-[13px] text-ink-3">{r.name}</span>
                {r.first && <span className="ml-2 text-[11.5px] text-people">held or picked</span>}
              </span>
              <span className="shrink-0 text-right text-[13px]">
                <span className="block text-ink">{day(r.date)}</span>
                <span className="block text-[12px] text-ink-3">{inDays(r.days)}{r.confirmed ? "" : " · expected"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">A results day can move a stock a lot either way: event risk, not a signal. Dates from each company's outlook card; "expected" means the company has not confirmed it yet.</p>
    </Reveal>
  );
}

/** One line linking to People when a logged public call touches a name the paper record holds or the brain picked. */
function PeopleNote({ data, go }) {
  const calls = joinCalls(data.people, data.peopleScores);
  if (!calls.length) return null;
  const judge = data.peopleScores?.judge_at_weeks ?? 26;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  const held = paper?.rebalances.at(-1)?.holdings ?? (data.livePrices ? data.longrun?.now.holdings : null) ?? [];
  const picked = data.sample ? [] : (data.lastOk?.picks ?? []).map((p) => p.pick.ticker);
  const touching = callsTouching(calls, [...held, ...picked]);
  if (!touching.length) return null;
  return (
    <Reveal className="card mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <div className="meta mb-2 text-people">People we learn from</div>
        <p className="text-[15px] leading-relaxed text-ink-2">
          {touching.length === 1 ? "A logged public call touches" : `${touching.length} logged public calls touch`} names held or picked here:{" "}
          {touching.map((c, i) => (
            <span key={c.id}>{i ? "; " : ""}<span className="font-mono text-ink">{c.ticker}</span> {c.stance} by {shortVia(c.via)} ({c.source_kind === "13f" ? "13F filed" : "public"} {fmtDate(c.date).replace(/^\w+, /, "")}): {statusPhrase(c, judge)}</span>
          ))}. Context only: each is scored against the core.
        </p>
      </div>
      <button type="button" onClick={() => go("people")} className="btn shrink-0 self-start sm:self-center">Their calls <ArrowRight /></button>
    </Reveal>
  );
}

const VERDICT_WORD = { passes_history: "passes history", candidate: "candidate", inconclusive: "inconclusive", rejected: "rejected" };

function Verdict({ data, go }) {
  const { stage, small } = trustStage(data);
  const asOf = data.market.as_of;
  const age = daysBetween(asOf, new Date().toISOString().slice(0, 10));
  const stale = age > 4;
  const lr = data.longrun;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  // The forward paper record is what the household follows; the history test's path can differ (it keeps names it already held).
  const rec = paper?.rebalances.at(-1) ?? null;
  const held = rec ? rec.holdings : (lr?.now.holdings ?? []);
  const corePct = rec ? rec.core_pct : (lr?.now.diversification.core_pct ?? 100);
  const met = small.filter((c) => c.ok).length;
  const rebalanceToday = stage >= 2 && rec?.date === asOf;
  const v1res = data.rulesResult?.satellite?.rules?.find((r) => r.id === "baseline_portfolio_v1"); // the frozen history verdict

  let head, accent;
  if (stale) [head, accent] = ["Data is stale.", "Don't act on it."];
  else if (rebalanceToday) [head, accent] = ["Rebalance day.", "Follow the rule, nothing more."];
  else [head, accent] = ["Nothing to do today.", stage >= 2 ? "Hold the portfolio." : "The core plan stands."];

  return (
    <>
      <Reveal>
        <a href="#market-today" onClick={jumpToMarket} title="What the market did at this close"
          className={`pill mb-10 min-h-[36px] hover:bg-surface ${stale ? "border-down/50 text-down" : data.livePrices ? "border-accent/40 text-accent" : "border-dashed border-people/60 text-people"}`}>
          <span className="size-2 rounded-full bg-current" />
          {data.livePrices ? "Market close" : "Sample prices"} · {fmtDate(asOf)}{stale ? ` · ${age} days old` : ""}
          <span aria-hidden="true">↓</span>
        </a>
      </Reveal>
      <Headline size="xl" className="max-w-[15ch]">{head} <Accent>{accent}</Accent></Headline>
      <Reveal delay={350} as="p" className="mx-auto mt-8 max-w-[58ch] text-[clamp(17px,1.8vw,21px)] leading-relaxed text-ink-2">
        {stale ? (
          <>The newest market close in the data is {fmtDate(asOf)}. The daily routine may have failed; check Routines before reading anything else.</>
        ) : (
          <>
            {lr || rec ? <>{rec ? "The rule's paper portfolio holds" : "The rule would hold"} <span className="text-ink">{held.length ? held.join(", ") : "no stocks"}</span>{corePct > 0 ? <> and {fmtNum(corePct, 0)}% index fund</> : null}; it next looks on {fmtDate(nextRebalance(asOf))}. {v1res ? <>On past prices its Playbook test reads <span className="text-ink">{VERDICT_WORD[v1res.verdict] ?? v1res.verdict}</span>: it beat {fmtNum(v1res.percentile, 0)}% of random picks from the same list. </> : null}</> : null}
            {stage >= 2 ? <>Trust stage {stage}: {STAGES[stage].money.toLowerCase()}, within the house limits.</> : <>No money moves until trust stage 2: <span className="text-ink">{met} of {small.length}</span> conditions met.</>}
          </>
        )}
      </Reveal>
      <Reveal delay={500} className="mt-10 flex flex-wrap justify-center gap-3">
        {stale ? (
          <button type="button" onClick={() => go("routines")} className="btn btn-primary">Open routines <ArrowRight /></button>
        ) : (
          <a href="#goal" className="btn btn-primary">
            The +{data.settings.goal.annual_return_pct}% goal check
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </a>
        )}
        <button type="button" onClick={() => go("portfolio")} className="btn">The portfolio <ArrowRight /></button>
      </Reveal>
      <Reveal delay={600}>
        <a href="#market-today" onClick={jumpToMarket}
          className="meta mt-4 inline-flex min-h-[44px] items-center gap-2 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
          What the market did at the close
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </a>
      </Reveal>
    </>
  );
}

/** Tilted wall of faded KB cards drifting in opposite directions behind the hero headline. */
function libraryWall(library) {
  return (library?.sources ?? []).flatMap((s) => s.principles.map((p) => ({
    id: p.id, principle: true, title: (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1], text: p.text, tag: p.tags[0], date: s.published ?? String(s.year),
  })));
}

function HeroWall({ items }) {
  const COLS = 7;
  const pool = items.length ? items : [];
  const columns = Array.from({ length: COLS }, (_, c) => pool.filter((_, i) => i % COLS === c).slice(0, 5));
  if (!pool.length) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute top-1/2 left-1/2 flex w-[190%] -translate-x-1/2 -translate-y-1/2 rotate-[-13deg] gap-6 sm:w-[150%]">
        {columns.map((col, c) => (
          <div key={c} className={`min-w-0 flex-1 flex-col gap-6 ${c >= 4 ? "hidden sm:flex" : "flex"}`} style={{ animation: `${c % 2 ? "wall-down" : "wall-up"} ${70 + c * 9}s linear infinite` }}>
            {[...col, ...col].map((k, i) => <WallCard key={`${k.id}-${i}`} k={k} />)}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_58%_52%_at_50%_52%,var(--bg)_35%,transparent_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--bg)_0%,transparent_18%,transparent_70%,var(--bg)_100%)]" />
    </div>
  );
}

function WallCard({ k }) {
  if (k.principle) {
    return (
      <div className="rounded-[22px] border border-line-2 bg-surface/80 p-6 opacity-35 sm:opacity-50">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.18em] text-ink-3 uppercase">{k.id}</span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">{k.tag.replaceAll("_", " ")}</span>
        </div>
        <p className="mt-5 line-clamp-4 text-[17px] leading-snug text-ink-2">{k.text}</p>
        <div className="mt-5 truncate font-mono text-[11px] tracking-[0.14em] text-ink-3">{k.date} · {k.title}</div>
      </div>
    );
  }
  const tone = k.stance === "bullish" ? "text-accent" : k.stance === "bearish" ? "text-down" : "text-ink-2";
  return (
    <div className="rounded-[22px] border border-line-2 bg-surface/80 p-6 opacity-35 sm:opacity-50">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.18em] text-ink-3 uppercase">{k.id}</span>
        <Conviction level={k.conviction} showLabel={false} />
      </div>
      <div className={`mt-5 font-mono text-[34px] leading-none ${tone}`}>{k.ticker}</div>
      <p className="mt-4 line-clamp-3 text-[15px] leading-snug text-ink-2">{k.thesis}</p>
      <div className="mt-5 flex items-center justify-between">
        <Chip kind={k.verdict} className="py-1 text-[11px]">{k.verdict}</Chip>
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3">{k.date}</span>
      </div>
    </div>
  );
}

export function PickCard({ item, i, name, horizon }) {
  const { pick } = item;
  const tone = TONE[pick.stance];
  return (
    <Reveal delay={i * 90} as="article" className="card card-hover group overflow-hidden" style={{ "--tone": tone }}>
      <div className="stripes relative h-56 border-b-2 px-7 pt-6" style={{ borderColor: tone }}>
        <div className="flex items-start justify-between">
          <span className="display text-[96px] leading-[0.8] font-medium tracking-[-0.06em] text-ink transition-transform duration-700 group-hover:-translate-y-1">{pad2(i + 1)}</span>
          <Conviction level={pick.conviction} />
        </div>
        <div className="absolute bottom-6 left-7 right-7">
          <div className="font-mono text-[32px] leading-none font-medium tracking-[-0.02em]" style={{ color: tone }}>{pick.ticker}</div>
          <div className="meta mt-3">{pick.stance} · {name}</div>
        </div>
      </div>
      <div className="p-7">
        <div className="flex items-center justify-between gap-3">
          <Chip kind={pick.stance} />
          <span className="meta">+{horizon} trading days</span>
        </div>
        <p className="mt-5 text-[16px] leading-relaxed text-ink">{pick.thesis}</p>
        <div className="mt-6 grid gap-4 text-[14px]">
          <div>
            <div className="meta mb-2">Risks</div>
            <ul className="grid gap-1 text-ink-2">
              {pick.risks.map((r) => <li key={r} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2 before:bg-ink-3">{r}</li>)}
            </ul>
          </div>
          <div>
            <div className="meta mb-2">Wrong if</div>
            <p className="text-ink-2">{pick.invalidation}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-1.5">
          {pick.evidence.map((e) => <span key={e} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2">{e}</span>)}
        </div>
        <div className="meta mt-6 flex items-center justify-between border-t border-line pt-5">
          <span className="text-ink">{item.ref_price != null ? <>ref <span className="num">{fmtNum(item.ref_price)}</span></> : "from the close of"}</span>
          <span className="num">{item.ref_date} → {addTradingDays(item.ref_date, horizon)}</span>
        </div>
      </div>
    </Reveal>
  );
}
