import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct, signTone } from "../lib/format.js";
import { LinesChart } from "../components/lines.jsx";
import { Accent, ArrowRight, Chip, Container, Empty, Headline, Reveal, SectionHead, Segmented } from "../components/ui.jsx";
import { BaseRates } from "../components/checklist.jsx";
import { edgeWords, fillNote, forwardWords } from "../lib/checklist.js";

const FAMILIES = [
  ["savings", "Saving", "How often we put money into the core (the big main fund)"],
  ["entry", "Picking stocks (pretend)", "What gets a stock into the side bet, on paper only"],
  ["exit", "Letting go (pretend)", "What gets a stock out again"],
  ["sizing", "How much", "How big a slice each one gets"],
  ["risk", "Safety", "What keeps a bad fall from hurting too much"],
  ["fundamental", "The business", "How the company itself is doing, not its price chart"],
  ["process", "Habits", "How we behave"],
];
const LABEL = {
  passes_history: "passed the past test", candidate: "still being checked", inconclusive: "cannot tell yet", rejected: "rejected",
  needs_data: "needs data", process_only: "habit", testable_now: "can be tested", reference_baseline: "the plain way", control: "for comparison",
  baseline: "the plain way", no_clear_difference: "no clear difference", too_few_independent_windows: "too little history", better: "better", worse: "worse",
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
  if (r.family === "savings" && r.status === "testable_now") return "Replaces the plain way if";
  if (r.status === "testable_now") return "Passes the past test if";
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
    return <Container className="pt-20"><Empty title="No rules written down yet">The household's rules live in config/rules.json.</Empty></Container>;
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
  const satRows = res?.satellite?.rules ?? [];
  const allRejected = satRows.length > 0 && satRows.every((r) => r.verdict === "rejected");

  return (
    <Container className="pt-14">
      <Reveal className="eyebrow mb-4">Our rules · version {rb.version} · {fmtDate(rb.updated_at)}{res ? ` · ${res.sample ? "sample prices" : `tested on real past prices up to ${fmtDate(res.as_of)}`}` : ""}</Reveal>
      <Headline size="xl" className="max-w-[16ch]">Our rules, <Accent>written down first.</Accent></Headline>
      <Reveal delay={200} as="p" className="mt-6 max-w-[64ch] text-[clamp(17px,1.7vw,20px)] leading-relaxed text-ink">
        <b className="font-semibold">In simple words:</b> these are the household's rules, written down before we saw any results, like writing your guess on paper before the coin is flipped.
        The stock-picking rules are experiments with pretend money, to learn whether picking stocks can beat just owning the whole market.{allRejected ? " So far, on past prices, none did: every one was rejected because it did no better than stocks picked at random." : ""}
        This page is not a list of what we will buy. Real money follows the honest action on the verdicts page, which is usually: keep buying a low-cost fund that holds the whole market.
      </Reveal>
      <div className="mt-6 grid max-w-[64ch] gap-4">
        {rb.trader.split("\n\n").map((para, i) => <Reveal key={i} delay={250 + i * 90} as="p" className="text-[clamp(17px,1.7vw,20px)] leading-relaxed text-ink-2">{para}</Reveal>)}
      </div>
      <Reveal delay={350} className="mt-8 flex flex-wrap gap-2 text-[13px]">
        <span className="pill">{rb.rules.length} rules</span>
        <span className="pill">{counts.tested} tested on past prices</span>
        {counts.needs > 0 && <span className="pill border-dashed border-people/60 text-people">{counts.needs} need data</span>}
        <span className="pill">{counts.process} habits</span>
        <span className="pill">{rb.tries_counted} tries counted</span>
      </Reveal>
      <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-ink-3">A "try" is any version of a rule we test or keep on the shelf. Roll a die enough times and you will get a six by luck, so the more tries we count, the higher the bar a rule must clear to show it is not just luck.</p>
      <Reveal className="card mt-8 border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
        <span className="text-people">How to read this page.</span> The tests on past prices use today's list of companies, and those are the ones that did well enough to still be here. That makes every result look better than it really was.
        So a rule is judged only against <span className="text-ink">stocks picked at random under the same conditions</span>, never against the +{goal}% goal.
        Every rule that can be tested also gets a pretend-money record from its first run, written down as it goes, which nobody can fiddle with later. Passing the past test only makes a rule worth a closer look. Nothing here moves real money.
        <span className="mt-3 block text-ink-3">
          How sure the experts are: <b className="font-medium text-ink-2">replicated</b> = other researchers checked it again and got the same answer; <b className="font-medium text-ink-2">mixed</b> = more than one source backs it, with buts and gaps;
          <b className="font-medium text-ink-2"> weak</b> = one source says so, or it is a guess or just our own habit; <b className="font-medium text-ink-2">untested</b> = our sources say nothing; <b className="font-medium text-ink-2">contradicted</b> = our sources say it does not work.
        </span>
      </Reveal>

      {res?.frozen && <FrozenNote res={res} name={name} />}
      <Sets rb={rb} name={name} satVerdict={satVerdict} />
      <Savings rb={rb} res={res} name={name} />
      <Satellite rb={rb} res={res} name={name} data={data} />
      <Forward rb={rb} data={data} name={name} />
      <TechChecklist data={data} />
      <Rules rb={rb} satVerdict={satVerdict} go={go} />
      <Process rb={rb} />
      <Testing rb={rb} />
      <Decisions rb={rb} go={go} />
      <p className="meta mt-16 normal-case tracking-[0.04em]">Analysis only, not financial advice. The rules are fixed in advance. They change only at a planned review, with a note saying what changed, never right after a big drop.</p>
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
      <span className="text-accent">Marked once, like a test grade.</span> The results of the past-price test were fixed on {fmtDate(res.frozen.as_of)}, {res.frozen.superseded?.length ? `the latest time these rules were re-marked (${res.frozen.superseded.length} earlier set${res.frozen.superseded.length === 1 ? " is" : "s are"} kept in the file)` : "the first run of these rules on real prices"}.
      The numbers below keep updating each day, but the result does not. If we let it flip on a lucky day, we could just wait for the day we like best.
      Newer prices count only through the pretend-money record.
      {differs.length > 0 && (
        <span className="mt-3 block text-ink-3">
          Today's numbers would read differently for {differs.map((d, i) => `${i ? ", " : ""}${name(d.id)}${d.weeks ? ` (${HORIZON(d.weeks)})` : ""}: ${LABEL[d.now] ?? d.now} instead of ${LABEL[d.frozen] ?? d.frozen}`).join("")}. That is shown for interest only; the fixed result stands.
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
        lede="A plan is a full way of behaving, like a recipe: where the savings go, and for the pretend experiments, how stocks are picked, how big each slice is, when they are let go, and what we do each month." />
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
        <SectionHead eyebrow="Saving" title={<>How often should savings <Accent>go in?</Accent></>} size="md" />
        <Empty title="Shows up after the next daily run">This study needs all the past prices, and the daily computer run has not worked it out yet.</Empty>
      </section>
    );
  }
  // Open on the longest horizon that has enough independent windows to give a verdict (the longer ones show the sign only).
  const usable = sv.horizons.filter((x) => x.independent >= rb.acceptance.savings.min_independent_windows);
  const h = sv.horizons.find((x) => x.weeks === (hw ?? (usable.at(-1) ?? sv.horizons[0]).weeks)) ?? sv.horizons[0];
  const stream = h.rows.filter((r) => r.mode === "stream");
  const windfall = h.rows.filter((r) => r.mode === "windfall");
  const others = stream.filter((r) => r.verdict !== "baseline");
  const clear = others.filter((r) => ["better", "worse"].includes(r.verdict));
  const tooFew = others.length > 0 && others.every((r) => r.verdict === "too_few_independent_windows");
  const maxBps = Math.max(0, ...stream.filter((r) => r.vs_baseline_irr_bps_median != null).map((r) => Math.abs(r.vs_baseline_irr_bps_median)));
  return (
    <section className="pt-24">
      <SectionHead eyebrow={`Saving · ${HORIZON(h.weeks)} stretches · ${h.windows} start dates, about ${h.independent} truly separate`} title={<>How often should savings <Accent>go in?</Accent></>} size="md"
        lede={<>In simple words: money comes in every week, and we test putting it into the core fund every week, every month, or less often. Many test stretches share the same years, like overlapping photos of one street, so there are really only a few separate ones.{" "}
          {tooFew ? <>This length has too few separate stretches to tell the choices apart: <span className="text-ink">pick what matches pay day and what your broker charges per trade.</span></>
            : clear.length === 0 ? <>No choice was clearly better than another: <span className="text-ink">pick what matches pay day and what your broker charges per trade.</span></> : <>Some differences are clear; read the rows.</>}</>}
        right={sv.horizons.length > 1 ? <Segmented label="How long" value={h.weeks} onChange={setHw} options={sv.horizons.map((x) => ({ value: x.weeks, label: HORIZON(x.weeks) }))} /> : null} />
      <Reveal className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-[14px]">
          <thead className="meta">
            <tr className="border-b border-line">{["Rule", "Buys a year", "Typical yearly growth", "vs the plain way", "Better how often", "Worst dip below money put in", "Cash waiting", "Fee where they tie", ""].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr>
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
        "Fee where they tie": the fee per purchase, as a share of one week's savings, at which that row and the plain once-a-month way come out the same. Buying every week or every 2 weeks wins only when fees are below it; buying every 3 months wins only when fees are above it. The biggest difference between the choices here: {fmtNum(maxBps, 0)} bp a year (100 bp = 1%), which is small.
        "Worst dip" is how far the account fell below the money put in, at a bad moment that happens about 1 time in 10.
      </p>
      {windfall.length > 0 && (
        <>
          <h3 className="mt-14 text-[22px] font-semibold tracking-[-0.02em]">A big sum: all at once, or bit by bit?</h3>
          <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">If a bonus or a gift arrives, is it better to put it all into the core fund right away, or a bit each week while the rest waits in safe short-term government savings (T-bills)?</p>
          <div className="mt-5 grid gap-3 md:hidden">{windfall.map((r) => <SavingsCard key={r.id} r={r} name={name} />)}</div>
          <Reveal className="card mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="meta"><tr className="border-b border-line">{["Rule", "Typical yearly growth", "vs all at once", "Better how often", "Worst dip below money put in", ""].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr></thead>
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
        <Stat k="Buys a year" v={fmtNum(r.trades_per_year, 0)} />
        <Stat k="Typical growth" v={fmtPct(r.irr_median_pct, 1)} />
        <Stat k="vs the plain way" v={d != null ? `${d > 0 ? "+" : ""}${fmtNum(d, 0)} bp` : "the plain way"} tone={d == null ? "text-ink-3" : d >= 0 ? "text-accent" : "text-down"} />
        <Stat k="Better how often" v={r.vs_baseline_better_pct != null ? `${fmtNum(r.vs_baseline_better_pct, 0)}%` : "–"} />
        <Stat k="Worst dip" v={fmtPct(r.worst_vs_paid_p10_pct, 0)} tone="text-down" />
        <Stat k="Cash waiting" v={`${fmtNum(r.cash_share_median_pct, 0)}%`} sub={r.breakeven_fee_pct_of_weekly != null ? `fees tie at ${r.breakeven_fee_pct_of_weekly > 0 ? fmtNum(r.breakeven_fee_pct_of_weekly, 1) + "%" : "never"}` : null} />
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
      <td className={`num px-4 py-3 font-mono ${d == null ? "text-ink-3" : d >= 0 ? "text-accent" : "text-down"}`}>{d != null ? `${d > 0 ? "+" : ""}${fmtNum(d, 0)} bp` : "the plain way"}</td>
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
        <SectionHead eyebrow="The side bet · pretend money" title={<>Can a rule pick <Accent>better stocks?</Accent></>} size="md" />
        <Empty title="Shows up after the next daily run">The stock-picking rules are tested on all the past prices against stocks picked at random.</Empty>
      </section>
    );
  }
  const n = sat.null.runs;
  const colors = ["var(--accent)", "var(--ai)", "var(--people)", "var(--down)", "var(--ink)"];
  return (
    <section className="pt-24">
      <SectionHead eyebrow={`The side bet · pretend money · ${fmtDate(sat.from)} to ${fmtDate(sat.to)} · ${fmtNum(sat.years, 1)} years`} title={<>Can a rule pick <Accent>better stocks?</Accent></>} size="md"
        lede={<>In simple words: each stock-picking rule plays against {fmtNum(n, 0)} pretend players who pick stocks at random, like pulling names from a hat. The random players hold the <span className="text-ink">same number of stocks, swap them just as often</span> and pay the same fees. Only <em>which</em> stocks differs, so the race shows whether the rule has skill or just luck. {rows.length > 0 && rows.every((r) => r.verdict === "rejected") ? " So far every rule was rejected: none clearly beat the random pickers." : ""}</>} />
      <Reveal className="card p-5 sm:p-8">
        <div className="meta mb-5 flex flex-wrap gap-x-6 gap-y-2 normal-case tracking-[0.04em]">
          <span><i className="mr-2 inline-block h-3 w-8 rounded bg-line-2 align-middle" />random pickers: the middle 90% of them</span>
          <span><i className="mr-2 inline-block size-2.5 rounded-full bg-accent align-middle" />the rule (average yearly growth)</span>
          <span><i className="mr-2 inline-block h-3 w-px bg-ink align-middle" />core fund (the whole market)</span>
          <span><i className="mr-2 inline-block h-3 border-l border-dashed border-ink-2 align-middle" />every stock on the list, equal shares</span>
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
            <tr className="border-b border-line">{["Rule", "Growth a year", "vs core fund", "Beat random pickers", "First / second half", "Biggest drop", "Swaps a year", "Stocks", "Result"].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top hover:bg-ink/[0.03]">
                <td className="px-4 py-3 font-medium">{name(r.id)}</td>
                <td className={`num px-4 py-3 font-mono ${r.stats.cagr_pct >= goal ? "text-accent" : ""}`}>{fmtPct(r.stats.cagr_pct, 1)}</td>
                <td className={`num px-4 py-3 font-mono ${r.vs_core_cagr_pts >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(r.vs_core_cagr_pts, 1)}</td>
                <td className="num px-4 py-3 font-mono">{fmtNum(r.percentile, 0)}%<div className="text-[11.5px] text-ink-3">luck chance {fmtNum(r.p_value, 3)}, after tries {fmtNum(r.p_adjusted, 2)}</div></td>
                <td className="num px-4 py-3 font-mono">{fmtNum(r.percentile_halves[0], 0)}% / {fmtNum(r.percentile_halves[1], 0)}%</td>
                <td className="num px-4 py-3 font-mono text-down">{fmtPct(r.stats.max_dd_pct, 0)}<div className="text-[11.5px] text-ink-3">core fund {fmtPct(sat.controls.core.max_dd_pct, 0)}</div></td>
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
              <Stat k="Growth a year" v={fmtPct(r.stats.cagr_pct, 1)} tone={r.stats.cagr_pct >= goal ? "text-accent" : ""} />
              <Stat k="vs core fund" v={fmtPct(r.vs_core_cagr_pts, 1)} tone={r.vs_core_cagr_pts >= 0 ? "text-accent" : "text-down"} />
              <Stat k="Beat random" v={`${fmtNum(r.percentile, 0)}%`} sub={`luck chance ${fmtNum(r.p_adjusted, 2)}`} />
              <Stat k="1st / 2nd half" v={`${fmtNum(r.percentile_halves[0], 0)} / ${fmtNum(r.percentile_halves[1], 0)}%`} />
              <Stat k="Biggest drop" v={fmtPct(r.stats.max_dd_pct, 0)} tone="text-down" sub={`core fund ${fmtPct(sat.controls.core.max_dd_pct, 0)}`} />
              <Stat k="Swaps a year" v={`${fmtNum(r.turnover_pct_year, 0)}%`} sub={`${fmtNum(r.avg_names, 1)} stocks${r.stops ? `, ${r.stops} stops` : ""}`} />
            </div>
            <ul className="mt-4 grid gap-1 text-[12px] leading-snug text-ink-3">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        Core fund {fmtPct(sat.controls.core.cagr_pct, 1)} a year; every stock on the list in equal shares {fmtPct(sat.controls.equal_weight.cagr_pct, 1)}. "Beat random pickers": out of 100 random pickers, how many the rule did better than. "Swaps a year": how much of the pot it changed in a year. "Luck chance": how likely a result this good is from luck alone (smaller is better). To pass, a rule must beat almost all of them, after counting {res.tries_counted} tries, in both halves of the past.
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
        <LinesChart dates={sat.weekly.dates} ariaLabel="How 100 would have grown: the chosen rules, the core fund and every stock in equal shares"
          series={[
            { key: "core", label: "Core fund", values: sat.weekly.core, color: "var(--ink)", width: 1.6 },
            { key: "ew", label: "Every stock, equal shares", values: sat.weekly.equal_weight, color: "var(--ink-3)", dash: true, width: 1.6 },
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
      <SectionHead eyebrow="Pretend-money record · written once a month, never edited" title={<>The test <Accent>nobody can fiddle.</Accent></>} size="md"
        lede={`In simple words: each rule writes down its pretend picks at the start of each month (each quarter for the quarterly rule), using only what was known that day. It is like sealing your guess in an envelope before the game. After ${min} days this record is one of the checks listed under How we test. It never puts real money in by itself.`} />
      {rows.length === 0 ? (
        <Empty title="Starts with the next daily run">The daily computer run writes down the first pretend picks. Each rule's line shows up from the second day.</Empty>
      ) : (
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead className="meta"><tr className="border-b border-line">{["Rule", "Since", "Days", "Monthly picks", "Rule grew", "Core fund grew", "Beat random pickers", "Pretend holdings now"].map((x) => <th key={x} className="px-4 py-3 font-normal">{x}</th>)}</tr></thead>
            <tbody>
              {rows.map(([id, r]) => {
                const k = led.dates.indexOf(r.started);
                const last = Math.round((new Date(led.as_of) - new Date(r.started)) / 864e5); // calendar days of record
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
                      ? <>{fmtNum(r.forward_percentile, 0)}%{last < min ? <span className="text-ink-3"> early, may change</span> : null}</>
                      : <span className="text-ink-3">{r.decisions < 6 ? "after 6 monthly picks" : "after 126 days of record"}</span>}{r.stale ? <span className="block text-[11.5px] text-people">prices missing: showing the last good day</span> : null}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{r.rebalances.at(-1).holdings.join(" · ") || <span className="text-ink-3">all in the core fund</span>}</td>
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

/* ------------------------------------------------------- technical checklist */

const STEP_TONE = { accent: "text-accent", down: "text-down", flat: "text-ink-2" };

/** The eight-step checklist from the video: each step, how code computes it, the paper-entry rule and what history says. */
function TechChecklist({ data }) {
  const cfg = data.checklistCfg;
  if (!cfg) return null;
  const ck = data.checklist;
  const br = ck?.base_rates ?? null;
  const hr = cfg.house_rule;
  const bench = data.bench.label;
  const edge = edgeWords(br);
  const stepName = Object.fromEntries(cfg.steps.map((s) => [s.id, s.name]));
  return (
    <section id="checklist" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow={`Chart checklist · from the video · version ${cfg.version} · pretend money`} title={<>Read the chart, <Accent>write the exit first.</Accent></>} size="md" lede={cfg.purpose} />
      <Reveal className="card border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
        <span className="pill mb-3 border-dashed border-people/60 text-people">{cfg.status}</span>
        <ul className="grid gap-2">
          {cfg.how_to_read.map((t) => <li key={t} className="relative pl-4 before:absolute before:left-0 before:top-[0.75em] before:h-px before:w-2 before:bg-people">{t}</li>)}
        </ul>
      </Reveal>

      <ol className="mt-5 grid gap-3 md:grid-cols-2">
        {cfg.steps.map((s, i) => (
          <Reveal as="li" key={s.id} delay={(i % 2) * 60} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[17px] font-semibold"><span className="num mr-2 font-mono text-[13px] font-normal text-ink-3">{s.n}</span>{s.name}</span>
            </div>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{s.checks}</p>
            <div className="meta mt-3 mb-1 normal-case tracking-[0.04em]">How the computer works it out{s.directional ? "" : " · a plan, not an up-or-down guess"}</div>
            <p className="text-[13.5px] leading-relaxed text-ink-2">{s.computes}</p>
          </Reveal>
        ))}
      </ol>

      <Reveal className="card mt-5 border-accent/40 p-5 sm:p-6">
        <div className="meta mb-2 text-accent">When a stock goes into the pretend record</div>
        <p className="text-[15.5px] leading-relaxed text-ink">{hr.text}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{cfg.verdict.text} The rule is marked on the first profit target (TP1), because the second one (TP2) would pass almost every time just by how it is set up.</p>
      </Reveal>

      <Reveal className="card mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[20px] font-semibold tracking-[-0.02em]">What history says</h3>
          {br && <span className="meta normal-case tracking-[0.04em]">{fmtDate(br.from)} to {fmtDate(br.to)} · {br.names} names{ck.sample ? " · sample prices" : ""}</span>}
        </div>
        {br ? (
          <>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">Every {br.step_days} market days, we filled in each stock's checklist using only what was known that day, then checked how it did against the {bench} over the next {br.horizon_days} market days.</p>
            <div className="mt-4"><BaseRates br={br} benchLabel={bench} /></div>
            {edge && <p className="mt-4 text-[14px] leading-relaxed text-ink">{edge}</p>}
            {br.house_rule && (
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                Stocks whose safety plan fit the rule: {fmtPct(br.house_rule.fits.mean ?? 0, 1)} on average ({br.house_rule.fits.n} cases); the rest: {fmtPct(br.house_rule.fails.mean ?? 0, 1)} ({br.house_rule.fails.n} cases).
              </p>
            )}
            {br.by_check?.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <div className="meta mb-2 normal-case tracking-[0.04em]">Each step on its own: average result vs the {bench} when it pointed up or down</div>
                <table className="w-full min-w-[300px] text-left text-[13.5px]">
                  <thead className="meta normal-case tracking-[0.04em]"><tr className="border-b border-line"><th className="py-2 font-normal">Step</th><th className="py-2 pl-2 text-right font-normal">Said "up"</th><th className="py-2 pl-2 text-right font-normal">Said "down"</th></tr></thead>
                  <tbody>
                    {br.by_check.map((c) => (
                      <tr key={c.check} className="border-b border-line last:border-0">
                        <td className="py-2 pr-2">{stepName[c.check] ?? c.check}</td>
                        {["bullish", "bearish"].map((k) => (
                          <td key={k} className={`num whitespace-nowrap py-2 pl-2 text-right font-mono ${c[k]?.n ? STEP_TONE[signTone(c[k].mean, 1)] : "text-ink-3"}`}>
                            {c[k]?.n ? fmtPct(c[k].mean, 1) : "–"}<span className="ml-1 text-[11px] text-ink-3">{c[k]?.n ?? 0}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">If a step worked, its "up" number would sit clearly above its "down" number. The small number after each figure is how many cases.</p>
              </div>
            )}
            <p className="mt-4 text-[13px] leading-relaxed text-ink-3">{fillNote(br.note, br)}</p>
          </>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">Shows up after the next daily run. {cfg.measure.text}</p>
        )}
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{forwardWords(ck?.forward)}</p>
      </Reveal>
      <ul className="mt-5 grid gap-2 text-[13.5px] leading-relaxed text-ink-3">
        {cfg.notes.map((n) => <li key={n} className="relative pl-4 before:absolute before:left-0 before:top-[0.75em] before:h-px before:w-2 before:bg-ink-3">{n}</li>)}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------- rules */

function Rules({ rb, satVerdict, go }) {
  return (
    <section className="pt-24">
      <SectionHead eyebrow="Every rule" title={<>Written down, <Accent>in advance.</Accent></>} size="md"
        lede="Each rule has one fixed set of numbers, written down before any result was seen. Some come from the books and studies we keep; many are just our own habits, and each says which. Next to each: why it is here, how sure the experts are, and what would make us drop it. The stock-picking ones are pretend-money experiments, not a shopping list." />
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
        <span className={`meta ${EVIDENCE[r.evidence]}`}>how sure: {r.evidence}</span>
      </div>
      <h4 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">{r.name}</h4>
      <p className="mt-2 text-[15px] leading-relaxed">{r.plain}</p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="meta mt-4 inline-flex min-h-[32px] items-center gap-1 hover:text-ink">{open ? "Hide the details" : "The exact rule, its numbers and tests"} <ArrowRight className={`size-3.5 transition ${open ? "rotate-90" : ""}`} /></button>
      {open && (
        <div className="mt-4 grid gap-4 text-[14px] leading-relaxed">
          <div><div className="meta mb-1">Exactly how it works</div><p className="text-ink-2">{r.definition}</p></div>
          {r.params.length > 0 && (
            <div><div className="meta mb-1">Its numbers, fixed in advance</div>
              <dl className="grid gap-1.5">{r.params.map((p) => <div key={p.name} className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 border-t border-line pt-1.5"><dt className="font-mono text-[12.5px]">{p.name} = {p.value}</dt><dd className="text-ink-3">{p.why}</dd></div>)}</dl></div>
          )}
          <div><div className="meta mb-1">Why it is on the list</div><p className="text-ink-2">{r.why_included}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="meta mb-1 text-accent">{adoptLabel(r)}</div><p className="text-ink-2">{r.adopt_if}</p></div>
            <div><div className="meta mb-1 text-down">Dropped if</div><p className="text-ink-2">{r.reject_if}</p></div>
          </div>
          {r.library_refs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5"><span className="meta mr-1">Where it comes from</span>
              {r.library_refs.map((x) => <button key={x} type="button" onClick={() => go("insights")} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2 hover:text-ink">{x}</button>)}</div>
          )}
          {r.data_needed && r.status === "needs_data" && <p className="text-people">Needs data we do not have yet: {r.data_needed}. The owner must say yes to any new data source first.</p>}
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
        lede="In simple words: a short to-do list for each month. Check the money went into the whole-market fund; look at the pretend-money record; write down any fall of 10% or more; place no other orders. Buying the whole-market fund is the only real-money step; the stock rules stay pretend. Ticks stay on this device." />
      <Reveal className="card p-3 sm:p-5"><List list={monthly} /></Reveal>
      {yearly.length > 0 && (
        <>
          <h3 className="mt-10 text-[22px] font-semibold tracking-[-0.02em]">Once a year</h3>
          <p className="mt-1 text-[14px] text-ink-3">Look over the rules and the size of the pretend stock pot at the yearly review, never right after a fall.</p>
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
        lede={`In simple words: the marking scheme, written before any result was seen, like a teacher writing the answer key before the exam. ${rb.tries_counted} versions are counted as tries, so the bar for "not just luck" rises with every rule added.`} />
      <Reveal className="card mb-4 p-5 text-[14.5px] leading-relaxed text-ink-2">
        <span className="mr-1.5 inline-block rounded-full border border-accent/50 px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] text-accent">program</span>
        the computer checks it on every daily run. <span className="mx-1.5 inline-block rounded-full border border-dashed border-people/60 px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] text-people">planned</span>
        written down but not built yet: people check it by hand. "E04" and the like name the experiments listed below.
      </Reveal>
      <div className="grid gap-4 lg:grid-cols-3">
        {[["adopt", "Passes the past test (pretend record only, no money)", "text-accent"], ["candidate", "Still being checked", "text-people"], ["reject", "Dropped", "text-down"]].map(([k, t, c]) => {
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
        A rule must beat almost every random picker: out of {a.null_runs} baskets of stocks picked at random, at most {maxAbove} may match or beat it (it must beat about {fmtNum(pctBar, 1)}% of them: the {a.satellite.null_percentile_min}% bar, made stricter for {rb.tries_counted} tries),
        and it must beat at least {a.satellite.halves_percentile_min}% of them in each half of the past. Its biggest drop may be at most {a.satellite.max_dd_worse_than_core_pts} points deeper than the whole-market fund's.
        It may swap at most {a.satellite.max_turnover_pct_year}% of the pretend stock pot a year ({a.satellite.max_turnover_pct_year}% means changing the whole pot twice). Pretend trades happen the day after the rule says so.
        Then it needs at least {a.min_paper_days} days of pretend-money record, and must pass every other check.
      </Reveal>
      <div className="mt-6 grid gap-3">
        {rb.experiments.map((e) => (
          <Reveal key={e.id} className="card p-5">
            <div className="font-medium"><span className="meta mr-2 normal-case tracking-[0.04em]">{e.id.split("_")[0]}</span>{e.question}</div>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{e.method}</p>
            <p className="meta mt-3 normal-case tracking-[0.04em]">Compared with: {e.null_model} · Passes if: {e.pass_criteria}</p>
          </Reveal>
        ))}
      </div>
      {rb.not_supported.length > 0 && (
        <>
          <h3 className="mt-14 text-[22px] font-semibold tracking-[-0.02em]">Left out, and what is not built yet</h3>
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
        lede="Questions only the household can answer. Where a number says 'decided for this version', it is already fixed and you are only asked whether you are happy with it. Changing it later makes a new version and counts as another try." />
      <ul className="grid gap-3 md:grid-cols-2">
        {owner.map((q) => (
          <li key={q.question} className="card border-people/40 p-5">
            <span className="pill mb-3 border-dashed border-people/60 text-people">your call</span>
            <p className="text-[15px] leading-relaxed">{q.question}</p>
          </li>
        ))}
      </ul>
      {housekeeping.length > 0 && (
        <details className="mt-6">
          <summary className="meta cursor-pointer hover:text-ink">Tidy-up notes for the program's author, nothing for you to decide ({housekeeping.length})</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">{housekeeping.map((q) => <li key={q.question} className="card p-5 text-[14.5px] leading-relaxed text-ink-2">{q.question}</li>)}</ul>
        </details>
      )}
      <button type="button" onClick={() => go("admin")} className="meta mt-5 inline-flex items-center gap-1 hover:text-ink">List of past decisions <ArrowRight className="size-3.5" /></button>
    </section>
  );
}
