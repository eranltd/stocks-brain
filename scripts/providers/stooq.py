"""Stooq daily bars (free end-of-day CSV, no key). US listings use the `<symbol>.us` code."""
from __future__ import annotations

import csv
import io
import time
import urllib.error
import urllib.request

NAME = "stooq"
URL = "https://stooq.com/q/d/l/?s={code}&i=d"
HEADERS = {"User-Agent": "stocks-brain/0.1 (+public research notebook)"}


class ProviderError(RuntimeError):
    pass


def code_for(symbol: str) -> str:
    return f"{symbol.lower().replace('.', '-')}.us"


def parse(text: str, symbol: str) -> list[dict]:
    """Parse Stooq CSV. Anything that is not the expected CSV is an error (fail closed)."""
    head = text.lstrip()[:200].lower()
    if not head.startswith("date,open,high,low,close"):
        reason = "no data" if "no data" in head else "daily hits limit" if "limit" in head else "unexpected response"
        raise ProviderError(f"{symbol}: {reason}: {text[:80]!r}")
    bars = []
    for row in csv.DictReader(io.StringIO(text)):
        try:
            bars.append({
                "date": row["Date"],
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(float(row.get("Volume") or 0)),
            })
        except (KeyError, ValueError) as exc:
            raise ProviderError(f"{symbol}: bad row {row!r}: {exc}") from exc
    if not bars:
        raise ProviderError(f"{symbol}: empty CSV")
    return sorted(bars, key=lambda b: b["date"])


def fetch_daily(symbol: str, retries: int = 3, timeout: int = 30) -> list[dict]:
    req = urllib.request.Request(URL.format(code=code_for(symbol)), headers=HEADERS)
    last: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return parse(res.read().decode("utf-8", errors="replace"), symbol)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = exc
            time.sleep(2 ** (attempt + 1))
    raise ProviderError(f"{symbol}: network error after {retries} tries: {last}")
