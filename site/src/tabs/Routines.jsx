import { useMemo, useState } from "react";
import { pad2, fmtDate, fmtUsd } from "../lib/format.js";
import { Accent, ArrowRight, Chip, Container, Empty, Reveal, SectionHead, Strip } from "../components/ui.jsx";
import dict from "../text/learn.js";
import { strings } from "../lib/text.js";

// Labels are text/learn.js "rt.cad.<id>"; weekdays "rt.dow.<0-6>" (0 is Sunday).
const CADENCE = ["all", "daily", "weekly", "monthly", "on_demand"];
// Who starts a routine: a GitHub Actions schedule in the repo, or a scheduled Claude Code session (a Claude routine).
// Label "rt.runner.<runner>", hover text "rt.runner.<runner>.title".
const RUNNER = {
  github_actions: { cls: "text-ink-2" },
  claude_routine: { cls: "border-ai/40 text-ai" },
};
// Routines whose card needs more than the schedule says: a plain line ("rt.note.<id>"), shown while it is active.
const NOTE = new Set(["close_run"]);
// A plainer schedule label where the cron alone would mislead (a Tue–Sat UTC cron covers the Mon–Fri US market days):
// "rt.when.<id>".
const WHEN = new Set(["close_run"]);

/** "05:23, 08:23 and 11:23 UTC (08:23, 11:23 and 14:23 your time)": UTC from the cron, and the reader's own clock. */
export function timesLabel(h, m, tz = undefined) {
  const t = strings(dict);
  const hours = h.split(",").map(Number);
  const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);
  const utc = list(hours.map((x) => `${pad2(x)}:${pad2(+m)}`));
  const now = new Date();
  const local = list(hours.map((x) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), x, +m)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz })));
  return local === utc ? t("rt.utc", { times: utc }) : t("rt.utcLocal", { times: utc, local });
}

function when(r) {
  const t = strings(dict);
  if (!r.cron) return WHEN.has(r.id) ? t(`rt.when.${r.id}`) : t("rt.whenAsked");
  const [m, h, dom, , dow] = r.cron.split(" ");
  const tl = timesLabel(h, m);
  if (WHEN.has(r.id)) return `${t(`rt.when.${r.id}`)} · ${tl}`;
  if (r.cadence === "daily") return `${days(dow)} · ${tl}`;
  if (r.cadence === "weekly") return `${t.has(`rt.dow.${+dow}`) ? t("rt.weekly", { day: t(`rt.dow.${+dow}`) }) : dow} · ${tl}`;
  return `${t("rt.monthly", { dom })} · ${tl}`;
}

/** Scheduled Claude sessions run on the subscription ($0 per run); the other model routines carry a cost cap. */
function llmDesc(llm) {
  const t = strings(dict);
  const capped = llm.filter((r) => r.runner !== "claude_routine");
  const sub = llm.length - capped.length;
  const usd = capped.length ? fmtUsd(Math.max(...capped.map((r) => r.max_cost_usd))) : null;
  const cap = usd ? t(sub ? "rt.llm.capOthers" : "rt.llm.capEach", { usd }) : "";
  return [sub ? t("rt.llm.sub", { count: sub }) : "", cap].filter(Boolean).join("; ").replace(/^./, (c) => c.toUpperCase()) + ".";
}

function days(dow) {
  const t = strings(dict);
  const name = (d) => (t.has(`rt.dow.${d}`) ? t(`rt.dow.${d}`) : d);
  if (dow === "*") return t("rt.everyDay");
  const [a, b] = dow.split("-").map(Number);
  return b === undefined ? name(a) : `${name(a)}–${name(b)}`;
}

/** Next fire time for the simple cron shapes in use: "m h * * d-d|d|*" and "m h D * *"; h may be a list ("5,11"). */
function nextRun(cron, from = new Date()) {
  if (!cron) return null;
  const [m, h, dom, , dow] = cron.split(" ");
  const hours = h.split(",").map(Number).sort((a, b) => a - b);
  const days = dow === "*" ? null : dow.includes("-") ? (() => { const [a, b] = dow.split("-").map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); })() : [Number(dow)];
  for (let i = 0; i < 400; i++) {
    for (const hh of hours) {
      const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + i, hh, +m));
      if (d <= from) continue;
      if (dom !== "*" && d.getUTCDate() !== +dom) continue;
      if (days && !days.includes(d.getUTCDay())) continue;
      return d;
    }
  }
  return null;
}

