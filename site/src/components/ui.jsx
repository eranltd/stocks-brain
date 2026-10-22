import { Children, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCountUp, useInView, useReducedMotion } from "../lib/motion.js";
import { fmtNum, fmtPct, signTone } from "../lib/format.js";
import shellText from "../text/shell.js";
import { strings } from "../lib/text.js";

/*
 * THE KIT: every page builds on these. The look: a near-black canvas with a faint grid (Field in shell.jsx), thin
 * hairline panels, condensed uppercase headlines (white line + orange line), mono tabular numbers, green up / red down /
 * amber wait, and one orange glow on the hero or active element only. Tokens and classes live in index.css (.panel,
 * .tile, .chip, .headline, .kicker, .micro, .spaced, .font-num, .glow ...). Words live in text/*.js, never here.
 *
 * Layout
 *   Container        the page column (max 1280, 16px gutter on a phone). Every page section sits in one.
 *   Reveal           fade/rise a block in when it scrolls into view. Use sparingly: hero blocks, not table rows.
 * Headlines
 *   HeroTitle        THE page headline: two condensed uppercase lines, white then orange, optional spaced subtitle and
 *                    kicker. One per page, at the top. ({line1, line2, sub, eyebrow, size: xl|lg|md|sm, as, id})
 *   SectionTitle     a section's or panel's title, condensed uppercase, optional orange "AGENT n ·" / eyebrow kicker
 *                    and a one-line sub. ({title, agent, eyebrow, sub, right, size: xs|sm|md|lg, as, id})
 *   Headline, Accent the older kinetic headline (words rise in); Accent marks the orange words. Prefer HeroTitle.
 *   SectionHead      older eyebrow + Headline + lede block; prefer SectionTitle (no lede: put prose in an InfoTip).
 * Surfaces
 *   Panel            the bordered box for any block of content. Header slot: title (or `head`), badge, (i) info
 *                    toggle whose text stays hidden until asked. `hero` = the one glowing element on a page (orange
 *                    border + glow); `active` = orange border only (the section in view). ({id, title, agent, eyebrow,
 *                    sub, head, badge, info, infoLabel, hero, active, flush, titleSize, as, className, bodyClassName})
 *   StatTile         one big number: mono label, big tabular value, delta chip, sub line, mini bars or a sparkline.
 *                    Use in rows of 2-4 for the headline numbers of a page. ({label, value, unit, delta, deltaD, sub,
 *                    note, bars, barsHi, spark, onClick, ariaLabel, tone})
 *   EmptyState       nothing to show yet (dashed tile, icon, condensed title, one line, optional action). Empty is
 *                    the older name, kept.
 *   Skeleton,        loading placeholders that keep the layout steady; shimmer is off under reduced motion.
 *   SkeletonRows
 * Data
 *   DataTable        dense table: sticky header (when the scroll box has a max height), sticky first column, sortable
 *                    columns, mono numbers, row hover, sideways scroll inside the panel on a phone, whole-row tap.
 *                    ({columns: [{key, label, align, sortable, sortValue, num, cell, className, firstDir}], rows,
 *                    rowKey, sort+onSort (controlled) or defaultSort, onRowClick, rowLabel, rowTone, minWidth,
 *                    scrollClassName, caption, bleed})
 *   MiniSpark        a tiny line of values (no axis, no numbers, aria-hidden): table rows, tiles. The big interactive
 *                    one is Sparkline in charts.jsx.
 *   MiniBars         a tiny bar chart (aria-hidden); diverging around zero when a value is negative. Tiles.
 *   Delta            a percent change: true minus sign, green/red/grey, optional arrow and chip. Percent only.
 *   CountUp          a number that counts up once in view.
 *   Strip            the older bracketed stat strip, kept.
 * Status
 *   Chip             small status label. New: `tone` neutral|up|down|wait|brand|ai|people|ghost, `check` for a green
 *                    tick, `icon` for any glyph. Older: `kind` (hit, miss, bullish, ...) still works.
 *   CallButton       the big call: buy = "BUY (paper)" green, enter green, wait amber, reject / skip red. Solid when
 *                    `active`, dim outline when not; `size` sm|md|lg. A button when it has onClick, else a span.
 *   CallChip         the same call as a compact tinted chip for table rows and lists (`solid` to fill it).
 *   callLabel(call)  the kit's word for a call ("BUY (paper)", "Wait", ...), for aria labels and custom layouts.
 *   Stamp            a rubber stamp (rejected red, approved green, wait amber) laid over a ticket or card corner.
 *   SimBadge         "PAPER TRADING · SIMULATED" (or `short`: "PAPER"): on every screen that shows a paper call.
 *   Conviction, Dot  three small bars for low / medium / high; a coloured dot.
 *   StepMark         a state mark (done ✓ green, wait clock amber, fail ✕ red, idle dot) with its words for screen readers.
 *   CheckIcon, CrossIcon, ClockIcon   crisp SVG marks (the web fonts have no ✓ ✕); they take the text colour.
 *   PipelineStrip    a row of numbered steps with a state mark each (done | wait | fail | idle), the active one lit
 *                    orange; steps are buttons when onStep is given. `lead`/`trail` slots; `sticky` + `top` to pin it
 *                    under the header; `variant="footer"` for the labelled strip at the end of a page.
 *   Connector        decorative orange elbow / straight line between panels (aria-hidden). Absolutely placed by the
 *                    caller with className; shape v|h|down-left|down-right. Hide it on a phone (hidden md:block).
 *   InfoTip          an (i) button that pops a short explanation. Pages show little prose: put "what this shows"
 *                    text here. InfoButton is the bare (i) for custom headers.
 * Controls
 *   Segmented        a small switch of 2-5 options (aria-pressed buttons); `tall` gives 44px+ buttons.
 *   IconButton, Chevron, ArrowRight, Carousel, CodeBlock, Tip   small shared controls, kept.
 *
 * Rules every page keeps: percent changes only (never a price or raw volume), tabular numbers (font-num), tap targets
 * of at least 44px, BUY always reads "BUY (paper)", motion off under prefers-reduced-motion, the glow on one element.
 */

