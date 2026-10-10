import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { loadAll, loadManifest } from "./lib/data.js";
import { newerBundle } from "./lib/appversion.js";
import { Field, Footer, Header, Loader, MobileNav } from "./components/shell.jsx";
import { Container } from "./components/ui.jsx";
import Today from "./tabs/Today.jsx";
import Details from "./tabs/Details.jsx";
import Portfolio from "./tabs/Portfolio.jsx";
import Playbook from "./tabs/Playbook.jsx";
import People from "./tabs/People.jsx";
import Watchlist from "./tabs/Watchlist.jsx";
import TrackRecord from "./tabs/TrackRecord.jsx";
import KB from "./tabs/KB.jsx";
import Insights from "./tabs/Insights.jsx";
import Learnings from "./tabs/Learnings.jsx";
import Runs from "./tabs/Runs.jsx";
import Routines from "./tabs/Routines.jsx";
import HowItWorks from "./tabs/HowItWorks.jsx";
import Admin from "./tabs/Admin.jsx";
import Stock from "./tabs/Stock.jsx";

const TABS = [
  { id: "today", label: "Today", C: Today },
  { id: "details", label: "Full dashboard", C: Details },
  { id: "portfolio", label: "Portfolio", C: Portfolio },
  { id: "playbook", label: "Playbook", C: Playbook },
  { id: "people", label: "People", C: People },
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
// Tabs that show synthetic data until the brain (M3) produces real picks.
const SAMPLE_TABS = ["track", "kb", "learnings", "runs"];
// Routes: a tab id, or "stock/<SYMBOL>" for a stock page.
// While the page is open, re-check the manifest this often (and when the tab comes back into view, at most once a minute).
const POLL_MS = 10 * 60 * 1000;
const FOCUS_MIN_MS = 60 * 1000;

const fromHash = () => {
  const h = decodeURIComponent(window.location.hash.replace("#", ""));
  if (/^stock\/[A-Z][A-Z0-9.\-]{0,9}$/.test(h)) return h;
  return TABS.some((t) => t.id === h) ? h : "today";
};

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState(fromHash);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  // Live: {checkedAt, checking, fresh (new data just loaded), reload (new data is out but could not be loaded in place)}.
  const [live, setLive] = useState({ checkedAt: null, checking: false, fresh: false, reload: false });
  const built = useRef(null);
  const lastCheck = useRef(0);
  const inFlight = useRef(false); // one check at a time (the poll, focus and "Check now" can coincide)
  const failedBuild = useRef(null); // a build that could not be loaded in place: do not refetch everything for it again
  // A newer version of the site itself (not just new data) is deployed: offer one tap to load it.
  const [update, setUpdate] = useState(false);
  const checkVersion = useCallback(() => { newerBundle().then((n) => { if (n) setUpdate(true); }); }, []);

  useEffect(() => {
    const t0 = performance.now();
    loadAll(setProgress)
      .then((d) => setTimeout(() => { built.current = d.manifest.built_at; lastCheck.current = Date.now(); setData(d); }, Math.max(0, 700 - (performance.now() - t0))))
      .catch((e) => setError(e));
    const v = setTimeout(checkVersion, 3000); // a phone may have opened a saved older copy of the page
    return () => clearTimeout(v);
  }, [checkVersion]);

  // Re-check the manifest; when built_at moved, load the new data in place (no page reload). If that fails (for example a
  // new site version changed the data's shape), keep what is shown and offer a refresh instead.
  const checkNow = useCallback(async () => {
    if (!built.current || inFlight.current) return;
    inFlight.current = true;
    lastCheck.current = Date.now();
    setLive((l) => ({ ...l, checking: true }));
    checkVersion();
    try {
      const m = await loadManifest();
      if (m.built_at === built.current || m.built_at === failedBuild.current) {
        setLive((l) => ({ ...l, checking: false, checkedAt: new Date() }));
        return;
      }
      try {
        const d = await loadAll();
        built.current = d.manifest.built_at;
        setData(d);
        setLive({ checking: false, checkedAt: new Date(), fresh: true, reload: false });
        setTimeout(() => setLive((l) => ({ ...l, fresh: false })), 8000);
      } catch {
        failedBuild.current = m.built_at;
        setLive((l) => ({ ...l, checking: false, checkedAt: new Date(), reload: true }));
      }
    } catch {
      setLive((l) => ({ ...l, checking: false })); // offline: try again on the next tick
    } finally {
      inFlight.current = false;
    }
  }, [checkVersion]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") checkNow(); };
    const back = () => { if (document.visibilityState === "visible" && Date.now() - lastCheck.current > FOCUS_MIN_MS) checkNow(); };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [checkNow]);

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
  const symbol = tab.startsWith("stock/") ? tab.slice(6) : null;
  const navTab = symbol ? "watchlist" : tab;
  const Active = symbol ? Stock : TABS.find((t) => t.id === tab).C;

  return (
    <>
      <Field />
      <Loader progress={progress} done={Boolean(data || error)} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>
      <Header tabs={TABS} active={navTab} onNav={go} sample={data?.sample} livePrices={data?.livePrices} theme={theme} onTheme={toggleTheme} />
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
        {data && <Active key={tab} data={data} go={go} query={query} setQuery={setQuery} openKB={openKB} symbol={symbol} live={live} checkNow={checkNow} />}
      </main>
      {data && <Footer data={data} />}
      {update && (
        <button type="button" onClick={() => window.location.reload()} role="status"
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-50 mx-auto max-w-[420px] rounded-2xl border border-accent/60 bg-surface px-5 py-4 text-left text-[16px] leading-snug text-ink shadow-xl sm:bottom-6">
          <span className="block font-semibold text-accent">A new version of the app is ready</span>
          <span className="block text-ink-2">Tap here to update</span>
        </button>
      )}
      <MobileNav tabs={TABS} active={navTab} onNav={go} sampleTabs={data?.sample ? SAMPLE_TABS : []} />
    </>
  );
}
