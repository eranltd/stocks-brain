import { Fragment } from "react";
import { addTradingDays } from "../lib/data.js";
import { daysBetween } from "../lib/stats.js";
import { fmtDate, fmtNum, pad2 } from "../lib/format.js";
import { BriefSections, marketBrief } from "../components/brief.jsx";
import { BaseRates, GoalSection, MarketContext, PortfolioNow, nextRebalance } from "../components/goal.jsx";
import { TrustLadder, trustStage } from "../components/trust.jsx";
import { callsTouching, joinCalls, shortVia, statusPhrase } from "../lib/people.js";
import { shortSector } from "../lib/marketday.js";
import { comingUp, inDays, todayISO } from "../lib/outlook.js";
import { ArrowRight, Chip, Container, Conviction, HeroTitle, InfoTip, Panel, SectionTitle } from "../components/ui.jsx";
import { DeskHead, MarketPulse, MoversPanel, SectorHeat, usePulse } from "../components/pulse.jsx";
import { isBehind, notesForDay, noteView, usableWhy } from "../lib/why.js";
import { WhyFooter, WhyNote } from "../components/why.jsx";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

// Every text on this page is in text/home.js ("det.*", the market panels' "pulse.*"; goal.jsx's sections use "goal.*").
/** A whole percent ("62%"). */
const wholePct = (v) => `${fmtNum(v, 0)}%`;

const STANCE_TONE = { bullish: "up", bearish: "down", neutral: "neutral" };
const STANCE_TEXT = { bullish: "text-up", bearish: "text-down", neutral: "text-ink-2" };

/**
 * The market details page (the old home): the decision first. The verdict (computed from the trust stage, data freshness
 * and the rule), then what the market did at the last close (index moves, breadth, the biggest movers, industries and
 * why it moved), results coming up, the goal check, the portfolio, market context, whether the rules work, the trust
 * ladder and the brain's latest picks. Dense panels with "◆ TITLE" heads, percent only.
 */
export default function Details({ data, go }) {
  const t = strings(dict);
  const brief = marketBrief(data);
  const run = data.sample ? null : data.lastOk;
  return (
    <Container className="pt-8 pb-6">
      <Verdict data={data} go={go} />
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
        <section id="picks" className="scroll-mt-28 pt-20">
          <SectionTitle size="md" eyebrow={t("det.picks.eyebrow", { date: fmtDate(run.date) })} title={<>{t("det.picks.titleA")} <span className="text-desk">{t("det.picks.titleB")}</span></>}
            right={<InfoTip label={t("det.picks.titleA")}>{t("det.picks.lede")}</InfoTip>} />
          {/* each pick's reason, risks and test are the brain's own words */}
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {run.picks.map((p, i) => <PickCard key={p.id} item={p} i={i} name={data.names[p.pick.ticker]} horizon={data.settings.scoring.horizon_days} />)}
          </div>
        </section>
      )}
      <p className="micro mt-16 tracking-[0.04em] normal-case">{t("det.footer")}</p>
    </Container>
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
const day = (iso) => fmtDate(iso).replace(/\s\d{4}$/, ""); // "Thu, 22 Oct"

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
function dayNotes(data, why, date) {
  const t = strings(dict);
  const marketId = data.marketId ?? data.markets?.find((m) => m.default)?.id ?? null;
  const labels = Object.fromEntries((data.markets ?? []).map((m) => [m.id, m.label ?? m.id]));
  const mine = new Set([...(data.watchlist?.symbols ?? []).map((s) => s.symbol), ...(data.watchlist?.context ?? []).map((c) => c.symbol), data.bench?.symbol]);
  const ours = (n) => (n.kind === "sector" ? !n.market || n.market === marketId : n.symbols.some((t) => mine.has(t)));
  const notes = notesForDay(why, date);
  return [...notes.filter(ours), ...notes.filter((n) => !ours(n))].map((n) => {
    const v = noteView(n, { names: data.names, groups: data.sectors ?? {}, short: shortSector });
    const one = n.kind !== "sector" && n.symbols.length === 1 ? n.symbols[0] : null;
    return { v, lead: v.who, tag: !ours(n) && n.market && labels[n.market] ? t("det.md.onList", { list: labels[n.market] }) : null, to: one ? `stock/${one}#why-it-moved` : null };
  });
}

