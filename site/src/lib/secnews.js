// Official company news (data/market/sec_news.json, from the SEC's filings index) in plain words for the Stock page and
// the home's cards. Pure functions, no React; tested in secnews.test.js. Titles are fixed plain words chosen by code
// (scripts/sec_news.py), never text from the filings, so they can be shown as they are.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDay = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };

/** How each kind of news is shown: a word for the badge and a tone. */
export const NEWS_KIND = {
  results: { word: "Results", tone: "accent" },
  report: { word: "Report", tone: "flat" },
  warning: { word: "Heads-up", tone: "down" },
  people: { word: "People", tone: "people" },
  deal: { word: "Deal", tone: "ai" },
  money: { word: "Money", tone: "ai" },
  update: { word: "Update", tone: "flat" },
  other: { word: "Other", tone: "flat" },
};

/** A company's filings, newest first (as published), or []. */
export function newsFor(doc, symbol) {
  return (doc?.companies ?? []).find((c) => c.symbol === symbol)?.filings ?? [];
}

/** The newest filing worth a line on a card: quarterly results or a heads-up first if within two weeks of the newest. */
export function headlineFor(doc, symbol) {
  const f = newsFor(doc, symbol);
  if (!f.length) return null;
  const newest = f[0].date;
  const near = (x) => (new Date(`${newest}T00:00:00Z`) - new Date(`${x.date}T00:00:00Z`)) / 864e5 <= 14;
  const top = f.find((x) => near(x) && (x.kind === "results" || x.kind === "warning")) ?? f[0];
  return { ...top, title: top.titles[0], day: shortDay(top.date), ...NEWS_KIND[top.kind] };
}

/** Rows for the Stock page's list. */
export function newsRows(doc, symbol, max = 6) {
  return newsFor(doc, symbol).slice(0, max).map((f) => ({ ...f, title: f.titles.join(" · "), day: shortDay(f.date), ...NEWS_KIND[f.kind] }));
}
