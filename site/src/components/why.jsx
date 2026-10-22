// "Why it moved" notes on the Full dashboard's market day and on each Stock page. The words come from lib/why.js
// (noteView); this file only lays them out. Every list of notes ends with the not-a-reason-to-trade line.

import { Fragment } from "react";
import dict from "../text/home.js";
import { strings } from "../lib/text.js";
import { fmtPct } from "../lib/format.js";
import { NOT_A_TRADE } from "../lib/why.js";

const CONF_COLOR = { accent: "var(--accent)", flat: "var(--ink-2)", people: "var(--people)" };
const moveTone = (v) => (v == null ? "text-ink-2" : v >= 0.05 ? "text-accent" : v <= -0.05 ? "text-down" : "text-ink-2");

/** A note's sources as links ("Wire One, Oct 9 ↗"), or a plain line when an unclear note found none. */
export function NoteSources({ v }) {
  const t = strings(dict);
  if (!v.sources.length) return <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{t("whyc.noSource")}</p>;
  return (
    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
      <span className="me-1">{t(v.unclear ? "whyc.lookedAt" : "whyc.sources")}</span>
      {v.sources.map((s, i) => (
        <Fragment key={s.url}>{i ? " · " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words underline decoration-line-2 underline-offset-2 hover:text-ink"><span>{s.publisher}</span>{s.day ? <>, <span>{s.day}</span></> : ""} ↗</a></Fragment>
      ))}
    </p>
  );
}

/** One note: who (or the day, on a Stock page), the move from the site's data, how sure, the headline, the why and the links. */
export function WhyNote({ v, lead, tag = null }) {
  return (
    <li className="rounded-2xl border border-line-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 text-[14px] font-semibold text-ink"><span>{lead}</span>{tag && <span className="ms-2 font-normal text-ink-3">{tag}</span>}</span>
        <span className="flex items-baseline gap-2">
          {v.move_pct != null && <span className={`num font-mono text-[13.5px] ${moveTone(v.move_pct)}`}>{fmtPct(v.move_pct, 1)}</span>}
          <span className="rounded-full border px-2.5 py-0.5 text-[12px] font-semibold" style={{ color: CONF_COLOR[v.tone], borderColor: "var(--line-2)" }}>{v.word}</span>
        </span>
      </div>
      <p className="mt-2 text-[16px] leading-snug text-ink">{v.headline}.</p>
      {v.why && <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{v.why}</p>}
      <NoteSources v={v} />
    </li>
  );
}

/** The fixed footer under any list of notes. */
export function WhyFooter({ className = "" }) {
  const t = strings(dict);
  return (
    <p className={`text-[13.5px] leading-relaxed text-ink-3 ${className}`}>
      <span className="font-semibold text-ink-2">{NOT_A_TRADE}</span> {t("whyc.footer")}
    </p>
  );
}
