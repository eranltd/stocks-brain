"""People we learn from: score each dated public call in config/people.json against the S&P 500 core.

Learn from them, but measure them. Every call is scored on the daily closes of the name and the core that the daily
Action already holds (.cache/prices, never published); only percentages and dates are written. A call starts on the
first trading day strictly AFTER the day it became public (no look-ahead) and is measured over 13, 26 and 52 weeks of
five trading days each (65, 130 and 260 trading days) once that much time has passed, and "so far" to the latest day.
The start and every finished horizon are fixed trading days, so a new close only moves "so far":

    excess = (1 + name growth) / (1 + core growth) - 1          (percent)
    signed excess = excess for a bullish call, -excess for a bearish one; the call was right when it is above zero.

A call on a name that is not on our watchlist is kept and shown, but not scored; so is a call made before the history
we hold for the name. A 13F call is the fund's book: a call marked `credit_person: false` (the firm's move, not the
named person's own) counts in the fund's record only. A person's record says nothing until at least MIN_MATURED of
their calls are half a year old. Run by `routines_code.py people` (routine score_people).
"""
from __future__ import annotations

from datetime import date
from statistics import median

HORIZONS = (13, 26, 52)  # weeks of five trading days
DAYS_PER_WEEK = 5
JUDGE_AT = 26            # the record is judged on calls that are half a year old
MIN_MATURED = 10         # fewer matured calls than this: "too few calls to judge"
MAX_START_GAP_DAYS = 7   # a start more than a week after the public date means the history has a hole there
NOTES = {"off_list": "not on our list", "no_history": "no published history for this name yet",
         "too_new": "no trading day after the public date yet",
         "before_history": "made before the history we hold for this name"}


def credited(call: dict) -> bool:
    """False when the call is the firm's move, not the named person's own (it then counts for the fund only)."""
    return call.get("credit_person", True) is not False


