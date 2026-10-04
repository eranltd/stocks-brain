import { fmtPct, numWord } from "../lib/format.js";
import { Accent, ArrowRight, Headline, Reveal } from "./ui.jsx";

/**
 * Live market brief, built by code from derived prices, the regime and the library.
 * No model involved: conditions map to library tags, and the principles carrying those tags are shown.
 */
export function marketBrief(data) {
  const { market, regime, bench, library, observations, watchlist } = data;
  const members = market.symbols.filter((s) => s.symbol !== bench.symbol);
  const rel = members.filter((s) => s.vs_bench_20d_pct != null).sort((a, b) => b.vs_bench_20d_pct - a.vs_bench_20d_pct);
  const leaders = rel.filter((s) => s.vs_bench_20d_pct > 0);
  const dd = regime?.metrics.drawdown_pct ?? -100;
  const nearHigh = dd > -2;
  const narrow = members.length > 0 && leaders.length / members.length < 0.35;

  const lead = nearHigh ? `${bench.symbol} at its high.` : dd <= -10 ? `${bench.symbol} ${Math.abs(dd).toFixed(0)}% off its high.` : `${bench.symbol} ${regime?.trend === "down" ? "in a downtrend" : "holding up"}.`;
  const accent = `${numWord(leaders.length)} of ${numWord(members.length).toLowerCase()} ${leaders.length === 1 ? "beats" : "beat"} it.`;

  // Conditions -> library tags. Each condition contributes at most one principle.
  const conds = [
    narrow && { why: "Leadership is narrow", tags: ["breadth", "benchmark", "conviction", "leadership"] },
    nearHigh && { why: `${bench.symbol} is at a 1-year high`, tags: ["all_time_highs"] },
    (regime?.metrics.dist_sma_pct ?? 0) > 5 && { why: "The index is stretched above its trend", tags: ["overextension"] },
    regime?.state === "stressed" && { why: "Volatility is stressed", tags: ["volatility", "risk"] },
    regime?.trend === "down" && { why: "The trend is down", tags: ["bottoms", "invalidation"] },
    data.market.breadth_above_sma50_pct != null && data.market.breadth_above_sma50_pct < 30 && { why: "Most names are below their 50-day", tags: ["breadth", "bottoms"] },
  ].filter(Boolean);
  const principles = (library?.sources ?? []).flatMap((s) => s.principles.map((p) => ({ ...p, source: s })));
  const used = new Set();
  const lessons = conds.map((c) => {
    const best = principles
      .filter((p) => !used.has(p.id))
      .map((p) => ({ p, score: p.tags.filter((t) => c.tags.includes(t)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.p.source.published ?? "").localeCompare(a.p.source.published ?? ""))[0];
    if (!best) return null;
    used.add(best.p.id);
    return { why: c.why, p: best.p };
  }).filter(Boolean).slice(0, 3);

  const today = new Date().toISOString().slice(0, 10);
  const mine = new Set([...watchlist.symbols.flatMap((s) => [s.symbol, ...(s.aliases ?? [])]), bench.symbol]);
  const claims = (observations?.items ?? [])
    .filter((o) => o.expires >= today && o.tickers.some((t) => mine.has(t)))
    .sort((a, b) => b.as_of.localeCompare(a.as_of))
    .slice(0, 6);
  return { lead, accent, leaders, laggards: [...rel].reverse(), top: rel[0], bottom: rel.at(-1), lessons, claims, narrow };
}

export function BriefHero({ data, brief, go }) {
  const { market, regime, bench } = data;
  return (
    <>
      <Reveal>
        <span className="pill mb-10 border-accent/40 text-accent">
          <span className="size-2 animate-pulse rounded-full bg-current" />
          Live market brief · {market.provider} · {market.as_of}
        </span>
      </Reveal>
      <Headline size="xl" className="max-w-[16ch]">{brief.lead} <Accent>{brief.accent}</Accent></Headline>
      <Reveal delay={350} as="p" className="mx-auto mt-8 max-w-[56ch] text-[clamp(17px,1.8vw,21px)] leading-relaxed text-ink-2">
        Regime <span className="text-ink">{regime?.label}</span>. {market.breadth_above_sma50_pct}% of the watchlist is above its 50-day average.
        {brief.top && <> Over 20 days <span className="text-ink">{brief.top.symbol}</span> leads ({fmtPct(brief.top.vs_bench_20d_pct, 1)} vs {bench.symbol}) and <span className="text-ink">{brief.bottom.symbol}</span> lags most ({fmtPct(brief.bottom.vs_bench_20d_pct, 1)}).</>}
      </Reveal>
      <Reveal delay={500} className="mt-10 flex flex-wrap justify-center gap-3">
        <a href="#brief" className="btn btn-primary">
          Today's read
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </a>
        <button type="button" onClick={() => go("watchlist")} className="btn">Watchlist <ArrowRight /></button>
      </Reveal>
    </>
  );
}

export function BriefSections({ data, brief, go }) {
  const { bench } = data;
  const titleOf = (s) => (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1];
  return (
    <section id="brief" className="scroll-mt-28 pt-24">
      <div className="eyebrow mb-5">Today's read · computed, not generated</div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Lessons in play</h3>
            <button type="button" onClick={() => go("insights")} className="meta inline-flex items-center gap-1 hover:text-ink">Insights <ArrowRight className="size-3.5" /></button>
          </div>
          <p className="mt-1 text-[14px] text-ink-3">Today's conditions, matched to principles from your library by tag.</p>
          <ol className="mt-6 grid gap-5">
            {brief.lessons.map(({ why, p }) => (
              <li key={p.id} className="border-t border-line pt-5 first:border-0 first:pt-0">
                <div className="meta text-accent">{why}</div>
                <p className="mt-2 text-[16px] leading-relaxed">{p.text}</p>
                <div className="meta mt-2 truncate normal-case tracking-[0.04em]" title={p.source.title}>{p.id} · {titleOf(p.source)}</div>
              </li>
            ))}
            {!brief.lessons.length && <li className="text-ink-3">No condition stands out today.</li>}
          </ol>
        </Reveal>
        <div className="grid gap-5">
          <Reveal delay={80} className="card p-6 sm:p-8">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">20 days vs {bench.symbol}</h3>
            <div className="mt-5 grid gap-2.5">
              {brief.leaders.length ? null : <p className="text-[14px] text-ink-3">No watchlist name beats the benchmark.</p>}
              {[...brief.laggards].reverse().map((s) => {
                const v = s.vs_bench_20d_pct;
                const w = Math.min(100, (Math.abs(v) / Math.max(...brief.laggards.map((x) => Math.abs(x.vs_bench_20d_pct)), 1)) * 100);
                return (
                  <button type="button" key={s.symbol} onClick={() => go(`stock/${s.symbol}`)} aria-label={`Open ${s.symbol}`}
                    className="grid min-h-[36px] grid-cols-[56px_minmax(0,1fr)_64px] items-center gap-3 rounded-lg text-left text-[13.5px] hover:bg-ink/[0.04]">
                    <span className="font-semibold">{s.symbol}</span>
                    <div className="relative h-2 rounded-full bg-line">
                      <div className={`absolute top-0 h-2 rounded-full ${v >= 0 ? "left-1/2 bg-accent" : "right-1/2 bg-down"}`} style={{ width: `${w / 2}%` }} />
                      <div className="absolute top-[-3px] left-1/2 h-[14px] w-px bg-line-2" />
                    </div>
                    <span className={`num text-right font-mono ${v >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(v, 1)}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>
          <Reveal delay={160} className="card p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Claims on your names</h3>
              <span className="meta">{brief.claims.length} live</span>
            </div>
            <p className="mt-1 text-[14px] text-ink-3">Unexpired claims from your sources. Unverified.</p>
            <ul className="mt-5 grid gap-4">
              {brief.claims.map((c) => (
                <li key={c.id} className="border-t border-line pt-4 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.tickers.map((t) => <span key={t} className="font-mono text-[13px] font-medium text-accent">{t}</span>)}
                    <span className="meta ml-auto">{c.as_of} → {c.expires}</span>
                  </div>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{c.text}</p>
                </li>
              ))}
              {!brief.claims.length && <li className="text-[14px] text-ink-3">No live claims about your watchlist.</li>}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
