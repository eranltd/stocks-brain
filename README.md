# stocks·brain

A personal, public stock-analysis agent. Every day it fetches Nasdaq data for a watchlist, builds a capped context pack,
runs the brain by itself every market morning (a scheduled Claude Code routine) whose picks are schema-checked and
recorded by an Action, scores past picks with code, and publishes a static dashboard on GitHub Pages.

**The household goal:** a diverse portfolio of 4-5 stocks around an index-fund core, aiming for +20% a year. The home page
leads with a computed verdict, checks the goal against history, shows what portfolio rule v1 holds and why, and keeps a
forward paper record that cannot be re-fitted. Money moves only when the trust ladder allows it (`docs/household.md`).

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
config/      watchlist.json, settings.json, sources.json (connectors), routines.json (schedule),
             people.json (people we learn from, the research on following them, their dated public calls),
             outlook.json (company outlook cards: latest quarter, guidance, next results date, what's next; linked)
schemas/     JSON Schemas for every file above, plus pick, run, outcome, prices, library
data/        market/derived.json + longrun.json (returns only, no prices), portfolio/paper.json (forward record),
             kb/outcomes.json, kb/library.json, people/scores.json, ops/routine_runs.json
             (raw bars stay in git-ignored .cache/)
runs/        run.<date>.json, one per run
samples/     deterministic synthetic data so the dashboard renders before live data exists
scripts/     _common.py (strict stdlib JSON-Schema subset), lint.py, scoring.py, market.py (setup checks, base
             rates, context), portfolio.py (rule v1, goal check), people.py (scores people's calls),
             routines_code.py (daily code-only steps),
             make_sample_data.py, build_site.py
prompts/     brain.md (the brain's rules), daily_brain_routine.md (what the scheduled brain session does)
.claude/workflows/brain.js  the saved multi-agent brain workflow the routine runs by name
.claude/workflows/outlook.js  the saved workflow that refreshes the company outlook cards (run on request)
site/        React + Tailwind + Vite dashboard (builds to _site/)
tests/       unittest suite (stdlib)
.github/workflows/  lint.yml (PRs), pages.yml (deploy on main), daily.yml (code-only routines), brain.yml (records a brain run)
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

Today (verdict, goal check, portfolio, market context, do the rules work, trust ladder) · Portfolio (4-5 stock builder,
correlation map, rule history, paper record) · Playbook · People (who we learn from, the research, their scored
calls) · Watchlist · Track record · KB (every pick) · Insights (library principles + dated claims) · Learnings ·
Runs (brain cost/time) · Routines (schedule, caps, run history) · How it works (pipeline map, roadmap) ·
Admin (the rule book with versions and GitHub edit links, connectors, decision log).

**Nothing lives only in a chat session.** Decisions and open items are in `docs/decisions.md`. Every KB batch is in
`data/kb/batches/` (lint fails if one is not ingested). Every routine run, failures included, is appended to
`data/ops/routine_runs.json`.
It has no third-party runtime scripts or fonts: everything is bundled and served from the Pages origin. It honours
`prefers-reduced-motion` and works at 393px.

## Daily routines (code only, $0)

`.github/workflows/daily.yml` runs on GitHub Actions (free for public repos):

| Routine | When (UTC) | Writes |
|---|---|---|
| fetch_prices (Tiingo, all-or-nothing) | Mon–Fri 23:40 | `data/prices/` |
| score_picks | Mon–Fri 23:40 | `data/kb/outcomes.json` |
| regime_monitor | Mon–Fri 23:40 | `data/kb/regime.json` |
| score_people | Mon–Fri 23:40 | `data/people/scores.json` |
| calibration | 1st of month 13:00 | `data/kb/calibration.json` |

It lints, commits the data to `main` and redeploys Pages. Lint fails if a GitHub Actions routine marked `active` in
`config/routines.json` has no matching cron in a workflow (a Claude routine such as the brain needs its prompt file and
`.claude/workflows/brain.js` instead). To test, run the workflow by hand
(Actions → daily → Run workflow). It defaults to a dry run.

```bash
python3 scripts/fetch_prices.py --dry-run     # fetch + validate, write nothing
python3 scripts/routines_code.py all          # score, regime, calibration
```

## The daily brain (Claude routine)

The brain runs by itself Tuesday to Saturday at 05:23 UTC, after the Monday to Friday closes are published, and fires
again at 11:23 UTC in case the data run was late (a day already recorded is skipped). It is a scheduled Claude Code routine on the household's Claude subscription (no API key, no new dependency). The session
follows `prompts/daily_brain_routine.md`:

```bash
bash scripts/data_branch.sh restore >/dev/null   # the published data
python3 scripts/build_pack.py                     # the pack the brain reads
python3 scripts/brain_status.py                   # {"as_of", "recorded", "run_file", "hold"}: stop if already recorded
```

then runs the saved workflow `brain` (`.claude/workflows/brain.js`), checks the picks, and dispatches `brain.yml`, which
rebuilds the pack, refuses the run if the data moved on, validates, lints and publishes `runs/run.<date>.json`, or
writes nothing. To run it by hand, follow the same file in a Claude Code session. To stop it, pause the routine in
Claude Code, or set `close_run` to `paused` in `config/routines.json` (see `docs/decisions.md`).

## Connectors and routines

- `config/sources.json` declares every data source: prices, X accounts, news, filings, 13F holdings (planned), library,
  people. A connector names its
  secret by **environment-variable name only**. Values live in GitHub Actions secrets.
- `config/routines.json` is the operating rhythm: daily close run and scoring, weekly opportunity scan and thesis review,
  monthly calibration and post-mortem. Every LLM routine has a cost cap, and anything that changes rules opens a PR for
  a person to merge.

## Library (books and lectures)

`data/kb/library.json` holds **paraphrased principles with a citation**. Each one is at most 280 characters and lint
rejects quotations. Never commit source text: the repo is public. The packer will include only principles whose
tags match the day, up to `pack.library_principles_max`.

## People we learn from

`config/people.json` lists the investors, teachers and writers the household follows: what we learn from each, where
they publish, what to be careful about, and what the research says about following people in public (in a study of
over 29,000 StockTwits finfluencers, most gave advice that did not beat the market after risk; studies of copying a
fund's disclosed holdings found copycats roughly matched the funds after costs, and a 13F is late and partial). It also holds a ledger of their dated
**public** calls on our watchlist names (for a 13F, the filing date), each with a link to the source. Learn from them,
but measure them: `routines_code.py people` (routine `score_people`) scores every call against the S&P 500 core on the
daily closes the Action holds, from the first trading day after the call became public, over 13, 26 and 52 weeks, and
writes only percentages to `data/people/scores.json`. A 13F is the fund's book: a call the file marks as the firm's own
(Berkshire's, for example) counts for the fund only, never for the person. A person's record says nothing until ten of their calls are half a year old. The brain sees
a compact view in `pack.people`, as context only. Calls are added by hand; no 13F or X connector is connected.

The site's **People** tab (in the phone's bottom bar) shows it all: who we follow and why, what to be careful about,
where each publishes, the research with links, and every call with how it has done against the core so far and at 13,
26 and 52 weeks, marked right, wrong or still maturing.

## Market today and company outlook

The **Today** post's market slide gives the last close in plain words: the S&P 500's and the Nasdaq-100's day moves, how
many of our names rose and fell, and the biggest riser and faller. The **Full dashboard** opens with the whole market
day: the three biggest risers and fallers, an average day move per sector, the S&P 500's distance from its high and the
share of our names above their fifty-day average. Percent changes only. It shows what moved, not why: news costs money
and is not connected. The close arrives with the nightly data run.

`config/outlook.json` holds a **company outlook card** per name: the latest quarter (revenue and its change from a year
earlier, highlights), the company's own guidance, the next results date (expected until confirmed), what is coming up
and what could change the story, each linked to the company's release or filing. Paraphrased, dated, no prices,
price targets or ratings (lint checks). The **Stock** page shows it as "What's next" (coming items split into Ahead and
Recently) and flags it once new results are, or are probably, out; Today ("Coming up") and the Full dashboard list
results dates in the next thirty days; the pack gives the brain the dates as event risk only.

Refresh after each earnings season, in a Claude Code session on this repo:

1. Run the saved workflow `outlook` with `{"today": "YYYY-MM-DD"}` (add `"tickers": [...]` for some names only).
   Researchers read primary sources in batches of four or five; a skeptic per batch re-checks every claim.
2. Put the returned `companies` into `config/outlook.json` (bump `version`, set `updated_at` and `change_note`), then
   run `python3 scripts/lint.py` and `python3 -m unittest discover -s tests`.
3. Open a pull request; a person reads the cards and merges.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| M1 | Folders, schemas, seed docs, lint, dashboard on sample data | done |
| M2 | `fetch_prices.py` behind a provider adapter (Tiingo) + `daily.yml` with code-only routines | done |
| M3 | `build_pack.py` + the brain (`prompts/brain.md`) + `record_run.py` through `brain.yml` | done |
| M4 | Scoring (code only, pick vs benchmark after N days) | done (`routines_code.py score`), waits for live picks |
| M5 | Daily Claude Code routine | the brain runs daily (`close_run`); other routines planned |

## Dependencies

- Python: standard library only.
- Site: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`,
  `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` (self-hosted fonts). All are pinned in
  `site/package-lock.json`.
