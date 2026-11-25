#!/usr/bin/env python3
"""Generate docs/architecture.html (backend architecture explainer). Run via scripts/architecture/make.py."""
import sys
import json
import os
from html import escape as _esc

# Language: KW_LANG=de + KW_DE=<de.json> translates SVG labels here (so tag/mask widths fit);
# HTML text is translated afterwards by translate.py.
LANG = os.environ.get("KW_LANG", "en")
DE = json.load(open(os.environ["KW_DE"], encoding="utf-8")) if LANG == "de" else {}


def tr(s):
    return DE.get(s, s) if LANG == "de" and isinstance(s, str) else s


def e(s):
    return _esc(tr(s))
from pathlib import Path

OUT = Path(sys.argv[1])

# ---------- SVG helpers ----------------------------------------------------

def tag(cx, y, text, inv=False, c=None):
    text = tr(text)
    w = round(len(text) * 6.9 + 16)
    cls = " inv" if inv else (f" cc {c}" if c else "")
    return (f'<rect class="tag{cls}" x="{cx - w / 2:.1f}" y="{y}" width="{w}" height="18" rx="2"/>'
            f'<text class="tg{cls}" x="{cx}" y="{y + 13}" text-anchor="middle">{e(text)}</text>')


def node(x, y, w, h, name, sub=None, tg=None, kind="", q=None, sub2=None, c=None):
    """Centered node box. kind: '' | 'focal' | 'store' | 'bad'."""
    cx = x + w / 2
    inv = kind == "focal"
    ic = " inv" if inv else ""
    out = [f'<rect class="mask" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>',
           f'<rect class="node {kind}{(" cc " + c) if c and not inv else ""}" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>']
    lines = []
    if tg:
        lines.append(("tag", tg))
    if isinstance(name, (list, tuple)):
        for n in name:
            lines.append(("nm", n))
    else:
        lines.append(("nm", name))
    if sub:
        lines.append(("sub", sub))
    if sub2:
        lines.append(("sub", sub2))
    if q:
        lines.append(("q", q))
    heights = {"tag": 26, "nm": 21, "sub": 19, "q": 24}
    total = sum(heights[k] for k, _ in lines)
    cy = y + (h - total) / 2
    for k, t in lines:
        if k == "tag":
            out.append(tag(cx, cy, t, inv, c))
        elif k == "nm":
            out.append(f'<text class="nm{ic}" x="{cx}" y="{cy + 16}" text-anchor="middle">{e(t)}</text>')
        elif k == "sub":
            out.append(f'<text class="sub{ic}" x="{cx}" y="{cy + 14}" text-anchor="middle">{e(t)}</text>')
        elif k == "q":
            out.append(f'<text class="q{ic}" x="{cx}" y="{cy + 19}" text-anchor="middle">{e(t)}</text>')
        cy += heights[k]
    return "".join(out)


def label(cx, y, text, zone=False):
    """Arrow label: mask rect (y = top, 16 px high) + mono caps text."""
    text = tr(text)
    w = round(len(text) * 6.9 + 12)
    z = " z" if zone else ""
    return (f'<rect class="lm{z}" x="{cx - w / 2:.1f}" y="{y}" width="{w}" height="16" rx="2"/>'
            f'<text class="lbl" x="{cx}" y="{y + 12}" text-anchor="middle">{e(text)}</text>')


def label_left(x, y, text, zone=False):
    text = tr(text)
    w = round(len(text) * 6.9 + 12)
    z = " z" if zone else ""
    return (f'<rect class="lm{z}" x="{x}" y="{y}" width="{w}" height="16" rx="2"/>'
            f'<text class="lbl" x="{x + 6}" y="{y + 12}">{e(text)}</text>')


def path(d, kind="", marker="ah"):
    m = f' marker-end="url(#{marker})"' if marker else ""
    return f'<path class="ar {kind}" d="{d}"{m}/>'


def svg(slug, w, h, title, desc, body):
    return (f'<svg class="dg" viewBox="0 0 {w} {h}" style="min-width:{w}px" role="img" '
            f'aria-labelledby="{slug}-title {slug}-desc">'
            f'<title id="{slug}-title">{e(title)}</title><desc id="{slug}-desc">{e(desc)}</desc>'
            f'<rect class="bg" width="{w}" height="{h}"/>{body}</svg>')


def legend(y, w, items):
    """items: list of (kind, text); kinds: main, muted, dash, focal, store, bad."""
    out = [f'<line class="rule" x1="16" y1="{y}" x2="{w - 16}" y2="{y}"/>',
           f'<text class="lbl" x="16" y="{y + 30}">LEGEND</text>']
    x = 96
    for kind, text in items:
        text = tr(text)
        yy = y + 26
        if kind in ("main", "muted", "dash", "baddash", "authline", "stopline"):
            cls = {"main": "main", "muted": "", "dash": "dash", "baddash": "bad dash", "authline": "auth", "stopline": "bad"}[kind]
            mk = {"main": "ah-main", "muted": "ah", "dash": "ah", "baddash": "ah-bad", "authline": "ah-auth", "stopline": "ah-bad"}[kind]
            out.append(f'<path class="ar {cls}" d="M {x},{yy} H {x + 36}" marker-end="url(#{mk})"/>')
        else:
            cls = kind if not kind.startswith("c-") else f"cc {kind}"
            out.append(f'<rect class="node {cls}" x="{x}" y="{yy - 9}" width="28" height="18" rx="4"/>')
        out.append(f'<text class="lg" x="{x + 46}" y="{yy + 5}">{e(text)}</text>')
        x += 46 + round(len(text) * 7.4) + 36
    return "".join(out)


def zone(x, y, w, h, title=None, sub=None, c=None):
    out = [f'<rect class="zone{(" zc " + c) if c else ""}" x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/>']
    if title:
        if c:
            out.append(f'<rect class="sw {c}" x="{x + 20}" y="{y + 38}" width="14" height="14" rx="3"/>')
        out.append(f'<text class="zt" x="{x + (42 if c else 20)}" y="{y + 50}">{e(title)}</text>')
    if sub:
        for i, s in enumerate(sub):
            out.append(f'<text class="zs" x="{x + (42 if c else 20)}" y="{y + 72 + 18 * i}">{e(s)}</text>')
    return "".join(out)


# ---------- Diagram 1: overview -------------------------------------------

def overview():
    W, H = 1120, 728
    b = []
    # bands
    b.append(zone(16, 16, 1088, 120, "Browser", ["client side"], "c-fe"))
    b.append(zone(16, 184, 1088, 120, "Next.js app", ["src/app/", "runs in Node.js"], "c-app"))
    b.append(zone(16, 352, 1088, 120, "Server logic", ["src/server/", "runs in Node.js"]))
    b.append(zone(16, 520, 1088, 120, "Data", ["src/server/db/", "PostgreSQL"], "c-db"))
    # arrows (behind nodes)
    b.append(path("M 424,112 V 208", "main", "ah-main"))
    b.append(label_left(434, 152, "HTML PAGE"))
    b.append(path("M 880,112 V 208", "main", "ah-main"))
    b.append(label_left(890, 152, "FETCH · JSON"))
    b.append(path("M 280,280 V 376"))
    b.append(path("M 700,280 V 320 Q 700,328 692,328 H 324 Q 316,328 316,336 V 376"))
    b.append(label(508, 334, "EVERY REQUEST"))
    b.append(path("M 388,412 H 444", "main", "ah-main"))
    b.append(path("M 624,412 H 680", "main", "ah-main"))
    b.append(path("M 860,412 H 916", "dash"))
    b.append(path("M 770,448 V 544", "main", "ah-main"))
    b.append(label_left(780, 488, "TYPED QUERY"))
    b.append(path("M 860,580 H 916", "main", "ah-main"))
    b.append(label(888, 552, "SQL", True))
    b.append(path("M 298,448 V 572 Q 298,580 306,580 H 680", "auth", "ah-auth"))
    b.append(label(490, 552, "SESSIONS · USERS", True))
    # nodes
    b.append(node(208, 40, 432, 72, "Pages users see", "HTML from the server · React · Tailwind CSS", "UI", c="c-fe"))
    b.append(node(664, 40, 432, 72, "Interactive parts", '"use client" · forms · authClient', "UI", c="c-fe"))
    b.append(node(208, 208, 432, 72, "Pages · Server Components", "src/app/**/page.tsx", "PAGE", c="c-app"))
    b.append(node(664, 208, 432, 72, "API route handlers", "/api/offers · /api/health · /api/auth/*", "API", c="c-app"))
    b.append(node(208, 376, 180, 72, "Better Auth", "auth.ts · viewer.ts", "2 · WHO?", c="c-auth"))
    b.append(node(444, 376, 180, 72, "Zod", "validation/*.ts", "3 · VALID?", c="c-zod"))
    b.append(node(680, 376, 180, 72, "Data Access Layer", "dal/*.ts", "4 · MAY SEE?", "focal"))
    b.append(node(916, 376, 180, 72, "Domain rules", "domain/status.ts", "RULES"))
    b.append(node(680, 544, 180, 72, "Drizzle ORM", "db/schema.ts · pg", "5 · ORM", c="c-db"))
    b.append(node(916, 544, 180, 72, "PostgreSQL 17", "9 tables", "DB", c="c-db"))
    b.append(legend(664, W, [("main", "request path"), ("muted", "calls"), ("dash", "reads rules"),
                             ("authline", "login data"), ("focal", "decides what a role sees")]))
    return svg("overview", W, H, "KreiswertS backend: the big picture",
               "Layered overview: browser pages and interactive parts call Next.js pages and API routes, "
               "which pass every request through Better Auth, Zod and the Data Access Layer to Drizzle ORM and PostgreSQL.",
               "".join(b))


# ---------- Diagram 2: one request, five stations --------------------------

def request():
    W, H = 1120, 280
    b = []
    b.append('<text class="req" x="20" y="44">GET /api/offers?city=Moers</text>')
    b.append('<text class="q" x="20" y="68">Example: the offers list on /offers</text>')
    # arrows
    for x1, x2 in ((108, 132), (280, 304), (452, 476), (624, 648), (796, 820), (968, 992)):
        b.append(path(f"M {x1},152 H {x2}", "main", "ah-main"))
    b.append(path("M 550,96 V 64", "bad", "ah-bad"))
    b.append(label_left(560, 72, "INVALID"))
    b.append(path("M 722,208 V 248 Q 722,256 714,256 H 72 Q 64,256 64,248 V 208", "main dash", "ah-main"))
    b.append(label(400, 228, "JSON · ROLE + OFFERS"))
    # nodes
    b.append(node(476, 12, 148, 52, "400 Bad Request", "which field failed", kind="bad"))
    b.append(node(20, 96, 88, 112, "Browser", "client", c="c-fe"))
    b.append(node(132, 96, 148, 112, "Route handler", "offers/route.ts", "STEP 1", q="Entry point", c="c-app"))
    b.append(node(304, 96, 148, 112, "Better Auth", "viewer.ts", "STEP 2", q="Guest or member?", c="c-auth"))
    b.append(node(476, 96, 148, 112, "Zod", "validation/", "STEP 3", q="Input valid?", c="c-zod"))
    b.append(node(648, 96, 148, 112, "Data Access", "dal/offers.ts", "STEP 4", "focal", q="What may they see?"))
    b.append(node(820, 96, 148, 112, "Drizzle ORM", "db/schema.ts", "STEP 5", q="Safe SQL", c="c-db"))
    b.append(node(992, 96, 112, 112, "PostgreSQL", "17", c="c-db"))
    return svg("request", W, H, "One request through the five stations",
               "GET /api/offers passes route handler, Better Auth, Zod, Data Access Layer and Drizzle ORM to PostgreSQL; "
               "invalid input returns 400, otherwise JSON with the role and the offers that role may see.",
               "".join(b))


