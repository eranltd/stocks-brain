import { useMemo, useState } from "react";
import { fmtShort, fmtUsd } from "../lib/format.js";
import { Chip, Container, DataTable, EmptyState, Panel, StatTile, StepMark } from "../components/ui.jsx";
import { clock, dayTimeline, lastByRoutine, nextRun, relTime } from "../lib/routines.js";
import { DayTrack, FilterChips, PageHero, TipText, useUtcMinute } from "../lib/learnkit.jsx";
import dict from "../text/learn.js";
import { strings } from "../lib/text.js";

/*
 * Routines: every timed job in the open, as an ops console. A weekday's timeline in UTC (each start time a dot: green ran
 * fine last time, red failed, grey no run yet, dashed planned) with a live "now" line; the other days' jobs; every job
 * in one table (tap a row for what it reads and saves); and the run log, failures included. Times come from the crons
 * in config/routines.json, outcomes from data/ops/routine_runs.json.
 */

const t = strings(dict);
const CADENCE = ["all", "daily", "weekly", "monthly", "on_demand"];
/** A status or outcome word, or the raw value when text/learn.js has none. */
const word = (prefix, v) => (t.has(`${prefix}.${v}`) ? t(`${prefix}.${v}`) : v);
const OUT_STEP = { success: "done", partial: "wait", failure: "fail", failed: "fail", cancelled: "fail", skipped: "idle" };
const STATUS_STEP = { active: "done", planned: "wait", disabled: "fail" };
const STATUS_TONE = { active: "up", planned: "ghost", disabled: "down" };
/** "22 Oct" from a date or a timestamp. */
const dayMonth = (iso) => (iso ? fmtShort(iso.slice(0, 10)) : "–");

function days(dow) {
  const name = (d) => (t.has(`rt.dow.${d}`) ? t(`rt.dow.${d}`) : d);
  if (dow === "*") return t("rt.everyDay");
  const [a, b] = dow.split("-").map(Number);
  return b === undefined ? name(a) : `${name(a)}–${name(b)}`;
}

/** "Mon–Fri 23:40", "Sat 13:00", "Day 1 13:00", "When asked" (UTC). */
function when(r) {
  if (!r.cron) return t("rt.whenAsked");
  const [m, h, dom, , dow] = r.cron.split(" ");
  const times = h.split(",").map((x) => clock(+x * 60 + +m)).join(" · ");
  const day = t.has(`rt.when.${r.id}`) ? t(`rt.when.${r.id}`) : dom !== "*" ? t("rt.monthly", { dom }) : days(dow);
  return `${day} ${times}`;
}

/** The reader's own clock for a UTC minute of the day, when it differs ("08:23"). */
function localOf(mins) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Math.floor(mins / 60), mins % 60));
  const local = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return local === clock(mins) ? null : local;
}

