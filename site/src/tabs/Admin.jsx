import { useEffect, useRef, useState } from "react";
import { Markdown, stripFrontMatter } from "../lib/markdown.jsx";
import { cap, pad2 } from "../lib/format.js";
import { useLang, En, EnglishNote } from "../lib/lang.jsx";
import dict from "../i18n/learn.js";
import { Accent, ArrowRight, Chip, Container, Reveal, SectionHead } from "../components/ui.jsx";

const ORDER = ["household", "shelf", "strategy", "guardrails", "methodology", "learnings", "watchlist", "settings", "sources", "people", "outlook", "checklist", "routines", "library", "decisions"];
// Each doc's display name and one-line description are i18n/learn.js "adm.name.<name>" and "adm.about.<name>".

/** A doc's name as shown: its translated name, else the file's name with a capital. */
const docName = (t, name) => (t.has(`adm.name.${name}`) ? t(`adm.name.${name}`) : cap(name));

function stats(doc, data, t, fmt) {
  const c = doc.content;
  const sections = (body) => t("adm.stats.sections", { sections: (body.match(/^## /gm) || []).length, rules: (body.match(/^\s*(-|\d+\.)\s/gm) || []).length });
  switch (doc.name) {
    case "household":
    case "strategy":
    case "methodology":
      return sections(stripFrontMatter(c));
    case "decisions": {
      const body = stripFrontMatter(c);
      const open = body.split("## Open items")[1]?.split("\n## ")[0] ?? "";
      return t("adm.stats.decisions", { open: (open.match(/^- /gm) || []).length, entries: (body.match(/^- \*\*/gm) || []).length });
    }
    case "guardrails": return t("adm.stats.guardrails", { max: c.max_picks, phrases: c.banned_phrases.length, keys: c.forbidden_keys.length });
    case "learnings": return t("adm.stats.learnings", { n: c.items.length, active: c.items.filter((l) => l.status === "active").length });
    case "watchlist": return t("adm.stats.watchlist", { n: c.symbols.length, bench: data.bench.symbol });
    case "settings": return t("adm.stats.settings", { cap: fmt.k(c.pack.token_cap), usd: fmt.usd(c.cost.target_usd), days: c.scoring.horizon_days });
    case "sources": return t("adm.stats.sources", { n: c.sources.length, active: c.sources.filter((s) => s.status === "active").length });
    case "people": return t("adm.stats.people", { people: c.people.length, calls: c.calls.length, findings: c.evidence.length });
    case "outlook": return t("adm.stats.outlook", { n: c.companies.length, dates: c.companies.filter((x) => x.next_earnings?.date).length });
    case "checklist": return t("adm.stats.checklist", { steps: c.steps.length, min: `${c.house_rule.min_reward_to_risk}+`, status: c.status });
    case "routines": return t("adm.stats.routines", { n: c.routines.length, llm: c.routines.filter((r) => r.uses_llm).length });
    case "library": return t("adm.stats.library", { n: c.sources.length, p: c.sources.reduce((a, s) => a + s.principles.length, 0) });
    default: return "";
  }
}

export default function Admin({ data }) {
  const [open, setOpen] = useState(null);
  const docs = ORDER.map((n) => data.docs.find((d) => d.name === n)).filter(Boolean);
  const repo = data.manifest.repo;
  const editUrl = (path) => `https://github.com/${repo}/edit/main/${path}`;
  const { t: tr, fmt } = useLang();
  const t = tr(dict);

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={t("adm.eyebrow")}
        title={<>{t("adm.title.a")} <Accent>{t("adm.title.b")}</Accent></>}
        lede={<>
          <span className="block text-ink">{t("adm.lede1")}</span>
          <span className="mt-3 block">{t("adm.lede2")}</span>
        </>}
      />
      <Reveal className="card flex items-center gap-5 overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-y-0 start-0 w-[3px] bg-accent" />
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </span>
        <div>
          <div className="meta text-ink">{t("adm.how.head")}</div>
          <p className="mt-1 text-[15px] text-ink-2">{t("adm.how.body", { repo })}</p>
        </div>
      </Reveal>

      <div className="mt-16 mb-6 flex items-baseline justify-between gap-4">
        <h3 className="text-[24px] font-semibold tracking-[-0.03em]">{t("adm.docs")} <span className="num ms-1 font-mono text-[13px] font-normal text-ink-3">{pad2(docs.length)}</span></h3>
        <span className="meta hidden sm:inline">{t("adm.docsSub")}</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((d, i) => (
          <Reveal key={d.name} delay={(i % 3) * 80} as="article" className={`card card-hover group flex flex-col p-7 sm:p-8 ${d.name === "library" ? "border-dashed border-people/50" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="meta">{pad2(i + 1)}</span>
              <a href={editUrl(d.path)} target="_blank" rel="noreferrer" className="-my-2 -me-3 inline-flex min-h-[44px] items-center gap-1.5 px-3 text-[14.5px] font-medium text-ink-2 transition hover:text-accent">
                {t("edit")} <ArrowRight className="size-4 transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </a>
            </div>
            <button type="button" onClick={() => setOpen(d)} className="mt-5 text-start">
              <h4 className="text-[26px] font-semibold tracking-[-0.03em] transition group-hover:text-accent">{docName(t, d.name)}</h4>
              {t.has(`adm.about.${d.name}`) && <p className="mt-2 text-[15px] text-ink-2">{t(`adm.about.${d.name}`)}</p>}
              <p className="mt-5 font-mono text-[12px] font-semibold tracking-[0.12em] text-accent uppercase">{stats(d, data, t, fmt)}</p>
            </button>
            <div className="mt-auto flex items-center gap-3 border-t border-line pt-5 text-[14px] [margin-top:max(1.5rem,auto)]">
              <span className="pill py-1 text-[11px] text-ink-2">{t("version", { v: d.version })}</span>
              <span className="text-ink-3">{fmt.rel(d.updated_at)}</span>
              <En as="span" className="min-w-0 flex-1 truncate text-end text-[13px] text-ink-3" title={d.change_note}>{d.change_note}</En>
            </div>
          </Reveal>
        ))}
      </div>

      <Connectors sources={data.sources} editUrl={editUrl("config/sources.json")} />

      {open && <Viewer doc={open} onClose={() => setOpen(null)} editUrl={editUrl(open.path)} />}
    </Container>
  );
}

const KIND_ICON = { prices: "↗", social: "@", news: "≣", filings: "▤", library: "❏", people: "◎", other: "•" };

function Connectors({ sources, editUrl }) {
  const t = useLang().t(dict);
  return (
    <section className="pt-32">
      <SectionHead
        eyebrow={t("adm.feeds.eyebrow")}
        title={<>{t("dataFeeds.title.a")} <Accent>{t("dataFeeds.title.b")}</Accent></>}
        lede={t("adm.feeds.lede")}
        size="md"
        right={<a href={editUrl} target="_blank" rel="noreferrer" className="btn">{t("adm.feeds.edit")} <ArrowRight /></a>}
      />
      <EnglishNote />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.sources.map((s, i) => (
          <Reveal key={s.id} delay={(i % 3) * 70} className={`card p-7 ${s.status === "planned" ? "border-dashed" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl border border-line-2 font-mono text-[18px] text-ink-2">{KIND_ICON[s.kind] ?? KIND_ICON.other}</span>
              <Chip kind={s.status} icon={false}>{t.has(`adm.status.${s.status}`) ? t(`adm.status.${s.status}`) : s.status}</Chip>
            </div>
            <En as="h4" className="mt-5 text-[20px] font-semibold tracking-[-0.02em]">{s.label}</En>
            <En as="p" className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.note}</En>
            <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 border-t border-line pt-5 text-[13px]">
              <dt className="meta">{t("adm.dl.company")}</dt><dd className={s.provider ? "font-mono" : "text-people"}>{s.provider ? <bdi>{s.provider}</bdi> : t("adm.dl.notChosen")}</dd>
              <dt className="meta">{t("adm.dl.often")}</dt><dd><En as="span">{s.cadence}</En></dd>
              <dt className="meta">{t("adm.dl.feeds")}</dt><dd dir="ltr" className="truncate text-start font-mono text-[12px]">{s.feeds.join(", ")}</dd>
              <dt className="meta">{t("adm.dl.secret")}</dt><dd className="font-mono text-[12px]">{s.secret_env ? <bdi>{s.secret_env}</bdi> : t("adm.dl.none")}</dd>
              {s.kind === "social" && (<><dt className="meta">{t("adm.dl.following")}</dt><dd>{s.follow.length ? <bdi dir="ltr">{s.follow.join(" ")}</bdi> : t("adm.dl.nobody")}</dd></>)}
            </dl>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Viewer({ doc, onClose, editUrl }) {
  const { t: tr, dir } = useLang();
  const t = tr(dict);
  const panel = useRef(null);
  const [raw, setRaw] = useState(false);
  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [onClose]);
  const isMd = typeof doc.content === "string";
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label={t("close")} onClick={onClose} className="absolute inset-0 animate-[rise_400ms_ease-out_both] bg-black/50 backdrop-blur-sm" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={docName(t, doc.name)}
        className="relative flex h-full w-full max-w-[760px] flex-col border-s border-line bg-surface shadow-2xl outline-none"
        style={{ animation: "slide-in 650ms cubic-bezier(.16,1,.3,1) both" }}
      >
        <style>{`@keyframes slide-in{from{transform:translateX(${dir === "rtl" ? -40 : 40}px);opacity:0}}`}</style>
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <div className="meta truncate"><bdi>{doc.path}</bdi> · {t("version", { v: doc.version })} · <bdi>{doc.updated_at}</bdi></div>
            <h3 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">{docName(t, doc.name)}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isMd && <button type="button" onClick={() => setRaw(!raw)} className="pill text-ink-2">{raw ? t("adm.view.formatted") : t("adm.view.json")}</button>}
            <a href={editUrl} target="_blank" rel="noreferrer" className="pill border-accent/40 text-accent">{t("edit")}</a>
            <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-10 place-items-center rounded-full border border-line-2 hover:border-ink-3">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <p className="mb-6 rounded-xl border border-line bg-bg/40 px-4 py-3 text-[14px] text-ink-2"><span className="meta me-2 text-ink">{t("adm.changeNote")}</span><En as="span">{doc.change_note}</En></p>
          <EnglishNote />
          <En>
            {isMd ? <Markdown source={doc.content} /> : raw ? (
              <pre className="overflow-x-auto rounded-xl bg-bg/60 p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">{JSON.stringify(doc.content, null, 2)}</pre>
            ) : (
              <JsonView value={doc.content} />
            )}
          </En>
        </div>
      </div>
    </div>
  );
}

const SKIP = new Set(["version", "updated_at", "change_note"]);

function JsonView({ value, depth = 0 }) {
  const t = useLang().t(dict);
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-ink-3">{t("adm.json.none")}</span>;
    if (value.every((v) => typeof v !== "object" || v === null))
      return <div className="flex flex-wrap gap-1.5">{value.map((v, i) => <span key={i} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[12px]">{String(v)}</span>)}</div>;
    return <div className="grid gap-3">{value.map((v, i) => <div key={i} className="rounded-2xl border border-line p-4"><JsonView value={v} depth={depth + 1} /></div>)}</div>;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([k]) => depth > 0 || !SKIP.has(k));
    return (
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(120px,auto)_minmax(0,1fr)]">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="meta pt-1">{k.replaceAll("_", " ")}</dt>
            <dd className="min-w-0 text-[14.5px]"><JsonView value={v} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  if (value === null) return <span className="text-people">{t("adm.json.notSet")}</span>;
  if (typeof value === "boolean") return <span className={value ? "text-accent" : "text-ink-3"}>{t(value ? "adm.json.yes" : "adm.json.no")}</span>;
  return <span className={typeof value === "number" ? "num font-mono" : ""}>{String(value)}</span>;
}
