// The home's sector spotlights ("Top chip makers", "Top tech giants", "Top energy companies"): each list's names ranked
// by how much they rose over the past year, in words (no digits, like the rest of the simple home). Pure functions, no
// React; tested in spotlight.test.js. The lists are config/markets.json markets; nothing here reads prices back.

import { verdictChip } from "./simple.js";

/** The markets shown as spotlights on the home, in this order (only those the site publishes). */
export const SPOTLIGHTS = ["chips", "tech", "energy"];

/** Who each list is measured against, in everyday words. */
export const SPOTLIGHT_WHO = { chips: "chip makers as a group", tech: "the Nasdaq-100", energy: "energy companies as a group" };

const ORD = ["Biggest", "Second-biggest", "Third-biggest", "Fourth-biggest", "Fifth-biggest", "Sixth-biggest", "Seventh-biggest", "Eighth-biggest", "Ninth-biggest", "Tenth-biggest"];
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** The rise over the derived series (about a year, indexed to 100 at its start), in percent; null without one. */
export function yearRise(row) {
  const s = row?.series;
  if (!s?.length) return null;
  const a = s[0].v, b = s.at(-1).v;
  return isNum(a) && isNum(b) && a > 0 ? (b / a - 1) * 100 : null;
}

/** The newest candle of a mini window: "green" (closed at or above its open) or "red", or null. */
export function lastCandle(win) {
  const i = win?.ok?.lastIndexOf(true) ?? -1;
  if (i < 0) return null;
  return win.c[i] >= win.o[i] ? "green" : "red";
}

/**
 * One spotlight's carousel items (the shape TopStocks takes), strongest rise first. `view` is loadMarket's view of the
 * list; `candles` its published candle files ({SYMBOL: path}).
 */
export function spotlightItems(view, candles = {}) {
  const rows = view?.market?.symbols ?? [];
  const bench = yearRise(rows.find((r) => r.symbol === view?.benchmark));
  const who = SPOTLIGHT_WHO[view?.id] ?? "its group";
  const list = (view?.watchlist?.symbols ?? []).map((s) => ({ t: s.symbol, rise: yearRise(rows.find((r) => r.symbol === s.symbol)) }));
  list.sort((a, b) => (b.rise ?? -Infinity) - (a.rise ?? -Infinity) || a.t.localeCompare(b.t));
  return list.map(({ t, rise }, i) => {
    const name = view.names?.[t] ?? t;
    const tag = rise == null ? "no year of prices yet" : rise > 0 ? `${ORD[i] ?? "A"} rise of the past year` : "lower than a year ago";
    const vs = rise == null || bench == null ? null : rise >= bench ? `rose more than ${who}` : `did worse than ${who}`;
    return {
      ticker: t, name, tag,
      plain: vs ? `Over the past year it ${vs}. A past rise does not promise the next one.` : null,
      chip: verdictChip(view.checklist, t),
      hasChart: Boolean(candles?.[t]),
      candlesTo: `stock/${t}#checklist`,
      to: `stock/${t}#brief`,
    };
  });
}
