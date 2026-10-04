import { addTradingDays } from "../lib/data.js";
import { cap, fmtDate, fmtK, fmtNum, fmtPct, fmtUsd, numWord, pad2 } from "../lib/format.js";
import { Accent, ArrowRight, Carousel, Chip, Container, Conviction, Empty, Headline, Reveal, SectionHead, Strip } from "../components/ui.jsx";

const TONE = { bullish: "var(--accent)", bearish: "var(--down)", neutral: "var(--flat)" };

export default function Today({ data, go }) {
  const { latest, lastOk, settings, sample } = data;
  if (!latest) return <Container className="py-24"><Empty title="No runs yet">The first daily run will appear here.</Empty></Container>;
  const failed = latest.status === "failed";
  const run = failed ? lastOk : latest;
  const picks = run?.picks ?? [];
  const n = picks.length;
  const recent = data.outcomes.slice().sort((a, b) => b.scored_date.localeCompare(a.scored_date) || a.ticker.localeCompare(b.ticker)).slice(0, 8);

  return (
    <>
      {/* hero */}
      <section className="relative isolate -mt-[76px] overflow-hidden pt-[76px]">
      <HeroWall items={data.kb} />
      <Container className="flex min-h-[86vh] flex-col items-center justify-center py-20 text-center">
        <Reveal>
          <span className={`pill mb-10 ${failed ? "border-down/50 text-down" : sample ? "border-dashed border-people/60 text-people" : "border-accent/40 text-accent"}`}>
            <span className={`size-2 rounded-full border-[1.5px] border-current ${failed ? "" : "border-dashed animate-[spin-slow_6s_linear_infinite]"}`} />
            {failed ? "Latest run failed closed" : sample ? "Sample run" : "Latest run"}<span className="hidden sm:inline"> · {latest.run_id}</span> · {n} {n === 1 ? "pick" : "picks"}
          </span>
        </Reveal>
        <Headline size="xl" className="max-w-[14ch]">
          {n ? `${numWord(n)} ${n === 1 ? "pick," : "picks,"}` : "No picks,"} <Accent>one call.</Accent>
        </Headline>
        <Reveal delay={350} as="p" className="mx-auto mt-8 max-w-[52ch] text-[clamp(17px,1.8vw,21px)] leading-relaxed text-ink-2">
          {run?.summary || "The brain found nothing worth flagging today."}{" "}
          <span className="text-ink">Numbers come from code; words from {fmtUsd(run?.cost.usd ?? 0)} of model time.</span>
        </Reveal>
        <Reveal delay={500} className="mt-10 flex flex-wrap justify-center gap-3">
          <a href="#picks" className="btn btn-primary">
            See today's picks
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </a>
          <button type="button" onClick={() => go("how")} className="btn">
            <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-accent">
              <svg viewBox="0 0 24 24" className="size-3" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            How it works
          </button>
        </Reveal>
        <Reveal delay={650}>
          <button type="button" onClick={() => go("runs")} className="meta mt-8 inline-flex items-center gap-2 tracking-[0.3em] text-ink-2 hover:text-ink">
            Open the run log <ArrowRight />
          </button>
        </Reveal>
      </Container>
      </section>

      <Container>
        {failed && (
          <Reveal className="card mb-8 flex items-start gap-4 border-down/40 p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-down/15 text-down">✕</span>
            <div>
              <div className="meta text-down">stopped · {fmtDate(latest.date)}</div>
              <p className="mt-1 text-ink">{latest.failure_reason}</p>
              <p className="mt-1 text-[14px] text-ink-3">Showing the last successful run ({run ? fmtDate(run.date) : "none"}).</p>
            </div>
          </Reveal>
        )}

        <Strip
          cells={[
            { value: n, label: n === 1 ? "pick" : "picks", desc: "At most " + data.guardrails.max_picks + ". Zero is a valid answer." },
            { value: 1, label: "AI call", tone: "ai", desc: `Schema-checked output, ${run?.repair_retries ? "one repair retry used" : "no repair needed"}.` },
            { value: fmtUsd(run?.cost.usd ?? 0), label: "cost", tone: (run?.cost.usd ?? 0) > settings.cost.warn_usd ? "people" : "accent", desc: `Target ${fmtUsd(settings.cost.target_usd)}, warn above ${fmtUsd(settings.cost.warn_usd)}.` },
            { value: fmtK(run?.pack.tokens ?? 0), label: "pack tokens", tone: "flat", desc: `Hard cap ${fmtK(run?.pack.cap_tokens ?? 0)}. Over the cap, the run stops.`, meter: run ? run.pack.tokens / run.pack.cap_tokens : 0 },
          ]}
        />

        <section id="picks" className="scroll-mt-28 pt-28">
          <SectionHead
            eyebrow={`Today · ${run ? fmtDate(run.date) : ""}`}
            title={<>What the brain <Accent>flagged.</Accent></>}
            lede="Each pick is a stance, a thesis and the condition that would prove it wrong. Code attaches the reference price and scores it after the horizon."
          />
          {n ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {picks.map((p, i) => <PickCard key={p.id} item={p} i={i} name={data.names[p.pick.ticker]} horizon={settings.scoring.horizon_days} />)}
            </div>
          ) : (
            <Empty title="No picks today">Fewer, clearer picks beat many weak ones. Zero is allowed.</Empty>
          )}
        </section>

        <LatestInsights library={data.library} go={go} />

        {recent.length > 0 && (
          <section className="pt-28">
            <SectionHead
              eyebrow="Recently scored"
              title={<>The last <Accent>{settings.scoring.horizon_days} days</Accent>, judged.</>}
              right={null}
            />
            <Carousel meta={`${recent.length} scored`}>
              {recent.map((o, i) => <ScoredCard key={o.pick_id} o={o} i={i} name={data.names[o.ticker]} onOpen={() => go("track")} />)}
            </Carousel>
          </section>
        )}
      </Container>
    </>
  );
}

