"""The other markets (config/markets.json): their lists and schema, the request budget of the two fetch runs, the per-market
fail-closed fetch and publication (data/markets/<id>/), lint of the published files, the fund cards' rules and the site
export (manifest.markets). Prices here are synthetic (samples/prices or generated rows); nothing touches the network."""
import contextlib
import copy
import io
import json
import shutil
import sys
import tempfile
import types
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import fetch_prices  # noqa: E402
import routines_code  # noqa: E402
from _common import (  # noqa: E402
    CONFIG, ROOT, SAMPLES, Validator, fetch_plan, load_json, market_symbols, market_watchlist, markets_config, other_markets,
    scope_symbols, settings, watchlist,
)
from lint import Lint, _cron_gap_minutes  # noqa: E402
from providers import tiingo  # noqa: E402

TLV = {"TEVA", "NICE", "CHKP", "ESLT", "TSEM", "ICL", "WIX", "MNDY", "GLBE", "NVMI", "CAMT", "ORA"}
ISHARES = {"IVV", "ACWI", "EFA", "IEMG", "EIS", "IJR", "SOXX", "AGG", "TLT"}


def lint_with_markets(soft=False) -> Lint:
    lt = Lint(soft_markets=soft)
    lt.markets = lt.check_markets_config(settings(), watchlist())
    return lt


class MarketsConfigTest(unittest.TestCase):
    def test_repo_files_are_valid_and_clean(self):
        v = Validator()
        mc = markets_config()
        self.assertEqual(v.validate(mc, "markets.schema.json"), [])
        self.assertEqual(mc["default"], "nasdaq")
        self.assertEqual([m["id"] for m in mc["markets"]], ["nasdaq", "tlv", "ishares"])
        for m in mc["markets"]:
            self.assertEqual(v.validate(market_watchlist(m), "watchlist.schema.json"), [], m["id"])
        lt = lint_with_markets()
        self.assertEqual((lt.errors, lt.warnings), ([], []))
        self.assertEqual(v.validate(load_json(CONFIG / "funds.json"), "funds.schema.json"), [])

    def test_the_lists_the_household_decided(self):
        by = {m["id"]: m for m in markets_config()["markets"]}
        self.assertEqual({s["symbol"] for s in market_watchlist(by["tlv"])["symbols"]}, TLV)
        self.assertEqual({s["symbol"] for s in market_watchlist(by["ishares"])["symbols"]}, ISHARES)
        self.assertEqual((by["nasdaq"]["benchmark"], by["tlv"]["benchmark"], by["ishares"]["benchmark"]), ("QQQ", "EIS", "SPY"))
        self.assertEqual(by["nasdaq"]["benchmark"], settings()["scoring"]["benchmark"]["symbol"])
        self.assertEqual(by["ishares"]["kind"], "funds")
        self.assertIn("not covered by our data provider", by["tlv"]["note"])
        self.assertTrue(all("sector" in s for s in market_watchlist(by["tlv"])["symbols"]))
        self.assertTrue(all("category" in s and "sector" not in s for s in market_watchlist(by["ishares"])["symbols"]))

    def tree(self, mutate_markets=None, mutate_lists=None):
        root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, root, True)
        shutil.copytree(CONFIG, root / "config")
        mc = load_json(root / "config" / "markets.json")
        lists = {m["id"]: load_json(root / m["watchlist"]) for m in mc["markets"] if m["id"] != mc["default"]}
        if mutate_markets:
            mutate_markets(mc)
        if mutate_lists:
            mutate_lists(lists)
        (root / "config" / "markets.json").write_text(json.dumps(mc))
        for mid, wl in lists.items():
            (root / "config" / "watchlists" / f"{mid}.json").write_text(json.dumps(wl))
        return root

    def errors(self, root, st=None):
        lt = Lint()
        lt.check_markets_config(st or settings(), watchlist(), root=root)
        return lt.errors

    def test_lint_catches(self):
        def bench_on_own_list(ls):
            ls["tlv"]["symbols"].append({"symbol": "EIS", "name": "Israel fund", "sector": "Financials"})

        def dup(ls):
            ls["ishares"]["symbols"].append(copy.deepcopy(ls["ishares"]["symbols"][0]))

        def fund_without_category(ls):
            s = ls["ishares"]["symbols"][0]
            s.pop("category")
            s["sector"] = "Financials"

        def stock_without_sector(ls):
            s = ls["tlv"]["symbols"][0]
            s.pop("sector")
            s["category"] = "Sector"

        def context_on_other(ls):
            ls["tlv"]["context"] = [{"symbol": "SGOV", "name": "Cash", "role": "cash"}]

        cases = {
            "benchmark on its own list": (None, bench_on_own_list, "is on its own list"),
            "duplicate symbol": (None, dup, "duplicate symbols"),
            "fund without category": (None, fund_without_category, "a funds market lists a fund category"),
            "stock without sector": (None, stock_without_sector, "a stocks market lists a GICS sector"),
            "context on another list": (None, context_on_other, "main list only"),
            "default moved": (lambda mc: mc["markets"][0].__setitem__("data", "data/markets/nasdaq"), None, "the default market is the main list"),
            "default benchmark differs": (lambda mc: mc["markets"][0].__setitem__("benchmark", "SPY"), None, "differs from settings"),
            "duplicate label": (lambda mc: mc["markets"][2].__setitem__("label", "TLV"), None, "duplicate market labels"),
            "unknown default": (lambda mc: mc.__setitem__("default", "zzz"), None, "is not a market"),
            "wrong data dir": (lambda mc: mc["markets"][1].__setitem__("data", "data/markets/other"), None, "publishes under data/markets/tlv"),
        }
        self.assertEqual(self.errors(self.tree()), [])
        for name, (mm, ml, msg) in cases.items():
            errs = self.errors(self.tree(mm, ml))
            self.assertTrue(any(msg in e for e in errs), f"{name}: {errs}")

    def test_a_benchmark_may_sit_on_another_markets_list(self):
        # EIS is TLV's benchmark and one of the iShares funds: allowed (only its own list is refused).
        self.assertIn("EIS", {s["symbol"] for s in market_watchlist(markets_config()["markets"][2])["symbols"]})
        self.assertEqual(self.errors(self.tree()), [])


