"""Who is betting what, per stock (routine flows): three free signals for each name on the main list and My list.

1. Short selling: the share of each day's trading volume that was short sales, from FINRA's free daily short-sale volume
   file (consolidated, https://cdn.finra.org/equity/regsho/daily/CNMSshvol<YYYYMMDD>.txt; no key). Market makers sell
   short as part of normal trading, so 30 to 45% is common: the signal is a day well above the name's own recent level.
   Kept as a percent per day for the last HISTORY_DAYS trading days, never the volumes.
2. Analysts: how many say strong buy, buy, hold, sell and strong sell, the latest month (Finnhub free plan).
3. Insiders (officers and directors): net shares bought or sold in the last INSIDER_MONTHS months and Finnhub's insider
   sentiment score (MSPR, -100 all selling to +100 all buying), from their SEC Form 4 filings (Finnhub free plan).

Nobody publishes "85% bought, 15% sold" for free: every share bought is a share sold. These are the closest free,
honest signals. Writes data/market/flows.json. Without FINNHUB_API_KEY the analyst and insider parts are skipped (the
FINRA part needs no key). Usage: python3 scripts/flows.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, Validator, dump_json, load_json, market_watchlist, markets_config, watchlist  # noqa: E402

FINRA = "https://cdn.finra.org/equity/regsho/daily/CNMSshvol{d}.txt"
FINNHUB = "https://finnhub.io/api/v1"
HISTORY_DAYS = 30      # trading days of short-sale share kept per name
LOOKBACK_DAYS = 45     # calendar days searched for missing FINRA files (holidays simply have no file)
BASE_DAYS = 20         # the "usual level" is the average of the 20 days before the latest
INSIDER_MONTHS = 3
GAP_S = 1.1            # Finnhub's free plan allows 60 calls a minute
LISTS = ("mine",)      # the main list is always included; these other lists too
UA = {"User-Agent": "stocks-brain-flows/1"}
OUT = MARKET / "flows.json"


def _get(url: str, headers: dict | None = None) -> bytes | None:
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except urllib.error.HTTPError as exc:
        if exc.code != 404:  # a weekend or holiday simply has no file
            print(f"flows: {url.split('?')[0]} failed: {exc}", file=sys.stderr)
        return None
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"flows: {url.split('?')[0]} failed: {exc}", file=sys.stderr)
        return None


def symbols() -> list[str]:
    """The main list's names, then each list in LISTS (first seen order, no duplicates)."""
    out = [s["symbol"] for s in watchlist()["symbols"]]
    for m in markets_config()["markets"]:
        if m["id"] in LISTS:
            out += [s["symbol"] for s in market_watchlist(m)["symbols"]]
    return list(dict.fromkeys(out))


def parse_finra(text: str, wanted: set[str]) -> dict[str, float]:
    """{symbol: short share of volume, percent} for the wanted symbols in one FINRA daily file."""
    out = {}
    for line in text.splitlines()[1:]:
        p = line.split("|")
        if len(p) < 5 or p[1] not in wanted:
            continue
        try:
            short, total = float(p[2]), float(p[4])
        except ValueError:
            continue
        if total > 0:
            out[p[1]] = round(short / total * 100, 1)
    return out


def short_view(hist: list[dict]) -> dict | None:
    """The latest day against the name's usual level: {date, pct, base_pct, diff, level, history}. `level` in words:
    "high" when the latest is 10+ points above the usual level, "low" 10+ below, else "usual"."""
    if not hist:
        return None
    hist = sorted(hist, key=lambda h: h["d"])[-HISTORY_DAYS:]
    last = hist[-1]
    prev = [h["p"] for h in hist[:-1]][-BASE_DAYS:]
    base = round(sum(prev) / len(prev), 1) if len(prev) >= 5 else None
    diff = round(last["p"] - base, 1) if base is not None else None
    level = None if diff is None else "high" if diff >= 10 else "low" if diff <= -10 else "usual"
    return {"date": last["d"], "pct": last["p"], "base_pct": base, "diff": diff, "level": level, "history": hist}


def analysts_view(rows: list | None) -> dict | None:
    if not rows:
        return None
    r = max(rows, key=lambda x: x.get("period", ""))
    keys = {"strongBuy": "strong_buy", "buy": "buy", "hold": "hold", "sell": "sell", "strongSell": "strong_sell"}
    v = {out: int(r.get(k) or 0) for k, out in keys.items()}
    n = sum(v.values())
    if not n:
        return None
    return {"period": r["period"][:10], "n": n, **v, "buy_pct": round((v["strong_buy"] + v["buy"]) / n * 100)}


