"""Offer form (Form:A): list of sections (click, keyboard, focus, current marker), column layout, no console errors."""
import os, sys
from pw_common import BASE, SHOTS, check, context, run
PATH = sys.argv[1] if len(sys.argv) > 1 else "/my-offers/7/edit"

def main(browser):
    ctx = context(browser); page = ctx.new_page(); errors = []
    page.on("console", lambda m: errors.append(m.text[:400]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)[:400]))
    page.goto(BASE + PATH); page.wait_for_load_state("networkidle"); page.wait_for_timeout(800)
    nav = page.get_by_role("navigation", name="Abschnitte"); links = nav.get_by_role("link")
    check("seven numbered sections", links.count() == 7 and [l.inner_text().split("\n")[0] for l in links.all()] == [str(i) for i in range(1, 8)], str(links.count()))
    cols = page.evaluate("""(() => { const g = document.querySelector('nav[aria-labelledby=form-sections]').parentElement; return [...g.children].map(c => Math.round(c.getBoundingClientRect().width)) })()""")
    check("1440: columns 3 / 6 / 3", len(cols) == 3 and abs(cols[0] - cols[2]) <= 1 and abs(cols[1] - (2 * cols[0] + 24)) <= 2, str(cols))
    check("first section is marked as current", links.nth(0).get_attribute("aria-current") == "step" and links.nth(4).get_attribute("aria-current") is None)
    facts = page.evaluate("(() => { const r = document.querySelector('aside[aria-labelledby=live-preview] dl + div dl > div, aside[aria-labelledby=live-preview] div > dl > div'); return r ? getComputedStyle(r).gridTemplateColumns + ' | ' + r.className.slice(-60) : 'none' })()")
    check("preview facts stack label above value at 1440", " " not in facts.split(" | ")[0].strip(), facts)

    # click: opens a closed section, scrolls to it, focus on its heading row, marker moves
    if page.locator("#section-pricing").evaluate("e => e.open"): page.locator("#section-pricing > summary").click(); page.wait_for_timeout(200)  # close "5. Preis" (open on the edit page)
    was_closed = not page.locator("#section-pricing").evaluate("e => e.open")
    links.nth(4).click(); page.wait_for_timeout(900)
    top = page.locator("#section-pricing").bounding_box()["y"]
    check("click opens the section", was_closed and page.locator("#section-pricing").evaluate("e => e.open"))
    at_end = page.evaluate("scrollY + innerHeight >= document.documentElement.scrollHeight - 2")
    check("click scrolls the section to the top (or the page to its end)", -2 <= top <= 30 or (at_end and top < 900), f"{top} end={at_end}")
    check("focus is on the section's heading row", page.evaluate("document.activeElement.tagName + ':' + document.activeElement.parentElement.id") == "SUMMARY:section-pricing")
    check("marker moved to section 5", links.nth(4).get_attribute("aria-current") == "step" and links.nth(0).get_attribute("aria-current") is None)
    # keyboard: Enter on a link; typing in a field marks its section
    links.nth(6).focus(); page.keyboard.press("Enter"); page.wait_for_timeout(900)
    check("Enter on a link goes to section 7", page.evaluate("document.activeElement.parentElement.id") == "section-evidence" and links.nth(6).get_attribute("aria-current") == "step")
    page.locator("#title").focus(); page.wait_for_timeout(100)
    check("focus in a field marks its section", links.nth(0).get_attribute("aria-current") == "step")
    check("the form was not marked as changed by navigating", page.get_by_text("Ungespeicherte").count() == 0)
    page.screenshot(path=os.path.join(SHOTS, "form_nav_1440.png"))

    # 1100 px: sections as a row above, fields 8 + preview 4; 360: one column, nothing wider than the screen
    for w, expect in [(1100, "row"), (360, "one")]:
        page.set_viewport_size({"width": w, "height": 800}); page.wait_for_timeout(300)
        b = page.evaluate("""(() => { const n = document.querySelector('nav[aria-labelledby=form-sections]'), g = n.parentElement, r = e => e.getBoundingClientRect();
          return { nav: r(n).width, grid: r(g).width, form: r(g.children[1]).width, aside: r(g.children[2]).width, asideLeft: r(g.children[2]).left, formLeft: r(g.children[1]).left, overflow: document.documentElement.scrollWidth > innerWidth } })()""")
        if expect == "row": check("1100: sections full width, preview beside the fields", abs(b["nav"] - b["grid"]) <= 1 and b["asideLeft"] > b["formLeft"] + 100, str(b))
        else: check("360: one column", abs(b["form"] - b["grid"]) <= 1 and abs(b["aside"] - b["grid"]) <= 1 and abs(b["asideLeft"] - b["formLeft"]) <= 1, str(b))
        check(f"{w}: no sideways scrolling", not b["overflow"])
    check("no console or page errors", not errors, " || ".join(errors)[:900])
    ctx.close()
run(main)
