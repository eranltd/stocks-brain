---
version: 0.2.0
updated_at: 2026-11-14
change_note: Built in: the bull and bear debate before every BUY (lib/debate.js).
---
# Lessons from open-source AI traders

The owner asked to learn from the AI trading projects on GitHub. Five well-known ones were read through their
papers, READMEs and write-ups (November 2026). This page says what they do, what the evidence shows, and what this
site takes from them. Ideas below are ideas to test, not rules: a rule joins the rule book only through its tests
(`config/rules.json`, `docs/methodology.md`).

## The projects

- **AI Hedge Fund** (virattt/ai-hedge-fund, about 50,000 stars). A team of AI agents, several of them modelled on
  famous investors (Buffett, Munger and others), plus fundamentals, sentiment, technicals and valuation agents. A
  risk manager sets position limits and a portfolio manager makes the final call. The README says it is for
  education only and places no real trades.
- **TradingAgents** (TauricResearch/TradingAgents, a 2024 paper from UCLA and MIT). Analysts write reports, a bull
  researcher and a bear researcher debate them, a trader decides and a risk team checks the decision. The paper
  reports better returns and drawdowns than simple baselines on a few large US stocks over a short window, but in
  simulation only; readers questioned the numbers, and the authors leave live trading to future work.
- **FinRL** (AI4Finance). Reinforcement-learning trading with a backtesting module where transaction costs are a
  setting, so a strategy pays for every trade in the test.
- **Qlib** (Microsoft). A research platform for factor and machine-learning models, built around clean data, a
  strict split between training and test periods, and comparing every model with the same benchmark.
- **Freqtrade** (crypto). A trading bot with a "lookahead analysis" tool that reruns a backtest with the future
  hidden and flags signals that change: the signal was using data it could not have had.

## What the evidence says

- **Most AI trading agents do not beat simply holding the market.** StockBench (arXiv 2510.02209, 2025) tested
  many leading AI models making daily buy, sell or hold decisions on real stocks for several months. Most did not
  beat an equal-weight buy-and-hold basket; some did better only on risk. They struggled most in the falling market
  of early 2025, and did worse as the number of stocks grew from 5 to 30.
- **Knowing finance is not the same as trading well.** Models that score well on finance questions did not trade
  better.
- **Wins depend on the period and the yardstick.** Other benchmarks show agents ahead mainly in rising or very
  liquid markets, or against a weak baseline.
- **Backtests flatter.** The common traps: using data that was not yet known on the day (look-ahead), testing many
  versions and keeping the best (selection bias), and leaving out trading costs. A backtest that looks too good
  (for example a Sharpe ratio above 3) usually has one of these errors.

## What this site takes from them

1. **The weekly whole-market buy stays the real-money plan.** The strongest finding across the evidence is that
   holding the market is hard to beat. Everything else here stays paper money until it beats that plan in fair tests.
2. **Debate before a call, already here.** The Desk's six agents and the Brain mirror the bull/bear debate and the
   risk check of TradingAgents and AI Hedge Fund. Keep the risk agent able to say no on its own.
3. **Short notes between agents, not long chats.** TradingAgents passes structured reports between agents because
   details get lost in long conversations. Our agents already hand over short structured readings; keep it so.
4. **Every test pays for its trades.** Keep costs in every rule test (as `config/rules.json` does) and try them at
   one and a half to two times the expected cost before trusting a result.
5. **No peeking at the future.** Every number a rule uses must be known at the close it decides on. Worth a
   look-ahead check like Freqtrade's: rerun a test with the last day hidden and confirm no past signal changes.
6. **Count the tries.** Testing many versions and keeping the best inflates results; the rule book already counts
   tries (`tries_counted`) and asks for more independent windows when there were many.
7. **Judge by risk as well as return.** Several agents won only on smaller drops. Show drawdown beside return
   everywhere a rule or agent is scored.
8. **Watch the falling markets.** Agents did worst in the early-2025 fall. Score every rule separately in up and
   down markets (the regime monitor already labels them).
9. **Fewer names is easier.** Agents did worse as the list grew. A short list the system knows well beats a long one.

## Built in

- **The bull and the bear** (from TradingAgents' bull and bear researchers and AI Hedge Fund's risk manager). Before any
  paper BUY on the Desk, two agents list the facts for and against the name: its trend, how it did against the market,
  how far it is from its high, a big drop, what analysts say, short selling against its usual level, insiders buying or
  selling, results due within a week, and its field's competition. A BUY whose bear case is clearly stronger waits.
  Every stock page shows both sides in words (`lib/debate.js`).

## Ideas to test (not rules yet)

- A **look-ahead check** in the rule tests: hide the last day, rerun, and flag any earlier signal that changes.
- A **cost stress** column: every rule's verdict at one and a half and two times the trading cost.
- An **up-market and down-market split** of every rule's result on the Rules under test page.

Sources: [AI Hedge Fund overview](https://blogs.reskilll.com/ai-hedge-fund-the-50k-star-open-source-multi-agent-investment-system/),
[TradingAgents paper](https://arxiv.org/pdf/2412.20138), [StockBench](https://arxiv.org/html/2510.02209v1),
[FinRL backtesting](https://hackernoon.com/lite/how-finrls-backtesting-module-enhances-trading-strategy-validation),
[look-ahead bias](https://hackernoon.com/how-trading-ai-can-accidentally-see-the-future-and-how-to-prevent-it),
[backtesting traps](https://www.luxalgo.com/blog/backtesting-traps-common-errors-to-avoid/).
