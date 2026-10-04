#!/usr/bin/env python3
"""Generate deterministic SAMPLE data under samples/ so the dashboard renders before live data exists.

Everything is synthetic (seeded random walks) and flagged `"sample": true`. Symbols come from
config/watchlist.json and the benchmark from config/settings.json. No network, no LLM.

Usage: python3 scripts/make_sample_data.py [--end YYYY-MM-DD] [--days N] [--runs N]
"""
from __future__ import annotations

import argparse
import hashlib
import math
import random
import shutil
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SAMPLES, doc_versions, dump_json, parse_front_matter, DOCS, settings, watchlist  # noqa: E402
import scoring  # noqa: E402

DEFAULT_END = "2026-10-02"
SEED = 20261004

THESES = {
    "bullish": [
        "{name} has outpaced the benchmark across the lookback window with a steady, orderly advance. "
        "Trend and relative strength agree, and no active lesson argues against this setup.",
        "{name} keeps making higher lows while the benchmark chops sideways. Pullbacks have been bought "
        "quickly, which suggests persistent demand rather than a one-off gap.",
    ],
    "bearish": [
        "{name} has lagged the benchmark across the lookback window and recent rebounds faded fast. "
        "The weakness looks persistent rather than a single event.",
        "{name} broke below its recent range while the benchmark held up. Relative weakness with rising "
        "volatility is a poor combination over the scoring horizon.",
    ],
    "neutral": [
        "{name} is moving broadly in line with the benchmark. Signals conflict, so the stance is to watch "
        "for a decisive break rather than lean either way.",
    ],
}
RISKS = {
    "bullish": ["Momentum reversal after an extended run", "Sector-wide de-rating", "Macro data surprise"],
    "bearish": ["Short-covering rally", "Positive company news flow", "Benchmark weakness narrows the gap"],
    "neutral": ["Breakout in either direction", "Volatility expansion"],
}
INVALIDATION = {
    "bullish": "A close back below the recent range low while the benchmark holds firm.",
    "bearish": "A close back above the recent range high on rising volume.",
    "neutral": "A sustained move away from the benchmark in either direction.",
}
SUMMARIES = [
    "Breadth was mixed. The brain favoured relative-strength leaders and flagged one persistent laggard.",
    "Quiet tape. Few names separated from the benchmark, so the pick list stays short.",
    "Leadership narrowed to a handful of names. Conviction is kept moderate until breadth improves.",
    "Rotation day. Picks lean on names whose relative trend held through the rotation.",
]


def trading_days(end: date, n: int) -> list[date]:
    out, d = [], end
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return out[::-1]


