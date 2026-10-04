#!/usr/bin/env python3
"""Code-only routines (no LLM): derive, score matured picks, regime monitor, calibration,
long-run portfolio statistics and the forward-only paper portfolio.

Usage: python3 scripts/routines_code.py derive|score|regime|calibration|longrun|paper|all
Each step reads public data, computes with plain arithmetic, validates against its schema,
and writes under data/kb/. Rules are documented in docs/methodology.md.
"""
from __future__ import annotations

import math
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DATA, DOCS, KB, MARKET, PRICES, RUNS, Validator, dump_json, load_json, parse_front_matter, settings, watchlist  # noqa: E402
import scoring  # noqa: E402

TODAY = datetime.now(timezone.utc).date().isoformat()


def _bars(prices_dir: Path, sym: str) -> list[dict]:
    p = prices_dir / f"{sym}.json"
    return load_json(p)["bars"] if p.exists() else []


def _method_version() -> str:
    meta, _ = parse_front_matter((DOCS / "methodology.md").read_text(encoding="utf-8"))
    return meta["version"]


def _write(path: Path, doc: dict, schema: str, compact: bool = False) -> None:
    errs = Validator().validate(doc, schema)
    if errs:
        raise SystemExit(f"{path.name}: schema check failed (nothing written): {errs[:5]}")
    dump_json(path, doc, compact=compact)


# ------------------------------------------------------------------- scoring

def score_outcomes(runs: list[dict], prices_dir: Path, existing: list[dict], st: dict, method: str,
                   ) -> tuple[list[dict], int]:
    """Score every live pick whose horizon has fully elapsed in the price data."""
    horizon = st["scoring"]["horizon_days"]
    band = st["scoring"]["flat_band_pct"]
    bench = st["scoring"]["benchmark"]["symbol"]
    done = {o["pick_id"] for o in existing}
    bench_bars = _bars(prices_dir, bench)
    bench_idx = {b["date"]: i for i, b in enumerate(bench_bars)}
    out, waiting = list(existing), 0
    for run in runs:
        for item in run["picks"]:
            if item["id"] in done:
                continue
            pick = item["pick"]
            bars = _bars(prices_dir, pick["ticker"])
            idx = {b["date"]: i for i, b in enumerate(bars)}
            i, bi = idx.get(item["ref_date"]), bench_idx.get(item["ref_date"])
            if i is None or bi is None or i + horizon >= len(bars) or bi + horizon >= len(bench_bars):
                waiting += 1
                continue
            j = i + horizon
            # Returns use the current (adjusted) series at ref_date, so splits/dividends cancel out.
            sc = scoring.score(pick["stance"], bars[i]["close"], bars[j]["close"],
                               bench_bars[bi]["close"], bench_bars[bi + horizon]["close"], band)
            out.append({
                "pick_id": item["id"], "run_date": run["date"], "ticker": pick["ticker"],
                "stance": pick["stance"], "conviction": pick["conviction"], "ref_date": item["ref_date"],
                "ref_price": item["ref_price"], "horizon_days": horizon, "scored_date": bars[j]["date"],
                "exit_price": bars[j]["close"], "benchmark_symbol": bench, **sc, "methodology_version": method,
            })
    return sorted(out, key=lambda o: (o["run_date"], o["ticker"])), waiting


def run_score() -> None:
    st = settings()
    runs = [load_json(p) for p in sorted(RUNS.glob("run.*.json"))]
    path = KB / "outcomes.json"
    existing = load_json(path)["items"] if path.exists() else []
    items, waiting = score_outcomes([r for r in runs if r["status"] == "ok"], PRICES, existing, st, _method_version())
    new = len(items) - len(existing)
    if path.exists() and not new:
        print(f"score: nothing new to score ({waiting} waiting)")
        return
    _write(path, {"version": "0.1.0", "updated_at": TODAY, "change_note": f"Scored {new} pick(s).",
                  "sample": False, "items": items}, "outcome.schema.json")
    print(f"score: {new} newly scored, {waiting} waiting")


# -------------------------------------------------------------------- regime

