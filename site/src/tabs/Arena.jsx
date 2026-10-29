import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "../lib/motion.js";
import { DAY_MS, SPEEDS, WINDOWS, windowed } from "../lib/arena.js";
import { raceData } from "../lib/replay.js";
import { mainListOf } from "../lib/buywindow.js";
import { shortName } from "../lib/simple.js";
import { plainName } from "../lib/why.js";
import { strings } from "../lib/text.js";
import dict from "../text/arena.js";
import { Container, EmptyState, HeroTitle, Panel, Segmented } from "../components/ui.jsx";
import { useInViewNow, usePageVisible } from "../components/motion.jsx";
import { NotAdvice } from "../components/shell.jsx";
import { useDesk } from "../components/desk.jsx";
import { Controls, DateCounter, PauseIcon, PlayIcon, useArenaClock, useDayTick } from "../components/arena/clock.jsx";
import { BarRace } from "../components/arena/race.jsx";
import { Duel } from "../components/arena/duel.jsx";
import { DayHeat, Wall, WALL_DAY_MS } from "../components/arena/wall.jsx";
import { Summary } from "../components/arena/summary.jsx";
import { Basket } from "../components/arena/basket.jsx";
import { OrbitPanel } from "../components/arena/orbit.jsx";
import { AgentPanel } from "../components/arena/agent.jsx";
import { AgentPlan } from "../components/arena/plan.jsx";
import { TradeLog } from "../components/arena/tradelog.jsx";
import { showTrade, useAgentLevel, useAgentStop, useFeedOwner } from "../components/agentfeed.jsx";
import { agentRun, LEVEL_IDS, levelOf, tradesOn } from "../lib/agent.js";

/*
 * THE ARENA: the past year of the main list replayed like a game. One clock (components/arena/clock.jsx) drives every
 * piece: the stage of the chosen mode (a bar race, a duel or a ticker wall of every list), the paper basket and the
 * orbit. Real past data only (the derived files' indexed series), percents and points only, apart from the paper basket's
 * labelled example. It plays by itself and loops: at the end it holds on the result for a moment, then starts again.
 * Pause, the slider or a speed stop the loop until Play is pressed again. Under reduced motion it shows the end at once.
 * Past moves do not tell what comes next, and the page says so.
 */

const t = strings(dict);
const MODES = ["race", "duel", "wall"];
const COUNT = [3, 2, 1, "go"];
const COUNT_MS = 430;
const LOOP_HOLD_MS = 5000;

const ModeIcon = ({ mode }) => (
  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    {mode === "race" && <><path d="M3 5h11M3 10h7M3 15h13" /></>}
    {mode === "duel" && <><path d="M3 14 8 9l3 3 6-7" /><path d="M3 16l5-3 4 1 5-4" opacity=".55" /></>}
    {mode === "wall" && <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></>}
  </svg>
);

