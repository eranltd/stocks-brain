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


def day_change(c: list[float]) -> float | None:
    """The last close's move from the close before it (%), or None with fewer than two closes."""
    return pct(c[-2], c[-1]) if len(c) >= 2 else None


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


# ------------------------------------------------------- technical checklist
# The eight-step checklist from a trading video the household liked (config/checklist.json, docs/methodology.md
# "Technical checklist"). Unproven for us: it is computed faithfully, shown and measured, never treated as an edge.
# Inputs are adjusted OHLCV lists aligned by index; every value at index i reads only indexes <= i (no look-ahead).
# Outputs are percentages, ratios, counts and labels; raw levels stay inside the function (provider licence).

DIRECTIONAL = ("candle", "trend", "volume", "ma20", "gaps", "levels", "rsi")  # step 8 (risk plan) is a plan, not a lean
STEPS = (*DIRECTIONAL, "risk_plan")
PARAMS = {  # every parameter the code reads, per step (lint checks config/checklist.json against this)
    "candle": ("doji_body_pct", "small_body_pct", "marubozu_body_pct", "shadow_ratio", "prior_days", "prior_weeks"),
    "trend": ("sma_fast", "sma_slow", "slope_days", "structure_days", "min_points"),
    "volume": ("avg_days", "trend_days", "flat_move_pct", "confirm_ratio", "fade_pct"),
    "ma20": ("days", "slope_days"),
    "gaps": ("lookback_days", "min_gap_pct", "lean_max_dist_pct", "toward_days", "max_listed"),
    "levels": ("lookback_days", "pivot_window", "cluster_pct", "lean_ratio"),
    "rsi": ("period", "overbought", "oversold"),
    "risk_plan": ("atr_days", "stop_atr_max", "stop_atr_min", "below_support_atr", "risk_multiple"),
}
VERDICTS = ("lean_up", "mixed", "lean_down")
INF = float("inf")


def sma_series(x: list[float], n: int) -> list[float | None]:
    """Simple n-period average at every index (None until n values exist)."""
    out: list[float | None] = [None] * len(x)
    s = 0.0
    for k, v in enumerate(x):
        s += v
        if k >= n:
            s -= x[k - n]
        if k >= n - 1:
            out[k] = s / n
    return out


def rsi_series(c: list[float], n: int = 14) -> list[float | None]:
    """Wilder's RSI: the first average gain and loss are plain means of the first n changes, then each new change
    is blended in with weight 1/n. 100 when there were no losses in the window, 0 when there were no gains."""
    out: list[float | None] = [None] * len(c)
    if len(c) <= n:
        return out
    ch = [c[k] - c[k - 1] for k in range(1, len(c))]
    gain = sum(max(x, 0.0) for x in ch[:n]) / n
    loss = sum(max(-x, 0.0) for x in ch[:n]) / n

    def val(g: float, lo: float) -> float:
        if lo == 0:
            return 100.0 if g > 0 else 50.0
        return 100 - 100 / (1 + g / lo)
    out[n] = val(gain, loss)
    for k in range(n + 1, len(c)):
        x = ch[k - 1]
        gain = (gain * (n - 1) + max(x, 0.0)) / n
        loss = (loss * (n - 1) + max(-x, 0.0)) / n
        out[k] = val(gain, loss)
    return out


def atr_series(h: list[float], lo: list[float], c: list[float], n: int = 14) -> list[float | None]:
    """Wilder's average true range. True range = the larger of high - low, |high - previous close| and
    |low - previous close| (the first bar has no previous close: high - low)."""
    tr = [h[0] - lo[0]] + [max(h[k] - lo[k], abs(h[k] - c[k - 1]), abs(lo[k] - c[k - 1])) for k in range(1, len(c))]
    out: list[float | None] = [None] * len(c)
    if len(c) < n:
        return out
    a = sum(tr[:n]) / n
    out[n - 1] = a
    for k in range(n, len(c)):
        a = (a * (n - 1) + tr[k]) / n
        out[k] = a
    return out


def pivot_flags(h: list[float], lo: list[float], w: int) -> tuple[list[bool], list[bool]]:
    """Swing pivots: a high above each of the w highs before it and at least as high as the w after it (a low the
    mirror), so a flat stretch or a double bar counts once. A pivot at k is only known at k + w, so callers at index i
    use pivots with k <= i - w."""
    n = len(h)
    hi = [False] * n
    low = [False] * n
    for k in range(w, n - w):
        hk, lk = h[k], lo[k]
        hi[k] = all(h[j] < hk for j in range(k - w, k)) and all(h[j] <= hk for j in range(k + 1, k + w + 1))
        low[k] = all(lo[j] > lk for j in range(k - w, k)) and all(lo[j] >= lk for j in range(k + 1, k + w + 1))
    return hi, low


