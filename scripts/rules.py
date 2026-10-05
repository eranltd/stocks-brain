"""Rule engine: backtests the household's rule sets (pure; no I/O, no LLM). Rules: docs/playbook.md.

Two experiments, both built from percentages and values indexed to 100 (provider licence: no prices):
  1. SAVINGS: the core fund bought on a fixed cadence (every x weeks), optionally gated by the core's slow trend,
     or a lump sum spread over some weeks, across many start dates.
  2. SATELLITE: a sleeve of up to 5 names chosen by a rule (filters, rank, caps, sizing, exits), compared with the
     core, with holding every name, and with a null distribution of random baskets run on the same schedule and costs.

Honesty built in: decisions use data up to the decision day only; fills happen `lag` days later (default 1: the
next close); a no-lookahead test re-runs the engine on truncated data. The watchlist is today's (hindsight and
survivorship), so rules are judged against the random-basket null drawn from the same names, never against the goal.
"""
from __future__ import annotations

import math
import random

import market as mk
import portfolio as pf

Y = mk.TRADING_DAYS
WEEK = 5
CORE = pf.CORE
WARM = Y + 1  # a name is usable once it has a year of history (12-1 momentum looks back 252 days)
WEEKS_PER_YEAR = Y / WEEK  # 50.4 five-day weeks: annualise weekly figures on the same 252-day year as everything else
GATE_DAYS = 210  # about ten months: the slow trend filter on the core


# ---------------------------------------------------------------- market

def build_market(raw: dict[str, list[dict]], members: list[str], core: str, bench: str, cash: str | None,
                 sectors: dict[str, str]) -> dict | None:
    """Closes for every member on the benchmark's dates (late listings padded with None in front, so a
    name joins the universe only once it has WARM days of history), plus the core, the benchmark and a
    daily cash return (a T-bill fund; zero before the fund existed, which is pessimistic for cash)."""
    if not raw.get(bench) or not raw.get(core):
        return None
    core_dates = {b["date"] for b in raw[core]}
    dates = [b["date"] for b in raw[bench] if b["date"] in core_dates]  # days both the benchmark and the core traded
    n = len(dates)
    names = {*members, core, bench}
    al = mk.align_tail({s: raw[s] for s in names if raw.get(s)}, dates)
    if len(al.get(core, [])) != n or len(al.get(bench, [])) != n:
        return None
    closes, first = {}, {}
    for s in members:
        if s in al:
            closes[s] = [None] * (n - len(al[s])) + al[s]
            first[s] = n - len(al[s])
    cash_ret = [0.0] * n
    if cash and raw.get(cash):
        m = {b["date"]: b["close"] for b in raw[cash]}
        prev = None
        for k, d in enumerate(dates):
            v = m.get(d)
            if v is not None and prev is not None:
                cash_ret[k] = v / prev - 1
            prev = v
    core_c = al[core]
    # True range (needs adjusted high/low in the raw bars): the ATR stop uses it, as the literature defines it.
    tr: dict[str, list] = {}
    for s in closes:
        by = {b["date"]: b for b in raw[s] if "high" in b and "low" in b}
        c = closes[s]
        row: list = [None] * n
        for k in range(max(1, first[s] + 1), n):
            b = by.get(dates[k])
            if b is not None and c[k - 1] is not None:
                row[k] = max(b["high"] - b["low"], abs(b["high"] - c[k - 1]), abs(b["low"] - c[k - 1]))
        tr[s] = row
    return {"n": n, "dates": dates, "c": closes, "first": first, "core": core_c, "bench": al[bench],
            "sector": sectors, "cash": cash_ret, "core_on": trend_flags(core_c), "tr": tr, "core_symbol": core, "bench_symbol": bench}


def trend_flags(c: list[float]) -> list[bool]:
    """core_on[k]: the close is above its ~10-month average, using data up to k only."""
    on = [False] * len(c)
    run = 0.0
    for k in range(len(c)):
        run += c[k]
        if k >= GATE_DAYS:
            run -= c[k - GATE_DAYS]
        if k >= GATE_DAYS - 1:
            on[k] = c[k] > run / GATE_DAYS
    return on


