import { Fragment } from "react";
import { addTradingDays } from "../lib/data.js";
import { daysBetween } from "../lib/stats.js";
import { fmtDate, fmtNum, pad2, signTone } from "../lib/format.js";
import { ltr, translate } from "../lib/i18n.js";
import { Auto, Bdi, En, EnglishNote, useLang } from "../lib/lang.jsx";
import { BriefSections, marketBrief } from "../components/brief.jsx";
import { BaseRates, GoalSection, MarketContext, PortfolioNow, nextRebalance } from "../components/goal.jsx";
import { TrustLadder, trustStage } from "../components/trust.jsx";
import { callsTouching, joinCalls, shortVia, statusPhrase } from "../lib/people.js";
import { marketDay, shortSector } from "../lib/marketday.js";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { Accent, ArrowRight, Chip, Container, Conviction, Headline, Reveal, SectionHead, Strip } from "../components/ui.jsx";
import { isBehind, notesForDay, noteView, usableWhy } from "../lib/why.js";
import { WhyFooter, WhyNote } from "../components/why.jsx";
import dict from "../i18n/home.js";

// Every text on this page is in i18n/home.js ("det.*"; goal.jsx's sections use "goal.*"), in English and Hebrew.
/** A whole percent ("62%"), kept left to right inside a Hebrew line. */
const wholePct = (v, lang = "en") => { const s = `${fmtNum(v, 0)}%`; return lang === "he" ? ltr(s) : s; };

const TONE = { bullish: "var(--accent)", bearish: "var(--down)", neutral: "var(--flat)" };

/**
 * Full dashboard (the old home page): the decision first. Verdict (computed from the trust stage, data freshness and the rule),
 * then what the market did at the last close, earnings coming up, the goal check, the portfolio, market context, whether
 * the rules work, and the trust ladder.
 */
export default function Details({ data, go }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  return (
    <>
      <section className="relative isolate -mt-[76px] overflow-hidden pt-[76px]">
        {/* Decoration must not show fake calls: the wall shows real library principles. */}
        <HeroWall items={libraryWall(data.library)} />
        <Container className="flex min-h-[82vh] flex-col items-center justify-center py-20 text-center">
          <Verdict data={data} go={go} />
        </Container>
      </section>
      <Container>
        <MarketDay data={data} go={go} />
        <ComingUp data={data} go={go} />
        <GoalSection data={data} />
        <PortfolioNow data={data} go={go} />
        <PeopleNote data={data} go={go} />
        <MarketContext data={data} />
        <BaseRates data={data} />
        <div className="pt-24"><TrustLadder data={data} go={go} /></div>
        <BriefSections data={data} brief={brief} go={go} />
        {run && run.picks.length > 0 && (
          <section id="picks" className="scroll-mt-28 pt-24">
            <SectionHead eyebrow={t("det.picks.eyebrow", { date: fmtDate(run.date, lang) }, { bidi: false })} title={<>{t("det.picks.titleA")} <Accent>{t("det.picks.titleB")}</Accent></>}
              lede={t("det.picks.lede")} size="md" />
            {/* each pick's reason, risks and test are the brain's own words (English for now) */}
            <EnglishNote />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {run.picks.map((p, i) => <PickCard key={p.id} item={p} i={i} name={data.names[p.pick.ticker]} horizon={data.settings.scoring.horizon_days} />)}
            </div>
          </section>
        )}
        <p className="meta mt-20 normal-case tracking-[0.04em]">{t("det.footer")}</p>
      </Container>
    </>
  );
}

/** Names the paper record holds (or, with live prices, the history test holds) and names the brain last picked. */
export function heldAndPicked(data) {
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  const held = paper?.rebalances.at(-1)?.holdings ?? (data.livePrices ? data.longrun?.now.holdings : null) ?? [];
  const picked = data.sample ? [] : (data.lastOk?.picks ?? []).map((p) => p.pick.ticker);
  return { held, picked };
}

