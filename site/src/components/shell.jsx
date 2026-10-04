import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export function Header({ tabs, active, onNav, sample, livePrices, theme, onTheme }) {
  const track = useRef(null);
  const [ink, setInk] = useState({ x: 0, w: 0, ready: false });
  const [scrolled, setScrolled] = useState(false);

  useLayoutEffect(() => {
    const place = () => {
      const btn = track.current?.querySelector(`[data-tab="${active}"]`);
      if (!btn) return;
      setInk({ x: btn.offsetLeft, w: btn.offsetWidth, ready: true });
      btn.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const onKey = (e) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next == null) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    onNav(t.id);
    track.current?.querySelector(`[data-tab="${t.id}"]`)?.focus();
  };

  return (
    <header className={`sticky top-0 z-40 border-b border-line pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-colors duration-500 ${scrolled ? "bg-bg/80" : "bg-bg/60"}`}>
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 lg:flex-nowrap lg:gap-x-6">
        <a href="#today" className="flex shrink-0 items-center gap-3" onClick={(e) => { e.preventDefault(); onNav("today"); }}>
          <Logo />
          <span className="text-[20px] font-semibold tracking-[-0.03em]">stocks·brain</span>
          <span className="pill hidden border-accent/40 bg-accent/10 font-sans text-[13px] font-medium tracking-normal text-accent normal-case sm:inline-flex">Nasdaq</span>
        </a>

        <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-1 lg:flex lg:justify-center">
          <nav aria-label="Sections" className="no-scrollbar max-w-full overflow-x-auto rounded-full border border-line bg-surface/70 p-1 backdrop-blur-xl">
            <div ref={track} role="tablist" onKeyDown={onKey} className="relative flex w-max">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-full bg-ink shadow-[0_6px_24px_-6px_var(--glow)] transition-[transform,width] duration-[650ms] ease-[cubic-bezier(.34,1.56,.64,1)]"
                style={{ transform: `translateX(${ink.x}px)`, width: ink.w, opacity: ink.ready ? 1 : 0 }}
              />
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  data-tab={t.id}
                  aria-selected={active === t.id}
                  tabIndex={active === t.id ? 0 : -1}
                  onClick={() => onNav(t.id)}
                  className={`relative z-10 shrink-0 rounded-full px-4 py-2.5 text-[15.5px] font-medium whitespace-nowrap transition-colors duration-500 sm:px-5 ${active === t.id ? "text-bg" : "text-ink-2 hover:text-ink"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          {sample && (
            <span className="pill border-dashed border-people/60 text-people" title={livePrices ? "Prices are live; picks stay synthetic until the brain runs" : "Synthetic data until the live pipeline runs"}>
              <span className="size-1.5 animate-pulse rounded-full bg-current" /> {livePrices ? "Sample picks" : "Sample data"}
            </span>
          )}
          <button
            type="button"
            onClick={onTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="grid size-10 place-items-center rounded-full border border-line-2 transition duration-500 hover:rotate-45 hover:border-ink-3"
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
      <Container className="flex flex-wrap items-center justify-between gap-x-10 gap-y-3 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="m-0 font-semibold tracking-[-0.01em]">Analysis only, not financial advice. Data may be delayed.</p>
        <p className="meta m-0 normal-case tracking-[0.04em]">
          Prices {manifest.price_source === "live" ? `live · ${manifest.price_provider}` : "sample"} · picks {manifest.source} · built {manifest.built_at.replace("T", " ").replace("Z", " UTC")}
        </p>
      </Container>
    </footer>
  );
}