def eligible(M: dict, i: int) -> list[str]:
    return [s for s in M["c"] if i - M["first"][s] >= WARM]


# --------------------------------------------------------- selection pieces

def _dist50(c, i):
    return mk.pct(mk.sma(c, 50, i), c[i])


def _rs(c, b, i, n):
    return mk.ret(c, n, i) - mk.ret(b, n, i)


def _rs_12_1(c, b, i):
    return (c[i - 21] / c[i - Y] - 1) * 100 - (b[i - 21] / b[i - Y] - 1) * 100


FILTERS = {
    "trend50_200": lambda c, b, i, p: c[i] > mk.sma(c, 50, i) > mk.sma(c, 200, i),
    "rs_3m": lambda c, b, i, p: _rs(c, b, i, 60) > 0,
    "rs_6m": lambda c, b, i, p: _rs(c, b, i, 120) > 0,
    "rs_12_1": lambda c, b, i, p: _rs_12_1(c, b, i) > 0,
    "not_stretched": lambda c, b, i, p: _dist50(c, i) < p.get("pct", 8),
    "breakout": lambda c, b, i, p: c[i] >= max(c[i - p.get("n", 126):i]),
    "pullback": lambda c, b, i, p: mk.sma(c, 50, i) > mk.sma(c, 200, i) and -p.get("max_pct", 5) <= _dist50(c, i) <= 2,
    "low_vol_cap": lambda c, b, i, p: mk.vol_ann(c, 60, i) < p.get("pct", 40),
}
RANKS = {
    "rs_6m": lambda c, b, i, st: _rs(c, b, i, 120),
    "rs_12_1": lambda c, b, i, st: _rs_12_1(c, b, i),
    "low_vol": lambda c, b, i, st: -mk.vol_ann(c, 60, i),
}


def _passes(spec: list[dict], c, b, i) -> bool:
    return all(FILTERS[f["f"]](c, b, i, f) for f in spec)


def _rank_value(rank: str, c, b, i, st):
    if rank == "checks_then_rs6":
        s = mk.setup_state(c, b, st["setup"], i)
        return (s["passed"], s["vs_bench_long_pct"]) if s else (-1, -1e9)
    return RANKS[rank](c, b, i, st)


def _corr(M: dict, a: str, b: str, i: int) -> float | None:
    """1-year daily-return correlation, cached per pair and day (every null run shares the same dates)."""
    key = (a, b, i) if a < b else (b, a, i)
    cache = M.setdefault("_corr", {})
    if key not in cache:
        cache[key] = pf.corr(M["c"][a], M["c"][b], i, Y)
    return cache[key]


def _fill(order: list[str], held: set[str], cfg: dict, M: dict, i: int) -> list[str]:
    """Walk candidates in order, honouring slots, sector cap and pairwise correlation cap."""
    picked: list[str] = []
    per: dict[str, int] = {}
    cap, ccap, slots = cfg.get("max_per_sector", 2), cfg.get("max_pair_corr", 0.85), cfg["slots"]
    for s in order:
        if len(picked) >= slots:
            break
        sec = M["sector"].get(s, "Unknown")
        if per.get(sec, 0) >= cap:
            continue
        if any((r := _corr(M, s, p, i)) is not None and r > ccap for p in picked):
            continue
        picked.append(s)
        per[sec] = per.get(sec, 0) + 1
    return picked


