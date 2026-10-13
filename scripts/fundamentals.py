#!/usr/bin/env python3
"""Company numbers from the SEC's XBRL company facts (free, official, public domain): trailing-twelve-month revenue
and its growth, operating and net margin, and free cash flow, per name on the main list. No model involved.

Data: https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json and the SEC's ticker-to-CIK map. The SEC asks every
client to send a User-Agent naming who it is with a contact email; it comes from the SEC_USER_AGENT environment
variable (an Actions secret), never from the repo. Requests stay under the SEC's ten a second.

Point in time: only facts filed on or before `as_of` count, and a restated period takes the newest filing up to then,
so a past run sees what was public that day. Quarters come from 10-Q and 10-K facts: a fact covering about three
months is a quarter; a year-to-date fact minus the one before it (same start) is the quarter between them, which is how
cash flows (reported year to date) and the fourth quarter (the 10-K year minus nine months) are found.

Writes data/market/fundamentals.json (schemas/fundamentals.schema.json). Fail closed: if the map or any company
cannot be fetched, nothing is written and the previous file stays.

Usage: python3 scripts/fundamentals.py [--as-of YYYY-MM-DD] [--fixtures DIR] [--dry-run]
  --fixtures DIR  read <DIR>/company_tickers.json and <DIR>/<SYMBOL>.json instead of the network
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, Validator, dump_json, watchlist  # noqa: E402

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
UA_ENV = "SEC_USER_AGENT"
FORMS = {"10-K", "10-Q", "10-K/A", "10-Q/A", "10-KT"}
QUARTER = (77, 115)  # days a fiscal quarter can span: 12-, 13- and 16-week quarters (Costco, PepsiCo) and calendar ones
STALE_DAYS = 200  # a latest quarter older than this is reported but flagged stale

# Each metric takes the candidate concept whose newest quarter is latest (companies switch tags over the years).
CONCEPTS = {
    "revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "RevenueFromContractWithCustomerIncludingAssessedTax",
                "RegulatedAndUnregulatedOperatingRevenue", "SalesRevenueNet", "RevenuesNetOfInterestExpense"],
    "operating_income": ["OperatingIncomeLoss"],
    "net_income": ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets",
              "PurchasesOfPropertyAndEquipmentAndIntangibleAssets", "PaymentsForCapitalImprovements",
              "PaymentsToExploreAndDevelopOilAndGasProperties"],
}


class SecError(RuntimeError):
    pass


def _d(s: str) -> date:
    return date.fromisoformat(s)


def quarters(facts: list[dict], as_of: str) -> dict[str, dict]:
    """Discrete fiscal quarters {end: {start, end, val, filed}} from one concept's USD facts, using only facts filed on
    or before `as_of` (the newest such filing wins for a restated period). Direct three-month facts win over derived."""
    latest: dict[tuple[str, str], dict] = {}
    for f in facts:
        if f.get("form") not in FORMS or not f.get("start") or f["filed"] > as_of:
            continue
        k = (f["start"], f["end"])
        if k not in latest or f["filed"] > latest[k]["filed"]:
            latest[k] = f
    out: dict[str, dict] = {}
    by_start: dict[str, list[dict]] = {}
    for f in latest.values():
        days = (_d(f["end"]) - _d(f["start"])).days
        if QUARTER[0] <= days <= QUARTER[1]:
            out[f["end"]] = {"start": f["start"], "end": f["end"], "val": float(f["val"]), "filed": f["filed"], "direct": True}
        by_start.setdefault(f["start"], []).append(f)
    for group in by_start.values():
        group.sort(key=lambda f: f["end"])
        for a, b in zip(group, group[1:]):
            gap = (_d(b["end"]) - _d(a["end"])).days
            if QUARTER[0] <= gap <= QUARTER[1] and not out.get(b["end"], {}).get("direct"):
                start = (_d(a["end"]) + timedelta(days=1)).isoformat()
                out[b["end"]] = {"start": start, "end": b["end"], "val": float(b["val"]) - float(a["val"]),
                                 "filed": max(a["filed"], b["filed"]), "direct": False}
    return out


def chain(qs: dict[str, dict], n: int) -> list[dict] | None:
    """The newest `n` back-to-back quarters (each starts within a week after the one before ends), newest first."""
    if not qs:
        return None
    ordered = sorted(qs.values(), key=lambda q: q["end"], reverse=True)
    run = [ordered[0]]
    for q in ordered[1:]:
        if len(run) == n:
            break
        gap = (_d(run[-1]["start"]) - _d(q["end"])).days
        if 0 < gap <= 7:
            run.append(q)
        elif q["end"] < run[-1]["start"]:
            return None  # a hole: a missing quarter would make the sum wrong
    return run if len(run) == n else None


def pick_chain(gaap: dict, names: list[str], as_of: str, n: int, end: str | None = None) -> tuple[str | None, list[dict] | None]:
    """The candidate concept with the newest run of `n` back-to-back quarters (companies switch tags over the years).
    With `end`, only a run whose newest quarter ends within a week of it counts (so all metrics share one period)."""
    best: tuple[str | None, list[dict] | None] = (None, None)
    for c in names:
        facts = gaap.get(c, {}).get("units", {}).get("USD")
        run = chain(quarters(facts, as_of), n) if facts else None
        if not run or (end and abs((_d(run[0]["end"]) - _d(end)).days) > 7):
            continue
        if best[1] is None or run[0]["end"] > best[1][0]["end"]:
            best = (c, run)
    return best


def _pct(a: float | None, b: float | None) -> float | None:
    return None if a is None or b in (None, 0) else round(a / b * 100, 1)


def company_view(symbol: str, cik: int, facts_doc: dict, as_of: str) -> dict:
    """One company's trailing-twelve-month numbers as of `as_of` (the end of its newest quarter filed by then)."""
    gaap = facts_doc.get("facts", {}).get("us-gaap", {})
    row: dict = {"symbol": symbol, "cik": cik, "name": facts_doc.get("entityName", symbol)}
    concept, rev4 = pick_chain(gaap, CONCEPTS["revenue"], as_of, 4)
    if not rev4:
        return {**row, "status": "no_data", "missing": ["revenue"]}
    end = rev4[0]["end"]
    _, rev8 = pick_chain(gaap, [concept], as_of, 8, end)
    ttm = {"revenue": sum(q["val"] for q in rev4)}
    missing = []
    for m in ("operating_income", "net_income", "operating_cash_flow", "capex"):
        _, c4 = pick_chain(gaap, CONCEPTS[m], as_of, 4, end)
        if c4:
            ttm[m] = sum(x["val"] for x in c4)
        else:
            missing.append(m)
    fcf = ttm["operating_cash_flow"] - ttm["capex"] if "operating_cash_flow" in ttm and "capex" in ttm else None
    prev = sum(q["val"] for q in rev8[4:]) if rev8 else None
    row.update({
        "status": "stale" if (_d(as_of) - _d(end)).days > STALE_DAYS else "ok",
        "period_end": end, "filed": max(q["filed"] for q in rev4), "revenue_concept": concept,
        "revenue_ttm": round(ttm["revenue"]),
        "revenue_growth_yoy_pct": _pct(ttm["revenue"] - prev, prev) if prev else None,
        "quarter_revenue_growth_yoy_pct": _pct(rev8[0]["val"] - rev8[4]["val"], rev8[4]["val"]) if rev8 else None,
        "operating_margin_pct": _pct(ttm.get("operating_income"), ttm["revenue"]),
        "net_margin_pct": _pct(ttm.get("net_income"), ttm["revenue"]),
        "free_cash_flow_ttm": None if fcf is None else round(fcf),
        "fcf_margin_pct": _pct(fcf, ttm["revenue"]),
        "missing": missing,
    })
    return row


