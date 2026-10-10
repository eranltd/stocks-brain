---
version: 0.16.0
updated_at: 2026-10-10
change_note: Two more markets for the header switch (Israeli companies through their US listings, and iShares index funds), with their own fetch run so each hour's requests stay within Tiingo's free plan.
---
# Decision log

Every decision that shapes the system, with the reason. Newest first. Nothing lives only in a chat session.

## Open items (waiting on the owner)
- **Author of sources S-001 to S-005**: confirm they are the same channel (Micha) as the later batches.
- **Paid connectors** (news, X, options data for implied moves): parked until the owner wants to spend.
- **SEC XBRL financials**: a free, official feed that could fill the outlook cards' numbers by code. Not connected
  until the household decides (see 2026-10-08).
- **Satellite size**: `docs/household.md` proposes 10% of savings (2% per slot). The owner sets it.
- **Market file size**: `derived.json` is written one line per symbol (compact) and is about 330 KB with 21 names.
  Past roughly 35 names it would hit lint's 512 KB cap and the daily run would fail closed; before that, move the
  per-point dates into one shared array.
- **Second price source**: Tiingo's daily returns show unusually low correlations between these names (for example
  AAPL to QQQ about 0.24 over a year). The diagnostic showed our pipeline reproduces the provider's data exactly, so
  the numbers are faithful to the source; a cross-check against a second source is still pending.