/** What the market did at the last close: index moves and breadth, the biggest movers, industries, and why (when a note exists). */
function MarketDay({ data, go }) {
  const t = strings(dict);
  const p = usePulse(data);
  const d = p?.d;
  if (!d || !d.names) return null;
  const why = usableWhy(data.why, Boolean(data.livePrices));
  const notes = why ? dayNotes(data, why, d.date) : [];
  const lead = d.spx?.pct ?? d.bench?.pct ?? null;
  const who = t(d.spx?.pct != null ? "det.md.who.market" : "det.md.who.ndx"); // the S&P 500 leads; older data has only the benchmark's move
  const verb = lead == null ? null : lead > 0.05 ? "up" : lead < -0.05 ? "down" : "flat";
  const verbTone = verb === "up" ? "text-up" : verb === "down" ? "text-down" : "text-ink-2"; // a fall never shows in the up colour
  // The verbs are the home's move words ("rose").
  const verbWord = verb && t(`size.${verb}`);
  const ink = (key, count) => <span className="text-ink">{t(key, { count })}</span>;
  const counted = d.flat
    ? rich(t, "det.md.countedFlat", { n: d.names, up: ink("det.md.up", d.rose), down: ink("det.md.down", d.fell), flat: t("det.md.andFlat", { count: d.flat }) })
    : rich(t, "det.md.counted", { n: d.names, up: ink("det.md.up", d.rose), down: ink("det.md.andDown", d.fell) });
  return (
    <section id="market-today" className="scroll-mt-28 pt-14 sm:pt-20">
      <SectionTitle size="md" eyebrow={t(data.livePrices ? "det.md.eyebrowLive" : "det.md.eyebrowSample", { date: fmtDate(d.date) })}
        title={verbWord ? <>{who} <span className={verbTone}>{verbWord}.</span></> : <>{t("det.md.lastA")} <span className="text-desk">{t("det.md.lastB")}</span></>}
        sub={d.counted ? counted : t("det.md.notCounted")}
        right={<InfoTip label={t("det.md.about")}>{t("det.md.ledeTail")} {t("det.md.closeTime")}</InfoTip>} />
      <div className="mt-5"><MarketPulse p={p} id="market-pulse" /></div>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <MoversPanel p={p} go={go} id="market-movers" />
        <SectorHeat p={p} id="market-sectors" />
      </div>
      {notes.length > 0 && (
        <Panel id="market-why" className="mt-4 scroll-mt-28" head={<DeskHead id="market-why-h" title={t("det.md.why")} sub={day(d.date)} />}>
          <ul className="grid gap-2 md:grid-cols-2">
            {notes.map((x) => <WhyNote key={x.v.key} v={x.v} tag={x.tag}
              lead={x.to ? <button type="button" onClick={() => goTo(go, x.to)} className="text-start underline decoration-line-2 underline-offset-2 hover:text-ink-2">{x.lead}</button> : x.lead} />)}
          </ul>
          <WhyFooter className="mt-3" />
        </Panel>
      )}
      <p className="mt-3 max-w-[90ch] text-[12.5px] leading-snug text-ink-3">
        {t(notes.length ? "det.md.notesSay" : !why ? "det.md.noWhy" : isBehind(why, d.date) ? "det.md.behind" : "det.md.whatNotWhy")}
      </p>
    </section>
  );
}

/**
 * Earnings dates for our names in the next thirty days, from the outlook cards: names we hold or picked first, then the
 * rest of the list, each by date; held or picked names with no date yet are named below. Hidden when there is nothing.
 */
