"""Folie „App Architecture: Platform Functions“ (16:9, englisch) → CONTENT/App_Architecture_Functions.{pptx,png}.

Design wie Folie 1 der Architektur-Präsentation: nutzt deren Helfer, Farben und Icons aus
~/__project_applied_research/Praesentation/folien/build_folien.py (Pfad per BUILD_FOLIEN änderbar).
Inhalt: docs/FUNKTIONEN.md.

    python scripts/build_slide_functions.py        # braucht python-pptx, cairosvg, Pillow
    soffice --headless --convert-to pdf CONTENT/App_Architecture_Functions.pptx
    pdftoppm -png -singlefile -scale-to-x 1920 -scale-to-y 1080 App_Architecture_Functions.pdf CONTENT/App_Architecture_Functions
"""
import importlib.util
import os
from pathlib import Path

from pptx import Presentation
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "CONTENT" / "App_Architecture_Functions.pptx"
BF_PATH = Path(os.environ.get(
    "BUILD_FOLIEN", Path.home() / "__project_applied_research/Praesentation/folien/build_folien.py"))

spec = importlib.util.spec_from_file_location("build_folien", BF_PATH)
bf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bf)  # LANG bleibt "de" → Texte gehen unverändert durch tr()
box, run, text, arrow, step, icon, tint = bf.box, bf.run, bf.text, bf.arrow, bf.step, bf.icon, bf.tint
INK, LINE, SURFACE, ON_INK, S1, S2, S3 = bf.INK, bf.LINE, bf.SURFACE, bf.ON_INK, bf.S1, bf.S2, bf.S3
LATER_FILL = "4A5470"  # vorgesehene, aber nicht im Prototyp gebaute Funktion

# (Icon, Name, Kurzbeschreibung, im Prototyp?)
FUNCTIONS = [
    ("search", "Map & Search", "filters + alerts", True),
    ("send", "Offer & Request", "why companies match", True),
    ("user-check", "Cooperation", "quantity · price · pickup", True),
    ("clock", "Material Tracking", "container status", False),
    ("eye", "Network Dashboard", "local network state", True),
    ("badge-check", "Impact", "reuse · disposal · CO₂", True),
]

# (Icon, Ebene, Farbe, Zeilenhöhe, je Funktion die Zeilen; „✓ “ = gibt es heute schon)
LAYERS = [
    ("monitor", "Pages", S1, 0.66, [
        ["/map", "/offers + filters"], ["/offers/new", "/requests/new"], ["/cooperations/[id]"],
        ["/containers/[id]"], ["/network"], ["/impact"]]),
    ("server", "API", S2, 0.78, [
        ["✓ GET /api/offers", "+ distance filter", "/api/alerts"],
        ["POST /api/offers", "/api/requests", "GET /api/matches"],
        ["/api/agreements", "PATCH …/status"], ["/api/containers"], ["GET /api/network"],
        ["GET /api/impact?year="]]),
    ("cpu", "Logic", S2, 0.78, [
        ["Distance (Haversine)", "Alerts on new offers"],
        ["Match reasons:", "material, distance,", "quantity"],
        ["✓ Status flow", "status.ts", "Who may switch (DAL)"],
        ["Container flow", "collected → reused"],
        ["Active, unmatched,", "most requested"],
        ["kg reused", "disposal avoided", "CO₂ = kg × factor"]]),
    ("database", "Data", S3, 0.92, [
        ["✓ sites · offers", "✓ materials", "alerts · notifications"],
        ["✓ offers", "requests", "(open with DB team)"],
        ["✓ agreements", "pickup date · quality", "agreement_events"],
        ["containers", "container_events"],
        ["reads offers,", "requests, alerts"],
        ["reads completed", "agreements"]]),
]

PATTERN = ["Record with a status", "Allowed changes\nstatus.ts", "History\n*_events table",
           "Dashboard + Impact\nread the history"]

X0, LABEL_W, RIGHT = 0.5, 1.5, 12.83
CX0, GAP = X0 + LABEL_W + 0.15, 0.12
COL_W = (RIGHT - CX0 - 5 * GAP) / 6


