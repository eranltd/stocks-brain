import { useState } from "react";
import { fmtDate, fmtShort } from "../lib/format.js";
import dict from "../text/learn.js";
import { callerName, callStatus, edgarUrl, groupPeople, isFirmCall, joinCalls, ownLinks, recordLine, shortVia } from "../lib/people.js";
import { Chip, Container, DataTable, Delta, EmptyState, InfoTip, Panel, SectionTitle, StatTile } from "../components/ui.jsx";
import { PageHero, ReadMore, TipText } from "../lib/learnkit.jsx";
import { strings } from "../lib/text.js";

/*
 * People to learn from: famous investors and teachers, as panels. The ledger of their dated public calls, each checked
 * against the whole market (percent changes only), then one panel per person with their hit-rate tiles and their calls,
 * then how they are used, what studies found, the data feeds and how to add one. The scores come from scripts/people.py
 * (data/people/scores.json); nothing here computes a return.
 */

const t = strings(dict);
const ext = { target: "_blank", rel: "noopener noreferrer" };
const STATUS_TONE = { right: "up", wrong: "down", maturing: "wait", unscored: "ghost" };
const SIDE_TONE = { bullish: "up", bearish: "down" };
const word = (prefix, v) => (t.has(`${prefix}.${v}`) ? t(`${prefix}.${v}`) : v);

