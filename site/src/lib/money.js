// What to do with real money, told simply. The site's plan (docs/household.md): real money follows this honest action,
// and depends first on when the money may be needed. Stock picks are not in it unless the evidence ever earns them a
// place. Pure functions, no React; numbers come from published data, never the model. The texts are in text/home.js.

import { strings } from "./text.js";
import dict from "../text/home.js";

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
 * `facts`: {fundName, cashName, cashYield, cagr, years, maxDrop, worstYear} (moneyFacts).
 */
export function honestAction(horizon, facts = {}) {
  const t = strings(dict);
  const fund = facts.fundName ?? t("money.fund");
  const cash = facts.cashName ?? t("money.cash");
  const y = num(facts.cashYield), g = num(facts.cagr), drop = num(facts.maxDrop), worst = num(facts.worstYear);
  const cashPays = y != null ? t("money.cashPays", { pct: pct(y, 1) }) : "";
  const history = g != null && facts.years ? t("money.history", { years: facts.years, pct: pct(g) }) : t("money.historyLong");
  const scary = drop != null ? t("money.scary", { pct: pct(drop) }) : "";
  if (horizon === "short") {
    return {
      title: t("money.short.title"),
      steps: [t("money.short.s1", { cash, pays: cashPays }), t("money.short.s2")],
      why: t("money.short.why", { scary }),
      risk: t("money.short.risk"),
    };
  }
  if (horizon === "medium") {
    return {
      title: t("money.medium.title"),
      steps: [t("money.medium.s1", { cash, pays: cashPays }), t("money.medium.s2", { fund }), t("money.medium.s3")],
      why: t("money.medium.why", { history }),
      risk: worst != null ? t("money.medium.riskWorst", { pct: pct(worst) }) : t("money.medium.risk"),
    };
  }
  return {
    title: t("money.long.title"),
    steps: [t("money.long.s1", { fund }), t("money.long.s2"), t("money.long.s3")],
    why: t("money.long.why", { history }),
    risk: t("money.long.risk", { scary }),
  };
}

/** The facts honestAction uses, from the site's data (no tickers written in code: names come from config). */
export function moneyFacts(data) {
  const t = strings(dict);
  const ctx = data?.market?.context ?? {};
  const cash = (ctx.instruments ?? []).find((i) => i.role === "cash");
  const core = data?.longrun?.stats?.core ?? null;
  const coreSym = data?.core?.symbol;
  return {
    fundName: coreSym ? t("money.fundLike", { sym: coreSym }) : undefined,
    cashName: cash ? t("money.cashLike", { sym: cash.symbol }) : undefined,
    cashYield: ctx.cash_yield_pct ?? null,
    cagr: core?.cagr_pct ?? null,
    years: core?.years ? Math.round(core.years) : null,
    maxDrop: core?.max_dd_pct ?? null,
    worstYear: core?.worst_12m_pct ?? null,
  };
}

/**
 * "Got a lump sum?": money already in hand (savings, a bonus, an inheritance). The plan's rule is windfall_lump_sum
 * (config/rules.json): one purchase, after the emergency reserve and the money needed soon are set aside. The numbers
 * come from the savings history test (data/market/rules.json): the lump sum against spreading the same money over half
 * a year, one year after each start date. `rulesResult` may be missing: the steps still hold.
 */
export function lumpSum(rulesResult, fund = null) {
  const t = strings(dict);
  const rows = (rulesResult?.savings?.horizons ?? []).find((h) => h.weeks === 52)?.rows ?? [];
  const lump = rows.find((r) => r.id === "windfall_lump_sum");
  const half = rows.find((r) => r.id === "windfall_spread_26w");
  const better = num(half?.vs_baseline_better_pct);
  const dipLump = num(lump?.worst_vs_paid_median_pct);
  const dipHalf = num(half?.worst_vs_paid_median_pct);
  const dips = dipLump !== null && dipHalf !== null ? t("lump.dips", { half: pct(dipHalf), lump: pct(dipLump) }) : "";
  const test = better !== null && half.windows
    ? `${t("lump.test", { windows: half.windows, times: Math.round(100 - better) })}${dips}.`
    : t("lump.studies");
  return {
    title: t("lump.title"),
    steps: [t("lump.s1"), t("lump.s2"), t("lump.s3", { fund: fund ?? t("lump.fund"), test }), t("lump.s4"), t("lump.s5")],
    before: [t("lump.b1"), t("lump.b2"), t("lump.b3")],
    adviser: t("lump.adviser"),
  };
}
