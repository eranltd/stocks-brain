import { useEffect, useRef } from "react";
import { useReducedMotion } from "../lib/motion.js";
import { FLOOR_DAY_MS, floorBreadth, HOLD_MS, moveAt } from "../lib/floor.js";
import { heat } from "../lib/arena.js";
import { TickNumber, useInViewNow, usePageVisible } from "./motion.jsx";
import { useArenaClock, useDayTick } from "./arena/clock.jsx";
import dict from "../text/stock.js";
import homeDict from "../text/home.js";
import { strings } from "../lib/text.js";

/*
 * THE FLOOR: the Stocks page's ARENA view (its default). One square per name, replaying the last 30 trading days again
 * and again: each step tints the square green or red by that day's move (stronger for a bigger move), flashes it, rolls
 * its percent (motion.jsx TickNumber) and scrolls its little bar tape left. The header's date, up/down count and
 * breadth bar step with it, and the last day holds with a LATEST flash before the loop starts again. One clock
 * (arena/clock.jsx, the Arena's, set to loop here) drives the floor and the pair cards below it; every step writes
 * straight to the DOM, so React does not re-render each frame. It pauses when the tab is hidden or the scanner and the
 * pairs are off screen; under reduced motion it shows the latest day, still. Past closes only, never live.
 */

