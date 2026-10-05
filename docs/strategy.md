---
version: 0.2.0
updated_at: 2026-10-05
change_note: Code attaches the reference date, not a price; outcomes are published as returns.
---
# Strategy

## Purpose
Each trading day, rank a small watchlist of Nasdaq-listed stocks and pick at most a few names
worth attention over the scoring horizon (see `config/settings.json`). This is research
practice, not advice.

## What a pick is
- A **stance** (`bullish`, `bearish`, `neutral`) on one watchlist ticker.
- A **conviction** level (`low`, `medium`, `high`).
- A short **thesis**, the main **risks**, and an **invalidation** condition stated in words.
- **Evidence** keys pointing to items in the context pack.

The model never states prices, targets, percentages or dates. Code attaches the reference
date, and later the outcome as returns (no prices are published).

## What the brain should look for
1. Relative strength against the benchmark over the pack's lookback window.
2. Trend and volatility as summarised by code in the pack. The model does not recompute them.
3. Agreement or conflict with active lessons in `docs/learnings.json`.
4. Fewer, clearer picks beat many weak ones. Returning zero picks is allowed.

## Out of scope
- Personal holdings, position sizing, order placement.
- Non-public data. Only public market data enters this repo.
