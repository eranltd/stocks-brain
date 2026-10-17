"""'When could we buy it?': what the Five Leaders rule would do if today's close were its review day (pure; no I/O).

This module explains a decision; it never makes one. The decision is the rule's own engine, `rules.pick_names`, called
with the same config, settings and random seed the forward ledger uses (routines_code.update_ledger), today's index as
the decision day and the rule's latest paper holdings as the names it holds. Each check shown per name is evaluated by
the engine's own filter and rank functions (rules.FILTERS, rules._passes, rules._rank_value, rules.eligible), never
re-implemented. The blocker codes are then derived from those checks and from the engine's result, and the result is
cross-checked: the names with no blocker must be exactly the names the engine picked, or the step fails closed.

Only ranks, booleans and percentages leave this module (provider licence: no prices, no volume).
"""
from __future__ import annotations

import random

import market as mk
import rules as rl
import us_market_calendar as cal

BLOCKERS = ("not_eligible", "rank_too_low", "sector_taken", "below_200", "falling_200", "stretched", "no_slot")


class Unexplained(Exception):
    """The engine's pick and the per-name checks disagree: nothing is published."""


def _spec(cfg: dict) -> tuple[dict, dict, dict]:
    """The rule's entry filters by name, its keep settings and its 200-day line (the trend_long filter)."""
    sel = cfg["selection"]
    if sel.get("method") != "filters" or cfg.get("regime") not in (None, "none"):
        raise ValueError("buy_window explains a 'filters' rule without a market gate (Five Leaders)")
    entry = {f["f"]: f for f in sel.get("filters", [])}
    for f in sel.get("filters", []) + sel.get("keep", {}).get("filters", []):
        if f["f"] not in ("trend_long", "not_stretched", "above_sma"):
            raise ValueError(f"buy_window cannot explain filter {f['f']!r}")
    keep = sel.get("keep", {"mode": "none"})
    if keep["mode"] not in ("rank_top", "none"):
        raise ValueError(f"buy_window cannot explain keep mode {keep['mode']!r}")
    trend = entry.get("trend_long", {"f": "trend_long", "n": 200, "rising_days": 21})
    return entry, keep, trend


def _window_ok(c: list, i: int, need: int) -> bool:
    return i - need + 1 >= 0 and all(x is not None for x in c[i - need + 1:i + 1])


def _codes(f: dict, above: bool | None, rising: bool | None) -> list[str]:
    """Why one engine filter failed, in blocker codes (the filter itself already said it failed)."""
    if f["f"] == "trend_long":
        return (["below_200"] if not above else []) + (["falling_200"] if not rising else [])
    if f["f"] == "above_sma":
        return ["below_200"]
    return ["stretched"]  # not_stretched


def explain(cfg: dict, M: dict, st: dict, i: int, held: list[str]) -> dict:
    """Per-name checks and blockers for the decision the engine would take at the close of day i holding `held`.

    Returns {"would_hold": [...], "of": n_eligible, "names": {symbol: {...}}} for every name in M["c"] (the members that
    have prices). Raises Unexplained if the blockers do not reproduce the engine's pick exactly."""
    entry, keep, trend = _spec(cfg)
    picked = rl.pick_names(cfg, M, st, i, held, random.Random(0))  # the ledger's own call (seed 0)
    sel, bench = cfg["selection"], M["bench"]
    elig = rl.eligible(M, i)
    key = {s: rl._rank_value(sel["rank"], M["c"][s], bench, i, st) for s in elig}
    order = sorted(key, key=key.get, reverse=True)  # the engine's own ordering expression
    rank = {s: k + 1 for k, s in enumerate(order)}
    top = set(order[: keep["n"]]) if keep["mode"] == "rank_top" else set()
    sector = M["sector"]
    leader: dict[str, str] = {}
    for s in order:
        leader.setdefault(sector.get(s, "Unknown"), s)
    cap, slots = cfg.get("max_per_sector", 2), cfg["slots"]
    per_sector: dict[str, int] = {}
    for s in picked:
        per_sector[sector.get(s, "Unknown")] = per_sector.get(sector.get(s, "Unknown"), 0) + 1
    n200, rd = trend.get("n", 200), trend.get("rising_days", 21)
    stretch_f = entry.get("not_stretched", {"f": "not_stretched", "pct": 8})
    names: dict[str, dict] = {}
    for s, c in M["c"].items():
        sec = sector.get(s, "Unknown")
        ok200 = _window_ok(c, i, n200 + rd)
        ok50 = _window_ok(c, i, 50)
        above = bool(rl.FILTERS["above_sma"](c, bench, i, {"n": n200})) if ok200 else None
        rising = bool(mk.sma(c, n200, i) > mk.sma(c, n200, i - rd)) if ok200 else None
        if ok200 and bool(rl.FILTERS["trend_long"](c, bench, i, trend)) != (above and rising):
            raise Unexplained(f"{s}: the 200-day check does not split into 'above' and 'rising'")
        dist = round(rl._dist50(c, i), 2) if ok50 else None
        stretched = (not rl.FILTERS["not_stretched"](c, bench, i, stretch_f)) if ok50 else None
        row = {"eligible": s in key, "rank": rank.get(s), "of": len(order), "sector": sec, "sector_leader": leader.get(sec),
               "held_now": s in held, "would_hold_if_today": s in picked, "above_200": above, "rising_200": rising,
               "dist_sma50_pct": dist, "stretched": stretched, "blockers": []}
        if s not in key:
            row["blockers"] = ["not_eligible"]
        elif s not in picked:
            codes: list[str] = []
            kept = s in held and s in top and rl._passes(keep.get("filters", []), c, bench, i)
            if s in held and not kept:  # a held name that lost its keep priority, then judged again as a newcomer
                if keep["mode"] == "rank_top" and s not in top:
                    codes.append("rank_too_low")
                codes += [x for f in keep.get("filters", []) if not rl._passes([f], c, bench, i)
                          for x in _codes(f, above, rising)]
            if kept or rl._passes(list(entry.values()), c, bench, i):  # a candidate the slots or the sector cap left out
                codes += ["sector_taken"] if per_sector.get(sec, 0) >= cap else ["no_slot"] if len(picked) >= slots else []
                if codes == [] or codes[-1] not in ("sector_taken", "no_slot"):
                    raise Unexplained(f"{s}: passed every check but the engine left it out for a reason this card cannot name")
            else:
                codes += [x for f in entry.values() if not rl._passes([f], c, bench, i)
                          for x in _codes(f, above, rising)]
            row["blockers"] = list(dict.fromkeys(codes))
        names[s] = row
    clear = {s for s, r in names.items() if not r["blockers"]}
    if clear != set(picked):
        raise Unexplained(f"blockers do not reproduce the engine's pick: engine {sorted(picked)}, unblocked {sorted(clear)}")
    return {"would_hold": picked, "of": len(order), "names": names}


