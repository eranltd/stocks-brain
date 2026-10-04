import { useMemo, useState } from "react";
import { addTradingDays } from "../lib/data.js";
import { fmtPct } from "../lib/format.js";
import { Accent, Chip, Container, Conviction, Empty, Reveal, SectionHead, Segmented, Dot } from "../components/ui.jsx";

const VERDICTS = [
  { value: "all", label: "All" },
  { value: "hit", label: "Hit", dot: <Dot tone="accent" /> },
  { value: "miss", label: "Miss", dot: <Dot tone="down" /> },
  { value: "flat", label: "Flat", dot: <Dot tone="flat" /> },
  { value: "pending", label: "Pending", dot: <Dot tone="people" dashed /> },
];

export default function KB({ data, query, setQuery }) {
  const { kb, settings, library, observations } = data;
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
        eyebrow="The KB"
        title={<>The whole <Accent>memory.</Accent></>}
        lede="Every pick the brain has made: what it argued, what would prove it wrong, and how it ended. The packer feeds a recent slice of this into each run."
      />

      <Reveal className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <label className="flex items-center gap-3 rounded-full border border-line-2 bg-surface px-5 py-3.5 focus-within:border-accent">
          <svg viewBox="0 0 24 24" className="size-[18px] text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimit(24); }}
            placeholder="Search ticker, thesis, evidence, pick id"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3"
            aria-label="Search the KB"
          />
        </label>
        <label className="flex items-center gap-3 rounded-full border border-line-2 bg-surface px-5 py-3.5">
          <span className="meta">Stance</span>
          <select value={stance} onChange={(e) => setStance(e.target.value)} className="w-full bg-transparent text-[15px] outline-none" aria-label="Filter by stance">
            <option value="all">All stances</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>
      </Reveal>

      <Reveal delay={100} className="mt-4 flex flex-wrap items-center gap-3">
        <Segmented label="Verdict" value={verdict} onChange={setVerdict} options={VERDICTS.map((v) => ({ ...v, count: filtered.counts[v.value] }))} />
        <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest" }, { value: "excess", label: "Best excess" }, { value: "hits", label: "Hits first" }]} />
        <span className="meta ml-auto">{filtered.list.length} of {kb.length}</span>
      </Reveal>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.list.slice(0, limit).map((k, i) => <KBCard key={k.id} k={k} i={i % 12} horizon={settings.scoring.horizon_days} />)}
      </div>
      {!filtered.list.length && <Empty title="Nothing matches">Try a ticker, or clear the filters.</Empty>}
      {filtered.list.length > limit && (
        <div className="mt-8 flex justify-center">
          <button type="button" className="btn" onClick={() => setLimit(limit + 24)}>Show more</button>
        </div>
      )}

      <Library library={library} />
      <Observations observations={observations} library={library} />
    </Container>
  );
}

