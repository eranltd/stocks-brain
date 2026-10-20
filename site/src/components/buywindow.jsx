import { dayWords } from "../lib/buywindow.js";
import { ArrowRight, Reveal } from "./ui.jsx";

/*
 * "When could we buy it?": what our own house rules say about one company or fund, in this order: real money first (the
 * weekly buy of the whole-market fund), then the weekly game (its next look, and for each weekly rule whether it would
 * pick the name if today were its decision day, and why), then the monthly rule (folded away), the house checks, what to
 * wait for, and one honest line. Wording: lib/buywindow.js. Made for a phone: one column, big plain headline, rows that
 * wrap.
 */

const TONE = {
  wait: { text: "text-people", border: "border-people/40", bar: "var(--people)" },
  rules_allow: { text: "text-accent", border: "border-accent/50", bar: "var(--accent)" },
  not_ours: { text: "text-ink", border: "border-line-2", bar: "var(--ink-3)" },
};

const MARK = {
  true: { glyph: "✓", cls: "bg-accent/15 text-accent", label: "met" },
  false: { glyph: "✕", cls: "bg-down/15 text-down", label: "not met" },
  null: { glyph: "?", cls: "bg-surface-2 text-ink-3", label: "not known today" },
};

function Head({ children }) {
  return <h3 className="meta mb-2 text-accent">{children}</h3>;
}

function Mark({ ok, small = false }) {
  const m = MARK[String(ok)] ?? MARK.null;
  return <span className={`grid shrink-0 place-items-center rounded-full font-semibold ${small ? "mt-0.5 size-6 text-[12px]" : "mt-0.5 size-8 text-[14px]"} ${m.cls}`} role="img" aria-label={m.label}>{m.glyph}</span>;
}

/** Full rows: a check, its value now and what it needs. */
function Rows({ rows }) {
  return (
    <ul className="grid gap-2">
      {rows.map((c) => (
        <li key={c.id} className="flex min-h-[52px] items-start gap-3 rounded-2xl border border-line px-4 py-3">
          <Mark ok={c.ok} />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] leading-snug text-ink">{c.label}</span>
            <span className="mt-1 block text-[14px] leading-snug text-ink-2">
              <span className="text-ink-3">Now:</span> <span className="num">{c.now}</span>
            </span>
            <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">
              <span className="text-ink-3">Needs:</span> <span className="num">{c.need}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One rule's look, compact: "<rule>: would pick it" or "would not pick it: why", then its checks in one line each. */
function RuleBlock({ r, showDate = false }) {
  return (
    <li className="rounded-2xl border border-line-2 p-4">
      <div className="flex items-start gap-3">
        <Mark ok={r.would} />
        <p className="min-w-0 flex-1 pt-1 text-[16.5px] leading-snug text-ink">
          <span className="font-semibold">{r.name}:</span> {r.line}{!r.would && r.why ? `: ${r.why}` : ""}.
          {showDate && r.nextReview && <span className="block text-[14px] text-ink-3">Next look {dayWords(r.nextReview)}</span>}
        </p>
      </div>
      <ul className="mt-3 grid gap-1.5 border-t border-line pt-3">
        {r.conditions.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <Mark ok={c.ok} small />
            <span className="min-w-0 flex-1 text-[14.5px] leading-snug text-ink-2">
              <span className="text-ink">{c.label}.</span> <span className="num">{c.now}</span>
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function BuyWindowCard({ a, go }) {
  if (!a) return null;
  const t = TONE[a.tone] ?? TONE.wait;
  const hasGame = a.games?.length > 0;
  const condHead = a.kind === "main" ? (a.available ? "Our house checks" : "Our checks today") : "Our checks today (for learning only)";
  const mlines = (a.monthly ?? []).map((r) => r.line);
  // Both monthly versions usually agree: then one phrase; otherwise each version's own.
  const monthlyLine = new Set(mlines).size === 1 ? mlines[0] : (a.monthly ?? []).map((r) => `${r.name}: ${r.line}`).join(" · ");
  return (
    <Reveal as="section" id="buy-window" aria-labelledby="buy-window-title" className={`card mt-6 scroll-mt-28 overflow-hidden ${t.border}`}>
      <div className="h-1.5" style={{ background: t.bar }} aria-hidden="true" />
      <div className="p-6 sm:p-8">
        <h2 id="buy-window-title" className="text-[15px] font-semibold uppercase tracking-[0.12em] text-accent">When could we buy it?</h2>
        <p className={`mt-3 text-[clamp(24px,6.5vw,32px)] leading-[1.15] font-semibold tracking-[-0.02em] ${t.text}`}>{a.headline}</p>

        <div className="mt-6 rounded-2xl border border-line-2 bg-surface-2 p-4 sm:p-5">
          <p className="meta normal-case tracking-[0.04em] text-accent">Real money</p>
          <p className="mt-1 text-[17px] leading-relaxed text-ink">{a.realMoney}</p>
        </div>

        {(hasGame || a.nextLook) && (
          <div className="mt-7">
            {hasGame && <Head>Pretend money: the weekly game</Head>}
            {a.nextLook && (
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
                </span>
                <p className="min-w-0 pt-1.5 text-[16.5px] leading-relaxed text-ink">{a.nextLook}</p>
              </div>
            )}
            {hasGame && (
              <>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-3">If that look were today:</p>
                <ul className="mt-2 grid gap-3">{a.games.map((r) => <RuleBlock key={r.id} r={r} />)}</ul>
              </>
            )}
          </div>
        )}

        {a.monthly?.length > 0 && (
          <details className="group mt-4 rounded-2xl border border-line-2">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-3 text-[16px] leading-snug text-ink">
              <span className="min-w-0 flex-1"><span className="font-semibold">Monthly rule:</span> <span className="text-ink-2">{monthlyLine}</span></span>
              <ArrowRight className="size-4 shrink-0 rotate-90 text-ink-3 transition group-open:-rotate-90" />
            </summary>
            <ul className="grid gap-3 px-3 pb-3">{a.monthly.map((r) => <RuleBlock key={r.id} r={r} showDate />)}</ul>
          </details>
        )}

        {a.conditions.length > 0 && (
          <div className="mt-7">
            <Head>{condHead}</Head>
            <Rows rows={a.conditions} />
          </div>
        )}

        {a.waitFor.length > 0 && (
          <div className="mt-7">
            <Head>{a.tone === "rules_allow" ? "Still to keep in mind" : "What to wait for"}</Head>
            <ul className="grid gap-2 text-[16.5px] leading-relaxed text-ink">
              {a.waitFor.map((w) => <li key={w} className="relative ps-4 before:absolute before:start-0 before:top-[0.75em] before:h-px before:w-2 before:bg-ink-3">{w}</li>)}
            </ul>
          </div>
        )}

        <p className="mt-6 border-t border-line pt-4 text-[14.5px] leading-relaxed text-ink-2">{a.note}</p>
        {go && (
          <button type="button" onClick={() => go("admin")} className="meta mt-3 inline-flex min-h-[44px] items-center gap-1 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
            Our house rules <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    </Reveal>
  );
}

const LINE_DOT = { accent: "var(--accent)", flat: "var(--people)" };

/** The one short line on a home company card ("When to buy: not this week (see why)"), tappable to the Stock page's card. */
export function BuyLine({ line, onClick }) {
  if (!line) return null;
  return (
    <button type="button" onClick={onClick}
      className="mt-4 flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-line-2 px-4 py-2.5 text-start transition hover:border-ink-3">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: LINE_DOT[line.tone] ?? "var(--ink-3)" }} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[16px] leading-snug text-ink">{line.text}</span>
      <ArrowRight className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}
