"""Price providers. Each module exposes `fetch_daily(symbol: str) -> list[dict]` returning
ascending daily bars: {date, open, high, low, close, volume}. Add a provider by adding a module
and registering it below; scripts pick one by name from config/settings.json (prices.provider)."""
from __future__ import annotations

from importlib import import_module

REGISTRY = {"tiingo": "providers.tiingo", "stooq": "providers.stooq"}


def get(name: str | None):
    if name not in REGISTRY:
        raise SystemExit(f"unknown or unset price provider {name!r}; known: {sorted(REGISTRY)}")
    return import_module(REGISTRY[name])