def pick_names(cfg: dict, M: dict, st: dict, i: int, held: list[str], rng: random.Random) -> list[str]:
    """Names the rule holds after the decision at close of day i, using data up to i only."""
    sel = cfg["selection"]
    method = sel["method"]
    if method == "core" or (cfg.get("regime") == "core_trend" and not M["core_on"][i]):
        return []
    if method == "scripted":  # tests: a fixed list of picks per decision day
        return list(sel["picks"].get(i, []))
    elig = eligible(M, i)
    if not elig:
        return []
    if method == "all":
        return elig
    if method == "random":
        order = elig[:]
        rng.shuffle(order)
        return _fill(order, set(), cfg, M, i)
    bench = M["bench"]
    if method == "v1":
        members = {s: M["c"][s] for s in elig}
        rule = {**st["portfolio"], **{k: cfg[k] for k in ("slots", "max_per_sector", "max_pair_corr") if k in cfg}}
        return pf.select(members, bench, M["sector"], i, st["setup"], rule, [h for h in held if h in members])[0]
    spec = sel.get("filters", [])
    rank = sel["rank"]
    key = {s: _rank_value(rank, M["c"][s], bench, i, st) for s in elig}
    keep_cfg = sel.get("keep", {"mode": "none"})
    keep: list[str] = []
    if keep_cfg["mode"] == "same_filters":
        keep = [s for s in held if s in key and _passes(spec, M["c"][s], bench, i)]
    elif keep_cfg["mode"] == "rank_top":
        top = set(sorted(key, key=key.get, reverse=True)[: keep_cfg["n"]])
        keep = [s for s in held if s in top]
    new = [s for s in elig if s not in keep and _passes(spec, M["c"][s], bench, i)]
    order = sorted(keep, key=key.get, reverse=True) + sorted(new, key=key.get, reverse=True)
    return _fill(order, set(held), cfg, M, i)


def target_weights(cfg: dict, M: dict, picked: list[str], i: int) -> dict[str, float]:
    slots, m = cfg["slots"], len(picked)
    if not m:
        return {CORE: 1.0}
    if cfg["selection"]["method"] == "all":  # the 'every name equally' control: never levered, no core remainder
        return {s: 1.0 / m for s in picked}
    if cfg.get("sizing") == "inverse_vol":
        iv = {s: 1.0 / max(5.0, mk.vol_ann(M["c"][s], 60, i)) for s in picked}
        t = sum(iv.values())
        w = {s: (m / slots) * iv[s] / t for s in picked}
    else:
        w = {s: 1.0 / slots for s in picked}
    rest = 1.0 - sum(w.values())
    if rest > 1e-12:
        w[CORE] = rest
    return w


# ---------------------------------------------------------------- sleeve

def _atr(M: dict, s: str, i: int, n: int) -> float:
    """Average true range over n days ending at i (close-to-close change where high/low are unavailable)."""
    row = M.get("tr", {}).get(s)
    if row is not None and all(row[k] is not None for k in range(i - n + 1, i + 1)):
        return sum(row[k] for k in range(i - n + 1, i + 1)) / n
    c = M["c"][s]
    return sum(abs(c[k] - c[k - 1]) for k in range(i - n + 1, i + 1)) / n


