#!/usr/bin/env python3
"""Official company news from the SEC (free, public domain): each company's recent filings that announce something,
in plain words. No model involved, and nothing is copied from the filings themselves: a US company's current report
(8-K) carries item codes (2.02 results, 5.02 a leadership change, 1.01 a major agreement...), and each code has a
fixed plain title here. A foreign company's report (6-K) has no codes, so it is a "company update" with its link.
Quarterly and yearly reports (10-Q, 10-K, 20-F, 40-F) are listed too.

Data: https://data.sec.gov/submissions/CIK##########.json and the SEC's ticker-to-CIK map, for every company on every
stock list (the main list first). The User-Agent comes from the SEC_USER_AGENT environment variable (an Actions
secret), as for scripts/fundamentals.py; requests stay well under the SEC's ten a second.

Point in time: only filings dated on or before `as_of`, within the last WINDOW_DAYS days, newest first, at most
MAX_PER_COMPANY each. A company whose fetch fails is listed under `missing`; if more than a quarter fail, nothing is
written and the previous file stays.

Writes data/market/sec_news.json (schemas/sec_news.schema.json).

Usage: python3 scripts/sec_news.py [--as-of YYYY-MM-DD] [--fixtures DIR] [--dry-run]
  --fixtures DIR  read <DIR>/company_tickers.json and <DIR>/sub_<SYMBOL>.json instead of the network
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, Validator, all_stock_symbols, dump_json  # noqa: E402
from fundamentals import TICKERS_URL, UA_ENV, SecError, _get  # noqa: E402

SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
DOC_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{doc}"
WINDOW_DAYS = 120
MAX_PER_COMPANY = 8
MAX_MISSING_SHARE = 0.25

# 8-K item codes, most newsworthy first: (plain title, kind). 9.01 (exhibits) says nothing on its own.
ITEMS = {
    "2.02": ("Quarterly results", "results"),
    "4.02": ("Earlier results corrected: past numbers should not be relied on", "warning"),
    "1.05": ("A cybersecurity incident", "warning"),
    "5.01": ("A change in who controls the company", "warning"),
    "2.04": ("A debt became due early", "warning"),
    "2.05": ("Cost cuts or a restructuring", "warning"),
    "2.06": ("Wrote down the value of some assets", "warning"),
    "3.01": ("A notice about its stock exchange listing", "warning"),
    "5.02": ("A leadership change (an executive or board member)", "people"),
    "1.01": ("Signed a major agreement", "deal"),
    "2.01": ("Bought or sold a business or major assets", "deal"),
    "1.02": ("Ended a major agreement", "deal"),
    "2.03": ("Took on new debt", "money"),
    "3.02": ("Sold new shares", "money"),
    "3.03": ("Changed shareholders' rights", "other"),
    "4.01": ("Changed its auditor", "other"),
    "5.03": ("Changed its bylaws or fiscal year", "other"),
    "5.07": ("Shareholder vote results", "other"),
    "5.08": ("Set a shareholder meeting date", "other"),
    "7.01": ("Shared an update with investors", "update"),
    "8.01": ("Other company news", "update"),
}
FORMS = {
    "10-Q": ("Quarterly report", "report"), "10-K": ("Yearly report", "report"),
    "20-F": ("Yearly report", "report"), "40-F": ("Yearly report", "report"),
    "6-K": ("Company update (a foreign company's report)", "update"),
}
NEWS_FORMS = {"8-K", "8-K/A", *FORMS, *(f"{f}/A" for f in FORMS)}


def describe(form: str, items: str) -> tuple[list[str], list[str], str]:
    """(item codes, plain titles, kind) for one filing. An 8-K's titles follow ITEMS order; an amendment says so."""
    base = form.removesuffix("/A")
    if base == "8-K":
        codes = [c.strip() for c in (items or "").split(",") if c.strip() in ITEMS]
        codes.sort(key=list(ITEMS).index)
        titles = [ITEMS[c][0] for c in codes] or ["Company news"]
        kind = ITEMS[codes[0]][1] if codes else "update"
    else:
        codes, (title, kind) = [], FORMS[base]
        titles = [title]
    if form.endswith("/A"):
        titles = [f"Correction to an earlier filing: {titles[0][0].lower()}{titles[0][1:]}", *titles[1:]]
    return codes, titles, kind