def classify_candle(cur: tuple, prev: tuple | None, prior_move: float | None, p: dict, unit: str = "day") -> dict:
    """One candle (open, high, low, close) against the one before it. Patterns in order: engulfing, doji, hammer or
    hanging man (long lower shadow; which one depends on the move into it), shooting star or inverted hammer (long
    upper shadow), marubozu (almost all body), spinning top (small body), else a plain up or down candle."""
    o, h, lo, c = cur
    rng = h - lo
    body = abs(c - o)
    body_pct = body / rng * 100 if rng > 0 else 0.0
    pos = (c - lo) / rng * 100 if rng > 0 else 50.0
    upper, lower = h - max(o, c), min(o, c) - lo
    after_rise = prior_move is not None and prior_move > 0
    after_fall = prior_move is not None and prior_move < 0
    pattern = lean = None
    if prev is not None:
        po, _, _, pc = prev
        if c > o and pc < po and o <= pc and c >= po and body > abs(pc - po):
            pattern, lean = "bullish engulfing", "bullish"
        elif c < o and pc > po and o >= pc and c <= po and body > abs(pc - po):
            pattern, lean = "bearish engulfing", "bearish"
    r = p["shadow_ratio"]
    if pattern is None:
        if body_pct <= p["doji_body_pct"]:
            pattern, lean = "doji", "neutral"
        elif lower >= r * body and upper <= body and (after_fall or after_rise):
            pattern, lean = ("hammer", "bullish") if after_fall else ("hanging man", "bearish")
        elif upper >= r * body and lower <= body and (after_fall or after_rise):
            pattern, lean = ("shooting star", "bearish") if after_rise else ("inverted hammer", "bullish")
        elif body_pct >= p["marubozu_body_pct"]:
            pattern, lean = ("bullish marubozu", "bullish") if c > o else ("bearish marubozu", "bearish")
        elif body_pct < p["small_body_pct"]:
            pattern, lean = "spinning top", "neutral"
        else:
            pattern, lean = (f"up {unit}", "bullish") if c > o else (f"down {unit}", "bearish")
    return {"lean": lean, "pattern": pattern, "body_pct": round(body_pct, 1), "close_in_range_pct": round(pos, 1)}


def _combine(a: str, b: str) -> str:
    """Two leans into one: agreement wins, a neutral defers to the other, a conflict is neutral."""
    if a == b or b == "neutral":
        return a
    return b if a == "neutral" else "neutral"


def prep_checklist(B: dict, P: dict) -> dict:
    """Series the checklist reads at every index, computed once per symbol (each value uses data up to its index).
    B = {dates, o, h, l, c, v}; P = the steps' params from config/checklist.json."""
    from datetime import date as _d
    c = B["c"]
    hi, low = pivot_flags(B["h"], B["l"], P["levels"]["pivot_window"])
    return {"sma20": sma_series(c, P["ma20"]["days"]), "sma50": sma_series(c, P["trend"]["sma_fast"]),
            "sma200": sma_series(c, P["trend"]["sma_slow"]), "rsi": rsi_series(c, P["rsi"]["period"]),
            "atr": atr_series(B["h"], B["l"], c, P["risk_plan"]["atr_days"]), "piv_hi": hi, "piv_lo": low,
            "week": [_d.fromisoformat(d).isocalendar()[:2] for d in B["dates"]],
            "friday": [_d.fromisoformat(d).weekday() >= 4 for d in B["dates"]]}


def checklist_warmup(P: dict) -> int:
    """Bars needed before the first index the checklist can be computed at."""
    t = P["trend"]
    return max(t["sma_slow"] + t["slope_days"], t["structure_days"], P["levels"]["lookback_days"],
               P["gaps"]["lookback_days"] + P["gaps"]["toward_days"], P["volume"]["avg_days"] + 1, 2 * P["volume"]["trend_days"],
               P["rsi"]["period"] + 1, P["risk_plan"]["atr_days"], P["ma20"]["days"] + P["ma20"]["slope_days"],
               P["candle"]["prior_days"] + 2) + 1


def _weeks(B: dict, pre: dict, i: int, need: int) -> list[tuple]:
    """The last `need` weekly candles (open, high, low, close) up to index i; the last one is the week so far."""
    out: list[list] = []
    k = i
    while k >= 0 and len(out) < need:
        wk, j = pre["week"][k], k
        while j - 1 >= 0 and pre["week"][j - 1] == wk:
            j -= 1
        out.append([B["o"][j], max(B["h"][j:k + 1]), min(B["l"][j:k + 1]), B["c"][k]])
        k = j - 1
    return [tuple(x) for x in reversed(out)]


def _cluster(levels: list[tuple[float, int]], tol_pct: float) -> list[dict]:
    """Group pivot levels within tol_pct of a cluster's lowest member: each zone's level is the mean of its members,
    touches the number of pivots in it, last the newest pivot's index."""
    out: list[dict] = []
    for v, k in sorted(levels):
        if out and v <= out[-1]["base"] * (1 + tol_pct / 100):
            z = out[-1]
            z["sum"] += v
            z["touches"] += 1
            z["last"] = max(z["last"], k)
        else:
            out.append({"base": v, "sum": v, "touches": 1, "last": k})
    return [{"level": z["sum"] / z["touches"], "touches": z["touches"], "last": z["last"]} for z in out]