# ---------------------------------------------------------------- network (only main() touches it)

def _get(url: str, ua: str, retries: int = 3, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept-Encoding": "identity"})
    last: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 404):  # no contact in the User-Agent, or unknown CIK: retrying will not help
                raise SecError(f"{url.rsplit('/', 1)[-1]}: HTTP {exc.code} {exc.reason}") from None
            last = exc
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as exc:
            last = exc
        time.sleep(2 ** (attempt + 1))
    raise SecError(f"{url.rsplit('/', 1)[-1]}: failed after {retries} tries: {last}")


def build(symbols: list[str], as_of: str, fixtures: Path | None = None) -> dict:
    ua = os.environ.get(UA_ENV, "")
    if not fixtures and "@" not in ua:
        raise SecError(f"{UA_ENV} must name the client and a contact email (SEC fair-access policy); add it as an Actions secret")
    load = (lambda name: json.loads((fixtures / name).read_text())) if fixtures else None
    tickers = load("company_tickers.json") if load else _get(TICKERS_URL, ua)
    cik = {v["ticker"].upper(): int(v["cik_str"]) for v in tickers.values()}
    rows = []
    for s in symbols:
        code = s.replace(".", "-")
        if code not in cik:
            raise SecError(f"{s}: not in the SEC ticker map")
        doc = load(f"{s}.json") if load else _get(FACTS_URL.format(cik=cik[code]), ua)
        if not load:
            time.sleep(0.25)  # well under the SEC's ten requests a second
        rows.append(company_view(s, cik[code], doc, as_of))
    return {"as_of": as_of, "sample": False, "source": "SEC XBRL company facts (us-gaap), trailing twelve months",
            "companies": rows}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", default=date.today().isoformat())
    ap.add_argument("--fixtures")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    syms = [s["symbol"] for s in watchlist()["symbols"]]
    try:
        doc = build(syms, args.as_of, Path(args.fixtures) if args.fixtures else None)
    except SecError as exc:
        print(f"fundamentals: FAILED, nothing written: {exc}", file=sys.stderr)
        return 1
    errs = Validator().validate(doc, "fundamentals.schema.json")
    if errs:
        print("fundamentals: FAILED schema, nothing written:", *errs[:10], sep="\n  ", file=sys.stderr)
        return 1
    for r in doc["companies"]:
        print(f"  {r['symbol']:6} {r['status']:7} {r.get('period_end', '-'):10} rev growth {r.get('revenue_growth_yoy_pct')} "
              f"op margin {r.get('operating_margin_pct')} fcf margin {r.get('fcf_margin_pct')} missing {r.get('missing')}")
    if not args.dry_run:
        dump_json(MARKET / "fundamentals.json", doc)
    print(f"fundamentals: {len(doc['companies'])} companies as of {doc['as_of']}" + (" (dry run)" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
