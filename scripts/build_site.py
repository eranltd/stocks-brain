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

    # The other markets' files are linted softly: a market with a problem is left out of the site (manifest derived: null)
    # instead of stopping the whole build; everything else still fails closed.
    bad_markets: set[str] = set()
    if not args.skip_lint:
        import lint
        lt = lint.Lint(soft_markets=True)
        if lt.run() != 0:
            print("build_site: lint failed; not exporting", file=sys.stderr)
            return 1
        bad_markets = lt.bad_markets

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
    # Technical checklist (config/checklist.json): same source rule as prices; samples are computed from the synthetic bars.
    # Its indexed candles (data/market/candles/<SYMBOL>.json, percent from the last close) go with it, one file per
    # symbol listed in manifest.candles and loaded by the Stock page only when a chart is opened.
    checklist = None
    candles: dict[str, str] = {}
    checklist_cfg = CONFIG / "checklist.json"
    if checklist_cfg.exists():
        from _common import watchlist
        on_list = {s["symbol"] for s in watchlist()["symbols"]} | {st["scoring"]["benchmark"]["symbol"]}
        if price_source == "live" and (MARKET / "checklist.json").exists():
            _copy(MARKET / "checklist.json", OUT / "market" / "checklist.json")
            checklist = "market/checklist.json"
            for p in sorted((MARKET / "candles").glob("*.json")):
                if p.stem in on_list:  # a stale file of a name taken off the list is not shown (lint warns about it)
                    _copy(p, OUT / "market" / "candles" / p.name)
                    candles[p.stem] = f"market/candles/{p.name}"
        elif price_source == "sample":
            import routines_code
            doc, charts = routines_code.checklist_and_candles(SAMPLES / "prices", st, watchlist(), load_json(checklist_cfg),
                                                              sample=True, provider="sample")
            if doc:
                dump_json(OUT / "market" / "checklist.json", doc, compact=True)
                checklist = "market/checklist.json"
                for sym, cdoc in routines_code.candle_files(charts)[0].items():
                    dump_json(OUT / "market" / "candles" / f"{sym}.json", cdoc, compact=True)
                    candles[sym] = f"market/candles/{sym}.json"
    markets = export_markets(args.source, price_source, st, checklist, candles, skip=bad_markets)
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
                *(("people",) if people_cfg.exists() else ()), *(("outlook",) if (CONFIG / "outlook.json").exists() else ()),
                *(("checklist",) if checklist_cfg.exists() else ()), *(("markets",) if (CONFIG / "markets.json").exists() else ()),
                *(("funds",) if (CONFIG / "funds.json").exists() else ()))
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
        "checklist": checklist,
        "candles": candles or None,
        "markets": markets,
        "kb": kb,
        "docs": docs,
    })
    print(f"build_site: picks {source}, prices {price_source} (derived), {len(runs)} runs -> {OUT}")
    return 0


def export_markets(source_arg: str, price_source: str, st: dict, checklist: str | None, candles: dict[str, str],
                   skip: set[str] = frozenset()) -> dict | None:
    """manifest.markets: {id: {label, name, note, kind, benchmark, benchmark_label, default, sample, derived, checklist,
    candles: {SYMBOL: path} | None, watchlist}} in config/markets.json order, or None without that file.

    The default market points at the files exported above (market/...). Each other market goes live on its own when
    data/markets/<id>/derived.json exists, and follows the same rule as the main prices otherwise: sample numbers are
    computed from the synthetic bars only when the main prices are samples too (never sample numbers next to live
    prices), so a market with no live data yet has derived: null. A market in `skip` (its published files failed lint)
    is exported with derived: null too. Its watchlist is copied to config/watchlists/."""
    from _common import ROOT, market_watchlist, markets_config
    if not (CONFIG / "markets.json").exists():
        return None
    import routines_code
    mc = markets_config()
    cfg = routines_code.checklist_config()
    out: dict = {}
    for m in mc["markets"]:
        base = {k: m[k] for k in ("label", "name", "note", "kind", "benchmark", "benchmark_label")}
        if m["id"] == mc["default"]:
            out[m["id"]] = {**base, "default": True, "sample": price_source == "sample", "derived": "market/derived.json",
                            "checklist": checklist, "candles": candles or None, "watchlist": "config/watchlist.json"}
            continue
        wl_path = f"config/watchlists/{m['id']}.json"
        _copy(ROOT / m["watchlist"], OUT / wl_path)
        live_dir = ROOT / m["data"]
        src = source_arg if source_arg != "auto" else ("live" if (live_dir / "derived.json").exists() else price_source)
        entry = {**base, "default": False, "sample": src == "sample", "derived": None, "checklist": None, "candles": None,
                 "watchlist": wl_path}
        rel = f"markets/{m['id']}"
        if m["id"] in skip:
            print(f"build_site: market {m['id']} left out (its published files failed lint; see the warnings)", file=sys.stderr)
        elif src == "live" and (live_dir / "derived.json").exists():
            _copy(live_dir / "derived.json", OUT / rel / "derived.json")
            entry["derived"] = f"{rel}/derived.json"
            if (live_dir / "checklist.json").exists():
                _copy(live_dir / "checklist.json", OUT / rel / "checklist.json")
                entry["checklist"] = f"{rel}/checklist.json"
                on_list = {s["symbol"] for s in market_watchlist(m)["symbols"]} | {m["benchmark"]}
                files = {p.stem: p for p in sorted((live_dir / "candles").glob("*.json")) if p.stem in on_list}
                for sym, p in files.items():
                    _copy(p, OUT / rel / "candles" / p.name)
                entry["candles"] = {sym: f"{rel}/candles/{sym}.json" for sym in files} or None
        elif src == "sample":
            try:
                res = routines_code.compute_market(m, SAMPLES / "prices", st, cfg, sample=True, provider="sample")
            except SystemExit as exc:  # e.g. sample bars not generated for a new market yet: the market shows no data
                print(f"build_site: no sample data for market {m['id']}: {exc}", file=sys.stderr)
            else:
                dump_json(OUT / rel / "derived.json", res["derived"], compact=True)
                entry["derived"] = f"{rel}/derived.json"
                if res["checklist"]:
                    dump_json(OUT / rel / "checklist.json", res["checklist"], compact=True)
                    entry["checklist"] = f"{rel}/checklist.json"
                    for sym, doc in res["candles"].items():
                        dump_json(OUT / rel / "candles" / f"{sym}.json", doc, compact=True)
                    entry["candles"] = {sym: f"{rel}/candles/{sym}.json" for sym in res["candles"]} or None
        out[m["id"]] = entry
    return out


def _copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


if __name__ == "__main__":
    sys.exit(main())
