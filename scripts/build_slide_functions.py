"""Folie „App Architecture: Platform Functions“ (16:9, 2560 × 1440, englisch) → nur CONTENT/App_Architecture_Functions.png.

Design wie Folie 1 der Architektur-Präsentation: nutzt deren Helfer, Farben und Icons aus
~/__project_applied_research/Praesentation/folien/build_folien.py (Pfad per BUILD_FOLIEN änderbar).
Inhalt: docs/FUNKTIONEN.md.

    python scripts/build_slide_functions.py   # braucht python-pptx, cairosvg, Pillow, soffice, pdftoppm
PPTX und PDF entstehen nur als Zwischenschritt in einem Temp-Ordner.
"""
import importlib.util
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from pptx import Presentation
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "CONTENT" / "App_Architecture_Functions.png"
BF_PATH = Path(os.environ.get(
    "BUILD_FOLIEN", Path.home() / "__project_applied_research/Praesentation/folien/build_folien.py"))

sys.dont_write_bytecode = True  # kein __pycache__ im fremden Repo
spec = importlib.util.spec_from_file_location("build_folien", BF_PATH)
bf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bf)  # LANG bleibt "de" → Texte gehen unverändert durch tr()
box, run, text, arrow, step, icon, tint = bf.box, bf.run, bf.text, bf.arrow, bf.step, bf.icon, bf.tint
INK, LINE, SURFACE, ON_INK, S1, S2, S3 = bf.INK, bf.LINE, bf.SURFACE, bf.ON_INK, bf.S1, bf.S2, bf.S3
LATER_FILL = "4A5470"  # vorgesehene, aber nicht im Prototyp gebaute Funktion
W, H = 16, 9  # Zoll, 16:9 – größer als Folie 1 (13,333 × 7,5), damit Stack + 6 Funktionen Platz haben
PX = (2560, 1440)

# (Icon, Name, Kurzbeschreibung, im Prototyp?)
FUNCTIONS = [
    ("search", "Map & Search", "filters + alerts", True),
    ("send", "Offer & Request", "why companies match", True),
    ("user-check", "Cooperation", "quantity · price · pickup", True),
    ("clock", "Material Tracking", "container status", False),
    ("eye", "Network Dashboard", "local network state", True),
    ("badge-check", "Impact", "reuse · disposal · CO₂", True),
]

# Zeilen = Weg einer Anfrage wie Folie 1/2: Frontend, dann die 5 Stationen auf dem Server.
# (Nummer oder Icon, Rolle, Werkzeug, Farbe, Zeilenhöhe, je Funktion die Zeilen; „✓ “ = gibt es heute schon)
LAYERS = [
    ("monitor", "Frontend · browser", "React pages", S1, 0.56, [
        ["/map", "/offers + filters"], ["/offers/new", "/requests/new"], ["/cooperations/[id]"],
        ["/containers/[id]"], ["/network"], ["/impact"]]),
    (1, "Entry point", "Next.js Route + API", S2, 0.78, [
        ["✓ GET /api/offers", "/api/alerts"],
        ["POST /api/offers", "/api/requests", "GET /api/matches"],
        ["/api/agreements", "PATCH …/status"], ["/api/containers"], ["GET /api/network"],
        ["GET /api/impact?year="]]),
    (2, "Authentication", "Better Auth", S2, 0.62, [
        ["Guest: map + offers", "Member: + price, alerts"], ["Guest: browse", "Member: post + match"],
        ["Member: only the two companies"], ["Member only"], ["Guest: totals", "Member: details"],
        ["Guest + member"]]),
    (3, "Validation", "Zod", S2, 0.62, [
        ["material + radius km", "quantity + price range"], ["quantity kg > 0", "date, price ≥ 0"],
        ["status value", "pickup date, quality"], ["container id, status"], ["period"], ["year"]]),
    (4, "Authorization + logic", "Data Access Layer", S2, 0.78, [
        ["Distance (Haversine)", "alerts on new offers"],
        ["Match reasons: material, distance, quantity"],
        ["✓ Status flow (status.ts)", "only the two sites may change it"],
        ["Container flow: collected → reused"],
        ["active + unmatched", "most requested"],
        ["kg reused", "disposal avoided", "CO₂ = kg × factor"]]),
    (5, "ORM → SQL", "Drizzle\n→ PostgreSQL", S3, 0.92, [
        ["✓ sites · offers", "✓ materials", "alerts · notifications"],
        ["✓ offers", "requests (open with DB team)"],
        ["✓ agreements", "pickup date · quality", "agreement_events"],
        ["containers", "container_events"],
        ["reads offers, requests, alerts"],
        ["reads completed agreements"]]),
]

