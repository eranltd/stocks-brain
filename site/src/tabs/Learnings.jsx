import { fmtShort, pad2 } from "../lib/format.js";
import dict from "../text/learn.js";
import { Chip, Container, EmptyState, Panel, PipelineStrip, StatTile } from "../components/ui.jsx";
import { PageHero, TipText } from "../lib/learnkit.jsx";
import { strings } from "../lib/text.js";

/*
 * Lessons learned, as evidence cards: each lesson a panel with its words, a meter of how its proof turned out (right,
 * wrong, other) and the checked guesses that prove it (tap one to open it in the Library). A strip at the end shows how
 * a lesson is born, from a guess to the brain reading it, each step lit by the real data.
 */

const t = strings(dict);
const DOT = { hit: "bg-up", miss: "bg-down", flat: "bg-ink-3" };

export default function Learnings({ data, openKB }) {
  const { learnings, outcomes, manifest } = data;
  const items = learnings.items;
  const active = items.filter((l) => l.status === "active");
  const byId = Object.fromEntries(outcomes.map((o) => [o.pick_id, o]));
  const steps = [
    ["guess", (data.kb?.length ?? 0) > 0],
    ["check", outcomes.length > 0],
    ["pattern", items.length > 0],
    ["write", items.length > 0],
    ["read", active.length > 0],
  ].map(([id, done]) => ({ id, label: t(`lrn.born.${id}`), state: done ? "done" : "wait", stateLabel: t(done ? "lrn.born.done" : "lrn.born.wait") }));
  const done = steps.filter((s) => s.state === "done").length;

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("lrn.hero1")} line2={t("lrn.hero2")} sub={t("lrn.sub")}
        info={<TipText lead={t("lrn.about.lead")} more={t("lrn.about.more")} />}
        chips={<>
          <Chip tone="neutral"><span className="text-ink-2">{t("lrn.version", { v: learnings.version, date: fmtShort(learnings.updated_at) })}</span></Chip>
          {manifest.source === "sample" && <Chip tone="people">{t("lrn.sample")}</Chip>}
        </>} />

      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatTile label={t("lrn.s.lessons")} value={items.length} />
        <StatTile label={t("lrn.s.inUse")} value={<span className={active.length ? "text-up" : ""}>{active.length}</span>} sub={t("lrn.s.inUseSub")} tone="flat" />
        <StatTile label={t("lrn.s.retired")} value={items.length - active.length} sub={t("lrn.s.retiredSub")} tone="flat" />
        <StatTile label={t("lrn.s.who")} value={<span className="text-people">{t("lrn.s.people")}</span>} sub={t("lrn.s.peopleSub")} tone="flat" />
      </div>

      {items.length ? (
        <div className="mt-4 grid gap-3 md:mt-8 md:grid-cols-2 md:items-start md:gap-4">
          {items.map((l, i) => <Lesson key={l.id} l={l} n={i + 1} byId={byId} openKB={openKB} />)}
        </div>
      ) : (
        <EmptyState className="mt-4 md:mt-8" title={t("lrn.empty.title")}>{t("lrn.empty.body")}</EmptyState>
      )}

      <PipelineStrip variant="footer" className="mt-4 md:mt-8" title={t("lrn.born.title")} label={t("lrn.born.title")} steps={steps}
        active={steps.find((s) => s.state !== "done")?.id}
        trail={<span className="font-num text-[11.5px] font-bold tracking-[0.08em] text-ink-2 uppercase"><span className="text-desk">{t("lrn.born.count", { n: done })}</span></span>} />

      <p className="micro mt-6 text-center normal-case tracking-[0.04em]">{t("source", { what: "docs/learnings.json" })}</p>
    </Container>
  );
}

/** One lesson: its words, a meter of how its proof turned out, and the proof itself (tap to open in the Library). */
function Lesson({ l, n, byId, openKB }) {
  const retired = l.status !== "active";
  const count = { hit: 0, miss: 0, other: 0 };
  for (const id of l.evidence) {
    const v = byId[id]?.verdict;
    count[v === "hit" || v === "miss" ? v : "other"] += 1;
  }
  const total = l.evidence.length || 1;
  const hId = `lesson-${l.id}-h`;
  return (
    <Panel as="article" id={`lesson-${l.id}`} className={retired ? "border-dashed opacity-75" : ""}
      head={<div className="flex items-center gap-3">
        <span className={`font-num text-[34px] leading-none font-bold tracking-[-0.04em] ${retired ? "text-ink-3" : "text-desk"}`}>{pad2(n)}</span>
        <span className="min-w-0">
          <h3 id={hId} tabIndex={-1} className="font-num text-[12px] font-bold text-ink outline-none">{l.id}</h3>
          <span className="micro block">{t("lrn.added", { date: fmtShort(l.added) })}</span>
        </span>
      </div>}
      badge={<Chip tone={retired ? "ghost" : "up"}>{t.has(`lrn.status.${l.status}`) ? t(`lrn.status.${l.status}`) : l.status}</Chip>}>
      <p className="text-[17px] leading-snug font-medium tracking-[-0.01em] text-ink sm:text-[19px]">{l.lesson}</p>
      <div className="mt-4" aria-hidden="true">
        <span className="flex h-1.5 overflow-hidden rounded-full bg-line-2">
          <span className="bg-up" style={{ width: `${(count.hit / total) * 100}%` }} />
          <span className="bg-down" style={{ width: `${(count.miss / total) * 100}%` }} />
          <span className="bg-ink-3/60" style={{ width: `${(count.other / total) * 100}%` }} />
        </span>
      </div>
      <p className="font-num mt-1.5 text-[11.5px] text-ink-3">{t("lrn.meter", count)}</p>
      <p className="micro mt-3">{t("lrn.proof", { count: l.evidence.length })}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {l.evidence.map((id) => {
          const v = byId[id]?.verdict;
          return (
            <button key={id} type="button" onClick={() => openKB(id)} aria-label={t("lrn.open", { id })}
              className="chip min-h-[36px] border-line-2 bg-surface-2 text-ink-2 normal-case tracking-normal transition-colors hover:border-desk/60 hover:text-desk">
              <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[v] ?? "border border-dashed border-ink-3"}`} />
              {id}
              <span aria-hidden="true" className="text-ink-3">↗</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
