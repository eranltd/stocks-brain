import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Markdown, stripFrontMatter } from "../lib/markdown.jsx";
import { cap, fmtUsd, fmtK, relDays } from "../lib/format.js";
import dict from "../text/learn.js";
import { Chip, Container, DataTable, Panel, Segmented, SkeletonRows, StepMark } from "../components/ui.jsx";
import { PageHero, TipText } from "../lib/learnkit.jsx";
import { strings } from "../lib/text.js";

/*
 * Admin: the rule book as an ops console. Every file the brain reads, in one table (tap a row to read it in a side
 * sheet, formatted or as JSON; the edit link opens it on GitHub), and every data feed with its status. The page is
 * read-only: changes go through pull requests.
 */

const ORDER = ["household", "shelf", "strategy", "guardrails", "methodology", "learnings", "watchlist", "settings", "sources", "people", "outlook", "checklist", "routines", "library", "decisions"];
// Each doc's display name and one-line description are text/learn.js "adm.name.<name>" and "adm.about.<name>".
const t = strings(dict);
const STATUS_STEP = { active: "done", planned: "wait", disabled: "fail" };
const STATUS_TONE = { active: "up", planned: "ghost", disabled: "down" };

/** A doc's name as shown: its plain name (text/learn.js), else the file's name with a capital. */
const docName = (name) => (t.has(`adm.name.${name}`) ? t(`adm.name.${name}`) : cap(name));
const word = (prefix, v) => (t.has(`${prefix}.${v}`) ? t(`${prefix}.${v}`) : v);

