import { Container } from "../components/ui.jsx";
import { VerdictPage } from "../components/verdict.jsx";
import { useT } from "../lib/lang.jsx";
import dict from "../i18n/plan.js";

/** The brain's verdicts: what the super-smart machine decided, told like to a five-year-old. Texts: i18n/plan.js "vt.*". */
export default function Verdicts({ data, go }) {
  const t = useT(dict);
  return (
    <Container className="max-w-[720px] pt-6 pb-24 sm:pt-8">
      <h1 className="display mb-2 text-[clamp(34px,9vw,52px)] leading-[1.02] tracking-[-0.03em]">{t.rich("vt.title", { brain: <span style={{ color: "var(--ai)" }}>{t("vt.brain")}</span> })}</h1>
      <p className="mb-8 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">{t("vt.lede")}</p>
      <VerdictPage data={data} go={go} />
    </Container>
  );
}
