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
      <HeroTitle line1={line1} line2={line2} sub={sub} size={size}>
        {info && !chips && !right && <InfoTip label={infoLabel ?? t("lx.about")} align="start" className="mt-2 -ms-2.5">{info}</InfoTip>}
      </HeroTitle>
      {(chips || right) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {info && <InfoTip label={infoLabel ?? t("lx.about")} align="start" className="-ms-2.5">{info}</InfoTip>}
            {chips}
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

/* ------------------------------------------------------------ the day's timeline */

const nowMins = () => { const d = new Date(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const BAD = new Set(["failure", "failed", "cancelled"]);

/** A stop's state from its jobs' last outcomes: fail when any failed, done when any ran fine, else idle (no run yet). */
export function stopState(ids, last) {
  const outs = ids.map((id) => last?.[id]?.outcome).filter(Boolean);
  if (outs.some((o) => BAD.has(o))) return "fail";
  return outs.some((o) => o === "success" || o === "partial") ? "done" : "idle";
}

const DOT = { done: "bg-up shadow-[0_0_10px_var(--up-glow)]", fail: "bg-down shadow-[0_0_10px_var(--down-glow)]", idle: "bg-ink-3" };
const STATE_WORD = { done: "lx.ok", fail: "lx.failed", idle: "lx.never" };

/** The current minute of the day in UTC, kept current. */
export function useUtcMinute() {
  const [m, setM] = useState(nowMins);
  useEffect(() => {
    const id = setInterval(() => setM(nowMins()), 30000);
    return () => clearInterval(id);
  }, []);
  return m;
}

/**
 * A weekday's timed jobs on a 24-hour UTC line: one dot per fire time (green: ran fine last time, red: failed, grey: no
 * run yet; a purple ring when a job there uses the AI) and an orange "now" marker. A dot is a button: `onPick(stop)`.
 * stops: lib/routines.js dayTimeline(); last: lastByRoutine().
 */
export function DayTrack({ stops, last, picked, onPick, nameOf = (id) => id, className = "" }) {
  const now = useUtcMinute();
  const latest = [...stops].reverse().find((s) => s.mins <= now) ?? stops.at(-1);
  const at = (m) => `${(m / 1440) * 100}%`;
  return (
    <div className={`relative h-[78px] select-none ${className}`}>
      <span aria-hidden="true" className="absolute inset-x-0 top-[36px] h-px bg-line-3" />
      <span aria-hidden="true" className="absolute top-[36px] left-0 h-px bg-gradient-to-r from-desk/0 to-desk/70" style={{ width: at(now) }} />
      {Array.from({ length: 25 }, (_, h) => (
        <span key={h} aria-hidden="true" className="absolute top-[36px] -translate-x-1/2" style={{ left: at(h * 60) }}>
          <span className={`block w-px ${h % 6 ? "h-1.5 bg-line-2" : "h-2.5 bg-line-3"}`} />
          {h % 6 === 0 && <span className="font-num absolute top-3.5 left-1/2 -translate-x-1/2 text-[10px] text-ink-3">{String(h).padStart(2, "0")}</span>}
        </span>
      ))}
      <span aria-hidden="true" className="absolute top-0 bottom-[30px] w-px bg-desk" style={{ left: at(now) }}>
        <span className={`font-num absolute top-0 rounded-[4px] bg-desk px-1 text-[9.5px] leading-[15px] font-bold whitespace-nowrap text-bg uppercase ${now > 1260 ? "right-1" : now < 180 ? "left-1" : "left-1/2 -translate-x-1/2"}`}>{t("lx.now")} {hhmm(now)}</span>
      </span>
      {stops.map((s) => {
        const st = stopState(s.ids, last);
        const size = 9 + Math.min(s.ids.length, 9);
        const on = picked === s.mins;
        return (
          <button key={s.mins} type="button" onClick={() => onPick?.(s)} aria-pressed={on}
            aria-label={`${hhmm(s.mins)} ${t("lx.utc")}: ${s.ids.map(nameOf).join(", ")}. ${t(STATE_WORD[st])}${s.ai ? `, ${t("lx.usesAi")}` : ""}`}
            className="group absolute top-[36px] grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" style={{ left: at(s.mins) }}>
            {s === latest && st === "done" && <span aria-hidden="true" className="absolute size-3 animate-ping rounded-full bg-up/60 motion-reduce:hidden" />}
            <span aria-hidden="true" className={`relative block rounded-full transition-transform group-hover:scale-125 ${DOT[st]} ${s.ai ? "ring-2 ring-ai ring-offset-2 ring-offset-surface" : ""} ${on ? "scale-125 outline-2 outline-offset-[3px] outline-desk" : ""}`}
              style={{ width: size, height: size }} />
          </button>
        );
      })}
    </div>
  );
}

/** One line about a picked stop: "05:23 UTC · Brain morning run · Ran fine last time". */
export function StopLine({ stop, last, nameOf = (id) => id }) {
  if (!stop) return null;
  const st = stopState(stop.ids, last);
  return (
    <p className="flex min-h-[44px] flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] leading-snug text-ink-2" aria-live="polite">
      <span className="font-num text-[14px] font-bold text-ink">{hhmm(stop.mins)}</span>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[st]}`} />
      <span className="min-w-0">{stop.ids.map(nameOf).join(" · ")}</span>
      {stop.ai && <span className="chip border-ai/40 bg-ai/10 text-ai">{t("how.kind.ai")}</span>}
      <span className="text-ink-3">{t(STATE_WORD[st])}</span>
    </p>
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
