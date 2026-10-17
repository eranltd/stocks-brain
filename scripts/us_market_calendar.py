"""US stock market calendar (New York Stock Exchange full-day closures), plain rules, no data provider.

The rule engine has no trading calendar: its decision periods are plain dates (rules.new_period: a new ISO week, month
or quarter) and the ledger records on the first run of each period. The "When could we buy it?" card needs the NEXT
review date ahead of time, for weekly, monthly and quarterly rules and for the weekly buy of the whole-market fund, so
this module (the repo's one trading calendar) lists the exchange's regular full-day holidays by rule:

  New Year's Day (1 Jan; a Sunday moves to Monday; a Saturday is NOT moved to the Friday before, by exchange rule),
  Martin Luther King Jr. Day (third Monday of January), Washington's Birthday (third Monday of February),
  Good Friday (two days before Western Easter), Memorial Day (last Monday of May), Juneteenth (19 June, from 2022),
  Independence Day (4 July), Labor Day (first Monday of September), Thanksgiving (fourth Thursday of November) and
  Christmas (25 December). Except New Year's Day, a holiday on a Saturday is observed on the Friday before and one on
  a Sunday on the Monday after.

Not covered: one-off closures the exchange announces at short notice (a national day of mourning, a storm). The date
shown is therefore "the first trading day by the regular calendar"; the rule itself always decides on the first day
the market is actually open. Early closes (half days) are trading days and need no rule here.
"""
from __future__ import annotations

from datetime import date, timedelta

QUARTER_MONTHS = (1, 4, 7, 10)  # the quarterly Five Leaders variant reviews only in these months (as rules.run_sleeve)


def easter(year: int) -> date:
    """Western (Gregorian) Easter Sunday: the anonymous Gregorian algorithm (Meeus/Jones/Butcher)."""
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7  # noqa: E741
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return date(year, month, day)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """The n-th given weekday (Monday 0) of a month; n = -1 is the last one."""
    if n > 0:
        first = date(year, month, 1)
        return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    last = nxt - timedelta(days=1)
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _observed(d: date) -> date:
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def holidays(year: int) -> set[date]:
    """The exchange's regular full-day holidays that fall in `year` (observed dates)."""
    out = set()
    ny = date(year, 1, 1)
    if ny.weekday() == 6:
        out.add(date(year, 1, 2))
    elif ny.weekday() != 5:  # a Saturday New Year's Day is not observed on the Friday before (it would be in the old year)
        out.add(ny)
    out.add(_nth_weekday(year, 1, 0, 3))   # Martin Luther King Jr. Day
    out.add(_nth_weekday(year, 2, 0, 3))   # Washington's Birthday
    out.add(easter(year) - timedelta(days=2))  # Good Friday
    out.add(_nth_weekday(year, 5, 0, -1))  # Memorial Day
    if year >= 2022:
        out.add(_observed(date(year, 6, 19)))  # Juneteenth
    out.add(_observed(date(year, 7, 4)))    # Independence Day
    out.add(_nth_weekday(year, 9, 0, 1))   # Labor Day
    out.add(_nth_weekday(year, 11, 3, 4))  # Thanksgiving
    out.add(_observed(date(year, 12, 25)))  # Christmas
    return out


def is_trading_day(d: date) -> bool:
    return d.weekday() < 5 and d not in holidays(d.year)


def first_trading_day(year: int, month: int) -> date:
    d = date(year, month, 1)
    while not is_trading_day(d):
        d += timedelta(days=1)
    return d


def first_trading_day_of_week(monday: date) -> date | None:
    """The first trading day of the ISO week that starts on `monday`, or None if the whole week is closed."""
    for k in range(5):
        if is_trading_day(monday + timedelta(days=k)):
            return monday + timedelta(days=k)
    return None


CADENCES = ("weekly", "monthly", "quarterly")


def next_review(as_of: str, cadence: str = "monthly") -> str:
    """The first trading day of the period after as_of's own period, by the rule's cadence (rules.new_period):
    weekly, the next ISO week; monthly, the next month; quarterly, the next January, April, July or October. A review in
    as_of's own period has already happened by then: the ledger decides on the first run of each period. The weekly buy
    of the whole-market fund uses the weekly date (the first trading day of next week)."""
    if cadence not in CADENCES:
        raise ValueError(f"unknown cadence {cadence!r}")
    d = date.fromisoformat(as_of)
    if cadence == "weekly":
        monday = d - timedelta(days=d.weekday())
        while True:
            monday += timedelta(days=7)
            if (first := first_trading_day_of_week(monday)) is not None:
                return first.isoformat()
    y, m = d.year, d.month
    while True:
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        if cadence == "monthly" or m in QUARTER_MONTHS:
            return first_trading_day(y, m).isoformat()