/** The Arena page; `embedded` on Home: a short headline, so the replay starts on the first screen. */
export default function Arena({ data, go, embedded = false }) {
  const reduced = useReducedMotion();
  const desk = useDesk(data);
  const race = useMemo(() => raceData(data.market?.symbols, {
    order: mainListOf(data), bench: data.bench?.symbol, name: (x) => shortName(x, data.outlook, data.names),
  }), [data]);
  const [win, setWin] = useState("1y");
  const [mode, setMode] = useState("race");
  const [pair, setPair] = useState(null);
  const w = useMemo(() => (race ? windowed(race, WINDOWS.find((x) => x.id === win)?.days ?? 252) : null), [race, win]);
  const benchName = plainName(data.bench?.label ?? race?.bench?.symbol ?? "");
  const watch = useRef(null);
  const stage = useRef(null);
  const clock = useArenaClock({ n: w?.n ?? 1, dayMs: mode === "wall" ? WALL_DAY_MS : DAY_MS, reduced, watch, resetKey: `${win}|${w?.dates?.[0] ?? ""}` });
  const [count, setCount] = useState(null);
  // The loop: on until the reader takes over (pause or the slider); Play turns it back on.
  const [auto, setAuto] = useState(true);
  const [stopped, setStopped] = useAgentStop();
  const [seenEnd, setSeenEnd] = useState(reduced);
  const onScreen = useInViewNow(watch, "0px");
  const visible = usePageVisible();
  const looping = auto && !stopped && onScreen && visible && !reduced && count == null && (w?.n ?? 0) > 1;
  const { playing, ended, play, restart } = clock;
  useEffect(() => {
    if (!looping) return undefined;
    if (ended) { const id = setTimeout(restart, LOOP_HOLD_MS); return () => clearTimeout(id); }
    if (!playing) play();
    return undefined;
  }, [looping, playing, ended, play, restart]);
  useEffect(() => { if (ended) setSeenEnd(true); }, [ended]);
  // STOP pauses the replay; Start lets the loop run again.
  useEffect(() => { if (stopped) clock.pause(); }, [stopped]); // eslint-disable-line react-hooks/exhaustive-deps

  // The demo trader agent plays along: its trades of each replayed day pop up at the top (components/agentfeed.jsx).
  const [level, setLevel] = useAgentLevel();
  const [logOpen, setLogOpen] = useState(false);
  const closeLog = useCallback(() => setLogOpen(false), []);
  const run = useMemo(() => (w ? agentRun(w, levelOf(level)) : null), [w, level]);
  useFeedOwner(playing);
  const playingNow = useRef(false);
  playingNow.current = playing;
  useDayTick(clock, (k, { snap }) => {
    if (snap || !playingNow.current || !run) return;
    for (const x of tradesOn(run, k)) showTrade({ ...x, date: w.dates[k] });
  }, [run, w]);
  useEffect(() => { setSeenEnd(reduced); }, [win, reduced]);
  // While the dock shows, the trade pop-ups sit below it.
  const docked = onScreen && !reduced && !stopped;
  useEffect(() => {
    document.documentElement.classList.toggle("has-dock", docked);
    return () => document.documentElement.classList.remove("has-dock");
  }, [docked]);
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);
  useEffect(() => { clearTimers(); setCount(null); }, [win]);

  // Play: from the start (or the end) a short 3-2-1 first; from a pause, straight on.
  const start = useCallback(() => {
    setAuto(true);
    const el = stage.current;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 60 || r.top > window.innerHeight * 0.45) el.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
    if (clock.playing || count != null) return;
    const fresh = !clock.started || clock.ended || clock.pos.current <= 1e-6;
    if (reduced || !fresh) { clock.play(); return; }
    clock.scrub(0);
    clearTimers();
    COUNT.forEach((c, i) => timers.current.push(setTimeout(() => setCount(c), i * COUNT_MS)));
    timers.current.push(setTimeout(() => { setCount(null); clock.play(); }, COUNT.length * COUNT_MS - 120));
  }, [clock, count, reduced]);

  if (!w || w.n < 20 || w.lines.length < 2) {
    return (
      <Container className="pt-10 pb-6">
        <HeroTitle eyebrow={t("arena.kicker")} line1={t("arena.hero1")} line2={t("arena.hero2")} />
        <EmptyState className="mt-8" title={t("arena.none")}>{t("arena.noneBody")}</EmptyState>
      </Container>
    );
  }

  const ready = !clock.started && count == null && !reduced && !auto;
  // The corner dock: play or pause and the speed, always at hand while the Arena is on screen.
  const resume = () => { setAuto(true); if (!clock.playing) clock.play(); };
  const nextSpeed = () => clock.setSpeed(SPEEDS[(SPEEDS.indexOf(clock.speed) + 1) % SPEEDS.length]);
  const nextLevel = () => setLevel(LEVEL_IDS[(LEVEL_IDS.indexOf(level) + 1) % LEVEL_IDS.length]);
  // The controls stop the loop when the reader pauses or drags the slider.
  const controls = { ...clock, pause: () => { setAuto(false); clock.pause(); }, scrub: (p) => { setAuto(false); clock.scrub(p); },
    restart: () => { setAuto(true); clock.restart(); } };
  const modeTitle = t(`arena.${mode === "race" ? "race" : mode === "duel" ? "duel" : "wall"}.title`);

  return (
    <div ref={watch} className="arena pb-6">
      {docked && createPortal(
        <div className="arena-dock" role="group" aria-label={t("arena.dock")}>
          <button type="button" className="arena-dock-play" data-on={clock.playing ? "1" : "0"} onClick={clock.playing ? controls.pause : resume}
            aria-label={clock.playing ? t("arena.c.pause") : t("arena.c.play")}>
            {clock.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span className="arena-dock-speeds">
            {SPEEDS.map((x) => (
              <button key={x} type="button" aria-pressed={clock.speed === x} onClick={() => clock.setSpeed(x)}>{`${x}×`}</button>
            ))}
          </span>
          <button type="button" className="arena-dock-cycle" onClick={nextSpeed} aria-label={t("arena.c.speed")}>{`${clock.speed}×`}</button>
          <span className="arena-dock-sep" aria-hidden="true" />
          <span className="arena-dock-levels" role="group" aria-label={t("agent.level")}>
            {LEVEL_IDS.map((x) => (
              <button key={x} type="button" data-level={x} aria-pressed={level === x} onClick={() => setLevel(x)} title={t(`agent.level.say.${x}`)}>{t(`agent.level.${x}`)}</button>
            ))}
          </span>
          <button type="button" className="arena-dock-level" data-level={level} onClick={nextLevel} aria-label={`${t("agent.level")}: ${t(`agent.level.${level}`)}`}>
            {t(`agent.level.short.${level}`)}
          </button>
          <span className="arena-dock-sep" aria-hidden="true" />
          <button type="button" className="arena-dock-log" onClick={() => setLogOpen(true)} aria-label={t("log.open")}>
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M7 5h9M7 10h9M7 15h9M3.5 5h.01M3.5 10h.01M3.5 15h.01" /></svg>
            <span className="max-sm:hidden">{t("log.title")}</span>
          </button>
          <button type="button" className="arena-dock-stop" onClick={() => { setAuto(false); setStopped(true); }} aria-label={t("agent.stopAria")}>
            <span aria-hidden="true" className="arena-dock-stop-sq" />{t("agent.stop")}
          </button>
        </div>,
        document.body,
      )}
      {stopped && onScreen && !reduced && createPortal(
        <button type="button" className="arena-start" onClick={() => { setStopped(false); setAuto(true); }} aria-label={t("agent.startAria")}>
          <PlayIcon className="size-3.5" />{t("agent.start")}
        </button>,
        document.body,
      )}
      <Container className={embedded ? "pt-5 sm:pt-6" : "pt-8 sm:pt-12"}>
        <header className="arena-hero relative">
          <HeroTitle eyebrow={t(embedded ? "agent.home.kicker" : "arena.kicker")} line1={t(embedded ? "agent.home.hero1" : "arena.hero1")}
            line2={t(embedded ? "agent.home.hero2" : "arena.hero2")} size={embedded ? "sm" : "lg"}
            sub={embedded ? null : t("arena.sub", { names: w.lines.length, days: w.days })} />
          <div className={`mt-6 flex-wrap items-center gap-x-4 gap-y-3 ${embedded ? "hidden" : "flex"}`}>
            {auto && !reduced ? (
              <span className="arena-auto" data-role="arena-hero-play"><span className="agent-live-dot" aria-hidden="true" />{t("arena.auto")}</span>
            ) : (
              <button type="button" onClick={start} data-role="arena-hero-play" aria-label={t("arena.playAria")} className="arena-play">
                <span className="arena-play-icon"><PlayIcon className="size-5" /></span>{t("arena.play")}
              </button>
            )}
            <p className="arena-frame">{t("arena.frame")}</p>
          </div>
        </header>

        <div className={`${embedded ? "mt-5" : "mt-8"} flex flex-wrap items-center justify-between gap-2`}>
          <Segmented label={t("arena.mode")} value={mode} onChange={setMode} tall
            options={MODES.map((m) => ({ value: m, label: <span className="flex items-center gap-2"><ModeIcon mode={m} />{t(`arena.mode.${m}`)}</span> }))} />
          <Segmented label={t("arena.window")} value={win} onChange={setWin}
            options={WINDOWS.map((x) => ({ value: x.id, label: <span className="font-num tracking-normal">{t(`arena.win.${x.id}`)}</span> }))} />
        </div>

        {run && <AgentPlan race={w} run={run} clock={clock} go={go} className="mt-3" />}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div ref={stage} className="min-w-0 scroll-mt-[64px]">
            <Panel title={modeTitle} info={t(`arena.${mode === "race" ? "race" : mode === "duel" ? "duel" : "wall"}.info`)}
              badge={<span className="hidden font-num text-[11px] tracking-[0.08em] text-ink-3 uppercase sm:inline">{t(`arena.win.${win}`)}</span>}>
              <DateCounter clock={clock} dates={w.dates} className="mb-3 lg:hidden" />
              <div className="relative">
                {mode === "race" && <BarRace race={w} clock={clock} benchName={benchName} reduced={reduced} />}
                {mode === "duel" && <Duel race={w} clock={clock} pair={pair} setPair={setPair} reduced={reduced} />}
                {mode === "wall" && <Wall data={data} race={w} clock={clock} go={go} reduced={reduced} />}
                {(ready || count != null) && (
                  <div className="arena-ready">
                    {count == null ? (
                      <button type="button" onClick={start} className="arena-ready-btn">
                        <span className="arena-ready-word">{t("arena.ready")}</span>
                        <span className="arena-play arena-play-sm"><span className="arena-play-icon"><PlayIcon className="size-4" /></span>{t("arena.play")}</span>
                      </button>
                    ) : (
                      <span key={String(count)} className="arena-count" aria-live="assertive">{count === "go" ? t("arena.go") : count}</span>
                    )}
                  </div>
                )}
              </div>
              <Controls clock={controls} dates={w.dates} onPlay={start} reduced={reduced} className="mt-4" />
            </Panel>
          </div>
          <aside className="grid content-start gap-4">
            <div className="panel hidden p-5 lg:block"><DateCounter clock={clock} dates={w.dates} big /></div>
            {run && <AgentPanel race={w} run={run} clock={clock} go={go} onLog={() => setLogOpen(true)} />}
            <Basket race={w} clock={clock} benchName={benchName} />
            {mode !== "wall" && <DayHeat race={w} clock={clock} go={go} />}
          </aside>
        </div>

        {run && <TradeLog open={logOpen} onClose={closeLog} race={w} run={run} clock={clock} go={go} />}
        {(clock.ended || seenEnd) && <Summary race={w} benchName={benchName} />}
        <OrbitPanel race={w} clock={clock} sectors={data.sectors} core={desk.counts.buy} />

        <div className="mt-8 grid gap-3">
          <p className="arena-frame">{t("arena.frame")}</p>
          <NotAdvice compact />
        </div>
      </Container>
    </div>
  );
}
