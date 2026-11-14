import { useEffect, useMemo, useRef, useState } from "react";
import { easyNews, lightOf, moveWord, myStocks, plainIndex } from "../lib/easy.js";
import { headingOf, newsOf, pulseOf, realMoneyKey } from "../lib/marketnow.js";
import { storyOf } from "../lib/story.js";
import { cardFor, todayISO } from "../lib/outlook.js";
import { notesForSymbol, usableWhy } from "../lib/why.js";
import { loadMarket, OWN_LIST } from "../lib/data.js";
import { ago } from "../lib/feed.js";
import { fmtDate } from "../lib/format.js";
import { strings } from "../lib/text.js";
import { Logo, useScrollLock, Wordmark } from "./shell.jsx";
import { CalendarMark, FullArt, IconCheck, IconFull, IconList, IconMoon, IconNews, IconSimple, IconSun, SimpleArt, Spark, TrafficLight } from "./easyart.jsx";
import dict from "../text/easy.js";
import { lastChoice, rememberSwipe } from "../lib/view.js";
import { SwipeButton, SwipeMode } from "./swipe.jsx";

/*
 * Simple mode: the whole site as one calm screen anyone can read, for the owner's mother as much as for him on a busy
 * day. Built on plain-language and older-adult UX guidance (docs/decisions.md, 2026-11-14): big text (18-20px), big
 * buttons (60px), one column, few choices, every number with words beside it, the answer first and "more" one tap away.
 * Four cards: is the market OK (a traffic light), your stocks, what to do, in the news. A stock opens a simple card.
 * The Full view is one tap away at the top, always. Moves only, never a price.
 */

const t = strings(dict);
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const day = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "");
const tone = (v) => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");
const ARROW = { up: "▲", down: "▼", flat: "■" };

/** The question asked every time the app opens: Simple or Full, and Swipe mode on or off (last answers preselected). */
export function ModeChooser({ onPick }) {
  useScrollLock(true);
  const last = useMemo(() => lastChoice(), []);
  const [swipe, setSwipe] = useState(last.swipe);
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const pick = (v) => { rememberSwipe(swipe); onPick(v, swipe); };
  return (
    <div className="easy-choose" role="dialog" aria-modal="true" aria-labelledby="easy-choose-h">
      <div className="easy-choose-box">
        <p className="easy-brand"><Logo /><Wordmark /></p>
        <h1 id="easy-choose-h" className="easy-choose-h">{t("choose.h")}</h1>
        <button type="button" role="switch" aria-checked={swipe} className="easy-toggle" onClick={() => setSwipe((v) => !v)}>
          <span className="easy-toggle-text"><b>{t("choose.swipe")}</b><span>{t("choose.swipeSub")}</span></span>
          <span className="easy-toggle-track" aria-hidden="true"><i /></span>
        </button>
        <button ref={first} type="button" className="easy-choice" data-last={last.view === "simple" ? "" : undefined} onClick={() => pick("simple")}>
          <SimpleArt />
          <span><b>{t("choose.simple")}</b><span>{t("choose.simpleSub")}</span>{last.view === "simple" && <em>{t("choose.last")}</em>}</span>
        </button>
        <button type="button" className="easy-choice" data-last={last.view === "full" ? "" : undefined} onClick={() => pick("full")}>
          <FullArt />
          <span><b>{t("choose.full")}</b><span>{t("choose.fullSub")}</span>{last.view === "full" && <em>{t("choose.last")}</em>}</span>
        </button>
      </div>
    </div>
  );
}

/** A small button that switches to Simple (on Home and in the header) or to Full (in Simple). */
export function ViewSwitch({ to, onView, className = "" }) {
  return (
    <button type="button" className={`easy-switch ${className}`} onClick={() => onView(to)}>
      {to === "simple" ? <IconSimple /> : <IconFull />}{t(to === "simple" ? "switch.toSimple" : "switch.toFull")}
    </button>
  );
}

