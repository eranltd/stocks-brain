"""Polygon.io end-of-day aggregates (official API, free tier with a key): the SECOND price source.

Used only to cross-check Tiingo (scripts/price_crosscheck.py); nothing published comes from it but agreement statistics.
The key comes from the POLYGON_API_KEY environment variable (a GitHub Actions secret) and is sent in a header, never in
the URL. The free plan allows five requests a minute, so callers space their requests (MIN_INTERVAL_S).
Bars are split- and dividend-adjusted (adjusted=true), like Tiingo's adjusted series.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

NAME = "polygon"
SECRET_ENV = "POLYGON_API_KEY"
URL = "https://api.polygon.io/v2/aggs/ticker/{code}/range/1/day/{start}/{end}?adjusted=true&sort=asc&limit=50000"
MIN_INTERVAL_S = 12.5  # free plan: five requests a minute


class ProviderError(RuntimeError):
    pass


def code_for(symbol: str) -> str:
    return symbol.upper().replace("-", ".")


def parse(payload: str | dict, symbol: str) -> list[dict]:
    data = json.loads(payload) if isinstance(payload, str) else payload
    if not isinstance(data, dict) or data.get("status") not in ("OK", "DELAYED"):
        status = data.get("status") if isinstance(data, dict) else type(data).__name__
        raise ProviderError(f"{symbol}: status {str(status)[:40]}")
    rows = data.get("results") or []
    if not rows:
        raise ProviderError(f"{symbol}: empty response")
    bars = []
    for r in rows:
        try:
            day = datetime.fromtimestamp(int(r["t"]) / 1000, tz=timezone.utc)
            # Polygon stamps a US session at midnight New York time, which is 04:00 or 05:00 UTC the same day.
            bars.append({"date": day.date().isoformat(), "open": round(float(r["o"]), 4), "high": round(float(r["h"]), 4),
                         "low": round(float(r["l"]), 4), "close": round(float(r["c"]), 4), "volume": int(float(r.get("v") or 0))})
        except (KeyError, TypeError, ValueError) as exc:  # logs are public: keys only, never values (prices)
            raise ProviderError(f"{symbol}: bad row (keys {sorted(map(str, r))[:8]}): {type(exc).__name__}") from exc
    return sorted(bars, key=lambda b: b["date"])


def fetch_daily(symbol: str, keep_days: int = 260, retries: int = 3, timeout: int = 30) -> list[dict]:
    key = os.environ.get(SECRET_ENV)
    if not key:
        raise ProviderError(f"{SECRET_ENV} is not set (add it as a GitHub Actions secret)")
    end = date.today()
    start = end - timedelta(days=int(keep_days * 7 / 5) + 14)
    req = urllib.request.Request(URL.format(code=code_for(symbol), start=start.isoformat(), end=end.isoformat()),
                                 headers={"Authorization": f"Bearer {key}", "User-Agent": "stocks-brain/0.1"})
    last: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return parse(res.read().decode("utf-8"), symbol)
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 404):
                raise ProviderError(f"{symbol}: HTTP {exc.code} {exc.reason}") from None
            last = exc  # 429 (rate limit) and server errors: wait and retry
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = exc
        if attempt + 1 < retries:
            time.sleep(MIN_INTERVAL_S * (attempt + 1))
    raise ProviderError(f"{symbol}: network error after {retries} tries: {last}")
