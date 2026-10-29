import { useEffect, useMemo, useRef, useState } from "react";
import { niceTicks, tickLabel } from "../../lib/candles.js";
import { biggestSwing, combo, rankArrow, rankChanges, ranking, ranksAt } from "../../lib/arena.js";
import { lerp } from "../../lib/replay.js";
import { fmtDate, fmtList, fmtPct } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { useSize } from "../motion.jsx";

/*
 * MODE 1, the bar race: one bar per name on the main list (and the benchmark as a dashed ghost bar), sized by its change
 * since the window's first day, re-sorting as names overtake. Each row glides to its new place (transform only, eased
 * per frame: a FLIP done by hand), the numbers count with the replay, the leader wears the crown and the one orange glow,
 * and rank changes flash ▲2 / ▼1 for a moment. The axis follows the field (it widens as the leader runs away). Above
 * it: the leader, the day's biggest swing and the leader's streak of up days. All drawn straight into the DOM from the
 * clock (components/arena/clock.jsx), no React render per frame.
 */

const t = strings(dict);
const END = 1e-6;
const MIN_SPAN = 6; // percent: the axis never zooms in further, so the first quiet days look quiet
const VAL_W = 58; // room at the end of the track for a bar's number
const FLASH_MS = 420;
const SWAP = 0.55; // the share of a day that a change of places takes // rank changes are compared at most this often (playback time), so a fast replay stays readable

const Crown = ({ className = "size-[15px]" }) => (
  <svg viewBox="0 0 20 16" className={className} aria-hidden="true">
    <path d="M2 13.5h16l1-9-5 3.6L10 1.5 6 8.1 1 4.5Z" fill="currentColor" />
  </svg>
);

/** The race's three readouts over the board. */
function Hud({ refs }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      <div className="arena-hud">
        <span className="micro">{t("arena.leader")}</span>
        <span className="arena-hud-v text-desk"><Crown className="size-[13px] shrink-0" /><span ref={refs.leadSym} className="truncate">–</span></span>
        <span ref={refs.leadVal} className="arena-hud-s">–</span>
      </div>
      <div className="arena-hud">
        <span className="micro">{t("arena.swing")}</span>
        <span ref={refs.swingSym} className="arena-hud-v truncate">–</span>
        <span ref={refs.swingVal} className="arena-hud-s">{t("arena.swingNone")}</span>
      </div>
      <div className="arena-hud">
        <span className="micro truncate">{t("arena.combo")}</span>
        <span className="arena-hud-v"><span ref={refs.combo} className="inline-block origin-left">×0</span></span>
        <span ref={refs.comboOf} className="arena-hud-s truncate">–</span>
      </div>
    </div>
  );
}