def run_sleeve(cfg: dict, M: dict, st: dict, start: int, lag: int = 1, cost_bps: float = 10.0, seed: int = 0,
               end: int | None = None) -> dict:
    """Simulate one satellite sleeve from `start`. Decisions at the close of day d (rebalance days: first
    trading day of the month, or quarter) fill at the close of day d + lag. Stops are checked daily on closes
    and move the name's value to the core at the next fill. Returns daily values indexed to 100."""
    n = M["n"] if end is None else end
    dates, core = M["dates"], M["core"]
    quarterly = cfg.get("rebalance", "monthly") == "quarterly"
    ex = cfg.get("exit", {"kind": "none"})
    scripted = cfg["selection"]["picks"] if cfg["selection"]["method"] == "scripted" else None
    rng = random.Random(seed)
    pos: dict[str, float] = {}
    v = 100.0
    vals: list[float] = []
    rebs: list[dict] = []
    stops: list[dict] = []
    pending: list[tuple[int, str, object]] = []
    exiting: set[str] = set()
    peak: dict[str, float] = {}

    def px(s: str, k: int) -> float:
        return core[k] if s == CORE else M["c"][s][k]

    def fill_rebalance(k: int, w: dict[str, float], record: bool) -> None:
        nonlocal pos, v
        old = {s: x / v for s, x in pos.items()} if pos else {}
        traded = sum(abs(w.get(s, 0.0) - old.get(s, 0.0)) for s in {*w, *old})
        v -= v * traded * cost_bps / 1e4
        pos = {s: v * x for s, x in w.items() if x > 0}
        for s in pos:
            if s != CORE and s not in old:
                peak[s] = px(s, k)
        exiting.clear()
        if record:
            rebs.append({"date": dates[k], "holdings": [s for s in pos if s != CORE],
                         "core_pct": round(pos.get(CORE, 0.0) / v * 100, 1), "traded_pct": round(traded * 100, 1)})

    def fill_exit(k: int, s: str) -> None:
        nonlocal v
        if s not in pos:
            return
        w = pos[s] / v
        cost = pos[s] * 2 * cost_bps / 1e4  # sell the name and buy the core: traded weight is twice its weight
        pos[CORE] = pos.get(CORE, 0.0) + pos.pop(s) - cost
        v = sum(pos.values())
        exiting.discard(s)
        stops.append({"date": dates[k], "symbol": s, "traded_pct": round(2 * w * 100, 2)})

    for k in range(start, n):
        if pos:
            for s in pos:
                pos[s] *= px(s, k) / px(s, k - 1)
            v = sum(pos.values())
        due = [p for p in pending if p[0] == k]
        pending = [p for p in pending if p[0] != k]
        for _, kind, payload in due:
            if kind == "rebalance":
                fill_rebalance(k, payload, True)
            else:
                fill_exit(k, payload)
        if scripted is not None:  # replay of recorded decisions: decide exactly on the recorded days
            decide = k in scripted
        else:
            decide = (k == start or dates[k][:7] != dates[k - 1][:7]) and (k == start or not quarterly or int(dates[k][5:7]) in (1, 4, 7, 10))
        if decide:
            held = [s for s in pos if s != CORE]
            picked = pick_names(cfg, M, st, k, held, rng)
            w = target_weights(cfg, M, picked, k)
            if lag == 0:
                fill_rebalance(k, w, True)
            elif k + lag < n:
                pending.append((k + lag, "rebalance", w))
        if ex["kind"] != "none" and pos:
            for s in [s for s in pos if s != CORE and s not in exiting]:
                c = M["c"][s]
                peak[s] = max(peak.get(s, c[k]), c[k])
                hit = False
                if ex["kind"] == "atr_trail":
                    hit = c[k] < peak[s] - ex["k"] * _atr(M, s, k, ex["n"])
                elif ex["kind"] == "trend_break":
                    hit = c[k] < mk.sma(c, ex["n"], k)
                if hit:
                    exiting.add(s)
                    if lag == 0:
                        fill_exit(k, s)
                    elif k + lag < n:
                        pending.append((k + lag, "exit", s))
        vals.append(sum(pos.values()) if pos else v)
        if pos:
            v = vals[-1]
    return {"values": vals, "rebalances": rebs, "stops": stops, "start": start}


def cagr(vals: list[float]) -> float:
    return ((vals[-1] / vals[0]) ** (Y / (len(vals) - 1)) - 1) * 100


def thirds(vals: list[float]) -> tuple[float, float, float]:
    mid = len(vals) // 2
    return cagr(vals), cagr(vals[: mid + 1]), cagr(vals[mid:])


def turnover_per_year(rebs: list[dict], years: float, stops: list[dict] | None = None) -> float:
    """Percent of the sleeve replaced per year, rebalances and stop exits together (traded weight counts a buy and
    a sell, so halve it). The first entry is not turnover."""
    traded = sum(r["traded_pct"] for r in rebs[1:]) + sum(x["traded_pct"] for x in stops or [])
    return traded / 2 / max(years, 1e-9)


def decision_days(M: dict, start: int, lag: int, quarterly: bool = False) -> tuple[list[int], list[int]]:
    """Rebalance decision days (first trading day of the month or quarter, plus the first day) and their fill days."""
    n, dates = M["n"], M["dates"]
    dec = [k for k in range(start, n)
           if (k == start or dates[k][:7] != dates[k - 1][:7]) and (k == start or not quarterly or int(dates[k][5:7]) in (1, 4, 7, 10))
           and k + lag < n]
    return dec, [k + lag for k in dec]


