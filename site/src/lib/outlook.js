// View helpers for the company outlook cards (config/outlook.json). The file may hold no companies, or only some;
// every helper here returns something sensible for a missing card. Dates are ISO days compared in UTC.

const DAY = 86400000;
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`);

/** Whole days from `today` to `iso` (negative when it is past), or null without a date. */
export function daysUntil(iso, today) {
  if (!iso || !today) return null;
  return Math.round((utc(iso) - utc(today)) / DAY);
}

/** The card for one ticker, or null. */
export function cardFor(outlook, ticker) {
  return (outlook?.companies ?? []).find((c) => c.ticker === ticker) ?? null;
}

/** New results are out since the card was written: its next earnings date has passed. */
export function isStale(card, today) {
  const d = card?.next_earnings?.date;
  return Boolean(d && today && d < today);
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
 * Earnings dates within `windowDays` from today (today included), names in `first` (today's picks, the paper record)
 * before the rest, then by date and ticker. Each row: {ticker, name, date, days, confirmed, first}.
 */
export function comingUp(outlook, today, windowDays = 30, first = []) {
  const pri = new Set(first);
  return (outlook?.companies ?? [])
    .map((c) => ({ ticker: c.ticker, name: c.name, date: c.next_earnings?.date ?? null, confirmed: Boolean(c.next_earnings?.confirmed) }))
    .map((r) => ({ ...r, days: daysUntil(r.date, today), first: pri.has(r.ticker) }))
    .filter((r) => r.days != null && r.days >= 0 && r.days <= windowDays)
    .sort((a, b) => Number(b.first) - Number(a.first) || a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
}

export const KIND_LABEL = { product: "Product", finance: "Finance", regulatory: "Regulatory", deal: "Deal", other: "Other" };