def compute_regime(bars: list[dict], st: dict, sample: bool) -> dict:
    cfg = st["regime"]
    closes = [b["close"] for b in bars]
    need = max(cfg["vol_days"], cfg["trend_sma_days"] + cfg["slope_days"]) + 1
    if len(closes) < need:
        raise SystemExit(f"regime: need {need} bars of the benchmark, have {len(closes)}")
    rets = [math.log(closes[i] / closes[i - 1]) for i in range(len(closes) - cfg["vol_days"], len(closes))]
    mean = sum(rets) / len(rets)
    vol = math.sqrt(sum((r - mean) ** 2 for r in rets) / (len(rets) - 1)) * math.sqrt(252) * 100
    window = closes[-cfg["drawdown_days"]:]
    drawdown = (closes[-1] / max(window) - 1) * 100
    n, s = cfg["trend_sma_days"], cfg["slope_days"]
    sma_now = sum(closes[-n:]) / n
    sma_then = sum(closes[-n - s:-s]) / n
    slope = (sma_now / sma_then - 1) * 100
    if closes[-1] > sma_now and slope > 0:
        trend = "up"
    elif closes[-1] < sma_now and slope < 0:
        trend = "down"
    else:
        trend = "sideways"
    if vol >= cfg["vol_stressed_pct"] or drawdown <= -cfg["drawdown_stressed_pct"]:
        state = "stressed"
    elif vol <= cfg["vol_calm_pct"]:
        state = "calm"
    else:
        state = "normal"
    return {
        "as_of": bars[-1]["date"], "sample": sample, "benchmark": st["scoring"]["benchmark"]["symbol"],
        "state": state, "trend": trend, "label": f"{state} · {trend}trend" if trend != "sideways" else f"{state} · sideways",
        "metrics": {"vol_ann_pct": round(vol, 2), "drawdown_pct": round(drawdown, 2),
                    "dist_sma_pct": round((closes[-1] / sma_now - 1) * 100, 3), "sma_slope_pct": round(slope, 3)},
        "params": {k: cfg[k] for k in ("vol_days", "trend_sma_days", "slope_days", "drawdown_days")},
    }


def run_regime() -> None:
    st = settings()
    bars = _bars(PRICES, st["scoring"]["benchmark"]["symbol"])
    doc = compute_regime(bars, st, sample=False)
    _write(KB / "regime.json", doc, "regime.schema.json")
    print(f"regime: {doc['label']} (vol {doc['metrics']['vol_ann_pct']}%, dd {doc['metrics']['drawdown_pct']}%)")


# --------------------------------------------------------------- calibration

def signed_excess(o: dict) -> float:
    """Excess return in the direction of the call: bullish +, bearish -, neutral -|x| (closer to flat is better).
    Raw excess would count a wrong bearish call on a rallying stock as a gain."""
    x = o["excess_pct"]
    return x if o["stance"] == "bullish" else -x if o["stance"] == "bearish" else -abs(x)


def compute_calibration(outcomes: list[dict], as_of: str, sample: bool, min_n: int) -> dict:
    def group(key, values):
        rows = []
        for v in values:
            sel = [o for o in outcomes if o[key] == v]
            n = len(sel)
            rows.append({key: v, "n": n,
                         "hit_rate_pct": round(sum(o["verdict"] == "hit" for o in sel) / n * 100, 1) if n else None,
                         "avg_signed_excess_pct": round(sum(signed_excess(o) for o in sel) / n, 3) if n else None})
        return rows
    conv = group("conviction", ["low", "medium", "high"])
    lo, hi = conv[0], conv[2]
    if lo["n"] >= min_n and hi["n"] >= min_n:
        verdict = "informative" if hi["hit_rate_pct"] > lo["hit_rate_pct"] else "not_informative"
    else:
        verdict = "insufficient_data"
    return {"as_of": as_of, "sample": sample, "n": len(outcomes), "min_n": min_n,
            "conviction_verdict": verdict, "by_conviction": conv,
            "by_stance": group("stance", ["bullish", "bearish", "neutral"])}


def run_calibration() -> None:
    st = settings()
    path = KB / "outcomes.json"
    outcomes = load_json(path)["items"] if path.exists() else []
    doc = compute_calibration(outcomes, TODAY, False, st["scoring"]["calibration_min_n"])
    _write(KB / "calibration.json", doc, "calibration.schema.json")
    print(f"calibration: {doc['n']} outcomes, conviction {doc['conviction_verdict']}")


# ------------------------------------------------------------ derived market

def _pct(a: float, b: float) -> float:
    return round((b / a - 1) * 100, 3)


