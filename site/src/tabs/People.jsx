import { fmtDate, fmtPct, pad2 } from "../lib/format.js";
import { callerName, callStatus, edgarUrl, groupPeople, isFirmCall, joinCalls, ownLinks, recordLine, shortVia } from "../lib/people.js";
import { Accent, ArrowRight, Chip, Container, Empty, Headline, Reveal, SectionHead, Strip } from "../components/ui.jsx";

const KIND = { investor: "investor", educator: "educator", writer: "writer", teacher: "teacher" };
const GROUPS = [
  ["investors", "Investors whose funds file what they hold", "So their funds' moves can be scored."],
  ["teachers", "Teachers and writers", "How to think about value, risk and behaviour."],
  ["principles", "Principles only", "We keep their ideas; no new calls to track."],
];
const STATUS_CHIP = { right: "hit", wrong: "miss", maturing: "pending", unscored: "retired" };
const SOURCE_KIND = { "13f": "13F filing", letter: "letter", memo: "memo", interview: "interview", post: "post" };
// Plain words for the household about each connector this tab depends on (Admin keeps the technical notes).
const CONNECT = {
  people: { cost: "Free", what: "We add each call by hand from its public source, in our own words, and code scores it against the S&P 500 core." },
  holdings_13f: { cost: "Free and official", what: "What big funds own, from their SEC filings, about forty-five days after each quarter. Off until the household says so." },
  x_accounts: { cost: "Costs money", what: "Posts from the people we follow. Off; if it is ever on, we keep links only, never their words." },
  news: { cost: "Costs money", what: "Headlines about the names on our list. Off." },
};
const ext = { target: "_blank", rel: "noopener noreferrer" };
const SECTIONS = [["calls", "Their calls"], ["who", "Who we follow"], ["use", "How we use them"], ["research", "The research"], ["connected", "What is connected"], ["add", "Add one"]];
const day = (iso) => fmtDate(iso).replace(/^\w+, /, ""); // "15 May 2026", as on Today
const SECTION = "scroll-mt-28 pt-12 sm:pt-24";

const scrollTo = (id) => document.getElementById(`people-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** The small "open" marker of a disclosure row: a plus that turns into a minus. */
function Toggle({ children }) {
  return (
    <span className="meta inline-flex shrink-0 items-center gap-1.5 text-ink-3 group-hover:text-ink">
      {children}
      <span aria-hidden="true" className="inline-block w-3 text-center font-mono text-[14px] leading-none group-open:hidden">+</span>
      <span aria-hidden="true" className="hidden w-3 text-center font-mono text-[14px] leading-none group-open:inline-block">−</span>
    </span>
  );
}

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
        Following smart people is how we learn. Copying them is not a plan, so we write down what they did and when, and score it against the index like our own picks.
      </Reveal>
      <Reveal delay={350} as="nav" aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#people-${id}`} onClick={(e) => { e.preventDefault(); scrollTo(id); }}
            className="inline-flex min-h-[36px] items-center rounded-full border border-line-2 px-3.5 text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink">{label}</a>
        ))}
      </Reveal>

      <div className="mt-8">
        <Strip dense cells={[
          { value: following.length, label: "people we follow", desc: `Plus ${groups.principles.length} whose principles we keep.` },
          { value: calls.length, label: "public calls logged", desc: "Each with the date it became public and a link to the source." },
          { value: matured, label: "calls half a year old", tone: "flat", desc: `A call is judged ${judge} weeks after it became public.` },
          { value: minMatured, label: "needed to judge anyone", tone: "people", dashed: true, desc: anyEnough ? "Some records are long enough to read." : "Nobody has that many yet, so no record says anything yet." },
        ]} />
      </div>

      <Calls calls={calls} byId={byId} names={data.names} sc={sc} judge={judge} minMatured={minMatured} />
      <Who groups={groups} records={records} calls={calls} judge={judge} minMatured={minMatured} />
      <HowWeUse cfg={cfg} />
      <Research cfg={cfg} />
      <Connected sources={data.sources} cfg={cfg} />
      <AddOne repo={data.manifest.repo} go={go} />

      <p className="meta mt-16 normal-case tracking-[0.04em]">
        Source: config/people.json v{cfg.version}{sc ? `, data/people/scores.json (core ${sc.core}, percentages from daily closes, no prices)` : ""}. We paraphrase and link; we never copy their text. Analysis only, not financial advice.
      </p>
    </Container>
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
    <section id="people-calls" className={SECTION}>
      <SectionHead eyebrow={`The ledger · ${calls.length} public ${calls.length === 1 ? "call" : "calls"}`} title={<>Their calls, <Accent>scored.</Accent></>} size="md"
        lede={<>Each call counts from the first trading day <span className="text-ink">after</span> it became public. "For the call" is how much better it did than holding the S&P 500 core; for a sale, the name lagging counts in its favour. Judged at {judge} weeks; a record needs {minMatured} judged calls. Tap a call for the details.</>} />
      {calls.length === 0 ? (
        <Empty title="No calls logged yet">Add a call to config/people.json through a pull request: the date it became public, the person and fund, the name, bullish or bearish, a paraphrase of what they did and a link to the source. The next daily run scores it.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {calls.map((c) => <CallRow key={c.id} c={c} p={byId[c.person]} name={names[c.ticker]} judge={judge} horizons={horizons} />)}
        </div>
      )}
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        Percent changes from daily closes; no prices are published. A 13F call is the fund's book, not necessarily the named person's own pick; calls marked as the firm's count for the fund only.
      </p>
    </section>
  );
}

