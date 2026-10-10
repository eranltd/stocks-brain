import { useMemo, useState } from "react";
import { fmtDate, pad2 } from "../lib/format.js";
import { Accent, ArrowRight, Container, Empty, Reveal, SectionHead, Segmented, Strip } from "../components/ui.jsx";

const today = () => new Date().toISOString().slice(0, 10);

function youtubeUrl(ref) {
  const [kind, id] = (ref || "").split(":");
  return kind === "youtube" ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : null;
}

export default function Insights({ data }) {
  const library = data.library?.sources ?? [];
  const claims = data.observations?.items ?? [];
  const [view, setView] = useState("sources");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState(null);
  const now = today();

  const sources = useMemo(
    () => [...library].sort((a, b) => (b.published ?? b.added).localeCompare(a.published ?? a.added) || b.id.localeCompare(a.id)),
    [library],
  );
  const principles = useMemo(() => sources.flatMap((s) => s.principles.map((p) => ({ ...p, source: s }))), [sources]);
  const claimsBySource = useMemo(() => {
    const m = {};
    for (const c of claims) (m[c.source_id] ||= []).push(c);
    return m;
  }, [claims]);
  const tags = useMemo(() => {
    const count = {};
    for (const p of principles) for (const t of p.tags) count[t] = (count[t] || 0) + 1;
    return Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [principles]);

  const needle = q.trim().toLowerCase();
  const matchP = (p) =>
    (!tag || p.tags.includes(tag)) &&
    (!needle || [p.text, p.id, p.source.title, ...p.tags].join(" ").toLowerCase().includes(needle));
  const matchC = (c) =>
    (!tag || c.tags.includes(tag)) &&
    (!needle || [c.text, c.id, ...c.tickers, ...c.tags].join(" ").toLowerCase().includes(needle));

  const live = claims.filter((c) => c.expires >= now).length;
  const shownSources = sources.filter((s) => s.principles.some(matchP) || (claimsBySource[s.id] ?? []).some(matchC) || (!needle && !tag));

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={`Insights · library v${data.library?.version ?? "–"}`}
        title={<>What the sources <Accent>taught.</Accent></>}
        lede="Every video you fed in, distilled. Principles are lasting lessons in our own words, each with its source. Claims are dated readings and setups that expire and stay unverified until code checks them against prices. The brain reads the principles that match the day, plus only unexpired claims."
      />
      <Strip
        cells={[
          { value: sources.length, label: "sources", desc: "Videos so far. Books and lectures land here too." },
          { value: principles.length, label: "principles", desc: "Lasting lessons, paraphrased, at most 280 characters each." },
          { value: live, label: "live claims", tone: "people", dashed: true, desc: `${claims.length - live} more have expired and are kept for scoring sources.` },
          { value: tags.length, label: "themes", tone: "flat", desc: `Most common: ${tags.slice(0, 3).map(([t]) => t.replaceAll("_", " ")).join(", ")}.` },
        ]}
      />

      <Reveal className="mt-10 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex items-center gap-3 rounded-full border border-line-2 bg-surface px-5 py-3.5 focus-within:border-accent">
          <svg viewBox="0 0 24 24" className="size-[18px] text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons, claims, tickers, themes"
            aria-label="Search insights" className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
        </label>
        <Segmented label="View" value={view} onChange={setView}
          options={[{ value: "sources", label: "By source", count: sources.length }, { value: "themes", label: "By theme", count: tags.length }, { value: "claims", label: "Claims", count: claims.length }]} />
      </Reveal>

      <Reveal delay={80} className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setTag(null)} className={`pill shrink-0 py-2.5 ${!tag ? "border-transparent bg-ink text-bg" : "text-ink-2"}`}>all themes</button>
        {tags.map(([t, n]) => (
          <button key={t} type="button" onClick={() => setTag(t === tag ? null : t)}
            className={`pill shrink-0 py-2.5 ${t === tag ? "border-transparent bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}>
            {t.replaceAll("_", " ")} <span className="num opacity-60">{n}</span>
          </button>
        ))}
      </Reveal>

      <div className="mt-8">
        {view === "sources" && (
          shownSources.length ? (
            <div className="grid gap-6">
              {shownSources.map((s, i) => (
                <SourceCard key={s.id} s={s} n={Number(s.id.slice(2))} delay={(i % 4) * 60}
                  principles={s.principles.filter((p) => matchP({ ...p, source: s }))}
                  claims={(claimsBySource[s.id] ?? []).filter(matchC)} filtered={Boolean(needle || tag)} />
              ))}
            </div>
          ) : <Empty title="Nothing matches">Try another word or clear the theme.</Empty>
        )}
        {view === "themes" && <Themes principles={principles.filter(matchP)} tags={tag ? [[tag]] : tags} />}
        {view === "claims" && <Claims claims={claims.filter(matchC)} sources={library} />}
      </div>
    </Container>
  );
}

function SourceCard({ s, n, principles, claims, filtered, delay }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const visible = all || filtered ? principles : principles.slice(0, 2);
  const url = youtubeUrl(s.ref);
  const now = today();
  const liveClaims = claims.filter((c) => c.expires >= now).length;
  return (
    <Reveal delay={delay} as="article" className="card overflow-hidden">
      <div className="stripes grid gap-6 border-b border-line p-6 sm:p-8 md:grid-cols-[150px_minmax(0,1fr)_auto] md:items-start" style={{ "--tone": "var(--accent)" }}>
        <div>
          <div className="display num text-[64px] leading-[0.85] font-medium tracking-[-0.06em]">{pad2(n)}</div>
          <div className="meta mt-3">source</div>
        </div>
        <div className="min-w-0">
          <div className="meta flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-accent">{s.kind}</span>
            <span>{s.published ? fmtDate(s.published) : s.year}</span>
            <span className="normal-case tracking-[0.04em]">{s.author}</span>
          </div>
          <h3 className="mt-3 text-[clamp(20px,2.4vw,28px)] leading-snug font-semibold tracking-[-0.02em]">{s.title}</h3>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="btn shrink-0 self-start px-5 py-3 text-[14px]">
            Watch <ArrowRight className="size-4 -rotate-45" />
          </a>
        )}
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="p-6 sm:p-8">
          <div className="meta mb-4">Principles · {principles.length}{filtered && principles.length !== s.principles.length ? ` of ${s.principles.length}` : ""}</div>
          <ol className="grid gap-4">
            {visible.map((p) => (
              <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                <span className="num pt-0.5 font-mono text-[12px] text-ink-3">{p.id.split(".")[1]}</span>
                <div>
                  <p className="text-[15.5px] leading-relaxed text-ink">{p.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => <span key={t} className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink-3">{t.replaceAll("_", " ")}</span>)}
                  </div>
                </div>
              </li>
            ))}
            {!principles.length && <li className="text-ink-3">No principles match the filter.</li>}
          </ol>
          {visible.length < principles.length && (
            <button type="button" onClick={() => setAll(true)} className="btn mt-5 px-5 py-3 text-[14px]">Show all {principles.length} principles</button>
          )}
        </div>
        <div className="border-t border-line p-6 sm:p-8 lg:border-t-0 lg:border-l">
          <button type="button" onClick={() => setOpen(!open)} className="meta flex min-h-[44px] w-full items-center justify-between gap-3 text-left hover:text-ink" aria-expanded={open}>
            <span>Claims · {claims.length} <span className="text-people">({liveClaims} live)</span></span>
            <span className={`transition-transform duration-500 ${open ? "rotate-90" : ""}`}><ArrowRight className="size-4" /></span>
          </button>
          {!claims.length && <p className="mt-4 text-[14px] text-ink-3">No dated claims in this source.</p>}
          {open && (
            <ul className="mt-4 grid animate-rise gap-3">
              {claims.map((c) => <ClaimRow key={c.id} c={c} />)}
            </ul>
          )}
          {!open && claims.length > 0 && (
            <p className="mt-4 line-clamp-3 text-[14px] text-ink-3">{claims[0].text}</p>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function ClaimRow({ c }) {
  const expired = c.expires < today();
  return (
    <li className={`rounded-2xl border border-line bg-bg/40 p-4 ${expired ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {c.tickers.map((t) => <span key={t} className="font-mono text-[13px] font-medium text-accent">{t}</span>)}
        <span className="meta ml-auto">{c.as_of} → {expired ? "expired" : c.expires}</span>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{c.text}</p>
    </li>
  );
}

function Themes({ principles, tags }) {
  const groups = tags
    .map(([t]) => [t, principles.filter((p) => p.tags.includes(t))])
    .filter(([, list]) => list.length)
    .slice(0, 24);
  if (!groups.length) return <Empty title="Nothing matches">Try another word or clear the theme.</Empty>;
  return (
    <div className="grid gap-12">
      {groups.map(([t, list]) => (
        <section key={t}>
          <Reveal className="mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <h3 className="text-[24px] font-semibold tracking-[-0.03em] capitalize">{t.replaceAll("_", " ")}</h3>
            <span className="meta">{list.length} principles</span>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 40} className="card brackets p-6">
                <span className="meta">{p.id}</span>
                <p className="mt-3 text-[16px] leading-relaxed">{p.text}</p>
                <div className="meta mt-4 truncate border-t border-line pt-3 normal-case tracking-[0.04em]" title={p.source.title}>
                  {p.source.title} · {p.source.published ?? p.source.year}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Claims({ claims, sources }) {
  const [showExpired, setShowExpired] = useState(false);
  const now = today();
  const titles = Object.fromEntries(sources.map((s) => [s.id, s]));
  const live = claims.filter((c) => c.expires >= now);
  const shown = (showExpired ? claims : live).sort((a, b) => b.as_of.localeCompare(a.as_of) || a.id.localeCompare(b.id));
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented label="Show" value={showExpired ? "all" : "live"} onChange={(v) => setShowExpired(v === "all")}
          options={[{ value: "live", label: "Live", count: live.length }, { value: "all", label: "Include expired", count: claims.length }]} />
        <span className="meta">Unverified until code checks them against prices</span>
      </div>
      {!shown.length && <Empty title="No live claims">Include expired to see the history.</Empty>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((o, i) => {
          const expired = o.expires < now;
          return (
            <Reveal key={o.id} delay={(i % 6) * 40} as="article" className={`card flex flex-col p-6 ${expired ? "border-dashed opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="meta">{o.id} · {o.kind}</span>
                <span className={`pill py-1 text-[11px] ${o.status === "confirmed" ? "border-accent/40 text-accent" : o.status === "contradicted" ? "border-down/40 text-down" : "border-dashed border-people/60 text-people"}`}>{o.status}</span>
              </div>
              {o.tickers.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">{o.tickers.map((t) => <span key={t} className="font-mono text-[15px] font-medium text-accent">{t}</span>)}</div>
              )}
              <p className="mt-3 text-[15px] leading-relaxed text-ink">{o.text}</p>
              <div className="meta mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 normal-case tracking-[0.04em] [margin-top:max(1.25rem,auto)]">
                <span className="truncate" title={titles[o.source_id]?.title}>{o.source_id} · {titles[o.source_id]?.title ?? ""}</span>
                <span className="num shrink-0">{o.as_of} → {expired ? "expired" : o.expires}</span>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
