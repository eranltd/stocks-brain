"""Big one-day drops in the list's names, and what came next (an event study; derived percents only, no prices).

The owner asked the system to learn from Alphabet's drop on 29 Oct 2026 (about -12% the day after its results): was a
big one-day fall a chance to buy? This measures it on our own history instead of assuming it.

For every day a name closed DROP_PCT or more below the close before, the study follows the name and the benchmark from
the NEXT close (you only see a drop after the close, so that is the first price you could get) to H trading days later,
for each H in HORIZONS, and keeps the name's move minus the benchmark's ("excess"). The same is measured from every day
of the same names (the base rate), so a rise that would have come anyway is not credited to the drop. A second drop of
the same name within COOLDOWN trading days is part of the same event (a crash week counts once).

Honest limits, stated on the page: today's list (names that later fell out of it are missing, which flatters
rebounds), few events, overlapping windows, and no costs. A study, not a rule: nothing here is a reason to trade.
"""
from __future__ import annotations

DROP_PCT = 8.0
HORIZONS = (5, 20, 60)
COOLDOWN = 20
RECENT = 60  # how many of the latest events the page lists


def _pct(a: float, b: float) -> float:
    return (b / a - 1) * 100


def drop_days(c: list[float], drop: float = DROP_PCT, cooldown: int = COOLDOWN) -> list[int]:
    """Indexes of days that closed `drop` percent or more below the close before; one per `cooldown` window."""
    out: list[int] = []
    for i in range(1, len(c)):
        if c[i - 1] and _pct(c[i - 1], c[i]) <= -drop and (not out or i - out[-1] > cooldown):
            out.append(i)
    return out


def excess_after(c: list[float], b: list[float], i: int, h: int) -> float | None:
    """The name minus the benchmark from the close after day i to h trading days later (None if not there yet)."""
    j, k = i + 1, i + 1 + h
    if k >= len(c) or not c[j] or not b[j]:
        return None
    return _pct(c[j], c[k]) - _pct(b[j], b[k])


def _summary(xs: list[float]) -> dict:
    n = len(xs)
    if not n:
        return {"n": 0, "avg_excess_pct": None, "median_excess_pct": None, "beat_pct": None, "worst_pct": None, "best_pct": None}
    s = sorted(xs)
    mid = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    return {"n": n, "avg_excess_pct": round(sum(xs) / n, 2), "median_excess_pct": round(mid, 2),
            "beat_pct": round(100 * sum(1 for x in xs if x > 0) / n, 1), "worst_pct": round(s[0], 2), "best_pct": round(s[-1], 2)}


def study(closes: dict[str, list[float]], bench: list[float], dates: list[str], drop: float = DROP_PCT,
          horizons: tuple[int, ...] = HORIZONS, cooldown: int = COOLDOWN, recent: int = RECENT) -> dict:
    """The event study over names that share the benchmark's dates (each list ends on dates[-1]; a shorter list is a
    name that listed later and is aligned to the end). Returns {events_total, summary, base, events}."""
    n = len(dates)
    events, base = [], {h: [] for h in horizons}
    after = {h: [] for h in horizons}
    for sym, c0 in closes.items():
        off = n - len(c0)
        if off < 0:
            continue
        b = bench[off:]
        for i in range(1, len(c0)):
            for h in horizons:
                x = excess_after(c0, b, i, h)
                if x is not None:
                    base[h].append(x)
        for i in drop_days(c0, drop, cooldown):
            ex = {str(h): (None if (x := excess_after(c0, b, i, h)) is None else round(x, 2)) for h in horizons}
            for h in horizons:
                if ex[str(h)] is not None:
                    after[h].append(ex[str(h)])
            last = len(c0) - 1
            so_far = None if i + 1 > last else round(_pct(c0[i + 1], c0[last]) - _pct(b[i + 1], b[last]), 2)
            events.append({"symbol": sym, "date": dates[off + i], "drop_pct": round(_pct(c0[i - 1], c0[i]), 2),
                           "excess": ex, "so_far_excess_pct": so_far, "days_since": last - i})
    events.sort(key=lambda e: (e["date"], e["symbol"]), reverse=True)
    return {"events_total": len(events),
            "summary": {str(h): _summary(after[h]) for h in horizons},
            "base": {str(h): _summary(base[h]) for h in horizons},
            "events": events[:recent]}