const tx = () => strings(shellText);

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

export const Accent = ({ children }) => <span className="text-desk">{children}</span>;

/** Big kinetic headline: each word rises out of a mask, staggered. */
export function Headline({ children, className = "", as: Tag = "h1", size = "lg" }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const sizes = {
    xl: "text-[clamp(46px,11vw,120px)]",
    lg: "text-[clamp(40px,8vw,88px)]",
    md: "text-[clamp(32px,6vw,56px)]",
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
              className={`inline-block transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(.16,1,.3,1)] ${accent ? "text-desk" : ""} ${inView ? "translate-y-0 opacity-100" : "translate-y-[105%] opacity-0"}`}
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
        {eyebrow && <Reveal className="eyebrow mb-4">{eyebrow}</Reveal>}
        <Headline as="h2" size={size}>{title}</Headline>
        {lede && (
          <Reveal delay={200} as="p" className="mt-4 max-w-[62ch] text-[clamp(15px,1.5vw,17px)] leading-relaxed text-ink-2">
            {lede}
          </Reveal>
        )}
      </div>
      {right && <Reveal delay={300} className="flex min-w-0 max-w-full items-center gap-3">{right}</Reveal>}
    </div>
  );
}

/* --------------------------------------------------------------- headlines */

const HERO_SIZE = {
  xl: "text-[clamp(56px,15vw,132px)]",
  lg: "text-[clamp(48px,13vw,100px)]",
  md: "text-[clamp(36px,9vw,64px)]",
  sm: "text-[clamp(28px,7.2vw,40px)]",
};

/**
 * The page headline: line1 white, line2 orange (both condensed uppercase), an optional kicker above and a wide
 * letter-spaced subtitle below. `id` makes the heading focusable (tabIndex -1) for skip links and jumps.
 */
export function HeroTitle({ line1, line2, sub, eyebrow, as: Tag = "h1", size = "lg", align = "start", glow = true, id, className = "", children }) {
  const center = align === "center";
  return (
    <div className={`min-w-0 ${center ? "text-center" : ""} ${className}`}>
      {eyebrow && <p className={`kicker mb-3 flex items-center gap-2 ${center ? "justify-center" : ""}`}><span aria-hidden="true" className="h-px w-6 bg-desk" />{eyebrow}</p>}
      <Tag id={id} tabIndex={id ? -1 : undefined} className={`headline outline-none ${HERO_SIZE[size] ?? HERO_SIZE.lg}`}>
        <span className="block text-balance text-ink">{line1}</span>{line2 ? " " : null}
        {line2 && <span className={`block text-balance text-desk ${glow && size !== "sm" ? "hero-glow" : ""}`}>{line2}</span>}
      </Tag>
      {sub && <p className={`spaced mt-4 max-w-[52ch] ${center ? "mx-auto" : ""}`}>{sub}</p>}
      {children}
    </div>
  );
}

const SECTION_SIZE = { xs: "text-[18px]", sm: "text-[22px] sm:text-[24px]", md: "text-[28px] sm:text-[34px]", lg: "text-[clamp(32px,7vw,48px)]" };

/**
 * A section's or panel's title. `agent` puts an orange "AGENT n ·" before the title; `eyebrow` a kicker line above it;
 * `sub` one short line under it; `right` sits at the end of the row.
 */
