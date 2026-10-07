import { fmtDate, fmtPct, pad2 } from "../lib/format.js";
import { callStatus, edgarUrl, groupPeople, joinCalls, ownLinks, recordLine, shortVia } from "../lib/people.js";
import { Accent, ArrowRight, Chip, Container, Empty, Headline, Reveal, SectionHead, Strip } from "../components/ui.jsx";

const KIND = { investor: "investor", educator: "educator", writer: "writer", teacher: "teacher" };
const GROUPS = [
  ["investors", "Investors who show their moves", "Their funds file what they hold, so their calls can be logged and scored."],
  ["teachers", "Teachers and writers", "They teach how to think about value, risk and behaviour. No portfolio to score."],
  ["principles", "Principles only", "We keep their ideas. There are no new calls to track."],
];
const STATUS_CHIP = { right: "hit", wrong: "miss", maturing: "pending", unscored: "retired" };
const SOURCE_KIND = { "13f": "13F filing", letter: "letter", memo: "memo", interview: "interview", post: "post" };
// Plain words for the connectors this tab depends on (config/sources.json holds the details).
const CONNECT = {
  people: { cost: "Free", how: "Kept by hand." },
  holdings_13f: { cost: "Free and official", how: "Waiting for the household's decision." },
  x_accounts: { cost: "Costs money", how: "Parked until the household wants to spend." },
  news: { cost: "Costs money", how: "Parked until the household wants to spend." },
};
const ext = { target: "_blank", rel: "noopener noreferrer" };
const SECTIONS = [["use", "How we use them"], ["research", "The research"], ["who", "Who we follow"], ["calls", "Their calls"], ["connected", "What is connected"], ["add", "Add one"]];

const scrollTo = (id) => document.getElementById(`people-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function People({ data, go }) {
  const cfg = data.people;
  const sc = data.peopleScores;
  if (!cfg) {
    return <Container className="pt-20"><Empty title="No people file yet">config/people.json lists the people we learn from and their dated public calls.</Empty></Container>;
  }
  const judge = sc?.judge_at_weeks ?? 26;
  const minMatured = sc?.min_matured ?? 10;
  const records = Object.fromEntries((sc?.people ?? []).map((r) => [r.person, r]));
  const calls = joinCalls(cfg, sc);
  const byId = Object.fromEntries(cfg.people.map((p) => [p.id, p]));
  const groups = groupPeople(cfg.people);
  const following = cfg.people.filter((p) => p.status === "following");
  const matured = calls.filter((c) => c[`w${judge}`]).length;
  const anyEnough = (sc?.people ?? []).some((r) => r.enough);

  return (
    <Container className="pt-14">
      <Reveal className="eyebrow mb-4">
        People · v{cfg.version} · {fmtDate(cfg.updated_at)}{sc ? ` · scored to ${fmtDate(sc.as_of)}` : ""}
        {sc?.sample && <span className="pill ml-2 border-dashed border-people/60 text-people">sample prices</span>}
      </Reveal>
      <Headline size="xl" className="max-w-[14ch]">People we <Accent>learn from.</Accent></Headline>
      <Reveal delay={250} as="p" className="mt-6 max-w-[62ch] text-[clamp(17px,1.7vw,20px)] leading-relaxed text-ink-2">
        Following smart people is how we learn. Copying them is not a plan, so we write down what they said and when, and score it against the index like our own picks.
      </Reveal>
      <Reveal delay={350} as="nav" aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#people-${id}`} onClick={(e) => { e.preventDefault(); scrollTo(id); }}
            className="inline-flex min-h-[36px] items-center rounded-full border border-line-2 px-3.5 text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink">{label}</a>
        ))}
      </Reveal>

      <div className="mt-10">
        <Strip dense cells={[
          { value: following.length, label: "people we follow", desc: `Plus ${groups.principles.length} whose principles we keep.` },
          { value: calls.length, label: "public calls logged", desc: "Each with the date it became public and a link to the source." },
          { value: matured, label: "calls half a year old", tone: "flat", desc: `A call is judged ${judge} weeks after it became public.` },
          { value: minMatured, label: "needed to judge anyone", tone: "people", dashed: true, desc: anyEnough ? "Some records are long enough to read." : "Nobody has that many yet, so no record says anything yet." },
        ]} />
      </div>

      <HowWeUse cfg={cfg} />
      <Research cfg={cfg} />
      <Who groups={groups} records={records} judge={judge} minMatured={minMatured} />
      <Calls calls={calls} byId={byId} names={data.names} sc={sc} judge={judge} minMatured={minMatured} />
      <Connected sources={data.sources} cfg={cfg} />
      <AddOne repo={data.manifest.repo} go={go} />

      <p className="meta mt-16 normal-case tracking-[0.04em]">
        Source: config/people.json v{cfg.version}{sc ? `, data/people/scores.json (core ${sc.core}, weekly lines, no prices)` : ""}. We paraphrase and link; we never copy their text. Analysis only, not financial advice.
      </p>
    </Container>
  );
}

