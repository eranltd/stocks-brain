import { useEffect, useMemo, useRef, useState } from "react";
import { loadMarket } from "../lib/data.js";
import { CHART_DAYS, measurePairs, outOfTen, pairView, pickPairs } from "../lib/pairs.js";
import { heat } from "../lib/arena.js";
import { smoothPath } from "../lib/bigboard.js";
import { scaleLinear } from "../lib/candles.js";
import { TickNumber } from "./motion.jsx";
import { useDayTick } from "./arena/clock.jsx";
import { DeskHead } from "./pulse.jsx";
import { NotAdvice } from "./shell.jsx";
import { EmptyState, InfoTip, Panel, SectionTitle, SkeletonRows } from "./ui.jsx";
import dict from "../text/stock.js";
import { strings } from "../lib/text.js";

/*
 * PAIR STOCKS, under the scanner on every list: names from all the site's lists that moved like a seesaw (one up, the
 * other down) or together, measured on the last 120 shared trading days (lib/pairs.js). Each card has the two names
 * as little squares stepped by the floor's clock (so a seesaw pair flips opposite colours most days), how often they
 * went opposite or the same way, and a small chart of the last 60 days. Every list's file is fetched once
 * (lib/data.js loadMarket, as the Arena's ticker wall does). Past days only: a pair can stop working any time.
 */

const ALPHA = [0.05, 0.16, 0.28, 0.42, 0.56];
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const LINE = ["var(--race-1)", "var(--race-2)"];

