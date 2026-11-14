import { useCallback, useEffect, useState } from "react";

// Simple or Full: how this device shows the site. Asked once on the first visit (components/easy.jsx ModeChooser),
// remembered here, switchable at any time. null = not chosen yet.
const KEY = "sb:view";
let memo = null; // this visit's choice when storage is blocked (private mode)
const read = () => {
  try { const v = window.localStorage.getItem(KEY); return v === "simple" || v === "full" ? v : memo; } catch { return memo; }
};

export function useView() {
  const [view, setState] = useState(read);
  useEffect(() => {
    const sync = () => setState(read());
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
