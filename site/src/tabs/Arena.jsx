import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../lib/motion.js";
import { DAY_MS, WINDOWS, windowed } from "../lib/arena.js";
import { raceData } from "../lib/replay.js";
import { mainListOf } from "../lib/buywindow.js";
import { shortName } from "../lib/simple.js";
import { plainName } from "../lib/why.js";
import { strings } from "../lib/text.js";
import dict from "../text/arena.js";
import { Container, EmptyState, HeroTitle, Panel, Segmented } from "../components/ui.jsx";
import { NotAdvice } from "../components/shell.jsx";
import { useDesk } from "../components/desk.jsx";
import { Controls, DateCounter, PlayIcon, useArenaClock } from "../components/arena/clock.jsx";
import { BarRace } from "../components/arena/race.jsx";
import { Duel } from "../components/arena/duel.jsx";
import { DayHeat, Wall, WALL_DAY_MS } from "../components/arena/wall.jsx";
import { Summary } from "../components/arena/summary.jsx";
import { Basket } from "../components/arena/basket.jsx";
import { OrbitPanel } from "../components/arena/orbit.jsx";

/*
 * THE ARENA: the past year of the main list replayed like a game. One clock (components/arena/clock.jsx) drives every
 * piece: the stage of the chosen mode (a bar race, a duel or a ticker wall of every list), the paper basket and the
 * orbit. Real past data only (the derived files' indexed series), percents and points only, apart from the paper basket's
 * labelled example. It never plays by itself; under reduced motion it shows the end at once. Past moves do not tell
 * what comes next, and the page says so.
 */

const t = strings(dict);
const MODES = ["race", "duel", "wall"];
const COUNT = [3, 2, 1, "go"];
const COUNT_MS = 430;

const ModeIcon = ({ mode }) => (
  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    {mode === "race" && <><path d="M3 5h11M3 10h7M3 15h13" /></>}
    {mode === "duel" && <><path d="M3 14 8 9l3 3 6-7" /><path d="M3 16l5-3 4 1 5-4" opacity=".55" /></>}
    {mode === "wall" && <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></>}
  </svg>
);

export default function Arena({ data, go }) {
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
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);
  useEffect(() => { clearTimers(); setCount(null); }, [win]);

  // Play: from the start (or the end) a short 3-2-1 first; from a pause, straight on.
  const start = useCallback(() => {
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

  const ready = !clock.started && count == null && !reduced;
  const modeTitle = t(`arena.${mode === "race" ? "race" : mode === "duel" ? "duel" : "wall"}.title`);

  return (
    <div ref={watch} className="arena pb-6">
      <Container className="pt-8 sm:pt-12">
        <header className="arena-hero relative">
          <HeroTitle eyebrow={t("arena.kicker")} line1={t("arena.hero1")} line2={t("arena.hero2")} size="lg"
            sub={t("arena.sub", { names: w.lines.length, days: w.days })} />
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <button type="button" onClick={start} data-role="arena-hero-play" aria-label={t("arena.playAria")} className="arena-play">
              <span className="arena-play-icon"><PlayIcon className="size-5" /></span>{t("arena.play")}
            </button>
            <p className="arena-frame">{t("arena.frame")}</p>
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <Segmented label={t("arena.mode")} value={mode} onChange={setMode} tall
            options={MODES.map((m) => ({ value: m, label: <span className="flex items-center gap-2"><ModeIcon mode={m} />{t(`arena.mode.${m}`)}</span> }))} />
          <Segmented label={t("arena.window")} value={win} onChange={setWin}
            options={WINDOWS.map((x) => ({ value: x.id, label: <span className="font-num tracking-normal">{t(`arena.win.${x.id}`)}</span> }))} />
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
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
              <Controls clock={clock} dates={w.dates} onPlay={start} reduced={reduced} className="mt-4" />
            </Panel>
          </div>
          <aside className="grid content-start gap-4">
            <div className="panel hidden p-5 lg:block"><DateCounter clock={clock} dates={w.dates} big /></div>
            <Basket race={w} clock={clock} benchName={benchName} />
            {mode !== "wall" && <DayHeat race={w} clock={clock} go={go} />}
          </aside>
        </div>

        {clock.ended && <Summary race={w} benchName={benchName} />}
        <OrbitPanel race={w} clock={clock} sectors={data.sectors} core={desk.counts.buy} />

        <div className="mt-8 grid gap-3">
          <p className="arena-frame">{t("arena.frame")}</p>
          <NotAdvice compact />
        </div>
      </Container>
    </div>
  );
}
