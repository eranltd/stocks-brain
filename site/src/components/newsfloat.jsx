import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "../lib/motion.js";
import { NEWS_KIND, shortDay } from "../lib/secnews.js";
import { strings } from "../lib/text.js";
import { noteView, usableWhy } from "../lib/why.js";
import dict from "../text/shell.js";
import { usePageVisible } from "./motion.jsx";
import { useAgentStop } from "./agentfeed.jsx";

/*
 * The news float: one real news item at a time, bottom left (above the phone's bottom bar), changing every few
 * seconds, in a shuffled order: a "why it moved" note (our own words, with linked sources) or an official SEC filing
 * in plain words, from any stock on any list. Tap it to open that stock's page at the item. Hovering holds it; × hides
 * it for this visit. Nothing under reduced motion.
 */

const t = strings(dict);
const EVERY_MS = 9000;
const OFF_KEY = "sb:news-off";
const SEC_DAYS = 45;

// The filings worth a glance: results, heads-ups, deals, money and people (not routine reports or updates).
const SEC_KINDS = new Set(["results", "warning", "deal", "money", "people"]);

/** Shuffled, then nudged so the same stock never shows twice in a row. */
const shuffle = (xs) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 1; i < a.length; i++) {
    if (a[i].symbol !== a[i - 1].symbol) continue;
    const j = a.findIndex((x, k) => k > i && x.symbol !== a[i - 1].symbol);
    if (j > 0) [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** "TAIWAN SEMICONDUCTOR MANUFACTURING CO LTD" reads as "Taiwan Semiconductor Manufacturing Co Ltd". */
const calm = (s) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);

/** Every news item worth a glance: why-it-moved notes about one name, and recent SEC filings, shuffled. */
function useNewsPool(data) {
  return useMemo(() => {
    const out = [];
    const names = data?.names ?? {};
    const why = usableWhy(data?.why, Boolean(data?.livePrices));
    for (const note of why?.notes ?? []) {
      const v = noteView(note, { names });
      const symbol = v.symbols[0];
      if (!symbol || !v.headline || v.kind === "sector") continue;
      out.push({ id: `why:${v.key}`, kind: "why", symbol, who: v.who, title: v.headline, day: v.day, move: v.move_pct, badge: t("news.why"), section: "why-it-moved" });
    }
    const sec = data?.secNews && !(data.secNews.sample && data.livePrices) ? data.secNews : null;
    const asOf = sec?.as_of ? new Date(`${sec.as_of}T00:00:00Z`) : null;
    for (const c of sec?.companies ?? []) {
      for (const f of (c.filings ?? []).slice(0, 3)) {
        if (!f.titles?.[0] || !SEC_KINDS.has(f.kind) || (asOf && (asOf - new Date(`${f.date}T00:00:00Z`)) / 864e5 > SEC_DAYS)) continue;
        out.push({ id: `sec:${c.symbol}:${f.date}:${f.form}`, kind: "sec", symbol: c.symbol, who: names[c.symbol] ?? calm(c.name) ?? c.symbol, title: f.titles[0],
          day: shortDay(f.date), badge: NEWS_KIND[f.kind]?.word ?? t("news.sec"), section: "official-news" });
      }
    }
    return shuffle(out);
  }, [data]);
}

const readOff = () => { try { return window.sessionStorage.getItem(OFF_KEY) === "1"; } catch { return false; } };

export default function NewsFloat({ data, go }) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const pool = useNewsPool(data);
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [off, setOff] = useState(readOff);
  const [shown, setShown] = useState(false);
  const [stopped] = useAgentStop();

  // Wait a few seconds after the page opens, then start.
  useEffect(() => { const id = setTimeout(() => setShown(true), 4000); return () => clearTimeout(id); }, []);
  useEffect(() => {
    if (!shown || off || hold || !visible || pool.length < 2) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % pool.length), EVERY_MS);
    return () => clearInterval(id);
  }, [shown, off, hold, visible, pool.length]);

  if (reduced || off || stopped || !shown || !pool.length) return null;
  const x = pool[i % pool.length];
  const open = () => {
    go(`stock/${x.symbol}`);
    let tries = 0;
    const seek = () => {
      const el = document.getElementById(x.section);
      if (el) el.scrollIntoView({ block: "start" });
      else if (++tries < 40) setTimeout(seek, 60);
    };
    setTimeout(seek, 60);
  };
  const close = () => { try { window.sessionStorage.setItem(OFF_KEY, "1"); } catch { /* this view only */ } setOff(true); };

  return (
    <aside className="news-float" aria-label={t("news.label")} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <button key={x.id} type="button" className="news-card" data-kind={x.kind} onClick={open}>
        <span className="news-head">
          <span className="news-dot" aria-hidden="true" />
          <span className="news-badge">{x.badge}</span>
          <b>{x.symbol}</b>
          {Number.isFinite(x.move) && <span className="news-move" data-tone={x.move > 0 ? "up" : x.move < 0 ? "down" : "flat"}>{`${x.move > 0 ? "+" : x.move < 0 ? "−" : ""}${Math.abs(x.move).toFixed(1)}%`}</span>}
          <span className="ms-auto text-ink-3">{x.day}</span>
        </span>
        <span className="news-title">{x.title}</span>
        <span className="news-foot"><span className="truncate">{x.who}</span><span className="news-more">{t("news.more")} <span aria-hidden="true">→</span></span></span>
        {!hold && <span className="news-timer" aria-hidden="true" style={{ animationDuration: `${EVERY_MS}ms` }} />}
      </button>
      <button type="button" className="news-x" onClick={close} aria-label={t("news.hide")}>×</button>
    </aside>
  );
}
