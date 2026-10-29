import { useEffect, useMemo, useRef, useState } from "react";
import { loadMarket } from "../../lib/data.js";
import { breadth, raceTiles, wallLists, wallTiles } from "../../lib/arena.js";
import { fmtPct } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { HeatGrid } from "../motion.jsx";
import { SkeletonRows } from "../ui.jsx";
import { useDayTick } from "./clock.jsx";

/*
 * MODE 3, the ticker wall: every name on every list (each once), one tile each, coloured by that replayed day's move
 * like an exchange wall (components/motion.jsx HeatGrid). Each market's derived file is fetched once (lib/data.js
 * loadMarket keeps it for the session). At a slow pace each tile that changed flips in; faster, the colours fade
 * from day to day instead, so the wall never flashes. Tap a tile to open its page.
 */

const t = strings(dict);
/** The wall's pace: one day every WALL_DAY_MS at 1× (slower than the race, so a day can be read). */
export const WALL_DAY_MS = 400;
/** Tiles flip only while the replay steps at most this many days a second. */
const FLIP_MAX_PER_S = 3;

export function useWallGroups(data, dates) {
  const [state, setState] = useState({ status: "loading", views: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: "loading", views: null });
    Promise.all((data.markets ?? []).filter((m) => m.available).map((m) => loadMarket(data.manifest, m.id, data).catch(() => null)))
      .then((views) => live && setState({ status: views.some(Boolean) ? "ok" : "error", views: views.filter(Boolean) }));
    return () => { live = false; };
  }, [data, attempt]);
  const groups = useMemo(() => (state.views ? wallTiles(wallLists(state.views), dates) : null), [state.views, dates]);
  return { status: state.status, groups, retry: () => setAttempt((a) => a + 1) };
}

export function Wall({ data, race, clock, go, reduced = false }) {
  const { status, groups, retry } = useWallGroups(data, race.dates);
  const grid = useRef(null);
  const up = useRef(null), down = useRef(null), split = useRef(null), top = useRef(null), topV = useRef(null);
  const total = groups?.reduce((s, g) => s + g.tiles.length, 0) ?? 0;

  useDayTick(clock, (k, { snap }) => {
    if (!groups) return;
    const perS = (1000 * clock.speed) / WALL_DAY_MS;
    grid.current?.setDay(k, { animate: !snap && !reduced && clock.playing && perS <= FLIP_MAX_PER_S });
    const b = breadth(groups, k);
    if (up.current) up.current.textContent = String(b.up);
    if (down.current) down.current.textContent = String(b.down);
    if (split.current) split.current.style.transform = `scaleX(${b.up + b.down ? (b.up / (b.up + b.down)).toFixed(4) : 0.5})`;
    if (top.current) {
      top.current.textContent = b.top ? b.top.symbol : "–";
      topV.current.textContent = b.top ? fmtPct(b.top.move, 1) : "";
      topV.current.dataset.tone = b.top ? (b.top.move >= 0 ? "up" : "down") : "";
    }
  }, [groups, reduced]);

  // The colour fade lasts about one day at the current pace, so a fast replay blends instead of flashing.
  // At 1× a colour settles at once, matching its number; faster, it blends over about a day.
  const fade = clock.speed === 1 ? 120 : Math.max(180, Math.min(420, (WALL_DAY_MS / clock.speed) * 1.2));

  if (status === "loading") return <div className="py-6"><p role="status" className="micro mb-3">{t("arena.wall.loading")}</p><SkeletonRows rows={5} /></div>;
  if (status === "error" || !groups?.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-[15px] text-ink-2">{t("arena.wall.error")}</p>
        <button type="button" onClick={retry} className="arena-btn mx-auto mt-3">{t("arena.wall.retry")}</button>
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="arena-hud min-w-[86px]">
          <span className="micro">{t("arena.wall.up")} · {t("arena.wall.down")}</span>
          <span className="arena-hud-v font-num"><span ref={up} className="text-up">0</span><span className="text-ink-3">/</span><span ref={down} className="text-down">0</span></span>
        </div>
        <div className="wall-split" aria-hidden="true"><span ref={split} className="wall-split-up" /></div>
        <div className="arena-hud min-w-[96px] text-end">
          <span className="micro">{t("arena.wall.top")}</span>
          <span className="arena-hud-v justify-end"><span ref={top}>–</span></span>
          <span ref={topV} className="arena-hud-s" />
        </div>
      </div>
      <p className="micro mt-3">{t("arena.wall.count", { count: total })}</p>
      <HeatGrid ref={grid} groups={groups} day={Math.floor(clock.pos.current + 1e-6)} onOpen={(sym) => go(`stock/${sym}`)} className="mt-2" style={{ "--heat-fade": `${fade}ms` }} />
    </div>
  );
}

/** The main list's heat for the replayed day: a small grid beside the stage (HeatGrid, compact). Tap a tile to open it. */
export function DayHeat({ race, clock, go, className = "" }) {
  const groups = useMemo(() => raceTiles(race), [race]);
  const grid = useRef(null);
  useDayTick(clock, (k) => grid.current?.setDay(k), [groups]);
  return (
    <section aria-labelledby="arena-heat-h" className={`panel overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 id="arena-heat-h" className="kicker">{t("arena.heat.title")}</h2>
        <span className="micro">{t("arena.heat.sub")}</span>
      </div>
      <div className="p-3">
        <HeatGrid ref={grid} groups={groups} labels={false} compact onOpen={(sym) => go(`stock/${sym}`)} style={{ "--heat-fade": "160ms" }} />
      </div>
    </section>
  );
}

