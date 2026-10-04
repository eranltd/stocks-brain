import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { goalPath } from "../lib/stats.js";
import { LinesChart } from "./lines.jsx";
import { Accent, ArrowRight, Empty, Reveal, SectionHead } from "./ui.jsx";

export const STATUS = {
  kept: { label: "Held", tone: "text-accent" },
  added: { label: "New this month", tone: "text-accent" },
  fails_checks: { label: "Fails the checks", tone: "text-ink-3" },
  stretched: { label: "Stretched: no new buys", tone: "text-people" },
  slots_full: { label: "Slots full", tone: "text-ink-3" },
  sector_cap: { label: "Sector already has 2", tone: "text-ink-3" },
  too_correlated: { label: "Moves like a holding", tone: "text-ink-3" },
  no_history: { label: "Too little history", tone: "text-ink-3" },
};

/** First weekday of the month after `iso` (holidays ignored): when the rule next rebalances. */
export function nextRebalance(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  while ([0, 6].includes(n.getUTCDay())) n.setUTCDate(n.getUTCDate() + 1);
  return n.toISOString().slice(0, 10);
}

export const LABELS = (data) => ({
  rule: "Our rule (4–5 names)",
  equal_weight: `All ${data.watchlist.symbols.length}, equal`,
  core: `${data.longrun?.core ?? data.core?.symbol ?? "Core"} (core)`,
  bench: `${data.bench.symbol}`,
});
export const COLORS = { rule: "var(--accent)", equal_weight: "var(--ai)", core: "var(--ink)", bench: "var(--ink-3)", goal: "var(--people)" };

function Pending({ what }) {
  return <Empty title="Appears after the next daily run">{what} is computed from the full price history by the daily routine.</Empty>;
}

/* ------------------------------------------------------------------ goal */

