import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bottomTap, menuGroups, pageOf, subjectOf, SUBJECTS } from "../lib/nav.js";
import { NASDAQ_ONLY, nasdaqOnlyLine } from "../lib/markets.js";
import { useReducedMotion } from "../lib/motion.js";
import { Container } from "./ui.jsx";

/* ----------------------------------------------------------------- loader */

export function Loader({ progress, done }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 1000);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-bg transition-[clip-path] duration-[900ms] ease-[cubic-bezier(.65,0,.35,1)]"
      style={{ clipPath: done ? "inset(0 0 100% 0)" : "inset(0 0 0 0)" }}
    >
      <div className="grid justify-items-center gap-4">
        <svg viewBox="0 0 120 40" className="h-10 w-[120px] overflow-visible">
          <polyline
            points="2,30 18,24 30,28 46,12 60,18 74,6 88,14 102,8 118,2"
            fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="200" strokeDashoffset="200"
            style={{ animation: "dash 1.4s cubic-bezier(.16,1,.3,1) forwards", filter: "drop-shadow(0 0 8px var(--glow))" }}
          />
        </svg>
        <div className="num font-mono text-[clamp(56px,14vw,112px)] leading-none font-semibold tracking-[-0.06em]">
          {Math.round(progress * 100)}
          <sup className="ml-1 align-top text-[0.3em] text-ink-3">%</sup>
        </div>
        <div className="meta tracking-[0.3em]">loading the brain</div>
      </div>
    </div>
  );
}

/* --------------------------------------------- animated "price field" canvas */

export function Field() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0, t = 0;
    const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };
    const LINES = 16;
    const seeds = Array.from({ length: LINES }, (_, i) => ({ a: 0.6 + ((i * 37) % 11) / 10, b: (i * 1.7) % 6.28, s: 0.25 + ((i * 13) % 7) / 20 }));
    const rgb = () => getComputedStyle(document.documentElement).getPropertyValue("--field").trim() || "110 227 154";

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      const color = rgb().split(/\s+/).join(",");
      ctx.clearRect(0, 0, w, h);
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      for (let i = 0; i < LINES; i++) {
        const { a, b, s } = seeds[i];
        const base = h * (0.12 + (i / LINES) * 0.8);
        ctx.beginPath();
        for (let x = 0; x <= w + 10; x += 12) {
          const n = Math.sin(x * 0.004 * a + t * s + b) * 18 + Math.sin(x * 0.011 + t * s * 1.7 + i) * 7 + Math.sin(x * 0.0017 - t * 0.2 + b) * 26;
          const dx = x - pointer.x, dy = base + n - pointer.y;
          const lens = Math.exp(-(dx * dx + dy * dy) / 16000) * 38 * Math.sign(dy || 1);
          const y = base + n + lens;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const alpha = 0.035 + (i % 4 === 0 ? 0.07 : 0.02);
        ctx.strokeStyle = `rgba(${color},${alpha})`;
        ctx.lineWidth = i % 4 === 0 ? 1.4 : 1;
        ctx.stroke();
      }
    };
    const loop = () => { t += 0.006; draw(); raf = requestAnimationFrame(loop); };
    const onMove = (e) => { pointer.tx = e.clientX; pointer.ty = e.clientY + window.scrollY * 0; };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduced) loop(); };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    reduced ? draw() : loop();
    canvas.style.opacity = 1;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);
  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-0 transition-opacity duration-[1600ms]"
        style={{ maskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)", WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)" }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[70vh] bg-[radial-gradient(60%_60%_at_20%_0%,var(--glow),transparent_70%)]" />
      <div aria-hidden="true" className="grain" />
    </>
  );
}

/* ----------------------------------------------------------------- header */

/** Close a popover on a tap outside `refs` or on Escape (`close(true)` asks for focus back on its button). */
function useDismiss(open, close, refs) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!refs.some((r) => r.current?.contains(e.target))) close(false); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(true); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close, refs]);
}

/** Arrow keys, Home and End move between a panel's items (each marked data-item). */
function onListKeys(e) {
  const items = [...e.currentTarget.querySelectorAll("[data-item]")];
  const i = items.indexOf(document.activeElement);
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
  if (to == null || !items.length) return;
  e.preventDefault();
  items[(to + items.length) % items.length].focus();
}

