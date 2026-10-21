import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct, signTone } from "../lib/format.js";
import { LinesChart } from "../components/lines.jsx";
import { Accent, ArrowRight, Chip, Container, Empty, Headline, Reveal, SectionHead, Segmented } from "../components/ui.jsx";
import { BaseRates } from "../components/checklist.jsx";
import { edgeWords, fillNote, forwardWords, stepLabel } from "../lib/checklist.js";
import { translate } from "../lib/i18n.js";
import { Bdi, En, EnglishNote, useLang } from "../lib/lang.jsx";
import dict from "../i18n/plan.js";

// Every text code writes here is in i18n/plan.js ("pb.*"). The rule book itself (config/rules.json: rule names, plain
// words, definitions, sets, experiments, open questions), the chart checklist's config and the engine's reasons are data
// in English for now: they sit in <En> blocks, with the one-line "written in English for now" note once per section in
// Hebrew.

const FAMILIES = ["savings", "entry", "exit", "sizing", "risk", "fundamental", "process"];
/** A status or verdict in words ("passed the past test"); an unknown one shows as itself. */
const labelOf = (t, k) => (t.has(`pb.label.${k}`) ? t(`pb.label.${k}`) : k);
const EVIDENCE = { replicated: "text-accent", mixed: "text-people", weak: "text-ink-2", untested: "text-ink-3", contradicted: "text-down" };
const DOT = { passes_history: "var(--accent)", candidate: "var(--people)", inconclusive: "var(--ink-3)", rejected: "var(--down)" };
/** A study length: whole years when it divides, else weeks ("2 years", "26 weeks"; "שנתיים", "26 שבועות"). */
const HORIZON = (w, lang = "en") => {
  const t = translate(dict, lang);
  return w % 52 === 0 ? t("pb.years", { count: w / 52, n: w / 52 }) : t("pb.weeks", { count: w, n: w });
};
/** A headline template with an {accent} slot, as the plain array Headline animates word by word. */
const accented = (text, accent) => {
  const [a, b = ""] = text.split("{accent}");
  return [a, <Accent key="accent">{accent}</Accent>, b].filter((x) => x !== "");
};
/** "+12 bp" / "‎+12 נק׳ בסיס": basis points with their sign. */
const bpText = (t, d) => t("pb.bp", { v: `${d > 0 ? "+" : ""}${fmtNum(d, 0)}` });
/** "62%": a whole percent, left to right inside a Hebrew line. */
const wholePct = (v, lang) => (lang === "en" ? `${fmtNum(v, 0)}%` : fmtPct(v, 0, lang).replace("+", ""));

