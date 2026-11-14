// The Theme hunter (tabs/Themes.jsx): each theme of config/themes.json with its companies' numbers from the market that
// carries them, and the plain sums the page shows: how the field did over a year, the best and the worst, and "$1,000
// in each a year ago" with the losers counted too. Pure functions, tested in themes.test.js. Percents only.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** The theme's companies joined with their rows ({symbol, market, moat, note, name, row}); `views` maps market id to
 * its loaded view ({market: derived, names}). */
export function themeRows(theme, views) {
  return (theme?.companies ?? []).map((c) => {
    const v = views?.[c.market];
    const row = (v?.market?.symbols ?? []).find((s) => s.symbol === c.symbol) ?? null;
    return { ...c, name: v?.names?.[c.symbol] ?? c.symbol, row };
  });
}

/**
 * The field's year: {n (with a full year), short (listed less than a year), avg (average 1-year move), vsMarket
 * (average against the benchmark), best, worst, start, now (value of `each` dollars in each name a year ago), up}.
 */
export function themeYear(rows, each = 1000) {
  const full = rows.filter((r) => isNum(r.row?.ret_250d_pct));
  // Listed under a year: the name has numbers but no full year yet (a name with no numbers at all is not "short").
  const short = rows.filter((r) => r.row && !isNum(r.row.ret_250d_pct)).length;
  if (!full.length) return { n: 0, short, avg: null, vsMarket: null, best: null, worst: null, start: 0, now: 0, up: 0 };
  const rets = full.map((r) => r.row.ret_250d_pct);
  const vs = full.map((r) => r.row.vs_bench_250d_pct).filter(isNum);
  const by = [...full].sort((a, b) => b.row.ret_250d_pct - a.row.ret_250d_pct);
  return {
    n: full.length, short,
    avg: rets.reduce((a, b) => a + b, 0) / rets.length,
    vsMarket: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null,
    best: by[0], worst: by[by.length - 1],
    start: each * full.length,
    now: full.reduce((a, r) => a + each * (1 + r.row.ret_250d_pct / 100), 0),
    up: rets.filter((x) => x > 0).length,
  };
}

/** The markets a set of themes reads from, once each. */
export function themeMarkets(themes) {
  return [...new Set((themes?.themes ?? []).flatMap((t) => t.companies.map((c) => c.market)))];
}
