#!/usr/bin/env python3
"""Code-only routines (no LLM): score matured picks, regime monitor, calibration.

Usage: python3 scripts/routines_code.py score|regime|calibration|all
Each step reads public data, computes with plain arithmetic, validates against its schema,
and writes under data/kb/. Rules are documented in docs/methodology.md.
"""
from __future__ import annotations

import math
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DOCS, KB, MARKET, PRICES, RUNS, Validator, dump_json, load_json, parse_front_matter, settings, watchlist  # noqa: E402
import scoring  # noqa: E402

TODAY = datetime.now(timezone.utc).date().isoformat()


def _bars(prices_dir: Path, sym: str) -> list[dict]:
    p = prices_dir / f"{sym}.json"
    return load_json(p)["bars"] if p.exists() else []


def _method_version() -> str:
    meta, _ = parse_front_matter((DOCS / "methodology.md").read_text(encoding="utf-8"))
    return meta["version"]


def _write(path: Path, doc: dict, schema: str) -> None:
    errs = Validator().validate(doc, schema)
    if errs:
        raise SystemExit(f"{path.name}: schema check failed (nothing written): {errs[:5]}")
    dump_json(path, doc)


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

def compute_calibration(outcomes: list[dict], as_of: str, sample: bool, min_n: int) -> dict:
    def group(key, values):
        rows = []
        for v in values:
            sel = [o for o in outcomes if o[key] == v]
            n = len(sel)
            rows.append({key: v, "n": n,
                         "hit_rate_pct": round(sum(o["verdict"] == "hit" for o in sel) / n * 100, 1) if n else None,
                         "avg_excess_pct": round(sum(o["excess_pct"] for o in sel) / n, 3) if n else None})
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
    """Public, non-redistributive view of the market: returns, distances and indexed sparklines.
    No absolute prices leave this function."""
    bench = st["scoring"]["benchmark"]["symbol"]
    spark_n = st["site"]["sparkline_days"]
    bb = _bars(prices_dir, bench)
    out, as_of = [], None
    for sym in [*(s["symbol"] for s in wl["symbols"]), bench]:
        bars = _bars(prices_dir, sym)
        if len(bars) < 61:
            continue
        c = [b["close"] for b in bars]
        sma50 = sum(c[-50:]) / 50
        tail = bars[-spark_n:]
        base = tail[0]["close"]
        # Full window indexed to 100 at its first bar, with the 50-day average on the same index.
        sbase = bars[0]["close"]
        series = [{"date": b["date"], "v": round(b["close"] / sbase * 100, 2),
                   **({"sma50": round(sum(c[i - 49:i + 1]) / 50 / sbase * 100, 2)} if i >= 49 else {})}
                  for i, b in enumerate(bars)]
        rets = [math.log(c[i] / c[i - 1]) for i in range(len(c) - 20, len(c))]
        mu = sum(rets) / len(rets)
        vol20 = math.sqrt(sum((r - mu) ** 2 for r in rets) / (len(rets) - 1)) * math.sqrt(252) * 100
        row = {
            "symbol": sym, "last_date": bars[-1]["date"],
            "from_high_pct": round((c[-1] / max(c[-252:]) - 1) * 100, 3), "vol20_pct": round(vol20, 2),
            "series": series,
            "change_1d_pct": _pct(c[-2], c[-1]), "ret_20d_pct": _pct(c[-21], c[-1]), "ret_60d_pct": _pct(c[-61], c[-1]),
            "dist_sma50_pct": round((c[-1] / sma50 - 1) * 100, 3), "above_sma50": c[-1] > sma50,
            "spark": [{"date": b["date"], "v": round(b["close"] / base * 100, 2)} for b in tail],
        }
        if sym != bench and len(bb) >= 21:
            row["vs_bench_20d_pct"] = round(row["ret_20d_pct"] - _pct(bb[-21]["close"], bb[-1]["close"]), 3)
        out.append(row)
        as_of = max(as_of or "", row["last_date"])
    members = [r for r in out if r["symbol"] != bench]
    breadth = round(sum(r["above_sma50"] for r in members) / len(members) * 100, 1) if members else None
    return {"as_of": as_of or "1970-01-01", "sample": sample, "provider": provider, "benchmark": bench,
            "breadth_above_sma50_pct": breadth, "symbols": out}


def run_derive() -> None:
    st = settings()
    doc = compute_derived(PRICES, st, watchlist(), sample=False, provider=st["prices"]["provider"])
    if not doc["symbols"]:
        raise SystemExit("derive: no price data in .cache/prices (run fetch_prices first)")
    _write(MARKET / "derived.json", doc, "derived.schema.json")
    print(f"derive: {len(doc['symbols'])} symbols as of {doc['as_of']}, breadth {doc['breadth_above_sma50_pct']}% above 50-day")


STEPS = {"derive": run_derive, "score": run_score, "regime": run_regime, "calibration": run_calibration}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which not in (*STEPS, "all"):
        raise SystemExit(f"usage: routines_code.py {'|'.join(STEPS)}|all")
    for name, fn in STEPS.items():
        if which in (name, "all"):
            fn()