def held_for_decision(ledger_row: dict | None, as_of: str) -> tuple[list[str], list[str]]:
    """(held_now, held_input). held_now: the names in the rule's latest paper rebalance. held_input: the names the rule
    held going INTO today's decision. They differ only on a review day, when the ledger has already written today's
    decision: the engine is then given the decision before it, so today's would-hold equals the recorded decision."""
    rebs = (ledger_row or {}).get("rebalances", [])
    if not rebs:
        return [], []
    now = list(rebs[-1]["holdings"])
    if rebs[-1]["date"] == as_of:
        return now, list(rebs[-2]["holdings"]) if len(rebs) > 1 else []
    return now, now


def build(cfg: dict, M: dict, st: dict, ledger_row: dict | None, members: list[str], sectors: dict[str, str],
          rule_id: str, rule_label: str, sample: bool) -> dict:
    """The data/market/buy_window.json document for the main list, as of M's last day."""
    i = M["n"] - 1
    as_of = M["dates"][i]
    held_now, held_in = held_for_decision(ledger_row, as_of)
    ex = explain(cfg, M, st, i, held_in)
    entry, keep, _ = _spec(cfg)
    names = {}
    for s in members:  # a name with no usable prices today is listed as not eligible, with nothing known
        names[s] = ex["names"].get(s) or {
            "eligible": False, "rank": None, "of": ex["of"], "sector": sectors.get(s, "Unknown"), "sector_leader": None,
            "held_now": s in held_now, "would_hold_if_today": False, "above_200": None, "rising_200": None,
            "dist_sma50_pct": None, "stretched": None, "blockers": ["not_eligible"]}
        names[s]["held_now"] = s in held_now
        if names[s]["sector_leader"] is None:
            names[s]["sector_leader"] = next((r["sector_leader"] for r in ex["names"].values()
                                              if r["sector"] == names[s]["sector"] and r["sector_leader"]), None)
    return {"as_of": as_of, "sample": sample, "rule": rule_id, "rule_label": rule_label,
            "next_review": cal.next_review(as_of), "next_review_quarterly": cal.next_review(as_of, quarterly=True),
            "slots": cfg["slots"], "keep_rank": keep.get("n", 0),
            "stretch_limit_pct": float(entry.get("not_stretched", {}).get("pct", 8)),
            "held_now": held_now, "would_hold_if_today": ex["would_hold"], "names": names}


def problems(doc: dict, on_list: set[str]) -> list[str]:
    """Consistency of a published buy_window document (lint and tests): tickers on the main list, the lists agree with
    the per-name flags, blockers explain exactly who is out, review dates are trading days in the future."""
    out = []
    names = doc["names"]
    for t in {*names, *doc["held_now"], *doc["would_hold_if_today"]} - on_list:
        out.append(f"{t} is not on the main list")
    for s, r in names.items():
        if r["would_hold_if_today"] != (s in doc["would_hold_if_today"]):
            out.append(f"{s}: would_hold_if_today flag disagrees with the list")
        if r["held_now"] != (s in doc["held_now"]):
            out.append(f"{s}: held_now flag disagrees with the list")
        if bool(r["blockers"]) == r["would_hold_if_today"]:
            out.append(f"{s}: a name is either held by the rule today or has a reason it is not, never both or neither")
        if r["eligible"] != (r["rank"] is not None) or (not r["eligible"]) != ("not_eligible" in r["blockers"]):
            out.append(f"{s}: eligible, rank and the not_eligible blocker disagree")
        if r["rank"] is not None and not 1 <= r["rank"] <= r["of"]:
            out.append(f"{s}: rank {r['rank']} outside 1..{r['of']}")
        if r["sector_leader"] is not None and r["sector_leader"] in names and names[r["sector_leader"]]["sector"] != r["sector"]:
            out.append(f"{s}: sector leader {r['sector_leader']} is in another sector")
        if r["dist_sma50_pct"] is not None and not -95 <= r["dist_sma50_pct"] <= 500:
            out.append(f"{s}: dist_sma50_pct {r['dist_sma50_pct']} is not a sane percent (a price must never appear here)")
    if len(doc["would_hold_if_today"]) > doc["slots"]:
        out.append("more names than slots")
    for key, quarterly in (("next_review", False), ("next_review_quarterly", True)):
        if doc[key] != cal.next_review(doc["as_of"], quarterly):
            out.append(f"{key} {doc[key]} is not the first trading day after {doc['as_of']} by the market calendar")
    return out
