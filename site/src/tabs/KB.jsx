import { useMemo, useState } from "react";
import { addTradingDays } from "../lib/data.js";
import dict from "../text/learn.js";
import { Chip, Container, Conviction, Delta, EmptyState, InfoTip, Panel, Segmented, StatTile } from "../components/ui.jsx";
import { FilterChips, PageHero, SearchBox, TipText } from "../lib/learnkit.jsx";
import { strings } from "../lib/text.js";
import { fmtShort } from "../lib/format.js";

/*
 * The Library: every guess the brain ever made, kept, as a tile grid. Search, result and direction chips with counts,
 * a sort switch; each tile shows the guess, its reason, what would prove it wrong (behind the (i)) and how it turned out
 * against the whole market about a month later. Percent changes only.
 */

const t = strings(dict);
const VERDICTS = ["all", "hit", "miss", "flat", "pending"];
const DOT = { hit: "bg-up", miss: "bg-down", flat: "bg-ink-3", pending: "border border-dashed border-ink-3" };
const BAR = { hit: "bg-up", miss: "bg-down", flat: "bg-ink-3", pending: "bg-line-3" };
const VERDICT_TONE = { hit: "up", miss: "down", flat: "neutral", pending: "ghost" };
const STANCE_TONE = { bullish: "up", bearish: "down", neutral: "neutral" };
const PAGE = 24;

export default function KB({ data, query, setQuery, go }) {
  const { kb, settings } = data;
  const [verdict, setVerdict] = useState("all");
  const [stance, setStance] = useState("all");
  const [sort, setSort] = useState("newest");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = kb.filter(
      (k) =>
        (stance === "all" || k.stance === stance) &&
        (!q || [k.id, k.ticker, k.name, k.thesis, k.invalidation, ...k.evidence, ...k.risks].join(" ").toLowerCase().includes(q)),
    );
    const counts = Object.fromEntries(VERDICTS.map((v) => [v, v === "all" ? list.length : list.filter((k) => k.verdict === v).length]));
    if (verdict !== "all") list = list.filter((k) => k.verdict === verdict);
    if (sort === "excess") list = [...list].sort((a, b) => (b.outcome?.excess_pct ?? -1e9) - (a.outcome?.excess_pct ?? -1e9));
    if (sort === "hits") list = [...list].sort((a, b) => (a.verdict === "hit" ? 0 : 1) - (b.verdict === "hit" ? 0 : 1) || b.date.localeCompare(a.date));
    return { list, counts };
  }, [kb, query, verdict, stance, sort]);

  const n = (v) => kb.filter((k) => k.verdict === v).length;
  const checked = n("hit") + n("miss") + n("flat");
  const mornings = new Set(kb.map((k) => k.date)).size;
  const reset = () => setLimit(PAGE);

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("kb.hero1")} line2={t("kb.hero2")} sub={t("kb.sub", { n: kb.length })}
        info={<TipText lead={t("kb.about.lead")} more={t("kb.about.more")} />} />

      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatTile label={t("kb.s.total")} value={kb.length} sub={t("kb.s.totalSub", { n: mornings })} />
        <StatTile label={t("kb.s.right")} value={<span className={n("hit") ? "text-up" : ""}>{n("hit")}</span>} sub={checked ? t("kb.s.rate", { pct: `${Math.round((n("hit") / checked) * 100)}%` }) : "–"} tone="flat" />
        <StatTile label={t("kb.s.wrong")} value={<span className={n("miss") ? "text-down" : ""}>{n("miss")}</span>} sub={checked ? t("kb.s.rate", { pct: `${Math.round((n("miss") / checked) * 100)}%` }) : "–"} tone="flat" />
        <StatTile label={t("kb.s.waiting")} value={n("pending")} sub={t("kb.s.waitingSub")} tone="flat" />
      </div>

      <Panel id="kb-list" className="mt-4 md:mt-8" title={t("kb.list.title")}
        badge={<span className="font-num text-[12px] font-bold text-ink-2">{t("kb.count", { n: filtered.list.length, total: kb.length })}</span>}>
        <div className="grid gap-2.5">
          <SearchBox value={query} onChange={(v) => { setQuery(v); reset(); }} placeholder={t("kb.search")} label={t("kb.searchLabel")} />
          <FilterChips label={t("kb.result")} value={verdict} onChange={(v) => { setVerdict(v); reset(); }} wrap
            options={VERDICTS.map((v) => ({ value: v, label: t(`kb.v.${v}`), count: filtered.counts[v], dot: v === "all" ? null : <span aria-hidden="true" className={`size-2 rounded-full ${DOT[v]}`} /> }))} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterChips label={t("kb.direction")} value={stance} onChange={(v) => { setStance(v); reset(); }}
              options={["all", "bullish", "bearish", "neutral"].map((v) => ({ value: v, label: t(`kb.dir.${v}`) }))} />
            <Segmented label={t("kb.sort")} value={sort} onChange={setSort} options={["newest", "excess", "hits"].map((v) => ({ value: v, label: t(`kb.sort.${v}`) }))} />
          </div>
        </div>

        {filtered.list.length ? (
          <div className="mt-4 grid gap-2.5 md:grid-cols-2 md:items-start xl:grid-cols-3">
            {filtered.list.slice(0, limit).map((k) => <Guess key={k.id} k={k} horizon={settings.scoring.horizon_days} />)}
          </div>
        ) : <EmptyState compact className="mt-4" title={t("nothing.title")}>{t("kb.empty")}</EmptyState>}
        {filtered.list.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)}
            className="mt-3 min-h-[44px] w-full rounded-tile border border-line-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase hover:text-ink">
            {t("kb.more")} · {filtered.list.length - limit}
          </button>
        )}
      </Panel>

      <button type="button" onClick={() => go("insights")}
        className="panel group mt-4 flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:border-line-3 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="kicker block">{t("kb.lessons.title")}</span>
          <span className="mt-1 block text-[13.5px] leading-snug text-ink-2">{t("kb.lessons.body")}</span>
        </span>
        <span className="font-display shrink-0 text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase group-hover:text-desk">{t("kb.lessons.open")} <span aria-hidden="true">→</span></span>
      </button>
    </Container>
  );
}

