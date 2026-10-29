import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DAY_MS, SPEEDS, step } from "../../lib/arena.js";
import { fmtDate } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";

/*
 * The Arena's one clock: a position in trading days (0 to n - 1, fractions between days) that every piece on the page
 * follows: the stage of the chosen mode, the paper basket, the orbit and the flow cards. requestAnimationFrame with a
 * time-based step (lib/arena.js step), so the pace is the same at any frame rate and a stalled frame never leaps. The
 * pieces subscribe and draw straight into the DOM, so React does not re-render each frame. It never starts by itself,
 * pauses when the page is hidden or the Arena scrolls off screen, and under reduced motion it jumps to the end.
 */

const t = strings(dict);
const END = 1e-6;

/**
 * {pos (a ref), n, last, playing, started, ended, speed, setSpeed, play, pause, restart, scrub, subscribe, kick}.
 * subscribe(fn): fn(pos, dt) is called every frame while playing, at once when it subscribes (dt = Infinity: draw the
 * state without easing) and after a scrub; it returns true while it still has easing to finish, which keeps frames
 * coming while paused. `watch`: the element whose leaving the screen pauses the replay.
 */
export function useArenaClock({ n, dayMs = DAY_MS, reduced = false, watch = null, resetKey = "" }) {
  const last = Math.max(0, n - 1);
  const pos = useRef(reduced ? last : 0);
  const subs = useRef(new Set());
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const dayMsRef = useRef(dayMs);
  dayMsRef.current = dayMs;
  const raf = useRef(0);
  const prev = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(reduced);
  const [ended, setEnded] = useState(reduced);
  const [speed, setSpeedState] = useState(1);

  const emit = useCallback((dt) => {
    let busy = false;
    for (const fn of subs.current) busy = fn(pos.current, dt) === true || busy;
    return busy;
  }, []);

  const tick = useCallback((now) => {
    const dt = prev.current == null ? 16 : now - prev.current;
    prev.current = now;
    if (playingRef.current) pos.current = step(pos.current, dt, { n, speed: speedRef.current, dayMs: dayMsRef.current });
    const busy = emit(Math.min(dt, 100));
    if (playingRef.current && pos.current >= last - END) {
      playingRef.current = false;
      setPlaying(false);
      setEnded(true);
    }
    if (playingRef.current || busy) raf.current = requestAnimationFrame(tick);
    else { raf.current = 0; prev.current = null; }
  }, [emit, n, last]);

  const kick = useCallback(() => {
    if (!raf.current) { prev.current = null; raf.current = requestAnimationFrame(tick); }
  }, [tick]);

  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; }, []);

  // A new window or data: back to the start (the end under reduced motion), paused.
  useLayoutEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    playingRef.current = false;
    pos.current = reduced ? last : 0;
    setPlaying(false);
    setStarted(reduced);
    setEnded(reduced);
    emit(Infinity);
  }, [resetKey, reduced, last, emit]);

  const pause = useCallback(() => { playingRef.current = false; setPlaying(false); }, []);

  // Hidden tab, or the Arena off screen: pause. Play goes on from there.
  useEffect(() => {
    if (!playing) return undefined;
    const on = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", on);
    const el = watch?.current;
    let io = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) pause(); });
      io.observe(el);
    }
    return () => { document.removeEventListener("visibilitychange", on); io?.disconnect(); };
  }, [playing, watch, pause]);

  const play = useCallback(() => {
    setStarted(true);
    if (reduced || !last) { pos.current = last; setEnded(true); emit(Infinity); return; }
    if (pos.current >= last - END) pos.current = 0;
    setEnded(false);
    playingRef.current = true;
    setPlaying(true);
    kick();
  }, [reduced, last, emit, kick]);
  const restart = useCallback(() => {
    pos.current = 0;
    emit(Infinity);
    play();
  }, [emit, play]);
  const scrub = useCallback((p) => {
    setStarted(true);
    playingRef.current = false;
    setPlaying(false);
    pos.current = Math.max(0, Math.min(last, p));
    setEnded(pos.current >= last - END);
    if (reduced) emit(Infinity);
    else kick();
  }, [last, reduced, emit, kick]);
  const setSpeed = useCallback((s) => { speedRef.current = s; setSpeedState(s); }, []);
  const subscribe = useCallback((fn) => {
    subs.current.add(fn);
    fn(pos.current, Infinity);
    return () => subs.current.delete(fn);
  }, []);

  return { pos, n, last, playing, started, ended, speed, setSpeed, play, pause, restart, scrub, subscribe, kick, emit };
}

