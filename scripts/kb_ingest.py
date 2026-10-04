#!/usr/bin/env python3
"""Append a batch of sources (principles + dated observations) to the KB.

Assigns ids (S-###, S-###.P##, O-####), strips invisible characters, skips sources whose
`ref` is already in the library, bumps versions, schema-validates, and only then writes.

Batch file (JSON):
{
  "change_note": "Batch 3: ...",
  "sources": [{
    "kind": "video", "ref": "youtube:<id>", "title": "...", "author": "...", "year": 2026, "published": "YYYY-MM-DD",
    "principles": [["Our own words, <= 280 chars.", ["tag", "tag"]], ...],
    "observations": [{"as_of": "YYYY-MM-DD", "expires": "YYYY-MM-DD", "kind": "market|company|sector|theme",
                      "tickers": ["XYZ"], "text": "...", "tags": ["tag"]}, ...]
  }]
}
Usage: python3 scripts/kb_ingest.py BATCH.json [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import KB, Validator, dump_json, load_json  # noqa: E402


def clean(value):
    """Recursively drop Unicode format characters (e.g. U+2060 word joiners from pasted IDs)."""
    if isinstance(value, str):
        return "".join(c for c in value if unicodedata.category(c) != "Cf").strip()
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    return value


def bump(version: str) -> str:
    major, minor, _ = (int(x) for x in version.split("."))
    return f"{major}.{minor + 1}.0"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("batch")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    batch = clean(load_json(Path(args.batch)))
    today = datetime.now(timezone.utc).date().isoformat()
    lib = load_json(KB / "library.json")
    obs = load_json(KB / "observations.json")
    known = {s.get("ref") for s in lib["sources"]}
    next_s = max((int(s["id"][2:]) for s in lib["sources"]), default=0) + 1
    next_o = max((int(o["id"][2:]) for o in obs["items"]), default=0) + 1
    added_s = added_p = added_o = 0

    for src in batch["sources"]:
        if src["ref"] in known:
            print(f"skip {src['ref']}: already in the library")
            continue
        sid = f"S-{next_s:03d}"
        next_s += 1
        lib["sources"].append({
            "id": sid, "kind": src["kind"], "ref": src["ref"], "title": src["title"], "author": src["author"],
            "year": src.get("year"), "added": today,
            **({"published": src["published"]} if src.get("published") else {}),
            "principles": [{"id": f"{sid}.P{i:02d}", "text": t, "tags": tags}
                           for i, (t, tags) in enumerate(src["principles"], 1)],
        })
        for o in src.get("observations", []):
            obs["items"].append({"id": f"O-{next_o:04d}", "source_id": sid, "as_of": o["as_of"], "expires": o["expires"],
                                 "kind": o["kind"], "tickers": o.get("tickers", []), "text": o["text"],
                                 "tags": o["tags"], "status": "unverified"})
            next_o += 1
            added_o += 1
        known.add(src["ref"])
        added_s += 1
        added_p += len(src["principles"])

    if not added_s:
        print("kb_ingest: nothing new")
        return 0
    for doc in (lib, obs):
        doc.update(version=bump(doc["version"]), updated_at=today, change_note=batch["change_note"][:300])

    v = Validator()
    errs = v.validate(lib, "library.schema.json") + v.validate(obs, "observations.schema.json")
    quotes = [o["id"] for o in obs["items"] if o["text"].count('"') >= 2]
    quotes += [p["id"] for s in lib["sources"] for p in s["principles"] if p["text"].count('"') >= 2]
    bad_dates = [o["id"] for o in obs["items"] if o["expires"] <= o["as_of"]]
    problems = errs + [f"{i}: looks like a quotation" for i in quotes] + [f"{i}: expires before as_of" for i in bad_dates]
    if problems:
        print("kb_ingest: FAILED, nothing written:", *problems[:20], sep="\n  ", file=sys.stderr)
        return 1
    print(f"kb_ingest: +{added_s} sources, +{added_p} principles, +{added_o} observations"
          f" -> library v{lib['version']}, observations v{obs['version']}")
    if not args.dry_run:
        dump_json(KB / "library.json", lib)
        dump_json(KB / "observations.json", obs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