## 2026-10-10
- **Two more markets the header switch can show: TLV and iShares.** The household asked for more than the one Nasdaq
  list. `config/markets.json` now lists three markets; Nasdaq stays the default.
  - **TLV: Israeli companies through their US listings**, measured against EIS (the iShares MSCI Israel fund): Teva,
    NICE, Check Point, Elbit Systems, Tower Semiconductor, ICL, Wix, monday.com, Global-e, Nova, Camtek and Ormat
    (`config/watchlists/tlv.json`). Sectors are the GICS sectors in iShares' own holdings files of 2026-10-08 (EIS;
    the S&P mid-cap fund for Ormat, which EIS does not hold). Global-e is filed there under Consumer Discretionary,
    not Industrials or IT, so that is what the list says.
  - **Why US listings only.** Our price provider, Tiingo, has no Tel Aviv exchange data. So the market shows the
    Israeli companies that also trade in the US, in dollars, and says so on the site. What is missing: every Tel
    Aviv-only name, including the big banks (Leumi, Hapoalim, Discount, Mizrahi), the insurers and the property
    companies. In iShares' EIS holdings file of 2026-10-08 the names on our list are about a third of the fund by weight
    and banks and insurers alone another third, so the list and its benchmark can move apart. CyberArk and Sapiens were on the first list but stopped trading
    after their acquisitions, so they are out.
  - **iShares: a menu of index funds**, each measured against SPY (the S&P 500): IVV (the S&P 500 itself), ACWI (the
    world), EFA (developed markets outside the US), IEMG (emerging markets), EIS (Israel), IJR (US small companies),
    SOXX (chip makers), AGG (US bonds) and TLT (long US government bonds) (`config/watchlists/ishares.json`). Funds
    carry a plain category instead of a sector. Plain fund cards (what each holds, the index it follows, its yearly
    cost, from the fund's own page) go in `config/funds.json`, which starts empty; the researched cards arrive
    separately and lint keeps them free of digits in the plain text, prices, ratings and quotations.
  - **What each new market gets**: the same derived numbers as Nasdaq (day moves, returns, distances, setup checks,
    risk, the move against its own benchmark, indexed lines, breadth), the same technical checklist and the same
    candles, under `data/markets/<id>/`, computed by the same code with the market as a parameter.
  - **What stays Nasdaq-only**: the brain and its picks, scoring, the regime monitor, the goal check and portfolio
    rule, the paper portfolio, the rule backtests and ledger, and the people's scores. The Nasdaq files stay exactly
    where they were.
- **A second fetch run, three hours after the first, because of Tiingo's hourly cap.** Tiingo's pricing page gives
  the free plan 50 requests an hour (and 1,000 a day, 500 different symbols a month). The fetch makes one request per
  symbol. Nasdaq needs 28 (21 names, QQQ and six market-context funds); the two new markets need 22 (13 and 10, EIS
  counted once). Both in one run would be 49 of 50, with no room for a single retry. So the daily workflow fetches
  Nasdaq at 23:40 UTC as before and the other markets at 02:40 UTC (`fetch_markets`, `market_lists`). Each run may
  make at most 40 requests, retries included (`prices.max_requests_per_run`), logs how many it used, and lint fails if
  a run's symbols exceed that cap or the two runs are scheduled less than two hours apart. A run by hand should leave
  an hour between the two.
- **Fail closed per market.** A market is written only when every one of its symbols fetched and passed; a failed
  market keeps yesterday's files and the other still publishes. The Nasdaq run never writes `data/markets/` and lints
  those files as warnings only, so a TLV or iShares problem can never stop or reset the Nasdaq data. The site build
  leaves out a market whose files fail lint instead of failing the whole site.
- **A candles view of the checklist.** The household asked to see the checklist "on a graph with a candles view".
  Each Stock page's checklist card now has a Checks · Candles switch. It shows daily (three or six months) and weekly
  candles with the steps drawn on them: the twenty-day average, support and resistance, open gaps, the risk plan's
  stop and targets, RSI and volume against its average.
- **Candles are published as percent from the last close, not prices.** The price licence lets the site publish
  derived numbers only. Each open, high, low and close is its distance from the latest close (which is zero), and
  volume is only a ratio to its twenty-day average. A reader who knows one real price could rescale the chart; that
  was already true of the indexed lines published since the start, so this stays within the derived-only choice.
  Lint refuses a file whose last close is not zero, values outside a sane percent range, or a volume ratio that looks
  like raw volume, and the overlays must equal that day's checklist.

## 2026-10-09
- **The video's eight-step technical checklist joins the process, as an entry-and-exit checklist at the Paper stage.**
  The household liked a trading video's checklist (candle pattern, trend, volume, the twenty-day average, gaps, support
  and resistance, RSI, and risk management with a stop and two profit targets set before entering) and asked to add it
  to how we invest. It is added as `config/checklist.json` and the daily routine `technical_checklist`
  (`data/market/checklist.json`), computed by code after each close for every name and the benchmark.
  **House rule** (`docs/household.md`, "Before acting"): before any new paper entry of a satellite name, the checklist is
  read, a written risk plan (stop, TP1, TP2) exists, and reward-to-risk to TP1 is at least 2. This is the least invasive
  place for it: the site's entry check reads the rule from `config/checklist.json` (`house_rule`), and nothing in
  `config/settings.json` changed, so rule v1's settings, the registry and its frozen verdicts are untouched.
- **One exit added.** Rule 5 of "Before acting" now also exits our own entry when its written stop is hit, so the plan
  written before entering is followed; it is the one step that may come between monthly dates and it never adds a name.
  The rule's recorded paper portfolio and ledger do not use it.
- **What it does not change.** The pre-registered registry (`config/rules.json`), the frozen history verdicts, rule v1,
  the forward paper portfolio and the rule ledger are unchanged; their records stay comparable. The checklist adds a
  step before a household entry; it never makes a name a buy, never overrides the setup gate or the trust ladder, and
  never moves money.
- **Unproven for us, so measured like everything else.** The household's own pre-registered history test rejected its
  setup and strength rules, and nothing says a video's checklist does better. The routine publishes its history since
  2017 (every twenty trading days, excess return over the benchmark twenty days later, by verdict, by score, by step and
  by house-rule fit), which is in-sample and on today's list of survivors and says so, and a forward record from today
  (a snapshot every twenty trading days, never edited). The status stays `unproven` until the forward record, not the
  history, shows an edge; changing it is a new entry here. The index core stays first.
