#!/usr/bin/env python3
"""Repo lint: schemas, doc headers, guardrails, hygiene, size caps. Exits non-zero on any error.

Usage: python3 scripts/lint.py
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    CONFIG, DATA, DOC_META_KEYS, DOCS, EXTRA_MD_DOCS, JSON_DOCS, KB, MD_DOCS, PRICES, ROOT, RUNS, SAMPLES, SCHEMAS, SITE,
    SchemaError, Validator, load_json, parse_front_matter,
)

SKIP_DIRS = {".git", "_site", "__pycache__", ".venv", "node_modules"}
TEXT_EXT = {".py", ".json", ".md", ".html", ".css", ".js", ".jsx", ".webmanifest", ".yml", ".yaml", ".txt", ".svg", ".toml", ""}
GENERATED = ("site/public/data",)  # written by build_site.py, gitignored
SECRET_PATTERNS = [
    ("Anthropic key", re.compile(r"sk-ant-[A-Za-z0-9_\-]{10,}")),
    ("OpenAI-style key", re.compile(r"\bsk-[A-Za-z0-9]{20,}")),
    ("GitHub token", re.compile(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("inline credential", re.compile(
        r"(?i)\b(api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*[\"'][^\"'\s$]{12,}[\"']")),
]
FORBIDDEN_FILES = re.compile(r"(^\.env(\..*)?$|\.pem$|\.key$|^id_(rsa|ed25519)|\.p12$|\.pfx$)")
EXTERNAL_URL = re.compile(r"(?:https?:)?//[a-z0-9.-]+\.[a-z]{2,}", re.I)
# Plain links are fine (e.g. "edit on GitHub"); scripts, styles and fonts must be bundled.
# Outbound link targets the site may build (never fetched): repo, library videos, the People tab's X and SEC 13F links.
SITE_URL_ALLOW = {"http://www.w3.org/2000/svg", "https://github.com", "https://www.youtube.com", "https://x.com", "https://www.sec.gov"}
SITE_HOST_ALLOW = {urlsplit(a).netloc.lower() for a in SITE_URL_ALLOW}  # exact hosts: "x.co" must not pass as a prefix of "x.com"
PRICE_LIKE = re.compile(r"(\$|USD\s?|US\$)\s?\d|\d[\d,.]*\s?(dollars|per share)\b", re.I)


def site_url_allowed(url: str) -> bool:
    """True when a URL found in site sources points at an allowed host (compared exactly, never as a prefix)."""
    return urlsplit(url if url.startswith("//") or "://" in url[:8] else "https:" + url).netloc.lower() in SITE_HOST_ALLOW
MODEL_PORTFOLIO_FILES = {"data/market/longrun.json", "data/market/rules.json", "data/portfolio/paper.json", "data/portfolio/paper_rules.json"}
SITE_SOURCES = ("site/src/", "site/public/", "site/index.html", "site/vite.config.js")
BRAIN_WORKFLOW = ".claude/workflows/brain.js"  # the saved workflow a claude_routine runs by name


class Lint:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.v = Validator()

    def err(self, where: Path | str, msg: str) -> None:
        self.errors.append(f"{_rel(where)}: {msg}")

    def warn(self, where: Path | str, msg: str) -> None:
        self.warnings.append(f"{_rel(where)}: {msg}")

    # ------------------------------------------------------------------ schemas
    def schema(self, path: Path, schema: str):
        try:
            obj = load_json(path)
        except Exception as exc:  # noqa: BLE001
            self.err(path, f"invalid JSON: {exc}")
            return None
        try:
            problems = self.v.validate(obj, schema)
        except SchemaError as exc:
            self.err(SCHEMAS / schema, str(exc))
            return None
        for p in problems[:20]:
            self.err(path, p)
        if len(problems) > 20:
            self.err(path, f"... and {len(problems) - 20} more")
        return None if problems else obj

    def check_schemas_parse(self) -> None:
        for p in sorted(SCHEMAS.glob("*.json")):
            try:
                load_json(p)
            except Exception as exc:  # noqa: BLE001
                self.err(p, f"invalid JSON: {exc}")

    # ------------------------------------------------------------------- config
    def check_config(self) -> tuple[dict | None, dict | None]:
        st = self.schema(CONFIG / "settings.json", "settings.schema.json")
        wl = self.schema(CONFIG / "watchlist.json", "watchlist.schema.json")
        src = self.schema(CONFIG / "sources.json", "sources.schema.json")
        if src:
            ids = [s["id"] for s in src["sources"]]
            if len(ids) != len(set(ids)):
                self.err(CONFIG / "sources.json", "duplicate source ids")
            for s in src["sources"]:
                if s["status"] == "active" and not s["provider"]:
                    self.err(CONFIG / "sources.json", f"{s['id']}: active source needs a provider")
        rt = self.schema(CONFIG / "routines.json", "routines.schema.json")
        if rt and st:
            workflows = "\n".join(p.read_text() for p in (ROOT / ".github" / "workflows").glob("*.yml"))
            self.check_routines(rt, st, workflows)
        if st:
            c = st["cost"]
            if not c["target_usd"] <= c["warn_usd"] <= c["hard_cap_usd"]:
                self.err(CONFIG / "settings.json", "cost must satisfy target_usd <= warn_usd <= hard_cap_usd")
            bars_cap = load_json(SCHEMAS / "prices.schema.json")["properties"]["bars"]["maxItems"]
            if st["prices"]["keep_days"] > bars_cap:
                self.err(CONFIG / "settings.json", f"prices.keep_days {st['prices']['keep_days']} > prices schema maxItems {bars_cap}: every fetch would fail")
        people_path = CONFIG / "people.json"
        if people_path.exists():
            pc = self.schema(people_path, "people.schema.json")
            if pc:
                self.check_people(people_path, pc, src)
        rules_path = CONFIG / "rules.json"
        if rules_path.exists():
            rc = self.schema(rules_path, "rules.schema.json")
            if rc:
                self.check_rules(rules_path, rc)
        if wl:
            if wl.get("core") and wl["core"]["symbol"] not in {c["symbol"] for c in wl.get("context", [])}:
                self.err(CONFIG / "watchlist.json", "core.symbol must also be listed in context (so it is fetched)")
            syms = [s["symbol"] for s in wl["symbols"]]
            if len(syms) != len(set(syms)):
                self.err(CONFIG / "watchlist.json", "duplicate symbols")
        return st, wl

    def check_routines(self, rt: dict, st: dict, workflows: str, root: Path = ROOT) -> None:
        """Costs, schedules and runners. A github_actions routine's cron must be in a workflow file. A claude_routine
        is a scheduled Claude Code session (its cron lives in the Routine, not in the repo): it must use the model,
        and when active its instructions and the saved brain workflow must exist."""
        where = CONFIG / "routines.json"
        ids = [r["id"] for r in rt["routines"]]
        if len(ids) != len(set(ids)):
            self.err(where, "duplicate routine ids")
        for r in rt["routines"]:
            if r["uses_llm"] and not 0 < r["max_cost_usd"] <= st["cost"]["hard_cap_usd"]:
                self.err(where, f"{r['id']}: LLM routine needs 0 < max_cost_usd <= hard_cap_usd")
            if not r["uses_llm"] and r["max_cost_usd"] != 0:
                self.err(where, f"{r['id']}: code-only routine must have max_cost_usd 0")
            if (r["cadence"] == "on_demand") != (r["cron"] is None):
                self.err(where, f"{r['id']}: cron must be null exactly for on_demand")
            if r["runner"] == "claude_routine":
                if not r["uses_llm"]:
                    self.err(where, f"{r['id']}: a claude_routine runs the model, so uses_llm must be true")
                if not r.get("prompt"):
                    self.err(where, f"{r['id']}: a claude_routine needs a prompt file")
                elif r["status"] == "active" and not (root / r["prompt"]).is_file():
                    self.err(where, f"{r['id']}: active but its prompt {r['prompt']} does not exist")
                if r["status"] == "active" and not (root / BRAIN_WORKFLOW).is_file():
                    self.err(where, f"{r['id']}: active but the saved workflow {BRAIN_WORKFLOW} does not exist")
            else:
                if "prompt" in r:
                    self.err(where, f"{r['id']}: only a claude_routine has a prompt")
                if r["status"] == "active" and r["cron"] and r["cron"] not in workflows:
                    self.err(where, f"{r['id']}: active but cron {r['cron']!r} is in no workflow")

    def check_people(self, path: Path, pc: dict, src: dict | None = None, today: str | None = None) -> None:
        """Learn from them, but measure them: every call names a person we follow, has a real public date (never in the
        future) and a unique id that starts with that date. Text is paraphrased, never quoted."""
        today = today or date.today().isoformat()
        ids = [p["id"] for p in pc["people"]]
        if len(ids) != len(set(ids)):
            self.err(path, "duplicate person ids")
        status = {p["id"]: p["status"] for p in pc["people"]}
        cids = [c["id"] for c in pc["calls"]]
        if len(cids) != len(set(cids)):
            self.err(path, "duplicate call ids")
        for c in pc["calls"]:
            if c["person"] not in status:
                self.err(path, f"call {c['id']}: unknown person {c['person']!r}")
            elif status[c["person"]] != "following":
                self.err(path, f"call {c['id']}: {c['person']} is {status[c['person']]}; calls are tracked only for people we follow")
            if c["date"] > today:
                self.err(path, f"call {c['id']}: date {c['date']} is in the future")
            if not c["id"].startswith(c["date"] + "-"):
                self.err(path, f"call {c['id']}: id must start with its date {c['date']}")
        call_texts = [(f"call {c['id']}", c[k]) for c in pc["calls"] for k in ("what", "note") if c.get(k)]
        texts = [*((f"person {p['id']}", p[k]) for p in pc["people"] for k in ("learn", "caution")),
                 *call_texts, *(("evidence", e["claim"]) for e in pc["evidence"])]
        for where, text in texts:
            if text.count('"') >= 2:
                self.err(path, f"{where}: looks like a quotation; paraphrase in our own words")
        for where, text in call_texts:  # the repo is public: derived returns only, never a price
            if PRICE_LIKE.search(text):
                self.err(path, f"{where}: looks like a price; describe the action, not the price")
        follow = {h.lstrip("@").lower() for s in (src or {}).get("sources", []) if s["id"] == "x_accounts" for h in s["follow"]}
        for p in pc["people"]:
            if src and p["x_handle"] and p["x_handle"].lower() not in follow:
                self.warn(path, f"{p['id']}: X handle {p['x_handle']} is not in config/sources.json x_accounts.follow")

    def check_rules(self, path: Path, rc: dict) -> None:
        """The registry must match what the engine can run, cite real library ids, and count its tries honestly."""
        import rules as rl
        ids = [r["id"] for r in rc["rules"]]
        if len(ids) != len(set(ids)):
            self.err(path, "duplicate rule ids")
        lib_path = KB / "library.json"
        known = set()
        if lib_path.exists():
            for src in load_json(lib_path)["sources"]:
                known.add(src["id"])
                known.update(p["id"] for p in src["principles"])
        testable = 0
        sat_methods = {"v1", "filters", "random", "all", "core"}
        keeps = {"none", "same_filters", "rank_top"}
        exits = {"none", "atr_trail", "trend_break"}
        for r in rc["rules"]:
            where = f"{r['id']}"
            for ref in r["library_refs"]:
                if known and ref not in known:
                    self.err(path, f"{where}: library ref {ref} is not in data/kb/library.json")
            eng, st = r.get("engine"), r["status"]
            live = st in ("testable_now", "reference_baseline", "control")
            if live != bool(eng):
                self.err(path, f"{where}: status {st} {'needs' if live else 'must not have'} an engine")
            if r["family"] == "fundamental" and live:
                self.err(path, f"{where}: a fundamental rule cannot be testable until the owner approves a data provider")
            if not eng:
                continue
            testable += 1
            kind = eng.get("kind")
            if kind == "savings_contribute":
                if eng.get("every_weeks", 1) not in (1, 2, 4, 13) and eng.get("mode", "stream") == "stream":
                    self.err(path, f"{where}: every_weeks must be 1, 2, 4 or 13")
                if eng.get("gate", "none") not in ("none", "core_trend") or eng.get("mode", "stream") not in ("stream", "windfall"):
                    self.err(path, f"{where}: unknown savings gate or mode")
            elif kind == "satellite_select":
                sel = eng.get("selection", {})
                if sel.get("method") not in sat_methods:
                    self.err(path, f"{where}: unknown selection method {sel.get('method')!r}")
                if not 1 <= eng.get("slots", 0) <= 10:
                    self.err(path, f"{where}: slots must be 1..10 (published holdings lists hold at most 10)")
                if sel.get("method") == "filters":
                    for f in [*sel.get("filters", []), *sel.get("keep", {}).get("filters", [])]:
                        if f.get("f") not in rl.FILTERS:
                            self.err(path, f"{where}: unknown filter {f.get('f')!r}")
                    if sel.get("rank") not in (*rl.RANKS, "checks_then_rs6"):
                        self.err(path, f"{where}: unknown rank {sel.get('rank')!r}")
                    if sel.get("keep", {"mode": "none"}).get("mode") not in keeps:
                        self.err(path, f"{where}: unknown keep mode")
                if eng.get("exit", {"kind": "none"}).get("kind") not in exits:
                    self.err(path, f"{where}: unknown exit kind")
                if eng.get("sizing", "equal") not in ("equal", "inverse_vol") or eng.get("regime", "none") not in ("none", "core_trend"):
                    self.err(path, f"{where}: unknown sizing or regime")
            elif kind != "control":
                self.err(path, f"{where}: unknown engine kind {kind!r}")
        savings = [r for r in rc["rules"] if r.get("engine") and r["engine"].get("kind") == "savings_contribute"]
        for mode in sorted({r["engine"].get("mode", "stream") for r in savings}):
            if sum(1 for r in savings if r["engine"].get("mode", "stream") == mode and r["engine"].get("baseline")) != 1:
                self.err(path, f"exactly one {mode} savings rule must have engine.baseline = true")
        if rc["tries_counted"] < testable:
            self.err(path, f"tries_counted {rc['tries_counted']} < {testable} testable rules (count every variant tried)")
        rid = set(ids)
        for grp, items in (("sets", rc["sets"]), ("experiments", rc["experiments"])):
            for it in items:
                for x in it["rule_ids"]:
                    if x not in rid:
                        self.err(path, f"{grp} {it['id']}: unknown rule id {x}")
        for ex in rc["experiments"]:
            if not ex["rule_ids"]:
                self.err(path, f"experiment {ex['id']} names no rules")

    # --------------------------------------------------------------------- docs
    def check_docs(self) -> tuple[dict | None, dict]:
        versions: dict = {}
        for name in (*MD_DOCS, *EXTRA_MD_DOCS):
            path = DOCS / f"{name}.md"
            if not path.exists():
                self.err(path, "missing")
                continue
            try:
                meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
            except ValueError as exc:
                self.err(path, str(exc))
                continue
            for key in DOC_META_KEYS:
                if not meta.get(key):
                    self.err(path, f"front matter missing {key!r}")
            if meta.get("version") and not re.fullmatch(r"\d+\.\d+\.\d+", meta["version"]):
                self.err(path, "version must be semver x.y.z")
            if meta.get("updated_at"):
                try:
                    date.fromisoformat(meta["updated_at"])
                except ValueError:
                    self.err(path, "updated_at must be YYYY-MM-DD")
            if not body.strip():
                self.err(path, "empty body")
            versions[name] = meta.get("version")
        guard = self.schema(DOCS / "guardrails.json", "guardrails.schema.json")
        learn = self.schema(DOCS / "learnings.json", "learnings.schema.json")
        if (SAMPLES / "docs" / "learnings.json").exists():
            self.schema(SAMPLES / "docs" / "learnings.json", "learnings.schema.json")
        for name, obj in (("guardrails", guard), ("learnings", learn)):
            versions[name] = obj.get("version") if obj else None
        if learn:
            ids = [i["id"] for i in learn["items"]]
            if len(ids) != len(set(ids)):
                self.err(DOCS / "learnings.json", "duplicate lesson ids")
        assert set(versions) == set(MD_DOCS) | set(EXTRA_MD_DOCS) | set(JSON_DOCS)
        return guard, versions

    # --------------------------------------------------------------------- data
    def check_data(self, guard: dict | None, wl: dict | None, st: dict | None) -> None:
        on_list = {s["symbol"] for s in wl["symbols"]} if wl else set()
        bench = st["scoring"]["benchmark"]["symbol"] if st else None
        ctx = {c["symbol"] for c in wl.get("context", [])} if wl else set()
        for base in (ROOT, SAMPLES):
            runs_dir = RUNS if base is ROOT else SAMPLES / "runs"
            kb_dir = KB if base is ROOT else SAMPLES / "kb"
            prices_dir = PRICES if base is ROOT else SAMPLES / "prices"  # PRICES is the git-ignored cache
            for p in _json_files(runs_dir):
                if not re.fullmatch(r"run\.\d{4}-\d{2}-\d{2}\.json", p.name):
                    self.err(p, "unexpected file in runs/ (want run.YYYY-MM-DD.json)")
                    continue
                run = self.schema(p, "run.schema.json")
                if run:
                    self.check_run(p, run, guard, on_list)
            for p in _json_files(kb_dir):
                if p.name == "outcomes.json":
                    obj = self.schema(p, "outcome.schema.json")
                    if obj and not obj["sample"] and any("ref_price" in o or "exit_price" in o for o in obj["items"]):
                        self.err(p, "live outcomes carry raw prices (licence: publish returns only)")
                elif p.name == "observations.json":
                    obj = self.schema(p, "observations.schema.json")
                    if obj:
                        self.check_observations(p, obj)
                elif p.name in ("regime.json", "calibration.json"):
                    obj = self.schema(p, p.name.replace(".json", ".schema.json"))
                elif p.name == "library.json":
                    obj = self.schema(p, "library.schema.json")
                    if obj:
                        self.check_library(p, obj)
                else:
                    self.err(p, "unexpected file in kb/ (outcomes, library, observations, regime or calibration)")
                    continue
                if obj and obj["sample"] != (base is SAMPLES):
                    self.err(p, "sample flag must be true exactly for files under samples/")
            for p in _json_files(prices_dir):
                obj = self.schema(p, "prices.schema.json")
                if obj:
                    if p.stem != obj["symbol"]:
                        self.err(p, f"filename does not match symbol {obj['symbol']}")
                    if obj["symbol"] not in on_list | ctx | {bench}:
                        self.warn(p, f"{obj['symbol']} is not on the watchlist, the context list or the benchmark")
                    dates = [b["date"] for b in obj["bars"]]
                    if dates != sorted(set(dates)):
                        self.err(p, "bars must be strictly ascending by date")

    def check_library(self, path: Path, lib: dict) -> None:
        ids = [s["id"] for s in lib["sources"]]
        if len(ids) != len(set(ids)):
            self.err(path, "duplicate source ids")
        for src in lib["sources"]:
            for pr in src["principles"]:
                if not pr["id"].startswith(src["id"] + ".P"):
                    self.err(path, f"principle {pr['id']} must start with {src['id']}.P")
                if pr["text"].count('"') >= 2:
                    self.err(path, f"{pr['id']}: looks like a quotation; paraphrase in our own words")

    def check_observations(self, path: Path, obs: dict) -> None:
        ids = [o["id"] for o in obs["items"]]
        if len(ids) != len(set(ids)):
            self.err(path, "duplicate observation ids")
        lib_path = path.parent / "library.json"
        sources = {s["id"] for s in load_json(lib_path)["sources"]} if lib_path.exists() else set()
        for o in obs["items"]:
            if o["source_id"] not in sources:
                self.err(path, f"{o['id']}: source {o['source_id']} is not in {lib_path.name}")
            if o["expires"] <= o["as_of"]:
                self.err(path, f"{o['id']}: expires must be after as_of")
            if o["text"].count('"') >= 2:
                self.err(path, f"{o['id']}: looks like a quotation; paraphrase in our own words")

    def check_run(self, path: Path, run: dict, guard: dict | None, on_list: set) -> None:
        if path.name != f"{run['run_id']}.json" or run["run_id"] != f"run.{run['date']}":
            self.err(path, "run_id, date and filename must agree")
        if run["sample"] != (SAMPLES in path.parents):
            self.err(path, "sample flag must be true exactly for files under samples/")
        if run["cost"]["usd"] > run["cost"]["cap_usd"]:
            self.err(path, "cost exceeds cap_usd")
        if run["status"] == "ok" and run["pack"]["tokens"] > run["pack"]["cap_tokens"]:
            self.err(path, "ok run with a pack over its token cap (must have failed closed)")
        if run["status"] == "failed" and run["picks"]:
            self.err(path, "failed run must not carry picks")
        if not run["sample"] and any("ref_price" in item for item in run["picks"]):
            self.err(path, "live run carries a raw reference price (licence: record the date, publish returns only)")
        if not guard:
            return
        if len(run["picks"]) > guard["max_picks"]:
            self.err(path, f"{len(run['picks'])} picks > max_picks {guard['max_picks']}")
        tickers = [p["pick"]["ticker"] for p in run["picks"]]
        if len(tickers) != len(set(tickers)):
            self.err(path, "duplicate ticker in picks")
        banned = [b.lower() for b in guard["banned_phrases"]]
        for item in run["picks"]:
            pick = item["pick"]
            if item["id"] != f"{run['date']}:{pick['ticker']}":
                self.err(path, f"pick id {item['id']} must be <date>:<ticker>")
            if guard["picks_must_be_on_watchlist"] and pick["ticker"] not in on_list:
                self.err(path, f"{pick['ticker']} is not on the watchlist")
            if pick["stance"] not in guard["allowed_stances"]:
                self.err(path, f"stance {pick['stance']} not allowed")
            text = " ".join([pick["thesis"], pick["invalidation"], *pick["risks"]]).lower()
            for b in banned:
                if b in text:
                    self.err(path, f"banned phrase {b!r} in {item['id']}")
            if guard["no_digits_in_pick_text"] and re.search(r"\d", text):
                self.err(path, f"digits in pick text of {item['id']}; numbers come from code")
        if any(b in run["summary"].lower() for b in banned):
            self.err(path, "banned phrase in summary")

    def check_market(self) -> None:
        for path, schema in ((DATA / "market" / "derived.json", "derived.schema.json"),
                             (DATA / "market" / "longrun.json", "longrun.schema.json"),
                             (DATA / "market" / "rules.json", "rules_result.schema.json"),
                             (DATA / "portfolio" / "paper_rules.json", "paper_rules.schema.json"),
                             (DATA / "portfolio" / "paper.json", "paper.schema.json"),
                             (DATA / "people" / "scores.json", "people_scores.schema.json")):
            if path.exists():
                self.schema(path, schema)
        for p in _walk(ROOT):
            rel = p.relative_to(ROOT).as_posix()
            if rel.startswith("data/") and p.suffix == ".json":
                try:
                    obj = load_json(p)
                except Exception:  # noqa: BLE001
                    continue
                if isinstance(obj, dict) and "bars" in obj and not obj.get("sample"):
                    self.err(p, "raw provider bars must not be committed (licence); publish derived numbers only")

    def check_ops_and_batches(self) -> None:
        log = DATA / "ops" / "routine_runs.json"
        if log.exists():
            self.schema(log, "ops_log.schema.json")
        lib_path = KB / "library.json"
        refs = {s.get("ref") for s in load_json(lib_path)["sources"]} if lib_path.exists() else set()
        for p in sorted((KB / "batches").glob("*.json")) if (KB / "batches").exists() else []:
            try:
                batch = load_json(p)
            except Exception as exc:  # noqa: BLE001
                self.err(p, f"invalid JSON: {exc}")
                continue
            missing = [s["ref"] for s in batch.get("sources", []) if s.get("ref") not in refs]
            if missing:
                self.err(p, f"not ingested yet: {missing[:3]} (run scripts/kb_ingest.py)")

    # ------------------------------------------------------------------ hygiene
    def check_hygiene(self, guard: dict | None, wl: dict | None, st: dict | None) -> None:
        max_kb = st["lint"]["max_file_kb"] if st else 512
        max_data = st["lint"]["max_total_data_mb"] if st else 50
        forbidden = set(guard["forbidden_keys"]) if guard else set()
        literals = {s["symbol"] for s in [*wl["symbols"], *wl.get("context", [])]} if wl else set()
        if st:
            literals.add(st["scoring"]["benchmark"]["symbol"])
        lit_re = re.compile(r"[\"'`](" + "|".join(map(re.escape, sorted(literals))) + r")[\"'`]") if literals else None

        data_bytes = 0
        for path in _walk(ROOT):
            rel = path.relative_to(ROOT)
            if rel.as_posix().startswith(GENERATED):
                continue
            size = path.stat().st_size
            if FORBIDDEN_FILES.search(path.name):
                self.err(path, "file type must never be committed")
            if size > max_kb * 1024:
                self.err(path, f"{size // 1024} KB exceeds max_file_kb {max_kb}")
            if rel.parts[0] in ("data", "runs", "samples"):
                data_bytes += size
            if path.suffix not in TEXT_EXT:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            for label, rx in SECRET_PATTERNS:
                if rx.search(text):
                    self.err(path, f"possible secret ({label})")
            if path.suffix == ".json" and rel.parts[0] in ("data", "runs", "samples", "config"):
                try:
                    hits = _keys(load_json(path)) & forbidden
                except Exception:  # noqa: BLE001  (JSON errors reported elsewhere)
                    hits = set()
                if rel.as_posix() in MODEL_PORTFOLIO_FILES:
                    # Public model portfolios (a rule's picks, written by the Action, closed schema, tickers only).
                    # Only the word "holdings" is allowed there; every other forbidden key still applies.
                    hits.discard("holdings")
                if hits:
                    self.err(path, f"forbidden personal-holdings keys {sorted(hits)}")
            in_code = rel.parts[0] in ("scripts", "site") and path.suffix in (".py", ".js", ".jsx", ".html")
            if in_code and lit_re:
                m = lit_re.search(text)
                if m:
                    self.err(path, f"ticker literal {m.group(0)}; tickers belong in config/")
            if rel.as_posix().startswith(SITE_SOURCES):
                for m in EXTERNAL_URL.finditer(text):
                    url = m.group(0)
                    if not site_url_allowed(url):
                        self.err(path, f"external URL {url!r}; the site must be self-contained")
        if data_bytes > max_data * 1024 * 1024:
            self.err("data/", f"data+runs+samples total {data_bytes / 1e6:.1f} MB > {max_data} MB")

    def run(self) -> int:
        self.check_schemas_parse()
        st, wl = self.check_config()
        guard, _ = self.check_docs()
        self.check_data(guard, wl, st)
        self.check_ops_and_batches()
        self.check_market()
        self.check_hygiene(guard, wl, st)
        for w in self.warnings:
            print(f"warn  {w}")
        for e in self.errors:
            print(f"ERROR {e}")
        print(f"lint: {len(self.errors)} error(s), {len(self.warnings)} warning(s)")
        return 1 if self.errors else 0


def _rel(p: Path | str) -> str:
    try:
        return str(Path(p).resolve().relative_to(ROOT))
    except ValueError:
        return str(p)


def _walk(base: Path):
    """Files git would commit (tracked + untracked-not-ignored); plain walk if git is unavailable."""
    import subprocess
    try:
        out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                             cwd=base, capture_output=True, check=True).stdout.decode()
        for rel in sorted(filter(None, out.split("\0"))):
            p = base / rel
            if p.is_file():
                yield p
        return
    except (OSError, subprocess.CalledProcessError):
        pass
    yield from _walk_fs(base)


def _walk_fs(base: Path):
    for p in sorted(base.iterdir()):
        if p.name in SKIP_DIRS:
            continue
        if p.is_dir():
            yield from _walk_fs(p)
        elif p.is_file():
            yield p


def _json_files(d: Path) -> list[Path]:
    return sorted(d.glob("*.json")) if d.exists() else []


def _keys(obj) -> set:
    out: set = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.add(k)
            out |= _keys(v)
    elif isinstance(obj, list):
        for v in obj:
            out |= _keys(v)
    return out


if __name__ == "__main__":
    sys.exit(Lint().run())
