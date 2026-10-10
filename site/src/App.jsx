import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { loadAll, loadManifest, loadMarket } from "./lib/data.js";
import { hashFor, parseHash } from "./lib/nav.js";
import { DEFAULT_MARKET, defaultId, marketData, nasdaqData, pickMarket, switchChoices } from "./lib/markets.js";
import { newerBundle } from "./lib/appversion.js";
import { Field, Footer, Header, Loader, MobileNav, PageIntro } from "./components/shell.jsx";
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

// Every page by its route. The menu (three subjects and their pages) lives in lib/nav.js; routes stay as they were, so
// old links (#insights, #playbook) still open the right page. Routes: a page id, or "stock/<SYMBOL>" for a stock page,
// with "?m=<market>" when a market other than the default is chosen (#today?m=tlv).
const PAGES = {
  today: Today, details: Details, portfolio: Portfolio, playbook: Playbook, people: People, watchlist: Watchlist, track: TrackRecord,
  kb: KB, insights: Insights, learnings: Learnings, runs: Runs, routines: Routines, how: HowItWorks, admin: Admin,
};
// Pages that show synthetic data until the brain (M3) produces real picks.
const SAMPLE_TABS = ["track", "kb", "learnings", "runs"];
// While the page is open, re-check the manifest this often (and when the tab comes back into view, at most once a minute).
const POLL_MS = 10 * 60 * 1000;
const FOCUS_MIN_MS = 60 * 1000;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState(() => parseHash(window.location.hash).route);
  // The market the header switch shows: the hash's (a shared link) or the default, for this visit only.
  const [wanted, setWanted] = useState(() => parseHash(window.location.hash).market);
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

  const markets = data?.markets ?? null;
  const defId = markets ? defaultId(markets) : DEFAULT_MARKET;
  const marketId = markets ? pickMarket(markets, wanted) : (wanted ?? DEFAULT_MARKET);

  // Open a route in a market (the current one unless given); the hash keeps both so the link opens the same view.
  const navigate = useCallback((id, mk = marketId) => {
    if (id === tab && mk === marketId) return;
    const swap = () => {
      setTab(id);
      setWanted(mk);
      const h = hashFor(id, mk, defId);
      if (window.location.hash !== h) history.pushState(null, "", h);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduced && id !== tab) document.startViewTransition(() => flushSync(swap));
    else swap();
  }, [tab, marketId, defId]);
  const go = useCallback((id) => navigate(id), [navigate]);

  // The switch: stay on the page, except a stock page, which belongs to its own market (open the new market's list).
  const chooseMarket = useCallback((id) => {
    if (tab.startsWith("stock/")) { navigate("watchlist", id); return; }
    setWanted(id);
    history.replaceState(null, "", hashFor(tab, id, defId));
  }, [tab, navigate, defId]);
  // A stock page opened for a symbol of another market moves the switch to that market (no new history entry).
  const adoptMarket = useCallback((id) => {
    setWanted(id);
    history.replaceState(null, "", hashFor(tab, id, defId));
  }, [tab, defId]);

  useEffect(() => {
    const on = () => { const h = parseHash(window.location.hash); setTab(h.route); setWanted(h.market); };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);

  // The default market's data is loadAll's (outlook cut to its list); another market's view is fetched on first use.
  const base = useMemo(() => nasdaqData(data), [data]);
  const [other, setOther] = useState({ key: null, state: "loading", view: null });
  const [attempt, setAttempt] = useState(0);
  const otherKey = data && marketId !== defId ? `${data.manifest.built_at}|${marketId}|${attempt}` : null;
  useEffect(() => {
    if (!otherKey) return;
    let live = true;
    setOther({ key: otherKey, state: "loading", view: null });
    loadMarket(data.manifest, marketId, data).then(
      (view) => live && setOther({ key: otherKey, state: view.available ? "ready" : "none", view }),
      () => live && setOther({ key: otherKey, state: "error", view: null }),
    );
    return () => { live = false; };
  }, [otherKey]);
  const otherData = useMemo(() => (other.view ? marketData(base, other.view) : null), [base, other.view]);
  const market = useMemo(() => {
    if (!data) return null;
    const entry = data.markets.find((m) => m.id === marketId) ?? null;
    const isDefault = marketId === defId;
    const st = isDefault ? { state: entry?.available === false ? "none" : "ready", data: base }
      : other.key === otherKey ? { state: other.state, data: otherData } : { state: "loading", data: null };
    return {
      id: marketId, entry, isDefault, defaultId: defId, choices: switchChoices(data.markets), ...st,
      choose: chooseMarket, adopt: adoptMarket, retry: () => setAttempt((n) => n + 1),
    };
  }, [data, marketId, defId, base, other, otherKey, otherData, chooseMarket, adoptMarket]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("sb-theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  };

  const openKB = (q) => { setQuery(q); go("kb"); };
  const symbol = tab.startsWith("stock/") ? tab.slice(6) : null;
  const Active = symbol ? Stock : PAGES[tab];
  const intro = !symbol && tab !== "today";
  const sampleRoutes = data?.sample ? SAMPLE_TABS : [];

  return (
    <>
      <Field />
      <Loader progress={progress} done={Boolean(data || error)} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>
      <Header route={tab} onNav={go} sample={data?.sample} livePrices={data?.livePrices} theme={theme} onTheme={toggleTheme} market={market} sampleRoutes={sampleRoutes} />
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
        {data && intro && <PageIntro route={tab} market={market} />}
        {data && (
          // Under the page's own heading line the page starts closer to the top.
          <div className={intro ? "[&>*:first-child]:pt-10" : ""}>
            <Active key={tab} data={base} market={market} go={go} query={query} setQuery={setQuery} openKB={openKB} symbol={symbol} live={live} checkNow={checkNow} />
          </div>
        )}
      </main>
      {data && <Footer data={data} />}
      {update && (
        <button type="button" onClick={() => window.location.reload()} role="status"
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-50 mx-auto max-w-[420px] rounded-2xl border border-accent/60 bg-surface px-5 py-4 text-left text-[16px] leading-snug text-ink shadow-xl sm:bottom-6">
          <span className="block font-semibold text-accent">A new version of the app is ready</span>
          <span className="block text-ink-2">Tap here to update</span>
        </button>
      )}
      <MobileNav route={tab} onNav={go} sampleRoutes={sampleRoutes} />
    </>
  );
}
