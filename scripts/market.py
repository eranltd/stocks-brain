"""Pure market computations (no I/O, no LLM). Rules are documented in docs/methodology.md.

Everything here works on lists of adjusted closes aligned by date. Outputs are returns, distances,
counts and statistics only: no absolute prices (provider licence; see docs/decisions.md).
"""
from __future__ import annotations

import math

TRADING_DAYS = 252


def pct(a: float, b: float) -> float:
    return (b / a - 1) * 100


def sma(c: list[float], n: int, i: int | None = None) -> float | None:
    i = len(c) - 1 if i is None else i
    return sum(c[i - n + 1:i + 1]) / n if i + 1 >= n else None


def ret(c: list[float], n: int, i: int | None = None) -> float | None:
    i = len(c) - 1 if i is None else i
    return pct(c[i - n], c[i]) if i - n >= 0 else None


def vol_ann(c: list[float], n: int, i: int | None = None) -> float | None:
    """Annualised volatility (%) of the last n daily log returns ending at i."""
    i = len(c) - 1 if i is None else i
    if i - n < 0:
        return None
    r = [math.log(c[k] / c[k - 1]) for k in range(i - n + 1, i + 1)]
    mu = sum(r) / len(r)
    return math.sqrt(sum((x - mu) ** 2 for x in r) / (len(r) - 1)) * math.sqrt(TRADING_DAYS) * 100


def max_drawdown(c: list[float]) -> tuple[float, int, int]:
    """(max drawdown %, peak index, trough index) over the whole list."""
    peak_i, best = 0, (0.0, 0, 0)
    for k, v in enumerate(c):
        if v > c[peak_i]:
            peak_i = k
        dd = pct(c[peak_i], v)
        if dd < best[0]:
            best = (dd, peak_i, k)
    return best


def worst_window(c: list[float], n: int) -> float | None:
    return min(pct(c[k - n], c[k]) for k in range(n, len(c))) if len(c) > n else None


def align(series: dict[str, list[dict]], dates: list[str]) -> dict[str, list[float]]:
    """Closes for each symbol on exactly `dates` (symbols missing a date are dropped)."""
    out = {}
    for sym, bars in series.items():
        m = {b["date"]: b["close"] for b in bars}
        if all(d in m for d in dates):
            out[sym] = [m[d] for d in dates]
    return out


def align_tail(series: dict[str, list[dict]], dates: list[str]) -> dict[str, list[float]]:
    """Closes for each symbol on the longest suffix of `dates` it fully covers (a fund that launched
    later gets a shorter list ending on the same last date). Symbols missing the last date are dropped."""
    out = {}
    for sym, bars in series.items():
        m = {b["date"]: b["close"] for b in bars}
        vals = []
        for d in reversed(dates):
            if d not in m:
                break
            vals.append(m[d])
        if vals:
            out[sym] = vals[::-1]
    return out


# ------------------------------------------------------------- setup checks

def setup_state(c: list[float], b: list[float], cfg: dict, i: int | None = None) -> dict | None:
    """Setup checks v2 at index i (default: last). c = stock closes, b = benchmark closes, same dates.

    1. trend    close above its 50-day average AND the 50-day above the long (200-day) average
    2. rs_3m    excess return vs benchmark over rs_short_days > 0
    3. rs_6m    excess return vs benchmark over rs_long_days > 0
    4. calm     NOT stretched: close less than stretch_pct above its 50-day average (a veto when configured)
    """
    i = len(c) - 1 if i is None else i
    s50, slong = sma(c, 50, i), sma(c, cfg["trend_long_days"], i)
    rs_s = (ret(c, cfg["rs_short_days"], i), ret(b, cfg["rs_short_days"], i))
    rs_l = (ret(c, cfg["rs_long_days"], i), ret(b, cfg["rs_long_days"], i))
    if None in (s50, slong, *rs_s, *rs_l):
        return None
    dist50 = pct(s50, c[i])
    checks = {
        "trend": c[i] > s50 and s50 > slong,
        "rs_3m": rs_s[0] - rs_s[1] > 0,
        "rs_6m": rs_l[0] - rs_l[1] > 0,
        "calm": dist50 < cfg["stretch_pct"],
    }
    return {"checks": checks, "passed": sum(checks.values()), "stretched": not checks["calm"],
            "dist_sma50_pct": round(dist50, 3), "dist_long_pct": round(pct(slong, c[i]), 3),
            "vs_bench_short_pct": round(rs_s[0] - rs_s[1], 3), "vs_bench_long_pct": round(rs_l[0] - rs_l[1], 3)}


def _stats(xs: list[float], z: float = 1.645) -> dict:
    n = len(xs)
    if not n:
        return {"n": 0, "mean": None, "ci_low": None, "ci_high": None, "hit_pct": None}
    mu = sum(xs) / n
    sd = math.sqrt(sum((x - mu) ** 2 for x in xs) / (n - 1)) if n > 1 else 0.0
    half = z * sd / math.sqrt(n) if n > 1 else 0.0
    return {"n": n, "mean": round(mu, 3), "ci_low": round(mu - half, 3), "ci_high": round(mu + half, 3),
            "hit_pct": round(sum(x > 0 for x in xs) / n * 100, 1)}


