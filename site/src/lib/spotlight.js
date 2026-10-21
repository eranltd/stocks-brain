// The home's sector spotlights ("Top chip makers", "Top tech giants", "Top energy companies"): each list's names ranked
// by how much they rose over the past year, in words (no digits, like the rest of the simple home). Pure functions, no
// React; tested in spotlight.test.js. The lists are config/markets.json markets; nothing here reads prices back.

import { translate } from "./i18n.js";
import { verdictChip } from "./simple.js";
import dict from "../i18n/home.js";

/** The markets shown as spotlights on the home, in this order (only those the site publishes). */
export const SPOTLIGHTS = ["chips", "tech", "energy"];

/** Who each list is measured against, in everyday words (English; the "spot.who.<id>" texts in other languages). */
export const SPOTLIGHT_WHO = { chips: "chip makers as a group", tech: "the Nasdaq-100", energy: "energy companies as a group" };
const RANKS = 10; // "Biggest" to "Tenth-biggest" ("spot.rank.0" to "spot.rank.9"), then "A rise of the past year"
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
export function spotlightItems(view, candles = {}, lang = "en") {
  const t = translate(dict, lang);
  const rows = view?.market?.symbols ?? [];
  const bench = yearRise(rows.find((r) => r.symbol === view?.benchmark));
  const who = SPOTLIGHT_WHO[view?.id] ? t(`spot.who.${view.id}`) : t("spot.who.other");
  const list = (view?.watchlist?.symbols ?? []).map((s) => ({ sym: s.symbol, rise: yearRise(rows.find((r) => r.symbol === s.symbol)) }));
  list.sort((a, b) => (b.rise ?? -Infinity) - (a.rise ?? -Infinity) || a.sym.localeCompare(b.sym));
  return list.map(({ sym, rise }, i) => {
    const name = view.names?.[sym] ?? sym;
    const tag = rise == null ? t("spot.noYear") : rise > 0 ? t(i < RANKS ? `spot.rank.${i}` : "spot.rank.other") : t("spot.lower");
    const vs = rise == null || bench == null ? null : rise >= bench ? "more" : "worse";
    return {
      ticker: sym, name, tag,
      plain: vs ? t(`spot.${vs}`, { who }, { bidi: false }) : null,
      chip: verdictChip(view.checklist, sym, lang),
      hasChart: Boolean(candles?.[sym]),
      candlesTo: `stock/${sym}#checklist`,
      to: `stock/${sym}#brief`,
    };
  });
}
