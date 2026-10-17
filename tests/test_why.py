"""Why-it-moved notes: which moves code flags (scripts/why_candidates.py), whether a day is recorded
(scripts/why_status.py), the record's checks and merge (scripts/record_why.py), the Action and the routine registry,
and lint of the published file. Moves are synthetic percent series; tickers are made up (AAA, BBB, ...)."""
import copy
import json
import re
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import record_why  # noqa: E402
import why_candidates as wc  # noqa: E402
import why_status  # noqa: E402
from _common import CONFIG, ROOT, Validator, dump_json, load_json  # noqa: E402
from lint import Lint  # noqa: E402

DAY = "2026-10-09"


def days(n: int, end: str = DAY) -> list[str]:
    out, d = [], date.fromisoformat(end)
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d -= timedelta(days=1)
    return out[::-1]


def row(sym: str, moves: list[float], dates: list[str]) -> dict:
    """A derived row whose indexed series makes exactly these day moves (the first date is the base)."""
    v, series = 100.0, [{"date": dates[0], "v": 100.0}]
    for d, m in zip(dates[1:], moves):
        v *= 1 + m / 100
        series.append({"date": d, "v": v})
    return {"symbol": sym, "last_date": dates[-1], "series": series, "change_1d_pct": moves[-1]}


def calm(last: float, n: int = 61, swing: float = 0.5) -> list[float]:
    """Sixty quiet days alternating +swing/-swing, then the day's move."""
    return [swing if k % 2 else -swing for k in range(n - 1)] + [last]


def view(mid, kind, bench, members, moves, default=False, context=None, label=None):
    dates = days(62)
    der = {"as_of": dates[-1], "benchmark": bench,
           "symbols": [row(s["symbol"], moves.get(s["symbol"], calm(0.1)), dates) for s in members]
           + [row(bench, moves.get(bench, calm(0.2)), dates)]}
    if context:
        der["context"] = {"instruments": [{"symbol": c, "role": r, "name": c, "change_1d_pct": m,
                                           "recent_days": [{"date": dates[-2], "change_pct": 0.1}, {"date": dates[-1], "change_pct": m}]}
                                          for c, r, m in context]}
    return {"id": mid, "label": label or mid.title(), "kind": kind, "default": default, "benchmark": bench,
            "benchmark_label": f"{bench} fund", "watchlist": {"symbols": members}, "derived": der}


def main_view(moves=None, context=(("SPYX", "spx", 0.3),)):
    members = [{"symbol": "AAA", "name": "Alpha", "sector": "Communication Services"},
               {"symbol": "BBB", "name": "Beta", "sector": "Communication Services"},
               {"symbol": "CCC", "name": "Gamma", "sector": "Communication Services"},
               {"symbol": "DDD", "name": "Delta", "sector": "Utilities"},
               {"symbol": "EEE", "name": "Epsilon", "sector": "Utilities"},
               {"symbol": "FFF", "name": "Zeta", "sector": "Financials"}]
    return view("main", "stocks", "BEN", members, moves or {}, default=True, context=list(context), label="Main")


def sectors_view(moves=None):
    members = [{"symbol": "SEC1", "name": "Telecom", "category": "Sector"}, {"symbol": "SEC2", "name": "Tech", "category": "Sector"},
               {"symbol": "BRD", "name": "Broad", "category": "US large companies"}]
    return view("sectors", "funds", "SPYX", members, moves or {})


def keys(res):
    return [c["key"] for c in res["candidates"]]


class FeedThresholdsTest(unittest.TestCase):
    def test_same_thresholds_as_the_sites_feed(self):
        js = (ROOT / "site" / "src" / "lib" / "feed.js").read_text()
        m = re.search(r"export const UNUSUAL = \{ lookback: (\d+), min_sd: (\d+), min_pct: (\d+) \}", js)
        self.assertIsNotNone(m, "site/src/lib/feed.js UNUSUAL changed shape")
        self.assertEqual(tuple(map(int, m.groups())), (wc.UNUSUAL["lookback"], wc.UNUSUAL["min_sd"], wc.UNUSUAL["min_pct"]))
        self.assertIn("prev.length < 20", js)
        self.assertEqual(wc.UNUSUAL["min_history"], 20)


