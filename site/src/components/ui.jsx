import { Children, useEffect, useRef, useState } from "react";
import { useCountUp, useInView, useReducedMotion } from "../lib/motion.js";
import { fmtNum } from "../lib/format.js";

/* ------------------------------------------------------------------ layout */

export function Container({ className = "", children }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-12 ${className}`}>{children}</div>;
}

export function Reveal({ as: Tag = "div", delay = 0, className = "", style, children, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <Tag ref={ref} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ "--d": `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

export const Accent = ({ children }) => <span className="text-accent">{children}</span>;

/** Big kinetic headline: each word rises out of a mask, staggered. */
export function Headline({ children, className = "", as: Tag = "h1", size = "lg" }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const sizes = {
    xl: "text-[clamp(46px,9vw,128px)]",
    lg: "text-[clamp(40px,6.6vw,92px)]",
    md: "text-[clamp(30px,4.4vw,56px)]",
  };
  let i = 0;
  const words = (node, accent = false) =>
    (Array.isArray(node) ? node.join("") : String(node))
      .split(/(\s+)/)
      .map((w, k) =>
        /^\s+$/.test(w) ? (
          " "
        ) : (
          <span key={`${i}-${k}`} className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom">
            <span
              className={`inline-block transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(.16,1,.3,1)] ${accent ? "text-accent" : ""} ${inView ? "translate-y-0 opacity-100" : "translate-y-[105%] opacity-0"}`}
              style={{ transitionDelay: `${i++ * 55}ms` }}
            >
              {w}
            </span>
          </span>
        ),
      );
  const content = Children.toArray(children).flatMap((c) =>
    typeof c === "string" || typeof c === "number" ? words(c) : c?.type === Accent ? words(c.props.children, true) : c?.type === "br" ? [c] : [c],
  );
  return (
    <Tag ref={ref} className={`display ${sizes[size]} ${className}`}>
      {content}
    </Tag>
  );
}

export function SectionHead({ eyebrow, title, lede, right, size = "lg", className = "" }) {
  return (
    <div className={`mb-8 flex flex-wrap items-end justify-between gap-6 ${className}`}>
      <div className="min-w-0 max-w-4xl">
        {eyebrow && <Reveal className="eyebrow mb-5">{eyebrow}</Reveal>}
        <Headline as="h2" size={size}>{title}</Headline>
        {lede && (
          <Reveal delay={200} as="p" className="mt-5 max-w-[62ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-ink-2">
            {lede}
          </Reveal>
        )}
      </div>
      {right && <Reveal delay={300} className="flex min-w-0 max-w-full items-center gap-3">{right}</Reveal>}
    </div>
  );
}

/* ---------------------------------------------------------- data display */

export function CountUp({ value, decimals = 0, prefix = "", suffix = "", className = "" }) {
  const [ref, inView] = useInView();
  const v = useCountUp(value, inView);
  return (
    <span ref={ref} className={`num ${className}`}>
      {prefix}
      {fmtNum(v, decimals)}
      {suffix}
    </span>
  );
}

const TONES = {
  accent: "text-accent",
  ai: "text-ai",
  people: "text-people",
  down: "text-down",
  flat: "text-ink-2",
};

export function Dot({ tone = "accent", dashed = false }) {
  if (dashed)
    return <span className={`inline-block size-2.5 rounded-full border-[1.5px] border-dashed border-current ${TONES[tone]}`} />;
  return <span className={`inline-block size-2 rounded-full bg-current ${TONES[tone]}`} />;
}

/** The bracketed stat strip ("7 steps | 1 AI step | You"). */
/** `dense`: two columns on phones with descriptions hidden, so key numbers fit on one screen. */
export function Strip({ cells, dense = false }) {
  return (
    <Reveal className={`card brackets grid overflow-hidden lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))] ${dense ? "grid-cols-2" : "sm:grid-cols-2"}`} style={{ "--n": cells.length }}>
      {cells.map((c, i) => (
        <div key={i} className={`border-line ${dense ? "border-b p-5 sm:p-8 [&:nth-child(odd)]:border-r lg:border-b-0 lg:[&:not(:last-child)]:border-r" : "p-6 sm:p-8 [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-r lg:[&:not(:last-child)]:border-b-0"}`}>
          <div className={`display num ${dense ? "text-[clamp(30px,5vw,64px)]" : "text-[clamp(40px,5vw,64px)]"}`}>{c.value}</div>
          <div className={`mt-3 flex items-center gap-2 text-[15px] font-semibold ${TONES[c.tone ?? "accent"]}`}>
            <Dot tone={c.tone ?? "accent"} dashed={c.dashed} />
            {c.label}
          </div>
          {c.desc && <p className={`mt-3 text-[14px] leading-relaxed text-ink-2 ${dense ? "hidden sm:block" : ""}`}>{c.desc}</p>}
          {c.meter != null && (
            <div className="mt-4 h-1 overflow-hidden rounded bg-line">
              <MeterFill value={c.meter} tone={c.meter > 1 ? "down" : "accent"} />
            </div>
          )}
        </div>
      ))}
    </Reveal>
  );
}

function MeterFill({ value, tone }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`h-full rounded transition-[width] duration-[1400ms] ease-[cubic-bezier(.16,1,.3,1)] ${tone === "down" ? "bg-down" : "bg-accent"}`}
      style={{ width: inView ? `${Math.min(100, value * 100)}%` : 0, transitionDelay: "300ms" }}
    />
  );
}