# ---------- Diagram 3: database --------------------------------------------

ROW, HEAD = 24, 32


def table(x, y, w, name, rows, auth=False):
    h = HEAD + ROW * len(rows)
    a = " cc c-auth" if auth else " cc c-db"
    out = [f'<rect class="mask" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>',
           f'<rect class="tbl{a}" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>',
           f'<path class="th{a}" d="M {x},{y + HEAD} V {y + 6} Q {x},{y} {x + 6},{y} H {x + w - 6} Q {x + w},{y} {x + w},{y + 6} V {y + HEAD} Z"/>',
           f'<text class="tn" x="{x + 12}" y="{y + 21}">{e(name)}</text>']
    for i, (field, mark) in enumerate(rows):
        ry = y + HEAD + ROW * i
        out.append(f'<line class="rl" x1="{x}" y1="{ry}" x2="{x + w}" y2="{ry}"/>')
        out.append(f'<text class="tf" x="{x + 12}" y="{ry + 16}">{e(field)}</text>')
        if mark:
            mw = round(len(mark) * 6.9 + 10)
            out.append(f'<rect class="tag" x="{x + w - 10 - mw}" y="{ry + 4}" width="{mw}" height="16" rx="2"/>')
            out.append(f'<text class="tg" x="{x + w - 10 - mw / 2}" y="{ry + 16}" text-anchor="middle">{mark}</text>')
    return "".join(out)


def database():
    W, H = 1120, 752
    b = []
    b.append('<rect class="zone" x="16" y="16" width="792" height="720" rx="10"/>')
    b.append('<rect class="sw c-db" x="32" y="32" width="14" height="14" rx="3"/><text class="zt" x="54" y="44">Platform data</text><text class="zs" x="182" y="44">schema.ts · from the ER diagram (2026-11-18)</text>')
    b.append('<rect class="zone" x="824" y="16" width="288" height="720" rx="10"/>')
    b.append('<rect class="sw c-auth" x="840" y="32" width="14" height="14" rx="3"/><text class="zt" x="862" y="44">Login data</text><text class="zs" x="964" y="44">auth-schema.ts</text>')
    # relationships (behind tables)
    b.append(path("M 264,132 H 272 Q 280,132 280,124 V 116 Q 280,108 288,108 H 296", "db", "ah-db"))
    b.append(path("M 296,436 H 288 Q 280,436 280,428 V 396 Q 280,388 272,388 H 264", "db", "ah-db"))
    b.append(path("M 412,344 V 288", "db", "ah-db"))
    b.append(label_left(422, 308, "SELLER", True))
    b.append(path("M 560,412 H 552 Q 544,412 544,404 V 396 Q 544,388 536,388 H 528", "db", "ah-db"))
    b.append(path("M 676,344 V 116 Q 676,108 668,108 H 528", "db", "ah-db"))
    b.append(label_left(686, 216, "BUYER", True))
    b.append(path("M 840,228 H 824 Q 816,228 816,220 V 88 Q 816,80 808,80 H 528", "auth dash", "ah-auth"))
    b.append(label(640, 56, "PLANNED LINK", True))
    b.append(path("M 1072,436 H 1084 Q 1092,436 1092,428 V 116 Q 1092,108 1084,108 H 1072", "auth", "ah-auth"))
    b.append(path("M 1072,620 H 1096 Q 1104,620 1104,612 V 88 Q 1104,80 1096,80 H 1072", "auth", "ah-auth"))
    # tables
    b.append(table(32, 64, 232, "users", [("id", "PK"), ("site_id", "FK"), ("email", "UQ"), ("password", ""), ("account_status", "")]))
    b.append(table(296, 64, 232, "sites  · business", [("id", "PK"), ("company_name", ""), ("branch_name", ""), ("description", ""),
                                                ("street_address · postal_code", ""), ("city", ""), ("latitude · longitude", ""),
                                                ("contact_name / email / phone", "")]))
    b.append(table(32, 344, 232, "materials", [("id", "PK"), ("code", "UQ"), ("name", ""), ("category", ""),
                                               ("impact_factor_kg_co2e_per_kg", "")]))
    b.append(table(296, 344, 232, "offers", [("id", "PK"), ("seller_site_id", "FK"), ("material_id", "FK"), ("title", ""),
                                            ("available_quantity_kg", ""), ("price_eur_per_kg", ""), ("available_from", ""),
                                            ("status", ""), ("created_at · updated_at", "")]))
    b.append(table(560, 344, 232, "agreements  · match", [("id", "PK"), ("offer_id", "FK"), ("buyer_site_id", "FK"),
                                                ("agreed_quantity_kg", ""), ("agreed_price_eur_per_kg", ""), ("status", ""),
                                                ("buyer_confirmed_at", ""), ("seller_confirmed_at", ""), ("actual_quantity_kg", ""),
                                                ("completed_at", ""), ("impact_factor_used", ""), ("created_at", "")]))
    b.append(table(840, 64, 232, "auth_users", [("id", "PK"), ("name", ""), ("email", "UQ"), ("email_verified", ""),
                                                ("username", "UQ"), ("site_id", ""), ("company_name", ""), ("vat_id", ""),
                                                ("material_interest", ""), ("created_at · updated_at", "")], True))
    b.append(table(840, 368, 232, "auth_sessions", [("id", "PK"), ("user_id", "FK"), ("token", "UQ"), ("expires_at", ""),
                                                   ("ip_address · user_agent", "")], True))
    b.append(table(840, 552, 232, "auth_accounts", [("id", "PK"), ("user_id", "FK"), ("provider_id", ""), ("account_id", ""),
                                                   ("password (hash)", "")], True))
    b.append('<text class="q" x="840" y="728">+ auth_verifications (tokens)</text>')
    # open questions note
    b.append('<rect class="node bad" x="32" y="528" width="232" height="192" rx="6"/>')
    notes = ["OPEN · DB OWNERS", "users or auth_users:", "which login table stays?", "prices + CO₂ factors:",
             "NUMERIC, not INTEGER", "status values as CHECK", "demand table missing"]
    for i, t in enumerate(notes):
        cls = "lbl bad" if i == 0 else "q"
        b.append(f'<text class="{cls}" x="48" y="{556 + 24 * i}">{e(t)}</text>')
    return svg("database", W, H, "KreiswertS database: 5 platform tables + login tables",
               "Entity diagram: sites are referenced by users, offers (seller) and agreements (buyer); offers reference materials; "
               "agreements reference offers; Better Auth keeps its own auth_users, auth_sessions and auth_accounts tables.",
               "".join(b))


# ---------- Diagram 4: cooperation status ----------------------------------

def status():
    W, H = 1120, 408
    b = []
    xs = [44, 260, 476, 692, 908]
    b.append(legend(344, W, [("c-open", "talking"), ("c-run", "deal running"), ("done", "done"),
                             ("stop", "stopped"), ("stopline", "abort path")]))
    for x in xs[:-1]:
        b.append(path(f"M {x + 168},164 H {x + 216}", "main", "ah-main"))
    b.append(path("M 128,136 V 80", "bad", "ah-bad"))
    b.append(path("M 344,136 V 80", "bad", "ah-bad"))
    b.append(path("M 176,192 V 216 Q 176,224 184,224 H 528 Q 536,224 536,216 V 192"))
    b.append(label(266, 232, "BOTH CONFIRM"))
    for x in (96, 600, 776):
        b.append(path(f"M {x},192 V 272", "bad", "ah-bad"))
    b.append(path("M 400,192 V 216 a 8,8 0 0,1 0,16 V 272", "bad", "ah-bad"))
    names = [("requested", "Buyer asks"), ("negotiation", "Price · quantity"), ("agreed", "Both confirmed"),
             ("in_progress", "Pickup · delivery"), ("completed", "Counts for impact")]
    for x, (n, s) in zip(xs, names):
        kind = "done" if n == "completed" else ("cc c-run" if n in ("agreed", "in_progress") else "cc c-open")
        b.append(state(x, 136, 168, n, s, kind, end=n == "completed"))
    b.append(state(44, 24, 384, "rejected", "Declined before agreement", "stop", end=True))
    b.append(state(44, 272, 816, "cancelled", "Stopped any time before completion", "stop", end=True))
    return svg("status", W, H, "Cooperation status flow",
               "A cooperation moves requested, negotiation, agreed, in_progress, completed; it can be rejected before agreement "
               "or cancelled any time before completion; only completed counts for impact.",
               "".join(b))


def state(x, y, w, name, sub, kind="", end=False):
    cx = x + w / 2
    inv = " inv" if kind in ("focal", "done") else ""
    out = [f'<rect class="mask" x="{x}" y="{y}" width="{w}" height="56" rx="6"/>',
           f'<rect class="node {kind}" x="{x}" y="{y}" width="{w}" height="56" rx="6"/>']
    if end:
        out.append(f'<rect class="endring{inv}" x="{x + 4}" y="{y + 4}" width="{w - 8}" height="48" rx="4"/>')
    out.append(f'<text class="sn{inv}" x="{cx}" y="{y + 25}" text-anchor="middle">{e(name)}</text>')
    out.append(f'<text class="q{inv}" x="{cx}" y="{y + 45}" text-anchor="middle">{e(sub)}</text>')
    return "".join(out)


# ---------- icons ------------------------------------------------------------

ICONS = {
    "layers": '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5" opacity=".0"/>',
    "route": '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h7a3 3 0 0 1 0 6H10a3 3 0 0 0 0 6h7"/>',
    "plug": '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/>',
    "list": '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    "db": '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
    "flow": '<rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="14" width="6" height="6" rx="1"/><path d="M9 7h4a2 2 0 0 1 2 2v5"/>',
    "tool": '<path d="M14.5 5.5a4 4 0 0 0 5 5L12 18a2.1 2.1 0 0 1-3-3l7.5-7.5Z"/><path d="m9 15-5 5"/>',
    "plus": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
    "grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m15 17.5 2 2 4-4"/>',
    "box": '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    "api": '<path d="M8 4H6a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-2"/>',
    "fn": '<path d="M10 20c2 0 2.5-2 3-5l1.5-8c.5-2.5 1.5-4 3.5-4M8 10h8"/>',
}


