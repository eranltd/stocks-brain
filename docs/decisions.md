---
version: 0.5.0
updated_at: 2026-10-04
change_note: Household goal (diverse 4-5 stocks, +20% a year); investor review of the home page; portfolio rule v1 and the forward paper portfolio.
---
# Decision log

Every decision that shapes the system, with the reason. Newest first. Nothing lives only in a chat session.

## Open items (waiting on the owner)
- **Author of sources S-001 to S-005**: confirm they are the same channel (Micha) as the later batches.
- **Reference prices in pick records**: runs and outcomes store single reference and exit closes. This is minor, but revisit at M3: drop them, or keep them as computed returns only.
- **LLM step (M3)**: run the daily brain as a scheduled Claude Code routine on the owner's subscription (preferred) or through a paid API key.
- **Paid connectors** (news, X, options data for implied moves): parked until the owner wants to spend.
- **Diversify the watchlist**: all 8 names are US large caps in 4 sectors (4 in technology). A diverse 4-5 stock
  portfolio needs candidates from other sectors. Adding names is a one-line config change each; the owner picks them.
- **Satellite size**: `docs/household.md` proposes 10% of savings (2% per slot). The owner sets it.
- **Second price source**: Tiingo's daily returns show unusually low correlations between these names (for example
  AAPL to QQQ about 0.24 over a year). The diagnostic showed our pipeline reproduces the provider's data exactly, so
  the numbers are faithful to the source; a cross-check against a second source is still pending.

## 2026-10-04
- **Household goal: a diverse portfolio of 4-5 stocks, +20% a year.** Recorded in settings (`goal`) and house rules.
  The site shows the goal next to what history says (compounding, rolling 12-month hit rate, deepest drops) and never
  uses it to pick stocks. +20% a year is about twice the market's long-run return, so the page says so plainly.
