import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "../../lib/candles.js";
import { bestDuel, duelResult, gapAt, leadChangeDays, LEVEL_PTS } from "../../lib/arena.js";
import { fmtDate, fmtPct } from "../../lib/format.js";
import { strings } from "../../lib/text.js";
import dict from "../../text/arena.js";
import { useSize } from "../motion.jsx";

/*
 * MODE 2, the duel: two names' lines (change since the window's first day) draw side by side with a glowing head dot
 * each, a bracket between the heads showing the gap in percent points, a tug-of-war meter (who leads by how much), the
 * lead changes counted, and a K.O. card at the end ("AAA WINS BY 23.4 PTS"). Points only: the gap is one line's percent
 * minus the other's. The lines are drawn once and revealed by a clip that the clock moves each frame.
 */

const t = strings(dict);
const END = 1e-6;
const pts = (v) => t("arena.duel.pts", { v: Math.abs(v).toFixed(1) });
const COLOR = { a: "var(--race-1)", b: "var(--race-4)" };

function Picker({ id, label, value, other, lines, onChange, side }) {
  return (
    <label htmlFor={id} className="duel-pick" data-side={side}>
      <span className="micro" style={{ color: COLOR[side] }}>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="duel-select">
        {lines.map((l) => <option key={l.symbol} value={l.symbol} disabled={l.symbol === other}>{`${l.symbol} · ${l.name}`}</option>)}
      </select>
    </label>
  );
}

