---
version: 0.2.0
updated_at: 2026-10-04
change_note: Prices from Stooq; scoring, regime and calibration now run as code-only routines.
---
# Methodology

## Daily pipeline
1. **fetch_prices**: the provider adapter (Stooq, free end-of-day CSV) writes `data/prices/<SYMBOL>.json`.
   All symbols must fetch and validate, or nothing is written.
2. **build_pack**: docs, prices and recent runs go into one JSON pack. The run stops if the pack exceeds `pack.token_cap`.
3. **run_brain**: one LLM call with JSON-schema output and at most one repair retry. The run stops if
   the projected cost exceeds `cost.hard_cap_usd` or schema validation fails twice.
4. **score_picks**: pure code. Each pick older than `scoring.horizon_days` trading days is scored against the benchmark.
5. **lint**: schemas, hygiene and size caps. Publish only when lint passes.

## Scoring (code only)
- `return_pct = (exit_close / ref_close - 1) * 100`, using closes `horizon_days` trading days apart.
- `benchmark_return_pct` uses the same formula on the benchmark over the same dates.
- `excess_pct = return_pct - benchmark_return_pct`.
- Verdict with flat band `b = scoring.flat_band_pct`:
  - bullish: `hit` if excess > b, `miss` if excess < -b, else `flat`
  - bearish: `hit` if excess < -b, `miss` if excess > b, else `flat`
  - neutral: `hit` if |excess| <= b, else `miss`

## Run record
Every run writes `runs/run.<date>.json` with cost, minutes, pack hash and token count, the doc
versions used, and the picks. The git history is the audit log.

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
