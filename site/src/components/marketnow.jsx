import { useEffect, useMemo, useState } from "react";
import { fearNeedle, headingOf, newsOf, pulseOf, realMoneyKey } from "../lib/marketnow.js";
import { ago } from "../lib/feed.js";
import { loadMarket } from "../lib/data.js";
import { fmtDate } from "../lib/format.js";
import { strings } from "../lib/text.js";
import dict from "../text/home.js";

/*
 * Market now: Home's first screen, built for "I open the app at any hour: what is going on?". Five cards, top to
 * bottom, in plain words: the mood (one sentence and the index funds), the fear dial, where we are heading (with what
 * to do with real money), what moved and why, and the news. It reads the hourly pulse (lib/marketnow.js) during the
 * US session and the last close otherwise, and always says which one it shows and when. Moves only, never a price.
 */

const t = strings(dict);
const pct = (v) => (Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%` : "–");
const tone = (v) => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");
const day = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "");
const nyTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  return now;
}

export function MarketNow({ data, go, openTo, market }) {
  const now = useMinute();
  const pulse = useMemo(() => pulseOf(data, now), [data, now]);
  const heading = useMemo(() => headingOf(data), [data]);
  const news = useMemo(() => newsOf(data, 10), [data]);
  const next = data?.buyWindow?.next_weekly_buy ?? null;
  const lead = pulse.indexes[pulse.indexes.length - 1] ?? null; // the benchmark (Nasdaq-100 fund) last
  return (
    <section className="now" aria-labelledby="now-h">
      <header className="now-top">
        <h1 id="now-h" className="now-title">{t("now.title")}</h1>
        <span className="now-stamp" data-live={pulse.source === "live" && pulse.fresh ? "1" : "0"}>
          <span className="now-dot" aria-hidden="true" />
          {pulse.source === "live"
            ? t(pulse.fresh ? "now.updated" : "now.updatedOld", { time: nyTime(pulse.at), ago: ago(pulse.at, now) })
            : pulse.at ? t("now.close", { day: day(pulse.at) }) : t("now.noData")}
        </span>
      </header>

      <MyList data={data} pulse={pulse} go={go} openTo={openTo} market={market} />

      <div className="now-grid">
        <article className="now-card now-mood" data-mood={pulse.mood}>
          <p className="now-eyebrow">{t("now.moodEyebrow")}</p>
          <p className="now-big">{t(`now.mood.${pulse.mood}`)}</p>
          <ul className="now-idx">
            {pulse.indexes.map((i) => (
              <li key={i.symbol}><span>{i.name}</span><b data-tone={tone(i.move)}>{pct(i.move)}</b></li>
            ))}
          </ul>
          {pulse.breadth.n > 0 && (
            <div className="now-breadth" aria-label={t("now.breadth", { up: pulse.breadth.up, n: pulse.breadth.n })}>
              <div className="now-bar"><i style={{ width: `${(pulse.breadth.up / pulse.breadth.n) * 100}%` }} /></div>
              <p>{t("now.breadth", { up: pulse.breadth.up, n: pulse.breadth.n })}</p>
            </div>
          )}
        </article>

        <FearCard fear={pulse.fear} heading={heading} />

        <article className="now-card now-head" data-trend={heading.trend}>
          <p className="now-eyebrow">{t("now.headEyebrow")}</p>
          <p className="now-big">{t(`now.trend.${heading.trend}`)}</p>
          <p className="now-line">{t(`now.risk.${heading.risk}`)}</p>
          {heading.above50 != null && <p className="now-line">{t("now.above50", { pct: Math.round(heading.above50) })}</p>}
          <div className="now-money">
            <p className="now-money-h">{t("now.moneyH")}</p>
            <p>{t(`now.money.${realMoneyKey(pulse, heading)}`)}</p>
            {next && <p className="now-money-next">{t("now.nextBuy", { day: day(next) })}</p>}
          </div>
        </article>
      </div>

      <article className="now-card now-movers">
        <div className="now-row-h">
          <p className="now-eyebrow">{t("now.moversEyebrow")}</p>
          <button type="button" className="now-more" onClick={() => go("watchlist")}>{t("now.allStocks")} →</button>
        </div>
        <ul>
          {pulse.movers.map((m) => (
            <li key={m.symbol}>
              <button type="button" className="now-mover" onClick={() => openTo(`stock/${m.symbol}`)}>
                <span className="now-sym">{m.symbol}</span>
                <span className="now-name">
                  <span>{m.name}</span>
                  {m.headline && <small>{m.headline}</small>}
                </span>
                <b className="now-pill" data-tone={tone(m.move)}>{pct(m.move)}</b>
              </button>
            </li>
          ))}
        </ul>
        {lead && <p className="now-foot">{t("now.moversFoot")}</p>}
      </article>

      {news.length > 0 && (
        <article className="now-card now-news">
          <p className="now-eyebrow">{t(news[0].kind === "market" ? "now.newsEyebrow" : "now.whyEyebrow")}</p>
          <ul>
            {news.map((n, i) => (
              <li key={`${n.url ?? n.headline}-${i}`}>
                {n.url ? (
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="now-news-item">
                    <span className="now-news-head">{n.headline}</span>
                    <span className="now-news-meta">{[n.source, n.at ? ago(new Date(n.at * 1000).toISOString(), now) : n.day].filter(Boolean).join(" · ")} ↗</span>
                  </a>
                ) : (
                  <button type="button" className="now-news-item" onClick={() => n.symbol && openTo(`stock/${n.symbol}#why-it-moved`)}>
                    <span className="now-news-head">{n.headline}</span>
                    <span className="now-news-meta">{[n.symbol, n.day].filter(Boolean).join(" · ")}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </article>
      )}
      <p className="now-note">{t("now.note")}</p>
    </section>
  );
}