export function Duel({ race, clock, pair, setPair, reduced = false }) {
  const [symA, symB] = pair ?? bestDuel(race) ?? [race.lines[0]?.symbol, race.lines[1]?.symbol];
  const A = race.lines.find((l) => l.symbol === symA) ?? race.lines[0];
  const B = race.lines.find((l) => l.symbol === symB) ?? race.lines[1];
  const box = useRef(null);
  const { w } = useSize(box);
  const narrow = w < 560;
  const W = Math.max(260, w), H = narrow ? 230 : 300;
  const L = narrow ? 36 : 44, R = narrow ? 92 : 112, T = 16, Bm = 24;
  const x1 = W - R;

  const geo = useMemo(() => {
    const all = [...A.values, ...B.values];
    let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    const y = scaleLinear(lo, hi, H - Bm, T);
    const x = (i) => L + (i / Math.max(1, race.n - 1)) * (x1 - L);
    const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const step = Math.abs(hi - lo) > 60 ? 20 : Math.abs(hi - lo) > 24 ? 10 : 5;
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    // Cumulative counts per day, so a frame reads them at once.
    const changes = leadChangeDays(A.values, B.values);
    const changeUpTo = new Array(race.n).fill(0);
    const frontA = new Array(race.n).fill(0), frontB = new Array(race.n).fill(0);
    let ci = 0;
    for (let k = 0; k < race.n; k++) {
      while (ci < changes.length && changes[ci] <= k) ci++;
      changeUpTo[k] = ci;
      const g = A.values[k] - B.values[k];
      frontA[k] = (k ? frontA[k - 1] : 0) + (k && g >= LEVEL_PTS ? 1 : 0);
      frontB[k] = (k ? frontB[k - 1] : 0) + (k && g <= -LEVEL_PTS ? 1 : 0);
    }
    const maxGap = Math.max(1, ...A.values.map((v, k) => Math.abs(v - B.values[k])));
    return { x, y, path, ticks, changeUpTo, frontA, frontB, maxGap, dA: path(A.values), dB: path(B.values) };
  }, [A, B, race, H, L, x1]);

  const r = useMemo(() => ({ clip: cell(), headA: cell(), headB: cell(), tagA: cell(), tagB: cell(), gap: cell(), gapLab: cell(),
    fill: cell(), read: cell(), changes: cell(), front: cell(), banner: cell(), valA: cell(), valB: cell() }), []);

  useEffect(() => {
    if (!w) return undefined;
    let lastK = -1, lastChanges = -1;
    return clock.subscribe((pos) => {
      const g = gapAt(A.values, B.values, pos);
      const hx = geo.x(pos), ya = geo.y(g.a), yb = geo.y(g.b);
      r.clip.current?.setAttribute("transform", `scale(${Math.max(0.0001, (hx + 1) / W).toFixed(5)},1)`);
      if (r.headA.current) r.headA.current.style.transform = `translate3d(${hx.toFixed(1)}px,${ya.toFixed(1)}px,0)`;
      if (r.headB.current) r.headB.current.style.transform = `translate3d(${hx.toFixed(1)}px,${yb.toFixed(1)}px,0)`;
      // Tags beside the heads, nudged apart when the lines are close.
      let ta = ya, tb = yb;
      if (Math.abs(ta - tb) < 22) { const m = (ta + tb) / 2, s = ta <= tb ? -1 : 1; ta = m + s * 11; tb = m - s * 11; }
      if (r.tagA.current) { r.tagA.current.style.transform = `translate3d(${(hx + 10).toFixed(1)}px,${ta.toFixed(1)}px,0) translateY(-50%)`; r.valA.current.textContent = fmtPct(g.a, 1); }
      if (r.tagB.current) { r.tagB.current.style.transform = `translate3d(${(hx + 10).toFixed(1)}px,${tb.toFixed(1)}px,0) translateY(-50%)`; r.valB.current.textContent = fmtPct(g.b, 1); }
      const top = Math.min(ya, yb), h = Math.abs(ya - yb);
      if (r.gap.current) {
        r.gap.current.style.transform = `translate3d(${(hx - 1).toFixed(1)}px,${top.toFixed(1)}px,0) scaleY(${Math.max(0.001, h).toFixed(2)})`;
        r.gap.current.dataset.lead = g.lead ?? "";
      }
      if (r.gapLab.current) {
        r.gapLab.current.style.transform = `translate3d(${(hx - 8).toFixed(1)}px,${(top + h / 2).toFixed(1)}px,0) translate(-100%,-50%)`;
        r.gapLab.current.textContent = g.lead ? pts(g.gap) : t("arena.duel.level");
        r.gapLab.current.style.opacity = h > 14 ? "1" : "0";
      }
      // The tug of war: player 1 pulls left, player 2 right.
      if (r.fill.current) {
        const f = Math.max(-1, Math.min(1, -g.gap / geo.maxGap));
        r.fill.current.style.transform = `scaleX(${f.toFixed(4)})`;
        r.fill.current.dataset.lead = g.lead ?? "";
      }
      if (r.read.current) {
        r.read.current.textContent = g.lead ? t("arena.duel.leads", { name: g.lead === "a" ? A.symbol : B.symbol, pts: pts(g.gap) }) : t("arena.duel.level");
        r.read.current.dataset.lead = g.lead ?? "";
      }
      const k = Math.floor(pos + END);
      if (k !== lastK) {
        lastK = k;
        const c = geo.changeUpTo[k] ?? 0;
        if (r.changes.current) r.changes.current.textContent = String(c);
        if (r.front.current) r.front.current.textContent = `${geo.frontA[k] ?? 0} – ${geo.frontB[k] ?? 0}`;
        if (lastChanges >= 0 && c > lastChanges && !reduced && r.banner.current?.animate) {
          r.banner.current.animate([{ opacity: 0, transform: "translate(-50%,8px) scale(.9)" }, { opacity: 1, transform: "translate(-50%,0) scale(1)", offset: 0.2 },
            { opacity: 1, transform: "translate(-50%,0) scale(1)", offset: 0.75 }, { opacity: 0, transform: "translate(-50%,-6px) scale(1)" }], { duration: 900, easing: "ease-out" });
          r.changes.current?.animate?.([{ transform: "scale(1.4)" }, { transform: "scale(1)" }], { duration: 320 });
        }
        lastChanges = c;
      }
      return false;
    });
  }, [clock.subscribe, A, B, geo, w, W, reduced, r]); // eslint-disable-line react-hooks/exhaustive-deps

  const [hideKo, setHideKo] = useState(false);
  useEffect(() => { if (!clock.ended) setHideKo(false); }, [clock.ended]);
  const res = clock.ended && !hideKo ? duelResult(race, A.symbol, B.symbol) : null;
  const pick = (side) => (v) => {
    const next = side === "a" ? [v, v === B.symbol ? A.symbol : B.symbol] : [v === A.symbol ? B.symbol : A.symbol, v];
    setPair(next);
  };

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <Picker id="duel-a" side="a" label={t("arena.duel.p1")} value={A.symbol} other={B.symbol} lines={race.lines} onChange={pick("a")} />
        <span className="duel-vs" aria-hidden="true">{t("arena.duel.vs")}</span>
        <Picker id="duel-b" side="b" label={t("arena.duel.p2")} value={B.symbol} other={A.symbol} lines={race.lines} onChange={pick("b")} />
      </div>

      <div ref={box} className="relative mt-3" style={{ height: H }} role="img"
        aria-label={t("arena.duel.aria", { a: A.name, b: B.name, from: fmtDate(race.dates[0]) })}>
        {w > 0 && (
          <>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 block" aria-hidden="true">
              <defs><clipPath id="duel-clip"><rect ref={r.clip} x="0" y="0" width={W} height={H} transform="scale(0,1)" /></clipPath></defs>
              {geo.ticks.map((v) => (
                <g key={v}>
                  <line x1={L} x2={x1} y1={Math.round(geo.y(v)) + 0.5} y2={Math.round(geo.y(v)) + 0.5} stroke={v === 0 ? "var(--line-3)" : "var(--line)"} strokeDasharray={v === 0 ? "" : "2 4"} />
                  <text x={L - 6} y={geo.y(v) + 3.5} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">{v === 0 ? "0%" : fmtPct(v, 0)}</text>
                </g>
              ))}
              <g fill="none" strokeLinejoin="round" strokeLinecap="round" opacity="0.16">
                <path d={geo.dA} stroke={COLOR.a} strokeWidth="1.5" />
                <path d={geo.dB} stroke={COLOR.b} strokeWidth="1.5" />
              </g>
              <g fill="none" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#duel-clip)">
                <path d={geo.dA} stroke={COLOR.a} strokeWidth="2.4" />
                <path d={geo.dB} stroke={COLOR.b} strokeWidth="2.4" />
              </g>
            </svg>
            <span ref={r.gap} className="duel-gap" aria-hidden="true" />
            <span ref={r.gapLab} className="duel-gap-label" aria-hidden="true" />
            <span ref={r.headA} className="duel-head" style={{ "--c": COLOR.a }} aria-hidden="true" />
            <span ref={r.headB} className="duel-head" style={{ "--c": COLOR.b }} aria-hidden="true" />
            <span ref={r.tagA} className="duel-tag" style={{ "--c": COLOR.a }} aria-hidden="true"><b>{A.symbol}</b><span ref={r.valA} /></span>
            <span ref={r.tagB} className="duel-tag" style={{ "--c": COLOR.b }} aria-hidden="true"><b>{B.symbol}</b><span ref={r.valB} /></span>
            <span ref={r.banner} className="duel-banner" aria-hidden="true">{t("arena.duel.change")}</span>
          </>
        )}
        {res && (
          <div className="duel-ko" role="status">
            <button type="button" onClick={() => setHideKo(true)} aria-label={t("arena.duel.close")} className="duel-ko-x">×</button>
            <span className="duel-ko-big">{res.draw ? t("arena.duel.draw") : t("arena.duel.ko")}</span>
            <span className="duel-ko-line" style={{ color: res.draw ? undefined : COLOR[res.winner.symbol === A.symbol ? "a" : "b"] }}>
              {res.draw ? t("arena.duel.drawLine") : t("arena.duel.wins", { name: res.winner.symbol, pts: pts(res.gap) })}
            </span>
            <span className="duel-ko-sub">
              {t("arena.duel.endLine", { count: res.changes, front: res.draw ? Math.max(res.front.a, res.front.b) : res.winner.symbol === A.symbol ? res.front.a : res.front.b, days: race.n - 1 })}
            </span>
            {!reduced && <button type="button" onClick={clock.restart} className="arena-btn mt-3">{t("arena.duel.rematch")}</button>}
          </div>
        )}
      </div>

      <div className="duel-meter mt-3" aria-hidden="true">
        <span className="duel-meter-end" style={{ color: COLOR.a }}>{A.symbol}</span>
        <span className="duel-meter-track"><span ref={r.fill} className="duel-meter-fill" /><span className="duel-meter-mid" /></span>
        <span className="duel-meter-end text-end" style={{ color: COLOR.b }}>{B.symbol}</span>
      </div>
      <p ref={r.read} className="mt-1.5 text-center font-display text-[17px] font-bold tracking-[0.08em] text-ink uppercase" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="arena-hud"><span className="micro">{t("arena.duel.changes")}</span><span ref={r.changes} className="arena-hud-v inline-block origin-left">0</span></div>
        <div className="arena-hud"><span className="micro">{t("arena.duel.front")}</span><span ref={r.front} className="arena-hud-v">0 – 0</span></div>
      </div>
    </div>
  );
}

/** A plain {current} box: stable refs made once inside useMemo (useRef cannot be called there). */
function cell() {
  return { current: null };
}
