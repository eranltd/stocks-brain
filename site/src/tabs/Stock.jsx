import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fmtNum, fmtPct, fmtShort, cap, signTone } from "../lib/format.js";
import { useInView } from "../lib/motion.js";
import { Accent, ArrowRight, Chip, Container, Conviction, Empty, Headline, Reveal, Segmented, Strip } from "../components/ui.jsx";
import { STAGES, trustStage } from "../components/trust.jsx";
import { STATUS } from "../components/goal.jsx";
import { cardFor, daysUntil, growthWords, inDays, KIND_LABEL, splitWhatsNext, staleness, todayISO } from "../lib/outlook.js";
import { gateReason, rowFor } from "../lib/checklist.js";
import { ChecklistCard, useChecklistView, VerdictPill } from "../components/checklist.jsx";
import { BRIEF_FOOTER, direction, eightChecks, readable, setupState, wherePaper } from "../lib/brief.js";
import { shortName, whenWords } from "../lib/simple.js";

/** Plain-language summary, assembled by code from the computed numbers (no model). */
function plainWords(row, checks, benchSymbol, benchLabel, liveClaims, settings, baseRate) {
  const out = [];
  const pct = (v) => `${Math.abs(v).toFixed(1)}%`;
  if (row.vs_bench_20d_pct != null) {
    out.push(`Over the last month ${row.symbol} ${row.ret_20d_pct >= 0 ? "rose" : "fell"} ${pct(row.ret_20d_pct)}, ${row.vs_bench_20d_pct >= 0 ? "beating" : "trailing"} the ${benchLabel} by ${Math.abs(row.vs_bench_20d_pct).toFixed(1)} points.`);
  } else {
    out.push(`Over the last month ${row.symbol} ${row.ret_20d_pct >= 0 ? "rose" : "fell"} ${pct(row.ret_20d_pct)}.`);
  }
  out.push(row.dist_sma50_pct > 0 ? "It trades above its 50-day average, so the trend is up." : "It trades below its 50-day average, so the trend is weak.");
  if (row.dist_sma50_pct >= settings.setup.stretch_pct) out.push(`It is stretched ${pct(row.dist_sma50_pct)} above that average. Buying this far from the trend often means buying just before a pullback.`);
  else if (row.from_high_pct != null && row.from_high_pct > -2) out.push("It is close to its 1-year high. That alone is not a reason to sell, or to buy.");
  else if (row.from_high_pct != null && row.from_high_pct < -20) out.push(`It sits ${pct(row.from_high_pct)} below its 1-year high. A big fall alone is not a reason to buy.`);
  if (row.symbol !== benchSymbol) {
    const n = checks.filter((c) => c.pass).length;
    out.push(n === 4 ? "All four setup checks pass: a healthy setup, but not a buy signal on its own." : n === 3 ? "Three of four setup checks pass." : n === 2 ? "Only two of four setup checks pass: mixed." : "Most setup checks fail: a name to watch, not to add to.");
    const rate = baseRate?.by_score.find((r) => r.passed === n);
    if (rate?.n) out.push(`In ${baseRate.from.slice(0, 4)}–${baseRate.to.slice(0, 4)}, names with ${n} of 4 went on to ${rate.mean >= 0 ? "beat" : "trail"} the benchmark by ${Math.abs(rate.mean).toFixed(1)} points over the next ${baseRate.horizon_days} days on average (${rate.n} cases).`);
  }
  if (liveClaims) out.push(`${liveClaims} live ${liveClaims === 1 ? "claim" : "claims"} from your sources mention it (unverified, see below).`);
  return out;
}

/** House rules applied to one stock: can the household act on it today? */
function actGate(data, row, checks) {
  const { stage } = trustStage(data);
  const passed = checks.filter((c) => c.pass).length;
  const st = data.longrun?.now.status.find((x) => x.symbol === row.symbol);
  const held = st && (st.status === "kept" || st.status === "added");
  const stretched = row.setup?.stretched ?? !checks.find((c) => c.id === "calm").pass;
  const reasons = [
    { ok: stage >= 2, text: stage >= 2 ? `Trust stage ${stage} (${STAGES[stage].name}) allows small positions` : `Trust stage ${stage} (${STAGES[stage].name}): no money moves yet` },
    { ok: Boolean(held), text: st ? (held ? "The portfolio rule holds it" : `The portfolio rule leaves it out: ${STATUS[st.status].label.toLowerCase()}`) : "The portfolio rule has not run yet" },
    { ok: passed >= 3 && !stretched, text: stretched ? "Stretched above its trend: no new buys" : `${passed} of 4 setup checks pass (need 3)` },
    // House rules, Before acting step 4: the checklist read and a written risk plan with reward-to-risk to TP1 of at least 2.
    gateReason(data.checklist, rowFor(data.checklist, row.symbol), data.checklistCfg, row.last_date),
  ];
  return { ok: reasons.every((r) => r.ok), reasons };
}