def sim_periods(M: dict, fills: list[int], picks: list[list[str]], slots: int, cost_bps: float, mid_day: int) -> tuple[float, float]:
    """Equal-weight sleeve between rebalances in closed form (a position compounds on its own between fills),
    exactly what run_sleeve does when there are no stops. Returns (value at the last day, value at mid_day)."""
    n, core = M["n"], M["core"]
    v, drift, v_mid = 100.0, {}, None
    for t, f in enumerate(fills):
        if picks[t]:
            w = {s: 1.0 / slots for s in picks[t]}
            rest = 1.0 - sum(w.values())
            if rest > 1e-12:
                w[CORE] = rest
        else:
            w = {CORE: 1.0}
        traded = sum(abs(w.get(s, 0.0) - drift.get(s, 0.0)) for s in {*w, *drift})
        v -= v * traded * cost_bps / 1e4
        end = fills[t + 1] if t + 1 < len(fills) else n - 1
        new, mid = {}, 0.0
        for s, x in w.items():
            c = core if s == CORE else M["c"][s]
            new[s] = v * x * c[end] / c[f]
            if v_mid is None and f <= mid_day and (mid_day < end or end == n - 1):
                mid += v * x * c[mid_day] / c[f]
        if mid:
            v_mid = mid
        v = sum(new.values())
        drift = {s: x / v for s, x in new.items()}
    return v, v_mid if v_mid is not None else v


def matched_null(M: dict, st: dict, start: int, rebs: list[dict], cfg: dict, runs: int, seed: int,
                 lag: int, cost_bps: float, days: list[int] | None = None) -> dict:
    """Skill versus luck for ONE rule. Random names, but at every decision the same NUMBER of names the rule held
    (so the same exposure to stocks versus the core) and the same replacement rate (so the same trading costs),
    with the rule's own caps, sizing, exits, gate and fills. Only WHICH names differs. Equal-weight rules without
    exits use the closed-form period simulator (tested equal to the daily engine); others replay each random draw
    through the daily engine. Returns per-run (cagr, cagr_first_half, cagr_second_half) plus q."""
    n = M["n"]
    quarterly = cfg.get("rebalance", "monthly") == "quarterly"
    if days is None:
        dec, fills = decision_days(M, start, lag, quarterly)
    else:  # recorded decision days (the forward ledger records on the first run of a month, not always day one)
        dec = [d for d in days if d + lag < n]
        fills = [d + lag for d in dec]
    m = [len(r["holdings"]) for r in rebs][: len(dec)]
    # Replacement only where names were held on both sides (going to or from the core is matched through m).
    kept = [len(set(a["holdings"]) & set(b["holdings"])) / len(a["holdings"]) for a, b in zip(rebs, rebs[1:]) if a["holdings"] and b["holdings"]]
    q = 1.0 - sum(kept) / len(kept) if kept else 1.0
    elig = [eligible(M, d) for d in dec]
    caps = {k: cfg[k] for k in ("max_per_sector", "max_pair_corr") if k in cfg}
    fast = cfg.get("sizing", "equal") == "equal" and cfg.get("exit", {"kind": "none"})["kind"] == "none"
    mid = start + (n - start) // 2
    span = n - 1 - start
    out = []
    for r in range(runs):
        rng = random.Random(seed + r)
        held: list[str] = []
        picks = []
        for t, d in enumerate(dec):
            ok = set(elig[t])
            keep = [s for s in held if s in ok and rng.random() >= q]
            rest = [s for s in elig[t] if s not in keep]
            rng.shuffle(rest)
            picked = _fill(keep + rest, set(held), {"slots": m[t], **caps}, M, d) if m[t] else []
            picks.append(picked)
            held = picked
        if fast:
            v_end, v_mid = sim_periods(M, fills, picks, cfg["slots"], cost_bps, mid)
            out.append((((v_end / 100) ** (Y / span) - 1) * 100, ((v_mid / 100) ** (Y / (mid - start)) - 1) * 100,
                        ((v_end / v_mid) ** (Y / (n - 1 - mid)) - 1) * 100))
        else:
            replay = {**cfg, "regime": "none", "selection": {"method": "scripted", "picks": dict(zip(dec, picks))}}
            out.append(thirds(run_sleeve(replay, M, st, start, lag, cost_bps)["values"]))
    return {"runs": out, "q": q, "avg_names": sum(m) / len(m) if m else 0.0}