def compute_derived(prices_dir: Path, st: dict, wl: dict, sample: bool, provider: str) -> dict:
    """Public, non-redistributive view of the market: returns, distances, risk, setup checks,
    base rates and market context. No absolute prices leave this function."""
    import market as mk
    bench = st["scoring"]["benchmark"]["symbol"]
    spark_n, series_n = st["site"]["sparkline_days"], st["site"]["series_days"]
    members = [s["symbol"] for s in wl["symbols"]]
    context = wl.get("context", [])
    raw = {sym: _bars(prices_dir, sym) for sym in {*members, bench, *(c["symbol"] for c in context)}}
    bb = raw[bench]
    if len(bb) < 61:
        return {"as_of": "1970-01-01", "sample": sample, "provider": provider, "benchmark": bench,
                "breadth_above_sma50_pct": None, "symbols": []}
    dates = [b["date"] for b in bb]
    closes = mk.align_tail({s: raw[s] for s in [*members, bench] if raw[s]}, dates)
    bc = closes[bench]
    full = {s: c for s, c in closes.items() if len(c) == len(dates)}  # history tests need equal lengths
    out = []
    for sym in [*members, bench]:
        if sym not in closes or len(closes[sym]) < 61:
            continue
        c = closes[sym]
        tail = c[-series_n:]
        tdates = dates[-len(tail):]
        sbase, spbase = tail[0], c[-spark_n]
        series = []
        for k, d in enumerate(tdates):
            gi = len(c) - len(tail) + k
            s50 = mk.sma(c, 50, gi)
            series.append({"date": d, "v": round(tail[k] / sbase * 100, 2), **({"sma50": round(s50 / sbase * 100, 2)} if s50 else {})})
        s50 = mk.sma(c, 50)
        row = {
            "symbol": sym, "last_date": dates[-1],
            "from_high_pct": round(mk.pct(max(c[-252:]), c[-1]), 3), "vol20_pct": round(mk.vol_ann(c, 20), 2),
            "series": series,
            "change_1d_pct": round(mk.pct(c[-2], c[-1]), 3), "ret_20d_pct": round(mk.ret(c, 20), 3),
            "ret_60d_pct": round(mk.ret(c, 60), 3),
            "dist_sma50_pct": round(mk.pct(s50, c[-1]), 3), "above_sma50": c[-1] > s50,
            "spark": [{"date": d, "v": round(v / spbase * 100, 2)} for d, v in zip(dates[-spark_n:], c[-spark_n:])],
        }
        for n in (120, 250):
            if len(c) > n:
                row[f"ret_{n}d_pct"] = round(mk.ret(c, n), 3)
        if sym != bench:
            for n in (20, 60, 120, 250):
                if len(c) > n:
                    row[f"vs_bench_{n}d_pct" if n != 20 else "vs_bench_20d_pct"] = round(mk.ret(c, n) - mk.ret(bc, n), 3)
            state = mk.setup_state(c, bc[-len(c):], st["setup"])
            if state:
                row["setup"] = state
        if len(c) > 252:
            row["risk"] = mk.risk_profile(c, None if sym == bench else bc)
        out.append(row)

    # Equal-weight basket of the watchlist vs the benchmark: the "just hold the index" check.
    basket = None
    mem = [full[s] for s in members if s in full]
    if mem and len(bc) > 252:
        ew = mk.equal_weight(mem)
        basket = {"risk": mk.risk_profile(ew, bc), "bench_risk": mk.risk_profile(bc, None)}
        worst = sorted(range(1, len(bc)), key=lambda k: bc[k] / bc[k - 1])[:10]
        worst = [k for k in worst if k >= len(bc) - 252]
        basket["bad_days"] = [{"date": dates[k], "bench_pct": round(mk.pct(bc[k - 1], bc[k]), 2),
                               "names_down": sum(1 for c in mem if c[k] < c[k - 1]), "names": len(mem)} for k in worst]

    # Market context: cash hurdle, real breadth (equal vs cap weight), bonds, credit, core trend filter.
    role = {c["role"]: c["symbol"] for c in context}
    ctx_closes = mk.align_tail({c["symbol"]: raw[c["symbol"]] for c in context if raw.get(c["symbol"])}, dates)
    ctx = {"instruments": []}
    for c in context:
        cc = ctx_closes.get(c["symbol"])
        if not cc or len(cc) < 61:
            continue
        ctx["instruments"].append({"symbol": c["symbol"], "role": c["role"], "name": c["name"],
                                   "ret_20d_pct": round(mk.ret(cc, 20), 3), "ret_60d_pct": round(mk.ret(cc, 60), 3),
                                   **({"ret_250d_pct": round(mk.ret(cc, 250), 3)} if len(cc) > 250 else {}),
                                   "from_high_pct": round(mk.pct(max(cc[-252:]), cc[-1]), 3)})
    cash = ctx_closes.get(role.get("cash"))
    if cash:
        ctx["cash_yield_pct"] = round(mk.cash_yield(cash), 2)
    if role.get("eq_ndx") in ctx_closes:
        ctx["participation_ndx"] = mk.participation(bc, ctx_closes[role["eq_ndx"]])
    if role.get("eq_spx") in ctx_closes and role.get("spx") in ctx_closes:
        ctx["participation_spx"] = mk.participation(ctx_closes[role["spx"]], ctx_closes[role["eq_spx"]])
    if role.get("credit") in ctx_closes and role.get("bonds") in ctx_closes:
        hy, tsy = ctx_closes[role["credit"]], ctx_closes[role["bonds"]]
        ctx["credit_vs_treasuries_60d_pct"] = round(mk.ret(hy, 60) - mk.ret(tsy, 60), 3)
    core = wl.get("core")
    if core and core["symbol"] in ctx_closes and len(ctx_closes[core["symbol"]]) > 252:
        cc = ctx_closes[core["symbol"]]
        ctx["core"] = {"symbol": core["symbol"], "label": core["label"], "risk": mk.risk_profile(cc, None),
                       "from_high_pct": round(mk.pct(max(cc[-252:]), cc[-1]), 3), "trend_filter": mk.trend_filter(cc, cash)}

    rates = mk.base_rates(full, bench, dates, st["setup"], st["backtest"]) if len(bc) > st["backtest"]["min_history_days"] + 60 else None
    member_rows = [r for r in out if r["symbol"] != bench]
    breadth = round(sum(r["above_sma50"] for r in member_rows) / len(member_rows) * 100, 1) if member_rows else None
    doc = {"as_of": dates[-1], "sample": sample, "provider": provider, "benchmark": bench,
           "breadth_above_sma50_pct": breadth, "symbols": out}
    if basket:
        doc["basket"] = basket
    if ctx["instruments"] or ctx.get("core"):
        doc["context"] = ctx
    if rates:
        doc["base_rates"] = rates
    return doc