def col_x(i):
    return CX0 + i * (COL_W + GAP)


def cell_lines(items):
    paras = []
    for t in items:
        if t.startswith("✓ "):
            paras.append([run("✓ ", 10, True, S2), run(t[2:], 10, True)])
        else:
            paras.append([run(t, 10)])
    return paras


def function_cards(s, y, h):
    # eine Schriftgröße für alle Namen: die größte, bei der der längste Name in die Karte passt
    size = max(sz for sz in (12.5, 12, 11.5, 11) if all(bf.label_width(f[1], sz) <= COL_W - 0.2 for f in FUNCTIONS)
               or sz == 11)
    for i, (ic, name, what, now) in enumerate(FUNCTIONS):
        x = col_x(i)
        box(s, x, y, COL_W, h, INK if now else LATER_FILL)
        mid = x + COL_W / 2
        icon(s, ic, mid - 0.4, y + 0.13, 0.32, SURFACE)
        step(s, mid + 0.06, y + 0.12, i + 1, bf.LABEL_ON_INK, d=0.34)
        text(s, x + 0.08, y + 0.53, COL_W - 0.16, 0.25, [[run(name, size, True, SURFACE)]], align=PP_ALIGN.CENTER)
        sub = what if now else what + " · later"
        text(s, x + 0.08, y + 0.78, COL_W - 0.16, 0.22, [[run(sub, 9.5, False, ON_INK)]], align=PP_ALIGN.CENTER)


def layer_rows(s, y):
    for ic, label, color, h, cells in LAYERS:
        box(s, X0, y - 0.06, RIGHT - X0 + 0.06, h + 0.12, tint(color, 0.09))
        icon(s, ic, X0 + 0.14, y + h / 2 - 0.27, 0.26, color)
        text(s, X0 + 0.14, y + h / 2 + 0.03, LABEL_W - 0.2, 0.25, [[run(label, 13, True, color)]])
        for i, items in enumerate(cells):
            later = not FUNCTIONS[i][3]
            box(s, col_x(i), y, COL_W, h, tint(color, 0.04) if later else SURFACE, line=LINE)
            text(s, col_x(i) + 0.1, y + 0.06, COL_W - 0.2, h - 0.12, cell_lines(items), anchor=MSO_ANCHOR.MIDDLE)
        y += h + 0.16
    return y


def pattern_row(s, y):
    text(s, X0, y + 0.02, LABEL_W, 0.5, [[run("One pattern", 11.5, True)], [run("for every flow", 11.5, True)]])
    bw, aw, h = 1.82, 0.38, 0.52
    x = CX0
    for i, label in enumerate(PATTERN):
        box(s, x, y, bw, h, SURFACE, line=LINE)
        text(s, x + 0.06, y, bw - 0.12, h, [[run(p, 10, j == 0)] for j, p in enumerate(label.split("\n"))],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        x += bw
        if i < len(PATTERN) - 1:
            arrow(s, x + 0.05, y + h / 2, x + aw - 0.05, y + h / 2, S2)
            x += aw
    lx = x + 0.3
    text(s, lx, y + 0.02, RIGHT - lx, h, [
        [run("✓ ", 10, True, S2), run("exists today", 10)],
        [run("everything else: planned", 10)],
    ], anchor=MSO_ANCHOR.MIDDLE)


def main():
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)  # 16:9, 13,333 × 7,5 Zoll
    s = bf.new_slide(
        prs, "App Architecture: Platform Functions",
        "Six functions for companies – each runs through the same five server steps and shares one database.",
        "Each column is one function, each row one layer of the app. Pages are built by the frontend team, "
        "API, logic and data follow the five server steps from slide 1. Tracking is prepared, not part of the "
        "prototype. Cooperation and tracking share one pattern: status, allowed changes, history.")
    function_cards(s, 1.5, 1.05)
    y = layer_rows(s, 2.72)
    pattern_row(s, y + 0.04)
    prs.core_properties.title = "App Architecture: Platform Functions"
    prs.core_properties.language = "en-US"
    prs.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
