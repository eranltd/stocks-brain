import { pad2, fmtDate, fmtPct } from "../lib/format.js";
import dict from "../text/learn.js";
import { callerName, callStatus, edgarUrl, groupPeople, isFirmCall, joinCalls, ownLinks, recordLine, shortVia } from "../lib/people.js";
import { Accent, ArrowRight, Chip, Container, Empty, Headline, Reveal, SectionHead, Strip } from "../components/ui.jsx";
import { strings } from "../lib/text.js";
import { rich } from "../lib/rich.jsx";

// Words live in text/learn.js: a person's kind "ppl.kind.<kind>", the groups "ppl.group.<key>" (+ "Sub"), a source
// kind "ppl.src.<kind>", a connector's cost "ppl.cost.<cost>" and description "ppl.conn.<id>", the sections "ppl.sec.<id>".
const GROUPS = ["investors", "teachers", "principles"];
const STATUS_CHIP = { right: "hit", wrong: "miss", maturing: "pending", unscored: "retired" };
// Plain words about each connector this tab depends on (Admin keeps the technical notes).
const CONNECT = { people: "free", holdings_13f: "official", x_accounts: "paid", news: "paid" };
const ext = { target: "_blank", rel: "noopener noreferrer" };
const SECTIONS = ["calls", "who", "use", "research", "connected", "add"];
const t = strings(dict);
/** "15 May 2026", as on Today: the long date without its weekday. */
const day = (iso) => fmtDate(iso).replace(/^[^,]+, /, "");
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
    return <Container className="pt-20"><Empty title={t("ppl.empty.title")}>{t("ppl.empty.body")}</Empty></Container>;
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
        {t("ppl.eyebrow", { v: cfg.version, date: fmtDate(cfg.updated_at) })}{sc ? t("ppl.scoredTo", { date: fmtDate(sc.as_of) }) : ""}
        {sc?.sample && <span className="pill ms-2 border-dashed border-people/60 text-people">{t("ppl.samplePrices")}</span>}
      </Reveal>
      <Headline size="xl" className="max-w-[14ch]">{t("ppl.head.a")} <Accent>{t("ppl.head.b")}</Accent></Headline>
      <Reveal delay={250} as="p" className="mt-6 max-w-[62ch] text-[clamp(17px,1.7vw,20px)] leading-relaxed text-ink-2">
        {t("ppl.intro1")}
      </Reveal>
      <Reveal delay={300} as="p" className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-ink-2">
        {t("ppl.intro2")}
      </Reveal>
      <Reveal delay={350} as="nav" aria-label={t("ppl.onPage")} className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((id) => (
          <a key={id} href={`#people-${id}`} onClick={(e) => { e.preventDefault(); scrollTo(id); }}
            className="inline-flex min-h-[36px] items-center rounded-full border border-line-2 px-3.5 text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink">{t(`ppl.sec.${id}`)}</a>
        ))}
      </Reveal>

      <div className="mt-8">
        <Strip dense cells={[
          { value: following.length, label: t("ppl.s.following"), desc: t("ppl.s.followingDesc", { n: groups.principles.length }) },
          { value: calls.length, label: t("ppl.s.calls"), desc: t("ppl.s.callsDesc") },
          { value: matured, label: t("ppl.s.matured"), tone: "flat", desc: t("ppl.s.maturedDesc", { judge }) },
          { value: minMatured, label: t("ppl.s.needed"), tone: "people", dashed: true, desc: anyEnough ? t("ppl.s.enough") : t("ppl.s.notEnough") },
        ]} />
      </div>

      <Calls calls={calls} byId={byId} names={data.names} sc={sc} judge={judge} minMatured={minMatured} />
      <Who groups={groups} records={records} calls={calls} judge={judge} minMatured={minMatured} />
      <HowWeUse cfg={cfg} />
      <Research cfg={cfg} />
      <Connected sources={data.sources} cfg={cfg} />
      <AddOne repo={data.manifest.repo} go={go} />

      <p className="meta mt-16 normal-case tracking-[0.04em]">
        {sc ? t("ppl.footerScores", { v: cfg.version, core: sc.core }) : t("ppl.footer", { v: cfg.version })}
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
    return <div className="text-[12.5px] text-ink-3">{left != null && left > 0 ? t("ppl.leg.inWeeks", { n: left }) : "–"}</div>;
  }
  return (
    <div className="min-w-0">
      <div className={`num font-mono text-[15px] ${tone(leg.signed_excess_pct)}`}>{fmtPct(leg.signed_excess_pct, 1)}<span className="ms-1.5 font-sans text-[11.5px] text-ink-3">{t("ppl.leg.vsMarket")}</span></div>
      <div className="num font-mono text-[11.5px] leading-snug text-ink-3"><div><span>{ticker}</span> {fmtPct(leg.name_pct, 1)}</div><div>{t("ppl.leg.whole", { pct: fmtPct(leg.core_pct, 1) })}</div></div>
    </div>
  );
}

