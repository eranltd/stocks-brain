import { useId, useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct, signTone } from "../lib/format.js";
import { daysBetween } from "../lib/stats.js";
import { WEEKLY_RULES } from "../lib/weekly.js";
import { LinesChart } from "../components/lines.jsx";
import { Kpi, KpiStrip } from "../components/ledger.jsx";
import { ArrowRight, CheckIcon, Chip, Container, DataTable, EmptyState, HeroTitle, InfoTip, Panel, SectionTitle, Segmented, SimBadge, Stamp, StatTile } from "../components/ui.jsx";
import { BaseRates } from "../components/checklist.jsx";
import { edgeWords, fillNote, forwardWords } from "../lib/checklist.js";
import { strings } from "../lib/text.js";
import dict from "../text/plan.js";
import { rich } from "../lib/rich.jsx";

// This site's rules (Experiments). Rules under test first, the weekly game's two first: each rule a panel with its numbers
// as tiles and a stamp (passed the history test = APPROVED, rejected = REJECTED, else ON HOLD), its paper record, and the
// method behind an (i). Then the race against random pickers, the savings study, the chart checklist, every rule, the
// monthly habits, how a rule is tested and the owner's open questions. Every text code writes is in text/plan.js ("pb.*");
// the rule book itself (config/rules.json), the chart checklist's config and the engine's reasons are data, as written.

