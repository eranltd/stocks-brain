import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { avgPairCorr, basketSeries, goalPath, portfolioVol, weeklyStats, weightsFor } from "../lib/stats.js";
import { COLORS, LABELS, STATUS, nextRebalance, statusLabel, universeConcentration } from "../components/goal.jsx";
import { LinesChart } from "../components/lines.jsx";
import { MEASURES, bestChanges, halvesCheck, prepare, rank, scoreMix, searchMixes, standing } from "../lib/mix.js";
import { Accent, ArrowRight, Container, Empty, Headline, Reveal, SectionHead, Segmented } from "../components/ui.jsx";
import dict from "../text/plan.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

// Every text here is in text/plan.js ("pf.*").

/** A headline template with an {accent} slot, as the plain array Headline animates word by word. */
const accented = (text, accent) => {
  const [a, b = ""] = text.split("{accent}");
  return [a, <Accent key="accent">{accent}</Accent>, b].filter((x) => x !== "");
};
const SHORT = (s) => (s ?? "").replace("Information Technology", "Tech").replace("Communication Services", "Comms").replace("Consumer ", "Cons. ");
/** "62%": a whole percent. */
const wholePct = (v) => `${fmtNum(v, 0)}%`;

const KEY = "sb-portfolio-v1"; // this device only; never sent anywhere
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage may be unavailable */ } };

