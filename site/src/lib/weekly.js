// The weekly game: the household acts weekly. Real money buys the whole-market fund every week; pretend money plays
// two weekly rules (config/rules.json five_leaders_weekly and weekly_swing), recorded forward in the rules ledger
// (data/portfolio/paper_rules.json) and judged against random picks in the history test (data/market/rules.json).
// Pure functions, no React; tested in weekly.test.js.

export const WEEKLY_RULES = [
  { id: "weekly_swing", name: "Weekly Swing", what: "Each week: the five names that beat the market most over the last month." },
  { id: "five_leaders_weekly", name: "Five Leaders, weekly", what: "Each week: the strongest steady climbers of the past year." },
];

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** The coming Monday (today if it is Monday), as an ISO date: the fallback when no published date can be used. */
export function nextBuyDay(todayIso) {
  const d = new Date(`${todayIso}T00:00:00Z`);
  const add = (8 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

/**
 * The next weekly buy day, the one source for every card that names it ("This week", the two-minute read and "When
 * could we buy it?"). The daily run publishes it holiday-aware (buy_window.json `next_weekly_buy`: the first trading
 * day of the week after its close, by the US exchange calendar). It is used while it is still ahead (today or later)
 * and no more than a week past the coming Monday; otherwise (no file, an old file, a sample file on a live site) the
 * coming Monday, without holidays.
 */
export function weeklyBuyDay(todayIso, bw = null, siteSample = false) {
  const monday = nextBuyDay(todayIso);
  const pub = bw?.next_weekly_buy;
  if (typeof pub !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(pub) || (bw.sample && !siteSample)) return monday;
  const limit = new Date(`${monday}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 7);
  return pub >= todayIso && pub < limit.toISOString().slice(0, 10) ? pub : monday;
}

/** How a rule did on the history test, in words: passed, rejected, or not tested yet. */
export function historyWords(rulesResult, id) {
  const row = (rulesResult?.satellite?.rules ?? []).find((r) => r.id === id);
  if (!row || !isNum(row.percentile)) return { tested: false, line: "Not tested on past prices yet: the next nightly run does it." };
  const p = Math.round(row.percentile);
  const passed = row.verdict === "passes_history" || row.verdict === "passed";
  return {
    tested: true, passed, percentile: p,
    line: passed
      ? `On past prices it beat ${p} out of 100 random picks: good enough to keep playing on paper.`
      : `On past prices it beat only ${p} out of 100 random picks; luck alone beats about half. Not good enough for real money.`,
  };
}

/** One weekly rule's pretend record: this week's names, weeks played, and its result against the market since it began. */
export function gameRow(ledger, id, names = {}) {
  const r = ledger?.rules?.[id];
  if (!r || !r.rebalances?.length) return null;
  const last = r.rebalances.at(-1);
  const vals = r.values ?? [];
  const mine = vals.length > 1 && isNum(vals[0]) && isNum(vals.at(-1)) ? (vals.at(-1) / vals[0] - 1) * 100 : null;
  const k = (ledger.dates ?? []).indexOf(r.started);
  const core = ledger.core ?? [];
  const market = k >= 0 && isNum(core[k]) && isNum(core.at(-1)) ? (core.at(-1) / core[k] - 1) * 100 : null;
  return {
    id, started: r.started, weeks: r.rebalances.length, since: last.date,
    holdings: last.holdings.map((t) => ({ ticker: t, name: names[t] ?? t })),
    mine, market, ahead: isNum(mine) && isNum(market) ? mine - market : null,
  };
}

/** The scoreboard line for a row, in words. */
export function scoreLine(row) {
  if (!row) return "Starts with the next weekly review.";
  if (!isNum(row.ahead) || row.weeks < 2) return `Week ${row.weeks}: too early to score. It is checked again every week.`;
  const a = Math.abs(row.ahead);
  const by = a < 0.5 ? "about level with" : `${a.toFixed(1)} points ${row.ahead > 0 ? "ahead of" : "behind"}`;
  return `After ${row.weeks} weeks it is ${by} the whole market. A few weeks prove nothing: luck swings this much.`;
}
