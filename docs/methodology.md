---
version: 0.10.0
updated_at: 2026-10-07
change_note: People we learn from - each dated public call is scored against the core from fixed trading days; the brain fires at 05:23 and 11:23 UTC.
---
# Methodology

## Daily pipeline
1. **fetch_prices**: the provider adapter (Tiingo, split/dividend-adjusted end-of-day bars) writes `.cache/prices/<SYMBOL>.json` (git-ignored; raw bars are never committed).
   Each fetch re-pulls the whole kept window, so stored history is adjusted consistently.
   All symbols must fetch and validate, or nothing is written.
2. **build_pack**: docs, prices and recent runs go into one JSON pack. The run stops if the pack exceeds `pack.token_cap`.
3. **brain** (routine `close_run`): a scheduled Claude Code session on the household's Claude subscription, Tuesday to
   Saturday at 05:23 UTC and again at 11:23 UTC in case the data run was late (after the Monday to Friday closes are
   published), follows `prompts/daily_brain_routine.md`. It
   restores the published data, builds the pack, and stops if `scripts/brain_status.py` says that market day's run already
   exists (so holidays are skipped). Otherwise it runs the saved workflow `.claude/workflows/brain.js` (`prompts/brain.md`:
   three analyst lenses, a skeptic per candidate, a constructor and a reviewer) and checks the picks with
   `record_run.check_picks`. It records them only by dispatching the `brain` Action, which rebuilds the same pack from the
   `data` branch, refuses the run if the data has moved on, validates and lints, and writes nothing if any check fails.
   The session never commits, edits files or fetches prices.
4. **score_picks**: pure code. Each pick older than `scoring.horizon_days` trading days is scored against the benchmark.
5. **lint**: schemas, hygiene and size caps. Publish only when lint passes.

## Scoring (code only)
- `return_pct = (exit_close / ref_close - 1) * 100`, using adjusted closes `horizon_days` trading days apart,
  both read from the current price series. Live runs record only the reference date and outcomes publish returns,
  never prices (provider licence); synthetic samples keep their made-up prices.
- `benchmark_return_pct` uses the same formula on the benchmark over the same dates.
- `excess_pct = return_pct - benchmark_return_pct`.
- Verdict with flat band `b = scoring.flat_band_pct`:
  - bullish: `hit` if excess > b, `miss` if excess < -b, else `flat`
  - bearish: `hit` if excess < -b, `miss` if excess > b, else `flat`
  - neutral: `hit` if |excess| <= b, else `miss`

## Run record
Every run writes `runs/run.<date>.json` with cost, minutes, pack hash and token count, the doc
versions used, and the picks. The git history of the `data` branch is the audit log.
- `scripts/build_pack.py` builds the pack from live derived data only (it refuses samples), selects up to
  `pack.library_principles_max` library principles by tag, and fails closed above `pack.token_cap`. Every citable key
  is a lowercase dot path (`market.nvda.setup`, `library.s-028:p02`).
- `scripts/record_run.py` checks the brain's output (pick schema, guardrails, evidence keys that exist in the pack, one
  run per market day), attaches the reference date and writes the run; nothing is written if any check fails.

## Where data lives
Code is on `main`, which requires pull requests. Everything the routines write (`data/` and `runs/`) is published to the
`data` branch by `scripts/data_branch.sh`, with full history and no force pushes. Each run restores the published data,
works on it, and publishes it back only if lint passes; the Pages build overlays it on `main` before exporting the site.

## Regime (code only)
Computed daily from benchmark closes; parameters live in `config/settings.json` under `regime`.
- `vol_ann_pct`: standard deviation of the last `vol_days` daily log returns, times the square root of 252, times 100.
- `drawdown_pct`: last close against the highest close of the last `drawdown_days`.
- Trend: `up` if the close is above its `trend_sma_days` average and that average rose over `slope_days`;
  `down` if both are the opposite; otherwise `sideways`.
- State: `stressed` if vol is at least `vol_stressed_pct` or drawdown is at least `drawdown_stressed_pct`;
  `calm` if vol is at most `vol_calm_pct`; otherwise `normal`.