function stats(doc, data) {
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
    case "settings": return t("adm.stats.settings", { cap: fmtK(c.pack.token_cap), usd: fmtUsd(c.cost.target_usd), days: c.scoring.horizon_days });
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
  const [feed, setFeed] = useState(null);
  const docs = ORDER.map((n) => data.docs.find((d) => d.name === n)).filter(Boolean);
  const repo = data.manifest.repo;
  const editUrl = (path) => `https://github.com/${repo}/edit/main/${path}`;
  const sources = data.sources.sources;
  const live = sources.filter((s) => s.status === "active").length;

  const docCols = [
    { key: "name", label: t("adm.th.file"), sortable: true, firstDir: "asc", sortValue: (d) => docName(d.name), cell: (d) => (
      <span className="block min-w-0 py-1.5">
        <span className="block max-w-[150px] truncate text-[14px] font-semibold text-ink sm:max-w-[240px]">{docName(d.name)}</span>
        <span className="block max-w-[150px] truncate text-[11.5px] leading-snug text-ink-3 sm:max-w-[240px]">{t.has(`adm.about.${d.name}`) ? t(`adm.about.${d.name}`) : d.path}</span>
      </span>
    ) },
    { key: "version", label: t("adm.th.version"), align: "start", cell: (d) => <Chip tone="neutral" className="min-h-[22px] px-1.5 text-[10.5px]">{t("version", { v: d.version })}</Chip> },
    { key: "updated_at", label: t("adm.th.updated"), sortable: true, align: "start", className: "font-num text-[12px] text-ink-2 whitespace-nowrap", cell: (d) => relDays(d.updated_at) },
    { key: "inside", label: t("adm.th.inside"), align: "start", className: "font-num text-[11px] text-desk whitespace-nowrap uppercase tracking-[0.06em]", cell: (d) => stats(d, data) },
    { key: "note", label: t("adm.th.note"), align: "start", cell: (d) => <span className="block max-w-[280px] truncate text-[12.5px] text-ink-3" title={d.change_note}>{d.change_note}</span> },
    { key: "edit", label: t("adm.th.edit"), cell: (d) => (
      <a href={editUrl(d.path)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        className="inline-flex min-h-[44px] items-center gap-1 font-display text-[13px] font-bold tracking-[0.1em] text-ink-2 uppercase hover:text-desk">{t("edit")} <span aria-hidden="true">↗</span></a>
    ) },
  ];
  const feedCols = [
    { key: "label", label: t("adm.th.feed"), sortable: true, firstDir: "asc", cell: (s) => (
      <span className="block min-w-0 py-1.5">
        <span className="block max-w-[150px] truncate text-[14px] font-semibold text-ink sm:max-w-[240px]">{s.label}</span>
        <span className="font-num block text-[10.5px] text-ink-3">{s.kind}</span>
      </span>
    ) },
    { key: "status", label: t("adm.th.status"), sortable: true, align: "start", cell: (s) => (
      <Chip tone={STATUS_TONE[s.status] ?? "neutral"} className="min-h-[22px] px-1.5 text-[10.5px]"><StepMark state={STATUS_STEP[s.status] ?? "idle"} />{word("adm.status", s.status)}</Chip>
    ) },
    { key: "provider", label: t("adm.dl.company"), align: "start", className: (s) => `font-num text-[12px] ${s.provider ? "text-ink" : "text-people"}`, cell: (s) => s.provider ?? t("adm.dl.notChosen") },
    { key: "cadence", label: t("adm.dl.often"), align: "start", className: "text-[12px] text-ink-2 whitespace-nowrap", cell: (s) => s.cadence },
    { key: "secret_env", label: t("adm.dl.secret"), align: "start", className: "font-num text-[11px] text-ink-3", cell: (s) => s.secret_env ?? t("adm.dl.none") },
  ];
  const picked = sources.find((s) => s.id === feed);

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("adm.hero1")} line2={t("adm.hero2")} sub={t("adm.sub", { n: docs.length })}
        info={<TipText lead={t("adm.about.lead")} more={t("adm.about.more")} />}
        chips={<>
          <Chip tone="up"><StepMark state="done" />{t("adm.readOnly")}</Chip>
          <a href={`https://github.com/${repo}/pulls`} target="_blank" rel="noreferrer" className="chip min-h-[32px] border-line-2 bg-surface-2 text-ink-2 hover:border-line-3 hover:text-ink">{t("adm.prs")} <span aria-hidden="true">↗</span></a>
        </>} />

      <Panel id="adm-docs" className="mt-7" title={t("adm.docs")} sub={t("adm.docsSub")} badge={<span className="font-num text-[12px] font-bold text-ink-2">{docs.length}</span>}>
        <div className="-mt-4 -mb-4 sm:-mt-5 sm:-mb-5">
          <DataTable columns={docCols} rows={docs} rowKey={(d) => d.name} minWidth={860} onRowClick={setOpen} rowLabel={(d) => docName(d.name)}
            rowTone={(d) => (open?.name === d.name ? "brand" : null)} scrollClassName="relative" caption={t("adm.docs")} />
        </div>
      </Panel>

      <Panel id="adm-feeds" className="mt-4 md:mt-8" title={t("adm.feeds.title")} sub={t("adm.feeds.sub")} info={t("adm.feeds.info")}
        badge={<>
          <span className="font-num text-[12px] font-bold text-ink-2"><span className="text-up">{live}</span>/{sources.length}</span>
          <a href={editUrl("config/sources.json")} target="_blank" rel="noreferrer" className="chip ms-1 hidden min-h-[32px] border-line-2 text-ink-2 hover:text-ink sm:inline-flex">{t("adm.feeds.edit")} <span aria-hidden="true">↗</span></a>
        </>}>
        <div className="-mt-4 sm:-mt-5">
          <DataTable columns={feedCols} rows={sources} rowKey={(s) => s.id} minWidth={640} onRowClick={(s) => setFeed((f) => (f === s.id ? null : s.id))} rowLabel={(s) => s.label}
            rowTone={(s) => (s.id === feed ? "brand" : null)} scrollClassName="relative" caption={t("adm.feeds.title")} />
        </div>
        {picked && (
          <div className="tile mt-4 grid animate-pop gap-2 p-4 motion-reduce:animate-none md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-4" aria-live="polite">
            <div className="min-w-0">
              <p className="headline text-[22px] text-ink">{picked.label}</p>
              <p className="mt-1 text-[14px] leading-snug text-ink-2">{picked.note}</p>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-4 gap-y-1.5 text-[12.5px]">
              <dt className="micro pt-0.5">{t("adm.dl.feeds")}</dt><dd className="font-num break-words text-ink-2">{picked.feeds.join(", ")}</dd>
              {picked.kind === "social" && (<><dt className="micro pt-0.5">{t("adm.dl.following")}</dt><dd className="text-ink-2">{picked.follow.length ? picked.follow.join(" ") : t("adm.dl.nobody")}</dd></>)}
            </dl>
          </div>
        )}
      </Panel>

      {open && <Viewer doc={open} onClose={() => setOpen(null)} editUrl={editUrl(open.path)} />}
    </Container>
  );
}

