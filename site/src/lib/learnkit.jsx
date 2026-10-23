import { useEffect, useId, useState } from "react";
import { HeroTitle, InfoTip } from "../components/ui.jsx";
import dict from "../text/learn.js";
import { strings } from "./text.js";

/*
 * Small shared pieces of the Learn pages (How it works, People, Lessons, Library, Lessons learned, the quiz, Runs,
 * Routines, Admin), built on the kit in components/ui.jsx. Only those pages use this file. Words are text/learn.js "lx.*".
 */

const t = strings(dict);

/**
 * A Learn page's top: the kit's HeroTitle, then one row of status chips with an (i) that holds the page's explanation
 * (pages show little prose). `right` sits at the end of the row on a wide screen (links, a count).
 */
export function PageHero({ line1, line2, sub, chips, info, infoLabel, right, size = "lg" }) {
  return (
    <div className="grid gap-5">
      <HeroTitle line1={line1} line2={line2} sub={sub} size={size} />
      {(chips || info || right) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chips}
            {info && <InfoTip label={infoLabel ?? t("lx.about")} align="start">{info}</InfoTip>}
          </div>
          {right && <div className="flex min-w-0 flex-wrap items-center gap-2">{right}</div>}
        </div>
      )}
    </div>
  );
}

/** Two short paragraphs for an InfoTip: the plain version first, then the detail. */
export function TipText({ lead, more }) {
  return (
    <>
      <span className="block text-ink">{lead}</span>
      {more && <span className="mt-2 block">{more}</span>}
    </>
  );
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" />
  </svg>
);

/** The search field of a list page: a raised tile with a mono placeholder and an orange edge while typing. */
export function SearchBox({ value, onChange, placeholder, label, className = "" }) {
  return (
    <label className={`tile flex min-h-[48px] items-center gap-3 bg-surface px-4 transition-colors focus-within:border-desk/60 ${className}`}>
      <SearchIcon />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-ink outline-none placeholder:text-ink-3" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label={t("lx.clear")}
          className="-me-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink">
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>
        </button>
      )}
    </label>
  );
}

/**
 * A row of filter chips (one may be on): a sideways rail on a phone, wrapping on a wide screen when `wrap`. options:
 * [{value, label, count, dot}]. Each chip is a 44px aria-pressed button; the one that is on is orange.
 */
export function FilterChips({ options, value, onChange, label, wrap = false, className = "" }) {
  return (
    <div role="group" aria-label={label} className={`no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${wrap ? "sm:flex-wrap" : ""} ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value ?? "all"} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-chip border px-3 font-mono text-[11.5px] font-semibold tracking-[0.08em] uppercase transition-colors ${on ? "border-desk/60 bg-desk/12 text-desk" : "border-line-2 bg-surface text-ink-2 hover:border-line-3 hover:text-ink"}`}>
            {o.dot}
            <span className="whitespace-nowrap">{o.label}</span>
            {o.count != null && <span className={`font-num text-[11px] tracking-normal ${on ? "text-desk/80" : "text-ink-3"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A "Read more" disclosure: the button stays put, the text opens under it. */
export function ReadMore({ children, label, lessLabel, className = "" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase transition-colors hover:text-desk">
        <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border border-line-3 font-mono text-[12px] leading-none transition-transform ${open ? "rotate-45 border-desk text-desk" : ""}`}>+</span>
        {open ? lessLabel ?? t("lx.less") : label ?? t("lx.more")}
      </button>
      {open && <div id={id} className="animate-pop pb-1 motion-reduce:animate-none">{children}</div>}
    </div>
  );
}

/** A tiny mono label + value pair, for a tile's footer ("V 0.2.0", "NEXT IN 3 H"). */
export function Fact({ label, children, className = "" }) {
  return (
    <span className={`inline-flex min-w-0 items-baseline gap-1.5 ${className}`}>
      <span className="micro shrink-0">{label}</span>
      <span className="font-num min-w-0 truncate text-[12px] font-semibold text-ink-2">{children}</span>
    </span>
  );
}

/** The height of the site's sticky header, kept current (a sticky strip sits right under it). */
export function useHeaderHeight() {
  const [h, setH] = useState(64);
  useEffect(() => {
    const el = document.querySelector("header");
    if (!el) return;
    const on = () => setH(Math.round(el.getBoundingClientRect().height));
    on();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

/** The id of the last section (by element id) whose top has passed `line` px from the top of the screen. */
export function useScrollSpy(ids, line) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join();
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let cur = ids[0];
        for (const id of ids) {
          const top = document.getElementById(id)?.getBoundingClientRect().top;
          if (top != null && top <= line) cur = id;
        }
        setActive(cur);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [key, line]); // eslint-disable-line react-hooks/exhaustive-deps
  return [active, setActive];
}

/** Scroll a section into view under the header and a sticky strip, then move focus to its heading. */
export function jumpTo(id, offset, reduced) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset), behavior: reduced ? "auto" : "smooth" });
  document.getElementById(`${id}-h`)?.focus({ preventScroll: true });
}
