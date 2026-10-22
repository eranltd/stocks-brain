import { useMemo, useState } from "react";
import { pad2, fmtDate } from "../lib/format.js";
import dict from "../text/learn.js";
import { Accent, ArrowRight, Container, Empty, Reveal, SectionHead, Segmented, Strip } from "../components/ui.jsx";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

const today = () => new Date().toISOString().slice(0, 10);
/** A theme tag from the library, as words ("risk_management" -> "risk management"). */
const tagWords = (tag) => tag.replaceAll("_", " ");
const t = strings(dict);

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
        eyebrow={t("ins.eyebrow", { v: data.library?.version ?? "–" })}
        title={<>{t("ins.title.a")} <Accent>{t("ins.title.b")}</Accent></>}
        lede={<>
          <span className="block text-ink">{t("ins.lede1")}</span>
          <span className="mt-3 block">{rich(t, "ins.lede2", { principle: <span className="text-ink">{t("ins.word.principle")}</span>, claim: <span className="text-ink">{t("ins.word.claim")}</span> })}</span>
        </>}
      />
      <Strip
        cells={[
          { value: sources.length, label: t("ins.s.sources"), desc: t("ins.s.sourcesDesc") },
          { value: principles.length, label: t("ins.s.principles"), desc: t("ins.s.principlesDesc") },
          { value: live, label: t("ins.s.live"), tone: "people", dashed: true, desc: t("ins.s.liveDesc", { n: claims.length - live }) },
          { value: tags.length, label: t("ins.s.themes"), tone: "flat", desc: t("ins.s.themesDesc", { list: tags.slice(0, 3).map(([x]) => tagWords(x)).join(", ") }) },
        ]}
      />

      <Reveal className="mt-10 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex items-center gap-3 rounded-full border border-line-2 bg-surface px-5 py-3.5 focus-within:border-accent">
          <svg viewBox="0 0 24 24" className="size-[18px] text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ins.search")}
            aria-label={t("ins.searchLabel")} className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
        </label>
        <Segmented label={t("ins.view")} value={view} onChange={setView}
          options={[{ value: "sources", label: t("ins.view.sources"), count: sources.length }, { value: "themes", label: t("ins.view.themes"), count: tags.length }, { value: "claims", label: t("ins.view.claims"), count: claims.length }]} />
      </Reveal>

      <Reveal delay={80} className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setTag(null)} className={`pill shrink-0 py-2.5 ${!tag ? "border-transparent bg-ink text-bg" : "text-ink-2"}`}>{t("ins.allThemes")}</button>
        {tags.map(([x, n]) => (
          <button key={x} type="button" onClick={() => setTag(x === tag ? null : x)}
            className={`pill shrink-0 py-2.5 ${x === tag ? "border-transparent bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}>
            <span>{tagWords(x)}</span> <span className="num opacity-60">{n}</span>
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
          ) : <Empty title={t("nothing.title")}>{t("ins.empty")}</Empty>
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
          <div className="display num text-[64px] leading-[0.85] font-medium">{pad2(n)}</div>
          <div className="meta mt-3">{t("ins.source")}</div>
        </div>
        <div className="min-w-0">
          <div className="meta flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-accent">{t.has(`ins.kind.${s.kind}`) ? t(`ins.kind.${s.kind}`) : s.kind}</span>
            <span>{s.published ? fmtDate(s.published) : s.year}</span>
            <span className="normal-case tracking-[0.04em]">{s.author}</span>
          </div>
          <h3 className="mt-3 text-[clamp(20px,2.4vw,28px)] leading-snug font-semibold tracking-[-0.02em]">{s.title}</h3>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="btn shrink-0 self-start px-5 py-3 text-[14px]">
            {t("ins.watch")} <ArrowRight className="size-4 -rotate-45" />
          </a>
        )}
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="p-6 sm:p-8">
          <div className="meta mb-4">{filtered && principles.length !== s.principles.length ? t("ins.principlesOf", { n: principles.length, total: s.principles.length }) : t("ins.principlesHead", { n: principles.length })}</div>
          <ol className="grid gap-4">
            {visible.map((p) => (
              <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                <span className="num pt-0.5 font-mono text-[12px] text-ink-3">{p.id.split(".")[1]}</span>
                <div>
                  <p className="text-[15.5px] leading-relaxed text-ink">{p.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((x) => <span key={x} className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink-3">{tagWords(x)}</span>)}
                  </div>
                </div>
              </li>
            ))}
            {!principles.length && <li className="text-ink-3">{t("ins.noMatch")}</li>}
          </ol>
          {visible.length < principles.length && (
            <button type="button" onClick={() => setAll(true)} className="btn mt-5 px-5 py-3 text-[14px]">{t("ins.showAll", { n: principles.length })}</button>
          )}
        </div>
        <div className="border-t border-line p-6 sm:p-8 lg:border-t-0 lg:border-s">
          <button type="button" onClick={() => setOpen(!open)} className="meta flex min-h-[44px] w-full items-center justify-between gap-3 text-start hover:text-ink" aria-expanded={open}>
            <span>{t("ins.dated", { n: claims.length })} <span className="text-people">{t("ins.stillInDate", { n: liveClaims })}</span></span>
            <span className={`transition-transform duration-500 ${open ? "rotate-90" : ""}`}><ArrowRight className="size-4" /></span>
          </button>
          {!claims.length && <p className="mt-4 text-[14px] text-ink-3">{t("ins.noClaims")}</p>}
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
        {c.tickers.map((x) => <span key={x} className="font-mono text-[13px] font-medium text-accent">{x}</span>)}
        <span className="meta ms-auto"><span>{c.as_of} → {expired ? t("ins.expired") : c.expires}</span></span>
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
  if (!groups.length) return <Empty title={t("nothing.title")}>{t("ins.empty")}</Empty>;
  return (
    <div className="grid gap-12">
      {groups.map(([x, list]) => (
        <section key={x}>
          <Reveal className="mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <h3 className="text-[24px] font-semibold tracking-[-0.03em] capitalize">{tagWords(x)}</h3>
            <span className="meta">{t("ins.themeCount", { count: list.length })}</span>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 40} className="card brackets p-6">
                <span className="meta">{p.id}</span>
                <p className="mt-3 text-[16px] leading-relaxed">{p.text}</p>
                <div className="meta mt-4 truncate border-t border-line pt-3 text-start normal-case tracking-[0.04em]" title={p.source.title}>
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
        <Segmented label={t("ins.show")} value={showExpired ? "all" : "live"} onChange={(v) => setShowExpired(v === "all")}
          options={[{ value: "live", label: t("ins.live"), count: live.length }, { value: "all", label: t("ins.all"), count: claims.length }]} />
        <span className="meta">{t("ins.notProven")}</span>
      </div>
      {!shown.length && <Empty title={t("ins.noLive.title")}>{t("ins.noLive.body")}</Empty>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((o, i) => {
          const expired = o.expires < now;
          return (
            <Reveal key={o.id} delay={(i % 6) * 40} as="article" className={`card flex flex-col p-6 ${expired ? "border-dashed opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="meta"><span>{o.id}</span> · <span>{o.kind}</span></span>
                <span className={`pill py-1 text-[11px] ${o.status === "confirmed" ? "border-accent/40 text-accent" : o.status === "contradicted" ? "border-down/40 text-down" : "border-dashed border-people/60 text-people"}`}>{t.has(`ins.status.${o.status}`) ? t(`ins.status.${o.status}`) : o.status}</span>
              </div>
              {o.tickers.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">{o.tickers.map((x) => <span key={x} className="font-mono text-[15px] font-medium text-accent">{x}</span>)}</div>
              )}
              <p className="mt-3 text-[15px] leading-relaxed text-ink">{o.text}</p>
              <div className="meta mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 normal-case tracking-[0.04em] [margin-top:max(1.25rem,auto)]">
                <span className="truncate" title={titles[o.source_id]?.title}>{o.source_id} · {titles[o.source_id]?.title ?? ""}</span>
                <span className="num shrink-0"><span>{o.as_of} → {expired ? t("ins.expired") : o.expires}</span></span>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
