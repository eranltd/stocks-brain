// The swing setup: the Stock page's "Swing setup" card and the Stocks page's strip (components/swing.jsx), and the
// sentences lib/swing.js writes ("sw.*"). Format: see shell.js. Voice: a research notebook anyone may read; pretend money
// only; never advice. Percent distances from the last close, never prices.
export default {
  "sw.title": "Swing setup",
  "sw.sub": "Pullback in an uptrend · pretend money",
  "sw.paper": "Paper",
  "sw.nav": "Swing",
  "sw.yes": "passes",
  "sw.no": "does not pass",
  "sw.info": "The textbook beginner swing setup, read by code from end-of-day bars: an uptrend, a dip toward the twenty-day average, then a day that closes above the day before's high. The plan: in at the next open, out at the stop, at the target (twice the risk) or after ten trading days. Pretend money only. It never moves money and never overrides the house rules.",

  "sw.state.setup": "Setup",
  "sw.state.watch": "On watch",
  "sw.state.none": "Not now",
  "sw.line.setup": "All four checks pass at the last close. A paper trade would go in at the next open.",
  "sw.line.setup.earnings": "The chart passes all four checks, but results are due inside the trade's window. The plan skips it.",
  "sw.line.watch": "In a pullback inside an uptrend. Waiting for a bounce day, or for a stop that is not too wide.",
  "sw.line.none": "Not a swing setup today. The plan only trades pullbacks inside an uptrend.",

  "sw.ck.uptrend.ok": "Uptrend: {dist} from its {days}-day average, which is rising",
  "sw.ck.uptrend.no": "Uptrend: no ({dist} from its {days}-day average, or the average is not rising)",
  "sw.ck.pullback.ok": { one: "Pullback: dipped to the {days}-day average, low {count} day ago ({depth} from the recent high)", other: "Pullback: dipped to the {days}-day average, low {count} days ago ({depth} from the recent high)", zero: "Pullback: dipped to the {days}-day average, low today ({depth} from the recent high)" },
  "sw.ck.pullback.no": "Pullback: no dip to the {days}-day average lately",
  "sw.ck.trigger.ok": "Bounce: closed above the day before's high",
  "sw.ck.trigger.no": "Bounce: not yet (no close above the day before's high)",
  "sw.ck.risk.ok": "Stop: {stop}, within the {max}% limit",
  "sw.ck.risk.no": "Stop: {stop}, wider than the {max}% limit",

  "sw.plan.stop": "Stop",
  "sw.plan.target": "Target",
  "sw.plan.high": "Recent high",
  "sw.plan.stopSub": "under the pullback's low",
  "sw.plan.targetSub": "twice the risk",
  "sw.plan.highSub": "{rr}× the risk",
  "sw.plan.note": "From the last close. The paper trade's real levels come from the next open.",

  "sw.warn.earnings": { one: "Results are due {date}, in {count} day: inside the trade's window. The plan skips it.", other: "Results are due {date}, in {count} days: inside the trade's window. The plan skips it.", zero: "Results are due today ({date}). The plan skips it." },
  "sw.warn.high": "The recent high is only {high} away ({rr}× the risk), nearer than the target. Price may stall there.",
  "sw.warn.noDate": "No results date on file for this name. Check it by hand before a paper trade.",

  "sw.hist": "History since {from}: {n} setups traded, {win}% winners, average {avg} per trade (90% range {lo} to {hi}). The same exits on any uptrend day: {base}. In-sample, on today's survivors: it flatters the setup.",
  "sw.fwd.none": "Forward record since {date}: no setups yet.",
  "sw.fwd.some": { one: "Forward record since {date}: {count} setup, {running} still running, {done} finished (average {avg}).", other: "Forward record since {date}: {count} setups, {running} still running, {done} finished (average {avg})." },
  "sw.none": "No swing reading for this name yet. It appears after the next daily run.",

  "sw.strip.title": "Swing setups today",
  "sw.strip.sub": "Pullbacks in an uptrend · pretend money",
  "sw.strip.setups": "Setups",
  "sw.strip.watch": "On watch",
  "sw.strip.noSetups": "No setups at the last close.",
  "sw.strip.noWatch": "Nothing on watch.",
  "sw.strip.open": "Open {symbol}",
  "sw.strip.stop": "stop {stop}",
  "sw.strip.more": { one: "+{count} more", other: "+{count} more" },
};