## Calibration (code only)
Monthly. Hit rate and average excess grouped by conviction and by stance. Conviction is `informative`
only if high-conviction picks beat low-conviction picks on hit rate, with at least
`scoring.calibration_min_n` scored picks in each group. Otherwise it is `not_informative`, or `insufficient_data`.

## Setup checks v2 (code only, not a recommendation)
Four pass/fail checks per watchlist name, computed in Python (`scripts/market.py`) and published in `derived.json`.
Thresholds live under `setup` in settings.
1. **Trend**: the close is above its 50-day average, and the 50-day is above the `trend_long_days` (200-day) average.
2. **3-month strength**: the return over `rs_short_days` beats the benchmark's.
3. **6-month strength**: the return over `rs_long_days` beats the benchmark's. (Relative strength over 3 to 12 months
   is the replicated signal in the literature; 20 days is mostly noise.)
4. **Not stretched**: the close is less than `stretch_pct` above its 50-day average. With `veto_stretched`, failing
   this blocks any new buy, whatever the other checks say.
The **gate** is: at least 3 checks pass and the name is not stretched.

## Base rates: do the checks work? (code only)
For every name, every `backtest.step_days` trading days over the kept history (about 10 years), the checks are
graded with data up to that day, and the excess return over the benchmark `backtest.horizon_days` later is recorded.
Step = horizon, so samples per name do not overlap. Published: mean, 90% confidence interval (z = 1.645), share
positive and n, by score (0 to 4), by check (pass vs fail) and for the gate. The same names are used throughout,
so this compares the checks with themselves; it says nothing about picking better names.

## Market context (code only)
From the context funds in `config/watchlist.json` (roles, not tickers, drive the logic):
- **Cash hurdle**: annualised 21-day return of a 0-3 month T-bill fund.
- **Participation**: equal-weight minus cap-weight return over 20 and 60 days (Nasdaq-100 and S&P 500). Both below
  -1 point = narrow (a few giants carry the index); both above +1 = broad; otherwise mixed.
- **Credit**: high-yield bond fund minus 7-10 year Treasury fund over 60 days.
- **Core trend filter**: the core index fund above its ~10-month (210-day) average and its 12-month return above
  cash. Context for the core only, never a trading trigger.

## The household goal check (code only)
`settings.goal.annual_return_pct` (+20%) is compared with history, never used to pick stocks. For the rule, holding
every watchlist name equally (monthly), the core and the benchmark: compound annual return, deepest drawdown,
and the share of rolling 12-month windows at or above the goal, below zero, worst, median and best.
**Hindsight**: the watchlist is chosen today, so every history test on it is flattered. Compare the rule with
"all names equal" (same hindsight), not with the goal.

## Portfolio rule v1 (code only)
A diversified satellite of up to `portfolio.slots` (5) names. Monthly, at the close of the first trading day:
1. Keep a held name while it passes `keep_min_checks` (2); stretch is ignored for names already held (no selling strength).
2. Add names that pass the gate (`entry_min_checks` = 3, not stretched).
3. Rank by checks passed, then 6-month strength vs the benchmark; fill slots with at most `max_per_sector` per GICS
   sector and no pair with 1-year daily-return correlation above `max_pair_corr`.