def base_rates(closes: dict[str, list[float]], bench: str, dates: list[str], cfg: dict, bt: dict) -> dict:
    """How did each setup state do historically? Forward excess return vs the benchmark over
    `horizon_days`, sampled every `step_days` per name (non-overlapping when step >= horizon)."""
    h, step = bt["horizon_days"], bt["step_days"]
    b = closes[bench]
    by_score: dict[int, list[float]] = {k: [] for k in range(5)}
    by_check: dict[str, dict[str, list[float]]] = {k: {"pass": [], "fail": []} for k in ("trend", "rs_3m", "rs_6m", "calm")}
    gate: dict[str, list[float]] = {"pass": [], "fail": []}
    every: list[float] = []
    start = max(bt["min_history_days"], cfg["trend_long_days"], cfg["rs_long_days"]) + 1
    for sym, c in closes.items():
        if sym == bench:
            continue
        for i in range(start, len(c) - h, step):
            st = setup_state(c, b, cfg, i)
            if st is None:
                continue
            fwd = pct(c[i], c[i + h]) - pct(b[i], b[i + h])
            every.append(fwd)
            by_score[st["passed"]].append(fwd)
            for k, ok in st["checks"].items():
                by_check[k]["pass" if ok else "fail"].append(fwd)
            gate_ok = st["passed"] >= 3 and not (cfg["veto_stretched"] and st["stretched"])
            gate["pass" if gate_ok else "fail"].append(fwd)
    return {
        "from": dates[start] if len(dates) > start else None, "to": dates[-1 - h] if len(dates) > h else None,
        "horizon_days": h, "step_days": step, "names": sum(1 for s in closes if s != bench),
        "all": _stats(every),
        "by_score": [{"passed": k, **_stats(v)} for k, v in by_score.items()],
        "by_check": [{"check": k, "pass": _stats(v["pass"]), "fail": _stats(v["fail"])} for k, v in by_check.items()],
        "gate": {"pass": _stats(gate["pass"]), "fail": _stats(gate["fail"])},
    }


# ------------------------------------------------------- context and risk

def risk_profile(c: list[float], b: list[float] | None, window: int = TRADING_DAYS) -> dict:
    """Downside numbers over the last `window` days (percent only)."""
    w = c[-(window + 1):]
    dd, pk, tr = max_drawdown(w)
    v = vol_ann(c, min(window, len(c) - 1))
    out = {"ret_1y_pct": round(pct(w[0], w[-1]), 3), "max_dd_1y_pct": round(dd, 3),
           "worst_20d_1y_pct": round(worst_window(w, 20), 3), "vol_1y_pct": round(v, 2),
           "loss_95_20d_pct": round(-1.645 * v * math.sqrt(20 / TRADING_DAYS), 2)}
    if b is not None:
        bw = b[-(window + 1):]
        rs = [w[k] / w[k - 1] - 1 for k in range(1, len(w))]
        rb = [bw[k] / bw[k - 1] - 1 for k in range(1, len(bw))]
        mb = sum(rb) / len(rb)
        ms = sum(rs) / len(rs)
        cov = sum((x - ms) * (y - mb) for x, y in zip(rs, rb)) / (len(rs) - 1)
        varb = sum((y - mb) ** 2 for y in rb) / (len(rb) - 1)
        vars_ = sum((x - ms) ** 2 for x in rs) / (len(rs) - 1)
        out["beta_1y"] = round(cov / varb, 2) if varb else None
        out["corr_1y"] = round(cov / math.sqrt(varb * vars_), 2) if varb and vars_ else None
        out["vs_bench_1y_pct"] = round(out["ret_1y_pct"] - pct(bw[0], bw[-1]), 3)
    return out


def equal_weight(closes: list[list[float]]) -> list[float]:
    """Daily-rebalanced equal-weight basket, indexed to 100."""
    out = [100.0]
    for k in range(1, len(closes[0])):
        out.append(out[-1] * (1 + sum(c[k] / c[k - 1] - 1 for c in closes) / len(closes)))
    return out


def cash_yield(c: list[float], n: int = 21) -> float | None:
    """Annualised trailing return of a T-bill ETF: a close proxy for the cash yield."""
    return ((c[-1] / c[-1 - n]) ** (TRADING_DAYS / n) - 1) * 100 if len(c) > n else None


def participation(cap: list[float], eq: list[float]) -> dict:
    """Equal-weight vs cap-weight: positive means the average member beat the giants."""
    r = {f"eq_vs_cap_{n}d_pct": round(ret(eq, n) - ret(cap, n), 3) for n in (20, 60)}
    a, b = r["eq_vs_cap_20d_pct"], r["eq_vs_cap_60d_pct"]
    r["state"] = "narrow" if a < -1 and b < -1 else "broad" if a > 1 and b > 1 else "mixed"
    return r


def trend_filter(c: list[float], cash: list[float] | None) -> dict:
    """Slow trend filter on a broad index (the 'shelf' finding): above its ~10-month average, and
    12-month return above cash. Context for the core, never a timing trigger."""
    s210 = sma(c, 210)
    r12 = ret(c, TRADING_DAYS)
    rc = ret(cash, TRADING_DAYS) if cash and len(cash) > TRADING_DAYS else None
    above = s210 is not None and c[-1] > s210
    beats = r12 is not None and rc is not None and r12 > rc
    return {"above_10m_avg": above, "dist_10m_avg_pct": round(pct(s210, c[-1]), 3) if s210 else None,
            "ret_12m_pct": round(r12, 3) if r12 is not None else None,
            "cash_12m_pct": round(rc, 3) if rc is not None else None,
            "on": bool(above and (beats or rc is None))}