- **Faithful, within our data and licence.** Five-minute candles are not possible (end-of-day data only), so the candle
  step reads the daily and weekly candles. Levels, gaps, stops and targets are published as percent distances from the
  close, never prices, and volume as ratios (provider licence). Parameters are the video's and conventional values
  (RSI fourteen days with seventy and thirty, the twenty-day average, a sixty-day gap window, a year of swing pivots, a
  stop at the nearest support or two ATRs, whichever is closer, but at least one ATR), not fitted to our history. The
  video applied the checklist to Blackstone, Nvidia and Bank of America; only Nvidia is on our list, and no tickers were
  added.

## 2026-10-08
- **What the market did, on Today.** The household asked where to see what the market did today. The Today post's
  market slide gives the last close in plain words and the Full dashboard opens with the whole market day: the S&P
  500's and the Nasdaq-100's day moves, how many of our names rose and fell, the three biggest risers and fallers (tap
  to open), an average day move per sector, the S&P 500's distance from its high and the share of our names above their
  fifty-day average. The context funds now carry a day move too (percent only, from the closes the
  Action already holds). It says plainly that it cannot say why: news is not connected.
- **Company outlook cards are researched from primary sources and kept in config** (`config/outlook.json`), not bought
  as a feed. The household asked where the companies are headed (what's next for Nvidia, finance and product). A paid
  fundamentals or estimates feed would cost money, bring analyst targets and ratings we do not want, and add a provider
  the household has not approved. A card per company, researched after each earnings season from the company's own
  releases and filings, paraphrased, linked and dated, answers the question for free, can be checked by anyone, and
  says when it is out of date (the Stock page flags it once new results are out). Lint keeps prices, price targets,
  ratings and quotations out. The refresh is a saved workflow (`outlook`): researchers in batches, a skeptic per batch,
  then a pull request a person merges. The file starts empty; the first researched cards arrive through that pull
  request after they are checked. The brain sees only dates and whether guidance exists, as context and event risk,
  never as evidence that a stock will beat the index.
- **News ("why it moved") stays parked.** It needs a paid feed; the market section shows what moved, not why.
- **SEC XBRL financials** (the SEC's free, official machine-readable company figures) could later fill the finance part
  of each card by code instead of by hand. Connecting it is a household decision: it is listed here, not connected.

## 2026-10-07
- **People we learn from** (`config/people.json`, routine `score_people`). The household asked for a clear section on the
  people we follow to learn more. Each person has what we learn from them, where they publish and a caution; the file
  also carries what the research says about following people in public (in a study of over 29,000 StockTwits
  finfluencers most gave advice that did not beat the market after risk; studies of copying disclosed mutual-fund holdings
  found copycats roughly matched the funds after costs, and a 13F is late and partial) and a ledger of their dated public calls. Learn from them, but
  measure them: code scores every call against the S&P 500 core from the first trading day after it became public,
  the same honesty the Playbook applies to our own rules. A record needs ten calls that are half a year old before it
  can say anything, and the brain may use it only as context, never as the only evidence for a pick.
- **The first calls are 13F filings, added by hand.** A 13F is the fund's book (so each call names the fund), US longs
  only, up to about forty-five days late. SEC EDGAR is free and official, but it is listed as a planned source, not
  connected: the household decides before any provider is connected. The X accounts of the people we follow are
  listed in `config/sources.json`; the X connector stays parked because it costs money. Only facts confirmed from
  primary or official sources, or a named reputable report (see the research notes), are in the file; links and
  handles that could not be confirmed were left out.
- **Scored on fixed trading days, not the weekly chart grid.** The weekly lines are anchored on the latest close, so
  every new day moved each call's start and its finished 13, 26 and 52 week results. Calls are now scored on the
  daily closes the Action already holds: the start is the first trading day after the public date and each horizon is
  a fixed number of trading days (65, 130, 260), so only "so far" moves. Only percentages and dates are published.
- **A 13F is the firm's book.** Berkshire's three moves are marked as the firm's own (`credit_person: false`): they
  count for Berkshire Hathaway, not for Warren Buffett, who is Chairman Emeritus and whose successor made the later
  decisions. The pack carries a record per fund (`people.fund`) and tells the brain to name the fund, not the person.
  The dates shown are 13F filing dates; a fund may have mentioned a stake earlier, which we do not claim until a
  primary source confirms it.
- **A People tab, in the phone's bottom bar.** The site gets a "People we learn from" tab: how we use them, what the
  research says (with links), who we follow and why (with each person's caution, where they publish, their X handle
  and 13F filings when confirmed), their calls with how each did against the core so far and at 13, 26 and 52 weeks,
  what is connected and how to add someone. A person's record reads "too few to judge" until ten of their calls are
  half a year old. Today shows one line when a logged call touches a name the paper record holds or the brain picked.
- **The brain fires at 05:23 and 11:23 UTC** (routine `close_run`, was 04:47). The daily data run has been starting
  about three hours late (around 02:40 to 03:20 UTC instead of 23:40), so the morning firing could find no new close.
  The second firing catches a late data run; when the day is already recorded it stops before calling the model.
- **The routine wakes one dedicated session, not a fresh one each time.** The first live test (07 Oct) ran the brain
  to the end, but a fresh session per firing had no GitHub access, so it could not dispatch `brain.yml` and nothing
  was recorded. The routine now wakes a dedicated Claude Code session that has this repository and its GitHub access
  attached; it starts again from step 1 of `prompts/daily_brain_routine.md` every morning. The brain's summary is now
  asked to stay well under the six-hundred-character limit (the test run went nine characters over and had to trim).

## 2026-10-06
- **The brain runs every market morning by itself** (routine `close_run`, now active). The household asked for it to
  run daily without anyone starting it. It is a scheduled Claude Code routine: a cloud session on the household's Claude
  subscription, started by a cron trigger Tuesday to Saturday at 04:47 UTC, after `daily.yml` has published the Monday to
  Friday closes at 23:40 UTC. The session follows `prompts/daily_brain_routine.md`: a clean checkout of `main`, restore
  the published data, build the pack, then `scripts/brain_status.py`. If that market day's run already exists it stops
  without calling the model (this is also how holidays are skipped). Otherwise it runs the saved workflow
  `.claude/workflows/brain.js` (the same four steps as the hand runs: three analyst lenses, a skeptic per candidate, a
  constructor, a reviewer), checks the picks with `record_run.check_picks`, and dispatches the `brain` Action with them.
  This closes the open item on how the model step is paid for.
- **Why a routine, not an API key or a third-party Action.** No new dependency, no model secret in the repo's Actions,
  and no per-call bill: the subscription is already paid. The registry keeps its cost cap (lint requires one for every
  model routine) as a ceiling, not a bill.
- **How it fails closed.** The session may not commit, push, edit files, fetch prices or write a model name; its only
  write path is dispatching `brain.yml`, which rebuilds the same pack from the `data` branch, refuses the run if the data
  moved on (the session then starts over once), validates, lints and writes nothing if any check fails. If the session
  itself fails, nothing is recorded and the site keeps showing the last good run; the Routines tab shows when the brain
  last ran. Lint now knows two runners: a GitHub Actions routine's cron must be in a workflow file; an active Claude
  routine needs its prompt file and the saved workflow instead.
- **How to stop it.** Pause or delete the routine in Claude Code (claude.ai/code, Routines). To stop it from the repo,
  set `close_run` to `paused` in `config/routines.json` through a pull request: the session reads it first and stops.
  Disabling the `brain` workflow in GitHub Actions also stops anything from being recorded.

## 2026-10-05
- **First real-data run of registry 1.0.0, verdicts frozen (2026-10-05, prices to 2026-10-02, 9.0 years, 2000 random baskets).**
  Every stock rule was **rejected**: Five Leaders (main) beat 15% of the random baskets, the basic version 29%, the quarterly
  version 10%, rule v1 8% (adjusted p of 1.0 for all; second half of history at the 3rd to 13th percentile). Yearly growth was
  15.8%, 17.3%, 15.1% and 15.2% against 14.9% for the core, 21.6% for holding all 21 names equally and a median of 19.5% to 20.4% for
  the random baskets: the list itself did well, picking from it by past strength did not add to it. Turnover on the engine's basis:
  237%, 179%, 150% and 209% (v1). Savings: buying weekly or every two weeks showed no clear difference from monthly at 52 weeks
  (+66 and +41 bps, ahead in about 70% of starts, short of the 80% bar); quarterly was about 270 bps a year behind and not clearly
  different; spreading a windfall over 52 weeks was clearly worse than a lump sum (-575 bps), over 26 weeks not clearly different
  (-372 bps). Only the 52-week row has 8 independent windows, so the 104 and 156 week rows show the sign only.
  What it means: the stock-pot default stays the index fund. Nothing here moves money; the owner's questions stand. The Today page
  now says that rule v1's own history test reads rejected. A rule that did not beat luck on this list may still be worth following
  on the forward record (every rule is tracked from today), but nothing in the history supports it.
- **Pre-registered rule registry 1.0.0 (`config/rules.json`).** Written on 2026-10-05, before any rule ran on real prices. It
  holds 23 rules, six plans, 14 experiments, the acceptance numbers and the tries. Fixed numbers: decisions on the first trading
  day of the month, fills at the next close, 10 bps per unit of weight traded (satellite and controls; the savings test charges no
  cost), 2000 random baskets, seed 20261005, 17 tries, a passes-history bar of adjusted p of 0.05 or less (at most 4 of 2000
  baskets at or above the rule), 60th percentile in both halves, a drop within 15 points of the core, turnover at most 200% of the
  stock pot replaced a year (a sale and a purchase count once), savings arms need 8 independent windows, 50 bps and 80% of starts,
  182 paper days. Seen before it was written: rule v1's history, the core and the all-names yardstick. Not seen: any result of the
  Five Leaders rules or the random baskets. The research that produced it (library mining, five lenses, three judges, a synthesis
  and a critic) and a five-reviewer adversarial pass are in this session's history; about 100 review findings were applied.
- **What the registry fixes, and where it departs from the research.** Backtests reset to equal weights each month while the
  household practice lets winners drift; the drift arm is reserved. The 200-day exit is a review-day check, not a daily stop.
  The stretch veto, one-per-sector cap and 200-day line are parameters of Five Leaders, not separate rules. Weekly, two-weekly and
  quarterly buying and 26 and 52 week staging are comparison arms. Fundamentals are dormant (no data provider approved). The paper
  period is 182 days like `docs/household.md` (the research wanted 365: an owner question). Rule v1 is capped at candidate. M1 and
  M2 are not capped: their numbers (8% stretch, 50 and 200 day averages) echo the site's setup checks, whose base rates were
  published earlier, so the settings are not clean of that history (said in the rules); no result of the rules themselves was seen.
- **The history verdict is read once.** `data/market/rules.json` carries a `frozen` block written on the first real-data run. A
  change to the rules' engine settings, the acceptance numbers, the tries, the cost, the settings rule v1 reads or the watchlist
  starts a new freeze, which the program accepts only if `tries_counted` is raised; the earlier freeze stays in the file. So a
  watchlist change now needs `tries_counted` +1 in `config/rules.json` and a line here, or the rules step stops (the day's market
  data still publishes). The wording of the money gates is protected by git history only. The tries ledger is not built.
- **Guards added.** A price gap that would silently restart a name's 253-day clock stops the rules and ledger steps (they name the
  names and dates). The forward ledger and the freeze know rule v1's real settings. Only one windfall and one stream savings
  baseline are allowed (lint).
- **Funding the stock pot, stated once.** The pot is its own holding, funded once from new money or a windfall, else by a one-time
  sale of core index units (the only exception to never selling the core, may be taxable, the owner writes it down). After that
  only the pot's own parked index money and the proceeds of the name a rule replaces are traded. Nothing is bought from salary.
- **Money gate, stated once.** passes_history is a first screen and opens no money. Money needs 182+ paper days, a forward
  percentile of 50 or more (a sanity check: about half of luck-only rules pass it), 100% on-time orders, growth after costs ahead
  of the core and all 21 names, the planned vetoes once built, and the owner's size within 10%. `docs/household.md` rules 2, 3, 4
  and the trust ladder describe rule v1 and stay in force until a rule is adopted; they must be rewritten with a change note first.
- **Turnover has one basis.** The engine reports the percent of the stock pot replaced per year. Rule v1's site record of 419.6%
  counts buys and sells, which is about 210% on the engine's basis, just over the 200% limit; the engine prints its own figure.
- **Brain runs go through an Action.** The brain runs in a Claude Code session on the pack built from the published
  data. Its output is passed to the `brain` workflow (manual dispatch), which rebuilds the same pack from the `data`
  branch, validates the picks against it (`scripts/record_run.py`), lints and publishes the run record to the `data`
  branch. Only Actions write that branch; nothing is written if a check fails. The scheduled `close_run` routine stays
  planned until the owner chooses how the model call is paid for (open item above).
- **Data on its own branch.** Branch protection on `main` (pull requests only) rejected the daily Action's data
  commits, so the tabs fed by daily data stayed empty. Code still goes through pull requests on `main`; everything the
  routines write (`data/`, `runs/`) is published to a `data` branch with full history (never force-pushed), and the
  Pages build overlays it on `main`. No bypass of the protection is needed. To return to direct data commits later, add
  the Action to the protection bypass list and point `scripts/data_branch.sh` publish back at `main`.
- **No prices in runs or outcomes.** Run records now store the reference date only; scoring reads both closes from the
  in-run adjusted series and publishes returns (provider licence). Synthetic samples keep their made-up prices. Lint
  fails a live run or outcome that carries a price. This closes the open item about reference prices.
- **The brain's pipeline (M3, run by hand for now).** `scripts/build_pack.py` builds a capped pack of live derived
  numbers and curated text; `scripts/record_run.py` validates the brain's picks (schema, guardrails, evidence keys) and
  writes the run. The brain itself is run in a Claude Code session on the owner's subscription until it is scheduled.

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
- **Portfolio rule v1 and a forward paper portfolio.** The rule picks up to 5 names monthly from the (now 21-name,
  10-sector) watchlist with a sector cap and a
  correlation cap; empty slots stay in the core. It is tested over ~9 years against holding every name, the core and
  the benchmark. Because that test has hindsight (today's watchlist), the trust ladder now rests on a forward paper
  record whose monthly holdings are written once and never edited.
- **Portfolio builder** on its own tab: the household can try any 4-5 names; the selection stays in the browser
  (localStorage), never in the public repo.
- **Watchlist widened beyond big tech.** All eight names were mega-cap growth, so the brain could only ever return one
  kind of bet, and the household's core index already holds it. Added thirteen Nasdaq-listed names from other sectors:
  health care (AMGN, ISRG, GILD), staples (PEP, MNST), utilities (AEP, XEL), industrials (CTAS, PCAR), financials (CME),
  telecom (TMUS), energy (FANG) and materials (LIN). Same Tiingo fetch, same derived-only publication. Asked for in the
  first dry-run session, to pick a diverse four-stock basket from data.
- **Brain dry run 1 (by hand in Claude Code, not scored).** The model read the inputs a pack would hold, as of 2 Oct
  (derived prices, regime, strategy, guardrails, library), and returned four calls that pass the pick schema and
  guardrails: NVDA bullish (medium), MSFT bullish (low), AVGO bearish (low), COST bearish (low). No call on META
  (stretched far above its 50-day average), GOOGL or AMZN (below it, with reports inside the horizon). Conviction stayed
  modest because the Microsoft, Alphabet and Amazon reports and the Fed decision fall in the horizon's last week.
  Not written to `runs/`: a run record needs reference prices and a cost that come from code, which is M3.
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