const Caret = ({ open }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/** Focus the first item of a panel that just opened from the keyboard (or the chosen one when there is one). */
function useFocusOnOpen(open, panel, viaKeys) {
  useEffect(() => {
    if (!open || !viaKeys.current) return;
    const el = panel.current?.querySelector("[data-item][data-current]") ?? panel.current?.querySelector("[data-item]");
    el?.focus();
  }, [open, panel, viaKeys]);
}

/**
 * The market switch: a clear button with the market's name; tapping it opens a small menu of the markets, each with
 * one line. The choice applies to this visit (and rides in the link); the site always opens on the default.
 */
export function MarketSwitch({ market }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const panel = useRef(null);
  const viaKeys = useRef(false);
  const refs = useMemo(() => [btn, panel], []);
  const close = useCallback((refocus) => { setOpen(false); if (refocus) btn.current?.focus(); }, []);
  useDismiss(open, close, refs);
  useFocusOnOpen(open, panel, viaKeys);
  const choices = market?.choices ?? [];
  if (!choices.length) return null;
  const current = choices.find((c) => c.id === market.id) ?? choices[0];
  const pick = (id) => { setOpen(false); btn.current?.focus(); if (id !== market.id) market.choose(id); };
  return (
    <div className="sm:relative">
      <button ref={btn} type="button" aria-expanded={open} aria-controls="market-menu"
        aria-label={`Market: ${current.label}. Change market`}
        onPointerDown={() => { viaKeys.current = false; }}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") viaKeys.current = true; if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors ${open ? "border-accent bg-accent/15 text-accent" : "border-accent/45 bg-accent/10 text-accent hover:border-accent"}`}>
        <span className="font-normal text-ink-2">Market</span>
        {current.label}
        <Caret open={open} />
      </button>
      {open && (
        <div ref={panel} id="market-menu" role="group" aria-label="Choose a market" onKeyDown={onListKeys}
          className="absolute top-full right-4 left-4 z-50 mt-2 animate-pop rounded-3xl border border-line-2 bg-surface p-2 shadow-2xl motion-reduce:animate-none sm:right-auto sm:left-0 sm:w-[340px]">
          <p className="px-3 pt-2 pb-1 text-[14px] leading-snug text-ink-2">Which list to show. For this visit only; the daily brain and the practice portfolio always use Nasdaq.</p>
          <ul className="mt-1 grid gap-1">
            {choices.map((c) => {
              const on = c.id === current.id;
              return (
                <li key={c.id}>
                  <button type="button" data-item="" data-current={on ? "" : undefined} aria-pressed={on} onClick={() => pick(c.id)}
                    className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${on ? "bg-surface-2 text-ink" : "text-ink hover:bg-surface-2"}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold tracking-[-0.01em]">{c.label}</span>
                      <span className="block text-[14.5px] leading-snug text-ink-2">{c.what}</span>
                      {!c.available && <span className="mt-0.5 block text-[13px] text-ink-3">Numbers after the next nightly run</span>}
                    </span>
                    <span className={on ? "text-accent" : "invisible"}><Check /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One page row in a subject's menu or sheet. */
function PageItem({ page, on, sample, onClick, big = true }) {
  return (
    <button type="button" data-item="" data-current={on ? "" : undefined} aria-current={on ? "page" : undefined} onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 text-left transition-colors ${big ? "min-h-[60px] py-3" : "min-h-[48px] py-2"} ${on ? "bg-ink text-bg" : "text-ink hover:bg-surface-2"}`}>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-2 font-semibold tracking-[-0.01em] ${big ? "text-[17px]" : "text-[15.5px]"}`}>
          {page.label}
          {sample && <span className={`font-mono text-[9.5px] font-medium tracking-[0.12em] uppercase ${on ? "text-bg/60" : "text-people"}`}>sample</span>}
        </span>
        {big && <span className={`block text-[14.5px] leading-snug ${on ? "text-bg/75" : "text-ink-2"}`}>{page.what}</span>}
      </span>
    </button>
  );
}

/** A subject's pages in groups (Learn adds a small "Behind the scenes" group). */
function SubjectList({ subject, route, sampleRoutes, onPick }) {
  const here = pageOf(route)?.route;
  return menuGroups(subject.id).map((g) => (
    <div key={g.id} className={g.label ? "mt-2 border-t border-line pt-2" : ""}>
      {g.label && <div className="meta px-4 pt-1 pb-1.5">{g.label}</div>}
      <ul className="grid gap-1">
        {g.pages.map((p) => (
          <li key={p.route}><PageItem page={p} on={here === p.route} sample={sampleRoutes.includes(p.route)} big={!g.label} onClick={() => onPick(p.route)} /></li>
        ))}
      </ul>
    </div>
  ));
}

/** iPad and desktop: one large button per subject; it opens a panel listing its pages. */
function SubjectMenu({ subject, current, open, setOpen, route, onNav, sampleRoutes }) {
  const btn = useRef(null);
  const panel = useRef(null);
  const viaKeys = useRef(false);
  const refs = useMemo(() => [btn, panel], []);
  const close = useCallback((refocus) => { setOpen(null); if (refocus) btn.current?.focus(); }, [setOpen]);
  useDismiss(open, close, refs);
  useFocusOnOpen(open, panel, viaKeys);
  const id = `menu-${subject.id}`;
  return (
    <div className="relative">
      <button ref={btn} type="button" aria-expanded={open} aria-controls={id}
        onPointerDown={() => { viaKeys.current = false; }}
        onClick={() => setOpen(open ? null : subject.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") viaKeys.current = true; if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(subject.id); } }}
        className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border px-5 text-[16px] font-semibold tracking-[-0.01em] transition-colors duration-300 ${current ? "border-transparent bg-ink text-bg" : open ? "border-ink-3 text-ink" : "border-line-2 text-ink hover:border-ink-3"}`}>
        {subject.label}
        <Caret open={open} />
      </button>
      {open && (
        <div ref={panel} id={id} role="group" aria-label={`${subject.label} pages`} onKeyDown={onListKeys}
          className="absolute top-[calc(100%+10px)] left-1/2 z-50 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 animate-pop rounded-3xl border border-line-2 bg-surface p-2 shadow-2xl motion-reduce:animate-none">
          <p className="px-4 pt-2 pb-2 text-[14px] leading-snug text-ink-2">{subject.what}</p>
          <SubjectList subject={subject} route={route} sampleRoutes={sampleRoutes} onPick={(r) => { setOpen(null); onNav(r); }} />
        </div>
      )}
    </div>
  );
}

export function Header({ route, onNav, sample, livePrices, theme, onTheme, market, sampleRoutes = [] }) {
  const [scrolled, setScrolled] = useState(false);
  const [openSubject, setOpenSubject] = useState(null);
  const subject = subjectOf(route);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpenSubject(null), [route]);

  return (
    <header className={`sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-colors duration-500 ${scrolled ? "bg-bg/80" : "bg-bg/60"}`}>
      <Container className="relative flex flex-wrap items-center gap-x-3 gap-y-3 py-3 sm:gap-x-4 sm:py-4">
        <a href="#today" aria-label="stocks·brain, home" className="flex shrink-0 items-center gap-3" onClick={(e) => { e.preventDefault(); onNav("today"); }}>
          <Logo />
          <span className="hidden text-[20px] font-semibold tracking-[-0.03em] min-[420px]:inline">stocks·brain</span>
        </a>
        <MarketSwitch market={market} />

        <nav aria-label="Sections" className="order-3 hidden w-full justify-center gap-2 sm:flex lg:order-none lg:w-auto lg:flex-1">
          {SUBJECTS.map((s) => (
            <SubjectMenu key={s.id} subject={s} current={subject === s.id} open={openSubject === s.id} setOpen={setOpenSubject}
              route={route} onNav={onNav} sampleRoutes={sampleRoutes} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {sample && (
            <span className="pill border-dashed border-people/60 text-people" title={livePrices ? "Prices are live; picks stay synthetic until the brain runs" : "Synthetic data until the live pipeline runs"}>
              <span className="size-1.5 animate-pulse rounded-full bg-current" /> <span className="sm:hidden">Sample</span><span className="hidden sm:inline">{livePrices ? "Sample picks" : "Sample prices · picks"}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="grid size-11 place-items-center rounded-full border border-line-2 transition duration-500 hover:rotate-45 hover:border-ink-3"
          >
            <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {theme === "dark" ? (
                <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
              ) : (
                <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
              )}
            </svg>
          </button>
        </div>
      </Container>
    </header>
  );
}

/**
 * Under the header on every page but Home and a stock page: where you are and a one-line "what's this", and, when
 * another market is chosen on a page that reads Nasdaq only, one calm line that says so.
 */
export function PageIntro({ route, market }) {
  const page = pageOf(route);
  if (!page || route === "today" || route.startsWith("stock/")) return null;
  const subject = SUBJECTS.find((s) => s.id === page.subject);
  const other = market && !market.isDefault && NASDAQ_ONLY.includes(route);
  return (
    <Container className="pt-8 sm:pt-10">
      <p className="meta normal-case tracking-[0.06em]"><span className="uppercase tracking-[0.16em]">{subject.label}</span> · {page.label}</p>
      <p className="mt-1.5 max-w-[60ch] text-[16px] leading-snug text-ink-2">{page.what}</p>
      {other && (
        <p role="note" className="mt-4 flex max-w-[72ch] flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line-2 bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink-2">
          <span className="min-w-0 flex-1 basis-[28ch]">{nasdaqOnlyLine(market.entry?.label ?? market.id)}</span>
          <button type="button" onClick={() => market.choose(market.defaultId)} className="min-h-[44px] shrink-0 rounded-full border border-line-2 px-4 text-[15px] font-medium text-ink hover:border-ink-3">Show Nasdaq</button>
        </p>
      )}
    </Container>
  );
}

function Logo() {
  return (
    <span className="relative grid size-9 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 animate-[spin-slow_14s_linear_infinite]">
        <circle cx="18" cy="18" r="13" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="62 20" strokeLinecap="round" />
      </svg>
      <span className="size-2 animate-pulse-ring rounded-full bg-accent" />
    </span>
  );
}

/* ----------------------------------------------------------------- footer */

export function Footer({ data }) {
  const { manifest } = data;
  return (
    <footer className="relative mt-24 border-t border-line">
      <Container className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3 py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="m-0 font-semibold tracking-[-0.01em]">Analysis only, not financial advice. Data may be delayed.</p>
        <p className="meta m-0 normal-case tracking-[0.04em]">
          Prices {manifest.price_source === "live" ? `live · ${manifest.price_provider}` : "sample"} · picks {manifest.source} · built {manifest.built_at.replace("T", " ").replace("Z", " UTC")}
        </p>
      </Container>
    </footer>
  );
}

/* ------------------------------------------------- phone bottom bar */

const ICONS = {
  today: <path d="M4 12.5 12 5l8 7.5M6.5 10.5V19h11v-8.5" />,
  plan: <><path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z" /><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" /></>,
  learn: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></>,
};

/**
 * Phone: the bottom bar is the three subjects. Today goes straight Home from elsewhere (one tap); tapping the subject
 * you are in, or Our plan or Learn, opens a sheet of its pages.
 */
export function MobileNav({ route, onNav, sampleRoutes = [] }) {
  const [sheet, setSheet] = useState(null);
  const panel = useRef(null);
  const opener = useRef(null);
  const subject = subjectOf(route);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e) => { if (e.key === "Escape") { setSheet(null); opener.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    (panel.current?.querySelector("[data-item][data-current]") ?? panel.current?.querySelector("[data-item]"))?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);
  useEffect(() => setSheet(null), [route]);
  const tap = (id, e) => {
    if (sheet === id) { setSheet(null); return; }
    const t = bottomTap(id, route);
    opener.current = e.currentTarget;
    if (t.go) { setSheet(null); onNav(t.go); } else setSheet(t.sheet);
  };
  const open = SUBJECTS.find((s) => s.id === sheet);
  return (
    <>
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-3">
          {SUBJECTS.map((s) => {
            const on = sheet ? sheet === s.id : subject === s.id;
            return (
              <button key={s.id} type="button" onClick={(e) => tap(s.id, e)} aria-expanded={sheet === s.id} aria-current={subject === s.id ? "true" : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[13px] font-semibold transition-colors ${on ? "text-ink" : "text-ink-3"}`}>
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-300 ${on ? "bg-ink text-bg" : ""}`}>
                  <svg viewBox="0 0 24 24" className="size-[20px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[s.id]}</svg>
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>
      {open && (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <button type="button" aria-label="Close" tabIndex={-1} onClick={() => setSheet(null)} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div ref={panel} onKeyDown={onListKeys}
            className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-rise overflow-y-auto rounded-t-3xl border-t border-line-2 bg-surface px-3 pt-3 pb-[calc(76px+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-2" />
            <h2 id="sheet-title" className="px-4 text-[22px] font-semibold tracking-[-0.02em]">{open.label}</h2>
            <p className="px-4 pt-1 pb-3 text-[15px] leading-snug text-ink-2">{open.what}</p>
            <SubjectList subject={open} route={route} sampleRoutes={sampleRoutes} onPick={(r) => { setSheet(null); onNav(r); }} />
          </div>
        </div>
      )}
    </>
  );
}