export default function Portfolio({ data, go }) {
  const t = strings(dict);
  const lr = data.longrun;
  const goal = data.settings.goal.annual_return_pct;
  const slots = data.settings.portfolio.slots;
  const minNames = data.settings.portfolio.target_min_names;
  // The rule's picks are what its forward paper record holds (the history test's path can keep older names).
  const rulePicks = (data.paper && !data.paper.sample ? data.paper.rebalances.at(-1)?.holdings : null) ?? lr?.now.holdings ?? [];
  const [picked, setPicked] = useState(() => load()?.picked?.filter((s) => data.sectors[s]) ?? rulePicks);
  const [mode, setMode] = useState(() => load()?.mode ?? "equal");
  const volOf = (s) => data.market.symbols.find((x) => x.symbol === s)?.risk?.vol_1y_pct ?? null;

  const toggle = (s) => {
    const next = picked.includes(s) ? picked.filter((x) => x !== s) : picked.length < slots ? [...picked, s] : picked;
    setPicked(next);
    save({ picked: next, mode });
  };
  const setM = (m) => { setMode(m); save({ picked, mode: m }); };
  const useMix = (names) => { setPicked(names); save({ picked: names, mode }); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* not available */ } };

  const view = useMemo(() => {
    if (!lr || !picked.length) return null;
    const w = weightsFor(picked, mode, volOf);
    const series = basketSeries(lr.weekly, w);
    const vol = picked.every((s) => volOf(s) != null) ? portfolioVol(w, volOf, lr.corr_1y) : null;
    return { w, series, stats: weeklyStats(series, goal), vol, corr: avgPairCorr(picked, lr.corr_1y) };
  }, [lr, picked, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lr) {
    return (
      <Container className="pt-20">
        <Empty title={t("pf.next")}>{t("pf.emptyBody")}</Empty>
      </Container>
    );
  }

  const L = LABELS(data);
  const goalText = `+${goal}%`;
  const range = `${minNames}–${slots}`;
  const ruleStats = weeklyStats(lr.weekly.rule, goal);
  const coreStats = weeklyStats(lr.weekly.core, goal);
  const bySector = {};
  picked.forEach((s) => { bySector[data.sectors[s]] = (bySector[data.sectors[s]] ?? 0) + 1; });
  const status = Object.fromEntries(lr.now.status.map((x) => [x.symbol, x]));
  const warnings = [
    picked.length < minNames && t("pf.warn.few", { count: picked.length, n: picked.length, range }),
    ...Object.entries(bySector).filter(([, n]) => n > lr.rule.max_per_sector).map(([sec, n]) => t("pf.warn.sector", { n, sector: sec, max: lr.rule.max_per_sector })),
    view?.corr != null && view.corr > 0.6 && t("pf.warn.corr", { score: fmtNum(view.corr, 2) }),
    ...picked.filter((s) => status[s]?.status === "stretched").map((s) => t("pf.warn.stretched", { s })),
    ...picked.filter((s) => status[s]?.status === "fails_checks").map((s) => t("pf.warn.fails", { s, passed: status[s].passed })),
  ].filter(Boolean);
  const u = universeConcentration(data);

  return (
    <Container className="pt-14">
      <Reveal className="eyebrow mb-4">{t("pf.eyebrow", { prices: lr.sample ? t("pf.samplePrices") : t("pf.realYears", { years: fmtNum(lr.years, 1) }), date: fmtDate(lr.as_of) })}</Reveal>
      <Headline size="xl" className="max-w-[18ch]">{accented(t("pf.headline"), t("pf.headlineAccent"))}</Headline>
      <Reveal delay={250} as="p" className="mt-6 max-w-[62ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-ink">
        <b className="font-semibold">{t("pf.simple")}</b> {t("pf.intro")}
      </Reveal>
      <Reveal delay={300} as="p" className="mt-4 max-w-[62ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-ink-2">
        {t("pf.intro2", { slots, goal: goalText })}
      </Reveal>

      <Reveal className="card mt-10 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="meta">{t("pf.pickedOf", { n: picked.length, slots })}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="pill text-ink-2 hover:text-ink" onClick={() => { setPicked(rulePicks); save({ picked: rulePicks, mode }); }}>{t("pf.showRule")}</button>
            <Segmented label={t("pf.howMuch")} value={mode} onChange={setM} options={[{ value: "equal", label: t("pf.equal") }, { value: "vol", label: t("pf.calm") }]} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.watchlist.symbols.map((s) => {
            const on = picked.includes(s.symbol);
            return (
              <button key={s.symbol} type="button" onClick={() => toggle(s.symbol)} aria-pressed={on}
                className={`min-h-[44px] rounded-2xl border px-4 py-2 text-start transition ${on ? "border-accent/60 bg-accent/10" : "border-line-2 hover:border-ink-3"} ${!on && picked.length >= slots ? "opacity-40" : ""}`}>
                <span className={`font-mono text-[15px] font-semibold ${on ? "text-accent" : ""}`}>{s.symbol}</span>
                <span className="ms-2 text-[12.5px] text-ink-3">{SHORT(s.sector)}</span>
                {on && view && <span className="num ms-2 inline-block font-mono text-[12.5px] text-ink-2">{fmtNum(view.w[s.symbol] * 100, 0)}%</span>}
              </button>
            );
          })}
        </div>
        {mode === "vol" && <p className="mt-4 text-[13.5px] text-ink-3">{t("pf.calmNote")}</p>}
        {warnings.length > 0 && (
          <ul className="mt-5 grid gap-1.5 text-[14px] text-people">
            {warnings.map((w) => <li key={w} className="flex gap-2"><span>!</span>{w}</li>)}
          </ul>
        )}
      </Reveal>

      {view && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {[
              { k: t("pf.yourMix"), s: view.stats, you: true },
              { k: L.rule, s: ruleStats },
              { k: L.core, s: coreStats },
            ].map((x, i) => (
              <Reveal key={x.k} delay={i * 60} className={`card p-4 sm:p-6 ${x.you ? "border-accent/40" : ""}`}>
                <div className="meta truncate">{x.k}</div>
                <div className={`display num mt-3 text-[clamp(30px,4vw,48px)] leading-none ${x.s.cagr >= goal ? "text-accent" : ""}`}>{fmtPct(x.s.cagr, 1)}</div>
                <div className="meta mt-1 normal-case tracking-[0.04em]">{t("pf.avgGrowth")}</div>
                <dl className="mt-4 grid gap-1 text-[13px]">
                  <Row k={t("pf.row.hitGoal", { goal: goalText })} v={`${fmtNum(x.s.hitGoal, 0)}%`} />
                  <Row k={t("pf.row.lost")} v={`${fmtNum(x.s.loss12, 0)}%`} />
                  <Row k={t("pf.row.worstYear")} v={fmtPct(x.s.worst12, 0)} tone={x.s.worst12 < 0 ? "text-down" : ""} />
                  <Row k={t("pf.row.drop")} v={fmtPct(x.s.maxDD, 0)} tone="text-down" />
                </dl>
              </Reveal>
            ))}
            <Reveal delay={180} className="card p-4 sm:p-6">
              <div className="meta">{t("pf.last12")}</div>
              <dl className="mt-4 grid gap-1 text-[13px]">
                <Row k={t("pf.row.bumpy")} v={view.vol != null ? `${fmtNum(view.vol, 0)}%` : "–"} />
                <Row k={t("pf.row.badMonth")} v={view.vol != null ? fmtPct(-1.645 * view.vol * Math.sqrt(20 / 252), 0) : "–"} tone="text-down" />
                <Row k={t("pf.row.together")} v={view.corr != null ? fmtNum(view.corr, 2) : "–"} />
                <Row k={t("pf.row.kinds")} v={t("pf.kindsOf", { n: Object.keys(bySector).length, total: picked.length })} />
              </dl>
              <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">{t("pf.mixNote")}</p>
            </Reveal>
          </div>
          <Reveal className="card mt-5 p-5 sm:p-8">
            <LinesChart dates={lr.weekly.dates} ariaLabel={t("pf.chartAria")}
              series={[
                { key: "goal", label: t("pf.goalLine", { goal: goalText }), values: goalPath(lr.weekly.dates.length, goal), color: COLORS.goal, dash: true, width: 1.5 },
                { key: "core", label: L.core, values: lr.weekly.core, color: COLORS.core, width: 1.6 },
                { key: "rule", label: L.rule, values: lr.weekly.rule, color: COLORS.rule, width: 2 },
                { key: "mix", label: t("pf.yourMix"), values: view.series, color: "var(--ai)", width: 2.6 },
              ]} />
          </Reveal>
        </>
      )}

      <MixAndMatch data={data} lr={lr} picked={picked} useMix={useMix} slots={slots} minNames={minNames} go={go} />

      <section className="pt-24">
        <SectionHead eyebrow={t("pf.corr.eyebrow")} title={accented(t("pf.corr.title"), t("pf.corr.accent"))}
          lede={<>{t("pf.corr.lede")} {u.concentrated ? t("pf.corr.concentrated", { count: u.sectors, n: u.sectors }) : ""}</>} size="md" />
        <Reveal className="card overflow-x-auto p-4 sm:p-6">
          <CorrMap corr={lr.corr_1y} picked={picked} />
        </Reveal>
      </section>

      <section className="pt-24">
        <SectionHead eyebrow={t("pf.each.eyebrow", { from: fmtDate(lr.from), to: fmtDate(lr.to) })} title={accented(t("pf.each.title"), t("pf.each.accent"))} size="md"
          lede={t("pf.each.lede")} />
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-[14px]">
            <thead className="meta">
              <tr className="border-b border-line">
                {[t("pf.th.stock"), t("pf.th.kind"), t("pf.th.year"), t("pf.th.yearsGoal", { goal: goalText }), t("pf.row.worstYear"), t("pf.row.drop"), t("pf.th.bumpy"), t("pf.th.held"), t("pf.th.today")].map((h) => <th key={h} className="px-4 py-3 text-start font-normal">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lr.members.map((m) => (
                <tr key={m.symbol} className="border-b border-line last:border-0 hover:bg-ink/[0.03]">
                  <td className="px-4 py-3"><button type="button" onClick={() => go(`stock/${m.symbol}`)} className="font-mono font-semibold hover:text-accent">{m.symbol}</button></td>
                  <td className="px-4 py-3 text-ink-2">{m.sector}</td>
                  <td className={`num px-4 py-3 font-mono ${m.cagr_pct >= goal ? "text-accent" : ""}`}>{fmtPct(m.cagr_pct, 1)}</td>
                  <td className="num px-4 py-3 font-mono">{wholePct(m.hit_goal_12m_pct)}</td>
                  <td className="num px-4 py-3 font-mono text-down">{fmtPct(m.worst_12m_pct, 0)}</td>
                  <td className="num px-4 py-3 font-mono text-down">{fmtPct(m.max_dd_pct, 0)}</td>
                  <td className="num px-4 py-3 font-mono">{volOf(m.symbol) != null ? wholePct(volOf(m.symbol)) : "–"}</td>
                  <td className="num px-4 py-3 font-mono">{wholePct(m.held_pct)}</td>
                  <td className={`px-4 py-3 ${STATUS[status[m.symbol]?.status]?.tone ?? ""}`}>{status[m.symbol]?.status && STATUS[status[m.symbol].status] ? statusLabel(status[m.symbol].status) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <section className="pt-24">
        <SectionHead eyebrow={t("pf.held.eyebrow", { version: lr.rule.version, n: lr.rebalances_total, date: fmtDate(nextRebalance(lr.as_of)) })}
          title={accented(t("pf.held.title"), t("pf.held.accent"))}
          lede={t("pf.held.lede", { avg: fmtNum(lr.avg_names_held, 1), turn: `${fmtNum(lr.traded_per_year_pct / 2, 0)}%`, bps: lr.rule.cost_bps })} size="md" />
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-[14px]">
            <thead className="meta"><tr className="border-b border-line">{["month", "stocks", "core", "swapped"].map((k) => <th key={k} className="px-4 py-3 text-start font-normal">{t(`pf.held.${k}`)}</th>)}</tr></thead>
            <tbody>
              {[...lr.rebalances].reverse().map((r) => (
                <tr key={r.date} className="border-b border-line last:border-0">
                  <td className="num px-4 py-2.5 font-mono text-ink-2">{r.date.slice(0, 7)}</td>
                  <td className="px-4 py-2.5 font-mono">{r.holdings.length ? <span>{r.holdings.join(" · ")}</span> : <span className="text-ink-3">{t("pf.held.none")}</span>}</td>
                  <td className="num px-4 py-2.5 font-mono text-ink-2">{wholePct(r.core_pct)}</td>
                  <td className="num px-4 py-2.5 font-mono text-ink-3">{wholePct(r.traded_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <PaperRecord data={data} />

      <Reveal className="mt-16 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => go("today")} className="btn"><ArrowRight className="size-4 rotate-180" /> {t("pf.nav.today")}</button>
        <button type="button" onClick={() => go("admin")} className="btn">{t("pf.nav.rules")} <ArrowRight /></button>
      </Reveal>
      <p className="meta mt-10 normal-case tracking-[0.04em]">{t("pf.foot")}</p>
    </Container>
  );
}

/** A bold number or ticker list inside a sentence. */
function B({ children, className = "" }) {
  return <b className={`num font-mono ${className}`}>{children}</b>;
}

function MixChips({ names, sectors, picked }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((s) => (
        <span key={s} className={`rounded-full border px-2.5 py-1 font-mono text-[12.5px] ${picked.includes(s) ? "border-accent/60 text-accent" : "border-line-2"}`}>
          {s}<span className="ms-1.5 font-sans text-[11px] text-ink-3">{SHORT(sectors[s])}</span>
        </span>
      ))}
    </div>
  );
}

function MixAndMatch({ data, lr, picked, useMix, slots, minNames, go }) {
  const t = strings(dict);
  const [measure, setMeasure] = useState("profit");
  const [size, setSize] = useState(String(slots));
  const [limit, setLimit] = useState(true);
  const [on, setOn] = useState(false);
  const symbols = useMemo(() => Object.keys(lr.weekly.members), [lr]);
  const prep = useMemo(() => prepare(lr.weekly, symbols), [lr, symbols]);
  const cap = limit ? lr.rule.max_per_sector : null;
  const k = Number(size);
  const all = useMemo(() => (on ? searchMixes(prep, data.sectors, { k, cap }) : null), [on, prep, k, cap, data.sectors]);
  const halves = useMemo(() => (all ? halvesCheck(all) : null), [all]);
  const top = useMemo(() => (all ? rank(all, measure).slice(0, 5) : []), [all, measure]);
  const mine = useMemo(() => (picked.length ? scoreMix(prep, picked.map((s) => symbols.indexOf(s))) : null), [prep, picked, symbols]);
  const changes = useMemo(() => (on && picked.length ? bestChanges(prep, data.sectors, picked, { slots, cap, measure }) : null), [on, prep, picked, slots, cap, measure, data.sectors]);
  const solo = useMemo(() => symbols.map((_, i) => scoreMix(prep, [i]).cagr), [prep, symbols]);
  const withoutBest = (m) => {
    const best = m.idx.reduce((a, b) => (solo[b] > solo[a] ? b : a));
    return { name: symbols[best], score: scoreMix(prep, m.idx.filter((i) => i !== best)) };
  };
  const measureLabel = MEASURES[measure].label.toLowerCase();
  const sizes = Array.from({ length: slots - minNames + 1 }, (_, i) => String(minNames + i));
  const rejected = (data.rulesResult?.satellite?.rules ?? []).filter((r) => r.verdict === "rejected");
  const rejLo = rejected.length ? Math.min(...rejected.map((r) => r.percentile)) : null;
  const rejHi = rejected.length ? Math.max(...rejected.map((r) => r.percentile)) : null;
  const dates = lr.weekly.dates;
  const med = all ? rank(all, measure)[Math.floor(all.length / 2)] : null;
  const f = MEASURES[measure].pick;
  const delta = (s) => (mine ? s.cagr - mine.cagr : 0);

  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pf.mm.eyebrow")} title={accented(t("pf.mm.title"), t("pf.mm.accent"))} size="md"
        lede={t("pf.mm.lede", { range: `${minNames}–${slots}`, n: symbols.length })} />
      <Reveal className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label={t("pf.mm.sortBy")} value={measure} onChange={setMeasure} options={Object.keys(MEASURES).map((value) => ({ value, label: MEASURES[value].label }))} />
          {sizes.length > 1 && <Segmented label={t("pf.mm.inGroup")} value={size} onChange={setSize} options={sizes.map((s) => ({ value: s, label: t("pf.mm.nStocks", { n: s }) }))} />}
          <button type="button" aria-pressed={limit} onClick={() => setLimit(!limit)} className={`pill max-w-full whitespace-normal text-start ${limit ? "border-accent/50 text-accent" : "text-ink-2"}`}>{limit ? t("pf.mm.capOn", { max: lr.rule.max_per_sector }) : t("pf.mm.capOff")}</button>
        </div>
        {!on && (
          <div className="mt-5">
            <button type="button" className="btn" onClick={() => setOn(true)}>{t("pf.mm.try")} <ArrowRight /></button>
            <p className="mt-3 text-[13.5px] text-ink-3">{t("pf.mm.tryNote")}</p>
          </div>
        )}
      </Reveal>

      {on && all && (
        <>
          {mine && (
            <Reveal className="card mt-4 p-5 sm:p-7">
              <div className="meta mb-2">{t("pf.mm.rankTitle")}</div>
              <p className="text-[16px] leading-relaxed">
                {rich(t, "pf.mm.grew", { names: <B>{picked.join(" · ")}</B>, cagr: <B>{fmtPct(mine.cagr, 1)}</B>, dd: <B className="text-down">{fmtPct(mine.dd, 0)}</B> })}
                {" "}{picked.length === k
                  ? rich(t, "pf.mm.beat", { measure: measureLabel, pct: <B>{fmtNum(standing(all, measure, f(mine)), 0)}%</B>, n: fmtNum(all.length, 0) })
                  : t("pf.mm.size", { n: picked.length, k })}
                {" "}{t("pf.mm.middle", { mid: fmtPct(med.cagr, 1), best: fmtPct(top[0].cagr, 1) })}
              </p>
            </Reveal>
          )}

          <h3 className="mt-10 text-[22px] font-semibold tracking-[-0.02em]">{t("pf.mm.topTitle", { measure: measureLabel })}</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {top.map((m, i) => {
              const names = m.idx.map((x) => symbols[x]);
              const wo = withoutBest(m);
              return (
                <Reveal key={names.join("-")} delay={i * 50} className="card p-5">
                  <div className="flex items-center justify-between gap-3"><span className="meta">#{i + 1}</span><button type="button" className="pill text-ink-2 hover:text-ink" onClick={() => useMix(names)}>{t("pf.mm.tryGroup")}</button></div>
                  <div className="mt-3"><MixChips names={names} sectors={data.sectors} picked={picked} /></div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
                    <Row k={t("pf.mm.growth")} v={fmtPct(m.cagr, 1)} tone={m.cagr >= data.settings.goal.annual_return_pct ? "text-accent" : ""} />
                    <Row k={t("pf.row.drop")} v={fmtPct(m.dd, 0)} tone="text-down" />
                    <Row k={t("pf.mm.bumpy")} v={`${fmtNum(m.vol, 0)}%`} />
                    <Row k={t("pf.mm.without", { name: wo.name })} v={`${fmtPct(wo.score.cagr, 1)}`} />
                  </dl>
                </Reveal>
              );
            })}
          </div>

          {changes && changes.changes.length > 0 && (
            <Reveal className="card mt-4 p-5 sm:p-7">
              <div className="meta mb-3">{t(picked.length < slots ? "pf.mm.bestAdd" : "pf.mm.bestSwap", { measure: measureLabel })}</div>
              <ul className="grid gap-3">
                {changes.changes.map((c) => (
                  <li key={c.names.join("-")} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
                    <div>
                      <div className="font-mono text-[15px]"><span>{c.kind === "swap" ? <>{c.drop} → <span className="text-accent">{c.add}</span></> : <>+ <span className="text-accent">{c.add}</span></>}</span> <span className="font-sans text-[12.5px] text-ink-3">{SHORT(data.sectors[c.add])}</span></div>
                      <div className="mt-0.5 text-[13px] text-ink-3">{t("pf.mm.change", { cagr: fmtPct(c.score.cagr, 1), delta: fmtPct(delta(c.score), 1), dd: fmtPct(c.score.dd, 0) })}</div>
                    </div>
                    <button type="button" className="pill text-ink-2 hover:text-ink" onClick={() => useMix(c.names)}>{t("pf.mm.tryIt")}</button>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal className="card mt-4 border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-7">
            <div className="meta mb-3 text-people">{t("pf.mm.reality")}</div>
            <ul className="grid gap-3">
              <li><b className="font-medium text-ink">{t("pf.mm.r1b")}</b> {t("pf.mm.r1", { n: fmtNum(all.length, 0) })}</li>
              <li><b className="font-medium text-ink">{t("pf.mm.r2b")}</b> {t("pf.mm.r2", { n: symbols.length, date: fmtDate(dates[prep.mid]), pct: fmtNum(halves.medianPercentile, 0), lo: "-1", hi: "1", corr: fmtNum(halves.rankCorrelation, 2) })}</li>
              {rejLo != null && <li><b className="font-medium text-ink">{t("pf.mm.r3b")}</b> {t("pf.mm.r3", { lo: `${fmtNum(rejLo, 0)}%`, hi: `${fmtNum(rejHi, 0)}%` })} <button type="button" className="underline hover:text-ink" onClick={() => go("playbook")}>{t("pf.mm.r3link")}</button>.</li>}
              <li><b className="font-medium text-ink">{t("pf.mm.r4b")}</b> {t("pf.mm.r4", { dd: fmtPct(top[0].dd, 0), wo: fmtPct(withoutBest(top[0]).score.cagr, 1), cagr: fmtPct(top[0].cagr, 1) })}</li>
              <li>{t("pf.mm.r5", { years: fmtNum(lr.years, 1) })}</li>
            </ul>
          </Reveal>
        </>
      )}
    </section>
  );
}

function Row({ k, v, tone = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1">
      <dt className="text-ink-3">{k}</dt>
      <dd className={`num font-mono ${tone}`}>{v}</dd>
    </div>
  );
}

function CorrMap({ corr, picked }) {
  const n = corr.symbols.length;
  const color = (v) => (v == null ? "transparent" : `color-mix(in oklab, var(--people) ${Math.round(Math.max(0, Math.min(1, v)) * 70)}%, var(--surface-2))`);
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `52px repeat(${n}, minmax(0,1fr))`, minWidth: 52 + n * 40 }}>
      <span />
      {corr.symbols.map((s) => <span key={s} className={`meta text-center ${picked.includes(s) ? "text-accent" : ""}`}>{s}</span>)}
      {corr.m.map((row, i) => (
        <div key={corr.symbols[i]} className="contents">
          <span className={`meta self-center ${picked.includes(corr.symbols[i]) ? "text-accent" : ""}`}>{corr.symbols[i]}</span>
          {row.map((v, j) => {
            const both = picked.includes(corr.symbols[i]) && picked.includes(corr.symbols[j]) && i !== j;
            return (
              <span key={j} title={`${corr.symbols[i]} · ${corr.symbols[j]}: ${v ?? "–"}`}
                className={`num grid aspect-[1.3] place-items-center rounded-md font-mono text-[10.5px] ${i === j ? "text-ink-3" : "text-ink"} ${both ? "ring-2 ring-accent" : ""}`}
                style={{ background: i === j ? "transparent" : color(v) }}>
                {i === j ? "·" : v != null ? v.toFixed(2).replace(/^(-?)0\./, "$1.") : "–"}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PaperRecord({ data }) {
  const t = strings(dict);
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  return (
    <section className="pt-24">
      <SectionHead eyebrow={t("pf.paper.eyebrow")} title={accented(t("pf.paper.title"), t("pf.paper.accent"))}
        lede={t("pf.paper.lede")} size="md" />
      {paper && paper.track.length > 1 ? (
        <Reveal className="card p-5 sm:p-8">
          <LinesChart dates={paper.track.map((x) => x.date)} log={false} ariaLabel={t("pf.paper.aria")}
            series={[
              { key: "core", label: t("pf.paper.core"), values: paper.track.map((x) => x.core_v), color: COLORS.core, width: 1.6 },
              { key: "bench", label: data.bench.symbol, values: paper.track.map((x) => x.bench_v), color: COLORS.bench, dash: true, width: 1.6 },
              { key: "rule", label: t("pf.paper.rule"), values: paper.track.map((x) => x.v), color: COLORS.rule, width: 2.6 },
            ]} />
          <p className="meta mt-3 normal-case tracking-[0.04em]">{t("pf.paper.meta", {
            date: fmtDate(paper.started),
            picks: t("pf.paper.picks", { count: paper.rebalances.length, n: paper.rebalances.length }),
            holdings: paper.rebalances.at(-1).holdings.join(", ") || t("pf.paper.none"),
          })}</p>
        </Reveal>
      ) : (
        <Empty title={t(paper ? "pf.paper.today" : "pf.paper.next")}>{t("pf.paper.emptyBody")}</Empty>
      )}
    </section>
  );
}