export function SectionTitle({ title, agent, eyebrow, sub, right, as: Tag = "h2", size = "sm", id, className = "" }) {
  const t = tx();
  return (
    <div className={`flex min-w-0 items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="kicker mb-1.5">{eyebrow}</p>}
        <Tag id={id} tabIndex={id ? -1 : undefined} className={`headline leading-[0.95] outline-none ${SECTION_SIZE[size] ?? SECTION_SIZE.sm}`}>
          {agent != null && <span className="text-desk">{t("ui.agent", { n: agent })}<span aria-hidden="true"> · </span><span className="sr-only">: </span></span>}
          {title}
        </Tag>
        {sub && <p className="mt-1 text-[13px] leading-snug text-ink-3">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- surfaces */

/** The (i) button: 44px tap target, a small ring that turns orange while its text is open. `bleed` pulls it into a corner. */
export function InfoButton({ open, onClick, controls, label, bleed = false }) {
  const t = tx();
  return (
    <button type="button" aria-expanded={open} aria-controls={controls} aria-label={label ?? t("ui.info")} onClick={onClick}
      className={`grid size-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:text-ink ${bleed ? "-my-2 -me-2.5" : ""}`}>
      <span aria-hidden="true" className={`grid size-[22px] place-items-center rounded-full border font-display text-[13px] leading-none font-bold transition-colors ${open ? "border-desk bg-desk/15 text-desk" : "border-line-3"}`}>i</span>
    </button>
  );
}

/**
 * An (i) that pops a short explanation (closes on a tap outside or Escape). `align` start|end anchors the popover to the
 * button; it is nudged back inside the screen (16px gutter) when it would spill over an edge.
 */
export function InfoTip({ label, children, align = "end", className = "" }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const id = useId();
  const box = useRef(null);
  const pop = useRef(null);
  useLayoutEffect(() => {
    if (!open || !pop.current) { setShift(0); return; }
    const r = pop.current.getBoundingClientRect();
    const left = r.left - shift, right = r.right - shift, edge = 16, w = document.documentElement.clientWidth;
    setShift(right > w - edge ? w - edge - right : left < edge ? edge - left : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <span ref={box} className={`relative inline-flex align-middle ${className}`}>
      <InfoButton open={open} onClick={() => setOpen((v) => !v)} controls={id} label={label} />
      {open && (
        <span id={id} ref={pop} role="note" style={{ translate: `${shift}px 0` }}
          className={`absolute top-full z-[35] mt-1 block w-[min(300px,calc(100vw-32px))] animate-pop rounded-tile border border-line-2 bg-surface-2 p-3 text-start text-[13.5px] leading-snug font-normal tracking-normal text-ink-2 normal-case shadow-2xl motion-reduce:animate-none ${align === "start" ? "start-0" : "end-0"}`}>
          {children}
        </span>
      )}
    </span>
  );
}

/**
 * The bordered box. With a `title` (or a custom `head`) it gets a header row: title, `badge`, and an (i) toggle when
 * `info` is given (the text shows under the header only when asked). `hero`: the page's one glowing element. `active`:
 * an orange border (the section in view). `flush`: no body padding (a table that bleeds to the edges).
 */
export function Panel({ as: Tag = "section", id, title, agent, eyebrow, sub, head, badge, info, infoLabel, hero = false, active = false, flush = false,
  titleSize, className = "", bodyClassName = "", children, ...rest }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const hId = id ? `${id}-h` : `p${uid.replace(/[^a-zA-Z0-9_-]/g, "")}-h`;
  const tipId = `${hId}-info`;
  const hasHead = Boolean(title || head);
  return (
    <Tag id={id} aria-labelledby={hasHead ? hId : undefined} className={`panel ${hero ? "panel-hero" : active ? "panel-active" : ""} ${className}`} {...rest}>
      {hasHead && (
        <div className="flex items-start gap-3 border-b border-line px-4 pt-3.5 pb-3 sm:px-5">
          <div className="min-w-0 flex-1">
            {head ?? <SectionTitle id={hId} title={title} agent={agent} eyebrow={eyebrow} sub={sub} size={titleSize ?? (hero ? "md" : "sm")} />}
          </div>
          {badge && <div className="flex shrink-0 items-center gap-1.5 pt-0.5">{badge}</div>}
          {info && <InfoButton open={open} onClick={() => setOpen((v) => !v)} controls={tipId} label={infoLabel} bleed />}
        </div>
      )}
      {info && open && <div id={tipId} className="border-b border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-snug text-ink-2 sm:px-5">{info}</div>}
      <div className={flush ? bodyClassName : `p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
    </Tag>
  );
}

/** One big number. `delta` is a percent (Delta chip); `bars` a list of values (MiniBars, `barsHi` the lit bar); `spark` a list of values (MiniSpark). */
export function StatTile({ label, value, unit, delta, deltaD = 1, sub, note, bars, barsHi = 0, spark, tone = "brand", onClick, ariaLabel, disabled, className = "" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-label={ariaLabel} disabled={onClick ? disabled : undefined}
      className={`tile flex min-w-0 flex-col p-3 text-start sm:p-4 ${onClick ? "transition-colors hover:border-line-3 hover:bg-surface-3 disabled:hover:border-line disabled:hover:bg-surface-2" : ""} ${className}`}>
      <span className={`micro truncate ${tone === "brand" ? "text-desk" : ""}`}>{label}</span>
      <span className="font-num mt-2 block truncate text-[22px] leading-none font-bold tracking-[-0.03em] text-ink sm:text-[30px]">
        {value}{unit && <span className="ms-0.5 text-[0.6em] text-ink-2">{unit}</span>}
      </span>
      {(sub || delta != null) && (
        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {sub && <span className="font-num min-w-0 truncate text-[12.5px] font-bold text-ink-2">{sub}</span>}
          {delta != null && <Delta value={delta} d={deltaD} chip arrow />}
        </span>
      )}
      {(bars?.length > 0 || spark?.length > 1) && (
        <span className="mt-auto block pt-3">
          {bars?.length ? <MiniBars values={bars} hi={barsHi} /> : <MiniSpark values={spark} w={120} h={28} area fluid />}
        </span>
      )}
      {note && <span className="mt-1.5 hidden truncate text-[11.5px] text-ink-3 sm:block">{note}</span>}
    </Tag>
  );
}

const EmptyIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17l5-5 4 4 8-8" /><path d="M3 21h18" />
  </svg>
);