// "[engine]" = computed by the program on every daily run; "[planned]" = written down, not built yet, people check it by hand.
const TAG = /^\[(engine|planned)[^\]]*\]\s*/;
function Tagged({ text }) {
  const t = useLang().t(dict);
  const m = text.match(TAG);
  const body = m ? text.slice(m[0].length) : text;
  return (
    <>
      {m && <span className={`me-1.5 inline-block rounded-full border px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] ${m[1] === "engine" ? "border-accent/50 text-accent" : "border-dashed border-people/60 text-people"}`}>{t(m[1] === "engine" ? "pb.tag.program" : "pb.tag.planned")}</span>}
      <En as="span">{body}</En>
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

function Stat({ k, v, tone = "", sub }) {
  return (
    <div className="min-w-0">
      <div className="meta">{k}</div>
      <div className={`num mt-1 font-mono text-[15px] ${tone}`}><bdi>{v}</bdi></div>
      {sub && <div className="text-[11.5px] text-ink-3"><bdi>{sub}</bdi></div>}
    </div>
  );
}

export default function Playbook({ data, go }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const rb = data.rulebook;
  const res = data.rulesResult;
  if (!rb) {
    return <Container className="pt-20"><Empty title={t("pb.empty.title")}>{t("pb.empty.body")}</Empty></Container>;
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
      <Reveal className="eyebrow mb-4">{[
        t("pb.eyebrow", { v: rb.version, date: fmtDate(rb.updated_at, lang) }, { bidi: false }),
        res ? (res.sample ? t("pb.samplePrices") : t("pb.testedTo", { date: fmtDate(res.as_of, lang) }, { bidi: false })) : null,
      ].filter(Boolean).join(" · ")}</Reveal>
      <Headline size="xl" className="max-w-[16ch]">{accented(t("pb.headline"), t("pb.headlineAccent"))}</Headline>
      <Reveal delay={200} as="p" className="mt-6 max-w-[64ch] text-[clamp(17px,1.7vw,20px)] leading-relaxed text-ink">
        <b className="font-semibold">{t("pb.simple")}</b> {t("pb.intro1")}{allRejected ? ` ${t("pb.introRejected")}` : ""} {t("pb.intro2")}
      </Reveal>
      <div className="mt-6 grid max-w-[64ch] gap-4">
        <EnglishNote />
        {rb.trader.split("\n\n").map((para, i) => <Reveal key={i} delay={250 + i * 90} as="p" lang="en" dir="ltr" className="text-[clamp(17px,1.7vw,20px)] leading-relaxed text-ink-2">{para}</Reveal>)}
      </div>
      <Reveal delay={350} className="mt-8 flex flex-wrap gap-2 text-[13px]">
        <span className="pill">{t("pb.pill.rules", { count: rb.rules.length, n: rb.rules.length })}</span>
        <span className="pill">{t("pb.pill.tested", { n: counts.tested })}</span>
        {counts.needs > 0 && <span className="pill border-dashed border-people/60 text-people">{t("pb.pill.needs", { n: counts.needs })}</span>}
        <span className="pill">{t("pb.pill.habits", { count: counts.process, n: counts.process })}</span>
        <span className="pill">{t("pb.pill.tries", { n: rb.tries_counted })}</span>
      </Reveal>
      <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-ink-3">{t("pb.tryNote")}</p>
      <Reveal className="card mt-8 border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
        <span className="text-people">{t("pb.read.head")}</span> {t("pb.read.p1")}
        {" "}{t.rich("pb.read.p2", { random: <span className="text-ink">{t("pb.read.random")}</span>, goal: `+${goal}%` })}
        {" "}{t("pb.read.p3")}
        <span className="mt-3 block text-ink-3">
          {t.rich("pb.read.sure", Object.fromEntries(["replicated", "mixed", "weak", "untested", "contradicted"].map((k) => [k, <b key={k} className="font-medium text-ink-2">{t(`pb.ev.${k}`)}</b>])))}
        </span>
      </Reveal>

      {res?.frozen && <FrozenNote res={res} name={name} />}
      <Sets rb={rb} name={name} satVerdict={satVerdict} />
      <Savings rb={rb} res={res} name={name} />
      <Satellite res={res} name={name} data={data} />
      <Forward rb={rb} data={data} name={name} />
      <TechChecklist data={data} />
      <Rules rb={rb} satVerdict={satVerdict} go={go} />
      <Process rb={rb} />
      <Testing rb={rb} />
      <Decisions rb={rb} go={go} />
      <p className="meta mt-16 normal-case tracking-[0.04em]">{t("pb.foot")}</p>
    </Container>
  );
}

function FrozenNote({ res, name }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const differs = [
    ...(res.satellite?.rules ?? []).filter((r) => r.verdict_today && r.verdict_today !== r.verdict).map((r) => ({ id: r.id, now: r.verdict_today, frozen: r.verdict })),
    ...(res.savings?.horizons ?? []).flatMap((h) => h.rows.filter((r) => r.verdict_today && r.verdict_today !== r.verdict).map((r) => ({ id: r.id, now: r.verdict_today, frozen: r.verdict, weeks: h.weeks }))),
  ];
  return (
    <Reveal className="card mt-5 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
      <span className="text-accent">{t("pb.frozen.head")}</span> {t("pb.frozen.when", {
        date: fmtDate(res.frozen.as_of, lang),
        which: res.frozen.superseded?.length ? t("pb.frozen.latest", { count: res.frozen.superseded.length, n: res.frozen.superseded.length }) : t("pb.frozen.first"),
      }, { bidi: false })}
      {" "}{t("pb.frozen.body")}
      {differs.length > 0 && (
        <span className="mt-3 block text-ink-3">
          {t("pb.frozen.differs", {
            list: differs.map((d) => (d.weeks
              ? t("pb.frozen.itemH", { name: name(d.id), h: HORIZON(d.weeks, lang), now: labelOf(t, d.now), frozen: labelOf(t, d.frozen) })
              : t("pb.frozen.item", { name: name(d.id), now: labelOf(t, d.now), frozen: labelOf(t, d.frozen) }))).join(", "),
          }, { bidi: false })}
        </span>
      )}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ sets */

function Sets({ rb, name, satVerdict }) {
  const t = useLang().t(dict);
  return (
    <section className="pt-20">
      <SectionHead eyebrow={t("pb.sets.eyebrow")} title={accented(t("pb.sets.title"), t("pb.sets.accent"))} size="md"
        lede={t("pb.sets.lede")} />
      <EnglishNote />
      <div className="grid gap-4 md:grid-cols-2">
        {rb.sets.map((s, i) => (
          <Reveal key={s.id} delay={i * 70} lang="en" dir="ltr" className="card p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <span className="meta">{s.role.replace("_", " ")}</span>
            </div>
            <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">{s.name}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.plain}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {s.rule_ids.map((id) => (
                <a key={id} href={`#rule-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`rule-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                  className="rounded-full border border-line-2 px-3 py-1.5 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink">
                  {satVerdict[id] && <i className="me-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: DOT[satVerdict[id]] }} />}{name(id)}
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
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const sv = res?.savings;
  const [hw, setHw] = useState(null);
  if (!sv?.horizons?.length) {
    return (
      <section className="pt-24">
        <SectionHead eyebrow={t("pb.sav.eyebrow")} title={accented(t("pb.sav.title"), t("pb.sav.accent"))} size="md" />
        <Empty title={t("pb.next")}>{t("pb.sav.emptyBody")}</Empty>
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
      <SectionHead eyebrow={t("pb.sav.eyebrowFull", { h: HORIZON(h.weeks, lang), windows: h.windows, independent: h.independent }, { bidi: false })} title={accented(t("pb.sav.title"), t("pb.sav.accent"))} size="md"
        lede={<>{t("pb.sav.lede")}{" "}
          {tooFew || clear.length === 0
            ? t.rich(tooFew ? "pb.sav.tooFew" : "pb.sav.noClear", { pick: <span className="text-ink">{t("pb.sav.pick")}</span> })
            : t("pb.sav.some")}</>}
        right={sv.horizons.length > 1 ? <Segmented label={t("pb.sav.howLong")} value={h.weeks} onChange={setHw} options={sv.horizons.map((x) => ({ value: x.weeks, label: HORIZON(x.weeks, lang) }))} /> : null} />
      <Reveal className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-start text-[14px]">
          <thead className="meta">
            <tr className="border-b border-line">{["rule", "buys", "typical", "vsPlain", "betterOften", "worstDip", "cash", "feeTie", ""].map((x) => <th key={x} className="px-4 py-3 text-start font-normal">{x ? t(`pb.th.${x}`) : ""}</th>)}</tr>
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
        {t("pb.sav.note1", { bps: fmtNum(maxBps, 0) })}
        {" "}{t("pb.sav.note2")}
      </p>
      {windfall.length > 0 && (
        <>
          <h3 className="mt-14 text-[22px] font-semibold tracking-[-0.02em]">{t("pb.sav.bigTitle")}</h3>
          <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">{t("pb.sav.bigLede")}</p>
          <div className="mt-5 grid gap-3 md:hidden">{windfall.map((r) => <SavingsCard key={r.id} r={r} name={name} />)}</div>
          <Reveal className="card mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-start text-[14px]">
              <thead className="meta"><tr className="border-b border-line">{["rule", "typical", "vsAll", "betterOften", "worstDip", ""].map((x) => <th key={x} className="px-4 py-3 text-start font-normal">{x ? t(`pb.th.${x}`) : ""}</th>)}</tr></thead>
              <tbody>
                {windfall.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium"><En as="span">{name(r.id)}</En></td>
                    <td className="num px-4 py-3 font-mono">{fmtPct(r.irr_median_pct, 1, lang)}</td>
                    <td className="num px-4 py-3 font-mono">{r.vs_baseline_irr_bps_median != null ? t("pb.bp", { v: fmtNum(r.vs_baseline_irr_bps_median, 0) }) : "–"}</td>
                    <td className="num px-4 py-3 font-mono">{r.vs_baseline_better_pct != null ? wholePct(r.vs_baseline_better_pct, lang) : "–"}</td>
                    <td className="num px-4 py-3 font-mono text-down">{fmtPct(r.worst_vs_paid_p10_pct, 0, lang)}</td>
                    <td className="px-4 py-3"><Chip kind={r.verdict} icon={false}>{labelOf(t, r.verdict)}</Chip></td>
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
  const t = useLang().t(dict);
  const d = r.vs_baseline_irr_bps_median;
  const fee = r.breakeven_fee_pct_of_weekly;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3"><En as="span" className="font-medium">{name(r.id)}</En><Chip kind={r.verdict} icon={false}>{labelOf(t, r.verdict)}</Chip></div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat k={t("pb.th.buys")} v={fmtNum(r.trades_per_year, 0)} />
        <Stat k={t("pb.th.typicalShort")} v={fmtPct(r.irr_median_pct, 1)} />
        <Stat k={t("pb.th.vsPlain")} v={d != null ? bpText(t, d) : labelOf(t, "baseline")} tone={d == null ? "text-ink-3" : d >= 0 ? "text-accent" : "text-down"} />
        <Stat k={t("pb.th.betterOften")} v={r.vs_baseline_better_pct != null ? `${fmtNum(r.vs_baseline_better_pct, 0)}%` : "–"} />
        <Stat k={t("pb.th.worstDipShort")} v={fmtPct(r.worst_vs_paid_p10_pct, 0)} tone="text-down" />
        <Stat k={t("pb.th.cash")} v={`${fmtNum(r.cash_share_median_pct, 0)}%`} sub={fee != null ? t("pb.feesTie", { v: fee > 0 ? `${fmtNum(fee, 1)}%` : t("pb.never") }) : null} />
      </div>
    </div>
  );
}

function SavingsRow({ r, name }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const d = r.vs_baseline_irr_bps_median;
  const fee = r.breakeven_fee_pct_of_weekly;
  return (
    <tr className="border-b border-line last:border-0 hover:bg-ink/[0.03]">
      <td className="px-4 py-3 font-medium"><En as="span">{name(r.id)}</En></td>
      <td className="num px-4 py-3 font-mono">{fmtNum(r.trades_per_year, 0)}</td>
      <td className="num px-4 py-3 font-mono">{fmtPct(r.irr_median_pct, 1, lang)}</td>
      <td className={`num px-4 py-3 font-mono ${d == null ? "text-ink-3" : d >= 0 ? "text-accent" : "text-down"}`}>{d != null ? bpText(t, d) : labelOf(t, "baseline")}</td>
      <td className="num px-4 py-3 font-mono">{r.vs_baseline_better_pct != null ? wholePct(r.vs_baseline_better_pct, lang) : "–"}</td>
      <td className="num px-4 py-3 font-mono text-down">{fmtPct(r.worst_vs_paid_p10_pct, 0, lang)}</td>
      <td className="num px-4 py-3 font-mono text-ink-2">{wholePct(r.cash_share_median_pct, lang)}</td>
      <td className="num px-4 py-3 font-mono text-ink-2">{fee != null ? (fee > 0 ? fmtPct(fee, 1, lang).replace("+", "") : t("pb.never")) : "–"}</td>
      <td className="px-4 py-3"><Chip kind={r.verdict} icon={false}>{labelOf(t, r.verdict)}</Chip></td>
    </tr>
  );
}

/* ------------------------------------------------------------- satellite */

function Satellite({ res, name, data }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
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
        <SectionHead eyebrow={t("pb.sat.eyebrow")} title={accented(t("pb.sat.title"), t("pb.sat.accent"))} size="md" />
        <Empty title={t("pb.next")}>{t("pb.sat.emptyBody")}</Empty>
      </section>
    );
  }
  const n = sat.null.runs;
  const colors = ["var(--accent)", "var(--ai)", "var(--people)", "var(--down)", "var(--ink)"];
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pb.sat.eyebrowFull", { from: fmtDate(sat.from, lang), to: fmtDate(sat.to, lang), years: fmtNum(sat.years, 1) }, { bidi: false })} title={accented(t("pb.sat.title"), t("pb.sat.accent"))} size="md"
        lede={<>{t.rich("pb.sat.lede", { n: fmtNum(n, 0), same: <span className="text-ink">{t("pb.sat.same")}</span>, which: <em>{t("pb.sat.which")}</em> })}{rows.length > 0 && rows.every((r) => r.verdict === "rejected") ? ` ${t("pb.sat.allRejected")}` : ""}</>} />
      <Reveal className="card p-5 sm:p-8">
        <div className="meta mb-5 flex flex-wrap gap-x-6 gap-y-2 normal-case tracking-[0.04em]">
          <span><i className="me-2 inline-block h-3 w-8 rounded bg-line-2 align-middle" />{t("pb.sat.lg.random")}</span>
          <span><i className="me-2 inline-block size-2.5 rounded-full bg-accent align-middle" />{t("pb.sat.lg.rule")}</span>
          <span><i className="me-2 inline-block h-3 w-px bg-ink align-middle" />{t("pb.sat.lg.core")}</span>
          <span><i className="me-2 inline-block h-3 border-s border-dashed border-ink-2 align-middle" />{t("pb.sat.lg.ew")}</span>
        </div>
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[200px_minmax(0,1fr)_72px]">
              <button type="button" lang="en" className="min-w-0 truncate text-start text-[13px] text-ink-2 hover:text-ink sm:text-[14px]" title={name(r.id)} onClick={() => document.getElementById(`rule-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{name(r.id)}</button>
              <div dir="ltr" className="relative h-7">
                <i className="absolute top-0 h-full w-px bg-ink" style={{ left: `${axis.pos(sat.controls.core.cagr_pct)}%` }} />
                <i className="absolute top-0 h-full border-s border-dashed border-ink-2" style={{ left: `${axis.pos(sat.controls.equal_weight.cagr_pct)}%` }} />
                <i className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-line-2" style={{ left: `${axis.pos(r.null_cagr_pct.p05)}%`, width: `${axis.pos(r.null_cagr_pct.p95) - axis.pos(r.null_cagr_pct.p05)}%` }} />
                <i className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-3" style={{ left: `${axis.pos(r.null_cagr_pct.p50)}%` }} />
                <i className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${axis.pos(r.stats.cagr_pct)}%`, background: DOT[r.verdict] }} />
              </div>
              <span className="num text-end font-mono text-[13px]">{fmt.pct(r.stats.cagr_pct, 1)}</span>
            </div>
          ))}
        </div>
        <div dir="ltr" className="meta mt-4 flex justify-between normal-case tracking-[0.04em]"><span>{lang === "en" ? `${axis.lo}% a year` : <span dir="rtl">{t("pb.sat.aYearV", { v: `${axis.lo}%` })}</span>}</span><span>{axis.hi}%</span></div>
      </Reveal>

      <Reveal className="card mt-5 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-start text-[14px]">
          <thead className="meta">
            <tr className="border-b border-line">{["rule", "growth", "vsCore", "beatRandom", "halves", "drop", "swaps", "stocks", "result"].map((x) => <th key={x} className="px-4 py-3 text-start font-normal">{t(`pb.th.${x}`)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top hover:bg-ink/[0.03]">
                <td className="px-4 py-3 font-medium"><En as="span">{name(r.id)}</En></td>
                <td className={`num px-4 py-3 font-mono ${r.stats.cagr_pct >= goal ? "text-accent" : ""}`}>{fmt.pct(r.stats.cagr_pct, 1)}</td>
                <td className={`num px-4 py-3 font-mono ${r.vs_core_cagr_pts >= 0 ? "text-accent" : "text-down"}`}>{fmt.pct(r.vs_core_cagr_pts, 1)}</td>
                <td className="num px-4 py-3 font-mono">{wholePct(r.percentile, lang)}<div className="text-[11.5px] text-ink-3">{t("pb.sat.luck", { p: fmtNum(r.p_value, 3), adj: fmtNum(r.p_adjusted, 2) })}</div></td>
                <td className="num px-4 py-3 font-mono"><bdi dir="ltr">{fmtNum(r.percentile_halves[0], 0)}% / {fmtNum(r.percentile_halves[1], 0)}%</bdi></td>
                <td className="num px-4 py-3 font-mono text-down">{fmt.pct(r.stats.max_dd_pct, 0)}<div className="text-[11.5px] text-ink-3">{t("pb.sat.coreDrop", { v: fmtPct(sat.controls.core.max_dd_pct, 0) })}</div></td>
                <td className="num px-4 py-3 font-mono">{wholePct(r.turnover_pct_year, lang)}<div className="text-[11.5px] text-ink-3">{t("pb.sat.aYear")}{r.stops ? `, ${t("pb.sat.stops", { count: r.stops, n: r.stops })}` : ""}</div></td>
                <td className="num px-4 py-3 font-mono">{fmtNum(r.avg_names, 1)}</td>
                <td className="px-4 py-3">
                  <Chip kind={r.verdict} icon={false}>{labelOf(t, r.verdict)}</Chip>
                  <En as="ul" className="mt-2 max-w-[260px] text-[11.5px] leading-snug text-ink-3">{r.reasons.map((x) => <li key={x}>{x}</li>)}</En>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <div className="mt-5 grid gap-3 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-start justify-between gap-3"><En as="span" className="font-medium">{name(r.id)}</En><Chip kind={r.verdict} icon={false}>{labelOf(t, r.verdict)}</Chip></div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Stat k={t("pb.th.growth")} v={fmtPct(r.stats.cagr_pct, 1)} tone={r.stats.cagr_pct >= goal ? "text-accent" : ""} />
              <Stat k={t("pb.th.vsCore")} v={fmtPct(r.vs_core_cagr_pts, 1)} tone={r.vs_core_cagr_pts >= 0 ? "text-accent" : "text-down"} />
              <Stat k={t("pb.th.beatRandomShort")} v={`${fmtNum(r.percentile, 0)}%`} sub={t("pb.sat.luckShort", { p: fmtNum(r.p_adjusted, 2) })} />
              <Stat k={t("pb.th.halvesShort")} v={`${fmtNum(r.percentile_halves[0], 0)} / ${fmtNum(r.percentile_halves[1], 0)}%`} />
              <Stat k={t("pb.th.drop")} v={fmtPct(r.stats.max_dd_pct, 0)} tone="text-down" sub={t("pb.sat.coreDrop", { v: fmtPct(sat.controls.core.max_dd_pct, 0) })} />
              <Stat k={t("pb.th.swaps")} v={`${fmtNum(r.turnover_pct_year, 0)}%`} sub={`${t("pb.sat.nStocks", { n: fmtNum(r.avg_names, 1) })}${r.stops ? `, ${t("pb.sat.stops", { count: r.stops, n: r.stops })}` : ""}`} />
            </div>
            <En as="ul" className="mt-4 grid gap-1 text-[12px] leading-snug text-ink-3">{r.reasons.map((x) => <li key={x}>{x}</li>)}</En>
          </div>
        ))}
      </div>
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        {t("pb.sat.note", { core: fmtPct(sat.controls.core.cagr_pct, 1), ew: fmtPct(sat.controls.equal_weight.cagr_pct, 1), tries: res.tries_counted })}
      </p>

      <Reveal className="card mt-5 p-5 sm:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {rows.map((r, i) => {
            const on = sel.includes(r.id);
            return (
              <button key={r.id} type="button" aria-pressed={on} onClick={() => setShown(on ? sel.filter((x) => x !== r.id) : [...sel, r.id])}
                lang="en" className={`min-h-[36px] rounded-full border px-3.5 text-[13px] ${on ? "border-accent/60 bg-accent/10 text-ink" : "border-line-2 text-ink-3 hover:text-ink"}`}>{name(r.id)}</button>
            );
          })}
        </div>
        <LinesChart dates={sat.weekly.dates} ariaLabel={t("pb.sat.aria")}
          series={[
            { key: "core", label: t("pb.core"), values: sat.weekly.core, color: "var(--ink)", width: 1.6 },
            { key: "ew", label: t("pb.ew"), values: sat.weekly.equal_weight, color: "var(--ink-3)", dash: true, width: 1.6 },
            ...sel.map((id, i) => ({ key: id, label: name(id), values: sat.weekly.rules[id], color: colors[i % colors.length], width: 2.2 })),
          ]} />
      </Reveal>
    </section>
  );
}

/* --------------------------------------------------------------- forward */

function Forward({ rb, data, name }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const led = data.ledger && !data.ledger.sample ? data.ledger : null;
  const rows = Object.entries(led?.rules ?? {});
  const min = rb.acceptance.min_paper_days;
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pb.fwd.eyebrow")} title={accented(t("pb.fwd.title"), t("pb.fwd.accent"))} size="md"
        lede={t("pb.fwd.lede", { min })} />
      {rows.length === 0 ? (
        <Empty title={t("pb.fwd.next")}>{t("pb.fwd.emptyBody")}</Empty>
      ) : (
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-[14px]">
            <thead className="meta"><tr className="border-b border-line">{["pb.th.rule", "pb.fwd.since", "pb.fwd.days", "pb.fwd.picks", "pb.fwd.ruleGrew", "pb.fwd.coreGrew", "pb.th.beatRandom", "pb.fwd.holdings"].map((x) => <th key={x} className="px-4 py-3 text-start font-normal">{t(x)}</th>)}</tr></thead>
            <tbody>
              {rows.map(([id, r]) => {
                const k = led.dates.indexOf(r.started);
                const last = Math.round((new Date(led.as_of) - new Date(r.started)) / 864e5); // calendar days of record
                const coreRet = led.core.at(-1) / led.core[k] * 100 - 100;
                const ret = r.values.at(-1) - 100;
                return (
                  <tr key={id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium"><En as="span">{name(id)}</En></td>
                    <td className="num px-4 py-3 font-mono text-ink-2"><Bdi>{r.started}</Bdi></td>
                    <td className="num px-4 py-3 font-mono"><bdi dir="ltr">{last}{last < min ? <span className="text-ink-3"> / {min}</span> : null}</bdi></td>
                    <td className="num px-4 py-3 font-mono">{r.decisions}</td>
                    <td className={`num px-4 py-3 font-mono ${ret >= 0 ? "text-accent" : "text-down"}`}>{fmtPct(ret, 1, lang)}</td>
                    <td className="num px-4 py-3 font-mono text-ink-2">{fmtPct(coreRet, 1, lang)}</td>
                    <td className="num px-4 py-3 font-mono">{r.forward_percentile != null
                      ? <>{wholePct(r.forward_percentile, lang)}{last < min ? <span className="text-ink-3"> {t("pb.fwd.early")}</span> : null}</>
                      : <span className="text-ink-3">{t(r.decisions < 6 ? "pb.fwd.after6" : "pb.fwd.after126")}</span>}{r.stale ? <span className="block text-[11.5px] text-people">{t("pb.fwd.stale")}</span> : null}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{r.rebalances.at(-1).holdings.length ? <Bdi>{r.rebalances.at(-1).holdings.join(" · ")}</Bdi> : <span className="text-ink-3">{t("pb.fwd.allCore")}</span>}</td>
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
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const cfg = data.checklistCfg;
  if (!cfg) return null;
  const ck = data.checklist;
  const br = ck?.base_rates ?? null;
  const hr = cfg.house_rule;
  const bench = data.bench.label;
  const edge = edgeWords(br, lang);
  const stepName = Object.fromEntries(cfg.steps.map((s) => [s.id, stepLabel(s, lang)]));
  return (
    <section id="checklist" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow={t("pb.ck.eyebrow", { v: cfg.version })} title={accented(t("pb.ck.title"), t("pb.ck.accent"))} size="md" lede={<En as="span">{cfg.purpose}</En>} />
      <EnglishNote />
      <Reveal lang="en" dir="ltr" className="card border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
        <span className="pill mb-3 border-dashed border-people/60 text-people">{cfg.status}</span>
        <ul className="grid gap-2">
          {cfg.how_to_read.map((t) => <li key={t} className="relative ps-4 before:absolute before:start-0 before:top-[0.75em] before:h-px before:w-2 before:bg-people">{t}</li>)}
        </ul>
      </Reveal>

      <ol className="mt-5 grid gap-3 md:grid-cols-2">
        {cfg.steps.map((s, i) => (
          <Reveal as="li" key={s.id} delay={(i % 2) * 60} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[17px] font-semibold"><span className="num me-2 font-mono text-[13px] font-normal text-ink-3">{s.n}</span>{stepLabel(s, lang)}</span>
            </div>
            <En as="p" className="mt-2 text-[14.5px] leading-relaxed text-ink">{s.checks}</En>
            <div className="meta mt-3 mb-1 normal-case tracking-[0.04em]">{t("pb.ck.how")}{s.directional ? "" : ` · ${t("pb.ck.notDir")}`}</div>
            <En as="p" className="text-[13.5px] leading-relaxed text-ink-2">{s.computes}</En>
          </Reveal>
        ))}
      </ol>

      <Reveal className="card mt-5 border-accent/40 p-5 sm:p-6">
        <div className="meta mb-2 text-accent">{t("pb.ck.entry")}</div>
        <En as="p" className="text-[15.5px] leading-relaxed text-ink">{hr.text}</En>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2"><En as="span">{cfg.verdict.text}</En> {t("pb.ck.tp")}</p>
      </Reveal>

      <Reveal className="card mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{t("pb.ck.history")}</h3>
          {br && <span className="meta normal-case tracking-[0.04em]">{t("pb.ck.histMeta", { from: fmtDate(br.from, lang), to: fmtDate(br.to, lang), n: br.names }, { bidi: false })}{ck.sample ? ` · ${t("pb.samplePrices")}` : ""}</span>}
        </div>
        {br ? (
          <>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t("pb.ck.histBody", { step: br.step_days, bench, h: br.horizon_days })}</p>
            <div className="mt-4"><BaseRates br={br} benchLabel={bench} /></div>
            {edge && <p className="mt-4 text-[14px] leading-relaxed text-ink">{edge}</p>}
            {br.house_rule && (
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                {t("pb.ck.fits", { fits: fmtPct(br.house_rule.fits.mean ?? 0, 1), fn: br.house_rule.fits.n, fails: fmtPct(br.house_rule.fails.mean ?? 0, 1), xn: br.house_rule.fails.n })}
              </p>
            )}
            {br.by_check?.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <div className="meta mb-2 normal-case tracking-[0.04em]">{t("pb.ck.each", { bench })}</div>
                <table className="w-full min-w-[300px] text-start text-[13.5px]">
                  <thead className="meta normal-case tracking-[0.04em]"><tr className="border-b border-line"><th className="py-2 text-start font-normal">{t("pb.ck.step")}</th><th className="py-2 ps-2 text-end font-normal">{t("pb.ck.up")}</th><th className="py-2 ps-2 text-end font-normal">{t("pb.ck.down")}</th></tr></thead>
                  <tbody>
                    {br.by_check.map((c) => (
                      <tr key={c.check} className="border-b border-line last:border-0">
                        <td className="py-2 pe-2">{stepName[c.check] ?? c.check}</td>
                        {["bullish", "bearish"].map((k) => (
                          <td key={k} className={`num whitespace-nowrap py-2 ps-2 text-end font-mono ${c[k]?.n ? STEP_TONE[signTone(c[k].mean, 1)] : "text-ink-3"}`}>
                            <bdi dir="ltr">{c[k]?.n ? fmtPct(c[k].mean, 1) : "–"}<span className="ms-1 text-[11px] text-ink-3">{c[k]?.n ?? 0}</span></bdi>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{t("pb.ck.ifWorked")}</p>
              </div>
            )}
            <En as="p" className="mt-4 text-[13px] leading-relaxed text-ink-3">{fillNote(br.note, br)}</En>
          </>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t("pb.ck.later")} <En as="span">{cfg.measure.text}</En></p>
        )}
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{forwardWords(ck?.forward, lang)}</p>
      </Reveal>
      <ul lang="en" dir="ltr" className="mt-5 grid gap-2 text-[13.5px] leading-relaxed text-ink-3">
        {cfg.notes.map((n) => <li key={n} className="relative ps-4 before:absolute before:start-0 before:top-[0.75em] before:h-px before:w-2 before:bg-ink-3">{n}</li>)}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------- rules */

function Rules({ rb, satVerdict, go }) {
  const t = useLang().t(dict);
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pb.rules.eyebrow")} title={accented(t("pb.rules.title"), t("pb.rules.accent"))} size="md"
        lede={t("pb.rules.lede")} />
      <EnglishNote />
      {FAMILIES.map((fam) => {
        const list = rb.rules.filter((r) => r.family === fam);
        if (!list.length) return null;
        return (
          <div key={fam} className="mb-12">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1"><h3 className="text-[22px] font-semibold tracking-[-0.02em]">{t(`pb.fam.${fam}`)}</h3><span className="text-[14px] text-ink-3">{t(`pb.fam.${fam}.sub`)}</span></div>
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
  const t = useLang().t(dict);
  const [open, setOpen] = useState(false);
  const chipKind = verdict ?? r.status;
  return (
    <Reveal delay={i * 50} as="article" id={`rule-${r.id}`} className="card scroll-mt-28 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Chip kind={chipKind} icon={false}>{labelOf(t, chipKind)}</Chip>
        <span className={`meta ${EVIDENCE[r.evidence]}`}>{t("pb.rc.sure", { ev: t.has(`pb.ev.${r.evidence}`) ? t(`pb.ev.${r.evidence}`) : r.evidence })}</span>
      </div>
      <En as="h4" className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">{r.name}</En>
      <En as="p" className="mt-2 text-[15px] leading-relaxed">{r.plain}</En>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="meta mt-4 inline-flex min-h-[32px] items-center gap-1 hover:text-ink">{t(open ? "pb.rc.hide" : "pb.rc.open")} <ArrowRight className={`size-3.5 transition ${open ? "rotate-90" : ""}`} /></button>
      {open && (
        <div className="mt-4 grid gap-4 text-[14px] leading-relaxed">
          <div><div className="meta mb-1">{t("pb.rc.exact")}</div><En as="p" className="text-ink-2">{r.definition}</En></div>
          {r.params.length > 0 && (
            <div><div className="meta mb-1">{t("pb.rc.params")}</div>
              <En as="dl" className="grid gap-1.5">{r.params.map((p) => <div key={p.name} className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 border-t border-line pt-1.5"><dt className="font-mono text-[12.5px]">{p.name} = {p.value}</dt><dd className="text-ink-3">{p.why}</dd></div>)}</En></div>
          )}
          <div><div className="meta mb-1">{t("pb.rc.why")}</div><En as="p" className="text-ink-2">{r.why_included}</En></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="meta mb-1 text-accent">{t(adoptLabel(r))}</div><En as="p" className="text-ink-2">{r.adopt_if}</En></div>
            <div><div className="meta mb-1 text-down">{t("pb.rc.dropped")}</div><En as="p" className="text-ink-2">{r.reject_if}</En></div>
          </div>
          {r.library_refs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5"><span className="meta me-1">{t("pb.rc.source")}</span>
              {r.library_refs.map((x) => <button key={x} type="button" onClick={() => go("insights")} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2 hover:text-ink">{x}</button>)}</div>
          )}
          {r.data_needed && r.status === "needs_data" && <p className="text-people">{t("pb.rc.needs", { what: r.data_needed })}</p>}
        </div>
      )}
    </Reveal>
  );
}

/* --------------------------------------------------------------- process */

function Process({ rb }) {
  const t = useLang().t(dict);
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
          <button type="button" onClick={() => toggle(r.id)} aria-pressed={done.includes(r.id)} className="flex min-h-[56px] w-full items-start gap-4 px-2 py-3 text-start">
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[12px] ${done.includes(r.id) ? "border-accent bg-accent text-bg" : "border-line-2 text-transparent"}`}>✓</span>
            <span lang="en" dir="ltr" className="text-start"><span className="block font-medium">{r.name}</span><span className="block text-[14px] leading-relaxed text-ink-2">{r.plain}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pb.proc.eyebrow", { month })} title={accented(t("pb.proc.title"), t("pb.proc.accent"))} size="md"
        lede={t("pb.proc.lede")} />
      <EnglishNote />
      <Reveal className="card p-3 sm:p-5"><List list={monthly} /></Reveal>
      {yearly.length > 0 && (
        <>
          <h3 className="mt-10 text-[22px] font-semibold tracking-[-0.02em]">{t("pb.proc.yearly")}</h3>
          <p className="mt-1 text-[14px] text-ink-3">{t("pb.proc.yearlyLede")}</p>
          <Reveal className="card mt-4 p-3 sm:p-5"><List list={yearly} /></Reveal>
        </>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- testing */

function Testing({ rb }) {
  const t = useLang().t(dict);
  const a = rb.acceptance;
  const alpha = (100 - a.satellite.null_percentile_min) / 100;
  const maxAbove = Math.max(0, Math.floor((alpha * (a.null_runs + 1)) / rb.tries_counted - 1));
  const pctBar = (100 * (a.null_runs - maxAbove)) / a.null_runs;
  const isPlanned = (x) => /^\[planned/.test(x);
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pb.test.eyebrow")} title={accented(t("pb.test.title"), t("pb.test.accent"))} size="md"
        lede={t("pb.test.lede", { tries: rb.tries_counted })} />
      <Reveal className="card mb-4 p-5 text-[14.5px] leading-relaxed text-ink-2">
        <span className="me-1.5 inline-block rounded-full border border-accent/50 px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] text-accent">{t("pb.tag.program")}</span>
        {t("pb.test.programText")} <span className="mx-1.5 inline-block rounded-full border border-dashed border-people/60 px-2 py-0.5 align-middle font-mono text-[10.5px] uppercase tracking-[0.06em] text-people">{t("pb.tag.planned")}</span>
        {t("pb.test.plannedText")}
      </Reveal>
      <EnglishNote />
      <div className="grid gap-4 lg:grid-cols-3">
        {[["adopt", "text-accent"], ["candidate", "text-people"], ["reject", "text-down"]].map(([k, c]) => {
          const now = a.text[k].filter((x) => !isPlanned(x));
          const later = a.text[k].filter(isPlanned);
          return (
            <Reveal key={k} className="card p-6"><div className={`meta mb-3 ${c}`}>{t(`pb.test.${k}`)}</div>
              <ul className="grid gap-2 text-[14.5px] leading-relaxed text-ink-2">{now.map((x) => <li key={x} className="flex gap-2"><span className={c}>–</span><span><Tagged text={x} /></span></li>)}</ul>
              {later.length > 0 && (
                <details className="mt-4">
                  <summary className="meta cursor-pointer hover:text-ink">{t("pb.test.later", { n: later.length })}</summary>
                  <ul className="mt-3 grid gap-2 text-[14.5px] leading-relaxed text-ink-2">{later.map((x) => <li key={x} className="flex gap-2"><span className={c}>–</span><span><Tagged text={x} /></span></li>)}</ul>
                </details>
              )}
            </Reveal>
          );
        })}
      </div>
      <Reveal className="card mt-4 p-6 text-[14.5px] leading-relaxed text-ink-2">
        <div className="meta mb-3">{t("pb.test.numbers")}</div>
        {t("pb.test.body", {
          runs: a.null_runs, maxAbove, pctBar: `${fmtNum(pctBar, 1)}%`, pctMin: `${a.satellite.null_percentile_min}%`, tries: rb.tries_counted,
          halves: `${a.satellite.halves_percentile_min}%`, dd: a.satellite.max_dd_worse_than_core_pts, turn: `${a.satellite.max_turnover_pct_year}%`, days: a.min_paper_days,
        })}
      </Reveal>
      <div className="mt-6 grid gap-3">
        {rb.experiments.map((e) => (
          <Reveal key={e.id} className="card p-5">
            <div className="font-medium"><span className="meta me-2 normal-case tracking-[0.04em]">{e.id.split("_")[0]}</span><En as="span">{e.question}</En></div>
            <En as="p" className="mt-2 text-[14px] leading-relaxed text-ink-2">{e.method}</En>
            <p className="meta mt-3 normal-case tracking-[0.04em]">{t("pb.test.comparedWith")} <En as="span">{e.null_model}</En> · {t("pb.test.passesIf")} <En as="span">{e.pass_criteria}</En></p>
          </Reveal>
        ))}
      </div>
      {rb.not_supported.length > 0 && (
        <>
          <h3 className="mt-14 text-[22px] font-semibold tracking-[-0.02em]">{t("pb.test.left")}</h3>
          <ul lang="en" dir="ltr" className="mt-4 grid gap-3 md:grid-cols-2">
            {rb.not_supported.map((x) => <li key={x.name} className="card p-5"><div className="font-medium">{x.name}</div><p className="mt-1 text-[14px] leading-relaxed text-ink-2">{x.why}</p></li>)}
          </ul>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- decisions */

function Decisions({ rb, go }) {
  const t = useLang().t(dict);
  const owner = rb.open_questions.filter((q) => q.owner_decision);
  const housekeeping = rb.open_questions.filter((q) => !q.owner_decision);
  if (!owner.length && !housekeeping.length) return null;
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pb.dec.eyebrow")} title={accented(t("pb.dec.title"), t("pb.dec.accent"))} size="md"
        lede={t("pb.dec.lede")} />
      <EnglishNote />
      <ul className="grid gap-3 md:grid-cols-2">
        {owner.map((q) => (
          <li key={q.question} className="card border-people/40 p-5">
            <span className="pill mb-3 border-dashed border-people/60 text-people">{t("pb.dec.call")}</span>
            <En as="p" className="text-[15px] leading-relaxed">{q.question}</En>
          </li>
        ))}
      </ul>
      {housekeeping.length > 0 && (
        <details className="mt-6">
          <summary className="meta cursor-pointer hover:text-ink">{t("pb.dec.tidy", { n: housekeeping.length })}</summary>
          <ul lang="en" dir="ltr" className="mt-3 grid gap-3 md:grid-cols-2">{housekeeping.map((q) => <li key={q.question} className="card p-5 text-[14.5px] leading-relaxed text-ink-2">{q.question}</li>)}</ul>
        </details>
      )}
      <button type="button" onClick={() => go("admin")} className="meta mt-5 inline-flex items-center gap-1 hover:text-ink">{t("pb.dec.past")} <ArrowRight className="size-3.5" /></button>
    </section>
  );
}
