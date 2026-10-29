import { useMemo, useState } from "react";
import { fmtShort } from "../lib/format.js";
import dict from "../text/learn.js";
import { Chip, Container, EmptyState, Panel, SectionTitle, Segmented, StatTile } from "../components/ui.jsx";
import { FilterChips, PageHero, ReadMore, SearchBox, TipText } from "../lib/learnkit.jsx";
import { strings } from "../lib/text.js";

/*
 * Lessons: what the videos have taught, as a tile grid. Search, a view switch (sources, themes, dated guesses) and
 * theme chips; each source is a tile with its first lesson and the rest behind "All lessons". Dated guesses carry their
 * dates and a status; they prove nothing until code checks them.
 */

const t = strings(dict);
const today = () => new Date().toISOString().slice(0, 10);
/** A theme tag from the library, as words ("risk_management" -> "risk management"). */
const tagWords = (tag) => tag.replaceAll("_", " ");
const PAGE = 12;
const STATUS_TONE = { confirmed: "up", contradicted: "down" };

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
  const [limit, setLimit] = useState(PAGE);
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
    for (const p of principles) for (const x of p.tags) count[x] = (count[x] || 0) + 1;
    return Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [principles]);

  const needle = q.trim().toLowerCase();
  const matchP = (p) => (!tag || p.tags.includes(tag)) && (!needle || [p.text, p.id, p.source.title, ...p.tags].join(" ").toLowerCase().includes(needle));
  const matchC = (c) => (!tag || c.tags.includes(tag)) && (!needle || [c.text, c.id, ...c.tickers, ...c.tags].join(" ").toLowerCase().includes(needle));
  const live = claims.filter((c) => c.expires >= now).length;
  const filtered = Boolean(needle || tag);
  const shownSources = sources.filter((s) => !filtered || s.principles.some((p) => matchP({ ...p, source: s })) || (claimsBySource[s.id] ?? []).some(matchC));
  const num = Object.fromEntries([...sources].reverse().map((s, i) => [s.id, i + 1]));

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("ins.hero1")} line2={t("ins.hero2")} sub={t("ins.sub", { sources: sources.length, principles: principles.length })}
        info={<TipText lead={t("ins.about.lead")} more={t("ins.about.more")} />}
        chips={<Chip tone="neutral"><span className="text-ink-2">{t("ins.version", { v: data.library?.version ?? "–" })}</span></Chip>} />

      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatTile label={t("ins.s.sources")} value={sources.length} sub={t("ins.s.sourcesSub")} />
        <StatTile label={t("ins.s.principles")} value={principles.length} sub={t("ins.s.principlesSub")} tone="flat" />
        <StatTile label={t("ins.s.live")} value={<span className={live ? "text-wait" : ""}>{live}</span>} sub={t("ins.s.liveSub", { n: claims.length - live })} tone="flat" />
        <StatTile label={t("ins.s.themes")} value={tags.length} sub={tags.slice(0, 2).map(([x]) => tagWords(x)).join(" · ")} tone="flat" bars={tags.slice(0, 12).map(([, n]) => n)} barsHi={0} />
      </div>

      <Panel id="ins-lessons" className="mt-4 md:mt-8" title={t(`ins.view.${view}`)}
        badge={<Segmented label={t("ins.view")} value={view} onChange={(v) => { setView(v); setLimit(PAGE); }}
          options={["sources", "themes", "claims"].map((v) => ({ value: v, label: t(`ins.view.${v}`) }))} />}>
        <div className="grid gap-2.5">
          <SearchBox value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} placeholder={t("ins.search")} label={t("ins.searchLabel")} />
          <FilterChips label={t("ins.themeLabel")} value={tag} onChange={(v) => { setTag(v === tag ? null : v); setLimit(PAGE); }}
            options={[{ value: null, label: t("ins.allThemes"), count: principles.length }, ...tags.slice(0, 30).map(([x, n]) => ({ value: x, label: tagWords(x), count: n }))]} />
        </div>

        <div className="mt-4">
          {view === "sources" && (shownSources.length ? (
            <>
              <div className="grid gap-2.5 md:grid-cols-2 md:items-start xl:grid-cols-3">
                {shownSources.slice(0, limit).map((s) => (
                  <SourceTile key={s.id} s={s} n={num[s.id]} principles={s.principles.filter((p) => matchP({ ...p, source: s }))}
                    claims={(claimsBySource[s.id] ?? []).filter(matchC)} now={now} />
                ))}
              </div>
              {shownSources.length > limit && <MoreButton onClick={() => setLimit((l) => l + PAGE)} left={shownSources.length - limit} />}
            </>
          ) : <EmptyState compact title={t("nothing.title")}>{t("ins.empty")}</EmptyState>)}
          {view === "themes" && <Themes principles={principles.filter(matchP)} tags={tag ? [[tag]] : tags} />}
          {view === "claims" && <Claims claims={claims.filter(matchC)} sources={library} now={now} />}
        </div>
      </Panel>
    </Container>
  );
}

function MoreButton({ onClick, left }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-3 min-h-[44px] w-full rounded-tile border border-line-2 font-display text-[14px] font-bold tracking-[0.12em] text-ink-2 uppercase hover:text-ink">
      {t("ins.more")} · {left}
    </button>
  );
}

