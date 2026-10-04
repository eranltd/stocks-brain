import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { loadAll } from "./lib/data.js";
import { Field, Footer, Header, Loader } from "./components/shell.jsx";
import { Container } from "./components/ui.jsx";
import Today from "./tabs/Today.jsx";
import Watchlist from "./tabs/Watchlist.jsx";
import TrackRecord from "./tabs/TrackRecord.jsx";
import KB from "./tabs/KB.jsx";
import Insights from "./tabs/Insights.jsx";
import Learnings from "./tabs/Learnings.jsx";
import Runs from "./tabs/Runs.jsx";
import Routines from "./tabs/Routines.jsx";
import HowItWorks from "./tabs/HowItWorks.jsx";
import Admin from "./tabs/Admin.jsx";

const TABS = [
  { id: "today", label: "Today", C: Today },
  { id: "watchlist", label: "Watchlist", C: Watchlist },
  { id: "track", label: "Track record", C: TrackRecord },
  { id: "kb", label: "KB", C: KB },
  { id: "insights", label: "Insights", C: Insights },
  { id: "learnings", label: "Learnings", C: Learnings },
  { id: "runs", label: "Runs", C: Runs },
  { id: "routines", label: "Routines", C: Routines },
  { id: "how", label: "How it works", C: HowItWorks },
  { id: "admin", label: "Admin", C: Admin },
];
const fromHash = () => {
  const h = window.location.hash.replace("#", "");
  return TABS.some((t) => t.id === h) ? h : "today";
};

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState(fromHash);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");

  useEffect(() => {
    const t0 = performance.now();
    loadAll(setProgress)
      .then((d) => setTimeout(() => setData(d), Math.max(0, 700 - (performance.now() - t0))))
      .catch((e) => setError(e));
  }, []);

  const go = useCallback((id) => {
    if (id === tab) return;
    const swap = () => {
      setTab(id);
      if (window.location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduced) document.startViewTransition(() => flushSync(swap));
    else swap();
  }, [tab]);

  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("sb-theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  };

  const openKB = (q) => { setQuery(q); go("kb"); };
  const Active = TABS.find((t) => t.id === tab).C;

  return (
    <>
      <Field />
      <Loader progress={progress} done={Boolean(data || error)} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>
      <Header tabs={TABS} active={tab} onNav={go} sample={data?.sample} livePrices={data?.livePrices} theme={theme} onTheme={toggleTheme} />
      <main id="main" className="relative min-h-[70vh] [view-transition-name:main]">
        {error && (
          <Container className="py-24">
            <div className="card p-8">
              <div className="eyebrow mb-3 text-down">Could not load data</div>
              <p className="text-ink-2">{String(error.message || error)}</p>
              <p className="mt-3 text-ink-2">Locally, export the data first: <code className="font-mono text-ink">python3 scripts/build_site.py</code>, then <code className="font-mono text-ink">cd site && npm run dev</code>.</p>
            </div>
          </Container>
        )}
        {data && <Active key={tab} data={data} go={go} query={query} setQuery={setQuery} openKB={openKB} />}
      </main>
      {data && <Footer data={data} />}
    </>
  );
}
