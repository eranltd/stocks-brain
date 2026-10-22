import test from "node:test";
import assert from "node:assert/strict";
import { companyNumbers, fundamentalsWords } from "./fundamentals.js";

const row = { symbol: "AAA", status: "ok", period_end: "2026-06-30", filed: "2026-07-30", revenue_growth_yoy_pct: 14.2,
  quarter_revenue_growth_yoy_pct: -2.1, operating_margin_pct: 33.2, net_margin_pct: -8.2, fcf_margin_pct: 29.3, missing: [] };

test("fundamentalsWords turns margins into cents of each dollar", () => {
  const w = fundamentalsWords(row);
  assert.equal(w.lines[0].text, "Grew 14% over the last twelve months; the latest quarter was down 2% on a year before.");
  assert.equal(w.lines[1].text, "Keeps 33 cents of operating profit from each dollar of sales.");
  assert.equal(w.lines[2].tone, "down");
  assert.match(w.lines[3].text, /29 cents of spare cash/);
  assert.match(w.period, /Twelve months to June 2026/);
  assert.equal(fundamentalsWords(null), null);
});

test("companyNumbers skips companies with no data", () => {
  const doc = { companies: [row, { symbol: "BBB", status: "no_data" }] };
  assert.equal(companyNumbers(doc, "AAA"), row);
  assert.equal(companyNumbers(doc, "BBB"), null);
  assert.equal(companyNumbers(null, "AAA"), null);
});
