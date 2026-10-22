import { pad2, fmtDate } from "../lib/format.js";
import dict from "../text/learn.js";
import { Accent, ArrowRight, Chip, Container, Empty, Reveal, SectionHead, Strip } from "../components/ui.jsx";
import { strings } from "../lib/text.js";

export default function Learnings({ data, openKB }) {
  const { learnings, outcomes, manifest } = data;
  const items = learnings.items;
  const active = items.filter((l) => l.status === "active");
  const evidence = new Set(items.flatMap((l) => l.evidence));
  const byId = Object.fromEntries(outcomes.map((o) => [o.pick_id, o]));
  const t = strings(dict);

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={t("lrn.eyebrow", { v: learnings.version })}
        title={<>{t("lrn.title.a")} <Accent>{t("lrn.title.b")}</Accent></>}
        lede={<>
          <span className="block text-ink">{t("lrn.lede1")}</span>
          <span className="mt-3 block">{t("lrn.lede2")}</span>
        </>}
      />
      <Strip
        cells={[
          { value: items.length, label: t("lrn.s.lessons"), desc: t("lrn.s.updated", { date: fmtDate(learnings.updated_at) }) },
          { value: active.length, label: t("lrn.s.inUse"), desc: t("lrn.s.inUseDesc") },
          { value: items.length - active.length, label: t("lrn.s.retired"), tone: "flat", desc: t("lrn.s.retiredDesc") },
          { value: t("lrn.s.people"), label: t("lrn.s.write"), tone: "people", dashed: true, desc: t("lrn.s.writeDesc") },
        ]}
      />
      <div className="mt-10 grid gap-5">
        {items.length === 0 && <Empty title={t("lrn.empty.title")}>{t("lrn.empty.body")}</Empty>}
        {items.map((l, i) => (
          <Reveal key={l.id} delay={i * 80} as="article" className={`card grid gap-6 p-7 sm:p-9 md:grid-cols-[180px_minmax(0,1fr)] ${l.status === "retired" ? "border-dashed opacity-70" : "card-hover"}`}>
            <div>
              <div className="display text-[72px] leading-[0.85]">{pad2(i + 1)}</div>
              <div className="meta mt-3">{l.id} · {l.added}</div>
            </div>
            <div className="min-w-0">
              <Chip kind={l.status} icon={false}>{t.has(`lrn.status.${l.status}`) ? t(`lrn.status.${l.status}`) : l.status}</Chip>
              <p className="mt-4 text-[clamp(18px,2vw,23px)] leading-snug font-medium tracking-[-0.02em]">{l.lesson}</p>
              <div className="mt-6 border-t border-line pt-5">
                <div className="meta mb-3">{t("lrn.proof", { count: l.evidence.length })}</div>
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
        {t("source", { what: "docs/learnings.json" })}{manifest.source === "sample" ? t("lrn.sample") : ""}
      </Reveal>
    </Container>
  );
}