const FAMILIES = ["savings", "entry", "exit", "sizing", "risk", "fundamental", "process"];
/** A status or verdict in words ("passed the past test"); an unknown one shows as itself. */
const labelOf = (t, k) => (t.has(`pb.label.${k}`) ? t(`pb.label.${k}`) : k);
const EVIDENCE = { replicated: "text-up", mixed: "text-wait", weak: "text-ink-2", untested: "text-ink-3", contradicted: "text-down" };
const DOT = { passes_history: "var(--up)", candidate: "var(--wait)", inconclusive: "var(--ink-3)", rejected: "var(--down)" };
/** A verdict or status as a chip tone. */
const TONE = {
  passes_history: "up", better: "up", active: "up", candidate: "wait", needs_data: "people", process_only: "ai", testable_now: "neutral",
  reference_baseline: "neutral", baseline: "neutral", control: "ghost", no_clear_difference: "neutral", too_few_independent_windows: "ghost",
  inconclusive: "neutral", rejected: "down", worse: "down",
};
const VChip = ({ t, k }) => <Chip tone={TONE[k] ?? "neutral"}>{labelOf(t, k)}</Chip>;
/** The stamp for a history verdict: passed = APPROVED, rejected = REJECTED, anything else ON HOLD. */
const stampOf = (v) => (v === "passes_history" ? "approved" : v === "rejected" ? "rejected" : "wait");
/** A study length: whole years when it divides, else weeks ("2 years", "26 weeks"). */
const HORIZON = (w) => {
  const t = strings(dict);
  return w % 52 === 0 ? t("pb.years", { count: w / 52, n: w / 52 }) : t("pb.weeks", { count: w, n: w });
};
/** "+12 bp": basis points with their sign. */
const bpText = (t, d) => t("pb.bp", { v: `${d > 0 ? "+" : ""}${fmtNum(d, 0)}` });
/** "62%": a whole percent. */
const wholePct = (v) => `${fmtNum(v, 0)}%`;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const toneText = (v, d = 1) => ({ accent: "text-up", down: "text-down", flat: "text-ink" })[signTone(v, d)];
const scrollToRule = (id) => document.getElementById(`rule-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

// "[engine]" = computed by the program on every daily run; "[planned]" = written down, not built yet, people check it by hand.
const TAG = /^\[(engine|planned)[^\]]*\]\s*/;
function Tagged({ text }) {
  const t = strings(dict);
  const m = text.match(TAG);
  const body = m ? text.slice(m[0].length) : text;
  return (
    <>
      {m && <Chip tone={m[1] === "engine" ? "up" : "people"} className={`me-1.5 min-h-[20px] px-1.5 align-middle text-[10px] ${m[1] === "engine" ? "" : "border-dashed"}`}>{t(m[1] === "engine" ? "pb.tag.program" : "pb.tag.planned")}</Chip>}
      {body}
    </>
  );
}
const adoptLabel = (r) => {
  if (r.engine?.baseline) return "pb.adopt.inUse";
  if (r.family === "savings" && r.status === "testable_now") return "pb.adopt.replaces";
  if (r.status === "testable_now") return "pb.adopt.passes";
  if (r.status === "reference_baseline") return "pb.adopt.moveUp";
  if (r.status === "control") return "pb.adopt.usedAs";
  return "pb.adopt.followed";
};

/** A small bullet list (an orange dash before each line). */
function Dashes({ items, className = "", tone = "before:bg-desk" }) {
  return (
    <ul className={`grid gap-1.5 ${className}`}>
      {items.map((x) => <li key={x} className={`relative ps-4 before:absolute before:start-0 before:top-[0.7em] before:h-px before:w-2.5 ${tone}`}>{x}</li>)}
    </ul>
  );
}

export default function Playbook({ data, go }) {
  const t = strings(dict);
  const rb = data.rulebook;
  const res = data.rulesResult;
  if (!rb) {
    return <Container className="pb-24"><EmptyState title={t("pb.empty.title")}>{t("pb.empty.body")}</EmptyState></Container>;
  }
  const byId = Object.fromEntries(rb.rules.map((r) => [r.id, r]));
  const name = (id) => byId[id]?.name ?? id;
  const satRows = res?.satellite?.rules ?? [];
  const satVerdict = Object.fromEntries(satRows.map((r) => [r.id, r.verdict]));
  const counts = {
    tested: rb.rules.filter((r) => r.engine).length,
    needs: rb.rules.filter((r) => r.status === "needs_data").length,
    process: rb.rules.filter((r) => r.status === "process_only").length,
    rejected: satRows.filter((r) => r.verdict === "rejected").length,
    passed: satRows.filter((r) => r.verdict === "passes_history").length,
  };
  const goal = data.settings.goal.annual_return_pct;
  const allRejected = satRows.length > 0 && satRows.every((r) => r.verdict === "rejected");

  return (
    <Container className="pb-24">
      <div className="grid gap-5 sm:gap-6">
        <div className="grid gap-5">
          <HeroTitle line1={t("pb.hero1")} line2={t("pb.hero2")} sub={[
            t("pb.heroSub", { v: rb.version, date: fmtDate(rb.updated_at) }),
            res ? (res.sample ? t("pb.samplePrices") : t("pb.testedTo", { date: fmtDate(res.as_of) })) : null,
          ].filter(Boolean).join(" · ")} />
          <div className="flex flex-wrap items-center gap-1.5">
            <SimBadge />
            {res?.frozen && <FrozenChip res={res} name={name} />}
            <InfoTip label={t("pb.about")} align="start">
              <span className="grid gap-2">
                <span>{t("pb.intro1")}{allRejected ? ` ${t("pb.introRejected")}` : ""} {t("pb.intro2")}</span>
                {rb.trader.split("\n\n").map((p) => <span key={p.slice(0, 40)}>{p}</span>)}
              </span>
            </InfoTip>
            <InfoTip label={t("pb.read.head")} align="start">
              <span className="grid gap-2">
                <span>{t("pb.read.p1")} {rich(t, "pb.read.p2", { random: t("pb.read.random"), goal: `+${goal}%` })} {t("pb.read.p3")}</span>
                <span className="text-ink-3">{rich(t, "pb.read.sure", Object.fromEntries(["replicated", "mixed", "weak", "untested", "contradicted"].map((k) => [k, <b key={k} className="font-semibold text-ink-2">{t(`pb.ev.${k}`)}</b>])))}</span>
              </span>
            </InfoTip>
          </div>
        </div>

        <KpiStrip label={t("pb.kpi.label")}>
          <Kpi label={t("pb.kpi.rules")} value={rb.rules.length} note={t("pb.kpi.rulesSub", { n: counts.process })} />
          <Kpi label={t("pb.kpi.tested")} value={counts.tested} note={t("pb.kpi.testedSub")} />
          <Kpi label={t("pb.kpi.passed")} value={counts.passed} tone="text-up" note={t("pb.kpi.passedSub", { n: satRows.length })} />
          <Kpi label={t("pb.kpi.rejected")} value={counts.rejected} tone="text-down" note={t("pb.kpi.rejectedSub")} noteTone={allRejected ? "text-down" : "text-ink-3"} />
          <Kpi label={t("pb.kpi.needs")} value={counts.needs} tone="text-people" note={t("pb.kpi.needsSub")} />
          <Kpi label={t("pb.kpi.tries")} value={rb.tries_counted} tone="text-desk" note={t("pb.kpi.triesSub")} />
        </KpiStrip>

        <UnderTest rb={rb} res={res} data={data} name={name} />
        <Race res={res} name={name} />
        <Savings rb={rb} res={res} name={name} />
        <Sets rb={rb} name={name} satVerdict={satVerdict} />
        <TechChecklist data={data} />
        <Rules rb={rb} satVerdict={satVerdict} go={go} />
        <Process rb={rb} />
        <Testing rb={rb} />
        <Decisions rb={rb} go={go} />
        <p className="micro normal-case tracking-[0.04em]">{t("pb.foot")}</p>
      </div>
    </Container>
  );
}

/** "MARKED 17 OCT": the history verdicts are fixed on that day; the (i) says why, and where today's numbers differ. */
function FrozenChip({ res, name }) {
  const t = strings(dict);
  const differs = [
    ...(res.satellite?.rules ?? []).filter((r) => r.verdict_today && r.verdict_today !== r.verdict).map((r) => ({ id: r.id, now: r.verdict_today, frozen: r.verdict })),
    ...(res.savings?.horizons ?? []).flatMap((h) => h.rows.filter((r) => r.verdict_today && r.verdict_today !== r.verdict).map((r) => ({ id: r.id, now: r.verdict_today, frozen: r.verdict, weeks: h.weeks }))),
  ];
  return (
    <span className="inline-flex items-center">
      <Chip tone="neutral"><span className="text-ink-3">{t("pb.frozenChip")}</span><span className="text-ink">{fmtDate(res.frozen.as_of).replace(/\s\d{4}$/, "")}</span></Chip>
      <InfoTip label={t("pb.frozen.head")} align="start">
        <span className="grid gap-2">
          <span>{t("pb.frozen.when", {
            date: fmtDate(res.frozen.as_of),
            which: res.frozen.superseded?.length ? t("pb.frozen.latest", { count: res.frozen.superseded.length, n: res.frozen.superseded.length }) : t("pb.frozen.first"),
          })} {t("pb.frozen.body")}</span>
          {differs.length > 0 && <span className="text-ink-3">{t("pb.frozen.differs", {
            list: differs.map((d) => (d.weeks
              ? t("pb.frozen.itemH", { name: name(d.id), h: HORIZON(d.weeks), now: labelOf(t, d.now), frozen: labelOf(t, d.frozen) })
              : t("pb.frozen.item", { name: name(d.id), now: labelOf(t, d.now), frozen: labelOf(t, d.frozen) }))).join(", "),
          })}</span>}
        </span>
      </InfoTip>
    </span>
  );
}

/** A section heading between groups of panels. */
function Head({ title, eyebrow, sub, right, id }) {
  return <SectionTitle id={id} title={title} eyebrow={eyebrow} sub={sub} right={right} size="md" className="pt-4" />;
}

/* ---------------------------------------------------------- rules under test */

/**
 * Every rule with a history test or a paper record, the weekly game's two first: a panel each with its numbers as tiles,
 * a stamp for its history verdict, and its paper record.
 */
function UnderTest({ rb, res, data, name }) {
  const t = strings(dict);
  const sat = res?.satellite;
  const led = data.ledger && !data.ledger.sample ? data.ledger : null;
  const rows = sat?.rules ?? [];
  const weekly = WEEKLY_RULES.map((r) => r.id);
  const ids = [...new Set([...rows.map((r) => r.id), ...Object.keys(led?.rules ?? {})])]
    .sort((a, b) => (weekly.includes(a) ? weekly.indexOf(a) : 99) - (weekly.includes(b) ? weekly.indexOf(b) : 99));
  if (!ids.length) {
    return (
      <>
        <Head eyebrow={t("pb.sat.eyebrow")} title={t("pb.under.title")} />
        <EmptyState title={t("pb.next")}>{t("pb.sat.emptyBody")}</EmptyState>
      </>
    );
  }
  return (
    <section aria-labelledby="under-test" className="grid gap-4">
      <Head id="under-test" eyebrow={sat ? t("pb.sat.eyebrowFull", { from: fmtDate(sat.from), to: fmtDate(sat.to), years: fmtNum(sat.years, 1) }) : t("pb.sat.eyebrow")}
        title={t("pb.under.title")} sub={t("pb.under.sub", { n: sat?.null.runs ? fmtNum(sat.null.runs, 0) : "–" })}
        right={<InfoTip label={t("pb.under.about")}>{rich(t, "pb.sat.lede", { n: sat ? fmtNum(sat.null.runs, 0) : "–", same: t("pb.sat.same"), which: t("pb.sat.which") })}</InfoTip>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {ids.map((id) => (
          <RulePanel key={id} id={id} r={rows.find((x) => x.id === id)} sat={sat} led={led} rb={rb} name={name} weekly={weekly.includes(id)} goal={data.settings.goal.annual_return_pct} />
        ))}
      </div>
    </section>
  );
}

function RulePanel({ id, r, sat, led, rb, name, weekly, goal }) {
  const t = strings(dict);
  const fwd = led?.rules?.[id] ?? null;
  const min = rb.acceptance.min_paper_days;
  const fam = rb.rules.find((x) => x.id === id)?.family;
  const path = sat?.weekly?.rules?.[id];
  let paper = null;
  if (fwd && led) {
    const k = led.dates.indexOf(fwd.started);
    const days = daysBetween(fwd.started, led.as_of); // calendar days of record
    const coreRet = k >= 0 ? (led.core.at(-1) / led.core[k]) * 100 - 100 : null;
    paper = { days, ret: fwd.values.at(-1) - 100, coreRet, holdings: fwd.rebalances.at(-1)?.holdings ?? [], pct: fwd.forward_percentile, decisions: fwd.decisions, stale: fwd.stale };
  }
  return (
    <Panel as="article" id={`rule-${id}`} className="scroll-mt-28" eyebrow={weekly ? t("pb.under.weekly") : fam ? t(`pb.fam.${fam}`) : null} title={name(id)}
      badge={r ? <Stamp kind={stampOf(r.verdict)} size="sm" rotate={-6} className="me-1" /> : null}
      info={r ? <span className="grid gap-2"><Dashes items={r.reasons} /><span className="text-ink-3">{t("pb.sat.note", { core: fmtPct(sat.controls.core.cagr_pct, 1), ew: fmtPct(sat.controls.equal_weight.cagr_pct, 1), tries: rb.tries_counted })}</span></span> : t("pb.fwd.lede", { min })}
      infoLabel={t("pb.under.method")}>
      {r && (
        <div className="grid grid-cols-3 gap-2">
          <StatTile label={t("pb.th.growth")} value={<span className={r.stats.cagr_pct >= goal ? "text-up" : ""}>{fmtPct(r.stats.cagr_pct, 1)}</span>} sub={t("pb.rp.aYear")} spark={path?.length > 1 ? path : undefined} />
          <StatTile label={t("pb.th.vsCore")} value={<span className={toneText(r.vs_core_cagr_pts)}>{fmtPct(r.vs_core_cagr_pts, 1).replace("%", "")}</span>} unit={t("pb.rp.pts")} sub={t("pb.rp.vsCoreSub")} />
          <StatTile label={t("pb.th.beatRandomShort")} value={<span className={r.verdict === "rejected" ? "text-down" : r.verdict === "passes_history" ? "text-up" : ""}>{fmtNum(r.percentile, 0)}</span>} unit="/100"
            sub={t("pb.sat.luckShort", { p: fmtNum(r.p_adjusted, 2) })} />
          <StatTile label={t("pb.th.halvesShort")} value={`${fmtNum(r.percentile_halves[0], 0)}/${fmtNum(r.percentile_halves[1], 0)}`} sub={t("pb.rp.halvesSub")} bars={r.percentile_halves.map((x) => x - 50)} barsHi={-1} />
          <StatTile label={t("pb.th.drop")} value={<span className="text-down">{fmtPct(r.stats.max_dd_pct, 0)}</span>} sub={t("pb.sat.coreDrop", { v: fmtPct(sat.controls.core.max_dd_pct, 0) })} />
          <StatTile label={t("pb.th.swaps")} value={wholePct(r.turnover_pct_year)} sub={`${t("pb.sat.nStocks", { n: fmtNum(r.avg_names, 1) })}${r.stops ? ` · ${t("pb.sat.stops", { count: r.stops, n: r.stops })}` : ""}`} />
        </div>
      )}
      {paper ? (
        <div className={`tile ${r ? "mt-3" : ""} px-3 py-2.5`}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="micro text-ink-2">{t("pb.rp.paper")} <span className="font-num text-ink">{paper.days}</span>{paper.days < min && <span className="text-ink-3">/{min}</span>} {t("pb.rp.days")}</p>
            <p className="font-num text-[12.5px]">
              <span className={toneText(paper.ret)}>{fmtPct(paper.ret, 1)}</span>
              <span className="text-ink-3"> {t("pb.rp.vsCore")} </span>
              <span className={isNum(paper.coreRet) ? toneText(paper.coreRet) : "text-ink-3"}>{isNum(paper.coreRet) ? fmtPct(paper.coreRet, 1) : "–"}</span>
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-desk/80" style={{ width: `${Math.min(100, (paper.days / min) * 100)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {paper.holdings.length ? paper.holdings.map((s) => <Chip key={s} tone="neutral" className="min-h-[22px] px-1.5 font-num text-[10.5px]">{s}</Chip>)
              : <span className="micro">{t("pb.fwd.allCore")}</span>}
            <span className="ms-auto text-[11.5px] text-ink-3">
              {isNum(paper.pct) ? <>{t("pb.rp.fwdPct", { p: wholePct(paper.pct) })}{paper.days < min ? ` · ${t("pb.fwd.early")}` : ""}</> : t(paper.decisions < 6 ? "pb.fwd.after6" : "pb.fwd.after126")}
              {paper.stale ? <span className="block text-wait">{t("pb.fwd.stale")}</span> : null}
            </span>
          </div>
        </div>
      ) : r ? <p className="micro mt-3">{t("pb.fwd.next")}</p> : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------- race */

/** Each rule's growth against the middle 90% of random pickers, and their paths against the core fund. */
function Race({ res, name }) {
  const t = strings(dict);
  const sat = res?.satellite;
  const rows = sat?.rules ?? [];
  const [shown, setShown] = useState(null);
  const sel = shown ?? rows.slice(0, 3).map((r) => r.id);
  const axis = useMemo(() => {
    if (!sat) return null;
    const vals = [sat.controls.core.cagr_pct, sat.controls.equal_weight.cagr_pct, ...rows.flatMap((r) => [r.null_cagr_pct.p05, r.null_cagr_pct.p95, r.stats.cagr_pct])];
    const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    return { lo, hi, pos: (v) => ((v - lo) / (hi - lo)) * 100 };
  }, [sat]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sat) return null;
  const colors = ["var(--desk)", "var(--ai)", "var(--up)", "var(--down)", "var(--wait)", "var(--people)"];
  return (
    <Panel id="race" eyebrow={t("pb.race.eyebrow")} title={t("pb.race.title")} sub={t("pb.race.sub", { n: fmtNum(sat.null.runs, 0) })}
      info={t("pb.sat.note", { core: fmtPct(sat.controls.core.cagr_pct, 1), ew: fmtPct(sat.controls.equal_weight.cagr_pct, 1), tries: res.tries_counted })} infoLabel={t("pb.race.about")}>
      <div className="micro mb-4 flex flex-wrap gap-x-5 gap-y-2 normal-case tracking-[0.04em]">
        <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-7 rounded-[3px] bg-line-3" />{t("pb.sat.lg.random")}</span>
        <span className="inline-flex items-center gap-2"><i className="inline-block size-2.5 rounded-full bg-desk" />{t("pb.sat.lg.rule")}</span>
        <span className="inline-flex items-center gap-2"><i className="inline-block h-3 w-px bg-ink" />{t("pb.sat.lg.core")}</span>
        <span className="inline-flex items-center gap-2"><i className="inline-block h-3 border-s border-dashed border-ink-2" />{t("pb.sat.lg.ew")}</span>
      </div>
      <div className="grid gap-2.5">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[96px_minmax(0,1fr)_60px] items-center gap-3 sm:grid-cols-[190px_minmax(0,1fr)_72px]">
            <button type="button" className="min-h-[36px] min-w-0 truncate text-start text-[12.5px] font-semibold text-ink-2 hover:text-ink sm:text-[13.5px]" title={name(r.id)} onClick={() => scrollToRule(r.id)}>{name(r.id)}</button>
            <div className="relative h-7">
              <i className="absolute top-0 h-full w-px bg-ink" style={{ left: `${axis.pos(sat.controls.core.cagr_pct)}%` }} />
              <i className="absolute top-0 h-full border-s border-dashed border-ink-2" style={{ left: `${axis.pos(sat.controls.equal_weight.cagr_pct)}%` }} />
              <i className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[3px] bg-line-3" style={{ left: `${axis.pos(r.null_cagr_pct.p05)}%`, width: `${axis.pos(r.null_cagr_pct.p95) - axis.pos(r.null_cagr_pct.p05)}%` }} />
              <i className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-3" style={{ left: `${axis.pos(r.null_cagr_pct.p50)}%` }} />
              <i className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-[0_0_10px_var(--desk-glow)]" style={{ left: `${axis.pos(r.stats.cagr_pct)}%`, background: DOT[r.verdict] ?? "var(--desk)" }} />
            </div>
            <span className="font-num text-end text-[13px] font-bold text-ink">{fmtPct(r.stats.cagr_pct, 1)}</span>
          </div>
        ))}
      </div>
      <div className="micro mt-3 flex justify-between normal-case tracking-[0.04em]"><span>{t("pb.race.axis", { v: axis.lo })}</span><span>{t("pb.race.axis", { v: axis.hi })}</span></div>

      <div className="mt-6 border-t border-line pt-5">
        <p className="micro mb-2 text-ink-2">{t("pb.race.paths")}</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {rows.map((r) => {
            const on = sel.includes(r.id);
            return (
              <button key={r.id} type="button" aria-pressed={on} onClick={() => setShown(on ? sel.filter((x) => x !== r.id) : [...sel, r.id])}
                className={`min-h-[40px] rounded-[10px] border px-3 text-[12.5px] font-semibold transition-colors ${on ? "border-desk/60 bg-desk/10 text-ink" : "border-line-2 text-ink-3 hover:text-ink"}`}>{name(r.id)}</button>
            );
          })}
        </div>
        <LinesChart dates={sat.weekly.dates} ariaLabel={t("pb.sat.aria")}
          series={[
            { key: "core", label: t("pb.core"), values: sat.weekly.core, color: "var(--ink)", width: 1.6 },
            { key: "ew", label: t("pb.ew"), values: sat.weekly.equal_weight, color: "var(--ink-3)", dash: true, width: 1.6 },
            ...sel.map((id) => ({ key: id, label: name(id), values: sat.weekly.rules[id], color: colors[rows.findIndex((r) => r.id === id) % colors.length], width: 2.2 })),
          ]} />
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- savings */