def icon(name):
    return (f'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" '
            f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>')


def h2(num, ic, text, ident):
    return f'<h2 id="{ident}">{icon(ic)}<span><span class="num">{num}</span>{e(text)}</span></h2>'


def code(src):
    return f'<pre><code>{e(src)}</code></pre>'


# ---------- page -------------------------------------------------------------

CSS = r"""
:root{--node:#3f5a1f;--node-t:#edf3e4;--fe:#0369a1;--fe-t:#e0f2fe;--app:#7e3fbf;--app-t:#f3eafc;--auth:#8a4f00;--auth-t:#fcefdc;--zod:#0f766e;--zod-t:#dcf3ef;--dal:#4338ca;--dal-t:#e9e8fc;--db:#a03d6e;--db-t:#f9e7f0;--open:#755f00;--open-t:#fbf4d2;--run:#15803d;--run-t:#dcfce7;--ok:#15803d;--ok-t:#dcfce7;--ok-solid:#15803d;--dal-solid:#4338ca;--canvas:#f6f6f3;--surface:#fff;--ink:#1c2030;--muted:#555c6c;--line:#e2e3e8;--line-strong:#c4c7d0;--brand:#1c2030;--on-brand:#fff;--on-brand-muted:#d9dcf7;--mint:#eceafd;--zone:#f8f8f6;--danger:#b42318;--danger-soft:#fdecea;--code:#f0f0ec;--accent-line:#4338ca;--wait:#755f00;color-scheme:light}
:root[data-theme=dark],:root.dark{--node:#b5d98a;--node-t:#1f2a14;--fe:#7dd3fc;--fe-t:#0c2a3a;--app:#c9a7f7;--app-t:#2a1f40;--auth:#f2bd6b;--auth-t:#352712;--zod:#5eead4;--zod-t:#0b2f2b;--dal:#a5b4fc;--dal-t:#232650;--db:#f5a3c8;--db-t:#38192a;--open:#ecd36a;--open-t:#332c0e;--run:#86efac;--run-t:#12301d;--ok:#86efac;--ok-t:#12301d;--ok-solid:#166534;--dal-solid:#4f46e5;--canvas:#0f1115;--surface:#171a21;--ink:#e8eaf0;--muted:#a3a9b7;--line:#2a2e38;--line-strong:#434957;--brand:#e8eaf0;--on-brand:#fff;--on-brand-muted:#dfe1ff;--mint:#232650;--zone:#1c1f27;--danger:#f5a3a3;--danger-soft:#3a1f22;--code:#21252e;--accent-line:#a5b4fc;--wait:#ecd36a;color-scheme:dark}
*{box-sizing:border-box}
html{scroll-padding-top:72px}
.topbar{position:sticky;top:0;z-index:10;background:var(--canvas);border-bottom:1px solid var(--line)}
.topbar .in{max-inline-size:1200px;margin-inline:auto;padding:10px 32px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.topbar .brand{font-weight:700;font-size:16px;margin-right:auto}
.seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:8px;overflow:hidden;background:var(--surface)}
.seg a,.seg button{font:600 14px/1 Inter,ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:transparent;border:0;padding:9px 14px;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-block-size:36px}
.seg>*+*{border-left:1px solid var(--line-strong)}
.seg a[aria-current=page],.seg button[aria-pressed=true]{background:var(--dal-solid);color:var(--on-brand)}
.seg a:hover:not([aria-current=page]),.seg button:hover:not([aria-pressed=true]){background:var(--zone)}
.seg a:focus-visible,.seg button:focus-visible{outline:2px solid var(--dal);outline-offset:-2px}
@media (max-width:560px){.topbar .in{padding:8px 16px;gap:8px}.topbar .brand{flex-basis:100%}}

html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-inline-size:1200px;margin-inline:auto;padding:48px 32px 64px}
header.hero{display:grid;gap:16px;margin-bottom:48px}
.eyebrow{font:600 13px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0}
h1{font-size:44px;line-height:1.1;margin:0;font-weight:700;letter-spacing:-.01em;text-wrap:balance}
.lead{font-size:19px;line-height:1.55;max-inline-size:68ch;margin:0;text-wrap:pretty}
h2{display:flex;align-items:center;gap:12px;font-size:28px;line-height:1.2;margin:0 0 8px;font-weight:700;text-wrap:balance}
h2 .num{font:600 15px/1 ui-monospace,"SF Mono",Menlo,monospace;color:var(--muted);margin-right:12px}
h3{font-size:20px;line-height:1.25;margin:0;font-weight:650;text-wrap:balance}
.ic{inline-size:28px;block-size:28px;flex:none;padding:6px;box-sizing:content-box;border-radius:8px;background:var(--mint);color:var(--ink)}
section{margin-top:64px}
section>p.intro{max-inline-size:68ch;margin:0 0 24px;text-wrap:pretty}
.stack{display:grid;grid-template-columns:1.15fr 1fr 1.25fr .95fr;gap:16px;margin-top:8px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:20px;min-width:0}
.card .k{font:600 13px/1.4 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
.card .v{font-size:17px;font-weight:600;margin:0;line-height:1.4}
.card .v span{display:block;font-weight:400;font-size:15px;color:var(--muted)}
figure{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.scroll{overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--line-strong) transparent;padding:16px}
.scroll::-webkit-scrollbar{height:6px;width:6px}.scroll::-webkit-scrollbar-track{background:transparent}
.scroll::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:3px}
.dg{display:block;width:100%;height:auto}
figcaption{border-top:1px solid var(--line);padding:14px 20px;font-size:15px;line-height:1.5}
.rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px}
.rules .card{display:flex;gap:12px;align-items:flex-start}
.rules .card p{margin:0}.rules .card p b{display:block;margin-bottom:4px}
.badge{flex:none;inline-size:28px;block-size:28px;border-radius:6px;display:grid;place-items:center;font:700 14px/1 ui-monospace,monospace;background:var(--mint);color:var(--ink)}
.badge.no{background:var(--danger-soft);color:var(--danger)}
.roles{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:16px;margin-top:16px;align-items:start}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding:0;list-style:none}
.chips li{font:13px/1.4 ui-monospace,"SF Mono",Menlo,monospace;padding:4px 10px;border-radius:4px;background:var(--mint);border:1px solid var(--line)}
.chips li.plus{background:var(--dal-solid);color:var(--on-brand);border-color:var(--dal-solid)}
.roles p{margin:8px 0 0}
.ways{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,.85fr);gap:16px;align-items:start}
.ways .card{display:grid;gap:12px}
.ways .card p{margin:0}
.ways .card.no{border-color:var(--danger);background:var(--danger-soft)}
.mini{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:13px/1.4 ui-monospace,"SF Mono",Menlo,monospace}
.mini b{font-weight:400;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}.mini span{padding:3px 8px;border:1px solid var(--line-strong);border-radius:4px;background:var(--surface)}
.mini i{font-style:normal;color:var(--muted)}
pre{margin:0;background:var(--code);border-radius:6px;padding:12px 14px;overflow-x:auto;font:13.5px/1.55 ui-monospace,"SF Mono",Menlo,Consolas,monospace;
scrollbar-width:thin;scrollbar-color:var(--line-strong) transparent}
pre::-webkit-scrollbar{height:6px}pre::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:3px}
code{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:.92em}
p code,td code,li code,figcaption code{display:inline-block;max-inline-size:100%;background:var(--code);padding:0 5px;border-radius:4px;overflow-wrap:anywhere;line-height:1.45;vertical-align:baseline}
.tw{background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--line-strong) transparent}
.tw::-webkit-scrollbar{height:6px}.tw::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:3px}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:15px;line-height:1.45}
th,td{text-align:left;padding:10px 16px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:600 13px/1.4 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--zone)}
tr:last-child td{border-bottom:0}
td.m{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:14px;white-space:nowrap}
.verb{display:inline-block;min-width:44px;font:700 12px/1.6 ui-monospace,monospace;padding:0 6px;border-radius:3px;background:var(--mint);text-align:center}
.st{white-space:nowrap;font-weight:600}
.st.ok{color:var(--ok)}.st.wait{color:var(--wait)}
.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:start}
.two h3{margin-bottom:12px}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;counter-reset:s}
.steps li{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:20px;counter-increment:s;display:grid;gap:8px;align-content:start}
.steps li::before{content:counter(s);font:700 15px/1 ui-monospace,monospace;inline-size:30px;block-size:30px;border-radius:6px;display:grid;place-items:center;background:var(--ink);color:var(--on-brand)}
.steps b{font-size:17px}
.steps p{margin:0;font-size:15px}
.cmds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}.card.os{margin-top:16px;display:grid;gap:12px}.card.os>p{margin:0;max-inline-size:80ch}.osgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}.osb{min-width:0;display:grid;gap:8px;align-content:start}.osh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0}.osh b{font-size:17px}.osh span{font-size:14px;color:var(--muted)}.ossteps{list-style:none;margin:0;padding:0;display:grid;gap:14px}.ossteps li{display:grid;grid-template-columns:24px minmax(0,1fr);column-gap:10px;row-gap:4px;align-items:start}.ossteps li>*:not(.n){grid-column:2}.ossteps .n{grid-row:1;inline-size:24px;block-size:24px;border-radius:5px;background:var(--ink);color:var(--canvas);display:grid;place-items:center;font:700 13px/1 ui-monospace,monospace}.ossteps b{font-size:15px;line-height:24px}.ossteps .note{margin:0;font-size:14px}.ossteps .box{background:var(--code);border-radius:6px;padding:8px 10px;display:grid;gap:6px}.ossteps .box code{display:block;background:none;padding:0 0 0 16px;text-indent:-16px;border-radius:0;font:13px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-inline-size:none}
.cmds .card{display:grid;gap:10px;align-content:start}
footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--line);font-size:15px}
footer p{margin:0;max-inline-size:80ch}
a{color:inherit;text-underline-offset:3px}
.c-fe{--c:var(--fe);--t:var(--fe-t)}.c-app{--c:var(--app);--t:var(--app-t)}.c-auth{--c:var(--auth);--t:var(--auth-t)}.c-zod{--c:var(--zod);--t:var(--zod-t)}.c-dal{--c:var(--dal);--t:var(--dal-t)}.c-db{--c:var(--db);--t:var(--db-t)}.c-open{--c:var(--open);--t:var(--open-t)}.c-run{--c:var(--run);--t:var(--run-t)}
.node.cc{fill:var(--t);stroke:var(--c);stroke-width:1.4}
.tag.cc{stroke:var(--c)}.tg.cc{fill:var(--c)}
.tbl.cc{stroke:var(--c);stroke-width:1.3}.th.cc{fill:var(--t)}
.sw{fill:var(--c)}
.node.stop{fill:var(--danger-soft);stroke:var(--danger);stroke-width:1.4}
.ar.auth{stroke:var(--auth)}.ar.db{stroke:var(--db)}
.mk.auth{fill:var(--auth)}.mk.db{fill:var(--db)}
.key{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0;padding:0;list-style:none}
.key li{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:6px;background:var(--t);border:1px solid var(--c);font-size:15px;line-height:1.3}
.key li i{flex:none;inline-size:14px;block-size:14px;border-radius:3px;background:var(--c)}
.key li b{font-weight:650}
.key li span{font:13px/1.3 ui-monospace,"SF Mono",Menlo,monospace}
.key li.err{--c:var(--danger);--t:var(--danger-soft)}
.keyhead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.chip{display:inline-block;padding:1px 8px;border-radius:4px;background:var(--t);border:1px solid var(--c);font:13.5px/1.5 ui-monospace,"SF Mono",Menlo,monospace;white-space:nowrap}
.dot{display:inline-block;inline-size:12px;block-size:12px;border-radius:3px;background:var(--c);margin-right:8px;vertical-align:-1px}
.mini span[class*="c-"]{background:var(--t);border-color:var(--c)}
.badge.ok{background:var(--ok-t);color:var(--ok)}.badge.zd{background:var(--zod-t);color:var(--zod)}
.st.ready{color:var(--dal)}.st.later{color:var(--muted)}

.c-rule{--c:var(--ink);--t:var(--zone)}.c-node{--c:var(--node);--t:var(--node-t)}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0;padding:0;list-style:none}
.toc a{display:inline-block;padding:4px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);text-decoration:none;font-size:15px}
.toc a:hover{background:var(--zone)}
.toc a:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,.8fr)) minmax(0,1.6fr);gap:16px;margin-bottom:16px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:16px 20px;display:grid;gap:4px;align-content:start}
.kpi b{font-size:32px;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi.ok b{color:var(--ok)}.kpi.c-open b{color:var(--open)}
.kpi span{font-size:15px}
.bar{block-size:8px;border-radius:4px;background:var(--line);overflow:hidden;inline-size:100%}
.bar i{display:block;block-size:100%;background:var(--ok)}
.bar.big{block-size:12px;margin-top:6px}
.stlegend{list-style:none;display:flex;flex-wrap:wrap;gap:8px 18px;padding:0;margin:0 0 12px;font-size:15px;align-items:center}
.stlegend li{display:flex;align-items:center;gap:8px}
.stlegend li i{font-style:normal;inline-size:28px;block-size:22px;display:grid;place-items:center;border-radius:4px;border:1px solid var(--line)}
.stlegend li.note{flex-basis:100%}
.s-done i,td.s-done{background:var(--ok-t)}
.s-part i,td.s-part{background:var(--open-t)}
.stlegend .s-later i{border-style:dashed}
td.s-na{color:var(--muted)}
table.fm{min-width:1040px}
table.fm td{font-size:14px}
table.fm td i{font-style:normal;margin-right:2px}
table.fm td:first-child{min-width:230px}
.fd{display:block;font-size:14px;color:var(--muted);margin-top:2px}
tr.grp td{background:var(--zone);font-weight:700;font-size:15px}
.gnum{display:inline-grid;place-items:center;inline-size:24px;block-size:24px;border-radius:5px;background:var(--ink);color:var(--canvas);font:700 13px/1 ui-monospace,monospace;margin-right:10px}
.due{margin-left:12px;font:600 12px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.pcell{display:flex;align-items:center;gap:8px;min-width:130px}
.pcell .bar{flex:1}
.pcell span{font-variant-numeric:tabular-nums;font-size:14px;min-width:44px;text-align:right}
.comps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.comp{background:var(--surface);border:1px solid var(--c);border-radius:8px;padding-bottom:20px;overflow:hidden;min-width:0}
.comp.wide{grid-column:1/-1}.comp.wide .fns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:32px}.comp.wide .fns>div{min-width:0}
.comp header{display:flex;align-items:center;gap:10px;padding:14px 20px;background:var(--t);border-bottom:1px solid var(--c);flex-wrap:wrap}
.comp header h3{margin:0}
.comp .sw{inline-size:14px;block-size:14px;border-radius:3px;background:var(--c);flex:none}
.comp .stn{margin-left:auto;font:600 12px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--c)}
.comp>p,.comp>ul,.comp>dl{margin-inline:20px}
.comp>p{margin-top:14px;margin-bottom:0}
.comp>p.lbl2{font:600 12px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:18px 20px 8px}
.files{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px;margin-block:0}
.files li{font:13px/1.5 ui-monospace,"SF Mono",Menlo,monospace;padding:1px 8px;border-radius:4px;background:var(--t);border:1px solid var(--c);overflow-wrap:anywhere}
.fns{margin-block:0}
.fns dt{font:600 13.5px/1.4 ui-monospace,"SF Mono",Menlo,monospace;overflow-wrap:anywhere}
.fns dt+dd{margin:2px 0 10px;font-size:15px}
.det{margin-block:0;padding-left:20px;font-size:15px}
.det li+li{margin-top:4px}
.conv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px;align-items:start}
.conv .card p{margin:0}.conv .card p+p{font-size:15px}
table.api{min-width:1100px}
table.api td{font-size:14px}
table.api td.m{white-space:nowrap}table.api td:nth-child(2){min-width:130px}
td.in{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:13px}
.ast{display:inline-flex;gap:6px;align-items:center;white-space:nowrap;padding:1px 8px;border-radius:4px;font-size:13.5px;font-weight:600;border:1px solid transparent}
.ast i,.stlegend li i{font-style:normal}
.a-live i,.ast.a-live{background:var(--ok-t);color:var(--ok)}
.a-planned i,.ast.a-planned{background:var(--open-t);color:var(--open)}
.a-proposed i,.ast.a-proposed{border:1px dashed var(--line-strong)}
@media (max-width:900px){.comps,.conv,.comp.wide .fns{grid-template-columns:minmax(0,1fr)}.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.kpi.wide{grid-column:1/-1}}
/* SVG roles */
.bg{fill:var(--surface)}
.zone{fill:var(--zone);stroke:var(--line);stroke-width:1}
.mask{fill:var(--surface)}
.node{fill:var(--surface);stroke:var(--ink);stroke-width:1.1}
.node.focal{fill:var(--dal-solid);stroke:var(--dal-solid)}.node.done{fill:var(--ok-solid);stroke:var(--ok-solid)}
.node.store{fill:var(--mint);stroke:var(--ink)}
.node.bad{fill:var(--danger-soft);stroke:var(--danger);stroke-dasharray:5 4}
.endring{fill:none;stroke:var(--line-strong);stroke-width:1}.endring.inv{stroke:var(--on-brand-muted);opacity:.6}
.tag{fill:none;stroke:var(--line-strong);stroke-width:1}.tag.inv{stroke:var(--on-brand-muted)}
text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.tg{font:600 11px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.06em;fill:var(--muted)}
.tg.inv{fill:var(--on-brand-muted)}
.nm{font-size:15px;font-weight:650;fill:var(--ink)}
.sub{font:12px ui-monospace,"SF Mono",Menlo,monospace;fill:var(--muted)}
.q{font-size:13px;fill:var(--ink)}
.nm.inv,.q.inv{fill:var(--on-brand)}.sub.inv{fill:var(--on-brand-muted)}
.sn{font:650 14px ui-monospace,"SF Mono",Menlo,monospace;fill:var(--ink)}.sn.inv{fill:var(--on-brand)}
.req{font:650 15px ui-monospace,"SF Mono",Menlo,monospace;fill:var(--ink)}
.zt{font-size:16px;font-weight:700;fill:var(--ink)}
.zs{font:12px ui-monospace,"SF Mono",Menlo,monospace;fill:var(--muted)}
.lbl{font:600 11px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.06em;fill:var(--muted)}
.lbl.bad{fill:var(--danger)}
.lm{fill:var(--surface)}.lm.z{fill:var(--zone)}
.lg{font-size:13px;fill:var(--ink)}
.rule{stroke:var(--line);stroke-width:1}
.ar{fill:none;stroke:var(--muted);stroke-width:1.4}
.ar.main{stroke:var(--accent-line);stroke-width:1.8}
.ar.dash{stroke-dasharray:5 4}
.ar.bad{stroke:var(--danger)}
.mk{fill:var(--muted)}.mk.main{fill:var(--accent-line)}.mk.bad{fill:var(--danger)}
.tbl{fill:var(--surface);stroke:var(--ink);stroke-width:1.1}
.th{fill:var(--mint)}.th.auth{fill:var(--zone)}
.tn{font:650 14px ui-monospace,"SF Mono",Menlo,monospace;fill:var(--ink)}
.tf{font:12.5px ui-monospace,"SF Mono",Menlo,monospace;fill:var(--ink)}
.rl{stroke:var(--line);stroke-width:1}
@media (max-width:900px){.stack,.rules,.ways,.two,.cmds,.roles,.osgrid{grid-template-columns:minmax(0,1fr)}.steps{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:36px}}
@media (max-width:560px){.wrap{padding:32px 16px 48px}.steps{grid-template-columns:minmax(0,1fr)}h1{font-size:30px}h2{font-size:24px}.lead{font-size:17px}th,td{padding:8px 12px}}
@media print{.scroll{overflow:visible}}
"""

MARKERS = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
           '<marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon class="mk" points="0 0, 8 3, 0 6"/></marker>'
           '<marker id="ah-main" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon class="mk main" points="0 0, 8 3, 0 6"/></marker>'
           '<marker id="ah-auth" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon class="mk auth" points="0 0, 8 3, 0 6"/></marker>'
           '<marker id="ah-db" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon class="mk db" points="0 0, 8 3, 0 6"/></marker>'
           '<marker id="ah-bad" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon class="mk bad" points="0 0, 8 3, 0 6"/></marker>'
           '</defs></svg>')