function KBCard({ k, i, horizon }) {
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
        <Chip kind={k.stance} className="py-1 text-[10px]" />
        {k.evidence.slice(0, 2).map((e) => <span key={e} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2">{e}</span>)}
        {k.evidence.length > 2 && <span className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-3">+{k.evidence.length - 2}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <Chip kind={k.verdict}>{k.verdict === "pending" ? "pending" : `${k.verdict} ${fmtPct(k.outcome.excess_pct, 1)}`}</Chip>
        <span className="meta num text-right">{k.date} → {k.outcome?.scored_date ?? addTradingDays(k.date, horizon)}</span>
      </div>
    </Reveal>
  );
}

function Library({ library }) {
  const [tag, setTag] = useState(null);
  const sources = library?.sources ?? [];
  const principles = sources.flatMap((s) => s.principles.map((p) => ({ ...p, source: s })));
  const tags = [...new Set(principles.flatMap((p) => p.tags))].sort();
  const shown = tag ? principles.filter((p) => p.tags.includes(tag)) : principles;
  return (
    <section className="pt-32">
      <SectionHead
        eyebrow="The library"
        title={<>What the books <Accent>taught.</Accent></>}
        lede="Principles distilled from books and lectures, in our own words, each with its source. The repo is public, so source text never lands here. The packer picks the principles whose tags match the day."
        right={<span className="meta">{sources.length} sources · {principles.length} principles</span>}
        size="md"
      />
      {!principles.length ? (
        <Empty title="The library is empty">Add sources to data/kb/library.json: one entry per book or lecture, a few short principles each.</Empty>
      ) : (
        <>
          <Reveal className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setTag(null)} className={`pill shrink-0 ${!tag ? "bg-ink text-bg" : "text-ink-2"}`}>all</button>
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => setTag(t === tag ? null : t)} className={`pill shrink-0 ${t === tag ? "bg-ink text-bg" : "text-ink-2"}`}>{t}</button>
            ))}
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((p, i) => (
              <Reveal key={p.id} delay={(i % 6) * 50} className="card brackets p-7">
                <div className="flex items-center justify-between">
                  <span className="meta">{p.id}</span>
                  <span className="pill border-dashed border-people/50 py-1 text-[10px] text-people">{p.source.kind}</span>
                </div>
                <p className="mt-4 text-[17px] leading-relaxed tracking-[-0.01em]">{p.text}</p>
                <div className="meta mt-5 border-t border-line pt-4 normal-case tracking-[0.04em]">
                  {p.source.title} · {p.source.author}{p.source.year ? ` · ${p.source.year}` : ""}
                </div>
              </Reveal>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const OBS_KIND = { market: "market", company: "company", sector: "sector", theme: "theme" };

function Observations({ observations, library }) {
  const [showExpired, setShowExpired] = useState(false);
  const [q, setQ] = useState("");
  const items = observations?.items ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const titles = Object.fromEntries((library?.sources ?? []).map((s) => [s.id, s]));
  const live = items.filter((o) => o.expires >= today);
  const needle = q.trim().toUpperCase();
  const shown = (showExpired ? items : live)
    .filter((o) => !needle || o.tickers.some((t) => t.includes(needle)) || o.text.toUpperCase().includes(needle))
    .sort((a, b) => b.as_of.localeCompare(a.as_of) || a.id.localeCompare(b.id));
  return (
    <section className="pt-32">
      <SectionHead
        eyebrow="Observations"
        title={<>Dated claims, <Accent>not facts.</Accent></>}
        lede="Readings, earnings setups and adoption figures quoted by sources. Each one expires and stays unverified until code checks it against prices. The packer only passes unexpired claims, labelled as claims."
        right={<span className="meta">{live.length} live · {items.length - live.length} expired</span>}
        size="md"
      />
      {!items.length ? (
        <Empty title="No observations yet">Dated claims from new sources land in data/kb/observations.json.</Empty>
      ) : (
        <>
          <Reveal className="mb-6 flex flex-wrap items-center gap-3">
            <label className="flex min-w-[220px] flex-1 items-center gap-3 rounded-full border border-line-2 bg-surface px-5 py-3 focus-within:border-accent sm:max-w-sm">
              <span className="meta">Ticker</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. META" aria-label="Filter observations by ticker or text"
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
            </label>
            <Segmented label="Show" value={showExpired ? "all" : "live"} onChange={(v) => setShowExpired(v === "all")}
              options={[{ value: "live", label: "Live", count: live.length }, { value: "all", label: "Include expired", count: items.length }]} />
          </Reveal>
          {!shown.length && <Empty title="Nothing live">All observations have expired. Include expired to see the history.</Empty>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((o, i) => {
              const expired = o.expires < today;
              return (
                <Reveal key={o.id} delay={(i % 6) * 40} as="article" className={`card flex flex-col p-6 ${expired ? "border-dashed opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="meta">{o.id} · {OBS_KIND[o.kind]}</span>
                    <span className={`pill py-1 text-[10px] ${o.status === "confirmed" ? "border-accent/40 text-accent" : o.status === "contradicted" ? "border-down/40 text-down" : "border-dashed border-people/60 text-people"}`}>{o.status}</span>
                  </div>
                  {o.tickers.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {o.tickers.map((t) => <span key={t} className="font-mono text-[15px] font-medium text-accent">{t}</span>)}
                    </div>
                  )}
                  <p className="mt-3 text-[15px] leading-relaxed text-ink">{o.text}</p>
                  <div className="meta mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 normal-case tracking-[0.04em] [margin-top:max(1.25rem,auto)]">
                    <span className="truncate" title={titles[o.source_id]?.title}>{o.source_id} · {titles[o.source_id]?.ref ?? ""}</span>
                    <span className="shrink-0 num">{o.as_of} → {expired ? "expired" : o.expires}</span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
