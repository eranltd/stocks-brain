import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "../lib/motion.js";
import { pad2 } from "../lib/format.js";
import dict from "../text/learn.js";
import { Accent, Chevron, CodeBlock, Container, Dot, Headline, IconButton, Reveal, SectionHead, Strip } from "../components/ui.jsx";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

const ROUTE = "M70,150 H920 Q940,150 940,170 V390 Q940,410 920,410 H400 Q380,410 380,390 V150";
const BRANCHES = {
  library: "M200,310 C290,310 300,230 380,150",
  dashboard: "M840,150 V48",
};
const LOOP = "M540,410 H400 Q380,410 380,390 V170";

// kind: data | code | ai | people. `on` = which path the station sits on. Each stop's label and description are
// text/learn.js "how.st.<id>.label" and ".text"; kinds are "how.kind.<kind>".
const STATIONS = [
  { id: "watchlist", kind: "data", x: 70, y: 150, lx: 0, ly: -30, glyph: "≡", file: "config/watchlist.json", m: "M1" },
  { id: "fetch", kind: "code", x: 210, y: 150, lx: 0, ly: -30, glyph: "↓", file: "scripts/fetch_prices.py", m: "M2" },
  { id: "library", kind: "data", x: 200, y: 310, lx: 0, ly: 40, glyph: "▤", branch: "library", file: "data/kb/library.json", m: "M1" },
  { id: "packer", kind: "code", x: 380, y: 150, lx: -18, ly: -30, glyph: "◫", file: "scripts/build_pack.py", m: "M3" },
  { id: "brain", kind: "ai", x: 540, y: 150, lx: 0, ly: 42, glyph: "✦", file: "prompts/brain.md", m: "M3" },
  { id: "checker", kind: "code", x: 690, y: 150, lx: 0, ly: 42, glyph: "✓", file: "schemas/ + scripts/lint.py", m: "M1" },
  { id: "runs", kind: "data", x: 840, y: 150, lx: 0, ly: 42, glyph: "◉", file: "runs/run.<date>.json", m: "M1" },
  { id: "dashboard", kind: "code", x: 840, y: 48, lx: 26, ly: 5, anchor: "start", glyph: "▣", branch: "dashboard", file: "site/", m: "M1" },
  { id: "scorer", kind: "code", x: 940, y: 290, lx: -28, ly: 5, anchor: "end", glyph: "±", file: "scripts/score_picks.py", m: "M4" },
  { id: "kb", kind: "data", x: 700, y: 410, lx: 0, ly: 42, glyph: "◎", file: "data/kb/outcomes.json", m: "M4" },
  { id: "you", kind: "people", x: 540, y: 410, lx: 0, ly: 42, glyph: "☺", file: "pull request", m: "you" },
  { id: "rulebook", kind: "data", x: 380, y: 290, lx: 28, ly: 6, anchor: "start", glyph: "❏", file: "docs/", m: "M1" },
];
const KIND = {
  data: { stroke: "var(--accent)", fill: "color-mix(in srgb, var(--accent) 14%, var(--bg))", tone: "accent" },
  code: { stroke: "var(--ink-3)", fill: "var(--bg)", tone: "flat" },
  ai: { stroke: "var(--ai)", fill: "color-mix(in srgb, var(--ai) 16%, var(--bg))", tone: "ai" },
  people: { stroke: "var(--people)", fill: "var(--bg)", tone: "people", dashed: true },
};
const STEP_MS = 2200;

export default function HowItWorks({ data }) {
  return (
    <>
      <Container className="pt-16">
        <Story />
      </Container>
      <Container className="pt-20">
        <MapShowcase />
      </Container>
      <Container className="pt-32">
        <RunIt data={data} />
      </Container>
    </>
  );
}

// The five story steps are text/learn.js "how.story.<n>.head" and ".body".
const STORY = [1, 2, 3, 4, 5];

const t = strings(dict);

/** The whole system in five plain steps, before the detailed map. */
function Story() {
  return (
    <div>
      <SectionHead
        eyebrow={t("how.story.eyebrow")}
        title={<>{t("how.story.title.a")} <Accent>{t("how.story.title.b")}</Accent></>}
        lede={<>
          <span className="block text-ink">{t("how.story.lede1")}</span>
          <span className="mt-3 block">{t("how.story.lede2")}</span>
        </>}
      />
      <Reveal className="card px-2 py-1 sm:p-4">
        <ol className="grid">
          {STORY.map((n, i) => (
            <li key={n} className="flex gap-3 border-b border-line px-2 py-3 last:border-0">
              <span className="num shrink-0 font-mono text-[12.5px] leading-[22px] text-accent">{pad2(i + 1)}</span>
              <span className="text-[15px] leading-snug"><span className="font-semibold text-ink">{t(`how.story.${n}.head`)}.</span> <span className="text-ink-2">{t(`how.story.${n}.body`)}</span></span>
            </li>
          ))}
        </ol>
      </Reveal>
      <Reveal className="card mt-3 border-people/40 p-4 text-[15px] leading-relaxed text-ink-2 sm:p-5">
        <span className="text-people">{t("how.money.head")}</span> {t("how.money.body")}
      </Reveal>
    </div>
  );
}