4. Equal weight per slot; empty slots stay in the core index fund. Costs: `cost_bps` per unit of weight traded.
The history test (after the 252-day warm-up) covers the span that every eligible name, the core and the benchmark share
(about 7 years with today's list, because one name listed in 2018; names need `portfolio.min_history_years` of data).
It is in `data/market/longrun.json`, with each name's long-run numbers, the last 24 rebalances, the current status of every
name and a 1-year correlation matrix. The rule engine below uses the full 10 years and lets late listings join once they
have a year of data.

## Forward paper portfolio (code only)
`data/portfolio/paper.json`. On the first daily run of each calendar month the rule's holdings are chosen with that
day's data and appended. Recorded holdings are never edited; the track is recomputed from them each day (values
indexed to 100, same costs). This is the only evidence free of hindsight, so the trust ladder rests on it.
It also carries the risk of what it holds now (`diversification`, as in longrun's `now`) and `if_rebalanced_today`.
The site's portfolio views show this record. The history test's own path can hold a different set, because it keeps a
name it already held while that name passes the keep checks; the record started fresh, so a name needs the entry checks.

## Rule engine (code only)
`config/rules.json` is the pre-registered rule set (the Playbook tab is its human version): 23 rules, 6 plans, 14 experiments, the
acceptance numbers and the count of tries (17), written before any rule ran on real prices. `scripts/rules.py` runs every
testable rule; `data/market/rules.json` holds the results (percentages and values indexed to 100, no prices).
Common conventions: a decision at the close of day d uses data up to d only and fills at the close of d + `fill_lag_days`
(1: the next close); costs are `portfolio.cost_bps` per unit of weight traded; a name joins only after one year of history;
cash earns the T-bill fund's return, and zero before that fund existed (pessimistic for rules that hold cash).
- **Savings study.** The core fund is bought on a cadence. Stream: one unit of cash arrives each week and everything on hand
  is invested every x weeks (x = 1, 2, 4 or 13), optionally only while the core is above its 10-month (210-day) average;
  cash waits in T-bills. Windfall: a lump sum invested at once or in equal weekly tranches. Each variant is run from every
  4th week as a start date over each horizon. Reported per variant: median money-weighted return (IRR) and money multiple,
  the 10th-percentile of the worst moment when the account was worth less than what had been paid in, average share held
  in cash, trades a year, and against the baseline of the same kind: median IRR difference in basis points, share of start
  dates where it was better, and the fixed fee per trade (as a share of one weekly contribution) at which less frequent
  buying catches up. Start dates overlap, so **independent windows** (span divided by horizon) is the honest sample size;
  below `acceptance.savings.min_independent_windows` no verdict is given.
- **Satellite rules.** A sleeve of up to `slots` names: filters (trend, a close above a rising n-day average, 3/6/12-1-month relative strength, stretch, breakout,
  pullback, low volatility), a rank, a keep rule for names already held (same filters, or stay while in the top n and above a long average), sector and correlation caps, equal or inverse-volatility sizing, optional exits (ATR
  trailing stop on true range, trend break) and an optional gate that sends the sleeve to the core while the core's trend is
  off. Rebalanced on the first trading day of each month (or quarter). Controls: the core, and every eligible name equally.
- **Matched null (skill versus luck).** For each rule, random names are drawn with the **same number of names at every
  decision** (same exposure to stocks versus the core), the **same replacement rate** (same trading), the same caps, fills and
  costs, `acceptance.null_runs` times. Only *which* names differs, so the rule's percentile among the draws measures selection.
  The null is drawn from the same hand-picked names on purpose: it reduces, but does not remove, the hindsight shared by rule and null (experiment E07 plans the check).
- **Verdict (history only).** `rejected`: below `reject_below_percentile`. `passes_history`: percentile above the bar adjusted
  for the number of variants tried (Bonferroni on 1 - `null_percentile_min`), at least `halves_percentile_min` in each half of
  the history, deepest drop not more than `max_dd_worse_than_core_pts` worse than the core, turnover within `max_turnover_pct_year`.
  `candidate`: percentile above `null_percentile_min` and both halves ok. Otherwise `inconclusive`. Every testable rule gets a forward record from its first run; a pass only makes a rule worth a closer read.
  **History never moves money.** `null_percentile_min` is the significance level (100 minus it, 0.05), applied to the Bonferroni-adjusted
  p-value: with 17 tries and 2000 draws a rule must be at or above all but 4 of them (about the 99.8th percentile). The reference baseline (rule v1, whose history was seen before the registry was
  written) is capped at `candidate`. Turnover is the percent of the sleeve replaced per year (a sale and a purchase count once).
  **The verdict is read once**: `data/market/rules.json` carries a `frozen` block (as-of date, a hash of everything that decides a
  verdict, the verdict of each rule) written on the first real-data run; later days update the displayed numbers, not the
  verdict, so a lucky day cannot flip a rule. A change to the rules' engine settings, the acceptance numbers, the tries, the cost, the settings rule v1 reads
  (`config/settings.json` setup and portfolio) or the watchlist and its sector labels starts a new freeze (a new pre-registration); the
  program accepts it only if `tries_counted` was raised, and keeps the earlier freeze in the file. Prose changes do not start one.
- **Forward ledger.** `data/portfolio/paper_rules.json`: on the first daily run of each month (quarter for quarterly rules) every
  testable satellite rule's names are chosen with that day's data and appended, never edited. Each track is recomputed from the
  record by the same engine (stops are mechanical). After 6 decisions and about six months the rule is compared with the matched null over the
  forward window alone (the forward percentile; before that it is marked provisional). Every testable satellite rule is tracked
  from its first run, whatever its history verdict.
- **Tests that keep this honest.** The engine reproduces rule v1 exactly; replacing all data after any decision day with a
  different future leaves every decision unchanged (a mutation check proves the test can fail); the fast period simulator used by the
  null equals the daily engine to nine decimals; a small repo test (12 random pickers against 80-draw nulls) guards only against gross miscalibration of the null; it does not test the
  17-try bar. A price gap that would silently shrink the universe stops the run instead of shortening a name's history.

## People we learn from (code only)
`config/people.json` lists the investors, teachers and writers we follow: what we learn from each, where they publish, a
caution, the research on following people in public, and a ledger of their dated **public** calls on our watchlist names.
A call records who made it and through which fund (`via`), the day it became public, the ticker, bullish or bearish, a
paraphrase of what they did and a link to the source. People kept for their principles only have no calls. The People
tab shows all of it. Learn from them, but measure them: `scripts/people.py` (routine `score_people`) scores each call
on the daily closes of the name and the S&P 500 core that the daily Action already holds (never published; only
percentages and dates are written to `data/people/scores.json`):
- A call starts on the first trading day **strictly after** the day it became public (for a 13F, its filing date; the
  fund may have said it earlier), so nothing is known before it was public.
- Growth of the name and of the core over 13, 26 and 52 weeks of five trading days (65, 130 and 260 trading days) once
  that much time has passed, and so far to the latest close. The start and every finished horizon are fixed trading
  days, so a new close moves only "so far". `excess = (1 + name) / (1 + core) - 1`, in percent.
- Signed excess is the excess for a bullish call and minus the excess for a bearish one; the call was right when it is
  above zero.
- A call on a name that is not on the watchlist is kept and shown but not scored, and so is a call made before the
  history we hold for the name (or with a gap of more than a week after its public date).
- Per person and per fund: calls, scored calls, calls matured at 26 weeks, the share right at 26 weeks and the median
  signed excess at 26 weeks. Fewer than ten matured calls is too few to judge.
- A 13F is a fund's quarter-end US long book filed up to about forty-five days late, and the firm's book rather than the
  named person's own pick; each call names the fund it came from. A call marked `credit_person: false` (Berkshire's,
  for example) counts in the fund's record only. The pack shows all of this as context, never as the only evidence for
  a pick, and tells the brain to name the fund, not the person.
- Why context only: in a study of over 29,000 StockTwits finfluencers, most gave advice that did not beat the market
  after risk (the People tab cites the research), a 13F is late and partial, and people tend to praise what their funds
  own. Until a record has ten matured calls it cannot tell skill from luck, so no call is ever the only reason for a
  pick and none moves money.

## Evidence labels (the Playbook's rules)
`replicated`: independent replication named in the cited library material. `mixed`: backed by principles from more than one source, with
caveats or gaps. `weak`: one source's assertion, an inference, or a house convention. `untested`: the library is silent. `contradicted`:
the library argues against it. A library id beside a rule is a source consulted, not proof; each rule says which numbers are conventions.

## Trust statistics
- **Portfolio (trust ladder)**: stage 1 when the paper record exists; stage 2 needs `trust.paper_min_days_small` days
  of record, the paper portfolio ahead of the core, the rule ahead of "all names equal" in history, and the gate's
  90% interval above zero; stage 3 needs `trust.paper_min_days_trusted` days and still ahead of the core.
- **Brain picks (Track record)**: signed excess (bullish +x, bearish -x, neutral -|x|), effective picks (one per
  ticker per horizon, no overlap), Wilson lower bound of the hit rate, and calendar span.
