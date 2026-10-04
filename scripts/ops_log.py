#!/usr/bin/env python3
"""Append one workflow run to data/ops/routine_runs.json (keeps the newest 500).

Called from the workflow with `if: always()`, so failures are recorded too. Step outcomes come
from the environment as ROUTINE_<NAME>=<success|failure|skipped|cancelled>.

Usage: python3 scripts/ops_log.py --workflow daily --trigger schedule --started 2026-10-04T23:40:00Z \
         --run-id 123 --url https://github.com/o/r/actions/runs/123 [--note "..."]
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DATA, Validator, dump_json, load_json  # noqa: E402

LOG = DATA / "ops" / "routine_runs.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workflow", required=True)
    ap.add_argument("--trigger", required=True)
    ap.add_argument("--started", required=True)
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--note", default="")
    args = ap.parse_args()

    steps = [{"routine": k[len("ROUTINE_"):].lower(), "outcome": v}
             for k, v in sorted(os.environ.items()) if k.startswith("ROUTINE_") and v]
    outcomes = {s["outcome"] for s in steps}
    ran = outcomes - {"skipped"}
    status = ("skipped" if not ran else "failure" if ran <= {"failure", "cancelled"}
              else "partial" if outcomes & {"failure", "cancelled"} else "success")
    now = datetime.now(timezone.utc).replace(microsecond=0)
    entry = {"run_id": str(args.run_id), "workflow": args.workflow,
             "trigger": args.trigger if args.trigger in ("schedule", "workflow_dispatch", "push") else "manual",
             "started_at": args.started, "finished_at": now.isoformat().replace("+00:00", "Z"),
             "status": status, "steps": steps, "url": args.url}
    if args.note:
        entry["note"] = args.note[:300]
    log = load_json(LOG)
    log["items"] = [e for e in log["items"] if e["run_id"] != entry["run_id"]] + [entry]
    log["items"] = log["items"][-500:]
    log["updated_at"] = now.date().isoformat()
    log["change_note"] = f"Run {entry['run_id']}: {status}."
    errs = Validator().validate(log, "ops_log.schema.json")
    if errs:
        print("ops_log: schema check failed, not written:", errs[:5], file=sys.stderr)
        return 1
    dump_json(LOG, log)
    print(f"ops_log: {args.workflow} run {entry['run_id']} -> {status} ({len(steps)} steps)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