/** Run `fn(k, info)` whenever the clock's whole day changes (and once at subscribe). info: {snap, dt, pos}. */
export function useDayTick(clock, fn, deps = []) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let lastK = -1;
    return clock.subscribe((p, dt) => {
      const k = Math.floor(p + END);
      if (k !== lastK || dt === Infinity) {
        lastK = k;
        ref.current(k, { snap: dt === Infinity, dt, pos: p });
      }
      return false;
    });
  }, [clock.subscribe, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const PlayIcon = ({ className = "size-4" }) => <svg viewBox="0 0 20 20" className={className} aria-hidden="true"><path d="M6 4.2v11.6a.8.8 0 0 0 1.2.7l9.4-5.8a.8.8 0 0 0 0-1.4L7.2 3.5A.8.8 0 0 0 6 4.2Z" fill="currentColor" /></svg>;
const PauseIcon = () => <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor" /><rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor" /></svg>;
const RestartIcon = () => <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" /><path d="M4 3.5V7h3.5" /></svg>;

/**
 * Play / pause, restart, speed and a slider to any day, with the day count. The slider and the count follow the clock
 * without re-rendering. `onPlay` (the page's start, with its countdown) replaces the clock's own play.
 */
export function Controls({ clock, dates, onPlay, reduced = false, className = "" }) {
  const slider = useRef(null);
  const count = useRef(null);
  const dateEl = useRef(null);
  useEffect(() => clock.subscribe((p) => {
    const k = Math.floor(p + END);
    const el = slider.current;
    if (el) {
      if (document.activeElement !== el) el.value = String(k);
      el.style.setProperty("--p", `${clock.last ? (p / clock.last) * 100 : 100}%`);
      el.setAttribute("aria-valuetext", dates[k] ? fmtDate(dates[k]) : "");
    }
    if (count.current) count.current.textContent = t("arena.day", { i: k, n: clock.last });
    if (dateEl.current && dates[k]) dateEl.current.textContent = fmtDate(dates[k]);
    return false;
  }), [clock.subscribe, clock.last, dates]); // eslint-disable-line react-hooks/exhaustive-deps
  const resume = clock.started && !clock.ended && !clock.playing;
  return (
    <div className={`arena-controls ${className}`}>
      <div className="flex items-center justify-between gap-3 font-num text-[11px] tracking-[0.06em] text-ink-3 uppercase">
        <span ref={count}>{t("arena.day", { i: 0, n: clock.last })}</span>
        <span ref={dateEl} className="truncate" />
      </div>
      <input ref={slider} type="range" min={0} max={clock.last} step={1} defaultValue={reduced ? clock.last : 0}
        onChange={(e) => clock.scrub(Number(e.target.value))} aria-label={t("arena.c.scrub")} className="scrub arena-scrub" />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button type="button" data-role="arena-play" onClick={clock.playing ? clock.pause : (onPlay ?? clock.play)}
          className="arena-btn arena-btn-main">
          {clock.playing ? <PauseIcon /> : <PlayIcon />}
          {clock.playing ? t("arena.c.pause") : resume ? t("arena.c.resume") : t("arena.c.play")}
        </button>
        <button type="button" onClick={clock.restart} disabled={!clock.started || reduced} className="arena-btn" aria-label={t("arena.c.restart")}>
          <RestartIcon /><span className="hidden sm:inline">{t("arena.c.restart")}</span>
        </button>
        {!reduced && (
          <div role="group" aria-label={t("arena.c.speed")} className="arena-speed ms-auto">
            {SPEEDS.map((x) => (
              <button key={x} type="button" aria-pressed={clock.speed === x} onClick={() => clock.setSpeed(x)}>{`${x}×`}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/**
 * The replay's date as a big ticking counter in the display face ("21 OCT" and the year), the day count and a thin
 * progress line. `big`: the iPad and desktop rail's version; otherwise a compact one for the top of the stage.
 */
export function DateCounter({ clock, dates, big = false, className = "" }) {
  const day = useRef(null), mon = useRef(null), year = useRef(null), count = useRef(null), bar = useRef(null);
  useEffect(() => {
    let lastK = -1;
    return clock.subscribe((p, dt) => {
      const k = Math.floor(p + END);
      if (bar.current) bar.current.style.transform = `scaleX(${clock.last ? (p / clock.last).toFixed(4) : 1})`;
      if (k === lastK || !dates[k] || !day.current) return false;
      lastK = k;
      const d = new Date(`${dates[k]}T00:00:00Z`);
      day.current.textContent = String(d.getUTCDate()).padStart(2, "0");
      mon.current.textContent = MONTH.format(d);
      year.current.textContent = String(d.getUTCFullYear());
      count.current.textContent = t("arena.day", { i: k, n: clock.last });
      if (dt !== Infinity && big && day.current.animate) day.current.animate([{ transform: "translate3d(0,-12%,0)", opacity: 0.5 }, { transform: "none", opacity: 1 }], { duration: 160, easing: "ease-out" });
      return false;
    });
  }, [clock.subscribe, clock.last, dates, big]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`arena-date ${big ? "arena-date-big" : ""} ${className}`} aria-hidden="true">
      <div className="flex items-end gap-2">
        <span className="arena-date-main"><span ref={day} className="inline-block">--</span> <span ref={mon}>---</span></span>
        <span ref={year} className="arena-date-year">----</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <span className="arena-live"><span aria-hidden="true" className="arena-beacon" />{t("arena.live")}</span>
        <span ref={count} className="font-num text-[11px] tracking-[0.06em] text-ink-3 uppercase" />
      </div>
      <span className="arena-progress"><span ref={bar} /></span>
    </div>
  );
}