/** The fear dial: a half circle from calm to panic, the needle at the fear fund's move today. */
function FearCard({ fear, heading }) {
  const needle = fearNeedle(fear?.move);
  const level = fear?.level ?? null;
  const angle = needle == null ? null : -90 + needle * 180;
  return (
    <article className="now-card now-fear" data-level={level ?? "none"}>
      <p className="now-eyebrow">{t("now.fearEyebrow")}</p>
      <svg viewBox="0 0 200 112" className="now-dial" role="img" aria-label={level ? t(`now.fear.${level}`) : t("now.fearNone")}>
        <defs>
          <linearGradient id="now-dial-g" x1="0" x2="1">
            <stop offset="0" stopColor="var(--up)" /><stop offset="0.5" stopColor="var(--wait)" /><stop offset="1" stopColor="var(--down)" />
          </linearGradient>
        </defs>
        <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="url(#now-dial-g)" strokeWidth="14" strokeLinecap="round" opacity={angle == null ? 0.3 : 1} />
        {angle != null && (
          <g className="now-needle" style={{ transform: `rotate(${angle}deg)` }}>
            <line x1="100" y1="100" x2="100" y2="30" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        <circle cx="100" cy="100" r="8" fill="var(--ink)" />
      </svg>
      <p className="now-big now-fear-word">{level ? t(`now.fear.${level}`) : t(`now.risk.${heading.risk}`)}</p>
      <p className="now-line">
        {fear ? t("now.fearLine", { symbol: fear.symbol, move: pct(fear.move) }) : t("now.fearNone")}
      </p>
    </article>
  );
}

/** The owner's own watchlist (the "mine" market): every name's move today, best first; the hourly pulse while fresh,
 * else the last close of that list. Tapping a name opens its page. */
const MINE = "mine";
function MyList({ data, pulse, go, openTo, market }) {
  const [view, setView] = useState(null);
  const has = (data?.markets ?? []).some((m) => m.id === MINE);
  useEffect(() => {
    if (!has) return undefined;
    let on = true;
    loadMarket(data.manifest, MINE, data).then((v) => { if (on) setView(v); }).catch(() => {});
    return () => { on = false; };
  }, [has, data]);
  if (!has || !view?.watchlist) return null;
  const liveMove = new Map(pulse.source === "live" && pulse.fresh ? (data.live?.symbols ?? []).map((r) => [r.symbol, r.move_pct]) : []);
  const close = new Map((view.market?.symbols ?? []).map((r) => [r.symbol, r.change_1d_pct]));
  const rows = view.watchlist.symbols.map((s) => {
    const m = liveMove.has(s.symbol) ? liveMove.get(s.symbol) : close.get(s.symbol);
    return { symbol: s.symbol, name: s.name, move: Number.isFinite(m) ? m : null };
  }).sort((a, b) => (b.move ?? -1e9) - (a.move ?? -1e9));
  const up = rows.filter((r) => r.move > 0).length;
  const known = rows.filter((r) => r.move != null).length;
  return (
    <article className="now-card now-mine">
      <div className="now-row-h">
        <p className="now-eyebrow">{t("now.mineEyebrow")}</p>
        <button type="button" className="now-more" onClick={() => go("watchlist", MINE)}>{t("now.mineAll")} →</button>
      </div>
      {known > 0 && <p className="now-line">{t("now.mineLine", { up, n: known })}</p>}
      <ul className="now-mine-grid">
        {rows.map((r) => (
          <li key={r.symbol}>
            <button type="button" className="now-tile" data-tone={r.move == null ? "none" : tone(r.move)} onClick={() => openTo(`stock/${r.symbol}`)} title={r.name}>
              <span className="now-tile-sym">{r.symbol}</span>
              <b className="now-tile-move">{r.move == null ? "–" : pct(r.move)}</b>
            </button>
          </li>
        ))}
      </ul>
      {known === 0 && <p className="now-foot">{t("now.mineSoon")}</p>}
    </article>
  );
}
