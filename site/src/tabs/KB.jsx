import { useMemo, useState } from "react";
import { addTradingDays } from "../lib/data.js";
import dict from "../text/learn.js";
import { Accent, ArrowRight, Chip, Container, Conviction, Empty, Reveal, SectionHead, Segmented, Dot } from "../components/ui.jsx";
import { strings } from "../lib/text.js";
import { fmtPct } from "../lib/format.js";

// Labels are text/learn.js "kb.v.<value>".
const VERDICTS = [
  { value: "all" },
  { value: "hit", dot: <Dot tone="accent" /> },
  { value: "miss", dot: <Dot tone="down" /> },
  { value: "flat", dot: <Dot tone="flat" /> },
  { value: "pending", dot: <Dot tone="people" dashed /> },
];

export default function KB({ data, query, setQuery, go }) {
  const { kb, settings } = data;
  const t = strings(dict);
  const [verdict, setVerdict] = useState("all");
  const [stance, setStance] = useState("all");
  const [sort, setSort] = useState("newest");
  const [limit, setLimit] = useState(24);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = kb.filter(
      (k) =>
        (stance === "all" || k.stance === stance) &&
        (!q || [k.id, k.ticker, k.name, k.thesis, k.invalidation, ...k.evidence, ...k.risks].join(" ").toLowerCase().includes(q)),
    );
    const counts = Object.fromEntries(VERDICTS.map((v) => [v.value, v.value === "all" ? list.length : list.filter((k) => k.verdict === v.value).length]));
    if (verdict !== "all") list = list.filter((k) => k.verdict === verdict);
    if (sort === "excess") list = [...list].sort((a, b) => (b.outcome?.excess_pct ?? -1e9) - (a.outcome?.excess_pct ?? -1e9));
    if (sort === "hits") list = [...list].sort((a, b) => (a.verdict === "hit" ? 0 : 1) - (b.verdict === "hit" ? 0 : 1) || b.date.localeCompare(a.date));
    return { list, counts };
  }, [kb, query, verdict, stance, sort]);

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={t("kb.eyebrow")}
        title={<>{t("kb.title.a")} <Accent>{t("kb.title.b")}</Accent></>}
        lede={<>
          <span className="block text-ink">{t("kb.lede1")}</span>
          <span className="mt-3 block">{t("kb.lede2")}</span>
        </>}
      />

      <Reveal className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <label className="flex items-center gap-3 rounded-full border border-line-2 bg-surface px-5 py-3.5 focus-within:border-accent">
          <svg viewBox="0 0 24 24" className="size-[18px] text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimit(24); }}
            placeholder={t("kb.search")}
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3"
            aria-label={t("kb.searchLabel")}
          />
        </label>
        <label className="flex items-center gap-3 rounded-full border border-line-2 bg-surface px-5 py-3.5">
          <span className="meta">{t("kb.direction")}</span>
          <select value={stance} onChange={(e) => setStance(e.target.value)} className="w-full bg-transparent text-[15px] outline-none" aria-label={t("kb.directionLabel")}>
            {["all", "bullish", "bearish", "neutral"].map((v) => <option key={v} value={v}>{t(`kb.dir.${v}`)}</option>)}
          </select>
        </label>
      </Reveal>

      <Reveal delay={100} className="mt-4 flex flex-wrap items-center gap-3">
        <Segmented label={t("kb.result")} value={verdict} onChange={setVerdict} options={VERDICTS.map((v) => ({ ...v, label: t(`kb.v.${v.value}`), count: filtered.counts[v.value] }))} />
        <Segmented label={t("kb.sort")} value={sort} onChange={setSort} options={["newest", "excess", "hits"].map((v) => ({ value: v, label: t(`kb.sort.${v}`) }))} />
        <span className="meta ms-auto">{t("kb.count", { n: filtered.list.length, total: kb.length })}</span>
      </Reveal>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.list.slice(0, limit).map((k, i) => <KBCard key={k.id} k={k} i={i % 12} horizon={settings.scoring.horizon_days} />)}
      </div>
      {!filtered.list.length && <Empty title={t("nothing.title")}>{t("kb.empty")}</Empty>}
      {filtered.list.length > limit && (
        <div className="mt-8 flex justify-center">
          <button type="button" className="btn" onClick={() => setLimit(limit + 24)}>{t("kb.more")}</button>
        </div>
      )}

      <Reveal className="mt-24 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line p-7">
        <div>
          <div className="eyebrow mb-2">{t("kb.lessons.eyebrow")}</div>
          <p className="text-ink-2">{t("kb.lessons.body")}</p>
        </div>
        <button type="button" onClick={() => go("insights")} className="btn">{t("kb.lessons.open")} <ArrowRight /></button>
      </Reveal>
    </Container>
  );
}

function KBCard({ k, i, horizon }) {
  const t = strings(dict);
  const tone = { hit: "var(--accent)", miss: "var(--down)", flat: "var(--flat)", pending: "var(--line-2)" }[k.verdict];
  return (
    <Reveal delay={i * 40} as="article" className="card card-hover flex flex-col overflow-hidden p-6 sm:p-7">
      <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[2px] rounded-b" style={{ background: tone }} />
      <div className="flex items-center justify-between">
        <span className="meta">{k.id}</span>
        <Conviction level={k.conviction} tone="flat" />
      </div>
      <h3 className="mt-4 text-[20px] leading-snug font-semibold tracking-[-0.02em]">
        {k.name} <span className="font-mono text-[15px] font-normal text-ink-3">{k.ticker}</span>
      </h3>
      <p className="mt-2 line-clamp-3 text-[14.5px] leading-relaxed text-ink-2">{k.thesis}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip kind={k.stance} className="py-1 text-[11px]" />
        {k.evidence.slice(0, 2).map((e) => <span key={e} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2">{e}</span>)}
        {k.evidence.length > 2 && <span className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-3">+{k.evidence.length - 2}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <Chip kind={k.verdict}>{k.verdict === "pending" ? t("kb.chip.pending") : t(`kb.chip.${k.verdict}`, { pct: fmtPct(k.outcome.excess_pct, 1) })}</Chip>
        <span className="meta num text-end">{k.date} → {k.outcome?.scored_date ?? addTradingDays(k.date, horizon)}</span>
      </div>
    </Reveal>
  );
}
