#!/usr/bin/env python3
"""Build the brain's context pack (M3): one capped JSON document of DERIVED numbers and curated text.

The brain reads only this pack and cites evidence by pack key (lowercase dot paths such as
`market.nvda.setup`, `library.s-028:p02`, `people.calls.nvda`, `people.fund.berkshire-hathaway` or
`outlook.next_earnings.nvda`). Numbers come from code; the pack carries no raw prices.
Fails closed when the pack is over `pack.token_cap` (settings).

Usage: python3 scripts/build_pack.py [--out .cache/pack.json] [--data DIR] [--runs DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import CONFIG, DATA, DOCS, ROOT, RUNS, load_json, parse_front_matter, settings, watchlist  # noqa: E402

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


PEOPLE_CALLS_PER_NAME = 3  # the newest public calls per watchlist name; keeps the pack under its cap as the ledger grows
PEOPLE_NOTE = ("context only: public calls of people we follow and how they have done against the core (signed excess in percent: "
               "above zero means the call was right); never the only evidence for a pick. A 13F call is the fund's disclosed book: "
               "name the fund (via), not the person, and follow any note on the call. A call with no person is the firm's own "
               "and counts only in people.fund")


def fund_key(via: str) -> str:
    """'Berkshire Hathaway Inc' -> 'berkshire-hathaway': a citable, lowercase key for people.fund."""
    short = re.sub(r",?\s+(Inc\.?|LLC|LLP|L\.P\.|LP)$", "", via, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "-", short.lower()).strip("-")


def _rec(p: dict) -> dict:
    return {"scored": p["scored"], "matured_26w": p["matured_26w"], "right_26w_pct": r1(p["right_26w_pct"]),
            "median_signed_excess_26w": r1(p["median_signed_excess_26w"]), "enough": p["enough"]}


def people_block(scores: dict | None, on_list: set[str], cfg: dict | None = None) -> dict:
    """Compact view of data/people/scores.json. Keys stay citable: people.record.<person id>, people.fund.<fund>,
    people.calls.<ticker>. A call the config marks as the firm's own (credit_person false) carries no person."""
    if not scores or scores.get("sample"):
        return {"note": PEOPLE_NOTE, "record": {}, "fund": {}, "calls": {}}
    notes = {c["id"]: c["note"] for c in (cfg or {}).get("calls", []) if c.get("note")}
    kinds = {c["id"]: c["source_kind"] for c in (cfg or {}).get("calls", [])}
    record = {p["person"]: {"name": p["name"], "via": p["vias"], **_rec(p)} for p in scores["people"]}
    fund = {fund_key(v["via"]): {"name": v["via"], "persons": v["persons"], **_rec(v)} for v in scores["vias"]}
    calls: dict[str, list] = {}
    for c in sorted(scores["calls"], key=lambda c: c["date"], reverse=True):
        if c["ticker"] in on_list and len(calls.get(c["ticker"].lower(), [])) < PEOPLE_CALLS_PER_NAME:
            row = {"via": c["via"], "fund": fund_key(c["via"])}
            if c.get("credit_person", True):
                row["person"] = c["person"]
            row.update({"stance": c["stance"], "date": c["date"], "source_kind": kinds.get(c["id"]), "weeks_since": c["weeks_since"],
                        "signed_excess_so_far": r1((c["so_far"] or {}).get("signed_excess_pct"))})
            if notes.get(c["id"]):
                row["note"] = notes[c["id"]]
            calls.setdefault(c["ticker"].lower(), []).append({k: v for k, v in row.items() if v is not None})
    return {"note": PEOPLE_NOTE, "as_of": scores["as_of"], "min_matured": scores["min_matured"], "record": record, "fund": fund, "calls": calls}


OUTLOOK_NOTE = ("company statements and dates, context only; never evidence that a stock will beat the index; an earnings date "
                "within about two weeks is event risk")


def outlook_block(cfg: dict | None, on_list: set[str], today: str) -> dict:
    """Compact view of config/outlook.json: the next earnings date per watchlist name (days from `today`, whether the
    company confirmed it; dates already past are left out) and whether the company gives its own guidance. Citable as outlook.next_earnings.<ticker>
    and outlook.guidance.<ticker>; empty when the file has no companies."""
    nxt, guid = {}, {}
    for c in (cfg or {}).get("companies", []):
        t = c["ticker"]
        if t not in on_list:
            continue
        ne = c["next_earnings"]
        if ne.get("date") and ne["date"] >= today:  # a past date means new results are out and the card is due a refresh
            nxt[t.lower()] = {"date": ne["date"], "days": (date.fromisoformat(ne["date"]) - date.fromisoformat(today)).days,
                              "confirmed": bool(ne["confirmed"])}
        guid[t.lower()] = "given" if c["guidance"]["given"] else "none"
    return {"note": OUTLOOK_NOTE, "next_earnings": nxt, "guidance": guid}


def build(data_dir: Path = DATA, runs_dir: Path = RUNS, today: str | None = None, outlook: dict | None = None) -> dict:
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

    rules_res = load_json(data_dir / "market" / "rules.json") if (data_dir / "market" / "rules.json").exists() else None
    rules_history = {}
    if rules_res and not rules_res.get("sample") and rules_res.get("frozen"):
        sat = {r["id"]: r for r in (rules_res.get("satellite") or {}).get("rules", [])}
        ctrl = (rules_res.get("satellite") or {}).get("controls", {})
        rules_history = {
            "frozen_on": rules_res["frozen"]["as_of"], "tries_counted": rules_res["tries_counted"],
            "note": "history verdicts of the pre-registered stock rules against 2000 random baskets from the same list, read once and frozen; beat_random_pct is the share of random baskets beaten",
            "verdicts": {rid: {"verdict": v["verdict"], "beat_random_pct": r1(v["percentile"]), "cagr": r1(sat[rid]["stats"]["cagr_pct"]),
                               "turnover_pct_year": r1(sat[rid]["turnover_pct_year"])}
                         for rid, v in rules_res["frozen"]["satellite"].items() if rid in sat},
            "yardsticks": {"core_cagr": r1(ctrl.get("core", {}).get("cagr_pct")), "all_names_equal_cagr": r1(ctrl.get("equal_weight", {}).get("cagr_pct"))},
        }
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
        "rules_history": rules_history,
        "library": pick_library(load_json(kb / "library.json") if (kb / "library.json").exists() else None, st["pack"]["library_principles_max"]),
        "learnings": {x["id"].lower(): x for x in learn["items"] if x.get("status") == "active"},
        "claims": claims,
        "people": people_block(load_json(data_dir / "people" / "scores.json") if (data_dir / "people" / "scores.json").exists() else None, set(names),
                               load_json(CONFIG / "people.json") if (CONFIG / "people.json").exists() else None),
        "outlook": outlook_block(outlook if outlook is not None else (load_json(CONFIG / "outlook.json") if (CONFIG / "outlook.json").exists() else None),
                                 set(names), today),
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
