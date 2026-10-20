import { useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct } from "../lib/format.js";
import { avgPairCorr, basketSeries, goalPath, portfolioVol, weeklyStats, weightsFor } from "../lib/stats.js";
import { COLORS, LABELS, STATUS, nextRebalance, universeConcentration } from "../components/goal.jsx";
import { LinesChart } from "../components/lines.jsx";
import { MEASURES, bestChanges, halvesCheck, prepare, rank, scoreMix, searchMixes, standing } from "../lib/mix.js";
import { Accent, ArrowRight, Container, Empty, Headline, Reveal, SectionHead, Segmented } from "../components/ui.jsx";

const KEY = "sb-portfolio-v1"; // this device only; never sent anywhere
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage may be unavailable */ } };

export default function Portfolio({ data, go }) {
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
        <Empty title="Shows up after the next daily run">This page needs years of past prices, and the daily computer run has not worked them out yet.</Empty>
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
    picked.length < minNames && `Only ${picked.length} stock${picked.length === 1 ? "" : "s"}: the experiment uses ${minNames}–${slots}.`,
    ...Object.entries(bySector).filter(([, n]) => n > lr.rule.max_per_sector).map(([sec, n]) => `${n} stocks from the same kind of business (${sec}): the rule allows ${lr.rule.max_per_sector}.`),
    view?.corr != null && view.corr > 0.6 && `They move together a lot (score ${fmtNum(view.corr, 2)} out of 1): when one falls, the others likely fall too.`,
    ...picked.filter((s) => status[s]?.status === "stretched").map((s) => `${s} has run up far above its usual path: the rule would not pick it today.`),
    ...picked.filter((s) => status[s]?.status === "fails_checks").map((s) => `${s} passes only ${status[s].passed} of the rule's 4 checks.`),
  ].filter(Boolean);
  const u = universeConcentration(data);

  return (
    <Container className="pt-14">
      <Reveal className="eyebrow mb-4">Pretend portfolio · {lr.sample ? "sample prices" : `${fmtNum(lr.years, 1)} years of real past prices`} · {fmtDate(lr.as_of)}</Reveal>
      <Headline size="xl" className="max-w-[18ch]">A pretend portfolio, <Accent>to learn.</Accent></Headline>
      <Reveal delay={250} as="p" className="mt-6 max-w-[62ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-ink">
        <b className="font-semibold">In simple words:</b> this is a pretend portfolio. A computer rule picks a few stocks once a month with pretend money, so we can see whether picking stocks beats just owning the whole market. We do not put real money in it.
      </Reveal>
      <Reveal delay={300} as="p" className="mt-4 max-w-[62ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-ink-2">
        Real money follows the honest action on the verdicts page, which is usually: keep buying a low-cost fund that holds the whole market (we call it the core).
        Below you can play too. Pick up to {slots} stocks and see how they would have done in the past: how much they grew, how bumpy the ride was, and how often they reached +{goal}% in a year, next to the rule and the core.
        Your picks stay in this browser only. Nothing is saved anywhere else.
      </Reveal>

      <Reveal className="card mt-10 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="meta">{picked.length} of {slots} picked</div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="pill text-ink-2 hover:text-ink" onClick={() => { setPicked(rulePicks); save({ picked: rulePicks, mode }); }}>Show the rule's picks</button>
            <Segmented label="How much of each" value={mode} onChange={setM} options={[{ value: "equal", label: "Equal shares" }, { value: "vol", label: "More of the calm ones" }]} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.watchlist.symbols.map((s) => {
            const on = picked.includes(s.symbol);
            return (
              <button key={s.symbol} type="button" onClick={() => toggle(s.symbol)} aria-pressed={on}
                className={`min-h-[44px] rounded-2xl border px-4 py-2 text-start transition ${on ? "border-accent/60 bg-accent/10" : "border-line-2 hover:border-ink-3"} ${!on && picked.length >= slots ? "opacity-40" : ""}`}>
                <span className={`font-mono text-[15px] font-semibold ${on ? "text-accent" : ""}`}>{s.symbol}</span>
                <span className="ms-2 text-[12.5px] text-ink-3">{s.sector.replace("Information Technology", "Tech").replace("Communication Services", "Comms").replace("Consumer ", "Cons. ")}</span>
                {on && view && <span className="num ms-2 font-mono text-[12.5px] text-ink-2">{fmtNum(view.w[s.symbol] * 100, 0)}%</span>}
              </button>
            );
          })}
        </div>
        {mode === "vol" && <p className="mt-4 text-[13.5px] text-ink-3">More of the calm ones: a stock whose price jumps around less gets a bigger slice, so each stock adds about the same amount of bumpiness (Roni's shelf: volatility-based sizing).</p>}
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
              { k: "Your pretend mix", s: view.stats, you: true },
              { k: L.rule, s: ruleStats },
              { k: L.core, s: coreStats },
            ].map((x, i) => (
              <Reveal key={x.k} delay={i * 60} className={`card p-4 sm:p-6 ${x.you ? "border-accent/40" : ""}`}>
                <div className="meta truncate">{x.k}</div>
                <div className={`display num mt-3 text-[clamp(30px,4vw,48px)] leading-none ${x.s.cagr >= goal ? "text-accent" : ""}`}>{fmtPct(x.s.cagr, 1)}</div>
                <div className="meta mt-1 normal-case tracking-[0.04em]">average growth a year</div>
                <dl className="mt-4 grid gap-1 text-[13px]">
                  <Row k={`Years that hit +${goal}%`} v={`${fmtNum(x.s.hitGoal, 0)}%`} />
                  <Row k="Years that lost money" v={`${fmtNum(x.s.loss12, 0)}%`} />
                  <Row k="Worst year" v={fmtPct(x.s.worst12, 0)} tone={x.s.worst12 < 0 ? "text-down" : ""} />
                  <Row k="Biggest drop" v={fmtPct(x.s.maxDD, 0)} tone="text-down" />
                </dl>
              </Reveal>
            ))}
            <Reveal delay={180} className="card p-4 sm:p-6">
              <div className="meta">Your pretend mix · last 12 months</div>
              <dl className="mt-4 grid gap-1 text-[13px]">
                <Row k="Bumpiness (yearly swing)" v={view.vol != null ? `${fmtNum(view.vol, 0)}%` : "–"} />
                <Row k="A bad month (1 in 20)" v={view.vol != null ? fmtPct(-1.645 * view.vol * Math.sqrt(20 / 252), 0) : "–"} tone="text-down" />
                <Row k="Move together (0 to 1)" v={view.corr != null ? fmtNum(view.corr, 2) : "–"} />
                <Row k="Kinds of business" v={`${Object.keys(bySector).length} of ${picked.length}`} />
              </dl>
              <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">Evened out about once a month. Careful: this list was made knowing these companies did well, like picking a race winner after the race.</p>
            </Reveal>
          </div>
          <Reveal className="card mt-5 p-5 sm:p-8">
            <LinesChart dates={lr.weekly.dates} ariaLabel="How 100 would have grown: your pretend mix, the rule, the core and the goal path"
              series={[
                { key: "goal", label: `Goal +${goal}%/yr`, values: goalPath(lr.weekly.dates.length, goal), color: COLORS.goal, dash: true, width: 1.5 },
                { key: "core", label: L.core, values: lr.weekly.core, color: COLORS.core, width: 1.6 },
                { key: "rule", label: L.rule, values: lr.weekly.rule, color: COLORS.rule, width: 2 },
                { key: "mix", label: "Your pretend mix", values: view.series, color: "var(--ai)", width: 2.6 },
              ]} />
          </Reveal>
        </>
      )}

      <MixAndMatch data={data} lr={lr} picked={picked} useMix={useMix} slots={slots} minNames={minNames} go={go} />

      <section className="pt-24">
        <SectionHead eyebrow="Move-together map · daily ups and downs, last 12 months" title={<>Do they move <Accent>together?</Accent></>}
          lede={<>Each square says how much two stocks move together. 1.00 means they go up and down at the same time, like two kids on one swing. Low numbers mean they often go different ways, so one bad day does not sink everything. {u.concentrated ? `This list covers only ${u.sectors} kinds of business, so expect high numbers.` : ""}</>} size="md" />
        <Reveal className="card overflow-x-auto p-4 sm:p-6">
          <CorrMap corr={lr.corr_1y} picked={picked} />
        </Reveal>
      </section>

      <section className="pt-24">
        <SectionHead eyebrow={`Each stock · ${fmtDate(lr.from)} to ${fmtDate(lr.to)}`} title={<>The stocks, <Accent>one by one.</Accent></>} size="md"
          lede="How each stock did on its own in the past. A year = average yearly growth. Biggest drop = the worst fall from a high point. Bumpiness = how much the price jumps around in a year." />
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-[14px]">
            <thead className="meta">
              <tr className="border-b border-line">
                {["Stock", "Kind of business", "A year", `Years at +${goal}%`, "Worst year", "Biggest drop", "Bumpiness (1y)", "Time the rule held it", "Rule today"].map((h) => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}
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
        <SectionHead eyebrow={`Rule ${lr.rule.version} · ${lr.rebalances_total} monthly picks · next ${fmtDate(nextRebalance(lr.as_of))}`}
          title={<>What the rule <Accent>held, on paper.</Accent></>}
          lede={<>A replay on past prices of what the rule would have picked each month, with pretend money. It held {fmtNum(lr.avg_names_held, 1)} stocks on average and swapped about {fmtNum(lr.traded_per_year_pct / 2, 0)}% of the pot a year (how often it swaps stocks), paying a pretend fee of {lr.rule.cost_bps} bp per trade (100 bp = 1%). This replay is redone every day on today's list; the paper record further down is never redone.</>} size="md" />
        <Reveal className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-[14px]">
            <thead className="meta"><tr className="border-b border-line"><th className="px-4 py-3 font-normal">Month</th><th className="px-4 py-3 font-normal">Stocks held</th><th className="px-4 py-3 font-normal">In the core fund</th><th className="px-4 py-3 font-normal">Swapped</th></tr></thead>
            <tbody>
              {[...lr.rebalances].reverse().map((r) => (
                <tr key={r.date} className="border-b border-line last:border-0">
                  <td className="num px-4 py-2.5 font-mono text-ink-2">{r.date.slice(0, 7)}</td>
                  <td className="px-4 py-2.5 font-mono">{r.holdings.join(" · ") || <span className="text-ink-3">none (all in the core)</span>}</td>
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
      <p className="meta mt-10 normal-case tracking-[0.04em]">Analysis only, not financial advice. Pretend money only: nothing on this page is bought. Lines start at 100 so you can compare growth; the site shows growth, not prices.</p>
    </Container>
  );
}

const SHORT = (s) => (s ?? "").replace("Information Technology", "Tech").replace("Communication Services", "Comms").replace("Consumer ", "Cons. ");

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
      <SectionHead eyebrow="Mix and match · a game with the past" title={<>Which stocks, together, <Accent>grew the most?</Accent></>} size="md"
        lede={<>The computer tries every possible group of {minNames}–{slots} of our {symbols.length} stocks on the same past prices, and shows which would have grown the most, grown the most for the bumps, or fallen the least. This is looking back, like knowing the answers after the test. Read the reality check before believing any of it.</>} />
      <Reveal className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Sort groups by" value={measure} onChange={setMeasure} options={Object.entries(MEASURES).map(([value, m]) => ({ value, label: m.label }))} />
          {sizes.length > 1 && <Segmented label="Stocks in the group" value={size} onChange={setSize} options={sizes.map((s) => ({ value: s, label: `${s} stocks` }))} />}
          <button type="button" aria-pressed={limit} onClick={() => setLimit(!limit)} className={`pill ${limit ? "border-accent/50 text-accent" : "text-ink-2"}`}>{limit ? `At most ${lr.rule.max_per_sector} from one kind of business (house rule)` : "Any group, even all one kind of business"}</button>
        </div>
        {!on && (
          <div className="mt-5">
            <button type="button" className="btn" onClick={() => setOn(true)}>Try every group <ArrowRight /></button>
            <p className="mt-3 text-[13.5px] text-ink-3">It takes a moment. It runs on your device and saves nothing.</p>
          </div>
        )}
      </Reveal>

      {on && all && (
        <>
          {mine && (
            <Reveal className="card mt-4 p-5 sm:p-7">
              <div className="meta mb-2">How your pretend mix ranks · equal shares</div>
              <p className="text-[16px] leading-relaxed">
                <b className="num font-mono">{picked.join(" · ")}</b> grew <b className="num font-mono">{fmtPct(mine.cagr, 1)}</b> a year on average, with a biggest drop of <b className="num font-mono text-down">{fmtPct(mine.dd, 0)}</b>.
                {picked.length === k ? <> By {measureLabel} it beat <b className="num font-mono">{fmtNum(standing(all, measure, f(mine)), 0)}%</b> of the {fmtNum(all.length, 0)} possible groups.</> : <> It has {picked.length} stocks; the groups below use {k}.</>}
                {" "}The middle group grew {fmtPct(med.cagr, 1)} a year; the best grew {fmtPct(top[0].cagr, 1)}.
              </p>
            </Reveal>
          )}

          <h3 className="mt-10 text-[22px] font-semibold tracking-[-0.02em]">The five best groups in the past, by {measureLabel}</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {top.map((m, i) => {
              const names = m.idx.map((x) => symbols[x]);
              const wo = withoutBest(m);
              return (
                <Reveal key={names.join("-")} delay={i * 50} className="card p-5">
                  <div className="flex items-center justify-between gap-3"><span className="meta">#{i + 1}</span><button type="button" className="pill text-ink-2 hover:text-ink" onClick={() => useMix(names)}>Try this group</button></div>
                  <div className="mt-3"><MixChips names={names} sectors={data.sectors} picked={picked} /></div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
                    <Row k="Growth a year" v={fmtPct(m.cagr, 1)} tone={m.cagr >= data.settings.goal.annual_return_pct ? "text-accent" : ""} />
                    <Row k="Biggest drop" v={fmtPct(m.dd, 0)} tone="text-down" />
                    <Row k="Bumpiness" v={`${fmtNum(m.vol, 0)}%`} />
                    <Row k={`Without ${wo.name}`} v={`${fmtPct(wo.score.cagr, 1)}`} />
                  </dl>
                </Reveal>
              );
            })}
          </div>

          {changes && changes.changes.length > 0 && (
            <Reveal className="card mt-4 p-5 sm:p-7">
              <div className="meta mb-3">{picked.length < slots ? "Best stock to add to your pretend mix" : "Best single swaps for your pretend mix"} · by {measureLabel}</div>
              <ul className="grid gap-3">
                {changes.changes.map((c) => (
                  <li key={c.names.join("-")} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
                    <div>
                      <div className="font-mono text-[15px]">{c.kind === "swap" ? <>{c.drop} → <span className="text-accent">{c.add}</span></> : <>+ <span className="text-accent">{c.add}</span></>} <span className="font-sans text-[12.5px] text-ink-3">{SHORT(data.sectors[c.add])}</span></div>
                      <div className="mt-0.5 text-[13px] text-ink-3">{fmtPct(c.score.cagr, 1)} a year ({fmtPct(delta(c.score), 1)} compared with now), biggest drop {fmtPct(c.score.dd, 0)}</div>
                    </div>
                    <button type="button" className="pill text-ink-2 hover:text-ink" onClick={() => useMix(c.names)}>Try it</button>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal className="card mt-4 border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-7">
            <div className="meta mb-3 text-people">Reality check</div>
            <ul className="grid gap-3">
              <li><b className="font-medium text-ink">The best group always looks great afterwards.</b> With {fmtNum(all.length, 0)} groups to choose from, one has to come out on top, like one lottery ticket always wins. That shows what happened, not what comes next.</li>
              <li><b className="font-medium text-ink">The list was made looking back.</b> These {symbols.length} are companies that became big, so they look good partly because we already know they won. When the best 20 groups were picked using only the first half of the past (to {fmtDate(dates[prep.mid])}), in the second half they landed around {fmtNum(halves.medianPercentile, 0)} out of 100 (50 would be a coin flip; how much the two halves agree, from -1 to 1: {fmtNum(halves.rankCorrelation, 2)}). That comes from a list of winners, not a promise.</li>
              {rejLo != null && <li><b className="font-medium text-ink">Our own test, written down in advance, found picking by past strength did not work.</b> The stock rules that picked whatever had risen most beat only {fmtNum(rejLo, 0)}% to {fmtNum(rejHi, 0)}% of groups picked at random from this list. <button type="button" className="underline hover:text-ink" onClick={() => go("playbook")}>See our rules</button>.</li>}
              <li><b className="font-medium text-ink">The top groups lean on a few wild stocks.</b> They fell {fmtPct(top[0].dd, 0)} at their worst, and without its single best stock the first group would have grown {fmtPct(withoutBest(top[0]).score.cagr, 1)} a year instead of {fmtPct(top[0].cagr, 1)}.</li>
              <li>Equal shares, evened out about once a month, {fmtNum(lr.years, 1)} years of past prices. Analysis only, not advice; nothing is bought and nothing here is saved.</li>
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
      <dd className={`num text-end font-mono ${tone}`}>{v}</dd>
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
      <SectionHead eyebrow="Paper record · pretend money · written once a month, never edited" title={<>The honest <Accent>test.</Accent></>}
        lede="A test on past prices can always be fiddled with afterwards, like changing your guess after seeing the answer. This record cannot: each month the rule's pretend picks are written down using only what was known that day, and never changed. It is the real check of whether picking stocks beats owning the whole market. No real money goes in." size="md" />
      {paper && paper.track.length > 1 ? (
        <Reveal className="card p-5 sm:p-8">
          <LinesChart dates={paper.track.map((t) => t.date)} log={false} ariaLabel="Pretend portfolio compared with the core fund and the whole market since it started"
            series={[
              { key: "core", label: "Core fund", values: paper.track.map((t) => t.core_v), color: COLORS.core, width: 1.6 },
              { key: "bench", label: data.bench.symbol, values: paper.track.map((t) => t.bench_v), color: COLORS.bench, dash: true, width: 1.6 },
              { key: "rule", label: "Pretend portfolio", values: paper.track.map((t) => t.v), color: COLORS.rule, width: 2.6 },
            ]} />
          <p className="meta mt-3 normal-case tracking-[0.04em]">Since {fmtDate(paper.started)} · {paper.rebalances.length} monthly pick{paper.rebalances.length === 1 ? "" : "s"} · pretend holdings now {paper.rebalances.at(-1).holdings.join(", ") || "none (all in the core fund)"} · dashed line = the whole market</p>
        </Reveal>
      ) : (
        <Empty title={paper ? "Started today" : "Starts with the next daily run"}>The daily computer run writes down the first pretend picks. The line shows up from the second day.</Empty>
      )}
    </section>
  );
}