def open_gaps(h: list[float], lo: list[float], x: float, i: int, pg: dict) -> list[dict]:
    """Open gaps of the last `lookback_days` bars up to i, nearest first. A gap up (low above the previous high) sits
    below the price and later lows fill it from the top; a gap down (high below the previous low) sits above the price
    and later highs fill it from the bottom. dist_pct is from the close x to the unfilled edge nearest to it; the internal
    _far_pct to the gap's other edge (the candles chart draws the unfilled band between the two)."""
    gaps = []
    run_lo, run_hi = INF, -INF  # lowest low and highest high after bar k, up to i
    for k in range(i, max(1, i - pg["lookback_days"] + 1) - 1, -1):
        if lo[k] > h[k - 1] and pct(h[k - 1], lo[k]) >= pg["min_gap_pct"] and run_lo > h[k - 1]:
            gaps.append({"where": "below", "size_pct": round(pct(h[k - 1], lo[k]), 2),
                         "dist_pct": round(pct(x, min(lo[k], run_lo)), 2), "days_open": i - k, "_k": k,
                         "_far_pct": round(pct(x, h[k - 1]), 2)})
        elif h[k] < lo[k - 1] and pct(h[k], lo[k - 1]) >= pg["min_gap_pct"] and run_hi < lo[k - 1]:
            gaps.append({"where": "above", "size_pct": round(pct(h[k], lo[k - 1]), 2),
                         "dist_pct": round(pct(x, max(h[k], run_hi)), 2), "days_open": i - k, "_k": k,
                         "_far_pct": round(pct(x, lo[k - 1]), 2)})
        run_lo, run_hi = min(run_lo, lo[k]), max(run_hi, h[k])
    gaps.sort(key=lambda g: abs(g["dist_pct"]))
    return gaps


def sr_zones(h: list[float], lo: list[float], x: float, i: int, pre: dict, pl: dict) -> tuple[list[dict], list[dict]]:
    """(support zones below x nearest first, resistance zones above x nearest first) from the confirmed swing pivots of
    the last `lookback_days` bars up to i."""
    w = pl["pivot_window"]
    first = max(0, i - pl["lookback_days"] + 1)
    piv = [(h[k], k) for k in range(first, i - w + 1) if pre["piv_hi"][k]]
    piv += [(lo[k], k) for k in range(first, i - w + 1) if pre["piv_lo"][k]]
    zones = _cluster(piv, pl["cluster_pct"])
    return (sorted((z for z in zones if z["level"] < x), key=lambda z: -z["level"]),
            sorted((z for z in zones if z["level"] > x), key=lambda z: z["level"]))


