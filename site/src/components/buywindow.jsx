import { dayWords } from "../lib/buywindow.js";
import dict from "../text/stock.js";
import { ArrowRight, InfoTip, StepMark } from "./ui.jsx";
import { strings } from "../lib/text.js";

/*
 * "When could we buy it?": what this site's own rules say about one company or fund, in this order: real money first
 * (the weekly buy of the whole-market fund), then the weekly game (its next look, and for each weekly rule whether it
 * would pick the name if today were its decision day, and why), then the monthly rule (folded away), the site's checks,
 * what to wait for. Wording: lib/buywindow.js; the card's own words: text/stock.js "bwc.*". The Stock page wraps the
 * body in its panel (title, tone chip, the honest note behind the (i)). Compact: one line per check, a tick or a cross.
 */

/** The answer's tone as text colour and as the panel's chip. */
export const BW_TONE = {
  wait: { text: "text-wait", chip: "wait", word: "bwc.chip.wait" },
  rules_allow: { text: "text-up", chip: "up", word: "bwc.chip.allow" },
  not_ours: { text: "text-ink", chip: "neutral", word: "bwc.chip.notOurs" },
};

const MARK = { true: ["done", "bwc.mark.met"], false: ["fail", "bwc.mark.notMet"], null: ["idle", "bwc.mark.unknown"] };

function Mark({ ok, className = "size-3.5" }) {
  const t = strings(dict);
  const [state, label] = MARK[String(ok)] ?? MARK.null;
  return <StepMark state={state} label={t(label)} className={className} />;
}

const Head = ({ children }) => <h3 className="micro mb-1.5 text-desk">{children}</h3>;

/** The first sentence of a longer text ("With real money: not as a single stock today."). */
const firstSentence = (s) => String(s ?? "").match(/^.*?[.!?](?=\s|$)/)?.[0] ?? String(s ?? "");

/** One check per line: a mark, what it checks, its value now and (small) what it needs. */
function Rows({ rows }) {
  const t = strings(dict);
  return (
    <ul className="divide-y divide-line rounded-tile border border-line">
      {rows.map((c) => (
        <li key={c.id} className="flex items-start gap-2.5 px-3 py-2">
          <span className="pt-0.5"><Mark ok={c.ok} /></span>
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{c.label}</span>
          <span className="shrink-0 text-end">
            <span className="font-num block text-[12px] font-semibold text-ink">{c.now}</span>
            <span className="font-num block text-[10.5px] text-ink-3">{t("bwc.needShort", { need: c.need })}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One rule's look: "<rule>: would pick it" or "would not pick it" with why, then its checks one per line. */
function RuleBlock({ r, showDate = false }) {
  const t = strings(dict);
  return (
    <li className="rounded-tile border border-line bg-surface-2/50 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <span className="pt-0.5"><Mark ok={r.would} /></span>
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
          <span className="font-semibold">{r.name}</span>{" "}
          <span className={r.would ? "text-up" : "text-ink-2"}>{r.line}</span>
          {!r.would && r.why && <span className="block text-[12.5px] text-ink-3">{r.why}</span>}
          {showDate && r.nextReview && <span className="font-num block text-[11.5px] text-ink-3">{t("bwc.nextLook", { date: dayWords(r.nextReview) })}</span>}
        </p>
      </div>
      <ul className="mt-2 grid gap-1 border-t border-line pt-2">
        {r.conditions.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span className="pt-[3px]"><Mark ok={c.ok} className="size-3" /></span>
            <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink-2">{c.label}</span>
            <span className="font-num shrink-0 text-end text-[11.5px] text-ink-3">{c.now}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);

/** The panel's body for one buyWindow() answer `a`. */
export function BuyWindowBody({ a, go }) {
  const t = strings(dict);
  if (!a) return null;
  const tone = BW_TONE[a.tone] ?? BW_TONE.wait;
  const hasGame = a.games?.length > 0;
  const condHead = t(a.kind === "main" ? (a.available ? "bwc.cond.main" : "bwc.cond.today") : "bwc.cond.learn");
  const mlines = (a.monthly ?? []).map((r) => r.line);
  // Both monthly versions usually agree: then one phrase; otherwise each version's own.
  const monthlyLine = new Set(mlines).size === 1 ? mlines[0] : (a.monthly ?? []).map((r) => `${r.name}: ${r.line}`).join(" · ");
  const real = firstSentence(a.realMoney);
  return (
    <div className="grid gap-3">
      <p className={`text-[16.5px] leading-snug font-semibold tracking-[-0.01em] ${tone.text}`}>{a.headline}</p>

      <div className="grid gap-1.5">
        <div className="tile flex items-start gap-2.5 px-3 py-2">
          <span className="chip mt-0.5 shrink-0 border-desk/50 bg-desk/10 text-desk">{t("bwc.realMoney")}</span>
          <p className="min-w-0 flex-1 pt-1 text-[13px] leading-snug text-ink">{real}</p>
          {real !== a.realMoney && <InfoTip label={t("bwc.realMoney")} className="-my-2 -me-2">{a.realMoney}</InfoTip>}
        </div>
        {a.nextLook && (
          <p className="flex items-start gap-2.5 px-1 text-[13px] leading-snug text-ink-2">
            <span className="pt-px text-ink-3"><CalendarIcon /></span>
            <span className="min-w-0">{a.nextLook}</span>
          </p>
        )}
      </div>

      {hasGame && (
        <div>
          <Head>{t("bwc.game")}</Head>
          <ul className="grid gap-1.5">{a.games.map((r) => <RuleBlock key={r.id} r={r} />)}</ul>
        </div>
      )}

      {a.monthly?.length > 0 && (
        <details className="group rounded-tile border border-line">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-[13px] leading-snug text-ink [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1"><span className="font-semibold">{t("bwc.monthly")}</span> <span className="text-ink-2">{monthlyLine}</span></span>
            <span aria-hidden="true" className="shrink-0 text-ink-3 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ul className="grid gap-1.5 px-2 pb-2">{a.monthly.map((r) => <RuleBlock key={r.id} r={r} showDate />)}</ul>
        </details>
      )}

      {a.conditions.length > 0 && (
        <div>
          <Head>{condHead}</Head>
          <Rows rows={a.conditions} />
        </div>
      )}

      {a.waitFor.length > 0 && (
        <div>
          <Head>{t(a.tone === "rules_allow" ? "bwc.keepInMind" : "bwc.waitFor")}</Head>
          <ul className="grid gap-1 text-[13px] leading-snug text-ink-2">
            {a.waitFor.map((w) => (
              <li key={w} className="flex gap-2"><span aria-hidden="true" className="mt-[7px] size-[5px] shrink-0 rotate-45 bg-ink-3" /><span>{w}</span></li>
            ))}
          </ul>
        </div>
      )}

      {go && (
        <button type="button" onClick={() => go("admin")} className="micro inline-flex min-h-[44px] items-center gap-1 justify-self-start text-ink-2 hover:text-ink">
          {t("bwc.rules")} <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

const LINE_DOT = { accent: "var(--accent)", flat: "var(--people)" };

/** The one short line on a home company card ("When to buy: not this week (see why)"), tappable to the Stock page's card.
 *  Its words come from buyLine(a, today) in lib/buywindow.js. */
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