export function BarRace({ race, clock, benchName, reduced = false }) {
  const board = useRef(null);
  const { w } = useSize(board);
  const narrow = w < 520;
  const pitch = narrow ? 21 : 26;
  const barH = narrow ? 13 : 17;
  const labelW = narrow ? 70 : 168;
  const deltaW = narrow ? 30 : 40;
  const trackW = Math.max(60, w - labelW - deltaW);
  const rows = useMemo(() => [...race.lines.map((l) => ({ ...l, ghost: false })), ...(race.bench ? [{ ...race.bench, ghost: true }] : [])], [race]);
  const H = rows.length * pitch;
  const el = useRef({});
  const hud = { leadSym: useRef(null), leadVal: useRef(null), swingSym: useRef(null), swingVal: useRef(null), combo: useRef(null), comboOf: useRef(null) };
  const ticks = useRef([]);
  const zero = useRef(null);
  const [announce, setAnnounce] = useState("");

  // The drawing state between frames: each row's shown y, the shown axis, the leader, the last rank checkpoint.
  const st = useRef(null);
  useEffect(() => { st.current = null; }, [race, w]);

  // Each day's places, worked out once: a frame slides every row between its place on the day before and the day after.
  const days = useMemo(() => Array.from({ length: race.n }, (_, k) => {
    const out = {};
    for (const r of ranking(race, k)) out[r.symbol] = r;
    return out;
  }), [race]);

  useEffect(() => {
    if (!w) return undefined;
    const X = (v, d) => ((v - d.lo) / (d.hi - d.lo || 1)) * (trackW - VAL_W);
    return clock.subscribe((pos, dt) => {
      const snap = dt === Infinity || reduced;
      let s = st.current;
      if (!s) {
        s = st.current = { y: {}, dom: null, lead: null, k: -1, cp: null, cpK: -1, acc: 0, swingAt: -1e9, combo: 0, rank: {}, val: {}, sign: {} };
      }
      let busy = false;
      const k0 = Math.min(race.n - 1, Math.floor(pos + END)), k1 = Math.min(race.n - 1, k0 + 1);
      const f = Math.max(0, Math.min(1, pos - k0));
      // Swaps take the first part of each day and then hold, so places read clearly between swaps.
      const g = Math.min(1, f / SWAP);
      const sf = g * g * (3 - 2 * g);
      const near = days[Math.min(race.n - 1, Math.round(pos))];
      const vals = rows.map((r) => lerp(r.values, pos) ?? 0);
      // Where the axis should be: the field's spread, never narrower than MIN_SPAN.
      let lo = 0, hi = 0;
      for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo < MIN_SPAN) { const pad = (MIN_SPAN - (hi - lo)) / 2; hi += lo === 0 ? pad * 2 : pad; lo = lo === 0 ? 0 : lo - pad; }
      if (!s.dom || snap) s.dom = { lo, hi };
      else {
        const e = 1 - Math.exp(-dt / 260);
        s.dom = { lo: s.dom.lo + (lo - s.dom.lo) * e, hi: s.dom.hi + (hi - s.dom.hi) * e };
        if (Math.abs(s.dom.lo - lo) > 0.05 || Math.abs(s.dom.hi - hi) > 0.05) busy = true;
      }
      const d = s.dom, x0 = X(0, d);
      const ease = snap ? 1 : 1 - Math.exp(-dt / 45);
      let leader = null;
      rows.forEach((r, i) => {
        const e = el.current[r.symbol];
        if (!e?.row) return;
        const a0 = days[k0][r.symbol].slot, a1 = days[k1][r.symbol].slot;
        const ty = (a0 + (a1 - a0) * sf) * pitch;
        const y = s.y[r.symbol] == null || snap ? ty : s.y[r.symbol] + (ty - s.y[r.symbol]) * ease;
        if (Math.abs(ty - y) > 0.25) busy = true;
        s.y[r.symbol] = Math.abs(ty - y) <= 0.25 ? ty : y;
        e.row.style.transform = `translate3d(0,${s.y[r.symbol].toFixed(2)}px,0)`;
        const v = vals[i];
        const xv = X(v, d);
        const a = Math.min(x0, xv), len = Math.abs(xv - x0);
        const up = v >= 0;
        e.bar.style.transform = `translate3d(${a.toFixed(2)}px,0,0) scaleX(${(len / trackW).toFixed(5)})`;
        if (s.sign[r.symbol] !== up) {
          s.sign[r.symbol] = up;
          e.row.dataset.tone = r.ghost ? "ghost" : up ? "up" : "down";
        }
        e.val.style.transform = `translate3d(${((up ? xv : x0) + 5).toFixed(2)}px,-50%,0)`;
        const txt = fmtPct(v, 1);
        if (s.val[r.symbol] !== txt) { s.val[r.symbol] = txt; e.val.textContent = txt; }
        if (!r.ghost) {
          const rank = near[r.symbol].rank;
          if (rank === 1) leader = { symbol: r.symbol, value: v };
          const rk = String(rank).padStart(2, "0");
          if (s.rank[r.symbol] !== rk) { s.rank[r.symbol] = rk; e.rank.textContent = rk; }
        }
      });
      if (zero.current) zero.current.style.transform = `translate3d(${x0.toFixed(2)}px,0,0)`;
      // Ticks: round steps across the shown axis.
      const nt = niceTicks(d.lo, d.hi, narrow ? 3 : 5);
      ticks.current.forEach((tk, i) => {
        if (!tk) return;
        const v = nt.ticks.filter((x) => x !== 0)[i];
        if (v == null) { tk.style.opacity = "0"; return; }
        tk.style.opacity = "1";
        tk.style.transform = `translate3d(${X(v, d).toFixed(2)}px,0,0)`;
        const lab = tickLabel(v, nt.step);
        if (tk.dataset.v !== lab) { tk.dataset.v = lab; tk.lastChild.textContent = lab; }
      });
      // The crown and the glow move to a new leader.
      if (leader && leader.symbol !== s.lead) {
        if (s.lead) el.current[s.lead]?.row.classList.remove("is-lead");
        el.current[leader.symbol]?.row.classList.add("is-lead");
        s.lead = leader.symbol;
      }
      if (leader && hud.leadVal.current) {
        if (hud.leadSym.current.textContent !== leader.symbol) hud.leadSym.current.textContent = leader.symbol;
        hud.leadVal.current.textContent = fmtPct(leader.value, 1);
      }
      // A new whole day: the swing, the streak, and every few hundred milliseconds the rank changes.
      const k = Math.floor(pos + END);
      if (!snap) s.acc += dt;
      if (k !== s.k) {
        s.k = k;
        const now = performance.now();
        if (snap || now - s.swingAt > 220) {
          s.swingAt = now;
          const sw = biggestSwing(race, k);
          if (hud.swingSym.current) {
            hud.swingSym.current.textContent = sw ? sw.symbol : "–";
            hud.swingVal.current.textContent = sw ? fmtPct(sw.move, 1) : t("arena.swingNone");
            hud.swingVal.current.dataset.tone = sw ? (sw.move >= 0 ? "up" : "down") : "";
          }
        }
        // The streak of the name leading on this very day.
        const top = Object.values(days[k] ?? {}).find((r) => r.rank === 1);
        const lineOf = top ? race.lines.find((l) => l.symbol === top.symbol) : null;
        const c = lineOf ? combo(lineOf.values, k) : 0;
        if (hud.combo.current) {
          hud.combo.current.textContent = `×${c}`;
          if (c > s.combo && !snap && hud.combo.current.animate) hud.combo.current.animate([{ transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
          hud.comboOf.current.textContent = lineOf ? t("arena.comboOf", { name: lineOf.symbol }) : "–";
          s.combo = c;
        }
        if (snap || !s.cp) { s.cp = ranksAt(race, k); s.cpK = k; s.acc = 0; }
        else if (s.acc >= FLASH_MS) {
          const now2 = ranksAt(race, k);
          const ch = rankChanges(s.cp, now2);
          for (const [sym, dd] of Object.entries(ch)) {
            const de = el.current[sym]?.delta;
            if (!de) continue;
            de.textContent = rankArrow(dd);
            de.dataset.tone = dd > 0 ? "up" : "down";
            de.getAnimations?.().forEach((a) => a.cancel());
            de.animate?.([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: 950, easing: "ease-out", fill: "forwards" });
          }
          s.cp = now2; s.cpK = k; s.acc = 0;
        }
      }
      return busy;
    });
  }, [clock.subscribe, race, days, rows, w, trackW, pitch, narrow, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Words for screen readers when the replay stops.
  useEffect(() => {
    if (clock.playing || !clock.started) return;
    const k = Math.floor(clock.pos.current + END);
    const top = ranking(race, k).filter((r) => !r.ghost).slice(0, 3).map((r) => `${r.name} ${fmtPct(r.value, 1)}`);
    setAnnounce(t("arena.race.now", { date: fmtDate(race.dates[k]), leaders: fmtList(top) }));
  }, [clock.playing, clock.started, clock.ended, race]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <Hud refs={hud} />
      <div ref={board} className="race-board relative mt-3" style={{ height: H + 18 }} role="img"
        aria-label={t("arena.race.aria", { count: race.lines.length, from: fmtDate(race.dates[0]) })}>
        {w > 0 && (
          <>
            <div aria-hidden="true" className="absolute top-0 bottom-0" style={{ left: labelW, width: trackW }}>
              <span ref={zero} className="race-zero" />
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} ref={(n) => { ticks.current[i] = n; }} className="race-tick"><span /></span>
              ))}
            </div>
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0" style={{ top: 18 }}>
              {rows.map((r) => (
                <div key={r.symbol} data-tone={r.ghost ? "ghost" : "up"} className={`race-row ${r.ghost ? "is-ghost" : ""}`} style={{ height: pitch }}
                  ref={(n) => {
                    if (!n) { delete el.current[r.symbol]; return; }
                    el.current[r.symbol] = { row: n, bar: n.querySelector(".race-bar"), val: n.querySelector(".race-val"), rank: n.querySelector(".race-rank-n"), delta: n.querySelector(".race-delta") };
                  }}>
                  <span className="race-label" style={{ width: labelW }}>
                    <span className="race-rank"><span className="race-rank-n">{r.ghost ? "" : "–"}</span><Crown className="race-crown size-[14px]" /></span>
                    <span className="race-sym">{r.ghost ? r.symbol : r.symbol}</span>
                    {!narrow && <span className="race-name">{r.ghost ? benchName : r.name}</span>}
                  </span>
                  <span className="race-track" style={{ left: labelW, width: trackW }}>
                    <span className="race-bar" style={{ width: trackW, height: barH, marginTop: -barH / 2 }} />
                    <span className="race-val">0.0%</span>
                  </span>
                  <span className="race-delta" style={{ width: deltaW }} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}