def percentile_of(x: float, dist: list[float]) -> float:
    below = sum(d < x for d in dist) + 0.5 * sum(d == x for d in dist)
    return below / len(dist) * 100 if dist else 0.0


def quantile(xs: list[float], q: float) -> float:
    s = sorted(xs)
    return s[min(len(s) - 1, max(0, int(q * (len(s) - 1) + 0.5)))]


# --------------------------------------------------------------- savings

def run_savings(M: dict, start: int, horizon_weeks: int, every_weeks: int = 1, gate: bool = False, lag: int = 1,
                mode: str = "stream", spread_weeks: int = 1, trace: list | None = None) -> dict | None:
    """The core fund bought on a cadence. stream: one unit of cash arrives every week (a salary) and is invested
    every `every_weeks` weeks (all the cash on hand), only while the gate allows if gated; cash earns the T-bill
    return while it waits. windfall: 100 units arrive on day one and are invested all at once (spread_weeks=1) or
    in equal weekly tranches. Value is read at the end of the horizon."""
    core, cash_r, on = M["core"], M["cash"], M["core_on"]
    end = start + horizon_weeks * WEEK
    if end + lag >= M["n"]:
        return None
    units = cash = paid = 0.0
    flows: list[tuple[int, float]] = []
    buys: dict[int, float] = {}
    trades = 0
    fee_growth = 0.0  # what one unit of fee paid at each trade would have grown to by the end
    worst = 0.0
    cash_share = 0.0
    if mode == "windfall":
        cash, paid = 100.0, 100.0
        flows.append((0, 100.0))
    for k in range(start, end + 1):
        if k > start:
            cash *= 1 + cash_r[k]
        wk, dow = divmod(k - start, WEEK)
        if mode == "stream" and dow == 0 and wk < horizon_weeks:
            cash += 1.0
            paid += 1.0
            flows.append((wk, 1.0))
        if k in buys:  # fill
            want = buys.pop(k)
            amt = min(cash, want) if mode == "windfall" else cash
            if amt > 1e-12:
                units += amt / core[k]
                cash -= amt
                trades += 1
                fee_growth += core[end] / core[k]
        if dow == 0:
            if mode == "stream" and wk % every_weeks == 0 and wk < horizon_weeks and (not gate or on[k]):
                buys[k + lag] = 0.0
                if lag == 0:
                    units += cash / core[k]
                    cash = 0.0
                    trades += 1
                    fee_growth += core[end] / core[k]
                    buys.pop(k)
            if mode == "windfall" and wk < spread_weeks:
                if lag == 0:
                    amt = min(cash, 100.0 / spread_weeks)
                    units += amt / core[k]
                    cash -= amt
                    trades += 1
                    fee_growth += core[end] / core[k]
                else:
                    buys[k + lag] = 100.0 / spread_weeks
        wealth = units * core[k] + cash
        if trace is not None:  # tests: the day-by-day state, to prove no decision uses later data
            trace.append((k, round(units, 12), round(cash, 12)))
        if paid >= 8:
            worst = min(worst, wealth / paid - 1)
        cash_share += cash / wealth if wealth else 0.0
    terminal = units * core[end] + cash
    if mode == "windfall":
        irr = (terminal / 100.0) ** (WEEKS_PER_YEAR / horizon_weeks) - 1
    else:
        lo, hi = -0.5, 1.0  # weekly rate by bisection: sum f*(1+r)^(T-w) = terminal
        for _ in range(60):
            r = (lo + hi) / 2
            fv = sum(a * (1 + r) ** (horizon_weeks - w) for w, a in flows)
            lo, hi = (r, hi) if fv < terminal else (lo, r)
        irr = (1 + (lo + hi) / 2) ** WEEKS_PER_YEAR - 1
    return {"terminal_units": terminal, "multiple": terminal / paid, "irr_pct": irr * 100, "worst_vs_paid_pct": worst * 100,
            "cash_share_pct": cash_share / (end - start + 1) * 100, "trades": trades, "fee_growth": fee_growth, "paid": paid}


