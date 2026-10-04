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
    CONFIG, DOCS, JSON_DOCS, KB, MD_DOCS, PRICES, RUNS, SAMPLES, SITE, dump_json, load_json,
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

    has_live = any(RUNS.glob("run.*.json"))
    source = args.source if args.source != "auto" else ("live" if has_live else "sample")
    live = source == "live"
    runs_dir = RUNS if live else SAMPLES / "runs"
    kb_dir = KB if live else SAMPLES / "kb"
    prices_dir = PRICES if live else SAMPLES / "prices"
    learnings = DOCS / "learnings.json" if live else SAMPLES / "docs" / "learnings.json"

    shutil.rmtree(OUT, ignore_errors=True)
    st = settings()
    runs = sorted(runs_dir.glob("run.*.json"))
    for p in runs:
        _copy(p, OUT / "runs" / p.name)
    prices = sorted(prices_dir.glob("*.json"))
    for p in prices:
        _copy(p, OUT / "prices" / p.name)
    kb = {}
    for name in ("outcomes", "library"):
        if (kb_dir / f"{name}.json").exists():
            _copy(kb_dir / f"{name}.json", OUT / "kb" / f"{name}.json")
            kb[name] = f"kb/{name}.json"
    for name in ("watchlist", "settings", "sources", "routines"):
        _copy(CONFIG / f"{name}.json", OUT / "config" / f"{name}.json")

    docs = []
    for name in MD_DOCS:
        meta, _ = parse_front_matter((DOCS / f"{name}.md").read_text(encoding="utf-8"))
        _copy(DOCS / f"{name}.md", OUT / "docs" / f"{name}.md")
        docs.append({"name": name, "file": f"docs/{name}.md", "path": f"docs/{name}.md", **meta})
    for name in JSON_DOCS:
        src = learnings if name == "learnings" else DOCS / f"{name}.json"
        obj = load_json(src)
        _copy(src, OUT / "docs" / f"{name}.json")
        docs.append({"name": name, "file": f"docs/{name}.json", "path": f"docs/{name}.json",
                     **{k: obj[k] for k in ("version", "updated_at", "change_note")}})
    for name in ("watchlist", "settings", "sources", "routines"):
        obj = load_json(CONFIG / f"{name}.json")
        docs.append({"name": name, "file": f"config/{name}.json", "path": f"config/{name}.json",
                     **{k: obj[k] for k in ("version", "updated_at", "change_note")}})

    dump_json(OUT / "manifest.json", {
        "source": source,
        "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "repo": st["site"]["repo"],
        "runs": [f"runs/{p.name}" for p in runs],
        "runs_shown": st["site"]["runs_shown"],
        "prices": [f"prices/{p.name}" for p in prices],
        "kb": kb,
        "docs": docs,
    })
    print(f"build_site: {source} data, {len(runs)} runs, {len(prices)} price files -> {OUT}")
    return 0


def _copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


if __name__ == "__main__":
    sys.exit(main())
