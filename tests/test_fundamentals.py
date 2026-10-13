"""SEC company numbers: quarters from 10-Q/10-K facts, point in time, and the pack's compact view."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import build_pack  # noqa: E402
import fundamentals as f  # noqa: E402
from _common import Validator  # noqa: E402


def fact(start, end, val, filed, form="10-Q"):
    return {"start": start, "end": end, "val": val, "filed": filed, "form": form}


# A calendar-year company over two years: income reported per quarter plus the 10-K year, cash flow year to date only.
YEARS = {2024: 100.0, 2025: 120.0}


def revenue_facts():
    out = []
    for y, base in YEARS.items():
        q = [base, base + 2, base + 4, base + 6]
        ends = [f"{y}-03-31", f"{y}-06-30", f"{y}-09-30", f"{y}-12-31"]
        starts = [f"{y}-01-01", f"{y}-04-01", f"{y}-07-01", f"{y}-10-01"]
        for i in range(3):  # no direct fourth quarter: it is the 10-K year minus nine months
            out.append(fact(starts[i], ends[i], q[i], f"{y}-{(i + 1) * 3 + 1:02d}-28"))
            if i:
                out.append(fact(f"{y}-01-01", ends[i], sum(q[:i + 1]), f"{y}-{(i + 1) * 3 + 1:02d}-28"))
        out.append(fact(f"{y}-01-01", ends[3], sum(q), f"{y + 1}-02-10", "10-K"))
    return out


def ytd_facts(per_quarter):
    """Cash-flow style: only year-to-date figures (3, 6, 9 and 12 months)."""
    out = []
    for y in YEARS:
        ends = [f"{y}-03-31", f"{y}-06-30", f"{y}-09-30", f"{y}-12-31"]
        for i, e in enumerate(ends):
            out.append(fact(f"{y}-01-01", e, per_quarter * (i + 1), "2026-01-01" if i == 3 and y == 2025 else f"{y}-12-01",
                            "10-K" if i == 3 else "10-Q"))
    return out


class QuartersTest(unittest.TestCase):
    def test_fourth_quarter_and_cash_flow_are_derived(self):
        q = f.quarters(revenue_facts(), "2026-06-01")
        self.assertEqual(q["2025-12-31"]["val"], 126.0)
        self.assertFalse(q["2025-12-31"]["direct"])
        cf = f.quarters(ytd_facts(10.0), "2026-06-01")
        self.assertEqual([cf[e]["val"] for e in sorted(cf)][-4:], [10.0, 10.0, 10.0, 10.0])

    def test_point_in_time_drops_later_filings_and_takes_the_newest_restatement(self):
        facts = revenue_facts()
        q = f.quarters(facts, "2025-12-31")  # the 2025 10-K (filed 2026-02-10) is not public yet
        self.assertNotIn("2025-12-31", q)
        facts.append(fact("2025-07-01", "2025-09-30", 999.0, "2026-03-01", "10-Q/A"))
        self.assertEqual(f.quarters(facts, "2026-02-28")["2025-09-30"]["val"], 124.0)
        self.assertEqual(f.quarters(facts, "2026-03-01")["2025-09-30"]["val"], 999.0)

    def test_sixteen_week_quarter_counts(self):
        q = f.quarters([fact("2025-05-12", "2025-08-31", 50.0, "2025-10-01", "10-K")], "2026-01-01")
        self.assertIn("2025-08-31", q)  # 111 days: Costco's and PepsiCo's long quarter

    def test_a_hole_breaks_the_chain(self):
        q = f.quarters(revenue_facts(), "2026-06-01")
        self.assertEqual(len(f.chain(q, 8)), 8)
        del q["2025-06-30"]
        self.assertIsNone(f.chain(q, 4))


class CompanyViewTest(unittest.TestCase):
    def doc(self):
        return {"entityName": "Test Co", "facts": {"us-gaap": {
            "Revenues": {"units": {"USD": revenue_facts()}},
            "OperatingIncomeLoss": {"units": {"USD": [dict(x, val=x["val"] / 4) for x in revenue_facts()]}},
            "NetCashProvidedByUsedInOperatingActivities": {"units": {"USD": ytd_facts(30.0)}},
            "PaymentsToAcquirePropertyPlantAndEquipment": {"units": {"USD": ytd_facts(10.0)}},
        }}}

    def test_ttm_growth_margins_and_missing(self):
        row = f.company_view("TST", 1, self.doc(), "2026-06-01")
        self.assertEqual(row["status"], "ok")
        self.assertEqual(row["period_end"], "2025-12-31")
        self.assertEqual(row["revenue_ttm"], 492)
        self.assertEqual(row["revenue_growth_yoy_pct"], round((492 - 412) / 412 * 100, 1))
        self.assertEqual(row["quarter_revenue_growth_yoy_pct"], round((126 - 106) / 106 * 100, 1))
        self.assertEqual(row["operating_margin_pct"], 25.0)
        self.assertEqual(row["free_cash_flow_ttm"], 80)
        self.assertEqual(row["missing"], ["net_income"])
        self.assertIsNone(row["net_margin_pct"])
        doc = {"as_of": "2026-06-01", "sample": False, "source": "test", "companies": [row]}
        self.assertEqual(Validator().validate(doc, "fundamentals.schema.json"), [])

    def test_no_revenue_is_no_data_and_old_is_stale(self):
        self.assertEqual(f.company_view("TST", 1, {"facts": {}}, "2026-06-01")["status"], "no_data")
        self.assertEqual(f.company_view("TST", 1, self.doc(), "2027-01-01")["status"], "stale")

    def test_build_needs_a_contact_in_the_user_agent(self):
        import os
        old = os.environ.pop(f.UA_ENV, None)
        try:
            with self.assertRaises(f.SecError):
                f.build(["TST"], "2026-06-01")
        finally:
            if old is not None:
                os.environ[f.UA_ENV] = old


class PackBlockTest(unittest.TestCase):
    def test_compact_view_is_point_in_time(self):
        rows = [{"symbol": "AAA", "cik": 1, "name": "A", "status": "ok", "period_end": "2026-06-30", "filed": "2026-08-01",
                 "revenue_growth_yoy_pct": 12.3, "quarter_revenue_growth_yoy_pct": None, "operating_margin_pct": 30.0,
                 "net_margin_pct": 20.0, "fcf_margin_pct": 15.0},
                {"symbol": "BBB", "cik": 2, "name": "B", "status": "ok", "period_end": "2026-09-30", "filed": "2026-10-20",
                 "revenue_growth_yoy_pct": 5.0},
                {"symbol": "CCC", "cik": 3, "name": "C", "status": "no_data"}]
        block = build_pack.fundamentals_block({"sample": False, "companies": rows}, {"AAA", "BBB", "CCC"}, "2026-10-12")
        self.assertEqual(list(block["names"]), ["aaa"])  # BBB filed after the close, CCC has nothing
        self.assertEqual(block["names"]["aaa"], {"period_end": "2026-06-30", "growth": 12.3, "op_margin": 30.0, "net_margin": 20.0, "fcf_margin": 15.0})
        self.assertEqual(build_pack.fundamentals_block({"sample": True, "companies": rows}, {"AAA"}, "2026-10-12"), {})


if __name__ == "__main__":
    unittest.main()