def walk(rng: random.Random, days: list[date], start: float, drift: float, vol: float) -> list[dict]:
    bars, close = [], start
    for d in days:
        open_ = close * (1 + rng.gauss(0, vol / 4))
        close = max(1.0, open_ * math.exp(rng.gauss(drift, vol)))
        hi = max(open_, close) * (1 + abs(rng.gauss(0, vol / 2)))
        lo = min(open_, close) * (1 - abs(rng.gauss(0, vol / 2)))
        bars.append({"date": d.isoformat(), "open": round(open_, 2), "high": round(hi, 2),
                     "low": round(lo, 2), "close": round(close, 2),
                     "volume": int(rng.uniform(8e6, 9e7))})
    return bars


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--end", default=DEFAULT_END)
    ap.add_argument("--days", type=int, default=140)
    ap.add_argument("--runs", type=int, default=45)
    args = ap.parse_args()

    st, wl = settings(), watchlist()
    rng = random.Random(SEED)
    end = date.fromisoformat(args.end)
    days = trading_days(end, args.days)
    stamp = datetime.combine(end, datetime.min.time(), timezone.utc).replace(hour=21, minute=5)
    fetched_at = stamp.isoformat().replace("+00:00", "Z")
    bench = st["scoring"]["benchmark"]["symbol"]
    horizon = st["scoring"]["horizon_days"]
    band = st["scoring"]["flat_band_pct"]
    names = {s["symbol"]: s["name"] for s in wl["symbols"]}

    for sub in ("prices", "runs", "kb", "docs"):
        shutil.rmtree(SAMPLES / sub, ignore_errors=True)

    series: dict[str, list[dict]] = {}
    for sym in [*names, bench]:
        is_bench = sym == bench
        series[sym] = walk(rng, days, rng.uniform(80, 600),
                           drift=0.0004 if is_bench else rng.uniform(-0.0015, 0.002),
                           vol=0.009 if is_bench else rng.uniform(0.012, 0.024))
        dump_json(SAMPLES / "prices" / f"{sym}.json", {
            "symbol": sym, "provider": "sample", "currency": "USD",
            "fetched_at": fetched_at, "sample": True, "bars": series[sym]})

    versions = doc_versions()
    method_meta, _ = parse_front_matter((DOCS / "methodology.md").read_text(encoding="utf-8"))
    lookback = 20
    run_days = days[-args.runs:]
    outcomes = []
    for idx, d in enumerate(run_days):
        i = days.index(d)
        failed = idx == len(run_days) - 9  # one failed run so the UI shows that state
        rel = {}
        for sym in names:
            r = scoring.pct_return(series[sym][i - lookback]["close"], series[sym][i]["close"])
            b = scoring.pct_return(series[bench][i - lookback]["close"], series[bench][i]["close"])
            rel[sym] = r - b
        ranked = sorted(rel, key=rel.get, reverse=True)
        chosen = []
        last = idx == len(run_days) - 1  # the showcase day: one of each stance
        if not failed:
            chosen += [(s, "bullish") for s in ranked[: 1 if last else rng.choice([1, 2, 2, 3])]]
            if last or (rel[ranked[-1]] < -2 and rng.random() < 0.7):
                chosen.append((ranked[-1], "bearish"))
            mid = min(names, key=lambda s: abs(rel[s]))
            if (last or rng.random() < 0.35) and mid not in [c[0] for c in chosen]:
                chosen.append((mid, "neutral"))
        picks = []
        for sym, stance in chosen:
            mag = abs(rel[sym])
            conviction = "high" if mag > 8 else "medium" if mag > 3 else "low"
            picks.append({
                "id": f"{d.isoformat()}:{sym}", "ref_date": d.isoformat(),
                "ref_price": series[sym][i]["close"],
                "pick": {
                    "ticker": sym, "stance": stance, "conviction": conviction,
                    "thesis": rng.choice(THESES[stance]).format(name=names[sym]),
                    "risks": rng.sample(RISKS[stance], k=2),
                    "invalidation": INVALIDATION[stance],
                    "evidence": [f"prices.{sym.lower()}.rel_{lookback}d", "benchmark.trend", "learnings.active"],
                },
            })
            if i + horizon < len(days):
                j = i + horizon
                sc = scoring.score(stance, series[sym][i]["close"], series[sym][j]["close"],
                                   series[bench][i]["close"], series[bench][j]["close"], band)
                outcomes.append({
                    "pick_id": f"{d.isoformat()}:{sym}", "run_date": d.isoformat(), "ticker": sym,
                    "stance": stance, "conviction": conviction, "ref_date": d.isoformat(),
                    "ref_price": series[sym][i]["close"], "horizon_days": horizon,
                    "scored_date": days[j].isoformat(), "exit_price": series[sym][j]["close"],
                    "benchmark_symbol": bench, **sc, "methodology_version": method_meta["version"],
                })
        cost = 0.0 if failed else round(rng.uniform(0.32, 0.92) if idx % 11 != 3 else rng.uniform(1.1, 2.3), 3)
        in_tok = 0 if failed else rng.randint(6200, 11400)
        run = {
            "schema_version": 1, "run_id": f"run.{d.isoformat()}", "date": d.isoformat(),
            "generated_at": f"{d.isoformat()}T21:{rng.randint(10, 40):02d}:00Z",
            "status": "failed" if failed else "ok", "sample": True, "model": "sample-model",
            "cost": {"usd": cost, "input_tokens": in_tok, "output_tokens": 0 if failed else rng.randint(700, 1900),
                     "cap_usd": st["cost"]["hard_cap_usd"]},
            "duration_minutes": round(rng.uniform(0.2, 0.5) if failed else rng.uniform(1.1, 4.2), 2),
            "pack": {"hash": hashlib.sha256(f"{SEED}:{d}".encode()).hexdigest(),
                     "tokens": rng.randint(12100, 12900) if failed else in_tok - rng.randint(300, 900),
                     "cap_tokens": st["pack"]["token_cap"]},
            "doc_versions": versions, "repair_retries": 1 if idx % 13 == 5 else 0,
            "summary": "" if failed else rng.choice(SUMMARIES), "picks": picks,
        }
        if failed:
            run["failure_reason"] = "Context pack exceeded its token cap; stopped before the LLM call."
        dump_json(SAMPLES / "runs" / f"run.{d.isoformat()}.json", run)

    dump_json(SAMPLES / "kb" / "outcomes.json", {
        "version": "0.1.0", "updated_at": end.isoformat(),
        "change_note": "Synthetic sample outcomes for the dashboard.", "sample": True, "items": outcomes})
    write_sample_learnings(end, outcomes)
    write_sample_library(end)
    print(f"samples: {len(series)} price files, {len(run_days)} runs, {len(outcomes)} scored picks")
    return 0