const jumpToMarket = (e) => { e.preventDefault(); document.getElementById("market-today")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
const upDown = (v) => (v == null ? "" : v >= 0.05 ? "text-accent" : v <= -0.05 ? "text-down" : "text-ink-2"); // as shown, to one decimal
const day = (iso, lang = "en") => fmtDate(iso, lang).replace(/\s\d{4}$/, ""); // "Thu, 22 Oct" ("יום ה׳, 22 באוקטובר")
/** A sector in the page's language: English keeps the data's own name. */
const sectorName = (s, lang = "en") => (lang === "en" ? s : shortSector(s, lang));

/** One of the day's biggest movers on the list: tap to open its Stock page. */
function Mover({ m, name, go }) {
  const { fmt } = useLang();
  return (
    <li>
      <button type="button" onClick={() => go(`stock/${m.symbol}`)} className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-start hover:border-ink-3">
        <span className="min-w-0">
          <bdi className="font-mono text-[14px] font-semibold">{m.symbol}</bdi>
          <span dir="auto" className="block truncate text-[12px] text-ink-3">{name}</span>
        </span>
        <span className={`num shrink-0 font-mono text-[14px] ${upDown(m.pct)}`}>{fmt.pct(m.pct, 1)}</span>
      </button>
    </li>
  );
}

/** Open a route and scroll to the section after the hash once it renders (as Today's openAt does). */
function goTo(go, to) {
  const [route, id] = to.split("#");
  go(route);
  if (!id) return;
  let tries = 0;
  const seek = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
    else if (++tries < 40) setTimeout(seek, 50);
  };
  setTimeout(seek, 50);
}

/**
 * The "why it moved" notes of one market day (lib/why.js): this list's names, sectors and context funds first, then
 * notes from the other lists (labelled). Each: {v, lead, tag, to}.
 */
function dayNotes(data, why, date, lang = "en") {
  const t = translate(dict, lang);
  const marketId = data.marketId ?? data.markets?.find((m) => m.default)?.id ?? null;
  const labels = Object.fromEntries((data.markets ?? []).map((m) => [m.id, m.label ?? m.id]));
  const mine = new Set([...(data.watchlist?.symbols ?? []).map((s) => s.symbol), ...(data.watchlist?.context ?? []).map((c) => c.symbol), data.bench?.symbol]);
  const ours = (n) => (n.kind === "sector" ? !n.market || n.market === marketId : n.symbols.some((t) => mine.has(t)));
  const notes = notesForDay(why, date);
  return [...notes.filter(ours), ...notes.filter((n) => !ours(n))].map((n) => {
    const v = noteView(n, { names: data.names, groups: data.sectors ?? {}, short: (s) => shortSector(s, lang), lang });
    const one = n.kind !== "sector" && n.symbols.length === 1 ? n.symbols[0] : null;
    return { v, lead: v.who, tag: !ours(n) && n.market && labels[n.market] ? t("det.md.onList", { list: labels[n.market] }) : null, to: one ? `stock/${one}#why-it-moved` : null };
  });
}