class CandidatesTest(unittest.TestCase):
    def test_day_moves_use_the_published_last_change(self):
        dates = days(3)
        r = row("AAA", [1.0, -2.0], dates)
        r["change_1d_pct"] = -2.04  # the published figure wins for the last close
        m = wc.day_moves(r)
        self.assertAlmostEqual(m[dates[1]], 1.0, places=6)
        self.assertEqual(m[dates[2]], -2.04)
        r["last_date"] = "2026-01-01"
        self.assertAlmostEqual(wc.day_moves(r)[dates[2]], -2.0, places=6)

    def test_unusual_needs_both_size_and_rarity(self):
        dates = days(62)
        moves = dict(zip(dates[1:], calm(-13.27)))
        u = wc.unusual(moves, dates[-1])
        self.assertIsNotNone(u)
        self.assertGreater(u["times"], 3)
        self.assertIsNone(wc.unusual(dict(zip(dates[1:], calm(-2.9))), dates[-1]), "under three percent")
        wild = dict(zip(dates[1:], calm(-4.0, swing=2.5)))
        self.assertIsNone(wc.unusual(wild, dates[-1]), "under three standard deviations of a jumpy name")
        short = dict(zip(dates[-10:], calm(-13.0, n=10)))
        self.assertIsNone(wc.unusual(short, dates[-1]), "fewer than twenty days of history")

    def test_a_quiet_day_flags_nothing(self):
        res = wc.candidates([main_view(), sectors_view()])
        self.assertEqual(res, {"market_date": days(62)[-1], "candidates": []})

    def test_one_name_drags_its_sector_and_merges_into_it(self):
        """The 2026-10-09 shape: one name falls hard, its sector average follows only because of it."""
        res = wc.candidates([main_view({"AAA": calm(-13.27), "BBB": calm(0.97), "CCC": calm(-0.30)}), sectors_view()])
        self.assertEqual(keys(res), ["AAA"])
        c = res["candidates"][0]
        self.assertEqual((c["kind"], c["market"], c["symbols"], c["move_pct"], c["name"]), ("stock", "main", ["AAA"], -13.27, "Alpha"))
        self.assertIn("Communication Services average", c["why_flagged"])
        self.assertEqual(set(c), {"key", "kind", "market", "symbols", "move_pct", "why_flagged", "name"})

    def test_a_real_sector_day_keeps_the_sector(self):
        # EEE is a jumpy name (not unusual on its own), yet without DDD the sector still fell more than two and a half.
        res = wc.candidates([main_view({"DDD": calm(-4.0), "EEE": calm(-3.1, swing=2.0)}), sectors_view()])
        self.assertEqual(keys(res), ["DDD", "sector:Utilities"])
        sec = next(c for c in res["candidates"] if c["kind"] == "sector")
        self.assertEqual((sec["symbols"], sec["move_pct"]), (["DDD", "EEE"], -3.55))

    def test_a_one_name_sector_is_left_to_the_name_test(self):
        res = wc.candidates([main_view({"FFF": calm(-2.8, swing=2.0)}), sectors_view()])
        self.assertEqual(keys(res), [])

    def test_funds_flag_at_one_and_a_half_and_follow_the_market(self):
        ctx = (("SPYX", "spx", -2.0),)
        res = wc.candidates([main_view(context=ctx), sectors_view({"SEC1": calm(-2.4), "SEC2": calm(-5.0), "SPYX": calm(-2.0)})])
        by = {c["key"]: c for c in res["candidates"]}
        self.assertEqual(sorted(by), ["SEC2", "SPYX"])  # SEC1 moved with the market and merged into it
        self.assertEqual(by["SPYX"]["symbols"], ["SPYX", "SEC1"])
        self.assertIn("moved with it", by["SPYX"]["why_flagged"])
        self.assertEqual(by["SPYX"]["market"], "main")  # judged once, in the first market that has it (the main list's context)
        self.assertEqual(by["SEC2"]["kind"], "fund")
        res = wc.candidates([main_view(), sectors_view({"SEC1": calm(1.4)})])
        self.assertEqual(keys(res), [], "under one and a half percent")

    def test_a_non_sector_fund_needs_the_unusual_test(self):
        res = wc.candidates([main_view(), sectors_view({"BRD": calm(2.0)})])
        self.assertEqual(keys(res), [])
        res = wc.candidates([main_view(), sectors_view({"BRD": calm(6.0)})])
        self.assertEqual(keys(res), ["BRD"])
        self.assertEqual(res["candidates"][0]["kind"], "fund")

    def test_a_symbol_on_two_lists_counts_once(self):
        other = view("other", "stocks", "OBEN", [{"symbol": "AAA", "name": "Alpha", "sector": "Communication Services"}],
                     {"AAA": calm(-13.0)})
        res = wc.candidates([main_view({"AAA": calm(-13.0)}), other])
        self.assertEqual(keys(res), ["AAA"])
        self.assertEqual(res["candidates"][0]["market"], "main")

    def test_at_most_five_biggest_first_and_all_on_request(self):
        mv = {s: calm(-(4 + k)) for k, s in enumerate(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"])}
        views = [main_view(mv), sectors_view()]
        res = wc.candidates(views)
        self.assertEqual(len(res["candidates"]), 5)
        sizes = [abs(c["move_pct"]) for c in res["candidates"]]
        self.assertEqual(sizes, sorted(sizes, reverse=True))
        self.assertGreater(len(wc.candidates(views, cap=None)["candidates"]), 5)

    def test_another_day_in_the_series(self):
        views = [main_view({"AAA": calm(-13.0)[:-1] + [0.1]}), sectors_view()]
        earlier = days(62)[-2]
        self.assertIn(earlier, wc.market_dates(views))
        self.assertEqual(wc.candidates(views, earlier)["market_date"], earlier)

    def test_no_main_data_fails_closed(self):
        v = main_view()
        v["derived"] = None
        with self.assertRaises(SystemExit):
            wc.candidates([v])

    def test_load_views_reads_the_config_order_default_first(self):
        views = wc.load_views()
        mc = load_json(CONFIG / "markets.json")
        self.assertEqual([v["id"] for v in views][0], mc["default"])
        self.assertEqual(sorted(v["id"] for v in views), sorted(m["id"] for m in mc["markets"]))


def good_notes(day=None, key="AAA"):
    day = day or days(62)[-1]
    return {"market_date": day, "notes": [{
        "key": key, "kind": "stock", "market": "main",
        "headline": "A rival agreed to buy phone airwaves that could make it a competitor",
        "why": "On Thursday evening, after the close, a rival agreed to buy nationwide airwaves, pending approval by the "
               "regulator. Outlets read it as a step toward a phone network that could compete with the big carriers.",
        "confidence": "clear",
        "sources": [{"url": "https://www.reuters.com/business/a", "publisher": "Reuters", "published": day},
                    {"url": "https://investor.example-co.com/news", "publisher": "Example Co", "published": day}]}]}


HOSTS = {"reuters.com": "Reuters", "example-co.com": "Example Co", "sec.gov": "SEC"}


class RecordCheckTest(unittest.TestCase):
    def setUp(self):
        self.views = [main_view({"AAA": calm(-13.27)}), sectors_view()]
        self.day = days(62)[-1]
        self.today = (date.fromisoformat(self.day) + timedelta(days=1)).isoformat()

    def check(self, obj, recorded=()):
        return record_why.check(obj, self.views, HOSTS, self.today, set(recorded), ["guaranteed"])[0]

    def test_good_notes_pass(self):
        self.assertEqual(self.check(good_notes()), [])

    def test_text_rules(self):
        cases = {
            "digits": ("headline", "It fell thirteen percent, or 13 points"),
            "quotation marks": ("why", 'The chief said "this changes everything" on the call, and outlets agreed.'),
            "quotation marks (": ("why", "The chief called it 'a turning point for the business' on the call today."),
            "a price or market value": ("why", "Its market capitalization shrank by a large amount after the news broke."),
            "a price target or a rating": ("why", "One broker cut its price target after the news, and others followed it."),
            "advice words": ("why", "Investors should buy the dip because the fall looks like a bargain for the long run."),
            "a link in the text": ("why", "The full story is on www.reuters.com and on the company site as well."),
            "first person": ("why", "I read the release and my reading is that the deal worried the market."),
            "banned phrase": ("why", "The deal is a guaranteed win for the buyer, outlets said after the close."),
            "quotation marks (para": ("why", "The chief called it «a turning point for the business» on the call today."),
            "an amount": ("why", "A rival agreed to buy the airwaves for about eight billion, pending approval by the regulator."),
            "a percent or a money": ("headline", "Carrier shares fell thirteen percent after a rival deal"),
            "or a money figure": ("why", "A rival agreed to pay $ eight billion for the airwaves, pending approval by the regulator."),
            "a share-price move": ("why", "The shares fell after a rival agreed to buy nationwide airwaves, pending approval."),
            "hidden or control characters": ("why", "Outlets said investors sho\u200buld buy the dip after a rival deal this week."),
            "outside the Latin alphabet": ("why", "Outlets said it is a b\u0430rgain after a rival agreed to buy nationwide airwaves."),
        }
        for want, (field, text) in cases.items():
            n = good_notes()
            n["notes"][0][field] = text
            errs = self.check(n)
            self.assertTrue(any(want in e for e in errs), f"{want}: {errs}")

    def test_lengths_and_shape(self):
        n = good_notes()
        n["notes"][0]["headline"] = "x" * 91
        self.assertTrue(any("longer than 90" in e for e in self.check(n)))
        n = good_notes()
        n["notes"][0]["why"] = "y" * 321
        self.assertTrue(any("longer than 320" in e for e in self.check(n)))
        n = good_notes()
        n["notes"][0]["move_pct"] = -50  # the model never supplies the move
        self.assertTrue(any("unexpected key 'move_pct'" in e for e in self.check(n)))
        n = good_notes()
        n["notes"][0]["sources"] *= 3
        self.assertTrue(any("more than 4" in e for e in self.check(n)))

    def test_sources(self):
        n = good_notes()
        n["notes"][0]["sources"][0]["url"] = "https://www.badnews.com/a"
        self.assertTrue(any("not on the allow-list" in e for e in self.check(n)))
        for url in ("http://www.reuters.com/a", "https://reuters.com.evil.net/a", "https://notreuters.com/a",
                    "https://user@reuters.com/a", "https://reuters.com:8443/a",
                    "https://evil.example\\.reuters.com/a",  # a browser reads the backslash as a slash: host evil.example
                    "https://evil.example%2F.reuters.com/a", "https://xn--evil.reuters.com_/a"):
            self.assertIsNone(record_why.allowed_host(url, HOSTS), url)
        self.assertEqual(record_why.allowed_host("https://www.reuters.com/x", HOSTS), "reuters.com")
        self.assertEqual(record_why.allowed_host("https://REUTERS.com/x", HOSTS), "reuters.com")
        n = good_notes()
        n["notes"][0]["sources"][0]["published"] = (date.fromisoformat(self.day) + timedelta(days=2)).isoformat()
        self.assertTrue(any("after the market day plus one" in e for e in self.check(n)))
        n = good_notes()
        n["notes"][0]["sources"][1] = dict(n["notes"][0]["sources"][0])
        self.assertTrue(any("the same source twice" in e for e in self.check(n)))
        n = good_notes()
        n["notes"][0]["sources"] = []
        self.assertTrue(any("needs at least one source" in e for e in self.check(n)))
        n = good_notes()
        n["notes"][0]["sources"][0]["published"] = "2026-02-30"
        self.assertTrue(any("not a real date" in e or "date" in e for e in self.check(n)))

    def test_unclear_says_so(self):
        n = good_notes()
        n["notes"][0]["confidence"] = "unclear"
        self.assertTrue(any("say plainly" in e for e in self.check(n)))
        n["notes"][0]["headline"] = "No clear cause found for this fall"
        n["notes"][0]["why"] = "No source we trust explains this fall; we found no news from the company or its rivals that day."
        n["notes"][0]["sources"] = []
        self.assertEqual(self.check(n), [])
        n["notes"][0]["why"] = "No source on our list explained the move, so this note does not guess at a cause."
        self.assertEqual(self.check(n), [])
        # The routine's standard wording when no allow-listed page that explains the move would open (why.js UNCLEAR_NOTE).
        n["notes"][0]["headline"] = "No clear cause found in the sources we could open"
        n["notes"][0]["why"] = "We looked but could not open a source on our list that explains this move."
        self.assertEqual(self.check(n), [])

    def test_routine_unclear_note_passes(self):
        """The exact unclear note .claude/workflows/why.js writes in place of a dropped one passes the record's checks."""
        js = (ROOT / ".claude" / "workflows" / "why.js").read_text()
        m = re.search(r"const UNCLEAR_NOTE = \{ headline: '([^']+)', why: '([^']+)'", js)
        self.assertIsNotNone(m, "why.js defines UNCLEAR_NOTE")
        n = good_notes()
        n["notes"][0].update(headline=m.group(1), why=m.group(2), confidence="unclear", sources=[])
        self.assertEqual(self.check(n), [])
        self.assertIn(m.group(2), (ROOT / "prompts" / "why_routine.md").read_text())

    def test_the_filter_leak_is_caught(self):
        """WebSearch's allowed_domains filter lets other hosts through (sec.gov showed up in searches limited to company
        hosts): the record checks every cited host itself."""
        hosts = record_why.allow_list()
        n = good_notes()
        n["notes"][0]["sources"] = [{"url": "https://www.oilprice.com/a", "publisher": "OilPrice", "published": self.day}]
        errs = record_why.check(n, self.views, hosts, self.today, set(), [])[0]
        self.assertTrue(any("not on the allow-list" in e for e in errs), errs)

    def test_keys_must_be_flagged_by_code(self):
        n = good_notes(key="BBB")
        self.assertTrue(any("not a candidate" in e for e in self.check(n)))
        n = good_notes()
        n["notes"][0]["kind"] = "fund"
        self.assertTrue(any("differ from the candidate" in e for e in self.check(n)))
        n = good_notes()
        n["notes"].append(copy.deepcopy(n["notes"][0]))
        self.assertTrue(any("appears twice" in e for e in self.check(n)))

    def test_the_day(self):
        self.assertTrue(any("already recorded" in e for e in self.check(good_notes(), recorded={self.day})))
        self.assertTrue(any("not a market day" in e for e in self.check(good_notes(day="2026-10-10"))))  # a Saturday
        self.today = "2026-01-01"
        self.assertTrue(any("in the future" in e for e in self.check(good_notes())))

    def test_size_cap(self):
        self.assertLess(len(json.dumps(good_notes())), record_why.MAX_INPUT_CHARS)
        self.assertLessEqual(record_why.MAX_INPUT_CHARS, 65535)


class RecordMergeTest(unittest.TestCase):
    def test_fills_move_and_symbols_from_our_data_and_keeps_thirty_days(self):
        day = days(62)[-1]
        cands = {"AAA": {"move_pct": -13.27, "symbols": ["AAA"], "kind": "stock", "market": "main", "name": "Alpha Co"}}
        old_day = (date.fromisoformat(day) - timedelta(days=40)).isoformat()
        recent = (date.fromisoformat(day) - timedelta(days=3)).isoformat()
        base = good_notes()["notes"][0]
        existing = {"version": 1, "as_of": recent, "sample": False, "notes": [
            {**base, "market_date": old_day, "move_pct": 4.0, "symbols": ["AAA"], "researched_at": f"{old_day}T07:00:00Z"},
            {**base, "market_date": recent, "move_pct": 4.0, "symbols": ["AAA"], "researched_at": f"{recent}T07:00:00Z"}]}
        doc = record_why.merge(existing, good_notes(day), cands, f"{day}T07:00:00Z")
        self.assertEqual(Validator().validate(doc, "why.schema.json"), [])
        self.assertEqual(doc["as_of"], day)
        self.assertEqual([n["market_date"] for n in doc["notes"]], [day, recent])  # the forty-day-old note is dropped
        self.assertEqual((doc["notes"][0]["move_pct"], doc["notes"][0]["symbols"], doc["notes"][0]["name"]), (-13.27, ["AAA"], "Alpha Co"))
        self.assertNotIn("name", doc["notes"][1])  # older notes without a name stay valid
        self.assertFalse(doc["sample"])
        # the publisher shown on the site is the allow-list's name, never the model's text
        notes = good_notes(day)
        notes["notes"][0]["sources"][0]["publisher"] = "Buy now before it is too late"
        doc = record_why.merge(None, notes, cands, f"{day}T07:00:00Z", hosts=HOSTS)
        self.assertEqual([s["publisher"] for s in doc["notes"][0]["sources"]], ["Reuters", "Example Co"])

    def test_main_writes_only_when_every_check_passes(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        bad = tmp / "notes.json"
        bad.write_text("{not json")
        import contextlib
        import io
        from unittest import mock
        why = tmp / "why.json"
        with mock.patch.object(sys, "argv", ["record_why.py", str(bad), "--why", str(why)]), \
                contextlib.redirect_stderr(io.StringIO()) as err:
            self.assertEqual(record_why.main(), 1)
        self.assertIn("FAILED closed", err.getvalue())
        self.assertFalse(why.exists())


class StatusTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.derived, self.why = self.tmp / "derived.json", self.tmp / "why.json"
        dump_json(self.derived, {"as_of": "2026-10-09", "symbols": []})

    def test_recorded_only_with_a_live_note_for_the_day(self):
        self.assertEqual(why_status.status(self.derived, self.why), {"market_date": "2026-10-09", "recorded": False})
        dump_json(self.why, {"version": 1, "as_of": "2026-10-08", "sample": False, "notes": [{"market_date": "2026-10-08"}]})
        self.assertFalse(why_status.status(self.derived, self.why)["recorded"])
        dump_json(self.why, {"version": 1, "as_of": "2026-10-09", "sample": False, "notes": [{"market_date": "2026-10-09"}]})
        self.assertTrue(why_status.status(self.derived, self.why)["recorded"])
        dump_json(self.why, {"version": 1, "as_of": "2026-10-09", "sample": True, "notes": [{"market_date": "2026-10-09"}]})
        self.assertFalse(why_status.status(self.derived, self.why)["recorded"], "sample notes never count")
        self.why.write_text("not json")
        self.assertFalse(why_status.status(self.derived, self.why)["recorded"])

    def test_no_data_fails_closed(self):
        with self.assertRaises(SystemExit):
            why_status.status(self.tmp / "missing.json", self.why)


class RegistryAndActionTest(unittest.TestCase):
    def test_routine_sources_and_allow_list(self):
        rt = {r["id"]: r for r in load_json(CONFIG / "routines.json")["routines"]}
        r = rt["why_notes"]
        self.assertEqual((r["runner"], r["status"], r["prompt"], r["workflow"]),
                         ("claude_routine", "active", "prompts/why_routine.md", ".claude/workflows/why.js"))
        self.assertIn(r["prompt"], r["trigger_prompt"])
        self.assertIn("why.yml", r["trigger_prompt"])
        self.assertIn("config/news_sources.json", r["trigger_prompt"])
        self.assertEqual(r["cron"], "47 6,9 * * 2-6")
        news = {s["id"]: s for s in load_json(CONFIG / "sources.json")["sources"]}["news"]
        self.assertEqual(news["status"], "active")
        self.assertNotIn("pack", news["feeds"])
        ns = load_json(CONFIG / "news_sources.json")
        self.assertEqual(Validator().validate(ns, "news_sources.schema.json"), [])
        hosts = {s["host"] for s in ns["sources"]}
        for h in ("sec.gov", "fcc.gov", "cnbc.com", "bloomberg.com", "lightreading.com", "businesswire.com", "prnewswire.com",
                  "globenewswire.com",
                  # docs/decisions.md 2026-10-17: reputable outlets and official data our research tools can search and open
                  "finance.yahoo.com", "cbsnews.com", "abcnews.com", "nbcnews.com", "pbs.org", "fortune.com", "marketplace.org",
                  "asia.nikkei.com", "rigzone.com", "opec.org", "eia.gov", "federalreserve.gov", "bls.gov", "bea.gov", "nyse.com"):
            self.assertIn(h, hosts)
        import lint
        for h in lint.OUTLOOK_SOURCE_HOSTS:  # every company and regulator host the outlook cards already use
            self.assertIn(h, hosts)
        # Hosts the search tool refuses (any one of them in allowed_domains fails the whole search, 2026-10-16 test
        # fire) and whose pages do not open are kept under blocked, so the owner sees why, and are never searched or cited.
        blocked = {b["host"] for b in ns["blocked"]}
        for h in ("reuters.com", "apnews.com", "wsj.com", "ft.com", "marketwatch.com", "barrons.com", "nytimes.com", "economist.com"):
            self.assertIn(h, blocked)
            self.assertNotIn(h, hosts)
            self.assertIsNone(record_why.allowed_host(f"https://www.{h}/markets/a", record_why.allow_list()), h)
        domains = record_why.search_domains()
        self.assertEqual(domains, [s["host"] for s in ns["sources"] if s["search"]])
        self.assertFalse(blocked & set(domains))
        # Every official source and every outlet added for the swap opens; the fetch-blocked ones stay as skip-on-error.
        opens = {s["host"]: s["opens"] for s in ns["sources"]}
        for h in ("finance.yahoo.com", "cbsnews.com", "pbs.org", "eia.gov", "opec.org", "sec.gov", "prnewswire.com"):
            self.assertTrue(opens[h], h)
        for h in ("cnbc.com", "bloomberg.com", "fcc.gov", "businesswire.com"):
            self.assertFalse(opens[h], h)
        self.assertIn("byline", {s["host"]: s.get("note", "") for s in ns["sources"]}["finance.yahoo.com"])

    def test_lint_checks_the_allow_list(self):
        ns = load_json(CONFIG / "news_sources.json")
        lt = Lint()
        lt.check_news_sources(ns, CONFIG / "news_sources.json")
        self.assertEqual(lt.errors, [])
        cases = {
            "under blocked": lambda d: d["sources"].append({"host": "reuters.com", "publisher": "Reuters", "kind": "outlet",
                                                            "search": True, "opens": True}),
            "a subdomain of the source": lambda d: d["blocked"].append({"host": "news.sec.gov", "publisher": "SEC news",
                                                                         "reason": "a made-up blocked subdomain"}),
            "neither search it nor open it": lambda d: d["sources"][0].update(search=False, opens=False),
            "duplicate hosts in sources": lambda d: d["sources"].append(dict(d["sources"][0])),
            "duplicate hosts in blocked": lambda d: d["blocked"].append(dict(d["blocked"][0])),
            "nothing to search": lambda d: [s.update(search=False, opens=True) for s in d["sources"]],
        }
        for want, change in cases.items():
            d = copy.deepcopy(ns)
            change(d)
            lt = Lint()
            lt.check_news_sources(d, CONFIG / "news_sources.json")
            self.assertTrue(any(want in e for e in lt.errors), f"{want}: {lt.errors}")

    def test_domains_cli(self):
        import subprocess
        out = subprocess.run([sys.executable, str(ROOT / "scripts" / "record_why.py"), "--domains"], capture_output=True,
                             text=True, check=True).stdout
        self.assertEqual(json.loads(out), record_why.search_domains())

    def test_the_brain_never_reads_the_notes(self):
        for f in ("build_pack.py", "record_run.py", "brain_status.py"):
            text = (ROOT / "scripts" / f).read_text()
            self.assertNotIn("why.json", text, f)
            self.assertNotIn("record_why", text, f)

    def test_why_action_mirrors_the_brains(self):
        yml = (ROOT / ".github" / "workflows" / "why.yml").read_text()
        for needle in ("workflow_dispatch", "notes:", "group: daily", "data_branch.sh restore", "scripts/record_why.py .cache/why_notes.json",
                       "python3 scripts/lint.py", "data_branch.sh publish", "data_branch.sh reset", "ROUTINE_WHY_NOTES",
                       "gh workflow run pages.yml", "github.ref == 'refs/heads/main'"):
            self.assertIn(needle, yml)
        self.assertNotIn("TIINGO", yml)  # the notes never fetch prices
        self.assertNotIn("--soft-why", yml)  # the run that writes the notes lints them strictly
        for f in ("daily.yml", "brain.yml"):  # the runs that never write them cannot be blocked by a stale note
            self.assertIn("lint.py --soft-why", (ROOT / ".github" / "workflows" / f).read_text(), f)

    def test_lint_checks_the_routine_registry(self):
        lt = Lint()
        st = load_json(CONFIG / "settings.json")
        rt = load_json(CONFIG / "routines.json")
        wf = "\n".join(p.read_text() for p in (ROOT / ".github" / "workflows").glob("*.yml"))
        lt.check_routines(rt, st, wf)
        self.assertEqual(lt.errors, [])
        bad = copy.deepcopy(rt)
        for r in bad["routines"]:
            if r["id"] == "why_notes":
                r["trigger_prompt"] = "Run something else entirely, following some other file in the repo."
                r["workflow"] = ".claude/workflows/missing.js"
            if r["id"] == "sec_news":
                r["workflow"] = ".claude/workflows/why.js"
        lt = Lint()
        lt.check_routines(bad, st, wf)
        self.assertTrue(any("trigger_prompt must name" in e for e in lt.errors), lt.errors)
        self.assertTrue(any("missing.js does not exist" in e for e in lt.errors), lt.errors)
        self.assertTrue(any("only a claude_routine has a workflow" in e for e in lt.errors), lt.errors)


class LintWhyTest(unittest.TestCase):
    def note(self, **kw):
        n = {**good_notes()["notes"][0], "market_date": "2026-10-09", "move_pct": -13.27, "symbols": ["AAA"],
             "researched_at": "2026-10-10T07:00:00Z"}
        n["sources"] = [{"url": "https://www.cbsnews.com/news/a", "publisher": "CBS News", "published": "2026-10-09"}]
        n.update(kw)
        return n

    def errors(self, doc, sample=False):
        lt = Lint()
        lt.check_why(Path("data/market/why.json"), doc, sample, today="2026-10-17")
        return lt.errors

    def test_published_file_rules(self):
        ok = {"version": 1, "as_of": "2026-10-09", "sample": False, "notes": [self.note()]}
        self.assertEqual(Validator().validate(ok, "why.schema.json"), [])
        self.assertEqual(self.errors(ok), [])
        cases = {
            "sample flag": ({**ok, "sample": True}, False),
            "not the newest": ({**ok, "as_of": "2026-10-12"}, False),
            "twice": ({**ok, "notes": [self.note(), self.note()]}, False),
            "not on the allow-list": ({**ok, "notes": [self.note(sources=[{"url": "https://blog.example.org/a", "publisher": "Blog", "published": "2026-10-09"}])]}, False),
            "digits": ({**ok, "notes": [self.note(headline="It fell by 13 points after the news")]}, False),
            "sector:<GICS sector>": ({**ok, "notes": [self.note(kind="sector")]}, False),
            "start with the note's own ticker": ({**ok, "notes": [self.note(symbols=["BBB"])]}, False),
            "researched before": ({**ok, "notes": [self.note(researched_at="2026-10-08T07:00:00Z")]}, False),
            "older than": ({**ok, "as_of": "2026-11-20", "notes": [self.note(), self.note(market_date="2026-11-20", key="BBB", symbols=["BBB"])]}, False),
        }
        for want, (doc, sample) in cases.items():
            errs = self.errors(doc, sample)
            self.assertTrue(any(want in e for e in errs), f"{want}: {errs}")

    def test_sample_notes_lint_clean(self):
        p = ROOT / "samples" / "market" / "why.json"
        doc = load_json(p)
        self.assertTrue(doc["sample"])
        self.assertEqual(Validator().validate(doc, "why.schema.json"), [])
        lt = Lint()
        lt.check_why(p, doc, True)
        self.assertEqual(lt.errors, [])

    def test_news_never_feeds_the_pack(self):
        lt = Lint()
        src = load_json(CONFIG / "sources.json")
        for s in src["sources"]:
            if s["id"] == "news":
                s["feeds"].append("pack")
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        shutil.copytree(CONFIG, tmp / "config")
        (tmp / "config" / "sources.json").write_text(json.dumps(src))
        from unittest import mock
        import lint
        with mock.patch.object(lint, "CONFIG", tmp / "config"):
            lt.check_config()
        self.assertTrue(any("news never feeds the brain's pack" in e for e in lt.errors), lt.errors)


if __name__ == "__main__":
    unittest.main()
