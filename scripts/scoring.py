"""Pure scoring functions (no I/O, no LLM). Rules are documented in docs/methodology.md."""
from __future__ import annotations


def pct_return(ref: float, exit_: float) -> float:
    return (exit_ / ref - 1.0) * 100.0


def verdict(stance: str, excess_pct: float, flat_band_pct: float) -> str:
    b = flat_band_pct
    if stance == "bullish":
        return "hit" if excess_pct > b else "miss" if excess_pct < -b else "flat"
    if stance == "bearish":
        return "hit" if excess_pct < -b else "miss" if excess_pct > b else "flat"
    if stance == "neutral":
        return "hit" if abs(excess_pct) <= b else "miss"
    raise ValueError(f"unknown stance {stance!r}")


def score(stance: str, ref: float, exit_: float, bench_ref: float, bench_exit: float,
          flat_band_pct: float) -> dict:
    r = pct_return(ref, exit_)
    br = pct_return(bench_ref, bench_exit)
    ex = r - br
    return {
        "return_pct": round(r, 3),
        "benchmark_return_pct": round(br, 3),
        "excess_pct": round(ex, 3),
        "verdict": verdict(stance, ex, flat_band_pct),
    }
