import { Accent, Container, SectionHead } from "../components/ui.jsx";
import { VerdictHistory } from "../components/verdict.jsx";

/** Every daily brain run in plain words: what it decided, and what changed since the run before. */
export default function Verdicts({ data }) {
  return (
    <Container className="max-w-[760px] pt-20 pb-24">
      <SectionHead eyebrow="The brain's verdicts" size="md"
        title={<>Every run, <Accent>in plain words.</Accent></>}
        lede="The brain reads the market every morning after a US close and makes its own call. Each run is below, newest first: what it decided, what changed since the run before, and for each name why, and what would prove it wrong. All of it is on paper only." />
      <VerdictHistory data={data} />
    </Container>
  );
}