const RANGES = [
  { value: 21, label: "1M" },
  { value: 63, label: "3M" },
  { value: 126, label: "6M" },
  { value: 252, label: "1Y" },
];

/** Setup checks v2, computed in Python (derived.json `setup`; docs/methodology.md). Not a recommendation. */
export function setupChecks(row, bench, settings) {
  const s = settings.setup;
  const st = row.setup;
  const c = st?.checks ?? {
    trend: row.dist_sma50_pct > 0, rs_3m: (row.vs_bench_60d_pct ?? 0) > 0, rs_6m: (row.vs_bench_120d_pct ?? 0) > 0, calm: row.dist_sma50_pct < s.stretch_pct,
  };
  return [
    { id: "trend", label: "Trend", pass: c.trend, detail: st ? `${fmtPct(st.dist_sma50_pct, 1)} vs its 50-day, ${fmtPct(st.dist_long_pct, 1)} vs its ${s.trend_long_days}-day average` : `${fmtPct(row.dist_sma50_pct, 1)} vs its 50-day average` },
    { id: "rs_3m", label: `Beats ${bench} · 3 months`, pass: c.rs_3m, detail: `${fmtPct(st?.vs_bench_short_pct ?? row.vs_bench_60d_pct ?? 0, 1)} over ${s.rs_short_days} days` },
    { id: "rs_6m", label: `Beats ${bench} · 6 months`, pass: c.rs_6m, detail: `${fmtPct(st?.vs_bench_long_pct ?? row.vs_bench_120d_pct ?? 0, 1)} over ${s.rs_long_days} days` },
    { id: "calm", label: "Not stretched", pass: c.calm, detail: `${fmtPct(row.dist_sma50_pct, 1)} above the 50-day (limit +${s.stretch_pct}%)${s.veto_stretched ? ". Failing this blocks new buys" : ""}` },
  ];
}

/** Library principles matched to this stock's condition (same tag mechanism as the market brief). */
function stockLessons(row, checks, library) {
  const conds = [
    !checks.find((c) => c.id === "calm").pass && { why: "Stretched above its trend", tags: ["overextension", "mean_reversion"] },
    !checks.find((c) => c.id === "trend").pass && { why: "Below its 50-day average", tags: ["invalidation", "reversal", "breakouts"] },
    checks.find((c) => c.id === "rs_6m").pass && { why: "Leading the benchmark over 6 months", tags: ["momentum", "relative_strength"] },
    !checks.find((c) => c.id === "rs_6m").pass && { why: "Lagging the benchmark over 6 months", tags: ["relative_strength", "stance", "breadth"] },
    row.from_high_pct != null && row.from_high_pct > -2 && { why: "At a 1-year high", tags: ["all_time_highs"] },
    row.from_high_pct != null && row.from_high_pct < -20 && { why: "Far below its high", tags: ["bottoms", "valuation"] },
  ].filter(Boolean);
  const all = (library?.sources ?? []).flatMap((s) => s.principles.map((p) => ({ ...p, source: s })));
  const used = new Set();
  return conds.map((c) => {
    const best = all.filter((p) => !used.has(p.id)).map((p) => ({ p, n: p.tags.filter((t) => c.tags.includes(t)).length }))
      .filter((x) => x.n).sort((a, b) => b.n - a.n || (b.p.source.published ?? "").localeCompare(a.p.source.published ?? ""))[0];
    if (!best) return null;
    used.add(best.p.id);
    return { why: c.why, p: best.p };
  }).filter(Boolean).slice(0, 3);
}

