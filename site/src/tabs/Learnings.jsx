import { fmtDate, pad2 } from "../lib/format.js";
import { Accent, ArrowRight, Chip, Container, Empty, Reveal, SectionHead, Strip } from "../components/ui.jsx";

export default function Learnings({ data, openKB }) {
  const { learnings, outcomes, manifest } = data;
  const items = learnings.items;
  const active = items.filter((l) => l.status === "active");
  const evidence = new Set(items.flatMap((l) => l.evidence));
  const byId = Object.fromEntries(outcomes.map((o) => [o.pick_id, o]));

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={`Learnings · v${learnings.version}`}
        title={<>What the record <Accent>taught.</Accent></>}
        lede="Lessons come from scored outcomes, never from the model's own opinion. A person adds them through a pull request, each with evidence. The brain reads only the active ones."
      />
      <Strip
        cells={[
          { value: items.length, label: "lessons", desc: `Updated ${fmtDate(learnings.updated_at)}.` },
          { value: active.length, label: "active", desc: "Fed to the packer on every run." },
          { value: items.length - active.length, label: "retired", tone: "flat", desc: "Kept for history and never read by the brain." },
          { value: "You", label: "write them", tone: "people", dashed: true, desc: "The model proposes nothing here. People decide." },
        ]}
      />
      <div className="mt-10 grid gap-5">
        {items.length === 0 && <Empty title="No lessons yet">Lessons are added once enough picks have been scored to show a pattern.</Empty>}
        {items.map((l, i) => (
          <Reveal key={l.id} delay={i * 80} as="article" className={`card grid gap-6 p-7 sm:p-9 md:grid-cols-[180px_minmax(0,1fr)] ${l.status === "retired" ? "border-dashed opacity-70" : "card-hover"}`}>
            <div>
              <div className="display text-[72px] leading-[0.85] tracking-[-0.06em]">{pad2(i + 1)}</div>
              <div className="meta mt-3">{l.id} · {l.added}</div>
            </div>
            <div className="min-w-0">
              <Chip kind={l.status} icon={false}>{l.status}</Chip>
              <p className="mt-4 text-[clamp(18px,2vw,23px)] leading-snug font-medium tracking-[-0.02em]">{l.lesson}</p>
              <div className="mt-6 border-t border-line pt-5">
                <div className="meta mb-3">Evidence · {l.evidence.length} {l.evidence.length === 1 ? "pick" : "picks"}</div>
                <div className="flex flex-wrap gap-2">
                  {l.evidence.map((id) => {
                    const o = byId[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => openKB(id)}
                        className="group inline-flex items-center gap-2 rounded-full border border-line-2 px-3 py-1.5 font-mono text-[12px] text-ink-2 transition hover:border-accent hover:text-accent"
                      >
                        {o && <span className={`size-1.5 rounded-full ${o.verdict === "hit" ? "bg-accent" : o.verdict === "miss" ? "bg-down" : "bg-flat"}`} />}
                        {id}
                        <ArrowRight className="size-3 -rotate-45 opacity-0 transition group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="meta mt-10 text-center normal-case tracking-[0.04em]">
        Source: docs/learnings.json{manifest.source === "sample" ? " (sample lessons shown until live data exists)" : ""}
      </Reveal>
    </Container>
  );
}
