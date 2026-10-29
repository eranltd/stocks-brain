import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentRun, LEVEL_IDS, levelOf } from "../lib/agent.js";
import { windowed } from "../lib/arena.js";
import { mainListOf } from "../lib/buywindow.js";
import { fmtDate } from "../lib/format.js";
import { useReducedMotion } from "../lib/motion.js";
import { raceData } from "../lib/replay.js";
import { shortName } from "../lib/simple.js";
import { strings } from "../lib/text.js";
import dict from "../text/arena.js";
import { usePageVisible } from "./motion.jsx";

/*
 * The agent feed: the demo trader agent's buys and sells (lib/agent.js) pop up at the top of the screen, so the app
 * feels like an agent at work. While the Arena plays, it sends the trades of the day it is replaying (tabs/Arena.jsx
 * calls showTrade); on every other page a background loop walks the same agent's trades over the past year, one every
 * few seconds. Every pop-up says paper, demo and the day it happened. Off under reduced motion; the reader can switch it
 * off, which this device remembers.
 */

const t = strings(dict);
const FEED_KEY = "sb:agent-feed";
const LEVEL_KEY = "sb:agent-level";
const SHOW_MS = 5200;   // how long one pop-up stays
const GAP_MS = 450;     // a burst of trades comes out one by one
const LOOP_MS = 3600;   // the background loop: one trade every few seconds
const MAX_SHOWN = 3;
const MAX_QUEUE = 6;

const listeners = new Set();
let arenaOwners = 0;

/** Send one trade to the feed: {side, symbol, name, amount, pnl?, move?, date}. */
export function showTrade(trade) {
  for (const fn of listeners) fn(trade);
}

/** While `active`, the Arena owns the feed (its replay sends the trades) and the background loop waits. */
export function useFeedOwner(active) {
  useEffect(() => {
    if (!active) return undefined;
    arenaOwners += 1;
    return () => { arenaOwners -= 1; };
  }, [active]);
}

const readOn = () => { try { return window.localStorage.getItem(FEED_KEY) !== "off"; } catch { return true; } };

/** The reader's on/off switch for the pop-ups, shared by every component that shows it. */
export function useFeedSwitch() {
  const [on, setOnState] = useState(readOn);
  useEffect(() => {
    const sync = () => setOnState(readOn());
    window.addEventListener("sb-agent-feed", sync);
    return () => window.removeEventListener("sb-agent-feed", sync);
  }, []);
  const setOn = useCallback((v) => {
    try { window.localStorage.setItem(FEED_KEY, v ? "on" : "off"); } catch { /* storage unavailable: this visit only */ }
    setOnState(v);
    window.dispatchEvent(new Event("sb-agent-feed"));
  }, []);
  return [on, setOn];
}

const readLevel = () => { try { const v = window.localStorage.getItem(LEVEL_KEY); return LEVEL_IDS.includes(v) ? v : "medium"; } catch { return "medium"; } };

/** The agent's risk level (easy, medium, hard), shared by the Arena and the pop-ups; this device remembers it. */
export function useAgentLevel() {
  const [level, setLevelState] = useState(readLevel);
  useEffect(() => {
    const sync = () => setLevelState(readLevel());
    window.addEventListener("sb-agent-level", sync);
    return () => window.removeEventListener("sb-agent-level", sync);
  }, []);
  const setLevel = useCallback((v) => {
    try { window.localStorage.setItem(LEVEL_KEY, v); } catch { /* storage unavailable: this visit only */ }
    setLevelState(v);
    window.dispatchEvent(new Event("sb-agent-level"));
  }, []);
  return [level, setLevel];
}

const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const shortDay = (iso) => (iso ? fmtDate(iso).replace(/^\w+,\s/, "").replace(/\s\d{4}$/, "") : "");

/** The demo agent's past year on the main list at a risk level, for the background loop. */
function useYearRun(data, level) {
  return useMemo(() => {
    const race = raceData(data?.market?.symbols, { order: mainListOf(data), bench: data?.bench?.symbol, name: (x) => shortName(x, data.outlook, data.names) });
    const w = race ? windowed(race, 252) : null;
    const run = w ? agentRun(w, levelOf(level)) : null;
    return run?.trades?.length ? { run, dates: w.dates } : null;
  }, [data, level]);
}

/** The pop-ups, fixed under the header on every page. Mounted once (App.jsx). */
export default function AgentFeed({ data, go }) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [on] = useFeedSwitch();
  const live = on && !reduced;
  const [shown, setShown] = useState([]);
  const queue = useRef([]);
  const drain = useRef(0);
  const seq = useRef(0);
  const [level] = useAgentLevel();
  const year = useYearRun(data, level);
  const cursor = useRef(0);

  const release = useCallback(() => {
    drain.current = 0;
    const next = queue.current.shift();
    if (!next) return;
    const id = ++seq.current;
    setShown((s) => [{ ...next, id }, ...s].slice(0, MAX_SHOWN));
    setTimeout(() => setShown((s) => s.filter((x) => x.id !== id)), SHOW_MS);
    if (queue.current.length) drain.current = setTimeout(release, GAP_MS);
  }, []);

  const enqueue = useCallback((trade) => {
    queue.current.push(trade);
    if (queue.current.length > MAX_QUEUE) queue.current.splice(0, queue.current.length - MAX_QUEUE);
    if (!drain.current) drain.current = setTimeout(release, 0);
  }, [release]);

  useEffect(() => {
    if (!live) return undefined;
    listeners.add(enqueue);
    return () => listeners.delete(enqueue);
  }, [live, enqueue]);

  // The background loop: the agent's year of trades, one at a time, while no Arena is playing.
  useEffect(() => {
    if (!live || !visible || !year) return undefined;
    const id = setInterval(() => {
      if (arenaOwners > 0) return;
      const list = year.run.trades;
      const x = list[cursor.current % list.length];
      cursor.current += 1;
      enqueue({ ...x, date: year.dates[x.day] });
    }, LOOP_MS);
    return () => clearInterval(id);
  }, [live, visible, year, enqueue]);

  useEffect(() => () => clearTimeout(drain.current), []);
  useEffect(() => { if (!live) { queue.current = []; setShown([]); } }, [live]);

  if (!shown.length) return null;
  return (
    <div className="agent-feed" role="log" aria-live="off" aria-label={t("agent.feed")}>
      {shown.map((x) => (
        <div key={x.id} className="agent-toast" data-side={x.side}>
          <button type="button" className="agent-toast-body" onClick={() => go(`stock/${x.symbol}`)}>
            <span className="agent-toast-head">
              <span className="agent-toast-dot" aria-hidden="true" />
              {t("agent.toast.head", { day: shortDay(x.date) })}
            </span>
            <span className="agent-toast-main">
              <span className="agent-toast-side">{t(`agent.${x.side}`)}</span>
              <span className="agent-toast-sym">{x.symbol}</span>
              <span className="agent-toast-amt">{Number.isFinite(x.pnl) ? pct(x.pnl) : money(x.amount)}</span>
            </span>
            <span className="agent-toast-sub">
              {t(`agent.toast.${x.side}`, { amount: money(x.amount), move: pct(x.move ?? 0), rank: x.rank ?? "–", cold: x.cold ?? "–", days: x.days ?? 20 })}
            </span>
          </button>
          <button type="button" className="agent-toast-x" aria-label={t("agent.close")} onClick={() => setShown((s) => s.filter((y) => y.id !== x.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