def run_derive() -> None:
    st = settings()
    doc = compute_derived(PRICES, st, watchlist(), sample=False, provider=st["prices"]["provider"])
    if not doc["symbols"]:
        raise SystemExit("derive: no price data in .cache/prices (run fetch_prices first)")
    _write(MARKET / "derived.json", doc, "derived.schema.json", compact=True)
    print(f"derive: {len(doc['symbols'])} symbols as of {doc['as_of']}, breadth {doc['breadth_above_sma50_pct']}% above 50-day")


# ------------------------------------------------------- goal and portfolio

def _portfolio_inputs(prices_dir: Path, st: dict, wl: dict) -> tuple | None:
    """Members, core and benchmark closes on the dates all of them cover (core = the household index fund)."""
    import market as mk
    bench = st["scoring"]["benchmark"]["symbol"]
    core = (wl.get("core") or {}).get("symbol")
    syms = [s["symbol"] for s in wl["symbols"]]
    raw = {s: _bars(prices_dir, s) for s in {*syms, bench, *([core] if core else [])}}
    dates = [b["date"] for b in raw[bench]]
    closes = mk.align_tail(raw, dates)
    if not core or core not in closes or bench not in closes:
        return None
    warm = max(st["setup"]["trend_long_days"], st["setup"]["rs_long_days"], st["portfolio"]["corr_days"]) + 1
    min_len = warm + st["portfolio"]["min_history_years"] * mk.TRADING_DAYS
    eligible = [s for s in syms if s in closes and len(closes[s]) >= min_len]
    n = min(len(closes[core]), len(closes[bench]), *(len(closes[s]) for s in eligible))
    members = {s: closes[s][-n:] for s in eligible}
    excluded = [s for s in syms if s not in members]
    sectors = {s["symbol"]: s["sector"] for s in wl["symbols"]}
    return members, closes[core][-n:], closes[bench][-n:], dates[-n:], sectors, core, bench, excluded


def compute_longrun(prices_dir: Path, st: dict, wl: dict, sample: bool, provider: str) -> dict | None:
    import portfolio as pf
    inp = _portfolio_inputs(prices_dir, st, wl)
    if not inp:
        return None
    members, core_c, bench_c, dates, sectors, core, bench, excluded = inp
    body = pf.compute_longrun(members, core_c, bench_c, dates, sectors, st)
    if not body:
        return None
    # Names with too little history stay visible, marked, instead of silently disappearing.
    body["now"]["status"] += [{"symbol": s, "status": "no_history", "sector": sectors.get(s, "Unknown")} for s in excluded]
    return {"as_of": dates[-1], "sample": sample, "provider": provider, "core": core, "benchmark": bench,
            "excluded": excluded, **body}


