import { useEffect, useState } from "react";
import { loadMarket } from "../lib/data.js";
import dict from "../text/home.js";
import { SPOTLIGHTS, spotlightItems } from "../lib/spotlight.js";
import { TopStocks } from "./topstocks.jsx";
import { buyLine, buyWindowFor, mainListOf, mainWatchlistOf, sp500Of } from "../lib/buywindow.js";
import { todayISO } from "../lib/outlook.js";
import { strings } from "../lib/text.js";
import { NOT_YET } from "../lib/markets.js";

/**
 * The home's sector spotlights: one bold carousel per list (chip makers, tech giants, energy), names ranked by their
 * rise over the past year, each card with its last month of candles and whether the newest day was green or red.
 */
export function SectorSpotlights({ data, earned = false, openTo, seeCandles }) {
  const ids = SPOTLIGHTS.filter((id) => (data.markets ?? []).some((m) => m.id === id));
  return ids.map((id) => <Spotlight key={id} id={id} data={data} earned={earned} openTo={openTo} seeCandles={seeCandles} />);
}

function Spotlight({ id, data, earned, openTo, seeCandles }) {
  const t = strings(dict);
  const [view, setView] = useState(null);
  useEffect(() => {
    let live = true;
    loadMarket(data.manifest, id, data).then((v) => live && setView(v), () => live && setView(false));
    return () => { live = false; };
  }, [id, data]);
  if (!view) return null; // loading, or it failed: the rest of the home does not wait for it
  // The list's name comes from config/markets.json.
  const name = view.entry?.name || id;
  if (!view.available) {
    return (
      <section className="mx-auto w-full max-w-[1040px] px-4 pt-10">
        <h2 className="text-[clamp(26px,7vw,34px)] leading-tight font-bold tracking-[-0.025em] text-ink">{name}</h2>
        <p className="mt-2 text-[16px] text-ink-2">{NOT_YET}</p>
      </section>
    );
  }
  // "When to buy": one short line per card (lib/buywindow.js). A name also on the main list gets the rules' look.
  const today = todayISO();
  const ctx = {
    today, derived: view.market, checklist: view.checklist, bw: data.buyWindow, mainList: mainListOf(data), stocksEarned: earned, rulesResult: data.rulesResult, names: view.names,
    siteSample: Boolean(view.market?.sample), minRR: data.checklistCfg?.house_rule?.min_reward_to_risk ?? 2, stretchPct: data.settings?.setup?.stretch_pct ?? 8,
  };
  const items = spotlightItems(view, data.manifest?.markets?.[id]?.candles ?? {})
    .map((it) => ({ ...it, buy: buyLine(buyWindowFor(it.ticker, { ...ctx, sp500: sp500Of(it.ticker, view.watchlist, mainWatchlistOf(data)) }), today), buyTo: `stock/${it.ticker}#buy-window` }));
  return (
    <div className="pt-4">
      <TopStocks items={items} manifest={data.manifest} marketId={id} news={data.secNews} title={name} headingId={`top-${id}-title`}
        subtitle={t("spotc.subtitle")} label={name}
        fallback={t("spotc.fallback")} openTo={openTo} seeCandles={seeCandles} />
    </div>
  );
}