def checklist_at(B: dict, pre: dict, i: int, P: dict, house: dict) -> dict:
    """All eight steps at index i. Public fields are percentages, ratios, counts and labels; fields starting with
    '_' hold raw levels for the day-over-day comparison and are dropped before anything is written."""
    o, h, lo, c, v = B["o"], B["h"], B["l"], B["c"], B["v"]
    x = c[i]
    out: dict = {}

    # 1. candle: the last daily and weekly candles
    pc = P["candle"]
    pd, pw = pc["prior_days"], pc["prior_weeks"]
    daily = classify_candle((o[i], h[i], lo[i], c[i]), (o[i - 1], h[i - 1], lo[i - 1], c[i - 1]),
                            pct(c[i - 1 - pd], c[i - 1]) if i - 1 - pd >= 0 else None, pc, "day")
    wk = _weeks(B, pre, i, pw + 2)
    weekly = classify_candle(wk[-1], wk[-2] if len(wk) > 1 else None,
                             pct(wk[-2 - pw][3], wk[-2][3]) if len(wk) >= pw + 2 else None, pc, "week")
    weekly["partial"] = not pre["friday"][i]
    out["candle"] = {"lean": _combine(daily["lean"], weekly["lean"]), "daily": daily, "weekly": weekly}

    # 2. trend: averages, the slope of the 50-day and the swing structure over about three months
    pt = P["trend"]
    s50, s200, s50_then = pre["sma50"][i], pre["sma200"][i], pre["sma50"][i - pt["slope_days"]]
    slope = pct(s50_then, s50)
    seg = pt["structure_days"] // 3
    hs = [max(h[i - (3 - q) * seg + 1:i - (2 - q) * seg + 1]) for q in range(3)]
    ls = [min(lo[i - (3 - q) * seg + 1:i - (2 - q) * seg + 1]) for q in range(3)]
    structure = ("higher highs and higher lows" if hs[0] < hs[1] < hs[2] and ls[0] < ls[1] < ls[2]
                 else "lower highs and lower lows" if hs[0] > hs[1] > hs[2] and ls[0] > ls[1] > ls[2] else "mixed")
    points = ((1 if x > s50 else -1) + (1 if s50 > s200 else -1) + (1 if slope > 0 else -1 if slope < 0 else 0)
              + (1 if structure.startswith("higher") else -1 if structure.startswith("lower") else 0))
    direction = "up" if points >= pt["min_points"] else "down" if points <= -pt["min_points"] else "sideways"
    out["trend"] = {"direction": direction, "lean": {"up": "bullish", "down": "bearish"}.get(direction, "neutral"),
                    "points": points, "above_sma50": x > s50, "dist_sma50_pct": round(pct(s50, x), 2),
                    "sma50_above_sma200": s50 > s200, "dist_sma200_pct": round(pct(s200, x), 2),
                    "slope50_pct": round(slope, 2), "structure": structure}

    # 3. volume: does it back the move?
    pv = P["volume"]
    n, t = pv["avg_days"], pv["trend_days"]
    avg = sum(v[i - n:i]) / n
    up_v = sum(v[k] for k in range(i - n + 1, i + 1) if c[k] > c[k - 1])
    dn_v = sum(v[k] for k in range(i - n + 1, i + 1) if c[k] < c[k - 1])
    ud = min(up_v / dn_v, 10.0) if dn_v > 0 else (10.0 if up_v > 0 else 1.0)
    prior = sum(v[i - 2 * t + 1:i - t + 1])
    vtrend = pct(prior, sum(v[i - t + 1:i + 1])) if prior > 0 else 0.0
    move = pct(c[i - t], x)
    moving = "rising" if move > pv["flat_move_pct"] else "falling" if move < -pv["flat_move_pct"] else "flat"
    fading = vtrend <= -pv["fade_pct"]
    verdict, vlean = "neutral", "neutral"
    if moving == "rising":
        if ud < 1 or fading:
            verdict, vlean = "weakening", "bearish"
        elif ud >= pv["confirm_ratio"]:
            verdict, vlean = "confirms", "bullish"
    elif moving == "falling":
        if ud > 1 or fading:
            verdict = "weakening"  # selling may be drying up; we do not call bottoms, so no lean
        elif ud <= 1 / pv["confirm_ratio"]:
            verdict, vlean = "confirms", "bearish"
    out["volume"] = {"verdict": verdict, "lean": vlean, "move": moving, "move_pct": round(move, 2),
                     "vs_avg20": round(v[i] / avg, 2) if avg > 0 else None, "up_down_ratio_20d": round(ud, 2),
                     "trend_pct": round(vtrend, 1), "rising_on_falling_volume": moving == "rising" and fading}

    # 4. the 20-day average
    pm = P["ma20"]
    s20, s20_then = pre["sma20"][i], pre["sma20"][i - pm["slope_days"]]
    slope20 = pct(s20_then, s20)
    side = "above" if x > s20 else "below"
    out["ma20"] = {"side": side, "dist_pct": round(pct(s20, x), 2), "slope_pct": round(slope20, 2),
                   "lean": "bullish" if side == "above" and slope20 > 0 else "bearish" if side == "below" and slope20 < 0 else "neutral"}

    # 5. gaps: open (unfilled) gaps in the lookback, shrunk by any later partial fill
    pg = P["gaps"]
    gaps = open_gaps(h, lo, x, i, pg)
    near = gaps[0] if gaps else None
    toward = None
    if near:
        r5 = pct(c[i - pg["toward_days"]], x)
        toward = r5 > 0 if near["where"] == "above" else r5 < 0
    glean = "neutral"
    if near and abs(near["dist_pct"]) <= pg["lean_max_dist_pct"]:
        glean = "bullish" if near["where"] == "above" else "bearish"
    out["gaps"] = {"verdict": f"gap_{near['where']}" if near else "none", "lean": glean,
                   "above": sum(g["where"] == "above" for g in gaps), "below": sum(g["where"] == "below" for g in gaps),
                   "nearest": ({k2: v2 for k2, v2 in near.items() if not k2.startswith("_")} | {"moving_toward": toward}) if near else None,
                   "unfilled": [{k2: v2 for k2, v2 in g.items() if not k2.startswith("_")} for g in gaps[:pg["max_listed"]]],
                   "_ks": {(g["where"], g["_k"]) for g in gaps}, "_listed": gaps[:pg["max_listed"]]}

    # 6. support and resistance from swing pivots over about a year
    pl = P["levels"]
    sup, res = sr_zones(h, lo, x, i, pre, pl)

    def lv(z: dict) -> dict:
        return {"dist_pct": round(pct(x, z["level"]), 2), "touches": z["touches"], "days_ago": i - z["last"]}
    s_d = -pct(x, sup[0]["level"]) if sup else None
    r_d = pct(x, res[0]["level"]) if res else None
    if s_d is None and r_d is None:
        llean = "neutral"
    elif r_d is None:
        llean = "bullish"  # nothing overhead in the lookback: price is above every level of the past year
    elif s_d is None:
        llean = "bearish"  # below every level of the past year
    else:
        llean = "bullish" if r_d >= pl["lean_ratio"] * s_d else "bearish" if s_d >= pl["lean_ratio"] * r_d else "neutral"
    out["levels"] = {"lean": llean, "support": [lv(z) for z in sup[:2]], "resistance": [lv(z) for z in res[:2]],
                     "_sup": [z["level"] for z in sup[:2]], "_res": [z["level"] for z in res[:2]]}

    # 7. RSI
    pr = P["rsi"]
    r = pre["rsi"][i]
    zone = "overbought" if r >= pr["overbought"] else "oversold" if r <= pr["oversold"] else "neutral"
    out["rsi"] = {"value": round(r, 1), "zone": zone,
                  "lean": {"overbought": "bearish", "oversold": "bullish"}.get(zone, "neutral")}

    # 8. risk plan for a long entry at this close: stop, two targets, reward-to-risk
    pk = P["risk_plan"]
    a = pre["atr"][i]
    atr_stop = pk["stop_atr_max"] * a
    stop, basis = atr_stop, "atr"
    if sup:
        below_support = x - (sup[0]["level"] - pk["below_support_atr"] * a)
        if below_support < atr_stop:
            stop, basis = below_support, "support"
    if stop < pk["stop_atr_min"] * a:
        stop, basis = pk["stop_atr_min"] * a, "min_atr"
    stop_pct = stop / x * 100
    if res:
        tp1, tp1_basis = pct(x, res[0]["level"]), "resistance"
    else:
        tp1, tp1_basis = pk["risk_multiple"] * stop_pct, "risk_multiple"
    if len(res) > 1:
        tp2, tp2_basis = pct(x, res[1]["level"]), "resistance"
    else:
        tp2, tp2_basis = max(pk["risk_multiple"] * stop_pct, tp1 + stop_pct), "risk_multiple"
    rr1, rr2 = tp1 / stop_pct, tp2 / stop_pct
    out["risk_plan"] = {"atr_pct": round(a / x * 100, 2), "stop_pct": round(stop_pct, 2), "stop_basis": basis,
                        "tp1_pct": round(tp1, 2), "tp1_basis": tp1_basis, "tp2_pct": round(tp2, 2), "tp2_basis": tp2_basis,
                        "rr_tp1": round(rr1, 2), "rr_tp2": round(rr2, 2),
                        "fits_house_rule": rr1 >= house["min_reward_to_risk"]}

    # score: seven directional checks
    leans = {k: out[k]["lean"] for k in DIRECTIONAL}
    bull = sum(x2 == "bullish" for x2 in leans.values())
    bear = sum(x2 == "bearish" for x2 in leans.values())
    net = bull - bear
    thr = house["lean_threshold"]
    verdict = "lean_up" if net >= thr else "lean_down" if net <= -thr else "mixed"
    out["score"] = {"bullish": bull, "bearish": bear, "neutral": len(leans) - bull - bear, "net": net,
                    "verdict": verdict, "leans": leans}
    out["score"]["summary"] = checklist_summary(out)
    out["_close"] = x
    return out