class FetchBudgetTest(unittest.TestCase):
    """Tiingo's free plan: 50 requests an hour (its pricing page, checked 2026-10-10). One request per unique symbol."""

    def test_counts_per_run_and_both_runs_together(self):
        st = settings()
        plan = fetch_plan()
        nas, oth = scope_symbols(plan["nasdaq"]), scope_symbols(plan["markets"])
        self.assertEqual(len(nas), 28)  # 21 names, QQQ and six context funds
        self.assertEqual(len(oth), 22)  # 12 + EIS, 9 funds + SPY (EIS once)
        self.assertEqual(len(set(nas) | set(oth)), 49)  # both in one hour would leave no room for one retry
        self.assertEqual(st["prices"]["requests_per_hour"], 50)
        self.assertLessEqual(max(len(nas), len(oth)), st["prices"]["max_requests_per_run"])
        self.assertLess(st["prices"]["max_requests_per_run"], st["prices"]["requests_per_hour"])
        self.assertEqual(fetch_prices.symbols("markets"), oth)
        self.assertEqual(fetch_prices.symbols(), nas)

    def test_lint_guards_the_budget(self):
        st = copy.deepcopy(settings())
        st["prices"]["max_requests_per_run"] = 25
        lt = Lint()
        lt.check_markets_config(st, watchlist())
        self.assertTrue(any("the nasdaq fetch needs 28 requests" in e for e in lt.errors), lt.errors)
        st["prices"]["max_requests_per_run"] = 50
        lt = Lint()
        lt.check_markets_config(st, watchlist())
        self.assertTrue(any("must stay below the plan's requests_per_hour" in e for e in lt.errors), lt.errors)

    def test_the_two_runs_never_share_an_hour(self):
        rt = {r["id"]: r for r in load_json(CONFIG / "routines.json")["routines"]}
        self.assertGreaterEqual(_cron_gap_minutes(rt["fetch_prices"]["cron"], rt["fetch_markets"]["cron"]), 120)
        self.assertEqual(_cron_gap_minutes("40 23 * * 1-5", "10 0 * * 2-6"), 30)
        self.assertIsNone(_cron_gap_minutes("*/5 * * * *", "40 2 * * 2-6"))
        daily = (ROOT / ".github" / "workflows" / "daily.yml").read_text()
        for needle in ('--scope markets', '--scope nasdaq', 'routines_code.py markets', "--soft-markets",
                       "ROUTINE_FETCH_MARKETS", "ROUTINE_MARKET_LISTS", rt["fetch_markets"]["cron"]):
            self.assertIn(needle, daily)

    def test_budget_counts_retries_and_stops_when_spent(self):
        prov = types.SimpleNamespace(REQUESTS=7)
        b = fetch_prices.Budget(prov, cap=5)
        self.assertEqual((b.used(), b.retries()), (0, 3))
        prov.REQUESTS += 4
        self.assertEqual((b.used(), b.retries()), (4, 1))
        prov.REQUESTS += 1
        self.assertEqual(b.retries(), 0)
        b2 = fetch_prices.Budget(types.SimpleNamespace(), cap=2)  # a provider without a counter: one per symbol tried
        b2.tried = 2
        self.assertEqual(b2.retries(), 0)


