#!/usr/bin/env python3
"""Code-only routines (no LLM): derive, score matured picks, regime monitor, calibration,
long-run portfolio statistics, the forward-only paper portfolio, the forward ledger of every rule and the scores of
the public calls of the people we learn from.

Usage: python3 scripts/routines_code.py derive|score|regime|calibration|longrun|paper|rules|ledger|people|checklist|all
Each step reads public data, computes with plain arithmetic, validates against its schema,
and writes under data/kb/. Rules are documented in docs/methodology.md.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import CONFIG, DATA, DOCS, KB, MARKET, PRICES, RUNS, Validator, dump_json, load_json, parse_front_matter, settings, watchlist  # noqa: E402
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
                "horizon_days": horizon, "scored_date": bars[j]["date"],
                # Prices only in synthetic samples; live outcomes publish returns (provider licence).
                **({"ref_price": bars[i]["close"], "exit_price": bars[j]["close"]} if run.get("sample") else {}),
                "benchmark_symbol": bench, **sc, "methodology_version": method,
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


RECENT_DAYS = 15  # past day moves kept per context fund (the feed's past market days)


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
            "change_1d_pct": round(mk.day_change(c), 3), "ret_20d_pct": round(mk.ret(c, 20), 3),
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
                                   "change_1d_pct": round(mk.day_change(cc), 3),
                                   "ret_20d_pct": round(mk.ret(cc, 20), 3), "ret_60d_pct": round(mk.ret(cc, 60), 3),
                                   **({"ret_250d_pct": round(mk.ret(cc, 250), 3)} if len(cc) > 250 else {}),
                                   "from_high_pct": round(mk.pct(max(cc[-252:]), cc[-1]), 3),
                                   # Past market days for the Today feed (watchlist names and the benchmark have `series`).
                                   "recent_days": [{"date": dates[len(dates) - len(cc) + k],
                                                    "change_pct": round(mk.pct(cc[k - 1], cc[k]), 3)}
                                                   for k in range(max(1, len(cc) - RECENT_DAYS), len(cc))]})
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
            "rebalances": rebs, "track": track,
            # Risk of what the record holds now (the history test's own path can differ: it keeps names it already held).
            "diversification": pf.diversification(members, core_c, rebs[-1]["holdings"], rule["slots"], sectors, pf.Y),
            "if_rebalanced_today": pf.select(members, bench_c, sectors, len(dates) - 1, st["setup"], rule, rebs[-1]["holdings"])[0]}


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



# ------------------------------------------------------------ rule registry

def judge_satellite(r: dict, acc: dict, tries: int, runs: int) -> tuple[str, list[str]]:
    """Verdict on history alone (never money: the forward paper record decides that). Pre-registered numbers
    from config/rules.json `acceptance`. 'Not luck' uses the one-sided p-value against the matched null,
    Bonferroni-adjusted for the tries counted; it needs enough null runs for that p to be reachable."""
    alpha = (100 - acc["null_percentile_min"]) / 100
    reachable = 1 / (runs + 1) * tries <= alpha
    why = [f"beat {r['percentile']:.1f}% of random draws; p {r['p_value']:.4f}, adjusted for {tries} tries {r['p_adjusted']:.3f} (need {alpha:.2f} or less)"]
    if not reachable:
        why.append(f"{runs} null runs cannot reach that bar with {tries} tries")
    halves_ok = min(r["percentile_halves"]) >= acc["halves_percentile_min"]
    why.append(f"halves {r['percentile_halves'][0]:.0f} / {r['percentile_halves'][1]:.0f} (need {acc['halves_percentile_min']}+ in both)")
    dd_ok = r["max_dd_vs_core_pts"] >= -acc["max_dd_worse_than_core_pts"]
    why.append(f"deepest drop {r['max_dd_vs_core_pts']:+.1f} pts vs the core (limit -{acc['max_dd_worse_than_core_pts']})")
    turn_ok = r["turnover_pct_year"] <= acc["max_turnover_pct_year"]
    why.append(f"turnover {r['turnover_pct_year']:.0f}% a year including stops (limit {acc['max_turnover_pct_year']})")
    if r["percentile"] < acc["reject_below_percentile"]:
        return "rejected", why
    if reachable and r["p_adjusted"] <= alpha and halves_ok and dd_ok and turn_ok:
        return "passes_history", why
    if r["p_value"] <= alpha and halves_ok:
        return "candidate", why
    return "inconclusive", why


def cap_verdict(status: str, verdict: str, why: list[str]) -> tuple[str, list[str]]:
    """The reference baseline's history was viewed before the registry was written, so it cannot pass on history:
    its best verdict is 'candidate' (it still gets a forward record like every other rule)."""
    if status == "reference_baseline" and verdict == "passes_history":
        return "candidate", [*why, "capped at candidate: this rule's history was seen before pre-registration"]
    return verdict, why


def registry_hash(rc: dict, cost: float, st: dict, wl: dict) -> str:
    """Everything that decides a history verdict: the rules' engine settings, the acceptance numbers, the tries count, the
    cost, the settings rule v1 reads (config/settings.json setup and portfolio) and the universe (the watchlist's symbols and
    sector labels, the core and the benchmark). A change here is a new pre-registration, so a new freeze. The wording of the
    money gates is protected by the public git history only (see the registry's acceptance text)."""
    core = {"rules": [[r["id"], r["status"], r.get("engine")] for r in rc["rules"]], "acceptance": {k: v for k, v in rc["acceptance"].items() if k != "text"},
            "tries": rc["tries_counted"], "cost_bps": cost, "setup": st["setup"], "portfolio": st["portfolio"],
            "universe": sorted((s["symbol"], s["sector"]) for s in wl["symbols"]),
            "core": (wl.get("core") or {}).get("symbol"), "benchmark": st["scoring"]["benchmark"]["symbol"],
            "cash": next((c["symbol"] for c in wl.get("context", []) if c["role"] == "cash"), None)}
    return hashlib.sha256(json.dumps(core, sort_keys=True).encode()).hexdigest()[:16]


def freeze_verdicts(prev: dict | None, doc: dict, rc: dict, cost: float, st: dict, wl: dict) -> dict:
    """The history verdict is read ONCE, on the first real-data run of a registry. The daily recompute keeps updating the
    numbers (display), but a verdict that flips on a lucky day is optional stopping, so the decision uses the frozen one.
    Later data counts only through the forward ledger. A change to anything that decides a verdict (see registry_hash) starts a
    new freeze, but only if `tries_counted` was raised, so a re-read always costs a try; the superseded freeze stays in the
    file. Without the raised count the run fails closed."""
    h = registry_hash(rc, cost, st, wl)
    old = (prev or {}).get("frozen")
    if old and old.get("registry_hash") == h:
        return old
    if old and rc["tries_counted"] <= old.get("tries_counted", 0):
        raise SystemExit(f"rules: something that decides a verdict changed (rule settings, acceptance numbers, cost, rule v1's settings or the watchlist) "
                         f"since the verdicts were frozen on {old['as_of']}. A changed pre-registration is a new try: raise tries_counted in config/rules.json "
                         f"above {old.get('tries_counted', 0)} (and note it in docs/decisions.md), or restore the old settings.")
    sat = {r["id"]: {"verdict": r["verdict"], "percentile": r["percentile"], "p_adjusted": r["p_adjusted"], "reasons": r["reasons"]}
           for r in (doc.get("satellite") or {}).get("rules", [])}
    sav = {f"{hz['weeks']}:{r['id']}": {"verdict": r["verdict"]} for hz in (doc.get("savings") or {}).get("horizons", []) for r in hz["rows"]}
    history = [*(old.get("superseded", []) if old else []), {k: v for k, v in old.items() if k != "superseded"}] if old else []
    out = {"as_of": doc["as_of"], "registry_version": rc["version"], "registry_hash": h, "tries_counted": rc["tries_counted"], "satellite": sat, "savings": sav}
    if history:
        out["superseded"] = history
    return out


def judge_savings(row: dict, independent: int, acc: dict) -> str:
    if "vs_baseline_irr_bps_median" not in row:
        return "baseline"
    if independent < acc["min_independent_windows"]:
        return "too_few_independent_windows"
    d, share = row["vs_baseline_irr_bps_median"], row["vs_baseline_better_pct"]
    if abs(d) < acc["material_irr_bps"] or 100 - acc["consistency_pct"] < share < acc["consistency_pct"]:
        return "no_clear_difference"
    return "better" if d > 0 else "worse"


def compute_rules(prices_dir: Path, st: dict, wl: dict, rc: dict, sample: bool, provider: str, runs: int | None = None) -> dict | None:
    """Backtest every testable rule in config/rules.json (derived numbers only)."""
    import portfolio as pf
    import rules as rl
    members = [s["symbol"] for s in wl["symbols"]]
    sectors = {s["symbol"]: s["sector"] for s in wl["symbols"]}
    core = wl["core"]["symbol"]
    bench = st["scoring"]["benchmark"]["symbol"]
    cash = next((c["symbol"] for c in wl.get("context", []) if c["role"] == "cash"), None)
    raw = {s: _bars(prices_dir, s) for s in {*members, core, bench, *([cash] if cash else [])}}
    M = rl.build_market(raw, members, core, bench, cash, sectors)
    if not M or M["n"] < rl.WARM + 2 * rl.Y:
        return None
    if (gaps := rl.gap_report(M)):
        raise SystemExit("rules: a price gap would silently shrink the universe (fix the data first): " + "; ".join(gaps))
    acc, tries = rc["acceptance"], rc["tries_counted"]
    goal = st["goal"]["annual_return_pct"]
    lag, cost = acc["fill_lag_days"], st["portfolio"]["cost_bps"]
    nruns = runs if runs is not None else acc["null_runs"]
    live = [r for r in rc["rules"] if r.get("engine") and r["status"] in ("testable_now", "reference_baseline", "control")]

    # Savings cadence (core only)
    sv = [{"id": r["id"], **{k: v for k, v in r["engine"].items() if k != "kind"}} for r in live if r["engine"]["kind"] == "savings_contribute"]
    savings = None
    if sv:
        savings = rl.savings_study(M, sv, acc["savings_horizons_weeks"], acc["savings_step_weeks"], lag)
        for h in savings["horizons"]:
            for row in h["rows"]:
                row["verdict"] = judge_savings(row, h["independent"], acc["savings"])

    # Satellite sleeve
    start = rl.WARM
    sat = [r for r in live if r["engine"]["kind"] == "satellite_select"]
    satellite = None
    if sat:
        years = (M["n"] - 1 - start) / rl.Y
        # Controls pay the same entry cost and next-close fill as every rule.
        core_v = rl.run_sleeve({"slots": 1, "selection": {"method": "core"}}, M, st, start, lag, cost)["values"]
        ew = rl.run_sleeve({"slots": len(M["c"]), "selection": {"method": "all"}}, M, st, start, lag, cost)["values"]
        controls = {"core": pf.long_stats(core_v, goal), "equal_weight": pf.long_stats(ew, goal)}
        c_core, c_ew = rl.thirds(core_v), rl.thirds(ew)
        results = []
        for r in sat:
            eng = {k: v for k, v in r["engine"].items() if k != "kind"}
            res = rl.run_sleeve(eng, M, st, start, lag, cost)
            vals = res["values"]
            nul = rl.matched_null(M, st, start, res["rebalances"], eng, nruns, acc["null_seed"], lag, cost)
            c3 = rl.thirds(vals)
            stats = pf.long_stats(vals, goal)
            runs_ = nul["runs"]
            pcts = [rl.percentile_of(c3[k], [x[k] for x in runs_]) for k in range(3)]
            p = (sum(x[0] >= c3[0] for x in runs_) + 1) / (len(runs_) + 1)
            row = {"id": r["id"], "stats": stats, "cagr_halves_pct": [round(c3[1], 2), round(c3[2], 2)],
                   "percentile": round(pcts[0], 1), "percentile_halves": [round(pcts[1], 1), round(pcts[2], 1)],
                   "p_value": round(p, 4), "p_adjusted": round(min(1.0, p * tries), 4),
                   "null_cagr_pct": {q: round(rl.quantile([x[0] for x in runs_], v), 2) for q, v in (("p05", .05), ("p50", .5), ("p95", .95))},
                   "null_replacement_rate": round(nul["q"], 3),
                   "vs_core_cagr_pts": round(c3[0] - c_core[0], 2), "vs_equal_weight_cagr_pts": round(c3[0] - c_ew[0], 2),
                   "max_dd_vs_core_pts": round(stats["max_dd_pct"] - controls["core"]["max_dd_pct"], 1),
                   "turnover_pct_year": round(rl.turnover_per_year(res["rebalances"], years, res["stops"]), 1),
                   "avg_names": round(nul["avg_names"], 2),
                   "decisions": len(res["rebalances"]), "stops": len(res["stops"]),
                   "holdings_now": res["rebalances"][-1]["holdings"] if res["rebalances"] else [], "_values": vals}
            row["verdict"], row["reasons"] = cap_verdict(r["status"], *judge_satellite(row, acc["satellite"], tries, nruns))
            results.append(row)
        weekly_idx = pf.weekly_idx(M["n"], start, 5)
        rel = [k - start for k in weekly_idx]
        weekly = {"dates": [M["dates"][k] for k in weekly_idx],
                  "core": [round(core_v[k] / core_v[rel[0]] * 100, 2) for k in rel],
                  "equal_weight": [round(ew[k] / ew[rel[0]] * 100, 2) for k in rel]}
        weekly["rules"] = {x["id"]: [round(x["_values"][k] / x["_values"][rel[0]] * 100, 2) for k in rel] for x in results}
        for x in results:
            del x["_values"]
        satellite = {"from": M["dates"][start], "to": M["dates"][-1], "years": round(years, 1), "controls": controls,
                     "controls_halves": {"core": [round(c_core[1], 2), round(c_core[2], 2)], "equal_weight": [round(c_ew[1], 2), round(c_ew[2], 2)]},
                     "null": {"runs": nruns, "seed": acc["null_seed"],
                              "kind": "random names; same number of names held at each decision, same replacement rate, same caps, sizing, exits, fills and costs"},
                     "rules": results, "weekly": weekly}
    return {"as_of": M["dates"][-1], "sample": sample, "provider": provider, "registry_version": rc["version"],
            "tries_counted": tries, "fill_lag_days": lag, "cost_bps": cost, "goal_pct": goal,
            "excluded_history": [s for s in members if s not in M["c"]],
            "savings": savings, "satellite": satellite}


def summarize_rules(doc: dict) -> list[str]:
    """Derived numbers only (percentages): safe for a public Actions log."""
    out = []
    sv = doc.get("savings")
    for h in (sv or {}).get("horizons", []):
        out.append(f"savings {h['weeks']}w windows={h['windows']} independent={h['independent']} {h['from']}..{h['to']}")
        for r in h["rows"]:
            out.append(f"  {r['id']:22} irr {r['irr_median_pct']:6.2f}% mult {r['multiple_median']:.3f} underwater p10 {r['worst_vs_paid_p10_pct']:6.1f}% "
                       f"cash {r['cash_share_median_pct']:4.0f}% trades/yr {r['trades_per_year']:5.1f} "
                       f"dIRR {r.get('vs_baseline_irr_bps_median', 0):+7.1f}bp better {r.get('vs_baseline_better_pct', 0):5.1f}% "
                       f"fee* {r.get('breakeven_fee_pct_of_weekly', float('nan')):6.2f}% {r['verdict']}")
    sat = doc.get("satellite")
    if sat:
        n, c, e = sat["null"], sat["controls"]["core"], sat["controls"]["equal_weight"]
        out.append(f"satellite {sat['from']}..{sat['to']} ({sat['years']}y) matched null runs={n['runs']}")
        out.append(f"  core cagr {c['cagr_pct']} dd {c['max_dd_pct']}   equal-weight cagr {e['cagr_pct']} dd {e['max_dd_pct']}")
        for r in sat["rules"]:
            s = r["stats"]
            out.append(f"  {r['id']:24} cagr {s['cagr_pct']:6.2f} dd {s['max_dd_pct']:6.1f} vsCore {r['vs_core_cagr_pts']:+6.2f} null p05/p50/p95 {r['null_cagr_pct']['p05']:.1f}/{r['null_cagr_pct']['p50']:.1f}/{r['null_cagr_pct']['p95']:.1f} pct {r['percentile']:5.1f} "
                       f"halves {r['percentile_halves'][0]:4.0f}/{r['percentile_halves'][1]:4.0f} p_adj {r['p_adjusted']:.3f} turn {r['turnover_pct_year']:5.0f}% "
                       f"names {r['avg_names']:.1f} stops {r['stops']} -> {r['verdict']}")
    return out


def run_rules() -> None:
    if not (CONFIG / "rules.json").exists():
        print("rules: no config/rules.json yet, nothing to test")
        return
    st, wl = settings(), watchlist()
    rc = load_json(CONFIG / "rules.json")
    doc = compute_rules(PRICES, st, wl, rc, sample=False, provider=st["prices"]["provider"])
    if not doc:
        raise SystemExit("rules: not enough aligned history for the core, benchmark and watchlist")
    path = MARKET / "rules.json"
    doc["frozen"] = freeze_verdicts(load_json(path) if path.exists() else None, doc, rc, st["portfolio"]["cost_bps"], st, wl)
    _write(path, doc, "rules_result.schema.json", compact=True)
    print("rules:", f"registry {rc['version']}, as of {doc['as_of']}")
    print(*summarize_rules(doc), sep="\n")


def _rule_market(prices_dir: Path, st: dict, wl: dict):
    import rules as rl
    members = [s["symbol"] for s in wl["symbols"]]
    sectors = {s["symbol"]: s["sector"] for s in wl["symbols"]}
    core = wl["core"]["symbol"]
    bench = st["scoring"]["benchmark"]["symbol"]
    cash = next((c["symbol"] for c in wl.get("context", []) if c["role"] == "cash"), None)
    raw = {s: _bars(prices_dir, s) for s in {*members, core, bench, *([cash] if cash else [])}}
    return rl.build_market(raw, members, core, bench, cash, sectors)


def _engine_hash(cfg: dict, cost: float, lag: int, st: dict | None = None) -> str:
    """Identity of a rule's record. Rule v1 reads its numbers from config/settings.json, so those are part of its identity."""
    body = {"cfg": cfg, "cost_bps": cost, "lag": lag}
    if st is not None and cfg.get("selection", {}).get("method") == "v1":
        body["v1_settings"] = {"setup": st["setup"], "portfolio": st["portfolio"]}
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()[:16]


def update_ledger(prev: dict | None, M: dict, st: dict, rc: dict, sample: bool) -> dict:
    """Forward ledger of every testable satellite rule. On the first run of each calendar month (each quarter for
    quarterly rules) a rule's holdings are chosen with only that day's data and appended; recorded holdings are never
    edited. Each rule's track is replayed from its record by the same engine, on the recorded days (stops are
    mechanical). Append-only across registry changes: a rule whose settings change starts a new record and the old one
    is frozen under `retired`, as is a rule removed from the registry. If a recorded name or date is missing from the
    prices, the rule keeps its last good track instead of crashing the day. The forward comparison with the matched
    null waits for 6 decisions and about six months."""
    import rules as rl
    acc = rc["acceptance"]
    lag, cost = acc["fill_lag_days"], st["portfolio"]["cost_bps"]
    last = M["n"] - 1
    today = M["dates"][last]
    idx = {d: k for k, d in enumerate(M["dates"])}
    prev_rules = (prev or {}).get("rules", {})
    retired = dict((prev or {}).get("retired", {}))
    out, live_ids = {}, set()
    for r in rc["rules"]:
        eng = r.get("engine")
        if not eng or eng["kind"] != "satellite_select" or r["status"] not in ("testable_now", "reference_baseline"):
            continue
        live_ids.add(r["id"])
        cfg = {k: v for k, v in eng.items() if k != "kind"}
        h = _engine_hash(cfg, cost, lag, st)
        old = prev_rules.get(r["id"])
        if old and old.get("engine_hash") != h:  # the rule changed: freeze its record, start a new one
            retired[f"{r['id']}@{old.get('engine_hash', 'legacy')[:8]}"] = {**old, "retired_on": today}
            old = None
        quarterly = cfg.get("rebalance") == "quarterly"
        rebs = [dict(x) for x in (old or {}).get("rebalances", [])]
        due = not rebs or (today > rebs[-1]["date"] and today[:7] != rebs[-1]["date"][:7] and (not quarterly or int(today[5:7]) in (1, 4, 7, 10)))
        if due and last - rl.WARM >= 0:
            picked = rl.pick_names(cfg, M, st, last, rebs[-1]["holdings"] if rebs else [], random.Random(0))
            rebs.append({"date": today, "holdings": picked})
        if not rebs:
            continue
        names = {s for x in rebs for s in x["holdings"]}
        missing = [x["date"] for x in rebs if x["date"] not in idx] + sorted(s for s in names if s not in M["c"])
        if missing:
            print(f"ledger: {r['id']} keeps its last good track; missing from prices: {missing[:5]}")
            kept = old or {"started": rebs[0]["date"], "values": [100.0]}
            out[r["id"]] = {**kept, "rebalances": rebs, "decisions": len(rebs), "engine_hash": h, "stale": True}
            continue
        start = idx[rebs[0]["date"]]
        days = [idx[x["date"]] for x in rebs]
        scripted = {**cfg, "selection": {"method": "scripted", "picks": {d: x["holdings"] for d, x in zip(days, rebs)}}}
        res = rl.run_sleeve(scripted, M, st, start, lag, cost)
        vals = res["values"]
        row = {"started": rebs[0]["date"], "rebalances": rebs, "values": [round(v, 3) for v in vals], "decisions": len(rebs),
               "engine_hash": h}
        if len(rebs) >= 6 and len(vals) > 126:
            nul = rl.matched_null(M, st, start, res["rebalances"], cfg, acc["null_runs"], acc["null_seed"], lag, cost, days=days)
            mine = ((vals[-1] / vals[0]) ** (rl.Y / (len(vals) - 1)) - 1) * 100
            row["forward_percentile"] = round(rl.percentile_of(mine, [x[0] for x in nul["runs"]]), 1)
        out[r["id"]] = row
    for rid, old in prev_rules.items():
        if rid not in live_ids:  # removed from the registry: keep its record, frozen
            retired.setdefault(f"{rid}@{old.get('engine_hash', 'legacy')[:8]}", {**old, "retired_on": today})
    starts = [idx[v["started"]] for v in out.values() if v["started"] in idx]
    base = min(starts) if starts else last
    core_c, bench_c = M["core"], M["bench"]
    return {"as_of": today, "sample": sample,
            "note": "Forward only: each rule's holdings are written on the first run of the month with that day's data and never edited. Values indexed to 100 at each rule's start; core and benchmark from the earliest start.",
            "dates": M["dates"][base:], "core": [round(100 * c / core_c[base], 3) for c in core_c[base:]],
            "bench": [round(100 * c / bench_c[base], 3) for c in bench_c[base:]], "rules": out, "retired": retired}


def rl_gap_report(M: dict) -> list[str]:
    import rules as rl
    return rl.gap_report(M)


def run_ledger() -> None:
    if not (CONFIG / "rules.json").exists():
        print("ledger: no config/rules.json yet, nothing to record")
        return
    st, wl = settings(), watchlist()
    rc = load_json(CONFIG / "rules.json")
    M = _rule_market(PRICES, st, wl)
    if not M:
        raise SystemExit("ledger: missing core or benchmark prices")
    if (gaps := rl_gap_report(M)):
        raise SystemExit("ledger: a price gap would silently shrink the universe (nothing recorded today): " + "; ".join(gaps))
    path = DATA / "portfolio" / "paper_rules.json"
    doc = update_ledger(load_json(path) if path.exists() else None, M, st, rc, sample=False)
    _write(path, doc, "paper_rules.schema.json", compact=True)
    n = {k: v["decisions"] for k, v in doc["rules"].items()}
    print(f"ledger: {len(n)} rules, decisions {n}, as of {doc['as_of']}")


# ------------------------------------------------------- people we learn from

def people_series(prices_dir: Path, wl: dict, tickers: set[str]) -> tuple[dict, str] | None:
    """Daily closes of the core and the called names on the core's trading days, each list as long as the dates
    (None before a name's history begins). Raw closes stay in memory; only percentages are ever written."""
    import market as mk
    core = (wl.get("core") or {}).get("symbol")
    core_bars = _bars(prices_dir, core) if core else []
    if not core_bars:
        return None
    dates = [b["date"] for b in core_bars]
    closes = mk.align_tail({core: core_bars, **{t: _bars(prices_dir, t) for t in tickers if t != core}}, dates)
    if len(closes.get(core, [])) != len(dates):
        return None
    n = len(dates)
    members = {t: [None] * (n - len(v)) + v for t, v in closes.items() if t != core}
    return {"dates": dates, "core": closes[core], "members": members}, core


def compute_people(prices_dir: Path, cfg: dict, wl: dict, sample: bool) -> dict | None:
    import people as pp
    on_list = {s["symbol"] for s in wl["symbols"]}
    got = people_series(prices_dir, wl, {c["ticker"] for c in cfg["calls"] if c["ticker"] in on_list})
    if not got:
        return None
    series, core = got
    return pp.compute_scores(cfg, series, on_list, core=core, sample=sample)


def run_people() -> None:
    """Score every public call in config/people.json on the daily closes (fixed trading days, never re-gridded)."""
    import people as pp
    cfg_path = CONFIG / "people.json"
    if not cfg_path.exists():
        print("people: no config/people.json yet, nothing to score")
        return
    cfg = load_json(cfg_path)
    errs = Validator().validate(cfg, "people.schema.json")
    if errs:
        raise SystemExit(f"people: config/people.json fails its schema (nothing written): {errs[:5]}")
    doc = compute_people(PRICES, cfg, watchlist(), sample=False)
    if not doc:
        raise SystemExit("people: no daily closes for the core (run fetch_prices first)")
    _write(DATA / "people" / "scores.json", doc, "people_scores.schema.json")
    print(*pp.summarize(doc), sep="\n")


# ------------------------------------------------------- technical checklist

CHECKLIST_NOTE = ("The eight-step checklist from a trading video the household liked, computed by code from end-of-day bars. Unproven for "
                  "us: a description of the chart, not a forecast; never the only reason for a pick and never ahead of the index core.")
FORWARD_NOTE = ("Forward only: every {step} trading days each name's verdict is written with that day's data and never edited; each is "
                "scored {h} trading days later as its excess return over the benchmark.")
BASE_RATES_NOTE = ("In-sample and on today's list of survivors: names that did well enough to be on the list today, so this flatters "
                   "the checklist. Samples every {step} trading days do not overlap in time for one name, but names move together, so "
                   "the real uncertainty is wider than the 90% ranges shown.")


def checklist_params(cfg: dict) -> tuple[dict, dict]:
    """(steps' params by step id, house numbers) from config/checklist.json."""
    return ({s["id"]: s["params"] for s in cfg["steps"]},
            {"min_reward_to_risk": cfg["house_rule"]["min_reward_to_risk"], "lean_threshold": cfg["verdict"]["lean_threshold"]})


def align_bars_tail(raw: dict[str, list[dict]], dates: list[str]) -> dict[str, dict]:
    """OHLCV lists for each symbol on the longest suffix of `dates` it fully covers (as market.align_tail, for whole bars).
    Raw values stay in memory; only derived numbers are written."""
    out = {}
    for sym, bars in raw.items():
        m = {b["date"]: b for b in bars}
        rows = []
        for d in reversed(dates):
            if d not in m:
                break
            rows.append(m[d])
        if rows:
            rows.reverse()
            out[sym] = {"dates": [b["date"] for b in rows], "o": [b["open"] for b in rows], "h": [b["high"] for b in rows],
                        "l": [b["low"] for b in rows], "c": [b["close"] for b in rows], "v": [b.get("volume") or 0 for b in rows]}
    return out


def checklist_forward(prev: dict | None, rows: list[dict], series: dict[str, dict], bench: str, measure: dict) -> dict:
    """The forward record: a snapshot of every name's verdict on the first run and then every `step_days` trading days,
    written with that day's data and never edited; each scored `horizon_days` trading days later (excess return over the
    benchmark, percent). Recomputed from the record each run."""
    import market as mk
    step, h = measure["step_days"], measure["horizon_days"]
    dates = series[bench]["dates"]
    today = dates[-1]
    pos = {d: k for k, d in enumerate(dates)}
    records = [dict(r) for r in (prev or {}).get("records", [])]
    last = records[-1]["date"] if records else None
    if last is None or (last < today and (last not in pos or len(dates) - 1 - pos[last] >= step)):
        records.append({"date": today, "names": {r["symbol"]: {"verdict": r["score"]["verdict"], "net": r["score"]["net"],
                                                               "fits": r["risk_plan"]["fits_house_rule"]}
                                                 for r in rows if r["symbol"] != bench}})
    b = series[bench]["c"]
    by_v: dict[str, list[float]] = {k: [] for k in mk.VERDICTS}
    rule = {"fits": [], "fails": []}
    scored = 0
    for rec in records:
        bi = pos.get(rec["date"])
        if bi is None or bi + h >= len(dates):
            continue
        scored += 1
        for sym, x in rec["names"].items():
            B = series.get(sym)
            if not B:
                continue
            i = len(B["c"]) - (len(dates) - bi)
            if i < 0 or B["dates"][i] != rec["date"]:
                continue
            fwd = mk.pct(B["c"][i], B["c"][i + h]) - mk.pct(b[bi], b[bi + h])
            by_v[x["verdict"]].append(fwd)
            rule["fits" if x["fits"] else "fails"].append(fwd)
    return {"note": FORWARD_NOTE.format(step=step, h=h), "started": records[0]["date"], "step_days": step, "horizon_days": h,
            "records": records, "scored_records": scored,
            "by_verdict": [{"verdict": k, **mk._stats(v)} for k, v in by_v.items()],
            "house_rule": {k: mk._stats(v) for k, v in rule.items()}}


def forward_problems(fw) -> list[str]:
    """Shape of a published forward record (checked on its own, so a later change elsewhere in the file cannot wedge the run)."""
    import market as mk
    if not isinstance(fw, dict) or not isinstance(fw.get("records"), list) or not fw["records"]:
        return ["forward.records is missing or empty"]
    out, last = [], ""
    for k, r in enumerate(fw["records"]):
        if not isinstance(r, dict) or not isinstance(r.get("date"), str) or not isinstance(r.get("names"), dict):
            out.append(f"record {k}: needs date and names")
            continue
        if r["date"] <= last:
            out.append(f"record {k}: dates must ascend")
        last = r["date"]
        for sym, x in r["names"].items():
            if not isinstance(x, dict) or x.get("verdict") not in mk.VERDICTS or not isinstance(x.get("fits"), bool) or not isinstance(x.get("net"), int):
                out.append(f"record {k} {sym}: needs verdict, net and fits")
    return out


def compute_checklist(prices_dir: Path, st: dict, wl: dict, cfg: dict, sample: bool, provider: str,
                      prev: dict | None = None) -> dict | None:
    """The technical checklist for every watchlist name and the benchmark at the last close, what flipped since the day
    before, the last `history_days` verdicts, the history base rates and the forward record. Derived numbers only."""
    return checklist_and_candles(prices_dir, st, wl, cfg, sample, provider, prev)[0]


def checklist_and_candles(prices_dir: Path, st: dict, wl: dict, cfg: dict, sample: bool, provider: str,
                          prev: dict | None = None) -> tuple[dict | None, dict[str, dict]]:
    """compute_checklist's document and, from the same bars on the same run, each checked symbol's indexed candles
    (market.candles: {symbol, as_of, sample, basis, daily, weekly, overlays}), whose overlays are that day's checklist."""
    import market as mk
    P, house = checklist_params(cfg)
    measure = cfg["measure"]
    bench = st["scoring"]["benchmark"]["symbol"]
    members = [s["symbol"] for s in wl["symbols"]]
    raw = {s: _bars(prices_dir, s) for s in {*members, bench}}
    if not raw[bench]:
        return None
    series = align_bars_tail({s: b for s, b in raw.items() if b}, [b["date"] for b in raw[bench]])
    warm, hist = mk.checklist_warmup(P), measure["history_days"]
    rows, skipped, preps, charts = [], [], {}, {}
    for sym in [*members, bench]:
        B = series.get(sym)
        if not B or len(B["c"]) < warm + hist:
            skipped.append(sym)
            continue
        pre = preps[sym] = mk.prep_checklist(B, P)
        n = len(B["c"])
        days = [mk.checklist_at(B, pre, i, P, house) for i in range(n - hist - 1, n)]
        history = [{"date": B["dates"][n - hist + j], "verdict": cur["score"]["verdict"], "net": cur["score"]["net"],
                    "changes": mk.checklist_changes(days[j], cur)} for j, cur in enumerate(days[1:])]
        rows.append({"symbol": sym, "as_of": B["dates"][-1], **mk.public(days[-1]), "changes": history[-1]["changes"],
                     "history": history})
        charts[sym] = {"symbol": sym, "as_of": B["dates"][-1], "sample": sample, "basis": mk.CANDLES_BASIS,
                       **mk.candles(B, pre, P, days[-1])}
    if bench not in preps:
        return None, {}
    full = {s: series[s] for s in preps}
    rates = mk.checklist_base_rates(full, bench, P, house, measure, preps)
    return ({"as_of": series[bench]["dates"][-1], "sample": sample, "provider": provider, "benchmark": bench,
            "config_version": cfg["version"], "status": cfg["status"], "note": CHECKLIST_NOTE,
            "house_rule": {"min_reward_to_risk": house["min_reward_to_risk"], "target": cfg["house_rule"]["target"]},
            "lean_threshold": house["lean_threshold"], "symbols": rows, "skipped": skipped,
            "base_rates": {**rates, "note": BASE_RATES_NOTE.format(step=rates["step_days"])}
            if rates["all"]["n"] else None,
            "forward": checklist_forward(prev, rows, full, bench, measure)}, charts)


def candle_files(charts: dict[str, dict]) -> tuple[dict[str, dict], list[str]]:
    """(the candles documents that pass their schema and market.candle_problems, the symbols refused with why). A refused
    symbol gets no chart today rather than failing the run: its checklist row still stands. The reasons name the field
    only, never its value: a refused value may be a raw price or volume, and the run's log is public."""
    import market as mk
    v = Validator()
    ok, refused = {}, []
    for sym, doc in charts.items():
        bad = [e.split(":", 1)[0] for e in v.validate(doc, "candles.schema.json")] or mk.candle_problems(doc)
        if bad:
            refused.append(f"{sym}: {bad[:2]}")
        else:
            ok[sym] = doc
    return ok, refused


def write_candles(out_dir: Path, docs: dict[str, dict]) -> None:
    """One file per symbol in out_dir; files of symbols not in `docs` (off the list, skipped or refused today) are
    removed, so every chart on the site is from the same day as the checklist."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in out_dir.glob("*.json"):
        if p.stem not in docs:
            p.unlink()
    for sym, doc in docs.items():
        dump_json(out_dir / f"{sym}.json", doc, compact=True)


def run_checklist() -> None:
    cfg_path = CONFIG / "checklist.json"
    if not cfg_path.exists():
        print("checklist: no config/checklist.json, nothing to compute")
        return
    cfg = load_json(cfg_path)
    errs = Validator().validate(cfg, "checklist_config.schema.json")
    if errs:
        raise SystemExit(f"checklist: config/checklist.json fails its schema (nothing written): {errs[:5]}")
    st = settings()
    path = MARKET / "checklist.json"
    prev = None
    if path.exists():  # the forward record is append-only: an unreadable record stops the run instead of starting over
        prev = load_json(path).get("forward")
        bad = forward_problems(prev)
        if bad:
            raise SystemExit(f"checklist: the published forward record is unreadable, so it would be lost (nothing written): {bad[:3]}")
    doc, charts = checklist_and_candles(PRICES, st, watchlist(), cfg, sample=False, provider=st["prices"]["provider"], prev=prev)
    if not doc:
        raise SystemExit("checklist: no benchmark prices in .cache/prices (run fetch_prices first)")
    files, refused = candle_files(charts)
    _write(path, doc, "checklist.schema.json", compact=True)
    write_candles(MARKET / "candles", files)
    print(f"candles: {len(files)} indexed chart file(s) in data/market/candles/" + (f"; refused {refused}" if refused else ""))
    counts = {v: sum(r["score"]["verdict"] == v for r in doc["symbols"]) for v in ("lean_up", "mixed", "lean_down")}
    br = doc["base_rates"]
    print(f"checklist: {len(doc['symbols'])} symbols as of {doc['as_of']}, verdicts {counts}, skipped {doc['skipped']}; "
          f"forward {len(doc['forward']['records'])} record(s), {doc['forward']['scored_records']} scored"
          + (f"; history {br['from']}..{br['to']} n={br['all']['n']}" if br else ""))


STEPS = {"derive": run_derive, "score": run_score, "regime": run_regime, "calibration": run_calibration,
         "longrun": run_longrun, "paper": run_paper, "rules": run_rules, "ledger": run_ledger, "people": run_people,
         "checklist": run_checklist}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which not in (*STEPS, "all"):
        raise SystemExit(f"usage: routines_code.py {'|'.join(STEPS)}|all")
    for name, fn in STEPS.items():
        if which in (name, "all"):
            fn()