PHRASE = {  # plain words, no digits, for the one-line summary
    ("candle", "bullish"): "bullish candles", ("candle", "bearish"): "bearish candles",
    ("trend", "bullish"): "an uptrend", ("trend", "bearish"): "a downtrend",
    ("volume", "bullish"): "volume backs the rise", ("volume", "bearish"): "volume does not back the move",
    ("ma20", "bullish"): "above a rising twenty-day average", ("ma20", "bearish"): "below a falling twenty-day average",
    ("gaps", "bullish"): "an open gap above", ("gaps", "bearish"): "an open gap below",
    ("levels", "bullish"): "room up to resistance", ("levels", "bearish"): "pressed under resistance",
    ("rsi", "bullish"): "RSI oversold", ("rsi", "bearish"): "RSI overbought",
}


def checklist_summary(cl: dict) -> str:
    s = cl["score"]
    head = {"lean_up": "Leans up", "lean_down": "Leans down", "mixed": "Mixed"}[s["verdict"]]
    lead, other = ("bullish", "bearish") if s["verdict"] != "lean_down" else ("bearish", "bullish")
    pro = [PHRASE[(k, lead)] for k in DIRECTIONAL if s["leans"][k] == lead][:3]
    con = [PHRASE[(k, other)] for k in DIRECTIONAL if s["leans"][k] == other][:2]
    text = head + (f": {', '.join(pro)}" if pro else "") + (f"; against it, {', '.join(con)}" if con else "") + "."
    rp = cl["risk_plan"]
    text += " Reward-to-risk fits the house rule." if rp["fits_house_rule"] else " Reward-to-risk is below the house rule."
    return text