export function GoalSection({ data }) {
  const lr = data.longrun;
  const goal = data.settings.goal.annual_return_pct;
  if (!lr) {
    return (
      <section id="goal" className="scroll-mt-28 pt-24">
        <SectionHead eyebrow="The goal" title={<>+{goal}% a year. <Accent>Is it realistic?</Accent></>} />
        <Pending what="The goal check" />
      </section>
    );
  }
  const L = LABELS(data);
  const s = lr.stats;
  const keys = ["rule", "equal_weight", "core", "bench"];
  const w = lr.weekly;
  const series = [
    { key: "goal", label: `Goal +${goal}%/yr`, values: goalPath(w.dates.length, goal), color: COLORS.goal, dash: true, width: 1.5 },
    { key: "core", label: L.core, values: w.core, color: COLORS.core, width: 1.6 },
    { key: "bench", label: L.bench, values: w.bench, color: COLORS.bench, dash: true, width: 1.6 },
    { key: "equal_weight", label: L.equal_weight, values: w.equal_weight, color: COLORS.equal_weight, width: 1.8 },
    { key: "rule", label: L.rule, values: w.rule, color: COLORS.rule, width: 2.6 },
  ];
  const ruleVsAll = s.rule.cagr_pct - s.equal_weight.cagr_pct;
  const winners = keys.filter((k) => s[k].cagr_pct >= goal);
  const coreHit = s.core.hit_goal_12m_pct;
  return (
    <section id="goal" className="scroll-mt-28 pt-24">
      <SectionHead
        eyebrow={`The goal · ${lr.sample ? "sample prices" : `${fmtNum(lr.years, 1)} years of real prices`}`}
        title={<>+{goal}% a year. <Accent>Is it realistic?</Accent></>}
        lede={<>That doubles the money every <span className="text-ink">{lr.goal.years_to_double} years</span> (×{lr.goal.multiple_5y} in 5 years, ×{lr.goal.multiple_10y} in 10). Below: what history says it takes, computed by code from {fmtDate(lr.from)} to {fmtDate(lr.to)}.</>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {keys.map((k, i) => {
          const x = s[k];
          const hit = x.cagr_pct >= goal;
          return (
            <Reveal key={k} delay={i * 70} className={`card p-4 sm:p-6 ${k === "rule" ? "border-accent/40" : ""}`}>
              <div className="meta flex items-center gap-2 truncate"><i className="inline-block h-[3px] w-4 shrink-0 rounded" style={{ background: COLORS[k] }} />{L[k]}</div>
              <div className={`display num mt-3 text-[clamp(30px,4vw,52px)] leading-none ${hit ? "text-accent" : ""}`}>{fmtPct(x.cagr_pct, 1)}</div>
              <div className="meta mt-1 normal-case tracking-[0.04em]">a year</div>
              <dl className="mt-4 grid gap-1.5 text-[13px] sm:mt-5 sm:text-[13.5px]">
                <Row k={`+${goal}% years`} v={`${fmtNum(x.hit_goal_12m_pct, 0)}%`} tone={x.hit_goal_12m_pct >= 50 ? "text-accent" : ""} />
                <Row k="Losing years" v={`${fmtNum(x.loss_12m_pct, 0)}%`} />
                <Row k="Worst year" v={fmtPct(x.worst_12m_pct, 0)} tone={x.worst_12m_pct < 0 ? "text-down" : ""} />
                <Row k="Deepest drop" v={fmtPct(x.max_dd_pct, 0)} tone="text-down" />
              </dl>
            </Reveal>
          );
        })}
      </div>
      <p className="meta mt-3 normal-case tracking-[0.04em]">"Years" are every rolling 12-month window in the period ({s.rule.windows_12m} of them), not calendar years.</p>
      <Reveal className="card mt-5 p-5 sm:p-8">
        <LinesChart dates={w.dates} series={series} ariaLabel={`Growth of 100 since ${lr.from}: our rule, all names equal, the core and the benchmark, against the goal path`} />
        <p className="meta mt-3 normal-case tracking-[0.04em]">Log scale: a steady +{goal}% a year is the straight dashed line. Weekly points, indexed to 100, after {lr.rule.cost_bps} bp trading costs for the rule.</p>
      </Reveal>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-3">What this says</div>
          <ul className="grid gap-3 text-[15.5px] leading-relaxed">
            <li>The broad market ({lr.core}) made <span className="text-ink">{fmtPct(s.core.cagr_pct, 1)} a year</span> and reached +{goal}% in {fmtNum(coreHit, 0)}% of 12-month windows. {s.core.cagr_pct < goal ? "The goal is above what the index delivered." : "Unusually strong years: long-run index returns are closer to 10%."}</li>
            <li>The rule {ruleVsAll >= 0 ? "beat" : "trailed"} simply holding all {data.watchlist.symbols.length} names by <span className="text-ink">{fmtNum(Math.abs(ruleVsAll), 1)} points a year</span>, with a deepest drop of {fmtPct(s.rule.max_dd_pct, 0)} vs {fmtPct(s.equal_weight.max_dd_pct, 0)}. That gap is the rule's own contribution.</li>
            {winners.length > 0 ? (
              <li>Every line that beat +{goal}% here also fell {fmtPct(Math.max(...winners.map((k) => s[k].max_dd_pct)), 0)} or more from a peak along the way. That is the price of the goal.</li>
            ) : (
              <li>Nothing here reached +{goal}% a year over the whole period, and the deepest drops ran from {fmtPct(Math.max(...keys.map((k) => s[k].max_dd_pct)), 0)} to {fmtPct(Math.min(...keys.map((k) => s[k].max_dd_pct)), 0)}.</li>
            )}
          </ul>
        </Reveal>
        <Reveal delay={80} className="card border-people/40 p-6 sm:p-8">
          <div className="eyebrow mb-3 text-people">Read this before trusting the numbers</div>
          <ul className="grid gap-3 text-[15px] leading-relaxed text-ink-2">
            <li><span className="text-ink">Hindsight.</span> The watchlist was chosen today, knowing these companies won. Any test on it flatters the result, the rule and "all names" alike. Compare them with each other, not with the goal.</li>
            <li><span className="text-ink">One period.</span> {fmtNum(lr.years, 1)} years, mostly a strong market for large US tech. A different decade can look very different.</li>
            <li><span className="text-ink">Household total.</span> +{goal}% on a small satellite does not make +{goal}% on the household's money. Only the forward paper record below counts as evidence.</li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Row({ k, v, tone = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
      <dt className="text-ink-3">{k}</dt>
      <dd className={`num text-right font-mono ${tone}`}>{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------- portfolio */

export function PortfolioNow({ data, go }) {
  const lr = data.longrun;
  const slots = data.settings.portfolio.slots;
  if (!lr) {
    return (
      <section id="portfolio" className="scroll-mt-28 pt-24">
        <SectionHead eyebrow="The portfolio" title={<>{slots} slots. <Accent>Diversified.</Accent></>} />
        <Pending what="The rule portfolio" />
      </section>
    );
  }
  const now = lr.now;
  const div = now.diversification;
  const st = Object.fromEntries(now.status.map((x) => [x.symbol, x]));
  const cells = [...now.holdings.map((s) => ({ s })), ...Array.from({ length: slots - now.holdings.length }, () => ({ s: null }))];
  const out = now.status.filter((x) => !now.holdings.includes(x.symbol));
  const changes = now.if_rebalanced_today.filter((s) => !now.holdings.includes(s)).length + now.holdings.filter((s) => !now.if_rebalanced_today.includes(s)).length;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  const last = paper?.track.at(-1);
  return (
    <section id="portfolio" className="scroll-mt-28 pt-24">
      <SectionHead
        eyebrow={`Portfolio rule ${lr.rule.version} · since ${fmtDate(now.last_rebalance)} · next ${fmtDate(nextRebalance(lr.as_of))}`}
        title={<>{now.holdings.length ? `${now.holdings.length} names` : "No names"}{now.holdings.length < slots ? <>, <Accent>{fmtNum(div.core_pct, 0)}% core.</Accent></> : <Accent>, fully invested.</Accent>}</>}
        lede={<>Up to {slots} names, at most {lr.rule.max_per_sector} per sector. A new name needs {lr.rule.entry_min_checks} of 4 setup checks and must not be stretched; a held name stays while it passes {lr.rule.keep_min_checks}. Empty slots stay in the index fund. Rebalanced once a month. This is a paper portfolio until the trust ladder says otherwise.</>}
        right={<button type="button" onClick={() => go("portfolio")} className="btn">Build your own <ArrowRight /></button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map(({ s }, i) => s ? (
          <Reveal key={s} delay={i * 60} as="button" type="button" onClick={() => go(`stock/${s}`)} className="card card-hover p-5 text-left">
            <div className="meta">Slot {i + 1} · {fmtNum(100 / slots, 0)}%</div>
            <div className="mt-3 font-mono text-[26px] font-medium text-accent">{s}</div>
            <div className="mt-1 truncate text-[13.5px] text-ink-2">{data.names[s]}</div>
            <div className="meta mt-3 truncate normal-case tracking-[0.04em]">{data.sectors[s]}</div>
            <div className="mt-3 flex items-center justify-between text-[12.5px]">
              <span className="num font-mono">{st[s]?.passed ?? "–"}/4 checks</span>
              <span className={`num font-mono ${(st[s]?.vs_bench_long_pct ?? 0) >= 0 ? "text-accent" : "text-down"}`}>{st[s]?.vs_bench_long_pct != null ? fmtPct(st[s].vs_bench_long_pct, 0) : ""}</span>
            </div>
          </Reveal>
        ) : (
          <Reveal key={`core-${i}`} delay={i * 60} className="card border-dashed p-5">
            <div className="meta">Slot {i + 1} · {fmtNum(100 / slots, 0)}%</div>
            <div className="mt-3 font-mono text-[26px] font-medium text-ink-2">{lr.core}</div>
            <div className="mt-1 text-[13.5px] text-ink-3">Index fund until a name qualifies</div>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">Risk of this mix · last 12 months</div>
          <div className="grid grid-cols-2 gap-5">
            <Big v={`${fmtNum(div.vol_1y_pct, 0)}%`} l="yearly swing (volatility)" />
            <Big v={fmtPct(div.loss_95_20d_pct, 0)} l="a bad month (1 in 20)" tone="text-down" />
            <Big v={div.avg_pair_corr != null ? fmtNum(div.avg_pair_corr, 2) : "–"} l="avg correlation between names" />
            <Big v={`${div.sectors}`} l={`sector${div.sectors === 1 ? "" : "s"} among ${div.names} name${div.names === 1 ? "" : "s"}`} />
          </div>
          <p className="mt-5 text-[14px] leading-relaxed text-ink-3">Correlation near 1 means the names move together, so they protect each other less. Below 0.5 is real diversification.</p>
        </Reveal>
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">Why the others are out</div>
          <ul className="grid gap-4">
            {Object.entries(out.reduce((g, x) => ((g[x.status] ??= []).push(x), g), {})).map(([k, xs]) => (
              <li key={k}>
                <div className={`text-[14px] font-medium ${STATUS[k].tone}`}>{STATUS[k].label} <span className="text-ink-3">· {xs.length}</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {xs.map((x) => (
                    <button key={x.symbol} type="button" onClick={() => go(`stock/${x.symbol}`)} title={x.passed != null ? `${x.passed} of 4 checks` : ""}
                      className="min-h-[34px] rounded-full border border-line-2 px-3 font-mono text-[12.5px] hover:border-ink-3 hover:text-ink">
                      {x.symbol}{x.passed != null && <span className="ml-1.5 text-ink-3">{x.passed}/4</span>}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {!out.length && <li className="text-ink-3">Every watchlist name is held.</li>}
          </ul>
          {changes > 0 && <p className="mt-4 text-[14px] text-people">If the rule rebalanced today it would make {changes} change{changes === 1 ? "" : "s"}. It waits for the monthly date on purpose (fewer trades, less noise).</p>}
        </Reveal>
      </div>
      <Reveal className="card mt-5 flex flex-col items-start gap-x-8 gap-y-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-2">Forward paper record · the only evidence without hindsight</div>
          {paper && last ? (
            <p className="text-[16px] leading-relaxed">
              Since {fmtDate(paper.started)} ({paper.rebalances.length} monthly decision{paper.rebalances.length === 1 ? "" : "s"}, never edited): rule <b className={`num font-mono ${last.v >= 100 ? "text-accent" : "text-down"}`}>{fmtPct(last.v - 100, 1)}</b>, core <b className="num font-mono">{fmtPct(last.core_v - 100, 1)}</b>, {data.bench.symbol} <b className="num font-mono">{fmtPct(last.bench_v - 100, 1)}</b>.
            </p>
          ) : (
            <p className="text-[16px] leading-relaxed text-ink-2">Starts with the next daily run. Each month the rule's holdings are written down with only that day's data and never changed, so the record cannot be fitted after the fact.</p>
          )}
        </div>
        <button type="button" onClick={() => go("portfolio")} className="btn">Portfolio details <ArrowRight /></button>
      </Reveal>
      <DiversityNote data={data} go={go} />
    </section>
  );
}

function Big({ v, l, tone = "" }) {
  return (
    <div>
      <div className={`display num text-[clamp(28px,3.4vw,40px)] leading-none ${tone}`}>{v}</div>
      <div className="mt-2 text-[13px] text-ink-3">{l}</div>
    </div>
  );
}

/** Honest flag: a watchlist of US mega-caps cannot make a truly diverse portfolio. */
export function universeConcentration(data) {
  const syms = data.watchlist.symbols;
  const bySector = {};
  for (const s of syms) bySector[s.sector] = (bySector[s.sector] ?? 0) + 1;
  const top = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0];
  const c = data.longrun?.corr_1y;
  let avg = null;
  if (c) {
    const xs = [];
    c.m.forEach((row, i) => row.forEach((v, j) => { if (j > i && v != null) xs.push(v); }));
    avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }
  return { n: syms.length, sectors: Object.keys(bySector).length, top, avg, concentrated: Object.keys(bySector).length < 6 || top[1] / syms.length > 0.35 };
}

function DiversityNote({ data, go }) {
  const u = universeConcentration(data);
  if (!u.concentrated) return null;
  return (
    <Reveal className="card mt-5 border-people/40 p-6 sm:p-8">
      <div className="eyebrow mb-3 text-people">The watchlist limits diversity</div>
      <p className="text-[15.5px] leading-relaxed text-ink-2">
        All {u.n} names are large US companies in only <span className="text-ink">{u.sectors} sectors</span>, {u.top[1]} of them in {u.top[0]}{u.avg != null ? <>, with an average correlation of <span className="text-ink">{fmtNum(u.avg, 2)}</span></> : null}.
        {u.avg != null && u.avg < 0.4 ? " Correlations look low this year, but in sell-offs stocks in the same sectors tend to fall together." : " A 4–5 stock portfolio drawn from this list will move largely as one bet."} Real diversification needs candidates from other sectors (health care, financials, industrials, energy, utilities). Adding them is a one-line change to the watchlist, decided by the household.
      </p>
      <button type="button" onClick={() => go("portfolio")} className="meta mt-4 inline-flex items-center gap-1 hover:text-ink">See the correlation map <ArrowRight className="size-3.5" /></button>
    </Reveal>
  );
}

/* --------------------------------------------------------------- context */

export function MarketContext({ data }) {
  const ctx = data.market.context;
  if (!ctx) return null;
  const tf = ctx.core?.trend_filter;
  const p = ctx.participation_ndx;
  const ps = ctx.participation_spx;
  const cards = [
    tf && {
      k: "Core trend", v: tf.on ? "On" : "Off", tone: tf.on ? "text-accent" : "text-people",
      d: `${ctx.core.symbol} is ${tf.above_10m_avg ? "above" : "below"} its 10-month average (${fmtPct(tf.dist_10m_avg_pct ?? 0, 1)})${tf.ret_12m_pct != null ? ` and made ${fmtPct(tf.ret_12m_pct, 1)} in 12 months${tf.cash_12m_pct != null ? ` vs cash ${fmtPct(tf.cash_12m_pct, 1)}` : ""}` : ""}. A slow filter: context for the core, never a reason to trade it.`,
    },
    ctx.cash_yield_pct != null && {
      k: "Cash pays", v: `${fmtNum(ctx.cash_yield_pct, 1)}%`, tone: "",
      d: "A year, from short T-bills. The hurdle: any stock idea must beat this without the risk.",
    },
    p && {
      k: "Participation", v: p.state === "narrow" ? "Narrow" : p.state === "broad" ? "Broad" : "Mixed", tone: p.state === "narrow" ? "text-people" : p.state === "broad" ? "text-accent" : "",
      d: `The average Nasdaq-100 stock vs the index: ${fmtPct(p.eq_vs_cap_60d_pct, 1)} over 60 days${ps ? `; S&P 500: ${fmtPct(ps.eq_vs_cap_60d_pct, 1)}` : ""}. Narrow means a few giants carry the index.`,
    },
    ctx.credit_vs_treasuries_60d_pct != null && {
      k: "Credit", v: ctx.credit_vs_treasuries_60d_pct >= 0 ? "Calm" : "Cautious", tone: ctx.credit_vs_treasuries_60d_pct >= 0 ? "text-accent" : "text-people",
      d: `High-yield bonds vs Treasuries over 60 days: ${fmtPct(ctx.credit_vs_treasuries_60d_pct, 1)}. Lenders getting nervous often shows here first.`,
    },
  ].filter(Boolean);
  return (
    <section className="pt-24">
      <SectionHead eyebrow={`Market context · ${fmtDate(data.market.as_of)}`} title={<>Is the market <Accent>helping?</Accent></>} size="md" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <Reveal key={c.k} delay={i * 60} className="card p-6">
            <div className="meta">{c.k}</div>
            <div className={`display mt-2 text-[34px] leading-none ${c.tone}`}>{c.v}</div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">{c.d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ base rates */

export function BaseRates({ data }) {
  const br = data.market.base_rates;
  if (!br) return null;
  const g = br.gate;
  const edge = g.pass.ci_low != null && g.pass.ci_low > 0;
  const better = g.pass.mean != null && g.fail.mean != null && g.pass.mean > g.fail.mean;
  const MIN_N = 5;
  const maxAbs = Math.max(...br.by_score.filter((r) => r.n >= MIN_N).map((r) => Math.max(Math.abs(r.ci_low ?? 0), Math.abs(r.ci_high ?? 0))), 0.5);
  const pos = (v) => Math.max(0, Math.min(100, 50 + (v / maxAbs) * 50));
  return (
    <section className="pt-24">
      <SectionHead
        eyebrow={`Do our rules work? · ${br.from} to ${br.to} · ${br.names} names`}
        title={edge ? <>The checks <Accent>helped.</Accent></> : better ? <>Slightly better. <Accent>Not proven.</Accent></> : <>No edge <Accent>found.</Accent></>}
        lede={<>Every {br.step_days} trading days in history, each name was graded by the setup checks, then measured {br.horizon_days} days later against {data.bench.symbol}. Same names, same hindsight, so this only compares the checks with themselves.</>}
        size="md"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="meta text-accent">Passed the gate</div>
              <div className={`display num mt-2 text-[40px] leading-none ${g.pass.mean >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(g.pass.mean ?? 0, 2)}</div>
              <p className="mt-2 text-[13px] text-ink-3">per {br.horizon_days} days vs {data.bench.symbol} · beat it {fmtNum(g.pass.hit_pct ?? 0, 0)}% of the time · n={g.pass.n}</p>
            </div>
            <div>
              <div className="meta">Did not pass</div>
              <div className={`display num mt-2 text-[40px] leading-none ${g.fail.mean >= 0 ? "" : "text-down"}`}>{fmtPct(g.fail.mean ?? 0, 2)}</div>
              <p className="mt-2 text-[13px] text-ink-3">beat it {fmtNum(g.fail.hit_pct ?? 0, 0)}% of the time · n={g.fail.n}</p>
            </div>
          </div>
          <p className="mt-6 text-[14.5px] leading-relaxed text-ink-2">
            90% range for names that passed: {fmtPct(g.pass.ci_low ?? 0, 2)} to {fmtPct(g.pass.ci_high ?? 0, 2)}. {edge ? "The whole range is above zero." : "The range includes zero, so luck cannot be ruled out."} The trust ladder needs it above zero.
          </p>
        </Reveal>
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="meta mb-4">By number of checks passed (average and 90% range)</div>
          <div className="grid gap-3">
            {br.by_score.map((r) => (
              <div key={r.passed} className="grid grid-cols-[64px_minmax(0,1fr)_72px] items-center gap-3 text-[13.5px]">
                <span className="font-mono">{r.passed} of 4</span>
                <div className="relative h-5">
                  <div className="absolute top-1/2 left-1/2 h-4 w-px -translate-y-1/2 bg-line-2" />
                  {r.n >= MIN_N && (
                    <>
                      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line-2" style={{ left: `${pos(r.ci_low)}%`, width: `${pos(r.ci_high) - pos(r.ci_low)}%` }} />
                      <div className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${r.mean >= 0 ? "bg-accent" : "bg-down"}`} style={{ left: `${pos(r.mean)}%` }} />
                    </>
                  )}
                  {r.n > 0 && r.n < MIN_N && <span className="absolute inset-0 grid place-items-center text-[11.5px] text-ink-3">too few cases</span>}
                </div>
                <span className="num text-right font-mono text-ink-2">{r.n ? fmtPct(r.mean, 2) : "–"} <span className="text-ink-3">n{r.n}</span></span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
