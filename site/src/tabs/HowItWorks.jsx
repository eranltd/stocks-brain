import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../lib/motion.js";
import { fmtDate, fmtPct } from "../lib/format.js";
import { mainListOf } from "../lib/buywindow.js";
import { stocksEarned } from "../lib/money.js";
import { usableWhy } from "../lib/why.js";
import { REPORTERS, callCounts, deskCalls, freshness, houseLimits } from "../lib/desk.js";
import { dayTimeline, lastByRoutine } from "../lib/routines.js";
import { trustStage } from "../components/trust.jsx";
import { NotAdvice } from "../components/shell.jsx";
import {
  CallChip, Chip, CodeBlock, Connector, Container, InfoTip, MiniBars, MiniSpark, Panel, PipelineStrip, SimBadge, StatTile, Stamp, StepMark,
} from "../components/ui.jsx";
import { DayTrack, PageHero, ReadMore, StopLine, TipText } from "../lib/learnkit.jsx";
import dict from "../text/learn.js";
import home from "../text/home.js";
import { strings } from "../lib/text.js";

/*
 * How it works: one animated flow diagram of the real system. Five data sources on the left (each a small card with a
 * tiny line or bars from the published data) send curved lines, with dots running along them, into the five reporting
 * agents of the Desk (Research, News, Strategy, Execution, Risk); they all report to the Boss, a turning globe of dots,
 * which makes the final paper call. Tap any node for one plain sentence. Then: code keeps score, a weekday's timed jobs
 * on a 24-hour line, the roadmap and, for the builder, the commands. Under reduced motion the dots and the globe stand
 * still. Every number is read from the published files; the calls are worked out by lib/desk.js, as on the Desk.
 */

const t = strings(dict);
const th = strings(home);

/** The sources: kind, line colour, and the agents each one feeds (as lib/desk.js reads them). */
const SOURCES = [
  { id: "prices", kind: "code", color: "var(--race-1)", to: ["research", "strategy", "execution", "risk"] },
  { id: "news", kind: "ai", color: "var(--race-3)", to: ["news"] },
  { id: "filings", kind: "code", color: "var(--race-4)", to: ["news"] },
  { id: "brain", kind: "ai", color: "var(--ai)", to: ["strategy"] },
  { id: "rules", kind: "people", color: "var(--race-5)", to: ["risk"] },
];
const NUM = { research: 1, news: 2, strategy: 3, execution: 4, risk: 5, boss: 6 };
const STEP = { fresh: "done", stale: "wait", missing: "fail" };
const KIND_TEXT = { data: "text-up", code: "text-ink-2", ai: "text-ai", people: "text-people" };
const DAY = 86400000;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/* -------------------------------------------------------------------- model */

