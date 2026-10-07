"""People we learn from: score each dated public call in config/people.json against the S&P 500 core.

Learn from them, but measure them. Every call is scored on the published weekly indexed lines (data/market/longrun.json
`weekly`: one point every five trading days, the name and the core indexed to 100), never on raw prices. A call starts
at the first weekly point strictly AFTER the day it became public (no look-ahead), and is measured over 13, 26 and 52
weeks once that much time has passed, and "so far" to the latest point:

    excess = (1 + name growth) / (1 + core growth) - 1          (percent)
    signed excess = excess for a bullish call, -excess for a bearish one; the call was right when it is above zero.

A call on a name that is not on our watchlist is kept and shown, but not scored. A person's record says nothing until at
least MIN_MATURED of their calls are half a year old. Run by `routines_code.py people` (routine score_people).
"""
from __future__ import annotations

from statistics import median

HORIZONS = (13, 26, 52)  # weekly points (five trading days each)
JUDGE_AT = 26            # the record is judged on calls that are half a year old
MIN_MATURED = 10         # fewer matured calls than this: "too few calls to judge"
NOTES = {"off_list": "not on our list", "no_history": "no published history for this name yet",
         "too_new": "no weekly close after the public date yet"}


def _leg(name: list[float], core: list[float], dates: list[str], k: int, j: int, stance: str) -> dict:
    g, c = name[j] / name[k] - 1, core[j] / core[k] - 1
    excess = ((1 + g) / (1 + c) - 1) * 100
    signed = excess if stance == "bullish" else -excess
    return {"weeks": j - k, "end_date": dates[j], "name_pct": round(g * 100, 2), "core_pct": round(c * 100, 2),
            "excess_pct": round(excess, 2), "signed_excess_pct": round(signed, 2), "right": signed > 0}


def score_call(call: dict, weekly: dict, on_list: set[str]) -> dict:
    """One call against the weekly series {dates, core, members: {SYMBOL: [...]}}."""
    out = {k: call[k] for k in ("id", "person", "via", "date", "ticker", "stance")}
    dates, core, members = weekly["dates"], weekly["core"], weekly["members"]
    t = call["ticker"]
    k = next((i for i, d in enumerate(dates) if d > call["date"]), None)  # strictly after: no look-ahead
    reason = "off_list" if t not in on_list else "no_history" if t not in members else "too_new" if k is None else None
    if reason:
        return {**out, "scored": False, "note": NOTES[reason], "start_date": None, "weeks_since": None,
                "so_far": None, **{f"w{h}": None for h in HORIZONS}}
    name, last = members[t], len(dates) - 1
    return {**out, "scored": True, "start_date": dates[k], "weeks_since": last - k,
            "so_far": _leg(name, core, dates, k, last, call["stance"]) if last > k else None,
            **{f"w{h}": _leg(name, core, dates, k, k + h, call["stance"]) if k + h <= last else None for h in HORIZONS}}


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


def compute_scores(cfg: dict, longrun: dict, on_list: set[str]) -> dict:
    weekly = longrun["weekly"]
    people = {p["id"]: p for p in cfg["people"]}
    unknown = sorted({c["person"] for c in cfg["calls"]} - set(people))
    if unknown:
        raise SystemExit(f"people: calls name unknown people {unknown} (fail closed)")
    calls = [score_call(c, weekly, on_list) for c in sorted(cfg["calls"], key=lambda c: (c["date"], c["id"]))]
    by_person = [{"person": pid, "name": people[pid]["name"], "vias": sorted({r["via"] for r in rows}), **record(rows)}
                 for pid in people if (rows := [r for r in calls if r["person"] == pid])]
    by_via = [{"via": via, "persons": sorted({r["person"] for r in rows}), **record(rows)}
              for via in sorted({r["via"] for r in calls}) if (rows := [r for r in calls if r["via"] == via])]
    return {
        "as_of": weekly["dates"][-1], "sample": longrun["sample"], "core": longrun["core"], "config_version": cfg["version"],
        "series": "data/market/longrun.json weekly (indexed lines, one point every five trading days)",
        "method": ("Start at the first weekly close after the public date; growth of the name vs the S&P 500 core over 13, 26 and "
                   "52 weeks and so far; excess = (1+name)/(1+core)-1; signed for the stance (a bearish call is right when the name lagged)."),
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
    return out