def company_filings(sub: dict, cik: int, as_of: str, window: int = WINDOW_DAYS, cap: int = MAX_PER_COMPANY) -> list[dict]:
    """The newsworthy filings in a submissions document, dated within `window` days up to `as_of`, newest first."""
    r = sub.get("filings", {}).get("recent", {})
    since = (date.fromisoformat(as_of) - timedelta(days=window)).isoformat()
    out = []
    for i, form in enumerate(r.get("form", [])):
        day = r["filingDate"][i]
        if form not in NEWS_FORMS or not since <= day <= as_of:
            continue
        codes, titles, kind = describe(form, r.get("items", [""] * (i + 1))[i])
        acc, doc = r["accessionNumber"][i].replace("-", ""), r["primaryDocument"][i]
        out.append({"date": day, "form": form, "items": codes, "titles": titles, "kind": kind,
                    "url": DOC_URL.format(cik=cik, acc=acc, doc=doc) if doc else DOC_URL.format(cik=cik, acc=acc, doc="").rstrip("/")})
    out.sort(key=lambda f: f["date"], reverse=True)
    return out[:cap]


def build(symbols: list[str], as_of: str, fixtures: Path | None = None) -> dict:
    ua = os.environ.get(UA_ENV, "")
    if not fixtures and "@" not in ua:
        raise SecError(f"{UA_ENV} must name the client and a contact email (SEC fair-access policy); add it as an Actions secret")
    load = (lambda name: json.loads((fixtures / name).read_text())) if fixtures else None
    tickers = load("company_tickers.json") if load else _get(TICKERS_URL, ua)
    cik = {v["ticker"].upper(): int(v["cik_str"]) for v in tickers.values()}
    rows, missing = [], []
    for s in symbols:
        code = s.replace(".", "-")
        if code not in cik:
            missing.append(s)
            continue
        try:
            sub = load(f"sub_{s}.json") if load else _get(SUBMISSIONS_URL.format(cik=cik[code]), ua)
        except (SecError, FileNotFoundError):
            missing.append(s)
            continue
        if not load:
            time.sleep(0.25)
        rows.append({"symbol": s, "cik": cik[code], "name": sub.get("name") or s, "filings": company_filings(sub, cik[code], as_of)})
    if len(missing) > MAX_MISSING_SHARE * len(symbols):
        raise SecError(f"{len(missing)} of {len(symbols)} companies could not be read: {missing[:8]}")
    return {"as_of": as_of, "sample": False, "source": "SEC EDGAR filings index (company submissions)",
            "window_days": WINDOW_DAYS, "companies": rows, "missing": missing}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", default=date.today().isoformat())
    ap.add_argument("--fixtures")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    try:
        doc = build(all_stock_symbols(), args.as_of, Path(args.fixtures) if args.fixtures else None)
    except SecError as exc:
        print(f"sec_news: FAILED, nothing written: {exc}", file=sys.stderr)
        return 1
    errs = Validator().validate(doc, "sec_news.schema.json")
    if errs:
        print("sec_news: FAILED schema, nothing written:", *errs[:10], sep="\n  ", file=sys.stderr)
        return 1
    for c in doc["companies"]:
        top = c["filings"][0] if c["filings"] else None
        print(f"  {c['symbol']:6} {len(c['filings'])} filing(s)" + (f"; newest {top['date']} {top['form']}: {top['titles'][0]}" if top else ""))
    if doc["missing"]:
        print(f"  missing: {doc['missing']}")
    if not args.dry_run:
        dump_json(MARKET / "sec_news.json", doc)
    print(f"sec_news: {len(doc['companies'])} companies as of {doc['as_of']}" + (" (dry run)" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
