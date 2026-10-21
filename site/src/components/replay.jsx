import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { loadMarketCandles } from "../lib/data.js";
import { useReducedMotion } from "../lib/motion.js";
import { bands, candleGeom, fitDomain, linePath, monthTicks, niceTicks, scaleLinear, tickLabel } from "../lib/candles.js";
import { advance, endSummary, frameAt, MODES, monthsSpanned, REPLAY_MS, replaySeries, sinceWords, SPEEDS } from "../lib/replay.js";
import { Ltr, useLang } from "../lib/lang.jsx";
import dict from "../i18n/stock.js";
import { Reveal, Segmented } from "./ui.jsx";
import { CandleMark } from "./candles.jsx";

/*
 * The replay on a Stock page: the name's real candles of the past six months (or about a year of weeks) appear one at a
 * time from the left, the 20-period average drawing along, with a big date and a running "since April" counter. It
 * never starts by itself, pauses when it scrolls out of view or the tab is hidden, and under reduced motion "Play"
 * simply shows the whole period. The chart is a left-to-right island in both languages; the controls and words follow
 * the page. Numbers are percent from the replay's first close (lib/replay.js), never prices.
 *
 * usePlayer and PlayerControls are shared with the race on Home (components/race.jsx).
 */

const END = 1e-6;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const TONE_TEXT = { accent: "text-accent", down: "text-down", flat: "text-ink" };
const TONE_VAR = { accent: "var(--accent)", down: "var(--down)", flat: "var(--ink-2)" };
const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3, strokeLinejoin: "round" };

/**
 * Playback of n steps with requestAnimationFrame and a time-based step (lib/replay.js advance), so it runs at the same
 * pace at any frame rate. At rest it shows the end (the full chart). `watch` is the element whose leaving the screen
 * pauses it; `resetKey` changing (another name, days or weeks) puts it back at rest.
 */
export function usePlayer(n, { totalMs = REPLAY_MS, reduced = false, watch = null, resetKey = "" } = {}) {
  const last = Math.max(0, n - 1);
  const [pos, setPosState] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const posRef = useRef(last);
  const setPos = useCallback((v) => {
    posRef.current = v;
    setPosState(v);
  }, []);

  useEffect(() => {
    setPlaying(false);
    setStarted(false);
    setPos(last);
  }, [resetKey, last, setPos]);

  // The loop: one step per frame, as long as the time since the last frame (capped, so nothing leaps after a stall).
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0, prev = null;
    const tick = (now) => {
      const dt = prev == null ? 0 : now - prev;
      prev = now;
      const next = advance(posRef.current, dt, { n, speed, totalMs });
      setPos(next);
      if (next >= last - END) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, n, last, totalMs, setPos]);

  // Scrolled (mostly) out of view: pause. The reader presses Play again to go on from there.
  useEffect(() => {
    const el = watch?.current;
    if (!playing || !el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting || e.intersectionRatio < 0.2) setPlaying(false); }, { threshold: [0, 0.2] });
    io.observe(el);
    return () => io.disconnect();
  }, [playing, watch]);

  // The tab or the app goes to the background: pause.
  useEffect(() => {
    if (!playing) return undefined;
    const on = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [playing]);

  const play = () => {
    setStarted(true);
    if (reduced || !last) { setPlaying(false); setPos(last); return; }
    if (!started || posRef.current >= last - END) setPos(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const restart = () => {
    setStarted(true);
    setPos(0);
    setPlaying(!reduced && last > 0);
  };
  const scrub = (i) => {
    setStarted(true);
    setPlaying(false);
    setPos(Math.max(0, Math.min(last, i)));
  };
  const ended = started && !playing && pos >= last - END;
  // Before the first play the full chart shows, even for the one render before a new series' reset runs.
  return { n, last, pos: started ? Math.min(pos, last) : last, playing, started, ended, speed, setSpeed, play, pause, restart, scrub };
}

/** The width of an element, kept current. */
export function useWidth(ref, fallback = 340) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(Math.round(el.getBoundingClientRect().width) || fallback);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return w;
}

const PlayIcon = () => <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="M6 4.2v11.6a.8.8 0 0 0 1.2.7l9.4-5.8a.8.8 0 0 0 0-1.4L7.2 3.5A.8.8 0 0 0 6 4.2Z" fill="currentColor" /></svg>;
const PauseIcon = () => <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor" /><rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor" /></svg>;
const RestartIcon = () => <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" /><path d="M4 3.5V7h3.5" /></svg>;

/** The big Play over the faded full chart, before the first play. */
export function PosterPlay({ onClick, label }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <button type="button" onClick={onClick} data-role="poster-play"
        className="inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-ink px-7 text-[18px] font-semibold text-bg shadow-[0_18px_50px_-12px_rgb(0_0_0/0.7)] transition active:scale-[0.97]">
        <PlayIcon />{label}
      </button>
    </div>
  );
}

