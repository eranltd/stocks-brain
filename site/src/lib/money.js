// What to do with real money, told like to a five-year-old. The household's choice (docs/household.md): real money
// follows this honest action, and depends first on when the money may be needed. Stock picks are not in it unless the
// evidence ever earns them a place. Pure functions, no React; numbers come from published data, never the model.

export const HORIZONS = [
  { id: "long", label: "Not for 5 years or more", short: "5+ years" },
  { id: "medium", label: "In 1 to 5 years", short: "1-5 years" },
  { id: "short", label: "Within a year", short: "Under a year" },
];

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v, d = 0) => `${Math.abs(v).toFixed(d)}%`;

/** True only when a tested stock rule passed its history test AND the trust ladder reached Small money. Never true by
 *  hope: today every rule was rejected against random picks, so this is false. */
export function stocksEarned(rulesResult, stage) {
  const frozen = rulesResult?.frozen?.satellite ?? {};
  const passed = Object.values(frozen).some((v) => v.verdict === "passes_history");
  return passed && stage >= 2;
}

/**
 * The honest action for one time horizon: a headline, a few short steps, why, and what can go wrong, with today's
 * numbers from the data (the cash rate, the whole-market fund's past growth and its biggest drop).
 * `facts`: {fundName, cashName, cashYield, cagr, years, maxDrop, worstYear}.
 */
export function honestAction(horizon, facts = {}) {
  const fund = facts.fundName ?? "a low-cost fund that holds the whole US market (an S&P 500 fund)";
  const cash = facts.cashName ?? "short-term government savings (T-bills)";
  const y = num(facts.cashYield), g = num(facts.cagr), drop = num(facts.maxDrop), worst = num(facts.worstYear);
  const cashPays = y != null ? ` They pay about ${pct(y, 1)} a year right now.` : "";
  const history = g != null && facts.years
    ? ` Over the last ${facts.years} years it grew about ${pct(g)} a year on average; over many decades the average is closer to 10% a year.`
    : " Over many decades it has grown about 10% a year on average.";
  const scary = drop != null ? ` In those years it once fell ${pct(drop)} from its top before coming back.` : "";
  if (horizon === "short") {
    return {
      title: "Keep it safe.",
      steps: [`Keep this money in a savings account or in ${cash}.${cashPays}`, "Do not put money you need within a year into stocks."],
      why: `Stocks can drop a lot in a few months, like a sudden storm.${scary} If you need the money right then, you would have to sell at a bad time.`,
      risk: "Safe money grows slowly, but it is there when you need it.",
    };
  }
  if (horizon === "medium") {
    return {
      title: "Split it: part safe, part whole market.",
      steps: [
        `Put part in ${cash}.${cashPays}`,
        `Put the rest in ${fund}, a little every week.`,
        "The sooner you need the money, the bigger the safe part: about half and half at five years, mostly safe when it is a year or two away.",
      ],
      why: `The safe part is there when you need it; the market part can grow.${history}`,
      risk: `The market part can drop a lot along the way${worst != null ? `: its worst twelve months in our data lost ${pct(worst)}` : ""}.`,
    };
  }
  return {
    title: "Buy the whole market, a little every week, and leave it alone.",
    steps: [
      `Put it in ${fund}.`,
      "Add a little every week, the same amount, whatever the news says. In our test, weekly did a bit better than monthly if the broker's fee per order is tiny.",
      "Do not sell when it drops. Look at it rarely.",
    ],
    why: `Owning the whole market is like planting an orchard instead of betting on one tree.${history} That has beaten almost everyone who tries to pick stocks.`,
    risk: `It will have bad years.${scary} Money you need sooner does not belong here.`,
  };
}

/** The facts honestAction uses, from the site's data (no tickers written in code: names come from config). */
export function moneyFacts(data) {
  const ctx = data?.market?.context ?? {};
  const cash = (ctx.instruments ?? []).find((i) => i.role === "cash");
  const core = data?.longrun?.stats?.core ?? null;
  const coreSym = data?.core?.symbol;
  return {
    fundName: coreSym ? `a low-cost fund that holds the whole US market, such as an S&P 500 fund (like ${coreSym})` : undefined,
    cashName: cash ? `short-term government savings (T-bills, like ${cash.symbol})` : undefined,
    cashYield: ctx.cash_yield_pct ?? null,
    cagr: core?.cagr_pct ?? null,
    years: core?.years ? Math.round(core.years) : null,
    maxDrop: core?.max_dd_pct ?? null,
    worstYear: core?.worst_12m_pct ?? null,
  };
}

/**
 * "Got a lump sum?": money already in hand (savings, a bonus, an inheritance). The household's rule is
 * windfall_lump_sum (config/rules.json): one purchase, after the emergency reserve and the money needed soon are set
 * aside. The numbers come from the savings history test (data/market/rules.json): the lump sum against spreading the
 * same money over half a year, one year after each start date. `rulesResult` may be missing: the steps still hold.
 */
export function lumpSum(rulesResult, fund = "the whole-market fund") {
  const rows = (rulesResult?.savings?.horizons ?? []).find((h) => h.weeks === 52)?.rows ?? [];
  const lump = rows.find((r) => r.id === "windfall_lump_sum");
  const half = rows.find((r) => r.id === "windfall_spread_26w");
  const better = num(half?.vs_baseline_better_pct);
  const dipLump = num(lump?.worst_vs_paid_median_pct);
  const dipHalf = num(half?.worst_vs_paid_median_pct);
  const test = better !== null && half.windows
    ? `In our test on ${half.windows} start dates, putting it all in at once was ahead after a year ${Math.round(100 - better)} times in 100, against spreading it over half a year. Spreading only made the dips feel smaller${dipLump !== null && dipHalf !== null ? ` (the usual worst moment was ${pct(dipHalf)} down instead of ${pct(dipLump)})` : ""}.`
    : "Studies of past prices found that putting it all in at once usually beat spreading it out, because markets rise more often than they fall.";
  return {
    title: "Got a lump sum? Five steps.",
    steps: [
      "First set aside 3 to 6 months of spending in safe savings. That is your emergency money; it never goes into stocks.",
      "Money you will need within 5 years (a car, a flat, a wedding) also stays out of stocks: see the answer above for your time frame.",
      `The rest goes into ${fund} in one purchase. ${test}`,
      "If a crash right after buying would make you sell, spreading it over 6 months is fine: it costs a little on average, but staying in is what matters most.",
      "Then keep adding new savings every week, and do not sell when it drops.",
    ],
    before: [
      "Account type: a tax-advantaged account (in Israel, a keren hishtalmut or an investment kupat gemel) can beat a regular brokerage account.",
      "Where the fund is registered: for non-US investors, a US-registered fund can bring US estate tax and a higher tax on dividends; an Irish-registered fund on the same index often avoids both.",
      "Currency and fees: what the broker charges per order and per year, and whether you mind the fund moving with the dollar.",
    ],
    adviser: "For big sums, an hour with a licensed, fee-only adviser (a fixed fee, no commission) on these three questions is worth more than any stock pick.",
  };
}