/** One call: a compact row (name, stance, verdict, who and when, how it did vs the core); the details open on a tap. */
function CallRow({ c, p, name, judge, horizons }) {
  const st = callStatus(c, judge);
  const firm = isFirmCall(c);
  const sf = c.so_far;
  const judged = c[`w${judge}`];
  const pct = (v) => <span className={`num font-mono ${tone(v)}`}>{fmtPct(v, 1)}</span>;
  return (
    <Reveal as="article" className="card min-w-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-1.5 px-4 py-3.5 sm:p-5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[20px] leading-none font-medium tracking-[-0.02em]">{c.ticker}</span>
            <Chip kind={c.stance}>{c.stance}</Chip>
            <span className="ml-auto flex items-center gap-2"><Chip kind={STATUS_CHIP[st.kind]}>{st.label}</Chip><Toggle /></span>
          </div>
          <div className="text-[13.5px] leading-snug text-ink-2">
            <span className="text-ink">{callerName(c, p)}</span>
            {firm ? " · the firm's call" : <span title={c.via}> via {shortVia(c.via)}</span>}
            <span className="text-ink-3"> · {c.source_kind === "13f" ? "13F filed" : "public"} {day(c.date)}</span>
          </div>
          <div className="text-[13.5px] leading-snug text-ink-3">
            {!c.scored ? `Not scored: ${st.detail}.`
              : judged ? <>At {judge} weeks {pct(judged.signed_excess_pct)} for the call{sf ? <>; so far {pct(sf.signed_excess_pct)}</> : null}</>
              : sf ? <>So far {pct(sf.signed_excess_pct)} for the call · {c.weeks_since} of {judge} weeks</>
              : "Too new to measure yet."}
          </div>
        </summary>
        <div className="border-t border-line px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
          {name && <div className="text-[13.5px] text-ink">{name}</div>}
          <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{c.what}</p>
          {c.note && <p className="mt-2 text-[13px] leading-snug text-people">{c.note}</p>}
          {c.scored && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0"><div className="meta mb-1">So far · {c.weeks_since} wk</div><Leg leg={sf} ticker={c.ticker} /></div>
                {horizons.map((w) => <div key={w} className="min-w-0"><div className="meta mb-1">{w} weeks</div><Leg leg={c[`w${w}`]} weeks={w} since={c.weeks_since} ticker={c.ticker} /></div>)}
              </div>
              <p className="mt-3 text-[12px] text-ink-3">Counted from the close of {day(c.start_date)}, the first trading day after it became public; judged at {judge} weeks.</p>
            </>
          )}
          <a href={c.source_url} {...ext} className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-[13.5px] text-ink-2 hover:text-accent">Source: {SOURCE_KIND[c.source_kind] ?? c.source_kind} <ArrowRight className="size-3.5 -rotate-45" /></a>
        </div>
      </details>
    </Reveal>
  );
}

