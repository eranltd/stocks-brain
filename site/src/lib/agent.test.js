import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_LEVELS, AGENT_START, LEVEL_IDS, agentMind, agentRun, holdingsAt, levelOf, scoreAt, tradesOn } from "./agent.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const race = (rows) => ({ n: rows[0][1].length, dates: rows[0][1].map((_, i) => `d${i}`), lines: rows.map(([symbol, values]) => ({ symbol, name: symbol, values })) });

test("the demo agent: holds cash, then buys the names that rose most, split evenly", () => {
  const r = race([
    ["AAA", [0, 2, 4, 6, 8, 10, 12, 14]],
    ["BBB", [0, -1, -2, -3, -4, -5, -6, -7]],
    ["CCC", [0, 1, 1, 1, 1, 1, 1, 1]],
  ]);
  const run = agentRun(r, { start: 1000, hold: 2, every: 5, lookback: 20 });
  near(run.equity[0], 1000);
  near(run.equity[4], 1000);
  const buys = tradesOn(run, 5);
  assert.deepEqual(buys.map((x) => [x.side, x.symbol]), [["buy", "AAA"], ["buy", "CCC"]]);
  near(buys[0].amount, 500);
  assert.equal(run.trades.some((x) => x.symbol === "BBB"), false, "never buys a name that fell");
  // AAA from 10% to 14%: 500 * 1.14/1.10; CCC flat.
  near(run.equity[7], 500 * (1.14 / 1.1) + 500);
  assert.deepEqual(holdingsAt(run, 7).map((h) => h.symbol), ["AAA", "CCC"]);
});

test("the demo agent: sells a name that drops out of the top, with its gain or loss", () => {
  const r = race([
    ["AAA", [0, 5, 10, 15, 20, 25, 20, 15, 10, 5, 0, 0]],
    ["BBB", [0, 1, 2, 3, 4, 5, 8, 12, 16, 20, 24, 24]],
  ]);
  const run = agentRun(r, { start: 1000, hold: 1, every: 5, lookback: 5 });
  assert.deepEqual(tradesOn(run, 5).map((x) => [x.side, x.symbol]), [["buy", "AAA"]]);
  const day10 = tradesOn(run, 10);
  assert.deepEqual(day10.map((x) => [x.side, x.symbol]), [["sell", "AAA"], ["buy", "BBB"]]);
  near(day10[0].pnl, (1.0 / 1.25 - 1) * 100);
  assert.deepEqual(scoreAt(run, 10), { wins: 0, closed: 1 });
  assert.deepEqual(scoreAt(run, 9), { wins: 0, closed: 0 });
});

test("the demo agent: never trades on the last day, and handles no data", () => {
  const r = race([["AAA", [0, 1, 2, 3, 4, 5]], ["BBB", [0, 0, 0, 0, 0, 0]]]);
  const run = agentRun(r, { every: 5 });
  assert.equal(run.trades.length, 0);
  near(run.equity.at(-1), AGENT_START);
  assert.equal(agentRun(null), null);
  assert.equal(agentRun({ n: 1, lines: [{ symbol: "AAA", values: [0] }] }), null);
});

test("the agent's mind: ranks the names, shows what it wants to buy and sell, and when it acts next", () => {
  const r = race([
    ["AAA", [0, 5, 10, 15, 20, 25, 20, 15, 10, 5, 0, 0]],
    ["BBB", [0, 1, 2, 3, 4, 5, 8, 12, 16, 20, 24, 24]],
  ]);
  const opts = { hold: 1, every: 5, lookback: 5 };
  const run = agentRun(r, { start: 1000, ...opts });
  const d5 = agentMind(r, run, 5, opts);
  assert.equal(d5.nextIn, 0);
  assert.deepEqual(d5.today.map((x) => [x.side, x.symbol, x.rank]), [["buy", "AAA", 1]]);
  const d8 = agentMind(r, run, 8, opts);
  assert.deepEqual(d8.ranked.map((x) => [x.symbol, x.rank, x.held, x.zone]), [["BBB", 1, false, true], ["AAA", 2, true, false]]);
  assert.deepEqual(d8.wantBuy.map((x) => x.symbol), ["BBB"]);
  assert.deepEqual(d8.wantSell.map((x) => x.symbol), ["AAA"]);
  assert.equal(d8.nextIn, 2);
  assert.equal(agentMind(r, run, 11, opts).nextIn, null, "no check left in the window");
  assert.deepEqual(tradesOn(run, 10).map((x) => x.rank), [2, 1]);
});

test("the risk levels: easy spreads wider and keeps cash, hard bets on fewer names more often", () => {
  assert.deepEqual(LEVEL_IDS, ["easy", "medium", "hard"]);
  assert.ok(AGENT_LEVELS.easy.hold > AGENT_LEVELS.medium.hold && AGENT_LEVELS.medium.hold > AGENT_LEVELS.hard.hold);
  assert.ok(AGENT_LEVELS.easy.every > AGENT_LEVELS.hard.every);
  assert.ok(AGENT_LEVELS.easy.invest < 1);
  assert.equal(levelOf("nope"), AGENT_LEVELS.medium);
  const r = race([["AAA", [0, 1, 2, 3, 4, 5, 6, 7]], ["BBB", [0, 2, 4, 6, 8, 10, 12, 14]]]);
  const run = agentRun(r, { start: 1000, hold: 2, every: 5, lookback: 5, invest: 0.5 });
  const buys = tradesOn(run, 5);
  assert.equal(buys.length, 2);
  near(buys[0].amount + buys[1].amount, 500);
  assert.deepEqual(run.opts, { hold: 2, every: 5, lookback: 5, invest: 0.5 });
  assert.equal(agentMind(r, run, 6).nextIn, null);
});