PATTERN = ["Record with a status", "Allowed changes\nstatus.ts", "History\n*_events table",
           "Dashboard + Impact\nread the history"]

X0, LABEL_W, RIGHT = 0.5, 2.5, W - 0.5
CX0, GAP = X0 + LABEL_W + 0.15, 0.12
COL_W = (RIGHT - CX0 - 5 * GAP) / 6
GAP_Y = 0.12


def col_x(i):
    return CX0 + i * (COL_W + GAP)


DONE, PLANNED = "✓", "○"  # gibt es heute · geplant
MARK_W = 0.2  # Zoll: Breite der Marke, Folgezeilen beginnen bündig mit dem Text


def mark_run(mark, size=10.5):
    return run(mark + "\t", size, True, S2 if mark == DONE else INK)


def hanging(tb):
    """Hängender Einzug: Marke links, Text und Folgezeilen bündig dahinter."""
    for p in tb.text_frame.paragraphs:
        p_pr = p._p.get_or_add_pPr()
        p_pr.set("marL", str(Inches(MARK_W)))
        p_pr.set("indent", str(-Inches(MARK_W)))
    return tb


def cell_text(s, x, y, w, h, items):
    """Je Eintrag ein Absatz: ✓ gibt es heute (fett) · ○ geplant."""
    paras = []
    for t in items:
        done = t.startswith(DONE + " ")
        paras.append([mark_run(DONE if done else PLANNED), run(t[2:] if done else t, 10.5, done)])
    return hanging(text(s, x, y, w, h, paras, anchor=MSO_ANCHOR.MIDDLE))


def stack_card(s, y, h):
    """Ecke oben links: die Basis aus Folie 2 (Sprache, Framework, Laufzeit)."""
    box(s, X0, y, LABEL_W, h, INK)
    text(s, X0 + 0.16, y + 0.1, LABEL_W - 0.3, h - 0.2, [
        [run("Built with", 10, False, ON_INK)],
        [run("TypeScript", 13, True, SURFACE, bf.TOOL)],
        [run("Next.js · Node.js", 12, True, SURFACE, bf.TOOL)],
        [run("one language, one project", 9.5, False, ON_INK)],
    ], anchor=MSO_ANCHOR.MIDDLE, space=1)


def function_cards(s, y, h):
    # eine Schriftgröße für alle Namen: die größte, bei der der längste Name in die Karte passt
    size = max(sz for sz in (13, 12.5, 12, 11.5, 11) if all(bf.label_width(f[1], sz) <= COL_W - 0.2 for f in FUNCTIONS)
               or sz == 11)
    for i, (ic, name, what, now) in enumerate(FUNCTIONS):
        x = col_x(i)
        box(s, x, y, COL_W, h, INK if now else LATER_FILL)
        mid = x + COL_W / 2
        icon(s, ic, mid - 0.18, y + 0.11, 0.36, SURFACE)  # ohne Nummer: 1–5 gehört den Stationen
        text(s, x + 0.08, y + 0.53, COL_W - 0.16, 0.25, [[run(name, size, True, SURFACE)]], align=PP_ALIGN.CENTER)
        sub = what if now else what + " · later"
        text(s, x + 0.08, y + 0.78, COL_W - 0.16, 0.22, [[run(sub, 10, False, ON_INK)]], align=PP_ALIGN.CENTER)


def layer_label(s, mark, role, tool, color, y, h):
    if isinstance(mark, int):
        step(s, X0 + 0.14, y + h / 2 - 0.17, mark, color)
    else:
        icon(s, mark, X0 + 0.15, y + h / 2 - 0.16, 0.32, color)
    text(s, X0 + 0.6, y, LABEL_W - 0.66, h, [[run(role, 10, True, color)]] + [[run(p, 11.5, True, INK, bf.TOOL)] for p in tool.split("\n")],
         anchor=MSO_ANCHOR.MIDDLE)


