#!/usr/bin/env python3
"""Rebuild the architecture page in both languages:

    python3 scripts/architecture/make.py        # docs/architecture.html + docs/architecture.de.html

New English text → add its German version to de.json (key = English text node);
`python3 scripts/architecture/translate.py build <en.html> de.json <out> -v` lists sentences still missing.
docs/architecture.png is a full-page screenshot (light theme, 1440 px wide) and is not rebuilt here.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE.parents[1] / "docs"


def run(args, env=None):
    subprocess.run([sys.executable, *map(str, args)], check=True, env=env)


run([HERE / "build.py", DOCS / "architecture.html"])
with tempfile.TemporaryDirectory() as tmp:
    raw = Path(tmp) / "de_raw.html"
    run([HERE / "build.py", raw], env=dict(os.environ, KW_LANG="de", KW_DE=str(HERE / "de.json")))
    run([HERE / "translate.py", "build", raw, HERE / "de.json", DOCS / "architecture.de.html"])