function Calls({ calls, byId, names, sc, judge, minMatured }) {
  const horizons = sc?.horizons_weeks ?? [13, 26, 52];
  return (
    <section id="people-calls" className={SECTION}>
      <SectionHead eyebrow={t("ppl.calls.eyebrow", { count: calls.length })} title={<>{t("ppl.calls.title.a")} <Accent>{t("ppl.calls.title.b")}</Accent></>} size="md"
        lede={rich(t, "ppl.calls.lede", { after: <span className="text-ink">{t("ppl.calls.after")}</span>, judge, min: minMatured })} />
      {calls.length === 0 ? (
        <Empty title={t("ppl.calls.empty.title")}>{t("ppl.calls.empty.body")}</Empty>
      ) : (
        <>
        <div className="grid gap-3 md:grid-cols-2">
          {calls.map((c) => <CallRow key={c.id} c={c} p={byId[c.person]} name={names[c.ticker]} judge={judge} horizons={horizons} />)}
        </div>
        </>
      )}
      <p className="meta mt-3 normal-case tracking-[0.04em]">
        {t("ppl.calls.note")}
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
            <Chip kind={c.stance} />
            <span className="ms-auto flex items-center gap-2"><Chip kind={STATUS_CHIP[st.kind]}>{st.label}</Chip><Toggle /></span>
          </div>
          <div className="text-[13.5px] leading-snug text-ink-2">
            <span className="text-ink">{callerName(c, p)}</span>
            {firm ? t("ppl.call.firm") : <span title={c.via}>{t("ppl.call.via", { fund: shortVia(c.via) })}</span>}
            <span className="text-ink-3">{t(c.source_kind === "13f" ? "ppl.call.filed" : "ppl.call.public", { date: day(c.date) })}</span>
          </div>
          <div className="text-[13.5px] leading-snug text-ink-3">
            {!c.scored ? t("ppl.call.notScored", { detail: st.detail })
              : judged ? <>{rich(t, "ppl.call.atWeeks", { judge, pct: pct(judged.signed_excess_pct) })}{sf ? rich(t, "ppl.call.soFarTail", { pct: pct(sf.signed_excess_pct) }) : null}</>
              : sf ? rich(t, "ppl.call.soFar", { pct: pct(sf.signed_excess_pct), since: c.weeks_since, judge })
              : t("ppl.call.tooNew")}
          </div>
        </summary>
        <div className="border-t border-line px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
          {name && <div className="text-[13.5px] text-ink">{name}</div>}
          <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{c.what}</p>
          {c.note && <p className="mt-2 text-[13px] leading-snug text-people">{c.note}</p>}
          {c.scored && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0"><div className="meta mb-1">{t("ppl.call.soFarHead", { n: c.weeks_since })}</div><Leg leg={sf} ticker={c.ticker} /></div>
                {horizons.map((w) => <div key={w} className="min-w-0"><div className="meta mb-1">{t("ppl.call.weeks", { n: w })}</div><Leg leg={c[`w${w}`]} weeks={w} since={c.weeks_since} ticker={c.ticker} /></div>)}
              </div>
              <p className="mt-3 text-[12px] text-ink-3">{t("ppl.call.counted", { date: day(c.start_date), judge })}</p>
            </>
          )}
          <a href={c.source_url} {...ext} className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-[13.5px] text-ink-2 hover:text-accent">{t("source", { what: t.has(`ppl.src.${c.source_kind}`) ? t(`ppl.src.${c.source_kind}`) : c.source_kind })} <ArrowRight className="size-3.5 -rotate-45" /></a>
        </div>
      </details>
    </Reveal>
  );
}

