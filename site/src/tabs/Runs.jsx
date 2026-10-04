import { fmtK, fmtNum, fmtUsd } from "../lib/format.js";
import { CostChart } from "../components/charts.jsx";
import { Accent, Chip, Container, Reveal, SectionHead, Strip } from "../components/ui.jsx";

export default function Runs({ data }) {
  const { shownRuns: runs, settings } = data;
  const ok = runs.filter((r) => r.status === "ok");
  const total = runs.reduce((a, r) => a + r.cost.usd, 0);
  const avg = ok.length ? ok.reduce((a, r) => a + r.cost.usd, 0) / ok.length : 0;
  const mins = ok.length ? ok.reduce((a, r) => a + r.duration_minutes, 0) / ok.length : 0;
  const over = ok.filter((r) => r.cost.usd > settings.cost.warn_usd).length;
  const failed = runs.length - ok.length;

  return (
    <Container className="pt-20">
      <SectionHead
        eyebrow="Runs"
        title={<>Every call, <Accent>on the record.</Accent></>}
        lede={`One model call per day. Each run records its cost, minutes, pack hash and the doc versions it read. Over ${fmtUsd(settings.cost.hard_cap_usd)} projected, or over the token cap, the run stops before calling the model.`}
        right={<span className="meta">{runs.length} logged</span>}
      />
      <Strip
        cells={[
          { value: fmtUsd(avg), label: "avg per run", tone: avg > settings.cost.target_usd ? "people" : "accent", desc: `Target under ${fmtUsd(settings.cost.target_usd)}.` },
          { value: fmtUsd(total), label: `last ${runs.length} runs`, tone: "flat", desc: `${over} ${over === 1 ? "run" : "runs"} above the ${fmtUsd(settings.cost.warn_usd)} warning.` },
          { value: fmtNum(mins, 1), label: "avg minutes", tone: "flat", desc: "Wall time from pack to record." },
          { value: failed, label: "failed closed", tone: failed ? "down" : "accent", desc: "Stopped on a cap or a schema check, by design." },
        ]}
      />

      <Reveal className="card mt-6 p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-[19px] font-semibold tracking-[-0.02em]">Cost per run</h3>
          <div className="flex flex-wrap gap-4 text-[12.5px] text-ink-2">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ink-3" />within warning</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-people" />over warning</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-down" />failed</span>
          </div>
        </div>
        <CostChart runs={runs} cost={settings.cost} />
      </Reveal>

      <Reveal className="card mt-6 overflow-hidden">
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[880px] text-[13.5px]">
            <thead>
              <tr className="meta border-b border-line text-left">
                {["Run", "Status", "Cost", "Minutes", "Pack", "Picks", "Docs", "Hash"].map((h, i) => (
                  <th key={h} className={`px-5 py-4 font-medium ${[2, 3, 5].includes(i) ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r) => (
                <tr key={r.run_id} className="border-b border-line transition-colors last:border-0 hover:bg-ink/[0.03]" title={r.failure_reason}>
                  <td className="px-5 py-3.5 font-mono">{r.date}</td>
                  <td className="px-5 py-3.5"><Chip kind={r.status} icon={false} className="py-1 text-[11px]">{r.status}{r.repair_retries ? " · retry" : ""}</Chip></td>
                  <td className={`num px-5 py-3.5 text-right font-mono ${r.cost.usd > settings.cost.warn_usd ? "text-people" : ""}`}>{fmtUsd(r.cost.usd)}</td>
                  <td className="num px-5 py-3.5 text-right font-mono text-ink-2">{fmtNum(r.duration_minutes, 1)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-20 overflow-hidden rounded bg-line">
                        <div className={`h-full rounded ${r.pack.tokens > r.pack.cap_tokens ? "bg-down" : "bg-accent"}`} style={{ width: `${Math.min(100, (r.pack.tokens / r.pack.cap_tokens) * 100)}%` }} />
                      </div>
                      <span className="num font-mono text-[12px] text-ink-3">{fmtK(r.pack.tokens)}/{fmtK(r.pack.cap_tokens)}</span>
                    </div>
                  </td>
                  <td className="num px-5 py-3.5 text-right font-mono">{r.picks.length}</td>
                  <td className="px-5 py-3.5 font-mono text-[12px] text-ink-3">
                    s{r.doc_versions.strategy} g{r.doc_versions.guardrails} m{r.doc_versions.methodology} l{r.doc_versions.learnings}
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