def rows(data, mono_first=True):
    return "".join("<tr>" + "".join(
        f'<td class="m">{c}</td>' if (i == 0 and mono_first) else f"<td>{c}</td>" for i, c in enumerate(r)) + "</tr>" for r in data)


# Sections: feature progress, components in detail, API by feature.

# ---------- feature progress ---------------------------------------------------

ST = {
    "done": ("✅", "done"), "part": ("◐", "partly"), "plan": ("⏳", "planned"),
    "later": ("○", "later"), "na": ("–", "not needed"),
}

FEATURE_GROUPS = [
    ("0", "Platform basics", "live", [
        ("Sign up, log in, log out", "Company account; log in with username or email",
         [("done", "auth_* tables"), ("done", "Better Auth + Zod rules"), ("done", "/api/auth/*"), ("done", "/login · /register")]),
        ("Account page", "See your own session, sign out",
         [("done", "auth_sessions"), ("done", "getViewer()"), ("done", "get-session · sign-out"), ("part", "/account is a test page")]),
        ("Guest vs member", "Price + contact only for members",
         [("na", ""), ("done", "offerView()"), ("done", "role in /api/offers"), ("plan", "on /offers")]),
        ("Start page figures", "Businesses + offers on the start page",
         [("done", "sites · offers"), ("done", "getPlatformStats()"), ("na", "server component"), ("part", "countries + map are MOCK")]),
        ("German / English", "Language switch, all texts in both languages",
         [("na", ""), ("done", "getLocale()"), ("na", ""), ("done", "switch in header")]),
        ("Health check", "Is the server + database up?",
         [("na", ""), ("na", ""), ("done", "/api/health"), ("na", "")]),
    ]),
    ("1", "Map + search", "due 10 Jan 2027", [
        ("Offer list + filter", "Filter by material and city",
         [("done", "offers · materials · sites"), ("done", "listOffers()"), ("done", "GET /api/offers"), ("plan", "/offers")]),
        ("Material dropdown", "List of materials for the filters",
         [("done", "materials"), ("plan", "list function"), ("plan", "GET /api/materials"), ("plan", "filter UI")]),
        ("Distance search + map", "Offers within X km of a business",
         [("done", "latitude · longitude"), ("plan", "Haversine in SQL"), ("plan", "?near=&maxDistanceKm="), ("plan", "/map")]),
        ("Saved searches + alerts", "“PE film within 10 km” → notification",
         [("plan", "alerts · notifications"), ("plan", "match on new offer"), ("plan", "/api/alerts · /api/notifications"), ("plan", "/notifications")]),
    ]),
    ("2", "Offer + demand", "due 10 Jan 2027", [
        ("Offer detail", "One offer with all fields the role may see",
         [("done", "offers"), ("plan", "detail function"), ("plan", "GET /api/offers/[id]"), ("plan", "/offers/[id]")]),
        ("Create an offer", "Seller is always the member’s own business",
         [("done", "offers"), ("plan", "create function"), ("plan", "POST /api/offers"), ("plan", "/offers/new")]),
        ("Demand (requests)", "What a business is looking for",
         [("plan", "model open: own table?"), ("plan", ""), ("plan", "/api/requests"), ("plan", "/requests")]),
        ("Match reasons", "“Material fits · 7 km · quantity ok”",
         [("na", ""), ("plan", "matchReasons()"), ("plan", "reasons in responses"), ("plan", "reason badges")]),
    ]),
    ("3", "Cooperation", "due 10 Jan 2027", [
        ("Request → complete a match", "Buyer and seller agree step by step",
         [("part", "agreements · status values open"), ("part", "flow ✅ · rights check ⏳"), ("plan", "/api/cooperations"), ("plan", "/cooperations")]),
        ("History + pickup details", "Timeline, counter-offers, pickup date, quality",
         [("plan", "agreement_events · pickup_date"), ("plan", ""), ("plan", "…/[id]/events"), ("plan", "timeline")]),
    ]),
    ("4", "Material tracking", "only prepare", [
        ("Container tracking", "collected → sorting → … → reused",
         [("later", "containers · container_events"), ("later", "flow in status.ts"), ("later", ""), ("later", "")]),
    ]),
    ("5", "Network overview", "due 10 Jan 2027", [
        ("Network overview", "Active offers + demand, unmatched, most wanted",
         [("part", "needs demand table"), ("plan", "queries only"), ("plan", "GET /api/network"), ("plan", "/network")]),
    ]),
    ("6", "Impact", "due 10 Jan 2027", [
        ("Impact report", "Reused kg, avoided disposal, CO₂ (only completed)",
         [("part", "CO₂ factors → NUMERIC"), ("plan", "sums over completed"), ("plan", "GET /api/impact"), ("plan", "/impact")]),
    ]),
]


