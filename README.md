# stocks·brain

A personal, public stock-analysis agent. Every day it fetches Nasdaq data for a watchlist, builds a capped context pack,
makes **one** LLM call that returns schema-checked picks, scores past picks with code, and publishes a static dashboard
on GitHub Pages.

> Analysis only, not financial advice. Data may be delayed.
> The repo and the site are **public**: public market data only, no secrets, no personal holdings.

## Principles

- **Knowledge lives in versioned files**, not prompts. `prompts/brain.md` stays short; rules live in `docs/`, lessons in `docs/learnings.json`.
- **Numbers, dates and verdicts come from code**, never from the LLM. `pick.schema.json` has no numeric fields, and lint rejects digits in pick prose.
- **No ticker or surface literals in scripts or the site.** They come from `config/`, and lint enforces it.
- **Fail closed.** A pack over its token cap, a projected cost over the cap, or a failed schema check stops the run. The site will not build if lint fails.

## Layout

```
docs/        strategy.md, methodology.md (front matter: version, updated_at, change_note)
             guardrails.json, learnings.json (same three keys)
config/      watchlist.json, settings.json, sources.json (connectors), routines.json (schedule)
schemas/     JSON Schemas for every file above, plus pick, run, outcome, prices, library
data/        prices/ (written by the fetch Action), kb/outcomes.json, kb/library.json
runs/        run.<date>.json, one per run
samples/     deterministic synthetic data so the dashboard renders before live data exists
scripts/     _common.py (strict stdlib JSON-Schema subset), lint.py, scoring.py,
             make_sample_data.py, build_site.py
prompts/     brain.md
site/        React + Tailwind + Vite dashboard (builds to _site/)
tests/       unittest suite (stdlib)
.github/workflows/  lint.yml (PRs), pages.yml (deploy on main)
```

## Quickstart

```bash
python3 scripts/make_sample_data.py      # optional: regenerate samples/
python3 scripts/lint.py                  # schemas, guardrails, secrets, size caps, literals
python3 -m unittest discover -s tests
python3 scripts/build_site.py            # lint + export JSON to site/public/data
cd site && npm ci && npm run dev         # http://localhost:5173
npm run build                            # -> ../_site
```

The dashboard uses live data (`runs/`, `data/`) as soon as any run exists. Until then it shows `samples/`, with a
"Sample data" badge.

**GitHub Pages:** go to Settings → Pages → Source and choose **GitHub Actions**. `pages.yml` deploys on every push to `main`.
Live at https://eranltd.github.io/stocks-brain/. On iPhone, open it in Safari, then Share → Add to Home Screen.
It runs full-screen and works offline with the last data it saw.

## Dashboard

Today · Watchlist · Track record · KB (every pick, plus the library) · Learnings · Runs · How it works (pipeline map,
routines, roadmap) · Admin (the rule book with versions and GitHub edit links, plus connectors).
It has no third-party runtime scripts or fonts: everything is bundled and served from the Pages origin. It honours
`prefers-reduced-motion` and works at 393px.

## Daily routines (code only, $0)

`.github/workflows/daily.yml` runs on GitHub Actions (free for public repos):

| Routine | When (UTC) | Writes |
|---|---|---|
| fetch_prices (Stooq, all-or-nothing) | Mon–Fri 23:40 | `data/prices/` |
| score_picks | Mon–Fri 23:40 | `data/kb/outcomes.json` |
| regime_monitor | Mon–Fri 23:40 | `data/kb/regime.json` |
| calibration | 1st of month 13:00 | `data/kb/calibration.json` |

It lints, commits the data to `main` and redeploys Pages. Lint fails if a routine marked `active` in
`config/routines.json` has no matching cron in a workflow. To test, run the workflow by hand
(Actions → daily → Run workflow). It defaults to a dry run.

```bash
python3 scripts/fetch_prices.py --dry-run     # fetch + validate, write nothing
python3 scripts/routines_code.py all          # score, regime, calibration
```

## Connectors and routines

- `config/sources.json` declares every data source: prices, X accounts, news, filings, library. A connector names its
  secret by **environment-variable name only**. Values live in GitHub Actions secrets.
- `config/routines.json` is the operating rhythm: daily close run and scoring, weekly opportunity scan and thesis review,
  monthly calibration and post-mortem. Every LLM routine has a cost cap, and anything that changes rules opens a PR for
  a person to merge.

## Library (books and lectures)

`data/kb/library.json` holds **paraphrased principles with a citation**. Each one is at most 280 characters and lint
rejects quotations. Never commit source text: the repo is public. The packer will include only principles whose
tags match the day, up to `pack.library_principles_max`.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| M1 | Folders, schemas, seed docs, lint, dashboard on sample data | done |
| M2 | `fetch_prices.py` behind a provider adapter (Stooq) + `daily.yml` with code-only routines | done |
| M3 | `build_pack.py` + `run_brain.py` (target < $1/run, warn > $2, hard cap $2.50) | needs an LLM SDK decision |
| M4 | Scoring (code only, pick vs benchmark after N days) | done (`routines_code.py score`), waits for live picks |
| M5 | Daily Claude Code routine | |

## Dependencies

- Python: standard library only.
- Site: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`,
  `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` (self-hosted fonts). All are pinned in
  `site/package-lock.json`.
