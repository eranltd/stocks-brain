---
version: 0.29.0
updated_at: 2026-10-29
change_note: A demo trader agent plays along with the Arena; its paper trades pop up on every page and its plan shows what it wants to buy and sell.
---
# Decision log

Every decision that shapes the system, with the reason. Newest first. Nothing lives only in a chat session.

## Open items (waiting on the owner)
- **Author of sources S-001 to S-005**: confirm they are the same channel (Micha) as the later batches.
- **Paid connectors** (news APIs, X, options data for implied moves): parked until the owner wants to spend. The
  free why-it-moved notes (2026-10-17) do not need one.
- **Two secrets to add** (Settings → Secrets and variables → Actions): `SEC_USER_AGENT` (a name and a contact email,
  which the SEC requires; until it exists the company-numbers step fails softly and the brain reads no fundamentals)
  and `POLYGON_API_KEY` (a free polygon.io key; until it exists the weekly price cross-check is skipped).
- **Satellite size**: `docs/household.md` proposes 10% of savings (2% per slot). The owner sets it.
- **Market file size**: `derived.json` is written one line per symbol (compact) and is about 330 KB with 21 names.
  Past roughly 35 names it would hit lint's 512 KB cap and the daily run would fail closed; before that, move the
  per-point dates into one shared array.

## 2026-10-29 (evening)
- **A demo trader agent, with trade pop-ups and its plan on screen.** The owner wants to show the site as a proof of
  concept for a live trading agent: "mock progress of buying and selling on toasts on top", "how our agent works, what
  it wants to buy and sell on a given day", "it should feel live". `lib/agent.js` replays one plain rule on the real
  past year: every 5 trading days it holds the 4 names that rose most over the last 20 days (only names that rose),
  sells what drops out, splits $100,000 of paper money evenly. It is a demo, not one of the tested rules, and every
  place says paper, demo and past data. While the Arena plays, the trades of each replayed day pop up under the header
  (`components/agentfeed.jsx`); on other pages a background loop walks the same year of trades, one every few seconds.
  The Arena shows the agent's plan (ranking with the buy zone, what it holds, wants to buy and to sell, a countdown to
  its next move) and its paper money against the even split. The reader can switch the pop-ups off; reduced motion
  turns them off. Home's Arena view is framed as "The trader agent" with an "Everything inside" tile for every part
  of the app. The Arena now runs 650 ms a day ("still a little fast").
- **A corner dock with play or pause, speed and the risk level.** Fixed top right while the Arena shows: play/pause,
  0.5× to 4× (the 8× speed gave way to 0.5×), and Easy | Medium | Hard. The level sets the demo rule: Easy holds 6
  names, keeps 40% in cash and moves every 10 days (looking back 40); Medium is the plain rule; Hard holds 2 names,
  all in, moving every 3 days (looking back 10). The device remembers the level; the pop-ups and the plan follow it.

## 2026-10-29 (later)
- **Home opens on the Arena, playing by itself on a loop; every replay is slower and softer.** The owner: "the arena
  should be the default view", "the animation should be auto looped", and "too fast and not smooth for humans". Home's
  switch is now ARENA | DESK | DETAILS with ARENA first; it shows a short headline so the race starts on the first
  screen. The Arena starts on its own, holds on the result for 5 seconds at the end, then starts again; pause or the
  slider stop the loop until Play. Pace at 1×: the Arena 400 ms a day (was 140; since 650), the
  ticker wall 1 s a day (was 0.4), the floor 1.8 s a day (was 0.7) with a 3.5 s hold. Colours fade over about 1 s,
  numbers roll over 0.65 s, flashes are softer. Reduced motion still shows still frames.
- **The paper basket starts at $100,000** (was $10,000), at the owner's ask. Still pretend money from past data, labelled
  so on screen.

