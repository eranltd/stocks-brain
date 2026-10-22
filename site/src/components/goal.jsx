import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { goalPath } from "../lib/stats.js";
import { LinesChart } from "./lines.jsx";
import { Accent, ArrowRight, Empty, Reveal, SectionHead } from "./ui.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

// Every text here is in text/home.js ("goal.*").
/** A whole percent ("62%"). */
const whole = (v) => `${fmtNum(v, 0)}%`;
/** "+15%": the goal. */
const goalText = (goal) => `+${goal}%`;

/** Why a name is in or out of the pretend portfolio. */
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

/** A STATUS label ("Held"); an unknown key shows as itself. */
export const statusLabel = (key) => STATUS[key]?.label ?? key;

/** First weekday of the month after `iso` (holidays ignored): when the rule next rebalances. */
export function nextRebalance(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  while ([0, 6].includes(n.getUTCDay())) n.setUTCDate(n.getUTCDate() + 1);
  return n.toISOString().slice(0, 10);
}

/** The four lines' names. */
export const LABELS = (data) => {
  const t = strings(dict);
  return {
    rule: t("goal.label.rule", { range: "4–5" }),
    equal_weight: t("goal.label.equal", { n: data.watchlist.symbols.length }),
    core: t("goal.label.core", { core: data.longrun?.core ?? data.core?.symbol ?? "Core" }),
    bench: `${data.bench.symbol}`,
  };
};
export const COLORS = { rule: "var(--accent)", equal_weight: "var(--ai)", core: "var(--ink)", bench: "var(--ink-3)", goal: "var(--people)" };

/** `what` is "goal" or "portfolio". */
function Pending({ what }) {
  const t = strings(dict);
  return <Empty title={t("goal.pending.title")}>{t(`goal.pending.${what}`)}</Empty>;
}

/* ------------------------------------------------------------------ goal */