/** What the page shows, from the loaded data: the Desk's reports and calls, and each source's little series. */
function useModel(data) {
  return useMemo(() => {
    // As on the Desk (components/desk.jsx): sample files never stand next to live prices.
    const checklist = data.checklist && (!data.checklist.sample || data.sample) ? data.checklist : null;
    const why = usableWhy(data.why, data.livePrices);
    const secNews = data.secNews && !(data.secNews.sample && data.livePrices) ? data.secNews : null;
    const market = data.market;
    const run = data.lastOk ?? null;
    const members = mainListOf(data);
    const household = (data.docs ?? []).find((d) => d.name === "household")?.content ?? null;
    const earned = stocksEarned(data.rulesResult, trustStage(data).stage);
    const limits = houseLimits({ settings: data.settings, checklistCfg: data.checklistCfg, checklist, rulebook: data.rulebook, household, earned });
    const fresh = freshness({ market, checklist, why, secNews, run });
    const calls = deskCalls({ market, checklist, run, members, names: data.names ?? {}, limits, received: fresh.received });

    // Prices: the main list as one equal-weight line (each name's indexed closes, averaged) and its average day move.
    const set = new Set(members);
    const rows = (market?.symbols ?? []).filter((s) => set.has(s.symbol));
    const sparks = rows.map((s) => (s.spark ?? []).map((p) => p.v).filter(isNum)).filter((s) => s.length > 1);
    const n = sparks.length ? Math.min(...sparks.map((s) => s.length)) : 0;
    const line = n ? Array.from({ length: n }, (_, i) => sparks.reduce((a, s) => a + s[s.length - n + i] / s[s.length - n], 0) / sparks.length) : [];
    const days = rows.map((s) => s.change_1d_pct).filter(isNum);
    const avgDay = days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
    // News: notes per market day; SEC: filings per day over the last two weeks (each from its own file's date).
    const perDay = (dates, end, span) => {
      if (!end) return [];
      const count = {};
      for (const d of dates) count[d] = (count[d] ?? 0) + 1;
      const e = Date.parse(`${end}T00:00:00Z`);
      return Array.from({ length: span }, (_, i) => new Date(e - (span - 1 - i) * DAY).toISOString().slice(0, 10))
        .filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() % 6 !== 0).map((d) => count[d] ?? 0);
    };
    const notes = why?.notes ?? [];
    const noteBars = perDay(notes.map((x) => x.market_date ?? why.as_of), why?.as_of, 10);
    const filings = (secNews?.companies ?? []).filter((c) => set.has(c.symbol)).flatMap((c) => (c.filings ?? []).map((f) => f.date));
    const end = secNews?.as_of ?? null;
    const week = end ? new Date(Date.parse(`${end}T00:00:00Z`) - 7 * DAY).toISOString().slice(0, 10) : null;
    const runs = (data.shownRuns ?? []).filter((r) => r.status === "ok");
    const limitCount = [limits.noBorrowing, limits.slotPct, limits.potPct, limits.stopAtrMax, limits.stretchPct, limits.minRR].filter((v) => v != null && v !== false).length;

    return {
      fresh, counts: callCounts(calls), calls: calls.length,
      src: {
        prices: { state: fresh.research.state, date: market?.as_of, line, value: avgDay },
        news: { state: fresh.news.state, date: why?.as_of, bars: noteBars, count: notes.length },
        filings: { state: secNews ? fresh.news.state : "missing", date: end, bars: perDay(filings, end, 14), count: filings.filter((d) => d > week).length },
        brain: { state: fresh.strategy.state, date: run?.date, line: runs.slice(-14).map((r) => r.duration_minutes) },
        rules: { state: "fresh", date: null, count: limitCount },
      },
    };
  }, [data]);
}

/* ------------------------------------------------------------------- layout */

/** The width of a box, kept current. */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A cubic curve between two points, bending along x (wide) or y (tall). Returns its path and a point at t. */
function curve(a, b, tall) {
  const [x1, y1] = a, [x2, y2] = b;
  const c1 = tall ? [x1, y1 + (y2 - y1) * 0.55] : [x1 + (x2 - x1) * 0.55, y1];
  const c2 = tall ? [x2, y2 - (y2 - y1) * 0.55] : [x2 - (x2 - x1) * 0.55, y2];
  const at = (u) => {
    const v = 1 - u;
    return [0, 1].map((k) => v * v * v * a[k] + 3 * v * v * u * c1[k] + 3 * v * u * u * c2[k] + u * u * u * b[k]);
  };
  return { d: `M${x1},${y1} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x2},${y2}`, at };
}

/**
 * Where everything sits, in pixels of the box's own width. Wide: sources in a column on the left, the agents on a dotted
 * column in the middle, the globe on the right. Tall (a phone): the same three tiers from top to bottom.
 */
