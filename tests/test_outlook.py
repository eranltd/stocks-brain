"""Market today (context day changes) and the company outlook cards: schema, lint rules, the pack block and the
refresh workflow's shape. Cards here are synthetic fixtures; the repo file holds only researched cards."""
import copy
import json
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import build_pack  # noqa: E402
import market as mk  # noqa: E402
import record_run  # noqa: E402
import routines_code  # noqa: E402
from _common import CONFIG, DOCS, ROOT, SAMPLES, Validator, dump_json, load_json, settings, watchlist  # noqa: E402
from lint import Lint  # noqa: E402

TODAY = "2026-10-08"


def card(ticker: str, **kw) -> dict:
    c = {
        "ticker": ticker, "name": "Some Company", "as_of": "2026-10-01",
        "business": "Makes things people buy; most money comes from one product line.",
        "latest": {"period": "fiscal Q2 2027", "reported_on": "2026-08-20", "revenue": "10.0 billion US dollars",
                   "revenue_growth_yoy_pct": 12.5, "highlights": ["The main segment grew faster than the rest."],
                   "source_url": "https://www.sec.gov/example/results"},
        "guidance": {"given": True, "period": "fiscal Q3 2027", "text": "The company expects revenue to grow again next quarter.",
                     "source_url": "https://www.sec.gov/example/outlook"},
        "next_earnings": {"date": "2026-10-20", "confirmed": True, "note": "", "source_url": "https://www.prnewswire.com/example/ir"},
        "whats_next": [{"item": "A new product line is due to launch.", "when": "first half of 2027", "kind": "product",
                        "source_url": "https://www.businesswire.com/example/launch"}],
        "watch": [{"item": "Export rules could limit sales to some countries.", "source_url": "https://www.sec.gov/example/10q"}],
    }
    for k, v in kw.items():
        if isinstance(v, dict) and isinstance(c.get(k), dict):
            c[k] = {**c[k], **v}
        else:
            c[k] = v
    return c


class MarketTodayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.st, cls.wl = settings(), watchlist()
        cls.doc = routines_code.compute_derived(SAMPLES / "prices", cls.st, cls.wl, sample=True, provider="sample")

    def test_day_change(self):
        self.assertAlmostEqual(mk.day_change([100.0, 102.0]), 2.0)
        self.assertIsNone(mk.day_change([100.0]))

    def test_every_context_instrument_has_its_day_change(self):
        inst = self.doc["context"]["instruments"]
        self.assertEqual({i["role"] for i in inst}, {c["role"] for c in self.wl["context"]})
        dates = [b["date"] for b in load_json(SAMPLES / "prices" / f"{self.doc['benchmark']}.json")["bars"]]
        for i in inst:
            bars = {b["date"]: b["close"] for b in load_json(SAMPLES / "prices" / f"{i['symbol']}.json")["bars"]}
            self.assertAlmostEqual(i["change_1d_pct"], round((bars[dates[-1]] / bars[dates[-2]] - 1) * 100, 3), places=6)
            self.assertNotIn("close", i)
        self.assertEqual(Validator().validate(self.doc, "derived.schema.json"), [])

    def test_older_data_without_the_day_change_still_validates(self):
        old = copy.deepcopy(self.doc)
        for i in old["context"]["instruments"]:
            del i["change_1d_pct"]
        self.assertEqual(Validator().validate(old, "derived.schema.json"), [])
        bad = copy.deepcopy(self.doc)
        bad["context"]["instruments"][0]["close"] = 123.4
        self.assertTrue(Validator().validate(bad, "derived.schema.json"), "a raw price on a context instrument must be refused")


class OutlookConfigTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cfg = load_json(CONFIG / "outlook.json")
        cls.wl = watchlist()
        cls.syms = [s["symbol"] for s in cls.wl["symbols"]]
        cls.v = Validator()

    def doc(self, *cards):
        d = copy.deepcopy(self.cfg)
        d["companies"] = list(cards)
        d["updated_at"] = "2026-10-01"  # the fixtures' day, before TODAY: the repo file's own date may be later
        return d

    def lint(self, doc, today=TODAY):
        lint = Lint()
        lint.check_outlook(CONFIG / "outlook.json", doc, self.wl, today=today)
        return lint.errors, lint.warnings

    def test_repo_file_is_valid_and_clean(self):
        self.assertEqual(self.v.validate(self.cfg, "outlook.schema.json"), [])
        self.assertEqual(self.lint(self.cfg, today=max(TODAY, self.cfg["updated_at"])), ([], []))  # clean on the day it was written

    def test_a_good_card_passes(self):
        d = self.doc(card(self.syms[0]), card(self.syms[1], guidance={"given": False, "period": "", "text": "The company gives no quarterly forecast.", "source_url": None},
                                              next_earnings={"date": None, "confirmed": False, "note": "Not announced yet.", "source_url": None}))
        self.assertEqual(self.v.validate(d, "outlook.schema.json"), [])
        self.assertEqual(self.lint(d), ([], []))

    def test_schema_rules(self):
        t = self.syms[0]
        cases = {
            "plain http": card(t, latest={"source_url": "http://example.org"}),
            "bad kind": card(t, whats_next=[{"item": "Something is coming soon.", "when": "soon", "kind": "rumour", "source_url": "https://example.org"}]),
            "four highlights": card(t, latest={"highlights": ["A highlight of the quarter."] * 4}),
            "five whats_next": card(t, whats_next=[card(t)["whats_next"][0]] * 5),
            "four watch": card(t, watch=[card(t)["watch"][0]] * 4),
            "bad date": card(t, as_of="2026-02-30"),
            "lowercase ticker": card(t.lower()),
            "growth as text": card(t, latest={"revenue_growth_yoy_pct": "12%"}),
            "extra key": {**card(t), "price_target": 1},
            "no watch": card(t, watch=[]),
            "bad status": card(t, whats_next=[{**card(t)["whats_next"][0], "status": "soon"}]),
            "bad item date": card(t, whats_next=[{**card(t)["whats_next"][0], "date": "next week"}]),
        }
        for name, c in cases.items():
            self.assertTrue(self.v.validate(self.doc(c), "outlook.schema.json"), f"{name} was not caught")

    def test_lint_rules(self):
        a, b = self.syms[0], self.syms[1]
        cases = {
            "off the list": (card("ZZZZ"), "not on the watchlist"),
            "future as_of": (card(a, as_of="2026-10-09"), "as_of 2026-10-09 is in the future"),
            "future report": (card(a, as_of=TODAY, latest={"reported_on": "2026-10-09"}), "reported_on 2026-10-09 is in the future"),
            "reported after research": (card(a, latest={"reported_on": "2026-10-05"}), "after the card was researched"),
            "confirmed without date": (card(a, next_earnings={"date": None, "confirmed": True}), "confirmed but has no date"),
            "next before latest": (card(a, next_earnings={"date": "2026-08-01"}), "is not after the latest report"),
            "guidance without source": (card(a, guidance={"source_url": None}), "needs its source_url"),
            "price target": (card(a, watch=[{"item": "Analysts raised the price target again.", "source_url": "https://example.org"}]), "'price target'"),
            "buy rating": (card(a, latest={"highlights": ["Several banks kept a buy rating on it."]}), "'buy rating'"),
            "overweight": (card(a, business="A chip maker that brokers rate overweight in the sector."), "'overweight'"),
            "underweight": (card(a, guidance={"text": "Investors are underweight the name after the quarter."}), "'underweight'"),
            "stock price": (card(a, watch=[{"item": "The share price fell to 120 after the report.", "source_url": "https://example.org"}]), "looks like a stock price"),
            "quotation": (card(a, guidance={"text": 'The chief said "demand is insane" on the call.'}), "quotation"),
            "curly quotation": (card(a, guidance={"text": "The chief said “demand is insane” on the call."}), "quotation"),
            "closed at": (card(a, latest={"highlights": ["Shares closed at 120 after the report."]}), "looks like a stock price"),
            "market cap": (card(a, business="A chip maker with the largest market cap in the world today."), "looks like a stock price"),
            "rating in the period": (card(a, guidance={"period": "buy rating"}), "'buy rating'"),
            "single quotation": (card(a, whats_next=[{**card(a)["whats_next"][0], "when": "Muse 'in the coming months'"}]), "quotation"),
            "curly single quotation": (card(a, guidance={"text": "The chief called demand ‘insane’ on the call."}), "quotation"),
            "stock rose": (card(a, latest={"highlights": ["The stock rose 5% after the report."]}), "looks like a stock price"),
            "shares jumped": (card(a, watch=[{"item": "Shares jumped 8% on the news of the deal.", "source_url": "https://www.sec.gov/x"}]), "looks like a stock price"),
            "price objective": (card(a, business="A chip maker; one bank set a price objective of 200 on it."), "analyst rating"),
            "PT raised": (card(a, guidance={"text": "One broker said its PT raised to 250 after the quarter."}), "analyst rating"),
            "upgraded to buy": (card(a, watch=[{"item": "A broker upgraded the stock to buy this week.", "source_url": "https://www.sec.gov/x"}]), "analyst rating"),
            "outperform": (card(a, latest={"highlights": ["Two banks rate it outperform after the quarter."]}), "analyst rating"),
            "consensus": (card(a, guidance={"text": "Revenue guidance sits above the consensus estimate for the quarter."}), "analyst rating"),
            "analyst estimates": (card(a, guidance={"text": "Revenue guidance sits above analyst estimates for the quarter."}), "analyst rating"),
            "market value": (card(a, business="A chip maker with a market value of 4 trillion dollars today."), "analyst rating"),
            "done in the future": (card(a, whats_next=[{**card(a)["whats_next"][0], "status": "done", "date": "2026-11-01"}]), "marked done but dated 2026-11-01"),
        }
        for name, (c, msg) in cases.items():
            errors, _ = self.lint(self.doc(c))
            self.assertTrue(any(msg in e for e in errors), f"{name}: {errors}")
        errors, _ = self.lint(self.doc(card(a), card(a)))
        self.assertTrue(any("duplicate tickers" in e for e in errors))
        errors, _ = self.lint({**self.doc(), "updated_at": "2026-12-01"})
        self.assertTrue(any("updated_at" in e for e in errors))
        self.assertEqual(self.lint(self.doc(card(b)))[0], [])
        # company results in dollars are fine: they are the company's figures, not its share price
        ok = card(b, latest={"revenue": "$46.7 billion", "highlights": ["Data-center revenue rose to $41.1 billion."]})
        self.assertEqual(self.lint(self.doc(ok))[0], [])
        # a company's own words that only look like the banned ones: apostrophes, analyst days, network upgrades, Pacific Time
        fine = card(b, business="Apple's phones and Sjogren's drugs can't be compared; investors' money goes elsewhere.",
                    guidance={"text": "The company will hold its investor and analyst day in March, with the call at 2pm PT."},
                    whats_next=[{**card(b)["whats_next"][0], "item": "A network upgrade and a fleet upgraded to new trucks.", "status": "ahead", "date": "2026-12-01"}],
                    watch=[{"item": "Shares outstanding fell after buybacks; stock options vest in 2027.", "source_url": "https://www.sec.gov/x"}])
        self.assertEqual(self.lint(self.doc(fine)), ([], []))

    def test_plain_summary(self):
        a = self.syms[0]
        good = card(a, plain="Some Company: its main line keeps growing; a new product is due next year, and export rules are a risk.")
        self.assertEqual(self.v.validate(self.doc(good), "outlook.schema.json"), [])
        self.assertEqual(self.lint(self.doc(good)), ([], []))
        self.assertEqual(self.lint(self.doc(card(a))), ([], []), "the field is optional")
        for name, c in {"too long": card(a, plain="Some Company: " + "growing again, " * 13),
                        "too short": card(a, plain="Growing."), "not text": card(a, plain=3)}.items():
            self.assertTrue(self.v.validate(self.doc(c), "outlook.schema.json"), f"{name} was not caught")
        cases = {
            "digits": ("Some Company: sales grew 12% from a year earlier.", "plain: digits"),
            "one double quote": ('Some Company: the chief called demand "insane on the call.', "plain: quotation marks"),
            "curly quote": ("Some Company: the chief called demand “insane” on the call.", "plain: quotation marks"),
            "single quotes": ("Some Company: the chief called demand 'insane' on the call.", "plain: quotation marks"),
            "price target": ("Some Company: a bank raised its price target after the quarter.", "'price target'"),
            "stock move": ("Some Company: the shares jumped after the quarter was reported.", "looks like a stock price"),
        }
        for name, (text, msg) in cases.items():
            errors, _ = self.lint(self.doc(card(a, plain=text)))
            self.assertTrue(any(msg in e for e in errors), f"{name}: {errors}")
        # apostrophes are not quotation marks
        self.assertEqual(self.lint(self.doc(card(a, plain="Some Company: Apple's rival can't keep up; investors' cash went elsewhere.")))[0], [])

    def test_every_repo_card_has_a_plain_summary_that_starts_with_its_name(self):
        for c in self.cfg["companies"]:
            self.assertIn("plain", c, c["ticker"])
            self.assertNotRegex(c["plain"], r"\d", c["ticker"])
            self.assertTrue(c["plain"].split(":")[0] and ":" in c["plain"], c["ticker"])

    def test_lint_warnings(self):
        a = self.syms[0]
        cases = {
            "jargon": (card(a, guidance={"text": "EPS of $2.00 and capex of $1B next quarter."}), "'EPS' is jargon"),
            "basis points": (card(a, latest={"highlights": ["Margin rose 120 bp from a year earlier."]}), "'bp' is jargon"),
            "first person": (card(a, next_earnings={"note": "I read it in a copy because the site blocked my fetch."}), "first person"),
            "quote site": (card(a, next_earnings={"source_url": "https://finance.yahoo.com/some-article"}), "source finance.yahoo.com"),
            "lookalike host": (card(a, latest={"source_url": "https://notsec.gov.example.com/x"}), "source notsec.gov.example.com"),
            "ahead in the past": (card(a, whats_next=[{**card(a)["whats_next"][0], "status": "ahead", "date": "2026-10-01"}]), "has passed"),
            "probably stale": (card(a, latest={"reported_on": "2026-07-02"}, next_earnings={"date": None, "confirmed": False}), "probably out"),
        }
        for name, (c, msg) in cases.items():
            errors, warnings = self.lint(self.doc(c))
            self.assertEqual(errors, [], name)
            self.assertTrue(any(msg in w for w in warnings), f"{name}: {warnings}")
        _, warnings = self.lint(self.doc(card(a, latest={"reported_on": "2026-07-03"}, next_earnings={"date": None, "confirmed": False})))
        self.assertEqual(warnings, [], "97 days after the report is not yet stale")

    def test_a_card_past_its_next_results_is_flagged(self):
        errors, warnings = self.lint(self.doc(card(self.syms[0], next_earnings={"date": "2026-10-07"})))
        self.assertEqual(errors, [])
        self.assertTrue(any("new results are out" in w for w in warnings))

    def test_how_to_read_names_the_rules(self):
        text = " ".join(self.cfg["how_to_read"]).lower()
        for words in ("not a forecast", "paraphrase", "price targets", "refreshed after each earnings season", "flagged", "probably out"):
            self.assertIn(words, text)

    def test_every_coming_item_says_whether_it_is_done_or_ahead(self):
        for c in self.cfg["companies"]:
            self.assertTrue(c["watch"], c["ticker"])
            for w in c["whats_next"]:
                self.assertIn(w.get("status"), ("done", "ahead"), f"{c['ticker']}: {w['item']}")


class OutlookPackTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        st, wl = settings(), watchlist()
        cls.data = cls.tmp / "data"
        dump_json(cls.data / "market" / "derived.json", routines_code.compute_derived(SAMPLES / "prices", st, wl, sample=False, provider="tiingo"))
        (cls.tmp / "runs").mkdir()
        cls.syms = [s["symbol"] for s in wl["symbols"]]
        cls.on_list = set(cls.syms)
        cls.guard = load_json(DOCS / "guardrails.json")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def build(self, outlook):
        return build_pack.build(self.data, self.tmp / "runs", today=TODAY, outlook=outlook)

    def test_empty_block_without_companies(self):
        self.assertEqual(self.build({"companies": []})["outlook"], {"note": build_pack.OUTLOOK_NOTE, "next_earnings": {}, "guidance": {}})
        self.assertEqual(build_pack.outlook_block(None, self.on_list, TODAY)["next_earnings"], {})
        self.assertIn("never evidence that a stock will beat the index", build_pack.OUTLOOK_NOTE)
        self.assertIn("event risk", build_pack.OUTLOOK_NOTE)

    def test_block_keys_dates_and_guidance(self):
        a, b, c, d = self.syms[:4]
        cfg = {"companies": [
            card(a, next_earnings={"date": "2026-10-20", "confirmed": True}),
            card(b, next_earnings={"date": "2026-11-30", "confirmed": False}, guidance={"given": False, "source_url": None}),
            card(c, next_earnings={"date": "2026-10-01"}),  # past: new results are out, so no date is packed
            card(d, next_earnings={"date": None, "confirmed": False}),
            card("ZZZZ"),  # off the list: ignored
        ]}
        pack = self.build(cfg)
        o = pack["outlook"]
        self.assertEqual(o["next_earnings"], {a.lower(): {"date": "2026-10-20", "days": 12, "confirmed": True},
                                              b.lower(): {"date": "2026-11-30", "days": 53, "confirmed": False}})
        self.assertEqual(o["guidance"], {a.lower(): "given", b.lower(): "none", c.lower(): "given", d.lower(): "given"})
        keys = build_pack.evidence_keys(pack)
        self.assertIn(f"outlook.next_earnings.{a.lower()}", keys)
        self.assertIn(f"outlook.next_earnings.{a.lower()}.days", keys)  # four levels, still citable
        self.assertIn(f"outlook.guidance.{b.lower()}", keys)
        text = json.dumps(pack, sort_keys=True, separators=(",", ":"))
        self.assertNotIn("source_url", text)
        self.assertLessEqual(build_pack.estimate_tokens(text), settings()["pack"]["token_cap"])
        out = {"summary": "One name reports soon; that is event risk, and its own outlook is context only.",
               "picks": [{"ticker": a, "stance": "neutral", "conviction": "low",
                          "thesis": "Its results are due within about two weeks, so the setup can change quickly; we stay neutral.",
                          "risks": ["The results day could move it a lot either way"], "invalidation": "A clear break of its long average.",
                          "evidence": [f"outlook.next_earnings.{a.lower()}", f"outlook.guidance.{a.lower()}", "outlook"]}]}
        self.assertEqual(record_run.check_picks(out, pack, self.guard, self.on_list), [])
        out["picks"][0]["evidence"].append(f"outlook.next_earnings.{c.lower()}")
        self.assertTrue(record_run.check_picks(out, pack, self.guard, self.on_list))

    def test_a_full_list_stays_under_the_cap(self):
        cfg = {"companies": [card(t) for t in self.syms]}
        text = json.dumps(self.build(cfg), sort_keys=True, separators=(",", ":"))
        self.assertLessEqual(build_pack.estimate_tokens(text), settings()["pack"]["token_cap"])


class OutlookWiringTest(unittest.TestCase):
    def test_brain_is_told_how_to_use_the_outlook(self):
        md = (ROOT / "prompts" / "brain.md").read_text()
        js = (ROOT / ".claude" / "workflows" / "brain.js").read_text()
        for text in (md, js):
            self.assertIn("outlook", text)
            self.assertIn("never cite a company's own guidance", text)

    def test_refresh_workflow_follows_the_saved_workflow_rules(self):
        js = (ROOT / ".claude" / "workflows" / "outlook.js").read_text()
        head = js[:js.index("\n}\n") + 2]
        self.assertTrue(head.startswith("export const meta = {"))
        self.assertIn("name: 'outlook'", head)
        self.assertNotRegex(head, r"\$\{|\.\.\.|\w\(")  # a pure literal: no interpolation, spreads or calls
        for banned in ("Date.now", "Math.random", "new Date()", "require(", "process."):
            self.assertFalse(banned in js, f"{banned} in outlook.js")
        self.assertFalse(re.search(r"^\s*import\s", js, re.M), "a module import in outlook.js")
        self.assertRegex(js, r"args\.today is required")
        self.assertTrue(re.search(r"price target", js) and "primary sources" in js)


if __name__ == "__main__":
    unittest.main()
