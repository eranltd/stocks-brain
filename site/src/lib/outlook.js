// View helpers for the company outlook cards (config/outlook.json). The file may hold no companies, or only some;
// every helper here returns something sensible for a missing card. Dates are ISO days compared in UTC.

const DAY = 86400000;
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const NY_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in New York as YYYY-MM-DD: market dates follow the New York calendar, not UTC or the viewer's clock. */
export function todayISO(now = new Date()) {
  return NY_DAY.format(now);
}

/** A card with no next results date is probably out of date this long after its latest report: a quarter plus a week. */
export const STALE_AFTER_DAYS = 98;

/** Whole days from `today` to `iso` (negative when it is past), or null without a date. */
export function daysUntil(iso, today) {
  if (!iso || !today) return null;
  return Math.round((utc(iso) - utc(today)) / DAY);
}

/** The card for one ticker, or null. */
export function cardFor(outlook, ticker) {
  return (outlook?.companies ?? []).find((c) => c.ticker === ticker) ?? null;
}

/**
 * Why a card may be out of date, or null when it is current:
 * {kind: "passed", date, confirmed} once its next results date has passed (firm when the company confirmed the date),
 * {kind: "probably"} when it has no date and its latest report is more than a quarter and a week old.
 */
export function staleness(card, today) {
  if (!card || !today) return null;
  const ne = card.next_earnings ?? {};
  if (ne.date) return ne.date < today ? { kind: "passed", date: ne.date, confirmed: Boolean(ne.confirmed) } : null;
  const age = daysUntil(card.latest?.reported_on, today);
  return age != null && age <= -STALE_AFTER_DAYS ? { kind: "probably" } : null;
}

/** New results are, or are probably, out since the card was written. */
export function isStale(card, today) {
  return staleness(card, today) != null;
}

/**
 * The card's "what's next" items in two groups: `ahead` (dated today or later, else marked ahead) by date, undated last;
 * `recent` (dated before today, else marked done) newest first, undated last; `other` holds items with neither.
 */
export function splitWhatsNext(items, today) {
  const ahead = [], recent = [], other = [];
  for (const w of items ?? []) {
    const done = w.date ? Boolean(today) && w.date < today : w.status === "done";
    const next = w.date ? !done : w.status === "ahead";
    (done ? recent : next ? ahead : other).push(w);
  }
  const by = (dir) => (a, b) => (a.date && b.date ? dir * a.date.localeCompare(b.date) : a.date ? -1 : b.date ? 1 : 0);
  return { ahead: ahead.sort(by(1)), recent: recent.sort(by(-1)), other };
}

/** "in 12 days", "tomorrow", "today", "3 days ago". */
export function inDays(n) {
  if (n == null) return "";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Revenue growth against the same quarter a year earlier, in words, or "" when the card has none. */
export function growthWords(pct) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return "";
  const r = Math.abs(pct) < 10 ? Math.abs(pct).toFixed(1) : Math.round(Math.abs(pct)).toString();
  return `${pct >= 0 ? "up" : "down"} ${r}% from a year earlier`;
}

/**
 * Earnings dates within `windowDays` from today (today included), by date and ticker, as `ahead`; each row:
 * {ticker, name, date, days, confirmed, first}, where `first` marks names in `first` (held or picked). `undated` lists
 * the names in `first` whose card has no date yet, in the order given: {ticker, name}.
 */
export function comingUp(outlook, today, windowDays = 30, first = []) {
  const pri = new Set(first);
  const cards = outlook?.companies ?? [];
  const ahead = cards
    .map((c) => ({ ticker: c.ticker, name: c.name, date: c.next_earnings?.date ?? null, confirmed: Boolean(c.next_earnings?.confirmed) }))
    .map((r) => ({ ...r, days: daysUntil(r.date, today), first: pri.has(r.ticker) }))
    .filter((r) => r.days != null && r.days >= 0 && r.days <= windowDays)
    .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
  const undated = [...pri]
    .map((t) => cards.find((c) => c.ticker === t))
    .filter((c) => c && !c.next_earnings?.date)
    .map((c) => ({ ticker: c.ticker, name: c.name }));
  return { ahead, undated };
}

export const KIND_LABEL = { product: "Product", finance: "Finance", regulatory: "Regulatory", deal: "Deal", other: "Other" };