def rows(days):
    return [{"date": f"{x.isoformat()}T00:00:00.000Z", "adjOpen": 123.4567, "adjHigh": 124.4567, "adjLow": 122.4567,
             "adjClose": 123.9876, "adjVolume": 1000} for x in days]


class FetchPerMarketTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        keep = settings()["prices"]["keep_days"]
        days, d = [], date(2026, 10, 2)
        while len(days) < keep:
            if d.weekday() < 5:
                days.append(d)
            d -= timedelta(days=1)
        self.days = days[::-1]
        self.fx = self.tmp / "fx"
        self.fx.mkdir()

    def run_fetch(self, *extra):
        out, err = io.StringIO(), io.StringIO()
        cache = self.tmp / "prices"
        with mock.patch.object(sys, "argv", ["fetch_prices.py", "--scope", "markets", "--fixtures", str(self.fx), *extra]), \
                mock.patch.object(fetch_prices, "PRICES", cache), \
                contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            rc = fetch_prices.main()
        return rc, out.getvalue(), err.getvalue(), cache

    def test_all_markets_pass(self):
        for s in fetch_prices.symbols("markets"):
            (self.fx / f"{s}.json").write_text(json.dumps(rows(self.days)))
        rc, out, err, cache = self.run_fetch()
        self.assertEqual(rc, 0, err)
        self.assertIn("22 symbols for 2 market(s)", out)
        self.assertEqual(sorted(p.stem for p in cache.glob("*.json")), sorted(fetch_prices.symbols("markets")))
        self.assertNotIn("123.98", out + err)

    def test_one_failed_market_writes_nothing_for_it_and_the_other_still_writes(self):
        for s in fetch_prices.symbols("markets"):
            if s != "TEVA":
                (self.fx / f"{s}.json").write_text(json.dumps(rows(self.days)))
        (self.fx / "TEVA.json").write_text(json.dumps({"detail": "Not found."}))
        rc, out, err, cache = self.run_fetch()
        self.assertEqual(rc, 1)
        self.assertIn("market tlv FAILED", err)
        self.assertNotIn("market ishares FAILED", err)
        written = {p.stem for p in cache.glob("*.json")}
        bench_and_funds = set(market_symbols(other_markets()[1]))
        self.assertEqual(written, bench_and_funds)  # EIS is written: iShares holds it and passed
        self.assertNotIn("TEVA", written)
        self.assertNotIn("123.98", out + err)

    def test_provider_errors_never_echo_values(self):
        with self.assertRaises(tiingo.ProviderError) as e:
            tiingo.parse({"symbol": "X", "bars": [{"close": 123.9876}]}, "X")
        self.assertNotIn("123.98", str(e.exception))
        with self.assertRaises(tiingo.ProviderError) as e:
            tiingo.parse([{"date": "2026-10-01T00:00:00Z", "adjOpen": 123.9876}], "X")
        self.assertNotIn("123.98", str(e.exception))
        self.assertIn("2026-10-01", str(e.exception))


class PublishMarketsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.st, cls.cfg = settings(), routines_code.checklist_config()

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_compute_market_on_samples(self):
        for m in other_markets():
            res = routines_code.compute_market(m, SAMPLES / "prices", self.st, self.cfg, sample=False, provider="tiingo")
            d, cl = res["derived"], res["checklist"]
            self.assertEqual(Validator().validate(d, "derived.schema.json"), [])
            self.assertEqual(d["benchmark"], m["benchmark"])
            self.assertEqual({r["symbol"] for r in d["symbols"]}, set(market_symbols(m)))
            self.assertNotIn("context", d)
            self.assertEqual(cl["benchmark"], m["benchmark"])
            self.assertEqual(cl["as_of"], d["as_of"])
            self.assertEqual(sorted(res["candles"]), sorted(r["symbol"] for r in cl["symbols"]))
            self.assertEqual(res["refused"], [])

    def test_the_main_lists_numbers_do_not_move(self):
        # The benchmark parameter defaults to the settings one: the Nasdaq numbers are the same with or without it.
        wl = watchlist()
        a = routines_code.compute_derived(SAMPLES / "prices", self.st, wl, sample=True, provider="sample")
        b = routines_code.compute_derived(SAMPLES / "prices", self.st, wl, sample=True, provider="sample", bench="QQQ")
        self.assertEqual(a, b)

    def test_a_market_missing_a_symbol_is_refused(self):
        prices = self.tmp / "prices"
        shutil.copytree(SAMPLES / "prices", prices)
        (prices / "TEVA.json").unlink()
        with self.assertRaises(SystemExit) as e:
            routines_code.compute_market(other_markets()[0], prices, self.st, self.cfg, sample=False, provider="tiingo")
        self.assertIn("TEVA", str(e.exception))

    def run_markets(self, drop=()):
        prices = self.tmp / "prices"
        shutil.copytree(SAMPLES / "prices", prices, dirs_exist_ok=True)
        for s in drop:
            (prices / f"{s}.json").unlink()
        err = io.StringIO()
        with mock.patch.object(routines_code, "PRICES", prices), mock.patch.object(routines_code, "ROOT_DIR", self.tmp), \
                contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            try:
                routines_code.run_markets()
                rc = 0
            except SystemExit:
                rc = 1
        return rc, err.getvalue()

    def test_run_markets_fails_closed_per_market_and_never_touches_the_main_list(self):
        rc, err = self.run_markets(drop=("TEVA",))
        self.assertEqual(rc, 1)
        self.assertIn("tlv FAILED", err)
        self.assertFalse((self.tmp / "data" / "markets" / "tlv").exists())
        ish = self.tmp / "data" / "markets" / "ishares"
        self.assertTrue((ish / "derived.json").exists() and (ish / "checklist.json").exists())
        self.assertEqual(len(list((ish / "candles").glob("*.json"))), 10)
        self.assertFalse((self.tmp / "data" / "market").exists())

    def test_published_files_lint_clean_and_problems_are_per_market(self):
        self.assertEqual(self.run_markets()[0], 0)
        data = self.tmp / "data"
        lt = lint_with_markets()
        lt.check_markets_data(data)
        self.assertEqual((lt.errors, lt.warnings, lt.bad_markets), ([], [], set()))
        # A checklist written on another day than derived.json: an error, a warning in the Nasdaq run (--soft-markets).
        p = data / "markets" / "tlv" / "checklist.json"
        cl = load_json(p)
        cl["as_of"] = "2026-09-30"
        p.write_text(json.dumps(cl))
        lt = lint_with_markets()
        lt.check_markets_data(data)
        self.assertTrue(any("differs from derived.json" in e for e in lt.errors), lt.errors)
        self.assertEqual(lt.bad_markets, {"tlv"})
        soft = lint_with_markets(soft=True)
        soft.check_markets_data(data)
        self.assertEqual(soft.errors, [])
        self.assertTrue(any("differs from derived.json" in w for w in soft.warnings))
        # A directory for a market that is not configured, and a sample file in data/.
        (data / "markets" / "zzz").mkdir()
        d = data / "markets" / "ishares" / "derived.json"
        doc = load_json(d)
        doc["sample"] = True
        d.write_text(json.dumps(doc))
        lt = lint_with_markets()
        lt.check_markets_data(data)
        self.assertTrue(any("not a configured market" in e for e in lt.errors))
        self.assertTrue(any("live data only" in e for e in lt.errors))