function SourceTile({ s, n, principles, claims, now }) {
  const url = youtubeUrl(s.ref);
  const liveN = claims.filter((c) => c.expires >= now).length;
  const [first, ...rest] = principles;
  return (
    <article className="tile flex min-w-0 flex-col p-3.5">
      <div className="flex items-center gap-2">
        <span className="font-num text-[22px] leading-none font-bold text-ink-3">{String(n).padStart(2, "0")}</span>
        <Chip tone="brand" className="min-h-[22px] px-1.5 text-[10px]">{t.has(`ins.kind.${s.kind}`) ? t(`ins.kind.${s.kind}`) : s.kind}</Chip>
        <span className="font-num ms-auto text-[11px] text-ink-3">{s.published ? fmtShort(s.published) : s.year}</span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[15px] leading-snug font-semibold text-ink">{s.title}</h3>
      {first && <p className="mt-2.5 line-clamp-4 border-s-2 border-desk/60 ps-3 text-[13.5px] leading-snug text-ink-2">{first.text}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip tone="neutral" className="min-h-[22px] px-1.5 text-[10px]">{t("ins.lessons", { count: principles.length })}</Chip>
        {claims.length > 0 && <Chip tone={liveN ? "wait" : "ghost"} className="min-h-[22px] px-1.5 text-[10px]">{t("ins.liveN", { n: liveN })}</Chip>}
        {url && <a href={url} target="_blank" rel="noreferrer" className="chip ms-auto min-h-[30px] border-line-2 text-ink-2 hover:text-desk">{t("ins.watch")} <span aria-hidden="true">↗</span></a>}
      </div>
      {(rest.length > 0 || claims.length > 0) && (
        <ReadMore label={t("ins.allLessons")} className="mt-1">
          <ol className="grid gap-2 pb-1">
            {rest.map((p) => (
              <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
                <span className="font-num pt-0.5 text-[10.5px] text-ink-3">{p.id.split(".")[1]}</span>
                <span className="text-[13.5px] leading-snug text-ink-2">{p.text}</span>
              </li>
            ))}
          </ol>
          {claims.length > 0 && (
            <>
              <p className="micro mt-3 mb-1.5">{t("ins.guessesHead")}</p>
              <ul className="grid gap-1.5">{claims.map((c) => <ClaimRow key={c.id} c={c} now={now} />)}</ul>
            </>
          )}
        </ReadMore>
      )}
    </article>
  );
}

function ClaimRow({ c, now }) {
  const expired = c.expires < now;
  return (
    <li className={`rounded-[8px] border border-line px-3 py-2 ${expired ? "opacity-60" : ""}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {c.tickers.map((x) => <span key={x} className="font-num text-[12px] font-bold text-desk">{x}</span>)}
        <span className="font-num ms-auto text-[10.5px] text-ink-3">{fmtShort(c.as_of)} → {expired ? t("ins.expired") : fmtShort(c.expires)}</span>
      </p>
      <p className="mt-1 text-[13px] leading-snug text-ink-2">{c.text}</p>
    </li>
  );
}

function Themes({ principles, tags }) {
  const groups = tags.map(([x]) => [x, principles.filter((p) => p.tags.includes(x))]).filter(([, list]) => list.length).slice(0, 24);
  if (!groups.length) return <EmptyState compact title={t("nothing.title")}>{t("ins.empty")}</EmptyState>;
  return (
    <div className="grid gap-6">
      {groups.map(([x, list]) => (
        <section key={x}>
          <SectionTitle title={<span className="capitalize">{tagWords(x)}</span>} size="xs" right={<span className="font-num text-[11.5px] font-bold text-ink-3">{t("ins.lessons", { count: list.length })}</span>} className="border-b border-line pb-2" />
          <div className="mt-2.5 grid gap-2 md:grid-cols-2 md:items-start xl:grid-cols-3">
            {list.slice(0, 9).map((p) => (
              <div key={p.id} className="tile p-3">
                <p className="text-[13.5px] leading-snug text-ink">{p.text}</p>
                <p className="micro mt-2 truncate normal-case tracking-[0.04em]" title={p.source.title}>{p.id} · {p.source.title}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Claims({ claims, sources, now }) {
  const [all, setAll] = useState(false);
  const titles = Object.fromEntries(sources.map((s) => [s.id, s]));
  const live = claims.filter((c) => c.expires >= now);
  const shown = [...(all ? claims : live)].sort((a, b) => b.as_of.localeCompare(a.as_of) || a.id.localeCompare(b.id));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterChips label={t("ins.show")} value={all ? "all" : "live"} onChange={(v) => setAll(v === "all")}
          options={[{ value: "live", label: t("ins.live"), count: live.length }, { value: "all", label: t("ins.all"), count: claims.length }]} />
        <span className="micro">{t("ins.notProven")}</span>
      </div>
      {!shown.length ? <EmptyState compact title={t("ins.noLive.title")}>{t("ins.noLive.body")}</EmptyState> : (
        <div className="grid gap-2 md:grid-cols-2 md:items-start xl:grid-cols-3">
          {shown.map((o) => {
            const expired = o.expires < now;
            return (
              <article key={o.id} className={`tile flex flex-col p-3 ${expired ? "border-dashed opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="font-num text-[10.5px] text-ink-3">{o.id}</span>
                  {o.tickers.map((x) => <span key={x} className="font-num text-[12.5px] font-bold text-desk">{x}</span>)}
                  <Chip tone={STATUS_TONE[o.status] ?? "ghost"} className="ms-auto min-h-[22px] px-1.5 text-[10px]">{t.has(`ins.status.${o.status}`) ? t(`ins.status.${o.status}`) : o.status}</Chip>
                </div>
                <p className="mt-2 text-[13.5px] leading-snug text-ink">{o.text}</p>
                <p className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px] text-ink-3">
                  <span className="min-w-0 truncate" title={titles[o.source_id]?.title}>{o.source_id} · {titles[o.source_id]?.title ?? ""}</span>
                  <span className="font-num shrink-0">{fmtShort(o.as_of)} → {expired ? t("ins.expired") : fmtShort(o.expires)}</span>
                </p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
