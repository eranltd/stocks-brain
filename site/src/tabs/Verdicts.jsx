import { Container } from "../components/ui.jsx";
import { VerdictPage } from "../components/verdict.jsx";

/** The brain's verdicts: what the super-smart machine decided, told like to a five-year-old. */
export default function Verdicts({ data, go }) {
  return (
    <Container className="max-w-[720px] pt-6 pb-24 sm:pt-8">
      <h1 className="display mb-2 text-[clamp(34px,9vw,52px)] leading-[1.02] tracking-[-0.03em]">What the <span style={{ color: "var(--ai)" }}>brain</span> says</h1>
      <p className="mb-8 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">Every morning a smart computer program reads the whole market and makes up its mind about our stocks. Here is what it decided, told simply.</p>
      <VerdictPage data={data} go={go} />
    </Container>
  );
}
