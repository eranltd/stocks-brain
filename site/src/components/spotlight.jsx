import { useEffect, useState } from "react";
import { loadMarket } from "../lib/data.js";
import { NOT_YET } from "../lib/markets.js";
import { SPOTLIGHTS, spotlightItems } from "../lib/spotlight.js";
import { TopStocks } from "./topstocks.jsx";

/**
 * The home's sector spotlights: one bold carousel per list (chip makers, tech giants, energy), names ranked by their
 * rise over the past year, each card with its last month of candles and whether the newest day was green or red.
 */
export function SectorSpotlights({ data, openTo, seeCandles }) {
  const ids = SPOTLIGHTS.filter((id) => (data.markets ?? []).some((m) => m.id === id));
  return ids.map((id) => <Spotlight key={id} id={id} data={data} openTo={openTo} seeCandles={seeCandles} />);
}

function Spotlight({ id, data, openTo, seeCandles }) {
  const [view, setView] = useState(null);
  useEffect(() => {
    let live = true;
    loadMarket(data.manifest, id, data).then((v) => live && setView(v), () => live && setView(false));
    return () => { live = false; };
  }, [id, data]);
  if (!view) return null; // loading, or it failed: the rest of the home does not wait for it
  const title = view.entry?.name ?? id;
  if (!view.available) {
    return (
      <section className="mx-auto w-full max-w-[1040px] px-4 pt-10">
        <h2 className="text-[clamp(26px,7vw,34px)] leading-tight font-bold tracking-[-0.025em] text-ink">{title}</h2>
        <p className="mt-2 text-[16px] text-ink-2">{NOT_YET}</p>
      </section>
    );
  }
  const items = spotlightItems(view, data.manifest?.markets?.[id]?.candles ?? {});
  return (
    <div className="pt-4">
      <TopStocks items={items} manifest={data.manifest} marketId={id} news={data.secNews} title={title} headingId={`top-${id}-title`}
        subtitle="Ranked by how much they rose over the past year."
        fallback="Its year in words appears after the next nightly run." openTo={openTo} seeCandles={seeCandles} />
    </div>
  );
}