/* -------------------------------------------------------------------- who */

function Who({ groups, records, calls, judge, minMatured }) {
  return (
    <section id="people-who" className={SECTION}>
      <SectionHead eyebrow={t("ppl.who.eyebrow")} title={<>{t("ppl.who.title.a")} <Accent>{t("ppl.who.title.b")}</Accent></>} size="md"
        lede={t("ppl.who.lede")} />
      {GROUPS.map((key) => groups[key].length > 0 && (
        <div key={key} className="mb-8 sm:mb-10">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="text-[18px] font-semibold tracking-[-0.02em] sm:text-[22px]">{t(`ppl.group.${key}`)}</h3>
            <span className="text-[14px] text-ink-3">{t(`ppl.group.${key}Sub`)}</span>
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

function personLinks(p, t) {
  return [
    ...ownLinks(p).map((l) => ({ href: l.url, label: <span>{l.label}</span> })),
    ...(p.x_handle ? [{ href: `https://x.com/${p.x_handle}`, label: t("ppl.link.x", { handle: p.x_handle }) }] : []),
    ...(p.holdings_13f ? [{ href: edgarUrl(p.holdings_13f.cik), label: t("ppl.link.13f", { filer: p.holdings_13f.filer }) }] : []),
  ];
}

function PersonCard({ p, rec, i, judge, minMatured, firmCalls, group }) {
  const links = personLinks(p, t);
  const hasRecord = rec?.n || firmCalls.length || p.holdings_13f;
  return (
    <Reveal delay={(i % 3) * 60} as="article" id={`person-${p.id}`} className="card min-w-0 scroll-mt-28">
      <details className="group">
        <summary className="block cursor-pointer list-none px-4 py-3.5 sm:p-5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="min-w-0 text-[19px] font-semibold tracking-[-0.02em]">{p.name}</h4>
            <Toggle>{t("ppl.links", { count: links.length })}</Toggle>
          </div>
          <div className="meta mt-0.5 normal-case tracking-[0.02em]">{group === "investors" ? "" : `${t.has(`ppl.kind.${p.kind}`) ? t(`ppl.kind.${p.kind}`) : p.kind} · `}{p.style}</div>
          {hasRecord && (
            <div className="mt-2 flex items-start gap-2 text-[13.5px] leading-snug">
              <i aria-hidden="true" className={`mt-[6px] inline-block size-1.5 shrink-0 rounded-full ${rec?.n || firmCalls.length ? "bg-people" : "bg-line-2"}`} />
              <span className={rec?.n || firmCalls.length ? "text-ink" : "text-ink-3"}>{recordLine(p, rec, judge, minMatured, firmCalls)}</span>
            </div>
          )}
          <p className="mt-2 line-clamp-2 text-[14px] leading-snug group-open:line-clamp-none"><span className="meta me-1.5 text-accent">{t("ppl.learn")}</span>{p.learn}</p>
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-ink-2 group-open:line-clamp-none"><span className="meta me-1.5 text-people">{t("ppl.careful")}</span>{p.caution}</p>
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
  const links = personLinks(p, t);
  return (
    <details id={`person-${p.id}`} className="group scroll-mt-28">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="text-[16px] font-semibold tracking-[-0.01em]">{p.name}</span>
          <span className="meta ms-2 normal-case tracking-[0.02em]">{p.style}</span>
        </span>
        <Toggle />
      </summary>
      <div className="px-4 pb-4 sm:px-5">
        <p className="text-[14px] leading-snug"><span className="meta me-1.5 text-accent">{t("ppl.learn")}</span>{p.learn}</p>
        <p className="mt-2 text-[14px] leading-snug text-ink-2"><span className="meta me-1.5 text-people">{t("ppl.careful")}</span>{p.caution}</p>
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
      <SectionHead eyebrow={t("ppl.use.eyebrow")} title={<>{t("ppl.use.title.a")} <Accent>{t("ppl.use.title.b")}</Accent></>} size="md"
        lede={t("ppl.use.lede")} />
      <Reveal className="card px-2 py-1 sm:p-4">
        <ol className="grid">{cfg.how_we_use.slice(0, SHOWN_USES).map((x, i) => <UseItem key={i} x={x} i={i} />)}</ol>
        {rest.length > 0 && (
          <details className="group border-t border-line">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-2 [&::-webkit-details-marker]:hidden">
              <span className="meta">{t("ppl.use.more", { count: rest.length })}</span><Toggle />
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
      <SectionHead eyebrow={t("ppl.res.eyebrow", { count: cfg.evidence.length })} title={<>{t("ppl.res.title.a")} <Accent>{t("ppl.res.title.b")}</Accent></>} size="md"
        lede={t("ppl.res.lede")} />
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
      <SectionHead eyebrow={t("ppl.conn.eyebrow", { v: sources.version })} title={<>{t("dataFeeds.title.a")} <Accent>{t("dataFeeds.title.b")}</Accent></>} size="md"
        lede={t("ppl.conn.lede")} />
      <Reveal className="card divide-y divide-line">
        {list.map((s) => {
          const cost = CONNECT[s.id];
          const live = s.status === "active";
          return (
            <div key={s.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{s.label}</h3>
                <Chip kind={live ? "active" : "planned"} icon={false}>{t(live ? (s.provider === "manual" ? "ppl.conn.byHand" : "ppl.conn.on") : "ppl.conn.off")}</Chip>
              </div>
              {cost && <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{t(`ppl.conn.${s.id}`)}</p>}
              <div className="meta mt-2 normal-case tracking-[0.04em]">
                {cost && <span className={cost === "paid" ? "text-down" : "text-accent"}>{t(`ppl.cost.${cost}`)}</span>}
                {live && s.provider !== "manual" ? <> · {s.cadence}</> : ""}
                {s.id === "people" ? t("ppl.conn.counts", { people: cfg.people.length, calls: cfg.calls.length }) : ""}
              </div>
            </div>
          );
        })}
      </Reveal>
    </section>
  );
}

/* ----------------------------------------------------------------- add one */

// [field name, its description in text/learn.js "ppl.field.<key>"]
const CALL_FIELDS = [
  ["id", "id"], ["person", "person"], ["via", "via"], ["date", "date"], ["ticker", "ticker"], ["stance", "stance"], ["what", "what"],
  ["credit_person", "credit_person"], ["source_kind, source_url", "source"],
];

function AddOne({ repo, go }) {
  const edit = `https://github.com/${repo}/edit/main/config/people.json`;
  return (
    <section id="people-add" className={SECTION}>
      <SectionHead eyebrow={t("ppl.add.eyebrow")} title={<>{t("ppl.add.title.a")} <Accent>{t("ppl.add.title.b")}</Accent></>} size="md"
        lede={t("ppl.add.lede")}
        right={<a href={edit} {...ext} className="btn">{t("ppl.add.edit")} <ArrowRight className="size-4 -rotate-45" /></a>} />
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <Reveal className="card">
          <details className="group">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="meta">{t("ppl.add.person")}</span>
              <Toggle />
            </summary>
            <ul className="grid gap-2 px-4 pb-4 text-[14.5px] leading-snug text-ink-2 sm:px-5 sm:pb-5">
              {["p1", "p2", "p3", "p4"].map((k) => <li key={k} className="flex gap-2"><span className="text-accent">–</span><span>{t(`ppl.add.${k}`)}</span></li>)}
            </ul>
          </details>
        </Reveal>
        <Reveal className="card">
          <details className="group">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="meta">{t("ppl.add.call")}</span>
              <Toggle />
            </summary>
            <dl className="grid gap-2 px-4 pb-4 text-[14px] leading-snug sm:px-5 sm:pb-5">
              {CALL_FIELDS.map(([k, v]) => (
                <div key={k} className="grid gap-x-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <dt className="font-mono text-[12.5px] text-ink">{k}</dt>
                  <dd className="text-ink-2">{t(`ppl.field.${v}`)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Reveal>
      </div>
      <Reveal className="card mt-3 border-people/40 p-4 text-[14.5px] leading-relaxed text-ink-2 sm:p-5">
        <span className="text-people">{t("ppl.own.head")}</span>{" "}
        {rich(t, "ppl.own.body", { link: <button type="button" onClick={() => go("how")} className="text-ink underline-offset-4 hover:underline">{t("ppl.own.link")}</button> })}
      </Reveal>
    </section>
  );
}