def checklist_changes(prev: dict, cur: dict) -> list[dict]:
    """What flipped from one trading day to the next, in plain words, each with the lean it points to."""
    out: list[dict] = []

    def add(check: str, text: str, tone: str) -> None:
        out.append({"check": check, "text": text, "tone": tone})
    names = {"lean_up": "lean up", "mixed": "mixed", "lean_down": "lean down"}
    pv, cv = prev["score"]["verdict"], cur["score"]["verdict"]
    if pv != cv:
        tone = "bullish" if VERDICTS.index(cv) < VERDICTS.index(pv) else "bearish"
        add("score", f"Verdict moved from {names[pv]} to {names[cv]}", tone)
    pz, cz = prev["rsi"]["zone"], cur["rsi"]["zone"]
    if pz != cz:
        if cz != "neutral":
            add("rsi", f"RSI moved into {cz}", "bearish" if cz == "overbought" else "bullish")
        else:
            add("rsi", f"RSI left {pz}", "neutral")
    if prev["ma20"]["side"] != cur["ma20"]["side"]:
        up = cur["ma20"]["side"] == "above"
        add("ma20", f"Closed {'above' if up else 'below'} the twenty-day average", "bullish" if up else "bearish")
    pt, ct = prev["trend"]["direction"], cur["trend"]["direction"]
    if pt != ct:
        add("trend", f"Trend changed from {pt} to {ct}", {"up": "bullish", "down": "bearish"}.get(ct, "neutral"))
    if cur["volume"]["rising_on_falling_volume"] and not prev["volume"]["rising_on_falling_volume"]:
        add("volume", "Price rising on falling volume", "bearish")
    elif prev["volume"]["verdict"] != cur["volume"]["verdict"] and cur["volume"]["verdict"] != "neutral":
        add("volume", f"Volume now {'confirms the move' if cur['volume']['verdict'] == 'confirms' else 'shows the move weakening'}",
            cur["volume"]["lean"])
    pk, ck = prev["gaps"]["_ks"], cur["gaps"]["_ks"]
    for where, _ in sorted(pk - ck):
        add("gaps", f"Gap {where} filled", "neutral")
    for where, _ in sorted(ck - pk):
        add("gaps", "Gapped up, leaving an open gap below" if where == "below" else "Gapped down, leaving an open gap above",
            "bullish" if where == "below" else "bearish")
    x = cur["_close"]
    if prev["levels"]["_res"] and x > prev["levels"]["_res"][0]:
        add("levels", "Closed above a resistance level", "bullish")
    if prev["levels"]["_sup"] and x < prev["levels"]["_sup"][0]:
        add("levels", "Closed below a support level", "bearish")
    dp = cur["candle"]["daily"]["pattern"]
    if dp in ("bullish engulfing", "bearish engulfing", "hammer", "hanging man", "shooting star", "inverted hammer"):
        add("candle", f"Daily candle: {dp}", cur["candle"]["daily"]["lean"])
    pf, cf = prev["risk_plan"]["fits_house_rule"], cur["risk_plan"]["fits_house_rule"]
    if pf != cf:
        add("risk_plan", "Now fits the reward-to-risk rule" if cf else "No longer fits the reward-to-risk rule", "neutral")
    return out


def public(node):
    """Drop internal fields (names starting with '_') before anything is written."""
    if isinstance(node, dict):
        return {k: public(v) for k, v in node.items() if not k.startswith("_")}
    if isinstance(node, list):
        return [public(v) for v in node]
    return node


def score_bucket(net: int) -> str:
    for lo_, hi_ in ((-7, -5), (-4, -3), (-2, -1), (0, 0), (1, 2), (3, 4), (5, 7)):
        if lo_ <= net <= hi_:
            return f"{lo_}..{hi_}"
    raise ValueError(net)


SCORE_BUCKETS = ["-7..-5", "-4..-3", "-2..-1", "0..0", "1..2", "3..4", "5..7"]


def checklist_base_rates(series: dict, bench: str, P: dict, house: dict, br: dict, preps: dict | None = None) -> dict:
    """History of the checklist: every `step_days` trading days from `from` (on or after the warm-up), each name's
    checklist with data up to that close and its excess return over the benchmark `horizon_days` later. series =
    {symbol: B}, every list ending on the same date (a name's index k and the benchmark's index k + offset share a date,
    offset = the difference in lengths). In-sample, on today's list of survivors."""
    h, step = br["horizon_days"], br["step_days"]
    b = series[bench]["c"]
    bd = series[bench]["dates"]
    nb = len(b)
    warm = checklist_warmup(P)
    by_v: dict[str, list[float]] = {k: [] for k in VERDICTS}
    by_s: dict[str, list[float]] = {k: [] for k in SCORE_BUCKETS}
    by_c = {k: {"bullish": [], "bearish": [], "neutral": []} for k in DIRECTIONAL}
    rule = {"fits": [], "fails": []}
    every: list[float] = []
    first = last = None
    names = 0
    start_b = next((k for k, d in enumerate(bd) if d >= br["from"]), nb)
    for sym, B in series.items():
        if sym == bench:
            continue
        c = B["c"]
        off = nb - len(c)  # benchmark index = name index + off
        pre = (preps or {}).get(sym) or prep_checklist(B, P)
        begin = max(warm, start_b - off)
        used = False
        for i in range(begin, len(c) - h, step):
            cl = checklist_at(B, pre, i, P, house)
            fwd = pct(c[i], c[i + h]) - pct(b[i + off], b[i + off + h])
            every.append(fwd)
            by_v[cl["score"]["verdict"]].append(fwd)
            by_s[score_bucket(cl["score"]["net"])].append(fwd)
            for k, ln in cl["score"]["leans"].items():
                by_c[k][ln].append(fwd)
            rule["fits" if cl["risk_plan"]["fits_house_rule"] else "fails"].append(fwd)
            d = B["dates"][i]
            first = d if first is None or d < first else first
            last = d if last is None or d > last else last
            used = True
        names += used
    return {"from": first, "to": last, "horizon_days": h, "step_days": step, "names": names, "all": _stats(every),
            "by_verdict": [{"verdict": k, **_stats(v)} for k, v in by_v.items()],
            "by_score": [{"net": k, **_stats(v)} for k, v in by_s.items()],
            "by_check": [{"check": k, **{ln: _stats(xs) for ln, xs in v.items()}} for k, v in by_c.items()],
            "house_rule": {k: _stats(v) for k, v in rule.items()}}