def progress(cells):
    vals = [1 if s == "done" else 0.5 if s == "part" else 0 for s, _ in cells if s != "na"]
    return round(100 * sum(vals) / len(vals)) if vals else 100


def feature_section():
    rows_all = [f for _, _, _, fs in FEATURE_GROUPS for f in fs]
    pr = [progress(c) for _, _, c in rows_all]
    live = sum(p == 100 for p in pr)
    wip = sum(0 < p < 100 for p in pr)
    todo = sum(p == 0 for p in pr)
    overall = round(sum(pr) / len(pr))
    out = ['<div class="kpis">',
           f'<div class="kpi ok"><b>{live}</b><span>features live</span></div>',
           f'<div class="kpi c-open"><b>{wip}</b><span>in progress</span></div>',
           f'<div class="kpi"><b>{todo}</b><span>not started</span></div>',
           f'<div class="kpi wide"><b>{overall}&nbsp;%</b><span>overall progress</span>'
           f'<div class="bar big" role="img" aria-label="{overall} percent"><i style="width:{overall}%"></i></div></div>',
           '</div>']
    out.append('<ul class="stlegend">' + "".join(
        f'<li class="s-{k}"><i>{ic}</i>{t}</li>' for k, (ic, t) in ST.items()) +
        '<li class="note">Progress = share of the needed layers that are done (partly = half).</li></ul>')
    out.append('<div class="tw"><table class="fm"><thead><tr><th>Feature</th><th><i class="dot c-db"></i>Data</th>'
               '<th><i class="dot c-dal"></i>Server logic</th><th><i class="dot c-app"></i>API</th>'
               '<th><i class="dot c-fe"></i>Page</th><th>Progress</th></tr></thead><tbody>')
    for num, name, due, feats in FEATURE_GROUPS:
        out.append(f'<tr class="grp"><td colspan="6"><span class="gnum">{num}</span>{e(name)}<span class="due">{e(due)}</span></td></tr>')
        for fname, fdesc, cells in feats:
            p = progress(cells)
            tds = "".join(
                f'<td class="s-{s}"><i aria-label="{ST[s][1]}">{ST[s][0]}</i>{(" " + e(t)) if t else ""}</td>'
                for s, t in cells)
            out.append(f'<tr><td><b>{e(fname)}</b><span class="fd">{e(fdesc)}</span></td>{tds}'
                       f'<td><div class="pcell"><div class="bar" role="img" aria-label="{p} percent"><i style="width:{p}%"></i></div>'
                       f'<span>{p}&nbsp;%</span></div></td></tr>')
    out.append('</tbody></table></div>')
    return "".join(out)


# ---------- components in detail --------------------------------------------------

COMPONENTS = [
    ("c-fe", "Frontend", "pages · components · texts",
     "What users see. Pages are React Server Components rendered on the server; only interactive parts run in the browser (<code>\"use client\"</code>).",
     ["src/app/page.tsx", "src/app/login/", "src/app/register/", "src/app/account/", "src/components/", "src/i18n/"],
     [("/ · page.tsx", "Start page per Figma: hero, figures from <code>getPlatformStats()</code>, static map (MOCK)"),
      ("/login · LoginForm", "Username or email + password, “remember me”; errors via <code>authErrorText()</code>"),
      ("/register · RegisterForm", "Company, VAT ID, material interest, username, email, password twice, terms"),
      ("/account · SignOutButton", "Test page: shows the session and signs out – replace per Figma"),
      ("SiteHeader · LanguageSwitch", "Navigation, DE/EN switch, login or account link depending on the role"),
      ("messages.ts · getLocale()", "All texts in German and English; language from the <code>locale</code> cookie, default German")],
     ["Members who open /login or /register are sent to /account.",
      "Never imports <code>@/server/db</code> – data comes from DAL functions or <code>/api</code>."]),
    ("c-node", "Node.js", "runtime · runs the server",
     "The JavaScript runtime on the server. One Node.js process runs Next.js – pages, route handlers, Better Auth, Zod, the DAL and Drizzle with its database pool. The browser never runs this code.",
     ["package.json", ".nvmrc", ".env", "node_modules/"],
     [("npm run dev", "Development server with hot reload on <code>http://localhost:3000</code>"),
      ("npm run build · npm start", "Production build, then the production server"),
      ("npm run check", "TypeScript check + Vitest tests – must pass before every commit"),
      ("npm run db:* · auth:schema", "Database commands (drizzle-kit) and Better Auth schema generator"),
      (".env", "Read at start: <code>DATABASE_URL</code>, <code>BETTER_AUTH_SECRET</code>, <code>BETTER_AUTH_URL</code>")],
     ["Version: Node.js ≥ 20.9 (<code>.nvmrc</code>: 20); Node 24 works too.",
      "<code>pg</code> is loaded by Node at runtime, not bundled (<code>serverExternalPackages</code>).",
      "Modules marked <code>server-only</code> can only run here – never in the browser.",
      "Vitest stays on 4.x: version 5 breaks <code>npm install</code> with npm 10."]),
    ("c-app", "Next.js app", "station 1 · entry points",
     "One Next.js 16 project (App Router) serves pages and the API. Every URL is a folder in <code>src/app/</code>.",
     ["src/app/api/*/route.ts", "next.config.ts"],
     [("GET /api/offers", "route.ts: <code>getViewer</code> → Zod → <code>listOffers</code> → JSON <code>{ role, offers }</code>"),
      ("GET /api/health", "Runs <code>select 1</code> → <code>{ ok, db }</code>, or 503 when the database is down"),
      ("/api/auth/[...all]", "Hands every <code>/api/auth/*</code> call to Better Auth (<code>toNextJsHandler</code>)"),
      ("next.config.ts", "<code>pg</code> stays outside the bundle; old URLs /registrieren and /konto redirect (308)")],
     ["Route handlers stay thin: no SQL and no field filtering – that is the DAL’s job.",
      "Pages that read the session render per request (dynamic)."]),
    ("c-auth", "Better Auth", "station 2 · who is asking?",
     "Login library: creates accounts, checks passwords, sets the session cookie and keeps its data in its own <code>auth_*</code> tables.",
     ["src/server/auth.ts", "src/server/viewer.ts", "src/lib/auth-client.ts", "src/lib/auth-errors.ts"],
     [("auth", "Config: email + password, username plugin, Drizzle adapter, Next.js cookies"),
      ("getViewer(headers)", "Guest → <code>{ role: \"guest\" }</code><br>Member → <code>{ role: \"member\", userId, siteId }</code>"),
      ("authClient.*", "Browser: <code>signUp.email</code>, <code>signIn.email</code>, <code>signIn.username</code>, <code>signOut</code>"),
      ("authErrorText(error, locale)", "Error code → readable sentence in German or English")],
     ["Extra user fields: companyName, vatId, materialInterest (checked by Zod) and siteId (set by the backend only).",
      "Hook before sign-up and password change runs <code>registrationError()</code> → 400 with a code.",
      "Username 3–30 characters (a–z, 0–9, _ .); login attempts are rate-limited."]),
    ("c-zod", "Zod validation", "station 3 · is the input valid?",
     "Checks every input before it reaches the database. One schema gives both the check and the TypeScript type.",
     ["src/server/validation/offers.ts", "src/server/validation/registration.ts"],
     [("offerListQuery", "materialId positive integer · city 1–100 characters · limit 1–100 (default 50) · empty = ignored"),
      ("registrationError(body)", "First invalid field as an error code, otherwise <code>null</code>"),
      ("vatIdSchema", "EU VAT ID; spaces, dots, dashes are removed:<br><code>DE 294 681 207</code> → <code>DE294681207</code>"),
      ("passwordSchema", "8–128 characters with at least one digit and one capital letter")],
     ["Company name 2–200 characters; material interest is one of 8 fixed values.",
      "Codes: INVALID_COMPANY_NAME, INVALID_VAT_ID, INVALID_MATERIAL_INTEREST, PASSWORD_TOO_WEAK.",
      "The browser checks the same rules for quick feedback – the server check is the one that counts."]),
    ("c-dal", "Data Access Layer", "station 4 · what may they see?",
     "The only way to the data. Every function gets the viewer and returns exactly the fields that role may see.",
     ["src/server/dal/offers.ts", "src/server/dal/offer-view.ts", "src/server/dal/stats.ts"],
     [("listOffers(viewer, query)", "Joins offers + materials + sites, filters material and city (any case), newest first"),
      ("offerView(row, viewer)", "Guest: title, material, quantity, city · member: + price, description, contact"),
      ("getPlatformStats()", "Counts businesses and offers for the start page – totals only, safe for guests")],
     ["<code>import \"server-only\"</code>: using it in a client component fails the build.",
      "Pure parts like <code>offerView()</code> are tested without a database (Vitest).",
      "Next: who may change which status (buyer or seller) is checked here, not in the UI."]),
    ("c-rule", "Domain rules", "status flows",
     "Plain data and functions without a database: which statuses exist and which changes are allowed.",
     ["src/server/domain/status.ts"],
     [("COOPERATION_STATUSES", "requested, negotiation, agreed, in_progress, completed, rejected, cancelled"),
      ("cooperationFlow", "Allowed next statuses for every status; empty list = final status"),
      ("canTransition(flow, from, to)", "Is this change allowed?"),
      ("isFinal(flow, status)", "Is this a final status?")],
     ["Database, API, tests and UI use the same values.",
      "A new flow (e.g. container tracking) is a new table in the same format."]),
    ("c-db", "Drizzle ORM + PostgreSQL", "station 5 · safe SQL",
     "Drizzle builds typed, parameterised SQL – no SQL injection. PostgreSQL 17 stores the data.",
     ["src/server/db/client.ts", "src/server/db/schema.ts", "src/server/db/auth-schema.ts", "drizzle.config.ts"],
     [("db", "Drizzle client over a <code>pg</code> pool (max 10 connections, one pool per process)"),
      ("schema.ts", "sites, users, materials, offers, agreements – from the team’s ER diagram"),
      ("auth-schema.ts", "auth_users, auth_sessions, auth_accounts, auth_verifications – generated"),
      ("db:push · db:pull · db:studio", "Write schema to the DB · read a real DB · browse the data")],
     ["Without <code>DATABASE_URL</code> in <code>.env</code> the app stops with a clear message.",
      "Prices and CO₂ factors as NUMERIC are still to be agreed with the DB owners."]),
]