def savings_windows(M: dict, horizon_weeks: int, step_weeks: int = 4, lag: int = 1) -> list[int]:
    first = GATE_DAYS + 1
    last = M["n"] - horizon_weeks * WEEK - lag - 1
    return list(range(first, last, step_weeks * WEEK))


def _med(xs: list[float]) -> float:
    return quantile(xs, 0.5)


def savings_study(M: dict, specs: list[dict], horizons: list[int], step_weeks: int = 4, lag: int = 1) -> dict:
    """Run every savings spec over rolling start dates. Windows overlap heavily, so the number of INDEPENDENT
    windows is about span / horizon: reported as `independent`. Paired comparisons are against the baseline of the
    same mode (a salary stream is compared with a stream, a windfall with a windfall)."""
    base_of: dict[str, str] = {}
    for sp in specs:
        mode = sp.get("mode", "stream")
        if sp.get("baseline") or mode not in base_of:
            base_of[mode] = sp["id"]
    out: dict = {"baselines": base_of, "horizons": []}
    for h in horizons:
        starts = savings_windows(M, h, step_weeks, lag)
        if len(starts) < 3:
            continue
        runs: dict[str, list[dict]] = {}
        for sp in specs:
            runs[sp["id"]] = [r for s in starts if (r := run_savings(
                M, s, h, sp.get("every_weeks", 1), sp.get("gate", "none") == "core_trend", lag, sp.get("mode", "stream"),
                sp.get("spread_weeks", 1)))]
        span = (starts[-1] - starts[0]) + h * WEEK
        rows = []
        for sp in specs:
            mode = sp.get("mode", "stream")
            rs, base = runs[sp["id"]], runs[base_of[mode]]
            row = {"id": sp["id"], "mode": mode, "windows": len(rs),
                   "multiple_median": round(_med([r["multiple"] for r in rs]), 4),
                   "multiple_p10": round(quantile([r["multiple"] for r in rs], 0.1), 4),
                   "multiple_p90": round(quantile([r["multiple"] for r in rs], 0.9), 4),
                   "irr_median_pct": round(_med([r["irr_pct"] for r in rs]), 2),
                   "worst_vs_paid_median_pct": round(_med([r["worst_vs_paid_pct"] for r in rs]), 2),
                   "worst_vs_paid_p10_pct": round(quantile([r["worst_vs_paid_pct"] for r in rs], 0.1), 2),
                   "cash_share_median_pct": round(_med([r["cash_share_pct"] for r in rs]), 1),
                   "trades_per_year": round(_med([r["trades"] for r in rs]) / (h / WEEKS_PER_YEAR), 1)}
            if sp["id"] != base_of[mode]:
                pairs = list(zip(rs, base))
                d_irr = [a["irr_pct"] - b["irr_pct"] for a, b in pairs]
                d_mult = [(a["multiple"] - b["multiple"]) * 100 for a, b in pairs]
                row |= {"baseline": base_of[mode], "vs_baseline_irr_bps_median": round(_med(d_irr) * 100, 1),
                        "vs_baseline_multiple_pts_median": round(_med(d_mult), 2),
                        "vs_baseline_better_pct": round(sum(x > 0 for x in d_irr) / len(d_irr) * 100, 1)}
                # Fixed fee per trade, as % of one weekly contribution, at which the two cadences tie. A fee paid at a
                # trade loses its growth until the end, so each trade weighs what one unit would have grown to.
                dg = [(a["fee_growth"] - b["fee_growth"]) for a, b in pairs]
                fees = [(a["terminal_units"] - b["terminal_units"]) / d for (a, b), d in zip(pairs, dg) if abs(d) > 1e-9]
                if fees and mode == "stream" and sp.get("gate", "none") == "none":
                    row["breakeven_fee_pct_of_weekly"] = round(_med(fees) * 100, 2)
            rows.append(row)
        out["horizons"].append({"weeks": h, "windows": len(starts), "independent": max(1, span // (h * WEEK)),
                                "from": M["dates"][starts[0]], "to": M["dates"][min(M["n"] - 1, starts[-1] + h * WEEK)],
                                "rows": rows})
    return out