# --------------------------------------------------------------- indexed candles (the Stock page's chart)
# The same bars the checklist reads, published INDEXED: every open, high, low and close as percent from the last close
# (so the last close is 0), volume only as a ratio to its own average. Derived numbers only (provider licence).

CANDLES_BASIS = "percent from the last close"
CANDLE_DAYS, CANDLE_WEEKS = 130, 60  # about six months of days and fourteen months of weeks
CANDLE_PCT_RANGE = (-95.0, 500.0)  # an indexed candle outside this range is refused (lint and the routine)
CANDLE_VOL_REL_MAX = 100.0  # a volume ratio above this is refused: raw volume (thousands and up) must never slip through


def weekly_bars(B: dict, pre: dict) -> dict:
    """Weekly candles from daily bars: consecutive days of the same ISO week (Monday to Friday) form one week whose open is
    its first open, high and low the extremes, close its last close, date its last trading day and vday its mean daily
    volume (a holiday week or the week so far are not penalised for having fewer days). The same grouping as the
    checklist's weekly candle (_weeks)."""
    out: dict = {k: [] for k in ("dates", "o", "h", "l", "c", "vday")}
    n = len(B["c"])
    j = 0
    while j < n:
        k = j
        while k + 1 < n and pre["week"][k + 1] == pre["week"][j]:
            k += 1
        out["dates"].append(B["dates"][k])
        out["o"].append(B["o"][j])
        out["h"].append(max(B["h"][j:k + 1]))
        out["l"].append(min(B["l"][j:k + 1]))
        out["c"].append(B["c"][k])
        out["vday"].append(sum(B["v"][j:k + 1]) / (k + 1 - j))
        j = k + 1
    return out


def vol_rel_series(v: list[float], n: int) -> list[float | None]:
    """Each value over the mean of the n values before it (the checklist's vs_avg20); None in the warm-up or on a zero
    average."""
    out: list[float | None] = [None] * len(v)
    for k in range(n, len(v)):
        avg = sum(v[k - n:k]) / n
        out[k] = v[k] / avg if avg > 0 else None
    return out


def _indexed(x: float, S: dict, ma: list, rsi: list, vrel: list, last: int) -> dict:
    """The last `last` bars of S re-based to the close x: o/h/l/c and the average as percent from x (two decimals), RSI to
    one decimal (as the checklist), the volume ratio to two. High and low are widened to cover the open and close, so a
    provider rounding slip cannot draw a body outside its wick."""
    def p(val: float) -> float:
        return round(pct(x, val), 2) + 0.0  # + 0.0 turns -0.0 into 0.0
    sl = slice(max(0, len(S["c"]) - last), len(S["c"]))
    o, h, lo, c = S["o"][sl], S["h"][sl], S["l"][sl], S["c"][sl]
    return {"dates": S["dates"][sl], "o": [p(a) for a in o],
            "h": [p(max(a, b, d)) for a, b, d in zip(h, o, c)], "l": [p(min(a, b, d)) for a, b, d in zip(lo, o, c)],
            "c": [p(a) for a in c], "vol_rel": [None if r is None else round(r, 2) for r in vrel[sl]],
            "ma20": [None if m is None else p(m) for m in ma[sl]], "rsi": [None if r is None else round(r, 1) for r in rsi[sl]]}


def candle_overlays(cl: dict, dates: list[str]) -> dict:
    """The chart's lines and bands, taken from the checklist at the last close (checklist_at's output with its internal
    fields), so they are the very numbers the checklist card shows: support and resistance zones, open gaps as bands
    (from_pct the lower edge, to_pct the upper; the edge nearest the close is the checklist's dist_pct), the stop and the
    two targets (as the checklist: positive distances, the stop below the close and the targets above), reward-to-risk to
    TP1 and the house rule. `dates` are the bars the checklist ran on (a gap's since_date is the day that opened it)."""
    rp = cl["risk_plan"]
    return {"support": [{"pct": z["dist_pct"], "touches": z["touches"]} for z in cl["levels"]["support"]],
            "resistance": [{"pct": z["dist_pct"], "touches": z["touches"]} for z in cl["levels"]["resistance"]],
            "gaps": [{"from_pct": min(g["dist_pct"], g["_far_pct"]), "to_pct": max(g["dist_pct"], g["_far_pct"]),
                      "where": g["where"], "since_date": dates[g["_k"]]} for g in cl["gaps"]["_listed"]],
            "stop_pct": rp["stop_pct"], "tp1_pct": rp["tp1_pct"], "tp2_pct": rp["tp2_pct"], "rr_tp1": rp["rr_tp1"],
            "fits_house_rule": rp["fits_house_rule"]}


