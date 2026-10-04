---
version: 0.1.0
updated_at: 2026-10-04
change_note: Seed methodology. Scoring rules defined; implementation lands in milestone 4.
---
# Methodology

## Daily pipeline
1. **fetch_prices**: the provider adapter writes `data/prices/<SYMBOL>.json`.
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
