import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../lib/motion.js";
import { fibSphere, flowPath, heat, orbitRadius, project, turn } from "../lib/arena.js";
import { fmtPct } from "../lib/format.js";
import { strings } from "../lib/text.js";
import dict from "../text/arena.js";

/*
 * Motion pieces for the Arena and Home's live strip. Each one takes plain props for a still or slow use, and a `ref`
 * with an imperative setter for a replay that steps every frame (so React does not re-render 60 times a second).
 * Rules they all keep: transform and opacity only for CSS motion; canvas loops stop when the tab is hidden or the
 * canvas is off-screen; the device pixel ratio is capped at 2; under prefers-reduced-motion they show a still frame.
 *
 *   TickNumber   a big mono number that rolls digit by digit to its value; green at or above `base`, red below.
 *   HeatGrid     tiles (ticker + day move), green/red by the size of the move; re-colours as a replay steps; tap opens.
 *   OrbitSphere  a turning ball of dots (canvas 2D, fake 3D): one bright dot per name that drifts out on an up day and
 *                in on a down day, a cloud of small dots, and an orange core sized by the desk's BUY (paper) calls.
 *   FlowLines    curved lines from anchor points (small cards) into a target (the sphere), with dots running along them.
 *   useCssVars   the theme colours a canvas needs, re-read when the theme switches.
 *   useInViewNow whether an element is on screen now (not once): canvas loops pause off-screen.
 */

const t = strings(dict);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const DPR_MAX = 2;

/* ------------------------------------------------------------------ shared hooks */

/** True while the element is (partly) on screen; true when IntersectionObserver is missing. */
export function useInViewNow(ref, rootMargin = "80px") {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return on;
}

/** True while the page is visible. */
export function usePageVisible() {
  const [v, setV] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    const on = () => setV(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

/** The current values of some CSS custom properties on <html>, re-read when the theme attribute changes. */
export function useCssVars(names) {
  const key = names.join("|");
  const read = useCallback(() => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(key.split("|").map((n) => [n, cs.getPropertyValue(n).trim()]));
  }, [key]);
  const [vars, setVars] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setVars(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setVars(read());
    mq.addEventListener?.("change", on);
    return () => { mo.disconnect(); mq.removeEventListener?.("change", on); };
  }, [read]);
  return vars;
}