def components_section():
    out = ['<div class="comps">']
    for c, name, station, what, files, funcs, details in COMPONENTS:
        wide = " wide" if c == "c-fe" else ""
        out.append(f'<article class="comp {c}{wide}"><header><i class="sw"></i><h3>{e(name)}</h3><span class="stn">{e(station)}</span></header>'
                   f'<p>{what}</p>'
                   '<p class="lbl2">Files</p><ul class="files">' + "".join(f'<li>{e(f)}</li>' for f in files) + '</ul>'
                   '<p class="lbl2">Functions</p><dl class="fns">' + "".join(f'<div><dt>{e(sig)}</dt><dd>{d}</dd></div>' for sig, d in funcs) + '</dl>'
                   '<p class="lbl2">Good to know</p><ul class="det">' + "".join(f'<li>{d}</li>' for d in details) + '</ul></article>')
    out.append('</div>')
    return "".join(out)


# ---------- API by feature ------------------------------------------------------------

API_STATE = {"live": ("✅", "live"), "planned": ("⏳", "planned"), "proposed": ("◇", "proposal")}

API_GROUPS = [
    ("0", "Accounts + system", [
        ("POST", "/api/auth/sign-up/email", "c-auth", "everyone",
         "email, password, name, username, companyName, vatId, materialInterest",
         "user + session cookie · 400 with code (e.g. <code>INVALID_VAT_ID</code>) · 422 email exists", "live"),
        ("POST", "/api/auth/sign-in/email", "c-auth", "everyone", "email, password, rememberMe",
         "session cookie · too many tries → rate limit", "live"),
        ("POST", "/api/auth/sign-in/username", "c-auth", "everyone", "username, password, rememberMe", "session cookie", "live"),
        ("POST", "/api/auth/sign-out", "c-auth", "member", "–", "session deleted", "live"),
        ("GET", "/api/auth/get-session", "c-auth", "everyone", "cookie", "<code>{ session, user }</code> or <code>null</code>", "live"),
        ("GET", "/api/health", "c-db", "everyone", "–", "<code>{ ok: true, db: \"up\" }</code> · 503 when the DB is down", "live"),
    ]),
    ("1", "Map + search", [
        ("GET", "/api/offers", "c-dal", "guest · member", "query: materialId?, city?, limit? (1–100, default 50)",
         "<code>{ role, offers[] }</code> – guest: id, title, materialName, availableQuantityKg, city · member: + priceEurPerKg, "
         "description, contactName, contactEmail, contactPhone · 400 <code>{ error, details }</code>", "live"),
        ("GET", "/api/offers?near=&maxDistanceKm=", "c-dal", "guest · member", "near = siteId, maxDistanceKm",
         "same list + distance per offer", "planned"),
        ("GET", "/api/materials", "c-dal", "everyone", "–", "<code>[{ id, code, name, category }]</code> for the dropdown", "planned"),
        ("GET · POST · DELETE", "/api/alerts", "c-dal", "member (own business)", "material or category, radiusKm, minQuantityKg",
         "saved searches of your business", "planned"),
        ("GET", "/api/notifications", "c-dal", "member (own business)", "–", "notifications for matching new offers", "planned"),
    ]),
    ("2", "Offer + demand", [
        ("GET", "/api/offers/[id]", "c-dal", "guest · member", "id", "one offer, same role rules as the list", "planned"),
        ("POST", "/api/offers", "c-dal", "member (seller)", "title, materialId, availableQuantityKg, priceEurPerKg, availableFrom",
         "created offer · the seller is taken from the session, never from the browser", "planned"),
        ("GET · POST", "/api/requests", "c-dal", "member", "material, quantity, period, max. price",
         "demand of your business – data model still open", "planned"),
        ("–", "reasons[] in offer/request responses", "c-dal", "member", "–", "e.g. “Material fits · 7 km · quantity ok”", "proposed"),
    ]),
    ("3", "Cooperation", [
        ("POST", "/api/cooperations", "c-dal", "member (buyer)", "offerId, quantityKg", "new cooperation with status <code>requested</code>", "proposed"),
        ("GET", "/api/cooperations", "c-dal", "member", "status?", "your cooperations as buyer or seller", "proposed"),
        ("PATCH", "/api/cooperations/[id]", "c-dal", "buyer or seller", "status, quantity, price, note",
         "checked by <code>canTransition()</code> + who may do it · 409 if not allowed", "proposed"),
        ("GET", "/api/cooperations/[id]/events", "c-dal", "buyer or seller", "–", "timeline from <code>agreement_events</code>", "proposed"),
    ]),
    ("5", "Network overview", [
        ("GET", "/api/network", "c-dal", "everyone (totals)", "–", "active offers + demand, unmatched materials, most wanted", "proposed"),
    ]),
    ("6", "Impact", [
        ("GET", "/api/impact?year=", "c-dal", "everyone (totals)", "year", "reusedKg, avoidedDisposalKg, co2eKg – only completed", "proposed"),
    ]),
]


def api_section():
    n_live = sum(r[6] == "live" for _, _, rs in API_GROUPS for r in rs)
    n_plan = sum(r[6] == "planned" for _, _, rs in API_GROUPS for r in rs)
    n_prop = sum(r[6] == "proposed" for _, _, rs in API_GROUPS for r in rs)
    out = ['<div class="conv">'
           '<div class="card"><p class="k">Base</p><p>Same address as the app (<code>/api/…</code>), JSON in and out.</p></div>'
           '<div class="card"><p class="k">Login</p><p>The session cookie is sent automatically on the same site – no token handling.</p></div>'
           '<div class="card"><p class="k">Errors</p><p><code>400 { error, details }</code> from Zod · 503 database down · member-only → 401.</p></div>'
           '<div class="card"><p class="k">Roles</p><p>Every response says <code>role</code>; missing fields = not allowed for that role.</p></div>'
           '</div>']
    out.append('<ul class="stlegend">' + "".join(
        f'<li class="a-{k}"><i>{ic}</i>{t}</li>' for k, (ic, t) in API_STATE.items()) +
        f'<li class="note">{n_live} live · {n_plan} planned in docs/FEATURES.md or docs/FRONTEND.md · {n_prop} proposals from this page – agree on them first.</li></ul>')
    out.append('<div class="tw"><table class="api"><thead><tr><th>Endpoint</th><th>Who</th><th>Input</th><th>Returns</th><th>State</th></tr></thead><tbody>')
    for num, name, rows_ in API_GROUPS:
        out.append(f'<tr class="grp"><td colspan="5"><span class="gnum">{num}</span>{e(name)}</td></tr>')
        for meth, path_, c, who, inp, ret, st in rows_:
            ic, lab = API_STATE[st]
            out.append(f'<tr><td class="m"><span class="verb">{e(meth)}</span> <span class="chip {c}">{e(path_)}</span></td>'
                       f'<td>{e(who)}</td><td class="in">{e(inp)}</td><td>{ret}</td>'
                       f'<td><span class="ast a-{st}"><i>{ic}</i>{lab}</span></td></tr>')
    out.append('</tbody></table></div>')
    return "".join(out)



# ---------- set-up per operating system ----------------------------------------------

_DB = "PostgreSQL 17 + user + database"
_PKG = ("Packages", "", ["npm install"])
_ENV_NOTE = "Paste the printed secret into <code>BETTER_AUTH_SECRET</code> in <code>.env</code>."
_TABLES = ("Tables", "", ["npm run db:push"])
SETUP_OS = [
    ("macOS", "Terminal · Homebrew", [
        ("Tools", "Needs Homebrew (brew.sh).", ["brew install node git"]),
        (_DB, "", ["scripts/setup-postgres.sh"]),
        _PKG,
        ("Settings", _ENV_NOTE, ["cp .env.example .env", "openssl rand -base64 32"]),
        _TABLES]),
    ("Ubuntu / Linux", "Terminal · apt + sudo", [
        ("Tools", "Node via nvm – it reads <code>.nvmrc</code>; open a new terminal after installing nvm.",
         ["sudo apt install -y git curl",
          "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash",
          "nvm install"]),
        (_DB, "Asks for your sudo password.", ["scripts/setup-postgres.sh"]),
        _PKG,
        ("Settings", _ENV_NOTE, ["cp .env.example .env", "openssl rand -base64 32"]),
        _TABLES]),
    ("Windows", "PowerShell · winget", [
        ("Tools", "Then open a new PowerShell.", ["winget install OpenJS.NodeJS.LTS", "winget install Git.Git"]),
        (_DB, "Run PowerShell as administrator.",
         ["powershell -ExecutionPolicy Bypass -File scripts\\setup-postgres.ps1"]),
        _PKG,
        ("Settings", _ENV_NOTE,
         ["copy .env.example .env",
          "$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)"]),
        _TABLES]),
]


