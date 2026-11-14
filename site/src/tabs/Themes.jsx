import { useEffect, useMemo, useState } from "react";
import { loadMarket } from "../lib/data.js";
import { themeMarkets, themeRows, themeYear } from "../lib/themes.js";
import { strings } from "../lib/text.js";
import dict from "../text/themes.js";
import { Container, EmptyState, HeroTitle, Segmented, Skeleton } from "../components/ui.jsx";
import { NotAdvice } from "../components/shell.jsx";

/*
 * The Theme hunter (#themes): a way of looking for opportunities the owner heard from an investment-house friend. Pick
 * a field (space, AI, chips, software, energy), see who leads it (our short reading of each company's competition in
 * config/themes.json) and how the whole field did over a year, losers counted too: "$1,000 in each a year ago" is the
 * honest answer to "some of these went up thousands of percent". Each company opens its own page. Percents only.
 */

const t = strings(dict);
const pct = (v) => (Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(1)}%` : "–");
const tone = (v) => (!Number.isFinite(v) ? "flat" : v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");
const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const KEY = "sb:theme";

export default function Themes({ data, go }) {
  const themes = data?.themes?.themes ?? [];
  const [pick, setPick] = useState(() => { try { return window.localStorage.getItem(KEY) ?? null; } catch { return null; } });
  const theme = themes.find((x) => x.id === pick) ?? themes[0] ?? null;
  const choose = (id) => { setPick(id); try { window.localStorage.setItem(KEY, id); } catch { /* this visit only */ } };
  const [views, setViews] = useState({});
  const wanted = useMemo(() => themeMarkets(data?.themes), [data?.themes]);
  useEffect(() => {
    let on = true;
    Promise.all(wanted.map((id) => loadMarket(data.manifest, id, data).then((v) => [id, v]).catch(() => [id, null])))
      .then((pairs) => { if (on) setViews(Object.fromEntries(pairs)); });
    return () => { on = false; };
  }, [wanted, data]);
  const loading = wanted.some((id) => !(id in views));
  const rows = useMemo(() => themeRows(theme, views), [theme, views]);
  const year = useMemo(() => themeYear(rows), [rows]);
  const sorted = useMemo(() => [...rows].sort((a, b) => (b.row?.ret_250d_pct ?? -1e9) - (a.row?.ret_250d_pct ?? -1e9)), [rows]);

  if (!themes.length) return <Container className="pt-10"><EmptyState title={t("th.none")} /></Container>;
  return (
    <Container className="pt-6 pb-24 sm:pt-8">
      <HeroTitle size="md" line1={t("th.title1")} line2={t("th.title2")} sub={t("th.sub")} />
      <div className="mt-5">
        <Segmented tall label={t("th.pick")} value={theme.id} onChange={choose} options={themes.map((x) => ({ value: x.id, label: x.name }))} />
      </div>

      <section className="theme-hero mt-5" aria-live="polite">
        <p className="theme-why">{theme.why}</p>
        {loading ? <Skeleton className="mt-4 h-24 w-full" /> : year.n ? (
          <div className="theme-stats">
            <div className="theme-stat">
              <p className="micro">{t("th.year")}</p>
              <p className="theme-big" data-tone={tone(year.avg)}>{pct(year.avg)}</p>
              <p className="theme-line">{t("th.yearLine", { up: year.up, n: year.n })}</p>
            </div>
            <div className="theme-stat">
              <p className="micro">{t("th.vs")}</p>
              <p className="theme-big" data-tone={tone(year.vsMarket)}>{pct(year.vsMarket)}</p>
              <p className="theme-line">{t(year.vsMarket >= 0 ? "th.vsBeat" : "th.vsLag")}</p>
            </div>
            <div className="theme-stat theme-thousand">
              <p className="micro">{t("th.thousand", { n: year.n })}</p>
              <p className="theme-big" data-tone={tone(year.now - year.start)}>{money(year.now)}</p>
              <p className="theme-line">{t("th.thousandLine", { start: money(year.start) })}</p>
            </div>
            <div className="theme-stat">
              <p className="micro">{t("th.bestWorst")}</p>
              <p className="theme-line"><b>{year.best.symbol}</b> <span data-tone={tone(year.best.row.ret_250d_pct)}>{pct(year.best.row.ret_250d_pct)}</span></p>
              <p className="theme-line"><b>{year.worst.symbol}</b> <span data-tone={tone(year.worst.row.ret_250d_pct)}>{pct(year.worst.row.ret_250d_pct)}</span></p>
            </div>
          </div>
        ) : <p className="theme-line mt-3">{t("th.soon")}</p>}
        {year.short > 0 && <p className="theme-note">{t("th.short", { n: year.short })}</p>}
      </section>

      <ul className="theme-list mt-4">
        {sorted.map((c) => (
          <li key={c.symbol}>
            <button type="button" className="theme-co" onClick={() => go(`stock/${c.symbol}`, c.market)}>
              <span className="theme-co-top">
                <b className="theme-sym">{c.symbol}</b>
                <span className="theme-name">{c.name}</span>
                <span className="theme-moat" data-moat={c.moat}>{t(`th.moat.${c.moat}`)}</span>
              </span>
              <span className="theme-note-line">{c.note}</span>
              <span className="theme-nums">
                <span><small>{t("th.col.year")}</small><b data-tone={tone(c.row?.ret_250d_pct)}>{c.row?.ret_250d_pct != null ? pct(c.row.ret_250d_pct) : c.row ? t("th.new") : "–"}</b></span>
                <span><small>{t("th.col.month")}</small><b data-tone={tone(c.row?.ret_20d_pct)}>{pct(c.row?.ret_20d_pct)}</b></span>
                <span><small>{t("th.col.high")}</small><b data-tone={tone(c.row?.from_high_pct)}>{pct(c.row?.from_high_pct)}</b></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="theme-note mt-4">{data?.themes?.how_to_read}</p>
      <p className="theme-note">{t("th.honest")}</p>
      <NotAdvice compact className="mt-4" />
    </Container>
  );
}