function Guess({ k, horizon }) {
  const due = k.outcome?.scored_date ?? addTradingDays(k.date, horizon);
  return (
    <article className="tile relative flex min-w-0 flex-col overflow-hidden p-3.5 pt-4">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${BAR[k.verdict]}`} />
      <div className="flex items-center justify-between gap-2">
        <span className="font-num truncate text-[10.5px] text-ink-3">{k.id}</span>
        <Conviction level={k.conviction} tone="flat" showLabel={false} />
      </div>
      <p className="mt-1.5 flex min-w-0 items-baseline gap-2">
        <span className="font-num text-[16px] font-bold text-ink">{k.ticker}</span>
        <span className="min-w-0 truncate text-[12.5px] text-ink-3">{k.name}</span>
      </p>
      <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-snug text-ink-2">{k.thesis}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        <Chip tone={STANCE_TONE[k.stance] ?? "neutral"} className="min-h-[22px] px-1.5 text-[10px]">{t.has(`kb.dir.${k.stance}`) ? t(`kb.dir.${k.stance}`) : k.stance}</Chip>
        <span className="micro">{t("kb.wrongIf")}</span>
        <span className="-my-2 -ms-2.5"><InfoTip label={t("kb.wrongIf")} align="start">
          <span className="block text-ink">{k.invalidation}</span>
          {k.risks?.length > 0 && <span className="mt-2 grid gap-1">{k.risks.map((r) => <span key={r} className="flex gap-1.5"><span aria-hidden="true" className="text-down">–</span>{r}</span>)}</span>}
        </InfoTip></span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5 [margin-top:max(0.75rem,auto)]">
        <Chip tone={VERDICT_TONE[k.verdict] ?? "neutral"} className="min-h-[22px] px-1.5 text-[10px]">
          {k.verdict === "pending" ? t("kb.chip.pending") : <>{t(`kb.v.${k.verdict}`)} <Delta value={k.outcome.excess_pct} d={1} /></>}
        </Chip>
        <span className="font-num text-[11px] text-ink-3">{fmtShort(k.date)} → {t(k.outcome ? "kb.checked" : "kb.due", { date: fmtShort(due) })}</span>
      </div>
    </article>
  );
}

