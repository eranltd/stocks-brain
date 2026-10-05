import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { LinesChart } from "../components/lines.jsx";
import { Accent, ArrowRight, Chip, Container, Empty, Headline, Reveal, SectionHead, Segmented } from "../components/ui.jsx";

const FAMILIES = [
  ["savings", "Savings", "How often and how we buy the core"],
  ["entry", "Choosing names", "What gets a stock into the satellite"],
  ["exit", "Leaving", "What gets a stock out"],
  ["sizing", "Sizing", "How much of each"],
  ["risk", "Risk", "What limits the damage"],
  ["fundamental", "Fundamentals", "The business, not the chart"],
  ["process", "Process", "How we behave"],
];
const LABEL = {
  passes_history: "passes history", candidate: "candidate", inconclusive: "inconclusive", rejected: "rejected",
  needs_data: "needs data", process_only: "process", testable_now: "testable", reference_baseline: "baseline rule", control: "control",
  baseline: "baseline", no_clear_difference: "no clear difference", too_few_independent_windows: "too few windows", better: "better", worse: "worse",
};
const EVIDENCE = { replicated: "text-accent", mixed: "text-people", weak: "text-ink-2", untested: "text-ink-3", contradicted: "text-down" };
const DOT = { passes_history: "var(--accent)", candidate: "var(--people)", inconclusive: "var(--ink-3)", rejected: "var(--down)" };
const HORIZON = (w) => (w % 52 === 0 ? `${w / 52} year${w === 52 ? "" : "s"}` : `${w} weeks`);

// "[engine]" = computed by the program on every daily run; "[planned]" = written down, not built yet, people check it by hand.
const TAG = /^\[(engine|planned)[^\]]*\]\s*/;
function Tagged({ text }) {
  const m = text.match(TAG);
  const body = m ? text.slice(m[0].length) : text;
  return (
    <>
      {m && <span className={`mr-1.5 inline-block rounded-full border px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] ${m[1] === "engine" ? "border-accent/50 text-accent" : "border-dashed border-people/60 text-people"}`}>{m[1] === "engine" ? "program" : "planned"}</span>}
      {body}
    </>
  );
}
const adoptLabel = (r) => {
  if (r.engine?.baseline) return "We use it";
  if (r.family === "savings" && r.status === "testable_now") return "Replaces the baseline if";
  if (r.status === "testable_now") return "Passes history if";
  if (r.status === "reference_baseline") return "Can move up if";
  if (r.status === "control") return "Used as";
  return "We follow it when";
};