def _leg(name: list[float], core: list[float], dates: list[str], k: int, j: int, stance: str, step: int) -> dict:
    g, c = name[j] / name[k] - 1, core[j] / core[k] - 1
    excess = ((1 + g) / (1 + c) - 1) * 100
    signed = excess if stance == "bullish" else -excess
    return {"weeks": max(1, (j - k) // step), "end_date": dates[j], "name_pct": round(g * 100, 2), "core_pct": round(c * 100, 2),
            "excess_pct": round(excess, 2), "signed_excess_pct": round(signed, 2), "right": signed > 0}


def score_call(call: dict, series: dict, on_list: set[str], step: int = DAYS_PER_WEEK) -> dict:
    """One call against {dates, core, members: {SYMBOL: [close or None, ...]}}, every list as long as `dates`
    (None before a name's history begins). `step` is points per week: 5 for daily closes."""
    out = {k: call[k] for k in ("id", "person", "via", "date", "ticker", "stance")}
    out["credit_person"] = credited(call)
    dates, core, members = series["dates"], series["core"], series["members"]
    t = call["ticker"]
    name = members.get(t)
    k = next((i for i, d in enumerate(dates) if d > call["date"]), None)  # strictly after: no look-ahead
    reason = ("off_list" if t not in on_list else "no_history" if not name or name[-1] is None else "too_new" if k is None
              # k == 0: the history starts after the public date, so we cannot know this is the first day after it
              else "before_history" if (k == 0 or name[k] is None or core[k] is None
                                        or (date.fromisoformat(dates[k]) - date.fromisoformat(call["date"])).days > MAX_START_GAP_DAYS)
              else None)
    if reason:
        return {**out, "scored": False, "note": NOTES[reason], "start_date": None, "weeks_since": None,
                "so_far": None, **{f"w{h}": None for h in HORIZONS}}
    last = len(dates) - 1
    return {**out, "scored": True, "start_date": dates[k], "weeks_since": (last - k) // step,
            "so_far": _leg(name, core, dates, k, last, call["stance"], step) if last > k else None,
            **{f"w{h}": _leg(name, core, dates, k, k + h * step, call["stance"], step) if k + h * step <= last else None
               for h in HORIZONS}}


def record(rows: list[dict]) -> dict:
    """The track record of a group of scored calls (one person, or one fund)."""
    scored = [r for r in rows if r["scored"]]
    m = [r[f"w{JUDGE_AT}"] for r in scored if r[f"w{JUDGE_AT}"]]
    s = [r["so_far"] for r in scored if r["so_far"]]
    pct = lambda xs: round(sum(x["right"] for x in xs) / len(xs) * 100, 1) if xs else None  # noqa: E731
    med = lambda xs: round(median(x["signed_excess_pct"] for x in xs), 2) if xs else None  # noqa: E731
    return {"n": len(rows), "scored": len(scored), f"matured_{JUDGE_AT}w": len(m),
            f"right_{JUDGE_AT}w_pct": pct(m), f"median_signed_excess_{JUDGE_AT}w": med(m),
            "right_so_far_pct": pct(s), "median_signed_excess_so_far": med(s), "enough": len(m) >= MIN_MATURED}


def compute_scores(cfg: dict, series: dict, on_list: set[str], *, core: str, sample: bool,
                   step: int = DAYS_PER_WEEK) -> dict:
    """Score every call on `series` (see score_call). Percentages and dates only."""
    people = {p["id"]: p for p in cfg["people"]}
    unknown = sorted({c["person"] for c in cfg["calls"]} - set(people))
    if unknown:
        raise SystemExit(f"people: calls name unknown people {unknown} (fail closed)")
    calls = [score_call(c, series, on_list, step) for c in sorted(cfg["calls"], key=lambda c: (c["date"], c["id"]))]
    by_person = [{"person": pid, "name": people[pid]["name"], "vias": sorted({r["via"] for r in rows}), **record(rows)}
                 for pid in people if (rows := [r for r in calls if r["person"] == pid and r["credit_person"]])]
    by_via = [{"via": via, "persons": sorted({r["person"] for r in rows if r["credit_person"]}), **record(rows)}
              for via in sorted({r["via"] for r in calls}) if (rows := [r for r in calls if r["via"] == via])]
    return {
        "as_of": series["dates"][-1], "sample": sample, "core": core, "config_version": cfg["version"],
        "series": "daily closes of the name and the core (held by the daily Action, never published)",
        "method": ("Start on the first trading day after the public date; growth of the name vs the S&P 500 core over 13, 26 and "
                   "52 weeks (65, 130 and 260 trading days) and so far; excess = (1+name)/(1+core)-1; signed for the stance "
                   "(a bearish call is right when the name lagged)."),
        "horizons_weeks": list(HORIZONS), "judge_at_weeks": JUDGE_AT, "min_matured": MIN_MATURED,
        "calls": calls, "people": by_person, "vias": by_via,
    }


def summarize(doc: dict) -> list[str]:
    """Derived percentages only: safe for a public Actions log."""
    f = lambda x: "-" if x is None else f"{x:+.1f}%"  # noqa: E731
    out = [f"people: {len(doc['calls'])} calls, {sum(c['scored'] for c in doc['calls'])} scored, as of {doc['as_of']} (core {doc['core']})"]
    for c in doc["calls"]:
        if not c["scored"]:
            out.append(f"  {c['id']:28} {c['stance']:8} unscored: {c['note']}")
            continue
        sf = c["so_far"]
        out.append(f"  {c['id']:28} {c['stance']:8} from {c['start_date']} {c['weeks_since']:3}w  "
                   f"so far name {f(sf and sf['name_pct'])} core {f(sf and sf['core_pct'])} signed {f(sf and sf['signed_excess_pct'])}  "
                   + "  ".join(f"{h}w {f(c[f'w{h}'] and c[f'w{h}']['signed_excess_pct'])}" for h in HORIZONS))
    for p in doc["people"]:
        out.append(f"  {p['person']:24} n {p['n']} scored {p['scored']} matured@{JUDGE_AT}w {p[f'matured_{JUDGE_AT}w']} "
                   f"right {p[f'right_{JUDGE_AT}w_pct']} median {p[f'median_signed_excess_{JUDGE_AT}w']} "
                   f"{'enough' if p['enough'] else 'too few calls to judge'}")
    for v in doc["vias"]:
        out.append(f"  fund {v['via'][:40]:40} n {v['n']} matured@{JUDGE_AT}w {v[f'matured_{JUDGE_AT}w']} "
                   f"right {v[f'right_{JUDGE_AT}w_pct']} median {v[f'median_signed_excess_{JUDGE_AT}w']}")
    return out
