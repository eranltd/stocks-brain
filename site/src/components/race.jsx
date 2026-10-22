import { useId, useMemo, useRef } from "react";
import { useReducedMotion } from "../lib/motion.js";
import { monthTicks, niceTicks, scaleLinear, spreadLabels, tickLabel } from "../lib/candles.js";
import { highlights, leaders, lerp, RACE_MS, raceData, raceSummary, tipLabel, toneOf } from "../lib/replay.js";
import { mainListOf } from "../lib/buywindow.js";
import { shortName } from "../lib/simple.js";
import dict from "../text/home.js";
import { Reveal } from "./ui.jsx";
import { monthYear, PlayerControls, PosterPlay, TONE_TEXT, usePlayer, useWidth } from "./replay.jsx";
import { strings } from "../lib/text.js";
import { fmtDate, fmtPct, fmtList } from "../lib/format.js";

/*
 * "The race" on Home's Details view: the main list's indexed lines over the past year (the derived file's published
 * series, re-based to percent from the first day), growing one trading day at a time when the reader presses Play, each
 * coloured line's short name riding at its tip and a leaderboard of the top five so far. The benchmark is a dashed line
 * with its plain name. Only the year's top and bottom movers are in colour (eight; six on a phone), the rest
 * faint, so a phone stays legible. Same player as the Stock page's replay (components/replay.jsx).
 */

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3.5, strokeLinejoin: "round" };
const ROW = 34; // the leaderboard's row pitch in pixels
const SLOTS = 8; // --race-1 … --race-8 in index.css: a categorical palette checked for colour-blind separation