function layout(w) {
  const tall = w < 720;
  if (!tall) {
    const cardW = Math.round(Math.min(220, Math.max(160, w * 0.2))), cardH = 78, gap = 12;
    const H = SOURCES.length * cardH + (SOURCES.length - 1) * gap;
    const src = SOURCES.map((s, i) => {
      const y = i * (cardH + gap);
      return { ...s, box: { left: 0, top: y, width: cardW, height: cardH }, out: [cardW, y + cardH / 2] };
    });
    const colX = Math.round(cardW + (w - cardW) * 0.36), pillW = 156, pillH = 42;
    const step = (H - 64) / (REPORTERS.length - 1);
    const ag = REPORTERS.map((id, i) => {
      const cy = Math.round(32 + i * step);
      return { id, box: { left: colX - pillW / 2, top: cy - pillH / 2, width: pillW, height: pillH }, in: [colX - pillW / 2, cy], out: [colX + pillW / 2, cy] };
    });
    const right = colX + pillW / 2;
    const R = Math.round(Math.min(112, (w - right) * 0.27, H * 0.27));
    const sx = Math.round(right + (w - right) * 0.6), sy = Math.round(R + 34);
    return { tall, w, H, src, ag, colX, globe: { x: sx, y: sy, r: R }, callBox: { left: sx - 150, top: sy + R + 22, width: 300 } };
  }
  const gap = 6, cardW = (w - gap * 4) / 5, cardH = 70;
  const src = SOURCES.map((s, i) => {
    const x = i * (cardW + gap);
    return { ...s, box: { left: x, top: 0, width: cardW, height: cardH }, out: [x + cardW / 2, cardH] };
  });
  const agY = cardH + 78, nodeW = w / 5, nodeH = 54;
  const ag = REPORTERS.map((id, i) => {
    const cx = (i + 0.5) * nodeW;
    return { id, box: { left: cx - nodeW / 2, top: agY - 11, width: nodeW, height: nodeH }, in: [cx, agY - 8], out: [cx, agY + nodeH - 6] };
  });
  const R = Math.round(Math.min(96, w * 0.27));
  const sy = agY + nodeH + 52 + R;
  const callTop = sy + R + 20;
  return { tall, w, H: callTop + 92, src, ag, rowY: agY, globe: { x: w / 2, y: sy, r: R }, callBox: { left: 0, top: callTop, width: w } };
}

/* ------------------------------------------------------------------- globe */

/** Points spread evenly over a sphere (a Fibonacci lattice), deterministic. */
function spherePoints(n, radius = 1, jitter = 0) {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = g * i;
    const k = radius * (1 + (jitter ? Math.sin(i * 12.9898) * jitter : 0));
    out.push([Math.cos(a) * r * k, y * k, Math.sin(a) * r * k]);
  }
  return out;
}

/**
 * The Boss as a slowly turning globe of dots: a grey shell and an orange core. Drawn once by React, then turned by
 * setting each dot's x and opacity (no re-render). Still under reduced motion or while off screen.
 */
function Globe({ x, y, r, reduced }) {
  const shell = useMemo(() => spherePoints(150), []);
  const core = useMemo(() => spherePoints(70, 0.46, 0.18), []);
  const g = useRef(null);
  useEffect(() => {
    const el = g.current;
    if (!el) return;
    const dots = [...el.querySelectorAll("circle")];
    const pts = [...shell, ...core];
    const draw = (ang) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      for (let i = 0; i < pts.length; i++) {
        const [px, , pz] = pts[i];
        const X = px * c - pz * s, Z = px * s + pz * c;
        dots[i].setAttribute("cx", (x + X * r).toFixed(1));
        dots[i].setAttribute("opacity", (0.18 + 0.82 * ((Z + 1) / 2)).toFixed(2));
      }
    };
    let ang = 0.4;
    draw(ang);
    if (reduced) return;
    let raf = 0, last = 0, seen = true;
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { seen = e.isIntersecting; }) : null;
    io?.observe(el.ownerSVGElement ?? el);
    const tick = (now) => {
      if (seen && now - last > 40) { ang += (now - (last || now)) * 0.00022; draw(ang); last = now; }
      if (!seen) last = 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [shell, core, x, y, r, reduced]);
  return (
    <g aria-hidden="true">
      <circle cx={x} cy={y} r={r * 1.08} fill="none" stroke="var(--line-2)" strokeDasharray="1 5" strokeLinecap="round" />
      <circle cx={x} cy={y} r={r * 0.62} fill="var(--desk)" opacity="0.07" />
      <g ref={g}>
        {shell.map(([, py], i) => <circle key={`s${i}`} cx={x} cy={y + py * r} r={1.6} fill={i % 7 ? "var(--ink-3)" : "var(--race-1)"} />)}
        {core.map(([, py], i) => <circle key={`c${i}`} cx={x} cy={y + py * r} r={2.1} fill="var(--desk)" />)}
      </g>
    </g>
  );
}

