import { useCallback, useEffect, useState } from "react";

// Simple or Full, and Swipe on or off: asked every time the app opens (components/easy.jsx ModeChooser). The last
// answers are remembered on the device so the question opens with them already chosen. null = not answered yet.
const KEY = "sb:view";
const SWIPE_KEY = "sb:swipe";
let memo = null; // this visit's answer (the question is asked again on the next open)

/** The answers given last time on this device: {view: "simple" | "full" | null, swipe: boolean}. */
export function lastChoice() {
  try {
    const v = window.localStorage.getItem(KEY);
    return { view: v === "simple" || v === "full" ? v : null, swipe: window.localStorage.getItem(SWIPE_KEY) === "1" };
  } catch { return { view: null, swipe: false }; }
}

/** Remember this open's Swipe answer for next time. */
export function rememberSwipe(on) {
  try { window.localStorage.setItem(SWIPE_KEY, on ? "1" : "0"); } catch { /* storage unavailable */ }
}

export function useView() {
  const [view, setState] = useState(() => memo);
  useEffect(() => {
    const sync = () => setState(memo);
    window.addEventListener("sb-view", sync);
    return () => window.removeEventListener("sb-view", sync);
  }, []);
  const setView = useCallback((v) => {
    memo = v;
    try { window.localStorage.setItem(KEY, v); } catch { /* storage unavailable: this visit only */ }
    setState(v);
    window.dispatchEvent(new Event("sb-view"));
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return [view, setView];
}
