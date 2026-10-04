"""Shared helpers: repo paths, JSON I/O, doc front matter, and a strict JSON-Schema subset.

Stdlib only. The validator supports a deliberately small keyword set and *rejects*
any schema keyword it does not understand, so a schema can never silently pass
because of an unsupported feature (fail closed).
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CONFIG = ROOT / "config"
SCHEMAS = ROOT / "schemas"
DATA = ROOT / "data"
# Raw provider bars live only in a git-ignored cache inside the Action run. The provider's terms
# do not allow redistribution, so the public repo gets derived numbers only (data/market/derived.json).
PRICES = ROOT / ".cache" / "prices"
MARKET = DATA / "market"
KB = DATA / "kb"
RUNS = ROOT / "runs"
SAMPLES = ROOT / "samples"
SITE = ROOT / "site"

MD_DOCS = ("strategy", "methodology")  # versions recorded on every run
EXTRA_MD_DOCS = ("decisions",)  # versioned and published, but not read by the brain
JSON_DOCS = ("guardrails", "learnings")
DOC_META_KEYS = ("version", "updated_at", "change_note")


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def dump_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")


def settings() -> dict:
    return load_json(CONFIG / "settings.json")


def watchlist() -> dict:
    return load_json(CONFIG / "watchlist.json")


# --------------------------------------------------------------------------- docs

_FRONT = re.compile(r"\A---\n(.*?)\n---\n", re.S)


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Parse a minimal `key: value` front matter block. Returns (meta, body)."""
    m = _FRONT.match(text)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if not line.strip():
            continue
        key, sep, value = line.partition(":")
        if not sep:
            raise ValueError(f"bad front matter line: {line!r}")
        meta[key.strip()] = value.strip()
    return meta, text[m.end():]


def doc_versions() -> dict:
    """Current version of every instruction doc, keyed by doc name."""
    out = {}
    for name in MD_DOCS:
        meta, _ = parse_front_matter((DOCS / f"{name}.md").read_text(encoding="utf-8"))
        out[name] = meta.get("version")
    for name in JSON_DOCS:
        out[name] = load_json(DOCS / f"{name}.json").get("version")
    return out


# ---------------------------------------------------------------- schema validation

SUPPORTED = {
    "$id", "$schema", "$defs", "$ref", "title", "description",
    "type", "properties", "required", "additionalProperties",
    "items", "minItems", "maxItems", "uniqueItems",
    "enum", "const", "pattern", "minLength", "maxLength", "format",
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
    "anyOf",
}
_TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
    "null": lambda v: v is None,
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
}


class SchemaError(Exception):
    """The schema itself is invalid or uses unsupported features."""


class Validator:
    def __init__(self, schema_dir: Path = SCHEMAS):
        self.schema_dir = schema_dir
        self._cache: dict[str, dict] = {}

    def load(self, name: str) -> dict:
        if name not in self._cache:
            self._cache[name] = load_json(self.schema_dir / name)
        return self._cache[name]

    def validate(self, instance: Any, schema_name: str) -> list[str]:
        errors: list[str] = []
        self._check(instance, self.load(schema_name), schema_name, "$", errors)
        return errors

    # -- internals
    def _resolve(self, ref: str, base: str) -> tuple[dict, str]:
        file, _, pointer = ref.partition("#")
        file = file or base
        node: Any = self.load(file)
        for part in filter(None, pointer.split("/")):
            if not isinstance(node, dict) or part not in node:
                raise SchemaError(f"unresolvable $ref {ref!r} from {base}")
            node = node[part]
        return node, file

    def _check(self, v: Any, s: dict, base: str, path: str, errs: list[str]) -> None:
        if not isinstance(s, dict):
            raise SchemaError(f"schema at {path} is not an object")
        unknown = set(s) - SUPPORTED
        if unknown:
            raise SchemaError(f"unsupported keywords {sorted(unknown)} in {base} at {path}")

        if "$ref" in s:
            target, file = self._resolve(s["$ref"], base)
            self._check(v, target, file, path, errs)

        if "anyOf" in s:
            if not any(not self._sub(v, sub, base, path) for sub in s["anyOf"]):
                errs.append(f"{path}: matches none of anyOf")

        if "type" in s:
            types = s["type"] if isinstance(s["type"], list) else [s["type"]]
            if not any(_TYPES[t](v) for t in types):
                errs.append(f"{path}: expected {'/'.join(types)}, got {type(v).__name__}")
                return
        if "const" in s and v != s["const"]:
            errs.append(f"{path}: must equal {s['const']!r}")
        if "enum" in s and v not in s["enum"]:
            errs.append(f"{path}: {v!r} not in {s['enum']}")

        if isinstance(v, str):
            if "minLength" in s and len(v) < s["minLength"]:
                errs.append(f"{path}: shorter than {s['minLength']}")
            if "maxLength" in s and len(v) > s["maxLength"]:
                errs.append(f"{path}: longer than {s['maxLength']}")
            if "pattern" in s and not re.search(s["pattern"], v):
                errs.append(f"{path}: {v!r} does not match {s['pattern']}")
            if "format" in s:
                self._format(v, s["format"], path, errs)

        if _TYPES["number"](v):
            if "minimum" in s and v < s["minimum"]:
                errs.append(f"{path}: {v} < minimum {s['minimum']}")
            if "maximum" in s and v > s["maximum"]:
                errs.append(f"{path}: {v} > maximum {s['maximum']}")
            if "exclusiveMinimum" in s and v <= s["exclusiveMinimum"]:
                errs.append(f"{path}: {v} <= exclusiveMinimum {s['exclusiveMinimum']}")
            if "exclusiveMaximum" in s and v >= s["exclusiveMaximum"]:
                errs.append(f"{path}: {v} >= exclusiveMaximum {s['exclusiveMaximum']}")

        if isinstance(v, list):
            if "minItems" in s and len(v) < s["minItems"]:
                errs.append(f"{path}: fewer than {s['minItems']} items")
            if "maxItems" in s and len(v) > s["maxItems"]:
                errs.append(f"{path}: more than {s['maxItems']} items")
            if s.get("uniqueItems"):
                seen = [json.dumps(x, sort_keys=True) for x in v]
                if len(seen) != len(set(seen)):
                    errs.append(f"{path}: items are not unique")
            if "items" in s:
                for i, item in enumerate(v):
                    self._check(item, s["items"], base, f"{path}[{i}]", errs)

        if isinstance(v, dict):
            props = s.get("properties", {})
            for key in s.get("required", []):
                if key not in v:
                    errs.append(f"{path}: missing required {key!r}")
            for key, item in v.items():
                if key in props:
                    self._check(item, props[key], base, f"{path}.{key}", errs)
                elif s.get("additionalProperties") is False:
                    errs.append(f"{path}: unexpected key {key!r}")
                elif isinstance(s.get("additionalProperties"), dict):
                    self._check(item, s["additionalProperties"], base, f"{path}.{key}", errs)

    def _sub(self, v: Any, s: dict, base: str, path: str) -> list[str]:
        errs: list[str] = []
        self._check(v, s, base, path, errs)
        return errs

    @staticmethod
    def _format(v: str, fmt: str, path: str, errs: list[str]) -> None:
        try:
            if fmt == "date":
                date.fromisoformat(v)
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
                    raise ValueError
            elif fmt == "date-time":
                datetime.fromisoformat(v.replace("Z", "+00:00"))
                if "T" not in v:
                    raise ValueError
            else:
                raise SchemaError(f"unsupported format {fmt!r}")
        except ValueError:
            errs.append(f"{path}: {v!r} is not a valid {fmt}")