/** The whole Simple site. */
export function SimpleApp({ data, onView, theme, onTheme, swipe, setSwipe }) {
  const now = useMemo(() => new Date(), [data]);
  const pulse = useMemo(() => pulseOf(data, now), [data, now]);
  const heading = useMemo(() => headingOf(data), [data]);
  const light = lightOf(pulse);
  const [mine, setMine] = useState(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    let on = true;
    const has = (data?.markets ?? []).some((m) => m.id === OWN_LIST && m.available);
    if (!has) return undefined;
    loadMarket(data.manifest, OWN_LIST, data).then((v) => { if (on) setMine(v); }).catch(() => {});
    return () => { on = false; };
  }, [data]);
  // Your stocks: My list when it has numbers, else the main list.
  const view = mine?.market ? mine : { watchlist: data.watchlist, market: data.market, names: data.names };
  const liveRows = pulse.source === "live" && pulse.fresh ? data.live?.symbols : null;
  const stocks = useMemo(() => myStocks(view.watchlist?.symbols, view.market?.symbols, liveRows), [view, liveRows]);
  const news = useMemo(() => {
    const own = easyNews(data?.live, stocks.rows.map((r) => r.symbol), 3);
    return own.length ? own : newsOf(data, 3);
  }, [data, stocks]);
  const lead = pulse.indexes[pulse.indexes.length - 1] ?? pulse.indexes[0] ?? null;
  const next = data?.buyWindow?.next_weekly_buy ?? null;
  // The day the numbers are from: the quotes' own New York date for the hourly pulse, else the last close.
  const nyDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const fromDay = pulse.source === "live" ? (pulse.quotesAt ? nyDay(pulse.quotesAt) : null) : pulse.at;
  const when = pulse.source === "live" && pulse.fresh ? t("when.live", { ago: ago(pulse.at, now) }) : fromDay ? t("when.close", { day: day(fromDay) }) : "";

  return (
    <div className="easy">
      <header className="easy-top">
        <span className="easy-brand"><Logo /><span className="hidden min-[440px]:inline"><Wordmark /></span></span>
        <span className="ms-auto flex items-center gap-2">
          <SwipeButton on={swipe} onToggle={() => setSwipe((v) => !v)} className="easy-icon" />
          <button type="button" className="easy-icon" onClick={onTheme} aria-label={t(theme === "dark" ? "theme.light" : "theme.dark")}>{theme === "dark" ? <IconSun /> : <IconMoon />}</button>
          <ViewSwitch to="full" onView={onView} />
        </span>
      </header>

      <main className="easy-main" id="main">
        <p className="easy-when">{when}</p>

        <section className="easy-card easy-light" data-light={light.light} aria-labelledby="easy-q1">
          <div className="easy-light-row">
            <TrafficLight light={light.light} />
            <div className="min-w-0">
              <h2 id="easy-q1" className="easy-q">{t("q.ok")}</h2>
              <p className="easy-answer">{t(`light.${light.light}`)}</p>
              <p className="easy-text">{t(`light.say.${light.key}`)}</p>
            </div>
          </div>
          {lead && Number.isFinite(lead.move) && (
            <p className="easy-text">{t("light.lead", { name: plainIndex(lead.name), move: pct(lead.move), word: t(`move.${moveWord(lead.move)}`) })}</p>
          )}
          {light.light === "red" && <p className="easy-calm">{t("light.calm")}</p>}
        </section>

        {stocks.n > 0 && (
          <section className="easy-card" aria-labelledby="easy-q2">
            <h2 id="easy-q2" className="easy-q"><IconList />{t(mine?.market ? "q.mine" : "q.list")}</h2>
            <p className="easy-answer">{t("mine.count", { up: stocks.up, n: stocks.n })}</p>
            <ul className="easy-rows">
              {(all ? stocks.rows : stocks.top).map((r) => (
                <li key={r.symbol}>
                  <button type="button" className="easy-row" onClick={() => setOpen(r.symbol)}>
                    <span className="easy-row-name"><b>{r.name}</b><small>{r.symbol}</small></span>
                    <Spark points={r.spark} tone={tone(r.move)} />
                    <span className="easy-row-move" data-tone={tone(r.move)}>
                      <b>{ARROW[tone(r.move)]} {pct(r.move)}</b><small>{t(`move.${moveWord(r.move)}`)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {stocks.n > 3 && (
              <button type="button" className="easy-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
                {all ? t("mine.less") : t("mine.all", { n: stocks.n })}
              </button>
            )}
          </section>
        )}

        <section className="easy-card easy-todo" aria-labelledby="easy-q3">
          <h2 id="easy-q3" className="easy-q"><IconCheck />{t("q.do")}</h2>
          <p className="easy-answer">{t(`do.${realMoneyKey(pulse, heading)}`)}</p>
          <p className="easy-text">{t("do.why")}</p>
          {next && (
            <div className="easy-next">
              <CalendarMark dow={new Date(`${next}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase()} date={Number(next.slice(8, 10))} />
              <p className="easy-text"><b>{t("do.next", { day: day(next) })}</b></p>
            </div>
          )}
        </section>

        {news.length > 0 && (
          <section className="easy-card" aria-labelledby="easy-q4">
            <h2 id="easy-q4" className="easy-q"><IconNews />{t("q.news")}</h2>
            <ul className="easy-news">
              {news.map((n, i) => (
                <li key={`${n.headline}-${i}`}>
                  {n.url ? (
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="easy-news-item">
                      <b>{n.headline}</b><small>{[n.source, t("news.open")].filter(Boolean).join(" · ")}</small>
                    </a>
                  ) : <p className="easy-news-item"><b>{n.headline}</b>{n.day && <small>{n.day}</small>}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="easy-card easy-full" aria-label={t("full.h")}>
          <p className="easy-text">{t("full.text")}</p>
          <ViewSwitch to="full" onView={onView} className="easy-switch-big" />
        </section>
        <p className="easy-foot">{t("foot")}</p>
      </main>

      {swipe && <SwipeMode data={data} onClose={() => setSwipe(false)} onOpen={(s) => { setSwipe(false); setOpen(s); }} />}
      {open && <StockCard data={data} view={view} symbol={open} liveRows={liveRows} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One stock in plain words, as a sheet over the Simple screen. */
function StockCard({ data, view, symbol, liveRows, onClose }) {
  useScrollLock(true);
  const closeBtn = useRef(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const today = todayISO();
  const row = (view.market?.symbols ?? []).find((s) => s.symbol === symbol) ?? (data.market?.symbols ?? []).find((s) => s.symbol === symbol) ?? null;
  const name = (view.watchlist?.symbols ?? []).find((s) => s.symbol === symbol)?.name ?? data.names?.[symbol] ?? symbol;
  const notes = notesForSymbol(usableWhy(data.why, Boolean(data.livePrices)), symbol, { today }).map((n) => ({ headline: n.headline, date: n.market_date }));
  const live = liveRows ? { ...data.live, symbols: liveRows } : null;
  const chapters = storyOf({ symbol, row, live, notes, card: cardFor(data.outlook, symbol), today });
  const get = (id) => chapters.find((c) => c.id === id);
  const d = get("today"), tr = get("trend"), co = get("coming"), nw = get("news");
  return (
    <div className="easy-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="easy-sheet-h">
      <button type="button" className="easy-sheet-back" aria-label={t("card.close")} tabIndex={-1} onClick={onClose} />
      <div className="easy-sheet">
        <div className="easy-sheet-head">
          <h2 id="easy-sheet-h" className="easy-sheet-h">{name}<small>{symbol}</small></h2>
          <button ref={closeBtn} type="button" className="easy-close" onClick={onClose}>{t("card.close")}</button>
        </div>
        {d && (
          <div className="easy-sheet-part">
            <p className="easy-q">{t("card.today")}</p>
            <p className="easy-answer" data-tone={tone(d.move)}>{ARROW[tone(d.move)]} {pct(d.move)} · {t(`move.${moveWord(d.move)}`)}</p>
            {d.why && <p className="easy-text">{d.why}</p>}
          </div>
        )}
        {tr && (
          <div className="easy-sheet-part">
            <p className="easy-q">{t("card.lately")}</p>
            {tr.month != null && <p className="easy-text">{t("card.month", { move: pct(tr.month), word: t(`move.${moveWord(tr.month, "month")}`) })}</p>}
            {tr.year != null && <p className="easy-text">{t("card.year", { move: pct(tr.year), word: t(`move.${moveWord(tr.year, "year")}`) })}</p>}
          </div>
        )}
        {co && co.date && !co.passed && (
          <div className="easy-sheet-part">
            <p className="easy-q">{t("card.coming")}</p>
            <p className="easy-text">{t(co.days <= 1 ? "card.resultsSoon" : "card.results", { n: co.days, day: day(co.date) })}</p>
          </div>
        )}
        {data.companies?.[symbol] && (
          <div className="easy-sheet-part">
            <p className="easy-q">{t("card.what")}</p>
            <p className="easy-text">{data.companies[symbol]}</p>
          </div>
        )}
        {nw && (nw.plain || nw.headline) && (
          <div className="easy-sheet-part">
            <p className="easy-q">{t("card.about")}</p>
            <p className="easy-text">{nw.plain ?? nw.headline}</p>
          </div>
        )}
        <p className="easy-foot">{t("card.foot")}</p>
      </div>
    </div>
  );
}
