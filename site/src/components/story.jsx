import { useMemo } from "react";
import { moveWord, storyOf } from "../lib/story.js";
import { fmtDate } from "../lib/format.js";
import { strings } from "../lib/text.js";
import dict from "../text/stock.js";

/*
 * The story: the top of a stock's page tells what is going on with it in five short chapters, in plain words (today,
 * the trend, what is coming, what the news says, what the system thinks); every detail stays in the sections below,
 * one tap away. lib/story.js builds the chapters. Moves only, never a price.
 */

const t = strings(dict);
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const tone = (v) => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");
const day = (iso) => (iso ? fmtDate(iso).replace(/\s\d{4}$/, "") : "");
const ICON = { today: "◉", trend: "↗", coming: "◷", news: "✎", system: "✦" };

export function StoryPanel({ symbol, name, row, data, notes, card, call, buyTone, today, jump }) {
  const chapters = useMemo(() => storyOf({
    symbol, row, live: data?.live, notes: notes.map((n) => ({ headline: n.headline, date: n.market_date })), card, call, buyTone, today,
  }), [symbol, row, data?.live, notes, card, call, buyTone, today]);
  if (!chapters.length) return null;
  return (
    <section id="story" className="story" aria-labelledby="story-h">
      <h2 id="story-h" className="story-title">{t("story.title", { name })}</h2>
      <ol className="story-list">
        {chapters.map((c, i) => (
          <li key={c.id} className="story-ch" data-id={c.id} style={{ animationDelay: `${i * 70}ms` }}>
            <span className="story-icon" aria-hidden="true">{ICON[c.id]}</span>
            <div className="min-w-0">
              <p className="story-h">{t(`story.${c.id}.h`)}</p>
              <Chapter c={c} jump={jump} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Chapter({ c, jump }) {
  if (c.id === "today") {
    return (
      <>
        <p className="story-p">
          <b className="story-move" data-tone={tone(c.move)}>{pct(c.move)}</b>{" "}
          {c.source === "live" ? t("story.today.live") : t("story.today.close", { day: day(c.date) })}
        </p>
        {c.why && (c.url
          ? <a className="story-sub story-link" href={c.url} target="_blank" rel="noopener noreferrer">{c.why} ↗</a>
          : <p className="story-sub">{c.why}</p>)}
      </>
    );
  }
  if (c.id === "trend") {
    const parts = [
      c.month != null && t(`story.trend.month.${moveWord(c.month)}`, { pct: pct(c.month), abs: `${Math.abs(c.month).toFixed(1)}%` }),
      c.year != null && t(`story.trend.year.${moveWord(c.year, 20)}`, { pct: pct(c.year), abs: `${Math.abs(c.year).toFixed(1)}%` }),
    ].filter(Boolean);
    return (
      <>
        <p className="story-p">{parts.join(" ")}</p>
        <p className="story-sub">
          {[c.fromHigh != null && c.fromHigh < -1 ? t("story.trend.fromHigh", { pct: Math.round(-c.fromHigh) }) : c.fromHigh != null ? t("story.trend.atHigh") : null,
            c.vsMarket != null ? t(c.vsMarket >= 0 ? "story.trend.beat" : "story.trend.lag", { pct: Math.abs(c.vsMarket).toFixed(1) }) : null].filter(Boolean).join(" ")}
        </p>
      </>
    );
  }
  if (c.id === "coming") {
    return (
      <button type="button" className="story-btn" onClick={() => jump("whats-next")}>
        <p className="story-p">
          {c.date && !c.passed ? t(c.days === 0 ? "story.coming.today" : c.days === 1 ? "story.coming.tomorrow" : "story.coming.in", { n: c.days, day: day(c.date) })
            : c.passed ? t("story.coming.passed", { day: day(c.date) }) : t("story.coming.unknown")}
        </p>
        <p className="story-sub">{c.date && !c.passed && c.days <= 14 ? t("story.coming.big") : c.note ?? t("story.coming.see")}</p>
      </button>
    );
  }
  if (c.id === "news") {
    return (
      <button type="button" className="story-btn" onClick={() => jump(c.headline ? "why-it-moved" : "whats-next")}>
        {c.headline && <p className="story-p">{c.headline}{c.date ? <span className="story-date"> · {day(c.date)}</span> : null}</p>}
        {c.plain && <p className={c.headline ? "story-sub" : "story-p"}>{c.plain}</p>}
      </button>
    );
  }
  return (
    <button type="button" className="story-btn" onClick={() => jump("desk-call")}>
      {c.call && <p className="story-p"><b className="story-call" data-call={c.call}>{t(`story.call.${c.call}`)}</b> {t(`story.callWhy.${c.call}`)}</p>}
      {c.buyTone && <p className="story-sub">{t(`story.buy.${c.buyTone}`)}</p>}
    </button>
  );
}
