import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { goalPath } from "../lib/stats.js";
import { LinesChart } from "./lines.jsx";
import { Accent, ArrowRight, Empty, Reveal, SectionHead } from "./ui.jsx";

export const STATUS = {
  kept: { label: "Held", tone: "text-accent" },
  added: { label: "New this month", tone: "text-accent" },
  fails_checks: { label: "Did not pass the checks", tone: "text-ink-3" },
  stretched: { label: "Rose too fast: wait", tone: "text-people" },
  slots_full: { label: "No free seat", tone: "text-ink-3" },
  sector_cap: { label: "Its industry already has 2", tone: "text-ink-3" },
  too_correlated: { label: "Moves like one already held", tone: "text-ink-3" },
  no_history: { label: "Too new to judge", tone: "text-ink-3" },
};

/** First weekday of the month after `iso` (holidays ignored): when the rule next rebalances. */
export function nextRebalance(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  while ([0, 6].includes(n.getUTCDay())) n.setUTCDate(n.getUTCDate() + 1);
  return n.toISOString().slice(0, 10);
}

export const LABELS = (data) => ({
  rule: "The rule's pretend picks (4–5)",
  equal_weight: `All ${data.watchlist.symbols.length}, equal amounts`,
  core: `${data.longrun?.core ?? data.core?.symbol ?? "Core"} (whole market)`,
  bench: `${data.bench.symbol}`,
});
export const COLORS = { rule: "var(--accent)", equal_weight: "var(--ai)", core: "var(--ink)", bench: "var(--ink-3)", goal: "var(--people)" };

function Pending({ what }) {
  return <Empty title="Shows up after the next daily run">{what} is worked out from all past prices by the daily job.</Empty>;
}

/* ------------------------------------------------------------------ goal */