def insiders_view(doc: dict | None, today: date) -> dict | None:
    # Only the last INSIDER_MONTHS calendar months, this one included (the feed can send older months).
    y, m = today.year, today.month - (INSIDER_MONTHS - 1)
    while m < 1:
        y, m = y - 1, m + 12
    rows = [r for r in (doc or {}).get("data") or [] if (r.get("year", 0), r.get("month", 0)) >= (y, m)]
    if not rows:
        return None
    net = sum(int(r.get("change") or 0) for r in rows)
    msprs = [float(r["mspr"]) for r in rows if isinstance(r.get("mspr"), (int, float))]
    last = max(rows, key=lambda r: (r["year"], r["month"]))
    return {"months": INSIDER_MONTHS, "net_shares": net, "mspr": round(sum(msprs) / len(msprs), 1) if msprs else None,
            "last_month": f"{last['year']:04d}-{last['month']:02d}",
            "side": "bought" if net > 0 else "sold" if net < 0 else "none"}


def build(key: str | None, prev: dict | None, today: date) -> dict:
    names = symbols()
    wanted = set(names)
    # Short-sale history: keep what the last run published, fetch the days it does not have.
    hist: dict[str, list[dict]] = {s: [] for s in names}
    have: set[str] = set()
    for row in (prev or {}).get("symbols", []):
        if row["symbol"] in hist and row.get("short"):
            hist[row["symbol"]] = list(row["short"]["history"])
            have |= {h["d"] for h in row["short"]["history"]}
    for k in range(LOOKBACK_DAYS, -1, -1):
        d = today - timedelta(days=k)
        iso = d.isoformat()
        if d.weekday() >= 5 or iso in have:
            continue
        raw = _get(FINRA.format(d=d.strftime("%Y%m%d")))
        if not raw:
            continue
        for sym, pct in parse_finra(raw.decode("utf-8", "replace"), wanted).items():
            hist[sym].append({"d": iso, "p": pct})
    # Analysts and insiders: Finnhub, one call each per name.
    analysts: dict[str, dict | None] = {}
    insiders: dict[str, dict | None] = {}
    if key:
        hdr = {"X-Finnhub-Token": key}
        frm = (today.replace(day=1) - timedelta(days=31 * (INSIDER_MONTHS - 1))).replace(day=1).isoformat()
        for s in names:
            raw = _get(f"{FINNHUB}/stock/recommendation?{urllib.parse.urlencode({'symbol': s})}", hdr)
            analysts[s] = analysts_view(json.loads(raw)) if raw else None
            time.sleep(GAP_S)
            q = urllib.parse.urlencode({"symbol": s, "from": frm, "to": today.isoformat()})
            raw = _get(f"{FINNHUB}/stock/insider-sentiment?{q}", hdr)
            insiders[s] = insiders_view(json.loads(raw), today) if raw else None
            time.sleep(GAP_S)
    else:  # keep yesterday's analyst and insider views rather than blank them
        for row in (prev or {}).get("symbols", []):
            analysts[row["symbol"]] = row.get("analysts")
            insiders[row["symbol"]] = row.get("insiders")
    rows = [{"symbol": s, "short": short_view(hist[s]), "analysts": analysts.get(s), "insiders": insiders.get(s)} for s in names]
    dates = [r["short"]["date"] for r in rows if r["short"]]
    return {
        "as_of": max(dates) if dates else today.isoformat(),
        "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sample": False,
        "sources": {"short": "FINRA daily short sale volume (consolidated)", "analysts": "finnhub", "insiders": "finnhub (SEC Form 4)"},
        "symbols": rows,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    key = os.environ.get("FINNHUB_API_KEY", "").strip() or None
    prev = load_json(OUT) if OUT.exists() else None
    doc = build(key, prev, datetime.now(timezone.utc).date())
    with_short = sum(1 for r in doc["symbols"] if r["short"])
    if not with_short:
        raise SystemExit("flows: no short-sale data came back (nothing written)")
    errs = Validator().validate(doc, "flows.schema.json")
    if errs:
        raise SystemExit(f"flows.json: schema check failed (nothing written): {errs[:5]}")
    print(f"flows: {len(doc['symbols'])} names as of {doc['as_of']}; short data {with_short}, "
          f"analysts {sum(1 for r in doc['symbols'] if r['analysts'])}, insiders {sum(1 for r in doc['symbols'] if r['insiders'])}"
          + ("" if key else " (no FINNHUB_API_KEY: analysts and insiders kept from the last run)"))
    if not args.dry_run:
        dump_json(OUT, doc, compact=True)


if __name__ == "__main__":
    main()
