import { useCallback, useEffect, useRef, useState } from "react";
import { LEVEL_IDS } from "../lib/agent.js";
import { fmtDate } from "../lib/format.js";
import { useReducedMotion } from "../lib/motion.js";
import { strings } from "../lib/text.js";
import dict from "../text/arena.js";

/*
 * The agent feed: the demo trader agent's buys and sells (lib/agent.js) pop up at the top of the screen while its
 * replay plays (tabs/Arena.jsx calls showTrade with the trades of the day it is replaying). It lives in the agent demo
 * tab only (App.jsx mounts it there), so the rest of the site stays calm. Every pop-up says paper, demo and the day it
 * happened. Off under reduced motion; the reader can switch it off, which this device remembers.
 */

const t = strings(dict);
const FEED_KEY = "sb:agent-feed";
const LEVEL_KEY = "sb:agent-level";
const SHOW_MS = 5200;   // how long one pop-up stays
const GAP_MS = 450;     // a burst of trades comes out one by one
const MAX_SHOWN = 3;
const MAX_QUEUE = 6;

const listeners = new Set();

/** Send one trade to the feed: {side, symbol, name, amount, pnl?, move?, date}. */
export function showTrade(trade) {
  for (const fn of listeners) fn(trade);
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

const STOP_KEY = "sb:agent-stopped";
const readStopped = () => { try { return window.localStorage.getItem(STOP_KEY) === "1"; } catch { return false; } };

/**
 * The big STOP: stops the demo agent everywhere (no trades, no pop-ups, the Arena paused) and closes the floating
 * buttons and the news card; a small Start button brings it all back. This device remembers it.
 */
export function useAgentStop() {
  const [stopped, setState] = useState(readStopped);
  useEffect(() => {
    const sync = () => setState(readStopped());
    window.addEventListener("sb-agent-stop", sync);
    return () => window.removeEventListener("sb-agent-stop", sync);
  }, []);
  const setStopped = useCallback((v) => {
    try { window.localStorage.setItem(STOP_KEY, v ? "1" : "0"); } catch { /* storage unavailable: this visit only */ }
    setState(v);
    window.dispatchEvent(new Event("sb-agent-stop"));
  }, []);
  return [stopped, setStopped];
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

/** The pop-ups, fixed under the header of the agent demo tab (App.jsx mounts it there only). */
export default function AgentFeed({ go }) {
  const reduced = useReducedMotion();
  const [on] = useFeedSwitch();
  const [stopped] = useAgentStop();
  const live = on && !stopped && !reduced;
  const [shown, setShown] = useState([]);
  const queue = useRef([]);
  const drain = useRef(0);
  const seq = useRef(0);

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
