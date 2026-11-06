// A stock's story in five short chapters, for the top of its page: today, the trend (this month, this year, from its
// high), what is coming (its next results), what the news says, and what this site's system thinks. Plain words built
// from data the page already has. Pure functions, tested in story.test.js. Moves only, never a price.
import { FRESH_MIN } from "./marketnow.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const DAY = 86400000;

/** One word for a move over a stretch of time: "jumped", "rose", "flat", "fell", "dropped". */
export function moveWord(pct, big = 10) {
  if (!isNum(pct)) return null;
  if (pct >= big) return "jumped";
  if (pct >= 1) return "rose";
  if (pct > -1) return "flat";
  if (pct > -big) return "fell";
  return "dropped";
}

/** Today's move: the hourly pulse's when it is fresh and has the name, else the last close. */
export function todayOf({ symbol, row, live, now = new Date() }) {
  const lr = live && !live.sample ? (live.symbols ?? []).find((s) => s.symbol === symbol) : null;
  const fresh = lr && live.quotes_at && (now - live.quotes_at * 1000) / 60000 <= FRESH_MIN;
  if (fresh) {
    const n = (live.company_news ?? []).filter((x) => x.symbol === symbol).sort((a, b) => b.at - a.at)[0] ?? null;
    return { move: lr.move_pct, source: "live", headline: n?.headline ?? null, url: n?.url ?? null };
  }
  return { move: isNum(row?.change_1d_pct) ? row.change_1d_pct : null, source: "close", date: row?.last_date ?? null, headline: null, url: null };
}

/** The trend: {month, year, fromHigh, vsMarket (this month, against the benchmark), above50}. */
export function trendOf(row) {
  const v = (k) => (isNum(row?.[k]) ? row[k] : null);
  return { month: v("ret_20d_pct"), year: v("ret_250d_pct"), fromHigh: v("from_high_pct"), vsMarket: v("vs_bench_20d_pct"), above50: row?.above_sma50 ?? null };
}

/** What is coming: the next results date and how many days away, from the company's outlook card. */
export function comingOf(card, today) {
  const ne = card?.next_earnings ?? null;
  if (!ne) return null;
  if (ne.date && today) {
    const days = Math.round((Date.parse(`${ne.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
    if (days >= 0) return { date: ne.date, days, confirmed: Boolean(ne.confirmed) };
    return { date: ne.date, days, passed: true };
  }
  return { date: null, note: ne.note ?? null };
}

/** The chapters, in order, each {id, ...}; a chapter with nothing to say is left out. */
export function storyOf({ symbol, row, live, notes = [], card = null, call = null, buyTone = null, today = null, now = new Date() }) {
  const out = [];
  const day = todayOf({ symbol, row, live, now });
  const note = notes[0] ?? null;
  if (isNum(day.move)) out.push({ id: "today", ...day, why: day.headline ?? (note && note.date === row?.last_date ? note.headline : null) });
  const tr = trendOf(row);
  if (tr.month != null || tr.year != null) out.push({ id: "trend", ...tr });
  const coming = comingOf(card, today);
  if (coming) out.push({ id: "coming", ...coming });
  if (note || card?.plain) out.push({ id: "news", headline: note?.headline ?? null, date: note?.date ?? null, plain: card?.plain ?? null });
  if (call || buyTone) out.push({ id: "system", call, buyTone });
  return out;
}