def run_longrun() -> None:
    st = settings()
    doc = compute_longrun(PRICES, st, watchlist(), sample=False, provider=st["prices"]["provider"])
    if not doc:
        raise SystemExit("longrun: not enough aligned history for the core, benchmark and watchlist")
    _write(MARKET / "longrun.json", doc, "longrun.schema.json", compact=True)
    r = doc["stats"]["rule"]
    print(f"longrun: {doc['years']}y from {doc['from']}; rule CAGR {r['cagr_pct']}% maxDD {r['max_dd_pct']}%; "
          f"holds {doc['now']['holdings']}")


def update_paper(paper: dict | None, members: dict, core_c: list[float], bench_c: list[float], dates: list[str],
                 sectors: dict, st: dict, sample: bool) -> dict:
    """Forward-only paper portfolio: one rebalance per calendar month, chosen with data up to that day,
    recorded once and never recomputed (so it cannot be re-fitted later). The track is recomputed
    from the recorded holdings each run."""
    import portfolio as pf
    rule = st["portfolio"]
    rebs = list(paper["rebalances"]) if paper else []
    last = dates[-1]
    if not rebs or (last[:7] != rebs[-1]["date"][:7] and last > rebs[-1]["date"]):
        held = rebs[-1]["holdings"] if rebs else []
        picked = pf.select(members, bench_c, sectors, len(dates) - 1, st["setup"], rule, held)[0]
        rebs.append({"date": last, "rule": "v1", "holdings": picked,
                     "core_pct": round((rule["slots"] - len(picked)) / rule["slots"] * 100, 1)})
    pos_of = {d: k for k, d in enumerate(dates)}
    if any(r["date"] not in pos_of or any(h not in members for h in r["holdings"]) for r in rebs):
        raise SystemExit("paper: a recorded rebalance is outside the price history (fail closed)")
    by_date = {r["date"]: r for r in rebs}
    start = pos_of[rebs[0]["date"]]
    pos: dict[str, float] = {}
    v, track = 100.0, []
    for k in range(start, len(dates)):
        if pos:
            for key in pos:
                c = core_c if key == pf.CORE else members[key]
                pos[key] *= c[k] / c[k - 1]
            v = sum(pos.values())
        if dates[k] in by_date:
            r = by_date[dates[k]]
            w = {h: 1 / rule["slots"] for h in r["holdings"]}
            if r["core_pct"]:
                w[pf.CORE] = r["core_pct"] / 100
            old = {key: x / v for key, x in pos.items()}
            v -= v * sum(abs(w.get(x, 0) - old.get(x, 0)) for x in {*w, *old}) * rule["cost_bps"] / 1e4
            pos = {x: v * wx for x, wx in w.items()}
        track.append({"date": dates[k], "v": round(v, 3), "core_v": round(core_c[k] / core_c[start] * 100, 3),
                      "bench_v": round(bench_c[k] / bench_c[start] * 100, 3)})
    return {"as_of": last, "sample": sample, "started": rebs[0]["date"],
            "note": "Paper only: no money. Holdings are recorded on the first run of each month and never edited.",
            "rebalances": rebs, "track": track}


def run_paper() -> None:
    st, wl = settings(), watchlist()
    inp = _portfolio_inputs(PRICES, st, wl)
    if not inp:
        raise SystemExit("paper: missing core or benchmark prices")
    members, core_c, bench_c, dates, sectors, *_ = inp
    path = DATA / "portfolio" / "paper.json"
    old = load_json(path) if path.exists() else None
    doc = update_paper(old, members, core_c, bench_c, dates, sectors, st, sample=False)
    path.parent.mkdir(parents=True, exist_ok=True)
    _write(path, doc, "paper.schema.json", compact=True)
    t = doc["track"][-1]
    print(f"paper: since {doc['started']}, {len(doc['rebalances'])} rebalance(s); now {doc['rebalances'][-1]['holdings']}; "
          f"value {t['v']} vs core {t['core_v']}")


STEPS = {"derive": run_derive, "score": run_score, "regime": run_regime, "calibration": run_calibration,
         "longrun": run_longrun, "paper": run_paper}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which not in (*STEPS, "all"):
        raise SystemExit(f"usage: routines_code.py {'|'.join(STEPS)}|all")
    for name, fn in STEPS.items():
        if which in (name, "all"):
            fn()
