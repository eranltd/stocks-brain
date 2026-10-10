"""Tiingo end-of-day prices (official API, free tier with a key).

The key comes from the TIINGO_API_KEY environment variable (a GitHub Actions secret). It is
sent in a header, never in the URL, so it cannot leak into logs or error messages.
Bars are split/dividend-adjusted; each fetch pulls the whole window so history stays consistent.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

NAME = "tiingo"
SECRET_ENV = "TIINGO_API_KEY"
URL = "https://api.tiingo.com/tiingo/daily/{code}/prices?{query}"
REQUESTS = 0  # HTTP requests made by this process, retries included (fetch_prices.py keeps them under the plan's cap)


class ProviderError(RuntimeError):
    pass


def code_for(symbol: str) -> str:
    return symbol.lower().replace(".", "-")


def parse(payload: str | list, symbol: str) -> list[dict]:
    data = json.loads(payload) if isinstance(payload, str) else payload
    if isinstance(data, dict):  # error object, e.g. {"detail": "Not found."}; anything else is named by its keys only
        detail = data.get("detail")
        raise ProviderError(f"{symbol}: {str(detail)[:200]}" if isinstance(detail, str)
                            else f"{symbol}: unexpected object with keys {sorted(map(str, data))[:8]}")
    if not isinstance(data, list) or not data:
        raise ProviderError(f"{symbol}: empty response")
    bars = []
    for row in data:
        try:
            bars.append({
                "date": str(row["date"])[:10],
                "open": round(float(row["adjOpen"]), 4),
                "high": round(float(row["adjHigh"]), 4),
                "low": round(float(row["adjLow"]), 4),
                "close": round(float(row["adjClose"]), 4),
                "volume": int(row.get("adjVolume") or row.get("volume") or 0),
            })
        except (KeyError, TypeError, ValueError) as exc:
            # Logs are public: name the row's date and keys, never its values (they are prices).
            keys = sorted(map(str, row))[:12] if isinstance(row, dict) else type(row).__name__
            day = str(row.get("date", "?"))[:10] if isinstance(row, dict) else "?"
            raise ProviderError(f"{symbol}: bad row on {day} (keys {keys}): {type(exc).__name__}") from exc
    return sorted(bars, key=lambda b: b["date"])


def fetch_daily(symbol: str, keep_days: int = 260, retries: int = 3, timeout: int = 30) -> list[dict]:
    global REQUESTS
    key = os.environ.get(SECRET_ENV)
    if not key:
        raise ProviderError(f"{SECRET_ENV} is not set (add it as a GitHub Actions secret)")
    start = date.today() - timedelta(days=int(keep_days * 7 / 5) + 14)
    query = urllib.parse.urlencode({"startDate": start.isoformat(), "resampleFreq": "daily"})
    req = urllib.request.Request(
        URL.format(code=code_for(symbol), query=query),
        headers={"Authorization": f"Token {key}", "Content-Type": "application/json",
                 "User-Agent": "stocks-brain/0.1"},
    )
    last: Exception | None = None
    for attempt in range(retries):
        REQUESTS += 1
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return parse(res.read().decode("utf-8"), symbol)
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 404):  # bad key or unknown ticker: retrying will not help
                raise ProviderError(f"{symbol}: HTTP {exc.code} {exc.reason}") from None
            last = exc
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = exc
        if attempt + 1 < retries:
            time.sleep(2 ** (attempt + 1))
    raise ProviderError(f"{symbol}: network error after {retries} tries: {last}")
