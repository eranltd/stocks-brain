#!/usr/bin/env python3
"""Export the dashboard's public JSON into site/public/data/ (Vite serves and bundles it from there).

Uses live data (runs/, data/kb, data/prices, docs/learnings.json) when any run exists, otherwise
samples/. Runs lint first and refuses to export on lint errors (fail closed).

Usage:
  python3 scripts/build_site.py [--source auto|live|sample] [--skip-lint]
  cd site && npm ci && npm run build      # -> _site/
"""
from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    CONFIG, DATA, DOCS, EXTRA_MD_DOCS, JSON_DOCS, KB, MARKET, MD_DOCS, RUNS, SAMPLES, SITE, dump_json, load_json,
    parse_front_matter, settings,
)

OUT = SITE / "public" / "data"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=("auto", "live", "sample"), default="auto")
    ap.add_argument("--skip-lint", action="store_true")
    args = ap.parse_args()

    if not args.skip_lint:
        import lint
        if lint.Lint().run() != 0:
            print("build_site: lint failed; not exporting", file=sys.stderr)
            return 1

    # Each dataset goes live on its own: prices can be real while picks are still samples.
    def pick(has_live: bool) -> str:
        return args.source if args.source != "auto" else ("live" if has_live else "sample")
    source = pick(any(RUNS.glob("run.*.json")))
    price_source = pick((MARKET / "derived.json").exists())
    live = source == "live"
    runs_dir = RUNS if live else SAMPLES / "runs"
    kb_dir = KB if live else SAMPLES / "kb"
    regime_dir = KB if price_source == "live" else SAMPLES / "kb"
    learnings = DOCS / "learnings.json" if live else SAMPLES / "docs" / "learnings.json"

    shutil.rmtree(OUT, ignore_errors=True)
    st = settings()
    runs = sorted(runs_dir.glob("run.*.json"))
    for p in runs:
        _copy(p, OUT / "runs" / p.name)
    # Prices: derived numbers only (no raw bars). Samples are derived on the fly from synthetic bars.
    if price_source == "live":
        _copy(MARKET / "derived.json", OUT / "market" / "derived.json")
    else:
        import routines_code
        from _common import watchlist
        dump_json(OUT / "market" / "derived.json",
                  routines_code.compute_derived(SAMPLES / "prices", st, watchlist(), sample=True, provider="sample"), compact=True)
    # Goal and portfolio rule: same source as prices (never sample numbers next to live prices).
    longrun = None
    if price_source == "live" and (MARKET / "longrun.json").exists():
        _copy(MARKET / "longrun.json", OUT / "market" / "longrun.json")
        longrun = "market/longrun.json"
    elif price_source == "sample":
        import routines_code
        from _common import watchlist
        doc = routines_code.compute_longrun(SAMPLES / "prices", st, watchlist(), sample=True, provider="sample")
        if doc:
            dump_json(OUT / "market" / "longrun.json", doc, compact=True)
            longrun = "market/longrun.json"
    # Rule backtests: same source rule as prices.
    rules_result = None
    rules_cfg = CONFIG / "rules.json"
    if rules_cfg.exists():
        if price_source == "live" and (MARKET / "rules.json").exists():
            _copy(MARKET / "rules.json", OUT / "market" / "rules.json")
            rules_result = "market/rules.json"
        elif price_source == "sample":
            import routines_code
            from _common import watchlist
            doc = routines_code.compute_rules(SAMPLES / "prices", st, watchlist(), load_json(rules_cfg), sample=True, provider="sample", runs=60)
            if doc:
                dump_json(OUT / "market" / "rules.json", doc, compact=True)
                rules_result = "market/rules.json"
    ledger = DATA / "portfolio" / "paper_rules.json"
    if price_source == "live" and ledger.exists():
        _copy(ledger, OUT / "portfolio" / "paper_rules.json")
    paper = DATA / "portfolio" / "paper.json"
    if price_source == "live" and paper.exists():
        _copy(paper, OUT / "portfolio" / "paper.json")
    # People we learn from: their calls' scores, same source rule as prices (computed from the sample closes in sample mode).
    people_scores = None
    people_cfg = CONFIG / "people.json"
    if people_cfg.exists():
        if price_source == "live" and (DATA / "people" / "scores.json").exists():
            _copy(DATA / "people" / "scores.json", OUT / "people" / "scores.json")
            people_scores = "people/scores.json"
        elif price_source == "sample":
            import routines_code
            from _common import watchlist
            doc = routines_code.compute_people(SAMPLES / "prices", load_json(people_cfg), watchlist(), sample=True)
            if doc:
                dump_json(OUT / "people" / "scores.json", doc)
                people_scores = "people/scores.json"
    kb = {}
    # Curated knowledge (library, observations) is always the real file once it has content.
    def curated(name: str, key: str) -> Path:
        live_path = KB / f"{name}.json"
        return KB if live_path.exists() and load_json(live_path)[key] else SAMPLES / "kb"
    for name, base in (("outcomes", kb_dir), ("library", curated("library", "sources")),
                       ("observations", curated("observations", "items")),
                       ("calibration", kb_dir), ("regime", regime_dir)):
        if (base / f"{name}.json").exists():
            _copy(base / f"{name}.json", OUT / "kb" / f"{name}.json")
            kb[name] = f"kb/{name}.json"
    cfg_docs = ("watchlist", "settings", "sources", "routines", *(("rules",) if (CONFIG / "rules.json").exists() else ()),
                *(("people",) if people_cfg.exists() else ()), *(("outlook",) if (CONFIG / "outlook.json").exists() else ()))
    for name in cfg_docs:
        _copy(CONFIG / f"{name}.json", OUT / "config" / f"{name}.json")

    docs = []
    for name in (*MD_DOCS, *EXTRA_MD_DOCS):
        meta, _ = parse_front_matter((DOCS / f"{name}.md").read_text(encoding="utf-8"))
        _copy(DOCS / f"{name}.md", OUT / "docs" / f"{name}.md")
        docs.append({"name": name, "file": f"docs/{name}.md", "path": f"docs/{name}.md", **meta})
    for name in JSON_DOCS:
        src = learnings if name == "learnings" else DOCS / f"{name}.json"
        obj = load_json(src)
        _copy(src, OUT / "docs" / f"{name}.json")
        docs.append({"name": name, "file": f"docs/{name}.json", "path": f"docs/{name}.json",
                     **{k: obj[k] for k in ("version", "updated_at", "change_note")}})
    for name in cfg_docs:
        obj = load_json(CONFIG / f"{name}.json")
        docs.append({"name": name, "file": f"config/{name}.json", "path": f"config/{name}.json",
                     **{k: obj[k] for k in ("version", "updated_at", "change_note")}})

    ops = DATA / "ops" / "routine_runs.json"
    if ops.exists():
        _copy(ops, OUT / "ops" / "routine_runs.json")

    dump_json(OUT / "manifest.json", {
        "ops": "ops/routine_runs.json" if ops.exists() else None,
        "source": source,
        "price_source": price_source,
        "price_provider": st["prices"]["provider"],
        "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "repo": st["site"]["repo"],
        "runs": [f"runs/{p.name}" for p in runs],
        "runs_shown": st["site"]["runs_shown"],
        "market": "market/derived.json",
        "longrun": longrun,
        "rules_result": rules_result,
        "paper_rules": "portfolio/paper_rules.json" if price_source == "live" and ledger.exists() else None,
        "paper": "portfolio/paper.json" if price_source == "live" and paper.exists() else None,
        "people_scores": people_scores,
        "kb": kb,
        "docs": docs,
    })
    print(f"build_site: picks {source}, prices {price_source} (derived), {len(runs)} runs -> {OUT}")
    return 0


def _copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


if __name__ == "__main__":
    sys.exit(main())
