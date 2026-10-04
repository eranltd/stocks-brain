import { useMemo, useState } from "react";
import { fmtDate, pad2 } from "../lib/format.js";
import { Accent, ArrowRight, Chip, Container, Empty, Reveal, SectionHead, Strip } from "../components/ui.jsx";

const CADENCE = [
  { id: "all", label: "All" },
  { id: "daily", label: "Every trading day" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
  { id: "on_demand", label: "On demand" },
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function when(r) {
  if (!r.cron) return "when you ask";
  const [m, h, dom, , dow] = r.cron.split(" ");
  const t = `${pad2(+h)}:${pad2(+m)} UTC`;
  if (r.cadence === "daily") return `${dow === "1-5" ? "Mon–Fri" : "daily"} · ${t}`;
  if (r.cadence === "weekly") return `${DOW[+dow] ?? dow} · ${t}`;
  return `day ${dom} of the month · ${t}`;
}

/** Next fire time for the simple cron shapes we use: "m h * * d-d|d|*" and "m h D * *". */
function nextRun(cron, from = new Date()) {
  if (!cron) return null;
  const [m, h, dom, , dow] = cron.split(" ");
  const days = dow === "*" ? null : dow.includes("-") ? (() => { const [a, b] = dow.split("-").map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); })() : [Number(dow)];
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + i, +h, +m));
    if (d <= from) continue;
    if (dom !== "*" && d.getUTCDate() !== +dom) continue;
    if (days && !days.includes(d.getUTCDay())) continue;
    return d;
  }
  return null;
}

function relTime(d) {
  if (!d) return "";
  const hrs = Math.round((d - new Date()) / 36e5);
  return hrs < 24 ? `in ${hrs} h` : `in ${Math.round(hrs / 24)} d`;
}

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

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={`Routines · v${routines.version}`}
        title={<>Every routine, <Accent>in the open.</Accent></>}
        lede="What runs, when, what it may spend and what it writes. Each run records its outcome in the repo, failures included, and that log is shown below. Routines that would change rules or the watchlist open a pull request for you instead of acting."
        right={
          <div className="flex flex-wrap gap-2">
            <a className="btn px-5 py-3 text-[14px]" href={`${repo}/blob/main/config/routines.json`} target="_blank" rel="noreferrer">routines.json <ArrowRight className="size-4 -rotate-45" /></a>
            <a className="btn px-5 py-3 text-[14px]" href={`${repo}/actions`} target="_blank" rel="noreferrer">Actions <ArrowRight className="size-4 -rotate-45" /></a>
          </div>
        }
      />
      <Strip
        cells={[
          { value: `${active.length}/${all.length}`, label: "active", desc: "The rest are planned and switch on milestone by milestone." },
          { value: next ? relTime(next.at) : "—", label: next ? `next: ${next.r.name}` : "nothing scheduled", tone: "flat", desc: next ? `${next.at.toUTCString().replace(":00 GMT", " UTC")}` : "" },
          { value: last ? last.status : "none yet", label: "last run", tone: !last ? "flat" : last.status === "success" ? "accent" : last.status === "partial" ? "people" : "down", desc: last ? `${fmtDate(last.finished_at.slice(0, 10))} · ${last.trigger}` : "The first scheduled run needs the Tiingo key and main as the default branch." },
          { value: llm.length, label: "use the model", tone: "ai", desc: `Each capped; the highest cap is $${Math.max(...llm.map((r) => r.max_cost_usd)).toFixed(2)} per run.` },
        ]}
      />

      <Reveal className="no-scrollbar mt-10 flex gap-2 overflow-x-auto pb-1">
        {CADENCE.map((c) => {
          const n = c.id === "all" ? all.length : all.filter((r) => r.cadence === c.id).length;
          return (
            <button key={c.id} type="button" onClick={() => setCad(c.id)} aria-pressed={cad === c.id}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-[14px] font-medium transition ${cad === c.id ? "border-transparent bg-ink text-bg" : "border-line-2 text-ink-2 hover:text-ink"}`}>
              {c.label} <span className={`num font-mono text-[12px] ${cad === c.id ? "text-bg/60" : "text-ink-3"}`}>{n}</span>
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
                <Chip kind={r.status === "active" ? "active" : "planned"} icon={false}>{r.status}</Chip>
              </div>
              <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em]">{r.name}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{r.why}</p>
              <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-line pt-4 text-[13px]">
                <dt className="meta">milestone</dt><dd>{r.milestone}</dd>
                <dt className="meta">reads</dt><dd className="truncate font-mono text-[12px]">{r.inputs.join(", ") || "its own outputs"}</dd>
                <dt className="meta">writes</dt><dd className="truncate font-mono text-[12px]" title={r.outputs.join(", ")}>{r.outputs.join(", ")}</dd>
                {at && (<><dt className="meta">next</dt><dd>{relTime(at)}</dd></>)}
                <dt className="meta">last</dt>
                <dd>{lr ? <a href={lr.url} target="_blank" rel="noreferrer" className={`hover:underline ${lr.outcome === "success" ? "text-accent" : "text-down"}`}>{lr.outcome} · {lr.at.slice(0, 10)}</a> : <span className="text-ink-3">never ran</span>}</dd>
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 [margin-top:max(1.25rem,auto)]">
                {r.uses_llm ? <span className="pill border-ai/40 bg-ai/10 py-1 text-[11px] text-ai">✦ AI · cap ${r.max_cost_usd.toFixed(2)}</span> : <span className="pill py-1 text-[11px] text-ink-2">plain code · $0</span>}
                {r.human_gate && <span className="pill border-dashed border-people/60 py-1 text-[11px] text-people">you approve</span>}
              </div>
            </article>
          );
        })}
      </div>

      <section className="pt-28">
        <SectionHead
          eyebrow="Run history"
          title={<>What actually <Accent>ran.</Accent></>}
          lede="One row per workflow run, appended by the workflow itself to data/ops/routine_runs.json. Failed steps stay visible; data from a failed run is never committed."
          size="md"
          right={<span className="meta">{runs.length} runs logged</span>}
        />
        {!runs.length ? (
          <Empty title="No runs yet">The daily routine starts once the Tiingo key is added and main is the default branch. Each run will appear here.</Empty>
        ) : (
          <Reveal className="card overflow-hidden">
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13.5px]">
                <thead>
                  <tr className="meta border-b border-line text-left">
                    {["Finished", "Workflow", "Trigger", "Status", "Steps", "Log"].map((h) => <th key={h} className="px-5 py-4 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 60).map((r) => (
                    <tr key={r.run_id} className="border-b border-line last:border-0 hover:bg-ink/[0.03]">
                      <td className="px-5 py-3.5 font-mono">{r.finished_at.replace("T", " ").replace("Z", "")}</td>
                      <td className="px-5 py-3.5">{r.workflow}</td>
                      <td className="px-5 py-3.5 text-ink-2">{r.trigger}</td>
                      <td className="px-5 py-3.5"><Chip kind={r.status === "success" ? "ok" : r.status === "partial" ? "planned" : r.status === "skipped" ? "retired" : "failed"} icon={false}>{r.status}</Chip></td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {r.steps.filter((s) => s.outcome !== "skipped").map((s) => (
                            <span key={s.routine} className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${s.outcome === "success" ? "border-accent/30 text-accent" : "border-down/40 text-down"}`}>{s.routine}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-2 hover:text-accent">#{r.run_id.slice(-6)} <ArrowRight className="size-3.5 -rotate-45" /></a></td>
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