/* --------------------------------------------------------------- how we use */

function HowWeUse({ cfg }) {
  return (
    <section id="people-use" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow="How we use them" title={<>Learn from them. <Accent>Measure them.</Accent></>} size="md" lede={cfg.purpose} />
      <Reveal className="card p-3 sm:p-5">
        <ol className="grid md:grid-cols-2 md:gap-x-8">
          {cfg.how_we_use.map((x, i) => (
            <li key={i} className="flex gap-4 border-b border-line px-2 py-4 last:border-0 md:[&:nth-last-child(2)]:border-0">
              <span className="num shrink-0 font-mono text-[13px] text-accent">{pad2(i + 1)}</span>
              <span className="text-[15px] leading-relaxed">{x}</span>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

/* --------------------------------------------------------------- research */

function Research({ cfg }) {
  return (
    <section id="people-research" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow={`What the research says · ${cfg.evidence.length} findings`} title={<>Most influencers <Accent>don't help.</Accent></>} size="md"
        lede="What studies found about following people in public, and about copying what funds disclose. Each finding links to its source; the wording is ours." />
      <div className="grid gap-4 lg:grid-cols-2">
        {cfg.evidence.map((e, i) => (
          <Reveal key={e.url} delay={(i % 2) * 70} as="article" className="card flex flex-col p-6">
            <h3 className="text-[18px] font-semibold tracking-[-0.02em]">{e.topic}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{e.claim}</p>
            <a href={e.url} {...ext} className="mt-4 inline-flex items-start gap-1.5 border-t border-line pt-4 text-[13px] leading-snug text-ink-3 [overflow-wrap:anywhere] hover:text-accent">
              <span>{e.citation}</span><ArrowRight className="mt-0.5 size-3.5 shrink-0 -rotate-45" />
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- who */

function Who({ groups, records, judge, minMatured }) {
  return (
    <section id="people-who" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow="Who we follow" title={<>Why each one, <Accent>and the catch.</Accent></>} size="md"
        lede="What we learn from each person, where they publish, and what to be careful about. Links open the source in a new tab." />
      {GROUPS.map(([key, title, sub]) => groups[key].length > 0 && (
        <div key={key} className="mb-12">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h3>
            <span className="text-[14px] text-ink-3">{sub}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups[key].map((p, i) => <PersonCard key={p.id} p={p} rec={records[p.id]} i={i} judge={judge} minMatured={minMatured} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

function PersonCard({ p, rec, i, judge, minMatured }) {
  const links = ownLinks(p);
  const line = recordLine(p, rec, judge, minMatured);
  return (
    <Reveal delay={(i % 3) * 60} as="article" id={`person-${p.id}`} className={`card flex scroll-mt-28 flex-col p-6 ${p.status === "principles_only" ? "border-dashed" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill py-1 text-[11px] text-ink-2">{KIND[p.kind] ?? p.kind}</span>
        {p.status === "principles_only" && <Chip kind="retired" icon={false}>principles only</Chip>}
      </div>
      <h4 className="mt-3 text-[21px] font-semibold tracking-[-0.02em]">{p.name}</h4>
      <div className="meta mt-1 normal-case tracking-[0.02em]">{p.style}</div>
      <div className="mt-5"><div className="meta mb-1 text-accent">What we learn</div><p className="text-[15px] leading-relaxed">{p.learn}</p></div>
      <div className="mt-4"><div className="meta mb-1 text-people">Be careful</div><p className="text-[14.5px] leading-relaxed text-ink-2">{p.caution}</p></div>
      <div className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-[13.5px]">
        <i aria-hidden="true" className={`mt-[7px] inline-block size-1.5 shrink-0 rounded-full ${rec?.n ? "bg-people" : "bg-line-2"}`} />
        <span className={rec?.n ? "text-ink" : "text-ink-3"}>{line}</span>
      </div>
      <ul className="mt-4 grid gap-1 text-[13.5px]">
        {links.map((l) => <LinkRow key={l.url} href={l.url}>{l.label}</LinkRow>)}
        {p.x_handle && <LinkRow href={`https://x.com/${p.x_handle}`}>@{p.x_handle} on X</LinkRow>}
        {p.holdings_13f && <LinkRow href={edgarUrl(p.holdings_13f.cik)}>13F filings · {p.holdings_13f.filer}</LinkRow>}
      </ul>
    </Reveal>
  );
}

function LinkRow({ href, children }) {
  return (
    <li>
      <a href={href} {...ext} className="group flex min-h-[32px] items-start gap-1.5 py-1 text-ink-2 [overflow-wrap:anywhere] hover:text-accent">
        <ArrowRight className="mt-[3px] size-3.5 shrink-0 -rotate-45 text-ink-3 group-hover:text-accent" />
        <span>{children}</span>
      </a>
    </li>
  );
}

/* ------------------------------------------------------------------ calls */

const tone = (v) => (v == null ? "text-ink-3" : v >= 0 ? "text-accent" : "text-down");

/** One horizon: the signed excess ("for the call"), with the name's and the core's growth underneath. */
function Leg({ leg, weeks, since, ticker }) {
  if (!leg) {
    const left = since == null ? null : weeks - since;
    return <div className="text-[12.5px] text-ink-3">{left != null && left > 0 ? `in ${left} wk` : "–"}</div>;
  }
  return (
    <div className="min-w-0">
      <div className={`num font-mono text-[15px] ${tone(leg.signed_excess_pct)}`}>{fmtPct(leg.signed_excess_pct, 1)}<span className="ml-1.5 font-sans text-[11.5px] text-ink-3">for the call</span></div>
      <div className="num font-mono text-[11.5px] leading-snug text-ink-3"><div>{ticker} {fmtPct(leg.name_pct, 1)}</div><div>core {fmtPct(leg.core_pct, 1)}</div></div>
    </div>
  );
}

function Calls({ calls, byId, names, sc, judge, minMatured }) {
  const horizons = sc?.horizons_weeks ?? [13, 26, 52];
  return (
    <section id="people-calls" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow={`The ledger · ${calls.length} public ${calls.length === 1 ? "call" : "calls"}`} title={<>Their calls, <Accent>scored.</Accent></>} size="md"
        lede={<>Each call starts at the first weekly close <span className="text-ink">after</span> it became public, so nothing is counted before anyone could act on it. "For the call" is how much better the call did than simply holding the S&P 500 core; for a bearish call (a sale), the name falling behind the core counts in its favour. A call is judged at {judge} weeks, and a person needs {minMatured} judged calls before their record means anything.</>} />
      {calls.length === 0 ? (
        <Empty title="No calls logged yet">Add a call to config/people.json through a pull request: the date it became public, the person and fund, the name, bullish or bearish, a paraphrase of what they did and a link to the source. The next daily run scores it.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          {calls.map((c) => <CallCard key={c.id} c={c} p={byId[c.person]} name={names[c.ticker]} judge={judge} horizons={horizons} />)}
        </div>
      )}
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        Percent changes from the weekly indexed lines; no prices are published. The weekly points fall every five trading days, so a call can start up to a week after its public date. A 13F call is the fund's, not necessarily the named person's own pick.
      </p>
    </section>
  );
}

/** One call: a stacked card on phones; on wide screens the call on the left and its numbers on the right. */
function CallCard({ c, p, name, judge, horizons }) {
  const st = callStatus(c, judge);
  return (
    <Reveal as="article" className="card min-w-0 p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-10">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3">
          <span className="meta num">public {c.date}</span>
          <span className="lg:hidden"><Chip kind={STATUS_CHIP[st.kind]}>{st.label}</Chip></span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[24px] leading-none font-medium tracking-[-0.02em]">{c.ticker}</span>
          <Chip kind={c.stance}>{c.stance}</Chip>
          <span className="text-[14px] text-ink-2">{name ?? ""}</span>
        </div>
        <div className="mt-3 text-[14px]"><span className="font-medium">{p?.name ?? c.person}</span> <span className="text-ink-3" title={c.via}>via {shortVia(c.via)}</span></div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{c.what}</p>
        {c.note && <p className="mt-2 text-[13px] leading-snug text-people">{c.note}</p>}
        <a href={c.source_url} {...ext} className="mt-3 inline-flex min-h-[36px] items-center gap-1 self-start text-[13.5px] text-ink-2 hover:text-accent">Source: {SOURCE_KIND[c.source_kind] ?? c.source_kind} <ArrowRight className="size-3.5 -rotate-45" /></a>
      </div>
      <div className="mt-4 min-w-0 border-t border-line pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        <div className="mb-3 hidden items-center gap-3 lg:flex">
          <Chip kind={STATUS_CHIP[st.kind]}>{st.label}</Chip>
          <span className="text-[12.5px] text-ink-3">{st.kind === "maturing" ? `${st.detail}; judged at ${judge} weeks` : st.kind === "unscored" ? "" : `judged at ${judge} weeks`}</span>
        </div>
        {c.scored ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
              <div className="min-w-0"><div className="meta mb-1">So far · {c.weeks_since} wk</div><Leg leg={c.so_far} ticker={c.ticker} /></div>
              {horizons.map((w) => <div key={w} className="min-w-0"><div className="meta mb-1">{w} weeks</div><Leg leg={c[`w${w}`]} weeks={w} since={c.weeks_since} ticker={c.ticker} /></div>)}
            </div>
            <p className="mt-3 text-[12px] text-ink-3">Counted from the weekly close of {c.start_date}.</p>
          </>
        ) : (
          <p className="text-[13px] text-ink-3">Not scored: {st.detail}.</p>
        )}
      </div>
    </Reveal>
  );
}

/* -------------------------------------------------------------- connected */

function Connected({ sources, cfg }) {
  const list = ["people", "holdings_13f", "x_accounts", "news"].map((id) => sources.sources.find((s) => s.id === id)).filter(Boolean);
  return (
    <section id="people-connected" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow={`Connectors · sources v${sources.version}`} title={<>What is <Accent>connected.</Accent></>} size="md"
        lede="The people list and their calls are kept by hand, which is free. SEC EDGAR's 13F filings are free and official but not connected: the household decides before any provider is connected. X accounts and news feeds cost money, so they stay parked." />
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((s) => {
          const c = CONNECT[s.id] ?? {};
          const live = s.status === "active";
          return (
            <Reveal key={s.id} className={`card p-6 ${live ? "" : "border-dashed"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Chip kind={live ? "active" : "planned"} icon={false}>{live ? (s.provider === "manual" ? "by hand" : "connected") : "not connected"}</Chip>
                {c.cost && <span className={`meta ${c.cost === "Costs money" ? "text-down" : "text-accent"}`}>{c.cost}</span>}
              </div>
              <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">{s.label}</h3>
              {c.how && <p className="mt-2 text-[15px] leading-relaxed">{c.how}</p>}
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.note}</p>
              {s.id === "x_accounts" && s.follow.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.follow.map((h) => <a key={h} href={`https://x.com/${h}`} {...ext} className="rounded-full border border-line-2 px-2.5 py-1 font-mono text-[12px] text-ink-2 hover:border-ink-3 hover:text-ink">@{h}</a>)}
                </div>
              )}
              <div className="meta mt-4 normal-case tracking-[0.04em]">{s.cadence}{s.id === "people" ? ` · ${cfg.people.length} people, ${cfg.calls.length} calls` : ""}</div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- add one */

const CALL_FIELDS = [
  ["id", "the public date, the fund and the ticker, e.g. 2026-08-14-fund-ticker"],
  ["person", "the person's id from the people list"],
  ["via", "the fund or firm the call came from, as named on the source"],
  ["date", "the day it became public (for a 13F, its filing date)"],
  ["ticker", "a name on our list; other names are kept but not scored"],
  ["stance", "bullish (bought or added) or bearish (sold out or argued against)"],
  ["what", "one sentence in our own words"],
  ["source_kind and source_url", "13f, letter, memo, interview or post, and the link"],
];

function AddOne({ repo, go }) {
  const edit = `https://github.com/${repo}/edit/main/config/people.json`;
  return (
    <section id="people-add" className="scroll-mt-28 pt-24">
      <SectionHead eyebrow="How to" title={<>Add a person <Accent>or a call.</Accent></>} size="md"
        lede="Everything here lives in one file, config/people.json, changed through a pull request. Lint checks it before it is merged, and the next daily run scores any new call."
        right={<a href={edit} {...ext} className="btn">Edit people.json <ArrowRight className="size-4 -rotate-45" /></a>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="card p-6">
          <div className="meta mb-3">A person</div>
          <ul className="grid gap-2 text-[14.5px] leading-relaxed text-ink-2">
            <li className="flex gap-2"><span className="text-accent">–</span><span>Why we follow them, what we learn, and a fair caution.</span></li>
            <li className="flex gap-2"><span className="text-accent">–</span><span>Links only to where they publish themselves or to official pages; an X handle only if it is confirmed.</span></li>
            <li className="flex gap-2"><span className="text-accent">–</span><span>If their fund files a 13F, the filer's name and its SEC number (CIK).</span></li>
            <li className="flex gap-2"><span className="text-accent">–</span><span>Facts about a real person only from primary or official sources.</span></li>
          </ul>
        </Reveal>
        <Reveal className="card p-6">
          <div className="meta mb-3">A call</div>
          <dl className="grid gap-2 text-[14px] leading-relaxed">
            {CALL_FIELDS.map(([k, v]) => (
              <div key={k} className="grid gap-x-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="font-mono text-[12.5px] text-ink">{k}</dt>
                <dd className="text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
      <Reveal className="card mt-4 border-people/40 p-5 text-[14.5px] leading-relaxed text-ink-2 sm:p-6">
        <span className="text-people">Paraphrase, always.</span> The repo is public: write what they did in our own words and link to the source; never paste their text. A call needs the date it became public and a source anyone can open.
        No money follows a call on its own: the brain may read it only as context. See <button type="button" onClick={() => go("how")} className="text-ink underline-offset-4 hover:underline">How it works</button> for the daily loop.
      </Reveal>
    </section>
  );
}