export default function Routines({ data }) {
  const { routines, opsLog, manifest } = data;
  const all = routines.routines;
  const [cad, setCad] = useState("all");
  const [open, setOpen] = useState(null);
  const runs = useMemo(() => [...(opsLog?.items ?? [])].reverse(), [opsLog]);
  const last = useMemo(() => lastByRoutine(runs), [runs]);
  const nameOf = useMemo(() => { const n = Object.fromEntries(all.map((r) => [r.id, r.name])); return (id) => n[id] ?? id; }, [all]);
  const active = all.filter((r) => r.status === "active");
  const planned = all.filter((r) => r.status === "planned");
  const llm = all.filter((r) => r.uses_llm && r.status === "active");
  const next = active.map((r) => ({ r, at: nextRun(r.cron) })).filter((x) => x.at).sort((a, b) => a.at - b.at)[0];
  const lastRun = runs[0];
  const stops = useMemo(() => dayTimeline(all), [all]);
  const [stop, setStop] = useState(null);
  const repo = `https://github.com/${manifest.repo}`;
  const list = all.filter((r) => cad === "all" || r.cadence === cad);
  const others = all.filter((r) => r.cadence !== "daily");

  const linkCls = "chip min-h-[32px] border-line-2 bg-surface-2 text-ink-2 transition-colors hover:border-line-3 hover:text-ink";
  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("rt.hero1")} line2={t("rt.hero2")} sub={t("rt.sub", { on: active.length, planned: planned.length, ai: llm.length })}
        info={<TipText lead={t("rt.about.lead")} more={t("rt.about.more")} />}
        chips={<>
          <a className={linkCls} href={`${repo}/blob/main/config/routines.json`} target="_blank" rel="noreferrer">routines.json <span aria-hidden="true">↗</span></a>
          <a className={linkCls} href={`${repo}/actions`} target="_blank" rel="noreferrer">{t("rt.actions")} <span aria-hidden="true">↗</span></a>
        </>} />

      <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <Panel id="rt-timeline" hero title={t("rt.tl.title")} sub={t("rt.tl.sub")} info={t("rt.tl.info")}>
          <DayTrack stops={stops} last={last} picked={stop?.mins} onPick={(s) => { setStop(s); document.getElementById(`rt-at-${s.mins}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }} nameOf={nameOf} />
          <Timeline routines={all} last={last} picked={stop?.mins} nameOf={nameOf} />
        </Panel>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <StatTile label={t("rt.s.on")} value={active.length} unit={`/${all.length}`} bars={[active.length, planned.length]} barsHi={0} />
            <StatTile label={t("rt.s.next")} value={next ? relTime(next.at) : "–"} sub={next ? next.r.name : t("rt.s.nothing")} tone="flat" />
            <StatTile label={t("rt.s.last")} tone="flat"
              value={lastRun ? <span className={lastRun.status === "success" ? "text-up" : lastRun.status === "partial" ? "text-wait" : "text-down"}>{word("rt.out", lastRun.status)}</span> : t("rt.s.noneYet")}
              sub={lastRun ? `${dayMonth(lastRun.finished_at)} · ${lastRun.workflow}` : null} />
            <StatTile label={t("rt.s.ai")} value={<span className="text-ai">{llm.length}</span>} sub={t("rt.s.aiSub")} tone="flat" />
          </div>
          <Panel title={t("rt.other")} titleSize="xs" flush>
            <ul className="divide-y divide-line">
              {others.map((r) => (
                <li key={r.id} className="flex min-h-[48px] items-center gap-3 px-4 py-2 sm:px-5">
                  <span className="font-num w-[86px] shrink-0 text-[12px] font-semibold text-ink-2">{when(r)}</span>
                  <span className={`min-w-0 flex-1 truncate text-[13.5px] ${r.status === "active" ? "text-ink" : "text-ink-3"}`}>{r.name}</span>
                  {r.uses_llm && <Chip tone="ai" className="min-h-[22px] px-1.5 text-[10px]">AI</Chip>}
                  <Chip tone={STATUS_TONE[r.status] ?? "neutral"} className="min-h-[22px] px-1.5 text-[10px]">{word("rt.status", r.status)}</Chip>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel id="rt-all" className="mt-4 md:mt-8" title={t("rt.all.title")} sub={t("rt.all.sub")}
        badge={<span className="font-num text-[12px] font-bold text-ink-2">{list.length}</span>}>
        <FilterChips label={t("rt.th.when")} value={cad} onChange={(v) => { setCad(v); setOpen(null); }}
          options={CADENCE.map((id) => ({ value: id, label: t(`rt.cad.${id}`), count: id === "all" ? all.length : all.filter((r) => r.cadence === id).length }))} />
        <div className="mt-3">
          <JobsTable rows={list} last={last} open={open} onOpen={(r) => setOpen((o) => (o === r.id ? null : r.id))} />
        </div>
        {open && <JobDetail r={all.find((r) => r.id === open)} last={last[open]} />}
      </Panel>

      <Panel id="rt-history" className="mt-4 md:mt-8" title={t("rt.hist.title")} sub={t("rt.hist.sub")} info={t("rt.hist.info")}
        badge={<span className="font-num text-[12px] font-bold text-ink-2">{t("rt.hist.logged", { n: runs.length })}</span>}>
        {runs.length ? <History runs={runs} nameOf={nameOf} /> : <EmptyState compact title={t("rt.hist.empty.title")}>{t("rt.hist.empty.body")}</EmptyState>}
      </Panel>
    </Container>
  );
}

/* --------------------------------------------------------------- timeline */

const DOT = { done: "bg-up shadow-[0_0_10px_var(--up-glow)]", fail: "bg-down shadow-[0_0_10px_var(--down-glow)]", idle: "bg-ink-3" };
const ROWS_SHOWN = 3;

/** One stop's state from its jobs' last outcomes (as the track above). */
function stateOf(ids, last) {
  const outs = ids.map((id) => last[id]?.outcome).filter(Boolean);
  if (outs.some((o) => OUT_STEP[o] === "fail")) return "fail";
  return outs.some((o) => o === "success" || o === "partial") ? "done" : "idle";
}

/** The day as a vertical list: a mono time, a status dot on the line, the jobs; an orange "now" row in between. */
function Timeline({ routines, last, picked, nameOf }) {
  const now = useUtcMinute();
  const rows = useMemo(() => {
    const on = dayTimeline(routines);
    const plan = dayTimeline(routines.filter((r) => r.status === "planned").map((r) => ({ ...r, status: "active" }))).map((s) => ({ ...s, planned: true }));
    return [...on, ...plan].sort((a, b) => a.mins - b.mins || Number(a.planned ?? 0) - Number(b.planned ?? 0));
  }, [routines]);
  const nowAt = rows.findIndex((s) => s.mins > now);
  const latest = [...rows].reverse().find((s) => !s.planned && s.mins <= now && stateOf(s.ids, last) === "done");
  const items = [];
  rows.forEach((s, i) => {
    if (i === nowAt) items.push(<NowRow key="now" now={now} />);
    items.push(<Stop key={`${s.mins}-${s.planned ? "p" : "a"}`} s={s} last={last} past={s.mins <= now} live={s === latest} picked={picked === s.mins} nameOf={nameOf} />);
  });
  if (nowAt === -1) items.push(<NowRow key="now" now={now} />);
  return (
    <ol className="relative mt-3 border-t border-line pt-2">
      <span aria-hidden="true" className="absolute top-4 bottom-4 left-[68px] w-px bg-line-2" />
      {items}
    </ol>
  );
}

const ROW = "relative grid grid-cols-[48px_20px_minmax(0,1fr)] gap-x-2.5";

function NowRow({ now }) {
  return (
    <li className={`${ROW} items-center py-1.5`} aria-label={`${t("rt.tl.now")} ${clock(now)} UTC`}>
      <span className="font-num text-[13px] font-bold text-desk">{clock(now)}</span>
      <span aria-hidden="true" className="relative grid place-items-center">
        <span className="absolute size-3 animate-ping rounded-full bg-desk/50 motion-reduce:hidden" />
        <span className="relative size-2.5 rounded-full bg-desk shadow-[0_0_10px_var(--desk)]" />
      </span>
      <span aria-hidden="true" className="flex items-center gap-2">
        <span className="kicker text-[11px]">{t("rt.tl.now")}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-desk/80 to-transparent" />
      </span>
    </li>
  );
}

function Stop({ s, last, past, live, picked, nameOf }) {
  const [more, setMore] = useState(false);
  const st = s.planned ? "planned" : stateOf(s.ids, last);
  const shown = more ? s.ids : s.ids.slice(0, ROWS_SHOWN);
  const local = localOf(s.mins);
  return (
    <li id={`rt-at-${s.mins}`} className={`${ROW} items-start rounded-[8px] py-2 transition-colors ${picked ? "bg-desk/8" : ""}`}>
      <span className="pt-px">
        <span className={`font-num block text-[13.5px] leading-tight font-bold ${s.planned ? "text-ink-3" : past ? "text-ink-2" : "text-ink"}`}>{clock(s.mins)}</span>
        {local && <span className="font-num block text-[10px] leading-tight text-ink-3" title={t("rt.utcLocal", { times: clock(s.mins), local })}>{local}</span>}
      </span>
      <span aria-hidden="true" className="relative grid h-[19px] place-items-center">
        {live && <span className="absolute size-3 animate-ping rounded-full bg-up/60 motion-reduce:hidden" />}
        <span className={`relative block size-3 rounded-full ${st === "planned" ? "border-[1.5px] border-dashed border-ink-3 bg-surface" : DOT[st]} ${s.ai ? "ring-2 ring-ai ring-offset-2 ring-offset-surface" : ""}`} />
      </span>
      <div className="min-w-0">
        <ul className="grid gap-0.5">
          {shown.map((id) => {
            const lr = last[id];
            return (
              <li key={id} className="flex min-w-0 items-baseline gap-2">
                <span className={`min-w-0 truncate text-[13.5px] ${s.planned ? "text-ink-3" : "text-ink"}`}>{nameOf(id)}</span>
                <span className={`font-num shrink-0 text-[10.5px] ${lr ? (OUT_STEP[lr.outcome] === "fail" ? "text-down" : "text-ink-3") : "text-ink-3"}`}>
                  {s.planned ? t("rt.tl.planned") : lr ? t("rt.tl.ran", { date: dayMonth(lr.at) }) : "–"}
                </span>
              </li>
            );
          })}
        </ul>
        {s.ids.length > ROWS_SHOWN && (
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more}
            className="font-num -my-1 min-h-[32px] text-[11.5px] font-semibold text-ink-2 hover:text-desk">
            {more ? t("lx.less") : t("rt.tl.more", { n: s.ids.length - ROWS_SHOWN })}
          </button>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ tables */

function JobsTable({ rows, last, open, onOpen }) {
  const cols = [
    { key: "name", label: t("rt.th.job"), sortable: true, firstDir: "asc", sortValue: (r) => r.name, cell: (r) => (
      <span className="block min-w-0 py-1.5">
        <span className={`block max-w-[140px] truncate text-[13.5px] font-semibold sm:max-w-[220px] ${open === r.id ? "text-desk" : "text-ink"}`}>{r.name}</span>
        <span className="font-num block text-[10.5px] text-ink-3">{r.id}</span>
      </span>
    ) },
    { key: "when", label: t("rt.th.when"), align: "start", num: true, className: "text-[12px] text-ink-2", cell: (r) => when(r) },
    { key: "status", label: t("rt.th.status"), sortable: true, align: "start", sortValue: (r) => r.status, cell: (r) => (
      <span className="inline-flex items-center gap-1.5 text-[12.5px]"><StepMark state={STATUS_STEP[r.status] ?? "idle"} />{word("rt.status", r.status)}</span>
    ) },
    { key: "runner", label: t("rt.th.by"), align: "start", cell: (r) => (
      <span title={t.has(`rt.runner.${r.runner}.title`) ? t(`rt.runner.${r.runner}.title`) : undefined} className="text-[12.5px] text-ink-2">{word("rt.runner", r.runner)}</span>
    ) },
    { key: "cost", label: t("rt.th.cost"), align: "start", cell: (r) => (
      r.uses_llm ? <Chip tone="ai" className="min-h-[22px] px-1.5 text-[10px]">{r.runner === "claude_routine" ? t("rt.pill.sub") : t("rt.pill.cap", { usd: fmtUsd(r.max_cost_usd) })}</Chip>
        : <span className="font-num text-[11.5px] text-ink-3">{t("rt.pill.code")}</span>
    ) },
    { key: "last", label: t("rt.th.last"), sortable: true, sortValue: (r) => last[r.id]?.at ?? null, cell: (r) => {
      const lr = last[r.id];
      return lr ? <span className="font-num inline-flex items-center gap-1.5 text-[12px]"><StepMark state={OUT_STEP[lr.outcome] ?? "idle"} label={word("rt.out", lr.outcome)} />{dayMonth(lr.at)}</span> : <span className="text-ink-3">–</span>;
    } },
    { key: "next", label: t("rt.th.next"), sortable: true, sortValue: (r) => (r.status === "active" ? nextRun(r.cron)?.getTime() ?? null : null), firstDir: "asc", num: true,
      className: "text-[12px] text-ink-2", cell: (r) => (r.status === "active" && r.cron ? relTime(nextRun(r.cron)) : "–") },
  ];
  return (
    <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} minWidth={780} onRowClick={onOpen} rowLabel={(r) => r.name}
      rowTone={(r) => (r.id === open ? "brand" : null)} scrollClassName="relative md:max-h-[560px] md:overflow-y-auto" caption={t("rt.all.title")} />
  );
}

function JobDetail({ r, last }) {
  if (!r) return null;
  return (
    <div className="tile mt-3 grid animate-pop gap-3 p-4 motion-reduce:animate-none md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" aria-live="polite">
      <div className="min-w-0">
        <p className="kicker">{when(r)}</p>
        <p className="headline mt-1 text-[22px] text-ink">{r.name}</p>
        <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{t.has(`rt.note.${r.id}`) && r.status === "active" ? t(`rt.note.${r.id}`) : r.why}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone={STATUS_TONE[r.status] ?? "neutral"}>{word("rt.status", r.status)}</Chip>
          {r.uses_llm ? <Chip tone="ai">{r.runner === "claude_routine" ? t("rt.pill.sub") : t("rt.pill.cap", { usd: fmtUsd(r.max_cost_usd) })}</Chip> : <Chip tone="neutral">{t("rt.pill.code")}</Chip>}
          {r.human_gate && <Chip tone="people">{t("rt.pill.gate")}</Chip>}
          {last && <a href={last.url} target="_blank" rel="noreferrer" className="chip border-line-2 text-ink-2 hover:text-ink"><StepMark state={OUT_STEP[last.outcome] ?? "idle"} />{word("rt.out", last.outcome)} · {dayMonth(last.at)} ↗</a>}
        </div>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-4 gap-y-1.5 text-[12.5px]">
        <dt className="micro pt-0.5">{t("rt.dl.step")}</dt><dd className="font-num text-ink">{r.milestone}</dd>
        <dt className="micro pt-0.5">{t("rt.dl.reads")}</dt><dd className="font-num break-words text-ink-2">{r.inputs.length ? r.inputs.join(", ") : t("rt.dl.ownOutputs")}</dd>
        <dt className="micro pt-0.5">{t("rt.dl.saves")}</dt><dd className="font-num break-words text-ink-2">{r.outputs.join(", ")}</dd>
      </dl>
    </div>
  );
}

function History({ runs, nameOf }) {
  const cols = [
    { key: "finished_at", label: t("rt.th.finished"), num: true, cell: (r) => (
      <span className="font-num text-[12.5px] text-ink">{dayMonth(r.finished_at)} <span className="text-ink-3">{r.finished_at.slice(11, 16)}</span></span>
    ) },
    { key: "workflow", label: t("rt.th.workflow"), align: "start", cell: (r) => <span className="font-num text-[12.5px] font-semibold text-ink">{r.workflow}</span> },
    { key: "trigger", label: t("rt.th.trigger"), align: "start", className: "text-[12.5px] text-ink-2", cell: (r) => word("rt.trig", r.trigger) },
    { key: "status", label: t("rt.th.result"), align: "start", cell: (r) => (
      <Chip tone={r.status === "success" ? "up" : r.status === "partial" ? "wait" : r.status === "skipped" ? "ghost" : "down"} className="min-h-[22px] px-1.5 text-[10px]">
        <StepMark state={OUT_STEP[r.status] ?? "idle"} />{word("rt.out", r.status)}
      </Chip>
    ) },
    { key: "steps", label: t("rt.th.steps"), align: "start", cell: (r) => (
      <span className="flex flex-wrap gap-1 py-1.5">
        {r.steps.filter((s) => s.outcome !== "skipped").map((s) => (
          <span key={s.routine} title={nameOf(s.routine)} className={`font-num inline-flex items-center gap-1 rounded-[6px] border px-1.5 py-0.5 text-[10.5px] ${OUT_STEP[s.outcome] === "fail" ? "border-down/40 text-down" : "border-line-2 text-ink-2"}`}>
            <StepMark state={OUT_STEP[s.outcome] ?? "idle"} className="size-2.5" />{s.routine}
          </span>
        ))}
      </span>
    ) },
    { key: "url", label: t("rt.th.log"), cell: (r) => (
      <a href={r.url} target="_blank" rel="noreferrer" className="font-num inline-flex min-h-[44px] items-center gap-1 text-[12px] text-ink-2 hover:text-desk">#{r.run_id.slice(-6)} <span aria-hidden="true">↗</span></a>
    ) },
  ];
  return (
    <div className="-mt-4 -mb-4 sm:-mt-5 sm:-mb-5">
      <DataTable columns={cols} rows={runs.slice(0, 60)} rowKey={(r) => r.run_id} minWidth={760} caption={t("rt.hist.title")}
        rowTone={(r) => (OUT_STEP[r.status] === "fail" ? "down" : null)} scrollClassName="relative md:max-h-[560px] md:overflow-y-auto" />
    </div>
  );
}