def os_block(name, sub, steps):
    items = []
    for n, (title, note, cmds) in enumerate(steps, 1):
        items.append(f'<li><span class="n">{n}</span><b>{e(title)}</b>'
                     + (f'<p class="note">{note}</p>' if note else "")
                     + '<div class="box">' + "".join(f'<code>{_esc(c)}</code>' for c in cmds) + '</div></li>')
    return (f'<div class="osb"><p class="osh"><b>{e(name)}</b><span>{e(sub)}</span></p>'
            f'<ol class="ossteps">{"".join(items)}</ol></div>')


def page():
    api_now = [
        ('<span class="verb">GET</span> <span class="chip c-db">/api/health</span>', "everyone", "<code>{ ok, db }</code> – is the server + database up?"),
        ('<span class="verb">GET</span> <span class="chip c-dal">/api/offers</span>', "guest · member",
         "<code>{ role, offers[] }</code> · filters <code>materialId</code>, <code>city</code>, <code>limit</code> (max 100) · fields depend on the role"),
        ('<span class="verb">POST</span> <span class="chip c-auth">/api/auth/sign-up/email</span>', "everyone",
         "Create account: company name, VAT ID, material interest, username, email, password"),
        ('<span class="verb">POST</span> <span class="chip c-auth">/api/auth/sign-in/email</span>', "everyone", "Log in with email + password → session cookie"),
        ('<span class="verb">POST</span> <span class="chip c-auth">/api/auth/sign-in/username</span>', "everyone", "Log in with username + password → session cookie"),
        ('<span class="verb">POST</span> <span class="chip c-auth">/api/auth/sign-out</span>', "member", "Log out, deletes the session"),
        ('<span class="verb">GET</span> <span class="chip c-auth">/api/auth/get-session</span>', "everyone", "Current session or <code>null</code>"),
    ]
    api_next = [
        ('<span class="verb">GET</span> <span class="chip c-dal">/api/materials</span>', "Material list for the filter dropdown"),
        ('<span class="verb">GET</span> <span class="chip c-dal">/api/offers/[id]</span> · <span class="verb">POST</span> <span class="chip c-dal">/api/offers</span>', "Offer detail · create an offer"),
        ('<span class="chip c-dal">/api/offers?near=&amp;maxDistanceKm=</span>', "Map + distance search (Haversine on latitude/longitude)"),
        ('<span class="chip c-dal">/api/alerts</span> · <span class="chip c-dal">/api/notifications</span>', "Saved searches → in-app notifications"),
        ('<span class="chip c-dal">/api/cooperations</span>', "Request, negotiate, confirm, complete a match"),
    ]
    fns = [
        ("getViewer(headers)", '<span class="chip c-auth">server/viewer.ts</span>', "<code>{ role: \"guest\" }</code> or <code>{ role: \"member\", userId, siteId }</code>", "pages, API routes"),
        ("getPlatformStats()", '<span class="chip c-dal">server/dal/stats.ts</span>', "<code>{ businesses, materials }</code> – counts for the start page", "start page"),
        ("listOffers(viewer, query)", '<span class="chip c-dal">server/dal/offers.ts</span>', "Offers filtered by material/city, newest first", "GET /api/offers"),
        ("offerView(row, viewer)", '<span class="chip c-dal">server/dal/offer-view.ts</span>', "Removes price + contact for guests", "listOffers"),
        ("offerListQuery", '<span class="chip c-zod">server/validation/offers.ts</span>', "Zod schema + TypeScript type for the offer filters", "GET /api/offers"),
        ("registrationError(body)", '<span class="chip c-zod">server/validation/registration.ts</span>', "First invalid sign-up field as error code, else <code>null</code>", "Better Auth hook"),
        ("canTransition(flow, from, to)", "server/domain/status.ts", "Is this status change allowed? (+ <code>isFinal()</code>)", "cooperations (next)"),
        ("authClient", '<span class="chip c-fe">lib/auth-client.ts</span>', "<code>signUp</code>, <code>signIn.email</code>, <code>signIn.username</code>, <code>signOut</code> in the browser", "login + register forms"),
        ("authErrorText(error, locale)", '<span class="chip c-fe">lib/auth-errors.ts</span>', "Login error as a readable sentence in German or English", "login + register forms"),
    ]
    tools = [
        ('<span class="c-node"><i class="dot"></i></span>Node.js ≥ 20.9 + npm', "Runs the server; npm installs packages and runs the scripts", "package.json, .nvmrc"),
        ('<span class="c-app"><i class="dot"></i></span>Next.js 16 (App Router)', "Pages and API in one project, server + client components", "src/app/"),
        ('<span class="c-fe"><i class="dot"></i></span>React 19 · Tailwind CSS v4', "User interface, design tokens from Figma", "src/components/, globals.css"),
        ('<span class="c-auth"><i class="dot"></i></span>Better Auth 1.7', "Sign-up, login (email or username), session cookie, rate limit", "server/auth.ts"),
        ('<span class="c-zod"><i class="dot"></i></span>Zod 4', "Checks every input; one schema = validation + TypeScript type", "server/validation/"),
        ('<span class="c-db"><i class="dot"></i></span>Drizzle ORM + drizzle-kit', "Typed, parameterised SQL; push / pull / migrate / studio", "server/db/, drizzle.config.ts"),
        ('<span class="c-db"><i class="dot"></i></span>PostgreSQL 17 + pg', "The database, one connection pool per process", "scripts/setup-postgres.*"),
        ('<span style="--c:var(--line-strong)"><i class="dot"></i></span>Vitest 4 · TypeScript 5.9', "Unit tests for pure functions · type check", "*.test.ts"),
    ]
    roadmap = [
        ("1", "Map + search, notifications", "⏳ planned", "wait", "alerts · notifications"),
        ("2", "Offer + demand, match reasons", "⏳ planned", "wait", "demand table (open)"),
        ("3", "Organise a cooperation", "◐ status flow ready", "ready", "agreement_events, pickup_date"),
        ("4", "Material tracking (containers)", "○ later", "later", "containers · container_events"),
        ("5", "Network overview", "⏳ planned", "wait", "nothing new – queries only"),
        ("6", "Impact (CO₂, reused kg)", "⏳ planned", "wait", "NUMERIC for CO₂ factors"),
    ]

    H = []
    H.append('<!doctype html><html lang="en"><head><meta charset="utf-8">'
             '<meta name="viewport" content="width=device-width,initial-scale=1">'
             '<title>KreiswertS · How the backend works</title>'
             '<script>try{if(localStorage.getItem("kw-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}</script>'
             f'<style>{CSS}</style></head><body>{MARKERS}'
             '<div class="topbar"><div class="in"><span class="brand">KreiswertS · Architecture</span>'
             '<nav class="seg" aria-label="Language"><a href="architecture.html" hreflang="en" lang="en" aria-current="page">EN</a>'
             '<a href="architecture.de.html" hreflang="de" lang="de">DE</a></nav>'
             '<div class="seg" role="group" aria-label="Colour theme">'
             '<button type="button" data-theme-set="light" aria-pressed="true"><span aria-hidden="true">☀</span>Light</button>'
             '<button type="button" data-theme-set="dark" aria-pressed="false"><span aria-hidden="true">☾</span>Dark</button>'
             '</div></div></div><main class="wrap">')
    H.append('<header class="hero"><p class="eyebrow">KreiswertS · backend architecture · as of 2026-11-25</p>'
             '<h1>How the backend works – and how to build on it</h1>'
             '<p class="lead">One Next.js project holds the pages and the API. Every request walks the same five stations on the server '
             'before it touches the database. This page shows the layers, the request path, the API, the server functions, '
             'the database and the tools – everything you need to add a page or a feature.</p>'
             '<div class="stack">'
             '<div class="card c-app"><p class="k"><i class="dot"></i>Language · framework</p><p class="v">TypeScript · Next.js 16<span>Node.js ≥ 20.9, App Router</span></p></div>'
             '<div class="card c-fe"><p class="k"><i class="dot"></i>Interface</p><p class="v">React 19 · Tailwind v4<span>DE/EN switch, Figma tokens</span></p></div>'
             '<div class="card c-dal"><p class="k"><i class="dot"></i>Backend · security</p><p class="v">Better Auth · Zod · DAL<span>Login, input checks, who sees what</span></p></div>'
             '<div class="card c-db"><p class="k"><i class="dot"></i>Data</p><p class="v">Drizzle ORM<span>PostgreSQL 17</span></p></div>'
             '</div>'
             '<div><p class="k eyebrow" style="margin-top:8px">Colour key – the same colour means the same part everywhere on this page</p>'
             '<ul class="key">'
             '<li class="c-fe"><i></i><b>Frontend</b><span>browser · components</span></li>'
             '<li class="c-app"><i></i><b>1 Next.js app</b><span>page.tsx · /api routes</span></li>'
             '<li class="c-auth"><i></i><b>2 Login</b><span>Better Auth</span></li>'
             '<li class="c-zod"><i></i><b>3 Validation</b><span>Zod</span></li>'
             '<li class="c-dal"><i></i><b>4 Access rules</b><span>Data Access Layer</span></li>'
             '<li class="c-db"><i></i><b>5 Data</b><span>Drizzle · PostgreSQL</span></li>'
             '<li class="err"><i></i><b>Error · never</b><span>400 · forbidden</span></li>'
             '</ul></div>'
             '<nav aria-label="Contents"><p class="k eyebrow" style="margin-top:8px">On this page</p><ul class="toc">'
             '<li><a href="#s1">Big picture</a></li><li><a href="#s2">Features + progress</a></li>'
             '<li><a href="#s3">Components</a></li><li><a href="#s4">Request path</a></li><li><a href="#s5">Data in pages</a></li>'
             '<li><a href="#s6">API</a></li><li><a href="#s7">Server functions</a></li><li><a href="#s8">Database</a></li>'
             '<li><a href="#s9">Cooperation status</a></li><li><a href="#s10">Tools</a></li><li><a href="#s11">New feature</a></li>'
             '</ul></nav></header>')

    # 1 overview
    H.append('<section aria-labelledby="s1">' + h2("01", "layers", "The big picture", "s1"))
    H.append('<p class="intro">Four layers, top to bottom. The browser only talks to the Next.js app; the app only reaches data '
             'through the server logic in <code>src/server/</code>.</p>')
    H.append(f'<figure><div class="scroll">{overview()}</div>'
             '<figcaption>Steps 2–5 are the same for pages and API routes. The solid indigo box is where the platform decides what a guest '
             'or a member may see.</figcaption></figure>')
    H.append('<div class="rules">'
             '<div class="card"><span class="badge no">✕</span><p><b>The browser never touches the database.</b> '
             'Data goes through <code>/api/*</code> or a DAL function.</p></div>'
             '<div class="card"><span class="badge ok">✓</span><p><b>The backend decides visibility.</b> If a field is missing in the '
             'response, that role may not see it – hiding it in the UI is no protection.</p></div>'
             '<div class="card"><span class="badge zd">✓</span><p><b>One schema, two jobs.</b> A Zod schema validates the input '
             'and gives the TypeScript type for frontend and backend.</p></div>'
             '</div></section>')

    # 2 features
    H.append('<section aria-labelledby="s2">' + h2("02", "grid", "Features and progress", "s2"))
    H.append('<p class="intro">Every feature of the platform and how far each layer is built. Source: <code>docs/FEATURES.md</code>, '
             '<code>docs/FRONTEND.md</code> and the code as of 2026-11-25.</p>')
    H.append(feature_section() + '</section>')

    # 3 components
    H.append('<section aria-labelledby="s3">' + h2("03", "box", "Components in detail", "s3"))
    H.append('<p class="intro">Each software part: what it does, where it lives, its functions and the rules it enforces. '
             'Colours match the colour key at the top.</p>')
    H.append(components_section() + '</section>')

    # 4 request
    H.append('<section aria-labelledby="s4">' + h2("04", "route", "One request, five stations", "s4"))
    H.append('<p class="intro">The reference example is <code>src/app/api/offers/route.ts</code> – all five stations in 15 lines. '
             'Every new endpoint follows the same order.</p>')
    H.append(f'<figure><div class="scroll">{request()}</div></figure>')
    H.append('<div class="roles">'
             '<div class="card"><h3>Guest · no cookie</h3><p>Sees what an offer is and where.</p>'
             '<ul class="chips"><li>title</li><li>materialName</li><li>availableQuantityKg</li><li>city</li></ul></div>'
             '<div class="card"><h3>Member · session cookie</h3><p>Sees everything a guest sees, plus price and contact.</p>'
             '<ul class="chips"><li>title</li><li>materialName</li><li>availableQuantityKg</li><li>city</li>'
             '<li class="plus">priceEurPerKg</li><li class="plus">description</li><li class="plus">contactName</li>'
             '<li class="plus">contactEmail</li><li class="plus">contactPhone</li></ul></div>'
             '</div></section>')

    # 3 ways
    H.append('<section aria-labelledby="s5">' + h2("05", "plug", "Getting data into a page", "s5"))
    H.append('<p class="intro">Rule of thumb: reading (lists, details) → server component. Interactive (form, map, live filter) → '
             'a small client component that calls the API.</p>')
    H.append('<div class="ways">'
             '<div class="card"><p class="k">A · Server component (default)</p>'
             '<div class="mini"><span class="c-app">page.tsx</span><b><i>→</i><span class="c-auth">getViewer()</span></b><b><i>→</i><span class="c-dal">DAL function</span></b><b><i>→</i><span class="c-db">DB</span></b></div>'
             '<p>Rendered on the server: no loading state, the login cookie is read automatically. Filters come from the URL.</p>'
             + code('// src/app/page.tsx\nconst [viewer, stats] = await Promise.all([\n  getViewer(await headers()),\n  getPlatformStats(),\n]);') +
             '</div>'
             '<div class="card"><p class="k">B · Client component</p>'
             '<div class="mini"><span class="c-fe">"use client"</span><b><i>→</i><span class="c-app">fetch /api/…</span></b><b><i>→</i><span class="c-app">route</span></b><b><i>→</i><span class="c-dal">DAL</span></b></div>'
             '<p>For interactive parts. Login and sign-up use <code>authClient</code>, which calls <code>/api/auth/*</code>.</p>'
             + code('"use client";\nconst res = await fetch(\n  "/api/offers?city=Moers");\nconst { role, offers } =\n  await res.json();') +
             '</div>'
             '<div class="card no"><p class="k">✕ Never</p>'
             '<p><b>Import <code>@/server/db/*</code> in a page or component.</b> It skips login, validation and the access rules.</p>'
             '<p>Server code inside a <code>"use client"</code> file fails the build – use <code>fetch</code> there.</p>'
             '</div></div></section>')

    # 6 API
    H.append('<section aria-labelledby="s6">' + h2("06", "api", "API by feature", "s6"))
    H.append('<p class="intro">All endpoints – live and coming – grouped by feature, with who may call them, what goes in and what comes back. '
             'Routes live in <code>src/app/api/</code>; login routes come from Better Auth through <code>/api/auth/[...all]</code>.</p>')
    H.append(api_section() + '</section>')

    H.append('<section aria-labelledby="s7">' + h2("07", "fn", "Server functions you can use", "s7"))
    H.append('<p class="intro">Import these with <code>@/server/…</code> or <code>@/lib/…</code>. Functions in <code>dal/</code> '
             'are the only way to the data.</p>')
    H.append('<div class="tw"><table><thead><tr><th>Function</th><th>File</th><th>Returns · does</th><th>Used by</th></tr></thead><tbody>'
             + "".join(f'<tr><td class="m">{a}</td><td class="m">{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d in fns)
             + '</tbody></table></div></section>')

    # 6 database
    H.append('<section aria-labelledby="s8">' + h2("08", "db", "The database", "s8"))
    H.append('<p class="intro">Five platform tables from the team’s ER diagram, plus the tables Better Auth needs for login. '
             'A business (<code>sites</code>) is the centre: it sells offers, buys through agreements and has a login.</p>')
    H.append(f'<figure><div class="scroll">{database()}</div>'
             '<figcaption><b>PK</b> primary key · <b>FK</b> foreign key, the arrow points to the table it references · '
             '<b>UQ</b> unique · dashed line = logical link without a foreign key yet. <code>auth-schema.ts</code> is generated by '
             'Better Auth (<code>npm run auth:schema</code>) – never edit it by hand.</figcaption></figure></section>')

    # 7 status
    H.append('<section aria-labelledby="s9">' + h2("09", "flow", "Cooperation status", "s9"))
    H.append('<p class="intro">Status values and allowed changes live once in <code>src/server/domain/status.ts</code>. '
             'Database, API, tests and UI all use the same values; <code>canTransition()</code> checks every change.</p>')
    H.append(f'<figure><div class="scroll">{status()}</div>'
             '<figcaption>Inner frame = final status. Overview and impact count only <code>completed</code>.</figcaption></figure></section>')

    # 8 tools
    H.append('<section aria-labelledby="s10">' + h2("10", "tool", "Tools and commands", "s10"))
    H.append('<div class="tw"><table><thead><tr><th>Tool</th><th>Job</th><th>Where</th></tr></thead><tbody>'
             + "".join(f'<tr><td><b>{a}</b></td><td>{b}</td><td class="m">{c}</td></tr>' for a, b, c in tools)
             + '</tbody></table></div>')
    H.append('<div class="card os"><h3>Set up once – pick your system</h3>'
             '<p>Steps 1–5 once per computer, in a terminal inside the project folder. Node.js ≥ 20.9 and PostgreSQL 17 are the only requirements.</p>'
             '<div class="osgrid">' + "".join(os_block(*o) for o in SETUP_OS) + '</div>'
             '<p class="oscheck"><b>Check:</b> <code>npm run dev</code>, then open <code>http://localhost:3000/api/health</code> → <code>{"ok":true,"db":"up"}</code>. '
             'Login only works on <code>http://localhost:3000</code> (Better Auth checks <code>BETTER_AUTH_URL</code>).</p></div>')
    H.append('<div class="cmds" style="margin-top:16px">'
             '<div class="card"><h3>Every day</h3>' + code(
                 "npm run dev               # http://localhost:3000\n# health check:\n# /api/health → {\"ok\":true,\"db\":\"up\"}") + '</div>'
             '<div class="card"><h3>Database</h3>' + code(
                 "npm run db:studio         # browse the data\nnpm run db:pull           # read schema from a real DB\nnpm run db:generate       # SQL migration files\nnpm run db:migrate        # run them") + '</div>'
             '<div class="card"><h3>Before every commit</h3>' + code(
                 "npm run check             # TypeScript + Vitest\nnpm run build             # production build") + '</div>'
             '</div></section>')

    # 9 new feature
    H.append('<section aria-labelledby="s11">' + h2("11", "plus", "Adding a feature", "s11"))
    H.append('<ol class="steps">'
             '<li><b>Plan it</b><p>Row + short section in <code>docs/FEATURES.md</code>: what, data, logic, open points.</p></li>'
             '<li><b>Rules + data</b><p>Has a status flow → add it to <code>status.ts</code> with a test. Needs tables → ask the DB owners.</p></li>'
             '<li><b>Define the response type</b><p>Like <code>GuestOffer</code> / <code>MemberOffer</code>. The frontend can build with mock data of exactly that type.</p></li>'
             '<li><b>Build the five stations</b><div class="mini"><span class="c-app">Route</span><b><i>→</i><span class="c-auth">Auth</span></b><b><i>→</i><span class="c-zod">Zod</span></b><b><i>→</i><span class="c-dal">DAL</span></b><b><i>→</i><span class="c-db">Drizzle</span></b></div><p>Then add the endpoint to <code>docs/FRONTEND.md</code>.</p></li>'
             '</ol>')
    H.append('</section>')
    H.append('<footer><p>Sources: <code>README.md</code>, <code>docs/FRONTEND.md</code>, <code>docs/FEATURES.md</code> and the code in '
             '<code>src/</code> as of 2026-11-25. Prototype with demo data only. When the code changes, update this page.</p></footer>')
    H.append('</main><script>(function(){var r=document.documentElement,b=document.querySelectorAll("[data-theme-set]");'
             'function s(t){if(t==="dark")r.dataset.theme="dark";else delete r.dataset.theme;'
             'b.forEach(function(x){x.setAttribute("aria-pressed",String(x.dataset.themeSet===t))});'
             'try{localStorage.setItem("kw-theme",t)}catch(e){}}'
             'b.forEach(function(x){x.addEventListener("click",function(){s(x.dataset.themeSet)})});'
             's(r.dataset.theme==="dark"?"dark":"light");'
             'document.querySelectorAll(".seg a[hreflang]").forEach(function(a){a.addEventListener("click",function(){'
             'if(location.hash)a.href=a.getAttribute("href")+location.hash})})})();</script></body></html>')
    return "".join(H)


OUT.write_text(page(), encoding="utf-8")
print("wrote", OUT, OUT.stat().st_size, "bytes")