## 2026-10-29
- **Every page restyled as a trading terminal, with motion.** The owner sent screen recordings of animated trading
  dashboards ("I wanted to build this animated UI") and asked for the site to look like the best trading app, with
  less text. Every page now uses the phase-1 kit (dense "◆ PANEL" heads, mono numbers that count up, long text behind
  (i)). Motion always replays real past data, never invents it, and stops under reduced motion:
  - **The Arena** (`#arena`, `tabs/Arena.jsx`, `components/arena/*`): a year of real moves replayed like a game (bar
    race, duel, ticker wall of every list, a $10,000 paper basket labelled "paper · past data", a heat grid and a
    turning ball of dots). A small live-replay strip with the same pieces sits at the top of Home.
  - **The motion kit** (`components/motion.jsx`): TickNumber (odometer digits), HeatGrid, OrbitSphere (canvas 2D, no
    library), FlowLines. One clock per page, writes straight to the DOM, pauses off screen and when the tab is hidden.
  - **Stocks list**: four views, ARENA | CHART | LIST | HEAT. ARENA, "the floor", is the default because the owner
    asked for "little squares with never-ending animations" rather than lines: one square per name looping the last 30
    trading days. CHART is the big board (every name as % change over 1M to 1Y, Mixpanel-style). The hero chip says
    "Real data", not "Live": the data is daily closes.
  - **Pair stocks** (`lib/pairs.js`): the owner asked for pairs "like Pepsi and Coca-Cola, when one is up the other is
    down". Measured on our data (daily moves, last 120 shared days, all 7 lists): rivals in one industry mostly move
    together, and Coca-Cola is not on our lists; real opposites are staples vs chips (PEP vs MU or SOXX about −0.54,
    XLP vs XLK −0.6). So the section shows both kinds from the data: SEESAW (lowest correlation) and TWINS (highest,
    skipping near-copies such as two funds on one index), each with "opposite on N of 10 days". A pair can stop
    working any time; the page says so.
  - **Stock page, Brain, Experiments and Learn**: terminal layouts (key-number strip, candles that tick in, the
    Desk's call, a paper-bet ledger with honest "too few to tell" notes, How it works as an animated flow diagram).
  No new dependencies; percents only on screen (the one dollar figure is the labelled paper example).

## 2026-10-22
- **Home is a trading desk: six agents, one final call.** The owner asked for the site to look like a trading
  platform, with far less text, after a post showing six agents in a pipeline (Research, News, Strategy, Execution,
  Risk, Boss). Home's default view is now the Desk (`site/src/lib/desk.js`, `components/desk.jsx`); Details stays as
  the full dashboard and the words-only Simple view is gone. Each agent is a panel over data we already publish:
  Research is a scanner of the main list (day and 20-day moves, volume against its 20-day average, volatility,
  momentum against the benchmark, the checklist score; percents only, never prices); News is the why-it-moved notes,
  recent SEC filings and results due within a week; Strategy is each checklist risk plan (entry near support, stop,
  two targets, reward-to-risk) plus the brain's latest stance; Execution reads three unproven rules of thumb from the
  checklist (LEVEL, VOLUME, CLOSE) into ENTER, WAIT or SKIP; Risk applies the house limits; the Boss combines them.
- **The Boss's call is made by code, never by a model, and is paper only.** First match wins: a hard Risk failure
  (no written plan, or a stop wider than the limit), a bearish brain stance, or a downtrend is REJECT; a reward-to-risk
  under 2 or a stock stretched above its 50-day average is WAIT, because the house rules say to wait those out ("if it
  is thinner, wait"; "never chase a stretched stock"); a neutral brain, missing confirmations or fewer than five fresh
  reports is WAIT; only an up-leaning brain with Risk passing, all three confirmations and five fresh reports is
  BUY (paper). On its first day the Desk read 0 BUY, 18 WAIT and 3 REJECT (the three in a downtrend). Every screen
  carries PAPER TRADING · SIMULATED; real money stays the weekly whole-market buy until a rule earns its place.
- **Not copied from the post:** its headline result (a few hundred dollars multiplied overnight) was made with ten
  times leverage. The Risk panel states the house limit plainly: leverage 1×, never borrowed.

## 2026-10-21
- **Hebrew removed.** The owner judged the Hebrew version not good enough and asked to remove it entirely; the site is
  English only again. Kept: the not-advice notice and the any-reader wording. Gone: the HE | EN switch, the language
  detection, the right-to-left layout and every Hebrew text; the English texts stay in `site/src/text/`.

## 2026-10-17
- **Why notes: an allow-list our tools can actually use, and honest unclear notes.** The first test fire of
  `why_notes` (market day 2026-10-16; code flagged the chip fund SOXX, the energy benchmark XLE and the Nasdaq-100 with
  QQQE, IYZ and XLK) recorded nothing. WebSearch refuses the whole call (HTTP 400, not accessible to its user agent)
  when `allowed_domains` holds any of reuters.com, apnews.com, wsj.com, ft.com, marketwatch.com, barrons.com,
  nytimes.com or economist.com, and WebFetch could not open the pages of those tried (Reuters, AP, MarketWatch).
  Without them, search showed the causes on CNBC and Bloomberg, but every page there answered 403; the routine rightly
  cites only pages it opened, so every note
  was dropped. A probe of 104 hosts the next day (one search limited to each host and a fetch of a recent page) sorted
  them. Within the owner's approval of the notes (official sources and reputable outlets only), `config/news_sources.json`
  1.1.0:
  - **Blocked for our tools**: those eight, plus The Guardian, the BBC and Yonhap, which fail the same way, move to a
    separate `blocked` list with the reason, so the owner sees why they are missing. They are never searched or cited
    (`scripts/record_why.py` refuses them like any unlisted host).
  - **Added, because search and pages both work**: Yahoo Finance (only pages bylined by its staff or by Reuters, AP or
    CNN; never its syndicated StockStory, Motley Fool, Simply Wall St or OilPrice pieces), CBS News, ABC News, NBC News,
    PBS NewsHour, Fortune, Marketplace, Nikkei Asia, Focus Taiwan (CNA), TechCrunch, The Register, Semiconductor
    Engineering, TrendForce, Rigzone and OPEC. AP, Reuters and Bloomberg wire stories reach us through these (AP on PBS,
    ABC News and CBS; Reuters on Yahoo Finance, NBC News and Nikkei Asia; Bloomberg energy stories on Rigzone).
    Not added: OilPrice (news mixed with commentary), Forbes and TheStreet (opinion mixed in, and blocked anyway),
    pages with no visible date (Semiconductor Digest), and outlets whose pages refuse to open (CNN, Axios, the
    Washington Post, NPR, the IEA, S&P Global).
  - **Every source now says** `search` and `opens` (checked `reach_checked` 2026-10-17) and may carry a `note`. Official
    and company hosts whose pages refused to open (the FCC, FDA, Justice Department, FERC, Commerce, the Bank of Israel,
    Nasdaq, the Tel Aviv exchange, CME, Business Wire, GlobeNewswire, several company sites, the Fierce titles) and CNBC
    and Bloomberg stay listed with `opens: false`: tried at most once, skipped on any error, never worked around. Lint
    refuses a host that is both a source and blocked, or a source that can be neither searched nor opened.
  - **The routine** (`.claude/workflows/why.js`, `prompts/why_routine.md` steps 5 to 7) searches with `allowed_domains`
    set to exactly the sources marked `search` (`python3 scripts/record_why.py --domains`), ignores results on other
    hosts (the filter leaks: searches limited to company hosts returned sec.gov pages, so the record checks every host
    itself), looks for a story whose page will not open on another listed host that opens (a wire story republished
    there counts; a cache, archive, AMP, proxy or reader copy never does), and for a market-wide move reads official data
    first (EIA and OPEC for oil, the Fed, BLS, BEA and Treasury for rates and data releases, the exchange).
  - **Unclear notes are recorded, not dropped.** When no listed page that explains a move would open, the note reads:
    No clear cause found in the sources we could open. We looked but could not open a source on our list that explains
    this move. It has no source and is shown with its confidence, No clear cause found, so the household sees the move
    was looked into. `record_why.py` already accepted unclear notes with no source.
  - **Rehearsal** on 2026-10-16 with the new list and nothing dispatched: all three moves explained from pages that
    opened (CBS News, Nikkei Asia carrying Reuters, Yahoo Finance staff, Rigzone carrying Bloomberg); SOXX and the
    Nasdaq-100 clear, XLE likely; `record_why.py --check` passed.
- **Why it moved: short notes from a separate Claude session.** On Thursday 2026-10-08, after the US close, SpaceX
  (Nasdaq: SPCX) agreed to buy Grain Management's nationwide 800 MHz airwaves (about 8 billion dollars per the WSJ,
  pending FCC approval). On Friday T-Mobile, on our main list, fell 13.27% by our own numbers; Verizon and AT&T fell about
  nine to ten percent and the tower companies rose. The household sent a video on 2026-10-10 and asked why we had not
  caught it. The site showed the fall (Home, the market day, the feed) but never the cause: no news source was ever
  connected, nobody filed anything with the SEC, the names hit hardest are not on our lists, and the brain is sealed to
  its pack by design. The owner approved option A of the design with its two free extras (B and C below):
  - **What it does.** Routine `why_notes`, a scheduled Claude Code session on the household's Claude subscription that
    is not the brain, wakes at 06:47 and 09:47 UTC Tue-Sat, after every data run. Code (`scripts/why_candidates.py`)
    lists the day's unusual moves from our published percent numbers: a name at three percent or more and three or more
    standard deviations of its last sixty days (the feed's own test), a context fund, benchmark or sector fund at one and
    a half percent, a sector average of the main list at two and a half percent (two names or more). One story gets one
    note: a sector average that only echoes a flagged name folds into that name (the Communication average on 10-09), and
    funds that moved with the S&P 500 fold into it. At most five, biggest first. The saved workflow `why` sends one
    researcher per move to the allow-listed sources and a skeptic re-opens every link; the session checks the notes
    (`scripts/record_why.py --check`) and dispatches `why.yml`, which checks them again, takes each move and its names
    from our own data (never from the model), publishes `data/market/why.json` (thirty days) and redeploys the site.
    Home attaches the note to its mover line, the market day shows it instead of "what moved, not why", and each Stock
    page lists its name's notes. Every note carries: This explains a move; it is not a reason to trade.
  - **What it never does.** Trade, rate, recommend or set targets (the household does not buy on tips or headlines,
    `config/rules.json`); enter the brain's pack (the point-in-time rule of 2026-10-13 still holds: notes are written
    after the close and the brain never reads them); commit, push, edit a tracked file or open a pull request (it only
    dispatches the Action, exactly like the brain); fetch or print a price or volume; copy article text (notes are in our
    own words: no quotation marks, no digits, a headline of at most ninety characters and a why of at most three hundred
    and twenty); get past a login, paywall or bot check; link to a host off the allow-list. When no trusted source
    explains a move, the note says so plainly ("unclear") instead of guessing.
  - **Hardening (adversarial review).** Web text is data: the workflow's agents get a closed tool list (no GitHub or
    other connector tools, no git, no other commands) and the drafts handed between them are marked as data. The
    record also refuses amounts and percents in words or symbols, share-price moves, any quote-like mark, hidden or
    control characters and non-Latin look-alike letters, and a link whose host a browser would read differently (a
    backslash); the publisher shown on the site comes from the allow-list, never from the model. The daily and brain
    runs lint the notes with `--soft-why` (warnings), since they never write them, so a stale note (say, a host later
    taken off the allow-list) can never discard a day's prices or a brain run; `why.yml` lints them strictly.
  - **The allow-list** is `config/news_sources.json`, owner-editable: regulators (SEC, FCC, FDA and the like), the
    exchanges, the companies' own investor pages already used by the outlook cards, the three big newswires, reputable
    outlets (Reuters, AP, CNBC, WSJ, Bloomberg, FT, MarketWatch, Barron's and a few more) and a few trade publications
    (Light Reading, Fierce, STAT and others). A source must be dated no later than the day after the move.
  - **Cost.** No new bill and no new key: it uses the household's Claude allowance. On a quiet day a wake is a few
    commands; on a flagged day it is one researcher and one skeptic per move plus a writer. Run over our own published
    numbers for 40 market days (2026-08-21 to 2026-10-16), code would have flagged nothing on 7 days and one to five
    moves on the others, about 1.4 a day on average, most often a fund moving one and a half percent (the chip-makers
    fund on 20 days, the energy fund on 10, the Israel fund on 8); the sector funds will add some on broad days. If that
    proves noisy, the fund threshold is the knob (`FUND_MIN_PCT` in the script). GitHub Actions minutes are free for this public
    repo. To stop it, pause the scheduled task or set `why_notes` to `paused` in `config/routines.json`.
  - This replaces the 2026-10-08 call that "why it moved" stays parked until a paid feed: the premise was not re-tested
    against free routes. Paid news APIs stay parked; Google News stays rejected.
- **Official filings on Home (option B, free).** Home's "In the news" now also lists our names' SEC 8-K filings of the
  last three days, with the fixed plain titles `data/market/sec_news.json` already carries. It would not have caught the
  SpaceX deal (no party filed), but it covers results, deals and leadership changes.
- **A Sectors list for looking (option C, free).** Eleven US sector funds against the S&P 500, the narrowest fund per
  industry: telecom carriers through IYZ (not XLC, which is mostly Meta and Alphabet), then XLK, XLF, XLV, XLY, XLP, XLI,
  XLB, XLU, XLRE and XLE (also the Energy list's benchmark, listed once). Like the other markets it is for looking only:
  the brain, rules, paper and people still read Nasdaq. The markets run already holds 42 of `max_requests_per_run` 45
  and Tiingo allows 50 requests an hour, so the sectors have a third fetch run, `fetch_sectors` and `sector_list` at
  04:40 UTC Tue-Sat (12 requests, two hours after the markets run; lint checks every pair of runs is at least two hours
  apart and each within the cap). Raw bars never leave a run, so XLE and SPY are fetched again there; we now use 71
  unique symbols a month. The sector funds' moves are also why-it-moved triggers. Plain fund cards for them can come
  later; each has the plain category Sector.
- **"When could we buy it?" on every company, weekly first.** The household asked when it would next be time to buy
  Microsoft, and for the same answer on every company. Since 2026-10-16 the household acts weekly, so the card answers
  from our own written rules in this order:
  1. **Real money**: not as a single stock (household rules 0.5.0: no stock plan with real money until a rule passes
     history and the trust ladder reaches Small money; today none does). The weekly buy of the whole-market fund, with
     its next date, already buys a small piece of the company, said only where true: each stock list now records by
     hand whether a company is in the S&P 500 (`sp500` in the watchlists); a company that is not (the Israeli and
     foreign-listed ones) is told the weekly buy does not hold it, an unchecked one gets "if it is in the S&P 500". A
     fund that follows the plain S&P 500 is the kind of fund the weekly buy goes into; any other fund is not part of the
     plan.
  2. **The weekly game** (pretend money): its next look is the first trading day of next week, holiday-aware; for each
     weekly rule (`five_leaders_weekly`, `weekly_swing`), would it pick the name if today were its decision day, with
     yes/no checks from that rule's own engine (Five Leaders: strongest past-year rise, one per sector, above a rising
     200-day line, not 8% or more above its 50-day; Weekly Swing: strongest past-month rise against the market, one per
     sector, above its 50-day line, not stretched).
  3. **The monthly rule**: Five Leaders and its quarterly variant, the same way, with their next dates (folded away on
     the page).
  4. **What to wait for**, in plain words, plus the house checks (3 of 4 quick checks, the chart checklist's
     reward-to-risk to the first target at least 2). A wait line only one weekly rule needs names that rule ("Weekly
     Swing: wait until it is back above its 50-day line."), so a check one rule does not have is never read as needed
     for both. A name that misses a check carries no group or place reason from the engine; the card still marks its
     place row not met when every place would go to higher-ranked names in other groups (or names a keep buffer keeps),
     and says a group's place is open when the name leading it misses a check.
  5. **The honest line**: our own rules, not a forecast.
  A single stock is spoken of for real money only if the rule that picks it has ITS OWN frozen history verdict
  `passes_history` and stocks have earned a place; another rule passing never counts.
- **One engine, one calendar.** The routine `buy_window` (contract version 2) calls each rule's own engine
  (`rules.pick_names`, the rule's config, the ledger's seed, cost, lag and engine hash, and that rule's latest paper
  names) with today's close as the decision day, so the card can never disagree with what the ledger would record; for
  every rule the names with no reason against them must be exactly the engine's pick, or nothing is written. The engine
  hashes of the four rules are unchanged. The engine has no trading calendar (its periods are plain ISO weeks and
  months), so `scripts/us_market_calendar.py` stays the repo's one calendar and now gives weekly, monthly and quarterly
  next dates; the site's "This week" card, the two-minute read and this card all read the weekly buy day from the
  same published date (`next_weekly_buy`), falling back to the coming Monday when the file is old; the card names the
  weekly game's next look by that same day (it is the same first trading day), so it never shows two different weeks.
- **Why the rules and not the brain.** The brain's calls and weekly bets are an unscored experiment and change with each
  day's pack; the rules are pre-registered, tested against random picks and written down on each review day. "When" is a
  question about our own process, so only the process answers it.
- **What it never says.** No "buy signal", "recommend" or "you should buy"; never that a name is a buy for real money
  while no stock rule has earned it; no forecast or price target. Ranks, yes/no checks and percents only; no prices.

## 2026-10-16
- **The brain's weekly bet.** The household read a row of neutral calls as "the brain always says wait". Neutral is
  the honest call (every stock rule lost to random picks), but it teaches nothing. So each run now also returns
  `bets`: the three names the brain expects to do best over the coming week and the three it expects to do worst.
  The first run of each ISO week counts; later runs that week repeat it (`pack.bets.this_week`). The site scores it
  from that run's close to the next week's bet on the published indexed series (`site/src/lib/bets.js`; the brain sees
  the same scores in `pack.bets`): it wins the week if its best three beat its worst three. The record is shown against
  a coin: under twelve weeks it says "too early"; after that, how often luck would do as well. Best-minus-worst was
  chosen over best-against-the-market because the market's own drift would flatter a long-only bet. A bet is never a
  real-money instruction; it joins the trust ladder only like any rule would, by beating luck for months.
- **"Neutral" reads as the plan, not "wait".** The run headline for all-neutral runs is now "Do your weekly buy of
  the whole market. No single stock stands out." and the neutral mood word is "Can't tell".
- **Got a lump sum?** A five-step guide on the Brain page for money already in hand (emergency reserve first, money
  needed within five years stays out, the rest in one purchase per `windfall_lump_sum`, spreading over half a year
  only as a price of comfort), with the history test's numbers and the questions to settle before a big move
  (account type, the fund's country of registration, currency and fees).
- **Guess the candle, a simpler Home, and three brain checks a morning.** A quiz page (Learn, `quiz`): a real chart
  from our stocks with one notable candle marked; guess its kind, then whether the next week ended higher or lower;
  the score is kept on the device next to what luck would score. Home drops the time-horizon money card (it stays on
  the Brain's verdicts page), the market card and the companies card (both repeated other sections), and the candle
  cards lose their legend. The brain routine now checks at 05:23, 08:23 and 11:23 UTC, so a late data run waits at most
  three hours; the Routines page shows every time in the reader's own time zone too.
- **Two ways to read the site.** The household wants busy readers informed in a couple of minutes and curious readers
  to stay around twenty. Home now opens with "The two-minute read" (the brain's answer, this week's money action, the
  market; then "that is all you need today"), ends with "Got more time? Go down a rabbit hole" (ten real questions the
  site answers, each with a reading time, about forty-five minutes in all, `lib/explore.js`), and every other page ends
  with "Keep exploring": three next questions, never from the page you are on, changing day by day. Curiosity, not
  tricks: no endless feed, streaks or alarms.
- **The brain writes a letter to the family.** The household asked for the brain to advise them "like Warren Buffett".
  Each run now adds a `letter` (200 to 1400 characters, no digits): what to do with real money this week, what the
  pretend-money calls and the weekly game honestly show, one lesson, and what would change our minds. Buffett's
  shareholder letters set the tone only (plain, patient, candid); the letter never claims to be him or quotes him, and
  the site says so under it. It is checked like the rest (banned phrases, no digits) and follows the house rules: real
  money only in the weekly whole-market buy or safe savings.
- **We act weekly.** The household said "we are weekly traders". Two parts:
  - **Real money**: the core standing order moves from monthly to weekly. Our own savings-cadence test
    (`savings_weekly` against the monthly baseline) rated weekly "better": about +0.6 points a year, ahead in about
    four of five one-year windows, provided the broker's fee per order stays under the break-even fee the test prints.
  - **Pretend money**: a weekly trading game. Two weekly satellite rules join the registry (1.1.0):
    `five_leaders_weekly` (Five Leaders reviewed weekly) and `weekly_swing` (last month's strongest five, above their
    50-day average and not stretched, swapped weekly). The engine gained a weekly decision calendar (first trading day
    of each ISO week) for the backtest, the random baskets and the forward ledger. Both count as tries: 17 to 19, so
    every rule's adjusted p rises, and the history test is frozen anew. Real money in weekly stock trades only if a
    weekly rule passes history and then its paper record, exactly like every other rule.
  - The site shows a "This week" card on Home and the Brain's verdicts page: the weekly buy day, then each weekly
    rule's names this week, its score against the market and its history-test result in words.

## 2026-10-14
- **Official company news from the SEC, for every company.** The household asked for every company to be backed by
  public results or news. The SEC's free filings index is the most trustworthy source there is: what the company itself
  had to tell regulators. `scripts/sec_news.py` (routine sec_news, daily) lists each company's recent 8-K, 6-K, 10-Q,
  10-K and 20-F filings with fixed plain titles per 8-K item code (2.02 results, 5.02 leadership change, 1.01 major
  agreement...) and a link; nothing is copied from the filings, and no new key is needed (same SEC_USER_AGENT).
  Google News was rejected: no official API, and it mixes rumour with fact. Shown on every Stock page and as a line
  on the home's cards. Not yet in the brain's pack (its token cap); a later change can add a compact form.
- **SEC company numbers for every stock list.** `scripts/fundamentals.py` now covers every company on every stock list
  (44), and companies that file only yearly (20-F, often IFRS and a home currency) get their latest fiscal year
  (basis "annual"). The brain's pack still reads the main list only.
- **Candles up close on every stock page**, not only on the home's cards.
- **Chip makers, tech giants and energy as their own lists.** The household asked for the top semiconductor, high-tech
  and energy companies on the home page. They are three more markets in `config/markets.json` (chips against SOXX,
  tech against QQQ, energy against XLE), so they get the same derived numbers, checklist and candles as TLV and
  iShares, and the header switch shows them. The home shows each as a bold carousel ranked by the past year's rise
  (`lib/spotlight.js`), said in words with "a past rise does not promise the next one". Like the other markets they
  are for looking: the brain, rules and paper still read Nasdaq only. The markets fetch is now 42 symbols, so
  `prices.max_requests_per_run` went from 40 to 45 (the plan allows 50 an hour; the Nasdaq run is hours apart).
- **The newest candle, green or red.** Every carousel card says plainly whether the last day closed above its open
  (green) or below (red). It describes the day; it is not a signal. Our prices are end of day only, so the site cannot
  see moves inside a trading day, and candle readings did not beat chance in our own tests.

## 2026-10-13
- **No 4-5 stock plan; real money follows the honest action.** The household said the stocks plan is not how it wants
  to invest: it reads the brain and acts. The honest answer the evidence supports is not a stock list. The Brain's
  verdicts page (and Home) now ask "When might you need this money?" (kept on the device only) and give one plain
  action: five years or more, the whole-market fund every month; one to five, part safe and part fund; within a year,
  safe only; with today's cash rate and the fund's past growth and biggest drop from the data. A stock would join only
  when a tested rule passes history and the trust ladder reaches Small money (`lib/money.js` `stocksEarned`); none
  does. "Our plan" in the menu became "Experiments" (pretend portfolio, rules we test, the brain's score).
  `docs/household.md` 0.4.0 and the brain's house facts say the same.
- **The whole site in simple words (ELI5).** Every page leads with plain words: menu descriptions, page intros and
  each technical card's "In simple words" line; jargon is explained on first sight (the whole market, biggest drop,
  how sure). Numbers stay where code computes them.
- **Company numbers from SEC filings** (`scripts/fundamentals.py`, routine `sec_fundamentals`). The household chose
  the SEC's free XBRL company facts over paid data and social feeds. Each daily run turns every main-list company's
  10-Q and 10-K facts into twelve-month revenue growth, the latest quarter's growth, operating and net margin and free
  cash flow (operating cash flow minus capital spending), into `data/market/fundamentals.json`. Quarters come from
  three-month facts, or from one year-to-date figure minus the one before it (cash flows and the fourth quarter);
  twelve-, thirteen- and sixteen-week quarters all count (Costco, PepsiCo). Point in time: only facts filed by the day
  count, and a restated period takes the newest filing up to then. The brain reads a compact `fundamentals` block and
  is told it describes the business, not the stock; each Stock page has a plain card, "By its own numbers". The SEC
  asks every client for a User-Agent with a contact email, so the step needs the `SEC_USER_AGENT` secret; a failure
  keeps the last good file and never stops the day's market data.
- **A second price source to check Tiingo** (`scripts/price_crosscheck.py`, routine `price_crosscheck`, Polygon's
  free plan). On Fridays the daily run fetches the main list from Polygon too and compares daily returns; only
  agreement statistics are published (`data/market/price_check.json`), never a price. A one-off check the same day
  against a third source answered the open question already: AAPL to QQQ correlated about 0.21 there against Tiingo's
  0.24 over the past year (MSFT 0.33 against 0.34, NVDA 0.68 against 0.69), so the low correlations are the market's,
  not a data fault. The weekly check keeps it that way.
- **The pack cap is 14000 tokens** (was 12000): with the track record and the company numbers the pack came to about
  12000. Fail closed above it, as before.
- **Brain's verdicts is its own tab, told like to a five-year-old.** The household called it the most valuable page:
  a plain reader taps it to hear what the machine decided. It sits in the main bar on every screen (phones: "Brain",
  between Today and Our plan) and opens in one tap. The page leads with the newest answer, "Do I need to do anything?",
  a card per stock (thumbs up, thumbs down or just watching, and how sure), what changed, and an honest "Has the brain
  been right?" (too early until the first calls are scored), then every earlier answer. The brain now writes `eli5`
  for the whole run and for each pick (optional in the schema, checked like the rest: no digits, no banned phrases);
  older runs show one honest line by code plus the brain's own first sentence. Keyword-spotting the grown-up reason
  was tried and dropped: it read "not stretched" as "stretched".
- **The brain's verdict in plain words.** The household asked for a core section with the verdict of each brain run.
  Home has a card with the newest run: one line on what to do, what changed since the run before, and for each name
  its stance in words (just watching, leaning up, leaning down), how sure, one reason and what would prove it wrong;
  the brain's own summary is one tap away. A new page, Our plan → Brain's verdicts, lists every run that way.
- **What we borrowed from Tauric Research's TradingAgents** (a multi-agent LLM trading framework; read from its public
  README, not its code).
  - **Memory of its own calls.** TradingAgents appends each decision to a log and, once the holding period ends, scores
    it against the benchmark and has a model write a reflection the next run reads. The pack now carries
    `track_record`: the last runs' call per name, settled scores and the conviction calibration, all by code. We did
    not copy the model-written reflections: lessons stay human-approved (`docs/learnings.json`), and numbers stay code's.
  - **Point in time.** TradingAgents only shows a past run data that was public then. Our picks are referenced to the
    close of `meta.as_of` but the brain runs the next morning, so claims and people's calls dated after that close are
    now kept out of the pack. Overnight news would otherwise leak into calls scored from the earlier close.
  - **Consistency.** Its authors note that runs vary even at a fixed temperature. The brain must now say what changed
    in the data when it changes a name's stance or conviction; the skeptics and the reviewer check it.
  - **Not taken:** the live order step (house rules are paper only), social-media sentiment feeds (noise, licence and
    quality risk, and our history test found no edge in signals like these), and a separate bull-versus-bear debate
    (each skeptic already lists bull and bear points and argues against the analysts).

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