function Savings({ rb, res, name }) {
  const t = strings(dict);
  const sv = res?.savings;
  const [hw, setHw] = useState(null);
  if (!sv?.horizons?.length) {
    return (
      <Panel id="savings" eyebrow={t("pb.sav.eyebrow")} title={t("pb.sav.titleShort")}>
        <EmptyState compact title={t("pb.next")}>{t("pb.sav.emptyBody")}</EmptyState>
      </Panel>
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
  const vsCell = (r) => {
    const d = r.vs_baseline_irr_bps_median;
    return <span className={d == null ? "text-ink-3" : d >= 0 ? "text-up" : "text-down"}>{d != null ? bpText(t, d) : labelOf(t, "baseline")}</span>;
  };
  const cols = [
    { key: "rule", label: t("pb.th.rule"), cell: (r) => <span className="block max-w-[150px] text-[13px] leading-snug font-semibold text-ink">{name(r.id)}</span> },
    { key: "buys", label: t("pb.th.buys"), num: true, cell: (r) => fmtNum(r.trades_per_year, 0) },
    { key: "typical", label: t("pb.th.typicalShort"), num: true, className: "font-bold text-ink", cell: (r) => fmtPct(r.irr_median_pct, 1) },
    { key: "vs", label: t("pb.th.vsPlain"), num: true, cell: vsCell },
    { key: "often", label: t("pb.th.betterOften"), num: true, className: "text-ink-2", cell: (r) => (r.vs_baseline_better_pct != null ? wholePct(r.vs_baseline_better_pct) : "–") },
    { key: "dip", label: t("pb.th.worstDipShort"), num: true, className: "text-down", cell: (r) => fmtPct(r.worst_vs_paid_p10_pct, 0) },
    { key: "cash", label: t("pb.th.cash"), num: true, className: "text-ink-2", cell: (r) => wholePct(r.cash_share_median_pct) },
    { key: "fee", label: t("pb.th.feeTie"), num: true, className: "text-ink-2", cell: (r) => {
      const fee = r.breakeven_fee_pct_of_weekly;
      return fee != null ? (fee > 0 ? fmtPct(fee, 1).replace("+", "") : t("pb.never")) : "–";
    } },
    { key: "verdict", label: t("pb.th.result"), align: "start", cell: (r) => <VChip t={t} k={r.verdict} /> },
  ];
  const wcols = [
    cols[0],
    cols[2],
    { key: "vsAll", label: t("pb.th.vsAll"), num: true, cell: (r) => (r.vs_baseline_irr_bps_median != null ? t("pb.bp", { v: fmtNum(r.vs_baseline_irr_bps_median, 0) }) : "–") },
    cols[4],
    cols[5],
    cols.at(-1),
  ];
  return (
    <Panel id="savings" eyebrow={t("pb.sav.eyebrowFull", { h: HORIZON(h.weeks), windows: h.windows, independent: h.independent })} title={t("pb.sav.titleShort")}
      sub={tooFew ? t("pb.sav.subTooFew") : clear.length === 0 ? t("pb.sav.subNoClear") : t("pb.sav.some")}
      info={<span className="grid gap-2">
        <span>{t("pb.sav.lede")} {tooFew || clear.length === 0 ? rich(t, tooFew ? "pb.sav.tooFew" : "pb.sav.noClear", { pick: t("pb.sav.pick") }) : t("pb.sav.some")}</span>
        <span className="text-ink-3">{t("pb.sav.note1", { bps: fmtNum(maxBps, 0) })} {t("pb.sav.note2")}</span>
      </span>} infoLabel={t("pb.sav.about")}>
      {sv.horizons.length > 1 && (
        <div className="mb-3"><Segmented label={t("pb.sav.howLong")} value={h.weeks} onChange={setHw} options={sv.horizons.map((x) => ({ value: x.weeks, label: HORIZON(x.weeks) }))} /></div>
      )}
      <DataTable columns={cols} rows={stream} rowKey={(r) => r.id} minWidth={900} caption={t("pb.sav.titleShort")} rowTone={(r) => (r.verdict === "baseline" ? "brand" : null)} />
      {windfall.length > 0 && (
        <>
          <div className="mt-5 flex items-center gap-1">
            <p className="micro text-ink-2">{t("pb.sav.bigTitle")}</p>
            <InfoTip label={t("pb.sav.bigTitle")} align="start">{t("pb.sav.bigLede")}</InfoTip>
          </div>
          <DataTable columns={wcols} rows={windfall} rowKey={(r) => r.id} minWidth={640} caption={t("pb.sav.bigTitle")} />
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- sets */

function Sets({ rb, name, satVerdict }) {
  const t = strings(dict);
  return (
    <Panel id="plans" eyebrow={t("pb.sets.eyebrow")} title={t("pb.sets.titleShort")} info={t("pb.sets.lede")} infoLabel={t("pb.sets.about")}>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rb.sets.map((s) => (
          <div key={s.id} className="tile flex min-w-0 flex-col p-3.5">
            <div className="flex items-start justify-between gap-2">
              <span className="micro text-desk">{s.role.replace("_", " ")}</span>
              <InfoTip label={s.name}>{s.plain}</InfoTip>
            </div>
            <p className="headline -mt-1 text-[19px] leading-[1.05] text-ink">{s.name}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {s.rule_ids.map((id) => (
                <a key={id} href={`#rule-${id}`} onClick={(e) => { e.preventDefault(); scrollToRule(id); }}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] border border-line-2 px-2 text-[11.5px] text-ink-2 hover:border-line-3 hover:text-ink">
                  {satVerdict[id] && <i className="inline-block size-1.5 rounded-full" style={{ background: DOT[satVerdict[id]] }} />}{name(id)}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------- technical checklist */

const STEP_TONE = { accent: "text-up", down: "text-down", flat: "text-ink-2" };

/** The eight-step checklist from the video: each step, how code computes it, the paper-entry rule and what history says. */
function TechChecklist({ data }) {
  const t = strings(dict);
  const cfg = data.checklistCfg;
  if (!cfg) return null;
  const ck = data.checklist;
  const br = ck?.base_rates ?? null;
  const hr = cfg.house_rule;
  const bench = data.bench.label;
  const edge = edgeWords(br);
  const stepName = Object.fromEntries(cfg.steps.map((s) => [s.id, s.name]));
  const byCheck = br?.by_check ?? [];
  const cols = [
    { key: "check", label: t("pb.ck.step"), cell: (c) => <span className="text-[13px] font-semibold text-ink">{stepName[c.check] ?? c.check}</span> },
    ...["bullish", "bearish"].map((k) => ({
      key: k, label: t(k === "bullish" ? "pb.ck.up" : "pb.ck.down"), num: true,
      className: (c) => (c[k]?.n ? STEP_TONE[signTone(c[k].mean, 1)] : "text-ink-3"),
      cell: (c) => <span>{c[k]?.n ? fmtPct(c[k].mean, 1) : "–"}<span className="ms-1 text-[10.5px] text-ink-3">{c[k]?.n ?? 0}</span></span>,
    })),
  ];
  return (
    <Panel id="checklist" className="scroll-mt-28" eyebrow={t("pb.ck.eyebrow", { v: cfg.version })} title={t("pb.ck.titleShort")}
      badge={<Chip tone="people" className="border-dashed">{cfg.status}</Chip>}
      info={<span className="grid gap-2"><span>{cfg.purpose}</span><Dashes items={cfg.how_to_read} /></span>} infoLabel={t("pb.ck.about")}>
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cfg.steps.map((s) => (
          <li key={s.id} className="tile flex min-w-0 flex-col p-3">
            <div className="flex items-start justify-between gap-1">
              <span className="font-num text-[11px] font-bold text-desk">{String(s.n).padStart(2, "0")}</span>
              <InfoTip label={s.name}>
                <span className="grid gap-1.5"><span>{s.checks}</span><span className="text-ink-3"><span className="micro me-1">{t("pb.ck.how")}</span>{s.computes}</span>{!s.directional && <span className="text-ink-3">{t("pb.ck.notDir")}</span>}</span>
              </InfoTip>
            </div>
            <p className="headline -mt-1 text-[17px] leading-[1.05] text-ink">{s.name}</p>
            {!s.directional && <span className="micro mt-1.5 text-ink-3">{t("pb.ck.planChip")}</span>}
          </li>
        ))}
      </ol>

      <div className="mt-3 rounded-tile border border-up/35 bg-up/[0.05] p-3.5">
        <div className="flex items-center gap-1">
          <p className="micro text-up">{t("pb.ck.entry")}</p>
          <InfoTip label={t("pb.ck.entry")} align="start">{cfg.verdict.text} {t("pb.ck.tp")}</InfoTip>
        </div>
        <p className="mt-1.5 text-[14px] leading-snug text-ink">{hr.text}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="headline text-[19px] text-ink">{t("pb.ck.history")}</p>
        {br && <span className="micro normal-case tracking-[0.04em]">{t("pb.ck.histMeta", { from: fmtDate(br.from), to: fmtDate(br.to), n: br.names })}{ck.sample ? ` · ${t("pb.samplePrices")}` : ""}</span>}
        <InfoTip label={t("pb.ck.history")} align="start">
          {br ? <span className="grid gap-1.5"><span>{t("pb.ck.histBody", { step: br.step_days, bench, h: br.horizon_days })}</span><span>{fillNote(br.note, br)}</span><span>{t("pb.ck.ifWorked")}</span></span> : <>{t("pb.ck.later")} {cfg.measure.text}</>}
        </InfoTip>
      </div>
      {br ? (
        <div className="mt-2 grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <BaseRates br={br} benchLabel={bench} />
            {edge && <p className="mt-3 text-[13.5px] leading-snug text-ink">{edge}</p>}
            {br.house_rule && <p className="mt-2 text-[13px] leading-snug text-ink-2">{t("pb.ck.fits", { fits: fmtPct(br.house_rule.fits.mean ?? 0, 1), fn: br.house_rule.fits.n, fails: fmtPct(br.house_rule.fails.mean ?? 0, 1), xn: br.house_rule.fails.n })}</p>}
          </div>
          {byCheck.length > 0 && (
            <div className="min-w-0">
              <p className="micro mb-1 text-ink-2">{t("pb.ck.each", { bench })}</p>
              <DataTable columns={cols} rows={byCheck} rowKey={(c) => c.check} minWidth={300} caption={t("pb.ck.each", { bench })} />
            </div>
          )}
        </div>
      ) : <p className="mt-2 text-[13.5px] text-ink-2">{t("pb.ck.later")}</p>}
      <p className="mt-3 text-[13px] leading-snug text-ink-2">{forwardWords(ck?.forward)}</p>
      {cfg.notes?.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          <span className="micro">{t("pb.ck.notes", { n: cfg.notes.length })}</span>
          <InfoTip label={t("pb.ck.notes", { n: cfg.notes.length })} align="start"><Dashes items={cfg.notes} /></InfoTip>
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------- rules */

function Rules({ rb, satVerdict, go }) {
  const t = strings(dict);
  return (
    <section aria-labelledby="every-rule" className="grid gap-4">
      <Head id="every-rule" eyebrow={t("pb.rules.eyebrow")} title={t("pb.rules.titleShort")} sub={t("pb.rules.sub", { n: rb.rules.length })}
        right={<InfoTip label={t("pb.rules.about")}>{t("pb.rules.lede")}</InfoTip>} />
      {FAMILIES.map((fam) => {
        const list = rb.rules.filter((r) => r.family === fam);
        if (!list.length) return null;
        return (
          <Panel key={fam} id={`fam-${fam}`} title={t(`pb.fam.${fam}`)} sub={t(`pb.fam.${fam}.sub`)} badge={<Chip tone="neutral">{list.length}</Chip>} titleSize="xs">
            <ul className="grid gap-2 lg:grid-cols-2">
              {list.map((r) => <RuleCard key={r.id} r={r} verdict={satVerdict[r.id]} go={go} />)}
            </ul>
          </Panel>
        );
      })}
    </section>
  );
}

function RuleCard({ r, verdict, go }) {
  const t = strings(dict);
  const [open, setOpen] = useState(false);
  const id = useId();
  const chipKind = verdict ?? r.status;
  return (
    <li id={verdict ? undefined : `rule-${r.id}`} className="tile scroll-mt-28 min-w-0 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="flex min-h-[56px] w-full items-start gap-3 p-3 text-start">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <VChip t={t} k={chipKind} />
            <span className={`micro ${EVIDENCE[r.evidence] ?? ""}`}>{t("pb.rc.sure", { ev: t.has(`pb.ev.${r.evidence}`) ? t(`pb.ev.${r.evidence}`) : r.evidence })}</span>
          </span>
          <span className="mt-1.5 block text-[14.5px] leading-snug font-semibold text-ink">{r.name}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{r.plain}</span>
        </span>
        <svg viewBox="0 0 24 24" className={`mt-1 size-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180 text-desk" : "text-ink-3"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div id={id} className="grid gap-3 border-t border-line bg-surface/70 p-3.5 text-[13px] leading-relaxed">
          <div><p className="micro mb-1">{t("pb.rc.exact")}</p><p className="text-ink-2">{r.definition}</p></div>
          {r.params.length > 0 && (
            <div><p className="micro mb-1">{t("pb.rc.params")}</p>
              <dl className="grid gap-1.5">{r.params.map((p) => <div key={p.name} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 border-t border-line pt-1.5"><dt className="font-num text-[12px] text-ink">{p.name} = {p.value}</dt><dd className="text-ink-3">{p.why}</dd></div>)}</dl></div>
          )}
          <div><p className="micro mb-1">{t("pb.rc.why")}</p><p className="text-ink-2">{r.why_included}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="micro mb-1 text-up">{t(adoptLabel(r))}</p><p className="text-ink-2">{r.adopt_if}</p></div>
            <div><p className="micro mb-1 text-down">{t("pb.rc.dropped")}</p><p className="text-ink-2">{r.reject_if}</p></div>
          </div>
          {r.library_refs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5"><span className="micro me-1">{t("pb.rc.source")}</span>
              {r.library_refs.map((x) => <button key={x} type="button" onClick={() => go("insights")} className="min-h-[32px] rounded-[8px] border border-line-2 px-2 font-num text-[11px] text-ink-2 hover:text-ink">{x}</button>)}</div>
          )}
          {r.data_needed && r.status === "needs_data" && <p className="text-people">{t("pb.rc.needs", { what: r.data_needed })}</p>}
        </div>
      )}
    </li>
  );
}

/* --------------------------------------------------------------- process */

function Process({ rb }) {
  const t = strings(dict);
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
    <ul className="grid gap-2">
      {list.map((r) => {
        const on = done.includes(r.id);
        return (
          <li key={r.id}>
            <button type="button" onClick={() => toggle(r.id)} aria-pressed={on}
              className={`flex min-h-[56px] w-full items-start gap-3 rounded-tile border px-3 py-2.5 text-start transition-colors ${on ? "border-up/40 bg-up/[0.06]" : "border-line bg-surface-2 hover:border-line-3"}`}>
              <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-[7px] border ${on ? "border-up bg-up text-bg" : "border-line-3 text-transparent"}`}><CheckIcon className="size-3.5" /></span>
              <span className="min-w-0"><span className="block text-[14px] font-semibold text-ink">{r.name}</span><span className="block text-[12.5px] leading-snug text-ink-2">{r.plain}</span></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  const n = monthly.filter((r) => done.includes(r.id)).length;
  return (
    <Panel id="habits" eyebrow={t("pb.proc.eyebrow", { month })} title={t("pb.proc.titleShort")} info={t("pb.proc.lede")} infoLabel={t("pb.proc.about")}
      badge={<Chip tone={n === monthly.length ? "up" : "neutral"} check={n === monthly.length}>{n}/{monthly.length}</Chip>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <List list={monthly} />
        {yearly.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1">
              <p className="micro text-ink-2">{t("pb.proc.yearly")}</p>
              <InfoTip label={t("pb.proc.yearly")} align="start">{t("pb.proc.yearlyLede")}</InfoTip>
            </div>
            <List list={yearly} />
          </div>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- testing */

function Testing({ rb }) {
  const t = strings(dict);
  const a = rb.acceptance;
  const alpha = (100 - a.satellite.null_percentile_min) / 100;
  const maxAbove = Math.max(0, Math.floor((alpha * (a.null_runs + 1)) / rb.tries_counted - 1));
  const pctBar = (100 * (a.null_runs - maxAbove)) / a.null_runs;
  const isPlanned = (x) => /^\[planned/.test(x);
  const bars = [
    [t("pb.test.bar.random"), `${fmtNum(pctBar, 1)}%`],
    [t("pb.test.bar.halves"), `${a.satellite.halves_percentile_min}%`],
    [t("pb.test.bar.drop"), t("pb.test.bar.dropV", { n: a.satellite.max_dd_worse_than_core_pts })],
    [t("pb.test.bar.paper"), t("pb.test.bar.paperV", { n: a.min_paper_days })],
  ];
  return (
    <Panel id="testing" eyebrow={t("pb.test.eyebrow")} title={t("pb.test.titleShort")} sub={t("pb.test.sub", { tries: rb.tries_counted })}
      info={<span className="grid gap-2"><span>{t("pb.test.lede", { tries: rb.tries_counted })}</span><span>{t("pb.tryNote")}</span>
        <span className="text-ink-3">{t("pb.test.body", {
          runs: a.null_runs, maxAbove, pctBar: `${fmtNum(pctBar, 1)}%`, pctMin: `${a.satellite.null_percentile_min}%`, tries: rb.tries_counted,
          halves: `${a.satellite.halves_percentile_min}%`, dd: a.satellite.max_dd_worse_than_core_pts, turn: `${a.satellite.max_turnover_pct_year}%`, days: a.min_paper_days,
        })}</span></span>} infoLabel={t("pb.test.about")}>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {bars.map(([k, v]) => (
          <div key={k} className="tile min-w-0 px-3 py-2.5">
            <dt className="micro truncate">{k}</dt>
            <dd className="font-num mt-1.5 text-[22px] leading-none font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {[["adopt", "text-up", "border-up/35"], ["candidate", "text-wait", "border-wait/35"], ["reject", "text-down", "border-down/35"]].map(([k, c, b]) => {
          const now = a.text[k].filter((x) => !isPlanned(x));
          const later = a.text[k].filter(isPlanned);
          return (
            <div key={k} className={`tile border-t-2 ${b} p-3.5`}>
              <p className={`micro mb-2 ${c}`}>{t(`pb.test.${k}`)}</p>
              <ul className="grid gap-1.5 text-[13px] leading-snug text-ink-2">{now.map((x) => <li key={x} className="flex gap-2"><span className={c}>–</span><span><Tagged text={x} /></span></li>)}</ul>
              {later.length > 0 && (
                <details className="mt-3">
                  <summary className="micro min-h-[32px] cursor-pointer py-1 hover:text-ink">{t("pb.test.later", { n: later.length })}</summary>
                  <ul className="mt-2 grid gap-1.5 text-[13px] leading-snug text-ink-2">{later.map((x) => <li key={x} className="flex gap-2"><span className={c}>–</span><span><Tagged text={x} /></span></li>)}</ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-1">
        <p className="micro text-ink-2">{t("pb.test.experiments", { n: rb.experiments.length })}</p>
        <InfoTip label={t("pb.tag.about")} align="start">
          <span className="grid gap-1.5"><span><Tagged text="[engine] " />{t("pb.test.programText")}</span><span><Tagged text="[planned] " />{t("pb.test.plannedText")}</span></span>
        </InfoTip>
      </div>
      <ul className="mt-2 grid gap-2 md:grid-cols-2">
        {rb.experiments.map((e) => (
          <li key={e.id} className="tile flex items-start gap-3 p-3">
            <span className="font-num shrink-0 pt-0.5 text-[11.5px] font-bold text-desk">{e.id.split("_")[0]}</span>
            <span className="min-w-0 flex-1 text-[13.5px] leading-snug font-semibold text-ink">{e.question}</span>
            <InfoTip label={e.question}>
              <span className="grid gap-1.5"><span>{e.method}</span><span className="text-ink-3">{t("pb.test.comparedWith")} {e.null_model}</span><span className="text-ink-3">{t("pb.test.passesIf")} {e.pass_criteria}</span></span>
            </InfoTip>
          </li>
        ))}
      </ul>
      {rb.not_supported.length > 0 && (
        <>
          <p className="micro mt-4 mb-2 text-ink-2">{t("pb.test.left")}</p>
          <ul className="grid gap-2 md:grid-cols-2">
            {rb.not_supported.map((x) => (
              <li key={x.name} className="tile flex items-start gap-2 p-3">
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink-2">{x.name}</span>
                <InfoTip label={x.name}>{x.why}</InfoTip>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- decisions */

function Decisions({ rb, go }) {
  const t = strings(dict);
  const owner = rb.open_questions.filter((q) => q.owner_decision);
  const housekeeping = rb.open_questions.filter((q) => !q.owner_decision);
  if (!owner.length && !housekeeping.length) return null;
  return (
    <Panel id="open" eyebrow={t("pb.dec.eyebrow")} title={t("pb.dec.titleShort")} info={t("pb.dec.lede")} infoLabel={t("pb.dec.about")}
      badge={<Chip tone="people" className="border-dashed">{t("pb.dec.count", { count: owner.length })}</Chip>}>
      <ul className="grid gap-2 md:grid-cols-2">
        {owner.map((q) => (
          <li key={q.question} className="tile border-people/40 p-3 text-[13.5px] leading-snug text-ink">
            <Chip tone="people" className="mb-2 border-dashed">{t("pb.dec.call")}</Chip>
            <p>{q.question}</p>
          </li>
        ))}
      </ul>
      {housekeeping.length > 0 && (
        <details className="mt-3">
          <summary className="micro min-h-[44px] cursor-pointer py-3 hover:text-ink">{t("pb.dec.tidy", { n: housekeeping.length })}</summary>
          <ul className="grid gap-2 md:grid-cols-2">{housekeeping.map((q) => <li key={q.question} className="tile p-3 text-[13px] leading-snug text-ink-2">{q.question}</li>)}</ul>
        </details>
      )}
      <button type="button" onClick={() => go("admin")}
        className="group mt-3 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-tile border border-line-2 px-3.5 text-start transition-colors hover:border-line-3 sm:w-auto sm:min-w-[320px]">
        <span className="headline text-[15px] tracking-[0.1em] text-ink">{t("pb.dec.past")}</span>
        <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </button>
    </Panel>
  );
}