/**
 * A side sheet that reads one file: formatted or raw JSON. The body renders a frame after the sheet opens (a skeleton
 * meanwhile). It is drawn on <body> (a portal): <main> is its own layer for page transitions, so a sheet inside it could
 * not cover the site header.
 */
function Viewer({ doc, onClose, editUrl }) {
  const panel = useRef(null);
  const [raw, setRaw] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [onClose]);
  const isMd = typeof doc.content === "string";
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" aria-label={t("close")} onClick={onClose} className="absolute inset-0 animate-[fade_300ms_ease-out_both] bg-black/55 backdrop-blur-sm" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={docName(doc.name)}
        className="relative flex h-full w-full max-w-[760px] flex-col border-s border-desk/40 bg-surface shadow-2xl outline-none"
        style={{ animation: "slide-in 500ms cubic-bezier(.16,1,.3,1) both" }}>
        <style>{"@keyframes slide-in{from{transform:translateX(40px);opacity:0}}"}</style>
        <span aria-hidden="true" className="absolute inset-y-0 start-0 w-px bg-gradient-to-b from-desk via-desk/30 to-transparent" />
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 pt-4 pb-3 sm:px-6">
          <div className="min-w-0">
            <p className="kicker truncate">{doc.path}</p>
            <h3 className="headline mt-1.5 text-[30px] text-ink">{docName(doc.name)}</h3>
            <p className="font-num mt-1 text-[11.5px] text-ink-3">{t("version", { v: doc.version })} · {doc.updated_at}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-11 shrink-0 place-items-center rounded-full border border-line-2 text-ink-2 hover:border-line-3 hover:text-ink">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 sm:px-6">
          {!isMd && <Segmented label={t("adm.view.json")} value={raw ? "json" : "formatted"} onChange={(v) => setRaw(v === "json")}
            options={[{ value: "formatted", label: t("adm.view.formatted") }, { value: "json", label: t("adm.view.json") }]} />}
          <a href={editUrl} target="_blank" rel="noreferrer" className="chip ms-auto min-h-[36px] border-desk/50 bg-desk/10 px-3 text-desk">{t("edit")} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <p className="tile mb-5 px-3.5 py-2.5 text-[13.5px] leading-snug text-ink-2"><span className="micro me-2 text-desk">{t("adm.changeNote")}</span>{doc.change_note}</p>
          {!ready ? <SkeletonRows rows={8} /> : isMd ? <Markdown source={doc.content} /> : raw ? (
            <pre className="tile overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-ink-2">{JSON.stringify(doc.content, null, 2)}</pre>
          ) : <JsonView value={doc.content} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const SKIP = new Set(["version", "updated_at", "change_note"]);

function JsonView({ value, depth = 0 }) {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-ink-3">{t("adm.json.none")}</span>;
    if (value.every((v) => typeof v !== "object" || v === null))
      return <div className="flex flex-wrap gap-1.5">{value.map((v, i) => <span key={i} className="chip min-h-[24px] border-line-2 bg-surface-2 text-[11px] tracking-normal text-ink-2 normal-case">{String(v)}</span>)}</div>;
    return <div className="grid gap-2.5">{value.map((v, i) => <div key={i} className="tile p-3.5"><JsonView value={v} depth={depth + 1} /></div>)}</div>;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([k]) => depth > 0 || !SKIP.has(k));
    return (
      <dl className={`grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-[minmax(110px,auto)_minmax(0,1fr)] ${depth > 0 ? "mt-1 border-s border-line-2 ps-3" : ""}`}>
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="micro pt-1">{k.replaceAll("_", " ")}</dt>
            <dd className="min-w-0 text-[14px] [overflow-wrap:anywhere]"><JsonView value={v} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  if (value === null) return <span className="text-people">{t("adm.json.notSet")}</span>;
  if (typeof value === "boolean") return <span className={value ? "text-up" : "text-ink-3"}>{t(value ? "adm.json.yes" : "adm.json.no")}</span>;
  return <span className={typeof value === "number" ? "font-num" : ""}>{String(value)}</span>;
}
