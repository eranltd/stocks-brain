#!/usr/bin/env python3
"""Fetch daily bars into .cache/prices/<SYMBOL>.json (git-ignored).

Raw bars are never committed: the provider's terms forbid redistribution. Public output is derived numbers only
(data/market/derived.json and, for the other markets, data/markets/<id>/), written by routines_code.py.

Two scopes, each its own Action run hours apart, because Tiingo's free plan allows 50 requests an hour
(config/settings.json prices.requests_per_hour) and both together would need 49:
  nasdaq   the default market: watchlist, benchmark and market-context instruments (the daily run)
  markets  every other market in config/markets.json: its list and its benchmark (the markets run)
A run makes at most prices.max_requests_per_run HTTP requests, retries included, and logs how many it used.

Fail closed per market: every symbol is fetched once, merged with what is on disk, trimmed to prices.keep_days,
sanity-checked and schema-validated in memory. A market is written only if all its symbols pass; a failed market
writes nothing and the others still do (the nasdaq scope is one market, so it stays all-or-nothing). Exit 1 if any
market failed.

Usage: python3 scripts/fetch_prices.py [--scope nasdaq|markets] [--dry-run] [--fixtures DIR]
  --fixtures DIR  read <DIR>/<SYMBOL>.json|.csv (the provider's raw format) instead of the network
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import CONFIG, PRICES, Validator, dump_json, fetch_plan, load_json, scope_symbols, settings  # noqa: E402
import providers  # noqa: E402

RETRIES = 3


def symbols(scope: str = "nasdaq") -> list[str]:
    """The unique symbols one fetch run requests (one request each, before retries)."""
    return scope_symbols(fetch_plan()[scope])


def check_provider(name: str | None) -> None:
    src = {s["id"]: s for s in load_json(CONFIG / "sources.json")["sources"]}.get("prices")
    if not src or src["status"] != "active" or src["provider"] != name:
        raise SystemExit(f"sources.json 'prices' must be active with provider {name!r} (fail closed)")


def redact(msg: str) -> str:
    """Drop numeric values from a validation message so no price reaches a public log."""
    return re.sub(r"-?\d+(\.\d+)?(e-?\d+)?(?= (<|>|<=|>=) )", "<value>", msg)


def merge(old: list[dict], new: list[dict], keep: int) -> list[dict]:
    by_date = {b["date"]: b for b in old}
    by_date.update({b["date"]: b for b in new})  # provider wins on overlap (corrections)
    return [by_date[d] for d in sorted(by_date)][-keep:]


def sanity(sym: str, bars: list[dict]) -> list[str]:
    errs = []
    today = datetime.now(timezone.utc).date()
    for b in bars:
        if not b["low"] <= min(b["open"], b["close"]) <= max(b["open"], b["close"]) <= b["high"]:
            errs.append(f"{sym} {b['date']}: OHLC out of order")
        if date.fromisoformat(b["date"]) > today:
            errs.append(f"{sym} {b['date']}: date in the future")
    if bars and (today - date.fromisoformat(bars[-1]["date"])) > timedelta(days=10):
        errs.append(f"{sym}: last bar {bars[-1]['date']} is more than 10 days old")
    return errs


class Budget:
    """At most `cap` HTTP requests this run, retries included. Counts the provider's own counter when it keeps one
    (providers.tiingo.REQUESTS), otherwise one per symbol tried."""

    def __init__(self, provider, cap: int):
        self.provider, self.cap, self.tried = provider, cap, 0
        self.start = getattr(provider, "REQUESTS", None)

    def used(self) -> int:
        n = getattr(self.provider, "REQUESTS", None)
        return self.tried if n is None or self.start is None else n - self.start

    def retries(self) -> int:
        """How many attempts the next symbol may make (0 = the budget is spent)."""
        return max(0, min(RETRIES, self.cap - self.used()))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", choices=("nasdaq", "markets"), default="nasdaq")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixtures")
    args = ap.parse_args()

    st = settings()
    name = st["prices"]["provider"]
    check_provider(name)
    provider = providers.get(name)
    keep = st["prices"]["keep_days"]
    cap, hourly = st["prices"]["max_requests_per_run"], st["prices"]["requests_per_hour"]
    groups = fetch_plan(st)[args.scope]
    syms = scope_symbols(groups)
    if len(syms) > cap:  # lint refuses this config too; checked here so a hand edit cannot burn the hourly quota
        print(f"fetch_prices: {len(syms)} symbols in scope {args.scope} exceed max_requests_per_run {cap}; nothing fetched",
              file=sys.stderr)
        return 1
    v = Validator()
    budget = Budget(provider, cap)
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    print(f"fetch_prices: scope {args.scope}, {len(syms)} symbols for {len(groups)} market(s); "
          f"budget {cap} requests this run (provider plan: {hourly} an hour)")

    staged: dict[str, dict] = {}
    errors: dict[str, list[str]] = {}
    for sym in syms:
        try:
            if args.fixtures:
                fx = next(p for p in (Path(args.fixtures) / f"{sym}.json", Path(args.fixtures) / f"{sym}.csv") if p.exists())
                new = provider.parse(fx.read_text(), sym)
            else:
                tries = budget.retries()
                if not tries:
                    raise RuntimeError(f"{sym}: request budget of {cap} for this run is spent; not requested")
                budget.tried += 1
                new = provider.fetch_daily(sym, keep_days=keep, retries=tries)
        except Exception as exc:  # noqa: BLE001  (any provider failure fails the symbol's market)
            errors.setdefault(sym, []).append(str(exc))
            continue
        path = PRICES / f"{sym}.json"
        old = load_json(path)["bars"] if path.exists() else []
        doc = {"symbol": sym, "provider": name, "currency": "USD", "fetched_at": fetched_at,
               "sample": False, "bars": merge(old, new, keep)}
        bad = (sanity(sym, doc["bars"]) if not args.fixtures else []) + [f"{sym}: {redact(e)}" for e in v.validate(doc, "prices.schema.json")]
        if bad:
            errors.setdefault(sym, []).extend(bad)
        staged[sym] = doc
        # Workflow logs are public: counts and dates only, never a price (provider licence, docs/decisions.md).
        print(f"  {sym:6} {len(new):5} bars from {name}, {doc['bars'][0]['date']} to {doc['bars'][-1]['date']}")
    if not args.fixtures:
        print(f"fetch_prices: {budget.used()} request(s) used of {cap} this run (provider plan: {hourly} an hour)")

    ok = [m for m, ms in groups.items() if not any(s in errors for s in ms)]
    failed = [m for m in groups if m not in ok]
    for m in failed:
        msgs = [e for s in groups[m] for e in errors.get(s, [])]
        print(f"fetch_prices: market {m} FAILED, nothing written for it:", *msgs, sep="\n  ", file=sys.stderr)
    write = {s: staged[s] for m in ok for s in groups[m]}
    if args.dry_run:
        print(f"fetch_prices: dry run {'OK' if not failed else 'done'} for {len(write)} symbols"
              + (f"; failed: {failed}" if failed else ""))
        return 1 if failed else 0
    for sym, doc in write.items():
        dump_json(PRICES / f"{sym}.json", doc)
    print(f"fetch_prices: wrote {len(write)} files for {ok or 'no market'}" + (f"; failed: {failed}" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