export default function Stock({ data, symbol, go }) {
  const { market, bench, names, kb, observations, library, settings, sample, watchlist } = data;
  // The checklist card's view (Checks or Candles), remembered per device; the brief's "See it on the candles" sets it.
  const [ckView, setCkView] = useChecklistView();
  const row = market.symbols.find((s) => s.symbol === symbol);
  const benchRow = market.symbols.find((s) => s.symbol === bench.symbol);
  if (!row) {
    return (
      <Container className="pt-20">
        <Empty title={`${symbol} is not on the watchlist`}>Add it to config/watchlist.json and it will appear here after the next daily run.</Empty>
      </Container>
    );
  }
  const isBench = symbol === bench.symbol;
  const checks = setupChecks(row, bench.symbol, settings);
  const passed = checks.filter((c) => c.pass).length;
  const aliases = [symbol, ...(watchlist.symbols.find((s) => s.symbol === symbol)?.aliases ?? [])];
  const today = todayISO();
  const claims = (observations?.items ?? []).filter((o) => o.tickers.some((t) => aliases.includes(t))).sort((a, b) => b.as_of.localeCompare(a.as_of));
  const liveClaims = claims.filter((c) => c.expires >= today);
  const picks = kb.filter((k) => k.ticker === symbol);
  const lessons = stockLessons(row, checks, library);
  const others = market.symbols.filter((s) => s.symbol !== bench.symbol);
  const words = plainWords(row, checks, bench.symbol, bench.label, liveClaims.length, settings, market.base_rates);
  const gate = isBench ? null : actGate(data, row, checks);
  const long = data.longrun?.members.find((m) => m.symbol === symbol);
  const goal = settings.goal.annual_return_pct;
  const idx = others.findIndex((s) => s.symbol === symbol);
  const ckRow = rowFor(data.checklist, symbol);
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const seeCandles = () => {
    setCkView("candles");
    requestAnimationFrame(() => jump("checklist"));
  };

  return (
    <Container className="pt-14">
      <Reveal className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => go("watchlist")} className="meta inline-flex items-center gap-2 hover:text-ink">
          <ArrowRight className="size-3.5 rotate-180" /> Watchlist
        </button>
        {!isBench && idx >= 0 && (
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={() => go(`stock/${others[(idx - 1 + others.length) % others.length].symbol}`)} className="pill text-ink-2 hover:text-ink">← {others[(idx - 1 + others.length) % others.length].symbol}</button>
            <button type="button" onClick={() => go(`stock/${others[(idx + 1) % others.length].symbol}`)} className="pill text-ink-2 hover:text-ink">{others[(idx + 1) % others.length].symbol} →</button>
          </span>
        )}
      </Reveal>

      {!isBench && <StockBrief data={data} row={row} symbol={symbol} today={today} jump={jump} seeCandles={data.manifest.candles?.[symbol] ? seeCandles : null} />}

      <div className={`flex flex-wrap items-end justify-between gap-6 ${isBench ? "" : "mt-12"}`}>
        <div className="min-w-0">
          <Reveal className="eyebrow mb-4">{names[symbol]} · {market.provider === "sample" ? "sample prices" : `live · ${market.provider}`} · {fmtDate(row.last_date)}</Reveal>
          <Headline size="xl">{symbol} <span className={TONE_TEXT[signTone(row.change_1d_pct, 2)]}>{fmtPct(row.change_1d_pct, 2)}</span></Headline>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.checklistCfg && (
              <button type="button" onClick={() => jump("checklist")} className="pill min-h-[40px] max-w-full text-ink hover:border-ink-3">
                Checklist {ckRow ? <VerdictPill verdict={ckRow.score.verdict} className="ml-1" /> : null} <span aria-hidden="true">↓</span>
              </button>
            )}
            {!isBench && (
              <button type="button" onClick={() => jump("whats-next")} className="pill min-h-[40px] max-w-full text-ink hover:border-ink-3">
                What's next <span aria-hidden="true">↓</span>
              </button>
            )}
          </div>
        </div>
        {!isBench && (
          <Reveal delay={200} className="card px-6 py-5 text-right">
            <div className="meta">Setup checks</div>
            <div className="display num mt-1 text-[48px] leading-none">{passed}<span className="text-ink-3">/4</span></div>
            <div className="meta mt-2 normal-case tracking-[0.04em]">code, not advice</div>
          </Reveal>
        )}
      </div>

      <ChecklistCard data={data} symbol={symbol} go={go} view={ckView} onView={setCkView} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Reveal className="card p-6 sm:p-8">
          <div className="eyebrow mb-4">In plain words</div>
          <p className="text-[clamp(17px,1.7vw,20px)] leading-relaxed">{words.join(" ")}</p>
          <p className="meta mt-4 normal-case tracking-[0.04em]">Written by code from the numbers below. No model involved.</p>
        </Reveal>
        {gate && (
          <Reveal delay={100} className={`card p-6 sm:p-8 ${gate.ok ? "border-accent/50" : "border-people/40"}`}>
            <div className="eyebrow mb-4">Can we act on this?</div>
            <div className={`display text-[clamp(34px,4vw,48px)] ${gate.ok ? "text-accent" : "text-people"}`}>{gate.ok ? "Within house rules." : "Not yet."}</div>
            <ul className="mt-5 grid gap-2.5 text-[14.5px]">
              {gate.reasons.map((r) => (
                <li key={r.text} className="flex gap-3">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${r.ok ? "bg-accent/15 text-accent" : "bg-people/15 text-people"}`}>{r.ok ? "✓" : "–"}</span>
                  <span className={r.ok ? "" : "text-ink-2"}>{r.text}</span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => go("admin")} className="meta mt-5 inline-flex items-center gap-1 hover:text-ink">House rules <ArrowRight className="size-3.5" /></button>
          </Reveal>
        )}
      </div>

      <div className="mt-6">
        <Strip
          dense
          cells={[
            { value: fmtPct(row.ret_20d_pct, 1), label: "20 days", tone: row.ret_20d_pct >= 0 ? "accent" : "down" },
            ...(isBench ? [] : [{ value: fmtPct(row.vs_bench_20d_pct ?? 0, 1), label: `vs ${bench.symbol}`, tone: (row.vs_bench_20d_pct ?? 0) >= 0 ? "accent" : "down" }]),
            { value: fmtPct(row.ret_60d_pct, 1), label: "60 days", tone: row.ret_60d_pct >= 0 ? "accent" : "down" },
            ...(row.risk ? [{ value: fmtPct(row.risk.max_dd_1y_pct, 0), label: "deepest drop, 1y", tone: "down" }] : []),
            { value: row.from_high_pct != null ? fmtPct(row.from_high_pct, 1) : "—", label: "from 1y high", tone: "flat" },
            ...(row.vol20_pct != null ? [{ value: `${fmtNum(row.vol20_pct, 0)}%`, label: "volatility (ann.)", tone: "flat" }] : []),
          ]}
        />
      </div>

      <Reveal className="card mt-6 p-5 sm:p-8">
        <StockChart row={row} bench={isBench ? null : benchRow} benchSymbol={bench.symbol} picks={sample ? [] : picks} />
      </Reveal>

      {!isBench && <WhatsNext card={cardFor(data.outlook, symbol)} symbol={symbol} today={today} hasFile={Boolean(data.outlook)} />}

      {long && (
        <Reveal className="card mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Against the +{goal}% goal</h3>
            <span className="meta">{fmtDate(data.longrun.from)} to {fmtDate(data.longrun.to)} · hindsight applies</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              [fmtPct(long.cagr_pct, 1), "a year", long.cagr_pct >= goal ? "text-accent" : ""],
              [`${fmtNum(long.hit_goal_12m_pct, 0)}%`, `of 12-month windows at +${goal}% or more`, ""],
              [`${fmtNum(long.loss_12m_pct, 0)}%`, "of 12-month windows lost money", ""],
              [fmtPct(long.worst_12m_pct, 0), "worst 12 months", "text-down"],
              [fmtPct(long.max_dd_pct, 0), "deepest drop from a peak", "text-down"],
              [`${fmtNum(long.held_pct, 0)}%`, "of months held by the rule", ""],
            ].map(([v, l, tone]) => (
              <div key={l}>
                <div className={`display num text-[clamp(26px,3vw,36px)] leading-none ${tone}`}>{v}</div>
                <div className="mt-2 text-[12.5px] leading-snug text-ink-3">{l}</div>
              </div>
            ))}
          </div>
          {row.risk && <p className="mt-5 text-[14px] leading-relaxed text-ink-2">Over the last year it swung {fmtNum(row.risk.vol_1y_pct, 0)}% a year (beta {row.risk.beta_1y ?? "–"} to {bench.symbol}). In a bad month, 1 in 20, a position could lose about <span className="text-down">{fmtPct(row.risk.loss_95_20d_pct, 0)}</span>. Size it so that loss is acceptable.</p>}
        </Reveal>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {!isBench && (
          <Reveal className="card p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Setup checks</h3>
              <span className="meta">{passed} of 4 pass</span>
            </div>
            <p className="mt-1 text-[14px] text-ink-3">Plain rules from the methodology. They describe the setup; they do not make a call.</p>
            <ul className="mt-5 grid gap-3">
              {checks.map((c) => (
                <li key={c.id} className="flex items-center gap-4 rounded-2xl border border-line px-4 py-3.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] ${c.pass ? "bg-accent/15 text-accent" : "bg-down/15 text-down"}`} aria-label={c.pass ? "pass" : "fail"}>{c.pass ? "✓" : "✕"}</span>
                  <div className="min-w-0">
                    <div className="font-semibold">{c.label}</div>
                    <div className="num text-[13.5px] text-ink-3">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
        <Reveal delay={80} className="card p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Lessons in play</h3>
            <button type="button" onClick={() => go("insights")} className="meta inline-flex items-center gap-1 hover:text-ink">Insights <ArrowRight className="size-3.5" /></button>
          </div>
          <p className="mt-1 text-[14px] text-ink-3">Matched to this stock's condition from your library.</p>
          <ol className="mt-5 grid gap-5">
            {lessons.map(({ why, p }) => (
              <li key={p.id} className="border-t border-line pt-5 first:border-0 first:pt-0">
                <div className="meta text-accent">{why}</div>
                <p className="mt-2 text-[15.5px] leading-relaxed">{p.text}</p>
                <div className="meta mt-2 truncate normal-case tracking-[0.04em]" title={p.source.title}>{p.id} · {(p.source.title.match(/\(([^()]*)\)\s*$/) || [, p.source.title])[1]}</div>
              </li>
            ))}
            {!lessons.length && <li className="text-ink-3">No lesson matches this setup yet.</li>}
          </ol>
        </Reveal>
      </div>

      {!isBench && (
        <section className="pt-20">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-3">The brain's call</div>
              <h2 className="display text-[clamp(30px,4.4vw,52px)]">{sample ? <>Calls start with <Accent>M3.</Accent></> : picks.length ? <>{cap(picks[0].stance)}, <Accent>{picks[0].conviction} conviction.</Accent></> : <>No call <Accent>yet.</Accent></>}</h2>
            </div>
            {sample && <span className="pill border-dashed border-people/60 text-people">sample history below</span>}
          </div>
          {sample && (
            <p className="mb-6 max-w-[64ch] text-ink-2">
              The brain is not running yet. When it does, its latest call on {symbol} goes here: stance, thesis, risks and the condition that would prove it wrong, scored by code after {settings.scoring.horizon_days} trading days.
              The history below is <span className="text-ink">sample data</span> so you can see the format.
            </p>
          )}
          {picks.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {picks.slice(0, 4).map((k, i) => (
                <Reveal key={k.id} delay={i * 60} as="article" className={`card p-6 ${sample ? "border-dashed" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="meta">{k.id}</span>
                    <Conviction level={k.conviction} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Chip kind={k.stance} />
                    <Chip kind={k.verdict}>{k.verdict === "pending" ? "pending" : `${k.verdict} ${fmtPct(k.outcome.excess_pct, 1)}`}</Chip>
                  </div>
                  <p className="mt-4 text-[15px] leading-relaxed">{k.thesis}</p>
                  <div className="mt-4 text-[14px] text-ink-2"><span className="meta mr-2">Wrong if</span>{k.invalidation}</div>
                </Reveal>
              ))}
            </div>
          ) : (
            <Empty title="No calls on this name">The brain has not flagged it yet.</Empty>
          )}
        </section>
      )}

      <section className="pt-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-3">From your sources</div>
            <h2 className="display text-[clamp(30px,4.4vw,52px)]">What was said <Accent>about {symbol}.</Accent></h2>
          </div>
          <span className="meta">{liveClaims.length} live · {claims.length - liveClaims.length} expired</span>
        </div>
        {claims.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {claims.map((c) => {
              const expired = c.expires < today;
              return (
                <li key={c.id} className={`card p-6 ${expired ? "border-dashed opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="meta">{c.id} · {c.as_of}</span>
                    <span className={`pill py-1 text-[11px] ${expired ? "text-ink-3" : "border-dashed border-people/60 text-people"}`}>{expired ? "expired" : c.status}</span>
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed">{c.text}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="Nothing yet">No source has made a dated claim about {symbol}.</Empty>
        )}
      </section>

      <p className="meta mt-16 normal-case tracking-[0.04em]">Analysis only, not financial advice. Lines are indexed to 100; the site publishes returns, not raw prices.</p>
    </Container>
  );
}

/* ------------------------------------------------------------------ brief */

const MARK = {
  up: { glyph: "▲", cls: "bg-accent/15 text-accent", label: "leans up" },
  down: { glyph: "▼", cls: "bg-down/15 text-down", label: "leans down" },
  neutral: { glyph: "◆", cls: "bg-surface-2 text-ink-3", label: "neutral" },
};
const BRIEF_TONE = { accent: "text-accent", down: "text-down", flat: "text-ink" };

function BriefHead({ children }) {
  return <h3 className="meta mb-3 text-accent">{children}</h3>;
}

/**
 * "<Company> in short": the household's eight-step checklist in plain words, whether a new paper entry is within the
 * house rules and the plan in whole percents, and what is happening at the company. Wording: lib/brief.js.
 */
function StockBrief({ data, row, symbol, today, jump, seeCandles }) {
  const cfg = data.checklistCfg;
  const ck = data.checklist;
  const ckRow = rowFor(ck, symbol);
  const read = readable(ck, ckRow, row.last_date, { sampleSite: data.sample });
  const reading = read.ok ? ckRow : null;
  const dir = direction(reading);
  const checks = reading ? eightChecks(reading, cfg) : null;
  const where = wherePaper({ row: reading, setup: setupState(row, data.settings.setup.stretch_pct), read, min: cfg?.house_rule?.min_reward_to_risk ?? 2, benchLabel: `the ${data.bench.label.replace(/\s*\(.*\)$/, "")}` });
  const card = cardFor(data.outlook, symbol);
  const name = shortName(symbol, data.outlook, data.names);
  const ne = card?.next_earnings;
  const next = !card ? null : !ne?.date ? "Next results: not announced yet." : ne.date < today ? "New results are out since this was written; the card is due a refresh."
    : `Next results: ${whenWords(ne.date, today)}${ne.confirmed ? "" : " (expected)"}.`;
  return (
    <Reveal as="section" id="brief" aria-label={`${name} in short`} className="card scroll-mt-28 p-6 sm:p-8">
      <div className="eyebrow mb-3">{symbol} · the household's eight-step checklist</div>
      <h2 className="display text-[clamp(32px,7.5vw,52px)] leading-[1.02]">{name} <Accent>in short.</Accent></h2>

      <div className="mt-7">
        <BriefHead>Going up or down?</BriefHead>
        {dir ? (
          <>
            <div className={`display text-[clamp(40px,11vw,60px)] leading-none ${BRIEF_TONE[dir.tone]}`}>{dir.word}</div>
            {dir.summary && <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">{dir.summary}</p>}
            <p className="mt-2 text-[13.5px] text-ink-3">A description of the chart, not a forecast.</p>
            {seeCandles && (
              <button type="button" onClick={seeCandles} className="meta mt-2 inline-flex min-h-[40px] items-center gap-1.5 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
                See it on the candles <span aria-hidden="true">↓</span>
              </button>
            )}
          </>
        ) : (
          <p className="text-[17px] leading-relaxed text-ink-2">{read.why}</p>
        )}
      </div>

      <div className="mt-8">
        <BriefHead>The eight checks</BriefHead>
        {checks ? (
          <ol className="grid gap-2">
            {checks.map((c) => {
              const m = MARK[c.mark] ?? MARK.neutral;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => jump(`checklist-${c.id}`)}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left transition hover:border-ink-3">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] ${m.cls}`} role="img" aria-label={m.label}>{m.glyph}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] leading-snug text-ink">{c.text}</span>
                      {c.note && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{c.note}</span>}
                    </span>
                    <span className="shrink-0 text-ink-3" aria-hidden="true">↓</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <>
            <p className="text-[16px] leading-relaxed text-ink-2">{read.why} The eight checks it reads:</p>
            <ol className="mt-3 grid gap-1.5 text-[15px] text-ink-2">
              {(cfg?.steps ?? []).map((s) => <li key={s.id}>{s.name}</li>)}
            </ol>
          </>
        )}
      </div>

      <div className={`mt-8 rounded-2xl border p-5 ${where.ok ? "border-accent/50" : "border-people/40"}`}>
        <BriefHead>Where to invest (on paper)</BriefHead>
        <div className={`text-[20px] leading-snug font-semibold tracking-[-0.01em] ${where.ok ? "text-accent" : "text-people"}`}>{where.head}.</div>
        {where.ok ? (
          <ul className="mt-3 grid gap-2 text-[16px] leading-relaxed text-ink">
            {where.plan.map((p) => <li key={p} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2 before:bg-ink-3">{p}.</li>)}
          </ul>
        ) : (
          <div className="mt-3 grid gap-2 text-[16px] leading-relaxed">
            <p className="text-ink-2"><span className="text-ink">Why not:</span> {where.why.join("; ")}.</p>
            {where.wait.length > 0 && <p className="text-ink-2"><span className="text-ink">What would change it:</span> {where.wait.join("; ")}.</p>}
          </div>
        )}
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">The house rule: three of the four setup checks pass, the stock is not stretched, and the first target is at least {where.min} times as far as the stop. A paper entry only; the monthly portfolio rule decides what the practice portfolio holds.</p>
      </div>

      <div className="mt-8">
        <BriefHead>What's happening at the company</BriefHead>
        {card ? (
          <>
            <p className="max-w-[62ch] text-[17px] leading-relaxed text-ink">{card.plain ?? card.business}</p>
            {next && <p className="mt-2 text-[15.5px] text-ink-2">{next}</p>}
          </>
        ) : <p className="text-[16px] leading-relaxed text-ink-2">No company card yet; it is researched after each earnings season.</p>}
        <button type="button" onClick={() => jump("whats-next")} className="meta mt-3 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">What's next <span aria-hidden="true">↓</span></button>
      </div>

      <p className="mt-6 border-t border-line pt-4 text-[14px] leading-relaxed text-ink-2">{BRIEF_FOOTER}</p>
    </Reveal>
  );
}

/* ------------------------------------------------------------ what's next */

const ext = { target: "_blank", rel: "noopener noreferrer" };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
const dayOnly = (iso) => fmtDate(iso).replace(/^\w+, /, ""); // "19 Nov 2026"

function Src({ url }) {
  if (!url) return null;
  return <a href={url} {...ext} className="ml-1 whitespace-nowrap text-[12px] text-ink-3 underline decoration-line-2 underline-offset-2 hover:text-ink">{host(url)} ↗</a>;
}

const SubHead = ({ children }) => <div className="meta mb-3 text-accent">{children}</div>;
const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink-2" };

/** Why the card may be out of date, in words: firm only when the company confirmed the date that has passed. */
function staleWords(s) {
  if (!s) return null;
  if (s.kind === "passed" && s.confirmed) return "New results are out since this was written; due for a refresh.";
  if (s.kind === "passed") return `Its expected results date (${dayOnly(s.date)}) has passed; this card may be out of date.`;
  return "Newer results are probably out; this card may be out of date.";
}

/** A list of "what's next" items under a small label. */
function NextList({ label, items }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <div className="meta mb-2 normal-case tracking-[0.04em] text-ink-2">{label}</div>
      <ul className="grid gap-3">
        {items.map((w) => (
          <li key={w.item} className="text-[14.5px] leading-relaxed">
            <div className="meta mb-0.5 normal-case tracking-[0.04em]"><span className="uppercase tracking-[0.14em]">{KIND_LABEL[w.kind] ?? w.kind}</span> · {w.when}</div>
            <span>{w.item}</span><Src url={w.source_url} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The company's own story: the latest quarter, its guidance, what is coming up and what could change it. Paraphrased and linked. */
function WhatsNext({ card, symbol, today, hasFile }) {
  if (!card) {
    return (
      <Reveal id="whats-next" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
        <h3 className="text-[22px] font-semibold tracking-[-0.02em]">What's next</h3>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          {hasFile ? `No outlook card for ${symbol} yet.` : "No outlook file yet."} Cards are researched after each earnings season from the company's own releases and filings: the latest quarter, what the company says about the next one, its next results date and what is coming up, each with a link.
        </p>
      </Reveal>
    );
  }
  const { latest: lt, guidance: g, next_earnings: ne } = card;
  const stale = staleWords(staleness(card, today));
  const groups = splitWhatsNext(card.whats_next, today);
  const days = daysUntil(ne.date, today);
  const growth = growthWords(lt.revenue_growth_yoy_pct);
  return (
    <Reveal id="whats-next" className="card mt-6 scroll-mt-28 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[22px] font-semibold tracking-[-0.02em]">What's next</h3>
        <span className="meta normal-case tracking-[0.04em]">researched {dayOnly(card.as_of)}</span>
      </div>
      {stale && (
        <p className="mt-4 rounded-2xl border border-dashed border-people/60 px-4 py-3 text-[14px] text-people">{stale}</p>
      )}
      <p className="mt-4 max-w-[70ch] text-[15.5px] leading-relaxed text-ink-2">{card.business}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="min-w-0">
          <SubHead>Finance · {lt.period}</SubHead>
          <div className="text-[17px] font-semibold leading-snug">Revenue {lt.revenue}</div>
          <div className="mt-1 text-[13.5px] text-ink-3">{growth ? `${growth} · ` : ""}reported {dayOnly(lt.reported_on)}<Src url={lt.source_url} /></div>
          <ul className="mt-3 grid gap-1.5 text-[14.5px] leading-relaxed text-ink-2">
            {lt.highlights.map((h) => <li key={h} className="relative pl-4 before:absolute before:left-0 before:top-[0.75em] before:h-px before:w-2 before:bg-ink-3">{h}</li>)}
          </ul>
          <div className="mt-4 rounded-2xl border border-line px-4 py-3">
            <div className="meta mb-1">The company's own outlook{g.given && g.period ? ` · ${g.period}` : ""}</div>
            <p className="text-[14.5px] leading-relaxed">{g.given ? g.text : <span className="text-ink-2">{g.text}</span>}<Src url={g.source_url} /></p>
          </div>
        </div>

        <div className="min-w-0">
          <SubHead>Next results and news</SubHead>
          <div className="rounded-2xl border border-line px-4 py-3">
            <div className="meta mb-1">Next results</div>
            {ne.date ? (
              <div className="flex flex-wrap items-center gap-2 text-[15px]">
                <span className="font-semibold">{fmtDate(ne.date)}</span>
                {days != null && <span className="text-ink-3">{inDays(days)}</span>}
                {!ne.confirmed && <span className="pill border-dashed py-0.5 text-[10.5px] text-people">expected</span>}
              </div>
            ) : <div className="text-[15px] text-ink-2">Not announced yet</div>}
            {ne.note && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{ne.note}<Src url={ne.source_url} /></p>}
            {!ne.note && <Src url={ne.source_url} />}
          </div>
          <NextList label="Ahead" items={groups.ahead} />
          <NextList label="Recently" items={groups.recent} />
          <NextList label="Recent news and what's ahead" items={groups.other} />
        </div>

        <div className="min-w-0">
          <SubHead>What could change the story</SubHead>
          {card.watch.length ? (
            <ul className="grid gap-3">
              {card.watch.map((w) => <li key={w.item} className="text-[14.5px] leading-relaxed text-ink-2">{w.item}<Src url={w.source_url} /></li>)}
            </ul>
          ) : <p className="text-[14px] text-ink-3">No risks noted from the company's own filings yet.</p>}
        </div>
      </div>
      <p className="meta mt-6 normal-case tracking-[0.04em]">The company's own statements, paraphrased with links; not a forecast we endorse. No prices, price targets or ratings. A results day can move a stock a lot either way; it is not a signal.</p>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ chart */

function StockChart({ row, bench, benchSymbol, picks }) {
  const [range, setRange] = useState(126);
  const [ref, inView] = useInView();
  const [hover, setHover] = useState(null);
  const svg = useRef(null);
  const box = useRef(null);
  // Draw at real pixel size so axis text stays readable on phones.
  const [W, setW] = useState(1000);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const full = row.series ?? row.spark.map((p) => ({ date: p.date, v: p.v }));
  const maxRange = full.length;
  const n = Math.min(range, maxRange);

  const { pts, bpts, spts, lo, hi, dates } = useMemo(() => {
    const s = full.slice(-n);
    const base = s[0].v;
    const bmap = bench ? Object.fromEntries((bench.series ?? bench.spark).map((p) => [p.date, p.v])) : {};
    const bbase = bench ? bmap[s[0].date] : null;
    const pts = s.map((p) => p.v / base * 100);
    const bpts = bench && bbase ? s.map((p) => (bmap[p.date] != null ? bmap[p.date] / bbase * 100 : null)) : [];
    const spts = s.map((p) => (p.sma50 != null ? p.sma50 / base * 100 : null));
    const all = [...pts, ...bpts.filter((v) => v != null), ...spts.filter((v) => v != null)];
    return { pts, bpts, spts, lo: Math.min(...all), hi: Math.max(...all), dates: s.map((p) => p.date) };
  }, [full, n, bench]);

  const narrowW = W < 640;
  const H = narrowW ? 260 : 400, L = narrowW ? 34 : 48, R = narrowW ? 54 : 68, T = 14, B = 28;
  const x = (i) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R);
  const pad = (hi - lo) * 0.08 || 1;
  const y = (v) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const path = (arr) => arr.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p}`).join("");
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v));
  const up = pts.at(-1) >= 100;
  const color = up ? "var(--accent)" : "var(--down)";
  const markers = picks.map((k) => ({ k, i: dates.indexOf(k.date) })).filter((m) => m.i >= 0);

  const onMove = (e) => {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };
  const h = hover;
  const labelEvery = Math.ceil(pts.length / (narrowW ? 3 : 5));

  return (
    <div ref={ref}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[13px] text-ink-2">
          <span className="inline-flex items-center gap-2"><i className="h-[3px] w-5 rounded" style={{ background: color }} />{row.symbol}</span>
          {bench && <span className="inline-flex items-center gap-2"><i className="w-5 border-t-2 border-dashed border-ink-3" />{benchSymbol}</span>}
          <span className="inline-flex items-center gap-2"><i className="h-px w-5 bg-ink-2" />50-day avg</span>
        </div>
        <Segmented label="Range" value={range} onChange={setRange} options={RANGES.filter((r) => r.value <= Math.max(21, maxRange)).map((r) => ({ ...r }))} />
      </div>
      <div ref={box} className="relative">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y overflow-visible" role="img"
          aria-label={`${row.symbol} over ${n} trading days, indexed to 100${bench ? `, against ${benchSymbol}` : ""}`}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 100 ? "var(--line-2)" : "var(--line)"} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11.5px]">{t}</text>
            </g>
          ))}
          {lo < 100 && hi > 100 && <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} stroke="var(--line-2)" strokeDasharray="2 4" />}
          {dates.map((d, i) => i % labelEvery === 0 && (
            <text key={d} x={Math.max(L + 18, x(i))} y={H - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[11.5px]">{fmtShort(d)}</text>
          ))}
          <path d={path(spts)} fill="none" stroke="var(--ink-2)" strokeWidth="1.2" opacity="0.6" vectorEffect="non-scaling-stroke" />
          {bpts.length > 0 && <path d={path(bpts)} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          <path d={path(pts)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            style={{ opacity: inView ? 1 : 0, transition: "opacity 900ms cubic-bezier(.16,1,.3,1)" }} />
          {/* end labels */}
          <text x={W - R + 8} y={y(pts.at(-1)) + 4} className="font-mono text-[12px] font-semibold" fill={color}>{fmtPct(pts.at(-1) - 100, 1)}</text>
          {bpts.length > 0 && bpts.at(-1) != null && Math.abs(y(bpts.at(-1)) - y(pts.at(-1))) > 14 && (
            <text x={W - R + 8} y={y(bpts.at(-1)) + 4} className="fill-ink-3 font-mono text-[12px]">{fmtPct(bpts.at(-1) - 100, 1)}</text>
          )}
          {markers.map(({ k, i }) => (
            <circle key={k.id} cx={x(i)} cy={y(pts[i])} r="7" stroke="var(--surface)" strokeWidth="2"
              fill={k.stance === "bullish" ? "var(--accent)" : k.stance === "bearish" ? "var(--down)" : "var(--flat)"} />
          ))}
          {h != null && (
            <g>
              <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="var(--line-2)" />
              <circle cx={x(h)} cy={y(pts[h])} r="6" fill={color} stroke="var(--surface)" strokeWidth="2" />
              {bpts[h] != null && <circle cx={x(h)} cy={y(bpts[h])} r="5" fill="var(--ink-3)" stroke="var(--surface)" strokeWidth="2" />}
            </g>
          )}
        </svg>
        {h != null && (
          <div className="pointer-events-none absolute top-0 z-10 min-w-[170px] rounded-xl border border-line-2 bg-surface px-3 py-2 text-[12.5px] shadow-xl"
            style={{ left: `clamp(0px, calc(${(x(h) / W) * 100}% - 85px), calc(100% - 170px))` }}>
            <div className="meta mb-1">{fmtDate(dates[h])}</div>
            <div className="flex justify-between gap-4"><span>{row.symbol}</span><b className="num font-mono">{fmtPct(pts[h] - 100, 1)}</b></div>
            {bpts[h] != null && <div className="flex justify-between gap-4 text-ink-3"><span>{benchSymbol}</span><span className="num font-mono">{fmtPct(bpts[h] - 100, 1)}</span></div>}
          </div>
        )}
      </div>
      {!row.series && <p className="meta mt-3 normal-case tracking-[0.04em]">Showing the last {full.length} days; the full year appears after the next daily run.</p>}
    </div>
  );
}
