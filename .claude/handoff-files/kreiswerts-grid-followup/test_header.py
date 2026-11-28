"""Header menus (Kopf:B): mouse, keyboard and focus behaviour of "Create" and the account menu."""
import os
from pw_common import BASE, SHOTS, check, context, run

def main(browser):
    ctx = context(browser)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/dashboard"); page.wait_for_load_state("networkidle")
    header = page.locator("body > header")
    create = header.get_by_role("button", name="Erstellen")
    account = header.get_by_role("button", name="Kontomenü")
    focused = lambda: page.evaluate("document.activeElement.textContent.trim().replace(/\\s+/g, ' ')")
    ids = {id(create): create.get_attribute("aria-controls"), id(account): account.get_attribute("aria-controls")}
    panel = lambda btn: page.locator("[id='" + ids[id(btn)] + "']")  # by id: the button names change with the language

    check("header is 68 px high at 1440", abs(header.bounding_box()["height"] - 69) <= 1.5, str(header.bounding_box()["height"]))
    check("'Mein Konto' is no longer a main entry", header.get_by_role("navigation").get_by_role("link", name="Mein Konto").count() == 0)
    check("six main entries without icons", header.locator("nav li").count() == 6 and header.locator("nav svg").count() == 0)
    check("both menus start closed", create.get_attribute("aria-expanded") == "false" and not panel(create).is_visible() and not panel(account).is_visible())

    create.click()
    check("click opens Create", create.get_attribute("aria-expanded") == "true" and panel(create).is_visible())
    check("Create lists offer and request", [a.get_attribute("href") for a in panel(create).get_by_role("link").all()] == ["/my-offers/new", "/my-requests/new"])
    page.screenshot(path=os.path.join(SHOTS, "menu_create_1440.png"), clip={"x": 840, "y": 0, "width": 600, "height": 260})
    page.mouse.click(300, 500)
    check("click outside closes Create", create.get_attribute("aria-expanded") == "false" and not panel(create).is_visible())

    create.focus(); page.keyboard.press("Enter")
    check("Enter opens, focus stays on the button", panel(create).is_visible() and focused().startswith("Erstellen"))
    page.keyboard.press("Escape")
    check("Escape closes and keeps the focus on the button", not panel(create).is_visible() and focused().startswith("Erstellen"))
    page.keyboard.press("ArrowDown")
    check("Arrow down opens and focuses the first entry", panel(create).is_visible() and focused().startswith("Angebot erstellen"), focused())
    page.keyboard.press("ArrowDown"); a = focused(); page.keyboard.press("ArrowDown"); b = focused()
    check("Arrow down walks and wraps", a.startswith("Gesuch erstellen") and b.startswith("Angebot erstellen"), a + " / " + b)
    page.keyboard.press("End"); a = focused(); page.keyboard.press("Home"); b = focused()
    check("End / Home jump", a.startswith("Gesuch erstellen") and b.startswith("Angebot erstellen"))
    page.keyboard.press("Escape")
    check("Escape from an entry returns to the button", not panel(create).is_visible() and focused().startswith("Erstellen"))
    page.keyboard.press("ArrowUp")
    check("Arrow up opens on the last entry", panel(create).is_visible() and focused().startswith("Gesuch erstellen"))
    page.keyboard.press("Tab")
    check("Tab out closes Create and moves to the account button", not panel(create).is_visible() and page.evaluate("document.activeElement.getAttribute('aria-label') || ''").startswith("Kontomenü"))

    page.keyboard.press("Space")
    check("Space opens the account menu", panel(account).is_visible())
    texts = panel(account).inner_text()
    check("entries carry real class names", all("function" not in (e.get_attribute("class") or "") and "min-h-11" in (e.get_attribute("class") or "") for e in panel(account).locator("a, button:not([lang])").all() + panel(create).locator("a").all()))
    check("account menu: company, my account, language, appearance, log out", all(w in texts for w in ["Musterplast", "Mein Konto", "Sprache", "Darstellung", "Abmelden"]), texts)
    page.screenshot(path=os.path.join(SHOTS, "menu_account_1440.png"), clip={"x": 840, "y": 0, "width": 600, "height": 380})
    create.click()
    check("opening one menu closes the other", panel(create).is_visible() and not panel(account).is_visible())
    page.keyboard.press("Escape")

    # appearance: toggles the scheme and keeps the menu open
    account.click(); row = panel(account).get_by_role("button", name="Darstellung")
    before = page.evaluate("getComputedStyle(document.documentElement).colorScheme + '|' + (document.documentElement.dataset.theme || '')")
    row.click(); page.wait_for_timeout(400)
    after = page.evaluate("document.documentElement.dataset.theme || ''")
    check("appearance switches the scheme, menu stays open", after == "light" and panel(account).is_visible() and "Hell" in row.inner_text(), before + " → " + after)
    row.click(); page.wait_for_timeout(400)
    check("appearance switches back", page.evaluate("document.documentElement.dataset.theme") == "dark" and "Dunkel" in row.inner_text())

    # language: EN and back, menu stays usable
    panel(account).get_by_role("button", name="en", exact=True).click(); page.wait_for_timeout(1200)
    check("language switch → English labels", header.get_by_role("button", name="Create").count() == 1 and "My account" in panel(account).inner_text())
    panel(account).get_by_role("button", name="de", exact=True).click(); page.wait_for_timeout(1200)
    check("language switch → back to German", header.get_by_role("button", name="Erstellen").count() == 1)

    # a link closes the menu and navigates
    if not panel(account).is_visible(): header.locator("[aria-controls='" + ids[id(account)] + "']").click()
    panel(account).get_by_role("link", name="Mein Konto").click(); page.wait_for_url("**/account")
    check("'Mein Konto' navigates and the menu is closed", not panel(account).is_visible())
    create.click(); panel(create).get_by_role("link", name="Gesuch erstellen").click(); page.wait_for_url("**/my-requests/new")
    check("'Gesuch erstellen' navigates and the menu is closed", not panel(create).is_visible())

    # narrow: one row, menus stay inside the screen
    m = context(browser, width=360, height=740, scheme="light"); mp = m.new_page(); mp.goto(BASE + "/dashboard"); mp.wait_for_load_state("networkidle")
    mh = mp.locator("body > header")
    tops = mp.evaluate("[...document.querySelectorAll('body > header > div > a, body > header > div > div')].map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))")
    check("360 px: logo and actions share one row", abs(tops[0] - tops[1]) <= 2, str(tops))
    check("360 px: no sideways scrolling", mp.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    for name in ["Erstellen", "Kontomenü"]:
        btn = mh.get_by_role("button", name=name); btn.click(); box = mp.locator("#" + btn.get_attribute("aria-controls").replace(":", "\\:")).bounding_box()
        check(f"360 px: {name} panel inside the screen", box["x"] >= 0 and box["x"] + box["width"] <= 360, str(box))
        mp.screenshot(path=os.path.join(SHOTS, f"menu_{'create' if name == 'Erstellen' else 'account'}_360.png"), clip={"x": 0, "y": 0, "width": 360, "height": 400})
        mp.keyboard.press("Escape")
    m.close()

    # administrator: no bell, no Create, admin entries
    a = context(browser, user="admin_demo"); ap = a.new_page(); ap.goto(BASE + "/dashboard"); ap.wait_for_load_state("networkidle")
    ah = ap.locator("body > header")
    check("admin: seven entries, no Create, no bell", ah.locator("nav li").count() == 7 and ah.get_by_role("button", name="Erstellen").count() == 0 and ah.locator("a[href='/notifications']").count() == 0)
    check("admin: one row at 1440", abs(ah.bounding_box()["height"] - 69) <= 1.5, str(ah.bounding_box()["height"]))
    ah.get_by_role("button", name="Kontomenü").click()
    ap.screenshot(path=os.path.join(SHOTS, "menu_admin_1440.png"), clip={"x": 0, "y": 0, "width": 1440, "height": 330})
    a.close()

    # 1344 px (where the entries move into the header row): one row, nothing clipped – member and administrator; 1343: two rows
    for user in ["site_a", "admin_demo"]:
        c = context(browser, user=user, width=1344, height=800); cp = c.new_page(); cp.goto(BASE + "/dashboard"); cp.wait_for_load_state("networkidle")
        m = cp.evaluate("(() => { const h = document.querySelector('body > header'), u = h.querySelector('nav ul'); return { h: h.getBoundingClientRect().height, clipped: u.scrollWidth > u.clientWidth + 1, over: document.documentElement.scrollWidth > innerWidth } })()")
        check(f"1344 px {user}: one row, all entries visible", abs(m["h"] - 69) <= 1.5 and not m["clipped"] and not m["over"], str(m))
        cp.set_viewport_size({"width": 1343, "height": 800}); cp.wait_for_timeout(200)
        check(f"1343 px {user}: entries in their own row", cp.evaluate("document.querySelector('body > header').getBoundingClientRect().height") > 100)
        # English at 1344
        c.add_cookies([{"name": "locale", "value": "en", "url": BASE}]); cp.set_viewport_size({"width": 1344, "height": 800}); cp.reload(); cp.wait_for_load_state("networkidle")
        m = cp.evaluate("(() => { const h = document.querySelector('body > header'), u = h.querySelector('nav ul'); return { h: h.getBoundingClientRect().height, clipped: u.scrollWidth > u.clientWidth + 1, over: document.documentElement.scrollWidth > innerWidth } })()")
        check(f"1344 px {user}, English: one row, all entries visible", abs(m["h"] - 69) <= 1.5 and not m["clipped"] and not m["over"], str(m))
        c.close()

    # log out from the account menu (own session, so the stored login of the other checks stays valid)
    o = browser.new_context(viewport={"width": 1440, "height": 900}); page.wait_for_timeout(11000)  # login rate limit: 3 per 10 s
    from pw_common import password
    assert o.request.post(BASE + "/api/auth/sign-in/username", data={"username": "site_a", "password": password("site_a")}).status == 200
    op = o.new_page(); op.goto(BASE + "/dashboard"); op.wait_for_load_state("networkidle")
    op.locator("body > header").get_by_role("button", name="Kontomenü").click(); op.get_by_role("button", name="Abmelden").click(); op.wait_for_url(BASE + "/", timeout=15000)
    check("log out from the menu ends the session and returns to the start page", o.request.get(BASE + "/api/auth/get-session").text().strip() in ("null", ""))
    o.close()

    check("no console or page errors", not errors, " | ".join(errors)[:300])
    ctx.close()

run(main)