function ComingUp({ data, go }) {
  const t = strings(dict);
  const today = todayISO();
  const { held, picked } = heldAndPicked(data);
  const DAYS = 30;
  const { ahead, undated } = comingUp(data.outlook, today, DAYS, [...held, ...picked]);
  if (!ahead.length && !undated.length) return null;
  const tag = (x) => t(held.includes(x) ? "today.held" : "today.picked");
  const groups = [[t("det.cu.first"), ahead.filter((r) => r.first)], [t("det.cu.others"), ahead.filter((r) => !r.first)]].filter(([, rows]) => rows.length);
  return (
    <Panel id="coming-up" className="mt-4 scroll-mt-28" head={<DeskHead id="coming-up-h" title={t("det.cu.title")} sub={t("det.cu.next", { n: DAYS })} />}
      info={t("det.cu.explain")} infoLabel={t("det.cu.title")}>
      {groups.map(([label, rows], gi) => (
        <div key={label} className={gi ? "mt-4" : ""}>
          <p className="micro mb-1.5">{label}</p>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.ticker} className="border-b border-line">
                <button type="button" onClick={() => go(`stock/${r.ticker}`)}
                  className="-mx-2 flex min-h-[48px] w-[calc(100%+16px)] items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-start transition-colors hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-num text-[13.5px] font-bold text-ink">{r.ticker}</span>
                      {r.first && <Chip tone="people" className="min-h-[18px] px-1.5 text-[9.5px]">{tag(r.ticker)}</Chip>}
                    </span>
                    <span className="block truncate text-[12px] text-ink-3">{data.names[r.ticker] ?? r.name}</span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block font-num text-[12.5px] font-bold text-ink">{day(r.date)}</span>
                    <span className="micro block tracking-[0.06em] normal-case">{inDays(r.days)}{r.confirmed ? "" : t("today.expected")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {undated.length > 0 && (
        <p className="mt-3 text-[13px] leading-snug text-ink-2">
          {t("det.cu.undated")}{" "}
          {undated.map((u, i) => (
            <Fragment key={u.ticker}>{i ? ", " : ""}<button type="button" onClick={() => go(`stock/${u.ticker}`)} className="font-num font-bold text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink">{u.ticker}</button> ({tag(u.ticker)})</Fragment>
          ))}
        </p>
      )}
    </Panel>
  );
}

/** One line linking to People when a logged public call touches a name the paper record holds or the brain picked. */
function PeopleNote({ data, go }) {
  const t = strings(dict);
  const calls = joinCalls(data.people, data.peopleScores);
  if (!calls.length) return null;
  const judge = data.peopleScores?.judge_at_weeks ?? 26;
  const { held, picked } = heldAndPicked(data);
  const touching = callsTouching(calls, [...held, ...picked]);
  if (!touching.length) return null;
  return (
    <Panel id="people-note" className="mt-8" head={<DeskHead id="people-note-h" title={t("det.people.title")} />}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-[14px] leading-snug text-ink-2">
          {t("det.people.lead", { count: touching.length })}{" "}
          {touching.map((c, i) => (
            <span key={c.id}>{i ? "; " : ""}{rich(t, "det.people.item", {
              t: <span className="font-num font-bold text-ink">{c.ticker}</span>,
              stance: t.has(`feed.people.${c.stance}`) ? t(`feed.people.${c.stance}`) : c.stance,
              via: shortVia(c.via),
              kind: t(c.source_kind === "13f" ? "det.people.13f" : "det.people.public"),
              date: fmtDate(c.date).replace(/^[^,]+,\s*/, ""),
              status: <span>{statusPhrase(c, judge)}</span>,
            })}</span>
          ))}{t("det.people.tail")}
        </p>
        <button type="button" onClick={() => go("people")} className="btn shrink-0 self-start sm:self-center">{t("det.people.button")} <ArrowRight /></button>
      </div>
    </Panel>
  );
}

/** What to do today, computed once for both the Today post and the full dashboard's verdict. */
export function todayCall(data) {
  const t = strings(dict);
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
  const t = strings(dict);
  const { stage, small, asOf, age, stale, lr, rec, held, corePct, met, v1res, head, accent } = todayCall(data);
  const heldList = <span className="text-ink">{held.length ? <span>{held.join(", ")}</span> : t("det.v.noStocks")}</span>;
  const goalPct = `+${data.settings.goal.annual_return_pct}%`;
  const tone = stale ? "down" : data.livePrices ? "up" : "wait";
  return (
    <section className="grid gap-5">
      <HeroTitle line1={head} line2={accent} size="md" />
      <div className="flex flex-wrap items-center gap-1.5">
        <a href="#market-today" onClick={jumpToMarket} title={t("det.v.jump")} className="inline-flex min-h-[44px] items-center">
          <Chip tone={tone}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {t(data.livePrices ? "det.v.close" : "det.v.sample", { date: fmtDate(asOf) })}{stale ? t("det.v.daysOld", { count: age }) : ""}
            <span aria-hidden="true">↓</span>
          </Chip>
        </a>
      </div>
      <Panel id="verdict" hero={!stale} active={stale} head={<DeskHead id="verdict-h" title={t("det.v.title")} sub={t("det.v.sub")} />}>
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-ink-2">
          {stale ? (
            <>{t("det.v.stale", { date: fmtDate(asOf) })}</>
          ) : (
            <>
              {t("det.v.real")}{" "}
              {lr || rec ? <>{t("det.v.game")} {rich(t, rec ? "det.v.holds" : "det.v.wouldHold", { list: heldList })}{corePct > 0 ? t("det.v.andCore", { pct: wholePct(corePct) }) : null}{t("det.v.looksAgain", { date: fmtDate(nextRebalance(asOf)) })} {v1res ? <>{rich(t, "det.v.tested", { word: <span className="text-ink">{t.has(`det.v.word.${v1res.verdict}`) ? t(`det.v.word.${v1res.verdict}`) : v1res.verdict}</span>, pct: wholePct(v1res.percentile) })} </> : null}</> : null}
              {stage >= 2 ? t("det.v.stage", { stage }) : rich(t, "det.v.notYet", { met: <span className="font-num font-bold text-ink">{t("det.v.metOf", { met, n: small.length })}</span> })}
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {stale ? (
            <button type="button" onClick={() => go("routines")} className="btn btn-primary">{t("det.v.routines")} <ArrowRight /></button>
          ) : (
            <a href="#goal" className="btn btn-primary">
              {t("det.v.goal", { goal: goalPct })}
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
            </a>
          )}
          <button type="button" onClick={() => go("portfolio")} className="btn">{t("det.v.portfolio")} <ArrowRight /></button>
        </div>
        <a href="#market-today" onClick={jumpToMarket}
          className="mt-2 inline-flex min-h-[44px] items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.1em] text-desk uppercase hover:text-ink">
          {t("det.v.marketLink")}
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </a>
      </Panel>
    </section>
  );
}

/** One of the brain's picks: its guess, the reason, what could go wrong and what would prove it wrong (its own words). */
export function PickCard({ item, i, name, horizon }) {
  const t = strings(dict);
  const { pick } = item;
  const stance = pick.stance in STANCE_TONE ? pick.stance : "neutral";
  return (
    <article className="panel group flex flex-col overflow-hidden transition-colors hover:border-line-3">
      <div className="relative border-b border-line px-4 pt-3.5 pb-3 sm:px-5">
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[2px] ${stance === "bullish" ? "bg-up" : stance === "bearish" ? "bg-down" : "bg-ink-3"}`} />
        <div className="flex items-start justify-between gap-3">
          <span className="font-num text-[13px] font-bold text-desk">{pad2(i + 1)}</span>
          <Conviction level={pick.conviction} />
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className={`block font-num text-[30px] leading-none font-bold tracking-[-0.03em] ${STANCE_TEXT[stance]}`}>{pick.ticker}</span>
            <span className="mt-1 block truncate text-[12.5px] text-ink-3">{name}</span>
          </span>
          <Chip tone={STANCE_TONE[stance]}>{pick.stance}</Chip>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 py-3.5 sm:px-5">
        <p className="text-[14.5px] leading-snug text-ink">{pick.thesis}</p>
        <div className="mt-3 grid gap-3 text-[13px]">
          <div>
            <div className="micro mb-1">{t("det.pick.risks")}</div>
            <ul className="grid gap-0.5 text-ink-2">
              {pick.risks.map((r) => <li key={r} className="relative ps-3.5 leading-snug before:absolute before:start-0 before:top-[0.65em] before:h-px before:w-2 before:bg-ink-3">{r}</li>)}
            </ul>
          </div>
          <div>
            <div className="micro mb-1">{t("det.pick.wrongIf")}</div>
            <p className="leading-snug text-ink-2">{pick.invalidation}</p>
          </div>
        </div>
        <div className="mt-3 mb-3 flex flex-wrap gap-1">
          {pick.evidence.map((e) => <Chip key={e} tone="neutral" className="min-h-[22px] px-1.5 text-[10px] tracking-[0.02em] normal-case">{e}</Chip>)}
        </div>
        <div className="micro mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3">
          <span>{t("det.pick.checked", { n: horizon })}</span>
          <span className="font-num tracking-[0.04em] text-ink-2">{t("det.pick.fromClose")} {item.ref_date} → {addTradingDays(item.ref_date, horizon)}</span>
        </div>
      </div>
    </article>
  );
}