function MapShowcase() {
  const label = (s) => t(`how.st.${s.id}.label`);
  const reduced = useReducedMotion();
  const [wrapRef, inView] = useInView({ threshold: 0.3 });
  const routeRef = useRef(null);
  const [geo, setGeo] = useState(null); // { total, at: {id: len} }
  const [step, setStep] = useState(reduced ? STATIONS.length - 1 : -1);
  const [playing, setPlaying] = useState(false);
  const [lit, setLit] = useState(0);

  // Where each station sits along the route path.
  useLayoutEffect(() => {
    const p = routeRef.current;
    if (!p) return;
    const total = p.getTotalLength();
    const at = {};
    let prev = 0;
    for (const s of STATIONS) {
      if (s.branch) { at[s.id] = prev; continue; }
      let best = prev, bestD = Infinity;
      for (let l = prev; l <= total; l += 2) {
        const pt = p.getPointAtLength(l);
        const d = (pt.x - s.x) ** 2 + (pt.y - s.y) ** 2;
        if (d < bestD) { bestD = d; best = l; }
        if (bestD < 2 && d > bestD + 400) break;
      }
      at[s.id] = prev = best;
    }
    setGeo({ total, at });
  }, []);

  // Autoplay once on first view.
  useEffect(() => {
    if (inView && !reduced && step === -1) { setStep(0); setPlaying(true); }
  }, [inView, reduced, step]);

  useEffect(() => {
    if (!playing) return;
    if (step >= STATIONS.length - 1) {
      const t = setTimeout(() => { setPlaying(false); }, STEP_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step]);

  // Tween the lit length toward the target. The final step closes the loop to the end of the route.
  const target = !geo || step < 0 ? 0 : step === STATIONS.length - 1 ? geo.total : geo.at[STATIONS[step].id];
  useEffect(() => {
    if (reduced) return setLit(target);
    let raf;
    const from = lit, t0 = performance.now(), dur = 1100;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setLit(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced]);

  const dot = geo && routeRef.current ? routeRef.current.getPointAtLength(Math.max(0, lit)) : { x: 70, y: 150 };
  const reached = (s) => step >= STATIONS.indexOf(s);
  const cur = STATIONS[Math.max(0, step)];
  const counts = Object.keys(KIND).map((k) => ({ k, n: STATIONS.filter((s) => s.kind === k).length }));
  const replay = () => { setLit(0); setStep(0); setPlaying(true); };
  const goTo = (i) => { setPlaying(false); setStep(Math.max(0, Math.min(STATIONS.length - 1, i))); };
  const elapsed = Math.max(0, step) * (STEP_MS / 1000);
  const totalS = (STATIONS.length - 1) * (STEP_MS / 1000);
  const clock = (s) => `${pad2(Math.floor(s / 60))}:${pad2(Math.round(s % 60))}`;

  return (
    <div ref={wrapRef} className="card brackets overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-10">
        <span className="meta flex items-center gap-2"><Dot /> <span>stocks·brain</span> / <span className="text-ink">{t("how.map.title")}</span></span>
        <span className="meta">{t("how.map.stops", { n: STATIONS.length })}</span>
      </div>
      <div className="grid gap-10 p-6 sm:p-10 xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <div className="flex flex-col justify-center">
          <div className="eyebrow mb-6 flex items-center gap-2"><Dot /> {t("how.map.eyebrow")}</div>
          <Headline size="md">{t("how.map.head.a")} <Accent>{t("how.map.head.b")}</Accent></Headline>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
            {rich(t, "how.map.body", {
              a: <span className="text-ink">{t("how.map.a")}</span>,
              b: <span className="text-ink">{t("how.map.b")}</span>,
              c: <span className="text-ink">{t("how.map.c")}</span>,
              n: STATIONS.length,
            })}
          </p>
          <div className="mt-8 inline-flex w-fit flex-wrap gap-x-5 gap-y-2 rounded-3xl border border-line px-6 py-3">
            {counts.map(({ k, n }) => (
              <span key={k} className="inline-flex items-center gap-2 text-[14.5px]">
                <Dot tone={KIND[k].tone} dashed={KIND[k].dashed} /> {t(`how.kind.${k}`)} <span className="num text-ink-3">{n}</span>
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={replay} className="btn btn-primary whitespace-nowrap">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
              {t("how.map.replay")} <span className="num font-mono font-normal opacity-60">· <span>{clock(totalS)}</span></span>
            </button>
            <button type="button" onClick={() => goTo(step < 0 ? 0 : step + 1)} className="btn whitespace-nowrap">{t("how.map.step")}</button>
          </div>
        </div>

        <div className="min-w-0">
          <div className="no-scrollbar -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
            <svg viewBox="0 0 1000 470" className="block h-auto w-full min-w-[680px] md:min-w-0" role="img" aria-label={t("how.map.aria")}>
              <defs>
                <pattern id="dotgrid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--line)" /></pattern>
                <radialGradient id="mapglow" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="var(--glow)" /><stop offset="1" stopColor="transparent" /></radialGradient>
              </defs>
              <rect width="1000" height="470" fill="url(#dotgrid)" />
              <rect width="1000" height="470" fill="url(#mapglow)" />

              {/* base tracks */}
              <path ref={routeRef} d={ROUTE} fill="none" stroke="var(--line-2)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {Object.values(BRANCHES).map((d) => <path key={d} d={d} fill="none" stroke="var(--line-2)" strokeWidth="4" strokeLinecap="round" />)}
              <path d={ROUTE} fill="none" stroke="var(--ink-3)" strokeWidth="4" strokeLinecap="round" strokeDasharray="0.1 34" opacity="0.7" />
              <path d={LOOP} fill="none" stroke="var(--people)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.1 9" style={{ animation: reduced ? "none" : "march 1.2s linear infinite" }} opacity="0.85" />

              {/* lit progress */}
              {geo && (
                <path d={ROUTE} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={`${lit} ${geo.total + 10}`} style={{ filter: "drop-shadow(0 0 6px var(--glow))" }} />
              )}
              {Object.entries(BRANCHES).map(([id, d]) => (
                <path key={id} d={d} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" pathLength="1"
                  strokeDasharray="1 1" strokeDashoffset={reached(STATIONS.find((s) => s.id === id)) ? 0 : 1}
                  style={{ transition: reduced ? "none" : "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)" }} />
              ))}

              {/* stations */}
              {STATIONS.map((s, i) => {
                const k = KIND[s.kind];
                const on = reached(s);
                const active = i === step;
                return (
                  <g key={s.id} onClick={() => goTo(i)} className="cursor-pointer" role="button" aria-label={label(s)}>
                    {active && !reduced && (
                      <circle cx={s.x} cy={s.y} r="18" fill="none" stroke={k.stroke} strokeWidth="2" opacity="0.6">
                        <animate attributeName="r" from="18" to="34" dur="1.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.6" to="0" dur="1.6s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={s.x} cy={s.y} r="18" fill={k.fill} stroke={on ? k.stroke : "var(--line-2)"} strokeWidth="2"
                      strokeDasharray={k.dashed ? "4 4" : undefined}
                      style={{ transition: "stroke 500ms", filter: active ? `drop-shadow(0 0 10px ${k.stroke})` : undefined }} />
                    <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize="14" fill={on ? k.stroke : "var(--ink-3)"} style={{ transition: "fill 500ms" }}>{s.glyph}</text>
                    <text x={s.x + s.lx} y={s.y + s.ly} textAnchor={s.anchor ?? "middle"} fontSize="19" fontWeight="600"
                      fill={on ? "var(--ink)" : "var(--ink-3)"} style={{ transition: "fill 500ms", letterSpacing: "-0.01em" }}>
                      {s.kind === "ai" ? <>{t("how.st.brain.short")} · <tspan fill="var(--ai)">AI</tspan></> : label(s)}
                    </text>
                  </g>
                );
              })}

              {/* travelling dot */}
              {step >= 0 && <circle cx={dot.x} cy={dot.y} r="6" fill="var(--accent)" style={{ filter: "drop-shadow(0 0 8px var(--accent))" }} />}
            </svg>
          </div>

          <div key={cur.id} className="mt-6 grid animate-rise gap-4 rounded-2xl border border-line bg-bg/40 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6">
            <div className="display num text-[56px] leading-[0.85] text-ink-3">{pad2(Math.max(0, step) + 1)}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[19px] font-semibold tracking-[-0.02em]">{label(cur)}</span>
                <span className="pill py-1 text-[11px]" style={{ color: KIND[cur.kind].stroke, borderColor: KIND[cur.kind].stroke, borderStyle: KIND[cur.kind].dashed ? "dashed" : "solid" }}>{t(`how.kind.${cur.kind}`)}</span>
                <span className="pill py-1 text-[11px] text-ink-3">{cur.m === "you" ? t("how.map.people") : cur.m}</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t(`how.st.${cur.id}.text`)}</p>
              <code className="mt-3 inline-block font-mono text-[12.5px] text-accent">{cur.file}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-line px-6 py-5 sm:px-10">
        <IconButton label={t("how.map.prev")} onClick={() => goTo(step - 1)} disabled={step <= 0}><Chevron dir="left" /></IconButton>
        <IconButton label={t("how.map.next")} onClick={() => goTo(step + 1)} disabled={step >= STATIONS.length - 1}><Chevron /></IconButton>
        <div className="flex flex-1 gap-1.5">
          {STATIONS.map((s, i) => (
            <button key={s.id} type="button" aria-label={t("how.map.goTo", { label: label(s) })} onClick={() => goTo(i)} className="group h-6 flex-1">
              <span className={`block h-[3px] rounded-full transition-colors duration-500 ${i <= step ? "bg-ink" : "bg-line-2 group-hover:bg-ink-3"}`} />
            </button>
          ))}
        </div>
        <span className="meta num hidden sm:inline">{clock(elapsed)} / {clock(totalS)}</span>
      </div>
    </div>
  );
}

// Each milestone's label and description are text/learn.js "how.ms.<id>.label" and ".desc".
const MILESTONES = ["M1", "M2", "M3", "M4", "M5"].map((id) => ({ id }));

function RunIt({ data }) {
  const done = 4;
  return (
    <div className="grid gap-12 xl:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div>
        <SectionHead
          eyebrow={t("how.run.eyebrow")}
          title={<>{t("how.run.title.a")} <Accent>{t("how.run.title.b")}</Accent></>}
          lede={t("how.run.lede")}
        />
        <Strip
          cells={[
            { value: MILESTONES.length, label: t("how.run.s.milestones"), desc: t("how.run.s.milestonesDesc") },
            { value: done, label: t("how.run.s.done"), desc: t("how.run.s.doneDesc") },
            { value: t("how.run.s.people"), label: t("how.run.s.choose"), tone: "people", dashed: true, desc: t("how.run.s.chooseDesc") },
          ]}
        />
        <div className="mt-10 grid gap-6">
          <CodeBlock label={t("how.run.cmd.sample")} cmd="python3 scripts/make_sample_data.py" />
          <CodeBlock label={t("how.run.cmd.lint")} cmd="python3 scripts/lint.py" />
          <CodeBlock label={t("how.run.cmd.build")} cmd="python3 scripts/build_site.py" />
          <CodeBlock label={t("how.run.cmd.dev")} cmd="cd site && npm ci && npm run dev" />
        </div>
        <p className="meta mt-8 normal-case tracking-[0.04em]">{t("how.run.repo", { repo: data.manifest.repo })}</p>
      </div>
      <Reveal className="flex items-center justify-center">
        <Ring done={done} />
      </Reveal>
    </div>
  );
}

function Ring({ done }) {
  const R = 150, C = 200;
  const pts = MILESTONES.map((m, i) => {
    const a = -Math.PI / 2 + (i / MILESTONES.length) * Math.PI * 2;
    return { ...m, label: t(`how.ms.${m.id}.label`), desc: t(`how.ms.${m.id}.desc`), x: C + R * Math.cos(a), y: C + R * Math.sin(a), a };
  });
  const arc = (2 * Math.PI * R) * (done / MILESTONES.length);
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[420px] overflow-visible" role="img" aria-label={t("how.ring.aria", { done, total: MILESTONES.length })}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line-2)" strokeWidth="1.5" />
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={`${arc} ${2 * Math.PI * R}`} transform={`rotate(-90 ${C} ${C})`} />
      <text x={C} y={C - 6} textAnchor="middle" className="fill-accent font-mono text-[12px] font-semibold tracking-[0.25em]">{t("how.ring.title")}</text>
      <text x={C} y={C + 18} textAnchor="middle" className="fill-ink-3 font-mono text-[12px] tracking-[0.15em]">M1 → M5</text>
      {pts.map((p, i) => {
        const shipped = i < done;
        const next = i === done;
        const lx = C + (R + 46) * Math.cos(p.a), ly = C + (R + 46) * Math.sin(p.a) + 5;
        return (
          <g key={p.id}>
            <title>{`${p.id} ${p.label}: ${p.desc}`}</title>
            {next && <circle cx={p.x} cy={p.y} r="24" fill="var(--glow)" />}
            <circle cx={p.x} cy={p.y} r="18" fill="var(--bg)"
              stroke={shipped ? "var(--accent)" : next ? "var(--ink)" : "var(--people)"} strokeWidth="1.8" strokeDasharray={shipped || next ? undefined : "3.5 3.5"} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" className="font-mono text-[11px] font-semibold"
              fill={shipped ? "var(--accent)" : next ? "var(--ink)" : "var(--people)"}>{p.id}</text>
            <text x={lx} y={ly} textAnchor={Math.abs(Math.cos(p.a)) < 0.2 ? "middle" : Math.cos(p.a) > 0 ? "start" : "end"} className="fill-ink text-[15px] font-medium">{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