/** What the market did at the last close: index moves, our names' moves, sectors, and why (when a note exists). */
function MarketDay({ data, go }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  const d = marketDay(data.market, data.watchlist, data.bench);
  if (!d || !d.names) return null;
  const why = usableWhy(data.why, Boolean(data.livePrices));
  const notes = why ? dayNotes(data, why, d.date, lang) : [];
  const lead = d.spx?.pct ?? d.bench?.pct ?? null;
  const who = t(d.spx?.pct != null ? "det.md.who.market" : "det.md.who.ndx"); // the S&P 500 leads; older data has only the benchmark's move
  const verb = lead == null ? null : lead > 0.05 ? "up" : lead < -0.05 ? "down" : "flat";
  const verbTone = verb === "up" ? "text-accent" : verb === "down" ? "text-down" : "text-ink-2"; // a fall never shows in the up colour
  // The verbs are the home's move words in their masculine form (the market, an index): "rose" / "עלה".
  const verbWord = verb && t(`size.${verb}.m`);
  const pctOr = (v) => (v == null ? "–" : fmt.pct(v, 2));
  const tone = (v) => signTone(v, 2); // as shown, to two decimals
  const ink = (key, count) => <span className="text-ink">{t(key, { count })}</span>;
  const counted = d.flat
    ? t.rich("det.md.countedFlat", { n: d.names, up: ink("det.md.up", d.rose), down: ink("det.md.down", d.fell), flat: t("det.md.andFlat", { count: d.flat }) })
    : t.rich("det.md.counted", { n: d.names, up: ink("det.md.up", d.rose), down: ink("det.md.andDown", d.fell) });
  return (
    <section id="market-today" className="scroll-mt-28 pt-16 sm:pt-24">
      <SectionHead eyebrow={t(data.livePrices ? "det.md.eyebrowLive" : "det.md.eyebrowSample", { date: fmtDate(d.date, lang) }, { bidi: false })} size="md"
        title={verbWord ? <>{who} <span className={verbTone}>{verbWord}.</span></> : <>{t("det.md.lastA")} <Accent>{t("det.md.lastB")}</Accent></>}
        lede={<>{d.counted ? counted : t("det.md.notCounted")} {t("det.md.ledeTail")}</>} />
      <Strip dense cells={[
        { value: pctOr(d.spx?.pct), label: <Bdi>{d.spx?.name ?? "S&P 500"}</Bdi>, tone: tone(d.spx?.pct), desc: t(d.spx?.pct == null ? "det.md.spxLater" : "det.md.spxDesc") },
        { value: pctOr(d.bench?.pct), label: <Bdi>{d.bench ? `Nasdaq-100 (${d.bench.symbol})` : "Nasdaq-100"}</Bdi>, tone: tone(d.bench?.pct), desc: t("det.md.benchDesc") },
        { value: d.counted ? (lang === "he" ? ltr(`${d.rose}/${d.fell}`) : `${d.rose}/${d.fell}`) : "–", label: t("det.md.upDown"), tone: "flat", desc: t("det.md.upDownDesc", { counted: d.counted, n: d.names }) },
        { value: d.breadth == null ? "–" : wholePct(d.breadth, lang), label: t("det.md.breadth"), tone: "flat", desc: t("det.md.breadthDesc") },
      ]} />
      {(d.risers.length > 0 || d.fallers.length > 0) && (
        <Reveal className="card mt-4 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div className="min-w-0">
              <div className="meta mb-2 text-accent">{t("det.md.risers")}</div>
              <ul className="grid gap-2">{d.risers.map((m) => <Mover key={m.symbol} m={m} name={data.names[m.symbol]} go={go} />)}{!d.risers.length && <li className="text-[13px] text-ink-3">{t("det.md.noneRose")}</li>}</ul>
            </div>
            <div className="min-w-0">
              <div className="meta mb-2 text-down">{t("det.md.fallers")}</div>
              <ul className="grid gap-2">{d.fallers.map((m) => <Mover key={m.symbol} m={m} name={data.names[m.symbol]} go={go} />)}{!d.fallers.length && <li className="text-[13px] text-ink-3">{t("det.md.noneFell")}</li>}</ul>
            </div>
          </div>
          {d.sectors.length > 0 && (
            <p className="mt-5 text-[13.5px] leading-relaxed text-ink-2">
              <span className="meta me-2">{t("det.md.bySector")}</span>
              {d.sectors.map((x, i) => (
                <Fragment key={x.sector}>{i ? " · " : ""}<span className="whitespace-nowrap">{shortSector(x.sector, lang)} <span className={`num font-mono ${upDown(x.avg)}`}>{fmt.pct(x.avg, 1)}</span></span></Fragment>
              ))}
            </p>
          )}
        </Reveal>
      )}
      {notes.length > 0 && (
        <Reveal id="market-why" className="card mt-4 scroll-mt-28 p-5 sm:p-6">
          <div className="meta mb-3 text-accent">{t("det.md.why")}</div>
          {/* the notes' headlines and explanations are written in English for now */}
          <EnglishNote />
          <ul className="grid gap-3">
            {notes.map((x) => <WhyNote key={x.v.key} v={x.v} tag={x.tag}
              lead={x.to ? <button type="button" onClick={() => goTo(go, x.to)} className="text-start underline decoration-line-2 underline-offset-2 hover:text-ink-2">{x.lead}</button> : x.lead} />)}
          </ul>
          <WhyFooter className="mt-4" />
        </Reveal>
      )}
      <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
        {d.spx && d.spx.pct == null && <>{t("det.md.spxPending", { name: d.spx.name })} </>}
        {d.spx?.fromHigh != null && <>{d.spx.fromHigh > -0.05 ? t("det.md.atHigh", { name: d.spx.name }) : t("det.md.belowHigh", { name: d.spx.name, pct: `${Math.abs(d.spx.fromHigh).toFixed(1)}%` })} </>}
        {d.breadth != null && <>{t("det.md.breadthLine", { pct: `${fmtNum(d.breadth, 0)}%` })} </>}
      </p>
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        {t(notes.length ? "det.md.notesSay" : !why ? "det.md.noWhy" : isBehind(why, d.date) ? "det.md.behind" : "det.md.whatNotWhy")}{" "}
        {t("det.md.closeTime")}
      </p>
    </section>
  );
}