/**
 * Play or pause, restart, the speed, and a slider to any step. The slider runs left to right in both languages, like the
 * chart above it; the buttons follow the page. `words` = { play, resume, pause, restart, speed, scrub }.
 */
export function PlayerControls({ player, words, valueText, startLabel, endLabel, reduced = false }) {
  const { pos, playing, started, ended, speed, setSpeed, play, pause, restart, scrub, last } = player;
  const k = Math.floor(pos + END);
  const pct = last ? (k / last) * 100 : 100;
  const resume = started && !ended && !playing && k < last;
  return (
    <div className="mt-3">
      <Ltr>
        <input type="range" min={0} max={last} step={1} value={k} onChange={(e) => scrub(Number(e.target.value))}
          aria-label={words.scrub} aria-valuetext={valueText} className="scrub" style={{ "--p": `${pct}%` }} />
        <div className="flex justify-between gap-3 font-mono text-[11.5px] text-ink-3">
          <span dir="auto">{startLabel}</span>
          <span dir="auto">{endLabel}</span>
        </div>
      </Ltr>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={playing ? pause : play} data-role="play"
          className="inline-flex min-h-[48px] min-w-[120px] items-center justify-center gap-2 rounded-full bg-ink px-5 text-[16px] font-semibold text-bg transition active:scale-[0.97]">
          {playing ? <PauseIcon /> : <PlayIcon />}
          {playing ? words.pause : resume ? words.resume : words.play}
        </button>
        <button type="button" onClick={restart} disabled={!started} data-role="restart"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-line-2 px-4 text-[15px] font-medium text-ink transition hover:border-ink-3 disabled:opacity-40">
          <RestartIcon />{words.restart}
        </button>
        {!reduced && (
          <div className="ms-auto">
            <Segmented label={words.speed} value={String(speed)} onChange={(v) => setSpeed(Number(v))}
              options={SPEEDS.map((x) => ({ value: String(x), label: <span dir="ltr" className="num font-mono">{`${x}×`}</span> }))} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The month and year of a date, short ("Apr 2026" / "אפר׳ 2026"), for the ends of a slider. */
export function monthYear(iso, lang) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/* ------------------------------------------------------------------ the Stock page card */

export function StockReplay({ data, symbol }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  const reduced = useReducedMotion();
  const uid = useId();
  const [state, setState] = useState({ status: "loading", doc: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: "loading", doc: null });
    // The same file as the candles view (kept for the session by lib/data.js), so a second chart costs nothing.
    loadMarketCandles(data.manifest, data.marketId ?? "nasdaq", symbol).then(
      (doc) => live && setState({ status: doc ? "ok" : "none", doc }),
      () => live && setState({ status: "error", doc: null }),
    );
    return () => { live = false; };
  }, [data.manifest, data.marketId, symbol, attempt]);
  const [mode, setMode] = useState("daily");
  const s = useMemo(() => (state.doc ? replaySeries(state.doc, mode) : null), [state.doc, mode]);
  const watch = useRef(null);
  const player = usePlayer(s?.n ?? 1, { totalMs: REPLAY_MS, reduced, watch, resetKey: `${symbol}|${mode}|${s?.dates?.[0] ?? ""}` });
  if (state.status === "none" || (state.status === "ok" && !s && mode === "daily")) return null;

  const f = s ? frameAt(s, player.pos) : null;
  const dateText = !f ? "" : s.weekly ? (f.partial ? t("rp.weekSoFar") : t("rp.weekTo", { date: fmt.date(f.date) })) : fmt.date(f.date);
  const moveText = !f ? "" : f.move == null ? t(`rp.first.${s.mode}`) : t(`rp.move.${s.mode}`, { pct: fmt.pct(f.move, 1) });
  const summary = s && player.ended ? endSummary(s, symbol, lang) : "";
  const announce = summary || (f && player.started && !player.playing ? t("rp.paused", { date: dateText }) : "");
  const words = { play: t("rp.play"), resume: t("rp.resume"), pause: t("rp.pause"), restart: t("rp.restart"), speed: t("rp.speed"), scrub: t(`rp.scrub.${mode}`) };

  return (
    <Reveal as="section" id="replay" aria-labelledby={`${uid}-title`} className="card mt-6 scroll-mt-28 p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow mb-2">{t("rp.eyebrow")}</div>
          <h3 id={`${uid}-title`} className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
            {t(`rp.title.${mode}`, { count: s ? monthsSpanned(s.dates) : mode === "daily" ? 6 : 12 })}
          </h3>
        </div>
        <Segmented label={t("rp.mode")} value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.value, label: t(`rp.mode.${m.value}`) }))} />
      </div>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">{t(`rp.lede.${mode}`)}</p>

      {state.status === "loading" && <p role="status" className="mt-6 text-[14px] text-ink-3">{t("rp.loading")}</p>}
      {state.status === "error" && (
        <div className="mt-6">
          <p className="text-[15px] text-ink-2">{t("rp.error")}</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="pill mt-3 min-h-[40px] text-ink hover:border-ink-3">{t("cdv.retry")}</button>
        </div>
      )}
      {state.status === "ok" && !s && <p className="mt-6 text-[14px] text-ink-3">{t("cdv.noWindow")}</p>}

      {s && f && (
        <>
          {/* Phone: the counter, then the date and that day's move on one line; wider: the date block at the end. */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
            <div className="min-w-0">
              <div className="text-[13.5px] text-ink-3">{sinceWords(s.dates, lang)}</div>
              <div className={`num text-[clamp(36px,10vw,52px)] font-semibold leading-none tracking-[-0.03em] transition-colors duration-200 motion-reduce:transition-none ${TONE_TEXT[f.tone]}`}>
                <bdi>{fmt.pct(f.change, 1)}</bdi>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-col sm:items-end">
              <div className="num text-[clamp(17px,4.6vw,22px)] font-semibold leading-tight text-ink">{dateText}</div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] font-medium transition-colors duration-200 motion-reduce:transition-none ${
                f.moveTone === "accent" ? "border-accent/40 bg-accent/10 text-accent" : f.moveTone === "down" ? "border-down/40 bg-down/10 text-down" : "border-line-2 text-ink-2"}`}>
                <span aria-hidden="true" className="text-[10px]">{f.moveTone === "accent" ? "▲" : f.moveTone === "down" ? "▼" : "◆"}</span>
                {moveText}
              </div>
            </div>
          </div>

          <div ref={watch} className="relative mt-3">
            <ReplayChart s={s} pos={player.pos} poster={!player.started} label={t(`rp.aria.${s.mode}`, { name: symbol, from: fmt.date(s.dates[0]), to: fmt.date(f.date), change: fmt.pct(f.change, 1) })} />
            {!player.started && <PosterPlay onClick={player.play} label={words.play} />}
          </div>

          {summary && <p className="mt-4 rounded-2xl border border-line-2 bg-surface-2 px-4 py-3 text-[16.5px] leading-relaxed text-ink">{summary}</p>}

          <PlayerControls player={player} words={words} reduced={reduced} valueText={dateText}
            startLabel={monthYear(s.dates[0], lang)} endLabel={monthYear(s.dates.at(-1), lang)} />

          <p className="sr-only" aria-live="polite">{announce}</p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-2">
            <span className="inline-flex items-center gap-2">
              <svg width="20" height="10" aria-hidden="true"><path d="M1 8 C7 7, 10 3, 19 2" fill="none" stroke="var(--ai)" strokeWidth="2" strokeLinecap="round" /></svg>
              {t(`rp.avg.${s.mode}`)}
            </span>
            <span className="inline-flex items-center gap-2">
              <svg width="20" height="10" aria-hidden="true"><line x1="1" x2="19" y1="5" y2="5" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
              {t("rp.startLine")}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{t("rp.axis")}</p>
        </>
      )}

      <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{t(`rp.frame.${mode}`)}</p>
      {reduced && s && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{t("rp.reduced")}</p>}
    </Reveal>
  );
}

/**
 * The replay's chart: candles up to the frame (the next one fading in), the 20-period average drawn up to it, a dot and
 * a value tag on the newest close, and a dashed line where the replay started. The scale is the whole period's, so
 * nothing jumps while it plays. Before the first play (`poster`) it shows the full chart, faded under the Play button.
 */
function ReplayChart({ s, pos, poster, label }) {
  const { lang, fmt } = useLang();
  const box = useRef(null);
  const W = Math.max(260, useWidth(box));
  const narrow = W < 560;
  const L = 2, R = narrow ? 50 : 60, T = 14;
  const PH = narrow ? 220 : 300;
  const H = T + PH + 22;
  const x1 = W - R;

  const geo = useMemo(() => {
    const dom = fitDomain({ l: s.l, h: s.h }, s.ma20);
    const y = scaleLinear(dom.lo, dom.hi, T + PH, T);
    const lay = bands(s.n, L, x1);
    const { step, ticks } = niceTicks(dom.lo, dom.hi, narrow ? 5 : 7);
    return {
      y, lay, step, ticks,
      geoms: s.c.map((_, i) => candleGeom(s, i, y, lay)),
      months: monthTicks(s.dates, lay.cx, narrow ? 36 : 46, lang),
    };
  }, [s, x1, PH, narrow, lang]);

  const f = frameAt(s, pos);
  const k = f.i;
  // The whole candles only change when a new day arrives, not on every frame.
  const candles = useMemo(
    () => geo.geoms.slice(0, k + 1).map((g) => <CandleMark key={g.i} g={g} partial={s.partial && g.i === s.n - 1} />),
    [geo, k, s],
  );
  const maPath = useMemo(() => linePath(s.ma20.slice(0, k + 1), geo.lay.cx, geo.y), [geo, k, s]);
  const nextG = f.frac > 0 && k + 1 < s.n ? geo.geoms[k + 1] : null;
  // The average is drawn on toward the next day's point as that candle fades in (a line between two real points).
  let ma = maPath;
  if (nextG && isNum(s.ma20[k]) && isNum(s.ma20[k + 1])) {
    const xm = geo.lay.cx(k) + (geo.lay.cx(k + 1) - geo.lay.cx(k)) * f.frac;
    const ym = geo.y(s.ma20[k] + (s.ma20[k + 1] - s.ma20[k]) * f.frac);
    ma += `L${xm.toFixed(1)},${ym.toFixed(1)}`;
  }
  const headX = geo.lay.cx(k), headY = geo.y(s.c[k]);
  const tagText = fmt.pct(f.change, 1);
  const ticks = geo.ticks.filter((v) => Math.abs(geo.y(v) - headY) >= 13);
  const col = TONE_VAR[f.moveTone];

  return (
    <div ref={box} dir="ltr" className="select-none">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label={label} data-pos={pos.toFixed(3)}>
        {geo.ticks.map((v) => <line key={v} x1={L} x2={x1} y1={Math.round(geo.y(v)) + 0.5} y2={Math.round(geo.y(v)) + 0.5} stroke="var(--line)" />)}
        {ticks.map((v) => <text key={v} x={W - 2} y={geo.y(v) + 3.5} textAnchor="end" className="num fill-ink-3 font-mono text-[10.5px]">{tickLabel(v, geo.step)}</text>)}
        <line x1={L} x2={x1} y1={Math.round(geo.y(0)) + 0.5} y2={Math.round(geo.y(0)) + 0.5} stroke="var(--ink-3)" strokeDasharray="4 3" />

        <g opacity={poster ? 0.32 : 1}>
          {!poster && <line x1={Math.round(headX) + 0.5} x2={Math.round(headX) + 0.5} y1={T - 6} y2={T + PH} stroke="var(--ink-3)" strokeOpacity="0.35" />}
          {candles}
          {nextG && <CandleMark g={nextG} partial={s.partial && nextG.i === s.n - 1} opacity={f.frac} />}
          <path d={ma} fill="none" stroke="var(--ai)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {!poster && (
            <>
              <circle cx={headX} cy={headY} r="4.5" fill={col} stroke="var(--surface)" strokeWidth="2" />
              <line x1={headX + 6} x2={x1 + 3} y1={headY} y2={headY} stroke={col} strokeOpacity="0.45" strokeDasharray="2 3" />
              <rect x={x1 + 3} y={headY - 8.5} width={R - 4} height={17} rx="4" fill="var(--surface-2)" stroke={col} strokeOpacity="0.6" />
              <text x={W - 4} y={headY + 3.8} textAnchor="end" className="num font-mono text-[10.5px] font-semibold" fill="var(--ink)">{tagText}</text>
            </>
          )}
        </g>

        <line x1={L} x2={x1} y1={T + PH + 0.5} y2={T + PH + 0.5} stroke="var(--line-2)" />
        {geo.months.map((m) => <text key={m.i} x={m.x} y={H - 5} textAnchor="middle" className="fill-ink-3 font-mono text-[10.5px]" style={HALO}>{m.label}</text>)}
      </svg>
    </div>
  );
}
