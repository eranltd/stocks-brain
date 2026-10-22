import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bottomTap, menuGroups, pageOf, subjectOf, SUBJECTS } from "../lib/nav.js";
import { NASDAQ_ONLY } from "../lib/markets.js";
import { useReducedMotion } from "../lib/motion.js";
import { Container, Delta } from "./ui.jsx";
import { buildLine } from "../lib/appversion.js";
import { mainListOf } from "../lib/buywindow.js";
import { tapeItems, tapeSeconds } from "../lib/tape.js";
import { fmtPct, fmtShort } from "../lib/format.js";
import shellText from "../text/shell.js";
import { strings } from "../lib/text.js";

/* ----------------------------------------------------------------- loader */

export function Loader({ progress, done }) {
  const t = strings(shellText);
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
            fill="none" stroke="var(--desk)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="200" strokeDashoffset="200"
            style={{ animation: "dash 1.4s cubic-bezier(.16,1,.3,1) forwards", filter: "drop-shadow(0 0 8px var(--desk-glow))" }}
          />
        </svg>
        <div className="font-num text-[clamp(56px,14vw,112px)] leading-none font-bold tracking-[-0.06em]">
          {Math.round(progress * 100)}
          <sup className="ms-1 align-top text-[0.3em] text-desk">%</sup>
        </div>
        <div className="kicker tracking-[0.3em]">{t("loader.text")}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the canvas */

/**
 * The canvas behind every page: a near-black field with a faint 24px grid that fades toward the edges, a warm orange
 * glow at the top and a soft vignette (index.css .backdrop). Static, so it costs nothing and needs no reduced-motion care.
 */
export function Field() {
  return <div aria-hidden="true" className="backdrop" />;
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
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-3.5 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
export function MarketSwitch({ market, locked = false }) {
  const t = strings(shellText);
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
  // A page that only ever shows the main list says so in the switch itself (the choice is kept for the other pages).
  if (locked) {
    const main = choices.find((c) => c.id === market.defaultId) ?? choices[0];
    return (
      <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line px-3.5 font-display text-[15px] font-bold tracking-[0.08em] text-ink-2 uppercase" title={t("market.locked")}>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-3" />{main.label}
      </span>
    );
  }
  const pick = (id) => { setOpen(false); btn.current?.focus(); if (id !== market.id) market.choose(id); };
  return (
    <div className="sm:relative">
      <button ref={btn} type="button" aria-expanded={open} aria-controls="market-menu"
        aria-label={t("market.aria", { label: current.label })}
        onPointerDown={() => { viaKeys.current = false; }}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") viaKeys.current = true; if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border ps-3.5 pe-3 font-display text-[15px] font-bold tracking-[0.08em] uppercase transition-colors ${open ? "border-desk/70 bg-desk/10 text-ink" : "border-line-2 bg-surface-2/80 text-ink hover:border-line-3"}`}>
        {/* A live dot and the market's name; the word "Market" stays in the accessible name only. */}
        <span aria-hidden="true" className="size-1.5 rounded-full bg-up shadow-[0_0_8px_var(--up)]" />
        {current.label}
        <span className="text-ink-3"><Caret open={open} /></span>
      </button>
      {open && (
        <div ref={panel} id="market-menu" role="group" aria-label={t("market.menu")} onKeyDown={onListKeys}
          className="absolute top-full end-4 start-4 z-50 mt-2 animate-pop rounded-panel border border-line-2 bg-surface p-2 shadow-2xl motion-reduce:animate-none sm:end-auto sm:start-0 sm:w-[340px]">
          <p className="px-3 pt-2 pb-1 text-[13.5px] leading-snug text-ink-2">{t("market.intro")}</p>
          <ul className="mt-1 grid gap-1">
            {choices.map((c) => {
              const on = c.id === current.id;
              return (
                <li key={c.id}>
                  <button type="button" data-item="" data-current={on ? "" : undefined} aria-pressed={on} onClick={() => pick(c.id)}
                    className={`flex min-h-[60px] w-full items-center gap-3 rounded-[10px] px-4 py-3 text-start transition-colors ${on ? "bg-surface-3 text-ink shadow-[inset_2px_0_0_var(--desk)]" : "text-ink hover:bg-surface-2"}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[18px] font-bold tracking-[0.06em] uppercase">{c.label}</span>
                      <span className="block text-[14.5px] leading-snug text-ink-2">{c.what}</span>
                      {!c.available && <span className="mt-0.5 block text-[13px] text-ink-3">{t("market.later")}</span>}
                    </span>
                    <span className={on ? "text-desk" : "invisible"}><Check /></span>
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
  const t = strings(shellText);
  return (
    <button type="button" data-item="" data-current={on ? "" : undefined} aria-current={on ? "page" : undefined} onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[10px] px-4 text-start transition-colors ${big ? "min-h-[60px] py-3" : "min-h-[48px] py-2"} ${on ? "bg-surface-3 text-ink shadow-[inset_2px_0_0_var(--desk)]" : "text-ink hover:bg-surface-2"}`}>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-2 font-display font-bold tracking-[0.06em] uppercase ${big ? "text-[18px]" : "text-[16px]"} ${on ? "text-desk" : ""}`}>
          {page.label}
          {sample && <span className="font-mono text-[9.5px] font-semibold tracking-[0.12em] text-people uppercase">{t("menu.sample")}</span>}
        </span>
        {big && <span className="block text-[13.5px] leading-snug text-ink-2">{page.what}</span>}
      </span>
    </button>
  );
}

/** A subject's pages in groups (Learn adds a small "Behind the scenes" group). */
function SubjectList({ subject, route, sampleRoutes, onPick }) {
  const here = pageOf(route)?.route;
  return menuGroups(subject.id).map((g) => (
    <div key={g.id} className={g.label ? "mt-2 border-t border-line pt-2" : ""}>
      {g.label && <div className="micro px-4 pt-1 pb-1.5">{g.label}</div>}
      <ul className="grid gap-1">
        {g.pages.map((p) => (
          <li key={p.route}><PageItem page={p} on={here === p.route} sample={sampleRoutes.includes(p.route)} big={!g.label} onClick={() => onPick(p.route)} /></li>
        ))}
      </ul>
    </div>
  ));
}

/** A header tab: condensed uppercase, full header height on a laptop so the orange underline sits on the edge. */
const TAB = "relative inline-flex h-full min-h-[48px] items-center gap-1.5 px-3 font-display text-[15px] font-bold tracking-[0.1em] whitespace-nowrap uppercase transition-colors duration-300 lg:min-h-[64px] lg:px-4";
const TabLine = () => <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-desk shadow-[0_0_12px_var(--desk)] lg:inset-x-4" />;

/** iPad and desktop: one tab per subject; it opens a panel listing its pages. */
function SubjectMenu({ subject, current, open, setOpen, route, onNav, sampleRoutes }) {
  const t = strings(shellText);
  const btn = useRef(null);
  const panel = useRef(null);
  const viaKeys = useRef(false);
  const refs = useMemo(() => [btn, panel], []);
  const close = useCallback((refocus) => { setOpen(null); if (refocus) btn.current?.focus(); }, [setOpen]);
  useDismiss(open, close, refs);
  useFocusOnOpen(open, panel, viaKeys);
  const id = `menu-${subject.id}`;
  return (
    <div className="relative flex self-stretch">
      <button ref={btn} type="button" aria-expanded={open} aria-controls={id}
        onPointerDown={() => { viaKeys.current = false; }}
        onClick={() => setOpen(open ? null : subject.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") viaKeys.current = true; if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(subject.id); } }}
        className={`${TAB} ${current || open ? "text-ink" : "text-ink-2 hover:text-ink"}`}>
        {subject.label}
        <span className="text-ink-3"><Caret open={open} /></span>
        {current && <TabLine />}
      </button>
      {open && (
        <div ref={panel} id={id} role="group" aria-label={t("menu.pages", { label: subject.label })} onKeyDown={onListKeys}
          className="absolute top-[calc(100%+6px)] left-1/2 z-50 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 animate-pop rounded-panel border border-line-2 bg-surface p-2 shadow-2xl motion-reduce:animate-none">
          <p className="px-4 pt-2 pb-2 text-[13.5px] leading-snug text-ink-2">{subject.what}</p>
          <SubjectList subject={subject} route={route} sampleRoutes={sampleRoutes} onPick={(r) => { setOpen(null); onNav(r); }} />
        </div>
      )}
    </div>
  );
}

export function Header({ route, onNav, sample, livePrices, theme, onTheme, market, sampleRoutes = [] }) {
  const t = strings(shellText);
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
    <header className={`sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-colors duration-500 ${scrolled ? "border-line-2 bg-bg/85" : "border-line bg-bg/70"}`}>
      <Container className="relative flex flex-wrap items-center gap-x-2.5 sm:gap-x-4">
        <a href="#today" aria-label={t("header.home")} className="flex min-h-[56px] shrink-0 items-center gap-2.5 lg:min-h-[64px]" onClick={(e) => { e.preventDefault(); onNav("today"); }}>
          <Logo />
          <Wordmark />
        </a>
        <MarketSwitch market={market} locked={NASDAQ_ONLY.includes(route)} />

        <nav aria-label={t("header.sections")} className="order-3 -mx-1 hidden w-full items-stretch gap-1 border-t border-line sm:flex lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:justify-center lg:self-stretch lg:border-t-0">
          {SUBJECTS.map((s) => s.direct ? (
            <button key={s.id} type="button" onClick={() => onNav(s.direct)} aria-current={subject === s.id ? "page" : undefined}
              className={`${TAB} ${subject === s.id ? "text-ink" : "text-ink-2 hover:text-ink"}`}>
              <span className="size-1.5 rounded-full bg-ai shadow-[0_0_8px_var(--ai)]" aria-hidden="true" />{s.label}
              {subject === s.id && <TabLine />}
            </button>
          ) : (
            <SubjectMenu key={s.id} subject={s} current={subject === s.id} open={openSubject === s.id} setOpen={setOpenSubject}
              route={route} onNav={onNav} sampleRoutes={sampleRoutes} />
          ))}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          {sample && (
            <span className="pill border-dashed border-people/60 text-people" title={livePrices ? t("header.sampleTitleLive") : t("header.sampleTitle")}>
              <span className="size-1.5 animate-pulse rounded-full bg-current" /> <span className="sm:hidden lg:inline">{t("header.sample")}</span><span className="hidden sm:inline lg:hidden">{livePrices ? t("header.samplePicks") : t("header.samplePricesPicks")}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onTheme}
            aria-label={theme === "dark" ? t("header.toLight") : t("header.toDark")}
            className="grid size-11 place-items-center rounded-full border border-line-2 bg-surface-2/80 text-ink-2 transition duration-500 hover:rotate-45 hover:border-line-3 hover:text-ink"
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
 * The ticker tape under the header: the main list's day moves (ticker and percent, never a price), marching left and
 * pausing on hover or focus; tapping a name opens its page. Under reduced motion it is one still row that scrolls
 * sideways. The second copy that makes the loop seamless is hidden from screen readers and the keyboard.
 */
export function TickerTape({ data, onOpen }) {
  const t = strings(shellText);
  const reduced = useReducedMotion();
  const items = useMemo(() => tapeItems({ market: data?.market, members: mainListOf(data), names: data?.names }), [data]);
  if (!items.length) return null;
  const date = data.market?.as_of ? fmtShort(data.market.as_of) : "";
  const row = (copy) => items.map((x) => (
    <li key={`${copy}-${x.ticker}`} className="shrink-0" aria-hidden={copy ? true : undefined}>
      <button type="button" onClick={() => onOpen(`stock/${x.ticker}`)} tabIndex={copy ? -1 : undefined}
        aria-label={copy ? undefined : t("tape.item", { name: x.name, move: fmtPct(x.move, 2) })}
        className="flex h-11 items-center gap-2 px-3 text-[12.5px] transition-colors hover:bg-surface-2 sm:px-4">
        <span className="font-num font-bold tracking-[0.02em] text-ink">{x.ticker}</span>
        <Delta value={x.move} d={2} arrow />
      </button>
    </li>
  ));
  return (
    <section aria-label={t("tape.aria", { date })} className="tape relative border-b border-line bg-surface/60 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1600px] items-stretch">
        <p className="flex shrink-0 items-center gap-2 border-e border-line ps-4 pe-3 sm:ps-8 lg:ps-12">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-desk shadow-[0_0_8px_var(--desk)] motion-safe:animate-[beacon_2.4s_ease-in-out_infinite]" />
          <span className="kicker text-[12px]">{t("tape.label")}</span>
          <span className="font-num text-[11px] text-ink-3 uppercase">{date}</span>
        </p>
        <div className={`min-w-0 flex-1 ${reduced ? "no-scrollbar overflow-x-auto" : "tape-fade overflow-hidden"}`}>
          <ul className={`flex w-max ${reduced ? "" : "tape-track"}`} style={{ "--tape-s": `${tapeSeconds(items.length)}s` }}>
            {row(0)}
            {!reduced && row(1)}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Under the header on every page but Home and a stock page: where you are and a one-line "what's this". A page that
 * reads Nasdaq only shows Nasdaq in the header's switch instead of a notice.
 */
export function PageIntro({ route, market }) {
  const page = pageOf(route);
  if (!page || route === "today" || route === "verdicts" || route.startsWith("stock/")) return null;
  const subject = SUBJECTS.find((s) => s.id === page.subject);
  return (
    <Container className="pt-7 sm:pt-9">
      <p className="kicker flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden="true" className="h-px w-6 bg-desk" />{subject.label}<span aria-hidden="true" className="text-ink-3">/</span><span className="text-ink-2">{page.label}</span>
      </p>
      <p className="mt-2 max-w-[60ch] text-[15px] leading-snug text-ink-2">{page.what}</p>
    </Container>
  );
}

/** The mark: an orange pulse line in a small glowing square. */
function Logo() {
  return (
    <span aria-hidden="true" className="relative grid size-8 shrink-0 place-items-center rounded-[9px] border border-desk/60 bg-desk/10 shadow-[0_0_20px_-4px_var(--desk-glow)]">
      <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="var(--desk)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 13.5h3l2.2-6 3.4 9 2.4-6.5H18" />
      </svg>
    </span>
  );
}

/** STOCKS·BRAIN in the display face (the name itself is not translated). */
function Wordmark() {
  return (
    <span aria-hidden="true" className="font-display text-[21px] leading-none font-extrabold tracking-[0.06em] uppercase">
      stocks<span className="text-desk">·</span>brain
    </span>
  );
}

/* ----------------------------------------------------------------- footer */

/**
 * The not-advice notice. Full in the footer of every page; `compact` once on Home.
 * Educational research notebook; not investment advice, investment marketing or portfolio management; no licence from
 * the Israel Securities Authority; past results do not promise future results; check with a licensed adviser.
 */
export function NotAdvice({ compact = false, className = "" }) {
  const t = strings(shellText);
  if (compact) {
    return (
      <p role="note" className={`max-w-[72ch] text-[12.5px] leading-relaxed text-ink-3 ${className}`}>
        <span className="font-semibold text-ink-2">{t("notAdvice.title")}.</span> {t("notAdvice.compact")}
      </p>
    );
  }
  return (
    <section role="note" aria-label={t("notAdvice.title")} className={`max-w-[84ch] ${className}`}>
      <p className="m-0 flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.14em] text-ink-2 uppercase">
        <svg viewBox="0 0 16 16" className="size-3.5 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.8v.1" strokeLinecap="round" /></svg>
        {t("notAdvice.title")}
      </p>
      <p className="mt-1.5 mb-0 text-[12.5px] leading-relaxed text-ink-3">{t("notAdvice.body", { site: "stocks·brain" })} {t("notAdvice.delayed")}</p>
    </section>
  );
}

export function Footer({ data }) {
  const { manifest } = data;
  return (
    <footer className="relative mt-16 border-t border-line bg-bg/60">
      <Container className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 py-7 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
        <NotAdvice />
        <p className="m-0 font-num text-[11px] tracking-[0.02em] text-ink-3">
          {buildLine(manifest)}
        </p>
      </Container>
    </footer>
  );
}

/* ------------------------------------------------- phone bottom bar */

const ICONS = {
  // two candles: the desk
  today: <><path d="M7.5 3.5v3M7.5 16v4.5M16.5 6v3.5M16.5 17.5v3" /><rect x="5" y="6.5" width="5" height="9.5" rx="1.2" /><rect x="14" y="9.5" width="5" height="8" rx="1.2" /></>,
  // a flask: tests with pretend money
  plan: <><path d="M9 3.5h6M10 3.5v5.8L4.8 18a1.8 1.8 0 0 0 1.6 2.6h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.3V3.5" /><path d="M7.2 15h9.6" /></>,
  // a spark: the brain's verdicts
  verdicts: <><path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7-5.6-1.9L10.1 9Z" /><path d="M19 3.5v3M17.5 5h3" /></>,
  // an open book: lessons
  learn: <><path d="M3.5 5.5c2.6-1.4 5.6-1.3 8.5.6 2.9-1.9 5.9-2 8.5-.6v13c-2.6-1.4-5.6-1.3-8.5.6-2.9-1.9-5.9-2-8.5-.6Z" /><path d="M12 6.1v13" /></>,
};

/**
 * Phone: the bottom bar is the three subjects. Today goes straight Home from elsewhere (one tap); tapping the subject
 * you are in, or Experiments or Learn, opens a sheet of its pages.
 */
export function MobileNav({ route, onNav, sampleRoutes = [] }) {
  const t = strings(shellText);
  const subjects = SUBJECTS;
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
    const next = bottomTap(id, route);
    opener.current = e.currentTarget;
    if (next.go) { setSheet(null); onNav(next.go); } else setSheet(next.sheet);
  };
  const open = subjects.find((s) => s.id === sheet);
  return (
    <>
      <nav aria-label={t("header.sections")} className="fixed inset-x-0 bottom-0 z-50 border-t border-line-2 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-4">
          {subjects.map((s) => {
            const on = sheet ? sheet === s.id : subject === s.id;
            return (
              <button key={s.id} type="button" onClick={(e) => tap(s.id, e)} aria-expanded={sheet === s.id} aria-current={subject === s.id ? "true" : undefined}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 transition-colors ${on ? "text-desk" : "text-ink-3 active:text-ink"}`}>
                {on && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-desk shadow-[0_0_14px_var(--desk)]" />}
                <svg viewBox="0 0 24 24" className={`size-[22px] ${on ? "drop-shadow-[0_0_8px_var(--desk-glow)]" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[s.id]}</svg>
                <span className="font-display text-[12.5px] leading-none font-bold tracking-[0.1em] uppercase">{s.short ?? s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {open && (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <button type="button" aria-label={t("menu.close")} tabIndex={-1} onClick={() => setSheet(null)} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div ref={panel} onKeyDown={onListKeys}
            className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-rise overflow-y-auto rounded-t-[20px] border-t border-line-2 bg-surface px-3 pt-3 pb-[calc(76px+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-3" />
            <h2 id="sheet-title" className="headline px-4 text-[30px]">{open.label}</h2>
            <p className="px-4 pt-1.5 pb-3 text-[14px] leading-snug text-ink-2">{open.what}</p>
            <SubjectList subject={open} route={route} sampleRoutes={sampleRoutes} onPick={(r) => { setSheet(null); onNav(r); }} />
          </div>
        </div>
      )}
    </>
  );
}