def layer_rows(s, y):
    for mark, role, tool, color, h, cells in LAYERS:
        box(s, X0, y - GAP_Y / 2 + 0.01, RIGHT - X0 + 0.06, h + GAP_Y - 0.02, tint(color, 0.09))
        layer_label(s, mark, role, tool, color, y, h)
        for i, items in enumerate(cells):
            later = not FUNCTIONS[i][3]
            box(s, col_x(i), y + 0.03, COL_W, h - 0.06, tint(color, 0.04) if later else SURFACE, line=LINE)
            cell_text(s, col_x(i) + 0.1, y + 0.06, COL_W - 0.2, h - 0.12, items)
        y += h + GAP_Y
    return y


def pattern_row(s, y, h=0.52):
    text(s, X0, y, LABEL_W, h, [[run("One pattern for every flow", 11.5, True)]], anchor=MSO_ANCHOR.MIDDLE)
    bw, aw = 1.75, 0.32
    x = CX0
    for i, label in enumerate(PATTERN):
        box(s, x, y, bw, h, SURFACE, line=LINE)
        text(s, x + 0.06, y, bw - 0.12, h, [[run(p, 10.5, j == 0)] for j, p in enumerate(label.split("\n"))],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        x += bw
        if i < len(PATTERN) - 1:
            arrow(s, x + 0.06, y + h / 2, x + aw - 0.06, y + h / 2, S2)
            x += aw
    legend(s, x + 0.4, y + h / 2)


def legend(s, x, mid):
    """Legende unten rechts als Kasten: links Marken + „later“, rechts Gast/Mitglied."""
    w, h = RIGHT - x, 0.74
    y = mid - h / 2
    box(s, x, y, w, h, SURFACE, line=LINE)
    c1 = x + 0.16
    c2, cw = x + w * 0.56, w * 0.44 - 0.16
    hanging(text(s, c1, y, c2 - c1, h, [[mark_run(DONE), run("exists today", 10.5)],
                                               [mark_run(PLANNED), run("planned", 10.5)],
                                               [run("■\t", 10.5, True, LATER_FILL), run("later: not in prototype", 10.5)]], anchor=MSO_ANCHOR.MIDDLE))
    text(s, c2, y, cw, h, [[run("Guest", 10.5, True), run(" = logged out", 10.5)],
                                           [run("Member", 10.5, True), run(" = logged in", 10.5)]], anchor=MSO_ANCHOR.MIDDLE)


def main():
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(W), Inches(H)
    s = bf.new_slide(
        prs, "App Architecture: Platform Functions",
        "Six functions for companies – every request takes the same path: React page, then the five server steps "
        "① – ⑤ to PostgreSQL.",
        "Each column is one function, each row one step of a request (slides 1 and 2): React pages in the browser, "
        "then Next.js route, Better Auth (guest or member), Zod, Data Access Layer and Drizzle to PostgreSQL. "
        "Tracking is prepared, not part of the prototype. Cooperation and tracking share one pattern: status, "
        "allowed changes, history.")
    stack_card(s, 1.5, 1.05)
    function_cards(s, 1.5, 1.05)
    y = layer_rows(s, 2.76)
    pattern_row(s, y + 0.25)
    prs.core_properties.title = "App Architecture: Platform Functions"
    prs.core_properties.language = "en-US"
    with tempfile.TemporaryDirectory() as tmp:
        pptx = Path(tmp) / "slide.pptx"
        prs.save(pptx)
        subprocess.run(["soffice", f"-env:UserInstallation=file://{tmp}/lo", "--headless", "--convert-to", "pdf",
                        "--outdir", tmp, str(pptx)], check=True, capture_output=True)
        subprocess.run(["pdftoppm", "-png", "-singlefile", "-scale-to-x", str(PX[0]), "-scale-to-y", str(PX[1]),
                        str(Path(tmp) / "slide.pdf"), str(OUT.with_suffix(""))], check=True)
    print(OUT)


if __name__ == "__main__":
    main()
