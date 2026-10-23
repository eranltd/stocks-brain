import { Container } from "../components/ui.jsx";
import { VerdictPage } from "../components/verdict.jsx";

/**
 * The Brain: what the daily brain decided, as paper calls, and how its paper bets have done. The page itself (hero,
 * numbers, today's call, the weekly bet, the ledger, the real-money week) is components/verdict.jsx; texts: text/plan.js.
 */
export default function Verdicts({ data, go }) {
  return (
    <Container className="pt-6 pb-24 sm:pt-10">
      <VerdictPage data={data} go={go} />
    </Container>
  );
}
