// A company's own numbers (data/market/fundamentals.json, from its SEC filings) in plain sentences for the Stock page.
// Pure functions, no React. Trailing twelve months; "cents of each dollar of sales" reads easier than a margin.

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const cents = (pct) => `${Math.round(Math.abs(pct))} cents`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthYear = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

export function companyNumbers(doc, symbol) {
  return (doc?.companies ?? []).find((c) => c.symbol === symbol && c.status !== "no_data") ?? null;
}

/** Plain lines for one company's filed numbers: [{label, text, tone}] plus the period they cover. */
export function fundamentalsWords(c) {
  if (!c) return null;
  const lines = [];
  const g = num(c.revenue_growth_yoy_pct);
  if (g != null) {
    const q = num(c.quarter_revenue_growth_yoy_pct);
    lines.push({ label: "Sales", tone: g >= 0 ? "accent" : "down",
      text: `${g >= 0 ? "Grew" : "Shrank"} ${Math.abs(g).toFixed(0)}% over the last twelve months` +
        (q != null ? `; the latest quarter was ${q >= 0 ? "up" : "down"} ${Math.abs(q).toFixed(0)}% on a year before.` : ".") });
  }
  const op = num(c.operating_margin_pct);
  if (op != null) lines.push({ label: "Profit from the business", tone: op >= 0 ? "accent" : "down",
    text: op >= 0 ? `Keeps ${cents(op)} of operating profit from each dollar of sales.` : `Lost ${cents(op)} on each dollar of sales from running the business.` });
  const net = num(c.net_margin_pct);
  if (net != null) lines.push({ label: "Bottom line", tone: net >= 0 ? "accent" : "down",
    text: net >= 0 ? `${cents(net)} of each dollar of sales was left as profit after everything.` : `A loss of ${cents(net)} on each dollar of sales after everything, often a one-off charge: check the filing.` });
  const fcf = num(c.fcf_margin_pct);
  if (fcf != null) lines.push({ label: "Cash after investing", tone: fcf >= 0 ? "accent" : "down",
    text: fcf >= 0 ? `Brought in ${cents(fcf)} of spare cash per dollar of sales after paying for new buildings and equipment.` :
      `Spent ${cents(fcf)} more per dollar of sales than it brought in, after paying for new buildings and equipment.` });
  return { lines, period: `Twelve months to ${monthYear(c.period_end)}, from the company's filings with the SEC (filed ${c.filed}).`,
    stale: c.status === "stale", missing: c.missing ?? [] };
}
