#!/usr/bin/env python3
"""Build the brain's context pack (M3): one capped JSON document of DERIVED numbers and curated text.

The brain reads only this pack and cites evidence by pack key (lowercase dot paths such as
`market.nvda.setup` or `library.s-028:p02`). Numbers come from code; the pack carries no raw prices.
Fails closed when the pack is over `pack.token_cap` (settings).

Usage: python3 scripts/build_pack.py [--out .cache/pack.json] [--data DIR] [--runs DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DATA, DOCS, ROOT, RUNS, load_json, parse_front_matter, settings, watchlist  # noqa: E402

TAG_WEIGHT = {  # what a stock-picking step most needs from the library
    "relative_strength": 3, "momentum": 3, "trend": 3, "overextension": 3, "earnings": 3, "events": 2,
    "risk": 2, "stops": 2, "exits": 2, "position_sizing": 2, "diversification": 2, "concentration": 2,
    "valuation": 2, "quality": 2, "breakouts": 1, "moving_averages": 1, "regime": 1, "breadth": 1,
    "base_rates": 2, "survivorship": 1, "discipline": 1, "behavior": 1, "expectancy": 1, "megacap": 1,
}


def r1(x):
    return None if x is None else round(x, 1)


def estimate_tokens(text: str) -> int:
    return (len(text) + 3) // 4


def symbol_view(row: dict, long: dict | None, status: dict | None) -> dict:
    v = {"ret_20d": r1(row.get("ret_20d_pct")), "ret_60d": r1(row.get("ret_60d_pct")),
         "ret_120d": r1(row.get("ret_120d_pct")), "ret_250d": r1(row.get("ret_250d_pct")),
         "vs_bench_20d": r1(row.get("vs_bench_20d_pct")), "vs_bench_60d": r1(row.get("vs_bench_60d_pct")),
         "vs_bench_120d": r1(row.get("vs_bench_120d_pct")), "vs_bench_250d": r1(row.get("vs_bench_250d_pct")),
         "dist_sma50": r1(row.get("dist_sma50_pct")), "from_1y_high": r1(row.get("from_high_pct")),
         "vol20": r1(row.get("vol20_pct")), "change_1d": r1(row.get("change_1d_pct"))}
    if row.get("setup"):
        s = row["setup"]
        v["setup"] = {"passed": s["passed"], **s["checks"], "stretched": s["stretched"], "dist_long": r1(s["dist_long_pct"])}
    if row.get("risk"):
        k = row["risk"]
        v["risk"] = {"max_dd_1y": r1(k["max_dd_1y_pct"]), "vol_1y": r1(k["vol_1y_pct"]), "loss_95_20d": r1(k["loss_95_20d_pct"]),
                     "beta_1y": k.get("beta_1y"), "corr_1y": k.get("corr_1y")}
    if long:
        v["long_run"] = {"cagr": r1(long["cagr_pct"]), "max_dd": r1(long["max_dd_pct"]), "hit_goal_12m": r1(long["hit_goal_12m_pct"]),
                         "loss_12m": r1(long["loss_12m_pct"]), "years": long["years"]}
    if status:
        v["rule_v1"] = status["status"]
    return {k: x for k, x in v.items() if x is not None}


def pick_library(lib: dict | None, limit: int) -> dict:
    scored = []
    for src in (lib or {}).get("sources", []):
        for p in src["principles"]:
            w = sum(TAG_WEIGHT.get(t, 0) for t in p["tags"])
            if w:
                scored.append((-w, p["id"], {"text": p["text"], "tags": p["tags"], "source": src["title"][:90]}))
    scored.sort(key=lambda x: (x[0], x[1]))
    return {pid.lower().replace(".", ":"): body for _, pid, body in scored[:limit]}


def build(data_dir: Path = DATA, runs_dir: Path = RUNS, today: str | None = None) -> dict:
    st, wl = settings(), watchlist()
    kb = data_dir / "kb"
    derived = load_json(data_dir / "market" / "derived.json")
    if derived.get("sample"):
        raise SystemExit("build_pack: derived.json is sample data; the brain only runs on live data")
    longrun = load_json(data_dir / "market" / "longrun.json") if (data_dir / "market" / "longrun.json").exists() else None
    regime = load_json(kb / "regime.json") if (kb / "regime.json").exists() else None
    bench = st["scoring"]["benchmark"]["symbol"]
    members = {m["symbol"]: m for m in (longrun or {}).get("members", [])}
    status = {s["symbol"]: s for s in (longrun or {}).get("now", {}).get("status", [])}
    rows = {r["symbol"]: r for r in derived["symbols"]}
    today = today or date.today().isoformat()

    names = {s["symbol"]: s for s in wl["symbols"]}
    aliases = {a: s["symbol"] for s in wl["symbols"] for a in [s["symbol"], *s.get("aliases", [])]}
    obs = load_json(kb / "observations.json") if (kb / "observations.json").exists() else {"items": []}
    live = [o for o in sorted(obs["items"], key=lambda o: o["as_of"], reverse=True)
            if o["expires"] >= today and any(t in aliases for t in o["tickers"])][:12]
    claims = {o["id"].lower(): {"text": o["text"], "tickers": o["tickers"], "as_of": o["as_of"], "expires": o["expires"],
                                "status": o.get("status", "unverified")} for o in live}

    _, strategy = parse_front_matter((DOCS / "strategy.md").read_text(encoding="utf-8"))
    learn = load_json(DOCS / "learnings.json")
    recent = []
    for p in sorted(runs_dir.glob("run.*.json"))[-st["pack"]["recent_runs"]:]:
        r = load_json(p)
        recent.append({"date": r["date"], "status": r["status"],
                       "picks": [{"ticker": x["pick"]["ticker"], "stance": x["pick"]["stance"], "conviction": x["pick"]["conviction"]} for x in r["picks"]]})
    pack = {
        "meta": {"pack_version": 1, "as_of": derived["as_of"], "built": today, "benchmark": bench,
                 "core": (wl.get("core") or {}).get("symbol"), "horizon_days": st["scoring"]["horizon_days"],
                 "max_picks": load_json(DOCS / "guardrails.json")["max_picks"],
                 "units": "percent unless named otherwise; no prices anywhere"},
        "strategy": strategy.strip(),
        "guardrails": {k: v for k, v in load_json(DOCS / "guardrails.json").items() if k not in ("version", "updated_at", "change_note")},
        "watchlist": {s.lower(): {"name": m["name"], "sector": m.get("sector")} for s, m in names.items()},
        "market": {s.lower(): symbol_view(rows[s], members.get(s), status.get(s)) for s in names if s in rows},
        "benchmark": symbol_view(rows[bench], None, None) if bench in rows else {},
        "breadth_above_sma50": derived.get("breadth_above_sma50_pct"),
        "regime": {k: regime[k] for k in ("state", "trend", "label") if regime and k in regime} | ({"metrics": regime["metrics"]} if regime else {}),
        "context": derived.get("context", {}),
        "base_rates": {k: derived["base_rates"][k] for k in ("from", "to", "horizon_days", "gate", "by_score")} if derived.get("base_rates") else {},
        "rule_v1": {"holdings": longrun["now"]["holdings"], "last_rebalance": longrun["now"]["last_rebalance"],
                    "diversification": longrun["now"]["diversification"],
                    "history": {k: longrun["stats"][k] for k in ("rule", "equal_weight", "core")}} if longrun else {},
        "library": pick_library(load_json(kb / "library.json") if (kb / "library.json").exists() else None, st["pack"]["library_principles_max"]),
        "learnings": {x["id"].lower(): x for x in learn["items"] if x.get("status") == "active"},
        "claims": claims,
        "recent_runs": recent,
    }
    return pack


def evidence_keys(pack: dict) -> set[str]:
    """Every citable path: sections, and up to three levels below them."""
    out = set()

    def walk(node, prefix, depth):
        if not isinstance(node, dict) or depth > 3:
            return
        for k, v in node.items():
            key = f"{prefix}.{k}" if prefix else k
            out.add(key)
            walk(v, key, depth + 1)
    walk(pack, "", 0)
    return {k for k in out if k == k.lower()}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / ".cache" / "pack.json"))
    ap.add_argument("--data", default=str(DATA))
    ap.add_argument("--runs", default=str(RUNS))
    args = ap.parse_args()
    st = settings()
    pack = build(Path(args.data), Path(args.runs))
    text = json.dumps(pack, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    tokens = estimate_tokens(text)
    cap = st["pack"]["token_cap"]
    digest = hashlib.sha256(text.encode()).hexdigest()
    if tokens > cap:
        print(f"build_pack: FAILED closed, {tokens} tokens > cap {cap}", file=sys.stderr)
        return 1
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"hash": digest, "tokens": tokens, "cap_tokens": cap, "pack": pack}, indent=1, ensure_ascii=False) + "\n")
    print(f"build_pack: {tokens} tokens (cap {cap}), {len(evidence_keys(pack))} citable keys, as of {pack['meta']['as_of']} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