/**
 * Earnings dates for our names in the next thirty days, from the outlook cards: names we hold or picked first, then the
 * rest of the list, each by date; held or picked names with no date yet are named below. Hidden when there is nothing.
 */
function ComingUp({ data, go }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const today = todayISO();
  const { held, picked } = heldAndPicked(data);
  const DAYS = 30;
  const { ahead, undated } = comingUp(data.outlook, today, DAYS, [...held, ...picked]);
  if (!ahead.length && !undated.length) return null;
  const tag = (x) => t(held.includes(x) ? "today.held" : "today.picked");
  const groups = [[t("det.cu.first"), ahead.filter((r) => r.first)], [t("det.cu.others"), ahead.filter((r) => !r.first)]].filter(([, rows]) => rows.length);
  return (
    <Reveal className="card mt-6 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="meta text-accent">{t("det.cu.title")}</div>
        <span className="meta normal-case tracking-[0.04em]">{t("det.cu.next", { n: DAYS })}</span>
      </div>
      {groups.map(([label, rows]) => (
        <div key={label} className="mt-4">
          <div className="meta mb-2 normal-case tracking-[0.04em]">{label}</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.ticker}>
                <button type="button" onClick={() => go(`stock/${r.ticker}`)} className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-start hover:border-ink-3">
                  <span className="min-w-0">
                    <bdi className="font-mono text-[14px] font-semibold">{r.ticker}</bdi>
                    {r.first && <span className="pill ms-2 whitespace-nowrap py-0.5 text-[10.5px] text-people">{tag(r.ticker)}</span>}
                    <span dir="auto" className="block truncate text-[12px] text-ink-3">{data.names[r.ticker] ?? r.name}</span>
                  </span>
                  <span className="shrink-0 text-end text-[13px]">
                    <span className="block text-ink">{day(r.date, lang)}</span>
                    <span className="block text-[12px] text-ink-3">{inDays(r.days, lang)}{r.confirmed ? "" : t("today.expected")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {undated.length > 0 && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
          {t("det.cu.undated")}{" "}
          {undated.map((u, i) => (
            <Fragment key={u.ticker}>{i ? ", " : ""}<button type="button" onClick={() => go(`stock/${u.ticker}`)} className="font-mono text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink"><bdi>{u.ticker}</bdi></button> ({tag(u.ticker)})</Fragment>
          ))}
        </p>
      )}
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">{t("det.cu.explain")}</p>
    </Reveal>
  );
}

/** One line linking to People when a logged public call touches a name the paper record holds or the brain picked. */
function PeopleNote({ data, go }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const calls = joinCalls(data.people, data.peopleScores, lang);
  if (!calls.length) return null;
  const judge = data.peopleScores?.judge_at_weeks ?? 26;
  const { held, picked } = heldAndPicked(data);
  const touching = callsTouching(calls, [...held, ...picked]);
  if (!touching.length) return null;
  return (
    <Reveal className="card mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <div className="meta mb-2 text-people">{t("det.people.title")}</div>
        <p className="text-[15px] leading-relaxed text-ink-2">
          {t("det.people.lead", { count: touching.length })}{" "}
          {touching.map((c, i) => (
            // statusPhrase (lib/people.js) takes the language last once it speaks Hebrew; until then it writes English.
            <span key={c.id}>{i ? "; " : ""}{t.rich("det.people.item", {
              t: <span className="font-mono text-ink">{c.ticker}</span>,
              stance: t.has(`feed.people.${c.stance}`) ? t(`feed.people.${c.stance}`) : c.stance,
              via: shortVia(c.via),
              kind: t(c.source_kind === "13f" ? "det.people.13f" : "det.people.public"),
              date: fmtDate(c.date, lang).replace(/^[^,]+,\s*/, ""),
              status: <Auto>{statusPhrase(c, judge, lang)}</Auto>,
            })}</span>
          ))}{t("det.people.tail")}
        </p>
      </div>
      <button type="button" onClick={() => go("people")} className="btn shrink-0 self-start sm:self-center">{t("det.people.button")} <ArrowRight /></button>
    </Reveal>
  );
}

/** What to do today, computed once for both the Today post and the full dashboard's verdict. `head` and `accent` are in
 *  `lang` (default English). */
export function todayCall(data, lang = "en") {
  const t = translate(dict, lang);
  const { stage, small } = trustStage(data);
  const asOf = data.market.as_of;
  const age = daysBetween(asOf, todayISO()); // New York date: market days follow its calendar
  const stale = age > 4;
  const lr = data.longrun;
  const paper = data.paper && !data.paper.sample ? data.paper : null;
  // The forward paper record is what the plan follows; the history test's path can differ (it keeps names it already held).
  const rec = paper?.rebalances.at(-1) ?? null;
  const held = rec ? rec.holdings : (lr?.now.holdings ?? []);
  const corePct = rec ? rec.core_pct : (lr?.now.diversification.core_pct ?? 100);
  const met = small.filter((c) => c.ok).length;
  const rebalanceToday = stage >= 2 && rec?.date === asOf;
  const v1res = data.rulesResult?.satellite?.rules?.find((r) => r.id === "baseline_portfolio_v1"); // the frozen history verdict

  let head, accent;
  if (stale) [head, accent] = [t("det.head.stale"), t("det.accent.stale")];
  else if (rebalanceToday) [head, accent] = [t("det.head.swap"), t("det.accent.swap")];
  else [head, accent] = [t("det.head.calm"), t(stage >= 2 ? "det.accent.leave" : "det.accent.core")];
  return { stage, small, asOf, age, stale, lr, rec, held, corePct, met, rebalanceToday, v1res, head, accent };
}

function Verdict({ data, go }) {
  const { lang, t: tr, fmt } = useLang();
  const t = tr(dict);
  const { stage, small, asOf, age, stale, lr, rec, held, corePct, met, v1res, head, accent } = todayCall(data, lang);
  const heldList = <span className="text-ink">{held.length ? <bdi>{held.join(", ")}</bdi> : t("det.v.noStocks")}</span>;
  const goalPct = `+${data.settings.goal.annual_return_pct}%`;

  return (
    <>
      <Reveal>
        <a href="#market-today" onClick={jumpToMarket} title={t("det.v.jump")}
          className={`pill mb-10 min-h-[36px] hover:bg-surface ${stale ? "border-down/50 text-down" : data.livePrices ? "border-accent/40 text-accent" : "border-dashed border-people/60 text-people"}`}>
          <span className="size-2 rounded-full bg-current" />
          {t(data.livePrices ? "det.v.close" : "det.v.sample", { date: fmtDate(asOf, lang) }, { bidi: false })}{stale ? t("det.v.daysOld", { count: age }) : ""}
          <span aria-hidden="true">↓</span>
        </a>
      </Reveal>
      <Headline size="xl" className="max-w-[15ch]">{head} <Accent>{accent}</Accent></Headline>
      <Reveal delay={350} as="p" className="mx-auto mt-8 max-w-[58ch] text-[clamp(17px,1.8vw,21px)] leading-relaxed text-ink-2">
        {stale ? (
          <>{t("det.v.stale", { date: fmtDate(asOf, lang) }, { bidi: false })}</>
        ) : (
          <>
            {t("det.v.real")}{" "}
            {lr || rec ? <>{t("det.v.game")} {t.rich(rec ? "det.v.holds" : "det.v.wouldHold", { list: heldList })}{corePct > 0 ? t("det.v.andCore", { pct: wholePct(corePct, lang) }) : null}{t("det.v.looksAgain", { date: fmtDate(nextRebalance(asOf), lang) }, { bidi: false })} {v1res ? <>{t.rich("det.v.tested", { word: <span className="text-ink">{t.has(`det.v.word.${v1res.verdict}`) ? t(`det.v.word.${v1res.verdict}`) : v1res.verdict}</span>, pct: wholePct(v1res.percentile, lang) })} </> : null}</> : null}
            {stage >= 2 ? t("det.v.stage", { stage }) : t.rich("det.v.notYet", { met: <span className="text-ink">{t("det.v.metOf", { met, n: small.length })}</span> })}
          </>
        )}
      </Reveal>
      <Reveal delay={500} className="mt-10 flex flex-wrap justify-center gap-3">
        {stale ? (
          <button type="button" onClick={() => go("routines")} className="btn btn-primary">{t("det.v.routines")} <ArrowRight /></button>
        ) : (
          <a href="#goal" className="btn btn-primary">
            {t("det.v.goal", { goal: goalPct })}
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </a>
        )}
        <button type="button" onClick={() => go("portfolio")} className="btn">{t("det.v.portfolio")} <ArrowRight /></button>
      </Reveal>
      <Reveal delay={600}>
        <a href="#market-today" onClick={jumpToMarket}
          className="meta mt-4 inline-flex min-h-[44px] items-center gap-2 normal-case tracking-[0.04em] text-ink-2 hover:text-ink">
          {t("det.v.marketLink")}
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </a>
      </Reveal>
    </>
  );
}

/** Tilted wall of faded KB cards drifting in opposite directions behind the hero headline. */
function libraryWall(library) {
  return (library?.sources ?? []).flatMap((s) => s.principles.map((p) => ({
    id: p.id, principle: true, title: (s.title.match(/\(([^()]*)\)\s*$/) || [, s.title])[1], text: p.text, tag: p.tags[0], date: s.published ?? String(s.year),
  })));
}

function HeroWall({ items }) {
  const COLS = 7;
  const pool = items.length ? items : [];
  const columns = Array.from({ length: COLS }, (_, c) => pool.filter((_, i) => i % COLS === c).slice(0, 5));
  if (!pool.length) return null;
  return (
    <div aria-hidden="true" lang="en" dir="ltr" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute top-1/2 left-1/2 flex w-[190%] -translate-x-1/2 -translate-y-1/2 rotate-[-13deg] gap-6 sm:w-[150%]">
        {columns.map((col, c) => (
          <div key={c} className={`min-w-0 flex-1 flex-col gap-6 ${c >= 4 ? "hidden sm:flex" : "flex"}`} style={{ animation: `${c % 2 ? "wall-down" : "wall-up"} ${70 + c * 9}s linear infinite` }}>
            {[...col, ...col].map((k, i) => <WallCard key={`${k.id}-${i}`} k={k} />)}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_58%_52%_at_50%_52%,var(--bg)_35%,transparent_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--bg)_0%,transparent_18%,transparent_70%,var(--bg)_100%)]" />
    </div>
  );
}

function WallCard({ k }) {
  if (k.principle) {
    return (
      <div className="rounded-[22px] border border-line-2 bg-surface/80 p-6 opacity-35 sm:opacity-50">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.18em] text-ink-3 uppercase">{k.id}</span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">{k.tag.replaceAll("_", " ")}</span>
        </div>
        <p className="mt-5 line-clamp-4 text-[17px] leading-snug text-ink-2">{k.text}</p>
        <div className="mt-5 truncate font-mono text-[11px] tracking-[0.14em] text-ink-3">{k.date} · {k.title}</div>
      </div>
    );
  }
  const tone = k.stance === "bullish" ? "text-accent" : k.stance === "bearish" ? "text-down" : "text-ink-2";
  return (
    <div className="rounded-[22px] border border-line-2 bg-surface/80 p-6 opacity-35 sm:opacity-50">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.18em] text-ink-3 uppercase">{k.id}</span>
        <Conviction level={k.conviction} showLabel={false} />
      </div>
      <div className={`mt-5 font-mono text-[34px] leading-none ${tone}`}>{k.ticker}</div>
      <p className="mt-4 line-clamp-3 text-[15px] leading-snug text-ink-2">{k.thesis}</p>
      <div className="mt-5 flex items-center justify-between">
        <Chip kind={k.verdict} className="py-1 text-[11px]">{k.verdict}</Chip>
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3">{k.date}</span>
      </div>
    </div>
  );
}

