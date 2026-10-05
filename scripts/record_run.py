#!/usr/bin/env python3
"""Record one brain run (M3): validate the brain's picks against the pack and the rules, then write
runs/run.<date>.json. Fails closed: nothing is written unless every check passes.

The brain returns `{"summary": "...", "picks": [...]}` (prompts/brain.md). Code then:
  - checks each pick against schemas/pick.schema.json and docs/guardrails.json (watchlist only, no digits in prose,
    no banned phrases, at most max_picks, unique tickers)
  - checks every evidence key resolves to a key in the pack the brain was given
  - attaches the reference DATE (the pack's market close); returns are computed by code at scoring time from the
    adjusted series, so no raw price is ever published (provider licence)
  - records cost, pack hash and token counts, and the version of every instruction doc

Usage: python3 scripts/record_run.py --pack .cache/pack.json --picks picks.json --model "Claude Code session"
                                     --minutes 12 [--usd 0] [--input-tokens N] [--output-tokens N] [--runs DIR]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DOCS, RUNS, Validator, doc_versions, dump_json, load_json, settings, watchlist  # noqa: E402
from build_pack import estimate_tokens, evidence_keys  # noqa: E402

PROSE = ("thesis", "invalidation")


def check_picks(out: dict, pack: dict, guard: dict, on_list: set[str]) -> list[str]:
    errs = []
    v = Validator()
    if not isinstance(out, dict) or set(out) != {"summary", "picks"}:
        return ["brain output must be exactly {summary, picks}"]
    if not isinstance(out["summary"], str) or not 10 <= len(out["summary"]) <= 600:
        errs.append("summary must be 10 to 600 characters")
    picks = out["picks"]
    if len(picks) > guard["max_picks"]:
        errs.append(f"{len(picks)} picks > max_picks {guard['max_picks']}")
    keys = evidence_keys(pack)
    seen = set()
    banned = [b.lower() for b in guard["banned_phrases"]]
    texts = [out["summary"]]
    for i, p in enumerate(picks):
        errs += [f"pick {i}: {e}" for e in v.validate(p, "pick.schema.json")]
        t = p.get("ticker")
        if t in seen:
            errs.append(f"pick {i}: duplicate ticker {t}")
        seen.add(t)
        if guard["picks_must_be_on_watchlist"] and t not in on_list:
            errs.append(f"pick {i}: {t} is not on the watchlist")
        if p.get("stance") not in guard["allowed_stances"]:
            errs.append(f"pick {i}: stance {p.get('stance')!r} not allowed")
        prose = [p.get(k, "") for k in PROSE] + list(p.get("risks", []))
        if guard["no_digits_in_pick_text"] and any(re.search(r"\d", x) for x in prose):
            errs.append(f"pick {i}: digits in thesis, risks or invalidation (code attaches numbers)")
        texts += prose
        for e in p.get("evidence", []):
            if e not in keys:
                errs.append(f"pick {i}: evidence {e!r} is not a key in the pack")
    for b in banned:
        if any(b in x.lower() for x in texts):
            errs.append(f"banned phrase {b!r}")
    return errs


def make_run(out: dict, packfile: dict, model: str, minutes: float, usd: float, tin: int | None, tout: int | None) -> dict:
    st = settings()
    pack = packfile["pack"]
    day = pack["meta"]["as_of"]
    return {
        "schema_version": 1, "run_id": f"run.{day}", "date": day,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "status": "ok", "sample": False, "model": model,
        "cost": {"usd": usd, "input_tokens": tin if tin is not None else packfile["tokens"],
                 "output_tokens": tout if tout is not None else estimate_tokens(json.dumps(out)), "cap_usd": st["cost"]["hard_cap_usd"]},
        "duration_minutes": minutes,
        "pack": {"hash": packfile["hash"], "tokens": packfile["tokens"], "cap_tokens": packfile["cap_tokens"]},
        "doc_versions": doc_versions(), "repair_retries": 0, "summary": out["summary"],
        "picks": [{"id": f"{day}:{p['ticker']}", "ref_date": day, "pick": p} for p in out["picks"]],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", required=True)
    ap.add_argument("--picks", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--minutes", type=float, required=True)
    ap.add_argument("--usd", type=float, default=0.0)
    ap.add_argument("--input-tokens", type=int)
    ap.add_argument("--output-tokens", type=int)
    ap.add_argument("--runs", default=str(RUNS))
    args = ap.parse_args()
    packfile = load_json(Path(args.pack))
    out = load_json(Path(args.picks))
    guard = load_json(DOCS / "guardrails.json")
    on_list = {s["symbol"] for s in watchlist()["symbols"]}
    errs = check_picks(out, packfile["pack"], guard, on_list)
    run = make_run(out, packfile, args.model, args.minutes, args.usd, args.input_tokens, args.output_tokens) if not errs else None
    if run:
        errs += Validator().validate(run, "run.schema.json")
        if run["cost"]["usd"] > run["cost"]["cap_usd"]:
            errs.append("cost over cap")
    path = Path(args.runs) / f"run.{packfile['pack']['meta']['as_of']}.json"
    if path.exists():
        errs.append(f"{path.name} already exists: one run per market day")
    if errs:
        print("record_run: FAILED closed, nothing written:", *errs, sep="\n  ", file=sys.stderr)
        return 1
    dump_json(path, run)
    print(f"record_run: {len(run['picks'])} picks -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