/* -------------------------------------------------------------------- who */

function Who({ groups, records, calls, judge, minMatured }) {
  return (
    <section id="people-who" className={SECTION}>
      <SectionHead eyebrow="Who we follow" title={<>Why each one, <Accent>and the catch.</Accent></>} size="md"
        lede="What we learn from each one and what to be careful about. Tap a card for the full text and their links." />
      {GROUPS.map(([key, title, sub]) => groups[key].length > 0 && (
        <div key={key} className="mb-8 sm:mb-10">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="text-[18px] font-semibold tracking-[-0.02em] sm:text-[22px]">{title}</h3>
            <span className="text-[14px] text-ink-3">{sub}</span>
          </div>
          {key === "principles" ? (
            <div className="card divide-y divide-line">
              {groups[key].map((p) => <PrinciplesRow key={p.id} p={p} />)}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groups[key].map((p, i) => (
                <PersonCard key={p.id} p={p} rec={records[p.id]} i={i} judge={judge} minMatured={minMatured} group={key}
                  firmCalls={calls.filter((c) => c.person === p.id && isFirmCall(c))} />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function personLinks(p) {
  return [
    ...ownLinks(p).map((l) => ({ href: l.url, label: l.label })),
    ...(p.x_handle ? [{ href: `https://x.com/${p.x_handle}`, label: `@${p.x_handle} on X` }] : []),
    ...(p.holdings_13f ? [{ href: edgarUrl(p.holdings_13f.cik), label: `13F filings · ${p.holdings_13f.filer}` }] : []),
  ];
}

function PersonCard({ p, rec, i, judge, minMatured, firmCalls, group }) {
  const links = personLinks(p);
  const hasRecord = rec?.n || firmCalls.length || p.holdings_13f;
  return (
    <Reveal delay={(i % 3) * 60} as="article" id={`person-${p.id}`} className="card min-w-0 scroll-mt-28">
      <details className="group">
        <summary className="block cursor-pointer list-none px-4 py-3.5 sm:p-5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="min-w-0 text-[19px] font-semibold tracking-[-0.02em]">{p.name}</h4>
            <Toggle>{links.length} {links.length === 1 ? "link" : "links"}</Toggle>
          </div>
          <div className="meta mt-0.5 normal-case tracking-[0.02em]">{group === "investors" ? "" : `${KIND[p.kind] ?? p.kind} · `}{p.style}</div>
          {hasRecord && (
            <div className="mt-2 flex items-start gap-2 text-[13.5px] leading-snug">
              <i aria-hidden="true" className={`mt-[6px] inline-block size-1.5 shrink-0 rounded-full ${rec?.n || firmCalls.length ? "bg-people" : "bg-line-2"}`} />
              <span className={rec?.n || firmCalls.length ? "text-ink" : "text-ink-3"}>{recordLine(p, rec, judge, minMatured, firmCalls)}</span>
            </div>
          )}
          <p className="mt-2 line-clamp-2 text-[14px] leading-snug group-open:line-clamp-none"><span className="meta mr-1.5 text-accent">Learn</span>{p.learn}</p>
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-ink-2 group-open:line-clamp-none"><span className="meta mr-1.5 text-people">Careful</span>{p.caution}</p>
        </summary>
        <ul className="grid gap-0.5 border-t border-line px-4 pt-2 pb-3 text-[13.5px] sm:px-5">
          {links.map((l) => <LinkRow key={l.href} href={l.href}>{l.label}</LinkRow>)}
        </ul>
      </details>
    </Reveal>
  );
}

/** Someone whose principles we keep: one compact row, the rest behind a tap. */
function PrinciplesRow({ p }) {
  const links = personLinks(p);
  return (
    <details id={`person-${p.id}`} className="group scroll-mt-28">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="text-[16px] font-semibold tracking-[-0.01em]">{p.name}</span>
          <span className="meta ml-2 normal-case tracking-[0.02em]">{p.style}</span>
        </span>
        <Toggle />
      </summary>
      <div className="px-4 pb-4 sm:px-5">
        <p className="text-[14px] leading-snug"><span className="meta mr-1.5 text-accent">Learn</span>{p.learn}</p>
        <p className="mt-2 text-[14px] leading-snug text-ink-2"><span className="meta mr-1.5 text-people">Careful</span>{p.caution}</p>
        <ul className="mt-2 grid gap-0.5 text-[13.5px]">{links.map((l) => <LinkRow key={l.href} href={l.href}>{l.label}</LinkRow>)}</ul>
      </div>
    </details>
  );
}

function LinkRow({ href, children }) {
  return (
    <li>
      <a href={href} {...ext} className="group/link flex min-h-[32px] items-start gap-1.5 py-1 text-ink-2 [overflow-wrap:anywhere] hover:text-accent">
        <ArrowRight className="mt-[3px] size-3.5 shrink-0 -rotate-45 text-ink-3 group-hover/link:text-accent" />
        <span>{children}</span>
      </a>
    </li>
  );
}

/* --------------------------------------------------------------- how we use */

const SHOWN_USES = 4;

function UseItem({ x, i }) {
  return (
    <li className="flex gap-3 border-b border-line px-2 py-3 last:border-0">
      <span className="num shrink-0 font-mono text-[12.5px] leading-[22px] text-accent">{pad2(i + 1)}</span>
      <span className="text-[14.5px] leading-snug">{x}</span>
    </li>
  );
}

function HowWeUse({ cfg }) {
  const rest = cfg.how_we_use.slice(SHOWN_USES);
  return (
    <section id="people-use" className={SECTION}>
      <SectionHead eyebrow="How we use them" title={<>Learn from them. <Accent>Measure them.</Accent></>} size="md" />
      <Reveal className="card px-2 py-1 sm:p-4">
        <ol className="grid">{cfg.how_we_use.slice(0, SHOWN_USES).map((x, i) => <UseItem key={i} x={x} i={i} />)}</ol>
        {rest.length > 0 && (
          <details className="group border-t border-line">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-2 [&::-webkit-details-marker]:hidden">
              <span className="meta">{rest.length} more</span><Toggle />
            </summary>
            <ol className="grid">{rest.map((x, i) => <UseItem key={i} x={x} i={i + SHOWN_USES} />)}</ol>
          </details>
        )}
      </Reveal>
    </section>
  );
}

/* --------------------------------------------------------------- research */

function Research({ cfg }) {
  return (
    <section id="people-research" className={SECTION}>
      <SectionHead eyebrow={`What the research says · ${cfg.evidence.length} findings`} title={<>Most influencers studied <Accent>didn't help.</Accent></>} size="md"
        lede="Studies of following people in public and of copying what funds disclose. Tap a finding for its summary, in our words, and its source." />
      <Reveal className="card divide-y divide-line">
        {cfg.evidence.map((e) => (
          <details key={e.url} className="group">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="text-[15px] font-medium tracking-[-0.01em]">{e.topic}</span>
              <Toggle />
            </summary>
            <div className="px-4 pb-4 sm:px-5">
              <p className="text-[14.5px] leading-relaxed text-ink-2">{e.claim}</p>
              <a href={e.url} {...ext} className="mt-3 inline-flex items-start gap-1.5 text-[13px] leading-snug text-ink-3 [overflow-wrap:anywhere] hover:text-accent">
                <span>{e.citation}</span><ArrowRight className="mt-0.5 size-3.5 shrink-0 -rotate-45" />
              </a>
            </div>
          </details>
        ))}
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------- connected */

function Connected({ sources, cfg }) {
  const list = ["people", "holdings_13f", "x_accounts", "news"].map((id) => sources.sources.find((s) => s.id === id)).filter(Boolean);
  return (
    <section id="people-connected" className={SECTION}>
      <SectionHead eyebrow={`Connectors · sources v${sources.version}`} title={<>What is <Accent>connected.</Accent></>} size="md"
        lede="Only the list kept by hand is on. Nothing that costs money, and no new provider, is switched on until the household decides." />
      <Reveal className="card divide-y divide-line">
        {list.map((s) => {
          const c = CONNECT[s.id] ?? {};
          const live = s.status === "active";
          return (
            <div key={s.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{s.label}</h3>
                <Chip kind={live ? "active" : "planned"} icon={false}>{live ? (s.provider === "manual" ? "by hand" : "on") : "off"}</Chip>
              </div>
              {c.what && <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{c.what}</p>}
              <div className="meta mt-2 normal-case tracking-[0.04em]">
                {c.cost && <span className={c.cost === "Costs money" ? "text-down" : "text-accent"}>{c.cost}</span>}
                {live && s.provider !== "manual" ? ` · ${s.cadence}` : ""}
                {s.id === "people" ? ` · ${cfg.people.length} people, ${cfg.calls.length} calls` : ""}
              </div>
            </div>
          );
        })}
      </Reveal>
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
  ["what", "one sentence in our own words, no prices"],
  ["credit_person", "false when it is the firm's move, not the person's own; it then counts for the fund only"],
  ["source_kind and source_url", "13f, letter, memo, interview or post, and the link"],
];

function AddOne({ repo, go }) {
  const edit = `https://github.com/${repo}/edit/main/config/people.json`;
  return (
    <section id="people-add" className={SECTION}>
      <SectionHead eyebrow="How to" title={<>Add a person <Accent>or a call.</Accent></>} size="md"
        lede="One file, config/people.json, changed through a pull request. Lint checks it, and the next daily run scores any new call."
        right={<a href={edit} {...ext} className="btn">Edit people.json <ArrowRight className="size-4 -rotate-45" /></a>} />
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <Reveal className="card">
          <details className="group">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="meta">A person: what to include</span>
              <Toggle />
            </summary>
            <ul className="grid gap-2 px-4 pb-4 text-[14.5px] leading-snug text-ink-2 sm:px-5 sm:pb-5">
              <li className="flex gap-2"><span className="text-accent">–</span><span>Why we follow them, what we learn, and a fair caution.</span></li>
              <li className="flex gap-2"><span className="text-accent">–</span><span>Links only to where they publish themselves or to official pages; an X handle only if it is confirmed.</span></li>
              <li className="flex gap-2"><span className="text-accent">–</span><span>If their fund files a 13F, the filer's name and its SEC number (CIK).</span></li>
              <li className="flex gap-2"><span className="text-accent">–</span><span>Facts about a real person only from primary or official sources, or a named reputable report.</span></li>
            </ul>
          </details>
        </Reveal>
        <Reveal className="card">
          <details className="group">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="meta">A call: the fields</span>
              <Toggle />
            </summary>
            <dl className="grid gap-2 px-4 pb-4 text-[14px] leading-snug sm:px-5 sm:pb-5">
              {CALL_FIELDS.map(([k, v]) => (
                <div key={k} className="grid gap-x-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <dt className="font-mono text-[12.5px] text-ink">{k}</dt>
                  <dd className="text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Reveal>
      </div>
      <Reveal className="card mt-3 border-people/40 p-4 text-[14.5px] leading-relaxed text-ink-2 sm:p-5">
        <span className="text-people">Paraphrase, always.</span> The repo is public: our own words and a link, never their text or a price.
        A call is context for the brain, never a reason on its own to move money. See <button type="button" onClick={() => go("how")} className="text-ink underline-offset-4 hover:underline">How it works</button> for the daily loop.
      </Reveal>
    </section>
  );
}