/* -------------------------------------------------------------------- flow */

/** A line with dots running along it (standing still under reduced motion). */
function FlowLine({ c, color, i, reduced, width = 1.3, dots = 2 }) {
  return (
    <g>
      <path d={c.d} fill="none" stroke={color} strokeWidth={width} strokeOpacity="0.55" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: dots }, (_, k) => {
        if (reduced) {
          const [px, py] = c.at((k + 1) / (dots + 1));
          return <circle key={k} cx={px} cy={py} r="2.6" fill={color} />;
        }
        const dur = 3.4 + (i % 3) * 0.5;
        return (
          <circle key={k} r="2.6" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
            <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${-((k * dur) / dots + i * 0.41)}s`} path={c.d} />
          </circle>
        );
      })}
    </g>
  );
}

function SystemFlow({ m, picked, onPick }) {
  const reduced = useReducedMotion();
  const [ref, w] = useWidth();
  const L = useMemo(() => (w ? layout(w) : null), [w]);
  const agentOf = L ? Object.fromEntries(L.ag.map((a) => [a.id, a])) : {};
  const total = REPORTERS.length;
  const received = m.fresh.received;
  return (
    <div ref={ref} className="relative w-full" style={{ height: L?.H ?? 520 }}>
      {L && (
        <>
          <svg className="absolute inset-0 overflow-visible" width={L.w} height={L.H} viewBox={`0 0 ${L.w} ${L.H}`} aria-hidden="true">
            {/* the agents' dotted spine, with an orange pulse running down it in order */}
            {L.tall ? (
              <path d={`M0,${L.rowY} H${L.w}`} stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.1 7" />
            ) : (
              <path d={`M${L.colX},4 V${L.H - 4}`} stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.1 7" />
            )}
            <path d={L.tall ? `M${L.ag[0].in[0]},${L.rowY} H${L.ag.at(-1).in[0]}` : `M${L.colX},${L.ag[0].in[1]} V${L.ag.at(-1).in[1]}`}
              className="connector-flow" />
            {/* sources -> agents */}
            {L.src.flatMap((s, si) => s.to.map((id, k) => {
              const a = agentOf[id];
              return <FlowLine key={`${s.id}-${id}`} c={curve(s.out, a.in, L.tall)} color={s.color} i={si * 3 + k} reduced={reduced} />;
            }))}
            {/* agents -> the boss */}
            {L.ag.map((a, i) => {
              const g = L.globe;
              const end = L.tall ? [g.x + (a.out[0] - g.x) * 0.35, g.y - g.r * 0.9] : [g.x - g.r * 0.92, g.y + (a.out[1] - g.y) * 0.32];
              const st = m.fresh[a.id].state;
              return <FlowLine key={`b-${a.id}`} c={curve(a.out, end, L.tall)} color={st === "fresh" ? "var(--desk)" : "var(--ink-3)"} i={i + 7} reduced={reduced} width={1.6} dots={st === "fresh" ? 2 : 1} />;
            })}
            <Globe x={L.globe.x} y={L.globe.y} r={L.globe.r} reduced={reduced} />
          </svg>

          {L.src.map((s) => <SourceCard key={s.id} s={s} d={m.src[s.id]} tall={L.tall} on={picked === s.id} onPick={onPick} />)}
          {L.ag.map((a) => <AgentNode key={a.id} a={a} f={m.fresh[a.id]} tall={L.tall} on={picked === a.id} onPick={onPick} />)}

          <button type="button" onClick={() => onPick("boss")} aria-pressed={picked === "boss"}
            aria-label={`${t("how.agent", { n: NUM.boss })} · ${th("desk.a.boss")}: ${t("how.boss.in", { n: received, total })}`}
            className="group absolute grid place-items-center rounded-full" style={{ left: L.globe.x - 52, top: L.globe.y - 52, width: 104, height: 104 }}>
            <span className={`grid size-[88px] place-items-center rounded-full border bg-surface/85 backdrop-blur-sm transition-colors ${picked === "boss" ? "border-desk glow" : "border-desk/50 group-hover:border-desk"}`}>
              <span className="text-center">
                <span className={`font-num block text-[26px] leading-none font-bold tracking-[-0.04em] ${received === total ? "text-desk text-glow" : "text-wait"}`}>{received}<span className="text-ink-3">/</span>{total}</span>
                <span className="kicker mt-1 block text-[11px]">{th("desk.a.boss")}</span>
              </span>
            </span>
          </button>

          <div className="absolute" style={L.callBox}>
            <p className="micro mb-2 text-center">{t("how.flow.call")}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {["buy", "wait", "reject"].map((c) => (
                <div key={c} className={`tile px-1 py-2 text-center ${m.counts[c] ? "" : "opacity-60"}`}>
                  <span className={`font-num block text-[22px] leading-none font-bold ${m.counts[c] ? { buy: "text-up", wait: "text-wait", reject: "text-down" }[c] : "text-ink-3"}`}>{m.counts[c]}</span>
                  <CallChip call={c} className="mt-1.5 h-6 px-1.5 text-[11.5px] sm:text-[12.5px]" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const SRC_TONE = { prices: "text-[var(--race-1)]", news: "text-[var(--race-3)]", filings: "text-[var(--race-4)]", brain: "text-ai", rules: "text-[var(--race-5)]" };

function srcValue(id, d) {
  if (id === "prices") return d.value != null ? fmtPct(d.value, 2) : "–";
  if (id === "news") return t("how.src.news.value", { count: d.count });
  if (id === "filings") return t("how.src.filings.value", { count: d.count });
  if (id === "brain") return d.date ? t("how.src.brain.value", { date: fmtDate(d.date).replace(/^\w+,\s|\s\d{4}$/g, "") }) : "–";
  return t("how.src.rules.value", { count: d.count });
}

function SourceCard({ s, d, tall, on, onPick }) {
  const live = d.state === "fresh";
  const tone = SRC_TONE[s.id];
  return (
    <button type="button" onClick={() => onPick(s.id)} aria-pressed={on} aria-label={`${t(`how.src.${s.id}`)}: ${srcValue(s.id, d)}`}
      className={`tile absolute flex flex-col overflow-hidden text-start transition-[border-color,background-color] ${on ? "border-desk/70 bg-surface-3" : "hover:border-line-3"} ${tall ? "p-1.5" : "p-2.5"}`}
      style={s.box}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden="true" className="relative inline-flex size-1.5 shrink-0">
          {live && <span className="absolute inset-0 animate-ping rounded-full bg-up opacity-60 motion-reduce:hidden" />}
          <span className={`relative size-1.5 rounded-full ${live ? "bg-up" : d.state === "stale" ? "bg-wait" : "bg-down"}`} />
        </span>
        <span className={`truncate font-display leading-none font-bold uppercase ${tall ? "text-[12px] tracking-[0.04em]" : "text-[14px] tracking-[0.1em]"} ${tone}`}>{t(`how.src.${s.id}`)}</span>
        {!tall && <span className="font-num ms-auto shrink-0 text-[11.5px] font-semibold text-ink-2">{srcValue(s.id, d)}</span>}
      </span>
      <span className="mt-auto block pt-1">
        {d.line?.length > 1 ? <MiniSpark values={d.line} w={120} h={tall ? 24 : 28} area fluid tone={s.id === "brain" ? "brand" : undefined} />
          : d.bars?.length ? <MiniBars values={d.bars} hi={d.bars.length - 1} h={tall ? 22 : 26} />
          : <Segments n={d.count} tall={tall} />}
      </span>
    </button>
  );
}

/** The rules card's mark: one small block per house limit. */
function Segments({ n, tall }) {
  return (
    <span aria-hidden="true" className={`flex items-end gap-[3px] ${tall ? "h-[22px]" : "h-[26px]"}`}>
      {Array.from({ length: n }, (_, i) => <span key={i} className="h-2/3 min-w-[3px] flex-1 rounded-[2px] bg-[var(--race-5)] opacity-60" />)}
    </span>
  );
}

function AgentNode({ a, f, tall, on, onPick }) {
  const label = `${t("how.agent", { n: NUM[a.id] })} · ${th(`desk.a.${a.id}`)}: ${t(`how.state.${f.state}`)}`;
  if (tall) {
    return (
      <button type="button" onClick={() => onPick(a.id)} aria-pressed={on} aria-label={label}
        className="group absolute flex flex-col items-center text-center" style={a.box}>
        <span className={`grid size-[22px] place-items-center rounded-full border-2 bg-surface transition-colors ${on ? "border-desk shadow-[0_0_12px_var(--desk-glow)]" : "border-desk/60 group-hover:border-desk"}`}>
          <StepMark state={STEP[f.state]} className="size-2.5" />
        </span>
        <span className={`font-num mt-1 text-[10px] font-bold ${on ? "text-desk" : "text-ink-3"}`}>{String(NUM[a.id]).padStart(2, "0")}</span>
        <span className={`w-full truncate px-0.5 font-display text-[11px] leading-tight font-bold tracking-[0.04em] uppercase ${on ? "text-desk" : "text-ink"}`}>{th(`desk.a.${a.id}`)}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onPick(a.id)} aria-pressed={on} aria-label={label}
      className={`absolute flex items-center gap-2 rounded-full border bg-surface px-3 transition-[border-color,box-shadow] ${on ? "border-desk shadow-[0_0_18px_-4px_var(--desk-glow)]" : "border-line-3 hover:border-desk/70"}`}
      style={a.box}>
      <span className={`font-num text-[10.5px] font-bold ${on ? "text-desk" : "text-ink-3"}`}>{String(NUM[a.id]).padStart(2, "0")}</span>
      <span className="min-w-0 flex-1 truncate font-display text-[15px] leading-none font-bold tracking-[0.08em] text-ink uppercase">{th(`desk.a.${a.id}`)}</span>
      <StepMark state={STEP[f.state]} label={t(`how.state.${f.state}`)} />
    </button>
  );
}

/** One plain sentence about the picked node, with its kind, freshness and links. */
function Detail({ id, m }) {
  const src = SOURCES.find((s) => s.id === id);
  const feeds = src ? src.to : null;
  const reads = !src && id !== "boss" ? SOURCES.filter((s) => s.to.includes(id)).map((s) => s.id) : null;
  const state = src ? m.src[id].state : id === "boss" ? (m.fresh.received === REPORTERS.length ? "fresh" : "stale") : m.fresh[id].state;
  const date = src ? m.src[id].date : id === "boss" ? m.fresh.marketDate : m.fresh[id].date;
  const kind = src ? src.kind : "code";
  return (
    <div key={id} className="tile grid animate-pop gap-2 p-3.5 motion-reduce:animate-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4" aria-live="polite">
      <div className="min-w-0">
        <p className="kicker flex flex-wrap items-center gap-x-2 gap-y-1">
          {src ? <span className={SRC_TONE[id]}>{t("how.flow.data")}</span> : <span>{t("how.agent", { n: NUM[id] })}</span>}
          <span aria-hidden="true" className="text-ink-3">·</span>
          <span className={KIND_TEXT[kind]}>{t(`how.kind.${kind}`)}</span>
        </p>
        <p className="headline mt-1.5 text-[24px] text-ink">{src ? t(`how.src.${id}`) : th(`desk.a.${id}`)}</p>
        <p className="mt-1 text-[14.5px] leading-snug text-ink-2">{src ? t(`how.src.${id}.tip`) : t(`how.ag.${id}`)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[320px] sm:justify-end">
        {id !== "rules" && (
          <Chip tone="neutral"><StepMark state={STEP[state]} label={t(`how.state.${state}`)} /><span className="text-ink-2">{date ? fmtDate(date).replace(/^\w+,\s|\s\d{4}$/g, "") : t(`how.state.${state}`)}</span></Chip>
        )}
        {(feeds ?? reads)?.map((x) => (
          <Chip key={x} tone="ghost"><span className="text-ink-3">{feeds ? t("how.flow.feeds") : t("how.flow.reads")}</span> {feeds ? th(`desk.a.${x}`) : t(`how.src.${x}`)}</Chip>
        ))}
        {id === "boss" && <Chip tone="brand">{t("how.boss.in", { n: m.fresh.received, total: REPORTERS.length })}</Chip>}
      </div>
    </div>
  );
}

/** "Live · 21 Oct": the market day the flow is about, with a beacon. */
function LiveChip({ date }) {
  return (
    <Chip tone="up">
      <span aria-hidden="true" className="relative inline-flex size-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
        <span className="relative size-1.5 rounded-full bg-current" />
      </span>
      {t("how.flow.live")}{date ? <span className="text-ink-2">· {fmtDate(date).replace(/^\w+,\s|\s\d{4}$/g, "")}</span> : null}
    </Chip>
  );
}

/* -------------------------------------------------------------------- page */

const AFTER = [
  { id: "scorer", kind: "code" },
  { id: "kb", kind: "data" },
  { id: "you", kind: "people" },
  { id: "rulebook", kind: "data" },
];
const MILESTONES = ["M1", "M2", "M3", "M4", "M5"];
const DONE = 4;

export default function HowItWorks({ data, go }) {
  const m = useModel(data);
  const [picked, setPicked] = useState("boss");
  const routines = data.routines?.routines ?? [];
  const stops = useMemo(() => dayTimeline(routines), [routines]);
  const last = useMemo(() => lastByRoutine([...(data.opsLog?.items ?? [])].reverse()), [data.opsLog]);
  const nameOf = useMemo(() => { const n = Object.fromEntries(routines.map((r) => [r.id, r.name])); return (id) => n[id] ?? id; }, [routines]);
  const [stop, setStop] = useState(null);
  const shownStop = stop ?? stops.find((s) => s.ai) ?? stops[0];
  const scored = data.outcomes?.length ?? 0;
  const lessons = data.learnings?.items?.length ?? 0;

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("how.hero1")} line2={t("how.hero2")} sub={t("how.heroSub")}
        chips={<><SimBadge /><Chip tone="neutral"><span className="text-ink-3">{th("desk.a.boss")}</span> <span className="font-num text-ink">{m.fresh.received}/{REPORTERS.length}</span></Chip></>}
        info={<TipText lead={t("how.about.lead")} more={t("how.about.more")} />} />

      <Panel id="how-flow" className="mt-7" hero title={t("how.flow.title")} sub={t("how.flow.sub")} titleSize="md"
        badge={<LiveChip date={m.fresh.marketDate} />}>
        <SystemFlow m={m} picked={picked} onPick={setPicked} />
        <div className="mt-4"><Detail id={picked} m={m} /></div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => go("today")} className="group inline-flex min-h-[44px] items-center gap-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase hover:text-desk">
            {t("how.open.desk")} <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </Panel>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel border border-people/45 bg-people/5 px-4 py-3 sm:px-5">
        <p className="kicker text-people">{t("how.money.kicker")}</p>
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-ink">{t("how.money.line")}</p>
        <InfoTip label={t("how.money.kicker")}>{t("how.money.body")}</InfoTip>
      </div>

      <div className="mt-4 grid gap-4 md:mt-10 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-8">
        <Panel title={t("how.after.title")} sub={t("how.after.sub")} info={t("how.after.info")}>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-x-6">
            {AFTER.map((n, i) => (
              <li key={n.id} className="relative min-w-0">
                <div className="tile relative flex h-full flex-col p-2.5">
                  <span className="flex items-start justify-between gap-1">
                    <span className={`micro mt-1 ${KIND_TEXT[n.kind]}`}>{t(`how.kind.${n.kind}`)}</span>
                    <span className="-my-2.5 -me-2.5"><InfoTip label={t(`how.st.${n.id}`)}>{t(`how.st.${n.id}.tip`)}</InfoTip></span>
                  </span>
                  <span className="headline mt-1 text-[19px] text-ink">{t(`how.st.${n.id}`)}</span>
                  {n.id === "rulebook" && <Stamp kind="rejected" size="sm" rotate={-6} className="mt-2 self-start text-[10px]">{t("how.after.stamp")}</Stamp>}
                </div>
                {i < AFTER.length - 1 && <Connector shape="h" className="top-1/2 left-full hidden h-3 w-6 -translate-y-1/2 sm:block" />}
              </li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile label={t("how.after.kept")} value={data.kb?.length ?? 0} />
            <StatTile label={t("how.after.scored")} value={scored} tone="flat" />
            <StatTile label={t("how.after.lessons")} value={lessons} tone="flat" />
          </div>
        </Panel>

        <Panel title={t("how.day.title")} sub={t("how.day.sub")} info={t("how.day.info")} className="relative">
          <Connector shape="h" className="top-1/2 right-full hidden h-3 w-8 -translate-y-1/2 md:block" />
          <DayTrack stops={stops} last={last} picked={shownStop?.mins} onPick={setStop} nameOf={nameOf} />
          <div className="mt-2 border-t border-line pt-1"><StopLine stop={shownStop} last={last} nameOf={nameOf} /></div>
          <button type="button" onClick={() => go("routines")} className="group mt-1 inline-flex min-h-[44px] items-center gap-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase hover:text-desk">
            {t("how.day.open")} <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </Panel>
      </div>

      <PipelineStrip variant="footer" className="mt-4 md:mt-10" title={t("how.road.title")} label={t("how.road.title")}
        steps={MILESTONES.map((id, i) => ({ id, label: t(`how.ms.${id}.label`), state: i < DONE ? "done" : "wait", stateLabel: t(i < DONE ? "how.ms.done" : "how.ms.next") }))}
        active={MILESTONES[DONE]}
        trail={<span className="font-num text-[11.5px] font-bold tracking-[0.08em] text-ink-2 uppercase"><span className="text-desk">{t("how.road.done", { done: DONE, total: MILESTONES.length })}</span></span>} />

      <Panel className="mt-4" title={t("how.run.title")} sub={t("how.run.sub")} titleSize="xs">
        <ReadMore label={t("how.run.show")} lessLabel={t("how.run.hide")} className="-my-2">
          <div className="grid gap-4 pt-2 pb-2">
            <CodeBlock label={t("how.run.cmd.sample")} cmd="python3 scripts/make_sample_data.py" />
            <CodeBlock label={t("how.run.cmd.lint")} cmd="python3 scripts/lint.py" />
            <CodeBlock label={t("how.run.cmd.build")} cmd="python3 scripts/build_site.py" />
            <CodeBlock label={t("how.run.cmd.dev")} cmd="cd site && npm ci && npm run dev" />
            <p className="micro normal-case tracking-[0.04em]">{t("how.run.repo", { repo: data.manifest.repo })}</p>
          </div>
        </ReadMore>
      </Panel>

      <NotAdvice compact className="mx-auto mt-8 text-center" />
    </Container>
  );
}