export function MarketRace({ data }) {
  const t = strings(dict);
  const reduced = useReducedMotion();
  const uid = useId();
  const watch = useRef(null);
  const W = Math.max(280, useWidth(watch));
  const race = useMemo(() => raceData(data.market?.symbols, {
    order: mainListOf(data), bench: data.bench?.symbol, name: (x) => shortName(x, data.outlook, data.names),
  }), [data]);
  const player = usePlayer(race?.n ?? 1, { totalMs: RACE_MS, reduced, watch, resetKey: race ? `${race.n}|${race.dates[0]}` : "" });
  const many = W >= 440 ? SLOTS : 6;
  const hl = useMemo(() => (race ? highlights(race, many) : []), [race, many]);
  const colorOf = useMemo(() => Object.fromEntries(hl.map((sym, k) => [sym, `var(--race-${(k % SLOTS) + 1})`])), [hl]);
  if (!race || race.n < 20 || race.lines.length < 2) return null;

  const benchName = (data.bench?.label ?? race.bench?.symbol ?? "").replace(/\s*\(.*\)\s*$/, "") || race.bench?.symbol;
  const k = Math.floor(player.pos + 1e-6);
  const date = race.dates[k];
  const top = leaders(race, k, 5);
  const benchNow = race.bench ? race.bench.values[k] : null;
  const summary = player.ended ? raceSummary(race, benchName) : "";
  const announce = summary || (player.started && !player.playing ? t("race.paused", { date: fmtDate(date) }) : "");
  const words = { play: t("race.play"), resume: t("race.resume"), pause: t("race.pause"), restart: t("race.restart"), speed: t("race.speed"), scrub: t("race.scrub") };
  const faint = race.lines.length - hl.length;
  const half = Math.ceil(hl.length / 2);

  return (
    <Reveal as="section" id="race" aria-labelledby={`${uid}-title`} className="card scroll-mt-28 p-4 sm:p-6">
      <div className="eyebrow mb-2">{t("race.eyebrow")}</div>
      <h2 id={`${uid}-title`} className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("race.title")}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t("race.lede")}</p>

      <div className="mt-5">
        <div className="num text-[clamp(20px,5.6vw,26px)] font-semibold leading-tight text-ink">{fmtDate(date)}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[13.5px] text-ink-3">
          <span>{t("race.day", { i: k + 1, n: race.n })}</span>
          {race.bench && (
            <span>{t("race.benchSoFar", { bench: benchName })}{" "}
              <span className={`num font-mono text-[14px] font-semibold ${TONE_TEXT[toneOf(benchNow)]}`}>{fmtPct(benchNow, 1)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="meta normal-case tracking-[0.04em]">{t("race.leaders")}</h3>
        <ol className="relative mt-2" style={{ height: top.length * ROW - 4 }}>
          {top.map((r, rank) => (
            <li key={r.symbol} className="absolute inset-x-0 top-0 flex h-[30px] items-center gap-3 rounded-xl border border-line px-3"
              style={{ transform: `translateY(${rank * ROW}px)`, transition: reduced ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1)" }}>
              <span className="num w-4 shrink-0 font-mono text-[12.5px] text-ink-3">{rank + 1}</span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf[r.symbol] ?? "var(--ink-3)", opacity: colorOf[r.symbol] ? 1 : 0.5 }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{r.name}</span>
              <span className={`num shrink-0 font-mono text-[13.5px] font-semibold ${TONE_TEXT[toneOf(r.rise)]}`}>{fmtPct(r.rise, 1)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div ref={watch} className="relative mt-3">
        <RaceChart race={race} pos={player.pos} poster={!player.started} W={W} hl={hl} colorOf={colorOf} benchName={benchName}
          label={t("race.aria", { count: race.lines.length, from: fmtDate(race.dates[0]), to: fmtDate(date), leaders: fmtList(top.slice(0, 3).map((r) => r.name)) })} />
        {!player.started && <PosterPlay onClick={player.play} label={words.play} />}
      </div>

      {summary && <p className="mt-4 rounded-2xl border border-line-2 bg-surface-2 px-4 py-3 text-[16px] leading-relaxed text-ink">{summary}</p>}

      <PlayerControls player={player} words={words} reduced={reduced} valueText={fmtDate(date)}
        startLabel={monthYear(race.dates[0])} endLabel={monthYear(race.dates.at(-1))} />

      <p className="sr-only" aria-live="polite">{announce}</p>

      <div className="mt-5 grid gap-1.5 text-[13px] leading-snug text-ink-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {hl.map((sym) => {
            const l = race.lines.find((x) => x.symbol === sym);
            return (
              <span key={sym} className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-4 rounded-full" style={{ background: colorOf[sym] }} aria-hidden="true" />
                <span>{l?.name ?? sym}</span>
              </span>
            );
          })}
        </div>
        <p>{t("race.legendColour", { top: half, bottom: hl.length - half })}</p>
        {race.bench && (
          <p className="flex items-center gap-2">
            <svg width="20" height="8" aria-hidden="true" className="shrink-0"><line x1="1" x2="19" y1="4" y2="4" stroke="var(--ink)" strokeWidth="1.75" strokeDasharray="5 4" /></svg>
            <span>{t("race.legendBench", { bench: benchName })}</span>
          </p>
        )}
        {faint > 0 && (
          <p className="flex items-center gap-2">
            <svg width="20" height="8" aria-hidden="true" className="shrink-0"><line x1="1" x2="19" y1="4" y2="4" stroke="var(--ink-3)" strokeOpacity="0.6" strokeWidth="1.5" /></svg>
            <span>{t("race.legendFaint", { count: faint })}</span>
          </p>
        )}
        <p className="text-[12.5px] text-ink-3">{t("race.axis", { date: fmtDate(race.dates[0]) })}</p>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{t("race.frame")}</p>
      {reduced && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{t("race.reduced")}</p>}
    </Reveal>
  );
}

/**
 * The race's chart. Every line is drawn once for the whole year and revealed up to the frame by a clip (so a frame only
 * moves one rectangle, the tips and their names). Faint lines first, then the dashed benchmark, then the coloured ones.
 */
function RaceChart({ race, pos, poster, W, hl, colorOf, benchName, label }) {
  const clip = `race-clip-${useId().replace(/\W/g, "")}`;
  const narrow = W < 560;
  const L = narrow ? 34 : 46, R = narrow ? 84 : 100, T = 12;
  const PH = narrow ? 250 : 300;
  const H = T + PH + 22;
  const x1 = W - R;
  const hlSet = useMemo(() => new Set(hl), [hl]);

  const geo = useMemo(() => {
    const all = [...race.lines, ...(race.bench ? [race.bench] : [])].flatMap((l) => l.values);
    let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.06 || 1;
    lo -= pad; hi += pad;
    const y = scaleLinear(lo, hi, T + PH, T);
    const x = (i) => L + (i / Math.max(1, race.n - 1)) * (x1 - L);
    const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const { step, ticks } = niceTicks(lo, hi, narrow ? 5 : 6);
    return { x, y, step, ticks, months: monthTicks(race.dates, x, narrow ? 40 : 52), path };
  }, [race, x1, L, PH, narrow]);

  // The drawn lines never change during a replay: build them once per size.
  const lines = useMemo(() => (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      {race.lines.filter((l) => !hlSet.has(l.symbol)).map((l) => (
        <path key={l.symbol} d={geo.path(l.values)} stroke="var(--ink-3)" strokeOpacity="0.4" strokeWidth="1.25" />
      ))}
      {race.bench && <path d={geo.path(race.bench.values)} stroke="var(--ink)" strokeOpacity="0.85" strokeWidth="1.75" strokeDasharray="5 4" />}
      {race.lines.filter((l) => hlSet.has(l.symbol)).map((l) => (
        <path key={l.symbol} d={geo.path(l.values)} stroke={colorOf[l.symbol]} strokeWidth="2.25" />
      ))}
    </g>
  ), [race, geo, hlSet, colorOf]);

  const tipX = geo.x(pos);
  const tipped = [...race.lines.filter((l) => hlSet.has(l.symbol)), ...(race.bench ? [race.bench] : [])];
  const tips = spreadLabels(tipped.map((l) => ({
    id: l.symbol, y: geo.y(lerp(l.values, pos) ?? 0), bench: Boolean(l.bench), color: l.bench ? "var(--ink)" : colorOf[l.symbol],
    text: l.bench ? benchName : tipLabel(l.name, l.symbol, narrow ? 9 : 12),
  })), 13, T + 6, T + PH - 4);

  return (
    <div className="select-none">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label={label} data-pos={pos.toFixed(3)}>
        <defs><clipPath id={clip}><rect x="0" y="0" width={Math.max(0, tipX + 1)} height={H} /></clipPath></defs>
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={x1} y1={Math.round(geo.y(v)) + 0.5} y2={Math.round(geo.y(v)) + 0.5} stroke={v === 0 ? "var(--line-2)" : "var(--line)"} />
            <text x={L - 6} y={geo.y(v) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10.5px]">{tickLabel(v, geo.step)}</text>
          </g>
        ))}
        <g opacity={poster ? 0.32 : 1}>
          <g clipPath={`url(#${clip})`}>{lines}</g>
          {!poster && tips.map((tp) => (
            <g key={tp.id}>
              <circle cx={tipX} cy={tp.y} r={tp.bench ? 3 : 3.75} fill={tp.color} stroke="var(--surface)" strokeWidth="1.5" />
              {Math.abs(tp.ty - tp.y) > 2 && <path d={`M${tipX + 4},${tp.y} L${tipX + 8},${tp.ty}`} stroke={tp.color} strokeOpacity="0.7" fill="none" />}
              <text x={tipX + 10} y={tp.ty + 3.8} className={`text-[11px] ${tp.bench ? "fill-ink-2" : "fill-ink font-medium"}`} style={HALO}>{tp.text}</text>
            </g>
          ))}
        </g>
        <line x1={L} x2={x1} y1={T + PH + 0.5} y2={T + PH + 0.5} stroke="var(--line-2)" />
        {geo.months.map((m) => <text key={m.i} x={m.x} y={H - 5} textAnchor="middle" className="fill-ink-3 font-mono text-[10.5px]">{m.label}</text>)}
      </svg>
    </div>
  );
}