/** Tilted wall of faded KB cards drifting in opposite directions behind the hero headline. */
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
        <Chip kind={k.verdict} className="py-1 text-[10px]">{k.verdict}</Chip>
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
          <span className="text-ink">ref <span className="num">{fmtNum(item.ref_price)}</span></span>
          <span className="num">{item.ref_date} → {addTradingDays(item.ref_date, horizon)}</span>
        </div>
      </div>
    </Reveal>
  );
}

export function ScoredCard({ o, i, name, onOpen }) {
  const tone = o.verdict === "hit" ? "var(--accent)" : o.verdict === "miss" ? "var(--down)" : "var(--flat)";
  return (
    <Reveal delay={i * 70} as="article" className="card card-hover w-[min(86vw,380px)] shrink-0 snap-start overflow-hidden" style={{ "--tone": tone }}>
      <div className="stripes flex h-40 flex-col justify-between border-b-2 p-6" style={{ borderColor: tone }}>
        <div className="flex items-start justify-between">
          <span className="font-mono text-[28px] font-medium" style={{ color: tone }}>{o.ticker}</span>
          <span className="meta">{o.horizon_days}d horizon</span>
        </div>
        <div className="display num text-[54px] leading-none">{fmtPct(o.excess_pct, 1)}</div>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <Chip kind={o.verdict} />
          <Conviction level={o.conviction} />
        </div>
        <div className="mt-4 text-[18px] font-semibold tracking-[-0.02em]">{cap(o.stance)} on {name}</div>
        <p className="mt-2 font-mono text-[13px] text-ink-2 num">
          pick {fmtPct(o.return_pct)} vs bench {fmtPct(o.benchmark_return_pct)}
        </p>
        <button type="button" onClick={onOpen} className="meta mt-5 flex w-full items-center justify-between border-t border-line pt-4 text-ink hover:text-accent">
          <span className="inline-flex items-center gap-2">{o.pick_id} <ArrowRight className="size-3.5 -rotate-45" /></span>
          <span className="text-ink-3">scored {o.scored_date}</span>
        </button>
      </div>
    </Reveal>
  );
}

function LatestInsights({ library, go }) {
  const sources = [...(library?.sources ?? [])].sort((a, b) => (b.published ?? b.added).localeCompare(a.published ?? a.added));
  if (!sources.length) return null;
  const picks = sources.slice(0, 3).map((s) => ({ s, p: s.principles[0] }));
  const total = sources.reduce((a, s) => a + s.principles.length, 0);
  return (
    <section className="pt-28">
      <SectionHead
        eyebrow="From the library"
        title={<>Latest <Accent>insights.</Accent></>}
        lede={`${sources.length} sources and ${total} principles so far. These are from the newest videos.`}
        right={<button type="button" onClick={() => go("insights")} className="btn">All insights <ArrowRight /></button>}
      />
      <div className="grid gap-5 md:grid-cols-3">
        {picks.map(({ s, p }, i) => (
          <Reveal key={s.id} delay={i * 90} as="article" className="card card-hover brackets flex flex-col p-7">
            <span className="meta">{s.published ?? s.year} · {p.id}</span>
            <p className="mt-4 text-[17px] leading-relaxed tracking-[-0.01em]">{p.text}</p>
            <div className="meta mt-auto truncate border-t border-line pt-4 normal-case tracking-[0.04em] [margin-top:max(1.5rem,auto)]" title={s.title}>
              {(s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1]}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
