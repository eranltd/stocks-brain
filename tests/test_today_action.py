"""Today's action line for the morning push (scripts/today_action.py). Made-up tickers only."""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import today_action as ta  # noqa: E402

CALM = {"context": {"instruments": [{"role": "spx", "change_1d_pct": 0.3, "from_high_pct": -1.0}]}}


def pick(t, stance="neutral"):
    return {"ticker": t, "stance": stance, "conviction": "low"}


def run(d, picks, bets=None):
    return {"date": d, "status": "ok", "picks": [{"pick": p} for p in picks], **({"bets": bets} if bets else {})}


BET = {"best": ["AAA", "BBB", "CCC"], "worst": ["DDD", "EEE", "FFF"], "why": "a plain reason"}


class TodayActionTest(unittest.TestCase):
    def test_monday_is_buy_day_and_a_holiday_moves_it(self):
        self.assertTrue(ta.real_money(date(2026, 11, 2), {}).startswith("TODAY: weekly buy day"))
        # Labor Day 2026 is Mon 7 Sep: the week's buy moves to Tuesday
        self.assertTrue(ta.real_money(date(2026, 9, 8), {}).startswith("TODAY: weekly buy day"))
        self.assertIn("no action", ta.real_money(date(2026, 9, 7), {}))

    def test_other_days_name_the_next_buy_and_calm_a_drop(self):
        self.assertEqual(ta.real_money(date(2026, 10, 29), {"day": 0.3, "from_high": -1}), "TODAY: no action needed. Next buy Mon 2 Nov.")
        self.assertIn("fell 2.5% - don't sell", ta.real_money(date(2026, 10, 29), {"day": -2.5, "from_high": -4}))
        self.assertIn("12% off its high", ta.real_money(date(2026, 10, 29), {"day": -0.5, "from_high": -12}))

    def test_paper_side_new_bet_moved_call_or_all_neutral(self):
        earlier = [run("2026-10-26", [pick("AAA")], BET)]
        self.assertIn("new weekly bet", ta.pretend({"picks": [pick("AAA")], "bets": BET}, "2026-11-02", earlier))
        self.assertEqual(ta.pretend({"picks": [pick("AAA")], "bets": BET}, "2026-10-28", earlier), "Paper: all calls neutral.")
        self.assertEqual(ta.pretend({"picks": [pick("AAA", "bullish")], "bets": BET}, "2026-10-28", earlier), "Paper: AAA bullish.")

    def test_the_whole_line_fits_a_push(self):
        out = ta.line(date(2026, 11, 2), "2026-10-30", {"picks": [pick("AAA")], "bets": BET}, [], CALM)
        self.assertLessEqual(len(out), ta.PUSH_MAX)
        self.assertTrue(out.startswith("TODAY: weekly buy day"))


if __name__ == "__main__":
    unittest.main()
