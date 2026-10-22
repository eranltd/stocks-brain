// A company's own numbers (data/market/fundamentals.json, from its SEC filings) in plain sentences for the Stock page.
// Pure functions, no React. Trailing twelve months; "cents of each dollar of sales" reads easier than a margin.
// The texts are in text/stock.js ("fu.*").

import { strings } from "./text.js";
import dict from "../text/stock.js";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const cents = (pct) => Math.round(Math.abs(pct));
const monthYear = (iso, t) => { const d = new Date(`${iso}T00:00:00Z`); return `${t(`fu.month.${d.getUTCMonth()}`)} ${d.getUTCFullYear()}`; };

export function companyNumbers(doc, symbol) {
  return (doc?.companies ?? []).find((c) => c.symbol === symbol && c.status !== "no_data") ?? null;
}

/** Plain lines for one company's filed numbers: [{id, label, text, tone}] plus the period they cover. */
export function fundamentalsWords(c) {
  if (!c) return null;
  const t = strings(dict);
  const lines = [];
  const g = num(c.revenue_growth_yoy_pct);
  if (g != null) {
    const q = num(c.quarter_revenue_growth_yoy_pct);
    const head = t(g >= 0 ? "fu.sales.grew" : "fu.sales.shrank", { pct: `${Math.abs(g).toFixed(0)}%`, period: t(c.basis === "annual" ? "fu.sales.year" : "fu.sales.ttm") });
    const tail = q != null ? t(q >= 0 ? "fu.sales.qUp" : "fu.sales.qDown", { pct: `${Math.abs(q).toFixed(0)}%` }) : ".";
    lines.push({ id: "sales", label: t("fu.label.sales"), tone: g >= 0 ? "accent" : "down", text: head + tail });
  }
  const op = num(c.operating_margin_pct);
  if (op != null) lines.push({ id: "op", label: t("fu.label.op"), tone: op >= 0 ? "accent" : "down", text: t(op >= 0 ? "fu.op.pos" : "fu.op.neg", { c: cents(op) }) });
  const net = num(c.net_margin_pct);
  if (net != null) lines.push({ id: "net", label: t("fu.label.net"), tone: net >= 0 ? "accent" : "down", text: t(net >= 0 ? "fu.net.pos" : "fu.net.neg", { c: cents(net) }) });
  const fcf = num(c.fcf_margin_pct);
  if (fcf != null) lines.push({ id: "fcf", label: t("fu.label.fcf"), tone: fcf >= 0 ? "accent" : "down", text: t(fcf >= 0 ? "fu.fcf.pos" : "fu.fcf.neg", { c: cents(fcf) }) });
  const period = t(c.basis === "annual" ? "fu.period.annual" : "fu.period.ttm", { month: monthYear(c.period_end, t), filed: c.filed });
  return { lines, period,
    stale: c.status === "stale", missing: c.missing ?? [] };
}
