"""Shared helpers of the interaction tests: own instance on port 3190, login once, results as a list of checks."""
import os, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3190"
REPO = "<repo>"
SHOTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "shots")
STATE = os.path.join(SHOTS, "state_{}.json")
results = []

def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f" – {detail}" if detail and not ok else ""))

def password(user):
    key = "DEMO_ADMIN_PASSWORD" if user == "admin_demo" else "DEMO_PASSWORD"
    for line in open(os.path.join(REPO, ".env.demo"), encoding="utf-8"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("demo password missing")

def context(browser, user="site_a", width=1440, height=900, scheme="dark", locale_cookie=None):
    """A logged-in context; the session is stored per user so a run logs in at most once (rate limit 3 per 10 s)."""
    state = STATE.format(user)
    kwargs = dict(viewport={"width": width, "height": height}, color_scheme=scheme)
    if os.path.exists(state):
        ctx = browser.new_context(storage_state=state, **kwargs)
        if ctx.request.get(BASE + "/api/auth/get-session").text().strip() not in ("null", ""):
            return _cookies(ctx, locale_cookie)
        ctx.close()
    ctx = browser.new_context(**kwargs)
    r = ctx.request.post(BASE + "/api/auth/sign-in/username", data={"username": user, "password": password(user)})
    assert r.status == 200, f"login failed: HTTP {r.status}"
    ctx.storage_state(path=state)
    return _cookies(ctx, locale_cookie)

def _cookies(ctx, locale_cookie):
    if locale_cookie:
        ctx.add_cookies([{"name": "locale", "value": locale_cookie, "url": BASE}])
    return ctx

def run(main):
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        try:
            main(browser)
        finally:
            browser.close()
    print(f"{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)
