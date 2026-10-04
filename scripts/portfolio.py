"""Portfolio rule v1 and long-run statistics (pure; no I/O, no LLM). Rules: docs/methodology.md.

The household goal is a diversified satellite of 4-5 stocks around an index-fund core, and a
+20%/yr target. This module answers three questions with code only:
  1. What would the rule hold now, and why is each other name left out?
  2. How did the same rule do over the history we have (vs holding every name, the core, the benchmark)?
  3. How often did anything actually reach the goal over a 12-month window, and what did it cost in drawdown?
Outputs are percentages and values indexed to 100 (provider licence: no absolute prices).
"""
from __future__ import annotations

import math

import market as mk

Y = mk.TRADING_DAYS
CORE = "__core__"


def _rets(c: list[float], i: int, n: int) -> list[float]:
    return [c[k] / c[k - 1] - 1 for k in range(i - n + 1, i + 1)]


def corr(a: list[float], b: list[float], i: int, n: int) -> float | None:
    """Pearson correlation of daily returns over the n days ending at i."""
    if i - n < 0:
        return None
    ra, rb = _rets(a, i, n), _rets(b, i, n)
    ma, mb = sum(ra) / n, sum(rb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    va, vb = sum((x - ma) ** 2 for x in ra), sum((y - mb) ** 2 for y in rb)
    return cov / math.sqrt(va * vb) if va and vb else None


def long_stats(c: list[float], goal_pct: float) -> dict:
    """Compounding, drawdown and rolling 12-month outcomes for one daily series."""
    years = (len(c) - 1) / Y

    def cg(n: int) -> float | None:
        return round(((c[-1] / c[-1 - n]) ** (Y / n) - 1) * 100, 2) if len(c) > n else None

    r12 = sorted(mk.pct(c[k - Y], c[k]) for k in range(Y, len(c)))
    n = len(r12)
    return {
        "years": round(years, 1),
        "cagr_pct": round(((c[-1] / c[0]) ** (1 / years) - 1) * 100, 2) if years >= 1 else None,
        "cagr_1y_pct": cg(Y), "cagr_3y_pct": cg(3 * Y), "cagr_5y_pct": cg(5 * Y),
        "max_dd_pct": round(mk.max_drawdown(c)[0], 2),
        "vol_pct": round(mk.vol_ann(c, len(c) - 1), 2) if len(c) > 2 else None,
        "windows_12m": n,
        "hit_goal_12m_pct": round(sum(x >= goal_pct for x in r12) / n * 100, 1) if n else None,
        "loss_12m_pct": round(sum(x < 0 for x in r12) / n * 100, 1) if n else None,
        "worst_12m_pct": round(r12[0], 2) if n else None,
        "median_12m_pct": round(r12[n // 2], 2) if n else None,
        "best_12m_pct": round(r12[-1], 2) if n else None,
    }


def goal_math(goal_pct: float) -> dict:
    g = 1 + goal_pct / 100
    return {"annual_return_pct": goal_pct, "years_to_double": round(math.log(2) / math.log(g), 1),
            "multiple_5y": round(g ** 5, 2), "multiple_10y": round(g ** 10, 2)}


# ------------------------------------------------------------------ rule v1

def select(members: dict[str, list[float]], bench: list[float], sectors: dict[str, str], i: int,
           setup_cfg: dict, rule: dict, held: list[str]) -> tuple[list[str], dict[str, str], dict]:
    """Names the rule holds at index i using data up to i only.

    Keep a held name while it passes keep_min_checks (stretch is ignored for names already held, so the
    rule does not sell strength). Add new names that pass entry_min_checks and are not stretched. Rank
    by checks passed, then 6-month strength vs the benchmark. Then fill up to `slots`, at most
    max_per_sector per sector and no pair correlated above max_pair_corr. Empty slots stay in the core.
    Returns (picked, status per name, setup state per name)."""
    states = {s: st for s, c in members.items() if (st := mk.setup_state(c, bench, setup_cfg, i))}
    status: dict[str, str] = {s: "no_history" for s in members if s not in states}
    keep = [s for s in held if s in states and states[s]["passed"] >= rule["keep_min_checks"]]
    new = []
    for s, st in states.items():
        if s in keep:
            continue
        if st["passed"] < rule["entry_min_checks"]:
            status[s] = "fails_checks"
        elif setup_cfg["veto_stretched"] and st["stretched"]:
            status[s] = "stretched"
        else:
            new.append(s)
    rank = lambda s: (states[s]["passed"], states[s]["vs_bench_long_pct"])  # noqa: E731
    picked: list[str] = []
    per: dict[str, int] = {}
    for s in sorted(keep, key=rank, reverse=True) + sorted(new, key=rank, reverse=True):
        sec = sectors.get(s, "Unknown")
        if len(picked) >= rule["slots"]:
            status[s] = "slots_full"
        elif per.get(sec, 0) >= rule["max_per_sector"]:
            status[s] = "sector_cap"
        elif any((r := corr(members[s], members[p], i, rule["corr_days"])) is not None and r > rule["max_pair_corr"]
                 for p in picked):
            status[s] = "too_correlated"
        else:
            picked.append(s)
            per[sec] = per.get(sec, 0) + 1
            status[s] = "kept" if s in held else "added"
    return picked, status, states


def simulate(members: dict[str, list[float]], core: list[float], dates: list[str], start: int,
             choose, slots: int, cost_bps: float) -> tuple[list[float], list[dict]]:
    """Monthly rebalance at the close of the first trading day of each month, equal weight per slot,
    empty slots in the core, costs on traded weight. Returns (daily values indexed to 100, rebalances)."""
    pos: dict[str, float] = {}
    v, vals, rebs, held = 100.0, [], [], []
    for k in range(start, len(dates)):
        if pos:
            for key in pos:
                c = core if key == CORE else members[key]
                pos[key] *= c[k] / c[k - 1]
            v = sum(pos.values())
        if not pos or dates[k][:7] != dates[k - 1][:7]:
            picked = choose(k, held)
            w = {s: 1 / slots for s in picked}
            if len(picked) < slots:
                w[CORE] = (slots - len(picked)) / slots
            old = {key: x / v for key, x in pos.items()}
            traded = sum(abs(w.get(x, 0) - old.get(x, 0)) for x in {*w, *old})
            v -= v * traded * cost_bps / 1e4
            pos = {x: v * wx for x, wx in w.items()}
            rebs.append({"date": dates[k], "holdings": list(picked), "core_pct": round(w.get(CORE, 0) * 100, 1),
                         "traded_pct": round(traded * 100, 1)})
            held = picked
        vals.append(v)
    return vals, rebs


def weekly_idx(n: int, start: int, step: int) -> list[int]:
    return list(range(n - 1, start - 1, -step))[::-1]


def _indexed(c: list[float], idx: list[int]) -> list[float]:
    base = c[idx[0]]
    return [round(c[k] / base * 100, 2) for k in idx]


def diversification(members: dict[str, list[float]], core: list[float], picked: list[str], slots: int,
                    sectors: dict[str, str], n: int) -> dict:
    """Risk of the slot portfolio over the last n days: volatility, average pair correlation, sectors."""
    i = len(core) - 1
    keys = [*picked] + ([CORE] if len(picked) < slots else [])
    w = {s: 1 / slots for s in picked}
    if len(picked) < slots:
        w[CORE] = (slots - len(picked)) / slots
    series = {k: (core if k == CORE else members[k]) for k in keys}
    port = [1.0]
    for k in range(i - n + 1, i + 1):
        port.append(port[-1] * (1 + sum(w[x] * (series[x][k] / series[x][k - 1] - 1) for x in keys)))
    vol = mk.vol_ann(port, n)
    pairs = [corr(members[a], members[b], i, n) for x, a in enumerate(picked) for b in picked[x + 1:]]
    pairs = [p for p in pairs if p is not None]
    weighted_vol = sum(w[x] * mk.vol_ann(series[x], n) for x in keys)
    return {"names": len(picked), "core_pct": round(w.get(CORE, 0) * 100, 1),
            "sectors": len({sectors.get(s, "Unknown") for s in picked}),
            "avg_pair_corr": round(sum(pairs) / len(pairs), 2) if pairs else None,
            "vol_1y_pct": round(vol, 2), "loss_95_20d_pct": round(-1.645 * vol * math.sqrt(20 / Y), 2),
            "diversification_ratio": round(weighted_vol / vol, 2) if vol else None}


def compute_longrun(members: dict[str, list[float]], core: list[float], bench: list[float], dates: list[str],
                    sectors: dict[str, str], st: dict) -> dict | None:
    """Everything the Goal and Portfolio views need. members/core/bench are aligned on `dates`."""
    setup_cfg, rule, goal = st["setup"], st["portfolio"], st["goal"]["annual_return_pct"]
    start = max(setup_cfg["trend_long_days"], setup_cfg["rs_long_days"], rule["corr_days"]) + 1
    if len(dates) < start + Y or not members:
        return None

    def rule_choose(k: int, held: list[str]) -> list[str]:
        return select(members, bench, sectors, k, setup_cfg, rule, held)[0]

    rule_v, rebs = simulate(members, core, dates, start, rule_choose, rule["slots"], rule["cost_bps"])
    ew_v, _ = simulate(members, core, dates, start, lambda k, held: list(members), len(members), rule["cost_bps"])
    core_v, bench_v = core[start:], bench[start:]
    held_days = {s: 0 for s in members}
    for a, b in zip(rebs, [*rebs[1:], None]):
        span = (dates.index(b["date"]) if b else len(dates)) - dates.index(a["date"])
        for s in a["holdings"]:
            held_days[s] += span
    total = len(dates) - start

    picked, status, states = select(members, bench, sectors, len(dates) - 1, setup_cfg, rule, rebs[-1]["holdings"])
    idx = weekly_idx(len(dates), start, rule["weekly_step_days"])
    rel = [k - start for k in idx]
    yrs = (len(dates) - 1 - start) / Y
    return {
        "from": dates[start], "to": dates[-1], "years": round(yrs, 1),
        "goal": goal_math(goal),
        "rule": {"version": "v1", **{k: rule[k] for k in ("slots", "target_min_names", "entry_min_checks", "keep_min_checks",
                                                          "max_per_sector", "max_pair_corr", "cost_bps")}},
        "stats": {"rule": long_stats(rule_v, goal), "equal_weight": long_stats(ew_v, goal),
                  "core": long_stats(core_v, goal), "bench": long_stats(bench_v, goal)},
        "members": [{"symbol": s, "sector": sectors.get(s, "Unknown"), **long_stats(c[start:], goal),
                     "held_pct": round(held_days[s] / total * 100, 1)} for s, c in members.items()],
        "rebalances": rebs[-24:],
        "rebalances_total": len(rebs),
        "avg_names_held": round(sum(len(r["holdings"]) for r in rebs) / len(rebs), 2),
        "traded_per_year_pct": round(sum(r["traded_pct"] for r in rebs[1:]) / max(yrs, 1e-9), 1),
        "now": {"last_rebalance": rebs[-1]["date"], "holdings": rebs[-1]["holdings"],
                "if_rebalanced_today": picked,
                "status": [{"symbol": s, "status": status[s], "sector": sectors.get(s, "Unknown"),
                            **({"passed": states[s]["passed"], "stretched": states[s]["stretched"],
                                "vs_bench_long_pct": states[s]["vs_bench_long_pct"]} if s in states else {})}
                           for s in members],
                "diversification": diversification(members, core, rebs[-1]["holdings"], rule["slots"], sectors, Y)},
        "corr_1y": {"symbols": list(members),
                    "m": [[round(corr(members[a], members[b], len(dates) - 1, Y), 2) if a != b else 1.0 for b in members]
                          for a in members]},
        "weekly": {"dates": [dates[k] for k in idx],
                   "rule": [round(rule_v[k] / rule_v[rel[0]] * 100, 2) for k in rel],
                   "equal_weight": [round(ew_v[k] / ew_v[rel[0]] * 100, 2) for k in rel],
                   "core": _indexed(core, idx), "bench": _indexed(bench, idx),
                   "members": {s: _indexed(c, idx) for s, c in members.items()}},
    }