/* ----------------------------------------------------------------- chips */

const CHIP = {
  hit: "bg-accent/12 text-accent border-accent/25",
  miss: "bg-down/12 text-down border-down/25",
  flat: "bg-flat/15 text-ink-2 border-line-2",
  pending: "text-ink-3 border-dashed border-line-2",
  bullish: "bg-accent/12 text-accent border-accent/25",
  bearish: "bg-down/12 text-down border-down/25",
  neutral: "bg-flat/15 text-ink-2 border-line-2",
  active: "bg-accent/12 text-accent border-accent/25",
  retired: "text-ink-3 border-dashed border-line-2",
  planned: "text-people border-dashed border-people/50",
  disabled: "text-ink-3 border-line-2",
  failed: "bg-down/12 text-down border-down/25",
  ok: "bg-accent/12 text-accent border-accent/25",
  sample: "text-people border-dashed border-people/60",
  passes_history: "bg-accent/12 text-accent border-accent/25",
  candidate: "text-people border-people/50",
  inconclusive: "text-ink-2 border-line-2",
  rejected: "bg-down/12 text-down border-down/25",
  needs_data: "text-people border-dashed border-people/50",
  process_only: "text-ai border-ai/40 bg-ai/10",
  testable_now: "text-ink-2 border-line-2",
  reference_baseline: "text-ink-2 border-line-2",
  control: "text-ink-3 border-dashed border-line-2",
  baseline: "text-ink-3 border-line-2",
  no_clear_difference: "text-ink-2 border-line-2",
  too_few_independent_windows: "text-ink-3 border-dashed border-line-2",
  better: "bg-accent/12 text-accent border-accent/25",
  worse: "bg-down/12 text-down border-down/25",
  ai: "text-ai border-ai/40 bg-ai/10",
};
const ARROW = { bullish: "▲", bearish: "▼", neutral: "◆", hit: "✓", miss: "✕", flat: "–" };

export function Chip({ kind, children, icon = true, className = "" }) {
  return (
    <span className={`pill ${CHIP[kind] ?? ""} ${className}`}>
      {icon && ARROW[kind] && <span aria-hidden="true" className="text-[9px]">{ARROW[kind]}</span>}
      {children ?? kind}
    </span>
  );
}

export function Conviction({ level, showLabel = true, tone = "accent" }) {
  const n = { low: 1, medium: 2, high: 3 }[level] ?? 0;
  return (
    <span className="meta inline-flex items-center gap-2" title={`${level} conviction`}>
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={`block h-3 w-[3px] rounded-sm ${i < n ? (tone === "accent" ? "bg-accent" : "bg-ink-2") : "bg-line-2"}`} />
        ))}
      </span>
      {showLabel && <span className={n === 3 ? "text-accent" : ""}>{level}</span>}
    </span>
  );
}

/* ------------------------------------------------------------- controls */

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition duration-300 ${value === o.value ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
        >
          {o.dot}
          {o.label}
          {o.count != null && <span className={`num font-mono text-[12px] ${value === o.value ? "text-bg/60" : "text-ink-3"}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function IconButton({ label, onClick, children, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-12 place-items-center rounded-full border border-line-2 transition duration-300 hover:border-ink-3 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export const Chevron = ({ dir = "right" }) => (
  <svg viewBox="0 0 24 24" className={`size-5 ${dir === "left" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const ArrowRight = ({ className = "size-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Horizontal snap rail with prev/next buttons. */
export function Carousel({ children, meta }) {
  const rail = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = rail.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(update, [children]);
  const go = (dir) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div>
      <div className="mb-5 flex items-center justify-end gap-3">
        {meta && <span className="meta mr-2">{meta}</span>}
        <IconButton label="Previous" onClick={() => go(-1)} disabled={edge.start}><Chevron dir="left" /></IconButton>
        <IconButton label="Next" onClick={() => go(1)} disabled={edge.end}><Chevron /></IconButton>
      </div>
      <div
        ref={rail}
        onScroll={update}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
      >
        {children}
      </div>
    </div>
  );
}

export function CodeBlock({ cmd, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; the command is still selectable */
    }
  };
  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center justify-between text-[14.5px] text-ink">
          <span>{label}</span>
          <span className="meta">terminal</span>
        </div>
      )}
      <div className="flex items-center gap-3 rounded-2xl border border-line-2 bg-bg/60 py-2 pr-2 pl-5">
        <code className="no-scrollbar min-w-0 flex-1 overflow-x-auto py-2 font-mono text-[13.5px] whitespace-nowrap">
          <span className="mr-3 text-accent">$</span>
          {cmd}
        </code>
        <button type="button" onClick={copy} className="shrink-0 rounded-full border border-line-2 px-4 py-2 text-[13px] font-medium transition hover:border-ink-3">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="card border-dashed p-10 text-center">
      <div className="text-[18px] font-semibold">{title}</div>
      {children && <p className="mx-auto mt-2 max-w-[52ch] text-ink-2">{children}</p>}
    </div>
  );
}

/** Lightweight tooltip anchored to a container; position in container px. */
export function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 min-w-[150px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-line-2 bg-surface px-3 py-2 text-[12.5px] shadow-[0_20px_40px_-12px_rgb(0_0_0/0.5)]"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
}

export function useReduced() {
  return useReducedMotion();
}