export function PickCard({ item, i, name, horizon }) {
  const { lang, t: tr } = useLang();
  const t = tr(dict);
  const { pick } = item;
  const tone = TONE[pick.stance];
  return (
    <Reveal delay={i * 90} as="article" className="card card-hover group overflow-hidden" style={{ "--tone": tone }}>
      <div className="stripes relative h-56 border-b-2 px-7 pt-6" style={{ borderColor: tone }}>
        <div className="flex items-start justify-between">
          <span className="display text-[96px] leading-[0.8] font-medium tracking-[-0.06em] text-ink transition-transform duration-700 group-hover:-translate-y-1">{pad2(i + 1)}</span>
          <Conviction level={pick.conviction} />
        </div>
        <div className="absolute bottom-6 start-7 end-7">
          <bdi className="block font-mono text-[32px] leading-none font-medium tracking-[-0.02em]" style={{ color: tone }}>{pick.ticker}</bdi>
          <div className="meta mt-3">{t.has(`det.pick.stance.${pick.stance}`) && lang !== "en" ? t(`det.pick.stance.${pick.stance}`) : pick.stance} · <bdi>{name}</bdi></div>
        </div>
      </div>
      <div className="p-7">
        <div className="flex items-center justify-between gap-3">
          <Chip kind={pick.stance} />
          <span className="meta">{t("det.pick.checked", { n: horizon })}</span>
        </div>
        <En as="p" className="mt-5 text-[16px] leading-relaxed text-ink">{pick.thesis}</En>
        <div className="mt-6 grid gap-4 text-[14px]">
          <div>
            <div className="meta mb-2">{t("det.pick.risks")}</div>
            <En as="ul" className="grid gap-1 text-ink-2">
              {pick.risks.map((r) => <li key={r} className="relative ps-4 before:absolute before:start-0 before:top-[0.7em] before:h-px before:w-2 before:bg-ink-3">{r}</li>)}
            </En>
          </div>
          <div>
            <div className="meta mb-2">{t("det.pick.wrongIf")}</div>
            <En as="p" className="text-ink-2">{pick.invalidation}</En>
          </div>
        </div>
        <En className="mt-6 flex flex-wrap gap-1.5">
          {pick.evidence.map((e) => <span key={e} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2">{e}</span>)}
        </En>
        <div className="meta mt-6 flex items-center justify-between border-t border-line pt-5">
          <span className="text-ink">{item.ref_price != null ? t.rich("det.pick.priceThen", { price: <span className="num">{fmtNum(item.ref_price, 2, lang)}</span> }) : t("det.pick.fromClose")}</span>
          <span dir="ltr" className="num">{item.ref_date} → {addTradingDays(item.ref_date, horizon)}</span>
        </div>
      </div>
    </Reveal>
  );
}
