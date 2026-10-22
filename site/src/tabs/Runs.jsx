import dict from "../text/learn.js";
import { CostChart } from "../components/charts.jsx";
import { Accent, Chip, Container, Reveal, SectionHead, Strip } from "../components/ui.jsx";
import { strings } from "../lib/text.js";
import { fmtUsd, fmtNum, fmtK } from "../lib/format.js";

export default function Runs({ data }) {
  const { shownRuns: runs, settings } = data;
  const ok = runs.filter((r) => r.status === "ok");
  const total = runs.reduce((a, r) => a + r.cost.usd, 0);
  const avg = ok.length ? ok.reduce((a, r) => a + r.cost.usd, 0) / ok.length : 0;
  const mins = ok.length ? ok.reduce((a, r) => a + r.duration_minutes, 0) / ok.length : 0;
  const over = ok.filter((r) => r.cost.usd > settings.cost.warn_usd).length;
  const failed = runs.length - ok.length;
  const t = strings(dict);
  const TH = ["morning", "result", "cost", "minutes", "pack", "guesses", "versions", "fingerprint"];

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow={t("runs.eyebrow")}
        title={<>{t("runs.title.a")} <Accent>{t("runs.title.b")}</Accent></>}
        lede={<>
          <span className="block text-ink">{t("runs.lede1")}</span>
          <span className="mt-3 block">{t("runs.lede2")}</span>
        </>}
        right={<span className="meta">{t("runs.logged", { n: runs.length })}</span>}
      />
      <Strip
        cells={[
          { value: fmtUsd(avg), label: t("runs.s.avg"), tone: avg > settings.cost.target_usd ? "people" : "accent", desc: t("runs.s.avgDesc", { usd: fmtUsd(settings.cost.target_usd) }) },
          { value: fmtUsd(total), label: t("runs.s.total", { n: runs.length }), tone: "flat", desc: t("runs.s.over", { count: over, usd: fmtUsd(settings.cost.warn_usd) }) },
          { value: fmtNum(mins, 1), label: t("runs.s.mins"), tone: "flat", desc: t("runs.s.minsDesc") },
          { value: failed, label: t("runs.s.stopped"), tone: failed ? "down" : "accent", desc: t("runs.s.stoppedDesc") },
        ]}
      />

      <Reveal className="card mt-6 p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{t("runs.chart.title")}</h3>
          <div className="flex flex-wrap gap-4 text-[12.5px] text-ink-2">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ink-3" />{t("runs.chart.under")}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-people" />{t("runs.chart.over")}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-down" />{t("runs.chart.stopped")}</span>
          </div>
        </div>
        <CostChart runs={runs} cost={settings.cost} />
      </Reveal>

      <Reveal className="card mt-6 overflow-hidden">
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[880px] text-[13.5px]">
            <thead>
              <tr className="meta border-b border-line text-start">
                {TH.map((h, i) => (
                  <th key={h} className={`px-5 py-4 font-medium ${[2, 3, 5].includes(i) ? "text-end" : ""}`}>{t(`runs.th.${h}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r) => (
                <tr key={r.run_id} className="border-b border-line transition-colors last:border-0 hover:bg-ink/[0.03]" title={r.failure_reason}>
                  <td className="px-5 py-3.5 font-mono">{r.date}</td>
                  <td className="px-5 py-3.5"><Chip kind={r.status} icon={false} className="py-1 text-[11px]">{t.has(`runs.status.${r.status}`) ? t(`runs.status.${r.status}`) : r.status}{r.repair_retries ? t("runs.retry") : ""}</Chip></td>
                  <td className={`num px-5 py-3.5 text-end font-mono ${r.cost.usd > settings.cost.warn_usd ? "text-people" : ""}`}>{fmtUsd(r.cost.usd)}</td>
                  <td className="num px-5 py-3.5 text-end font-mono text-ink-2">{fmtNum(r.duration_minutes, 1)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-20 overflow-hidden rounded bg-line">
                        <div className={`h-full rounded ${r.pack.tokens > r.pack.cap_tokens ? "bg-down" : "bg-accent"}`} style={{ width: `${Math.min(100, (r.pack.tokens / r.pack.cap_tokens) * 100)}%` }} />
                      </div>
                      <span className="num font-mono text-[12px] text-ink-3">{fmtK(r.pack.tokens)}/{fmtK(r.pack.cap_tokens)}</span>
                    </div>
                  </td>
                  <td className="num px-5 py-3.5 text-end font-mono">{r.picks.length}</td>
                  <td className="px-5 py-3.5 font-mono text-[12px] text-ink-3">
                    <span>s{r.doc_versions.strategy} g{r.doc_versions.guardrails} m{r.doc_versions.methodology} l{r.doc_versions.learnings}</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[12px] text-ink-3">{r.pack.hash.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Container>
  );
}