class OutlookAndFundsLintTest(unittest.TestCase):
    def test_outlook_cards_may_name_any_markets_list(self):
        lt = lint_with_markets()
        self.assertIn("TEVA", lt.all_market_symbols(include_bench=False))
        self.assertNotIn("QQQ", lt.all_market_symbols(include_bench=False))
        self.assertIn("QQQ", lt.all_market_symbols())

    def card(self, **kw):
        c = {"ticker": "IVV", "name": "iShares Core S&P 500 ETF", "as_of": "2026-10-09",
             "holds": "Shares of the largest companies listed in the United States.",
             "plain": "One fund that owns a slice of the biggest American companies.", "category": "US large companies",
             "expense_ratio_pct": 0.03, "index_tracked": "S&P 500", "source_url": "https://www.ishares.com/us/products/x"}
        c.update(kw)
        return c

    def errors(self, *cards, today="2026-10-10"):
        fc = {**load_json(CONFIG / "funds.json"), "funds": list(cards)}
        self.assertEqual(Validator().validate(fc, "funds.schema.json"), [])
        lt = lint_with_markets()
        lt.check_funds(CONFIG / "funds.json", fc, today=today)
        return lt.errors, lt.warnings

    def test_good_card_and_rules(self):
        self.assertEqual(self.errors(self.card()), ([], []))
        cases = {
            "digits in holds": (self.card(holds="About five hundred, or 500, large American companies."), "digits"),
            "digits in plain": (self.card(plain="It owns 500 companies in one fund for you."), "digits"),
            "not on a funds list": (self.card(ticker="TEVA"), "not on a funds market's list"),
            "future": (self.card(as_of="2026-11-01"), "in the future"),
            "rating": (self.card(top_note="Analysts rate it a strong buy this year."), "rating"),
            "quotation": (self.card(plain="The fund calls itself “the core of a portfolio” today."), "quotation"),
        }
        for name, (c, msg) in cases.items():
            errs, _ = self.errors(c)
            self.assertTrue(any(msg in e for e in errs), f"{name}: {errs}")
        errs, _ = self.errors(self.card(), self.card())
        self.assertTrue(any("duplicate tickers" in e for e in errs))
        _, warns = self.errors(self.card(source_url="https://example.com/ivv"))
        self.assertTrue(any("not the fund's own page" in w for w in warns))

    def test_schema_refuses_extra_keys_and_text_ratios(self):
        fc = {**load_json(CONFIG / "funds.json"), "funds": [self.card(price_target=1)]}
        self.assertTrue(Validator().validate(fc, "funds.schema.json"))
        fc = {**load_json(CONFIG / "funds.json"), "funds": [self.card(expense_ratio_pct="0.03%")]}
        self.assertTrue(Validator().validate(fc, "funds.schema.json"))


class SiteExportTest(unittest.TestCase):
    def test_sample_build_exports_every_market(self):
        import build_site
        out = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, out, True)
        with mock.patch.object(build_site, "OUT", out), \
                mock.patch.object(sys, "argv", ["build_site.py", "--source", "sample", "--skip-lint"]), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(build_site.main(), 0)
        man = load_json(out / "manifest.json")
        ms = man["markets"]
        self.assertEqual(list(ms), ["nasdaq", "tlv", "ishares"])
        keys = {"label", "name", "note", "kind", "benchmark", "benchmark_label", "default", "sample", "derived", "checklist",
                "candles", "watchlist"}
        for mid, e in ms.items():
            self.assertEqual(set(e), keys, mid)
            self.assertTrue(e["sample"])
            self.assertTrue((out / e["watchlist"]).exists())
            d = load_json(out / e["derived"])
            self.assertEqual(d["benchmark"], e["benchmark"])
            self.assertTrue(d["sample"])
            cl = load_json(out / e["checklist"])
            self.assertEqual(sorted(e["candles"]), sorted(r["symbol"] for r in cl["symbols"]))
        self.assertEqual(ms["nasdaq"]["derived"], man["market"])
        self.assertEqual(ms["nasdaq"]["candles"], man["candles"])
        self.assertEqual(ms["tlv"]["derived"], "markets/tlv/derived.json")
        self.assertEqual(ms["ishares"]["candles"]["EIS"], "markets/ishares/candles/EIS.json")
        self.assertEqual(ms["ishares"]["kind"], "funds")
        names = {d["name"] for d in man["docs"]}
        self.assertTrue({"markets", "funds"} <= names)

    def test_live_build_without_market_files_shows_no_numbers(self):
        import build_site
        out = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, out, True)
        with mock.patch.object(build_site, "OUT", out):
            ms = build_site.export_markets("auto", "live", settings(), None, {})
            self.assertIsNone(ms["tlv"]["derived"])
            self.assertFalse(ms["tlv"]["sample"])
            skipped = build_site.export_markets("sample", "sample", settings(), None, {}, skip={"tlv"})
            self.assertIsNone(skipped["tlv"]["derived"])
            self.assertIsNotNone(skipped["ishares"]["derived"])

    def test_loader_exposes_markets(self):
        js = (ROOT / "site" / "src" / "lib" / "data.js").read_text()
        for needle in ("export function loadMarket", "export function marketsFrom", "markets, marketsConfig, funds"):
            self.assertIn(needle, js)


if __name__ == "__main__":
    unittest.main()