/** An element's content-box size, kept current. */
export function useSize(ref) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const r = el.getBoundingClientRect();
    setS({ w: Math.round(r.width), h: Math.round(r.height) });
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setS({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

/* ------------------------------------------------------------------ TickNumber */

const GLYPHS = Array.from({ length: 30 }, (_, i) => i % 10);

/** The cells of a number: [{kind: "digit", place} | {kind: "sep", text}] for `digits` whole digits and `decimals`. */
function cellsFor(digits, decimals, group) {
  const out = [];
  for (let p = digits - 1; p >= 0; p--) {
    out.push({ kind: "digit", place: p + decimals });
    if (group && p > 0 && p % 3 === 0) out.push({ kind: "sep", text: ",", place: p + decimals });
  }
  if (decimals) {
    out.push({ kind: "sep", text: ".", place: -1 });
    for (let p = decimals - 1; p >= 0; p--) out.push({ kind: "digit", place: p });
  }
  return out;
}

/**
 * A big mono number that rolls like an odometer: each digit turns (transform only) to its new value, the short way in
 * the direction the number moved. `value` sets it (it rolls there from `from` the first time it scrolls into view);
 * `ref.current.set(v)` sets it from a replay loop. Green when the value is at or above `base`, red below (no `base`:
 * by its sign when `signed`, else the ink colour). Leading zeros show faintly, like a terminal.
 */
export function TickNumber({ ref, value, from, base = null, digits = 5, decimals = 0, prefix = "", suffix = "", signed = false, group = true,
  format, label, className = "" }) {
  const reduced = useReducedMotion();
  const root = useRef(null);
  const strips = useRef([]);
  const cur = useRef([]); // each digit's position in its strip (10-19 at rest)
  const shown = useRef(null);
  const srText = useRef(null);
  const signEl = useRef(null);
  const cells = useMemo(() => cellsFor(digits, decimals, group), [digits, decimals, group]);
  const digitCells = useMemo(() => cells.filter((c) => c.kind === "digit"), [cells]);
  const toneOf = useCallback((v) => {
    if (isNum(base)) return v > base + 1e-9 ? "up" : v < base - 1e-9 ? "down" : "flat";
    if (signed) return v > 0 ? "up" : v < 0 ? "down" : "flat";
    return "ink";
  }, [base, signed]);

  const set = useCallback((v, { instant = false } = {}) => {
    if (!isNum(v) || !root.current) return;
    const prev = shown.current;
    const dir = prev == null ? 1 : v >= prev ? 1 : -1;
    shown.current = v;
    const units = Math.round(Math.abs(v) * 10 ** decimals);
    const lead = String(units).length; // digits that are not leading zeros
    digitCells.forEach((c, i) => {
      const el = strips.current[i];
      if (!el) return;
      const d = Math.floor(units / 10 ** c.place) % 10;
      let p = cur.current[i] ?? 10;
      const old = ((p % 10) + 10) % 10;
      if (old !== d || instant) {
        const steps = dir > 0 ? (d - old + 10) % 10 : -((old - d + 10) % 10);
        let target = p + steps;
        if (instant || reduced || target < 0 || target > 29) {
          // Back to the middle copy of the strip without a visible jump, then on to the digit.
          el.style.transition = "none";
          p = 10 + old;
          el.style.transform = `translate3d(0, ${-p}em, 0)`;
          void el.offsetHeight;
          el.style.transition = "";
          target = instant || reduced ? 10 + d : p + steps;
        }
        cur.current[i] = target;
        el.style.transform = `translate3d(0, ${-target}em, 0)`;
      }
      el.parentElement.classList.toggle("tick-lead", c.place >= Math.max(lead, decimals + 1));
    });
    root.current.dataset.tone = toneOf(v);
    if (signEl.current) signEl.current.textContent = v > 0 ? "+" : v < 0 ? "−" : "";
    if (srText.current) srText.current.textContent = format ? format(v) : `${prefix}${v.toFixed(decimals)}${suffix}`;
  }, [digitCells, decimals, reduced, toneOf, format, prefix, suffix]);

  useImperativeHandle(ref, () => ({ set }), [set]);

  // The first value, then each new `value`: rolls from `from` once the number is on screen. Only a change of the
  // `value` prop moves it here, so a replay's ref.current.set() is never undone by a re-render.
  const applied = useRef(undefined);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (shown.current == null) set(isNum(from) && !reduced ? from : isNum(value) ? value : 0, { instant: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isNum(value) || !inView || applied.current === value) return;
    applied.current = value;
    set(value);
  }, [value, inView, set]);

  return (
    <span ref={root} className={`tick-num ${className}`} data-tone="ink">
      <span aria-hidden="true" className="inline-flex items-baseline">
        {signed && <span ref={signEl} className="tick-sign" />}
        {prefix && <span className="tick-affix">{prefix}</span>}
        {cells.map((c, i) => c.kind === "sep" ? (
          <span key={`s${i}`} className="tick-sep">{c.text}</span>
        ) : (
          <span key={`d${c.place}`} className="tick-cell">
            <span ref={(el) => { strips.current[digitCells.indexOf(c)] = el; }} className="tick-strip">
              {GLYPHS.map((g, k) => <span key={k}>{g}</span>)}
            </span>
          </span>
        ))}
        {suffix && <span className="tick-affix">{suffix}</span>}
      </span>
      <span className="sr-only">{label ? `${label}: ` : ""}<span ref={srText} /></span>
    </span>
  );
}

/* ------------------------------------------------------------------ HeatGrid */

const HEAT_ALPHA = [0, 0.16, 0.3, 0.48, 0.68];

/**
 * Tiles for names, coloured by a day's move: green up, red down, stronger for a bigger move (lib/arena.js heat).
 * groups: [{id, label, tiles: [{symbol, name, moves}]}]; `day` picks the moves to show (or ref.current.setDay(k,
 * {animate}) from a replay loop: `animate` flips each tile that changed, for a slow pace only). `onOpen(symbol)` makes
 * each tile a button. `compact`: small tiles (still 44px tall) with the ticker and a short move.
 */
export function HeatGrid({ ref, groups, day = 0, onOpen, compact = false, labels = true, className = "", style }) {
  const tiles = useRef(new Map()); // symbol -> {root, up, down, move, ring, face, last}
  const setDay = useCallback((k, { animate = false } = {}) => {
    for (const g of groups ?? []) {
      for (const tile of g.tiles) {
        const el = tiles.current.get(tile.symbol);
        if (!el) continue;
        const m = tile.moves[k];
        const h = heat(m);
        const text = isNum(m) ? fmtPct(m, compact ? 1 : 2) : "–";
        if (el.last === text) continue;
        el.last = text;
        el.up.style.opacity = h.tone === "up" ? HEAT_ALPHA[h.level] : 0;
        el.down.style.opacity = h.tone === "down" ? HEAT_ALPHA[h.level] : 0;
        el.move.textContent = text;
        el.root.dataset.tone = h.tone;
        if (animate && el.face.animate) {
          el.face.animate([{ transform: "translate3d(0,-28%,0)", opacity: 0.3 }, { transform: "none", opacity: 1 }], { duration: 170, easing: "cubic-bezier(.2,.8,.2,1)" });
          if (h.level >= 4 && el.ring.animate) el.ring.animate([{ opacity: 0.9, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.06)" }], { duration: 520, easing: "ease-out" });
        }
      }
    }
  }, [groups, compact]);
  useImperativeHandle(ref, () => ({ setDay }), [setDay]);
  useLayoutEffect(() => {
    for (const el of tiles.current.values()) el.last = null;
    setDay(day);
  }, [groups, day, setDay]);

  const Tile = onOpen ? "button" : "span";
  return (
    <div className={`heat-grid ${compact ? "heat-compact" : ""} ${className}`} style={style}>
      {(groups ?? []).map((g) => (
        <div key={g.id} className="contents">
          {labels && g.label && <p className="heat-label micro">{g.label}<span className="ms-2 text-ink-3/70">{g.tiles.length}</span></p>}
          {g.tiles.map((tile) => (
            <Tile key={tile.symbol} type={onOpen ? "button" : undefined} onClick={onOpen ? () => onOpen(tile.symbol) : undefined}
              className="heat-tile" data-tone="none"
              ref={(root) => {
                if (!root) { tiles.current.delete(tile.symbol); return; }
                const q = (s) => root.querySelector(s);
                tiles.current.set(tile.symbol, { root, up: q(".heat-up"), down: q(".heat-down"), move: q(".heat-move"), ring: q(".heat-ring"), face: q(".heat-face"), last: null });
              }}>
              <span aria-hidden="true" className="heat-up" />
              <span aria-hidden="true" className="heat-down" />
              <span aria-hidden="true" className="heat-ring" />
              <span className="heat-face">
                <span className="heat-sym">{tile.symbol}</span>
                <span className="heat-move">–</span>
              </span>
              {onOpen && <span className="sr-only">{t("arena.wall.open", { name: tile.name })}</span>}
            </Tile>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ OrbitSphere */

const ORBIT_VARS = ["--up", "--down", "--ink", "--ink-3", "--desk", "--desk-2", "--arena-cloud", "--arena-ring", "--surface"];

/** "#rrggbb" or "rgb(...)" with an alpha, for canvas fills. */
function withAlpha(color, a) {
  const c = String(color).trim();
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) {
    const h = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1);
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    return `rgba(${parts.join(",")},${a})`;
  }
  return c;
}

/**
 * A turning ball of dots on a canvas (fake 3D: rotation + perspective, no library). `names`: [{symbol}] get one bright
 * dot each, placed around the middle band; `moves` {symbol: day move} push a dot out (up) or pull it in (down) and
 * colour it; `core` (a count, e.g. the desk's BUY (paper) calls) sizes the orange core; `cloud` small dots make the
 * shell. `labels` names the biggest movers facing the viewer. Spins slowly while on screen and the tab is visible;
 * a still frame under reduced motion. ref.current.setMoves(moves) updates it from a replay loop.
 */
export function OrbitSphere({ ref, names = [], moves = null, core = 0, cloud = 220, labels = true, spin = 0.16, tilt = 0.32, className = "", ariaLabel }) {
  const reduced = useReducedMotion();
  const box = useRef(null);
  const canvas = useRef(null);
  const { w } = useSize(box);
  const onScreen = useInViewNow(box);
  const visible = usePageVisible();
  const colors = useCssVars(ORBIT_VARS);
  const state = useRef({ angle: 0.6, r: {}, target: {}, moves: {} });

  const geo = useMemo(() => ({
    cloud: fibSphere(cloud, 1),
    stocks: fibSphere(Math.max(1, names.length), 0.62).map((p, i) => ({ p, symbol: names[i]?.symbol })),
    core: fibSphere(70, 1),
  }), [cloud, names]);

  const setMoves = useCallback((m) => {
    const s = state.current;
    s.moves = m ?? {};
    for (const n of names) s.target[n.symbol] = orbitRadius(s.moves[n.symbol]);
  }, [names]);
  useImperativeHandle(ref, () => ({ setMoves }), [setMoves]);
  useEffect(() => { if (moves) setMoves(moves); }, [moves, setMoves]);

  const draw = useCallback((dt) => {
    const cv = canvas.current;
    if (!cv || !w) return;
    const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
    const H = w;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    const s = state.current;
    const ease = 1 - Math.exp(-(dt || 0) / 380);
    for (const n of names) {
      const tg = s.target[n.symbol] ?? 1;
      s.r[n.symbol] = dt === Infinity || s.r[n.symbol] == null ? tg : s.r[n.symbol] + (tg - s.r[n.symbol]) * ease;
    }
    const R = w * 0.33, cx = w / 2, cy = H / 2;
    const ds = Math.min(1, Math.max(0.5, w / 380)); // dot size follows the ball's size
    const pr = (v) => project(turn(v, s.angle, tilt), { cx, cy, R });
    const c = colors;

    // Two thin orbit rings, tipped like the ball.
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(c["--arena-ring"] || c["--ink-3"], 0.55);
    for (const [k, rot] of [[1.42, -0.18], [1.18, 0.4]]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * k, R * k * Math.sin(tilt + 0.12), rot, 0, Math.PI * 2);
      ctx.stroke();
    }

    const items = [];
    for (const p of geo.cloud) {
      const q = pr(p);
      items.push({ z: q.z, kind: 0, q });
    }
    const coreScale = 0.2 + Math.min(1, core / 6) * 0.14;
    for (const p of geo.core) {
      const q = project(turn([p[0] * coreScale, p[1] * coreScale, p[2] * coreScale], s.angle * 2.2, tilt), { cx, cy, R });
      items.push({ z: q.z, kind: 1, q });
    }
    for (const st of geo.stocks) {
      const r = s.r[st.symbol] ?? 1;
      const q = pr([st.p[0] * r, st.p[1] * r, st.p[2] * r]);
      items.push({ z: q.z, kind: 2, q, symbol: st.symbol, move: s.moves[st.symbol] });
    }
    items.sort((a, b) => a.z - b.z);

    // The core's glow, behind its dots.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (coreScale + 0.22));
    const coreCol = core > 0 ? c["--desk"] : c["--ink-3"];
    glow.addColorStop(0, withAlpha(coreCol, core > 0 ? 0.42 : 0.18));
    glow.addColorStop(1, withAlpha(coreCol, 0));
    let glowDone = false;

    const cloudCol = c["--arena-cloud"] || c["--ink-3"];
    for (const it of items) {
      const { q } = it;
      const depth = (q.z + 1) / 2; // 0 far, 1 near
      if (!glowDone && it.z > -0.05) {
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cx, cy, R * (coreScale + 0.22), 0, Math.PI * 2); ctx.fill();
        glowDone = true;
      }
      if (it.kind === 0) {
        ctx.fillStyle = withAlpha(cloudCol, 0.18 + depth * 0.55);
        ctx.beginPath(); ctx.arc(q.x, q.y, (0.7 + depth * 1.1) * ds, 0, Math.PI * 2); ctx.fill();
      } else if (it.kind === 1) {
        ctx.fillStyle = withAlpha(core > 0 ? (depth > 0.5 ? c["--desk-2"] : c["--desk"]) : c["--ink-3"], 0.35 + depth * 0.6);
        ctx.beginPath(); ctx.arc(q.x, q.y, (1 + depth * 1.4) * ds, 0, Math.PI * 2); ctx.fill();
      } else {
        const h = heat(it.move);
        const col = h.tone === "up" ? c["--up"] : h.tone === "down" ? c["--down"] : c["--ink"];
        const rad = (2.4 + h.level * 0.55) * q.s * ds;
        ctx.fillStyle = withAlpha(col, 0.16 + depth * 0.14);
        ctx.beginPath(); ctx.arc(q.x, q.y, rad * 2.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = withAlpha(col, 0.55 + depth * 0.45);
        ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2); ctx.fill();
        it.rad = rad;
      }
    }
    if (!glowDone) { ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * (coreScale + 0.22), 0, Math.PI * 2); ctx.fill(); }

    // Names on the biggest movers that face the viewer.
    if (labels && w >= 200) {
      const front = items.filter((it) => it.kind === 2 && it.z > 0.15 && isNum(it.move)).sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, w >= 360 ? 4 : 3);
      ctx.font = `600 ${w >= 360 ? 10.5 : 9.5}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      for (const it of front) {
        const txt = `${it.symbol} ${fmtPct(it.move, 1)}`;
        const x = it.q.x + it.rad + 5, y = it.q.y;
        ctx.lineWidth = 3; ctx.strokeStyle = withAlpha(c["--surface"] || "#000", 0.85); ctx.strokeText(txt, x, y);
        ctx.fillStyle = c["--ink"]; ctx.fillText(txt, x, y);
      }
    }
  }, [w, names, geo, core, colors, labels, tilt]);

  // The loop: only while on screen, the tab is visible and motion is allowed; otherwise one still frame.
  useEffect(() => {
    if (!w) return undefined;
    if (reduced || !onScreen || !visible) { draw(Infinity); return undefined; }
    let raf = 0, prev = null;
    const tick = (now) => {
      const dt = prev == null ? 16 : Math.min(100, now - prev);
      prev = now;
      state.current.angle += (dt / 1000) * spin;
      draw(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [w, reduced, onScreen, visible, draw, spin]);

  return (
    <div ref={box} className={`relative aspect-square w-full ${className}`}>
      <canvas ref={canvas} role="img" aria-label={ariaLabel ?? t("arena.orbit.aria")} className="absolute inset-0 block size-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ FlowLines */

/**
 * Curved lines from anchor points into targets (lib/arena.js flowPath), drawn over a box (the caller places the cards
 * and the target inside it and passes their points in the box's pixels). `tones` colour each line ("up" | "down" |
 * "flat"); dots run along every line (SVG animateMotion, paused off-screen and while the tab is hidden; none under
 * reduced motion). `vertical`: the lines leave downwards (phone: cards above the sphere).
 */
export function FlowLines({ ref, from, to, tones = [], vertical = false, runners = 2, w, h, className = "" }) {
  const reduced = useReducedMotion();
  const svg = useRef(null);
  const uid = useId().replace(/\W/g, "");
  const onScreen = useInViewNow(svg, "0px");
  const visible = usePageVisible();
  const paths = useMemo(() => from.map((a, i) => (to[i] ? flowPath(a, to[i], vertical) : null)), [from, to, vertical]);
  useEffect(() => {
    const el = svg.current;
    if (!el?.pauseAnimations) return;
    if (onScreen && visible) el.unpauseAnimations(); else el.pauseAnimations();
  }, [onScreen, visible]);
  useImperativeHandle(ref, () => ({
    setTones(next) {
      next.forEach((tone, i) => {
        svg.current?.querySelectorAll(`[data-flow="${i}"]`).forEach((el) => { el.dataset.tone = tone; });
      });
    },
  }), []);
  const ready = w > 0 && h > 0;
  return (
    <svg ref={svg} width={w || 0} height={h || 0} viewBox={`0 0 ${w || 1} ${h || 1}`} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-visible ${className}`}>
      {ready && paths.map((d, i) => d && (
        <g key={i}>
          <path id={`${uid}-f${i}`} d={d} data-flow={i} data-tone={tones[i] ?? "flat"} className="flow-line" />
          {!reduced && Array.from({ length: runners }, (_, k) => (
            <circle key={k} r="2.4" data-flow={i} data-tone={tones[i] ?? "flat"} className="flow-dot">
              <animateMotion dur={`${2.6 + (i % 3) * 0.5}s`} repeatCount="indefinite" begin={`${-((k / runners) * (2.6 + (i % 3) * 0.5) + i * 0.37).toFixed(2)}s`}>
                <mpath href={`#${uid}-f${i}`} />
              </animateMotion>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}