export function GoalSection({ data }) {
  const lr = data.longrun;
  const goal = data.settings.goal.annual_return_pct;
  if (!lr) {
    return (
      <section id="goal" className="scroll-mt-28 pt-24">
        <SectionHead eyebrow="The goal" title={<>+{goal}% a year. <Accent>Is it realistic?</Accent></>}
          lede="In simple words: very hard. A fund that holds the whole market has made close to 10% a year on average over the long run." />
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
        lede={<>In simple words: very hard. A fund that holds the whole market has made close to <span className="text-ink">10% a year</span> on average over the long run, so +{goal}% means beating it by a lot, year after year. +{goal}% would double the money every <span className="text-ink">{lr.goal.years_to_double} years</span> (×{lr.goal.multiple_5y} in 5 years, ×{lr.goal.multiple_10y} in 10). Below: what really happened from {fmtDate(lr.from)} to {fmtDate(lr.to)}, worked out by code.</>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {keys.map((k, i) => {
          const x = s[k];
          const hit = x.cagr_pct >= goal;
          return (
            <Reveal key={k} delay={i * 70} className={`card p-4 sm:p-6 ${k === "rule" ? "border-accent/40" : ""}`}>
              <div className="meta flex items-center gap-2 truncate"><i className="inline-block h-[3px] w-4 shrink-0 rounded" style={{ background: COLORS[k] }} />{L[k]}</div>
              <div className={`display num mt-3 text-[clamp(30px,4vw,52px)] leading-none ${hit ? "text-accent" : ""}`}>{fmtPct(x.cagr_pct, 1)}</div>
              <div className="meta mt-1 normal-case tracking-[0.04em]">a year, on average</div>
              <dl className="mt-4 grid gap-1.5 text-[13px] sm:mt-5 sm:text-[13.5px]">
                <Row k={`Years with +${goal}% or more`} v={`${fmtNum(x.hit_goal_12m_pct, 0)}%`} tone={x.hit_goal_12m_pct >= 50 ? "text-accent" : ""} />
                <Row k="Years that lost money" v={`${fmtNum(x.loss_12m_pct, 0)}%`} />
                <Row k="Worst year" v={fmtPct(x.worst_12m_pct, 0)} tone={x.worst_12m_pct < 0 ? "text-down" : ""} />
                <Row k="Biggest drop" v={fmtPct(x.max_dd_pct, 0)} tone="text-down" />
              </dl>
            </Reveal>
          );
        })}
      </div>
      <p className="meta mt-3 normal-case tracking-[0.04em]">A "year" here is any 12 months in a row, whatever week it starts ({s.rule.windows_12m} of them in all), not just January to December. "Biggest drop" is the largest fall from a high point before it recovered.</p>
      <Reveal className="card mt-5 p-5 sm:p-8">
        <LinesChart dates={w.dates} series={series} ariaLabel={`Growth of 100 since ${lr.from}: the rule's pretend picks, all companies in equal amounts, the whole-market fund and the yardstick, against the goal path`} />
        <p className="meta mt-3 normal-case tracking-[0.04em]">Each line starts at 100 and shows what it grew to. A steady +{goal}% a year is the straight dashed line. The chart is drawn so the same percentage move looks the same size, early or late. Trading costs ({lr.rule.cost_bps} hundredths of a percent) are taken off the rule.</p>
      </Reveal>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-3">What this means</div>
          <ul className="grid gap-3 text-[15.5px] leading-relaxed">
            <li>The whole-market fund ({lr.core}) made <span className="text-ink">{fmtPct(s.core.cagr_pct, 1)} a year</span> and reached +{goal}% in {fmtNum(coreHit, 0)}% of 12-month stretches. {s.core.cagr_pct < goal ? "The goal is more than the whole market made." : "These were unusually strong years: over the long run the whole market averages closer to 10% a year."}</li>
            <li>The rule's picks {ruleVsAll >= 0 ? "did better than" : "did worse than"} simply holding all {data.watchlist.symbols.length} companies by <span className="text-ink">{fmtNum(Math.abs(ruleVsAll), 1)} points a year</span>, with a biggest drop of {fmtPct(s.rule.max_dd_pct, 0)} vs {fmtPct(s.equal_weight.max_dd_pct, 0)}. That gap is what the picking itself added or cost.</li>
            {winners.length > 0 ? (
              <li>Every line that beat +{goal}% here also fell {fmtPct(Math.max(...winners.map((k) => s[k].max_dd_pct)), 0)} or more from a high point along the way. Like a roller coaster: the higher the ride, the deeper the dips.</li>
            ) : (
              <li>Nothing here reached +{goal}% a year over the whole time, and the biggest drops ran from {fmtPct(Math.max(...keys.map((k) => s[k].max_dd_pct)), 0)} to {fmtPct(Math.min(...keys.map((k) => s[k].max_dd_pct)), 0)}.</li>
            )}
          </ul>
        </Reveal>
        <Reveal delay={80} className="card border-people/40 p-6 sm:p-8">
          <div className="eyebrow mb-3 text-people">Read this before trusting the numbers</div>
          <ul className="grid gap-3 text-[15px] leading-relaxed text-ink-2">
            <li><span className="text-ink">Picked with hindsight.</span> The list of companies was chosen today, already knowing they did well. It is like betting on a race after seeing who won: any test on it looks better than real life. Compare the lines with each other, not with the goal.</li>
            <li><span className="text-ink">Only one stretch of time.</span> {fmtNum(lr.years, 1)} years, mostly great years for big US tech companies. Another ten years can look very different.</li>
            <li><span className="text-ink">Pretend money only.</span> The rule's picks are an experiment with pretend money, not where the household's money goes. Only the pretend record kept from now on (below) counts as real evidence.</li>
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
        <SectionHead eyebrow="The pretend portfolio" title={<>{slots} seats. <Accent>Pretend money.</Accent></>} />
        <Pending what="The pretend portfolio" />
      </section>
    );
  }
  const now = lr.now;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  const last = paper?.track.at(-1);
  // Show what the forward paper record holds (what the household follows). The history test's own path can differ:
  // it keeps names it already held, while the record started fresh and needs the entry checks.
  const rec = paper?.rebalances.at(-1) ?? null;
  const holdings = rec ? rec.holdings : now.holdings;
  const same = holdings.length === now.holdings.length && holdings.every((s) => now.holdings.includes(s));
  const div = rec ? (paper.diversification ?? (same ? now.diversification : null)) : now.diversification;
  const corePct = rec ? rec.core_pct : now.diversification.core_pct;
  const next = rec ? (paper.if_rebalanced_today ?? null) : now.if_rebalanced_today;
  const pathOnly = now.holdings.filter((s) => !holdings.includes(s));
  const st = Object.fromEntries(now.status.map((x) => [x.symbol, x]));
  const cells = [...holdings.map((s) => ({ s })), ...Array.from({ length: slots - holdings.length }, () => ({ s: null }))];
  // A name the history path keeps on two checks is not held by the paper record; for the record it fails the entry checks.
  const out = now.status.filter((x) => !holdings.includes(x.symbol))
    .map((x) => (x.status === "kept" && x.passed < lr.rule.entry_min_checks ? { ...x, status: "fails_checks" } : x));
  const changes = next ? next.filter((s) => !holdings.includes(s)).length + holdings.filter((s) => !next.includes(s)).length : 0;
  return (
    <section id="portfolio" className="scroll-mt-28 pt-24">
      <SectionHead
        eyebrow={`Pretend portfolio · rule ${lr.rule.version}${rec ? " · pretend record" : ""} · since ${fmtDate(rec ? rec.date : now.last_rebalance)} · next look ${fmtDate(nextRebalance(lr.as_of))}`}
        title={<>{holdings.length ? `${holdings.length} companies` : "No companies"}{holdings.length < slots ? <>, <Accent>{fmtNum(corePct, 0)}% whole market.</Accent></> : <Accent>, every seat taken.</Accent>}</>}
        lede={<>In simple words: this is an experiment with pretend money, to learn whether picking a few stocks beats just owning the whole market. It is not where the household's money goes. The rule works like a table with {slots} seats: at most {lr.rule.max_per_sector} from the same industry. A new company needs to pass {lr.rule.entry_min_checks} of 4 checks and must not have risen too fast; a company already seated stays while it passes {lr.rule.keep_min_checks}. Empty seats sit in the whole-market fund. It changes seats once a month.</>}
        right={<button type="button" onClick={() => go("portfolio")} className="btn">Try your own mix <ArrowRight /></button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map(({ s }, i) => s ? (
          <Reveal key={s} delay={i * 60} as="button" type="button" onClick={() => go(`stock/${s}`)} className="card card-hover p-5 text-left">
            <div className="meta">Seat {i + 1} · {fmtNum(100 / slots, 0)}%</div>
            <div className="mt-3 font-mono text-[26px] font-medium text-accent">{s}</div>
            <div className="mt-1 truncate text-[13.5px] text-ink-2">{data.names[s]}</div>
            <div className="meta mt-3 truncate normal-case tracking-[0.04em]">{data.sectors[s]}</div>
            <div className="mt-3 flex items-center justify-between text-[12.5px]">
              <span className="num font-mono">passed {st[s]?.passed ?? "–"}/4 checks</span>
              <span className={`num font-mono ${(st[s]?.vs_bench_long_pct ?? 0) >= 0 ? "text-accent" : "text-down"}`}>{st[s]?.vs_bench_long_pct != null ? fmtPct(st[s].vs_bench_long_pct, 0) : ""}</span>
            </div>
          </Reveal>
        ) : (
          <Reveal key={`core-${i}`} delay={i * 60} className="card border-dashed p-5">
            <div className="meta">Seat {i + 1} · {fmtNum(100 / slots, 0)}%</div>
            <div className="mt-3 font-mono text-[26px] font-medium text-ink-2">{lr.core}</div>
            <div className="mt-1 text-[13.5px] text-ink-3">Whole-market fund until a company passes</div>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">How bumpy this mix is · last 12 months</div>
          {div ? <div className="grid grid-cols-2 gap-5">
            <Big v={`${fmtNum(div.vol_1y_pct, 0)}%`} l="how much it typically swings in a year" />
            <Big v={fmtPct(div.loss_95_20d_pct, 0)} l="a bad month (happens about 1 in 20)" tone="text-down" />
            <Big v={div.avg_pair_corr != null ? fmtNum(div.avg_pair_corr, 2) : "–"} l="how much they move together (0 to 1)" />
            <Big v={`${div.sectors}`} l={`industr${div.sectors === 1 ? "y" : "ies"} among ${div.names} compan${div.names === 1 ? "y" : "ies"}`} />
          </div> : <p className="text-[15px] text-ink-2">Worked out by the next daily run.</p>}
          <p className="mt-5 text-[14px] leading-relaxed text-ink-3">Near 1 means the companies rise and fall together, like eggs in one basket. Below 0.5 means they really are spread out, so one bad day hurts less.</p>
        </Reveal>
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">Why the other companies are not in</div>
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
            {!out.length && <li className="text-ink-3">Every company we follow is in.</li>}
          </ul>
          {pathOnly.length > 0 && <p className="mt-4 text-[14px] text-ink-3">The test on past prices also holds {pathOnly.join(", ")}: there it keeps a company it already had while it passes {lr.rule.keep_min_checks} checks. The pretend record started fresh on {fmtDate(paper.started)}, so a company needs {lr.rule.entry_min_checks} checks to get in.</p>}
          {changes > 0 && <p className="mt-4 text-[14px] text-people">If the rule changed seats today it would make {changes} change{changes === 1 ? "" : "s"}. It waits for the monthly date on purpose: fewer swaps, less reacting to noise.</p>}
        </Reveal>
      </div>
      <Reveal className="card mt-5 flex flex-col items-start gap-x-8 gap-y-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-2">Pretend record kept from now on · the only fair test</div>
          {paper && last ? (
            <p className="text-[16px] leading-relaxed">
              Since {fmtDate(paper.started)} ({paper.rebalances.length} monthly decision{paper.rebalances.length === 1 ? "" : "s"}, written down and never changed): rule's picks <b className={`num font-mono ${last.v >= 100 ? "text-accent" : "text-down"}`}>{fmtPct(last.v - 100, 1)}</b>, whole-market fund <b className="num font-mono">{fmtPct(last.core_v - 100, 1)}</b>, yardstick {data.bench.symbol} <b className="num font-mono">{fmtPct(last.bench_v - 100, 1)}</b>.
            </p>
          ) : (
            <p className="text-[16px] leading-relaxed text-ink-2">Starts with the next daily run. Each month the rule's picks are written down using only what was known that day, and never changed. Like sealing a guess in an envelope: nobody can tidy it up later.</p>
          )}
        </div>
        <button type="button" onClick={() => go("portfolio")} className="btn">More on the pretend portfolio <ArrowRight /></button>
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
      <div className="eyebrow mb-3 text-people">Our list is not very spread out</div>
      <p className="text-[15.5px] leading-relaxed text-ink-2">
        All {u.n} companies we follow are big US companies in only <span className="text-ink">{u.sectors} industries</span>, {u.top[1]} of them in {u.top[0]}{u.avg != null ? <>, and they move together by <span className="text-ink">{fmtNum(u.avg, 2)}</span> on a 0 to 1 scale</> : null}.
        {u.avg != null && u.avg < 0.4 ? " They look fairly independent this year, but when markets fall, companies in the same industry tend to fall together." : " A pretend portfolio of 4–5 stocks from this list moves mostly as one bet: eggs in one basket."} Really spreading out would need companies from other industries (health care, banks, factories, energy, utilities). Adding them is a one-line change to the list, decided by the household.
      </p>
      <button type="button" onClick={() => go("portfolio")} className="meta mt-4 inline-flex items-center gap-1 hover:text-ink">See which companies move together <ArrowRight className="size-3.5" /></button>
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
      k: "Whole-market direction", v: tf.on ? "Up" : "Not up", tone: tf.on ? "text-accent" : "text-people",
      d: `The whole-market fund (${ctx.core.symbol}) is ${tf.above_10m_avg ? "above" : "below"} its average price of the last 10 months (${fmtPct(tf.dist_10m_avg_pct ?? 0, 1)})${tf.ret_12m_pct != null ? ` and made ${fmtPct(tf.ret_12m_pct, 1)} in 12 months${tf.cash_12m_pct != null ? `, vs ${fmtPct(tf.cash_12m_pct, 1)} for cash` : ""}` : ""}. A slow signal, just for background: never a reason to sell or buy the fund.`,
    },
    ctx.cash_yield_pct != null && {
      k: "Safe savings pay", v: `${fmtNum(ctx.cash_yield_pct, 1)}%`, tone: "",
      d: "A year, from short US government loans (very safe). Any stock idea has to beat this, because this needs no risk at all.",
    },
    p && {
      k: "How many are joining in", v: p.state === "narrow" ? "Few" : p.state === "broad" ? "Many" : "Some", tone: p.state === "narrow" ? "text-people" : p.state === "broad" ? "text-accent" : "",
      d: `A typical Nasdaq-100 company vs the index as a whole: ${fmtPct(p.eq_vs_cap_60d_pct, 1)} over 60 days${ps ? `; S&P 500: ${fmtPct(ps.eq_vs_cap_60d_pct, 1)}` : ""}. "Few" means a handful of giant companies are doing the lifting while most others lag.`,
    },
    ctx.credit_vs_treasuries_60d_pct != null && {
      k: "Lenders' mood", v: ctx.credit_vs_treasuries_60d_pct >= 0 ? "Calm" : "Nervous", tone: ctx.credit_vs_treasuries_60d_pct >= 0 ? "text-accent" : "text-people",
      d: `Loans to riskier companies vs loans to the US government, over 60 days: ${fmtPct(ctx.credit_vs_treasuries_60d_pct, 1)}. When lenders get nervous, it often shows here first.`,
    },
  ].filter(Boolean);
  return (
    <section className="pt-24">
      <SectionHead eyebrow={`The market's mood · ${fmtDate(data.market.as_of)}`} title={<>Is the market <Accent>helping?</Accent></>} size="md"
        lede="In simple words: four quick signs of the market's mood, like checking the weather before going out. They are background only, never a reason to act." />
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
        eyebrow={`Do our checks work? · ${br.from} to ${br.to} · ${br.names} companies`}
        title={edge ? <>The checks <Accent>helped.</Accent></> : better ? <>Slightly better. <Accent>Not proven.</Accent></> : <>No advantage <Accent>found.</Accent></>}
        lede={<>In simple words: what happened in the past when a company passed our checks, compared with when it did not. Every {br.step_days} market days in the past, each company got a grade from the 4 checks; {br.horizon_days} days later we looked at whether it did better than the yardstick ({data.bench.symbol}). The list was picked with hindsight, so this only compares passing with not passing.</>}
        size="md"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="meta text-accent">Passed the checks</div>
              <div className={`display num mt-2 text-[40px] leading-none ${g.pass.mean >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(g.pass.mean ?? 0, 2)}</div>
              <p className="mt-2 text-[13px] text-ink-3">on average per {br.horizon_days} days vs {data.bench.symbol} · beat it {fmtNum(g.pass.hit_pct ?? 0, 0)}% of the time · {g.pass.n} cases</p>
            </div>
            <div>
              <div className="meta">Did not pass</div>
              <div className={`display num mt-2 text-[40px] leading-none ${g.fail.mean >= 0 ? "" : "text-down"}`}>{fmtPct(g.fail.mean ?? 0, 2)}</div>
              <p className="mt-2 text-[13px] text-ink-3">beat it {fmtNum(g.fail.hit_pct ?? 0, 0)}% of the time · {g.fail.n} cases</p>
            </div>
          </div>
          <p className="mt-6 text-[14.5px] leading-relaxed text-ink-2">
            For companies that passed, the true result is very likely (90% sure) between {fmtPct(g.pass.ci_low ?? 0, 2)} and {fmtPct(g.pass.ci_high ?? 0, 2)}. {edge ? "Even the low end is above zero." : "That range includes zero, so it could just be luck."} To move up the trust ladder, the low end must be above zero.
          </p>
        </Reveal>
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="meta mb-4">By how many of the 4 checks passed (dot: average; bar: likely range)</div>
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