/** Every list's view, loaded once each (cached for the session by loadMarket). */
function useAllLists(base) {
  const [state, setState] = useState({ status: "loading", views: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ status: "loading", views: null });
    Promise.all((base.markets ?? []).filter((m) => m.available).map((m) => loadMarket(base.manifest, m.id, base).catch(() => null)))
      .then((views) => live && setState({ status: views.some(Boolean) ? "ok" : "error", views: views.filter(Boolean) }));
    return () => { live = false; };
  }, [base, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

/** Each listed name once, with its series and whether its list holds funds. */
function universeOf(views) {
  const seen = new Map();
  for (const v of views ?? []) {
    if (!v?.available || !v.market?.symbols?.length) continue;
    const rows = Object.fromEntries(v.market.symbols.map((s) => [s.symbol, s]));
    for (const s of v.watchlist?.symbols ?? []) {
      const row = rows[s.symbol];
      if (!row?.series?.length || seen.has(s.symbol)) continue;
      seen.set(s.symbol, { symbol: s.symbol, name: v.names?.[s.symbol] ?? s.name ?? s.symbol, series: row.series, fund: v.entry?.kind === "funds" });
    }
  }
  return [...seen.values()];
}

/** The pairs section. `base`: the main data (it knows every list); `loop`: the floor's clock; `n`: its loop days. */
export function Pairs({ base, loop, n, go }) {
  const t = strings(dict);
  const { status, views, retry } = useAllLists(base);
  const names = useMemo(() => universeOf(views), [views]);
  const groups = useMemo(() => {
    if (!names.length) return null;
    const by = Object.fromEntries(names.map((x) => [x.symbol, x]));
    const measured = measurePairs(names);
    const card = (p, kind) => ({ ...p, kind, A: by[p.a], B: by[p.b], view: pairView(by[p.a].series, by[p.b].series, { days: CHART_DAYS, loop: n }) });
    return {
      seesaw: pickPairs(measured, { kind: "seesaw" }).map((p) => card(p, "seesaw")),
      twins: pickPairs(measured, { kind: "twins" }).map((p) => card(p, "twins")),
    };
  }, [names, n]);

  // One clock for every square: each step paints them straight into the DOM.
  const squares = useRef(new Map());
  const lastK = useRef(-1);
  const register = (key, el) => {
    if (!el) { squares.current.delete(key); return; }
    squares.current.set(key, el);
    if (lastK.current >= 0) paintSquare(el, lastK.current, true);
  };
  useDayTick(loop.clock, (k, { snap }) => {
    const back = k < lastK.current;
    lastK.current = k;
    for (const el of squares.current.values()) paintSquare(el, k, snap || loop.reduced || back);
  }, [groups, loop.reduced]);

  return (
    <section id="pairs" aria-labelledby="pairs-h" className="mt-10 scroll-mt-28">
      <SectionTitle id="pairs-h" size="md" eyebrow={t("wl.pairs.eyebrow")} title={<>{t("wl.pairs.title1")} <span className="text-desk">{t("wl.pairs.title2")}</span></>}
        sub={t("wl.pairs.sub")} right={<InfoTip label={t("wl.pairs.about")}>{t("wl.pairs.info")}</InfoTip>} />
      {status === "loading" && <div role="status" className="mt-4"><p className="micro mb-2">{t("wl.pairs.loading")}</p><SkeletonRows rows={4} /></div>}
      {status === "error" && (
        <EmptyState compact className="mt-4" title={t("wl.pairs.error")}
          action={<button type="button" onClick={retry} className="btn min-h-[44px] justify-center">{t("cdv.retry")}</button>} />
      )}
      {status === "ok" && groups && (
        <div className="mt-4 grid gap-4">
          {["seesaw", "twins"].map((kind) => (
            <Panel key={kind} id={`pairs-${kind}`} head={<DeskHead id={`pairs-${kind}-h`} title={t(`wl.pairs.${kind}`)} sub={t(`wl.pairs.${kind}Sub`)} />}>
              {groups[kind].length ? (
                <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                  {groups[kind].map((p) => <PairCard key={`${p.a}-${p.b}`} p={p} go={go} register={register} t={t} />)}
                </ul>
              ) : <EmptyState compact title={t("wl.pairs.none")} />}
            </Panel>
          ))}
        </div>
      )}
      <p className="mt-3 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink-2 uppercase">{t("wl.pairs.caption")}</p>
      <NotAdvice compact className="mt-2" />
    </section>
  );
}

/** Paint one square for loop day k: tint and rolling percent; a flash unless `calm`. */
function paintSquare(el, k, calm) {
  const m = el.moves[k];
  const h = heat(m);
  el.root.dataset.tone = h.tone;
  el.tint.style.opacity = String(ALPHA[h.level] ?? 0);
  el.tick?.set(isNum(m) ? Math.max(-99.9, Math.min(99.9, m)) : 0, { instant: calm });
  if (!calm && (h.tone === "up" || h.tone === "down")) el.flash.animate?.([{ opacity: h.level >= 3 ? 0.7 : 0.4 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
}

function PairCard({ p, go, register, t }) {
  const seesaw = p.kind === "seesaw";
  const share = seesaw ? outOfTen(p.opposite, p.days) : outOfTen(p.same, p.days);
  return (
    <li className="pair-card tile min-w-0 p-2.5 sm:p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
        <PairSquare who={p.A} moves={p.view.movesA} color={LINE[0]} go={go} register={(el) => register(`${p.a}-${p.b}:a`, el)} t={t} />
        <span aria-hidden="true" className={`pair-link ${seesaw ? "pair-link-seesaw" : ""}`}>{seesaw ? "⇅" : "⇉"}</span>
        <PairSquare who={p.B} moves={p.view.movesB} color={LINE[1]} go={go} register={(el) => register(`${p.a}-${p.b}:b`, el)} t={t} />
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="pair-meter" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < share ? (seesaw ? "on-seesaw" : "on-twins") : ""} />)}
        </span>
        <span className="min-w-0 font-mono text-[11px] font-semibold tracking-[0.04em] text-ink-2 uppercase">
          {t(seesaw ? "wl.pairs.opposite" : "wl.pairs.same", { n: share })}
        </span>
      </div>
      <PairChart a={p.view.lineA} b={p.view.lineB} label={t("wl.pairs.chart", { a: p.a, b: p.b, n: p.view.dates.length })} />
    </li>
  );
}

/** One name of a pair as a little square: ticker, a rolling percent for the floor's day; tap to open its page. */
function PairSquare({ who, moves, color, go, register, t }) {
  const root = useRef(null);
  const tick = useRef(null);
  useEffect(() => {
    const r = root.current;
    if (!r) return undefined;
    const el = { root: r, tint: r.querySelector(".floor-tint"), flash: r.querySelector(".floor-flash"), moves };
    Object.defineProperty(el, "tick", { get: () => tick.current });
    register(el);
    return () => register(null);
  }, [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button ref={root} type="button" onClick={() => go(`stock/${who.symbol}`)} data-tone="none" className="floor-tile pair-square"
      aria-label={t("wl.open", { symbol: who.symbol })}>
      <span aria-hidden="true" className="floor-tint" />
      <span aria-hidden="true" className="floor-flash" />
      <span className="floor-top" aria-hidden="true">
        <span className="floor-sym flex items-center gap-1.5"><span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />{who.symbol}</span>
      </span>
      <TickNumber ref={tick} digits={2} decimals={1} signed suffix="%" group={false} className="floor-pct" />
      <span aria-hidden="true" className="block truncate text-[10.5px] leading-tight text-ink-3">{who.name}</span>
    </button>
  );
}

/** The two names over the last 60 days, each from zero, as two small lines (decorative; the label says what it is). */
function PairChart({ a, b, label }) {
  const W = 200, H = 46;
  const vals = [...a, ...b].filter(isNum);
  if (vals.length < 4) return null;
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const pad = (hi - lo) * 0.1 || 1;
  const y = scaleLinear(lo - pad, hi + pad, H - 2, 2);
  const x = (i, n) => (i / Math.max(1, n - 1)) * W;
  const path = (v) => smoothPath(v.map((p, i) => (isNum(p) ? [x(i, v.length), y(p)] : null)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} className="mt-2 block h-[46px] w-full">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line-2)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={path(a)} fill="none" stroke={LINE[0]} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
      <path d={path(b)} fill="none" stroke={LINE[1]} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