/** Nothing to show yet: a dashed tile with an icon, a condensed title, one line and an optional action. */
export function EmptyState({ icon, title, children, action, compact = false, className = "" }) {
  return (
    <div className={`tile grid justify-items-center border-dashed border-line-2 bg-transparent px-6 text-center ${compact ? "py-6" : "py-10"} ${className}`}>
      <span className="grid size-10 place-items-center rounded-full border border-line-2 bg-surface-2 text-ink-3">{icon ?? <EmptyIcon />}</span>
      {title && <p className="headline mt-3 text-[20px] text-ink">{title}</p>}
      {children && <p className="mt-1.5 max-w-[46ch] text-[14px] leading-snug text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Older name of EmptyState. */
export function Empty({ title, children }) {
  return <EmptyState title={title}>{children}</EmptyState>;
}

/** A loading placeholder of the given size (Tailwind classes). Hidden from screen readers; pair with a status text. */
export function Skeleton({ className = "h-4 w-full" }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

/** A few placeholder rows for a list or table that is loading; announces "Loading" once. */
export function SkeletonRows({ rows = 4, className = "" }) {
  const t = tx();
  return (
    <div role="status" className={`grid gap-2 ${className}`}>
      <span className="sr-only">{t("ui.loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- data */

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

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const UPDOWN_TEXT = { accent: "text-up", down: "text-down", flat: "text-ink-2" };
const UPDOWN_CHIP = { accent: "border-up/30 bg-up/10", down: "border-down/30 bg-down/10", flat: "border-line-2 bg-surface-3" };

const Tri = ({ up }) => (
  <svg viewBox="0 0 10 10" className={`size-[7px] shrink-0 ${up ? "" : "rotate-180"}`} aria-hidden="true"><path d="M5 1.5 9 8.5H1Z" fill="currentColor" /></svg>
);

/** A percent change: "+1.2%" / "−0.8%" in green / red / grey (by what shows at `d` decimals). `chip` boxes it; `arrow` adds ▲/▼. */
export function Delta({ value, d = 1, chip = false, arrow = false, className = "" }) {
  if (!isNum(value)) return <span className={`font-num text-ink-3 ${className}`}>–</span>;
  const tone = signTone(value, d);
  return (
    <span className={`font-num inline-flex items-center gap-1 font-semibold whitespace-nowrap ${UPDOWN_TEXT[tone]} ${chip ? `rounded-[6px] border px-1.5 py-[3px] text-[11px] leading-none ${UPDOWN_CHIP[tone]}` : ""} ${className}`}>
      {arrow && tone !== "flat" && <Tri up={tone === "accent"} />}
      {fmtPct(value, d)}
    </span>
  );
}

const SPARK_TONE = { up: "var(--up)", down: "var(--down)", brand: "var(--desk)", flat: "var(--ink-3)" };

/**
 * A tiny line (no axis, no numbers; aria-hidden): green when it ended at or above where it began, red when below, or a
 * fixed `tone`. `area` adds a soft fill; `fluid` stretches it to its box's width.
 */
export function MiniSpark({ values, w = 64, h = 22, tone, area = false, fluid = false, className = "" }) {
  const gid = `g${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!values || values.length < 2) return <span className="font-num text-ink-3">–</span>;
  const lo = Math.min(...values), hi = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 2) + 1, 1.5 + (1 - (v - lo) / (hi - lo || 1)) * (h - 3)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const color = SPARK_TONE[tone ?? (values.at(-1) >= values[0] ? "up" : "down")];
  return (
    <svg width={fluid ? "100%" : w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`block ${fluid ? "" : "ms-auto"} ${className}`} aria-hidden="true">
      {area && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.28" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d}L${w - 1},${h}L1,${h}Z`} fill={`url(#${gid})`} />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * A tiny bar chart (aria-hidden). Bars from the bottom; around a middle line when any value is negative (green above,
 * red below). `hi`: the index of the lit (orange) bar, or -1 for none.
 */
export function MiniBars({ values, hi = 0, h = 30, className = "" }) {
  const xs = (values ?? []).filter(isNum);
  if (!xs.length) return null;
  const max = Math.max(...xs.map(Math.abs)) || 1;
  const diverging = xs.some((v) => v < 0);
  return (
    <span aria-hidden="true" className={`flex items-stretch gap-[3px] ${className}`} style={{ height: h }}>
      {xs.map((v, i) => {
        const pct = Math.max(8, (Math.abs(v) / max) * (diverging ? 50 : 100));
        const lit = i === hi;
        const color = lit ? "bg-desk shadow-[0_0_10px_var(--desk-glow)]" : diverging ? (v < 0 ? "bg-down/70" : "bg-up/70") : "bg-ink-3/45";
        return (
          <span key={i} className="relative min-w-[3px] flex-1">
            <span className={`absolute inset-x-0 rounded-[2px] ${color}`}
              style={diverging ? (v < 0 ? { top: "50%", height: `${pct}%` } : { bottom: "50%", height: `${pct}%` }) : { bottom: 0, height: `${pct}%` }} />
          </span>
        );
      })}
    </span>
  );
}

const alignOf = (a) => (a === "start" ? "text-start" : a === "center" ? "text-center" : "text-end");
const ROW_TONE = {
  brand: "bg-[color-mix(in_srgb,var(--desk)_8%,var(--surface))]",
  up: "bg-[color-mix(in_srgb,var(--up)_7%,var(--surface))]",
  down: "bg-[color-mix(in_srgb,var(--down)_7%,var(--surface))]",
};
const missing = (v) => v == null || (typeof v === "number" && !Number.isFinite(v));

/**
 * A dense table. columns: [{key, label, align (end by default; start for the first), sortable, sortValue(row), num (mono
 * numbers), cell(row) -> node, className (string or row -> string), firstDir ("desc" | "asc")}]. Sorting is controlled
 * (`sort` {key, dir} + `onSort(key)`: the caller sorts the rows) or internal (`defaultSort`; missing values last). The
 * first column is sticky and holds a button when `onRowClick` is given, so a row opens from the keyboard too. The box
 * scrolls sideways on a narrow screen; give `scrollClassName` a max height (md:max-h-[520px]) to pin the header.
 */
export function DataTable({ columns, rows, rowKey = (r, i) => i, sort, onSort, defaultSort = null, onRowClick, rowLabel, rowTone, minWidth = 560,
  scrollClassName = "", caption, bleed = true, className = "" }) {
  const t = tx();
  const [own, setOwn] = useState(defaultSort);
  const controlled = sort !== undefined;
  const cur = controlled ? sort : own;
  const shown = useMemo(() => {
    if (controlled || !cur) return rows;
    const col = columns.find((c) => c.key === cur.key);
    const val = col?.sortValue ?? ((r) => r[cur.key]);
    const sign = cur.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (missing(x) || missing(y)) return missing(x) === missing(y) ? 0 : missing(x) ? 1 : -1;
      return sign * (typeof x === "string" ? x.localeCompare(String(y)) : x - y);
    });
  }, [rows, columns, cur, controlled]);
  const by = (c) => {
    if (onSort) { onSort(c.key); return; }
    setOwn((s) => ({ key: c.key, dir: s?.key === c.key ? (s.dir === "desc" ? "asc" : "desc") : c.firstDir ?? "desc" }));
  };
  const last = columns.length - 1;
  const edge = (i) => `${i === 0 ? "sticky left-0 ps-4 sm:ps-5" : ""} ${i === last ? "pe-4 sm:pe-5" : ""}`;
  return (
    <div className={`thin-scroll overflow-x-auto ${bleed ? "-mx-4 sm:-mx-5" : ""} ${scrollClassName} ${className}`}>
      <table className="w-full border-separate border-spacing-0 text-[13px]" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c, i) => {
              const on = c.sortable && cur?.key === c.key;
              return (
                <th key={c.key ?? `c${i}`} scope="col" aria-sort={on ? (cur.dir === "desc" ? "descending" : "ascending") : undefined}
                  className={`micro sticky top-0 h-11 border-b border-line-2 bg-surface px-2 font-semibold whitespace-nowrap ${i === 0 ? "z-30" : "z-20"} ${alignOf(c.align ?? (i === 0 ? "start" : "end"))} ${edge(i)}`}>
                  {c.sortable ? (
                    <button type="button" onClick={() => by(c)} aria-label={t("ui.sortBy", { col: typeof c.label === "string" ? c.label : c.key })}
                      className={`inline-flex min-h-[44px] items-center gap-1 uppercase transition-colors ${on ? "text-desk" : "hover:text-ink"}`}>
                      {c.label}
                      <span aria-hidden="true" className="inline-block w-2 text-[10px]">{on ? (cur.dir === "desc" ? "↓" : "↑") : ""}</span>
                    </button>
                  ) : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, ri) => {
            const tone = ROW_TONE[rowTone?.(r)] ?? "bg-surface";
            return (
              <tr key={rowKey(r, ri)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={`group h-11 ${onRowClick ? "cursor-pointer" : ""}`}>
                {columns.map((c, i) => {
                  const Cell = i === 0 ? "th" : "td";
                  const content = c.cell ? c.cell(r) : r[c.key];
                  const extra = typeof c.className === "function" ? c.className(r) : c.className ?? "";
                  return (
                    <Cell key={c.key ?? `c${i}`} scope={i === 0 ? "row" : undefined}
                      className={`border-b border-line px-2 py-0 font-normal transition-colors group-last:border-b-0 group-hover:bg-surface-2 ${tone} ${i === 0 ? "z-10" : ""} ${alignOf(c.align ?? (i === 0 ? "start" : "end"))} ${c.num ? "font-num whitespace-nowrap" : ""} ${edge(i)} ${extra}`}>
                      {i === 0 && onRowClick ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onRowClick(r); }} aria-label={rowLabel?.(r)}
                          className="flex min-h-[44px] w-full items-center text-start">
                          {content}
                        </button>
                      ) : content}
                    </Cell>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The bracketed stat strip ("7 steps | 1 AI step | You"). */
/** `dense`: two columns on phones with descriptions hidden, so key numbers fit on one screen. */
export function Strip({ cells, dense = false }) {
  return (
    <Reveal className={`card brackets grid overflow-hidden lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))] ${dense ? "grid-cols-2" : "sm:grid-cols-2"}`} style={{ "--n": cells.length }}>
      {cells.map((c, i) => (
        <div key={i} className={`border-line ${dense ? "border-b p-5 sm:p-8 [&:nth-child(odd)]:border-e lg:border-b-0 lg:[&:not(:last-child)]:border-e" : "p-6 sm:p-8 [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-e lg:[&:not(:last-child)]:border-b-0"}`}>
          <div className={`display num ${dense ? "text-[clamp(34px,5.5vw,68px)]" : "text-[clamp(44px,5.5vw,68px)]"}`}>{c.value}</div>
          <div className={`mt-3 flex items-center gap-2 text-[14px] font-semibold ${TONES[c.tone ?? "accent"]}`}>
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

/* ------------------------------------------------------------------ status */

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

/** A crisp tick (the web fonts have no ✓): inherits the text colour. */
export const CheckIcon = ({ className = "size-3" }) => (
  <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
);
/** A crisp cross, for a failed check. */
export const CrossIcon = ({ className = "size-3" }) => (
  <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="m4.5 4.5 7 7m0-7-7 7" />
  </svg>
);
/** A small clock, for "waiting". */
export const ClockIcon = ({ className = "size-3" }) => (
  <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" />
  </svg>
);

const CHIP_TONE = {
  neutral: "border-line-2 bg-surface-2 text-ink-2",
  up: "border-up/35 bg-up/10 text-up",
  down: "border-down/35 bg-down/10 text-down",
  wait: "border-wait/40 bg-wait/10 text-wait",
  brand: "border-desk/50 bg-desk/10 text-desk",
  ai: "border-ai/40 bg-ai/10 text-ai",
  people: "border-people/50 bg-people/5 text-people",
  ghost: "border-dashed border-line-3 text-ink-3",
};

const CHIP = {
  hit: "bg-accent/12 text-accent border-accent/30",
  miss: "bg-down/12 text-down border-down/30",
  flat: "bg-flat/15 text-ink-2 border-line-2",
  pending: "text-ink-3 border-dashed border-line-3",
  bullish: "bg-accent/12 text-accent border-accent/30",
  bearish: "bg-down/12 text-down border-down/30",
  neutral: "bg-flat/15 text-ink-2 border-line-2",
  active: "bg-accent/12 text-accent border-accent/30",
  retired: "text-ink-3 border-dashed border-line-3",
  planned: "text-people border-dashed border-people/50",
  disabled: "text-ink-3 border-line-2",
  failed: "bg-down/12 text-down border-down/30",
  ok: "bg-accent/12 text-accent border-accent/30",
  sample: "text-people border-dashed border-people/60",
  passes_history: "bg-accent/12 text-accent border-accent/30",
  candidate: "text-people border-people/50",
  inconclusive: "text-ink-2 border-line-2",
  rejected: "bg-down/12 text-down border-down/30",
  needs_data: "text-people border-dashed border-people/50",
  process_only: "text-ai border-ai/40 bg-ai/10",
  testable_now: "text-ink-2 border-line-2",
  reference_baseline: "text-ink-2 border-line-2",
  control: "text-ink-3 border-dashed border-line-3",
  baseline: "text-ink-3 border-line-2",
  no_clear_difference: "text-ink-2 border-line-2",
  too_few_independent_windows: "text-ink-3 border-dashed border-line-3",
  better: "bg-accent/12 text-accent border-accent/30",
  worse: "bg-down/12 text-down border-down/30",
  ai: "text-ai border-ai/40 bg-ai/10",
};
const ARROW = { bullish: "▲", bearish: "▼", neutral: "◆", hit: "✓", miss: "✕", flat: "–" };

/**
 * A small status label. New style: `tone` (neutral | up | down | wait | brand | ai | people | ghost), `check` for a green
 * tick, `icon` for any glyph. Older style: `kind` (hit, miss, bullish, bearish, ...) picks its own colour and arrow.
 */
export function Chip({ kind, tone, check = false, icon = true, children, className = "", title }) {
  if (tone || check || (icon && typeof icon !== "boolean")) {
    const t = tone ?? "neutral";
    return (
      <span title={title} className={`chip ${CHIP_TONE[t] ?? CHIP_TONE.neutral} ${className}`}>
        {check && <span className="text-up"><CheckIcon /></span>}
        {icon && typeof icon !== "boolean" && <span aria-hidden="true" className="inline-flex">{icon}</span>}
        {children ?? kind}
      </span>
    );
  }
  return (
    <span title={title} className={`pill ${CHIP[kind] ?? ""} ${className}`}>
      {icon && ARROW[kind] && <span aria-hidden="true" className="text-[9px]">{ARROW[kind]}</span>}
      {children ?? kind}
    </span>
  );
}

const CALL = {
  buy: { tone: "up", key: "ui.call.buy" },
  enter: { tone: "up", key: "ui.call.enter" },
  wait: { tone: "wait", key: "ui.call.wait" },
  reject: { tone: "down", key: "ui.call.reject" },
  skip: { tone: "down", key: "ui.call.skip" },
};
const CALL_SOLID = { up: "border-up bg-up text-bg glow-up", wait: "border-wait bg-wait text-bg glow-wait", down: "border-down bg-down text-bg glow-down" };
const CALL_TINT = { up: "border-up/45 bg-up/10 text-up", wait: "border-wait/50 bg-wait/10 text-wait", down: "border-down/45 bg-down/10 text-down" };
const CALL_SIZE = { sm: "h-9 px-3 text-[14px] rounded-[8px]", md: "h-11 px-4 text-[17px] rounded-[10px]", lg: "h-14 px-6 text-[22px] rounded-[12px]" };

/** The label of a call ("BUY (paper)", "WAIT", ...), from the kit's words. */
export const callLabel = (call) => tx()(CALL[call]?.key ?? "ui.call.wait");

/**
 * A call as a big button. `active` (default) = solid with a soft glow; not active = a dim outline (the calls not made).
 * A button when it has onClick, otherwise a span (pass `as` to force). `label` overrides the word (BUY keeps "(paper)").
 */
export function CallButton({ call, label, size = "md", active = true, as, onClick, className = "", ...rest }) {
  const c = CALL[call] ?? CALL.wait;
  const Tag = as ?? (onClick ? "button" : "span");
  return (
    <Tag type={Tag === "button" ? "button" : undefined} onClick={onClick} {...rest}
      className={`headline inline-flex items-center justify-center gap-1.5 border tracking-[0.06em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-300 ${CALL_SIZE[size] ?? CALL_SIZE.md} ${active ? CALL_SOLID[c.tone] : "border-line-2 bg-transparent text-ink-3"} ${className}`}>
      {label ?? callLabel(call)}
    </Tag>
  );
}

/** The same call as a compact tinted chip (table rows, lists). */
export function CallChip({ call, label, solid = false, className = "" }) {
  const c = CALL[call] ?? CALL.wait;
  return (
    <span className={`headline inline-flex h-8 items-center justify-center rounded-[8px] border px-2.5 text-[14.5px] tracking-[0.06em] whitespace-nowrap ${solid ? CALL_SOLID[c.tone] : CALL_TINT[c.tone]} ${className}`}>
      {label ?? callLabel(call)}
    </span>
  );
}

const STAMP_TONE = { rejected: "text-down", approved: "text-up", wait: "text-wait" };
const STAMP_SIZE = { sm: "text-[12px]", md: "text-[16px]", lg: "text-[26px]" };

/** A rubber stamp: REJECTED (red), APPROVED (green) or ON HOLD (amber), tilted `rotate` degrees. Decorative text stays readable. */
export function Stamp({ kind = "rejected", children, size = "md", rotate = -8, className = "" }) {
  const t = tx();
  return (
    <span className={`stamp ${STAMP_TONE[kind] ?? STAMP_TONE.rejected} ${STAMP_SIZE[size] ?? STAMP_SIZE.md} ${className}`} style={{ "--stamp-r": `${rotate}deg` }}>
      {children ?? t(`ui.stamp.${kind}`)}
    </span>
  );
}

/** "PAPER TRADING · SIMULATED" with a slow orange beacon; `short` shows "PAPER" (the full words stay for screen readers). */
export function SimBadge({ short = false, className = "" }) {
  const t = tx();
  return (
    <span className={`chip border-desk/55 bg-desk/10 text-desk ${className}`} title={short ? t("ui.sim") : undefined}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-desk shadow-[0_0_8px_var(--desk)] motion-safe:animate-[beacon_2.4s_ease-in-out_infinite]" />
      {short ? <><span aria-hidden="true">{t("ui.simShort")}</span><span className="sr-only">{t("ui.sim")}</span></> : t("ui.sim")}
    </span>
  );
}

export function Conviction({ level, showLabel = true, tone = "accent" }) {
  const t = tx();
  const n = { low: 1, medium: 2, high: 3 }[level] ?? 0;
  const word = n ? t(`ui.conviction.${level}`) : level;
  return (
    <span className="meta inline-flex items-center gap-2" title={t("ui.convictionTitle", { level: word })}>
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={`block h-3 w-[3px] rounded-sm ${i < n ? (tone === "accent" ? "bg-accent" : "bg-ink-2") : "bg-line-2"}`} />
        ))}
      </span>
      {showLabel && <span className={n === 3 ? "text-accent" : ""}>{word}</span>}
    </span>
  );
}

const STEP_MARK = {
  done: ["text-up", CheckIcon],
  wait: ["text-wait", ClockIcon],
  fail: ["text-down", CrossIcon],
  idle: ["text-ink-3", ({ className }) => <span aria-hidden="true" className={`grid place-items-center ${className}`}><span className="size-1 rounded-full bg-current" /></span>],
};

/** A step's state mark (done ✓ green, wait clock amber, fail ✕ red, idle dot) with its words for screen readers. */
export function StepMark({ state = "idle", label, className = "size-3" }) {
  const [tone, Icon] = STEP_MARK[state] ?? STEP_MARK.idle;
  return (
    <span className={`inline-flex ${tone}`}>
      <Icon className={className} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/**
 * Numbered steps in a row, each with a state mark: steps [{id, label, state (done | wait | fail | idle), stateLabel}].
 * `active` lights one step orange; `onStep(id)` makes the steps buttons. `lead` and `trail` sit at either end. `sticky`
 * pins the strip under the header at `top` px. `variant="footer"` is the labelled strip at a page's end (`title`).
 */
export function PipelineStrip({ ref, steps, active, onStep, label, lead, trail, sticky = false, top = 0, variant = "bar", title, className = "" }) {
  const rail = useRef(null);
  const reduced = useReducedMotion();
  // Keep the lit step in view on a narrow screen (the rail scrolls sideways inside itself, never the page).
  useEffect(() => {
    const box = rail.current;
    const el = box?.querySelector(`[data-step="${active}"]`);
    if (!el || !box) return;
    const l = el.offsetLeft - box.offsetLeft, r = l + el.offsetWidth;
    if (l < box.scrollLeft || r > box.scrollLeft + box.clientWidth) box.scrollTo({ left: Math.max(0, l - 24), behavior: reduced ? "auto" : "smooth" });
  }, [active, reduced]);
  const footer = variant === "footer";
  const Step = onStep ? "button" : "span";
  const Box = onStep ? "nav" : "section"; // steps you can jump to are navigation; a summary strip is a labelled section
  return (
    <Box ref={ref} aria-label={label} style={sticky ? { top } : undefined}
      className={`${sticky ? "sticky z-30 border-y border-line-2 bg-bg/90 backdrop-blur-xl" : ""} ${footer ? "panel overflow-hidden" : ""} ${className}`}>
      {footer && title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
          <p className="kicker flex items-center gap-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-desk shadow-[0_0_8px_var(--desk)]" />{title}</p>
          {trail}
        </div>
      )}
      <div className={`mx-auto flex w-full items-center gap-2 ${sticky ? "max-w-[1280px] px-4 sm:px-8 lg:px-12" : footer ? "px-2 sm:px-3" : ""}`}>
        {lead && <span className="shrink-0">{lead}</span>}
        <ol ref={rail} className="no-scrollbar rail-fade flex min-w-0 flex-1 items-center overflow-x-auto">
          {steps.map((s, i) => {
            const on = s.id === active;
            return (
              <li key={s.id} className="flex shrink-0 items-center">
                <Step type={onStep ? "button" : undefined} data-step={s.id} onClick={onStep ? () => onStep(s.id) : undefined} aria-current={on ? "step" : undefined}
                  className={`relative flex min-h-[44px] items-center gap-1.5 px-2 transition-colors ${on ? "text-desk" : "text-ink-2"} ${onStep && !on ? "hover:text-ink" : ""}`}>
                  <span className={`font-num text-[10px] font-semibold ${on ? "text-desk" : "text-ink-3"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <StepMark state={s.state} label={s.stateLabel} />
                  <span className="font-display text-[14px] leading-none font-bold tracking-[0.1em] uppercase">{s.label}</span>
                  {on && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-desk shadow-[0_0_10px_var(--desk)]" />}
                </Step>
                {i < steps.length - 1 && <span aria-hidden="true" className={`h-px w-3 sm:w-5 ${s.state === "done" ? "bg-desk/60" : "bg-line-3"}`} />}
              </li>
            );
          })}
        </ol>
        {trail && !footer && <span className="shrink-0">{trail}</span>}
      </div>
    </Box>
  );
}

const SHAPES = {
  v: { d: "M50,0 V100", a: [50, 0], b: [50, 100] },
  h: { d: "M0,50 H100", a: [0, 50], b: [100, 50] },
  "down-left": { d: "M100,0 V50 H0 V100", a: [100, 0], b: [0, 100] },
  "down-right": { d: "M0,0 V50 H100 V100", a: [0, 0], b: [100, 100] },
};

/**
 * A decorative orange line between two panels, with a node at each end (aria-hidden). The caller places its box with
 * className (absolute; the line runs inside it): v (top to bottom, centred), h (left to right, centred), down-left (top
 * right, down, across, down to bottom left), down-right. `flow` adds a slow marching dash (off under reduced motion).
 */
export function Connector({ shape = "v", className = "", dots = true, flow = true }) {
  const s = SHAPES[shape] ?? SHAPES.v;
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={s.d} className="connector-line" />
        {flow && <path d={s.d} className="connector-flow" />}
      </svg>
      {dots && [s.a, s.b].map(([x, y], i) => (
        <span key={i} className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-desk bg-bg shadow-[0_0_8px_var(--desk-glow)]" style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- controls */

/** `tall`: 44px buttons, for a control that is a page's main switch (Home's Desk | Details). */
export function Segmented({ options, value, onChange, label, tall = false }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-[12px] border border-line-2 bg-surface p-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`relative flex min-h-[38px] shrink-0 items-center gap-2 rounded-[9px] px-4 font-display text-[15px] font-bold tracking-[0.08em] uppercase transition duration-300 ${tall ? "min-h-[44px] px-5" : ""} ${on ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]" : "text-ink-3 hover:text-ink"}`}
          >
            {o.dot}
            {o.label}
            {o.count != null && <span className={`font-num text-[12px] font-semibold tracking-normal ${on ? "text-ink-2" : "text-ink-3"}`}>{o.count}</span>}
            {on && <span aria-hidden="true" className="absolute inset-x-3 bottom-1 h-[2px] rounded-full bg-desk" />}
          </button>
        );
      })}
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
      className="grid size-11 place-items-center rounded-[10px] border border-line-2 bg-surface-2 transition duration-300 hover:border-line-3 disabled:opacity-30"
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
  const t = tx();
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
        {meta && <span className="meta me-2">{meta}</span>}
        <IconButton label={t("ui.prev")} onClick={() => go(-1)} disabled={edge.start}><Chevron dir="left" /></IconButton>
        <IconButton label={t("ui.next")} onClick={() => go(1)} disabled={edge.end}><Chevron /></IconButton>
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
  const t = tx();
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
          <span className="meta">{t("ui.terminal")}</span>
        </div>
      )}
      <div className="flex items-center gap-3 rounded-[10px] border border-line-2 bg-bg/60 py-1.5 pe-1.5 ps-4">
        <code className="no-scrollbar min-w-0 flex-1 overflow-x-auto py-2 font-mono text-[13px] whitespace-nowrap">
          <span className="me-3 text-desk">$</span>
          {cmd}
        </code>
        <button type="button" onClick={copy} className="min-h-[44px] shrink-0 rounded-[8px] border border-line-2 px-4 text-[13px] font-semibold transition hover:border-line-3">
          {copied ? t("ui.copied") : t("ui.copy")}
        </button>
      </div>
    </div>
  );
}

/** Lightweight tooltip anchored to a container; position in container px. */
export function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 min-w-[150px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-[10px] border border-line-2 bg-surface-2 px-3 py-2 text-[12.5px] shadow-[0_20px_40px_-12px_rgb(0_0_0/0.5)]"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
}

export function useReduced() {
  return useReducedMotion();
}