export default function People({ data, go }) {
  const cfg = data.people;
  const sc = data.peopleScores;
  const [open, setOpen] = useState(null);
  if (!cfg) {
    return <Container className="pt-8"><EmptyState title={t("ppl.empty.title")}>{t("ppl.empty.body")}</EmptyState></Container>;
  }
  const judge = sc?.judge_at_weeks ?? 26;
  const minMatured = sc?.min_matured ?? 10;
  const horizons = sc?.horizons_weeks ?? [13, 26, 52];
  const records = Object.fromEntries((sc?.people ?? []).map((r) => [r.person, r]));
  const calls = joinCalls(cfg, sc);
  const byId = Object.fromEntries(cfg.people.map((p) => [p.id, p]));
  const groups = groupPeople(cfg.people);
  const following = cfg.people.filter((p) => p.status === "following");
  const matured = calls.filter((c) => c[`w${judge}`]).length;
  const anyEnough = (sc?.people ?? []).some((r) => r.enough);
  const picked = calls.find((c) => c.id === open);

  return (
    <Container className="pt-6 pb-4 sm:pt-8">
      <PageHero line1={t("ppl.hero1")} line2={t("ppl.hero2")} sub={t("ppl.sub")}
        info={<TipText lead={t("ppl.about.lead")} more={t("ppl.about.more")} />}
        chips={<>
          <Chip tone="neutral"><span className="text-ink-2">{t("ppl.version", { v: cfg.version, date: fmtShort(cfg.updated_at) })}</span></Chip>
          {sc && <Chip tone="neutral"><span className="text-ink-2">{t("ppl.scoredTo", { date: fmtShort(sc.as_of) })}</span></Chip>}
          {sc?.sample && <Chip tone="people">{t("ppl.samplePrices")}</Chip>}
        </>} />

      <div className="mt-7 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatTile label={t("ppl.s.following")} value={following.length} sub={t("ppl.s.followingSub", { n: groups.principles.length })} />
        <StatTile label={t("ppl.s.calls")} value={calls.length} sub={t("ppl.s.callsSub")} tone="flat" />
        <StatTile label={t("ppl.s.matured")} value={matured} unit={`/${calls.length}`} sub={t("ppl.s.maturedSub", { judge })} tone="flat" />
        <StatTile label={t("ppl.s.needed")} value={minMatured} sub={t("ppl.s.neededSub")} tone="flat" note={anyEnough ? t("ppl.s.enough") : t("ppl.s.notEnough")} />
      </div>

      <Panel id="people-calls" hero className="mt-4 md:mt-8" title={t("ppl.calls.title")} sub={t("ppl.calls.sub")}
        info={t("ppl.calls.info", { judge, min: minMatured })} badge={<span className="font-num text-[12px] font-bold text-ink-2">{calls.length}</span>}>
        {calls.length === 0 ? <EmptyState compact title={t("ppl.calls.empty.title")}>{t("ppl.calls.empty.body")}</EmptyState> : (
          <>
            <div className="-mt-4 sm:-mt-5">
              <Ledger calls={calls} byId={byId} names={data.names} judge={judge} horizons={horizons} open={open} onOpen={(c) => setOpen((o) => (o === c.id ? null : c.id))} />
            </div>
            {picked && <CallDetail c={picked} name={data.names?.[picked.ticker]} />}
          </>
        )}
      </Panel>

      <section id="people-who" className="mt-10 md:mt-14">
        <SectionTitle title={t("ppl.who.title")} sub={t("ppl.who.sub")} size="md" />
        {["investors", "teachers"].map((key) => groups[key].length > 0 && (
          <div key={key} className="mt-5">
            <p className="kicker mb-2.5 flex flex-wrap items-baseline gap-x-2">{t(`ppl.group.${key}`)}<span className="font-sans text-[12.5px] font-normal tracking-normal text-ink-3 normal-case">{t(`ppl.group.${key}Sub`)}</span></p>
            <div className="grid gap-3 md:grid-cols-2 md:items-start md:gap-4">
              {[...groups[key]].sort((a, b) => Number(calls.some((c) => c.person === b.id)) - Number(calls.some((c) => c.person === a.id))).map((p) => (
                <PersonPanel key={p.id} p={p} rec={records[p.id]} calls={calls.filter((c) => c.person === p.id)} judge={judge} minMatured={minMatured} />
              ))}
            </div>
          </div>
        ))}
        {groups.principles.length > 0 && (
          <Panel className="mt-5" title={t("ppl.group.principles")} sub={t("ppl.group.principlesSub")} titleSize="xs" flush>
            <ul className="divide-y divide-line">
              {groups.principles.map((p) => (
                <li key={p.id} id={`person-${p.id}`} className="flex min-h-[52px] items-center gap-3 px-4 py-2 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-ink">{p.name}</span>
                    <span className="block truncate text-[12px] text-ink-3">{p.style}</span>
                  </span>
                  <InfoTip label={p.name}><TipText lead={p.learn} more={<><span className="micro me-1.5 text-people">{t("ppl.careful")}</span>{p.caution}</>} /></InfoTip>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <div className="mt-4 grid gap-4 md:mt-8 md:grid-cols-2 md:gap-4 lg:items-start">
        <HowUsed cfg={cfg} />
        <Research cfg={cfg} />
        <Feeds sources={data.sources} cfg={cfg} />
        <AddOne repo={data.manifest.repo} go={go} />
      </div>

      <p className="micro mt-8 text-center normal-case tracking-[0.04em]">
        {sc ? t("ppl.footerScores", { v: cfg.version, core: sc.core }) : t("ppl.footer", { v: cfg.version })}
      </p>
    </Container>
  );
}

/* ----------------------------------------------------------------- ledger */

/** A leg's "vs market" percent, or how many weeks are left, or a dash. */
function Leg({ c, w }) {
  const leg = c[`w${w}`];
  if (leg) return <Delta value={leg.signed_excess_pct} d={1} />;
  const left = c.weeks_since == null ? null : w - c.weeks_since;
  return <span className="font-num text-[11.5px] text-ink-3">{c.scored && left > 0 ? `${left}w` : "–"}</span>;
}

function Ledger({ calls, byId, names, judge, horizons, open, onOpen, compact = false }) {
  const cols = [
    { key: "ticker", label: t("ppl.th.stock"), sortable: true, firstDir: "asc", cell: (c) => (
      <span className="block py-1.5">
        <span className={`font-num block text-[13.5px] font-bold ${open === c.id ? "text-desk" : "text-ink"}`}>{c.ticker}</span>
        {!compact && names?.[c.ticker] && <span className="block max-w-[96px] truncate text-[10.5px] text-ink-3">{names[c.ticker]}</span>}
      </span>
    ) },
    !compact && { key: "who", label: t("ppl.th.who"), align: "start", sortable: true, sortValue: (c) => callerName(c, byId[c.person]), cell: (c) => (
      <span className="block max-w-[150px] py-1.5">
        <span className="block truncate text-[13px] text-ink">{callerName(c, byId[c.person])}</span>
        <span className="block truncate text-[10.5px] text-ink-3">{isFirmCall(c) ? t("ppl.call.firm") : shortVia(c.via)}</span>
      </span>
    ) },
    { key: "stance", label: t("ppl.th.side"), align: "start", cell: (c) => <Chip tone={SIDE_TONE[c.stance] ?? "neutral"} className="min-h-[22px] px-1.5 text-[10px]">{word("ppl.side", c.stance)}</Chip> },
    !compact && { key: "date", label: t("ppl.th.public"), sortable: true, align: "start", className: "font-num text-[12px] text-ink-2 whitespace-nowrap", cell: (c) => fmtShort(c.date) },
    ...(compact ? [judge] : horizons).map((w) => ({ key: `w${w}`, label: t("ppl.th.wk", { n: w }), sortable: true, num: true, sortValue: (c) => c[`w${w}`]?.signed_excess_pct ?? null, cell: (c) => <Leg c={c} w={w} /> })),
    { key: "so_far", label: t("ppl.th.soFar"), sortable: true, num: true, sortValue: (c) => c.so_far?.signed_excess_pct ?? null, cell: (c) => (c.so_far ? <Delta value={c.so_far.signed_excess_pct} d={1} /> : <span className="text-ink-3">–</span>) },
    { key: "status", label: t("ppl.th.status"), align: "start", cell: (c) => {
      const st = callStatus(c, judge);
      return <Chip tone={STATUS_TONE[st.kind] ?? "neutral"} className="min-h-[22px] px-1.5 text-[10px]">{st.label}</Chip>;
    } },
  ].filter(Boolean);
  return (
    <DataTable columns={cols} rows={calls} rowKey={(c) => c.id} minWidth={compact ? 320 : 760} onRowClick={onOpen} rowLabel={(c) => `${c.ticker} ${callerName(c, byId?.[c.person])}`}
      rowTone={(c) => (c.id === open ? "brand" : null)} scrollClassName="relative" caption={t("ppl.calls.title")} />
  );
}

function CallDetail({ c, name }) {
  const st = callStatus(c, 26);
  return (
    <div key={c.id} className="tile mt-4 grid animate-pop gap-1.5 p-4 motion-reduce:animate-none" aria-live="polite">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-num text-[16px] font-bold text-ink">{c.ticker}</span>
        {name && <span className="text-[13px] text-ink-3">{name}</span>}
        <span className="font-num text-[12px] text-ink-3">· {fmtDate(c.date)}</span>
      </p>
      <p className="text-[14px] leading-snug text-ink-2">{c.what}</p>
      {c.note && <p className="text-[13px] leading-snug text-people">{c.note}</p>}
      <p className="text-[12px] text-ink-3">
        {!c.scored ? t("ppl.call.notScored", { detail: st.detail }) : c.start_date ? t("ppl.call.counted", { date: fmtShort(c.start_date) }) : t("ppl.call.tooNew")}
      </p>
      <a href={c.source_url} {...ext} className="chip mt-1 min-h-[32px] w-fit border-line-2 text-ink-2 hover:text-ink">
        {t("source", { what: word("ppl.src", c.source_kind) })} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ people */

function personLinks(p) {
  return [
    ...ownLinks(p).map((l) => ({ href: l.url, label: l.label })),
    ...(p.x_handle ? [{ href: `https://x.com/${p.x_handle}`, label: t("ppl.link.x", { handle: p.x_handle }) }] : []),
    ...(p.holdings_13f ? [{ href: edgarUrl(p.holdings_13f.cik), label: t("ppl.link.13f", { filer: p.holdings_13f.filer }) }] : []),
  ];
}

const pct0 = (v) => (typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)}%` : "–");

function PersonPanel({ p, rec, calls, judge, minMatured }) {
  const links = personLinks(p);
  const firm = calls.filter(isFirmCall);
  const [open, setOpen] = useState(null);
  return (
    <Panel id={`person-${p.id}`} className="scroll-mt-28" title={p.name} sub={p.style} titleSize="sm"
      badge={<Chip tone="people" className="min-h-[22px] px-1.5 text-[10px]">{word("ppl.kind", p.kind)}</Chip>}>
      {rec?.n > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("ppl.st.calls")} value={rec.n} sub={`${rec.matured_26w}/${rec.n}`} />
          <StatTile label={t("ppl.st.right", { judge })} value={rec.matured_26w ? pct0(rec.right_26w_pct) : "–"} tone="flat" />
          <StatTile label={t("ppl.st.typical")} value={rec.matured_26w ? <Delta value={rec.median_signed_excess_26w} d={1} /> : "–"} tone="flat" />
          <StatTile label={t("ppl.st.soFar")} value={pct0(rec.right_so_far_pct)} tone="flat" />
        </div>
      )}
      {calls.length > 0 && (
        <>
          <p className="mt-3 flex flex-wrap items-center gap-1.5">
            {rec?.n > 0 && !rec.enough && <Chip tone="ghost">{t("ppl.tooFew", { min: minMatured })}</Chip>}
            {firm.length > 0 && (
              <span className="micro min-w-0 leading-snug" title={recordLine(p, rec, judge, minMatured, firm)}>
                <span className="text-people">{t("ppl.firmOnly")}</span> · {shortVia(firm[0].via)}
              </span>
            )}
          </p>
          <div className="mt-2">
            <Ledger calls={calls} judge={judge} compact open={open} onOpen={(c) => setOpen((o) => (o === c.id ? null : c.id))} />
          </div>
          {open && <CallDetail c={calls.find((c) => c.id === open)} />}
        </>
      )}
      <p className={`${calls.length || rec?.n ? "mt-3" : ""} line-clamp-3 text-[14px] leading-snug text-ink`}>
        <span className="micro me-1.5 text-desk">{t("ppl.learn")}</span>{p.learn}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-1">
        <span className="micro text-people">{t("ppl.careful")}</span>
        <InfoTip label={t("ppl.careful")} align="start">{p.caution}</InfoTip>
        {links.length > 0 && (
          <ReadMore label={t("ppl.links", { count: links.length })} className="ms-auto">
            <ul className="grid gap-0.5 pt-1 text-[13px]">
              {links.map((l) => (
                <li key={l.href}><a href={l.href} {...ext} className="flex min-h-[36px] items-start gap-1.5 py-1.5 text-ink-2 [overflow-wrap:anywhere] hover:text-desk"><span aria-hidden="true" className="text-ink-3">↗</span>{l.label}</a></li>
              ))}
            </ul>
          </ReadMore>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- the rest */

const SHOWN_USES = 4;

function UseList({ items, from = 0 }) {
  return (
    <ol className="grid">
      {items.map((x, i) => (
        <li key={i} className="flex gap-3 border-b border-line py-2.5 last:border-0">
          <span className="font-num shrink-0 text-[11.5px] leading-[20px] font-bold text-desk">{String(from + i + 1).padStart(2, "0")}</span>
          <span className="text-[13.5px] leading-snug text-ink-2">{x}</span>
        </li>
      ))}
    </ol>
  );
}

function HowUsed({ cfg }) {
  const rest = cfg.how_we_use.slice(SHOWN_USES);
  return (
    <Panel id="people-use" title={t("ppl.use.title")} sub={t("ppl.use.sub")} titleSize="sm">
      <UseList items={cfg.how_we_use.slice(0, SHOWN_USES)} />
      {rest.length > 0 && <ReadMore label={t("ppl.use.more", { count: rest.length })} className="mt-1"><UseList items={rest} from={SHOWN_USES} /></ReadMore>}
    </Panel>
  );
}

function Research({ cfg }) {
  return (
    <Panel id="people-research" title={t("ppl.res.title")} sub={t("ppl.res.sub")} titleSize="sm" flush
      badge={<span className="font-num text-[12px] font-bold text-ink-2">{cfg.evidence.length}</span>}>
      <ul className="divide-y divide-line">
        {cfg.evidence.map((e) => (
          <li key={e.url} className="flex min-h-[48px] items-center gap-2 px-4 py-1.5 sm:px-5">
            <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">{e.topic}</span>
            <InfoTip label={e.topic}>
              <span className="block">{e.claim}</span>
              <a href={e.url} {...ext} className="mt-2 block text-[12px] text-ink-3 [overflow-wrap:anywhere] hover:text-desk">{t("ppl.res.source")}: {e.citation} ↗</a>
            </InfoTip>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// Plain words about each connector this tab depends on (Admin keeps the technical notes).
const CONNECT = { people: "free", holdings_13f: "official", x_accounts: "paid", news: "paid" };

function Feeds({ sources, cfg }) {
  const list = Object.keys(CONNECT).map((id) => sources.sources.find((s) => s.id === id)).filter(Boolean);
  return (
    <Panel id="people-connected" title={t("ppl.conn.title")} sub={t("ppl.conn.sub")} info={t("ppl.conn.info")} titleSize="sm" flush>
      <ul className="divide-y divide-line">
        {list.map((s) => {
          const live = s.status === "active";
          const cost = CONNECT[s.id];
          return (
            <li key={s.id} className="flex min-h-[52px] items-center gap-2 px-4 py-1.5 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{s.label}</span>
                <span className={`micro block ${cost === "paid" ? "text-down" : "text-up"}`}>{t(`ppl.cost.${cost}`)}{s.id === "people" ? ` · ${cfg.people.length} · ${cfg.calls.length}` : ""}</span>
              </span>
              <Chip tone={live ? "up" : "ghost"} className="min-h-[22px] px-1.5 text-[10px]">{t(live ? (s.provider === "manual" ? "ppl.conn.byHand" : "ppl.conn.on") : "ppl.conn.off")}</Chip>
              <InfoTip label={s.label}>{t(`ppl.conn.${s.id}`)}</InfoTip>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// [field name, its description in text/learn.js "ppl.field.<key>"]
const CALL_FIELDS = [
  ["id", "id"], ["person", "person"], ["via", "via"], ["date", "date"], ["ticker", "ticker"], ["stance", "stance"], ["what", "what"],
  ["credit_person", "credit_person"], ["source_kind, source_url", "source"],
];

function AddOne({ repo }) {
  const edit = `https://github.com/${repo}/edit/main/config/people.json`;
  return (
    <Panel id="people-add" title={t("ppl.add.title")} sub={t("ppl.add.sub")} titleSize="sm"
      badge={<a href={edit} {...ext} className="chip min-h-[32px] border-desk/50 bg-desk/10 text-desk">{t("ppl.add.edit")} <span aria-hidden="true">↗</span></a>}>
      <p className="text-[13.5px] leading-snug text-ink-2">{t("ppl.own")}</p>
      <ReadMore label={t("ppl.add.person")} className="mt-1">
        <ul className="grid gap-1.5 pb-1 text-[13.5px] leading-snug text-ink-2">
          {["p1", "p2", "p3", "p4"].map((k) => <li key={k} className="flex gap-2"><span aria-hidden="true" className="text-desk">–</span><span>{t(`ppl.add.${k}`)}</span></li>)}
        </ul>
      </ReadMore>
      <ReadMore label={t("ppl.add.call")}>
        <dl className="grid gap-1.5 pb-1 text-[13px] leading-snug">
          {CALL_FIELDS.map(([k, v]) => (
            <div key={k} className="grid gap-x-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <dt className="font-num text-[12px] text-ink">{k}</dt>
              <dd className="text-ink-2">{t(`ppl.field.${v}`)}</dd>
            </div>
          ))}
        </dl>
      </ReadMore>
    </Panel>
  );
}