function relTime(d) {
  if (!d) return "";
  const t = strings(dict);
  const hrs = Math.round((d - new Date()) / 36e5);
  return hrs < 24 ? t("rt.inHours", { count: hrs }) : t("rt.inDays", { count: Math.round(hrs / 24) });
}

/** A fire time in UTC: "Tue, 20 Oct 2026 05:23 UTC". */
const utcStamp = (d) => d.toUTCString().replace(":00 GMT", " UTC");
/** A status or outcome word, or the raw value when text/learn.js has none. */
const word = (t, prefix, v) => (t.has(`${prefix}.${v}`) ? t(`${prefix}.${v}`) : v);

export default function Routines({ data }) {
  const { routines, opsLog, manifest } = data;
  const [cad, setCad] = useState("all");
  const all = routines.routines;
  const list = all.filter((r) => cad === "all" || r.cadence === cad);
  const active = all.filter((r) => r.status === "active");
  const llm = all.filter((r) => r.uses_llm);
  const runs = [...(opsLog?.items ?? [])].reverse();
  const last = runs[0];
  const lastByRoutine = useMemo(() => {
    const m = {};
    for (const run of runs) for (const s of run.steps) if (!m[s.routine] && s.outcome !== "skipped") m[s.routine] = { ...s, at: run.finished_at, url: run.url };
    return m;
  }, [runs]);
  const next = active.map((r) => ({ r, at: nextRun(r.cron) })).filter((x) => x.at).sort((a, b) => a.at - b.at)[0];
  const repo = `https://github.com/${manifest.repo}`;
  const t = strings(dict);

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={t("rt.eyebrow", { v: routines.version })}
        title={<>{t("rt.title.a")} <Accent>{t("rt.title.b")}</Accent></>}
        lede={<>
          <span className="block text-ink">{t("rt.lede1")}</span>
          <span className="mt-3 block">{t("rt.lede2")}</span>
        </>}
        right={
          <div className="flex flex-wrap gap-2">
            <a className="btn px-5 py-3 text-[14px]" href={`${repo}/blob/main/config/routines.json`} target="_blank" rel="noreferrer">routines.json <ArrowRight className="size-4 -rotate-45" /></a>
            <a className="btn px-5 py-3 text-[14px]" href={`${repo}/actions`} target="_blank" rel="noreferrer">{t("rt.actions")} <ArrowRight className="size-4 -rotate-45" /></a>
          </div>
        }
      />
      <Strip
        cells={[
          { value: <span>{active.length}/{all.length}</span>, label: t("rt.s.on"), desc: t("rt.s.onDesc") },
          { value: next ? relTime(next.at) : "—", label: next ? t("rt.s.next", { name: next.r.name }) : t("rt.s.nothing"), tone: "flat", desc: next ? utcStamp(next.at) : "" },
          { value: last ? word(t, "rt.out", last.status) : t("rt.s.noneYet"), label: t("rt.s.lastRun"), tone: !last ? "flat" : last.status === "success" ? "accent" : last.status === "partial" ? "people" : "down", desc: last ? `${fmtDate(last.finished_at.slice(0, 10))} · ${last.trigger}` : t("rt.s.firstRun") },
          { value: llm.length, label: t("rt.s.ai"), tone: "ai", desc: llmDesc(llm) },
        ]}
      />

      <Reveal className="no-scrollbar mt-10 flex gap-2 overflow-x-auto pb-1">
        {CADENCE.map((id) => {
          const n = id === "all" ? all.length : all.filter((r) => r.cadence === id).length;
          return (
            <button key={id} type="button" onClick={() => setCad(id)} aria-pressed={cad === id}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-[14px] font-medium transition ${cad === id ? "border-transparent bg-ink text-bg" : "border-line-2 text-ink-2 hover:text-ink"}`}>
              {t(`rt.cad.${id}`)} <span className={`num font-mono text-[12px] ${cad === id ? "text-bg/60" : "text-ink-3"}`}>{n}</span>
            </button>
          );
        })}
      </Reveal>

      <div key={cad} className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r, i) => {
          const lr = lastByRoutine[r.id];
          const at = r.status === "active" ? nextRun(r.cron) : null;
          return (
            <article key={r.id} className={`card card-hover flex animate-rise flex-col p-7 ${r.status !== "active" ? "border-dashed" : ""} ${r.human_gate ? "border-people/50" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between gap-3">
                <span className="meta num">{when(r)}</span>
                <Chip kind={r.status === "active" ? "active" : "planned"} icon={false}>{word(t, "rt.status", r.status)}</Chip>
              </div>
              <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em]">{r.name}</h3>
              {NOTE.has(r.id) && r.status === "active"
                ? <p className="mt-3 border-s-2 border-ai/50 ps-3 text-[14.5px] leading-relaxed text-ink">{t(`rt.note.${r.id}`)}</p>
                : <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{r.why}</p>}
              <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-line pt-4 text-[13px]">
                <dt className="meta">{t("rt.dl.step")}</dt><dd>{r.milestone}</dd>
                <dt className="meta">{t("rt.dl.reads")}</dt>{r.inputs.length ? <dd className="truncate text-start font-mono text-[12px]">{r.inputs.join(", ")}</dd> : <dd>{t("rt.dl.ownOutputs")}</dd>}
                <dt className="meta">{t("rt.dl.saves")}</dt><dd className="truncate text-start font-mono text-[12px]" title={r.outputs.join(", ")}>{r.outputs.join(", ")}</dd>
                {at && (<><dt className="meta">{t("rt.dl.next")}</dt><dd>{relTime(at)}</dd></>)}
                <dt className="meta">{t("rt.dl.last")}</dt>
                <dd>{lr ? <a href={lr.url} target="_blank" rel="noreferrer" className={`hover:underline ${lr.outcome === "success" ? "text-accent" : "text-down"}`}>{word(t, "rt.out", lr.outcome)} · <span>{lr.at.slice(0, 10)}</span></a> : <span className="text-ink-3">{t("rt.dl.never")}</span>}</dd>
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 [margin-top:max(1.25rem,auto)]">
                {RUNNER[r.runner] && <span className={`pill py-1 text-[11px] ${RUNNER[r.runner].cls}`} title={t(`rt.runner.${r.runner}.title`)}>{t(`rt.runner.${r.runner}`)}</span>}
                {r.uses_llm
                  ? <span className="pill border-ai/40 bg-ai/10 py-1 text-[11px] text-ai">{r.runner === "claude_routine" ? t("rt.pill.sub") : t("rt.pill.cap", { usd: fmtUsd(r.max_cost_usd) })}</span>
                  : <span className="pill py-1 text-[11px] text-ink-2">{t("rt.pill.code")}</span>}
                {r.human_gate && <span className="pill border-dashed border-people/60 py-1 text-[11px] text-people">{t("rt.pill.gate")}</span>}
              </div>
            </article>
          );
        })}
      </div>

      <section className="pt-28">
        <SectionHead
          eyebrow={t("rt.hist.eyebrow")}
          title={<>{t("rt.hist.title.a")} <Accent>{t("rt.hist.title.b")}</Accent></>}
          lede={t("rt.hist.lede")}
          size="md"
          right={<span className="meta">{t("rt.hist.logged", { n: runs.length })}</span>}
        />
        {!runs.length ? (
          <Empty title={t("rt.hist.empty.title")}>{t("rt.hist.empty.body")}</Empty>
        ) : (
          <Reveal className="card overflow-hidden">
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13.5px]">
                <thead>
                  <tr className="meta border-b border-line text-start">
                    {["finished", "job", "by", "result", "steps", "log"].map((h) => <th key={h} className="px-5 py-4 text-start font-medium">{t(`rt.th.${h}`)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 60).map((r) => (
                    <tr key={r.run_id} className="border-b border-line last:border-0 hover:bg-ink/[0.03]">
                      <td className="px-5 py-3.5 font-mono">{r.finished_at.replace("T", " ").replace("Z", "")}</td>
                      <td className="px-5 py-3.5">{r.workflow}</td>
                      <td className="px-5 py-3.5 text-ink-2">{r.trigger}</td>
                      <td className="px-5 py-3.5"><Chip kind={r.status === "success" ? "ok" : r.status === "partial" ? "planned" : r.status === "skipped" ? "retired" : "failed"} icon={false}>{word(t, "rt.out", r.status)}</Chip></td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {r.steps.filter((s) => s.outcome !== "skipped").map((s) => (
                            <span key={s.routine} className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${s.outcome === "success" ? "border-accent/30 text-accent" : "border-down/40 text-down"}`}>{s.routine}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-2 hover:text-accent"><span>#{r.run_id.slice(-6)}</span> <ArrowRight className="size-3.5 -rotate-45" /></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        )}
      </section>
    </Container>
  );
}
