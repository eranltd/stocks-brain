---
version: 0.2.0
updated_at: 2026-10-04
change_note: Prices published as derived numbers only; Tiingo key connected.
---
# Decision log

Every decision that shapes the system, with the reason. Newest first. Nothing lives only in a chat session.

## Open items (waiting on the owner)
- **Default branch**: set to `main` (Settings → General). Scheduled runs only fire from the default branch.
- **Author of sources S-001 to S-005**: confirm they are the same channel (Micha) as the later batches.
- **Reference prices in pick records**: runs and outcomes store single reference and exit closes. This is minor, but revisit at M3: drop them, or keep them as computed returns only.
- **LLM step (M3)**: run the daily brain as a scheduled Claude Code routine on the owner's subscription (preferred) or through a paid API key.
- **Paid connectors** (news, X, options data for implied moves): parked until the owner wants to spend.

## 2026-10-04
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
