#!/usr/bin/env python3
"""EN -> DE for docs/architecture.html: translates text nodes 1:1 from de.json.

  translate.py collect <en.html> <out.json>   list text nodes without translation
  translate.py build <en.html> <de.json> <de.html>
Text inside <code>, <pre>, <style>, <script> and directly inside an element with translate="no" stays as it is
(code, paths, identifiers).
"""
import json
import re
import sys

SKIP = {"code", "pre", "style", "script"}
TOKEN = re.compile(r"(<[^>]+>)")
IDENT = re.compile(r"^[\w./\-\[\]\(\)\*:?=&;,·#@{}\"'+→ ]*$")


def nodes(html):
    """Yield (index, text) for translatable text tokens."""
    parts = TOKEN.split(html)
    depth = 0
    for i, part in enumerate(parts):
        if part.startswith("<"):
            m = re.match(r"<(/?)([a-zA-Z0-9]+)", part)
            if m and m.group(2).lower() in SKIP and not part.endswith("/>"):
                depth += -1 if m.group(1) else 1
            continue
        if depth == 0 and part.strip():
            yield parts, i, part


def needs(text):
    t = text.strip()
    if not re.search(r"[A-Za-z]{2,}", t):
        return False
    # single technical token (path, identifier, call) → keep
    if " " not in t and IDENT.match(t) and not re.match(r"^[A-Z][a-z]+$", t):
        return False
    return True


def collect(html):
    seen = []
    for _, _, text in nodes(html):
        t = text.strip()
        if needs(t) and t not in seen:
            seen.append(t)
    return seen


def build(html, de):
    parts = TOKEN.split(html)
    out = list(parts)
    missing = []
    depth = 0
    keep = False
    for i, part in enumerate(parts):
        if part.startswith("<"):
            m = re.match(r"<(/?)([a-zA-Z0-9]+)", part)
            if m and m.group(2).lower() in SKIP and not part.endswith("/>"):
                depth += -1 if m.group(1) else 1
            keep = 'translate="no"' in part and not part.endswith("/>")  # identifier, e.g. a table name
            continue
        if depth or keep or not part.strip():
            continue
        t = part.strip()
        if t in de:
            lead = part[: len(part) - len(part.lstrip())]
            trail = part[len(part.rstrip()):]
            out[i] = lead + de[t] + trail
        elif needs(t):
            missing.append(t)
    res = "".join(out)
    # page-level switches
    res = res.replace('<html lang="en">', '<html lang="de">', 1)
    res = res.replace('hreflang="en" lang="en" aria-current="page">EN', 'hreflang="en" lang="en">EN', 1)
    res = res.replace('hreflang="de" lang="de">DE', 'hreflang="de" lang="de" aria-current="page">DE', 1)
    for a, b in de.get("__attr__", {}).items():
        res = res.replace(a, b)
    return res, missing


if __name__ == "__main__":
    cmd = sys.argv[1]
    html = open(sys.argv[2], encoding="utf-8").read()
    if cmd == "collect":
        json.dump(collect(html), open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        print(len(collect(html)), "texts")
    else:
        de = json.load(open(sys.argv[3], encoding="utf-8"))
        res, missing = build(html, de)
        open(sys.argv[4], "w", encoding="utf-8").write(res)
        done = {v for v in de.values() if isinstance(v, str)}
        rest = [m for m in missing if m not in done]
        print(f"{len(rest)} text nodes kept in English – mostly names, paths, identifiers (-v lists them)")
        for m in rest if "-v" in sys.argv else []:
            print("  ", m[:110])