export function GoalSection({ data }) {
  const t = strings(dict);
  const lr = data.longrun;
  const goal = data.settings.goal.annual_return_pct;
  const g = goalText(goal);
  const title = <>{t("goal.titleA", { goal: g })} <Accent>{t("goal.titleB")}</Accent></>;
  if (!lr) {
    return (
      <section id="goal" className="scroll-mt-28 pt-24">
        <SectionHead eyebrow={t("goal.eyebrow")} title={title} lede={t("goal.ledeShort")} />
        <Pending what="goal" />
      </section>
    );
  }
  const L = LABELS(data);
  const s = lr.stats;
  const keys = ["rule", "equal_weight", "core", "bench"];
  const w = lr.weekly;
  const series = [
    { key: "goal", label: t("goal.series", { goal: g }), values: goalPath(w.dates.length, goal), color: COLORS.goal, dash: true, width: 1.5 },
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
        eyebrow={lr.sample ? t("goal.eyebrowSample") : t("goal.eyebrowYears", { years: fmtNum(lr.years, 1) })}
        title={title}
        lede={rich(t, "goal.lede", {
          ten: <span className="text-ink">{t("goal.tenPct")}</span>, goal: g,
          years: <span className="text-ink">{t("goal.nYears", { n: lr.goal.years_to_double })}</span>,
          m5: `×${lr.goal.multiple_5y}`, m10: `×${lr.goal.multiple_10y}`,
          from: fmtDate(lr.from), to: fmtDate(lr.to),
        })}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {keys.map((k, i) => {
          const x = s[k];
          const hit = x.cagr_pct >= goal;
          return (
            <Reveal key={k} delay={i * 70} className={`card p-4 sm:p-6 ${k === "rule" ? "border-accent/40" : ""}`}>
              <div className="meta flex items-center gap-2 truncate"><i className="inline-block h-[3px] w-4 shrink-0 rounded" style={{ background: COLORS[k] }} />{L[k]}</div>
              <div className={`display num mt-3 text-[clamp(30px,4vw,52px)] leading-none ${hit ? "text-accent" : ""}`}>{fmtPct(x.cagr_pct, 1)}</div>
              <div className="meta mt-1 normal-case tracking-[0.04em]">{t("goal.perYearAvg")}</div>
              <dl className="mt-4 grid gap-1.5 text-[13px] sm:mt-5 sm:text-[13.5px]">
                <Row k={t("goal.row.hit", { goal: g })} v={whole(x.hit_goal_12m_pct)} tone={x.hit_goal_12m_pct >= 50 ? "text-accent" : ""} />
                <Row k={t("goal.row.loss")} v={whole(x.loss_12m_pct)} />
                <Row k={t("goal.row.worst")} v={fmtPct(x.worst_12m_pct, 0)} tone={x.worst_12m_pct < 0 ? "text-down" : ""} />
                <Row k={t("goal.row.dd")} v={fmtPct(x.max_dd_pct, 0)} tone="text-down" />
              </dl>
            </Reveal>
          );
        })}
      </div>
      <p className="meta mt-3 normal-case tracking-[0.04em]">{t("goal.yearNote", { n: s.rule.windows_12m })}</p>
      <Reveal className="card mt-5 p-5 sm:p-8">
        <LinesChart dates={w.dates} series={series} ariaLabel={t("goal.chartLabel", { from: lr.from })} />
        <p className="meta mt-3 normal-case tracking-[0.04em]">{t("goal.chartNote", { goal: g, bps: lr.rule.cost_bps })}</p>
      </Reveal>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-3">{t("goal.means")}</div>
          <ul className="grid gap-3 text-[15.5px] leading-relaxed">
            <li>{rich(t, "goal.coreMade", { core: lr.core, cagr: <span className="text-ink">{t("goal.perYear", { pct: fmtPct(s.core.cagr_pct, 1) })}</span>, goal: g, hit: whole(coreHit) })} {t(s.core.cagr_pct < goal ? "goal.coreBelow" : "goal.coreStrong")}</li>
            <li>{rich(t, ruleVsAll >= 0 ? "goal.better" : "goal.worse", { n: data.watchlist.symbols.length, gap: <span className="text-ink">{t("goal.ptsYear", { pts: fmtNum(Math.abs(ruleVsAll), 1) })}</span>, a: fmtPct(s.rule.max_dd_pct, 0), b: fmtPct(s.equal_weight.max_dd_pct, 0) })}</li>
            {winners.length > 0 ? (
              <li>{t("goal.winners", { goal: g, dd: fmtPct(Math.max(...winners.map((k) => s[k].max_dd_pct)), 0) })}</li>
            ) : (
              <li>{t("goal.noWinners", { goal: g, a: fmtPct(Math.max(...keys.map((k) => s[k].max_dd_pct)), 0), b: fmtPct(Math.min(...keys.map((k) => s[k].max_dd_pct)), 0) })}</li>
            )}
          </ul>
        </Reveal>
        <Reveal delay={80} className="card border-people/40 p-6 sm:p-8">
          <div className="eyebrow mb-3 text-people">{t("goal.caveats")}</div>
          <ul className="grid gap-3 text-[15px] leading-relaxed text-ink-2">
            <li><span className="text-ink">{t("goal.hindsight.b")}</span> {t("goal.hindsight")}</li>
            <li><span className="text-ink">{t("goal.oneStretch.b")}</span> {t("goal.oneStretch", { years: fmtNum(lr.years, 1) })}</li>
            <li><span className="text-ink">{t("goal.pretendOnly.b")}</span> {t("goal.pretendOnly")}</li>
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
      <dd className={`num text-end font-mono ${tone}`}>{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------- portfolio */

export function PortfolioNow({ data, go }) {
  const t = strings(dict);
  const lr = data.longrun;
  const slots = data.settings.portfolio.slots;
  if (!lr) {
    return (
      <section id="portfolio" className="scroll-mt-28 pt-24">
        <SectionHead eyebrow={t("goal.pf.eyebrowEmpty")} title={<>{t("goal.pf.seats", { n: slots })} <Accent>{t("goal.pf.pretend")}</Accent></>} />
        <Pending what="portfolio" />
      </section>
    );
  }
  const now = lr.now;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  const last = paper?.track.at(-1);
  // Show what the forward paper record holds (what the plan follows). The history test's own path can differ:
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
        eyebrow={<>{t("goal.pf.eyebrow", { v: lr.rule.version })}{rec ? t("goal.pf.record") : ""}{t("goal.pf.since", { date: fmtDate(rec ? rec.date : now.last_rebalance) })}{t("goal.pf.nextLook", { date: fmtDate(nextRebalance(lr.as_of)) })}</>}
        title={<>{t("goal.pf.companies", { count: holdings.length })}{holdings.length < slots ? <>, <Accent>{t("goal.pf.core", { pct: whole(corePct) })}</Accent></> : <Accent>{t("goal.pf.full")}</Accent>}</>}
        lede={t("goal.pf.lede", { slots, max: lr.rule.max_per_sector, entry: lr.rule.entry_min_checks, keep: lr.rule.keep_min_checks })}
        right={<button type="button" onClick={() => go("portfolio")} className="btn">{t("goal.pf.mix")} <ArrowRight /></button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map(({ s }, i) => s ? (
          <Reveal key={s} delay={i * 60} as="button" type="button" onClick={() => go(`stock/${s}`)} className="card card-hover p-5 text-start">
            <div className="meta">{t("goal.pf.seat", { i: i + 1, pct: whole(100 / slots) })}</div>
            <span className="mt-3 block font-mono text-[26px] font-medium text-accent">{s}</span>
            <div className="mt-1 truncate text-[13.5px] text-ink-2">{data.names[s]}</div>
            <div className="meta mt-3 truncate normal-case tracking-[0.04em]">{data.sectors[s]}</div>
            <div className="mt-3 flex items-center justify-between text-[12.5px]">
              <span className="num font-mono">{t("goal.pf.passed", { frac: `${st[s]?.passed ?? "–"}/4` })}</span>
              <span className={`num font-mono ${(st[s]?.vs_bench_long_pct ?? 0) >= 0 ? "text-accent" : "text-down"}`}>{st[s]?.vs_bench_long_pct != null ? fmtPct(st[s].vs_bench_long_pct, 0) : ""}</span>
            </div>
          </Reveal>
        ) : (
          <Reveal key={`core-${i}`} delay={i * 60} className="card border-dashed p-5">
            <div className="meta">{t("goal.pf.seat", { i: i + 1, pct: whole(100 / slots) })}</div>
            <span className="mt-3 block font-mono text-[26px] font-medium text-ink-2">{lr.core}</span>
            <div className="mt-1 text-[13.5px] text-ink-3">{t("goal.pf.coreSeat")}</div>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">{t("goal.pf.bumpy")}</div>
          {div ? <div className="grid grid-cols-2 gap-5">
            <Big v={whole(div.vol_1y_pct)} l={t("goal.pf.swing")} />
            <Big v={fmtPct(div.loss_95_20d_pct, 0)} l={t("goal.pf.badMonth")} tone="text-down" />
            <Big v={div.avg_pair_corr != null ? fmtNum(div.avg_pair_corr, 2) : "–"} l={t("goal.pf.together")} />
            <Big v={`${div.sectors}`} l={t("goal.pf.ind", { count: div.sectors, cos: t("goal.pf.cos", { count: div.names }) })} />
          </div> : <p className="text-[15px] text-ink-2">{t("goal.pf.later")}</p>}
          <p className="mt-5 text-[14px] leading-relaxed text-ink-3">{t("goal.pf.corrNote")}</p>
        </Reveal>
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">{t("goal.pf.whyNot")}</div>
          <ul className="grid gap-4">
            {Object.entries(out.reduce((g, x) => ((g[x.status] ??= []).push(x), g), {})).map(([k, xs]) => (
              <li key={k}>
                <div className={`text-[14px] font-medium ${STATUS[k].tone}`}>{statusLabel(k)} <span className="text-ink-3">· {xs.length}</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {xs.map((x) => (
                    <button key={x.symbol} type="button" onClick={() => go(`stock/${x.symbol}`)} title={x.passed != null ? t("goal.pf.ofChecks", { n: x.passed }) : ""}
                      className="min-h-[34px] rounded-full border border-line-2 px-3 font-mono text-[12.5px] hover:border-ink-3 hover:text-ink">
                      <span>{x.symbol}</span>{x.passed != null && <span className="ms-1.5 text-ink-3">{x.passed}/4</span>}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {!out.length && <li className="text-ink-3">{t("goal.pf.allIn")}</li>}
          </ul>
          {pathOnly.length > 0 && <p className="mt-4 text-[14px] text-ink-3">{t("goal.pf.pathOnly", { list: pathOnly.join(", "), keep: lr.rule.keep_min_checks, date: fmtDate(paper.started), entry: lr.rule.entry_min_checks })}</p>}
          {changes > 0 && <p className="mt-4 text-[14px] text-people">{t("goal.pf.changes", { count: changes })}</p>}
        </Reveal>
      </div>
      <Reveal className="card mt-5 flex flex-col items-start gap-x-8 gap-y-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-2">{t("goal.pf.recordTitle")}</div>
          {paper && last ? (
            <p className="text-[16px] leading-relaxed">
              {rich(t, "goal.pf.recordLine", {
                date: fmtDate(paper.started), decisions: t("goal.pf.decisions", { count: paper.rebalances.length }),
                a: <b className={`num font-mono ${last.v >= 100 ? "text-accent" : "text-down"}`}>{fmtPct(last.v - 100, 1)}</b>,
                b: <b className="num font-mono">{fmtPct(last.core_v - 100, 1)}</b>,
                sym: data.bench.symbol,
                c: <b className="num font-mono">{fmtPct(last.bench_v - 100, 1)}</b>,
              })}
            </p>
          ) : (
            <p className="text-[16px] leading-relaxed text-ink-2">{t("goal.pf.recordLater")}</p>
          )}
        </div>
        <button type="button" onClick={() => go("portfolio")} className="btn">{t("goal.pf.more")} <ArrowRight /></button>
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
  const t = strings(dict);
  const u = universeConcentration(data);
  if (!u.concentrated) return null;
  return (
    <Reveal className="card mt-5 border-people/40 p-6 sm:p-8">
      <div className="eyebrow mb-3 text-people">{t("goal.div.title")}</div>
      <p className="text-[15.5px] leading-relaxed text-ink-2">
        {rich(t, "goal.div.lead", { n: u.n, ind: <span className="text-ink">{t("goal.div.ind", { count: u.sectors })}</span>, k: u.top[1], sector: u.top[0] })}
        {u.avg != null ? rich(t, "goal.div.together", { avg: <span className="text-ink">{fmtNum(u.avg, 2)}</span> }) : null}.{" "}
        {t(u.avg != null && u.avg < 0.4 ? "goal.div.independent" : "goal.div.oneBet", { range: "4–5" })} {t("goal.div.spread")}
      </p>
      <button type="button" onClick={() => go("portfolio")} className="meta mt-4 inline-flex items-center gap-1 hover:text-ink">{t("goal.div.see")} <ArrowRight className="size-3.5" /></button>
    </Reveal>
  );
}

/* --------------------------------------------------------------- context */

export function MarketContext({ data }) {
  const t = strings(dict);
  const ctx = data.market.context;
  if (!ctx) return null;
  const tf = ctx.core?.trend_filter;
  const p = ctx.participation_ndx;
  const ps = ctx.participation_spx;
  const cards = [
    tf && {
      k: t("goal.ctx.tf.k"), v: t(tf.on ? "goal.ctx.tf.up" : "goal.ctx.tf.notUp"), tone: tf.on ? "text-accent" : "text-people",
      d: t(tf.above_10m_avg ? "goal.ctx.tf.above" : "goal.ctx.tf.below", { sym: ctx.core.symbol, pct: fmtPct(tf.dist_10m_avg_pct ?? 0, 1) })
        + (tf.ret_12m_pct != null ? t("goal.ctx.tf.made", { r: fmtPct(tf.ret_12m_pct, 1) }) + (tf.cash_12m_pct != null ? t("goal.ctx.tf.cash", { c: fmtPct(tf.cash_12m_pct, 1) }) : "") : "")
        + t("goal.ctx.tf.tail"),
    },
    ctx.cash_yield_pct != null && {
      k: t("goal.ctx.cash.k"), v: `${fmtNum(ctx.cash_yield_pct, 1)}%`, tone: "",
      d: t("goal.ctx.cash.d"),
    },
    p && {
      k: t("goal.ctx.p.k"), v: t(p.state === "narrow" ? "goal.ctx.p.few" : p.state === "broad" ? "goal.ctx.p.many" : "goal.ctx.p.some"), tone: p.state === "narrow" ? "text-people" : p.state === "broad" ? "text-accent" : "",
      d: t("goal.ctx.p.d", { a: fmtPct(p.eq_vs_cap_60d_pct, 1) }) + (ps ? t("goal.ctx.p.spx", { b: fmtPct(ps.eq_vs_cap_60d_pct, 1) }) : "") + t("goal.ctx.p.tail"),
    },
    ctx.credit_vs_treasuries_60d_pct != null && {
      k: t("goal.ctx.credit.k"), v: t(ctx.credit_vs_treasuries_60d_pct >= 0 ? "goal.ctx.credit.calm" : "goal.ctx.credit.nervous"), tone: ctx.credit_vs_treasuries_60d_pct >= 0 ? "text-accent" : "text-people",
      d: t("goal.ctx.credit.d", { pct: fmtPct(ctx.credit_vs_treasuries_60d_pct, 1) }),
    },
  ].filter(Boolean);
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("goal.ctx.eyebrow", { date: fmtDate(data.market.as_of) })} title={<>{t("goal.ctx.titleA")} <Accent>{t("goal.ctx.titleB")}</Accent></>} size="md"
        lede={t("goal.ctx.lede")} />
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
  const t = strings(dict);
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
        eyebrow={t("goal.br.eyebrow", { from: br.from, to: br.to, n: br.names })}
        title={(([a, b]) => <>{t(a)} <Accent>{t(b)}</Accent></>)(edge ? ["goal.br.edgeA", "goal.br.edgeB"] : better ? ["goal.br.betterA", "goal.br.betterB"] : ["goal.br.noneA", "goal.br.noneB"])}
        lede={t("goal.br.lede", { step: br.step_days, h: br.horizon_days, sym: data.bench.symbol })}
        size="md"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="meta text-accent">{t("goal.br.passed")}</div>
              <div className={`display num mt-2 text-[40px] leading-none ${g.pass.mean >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(g.pass.mean ?? 0, 2)}</div>
              <p className="mt-2 text-[13px] text-ink-3">{t("goal.br.passNote", { h: br.horizon_days, sym: data.bench.symbol, hit: whole(g.pass.hit_pct ?? 0), n: g.pass.n })}</p>
            </div>
            <div>
              <div className="meta">{t("goal.br.failed")}</div>
              <div className={`display num mt-2 text-[40px] leading-none ${g.fail.mean >= 0 ? "" : "text-down"}`}>{fmtPct(g.fail.mean ?? 0, 2)}</div>
              <p className="mt-2 text-[13px] text-ink-3">{t("goal.br.failNote", { hit: whole(g.fail.hit_pct ?? 0), n: g.fail.n })}</p>
            </div>
          </div>
          <p className="mt-6 text-[14.5px] leading-relaxed text-ink-2">
            {t("goal.br.range", { a: fmtPct(g.pass.ci_low ?? 0, 2), b: fmtPct(g.pass.ci_high ?? 0, 2) })} {t(edge ? "goal.br.aboveZero" : "goal.br.luck")} {t("goal.br.ladder")}
          </p>
        </Reveal>
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="meta mb-4">{t("goal.br.byScore")}</div>
          <div className="grid gap-3">
            {br.by_score.map((r) => (
              <div key={r.passed} className="grid grid-cols-[64px_minmax(0,1fr)_72px] items-center gap-3 text-[13.5px]">
                <span className="font-mono">{t("goal.br.of4", { n: r.passed })}</span>
                <div className="relative h-5">
                  <div className="absolute top-1/2 left-1/2 h-4 w-px -translate-y-1/2 bg-line-2" />
                  {r.n >= MIN_N && (
                    <>
                      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line-2" style={{ left: `${pos(r.ci_low)}%`, width: `${pos(r.ci_high) - pos(r.ci_low)}%` }} />
                      <div className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${r.mean >= 0 ? "bg-accent" : "bg-down"}`} style={{ left: `${pos(r.mean)}%` }} />
                    </>
                  )}
                  {r.n > 0 && r.n < MIN_N && <span className="absolute inset-0 grid place-items-center text-[11.5px] text-ink-3">{t("goal.br.tooFew")}</span>}
                </div>
                <span className="num text-end font-mono text-ink-2">{r.n ? fmtPct(r.mean, 2) : "–"} <span className="text-ink-3">n{r.n}</span></span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
