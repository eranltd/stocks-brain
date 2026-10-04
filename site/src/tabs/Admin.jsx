import { useEffect, useRef, useState } from "react";
import { Markdown, stripFrontMatter } from "../lib/markdown.jsx";
import { cap, fmtK, fmtUsd, pad2, relDays } from "../lib/format.js";
import { Accent, ArrowRight, Chip, Container, Reveal, SectionHead } from "../components/ui.jsx";

const ORDER = ["strategy", "guardrails", "methodology", "learnings", "watchlist", "settings", "sources", "routines", "library", "decisions"];
const ABOUT = {
  strategy: "What a pick is, and what the brain looks for.",
  guardrails: "The lines a pick never crosses.",
  methodology: "How a run flows and how picks are scored.",
  learnings: "What scored picks taught, with evidence.",
  watchlist: "The names the brain may pick from.",
  settings: "Caps, costs, horizon and benchmark.",
  sources: "Where data comes from: the connectors.",
  routines: "The schedule: what runs when, and what it may spend.",
  library: "Principles from books and lectures.",
  decisions: "Every decision and why, plus what is still open.",
};

function stats(doc, data) {
  const c = doc.content;
  switch (doc.name) {
    case "decisions": {
      const body = stripFrontMatter(c);
      const open = body.split("## Open items")[1]?.split("\n## ")[0] ?? "";
      return `${(open.match(/^- /gm) || []).length} open items · ${(body.match(/^- \*\*/gm) || []).length} entries`;
    }
    case "strategy":
    case "methodology": {
      const body = stripFrontMatter(c);
      const sections = (body.match(/^## /gm) || []).length;
      const items = (body.match(/^\s*(-|\d+\.)\s/gm) || []).length;
      return `${sections} sections · ${items} rules`;
    }
    case "guardrails": return `max ${c.max_picks} picks · ${c.banned_phrases.length} banned phrases · ${c.forbidden_keys.length} forbidden keys`;
    case "learnings": return `${c.items.length} lessons · ${c.items.filter((l) => l.status === "active").length} active`;
    case "watchlist": return `${c.symbols.length} symbols · bench ${data.bench.symbol}`;
    case "settings": return `pack ${fmtK(c.pack.token_cap)} · target ${fmtUsd(c.cost.target_usd)} · ${c.scoring.horizon_days}d horizon`;
    case "sources": return `${c.sources.length} connectors · ${c.sources.filter((s) => s.status === "active").length} active`;
    case "routines": return `${c.routines.length} routines · ${c.routines.filter((r) => r.uses_llm).length} use the model`;
    case "library": return `${c.sources.length} sources · ${c.sources.reduce((a, s) => a + s.principles.length, 0)} principles`;
    default: return "";
  }
}

export default function Admin({ data }) {
  const [open, setOpen] = useState(null);
  const docs = ORDER.map((n) => data.docs.find((d) => d.name === n)).filter(Boolean);
  const repo = data.manifest.repo;
  const editUrl = (path) => `https://github.com/${repo}/edit/main/${path}`;

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow="Admin"
        title={<>Edit the <Accent>rule book.</Accent></>}
        lede="Everything the brain reads lives in versioned files. Open a doc to read it, or edit it on GitHub. Every edit is a pull request: lint checks it, and git keeps the old version so any change can be undone."
      />
      <Reveal className="card flex items-center gap-5 overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </span>
        <div>
          <div className="meta text-ink">Edit mode · pull requests</div>
          <p className="mt-1 text-[15px] text-ink-2">This page is public and read-only. Edits go through {repo} on GitHub; no secrets, keys or holdings ever live in the repo.</p>
        </div>
      </Reveal>

      <div className="mt-16 mb-6 flex items-baseline justify-between gap-4">
        <h3 className="text-[24px] font-semibold tracking-[-0.03em]">The docs <span className="num ml-1 font-mono text-[13px] font-normal text-ink-3">{pad2(docs.length)}</span></h3>
        <span className="meta hidden sm:inline">What the brain reads</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((d, i) => (
          <Reveal key={d.name} delay={(i % 3) * 80} as="article" className={`card card-hover group flex flex-col p-7 sm:p-8 ${d.name === "library" ? "border-dashed border-people/50" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="meta">{pad2(i + 1)}</span>
              <a href={editUrl(d.path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[14.5px] font-medium text-ink-2 transition hover:text-accent">
                Edit <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </a>
            </div>
            <button type="button" onClick={() => setOpen(d)} className="mt-5 text-left">
              <h4 className="text-[26px] font-semibold tracking-[-0.03em] transition group-hover:text-accent">{cap(d.name)}</h4>
              <p className="mt-2 text-[15px] text-ink-2">{ABOUT[d.name]}</p>
              <p className="mt-5 font-mono text-[12px] font-semibold tracking-[0.12em] text-accent uppercase">{stats(d, data)}</p>
            </button>
            <div className="mt-auto flex items-center gap-3 border-t border-line pt-5 text-[14px] [margin-top:max(1.5rem,auto)]">
              <span className="pill py-1 text-[11px] text-ink-2">v{d.version}</span>
              <span className="text-ink-3">{relDays(d.updated_at)}</span>
              <span className="min-w-0 flex-1 truncate text-right text-[13px] text-ink-3" title={d.change_note}>{d.change_note}</span>
            </div>
          </Reveal>
        ))}
      </div>

      <Connectors sources={data.sources} editUrl={editUrl("config/sources.json")} />

      {open && <Viewer doc={open} onClose={() => setOpen(null)} editUrl={editUrl(open.path)} />}
    </Container>
  );
}

const KIND_ICON = { prices: "↗", social: "@", news: "≣", filings: "▤", library: "❏", other: "•" };

function Connectors({ sources, editUrl }) {
  return (
    <section className="pt-32">
      <SectionHead
        eyebrow="Connectors"
        title={<>Where the data <Accent>comes from.</Accent></>}
        lede="Every source is declared in config/sources.json. A connector names the secret it needs by environment variable only. Values live in GitHub Actions secrets, never in this public repo."
        size="md"
        right={<a href={editUrl} target="_blank" rel="noreferrer" className="btn">Edit sources <ArrowRight /></a>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.sources.map((s, i) => (
          <Reveal key={s.id} delay={(i % 3) * 70} className={`card p-7 ${s.status === "planned" ? "border-dashed" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl border border-line-2 font-mono text-[18px] text-ink-2">{KIND_ICON[s.kind]}</span>
              <Chip kind={s.status} icon={false}>{s.status}</Chip>
            </div>
            <h4 className="mt-5 text-[20px] font-semibold tracking-[-0.02em]">{s.label}</h4>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.note}</p>
            <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 border-t border-line pt-5 text-[13px]">
              <dt className="meta">provider</dt><dd className={s.provider ? "font-mono" : "text-people"}>{s.provider ?? "not chosen yet"}</dd>
              <dt className="meta">cadence</dt><dd>{s.cadence}</dd>
              <dt className="meta">feeds</dt><dd className="truncate font-mono text-[12px]">{s.feeds.join(", ")}</dd>
              <dt className="meta">secret</dt><dd className="font-mono text-[12px]">{s.secret_env ?? "none"}</dd>
              {s.kind === "social" && (<><dt className="meta">following</dt><dd>{s.follow.length ? s.follow.join(" ") : "nobody yet"}</dd></>)}
            </dl>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Viewer({ doc, onClose, editUrl }) {
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
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 animate-[rise_400ms_ease-out_both] bg-black/50 backdrop-blur-sm" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={doc.name}
        className="relative flex h-full w-full max-w-[760px] flex-col border-l border-line bg-surface shadow-2xl outline-none"
        style={{ animation: "slide-in 650ms cubic-bezier(.16,1,.3,1) both" }}
      >
        <style>{"@keyframes slide-in{from{transform:translateX(40px);opacity:0}}"}</style>
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <div className="meta truncate">{doc.path} · v{doc.version} · {doc.updated_at}</div>
            <h3 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">{cap(doc.name)}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isMd && <button type="button" onClick={() => setRaw(!raw)} className="pill text-ink-2">{raw ? "Formatted" : "JSON"}</button>}
            <a href={editUrl} target="_blank" rel="noreferrer" className="pill border-accent/40 text-accent">Edit</a>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line-2 hover:border-ink-3">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <p className="mb-6 rounded-xl border border-line bg-bg/40 px-4 py-3 text-[14px] text-ink-2"><span className="meta mr-2 text-ink">change note</span>{doc.change_note}</p>
          {isMd ? <Markdown source={doc.content} /> : raw ? (
            <pre className="overflow-x-auto rounded-xl bg-bg/60 p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">{JSON.stringify(doc.content, null, 2)}</pre>
          ) : (
            <JsonView value={doc.content} />
          )}
        </div>
      </div>
    </div>
  );
}

const SKIP = new Set(["version", "updated_at", "change_note"]);

function JsonView({ value, depth = 0 }) {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-ink-3">none</span>;
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
  if (value === null) return <span className="text-people">not set</span>;
  if (typeof value === "boolean") return <span className={value ? "text-accent" : "text-ink-3"}>{value ? "yes" : "no"}</span>;
  return <span className={typeof value === "number" ? "num font-mono" : ""}>{String(value)}</span>;
}