- **Investor review of the home page** (five lenses: allocator, risk, quant, behaviour, product). Verdict: the old
  home page could not support a decision. It led with sample picks and a 20-day leaderboard, had no cash hurdle, no
  downside, no core, a trust gate with a sign bug (raw instead of signed excess) that luck could pass, and a "live"
  pulse that created urgency. Changes:
  - Home leads with a computed verdict ("Nothing to do today. The core plan stands."), stale-data fail-closed.
  - Setup checks v2 (long trend, 3- and 6-month strength, stretch veto) computed once in Python.
  - Base rates over ~10 years show whether the checks have ever worked.
  - Market context: cash hurdle, equal- vs cap-weight participation, credit, the core's slow trend filter
    (Roni's shelf: slow trend filters on broad indexes; relative strength over 3-12 months; volatility sizing).
  - Trust statistics: signed excess, effective (non-overlapping) picks, Wilson lower bound, calendar span.
- **Portfolio rule v1 and a forward paper portfolio.** The rule picks up to 5 names monthly with a sector cap and a
  correlation cap; empty slots stay in the core. It is tested over ~9 years against holding every name, the core and
  the benchmark. Because that test has hindsight (today's watchlist), the trust ladder now rests on a forward paper
  record whose monthly holdings are written once and never edited.
- **Portfolio builder** on its own tab: the household can try any 4-5 names; the selection stays in the browser
  (localStorage), never in the public repo.
- **Library batches 8 and 9: the books.** A separate project read and summarised 119 investing and trading books
  (public at https://github.com/ungaroni/the-whole-shelf) and cross-examined them in groups. The durable, cited
  principles from 31 of those books, plus the Micha course notes on index investing and the long-average trend method,
  were ingested as sources S-020 to S-050 through `scripts/kb_ingest.py`. Each `ref` points at the public summary.
  No source text was committed. A short human version lives in `docs/shelf.md`, listed on the Admin tab.
- **Product goal: household trust and good decisions.** Added in response:
  - a trust ladder (Observe, Paper, Small money, Trusted) computed from real scored picks, with thresholds under `trust` in settings
  - house rules in `docs/household.md`: core index first, size limits, and the conditions before acting
  - "Can we act on this?" on each stock page, which applies those rules
  - "In plain words" summaries written by code
- **Stock pages** (`#stock/SYMBOL`) show:
  - the chart vs the benchmark, indexed, with the 50-day average and 1M to 1Y ranges
  - code-only setup checks (methodology "Setup checks")
  - lessons matched to the stock's condition
  - claims that name it
  - the brain's call, sample-labelled until M3
- **Today leads with a live market brief while picks are sample.** It shows a computed headline, lessons in play (library principles matched to conditions by tag), relative strength vs the benchmark, and live claims on watchlist names. Sample picks follow as a labelled preview.
- **Phones get a bottom tab bar** (Today, Watchlist, Insights, Routines, More). Ten tabs in a scrolling strip hid most of them on an iPhone.
- **Default branch is `main`**, so scheduled runs fire.
- **Prices are derived-only (owner's choice).** Tiingo's free plan forbids redistribution and the repo is public. Raw bars live only in a git-ignored `.cache/` inside each Action run (each fetch returns the full window, so nothing raw needs to persist). The public repo gets `data/market/derived.json`: 1-, 20- and 60-day returns, return vs the benchmark, distance from the 50-day average, breadth, and sparklines indexed to 100. The regime file now uses percentages instead of absolute closes. Lint fails if raw bars are ever committed.
- **Tiingo key connected.** The dry run on main fetched 260 bars per symbol.
- **Routines get their own tab**, with a run log in `data/ops/routine_runs.json`. Each workflow run appends its outcome, failures included, so the site shows what actually ran.
- **Batch files are committed** under `data/kb/batches/`. Lint fails if a batch is on record but not ingested.
- **Insights tab** for the library and dated claims, with search, themes and YouTube links. The owner considers these the most valuable content.
- **Knowledge has two kinds.** *Principles* are durable lessons, paraphrased, at most 280 characters, cited, with no quotations. *Observations* are dated third-party claims with an expiry and an `unverified` status, kept after expiry so sources can be scored. Ingest goes through `scripts/kb_ingest.py`: ids assigned, invisible characters stripped, idempotent, fails closed.
- **Direct commits to `main`** at the owner's request; no PRs for now.
- **Prices: Tiingo**, an official end-of-day API with a free key held in a GitHub secret and sent in a header. Bars are split- and dividend-adjusted; each fetch re-pulls the window. Scoring reads both closes from the current series.
- **Stooq rejected for the Action**: it serves a JavaScript bot check to GitHub runners (seen in a workflow run). It is kept as a local fallback, and the check is not bypassed.
- **Code-only routines on**: fetch prices, score matured picks, regime monitor (Mon–Fri 23:40 UTC), calibration (monthly). All cost $0. Lint fails if an active routine has no matching cron in a workflow.
- **Connectors and routines are config.** `config/sources.json` names secrets only by environment variable. `config/routines.json` holds the schedule, AI cost caps, a human gate for anything that changes rules, and the reasoning for each routine.
- **PWA**: manifest, Apple touch icon, and a hand-written service worker (offline with the last data). No new dependency.
- **Fonts**: Inter and JetBrains Mono, self-hosted from npm packages. They are served from the Pages origin, so there are no runtime third-party calls.
- **Site stack**: React + Tailwind + Vite at the owner's request, for maintainability, styled after the owner's Experiments Generator reference. Dark by default.
- **Pages** deploys from `main` through GitHub Actions (Settings → Pages → Source: GitHub Actions).

## Standing rules
- Numbers, dates and verdicts come from code, never from the model. Pick prose may not contain digits.
- No ticker literals in scripts or site code; they live in `config/`.
- Fail closed: token cap, cost cap, schema checks and lint all stop a run rather than publish bad data.
- Public repo: public market data only, no secrets, no personal holdings.
