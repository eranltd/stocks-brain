---
version: 0.5.0
updated_at: 2026-10-16
change_note: The household acts weekly. Real money buys the whole-market fund every week; a weekly pretend-money game (two weekly rules) is scored every week against the market and against random picks.
---
# House rules

This site exists to help our household invest calmly and with evidence. It is a research notebook, not advice.
These rules decide when, and how much, we act on anything it shows.

## Our goal
- **Real money follows the honest action**, shown on the Brain's verdicts page and decided first by when the money may
  be needed:
  - **5 years or more**: a low-cost fund that holds the whole market (an S&P 500 fund), the same amount every week
    (the household acts weekly), left alone through the drops.
  - **1 to 5 years**: part safe (T-bills or a savings account), part the whole-market fund; the sooner the money is
    needed, the bigger the safe part.
  - **Within a year**: safe only. Stocks can drop a lot in a few months.
- **No 4-5 stock plan with real money** (household decision, 2026-10-13). Picking a few stocks was the old satellite;
  on years of past prices every pre-registered stock rule did no better than stocks picked at random, so it is not
  where the household's money goes.
- Reality check: the broad US market's long-run return is near 10% a year, with deep drops on the way. +20% a year
  (`goal` in settings) is a stretch target for the experiments, not a promise; few investors sustain it.

## The experiments (pretend money)
- **The weekly game** (household decision, 2026-10-16: "we are weekly traders"). Two weekly rules in
  `config/rules.json` (`five_leaders_weekly`, `weekly_swing`) pick their names on the first trading day of each week
  and are recorded forward in the rules ledger, never edited. They face the same test as every rule: beat random picks
  on past prices, then on paper for at least six months. Until then the weekly trading is pretend money only.
- The stock rules (`config/rules.json`), the rule's paper portfolio and the brain's daily stock calls are experiments
  with pretend money. They exist to learn whether picking stocks can beat owning the whole market.
- A stock would join the honest action only when a tested rule passes its history test AND the trust ladder below
  reaches Small money. Then at most **10%** of investable savings, in equal slots of **2%**. Today none qualifies.
- Core first, always: most long-term savings belong in a broad, low-fee index fund. Check that it tracks its index and
  that fees are low (S-017). Buying at all-time highs is normal for an index; highs cluster (S-007).

## The trust ladder
For the experiments only: a stock rule earns real money only as far as its record allows. The site computes the stage (methodology, "Trust statistics").
1. **Observe**: the rule has no forward record yet. Read, learn, act on nothing.
2. **Paper**: the rule holds a paper portfolio, written down once a month and never edited. No money moves.
3. **Small money**: after at least 6 months of paper record, ahead of the core; the rule beat holding every name over
   the history; and names passing the setup gate beat the benchmark with a 90% range above zero. Act within the limits.
4. **Trusted**: a full year of paper record, still ahead of the core.

If the numbers fall back below a threshold, we step back down.

## Before acting (only once a stock rule has earned real money)
1. Act only on the rule's monthly date, and only on what the rule holds. No discretionary adds from a video, a tip or
   a headline. Dated claims are unverified.
2. A new name needs 3 of the 4 setup checks and must **not be stretched** above its trend (S-010, S-019).
3. No earnings report or major macro event early in the month (S-005, S-013). Check by hand until the event calendar exists.
4. **Technical checklist and risk plan** (from the video we liked; `config/checklist.json`). Before any new paper entry of
   a satellite name, read its eight-step checklist on the Stock page and write the risk plan down before entering: the
   stop, the first target (TP1) and the second (TP2). Reward-to-risk to TP1 must be at least 2; if it is thinner, wait.
   The checklist is unproven for us: it adds a check, never makes a name a buy and never overrides rules 1 to 3.
5. A name leaves when the rule drops it at the monthly review, or when the written stop of our own entry is hit: an exit,
   the one step that may come between monthly dates (the rule's recorded paper portfolio is unchanged). No averaging down
   by default.
6. Stay within the size limits. One idea never decides the household's outcome.

## Never
- Never buy only because a stock is at a high, or only because it has fallen a lot.
- Never chase a stock that is stretched far above its trend.
- Never put personal holdings, account details or amounts in this repo. It is public. The Portfolio tab's builder
  keeps your selection in your own browser only.

## Review
- Monthly, on the rebalance date: read the paper record, the rule's choices and why the other names are out.
- Change these rules only with a change note, like every other doc.