def candles(B: dict, pre: dict, P: dict, cl: dict, days: int = CANDLE_DAYS, weeks: int = CANDLE_WEEKS) -> dict:
    """Daily and weekly candles indexed to the last close, with the 20-period average, RSI and the volume ratio, and the
    checklist's overlays. B and pre are the checklist's own bars and series (prep_checklist) for the symbol and cl its
    reading at the last bar (checklist_at). Every value at a bar reads only bars up to it; the re-basing to the last close
    is the one thing that uses the whole window, by design. The last week is `partial` until a Friday close, as in the
    checklist."""
    x = B["c"][-1]
    n_ma, n_rsi, n_vol = P["ma20"]["days"], P["rsi"]["period"], P["volume"]["avg_days"]
    W = weekly_bars(B, pre)
    weekly = _indexed(x, W, sma_series(W["c"], n_ma), rsi_series(W["c"], n_rsi), vol_rel_series(W["vday"], n_vol), weeks)
    weekly["partial"] = not pre["friday"][-1]
    return {"daily": _indexed(x, B, pre["sma20"], pre["rsi"], vol_rel_series(B["v"], n_vol), days),
            "weekly": weekly, "overlays": candle_overlays(cl, B["dates"])}


def candle_problems(doc: dict) -> list[str]:
    """What would make a candles file unsafe or unreadable: arrays of unequal length, dates out of order, a last close
    that is not 0, a candle whose high and low do not hold its body, a number outside CANDLE_PCT_RANGE (a raw price
    slipping through), a volume ratio outside 0..CANDLE_VOL_REL_MAX (raw volume) or an RSI outside 0..100. The messages
    name the bar, never the value."""
    out: list[str] = []
    lo_ok, hi_ok = CANDLE_PCT_RANGE
    for part in ("daily", "weekly"):
        S = doc.get(part)
        if not isinstance(S, dict) or not isinstance(S.get("dates"), list) or not S["dates"]:
            out.append(f"{part}: missing or empty")
            continue
        n = len(S["dates"])
        keys = ("o", "h", "l", "c", "vol_rel", "ma20", "rsi")
        bad = [k for k in keys if not isinstance(S.get(k), list) or len(S[k]) != n]
        if bad:
            out.append(f"{part}: {', '.join(bad)} not the same length as dates")
            continue
        if S["dates"] != sorted(set(S["dates"])):
            out.append(f"{part}: dates must be strictly ascending")
        if S["c"][-1] != 0:
            out.append(f"{part}: the last close must be 0 (every value is percent from the last close)")
        for k in range(n):
            o, h, lo, c = (S[q][k] for q in "ohlc")
            if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (o, h, lo, c)):
                out.append(f"{part}[{k}]: o/h/l/c must be numbers")
                break
            if not h >= max(o, c) >= min(o, c) >= lo:
                out.append(f"{part}[{k}] {S['dates'][k]}: high and low must hold the open and close")
                break
            if not all(lo_ok <= v <= hi_ok for v in (o, h, lo, c)) or (S["ma20"][k] is not None and not lo_ok <= S["ma20"][k] <= hi_ok):
                out.append(f"{part}[{k}] {S['dates'][k]}: outside {lo_ok:g}..{hi_ok:g}% of the last close (a raw price?)")
                break
            if S["vol_rel"][k] is not None and not 0 <= S["vol_rel"][k] <= CANDLE_VOL_REL_MAX:
                out.append(f"{part}[{k}] {S['dates'][k]}: volume ratio outside 0..{CANDLE_VOL_REL_MAX:g} (raw volume?)")
                break
            if S["rsi"][k] is not None and not 0 <= S["rsi"][k] <= 100:
                out.append(f"{part}[{k}] {S['dates'][k]}: RSI outside 0..100")
                break
        if S["dates"][-1] != doc.get("as_of"):
            out.append(f"{part}: the last date must be as_of")
    return out


def overlays_from_row(row: dict) -> dict:
    """The overlays a candles file must carry for a published checklist row (its public numbers only), to check one file
    against the other. Gap bands are matched by their edge nearest the close (the checklist's dist_pct)."""
    rp = row["risk_plan"]
    return {"support": [{"pct": z["dist_pct"], "touches": z["touches"]} for z in row["levels"]["support"]],
            "resistance": [{"pct": z["dist_pct"], "touches": z["touches"]} for z in row["levels"]["resistance"]],
            "gaps": [(g["where"], g["dist_pct"]) for g in row["gaps"]["unfilled"]],
            "stop_pct": rp["stop_pct"], "tp1_pct": rp["tp1_pct"], "tp2_pct": rp["tp2_pct"], "rr_tp1": rp["rr_tp1"],
            "fits_house_rule": rp["fits_house_rule"]}


def overlay_mismatch(ov: dict, row: dict) -> list[str]:
    """Where a candles file's overlays differ from the checklist row of the same symbol and day."""
    want = overlays_from_row(row)
    got = {**ov, "gaps": [(g["where"], g["to_pct"] if g["where"] == "below" else g["from_pct"]) for g in ov.get("gaps", [])]}
    return [k for k in want if got.get(k) != want[k]]
