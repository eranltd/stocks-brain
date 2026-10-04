import { ArrowRight, Reveal } from "./ui.jsx";

/**
 * Lessons and claims for today, built by code from derived prices, the regime and the library.
 * No model involved: conditions map to library tags, and the principles carrying those tags are shown.
 */
export function marketBrief(data) {
  const { market, regime, bench, library, observations, watchlist } = data;
  const members = market.symbols.filter((s) => s.symbol !== bench.symbol);
  const dd = regime?.metrics.drawdown_pct ?? -100;
  const nearHigh = dd > -2;
  // Breadth from equal-weight vs cap-weight funds (real participation), not from our 8 names.
  const part = market.context?.participation_ndx?.state;
  const stretched = members.filter((s) => s.setup?.stretched);

  const conds = [
    part === "narrow" && { why: "A few giants carry the index", tags: ["breadth", "megacap", "concentration"] },
    nearHigh && { why: `${bench.symbol} is at a 1-year high`, tags: ["all_time_highs"] },
    stretched.length > 0 && { why: `${stretched.map((s) => s.symbol).join(", ")} stretched above trend`, tags: ["overextension", "mean_reversion"] },
    (regime?.metrics.dist_sma_pct ?? 0) > 5 && { why: "The index is stretched above its trend", tags: ["overextension"] },
    regime?.state === "stressed" && { why: "Volatility is stressed", tags: ["volatility", "risk"] },
    regime?.trend === "down" && { why: "The trend is down", tags: ["bottoms", "invalidation"] },
    market.context?.core?.trend_filter && !market.context.core.trend_filter.on && { why: "The core's slow trend filter is off", tags: ["trend", "regime", "drawdown"] },
    { why: "The goal: a diverse 4–5 stock portfolio", tags: ["diversification", "concentration", "correlation", "position_sizing"] },
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

  // Claims only about the watchlist itself (aliases included), never about the benchmark.
  const today = new Date().toISOString().slice(0, 10);
  const mine = new Set(watchlist.symbols.flatMap((s) => [s.symbol, ...(s.aliases ?? [])]));
  const claims = (observations?.items ?? [])
    .filter((o) => o.expires >= today && o.tickers.some((t) => mine.has(t)))
    .sort((a, b) => b.as_of.localeCompare(a.as_of))
    .slice(0, 4);
  return { lessons, claims };
}

export function BriefSections({ data, brief, go }) {
  const titleOf = (s) => (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1];
  return (
    <section id="brief" className="scroll-mt-28 pt-24">
      <div className="eyebrow mb-5">From your library · matched by code, not generated</div>
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
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Claims on your names</h3>
            <span className="meta">{brief.claims.length} unexpired</span>
          </div>
          <p className="mt-1 text-[14px] text-ink-3">What sources said, dated and unverified. Never a reason to act on its own.</p>
          <ul className="mt-5 grid gap-4">
            {brief.claims.map((c) => (
              <li key={c.id} className="border-t border-line pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  {c.tickers.map((t) => <span key={t} className="font-mono text-[13px] font-medium text-ink-2">{t}</span>)}
                  <span className="meta ml-auto">{c.as_of} → {c.expires}</span>
                </div>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{c.text}</p>
              </li>
            ))}
            {!brief.claims.length && <li className="text-[14px] text-ink-3">No unexpired claims about your watchlist.</li>}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
