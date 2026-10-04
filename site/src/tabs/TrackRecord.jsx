import { useState } from "react";
import { summarize } from "../lib/data.js";
import { fmtNum, fmtPct } from "../lib/format.js";
import { useInView } from "../lib/motion.js";
import { ExcessChart } from "../components/charts.jsx";
import { Accent, Chip, Container, Conviction, Empty, Reveal, SectionHead, Strip } from "../components/ui.jsx";
import { TrustLadder } from "../components/trust.jsx";

export default function TrackRecord({ data }) {
  const { outcomes, settings, bench, kb, calibration } = data;
  const [all, setAll] = useState(false);
  const s = summarize(outcomes);
  const pending = kb.filter((k) => k.verdict === "pending").length;
  if (!s.n)
    return (
      <Container className="pt-20">
        <SectionHead eyebrow="Track record" title={<>Scored by <Accent>code.</Accent></>} />
        <Empty title="Nothing scored yet">Picks are scored {settings.scoring.horizon_days} trading days after the run. {pending} waiting.</Empty>
      </Container>
    );
  const rows = [...outcomes].sort((a, b) => b.run_date.localeCompare(a.run_date) || a.ticker.localeCompare(b.ticker));
  const groups = ["bullish", "bearish", "neutral"].flatMap((st) =>
    ["high", "medium", "low"].map((cv) => ({ st, cv, ...summarize(outcomes.filter((o) => o.stance === st && o.conviction === cv)) })),
  ).filter((g) => g.n);

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={`Track record · vs ${bench.symbol}`}
        title={<>Every call, scored by <Accent>code.</Accent></>}
        lede={`Each pick is compared with ${bench.label} over ${settings.scoring.horizon_days} trading days. A flat band of ±${settings.scoring.flat_band_pct}% separates hits from noise. No model is involved in scoring.`}
      />
      <div className="mb-6"><TrustLadder data={data} go={() => {}} compact /></div>
      {data.sample && <p className="mb-6 rounded-2xl border border-dashed border-people/50 px-5 py-4 text-[15px] text-ink-2"><span className="pill mr-3 border-dashed border-people/60 text-people">sample</span>The numbers below are synthetic, to show the format. They do not count toward trust.</p>}
      <Strip
        cells={[
          { value: s.n, label: "scored", desc: `${pending} more waiting for their horizon.` },
          { value: `${fmtNum(s.hitRate, 0)}%`, label: "hit rate", desc: `${s.hits} hits · ${s.flats} flat · ${s.misses} misses.` },
          { value: fmtPct(s.avgExcess, 1), label: "avg excess", tone: s.avgExcess >= 0 ? "accent" : "down", desc: `Mean pick return minus ${bench.symbol}.` },
          { value: s.best ? fmtPct(s.best.excess_pct, 1) : "—", label: `best · ${s.best?.ticker ?? ""}`, tone: "flat", desc: s.worst ? `Worst: ${s.worst.ticker} ${fmtPct(s.worst.excess_pct, 1)}.` : "" },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[19px] font-semibold tracking-[-0.02em]">Excess return per pick</h3>
            <div className="flex gap-4 text-[12.5px] text-ink-2">
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-accent" />hit</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-flat" />flat</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-down" />miss</span>
            </div>
          </div>
          <ExcessChart outcomes={outcomes} />
        </Reveal>
        <Reveal delay={120} className="card p-6 sm:p-8">
          <h3 className="text-[19px] font-semibold tracking-[-0.02em]">Verdict split</h3>
          <Split s={s} />
          {calibration && (
            <p className="mt-8 rounded-2xl border border-line bg-bg/40 px-4 py-3 text-[13.5px] text-ink-2">
              <span className="meta mr-2 text-ink">Calibration</span>
              {{
                informative: "High-conviction picks beat low-conviction ones. Conviction carries information.",
                not_informative: "High conviction does not beat low conviction yet. Treat conviction as noise.",
                insufficient_data: `Not enough scored picks per conviction level (need ${calibration.min_n}) to judge yet.`,
              }[calibration.conviction_verdict]}
            </p>
          )}
          <div className="mt-8 meta mb-3">By stance and conviction</div>
          <div className="grid gap-2">
            {groups.map((g) => (
              <div key={g.st + g.cv} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[13.5px]">
                <span className="flex items-center gap-2"><Chip kind={g.st} className="py-1 text-[11px]" /><Conviction level={g.cv} showLabel={false} /></span>
                <span className="num font-mono text-ink-3">{g.n}×</span>
                <span className="num w-14 text-right font-mono">{fmtNum(g.hitRate, 0)}%</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <Reveal className="card mt-6 overflow-hidden">
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead>
              <tr className="meta border-b border-line text-left">
                {["Run", "Ticker", "Stance", "Conviction", "Pick", "Bench", "Excess", "Verdict"].map((h, i) => (
                  <th key={h} className={`px-5 py-4 font-medium ${i >= 4 && i <= 6 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(all ? rows : rows.slice(0, 15)).map((o) => (
                <tr key={o.pick_id} className="border-b border-line transition-colors last:border-0 hover:bg-ink/[0.03]">
                  <td className="px-5 py-3.5 font-mono text-ink-2">{o.run_date}</td>
                  <td className="px-5 py-3.5 font-semibold">{o.ticker}</td>
                  <td className="px-5 py-3.5"><Chip kind={o.stance} className="py-1 text-[11px]" /></td>
                  <td className="px-5 py-3.5"><Conviction level={o.conviction} /></td>
                  <td className="num px-5 py-3.5 text-right font-mono">{fmtPct(o.return_pct)}</td>
                  <td className="num px-5 py-3.5 text-right font-mono text-ink-3">{fmtPct(o.benchmark_return_pct)}</td>
                  <td className="num px-5 py-3.5 text-right font-mono font-semibold">{fmtPct(o.excess_pct)}</td>
                  <td className="px-5 py-3.5"><Chip kind={o.verdict} className="py-1 text-[11px]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      {rows.length > 15 && (
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>
        </div>
      )}
    </Container>
  );
}

function Split({ s }) {
  const [ref, inView] = useInView();
  const parts = [
    { k: "hit", v: s.hits, c: "bg-accent" },
    { k: "flat", v: s.flats, c: "bg-flat" },
    { k: "miss", v: s.misses, c: "bg-down" },
  ];
  return (
    <div ref={ref}>
      <div className="mt-6 flex h-3.5 gap-0.5 overflow-hidden rounded-md">
        {parts.map((p, i) => (
          <i
            key={p.k}
            className={`block h-full ${p.c} transition-[width] duration-[1400ms] ease-[cubic-bezier(.16,1,.3,1)] first:rounded-l-md last:rounded-r-md`}
            style={{ width: inView ? `${(p.v / s.n) * 100}%` : 0, transitionDelay: `${300 + i * 120}ms` }}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-ink-2">
        {parts.map((p) => (
          <span key={p.k} className="inline-flex items-center gap-1.5"><i className={`size-2 rounded-full ${p.c}`} />{p.k} <b className="num font-mono text-ink">{p.v}</b></span>
        ))}
      </div>
    </div>
  );
}