const ALPHA = [0.05, 0.16, 0.28, 0.42, 0.56];
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** "14 Sep". */
const shortDay = (iso) => {
  if (!iso) return "–";
  const d = new Date(`${iso}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTH.format(d)}`;
};

/**
 * The floor's clock: the Arena's clock that starts by itself, loops (a pause on the last day, then day one again) and
 * stops while `watch` is off screen or the tab is hidden. Under reduced motion it stays on the last day.
 */
export function useFloorLoop({ n, watch, resetKey = "" }) {
  const reduced = useReducedMotion();
  const clock = useArenaClock({ n: Math.max(1, n), dayMs: FLOOR_DAY_MS, reduced, resetKey });
  const onScreen = useInViewNow(watch, "0px");
  const visible = usePageVisible();
  const active = onScreen && visible && !reduced && n > 1;
  const { playing, ended, play, pause, restart } = clock;
  useEffect(() => {
    if (!active) { if (playing) pause(); return undefined; }
    if (ended) { const id = setTimeout(restart, HOLD_MS); return () => clearTimeout(id); }
    if (!playing) play();
    return undefined;
  }, [active, playing, ended, play, pause, restart]);
  return { clock, reduced };
}

/**
 * The floor. `floor` from lib/floor.js floorData; `show` the symbols the page's filters keep (all when null); `loop`
 * from useFloorLoop. Tap a square to open its page.
 */
export function Floor({ floor, show = null, loop, go }) {
  const t = strings(dict);
  const th = strings(homeDict);
  const { clock, reduced } = loop;
  const tiles = useRef(new Map());
  const head = useRef({});
  const lastK = useRef(-1);
  const n = floor.loopDates.length;
  const shown = show ? floor.tiles.filter((x) => show.has(x.symbol)) : floor.tiles;

  const byTile = useRef(new Map());
  byTile.current = new Map(floor.tiles.map((x) => [x.symbol, x]));
  const register = (symbol, el) => {
    if (!el) { tiles.current.delete(symbol); return; }
    tiles.current.set(symbol, el);
    const tile = byTile.current.get(symbol);
    if (tile && lastK.current >= 0) paintTile(tile, el, lastK.current, floor.tape, true);
  };

  useDayTick(clock, (k, { snap }) => {
    const back = k < lastK.current; // the loop went back to day one: jump, do not slide
    lastK.current = k;
    const calm = snap || reduced || back;
    for (const tile of floor.tiles) {
      const el = tiles.current.get(tile.symbol);
      if (el) paintTile(tile, el, k, floor.tape, calm);
    }
    const H = head.current;
    const b = floorBreadth(floor.tiles, k, floor.tape);
    if (H.date) {
      H.date.textContent = shortDay(floor.loopDates[k]);
      if (!calm) H.date.animate?.([{ opacity: 0.4, transform: "translate3d(0,-10%,0)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
    }
    if (H.up) H.up.textContent = String(b.up);
    if (H.down) H.down.textContent = String(b.down);
    if (H.bar) H.bar.style.transform = `scaleX(${b.up + b.down ? (b.up / (b.up + b.down)).toFixed(4) : 0.5})`;
    if (H.day) H.day.textContent = t("wl.fl.day", { i: k + 1, n });
    if (H.latest) {
      const on = k >= n - 1;
      H.latest.dataset.on = on ? "1" : "0";
      if (on && !calm) H.latest.animate?.([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "scale(1.06)", offset: 0.4 }, { opacity: 1, transform: "none" }], { duration: 520, easing: "ease-out" });
    }
  }, [floor, reduced]);

  return (
    <div className="mt-2">
      <div className="grid gap-4 lg:flex lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <h3 className="headline text-[clamp(34px,9vw,52px)] leading-[0.9]">{t("wl.fl.title1")} <span className="hero-glow text-desk">{t("wl.fl.title2")}</span></h3>
          <p className="mt-2 flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
            <span aria-hidden="true" className={`size-1.5 rounded-full bg-desk ${reduced ? "" : "motion-safe:animate-[beacon_1.6s_ease-in-out_infinite]"}`} />
            {t("wl.fl.loops", { n })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:min-w-[440px]" aria-hidden="true">
          <div className="tile floor-hud relative min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
            <span className="micro text-desk">{t("wl.fl.replay")}</span>
            <span ref={(el) => { head.current.date = el; }} className="mt-1.5 block truncate font-num text-[24px] leading-none font-bold tracking-[-0.03em] text-ink uppercase sm:text-[30px]">{shortDay(floor.loopDates.at(-1))}</span>
            <span ref={(el) => { head.current.day = el; }} className="mt-1.5 block font-mono text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase" />
            <span ref={(el) => { head.current.latest = el; }} data-on="0" className="floor-latest">{t("wl.fl.latest")}</span>
          </div>
          <div className="tile floor-hud min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
            <span className="micro text-desk">{t("wl.fl.updown")}</span>
            <span className="mt-1.5 block font-num text-[24px] leading-none font-bold tracking-[-0.03em] sm:text-[30px]">
              <span ref={(el) => { head.current.up = el; }} className="text-up">0</span><span className="text-ink-3">/</span><span ref={(el) => { head.current.down = el; }} className="text-down">0</span>
            </span>
            <span className="floor-split mt-2.5"><span ref={(el) => { head.current.bar = el; }} /></span>
          </div>
        </div>
      </div>

      <ul className="floor-grid mt-4">
        {shown.map((tile) => (
          <li key={tile.symbol} className="min-w-0">
            <FloorTile tile={tile} go={go} t={t} buyLabel={th("desk.call.buy")}
              register={(el) => register(tile.symbol, el)} />
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
        <span>{t("wl.fl.legend")}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="floor-key-buy" />{t("wl.fl.buyKey", { buy: th("desk.call.buy") })}</span>
      </p>
    </div>
  );
}

const TAPE_BARS = 16;

/** Paint one square for loop day k: tint, rolling percent, tape position; a flash and a blip unless `calm`. */
function paintTile(tile, el, k, tape, calm) {
  const m = moveAt(tile, k, tape);
  const h = heat(m);
  el.root.dataset.tone = h.tone;
  el.tint.style.opacity = String(ALPHA[h.level] ?? 0);
  el.tick?.set(isNum(m) ? Math.max(-99.9, Math.min(99.9, m)) : 0, { instant: calm });
  const j = k + tape;
  el.track.style.transition = calm ? "none" : "";
  el.track.style.transform = `translate3d(${(-(j + 1 - TAPE_BARS) / tile.moves.length) * 100}%,0,0)`;
  el.bars[el.now]?.classList.remove("is-now");
  el.bars[j]?.classList.add("is-now");
  el.now = j;
  if (!calm && (h.tone === "up" || h.tone === "down")) {
    el.blip.textContent = h.tone === "up" ? "▲" : h.tone === "down" ? "▼" : "◆";
    el.blip.animate?.([{ opacity: 0, transform: "translate3d(0,5px,0)" }, { opacity: 1, transform: "none", offset: 0.25 }, { opacity: 0, transform: "translate3d(0,-4px,0)" }], { duration: 1300, easing: "ease-out" });
    el.flash.animate?.([{ opacity: 0 }, { opacity: h.level >= 3 ? 0.4 : 0.22, offset: 0.25 }, { opacity: 0 }], { duration: 1400, easing: "ease-in-out" });
  }
}

/** One square: ticker, a rolling percent, a ▲/▼ blip, and a tape of the last days' moves. */
function FloorTile({ tile, go, register, t, buyLabel }) {
  const root = useRef(null);
  const tick = useRef(null);
  const parts = useRef({ bars: [] });
  useEffect(() => {
    const r = root.current;
    if (!r) return undefined;
    const p = parts.current;
    const el = { root: r, tint: r.querySelector(".floor-tint"), flash: r.querySelector(".floor-flash"), blip: r.querySelector(".floor-blip"), track: r.querySelector(".floor-track"), bars: p.bars, now: -1 };
    Object.defineProperty(el, "tick", { get: () => tick.current });
    register(el);
    return () => register(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = tile.moves.length;
  const buy = tile.call === "buy";
  return (
    <button ref={root} type="button" onClick={() => go(`stock/${tile.symbol}`)} data-tone="none"
      className={`floor-tile ${buy ? "floor-buy" : ""}`} aria-label={`${t("wl.open", { symbol: tile.symbol })}${buy ? ` · ${buyLabel}` : ""}`}>
      <span aria-hidden="true" className="floor-tint" />
      <span aria-hidden="true" className="floor-flash" />
      <span className="floor-top" aria-hidden="true">
        <span className="floor-sym">{tile.symbol}</span>
        <span className="floor-blip" />
      </span>
      <TickNumber ref={tick} digits={2} decimals={1} signed suffix="%" group={false} className="floor-pct" />
      <span aria-hidden="true" className="floor-tape">
        <span className="floor-track" style={{ width: `${(total / TAPE_BARS) * 100}%` }}>
          {tile.moves.map((m, i) => (
            <span key={i} ref={(el) => { parts.current.bars[i] = el; }} className={`floor-bar ${isNum(m) ? (m > 0 ? "up" : m < 0 ? "down" : "") : ""}`}
              style={{ width: `${100 / total}%` }}>
              <i style={{ height: `${isNum(m) ? Math.max(10, Math.min(100, (Math.abs(m) / tile.scale) * 100)) : 0}%` }} />
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