def write_sample_learnings(end: date, outcomes: list[dict]) -> None:
    """Three illustrative lessons whose evidence points at real sample outcome ids."""
    def ids(pred, k=3):
        return [o["pick_id"] for o in outcomes if pred(o)][:k] or [outcomes[0]["pick_id"]]
    lessons = [
        ("Bullish picks with low conviction rarely beat the benchmark by more than the flat band. "
         "Prefer zero picks over a weak bullish one.",
         ids(lambda o: o["stance"] == "bullish" and o["conviction"] == "low")),
        ("Bearish calls on names that already lagged badly tend to mean-revert inside the horizon. "
         "Require fresh weakness, not just a long slide.",
         ids(lambda o: o["stance"] == "bearish")),
        ("Neutral stances score well when the benchmark is calm, but miss in rotation weeks. "
         "Check benchmark volatility before choosing neutral.",
         ids(lambda o: o["stance"] == "neutral")),
    ]
    dump_json(SAMPLES / "docs" / "learnings.json", {
        "version": "0.3.0", "updated_at": end.isoformat(),
        "change_note": "Synthetic sample lessons so the Learnings view renders.",
        "items": [{"id": f"L-{i:03d}", "added": end.isoformat(),
                   "status": "retired" if i == 3 else "active", "lesson": text, "evidence": ev}
                  for i, (text, ev) in enumerate(lessons, start=1)],
    })


def write_sample_library(end: date) -> None:
    """Placeholder sources. Real entries are paraphrased principles with a citation."""
    sources = [
        ("lecture", "Sample lecture: relative strength", [
            ("Leaders tend to keep leading over weeks, so rank names against the benchmark, not in isolation.",
             ["relative_strength", "momentum"]),
            ("A trend that needs good news to continue is weaker than one that shrugs off bad news.",
             ["trend", "news"]),
        ]),
        ("book", "Sample book: risk before return", [
            ("Write down what would prove the idea wrong before you act on it.", ["invalidation", "process"]),
            ("Volatility expansion after a long calm stretch often marks a regime change.",
             ["volatility", "regime"]),
            ("Fewer, clearer bets are easier to learn from than many small ones.", ["process", "sizing"]),
        ]),
        ("course", "Sample course: reading the tape", [
            ("Breadth matters: a benchmark rising on a handful of names is fragile.", ["breadth", "benchmark"]),
        ]),
    ]
    dump_json(SAMPLES / "kb" / "library.json", {
        "version": "0.1.0", "updated_at": end.isoformat(),
        "change_note": "Synthetic placeholder sources.", "sample": True,
        "sources": [{"id": f"S-{i:03d}", "kind": kind, "title": title, "author": "Sample author",
                     "year": None, "added": end.isoformat(),
                     "principles": [{"id": f"S-{i:03d}.P{j:02d}", "text": t, "tags": tags}
                                    for j, (t, tags) in enumerate(prs, start=1)]}
                    for i, (kind, title, prs) in enumerate(sources, start=1)],
    })


if __name__ == "__main__":
    sys.exit(main())