function Stat({ k, v, tone = "", sub }) {
  return (
    <div className="min-w-0">
      <div className="meta">{k}</div>
      <div className={`num mt-1 font-mono text-[15px] ${tone}`}>{v}</div>
      {sub && <div className="text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

export default function Playbook({ data, go }) {
  const rb = data.rulebook;
  const res = data.rulesResult;
  if (!rb) {
    return <Container className="pt-20"><Empty title="No rule registry yet">config/rules.json defines the household's rules.</Empty></Container>;
  }
  const byId = Object.fromEntries(rb.rules.map((r) => [r.id, r]));
  const name = (id) => byId[id]?.name ?? id;
  const satVerdict = Object.fromEntries((res?.satellite?.rules ?? []).map((r) => [r.id, r.verdict]));
  const counts = {
    tested: rb.rules.filter((r) => r.engine).length,
    needs: rb.rules.filter((r) => r.status === "needs_data").length,
    process: rb.rules.filter((r) => r.status === "process_only").length,
  };
  const goal = data.settings.goal.annual_return_pct;

  return (
    <Container className="pt-14">
      <Reveal className="eyebrow mb-4">Playbook · rules v{rb.version} · {fmtDate(rb.updated_at)}{res ? ` · ${res.sample ? "sample prices" : `tested on real prices to ${fmtDate(res.as_of)}`}` : ""}</Reveal>
      <Headline size="xl" className="max-w-[16ch]">The trader we <Accent>want to be.</Accent></Headline>
      <div className="mt-6 grid max-w-[64ch] gap-4">
        {rb.trader.split("\n\n").map((para, i) => <Reveal key={i} delay={250 + i * 90} as="p" className="text-[clamp(17px,1.7vw,20px)] leading-relaxed text-ink-2">{para}</Reveal>)}
      </div>
      <Reveal delay={350} className="mt-8 flex flex-wrap gap-2 text-[13px]">
        <span className="pill">{rb.rules.length} rules</span>
        <span className="pill">{counts.tested} tested on history</span>
        {counts.needs > 0 && <span className="pill border-dashed border-people/60 text-people">{counts.needs} need data</span>}
        <span className="pill">{counts.process} process</span>
        <span className="pill">{rb.tries_counted} tries counted</span>
      </Reveal>
      <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-ink-3">A "try" is any variant we run or keep in reserve. The more tries, the likelier one wins by luck, so the bar for "not luck" rises with each.</p>
      <Reveal className="card mt-8 border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
        <span className="text-people">How to read the evidence.</span> History tests use today's watchlist, so every name is a survivor and every result is flattered.
        A rule is judged only against <span className="text-ink">random names under the same conditions</span>, never against the +{goal}% goal, and nothing here moves money:
        a rule that passes history goes on to the forward paper record, which cannot be re-fitted.
        <span className="mt-3 block text-ink-3">
          Evidence ratings: <b className="font-medium text-ink-2">replicated</b> = independent replication named in the sources we keep; <b className="font-medium text-ink-2">mixed</b> = backed by more than one source, with caveats or gaps;
          <b className="font-medium text-ink-2"> weak</b> = one source's claim, an inference, or our own convention; <b className="font-medium text-ink-2">untested</b> = our sources are silent; <b className="font-medium text-ink-2">contradicted</b> = they argue against it.
        </span>
      </Reveal>

      {res?.frozen && <FrozenNote res={res} name={name} />}
      <Sets rb={rb} name={name} satVerdict={satVerdict} />
      <Savings rb={rb} res={res} name={name} />
      <Satellite rb={rb} res={res} name={name} data={data} />
      <Forward rb={rb} data={data} name={name} />
      <Rules rb={rb} satVerdict={satVerdict} go={go} />
      <Process rb={rb} />
      <Testing rb={rb} />
      <Decisions rb={rb} go={go} />
      <p className="meta mt-16 normal-case tracking-[0.04em]">Analysis only, not financial advice. The registry is fixed in advance; it changes only at a scheduled review, with a change note, never right after a drawdown.</p>
    </Container>
  );
}

function FrozenNote({ res, name }) {
  const differs = [
    ...(res.satellite?.rules ?? []).filter((r) => r.verdict_today && r.verdict_today !== r.verdict).map((r) => ({ id: r.id, now: r.verdict_today, frozen: r.verdict })),
    ...(res.savings?.horizons ?? []).flatMap((h) => h.rows.filter((r) => r.verdict_today && r.verdict_today !== r.verdict).map((r) => ({ id: r.id, now: r.verdict_today, frozen: r.verdict, weeks: h.weeks }))),
  ];
  return (
    <Reveal className="card mt-5 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
      <span className="text-accent">Read once.</span> The history verdicts were fixed on {fmtDate(res.frozen.as_of)}, the first real-data run of these rules.
      The numbers below keep updating each day, but the verdict does not, because a verdict that flips on a lucky day is cherry-picking.
      Later data counts only through the forward record.
      {differs.length > 0 && (
        <span className="mt-3 block text-ink-3">
          Today's numbers would read differently for {differs.map((d, i) => `${i ? ", " : ""}${name(d.id)}${d.weeks ? ` (${HORIZON(d.weeks)})` : ""}: ${LABEL[d.now] ?? d.now} instead of ${LABEL[d.frozen] ?? d.frozen}`).join("")}. That is display only.
        </span>
      )}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ sets */

function Sets({ rb, name, satVerdict }) {
  return (
    <section className="pt-20">
      <SectionHead eyebrow="The plans" title={<>Rules that <Accent>fit together.</Accent></>} size="md"
        lede="A plan is a complete way of behaving: where the savings go, how names are chosen, how they are sized and left, and what we do each month." />
      <div className="grid gap-4 md:grid-cols-2">
        {rb.sets.map((s, i) => (
          <Reveal key={s.id} delay={i * 70} className="card p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <span className="meta">{s.role.replace("_", " ")}</span>
            </div>
            <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">{s.name}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.plain}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {s.rule_ids.map((id) => (
                <a key={id} href={`#rule-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`rule-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                  className="rounded-full border border-line-2 px-3 py-1.5 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink">
                  {satVerdict[id] && <i className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: DOT[satVerdict[id]] }} />}{name(id)}
                </a>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- savings */

function Savings({ rb, res, name }) {
  const sv = res?.savings;
  const [hw, setHw] = useState(null);
  if (!sv?.horizons?.length) {
    return (
      <section className="pt-24">
        <SectionHead eyebrow="Savings" title={<>How often do we <Accent>buy?</Accent></>} size="md" />
        <Empty title="Appears after the next daily run">The savings study is computed from the full price history.</Empty>
      </section>
    );
  }
  const h = sv.horizons.find((x) => x.weeks === (hw ?? sv.horizons.at(-1).weeks)) ?? sv.horizons[0];
  const stream = h.rows.filter((r) => r.mode === "stream");
  const windfall = h.rows.filter((r) => r.mode === "windfall");
  const others = stream.filter((r) => r.verdict !== "baseline");
  const clear = others.filter((r) => ["better", "worse"].includes(r.verdict));
  const tooFew = others.length > 0 && others.every((r) => r.verdict === "too_few_independent_windows");
  const maxBps = Math.max(0, ...stream.filter((r) => r.vs_baseline_irr_bps_median != null).map((r) => Math.abs(r.vs_baseline_irr_bps_median)));
  return (
    <section className="pt-24">
      <SectionHead eyebrow={`Savings · ${HORIZON(h.weeks)} windows · ${h.windows} start dates, about ${h.independent} independent`} title={<>How often do we <Accent>buy?</Accent></>} size="md"
        lede={<>Cash arrives every week and is invested every x weeks. Windows overlap heavily, so the real number of independent periods is small.{" "}
          {tooFew ? <>This horizon has too few independent periods to tell cadences apart: <span className="text-ink">choose by pay day and what your broker charges per trade.</span></>
            : clear.length === 0 ? <>No cadence was clearly better than another: <span className="text-ink">choose the one that matches pay day and what your broker charges per trade.</span></> : <>Some differences are clear; read the rows.</>}</>}
        right={sv.horizons.length > 1 ? <Segmented label="Horizon" value={h.weeks} onChange={setHw} options={sv.horizons.map((x) => ({ value: x.weeks, label: HORIZON(x.weeks) }))} /> : null} />
      <Reveal className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-[14px]">
          <thead className="meta">
            <tr className="border-b border-line">{["Rule", "Trades / yr", "Typical return", "vs baseline", "Better in", "Worst gap vs paid in", "Cash held", "Fee tie", ""].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr>
          </thead>
          <tbody>
            {stream.map((r) => <SavingsRow key={r.id} r={r} name={name} />)}
          </tbody>
        </table>
      </Reveal>
      <div className="grid gap-3 md:hidden">
        {stream.map((r) => <SavingsCard key={r.id} r={r} name={name} />)}
      </div>
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        "Fee tie": the fixed fee per trade, as a share of one weekly contribution, at which buying less often catches up with weekly buying. Maximum difference between cadences here: {fmtNum(maxBps, 0)} basis points a year (100 basis points, written bp, = 1 percentage point).
        "Worst gap" is the 1-in-10 worst moment between what you had put in and what the account was worth.
      </p>
      {windfall.length > 0 && (
        <>
          <h3 className="mt-14 text-[22px] font-semibold tracking-[-0.02em]">A lump sum, all at once or spread out</h3>
          <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">If a bonus or inheritance arrives, is it better to invest it immediately or in weekly portions, with the waiting cash in T-bills?</p>
          <div className="mt-5 grid gap-3 md:hidden">{windfall.map((r) => <SavingsCard key={r.id} r={r} name={name} />)}</div>
          <Reveal className="card mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="meta"><tr className="border-b border-line">{["Rule", "Typical return", "vs lump sum", "Better in", "Worst gap vs paid in", ""].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr></thead>
              <tbody>
                {windfall.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium">{name(r.id)}</td>
                    <td className="num px-4 py-3 font-mono">{fmtPct(r.irr_median_pct, 1)}</td>
                    <td className="num px-4 py-3 font-mono">{r.vs_baseline_irr_bps_median != null ? `${fmtNum(r.vs_baseline_irr_bps_median, 0)} bp` : "–"}</td>
                    <td className="num px-4 py-3 font-mono">{r.vs_baseline_better_pct != null ? `${fmtNum(r.vs_baseline_better_pct, 0)}%` : "–"}</td>
                    <td className="num px-4 py-3 font-mono text-down">{fmtPct(r.worst_vs_paid_p10_pct, 0)}</td>
                    <td className="px-4 py-3"><Chip kind={r.verdict} icon={false}>{LABEL[r.verdict] ?? r.verdict}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </>
      )}
    </section>
  );
}

function SavingsCard({ r, name }) {
  const d = r.vs_baseline_irr_bps_median;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3"><span className="font-medium">{name(r.id)}</span><Chip kind={r.verdict} icon={false}>{LABEL[r.verdict] ?? r.verdict}</Chip></div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat k="Trades / yr" v={fmtNum(r.trades_per_year, 0)} />
        <Stat k="Typical return" v={fmtPct(r.irr_median_pct, 1)} />
        <Stat k="vs baseline" v={d != null ? `${d > 0 ? "+" : ""}${fmtNum(d, 0)} bp` : "baseline"} tone={d == null ? "text-ink-3" : d >= 0 ? "text-accent" : "text-down"} />
        <Stat k="Better in" v={r.vs_baseline_better_pct != null ? `${fmtNum(r.vs_baseline_better_pct, 0)}%` : "–"} />
        <Stat k="Worst gap" v={fmtPct(r.worst_vs_paid_p10_pct, 0)} tone="text-down" />
        <Stat k="Cash held" v={`${fmtNum(r.cash_share_median_pct, 0)}%`} sub={r.breakeven_fee_pct_of_weekly != null ? `fee tie ${r.breakeven_fee_pct_of_weekly > 0 ? fmtNum(r.breakeven_fee_pct_of_weekly, 1) + "%" : "never"}` : null} />
      </div>
    </div>
  );
}

function SavingsRow({ r, name }) {
  const d = r.vs_baseline_irr_bps_median;
  return (
    <tr className="border-b border-line last:border-0 hover:bg-ink/[0.03]">
      <td className="px-4 py-3 font-medium">{name(r.id)}</td>
      <td className="num px-4 py-3 font-mono">{fmtNum(r.trades_per_year, 0)}</td>
      <td className="num px-4 py-3 font-mono">{fmtPct(r.irr_median_pct, 1)}</td>
      <td className={`num px-4 py-3 font-mono ${d == null ? "text-ink-3" : d >= 0 ? "text-accent" : "text-down"}`}>{d != null ? `${d > 0 ? "+" : ""}${fmtNum(d, 0)} bp` : "baseline"}</td>
      <td className="num px-4 py-3 font-mono">{r.vs_baseline_better_pct != null ? `${fmtNum(r.vs_baseline_better_pct, 0)}%` : "–"}</td>
      <td className="num px-4 py-3 font-mono text-down">{fmtPct(r.worst_vs_paid_p10_pct, 0)}</td>
      <td className="num px-4 py-3 font-mono text-ink-2">{fmtNum(r.cash_share_median_pct, 0)}%</td>
      <td className="num px-4 py-3 font-mono text-ink-2">{r.breakeven_fee_pct_of_weekly != null ? (r.breakeven_fee_pct_of_weekly > 0 ? `${fmtNum(r.breakeven_fee_pct_of_weekly, 1)}%` : "never") : "–"}</td>
      <td className="px-4 py-3"><Chip kind={r.verdict} icon={false}>{LABEL[r.verdict] ?? r.verdict}</Chip></td>
    </tr>
  );
}

/* ------------------------------------------------------------- satellite */

function Satellite({ rb, res, name, data }) {
  const sat = res?.satellite;
  const [shown, setShown] = useState(null);
  const goal = data.settings.goal.annual_return_pct;
  const rows = sat?.rules ?? [];
  const sel = shown ?? rows.slice(0, 3).map((r) => r.id);
  const axis = useMemo(() => {
    if (!sat) return null;
    const vals = [sat.controls.core.cagr_pct, sat.controls.equal_weight.cagr_pct, ...rows.flatMap((r) => [r.null_cagr_pct.p05, r.null_cagr_pct.p95, r.stats.cagr_pct])];
    const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    return { lo, hi, pos: (v) => ((v - lo) / (hi - lo)) * 100 };
  }, [sat]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sat) {
    return (
      <section className="pt-24">
        <SectionHead eyebrow="The satellite" title={<>How do we choose <Accent>names?</Accent></>} size="md" />
        <Empty title="Appears after the next daily run">The satellite rules are backtested on the full price history against random names.</Empty>
      </section>
    );
  }
  const n = sat.null.runs;
  const colors = ["var(--accent)", "var(--ai)", "var(--people)", "var(--down)", "var(--ink)"];
  return (
    <section className="pt-24">
      <SectionHead eyebrow={`The satellite · ${fmtDate(sat.from)} to ${fmtDate(sat.to)} · ${fmtNum(sat.years, 1)} years`} title={<>How do we choose <Accent>names?</Accent></>} size="md"
        lede={<>Each rule is compared with {fmtNum(n, 0)} random draws that hold the <span className="text-ink">same number of names at each decision, replace them at the same rate</span> and pay the same costs. Only <em>which</em> names differs, so what is left is selection: skill or luck.</>} />
      <Reveal className="card p-5 sm:p-8">
        <div className="meta mb-5 flex flex-wrap gap-x-6 gap-y-2 normal-case tracking-[0.04em]">
          <span><i className="mr-2 inline-block h-3 w-8 rounded bg-line-2 align-middle" />random names: 5th to 95th percentile</span>
          <span><i className="mr-2 inline-block size-2.5 rounded-full bg-accent align-middle" />the rule (a year, compounded)</span>
          <span><i className="mr-2 inline-block h-3 w-px bg-ink align-middle" />core</span>
          <span><i className="mr-2 inline-block h-3 border-l border-dashed border-ink-2 align-middle" />all names equal</span>
        </div>
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[200px_minmax(0,1fr)_72px]">
              <button type="button" className="min-w-0 truncate text-left text-[13px] text-ink-2 hover:text-ink sm:text-[14px]" title={name(r.id)} onClick={() => document.getElementById(`rule-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{name(r.id)}</button>
              <div className="relative h-7">
                <i className="absolute top-0 h-full w-px bg-ink" style={{ left: `${axis.pos(sat.controls.core.cagr_pct)}%` }} />
                <i className="absolute top-0 h-full border-l border-dashed border-ink-2" style={{ left: `${axis.pos(sat.controls.equal_weight.cagr_pct)}%` }} />
                <i className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-line-2" style={{ left: `${axis.pos(r.null_cagr_pct.p05)}%`, width: `${axis.pos(r.null_cagr_pct.p95) - axis.pos(r.null_cagr_pct.p05)}%` }} />
                <i className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-3" style={{ left: `${axis.pos(r.null_cagr_pct.p50)}%` }} />
                <i className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${axis.pos(r.stats.cagr_pct)}%`, background: DOT[r.verdict] }} />
              </div>
              <span className="num text-right font-mono text-[13px]">{fmtPct(r.stats.cagr_pct, 1)}</span>
            </div>
          ))}
        </div>
        <div className="meta mt-4 flex justify-between normal-case tracking-[0.04em]"><span>{axis.lo}% a year</span><span>{axis.hi}%</span></div>
      </Reveal>

      <Reveal className="card mt-5 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left text-[14px]">
          <thead className="meta">
            <tr className="border-b border-line">{["Rule", "A year", "vs core", "Beats random", "First / second half", "Deepest drop", "Trading", "Names", "Verdict"].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top hover:bg-ink/[0.03]">
                <td className="px-4 py-3 font-medium">{name(r.id)}</td>
                <td className={`num px-4 py-3 font-mono ${r.stats.cagr_pct >= goal ? "text-accent" : ""}`}>{fmtPct(r.stats.cagr_pct, 1)}</td>
                <td className={`num px-4 py-3 font-mono ${r.vs_core_cagr_pts >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(r.vs_core_cagr_pts, 1)}</td>
                <td className="num px-4 py-3 font-mono">{fmtNum(r.percentile, 0)}%<div className="text-[11.5px] text-ink-3">p {fmtNum(r.p_value, 3)}, adj {fmtNum(r.p_adjusted, 2)}</div></td>
                <td className="num px-4 py-3 font-mono">{fmtNum(r.percentile_halves[0], 0)}% / {fmtNum(r.percentile_halves[1], 0)}%</td>
                <td className="num px-4 py-3 font-mono text-down">{fmtPct(r.stats.max_dd_pct, 0)}<div className="text-[11.5px] text-ink-3">core {fmtPct(sat.controls.core.max_dd_pct, 0)}</div></td>
                <td className="num px-4 py-3 font-mono">{fmtNum(r.turnover_pct_year, 0)}%<div className="text-[11.5px] text-ink-3">a year{r.stops ? `, ${r.stops} stops` : ""}</div></td>
                <td className="num px-4 py-3 font-mono">{fmtNum(r.avg_names, 1)}</td>
                <td className="px-4 py-3">
                  <Chip kind={r.verdict} icon={false}>{LABEL[r.verdict]}</Chip>
                  <ul className="mt-2 max-w-[260px] text-[11.5px] leading-snug text-ink-3">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <div className="mt-5 grid gap-3 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-start justify-between gap-3"><span className="font-medium">{name(r.id)}</span><Chip kind={r.verdict} icon={false}>{LABEL[r.verdict]}</Chip></div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Stat k="A year" v={fmtPct(r.stats.cagr_pct, 1)} tone={r.stats.cagr_pct >= goal ? "text-accent" : ""} />
              <Stat k="vs core" v={fmtPct(r.vs_core_cagr_pts, 1)} tone={r.vs_core_cagr_pts >= 0 ? "text-accent" : "text-down"} />
              <Stat k="Beats random" v={`${fmtNum(r.percentile, 0)}%`} sub={`adj p ${fmtNum(r.p_adjusted, 2)}`} />
              <Stat k="Halves" v={`${fmtNum(r.percentile_halves[0], 0)} / ${fmtNum(r.percentile_halves[1], 0)}%`} />
              <Stat k="Deepest drop" v={fmtPct(r.stats.max_dd_pct, 0)} tone="text-down" sub={`core ${fmtPct(sat.controls.core.max_dd_pct, 0)}`} />
              <Stat k="Trading" v={`${fmtNum(r.turnover_pct_year, 0)}%`} sub={`${fmtNum(r.avg_names, 1)} names${r.stops ? `, ${r.stops} stops` : ""}`} />
            </div>
            <ul className="mt-4 grid gap-1 text-[12px] leading-snug text-ink-3">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        Core {fmtPct(sat.controls.core.cagr_pct, 1)} a year, all names equal {fmtPct(sat.controls.equal_weight.cagr_pct, 1)}. "Beats random": the share of random draws the rule outperformed. Passing needs a high percentile after counting {res.tries_counted} tries, in both halves of history.
      </p>

      <Reveal className="card mt-5 p-5 sm:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {rows.map((r, i) => {
            const on = sel.includes(r.id);
            return (
              <button key={r.id} type="button" aria-pressed={on} onClick={() => setShown(on ? sel.filter((x) => x !== r.id) : [...sel, r.id])}
                className={`min-h-[36px] rounded-full border px-3.5 text-[13px] ${on ? "border-accent/60 bg-accent/10 text-ink" : "border-line-2 text-ink-3 hover:text-ink"}`}>{name(r.id)}</button>
            );
          })}
        </div>
        <LinesChart dates={sat.weekly.dates} ariaLabel="Growth of 100: the selected rules, the core and all names equal"
          series={[
            { key: "core", label: "Core", values: sat.weekly.core, color: "var(--ink)", width: 1.6 },
            { key: "ew", label: "All names equal", values: sat.weekly.equal_weight, color: "var(--ink-3)", dash: true, width: 1.6 },
            ...sel.map((id, i) => ({ key: id, label: name(id), values: sat.weekly.rules[id], color: colors[i % colors.length], width: 2.2 })),
          ]} />
      </Reveal>
    </section>
  );
}

/* --------------------------------------------------------------- forward */

function Forward({ rb, data, name }) {
  const led = data.ledger && !data.ledger.sample ? data.ledger : null;
  const rows = Object.entries(led?.rules ?? {});
  const min = rb.acceptance.min_paper_days;
  return (
    <section className="pt-24">
      <SectionHead eyebrow="Forward record · written once a month, never edited" title={<>The test <Accent>nobody can fit.</Accent></>} size="md"
        lede={`Every testable rule writes its holdings on the first run of each month, using only that day's data. After ${min} days this, not the history, decides which rules deserve money.`} />
      {rows.length === 0 ? (
        <Empty title="Starts with the next daily run">The first decisions are written by the daily routine. Each rule's track appears from the second day.</Empty>
      ) : (
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead className="meta"><tr className="border-b border-line">{["Rule", "Since", "Days", "Decisions", "Rule", "Core", "Beats random", "Holds now"].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr></thead>
            <tbody>
              {rows.map(([id, r]) => {
                const k = led.dates.indexOf(r.started);
                const last = r.values.length - 1;
                const coreRet = led.core.at(-1) / led.core[k] * 100 - 100;
                const ret = r.values.at(-1) - 100;
                return (
                  <tr key={id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium">{name(id)}</td>
                    <td className="num px-4 py-3 font-mono text-ink-2">{r.started}</td>
                    <td className="num px-4 py-3 font-mono">{last}{last < min ? <span className="text-ink-3"> / {min}</span> : null}</td>
                    <td className="num px-4 py-3 font-mono">{r.decisions}</td>
                    <td className={`num px-4 py-3 font-mono ${ret >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(ret, 1)}</td>
                    <td className="num px-4 py-3 font-mono text-ink-2">{fmtPct(coreRet, 1)}</td>
                    <td className="num px-4 py-3 font-mono">{r.forward_percentile != null
                      ? <>{fmtNum(r.forward_percentile, 0)}%{last < min ? <span className="text-ink-3"> provisional</span> : null}</>
                      : <span className="text-ink-3">after 6 decisions</span>}{r.stale ? <span className="block text-[11.5px] text-people">prices missing: last good track</span> : null}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{r.rebalances.at(-1).holdings.join(" · ") || <span className="text-ink-3">core only</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Reveal>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- rules */

function Rules({ rb, satVerdict, go }) {
  return (
    <section className="pt-24">
      <SectionHead eyebrow="Every rule" title={<>Written down, <Accent>in advance.</Accent></>} size="md"
        lede="Each rule has one fixed set of numbers, written down before any result was seen. Some come from the sources we keep; many are our own conventions, and each says which. The reason, the evidence rating and what would drop it are next to it." />
      {FAMILIES.map(([fam, title, sub]) => {
        const list = rb.rules.filter((r) => r.family === fam);
        if (!list.length) return null;
        return (
          <div key={fam} className="mb-12">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1"><h3 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h3><span className="text-[14px] text-ink-3">{sub}</span></div>
            <div className="grid gap-4 lg:grid-cols-2">
              {list.map((r, i) => <RuleCard key={r.id} r={r} verdict={satVerdict[r.id]} i={i} go={go} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function RuleCard({ r, verdict, i, go }) {
  const [open, setOpen] = useState(false);
  const chipKind = verdict ?? r.status;
  return (
    <Reveal delay={i * 50} as="article" id={`rule-${r.id}`} className="card scroll-mt-28 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Chip kind={chipKind} icon={false}>{LABEL[chipKind]}</Chip>
        <span className={`meta ${EVIDENCE[r.evidence]}`}>evidence: {r.evidence}</span>
      </div>
      <h4 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">{r.name}</h4>
      <p className="mt-2 text-[15px] leading-relaxed">{r.plain}</p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="meta mt-4 inline-flex min-h-[32px] items-center gap-1 hover:text-ink">{open ? "Hide the detail" : "The exact rule, numbers and tests"} <ArrowRight className={`size-3.5 transition ${open ? "rotate-90" : ""}`} /></button>
      {open && (
        <div className="mt-4 grid gap-4 text-[14px] leading-relaxed">
          <div><div className="meta mb-1">Exactly</div><p className="text-ink-2">{r.definition}</p></div>
          {r.params.length > 0 && (
            <div><div className="meta mb-1">Numbers, fixed in advance</div>
              <dl className="grid gap-1.5">{r.params.map((p) => <div key={p.name} className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 border-t border-line pt-1.5"><dt className="font-mono text-[12.5px]">{p.name} = {p.value}</dt><dd className="text-ink-3">{p.why}</dd></div>)}</dl></div>
          )}
          <div><div className="meta mb-1">Why it is on the list</div><p className="text-ink-2">{r.why_included}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="meta mb-1 text-accent">{adoptLabel(r)}</div><p className="text-ink-2">{r.adopt_if}</p></div>
            <div><div className="meta mb-1 text-down">Dropped if</div><p className="text-ink-2">{r.reject_if}</p></div>
          </div>
          {r.library_refs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5"><span className="meta mr-1">Sources cited</span>
              {r.library_refs.map((x) => <button key={x} type="button" onClick={() => go("insights")} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2 hover:text-ink">{x}</button>)}</div>
          )}
          {r.data_needed && r.status === "needs_data" && <p className="text-people">Needs data we do not have: {r.data_needed}. The owner approves any provider first.</p>}
        </div>
      )}
    </Reveal>
  );
}

/* --------------------------------------------------------------- process */

function Process({ rb }) {
  const byId = Object.fromEntries(rb.rules.map((r) => [r.id, r]));
  const monthly = ["savings_monthly_autopilot", "drawdown_playbook", "precommit_no_override"].map((id) => byId[id]).filter(Boolean);
  const yearly = ["rule_change_protocol", "stock_pot_size"].map((id) => byId[id]).filter(Boolean);
  const month = new Date().toISOString().slice(0, 7);
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem(`sb-checklist-${month}`) || "[]"); } catch { return []; } });
  if (!monthly.length && !yearly.length) return null;
  const toggle = (id) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try { localStorage.setItem(`sb-checklist-${month}`, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  };
  const List = ({ list }) => (
    <ul>
      {list.map((r) => (
        <li key={r.id} className="border-b border-line last:border-0">
          <button type="button" onClick={() => toggle(r.id)} aria-pressed={done.includes(r.id)} className="flex min-h-[56px] w-full items-start gap-4 px-2 py-3 text-left">
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[12px] ${done.includes(r.id) ? "border-accent bg-accent text-bg" : "border-line-2 text-transparent"}`}>✓</span>
            <span><span className="block font-medium">{r.name}</span><span className="block text-[14px] leading-relaxed text-ink-2">{r.plain}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="pt-24">
      <SectionHead eyebrow={`This month · ${month}`} title={<>The monthly <Accent>checklist.</Accent></>} size="md"
        lede="Each month: check the index-fund order went through; read the paper record; write down any fall of 10% or more; place no other orders. Until a stock rule has earned money, the index purchase is the only real action. Ticks stay on this device." />
      <Reveal className="card p-3 sm:p-5"><List list={monthly} /></Reveal>
      {yearly.length > 0 && (
        <>
          <h3 className="mt-10 text-[22px] font-semibold tracking-[-0.02em]">Once a year</h3>
          <p className="mt-1 text-[14px] text-ink-3">Review the rules and the stock pot size at the yearly review, never right after a fall.</p>
          <Reveal className="card mt-4 p-3 sm:p-5"><List list={yearly} /></Reveal>
        </>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- testing */

function Testing({ rb }) {
  const a = rb.acceptance;
  const alpha = (100 - a.satellite.null_percentile_min) / 100;
  const maxAbove = Math.max(0, Math.floor((alpha * (a.null_runs + 1)) / rb.tries_counted - 1));
  const pctBar = (100 * (a.null_runs - maxAbove)) / a.null_runs;
  const isPlanned = (x) => /^\[planned/.test(x);
  return (
    <section className="pt-24">
      <SectionHead eyebrow="How we test" title={<>How a rule <Accent>earns its place.</Accent></>} size="md"
        lede={`Written before any result was seen. ${rb.tries_counted} variants are counted as tries, so the bar for "not luck" rises with every rule added.`} />
      <Reveal className="card mb-4 p-5 text-[14.5px] leading-relaxed text-ink-2">
        <span className="mr-1.5 inline-block rounded-full border border-accent/50 px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] text-accent">program</span>
        checked automatically on every daily run. <span className="mx-1.5 inline-block rounded-full border border-dashed border-people/60 px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] text-people">planned</span>
        written down now but not built yet: people check it by hand before any money. "E04" and the like name the experiments listed below.
      </Reveal>
      <div className="grid gap-4 lg:grid-cols-3">
        {[["adopt", "Passes history (paper record only, no money)", "text-accent"], ["candidate", "Stays a candidate", "text-people"], ["reject", "Dropped", "text-down"]].map(([k, t, c]) => {
          const now = a.text[k].filter((x) => !isPlanned(x));
          const later = a.text[k].filter(isPlanned);
          return (
            <Reveal key={k} className="card p-6"><div className={`meta mb-3 ${c}`}>{t}</div>
              <ul className="grid gap-2 text-[14.5px] leading-relaxed text-ink-2">{now.map((x) => <li key={x} className="flex gap-2"><span className={c}>–</span><span><Tagged text={x} /></span></li>)}</ul>
              {later.length > 0 && (
                <details className="mt-4">
                  <summary className="meta cursor-pointer hover:text-ink">Later checks, not built yet ({later.length})</summary>
                  <ul className="mt-3 grid gap-2 text-[14.5px] leading-relaxed text-ink-2">{later.map((x) => <li key={x} className="flex gap-2"><span className={c}>–</span><span><Tagged text={x} /></span></li>)}</ul>
                </details>
              )}
            </Reveal>
          );
        })}
      </div>
      <Reveal className="card mt-4 p-6 text-[14.5px] leading-relaxed text-ink-2">
        <div className="meta mb-3">The numbers</div>
        A rule must beat almost every random pick: out of {a.null_runs} random baskets, at most {maxAbove} may match or beat it (about {fmtNum(pctBar, 1)}% beaten: the {a.satellite.null_percentile_min}% bar, tightened for {rb.tries_counted} tries),
        and it must beat at least {a.satellite.halves_percentile_min}% of them in each half of history. Its worst fall may be at most {a.satellite.max_dd_worse_than_core_pts} points deeper than the index fund's.
        It may replace at most {a.satellite.max_turnover_pct_year}% of the stock pot a year ({a.satellite.max_turnover_pct_year}% means the whole pot twice). Orders fill the day after the signal.
        Then at least {a.min_paper_days} days of forward paper record, and every other money condition, before any money.
      </Reveal>
      <div className="mt-6 grid gap-3">
        {rb.experiments.map((e) => (
          <Reveal key={e.id} className="card p-5">
            <div className="font-medium"><span className="meta mr-2 normal-case tracking-[0.04em]">{e.id.split("_")[0]}</span>{e.question}</div>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{e.method}</p>
            <p className="meta mt-3 normal-case tracking-[0.04em]">Against: {e.null_model} · Pass: {e.pass_criteria}</p>
          </Reveal>
        ))}
      </div>
      {rb.not_supported.length > 0 && (
        <>
          <h3 className="mt-14 text-[22px] font-semibold tracking-[-0.02em]">What we will not do</h3>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {rb.not_supported.map((x) => <li key={x.name} className="card p-5"><div className="font-medium">{x.name}</div><p className="mt-1 text-[14px] leading-relaxed text-ink-2">{x.why}</p></li>)}
          </ul>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- decisions */

function Decisions({ rb, go }) {
  const owner = rb.open_questions.filter((q) => q.owner_decision);
  const housekeeping = rb.open_questions.filter((q) => !q.owner_decision);
  if (!owner.length && !housekeeping.length) return null;
  return (
    <section className="pt-24">
      <SectionHead eyebrow="Open" title={<>What only <Accent>you</Accent> can decide.</>} size="md"
        lede="Where a number is marked 'decided for this version', it is fixed in the registry and you are only asked whether you accept it. Changing one later is a new version and a counted try." />
      <ul className="grid gap-3 md:grid-cols-2">
        {owner.map((q) => (
          <li key={q.question} className="card border-people/40 p-5">
            <span className="pill mb-3 border-dashed border-people/60 text-people">owner decision</span>
            <p className="text-[15px] leading-relaxed">{q.question}</p>
          </li>
        ))}
      </ul>
      {housekeeping.length > 0 && (
        <details className="mt-6">
          <summary className="meta cursor-pointer hover:text-ink">Housekeeping for the program's author, no decision needed ({housekeeping.length})</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">{housekeeping.map((q) => <li key={q.question} className="card p-5 text-[14.5px] leading-relaxed text-ink-2">{q.question}</li>)}</ul>
        </details>
      )}
      <button type="button" onClick={() => go("admin")} className="meta mt-5 inline-flex items-center gap-1 hover:text-ink">Decision log <ArrowRight className="size-3.5" /></button>
    </section>
  );
}
