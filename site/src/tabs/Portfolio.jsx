import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { avgPairCorr, basketSeries, goalPath, portfolioVol, weeklyStats, weightsFor } from "../lib/stats.js";
import { COLORS, LABELS, STATUS, nextRebalance, universeConcentration } from "../components/goal.jsx";
import { LinesChart } from "../components/lines.jsx";
import { Accent, ArrowRight, Container, Empty, Headline, Reveal, SectionHead, Segmented } from "../components/ui.jsx";

const KEY = "sb-portfolio-v1"; // this device only; never sent anywhere
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage may be unavailable */ } };

export default function Portfolio({ data, go }) {
  const lr = data.longrun;
  const goal = data.settings.goal.annual_return_pct;
  const slots = data.settings.portfolio.slots;
  const minNames = data.settings.portfolio.target_min_names;
  const [picked, setPicked] = useState(() => load()?.picked?.filter((s) => data.sectors[s]) ?? lr?.now.holdings ?? []);
  const [mode, setMode] = useState(() => load()?.mode ?? "equal");
  const volOf = (s) => data.market.symbols.find((x) => x.symbol === s)?.risk?.vol_1y_pct ?? null;

  const toggle = (s) => {
    const next = picked.includes(s) ? picked.filter((x) => x !== s) : picked.length < slots ? [...picked, s] : picked;
    setPicked(next);
    save({ picked: next, mode });
  };
  const setM = (m) => { setMode(m); save({ picked, mode: m }); };

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
        <Empty title="Appears after the next daily run">The portfolio view needs the long-run history computed by the daily routine.</Empty>
      </Container>
    );
  }

  const L = LABELS(data);
  const ruleStats = weeklyStats(lr.weekly.rule, goal);
  const coreStats = weeklyStats(lr.weekly.core, goal);
  const bySector = {};
  picked.forEach((s) => { bySector[data.sectors[s]] = (bySector[data.sectors[s]] ?? 0) + 1; });
  const status = Object.fromEntries(lr.now.status.map((x) => [x.symbol, x]));
  const warnings = [
    picked.length < minNames && `Only ${picked.length} name${picked.length === 1 ? "" : "s"}: the goal is ${minNames}–${slots}.`,
    ...Object.entries(bySector).filter(([, n]) => n > lr.rule.max_per_sector).map(([sec, n]) => `${n} names in ${sec}: the rule allows ${lr.rule.max_per_sector}.`),
    view?.corr != null && view.corr > 0.6 && `Average correlation ${fmtNum(view.corr, 2)}: these names mostly move together.`,
    ...picked.filter((s) => status[s]?.status === "stretched").map((s) => `${s} is stretched above its trend: the rule would not buy it today.`),
    ...picked.filter((s) => status[s]?.status === "fails_checks").map((s) => `${s} passes only ${status[s].passed} of 4 setup checks.`),
  ].filter(Boolean);
  const u = universeConcentration(data);

  return (
    <Container className="pt-14">
      <Reveal className="eyebrow mb-4">Portfolio · {lr.sample ? "sample prices" : `${fmtNum(lr.years, 1)} years of real prices`} · {fmtDate(lr.as_of)}</Reveal>
      <Headline size="xl" className="max-w-[18ch]">Build a <Accent>diverse {minNames}–{slots}.</Accent></Headline>
      <Reveal delay={250} as="p" className="mt-6 max-w-[62ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-ink-2">
        Pick up to {slots} names and see how the mix behaved, how much it swings and how often it reached +{goal}% a year, next to the rule and the core.
        Your selection stays in this browser. Nothing is saved to the public repo.
      </Reveal>

      <Reveal className="card mt-10 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="meta">{picked.length} of {slots} chosen</div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="pill text-ink-2 hover:text-ink" onClick={() => { setPicked(lr.now.holdings); save({ picked: lr.now.holdings, mode }); }}>Use the rule's picks</button>
            <Segmented label="Weights" value={mode} onChange={setM} options={[{ value: "equal", label: "Equal" }, { value: "vol", label: "By risk" }]} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.watchlist.symbols.map((s) => {
            const on = picked.includes(s.symbol);
            return (
              <button key={s.symbol} type="button" onClick={() => toggle(s.symbol)} aria-pressed={on}
                className={`min-h-[44px] rounded-2xl border px-4 py-2 text-left transition ${on ? "border-accent/60 bg-accent/10" : "border-line-2 hover:border-ink-3"} ${!on && picked.length >= slots ? "opacity-40" : ""}`}>
                <span className={`font-mono text-[15px] font-semibold ${on ? "text-accent" : ""}`}>{s.symbol}</span>
                <span className="ml-2 text-[12.5px] text-ink-3">{s.sector.replace("Information Technology", "Tech").replace("Communication Services", "Comms").replace("Consumer ", "Cons. ")}</span>
                {on && view && <span className="num ml-2 font-mono text-[12.5px] text-ink-2">{fmtNum(view.w[s.symbol] * 100, 0)}%</span>}
              </button>
            );
          })}
        </div>
        {mode === "vol" && <p className="mt-4 text-[13.5px] text-ink-3">By risk: calmer names get more weight, so each one adds a similar amount of swing (Roni's shelf: volatility-based sizing).</p>}
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
              { k: "Your mix", s: view.stats, you: true },
              { k: L.rule, s: ruleStats },
              { k: L.core, s: coreStats },
            ].map((x, i) => (
              <Reveal key={x.k} delay={i * 60} className={`card p-4 sm:p-6 ${x.you ? "border-accent/40" : ""}`}>
                <div className="meta truncate">{x.k}</div>
                <div className={`display num mt-3 text-[clamp(30px,4vw,48px)] leading-none ${x.s.cagr >= goal ? "text-accent" : ""}`}>{fmtPct(x.s.cagr, 1)}</div>
                <div className="meta mt-1 normal-case tracking-[0.04em]">a year</div>
                <dl className="mt-4 grid gap-1 text-[13px]">
                  <Row k={`+${goal}% years`} v={`${fmtNum(x.s.hitGoal, 0)}%`} />
                  <Row k="Losing years" v={`${fmtNum(x.s.loss12, 0)}%`} />
                  <Row k="Worst year" v={fmtPct(x.s.worst12, 0)} tone={x.s.worst12 < 0 ? "text-down" : ""} />
                  <Row k="Deepest drop" v={fmtPct(x.s.maxDD, 0)} tone="text-down" />
                </dl>
              </Reveal>
            ))}
            <Reveal delay={180} className="card p-4 sm:p-6">
              <div className="meta">Your mix · last 12 months</div>
              <dl className="mt-4 grid gap-1 text-[13px]">
                <Row k="Yearly swing" v={view.vol != null ? `${fmtNum(view.vol, 0)}%` : "–"} />
                <Row k="Bad month" v={view.vol != null ? fmtPct(-1.645 * view.vol * Math.sqrt(20 / 252), 0) : "–"} tone="text-down" />
                <Row k="Avg correlation" v={view.corr != null ? fmtNum(view.corr, 2) : "–"} />
                <Row k="Sectors" v={`${Object.keys(bySector).length} of ${picked.length}`} />
              </dl>
              <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">Rebalanced about monthly. Hindsight applies: this list was chosen knowing these names did well.</p>
            </Reveal>
          </div>
          <Reveal className="card mt-5 p-5 sm:p-8">
            <LinesChart dates={lr.weekly.dates} ariaLabel="Growth of 100: your mix, the rule, the core and the goal path"
              series={[
                { key: "goal", label: `Goal +${goal}%/yr`, values: goalPath(lr.weekly.dates.length, goal), color: COLORS.goal, dash: true, width: 1.5 },
                { key: "core", label: L.core, values: lr.weekly.core, color: COLORS.core, width: 1.6 },
                { key: "rule", label: L.rule, values: lr.weekly.rule, color: COLORS.rule, width: 2 },
                { key: "mix", label: "Your mix", values: view.series, color: "var(--ai)", width: 2.6 },
              ]} />
          </Reveal>
        </>
      )}

      <section className="pt-24">
        <SectionHead eyebrow="Correlation map · daily returns, last 12 months" title={<>Do they move <Accent>together?</Accent></>}
          lede={<>1.00 means two names move in lockstep. A diverse portfolio wants low numbers between its holdings. {u.concentrated ? `This watchlist spans only ${u.sectors} sectors, so expect high numbers.` : ""}</>} size="md" />
        <Reveal className="card overflow-x-auto p-4 sm:p-6">
          <CorrMap corr={lr.corr_1y} picked={picked} />
        </Reveal>
      </section>

      <section className="pt-24">
        <SectionHead eyebrow={`Each name · ${fmtDate(lr.from)} to ${fmtDate(lr.to)}`} title={<>The names, <Accent>one by one.</Accent></>} size="md" />
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="meta">
              <tr className="border-b border-line">
                {["Name", "Sector", "A year", `+${goal}% years`, "Worst 12m", "Deepest drop", "Swing (1y)", "Rule held", "Rule today"].map((h) => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lr.members.map((m) => (
                <tr key={m.symbol} className="border-b border-line last:border-0 hover:bg-ink/[0.03]">
                  <td className="px-4 py-3"><button type="button" onClick={() => go(`stock/${m.symbol}`)} className="font-mono font-semibold hover:text-accent">{m.symbol}</button></td>
                  <td className="px-4 py-3 text-ink-2">{m.sector}</td>
                  <td className={`num px-4 py-3 font-mono ${m.cagr_pct >= goal ? "text-accent" : ""}`}>{fmtPct(m.cagr_pct, 1)}</td>
                  <td className="num px-4 py-3 font-mono">{fmtNum(m.hit_goal_12m_pct, 0)}%</td>
                  <td className="num px-4 py-3 font-mono text-down">{fmtPct(m.worst_12m_pct, 0)}</td>
                  <td className="num px-4 py-3 font-mono text-down">{fmtPct(m.max_dd_pct, 0)}</td>
                  <td className="num px-4 py-3 font-mono">{volOf(m.symbol) != null ? `${fmtNum(volOf(m.symbol), 0)}%` : "–"}</td>
                  <td className="num px-4 py-3 font-mono">{fmtNum(m.held_pct, 0)}%</td>
                  <td className={`px-4 py-3 ${STATUS[status[m.symbol]?.status]?.tone ?? ""}`}>{STATUS[status[m.symbol]?.status]?.label ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <section className="pt-24">
        <SectionHead eyebrow={`Rule ${lr.rule.version} · ${lr.rebalances_total} monthly decisions · next ${fmtDate(nextRebalance(lr.as_of))}`}
          title={<>What the rule <Accent>held.</Accent></>}
          lede={<>Average {fmtNum(lr.avg_names_held, 1)} names held; about {fmtNum(lr.traded_per_year_pct / 2, 0)}% of the portfolio replaced per year, at {lr.rule.cost_bps} bp per trade. The history test re-runs daily on today's watchlist; the paper record does not.</>} size="md" />
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead className="meta"><tr className="border-b border-line"><th className="px-4 py-3 font-normal">Month</th><th className="px-4 py-3 font-normal">Holdings</th><th className="px-4 py-3 font-normal">Core</th><th className="px-4 py-3 font-normal">Traded</th></tr></thead>
            <tbody>
              {[...lr.rebalances].reverse().map((r) => (
                <tr key={r.date} className="border-b border-line last:border-0">
                  <td className="num px-4 py-2.5 font-mono text-ink-2">{r.date.slice(0, 7)}</td>
                  <td className="px-4 py-2.5 font-mono">{r.holdings.join(" · ") || <span className="text-ink-3">none</span>}</td>
                  <td className="num px-4 py-2.5 font-mono text-ink-2">{fmtNum(r.core_pct, 0)}%</td>
                  <td className="num px-4 py-2.5 font-mono text-ink-3">{fmtNum(r.traded_pct, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <PaperRecord data={data} />

      <Reveal className="mt-16 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => go("today")} className="btn"><ArrowRight className="size-4 rotate-180" /> Today</button>
        <button type="button" onClick={() => go("admin")} className="btn">House rules <ArrowRight /></button>
      </Reveal>
      <p className="meta mt-10 normal-case tracking-[0.04em]">Analysis only, not financial advice. Lines are indexed to 100; the site publishes returns, not prices.</p>
    </Container>
  );
}

function Row({ k, v, tone = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1">
      <dt className="text-ink-3">{k}</dt>
      <dd className={`num text-right font-mono ${tone}`}>{v}</dd>
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
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  return (
    <section className="pt-24">
      <SectionHead eyebrow="Forward paper record · written once a month, never edited" title={<>The honest <Accent>test.</Accent></>}
        lede="A history test can always be tuned after the fact. This record cannot: each month the rule's holdings are written down using only that day's data. It is the evidence the trust ladder waits for." size="md" />
      {paper && paper.track.length > 1 ? (
        <Reveal className="card p-5 sm:p-8">
          <LinesChart dates={paper.track.map((t) => t.date)} log={false} ariaLabel="Paper portfolio vs the core and the benchmark since it started"
            series={[
              { key: "core", label: "Core", values: paper.track.map((t) => t.core_v), color: COLORS.core, width: 1.6 },
              { key: "bench", label: data.bench.symbol, values: paper.track.map((t) => t.bench_v), color: COLORS.bench, dash: true, width: 1.6 },
              { key: "rule", label: "Paper portfolio", values: paper.track.map((t) => t.v), color: COLORS.rule, width: 2.6 },
            ]} />
          <p className="meta mt-3 normal-case tracking-[0.04em]">Since {fmtDate(paper.started)} · {paper.rebalances.length} decision{paper.rebalances.length === 1 ? "" : "s"} · holdings now {paper.rebalances.at(-1).holdings.join(", ") || "none (all core)"}</p>
        </Reveal>
      ) : (
        <Empty title={paper ? "Started today" : "Starts with the next daily run"}>The first monthly decision is written by the daily routine; the line appears from the second day.</Empty>
      )}
    </section>
  );
}
