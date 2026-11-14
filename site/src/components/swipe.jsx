import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDeck } from "../lib/swipe.js";
import { lightOf, moveWord, plainIndex } from "../lib/easy.js";
import { headingOf, pulseOf, realMoneyKey } from "../lib/marketnow.js";
import { loadMarket, OWN_LIST } from "../lib/data.js";
import { strings } from "../lib/text.js";
import { Spark, TrafficLight } from "./easyart.jsx";
import { useScrollLock } from "./shell.jsx";
import dict from "../text/swipe.js";

/*
 * Swipe mode: the day as a feed of full-screen cards, the way short-video apps work: swipe up or left for the next,
 * down or right to go back.
 * The first card is the market (a traffic light and what to do), then one card per stock, the owner's own list first,
 * biggest move today first (lib/swipe.js), then "all caught up". Native scroll snapping does the swiping (no custom
 * drag code); arrow keys and Page Up/Down work too. Each stock card opens its full story. Toggled from the top bar like
 * dark mode. Moves only, never a price.
 */

const t = strings(dict);
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const tone = (v) => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");

/** The top-bar button that turns Swipe mode on and off (beside the dark-mode button). */
export function SwipeButton({ on, onToggle, className = "" }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on} aria-label={t(on ? "btn.off" : "btn.on")} title={t(on ? "btn.off" : "btn.on")}
      className={`swipe-btn ${on ? "is-on" : ""} ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="8.5" y="4" width="11" height="15" rx="2.2" transform="rotate(10 14 11.5)" />
        <rect x="4.5" y="5" width="11" height="15" rx="2.2" fill="var(--surface)" />
        <path d="M8 12.5h4M10.5 10l2.5 2.5-2.5 2.5" stroke="var(--desk)" />
      </svg>
    </button>
  );
}

export function SwipeMode({ data, onClose, onOpen }) {
  useScrollLock(true);
  const [mine, setMine] = useState(null);
  useEffect(() => {
    let on = true;
    if ((data?.markets ?? []).some((m) => m.id === OWN_LIST && m.available)) {
      loadMarket(data.manifest, OWN_LIST, data).then((v) => { if (on) setMine(v); }).catch(() => {});
    }
    return () => { on = false; };
  }, [data]);
  const stocks = useMemo(() => buildDeck({
    lists: [mine, { watchlist: data.watchlist, market: data.market }].filter(Boolean),
    outlook: data.outlookAll ?? data.outlook, flows: data.flows, themes: data.themes, funds: data.funds, companies: data.companies,
  }), [mine, data]);
  const total = stocks.length + 2; // the market, the stocks, the end
  const feed = useRef(null);
  const [i, setI] = useState(0);
  // Which card fills the screen: the scroll position over one card's height (each card is the feed's full height).
  const onScroll = () => {
    const el = feed.current;
    if (el) setI(Math.min(total - 1, Math.round(el.scrollTop / Math.max(1, el.clientHeight))));
  };
  // Left and right flicks move too (up/down is the feed's own scroll): left = next, right = back.
  const touch = useRef(null);
  const onTouchStart = (e) => { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY }; };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null;
    const p = e.changedTouches[0];
    if (!s || !p) return;
    const dx = p.clientX - s.x, dy = p.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) to(i + (dx < 0 ? 1 : -1));
  };
  const to = useCallback((n) => {
    const el = feed.current;
    if (el) el.scrollTo({ top: Math.max(0, Math.min(total - 1, n)) * el.clientHeight, behavior: "smooth" });
  }, [total]);
  useEffect(() => {
    feed.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); to(i + 1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); to(i - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, to, onClose]);

  return (
    <div className="swipe" role="dialog" aria-modal="true" aria-labelledby="swipe-h">
      <div className="swipe-top">
        <h2 id="swipe-h" className="swipe-title">{t("title")}</h2>
        <span className="swipe-count">{t("count", { i: i + 1, n: total })}</span>
        <button type="button" className="swipe-close" onClick={onClose}>{t("close")}</button>
        <div className="swipe-dots" aria-hidden="true"><i style={{ width: `${((i + 1) / total) * 100}%` }} /></div>
      </div>
      <div ref={feed} className="swipe-feed" tabIndex={-1} onScroll={onScroll} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* data-on marks the card on screen, so its entrance animation plays when it arrives (index.css). */}
        <section className="swipe-slide" data-on={i === 0 ? "" : undefined}><MarketCard data={data} /><Hint show={i === 0} /></section>
        {stocks.map((c, k) => <section key={c.symbol} className="swipe-slide" data-on={i === k + 1 ? "" : undefined}><StockCard c={c} onOpen={onOpen} /></section>)}
        <section className="swipe-slide" data-on={i === total - 1 ? "" : undefined}>
          <div className="swipe-card swipe-done">
            <p className="swipe-done-h">{t("done.h")}</p>
            <p className="swipe-done-sub">{t("done.sub", { n: stocks.length })}</p>
            <button type="button" className="swipe-again" onClick={() => to(0)}>{t("again")}</button>
            <button type="button" className="swipe-close swipe-close-big" onClick={onClose}>{t("done.close")}</button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** "Swipe up" under the first card, until the reader moves on. */
function Hint({ show }) {
  if (!show) return null;
  return (
    <p className="swipe-hint" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l6-6 6 6" /></svg>
      {t("hint")}
    </p>
  );
}

/** The first card: is the market OK today, and what to do. */
function MarketCard({ data }) {
  const pulse = useMemo(() => pulseOf(data, new Date()), [data]);
  const light = lightOf(pulse);
  const lead = pulse.indexes[pulse.indexes.length - 1] ?? pulse.indexes[0] ?? null;
  return (
    <article className="swipe-card swipe-market" data-light={light.light}>
      <p className="swipe-kicker">{t("market.kicker")}</p>
      <div className="swipe-market-row">
        <TrafficLight light={light.light} />
        <div>
          <p className="swipe-name">{t(`light.${light.light}`)}</p>
          <p className="swipe-word">{t(`light.say.${light.key}`)}</p>
        </div>
      </div>
      {lead && Number.isFinite(lead.move) && <p className="swipe-about">{t("market.lead", { name: plainIndex(lead.name), move: pct(lead.move) })}</p>}
      {pulse.breadth.n > 0 && (
        <div className="swipe-breadth">
          <p className="swipe-about">{t("market.breadth", { up: pulse.breadth.up, n: pulse.breadth.n })}</p>
          <div className="swipe-breadth-bar" aria-hidden="true">
            <i data-k="up" style={{ flexGrow: pulse.breadth.up }} /><i data-k="down" style={{ flexGrow: Math.max(0, pulse.breadth.n - pulse.breadth.up) }} />
          </div>
          <p className="swipe-breadth-key"><span data-k="up">{t("market.up", { n: pulse.breadth.up })}</span><span data-k="down">{t("market.down", { n: pulse.breadth.n - pulse.breadth.up })}</span></p>
        </div>
      )}
      <div className="swipe-facts"><span><b>{t(`do.${realMoneyKey(pulse, headingOf(data))}`)}</b></span></div>
    </article>
  );
}

function StockCard({ c, onOpen }) {
  return (
    <article className="swipe-card" data-tone={tone(c.move)}>
      <div className="swipe-card-head">
        <div className="min-w-0">
          <p className="swipe-name">{c.name}</p>
          <p className="swipe-sym">{c.symbol}</p>
        </div>
        {c.moat && <span className="swipe-moat" data-moat={c.moat.level}>{t(`moat.${c.moat.level}`)}</span>}
      </div>
      {c.what && <p className="swipe-what">{c.what}</p>}
      <p className="swipe-move" data-tone={tone(c.move)}>{pct(c.move)}</p>
      <p className="swipe-word">{t("today", { word: t(`move.${moveWord(c.move)}`) })}</p>
      {c.spark && c.spark.length > 1 && (
        <div className="swipe-chart">
          <Spark points={c.spark} tone={tone(c.spark[c.spark.length - 1] - c.spark[0])} className="swipe-chart-svg" />
          <small>{t("spark")} · {pct(c.spark[c.spark.length - 1] - c.spark[0])}</small>
        </div>
      )}
      {c.about && c.about !== c.what && <p className="swipe-about">{c.about}</p>}
      <div className="swipe-facts">
        {c.analysts && <span><b>{t("analysts", { buy: c.analysts.buy, n: c.analysts.n })}</b></span>}
        {c.moat && <span>{t("theme", { theme: c.moat.theme })}</span>}
      </div>
      {onOpen && <button type="button" className="swipe-read" onClick={() => onOpen(c.symbol)}>{t("read")} →</button>}
    </article>
  );
}
