#!/usr/bin/env python3
"""Generate docs/architecture.html (backend architecture explainer). Run via scripts/architecture/make.py."""
import sys
import json
import os
import re
from html import escape as _esc

# Language: KW_LANG=de + KW_DE=<de.json> translates SVG labels here (so tag/mask widths fit);
# HTML text is translated afterwards by translate.py.
LANG = os.environ.get("KW_LANG", "en")
DE = json.load(open(os.environ["KW_DE"], encoding="utf-8")) if LANG == "de" else {}


def tr(s):
    return DE.get(s, s) if LANG == "de" and isinstance(s, str) else s


def L(en, de):
    """Text with numbers: both languages here, so translate.py needs no entry per count."""
    return de if LANG == "de" else en


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
    b.append(node(664, 208, 432, 72, "API route handlers", "/api/offers · /api/requests · /api/matches · /api/my/* …", "API", c="c-app"))
    b.append(node(208, 376, 180, 72, "Better Auth", "auth.ts · viewer.ts", "2 · WHO?", c="c-auth"))
    b.append(node(444, 376, 180, 72, "Zod", "validation/*.ts", "3 · VALID?", c="c-zod"))
    b.append(node(680, 376, 180, 72, "Data Access Layer", "access.ts · dal/*.ts", "4 · MAY THEY?", "focal"))
    b.append(node(916, 376, 180, 72, "Domain rules", "domain/*.ts", "RULES"))
    b.append(node(680, 544, 180, 72, "Drizzle ORM", "db/schema.ts · pg", "5 · ORM", c="c-db"))
    b.append(node(916, 544, 180, 72, "PostgreSQL 17", f"{sum(len(ts) for _, _, ts in table_groups())} {tr('tables')}", "DB", c="c-db"))
    b.append(legend(664, W, [("main", "request path"), ("muted", "calls"), ("dash", "reads rules"),
                             ("authline", "login data"), ("focal", "decides what a role may do and see")]))
    return svg("overview", W, H, "KreiswertS backend: the big picture",
               "Layered overview: browser pages and interactive parts call Next.js pages and API routes, "
               "which pass every request through Better Auth, Zod and the Data Access Layer to Drizzle ORM and PostgreSQL.",
               "".join(b))


# ---------- Diagram 2: one request, five stations --------------------------

def request():
    W, H = 1120, 280
    b = []
    b.append('<text class="req" x="20" y="44">GET /api/offers?scope=radius&amp;radiusKm=25</text>')
    b.append('<text class="q" x="20" y="68">Example: the wider offer search on /offers</text>')
    # arrows
    for x1, x2 in ((108, 132), (280, 304), (452, 476), (624, 648), (796, 820), (968, 992)):
        b.append(path(f"M {x1},152 H {x2}", "main", "ah-main"))
    b.append(path("M 550,96 V 64", "bad", "ah-bad"))
    b.append(label_left(560, 72, "INVALID"))
    b.append(path("M 722,208 V 248 Q 722,256 714,256 H 72 Q 64,256 64,248 V 208", "main dash", "ah-main"))
    b.append(label(400, 228, "JSON · OFFERS + DISTANCE"))
    # nodes
    b.append(node(476, 12, 148, 52, "400 Bad Request", "which field failed", kind="bad"))
    b.append(node(20, 96, 88, 112, "Browser", "client", c="c-fe"))
    b.append(node(132, 96, 148, 112, "Route handler", "offers/route.ts", "STEP 1", q="Entry point", c="c-app"))
    b.append(node(304, 96, 148, 112, "Better Auth", "viewer.ts", "STEP 2", q="Who is asking?", c="c-auth"))
    b.append(node(476, 96, 148, 112, "Zod", "validation/", "STEP 3", q="Input valid?", c="c-zod"))
    b.append(node(648, 96, 148, 112, "Data Access", "dal/offers.ts", "STEP 4", "focal", q="Verified site?"))
    b.append(node(820, 96, 148, 112, "Drizzle ORM", "db/schema.ts", "STEP 5", q="Safe SQL", c="c-db"))
    b.append(node(992, 96, 112, 112, "PostgreSQL", "17", c="c-db"))
    return svg("request", W, H, "One request through the five stations",
               "GET /api/offers passes route handler, Better Auth, Zod, Data Access Layer and Drizzle ORM to PostgreSQL; "
               "invalid input returns 400, a site that is not verified gets 403, otherwise JSON with the offers and their distance.",
               "".join(b))


# ---------- Diagram 3: database --------------------------------------------

ROW, HEAD = 24, 32


def table(x, y, w, name, rows, auth=False):
    h = HEAD + ROW * len(rows)
    a = " cc c-auth" if auth else " cc c-db"
    # a bare table name is an identifier and stays English; "name · note" carries a translated note
    tn_attr, tn_text = ("", e(name)) if " " in name else (' translate="no"', _esc(name))
    out = [f'<rect class="mask" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>',
           f'<rect class="tbl{a}" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>',
           f'<path class="th{a}" d="M {x},{y + HEAD} V {y + 6} Q {x},{y} {x + 6},{y} H {x + w - 6} Q {x + w},{y} {x + w},{y + 6} V {y + HEAD} Z"/>',
           f'<text class="tn" x="{x + 12}" y="{y + 21}"{tn_attr}>{tn_text}</text>']
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
    W, H = 1120, 1528
    b = []
    b.append('<rect class="zone" x="16" y="16" width="792" height="784" rx="10"/>')
    b.append('<rect class="sw c-db" x="32" y="32" width="14" height="14" rx="3"/><text class="zt" x="54" y="44">Platform data</text><text class="zs" x="182" y="44">schema.ts · Level 1 (2026-11-26)</text>')
    b.append('<rect class="zone" x="824" y="16" width="288" height="784" rx="10"/>')
    b.append('<rect class="sw c-auth" x="840" y="32" width="14" height="14" rx="3"/><text class="zt" x="862" y="44">Login data</text><text class="zs" x="964" y="44">auth-schema.ts</text>')
    # relationships (behind tables; the arrow points to the referenced table)
    b.append(path("M 296,108 H 264", "db", "ah-db"))                                   # sites → companies
    b.append(path("M 528,132 H 560", "db", "ah-db"))                                   # sites → industrial_parks
    b.append(path("M 412,344 V 312", "db", "ah-db"))                                   # offers → sites
    b.append(label_left(422, 320, "OWNER", True))
    b.append(path("M 296,420 H 264", "db", "ah-db"))                                   # offers → material_categories
    b.append(path("M 560,420 H 528", "db", "ah-db"))                                   # enquiries → offers
    b.append(path("M 600,344 V 288 Q 600,280 592,280 H 528", "db", "ah-db"))           # enquiries → sites
    b.append(label_left(610, 316, "FROM · TO", True))
    b.append(path("M 148,624 V 496", "db", "ah-db"))                                   # attribute_definitions → material_categories
    b.append(path("M 412,624 V 592", "db", "ah-db"))                                   # offer_attribute_values → offers
    b.append(path("M 296,700 H 264", "db", "ah-db"))                                   # offer_attribute_values → attribute_definitions
    b.append(path("M 560,568 H 528", "db", "ah-db"))                                   # offer_delivery_options → offers
    b.append(path("M 840,252 H 528", "auth", "ah-auth"))                               # auth_users → sites
    b.append(label(684, 240, "1 ACCOUNT : 1 SITE", True))
    b.append(path("M 1072,436 H 1084 Q 1092,436 1092,428 V 116 Q 1092,108 1084,108 H 1072", "auth", "ah-auth"))
    b.append(path("M 1072,620 H 1096 Q 1104,620 1104,612 V 88 Q 1104,80 1096,80 H 1072", "auth", "ah-auth"))
    # tables
    b.append(table(32, 64, 232, "companies", [("id", "PK"), ("name", ""), ("vat_id", "UQ")]))
    b.append(table(296, 64, 232, "sites  · physical site", [("id", "PK"), ("company_id · park_id", "FK"), ("name · industry", ""),
                                                ("street_address · postal_code", ""), ("city · address_key", ""), ("latitude · longitude", ""),
                                                ("contact_name / email / phone", ""), ("verification_status", ""),
                                                ("capabilities · provenance", "")]))
    b.append(table(560, 64, 232, "industrial_parks", [("id", "PK"), ("slug", "UQ"), ("name · city", ""), ("latitude · longitude", ""),
                                                      ("radius_m · source_note", "")]))
    b.append(table(32, 344, 232, "material_categories", [("id", "PK"), ("key", "UQ"), ("name_en · name_de", ""), ("enabled", ""),
                                                         ("+ material_types · _forms", "")]))
    b.append(table(296, 344, 232, "offers", [("id", "PK"), ("site_id", "FK"), ("status · revision", ""), ("title · description", ""),
                                            ("category_id · type_id", "FK"), ("form_id · unit_key", "FK"),
                                            ("quantity · min_lot", ""), ("price_mode · price_amount", ""),
                                            ("expires_at · provenance", "")]))
    b.append(table(560, 344, 232, "enquiries", [("id", "PK"), ("offer_id", "FK"), ("from_site_id", "FK"), ("to_site_id", "FK"),
                                               ("topic · message", ""), ("response · responded_at", "")]))
    b.append(table(560, 552, 232, "offer_delivery_options", [("offer_id · term", "PK"), ("named_place", ""),
                                                            ("incoterms_version", ""), ("custom_note", "")]))
    b.append(table(32, 624, 232, "attribute_definitions", [("id", "PK"), ("category_id", "FK"), ("key · data_type · unit", ""),
                                                          ("min_value · max_value", ""), ("forms · critical", "")]))
    b.append(table(296, 624, 232, "offer_attribute_values", [("offer_id · attribute_id", "PK"), ("value_min · value_max", ""),
                                                            ("comparator", ""), ("value_text", "")]))
    b.append(table(840, 64, 232, "auth_users", [("id", "PK"), ("name", ""), ("email", "UQ"), ("username", "UQ"),
                                                ("role", ""), ("site_id", "UQ"), ("company_name", ""), ("vat_id", ""),
                                                ("material_interest", ""), ("created_at · updated_at", "")], True))
    b.append(table(840, 368, 232, "auth_sessions", [("id", "PK"), ("user_id", "FK"), ("token", "UQ"), ("expires_at", ""),
                                                   ("ip_address · user_agent", "")], True))
    b.append(table(840, 552, 232, "auth_accounts", [("id", "PK"), ("user_id", "FK"), ("provider_id", ""), ("account_id", ""),
                                                   ("password (hash)", "")], True))
    b.append('<text class="q" x="840" y="728">+ auth_verifications (tokens)</text>')
    # Level 2 requests (own band; foreign keys into the tables above are named in the rows)
    rt = tr("Material requests")
    b.append('<rect class="zone" x="16" y="816" width="1096" height="376" rx="10"/>')
    b.append(f'<rect class="sw c-db" x="32" y="832" width="14" height="14" rx="3"/><text class="zt" x="54" y="844">{e(rt)}</text>'
             f'<text class="zs" x="{round(54 + len(rt) * 9.5 + 16)}" y="844">schema.ts · Level 2, part 1 (2026-11-27)</text>')
    for y in (904, 1008, 1112):
        b.append(path(f"M 264,{y} H 296", "db", "ah-db"))                           # request_types / _forms / _revisions → requests
    b.append(path("M 560,904 H 528", "db", "ah-db"))                                   # request_responses → requests
    b.append(path("M 840,1000 H 816 Q 808,1000 808,1008 V 1080 Q 808,1088 800,1088 H 528", "db", "ah-db"))  # request_criteria → requests
    b.append(table(32, 864, 232, "request_types", [("request_id · type_id", "PK"), ("type_id → material_types", "")]))
    b.append(table(32, 968, 232, "request_forms", [("request_id · form_id", "PK"), ("form_id → material_forms", "")]))
    b.append(table(32, 1072, 232, "request_revisions", [("request_id · revision", "PK"), ("actor_user_id · action", ""), ("status · snapshot", "")]))
    b.append(table(296, 864, 232, "requests", [("id", "PK"), ("site_id", "FK"), ("status · revision", ""), ("title · description", ""),
                                              ("category_id · unit_key", "FK"), ("origins · quantity · min_lot", ""),
                                              ("needed_from · needed_until", ""), ("frequency · max_price_amount", ""),
                                              ("evidence_status · provenance", ""), ("closure_reason · expires_at", "")]))
    b.append(table(560, 864, 232, "request_responses", [("id", "PK"), ("request_id", "FK"), ("from_site_id", "FK"), ("to_site_id", "FK"),
                                                       ("offer_id · optional", "FK"), ("request_revision", ""), ("message · reply", "")]))
    b.append(table(840, 864, 232, "request_criteria", [("request_id", "PK"), ("attribute_id", "PK"), ("kind: required | preferred", ""),
                                                      ("value_min · value_max", ""), ("value_text", "")]))
    for i, t in enumerate(["MATCHES", "not stored – computed from", "the current request and offer", "on every call (matching.ts)"]):
        b.append(f'<text class="{"lbl" if i == 0 else "q"}" x="840" y="{1064 + 20 * i}">{e(t)}</text>')
    # Level 2 negotiations and exchanges (own band below the requests)
    nt = tr("Negotiations and exchanges")
    b.append('<rect class="zone" x="16" y="1208" width="1096" height="304" rx="10"/>')
    b.append(f'<rect class="sw c-db" x="32" y="1224" width="14" height="14" rx="3"/><text class="zt" x="54" y="1236">{e(nt)}</text>'
             f'<text class="zs" x="{round(54 + len(nt) * 9.5 + 16)}" y="1236">schema.ts · Level 2, part 2 (2026-11-27)</text>')
    b.append(path("M 264,1296 H 296", "db", "ah-db"))                                   # proposal_revisions → negotiations
    b.append(path("M 560,1296 H 528", "db", "ah-db"))                                   # exchanges → negotiations
    b.append(path("M 840,1296 H 792", "db", "ah-db"))                                   # exchange_events → exchanges
    b.append(path("M 676,1456 V 1488 Q 676,1496 668,1496 H 156 Q 148,1496 148,1488 V 1456", "db", "ah-db"))  # exchanges → accepted revision
    b.append(table(32, 1256, 232, "proposal_revisions", [("negotiation_id · revision", "PK"), ("proposed_by_site_id", "FK"),
                                                         ("quantity · unit_key", ""), ("payment_direction · price_amount", ""),
                                                         ("delivery_term · named_place", ""), ("freight_amount · freight_payer", ""),
                                                         ("valid_until · insert only", "")]))
    b.append(table(296, 1256, 232, "negotiations", [("id", "PK"), ("offer_id", "FK"), ("request_id · optional", "FK"),
                                                   ("offerer_site_id", "FK"), ("requester_site_id", "FK"), ("status · current_revision", ""),
                                                   ("accepted_revision · simulated", ""), ("decided_by_site_id", "FK")]))
    b.append(table(560, 1256, 232, "exchanges", [("id", "PK"), ("negotiation_id", "UQ"), ("accepted_revision", "FK"),
                                                ("status · revision", ""), ("planned_date · plan_note", ""),
                                                ("received_quantity · quality_result", ""), ("simulated", "")]))
    b.append(table(840, 1256, 232, "exchange_events", [("exchange_id · revision", "PK"), ("site_id", "FK"), ("action · status", ""), ("snapshot", "")]))
    for i, t in enumerate(["ONE OPEN NEGOTIATION", "per offer and requesting site", "(partial unique index)"]):
        b.append(f'<text class="{"lbl" if i == 0 else "q"}" x="840" y="{1408 + 20 * i}">{e(t)}</text>')
    more = ["FURTHER TABLES", "units · category_units", "offer_revisions (history)", "site_verification_events", "demo_cases (A–E, simulated)"]
    for i, t in enumerate(more):
        cls = "lbl" if i == 0 else "q"
        b.append(f'<text class="{cls}" x="560" y="{708 + 20 * i}">{e(t)}</text>')
    return svg("database", W, H, "KreiswertS database: main relationships",
               "Entity diagram: a company has sites, a site belongs to an industrial park and owns offers; offers reference the "
               "material catalogue and carry delivery options and attribute values; enquiries link an offer with the sending and the "
               "receiving site; each login in auth_users belongs to exactly one site. A material request of a site lists accepted types, "
               "forms and criteria, keeps its history and receives responses from other sites. A negotiation links an offer, the two "
               "sites and optionally a request; its proposal revisions are only inserted; an exchange points at the accepted revision "
               "and keeps its own history.",
               "".join(b))


# ---------- Diagram 3b: all tables at a glance --------------------------------
# Read from the schema files, so the counts follow the database. A table missing below stops the build:
# whoever adds a table names its group and kind here. KW_SCHEMA_DIR builds from another copy (e.g. HEAD).

SCHEMA_DIR = Path(os.environ.get("KW_SCHEMA_DIR", Path(__file__).resolve().parents[2] / "src/server/db"))

# group: (title, swatch, [(table, kind, purpose)]); kind: main | detail | link | history | ref | demo | login.
# Order = reading order, three per row; groups of equal size share a row so no zone stays half empty.
TABLE_GROUPS = [
    ("Companies and sites", "c-db", [
        ("companies", "main", "one company, several sites (VAT ID)"),
        ("sites", "main", "physical site – the centre of the data"),
        ("industrial_parks", "ref", "parks with centre and radius"),
        ("site_verification_events", "history", "who verified which site, and why"),
    ]),
    ("Negotiations and exchanges", "c-db", [
        ("negotiations", "main", "two sites negotiate one offer"),
        ("proposal_revisions", "history", "every proposal, insert only"),
        ("exchanges", "main", "planned, completed or cancelled"),
        ("exchange_events", "history", "every change of an exchange"),
    ]),
    ("Contracts and payments", "c-db", [
        ("contracts", "main", "immutable snapshot, two signatures"),
        ("contract_events", "history", "created, signed, voided"),
        ("payments", "main", "simulated payment of an exchange"),
        ("payment_events", "history", "every change with its source"),
    ]),
    ("Material catalogue", "c-db", [
        ("material_categories", "ref", "e.g. plastics, metals, wood"),
        ("material_types", "ref", "types within a category"),
        ("material_forms", "ref", "e.g. bales, granulate, sheets"),
        ("units", "ref", "units with conversion factor"),
        ("category_units", "link", "units allowed per category"),
        ("attribute_definitions", "ref", "technical attributes per category"),
    ]),
    ("Offers", "c-db", [
        ("offers", "main", "material offer of a site"),
        ("offer_delivery_options", "detail", "accepted delivery terms"),
        ("offer_attribute_values", "detail", "values of the technical attributes"),
        ("offer_revisions", "history", "one snapshot per saved state"),
        ("enquiries", "main", "private question about one offer"),
        ("demo_cases", "demo", "illustrative cases A–E"),
    ]),
    ("Material requests", "c-db", [
        ("requests", "main", "what a site needs"),
        ("request_types", "link", "accepted material types"),
        ("request_forms", "link", "accepted forms"),
        ("request_criteria", "detail", "required or preferred values"),
        ("request_revisions", "history", "one snapshot per saved state"),
        ("request_responses", "main", "a supplier answers a request"),
    ]),
    ("Assessments", "c-db", [
        ("assessments", "main", "private feasibility and CO₂e check"),
        ("impact_factors", "ref", "emission factors with version"),
        ("chain_consents", "main", "release for the combined benefit"),
    ]),
    ("Saved searches", "c-db", [
        ("saved_searches", "main", "filters a site wants to keep"),
        ("notifications", "main", "a new offer matches a search"),
    ]),
    ("Login (Better Auth)", "c-auth", [
        ("auth_users", "login", "one login, exactly one site"),
        ("auth_sessions", "login", "signed-in sessions"),
        ("auth_accounts", "login", "password hash per login"),
        ("auth_verifications", "login", "tokens for password reset"),
    ]),
]
KIND_TAG = {"detail": "DETAIL", "link": "LINK", "history": "HISTORY", "ref": "REFERENCE", "demo": "DEMO"}


def schema_tables():
    names = []
    for f in ("schema.ts", "auth-schema.ts"):
        names += re.findall(r'pgTable\(\s*"([a-z_0-9]+)"', (SCHEMA_DIR / f).read_text(encoding="utf-8"))
    known = {t for _, _, ts in TABLE_GROUPS for t, _, _ in ts}
    unknown = sorted(set(names) - known)
    if unknown:
        sys.exit(f"build.py: tables without a group in TABLE_GROUPS: {', '.join(unknown)}")
    return set(names)


def table_groups():
    """TABLE_GROUPS limited to the tables that exist in the schema (a group without tables is left out)."""
    have = schema_tables()
    return [(g, c, [t for t in ts if t[0] in have]) for g, c, ts in TABLE_GROUPS if any(t[0] in have for t in ts)]


def tables_overview():
    groups = table_groups()
    W, COLS, GAP, PAD = 1120, 3, 16, 16
    zw = (W - 2 * PAD - (COLS - 1) * GAP) / COLS
    RH, TOP = 44, 64
    b, y = [], PAD
    for r in range(0, len(groups), COLS):
        row = groups[r:r + COLS]
        zh = TOP + RH * max(len(ts) for _, _, ts in row) + 8
        for i, (title, c, ts) in enumerate(row):
            x = PAD + i * (zw + GAP)
            b.append(f'<rect class="zone" x="{x:.1f}" y="{y}" width="{zw:.1f}" height="{zh}" rx="10"/>')
            b.append(f'<rect class="sw {c}" x="{x + 16:.1f}" y="{y + 18}" width="14" height="14" rx="3"/>'
                     f'<text class="zt" x="{x + 38:.1f}" y="{y + 30}">{e(title)}</text>')
            b.append(f'<text class="zs" x="{x + 38:.1f}" y="{y + 50}">{len(ts)} {e("tables" if len(ts) > 1 else "table")}</text>')
            for j, (name, kind, purpose) in enumerate(ts):
                ry = y + TOP + RH * j
                b.append(f'<line class="rl" x1="{x + 16:.1f}" y1="{ry}" x2="{x + zw - 16:.1f}" y2="{ry}"/>')
                b.append(f'<text class="tn" x="{x + 16:.1f}" y="{ry + 19}" translate="no">{_esc(name)}</text>')
                b.append(f'<text class="q" x="{x + 16:.1f}" y="{ry + 37}">{e(purpose)}</text>')
                if kind in KIND_TAG:
                    t = tr(KIND_TAG[kind])
                    tw = round(len(t) * 6.9 + 12)
                    b.append(f'<rect class="tag" x="{x + zw - 16 - tw:.1f}" y="{ry + 6}" width="{tw}" height="18" rx="2"/>'
                             f'<text class="tg" x="{x + zw - 16 - tw / 2:.1f}" y="{ry + 19}" text-anchor="middle">{e(t)}</text>')
        y += zh + GAP
    total = sum(len(ts) for _, _, ts in groups)
    return svg("tables", W, y - GAP + PAD, f"{total} {tr('tables of the KreiswertS database by area')}",
               tr("Every table of the database, grouped by area, with its purpose; a tag marks history, link, detail, "
                  "reference and demo tables, untagged rows are main records."),
               "".join(b))


def kind_counts():
    n = {}
    for _, _, ts in table_groups():
        for _, kind, _ in ts:
            n[kind] = n.get(kind, 0) + 1
    return n


# ---------- Diagram 4: status flows ------------------------------------------

def status():
    W, H = 1120, 792
    b = []
    # four states of 160 px with 136 px between them: the transition labels fit into the gaps in both languages
    X = [44, 340, 636, 932]
    SW = 160
    mid = [x + SW / 2 for x in X]

    def heading(y, title, sub):
        # the sub-title starts after the title, whose width depends on the language
        t = tr(title)
        return f'<text class="zt" x="44" y="{y}">{e(t)}</text><text class="zs" x="{round(44 + len(t) * 9.5 + 16)}" y="{y}">{e(sub)}</text>'

    def step(i, y, text, kind="main", marker="ah-main"):
        return path(f"M {X[i] + SW},{y} H {X[i + 1]}", kind, marker) + label((X[i] + SW + X[i + 1]) / 2, y - 26, text)

    b.append(heading(36, "Offer", 'offers.status · "expired" is derived from expires_at'))
    b.append(step(0, 104, "PUBLISH"))
    b.append(step(1, 104, "DATE PASSES", "dash", "ah"))
    b.append(step(2, 104, "CLOSE", "bad", "ah-bad"))
    b.append(path(f"M {mid[1]},76 V 60 Q {mid[1]},52 {mid[1] + 8},52 H {mid[3] - 8} Q {mid[3]},52 {mid[3]},60 V 76", "bad", "ah-bad"))
    b.append(label((mid[1] + mid[3]) / 2, 44, "CLOSE"))
    b.append(path(f"M {mid[2]},132 V 148 Q {mid[2]},156 {mid[2] - 8},156 H {mid[1] + 8} Q {mid[1]},156 {mid[1]},148 V 132", "main", "ah-main"))
    b.append(label((mid[1] + mid[2]) / 2, 164, "RENEW · VALIDATED AGAIN"))
    b.append(state(X[0], 76, SW, "draft", "May be incomplete", "cc c-open"))
    b.append(state(X[1], 76, SW, "active", "In search and map", "cc c-run"))
    b.append(state(X[2], 76, SW, "expired", "Can be renewed", "cc c-open"))
    b.append(state(X[3], 76, SW, "closed", "Kept under My offers", "stop", end=True))
    b.append(heading(236, "Site", "sites.verification_status · set by the administrator only"))
    b.append(step(0, 304, "VERIFY"))
    b.append(step(1, 304, "DECLINE", "bad", "ah-bad"))
    b.append(path(f"M {mid[0]},332 V 348 Q {mid[0]},356 {mid[0] + 8},356 H {mid[2] - 8} Q {mid[2]},356 {mid[2]},348 V 332", "bad", "ah-bad"))
    b.append(label((mid[0] + mid[2]) / 2, 364, "DECLINE · WITH A NOTE"))
    b.append(state(X[0], 276, SW, "pending", "Profile + drafts only", "cc c-open"))
    b.append(state(X[1], 276, SW, "verified", "Full access", "done"))
    b.append(state(X[2], 276, SW, "declined", "Read only", "stop"))
    b.append('<text class="q" x="868" y="296">A decision can be revised;</text><text class="q" x="868" y="316">every change is a row in</text><text class="q" x="868" y="336">site_verification_events.</text>')
    b.append(heading(436, "Negotiation", "negotiations.status · revisions are only inserted"))
    b.append(step(0, 504, "ACCEPT"))
    b.append(path(f"M {mid[0]},476 V 460 Q {mid[0]},452 {mid[0] + 8},452 H {mid[2] - 8} Q {mid[2]},452 {mid[2]},460 V 476", "bad", "ah-bad"))
    b.append(label((mid[0] + mid[2]) / 2, 444, "DECLINE"))
    b.append(path(f"M {mid[0]},532 V 548 Q {mid[0]},556 {mid[0] + 8},556 H {mid[3] - 8} Q {mid[3]},556 {mid[3]},548 V 532", "bad", "ah-bad"))
    b.append(label((mid[0] + mid[3]) / 2, 564, "WITHDRAW"))
    b.append(state(X[0], 476, SW, "open", "Counter adds a revision", "cc c-run"))
    b.append(state(X[1], 476, SW, "agreed", "Terms locked", "done", end=True))
    b.append(state(X[2], 476, SW, "declined", "Versions kept", "stop", end=True))
    b.append(state(X[3], 476, SW, "withdrawn", "Versions kept", "stop", end=True))
    b.append(heading(636, "Exchange", "exchanges.status · only for an agreed negotiation"))
    b.append(step(0, 704, "RECORD RECEIPT"))
    b.append(path(f"M {mid[0]},732 V 748 Q {mid[0]},756 {mid[0] + 8},756 H {mid[2] - 8} Q {mid[2]},756 {mid[2]},748 V 732", "bad", "ah-bad"))
    b.append(label((mid[0] + mid[2]) / 2, 764, "CANCEL · WITH A REASON"))
    b.append(state(X[0], 676, SW, "planned", "Both sites can move it", "cc c-run"))
    b.append(state(X[1], 676, SW, "completed", "Quantity + quality", "done", end=True))
    b.append(state(X[2], 676, SW, "cancelled", "No delivery recorded", "stop", end=True))
    b.append('<text class="q" x="868" y="696">Simulated exchanges never</text><text class="q" x="868" y="716">count as verified outcomes</text><text class="q" x="868" y="736">(D13).</text>')
    return svg("status", W, H, "Offer lifecycle, site verification, negotiation and exchange",
               "An offer moves from draft to active and is closed by its owner; an active offer past its expiry date counts as "
               "expired and can be renewed or closed. A site is pending until the administrator verifies or declines it. "
               "A negotiation stays open while counterproposals add revisions and ends agreed, declined or withdrawn; an exchange "
               "of an agreed negotiation ends completed or cancelled.",
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
    "match": '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
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
.rules.four{grid-template-columns:repeat(4,minmax(0,1fr))}.rules .card p{margin:0}.rules .card p b{display:block;margin-bottom:4px}
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
.tkinds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:24px}
@media (max-width:900px){.tkinds{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:560px){.tkinds{grid-template-columns:minmax(0,1fr)}}
.tkinds .kpi p{margin:4px 0 0;font-size:15px;line-height:1.5;text-wrap:pretty}
.tfewer{margin-top:24px;display:grid;gap:8px}.tfewer p{margin:0;max-inline-size:68ch;text-wrap:pretty}
.tsub{margin:48px 0 8px}
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
@media (max-width:1100px){.rules.four{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:560px){.rules.four{grid-template-columns:minmax(0,1fr)}.wrap{padding:32px 16px 48px}.steps{grid-template-columns:minmax(0,1fr)}h1{font-size:30px}h2{font-size:24px}.lead{font-size:17px}th,td{padding:8px 12px}}
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
    ("0", "Accounts and sites", "Level 1 · live", [
        ("Register company → site → account", "Two steps; one account belongs to one physical site",
         [("done", "companies · sites · auth_users"), ("done", "registerSite()"), ("done", "POST /api/registration/site"), ("done", "/register · /register/site")]),
        ("Log in, log out, password recovery", "Username or email; reset link valid 30 minutes, usable once",
         [("done", "auth_* tables"), ("done", "Better Auth + hooks"), ("done", "/api/auth/*"), ("done", "/login · /forgot-password")]),
        ("Site verification", "New sites are pending until the administrator decides",
         [("done", "sites · site_verification_events"), ("done", "decideVerification()"), ("done", "/api/admin/sites"), ("done", "/admin/verification")]),
        ("Account settings", "Profile, contact, visibility, password",
         [("done", "sites"), ("done", "getMySite() · updateMySite()"), ("done", "GET · PUT /api/my/site"), ("done", "/account")]),
        ("German / English", "Language switch, all texts in both languages",
         [("na", ""), ("done", "getLocale()"), ("na", ""), ("done", "switch in the header")]),
    ]),
    ("1", "Offers", "Level 1 · live", [
        ("Create, edit, preview, publish", "Draft first; publishing needs a verified site and a complete offer",
         [("done", "offers · offer_delivery_options"), ("done", "offerProblems() · publishOffer()"), ("done", "/api/my/offers"), ("done", "/my-offers/new · …/preview")]),
        ("Technical attributes per material form", "Fields follow category → type → form; unknown stays unknown",
         [("done", "attribute_definitions · _values"), ("done", "applicableAttributes()"), ("done", "GET /api/catalogue"), ("done", "offer form")]),
        ("Lifecycle and history", "draft → active → closed; expiry after 30 days; stale edits rejected",
         [("done", "offers.revision · offer_revisions"), ("done", "effectiveOfferStatus()"), ("done", "…/publish · /renew · /close"), ("done", "/my-offers")]),
        ("Dashboard", "Own offers, drafts and enquiries at a glance",
         [("done", "offers · enquiries"), ("done", "listMyOffers()"), ("done", "GET /api/my/offers"), ("done", "/dashboard")]),
    ]),
    ("2", "Discovery and contact", "Level 1 · live", [
        ("Search: own park, then wider area", "Same filters; straight-line distance; unknown positions stay in the list",
         [("done", "sites · industrial_parks"), ("done", "searchOffers() · distanceKm()"), ("done", "GET /api/offers"), ("done", "/offers")]),
        ("Offer detail", "Delivery responsibilities, specifications, evidence, supplier",
         [("done", "offers + parts"), ("done", "getOffer() · offerDetail()"), ("done", "GET /api/offers/[id]"), ("done", "/offers/[id]")]),
        ("Contact supplier", "Enquiry with listing number; one answer; no stock change",
         [("done", "enquiries"), ("done", "createEnquiry()"), ("done", "POST …/enquiries"), ("done", "enquiry form")]),
        ("Company directory + site profile", "Verified sites, capabilities, active offers",
         [("done", "companies · sites"), ("done", "listSites() · getSiteProfile()"), ("done", "GET /api/sites"), ("done", "/companies · /sites/[id]")]),
        ("Industrial map", "Parks, sites and the offers of the same search",
         [("done", "coordinates"), ("done", "memberMap()"), ("done", "GET /api/map"), ("done", "/map")]),
        ("Deadline in the listing", "Function 41 · Collection deadline; labelled urgent from 7 days before; sort by deadline",
         [("done", "offers.collection_until"), ("done", "isUrgent() · offerCard()"), ("done", "GET /api/offers?sort=deadline"), ("done", "/offers · /map · offer form")]),
        ("Saved search + notice", "Function 19 · Save the filters of /offers; one notice per site when a matching offer is published; bell in the header",
         [("done", "saved_searches · notifications"), ("done", "matchesSavedSearch() · notifySavedSearches()"), ("done", "/api/my/saved-searches · /api/my/notifications"), ("done", "/notifications · bell")]),
    ]),
    ("3", "Public pages and administration", "Level 1 · live", [
        ("Public regional map", "Allow-listed projection: areas, named sites, simulated pathways",
         [("done", "demo_cases"), ("done", "publicMap()"), ("done", "GET /api/public/map"), ("done", "/regional-map")]),
        ("About, help, legal placeholders", "What the prototype is and is not",
         [("na", ""), ("na", ""), ("na", ""), ("done", "/about · /help")]),
        ("Guide", "Function 46 · Duties of both sides, by-product or waste, course of a cooperation, sources – no legal advice",
         [("na", ""), ("na", ""), ("na", ""), ("done", "/guide · footer link")]),
        ("Reference data", "Catalogue, units, parks; switch a category on or off",
         [("done", "material_* · units"), ("done", "getCatalogue()"), ("done", "/api/admin/categories/[id]"), ("done", "/admin/reference-data")]),
        ("Demo data A–E", "Eleven fictional companies with twelve sites and listings around the cases A–E, labelled everywhere",
         [("done", "provenance columns"), ("done", "scripts/seed.mjs"), ("na", ""), ("done", "labels on every view")]),
        ("Region data import/export", "Function 34 · Parks, catalogue, companies and sites as CSV; checked row by row, saved all or nothing",
         [("done", "industrial_parks · material_* · sites"), ("done", "scripts/data-csv.mjs"), ("na", ""), ("na", "script, guide docs/REPLICATION.md")]),
    ]),
    ("4", "Material requests and matching", "Level 2 · part 1 · live", [
        ("Publish a material request", "L2-001 · Accepted types and forms, origin, quantity, timing, criteria, price ceiling – no offer needed",
         [("done", "requests · request_types · _forms · _criteria"), ("done", "requestProblems() · publishRequest()"), ("done", "/api/my/requests"), ("done", "/my-requests/new · /requests/[id]")]),
        ("Browse open requests", "L2-002 · Own park first, then a wider area with the same filters",
         [("done", "requests · sites"), ("done", "searchRequests() · getRequest()"), ("done", "GET /api/requests"), ("done", "/requests · /requests/[id]")]),
        ("Respond to a request", "L2-003 · One response per site, optionally with an own active offer; the requester replies once",
         [("done", "request_responses"), ("done", "createResponse() · replyToResponse()"), ("done", "…/responses · …/reply"), ("done", "/requests/[id] · /my-requests")]),
        ("Manage own requests", "L2-004 · Edit with history and stale-edit check; close as fulfilled or withdrawn; renew",
         [("done", "request_revisions"), ("done", "updateRequest() · closeRequest()"), ("done", "…/publish · /renew · /close"), ("done", "/my-requests")]),
        ("Explained matching", "L2-005 · Request against offer, criterion by criterion: four results, no score",
         [("na", "computed, not stored"), ("done", "evaluateMatch() · getMatch()"), ("done", "GET /api/matches"), ("done", "/matches · comparison page")]),
        ("Requests on the industrial map", "L2-002 · Open requests of the same area and material filters as square markers",
         [("done", "requests · sites"), ("done", "memberMap() · searchRequests()"), ("done", "GET /api/map"), ("done", "/map")]),
        ("Volume aggregation", "L2-010 · Compatible batches added up as a potential collection group – nothing reserved",
         [("na", "computed, not stored"), ("done", "aggregateOffers()"), ("done", "GET /api/map"), ("done", "/map · collection groups")]),
    ]),
    ("5", "Negotiations and exchanges", "Level 2 · part 2 · live", [
        ("Propose and counter", "L2-006 · Revisions are only added: quantity, price, delivery, freight, validity",
         [("done", "negotiations · proposal_revisions"), ("done", "startNegotiation() · counterPropose()"), ("done", "/api/my/negotiations"), ("done", "/negotiations · /negotiations/new")]),
        ("Accept, decline, withdraw", "D16 · Only the counterpart accepts the current revision; accepted terms are locked",
         [("done", "negotiations.status"), ("done", "acceptProposal() · endNegotiation()"), ("done", "…/accept · /decline · /withdraw"), ("done", "/negotiations/[id]")]),
        ("Exchanges", "L2-011 · Planned → completed or cancelled; the receiving site records quantity and quality",
         [("done", "exchanges · exchange_events"), ("done", "planExchange() · completeExchange()"), ("done", "/api/my/exchanges"), ("done", "/exchanges · /exchanges/[id]")]),
    ]),
    ("6", "Feasibility and impact", "Level 2 · part 3 · live", [
        ("Economic feasibility", "L2-007 · Delivered cost and net proceeds with shared freight, own costs, baseline, break-even",
         [("done", "assessments (private per site)"), ("done", "calculateFeasibility() · saveAssessment()"), ("done", "PUT /api/my/assessments"), ("done", "/matches/… · /negotiations/[id]")]),
        ("Environmental assessment", "L2-008 · Existing against proposed route; transport-only apart; no CO₂e claim without baseline or factor",
         [("done", "assessments · impact_factors"), ("done", "calculateEnvironment() · approveAssessment()"), ("done", "…/assessments/[id]/approve · /api/impact-factors"), ("done", "/matches/…")]),
        ("Circularity overview", "PG-27 · Realised exchanges apart from simulated ones; released assessments as estimates",
         [("na", "computed, not stored"), ("done", "getImpactOverview() · countsAsVerifiedOutcome()"), ("done", "GET /api/my/impact"), ("done", "/impact")]),
    ]),
    ("7", "Contract, payment, chain benefit", "Level 2 · part 4 · live", [
        ("Contract", "L2-012 · Frozen snapshot of the accepted revision with a SHA-256 fingerprint; both sites sign, execution derived",
         [("done", "contracts · contract_events"), ("done", "createContract() · signContract() · contractExecution()"), ("done", "…/contract · /api/my/contracts/[id]/sign · /void"), ("done", "/contracts/[id]")]),
        ("Simulated payment", "L2-013 · Amount from the signed terms; pending → authorised → captured / refunded; signed provider confirmation",
         [("done", "payments · payment_events"), ("done", "createPayment() · handleProviderEvent() · SimulatedProvider"), ("done", "…/payments · /api/my/payments/[id]/… · /api/payments/webhook"), ("done", "/exchanges/[id]")]),
        ("Sourced emission factors", "D18 · UBA, IPCC and Plastics Europe values with document link; the rest stay example values",
         [("done", "impact_factors.source_url"), ("done", "listFactors() · calculateEnvironment()"), ("done", "GET /api/impact-factors"), ("done", "/matches/…")]),
        ("Combined chain benefit", "L2-014 · Both contributions added up, only from comparisons both sites released",
         [("done", "chain_consents"), ("done", "getChainView() · setChainConsent() · combinedChainBenefit()"), ("done", "…/chain-consent · GET /api/my/impact"), ("done", "/negotiations/[id] · /impact")]),
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
     ["src/app/(platform)/", "src/app/about/ · regional-map/ · help/", "src/app/login/ · register/", "src/components/", "src/i18n/"],
     [("(platform)/layout.tsx · gate.tsx", "Frame of the company platform and the access decision per page: redirect, notice or page"),
      ("OfferForm · OfferLivePreview", "Create / edit an offer: sections, fields per material form, live preview"),
      ("OfferCard · OfferDetailView", "The same card and detail in search, map, profile, preview"),
      ("LiveMap · geo.ts", "Interactive map (MapLibre + OpenFreeMap tiles): zoom, full screen, popups; parks, radius and pathways as layers"),
      ("SearchFilters", "Plain GET form – the URL carries the whole search, so “wider area” keeps every filter"),
      ("messages.ts · platform.ts", "All texts in German and English; language from the <code>locale</code> cookie, default German")],
     ["Guests are sent to /login, accounts without a site to /register/site.",
      "Never imports <code>@/server/db</code> – data comes from DAL functions or <code>/api</code>."]),
    ("c-node", "Node.js", "runtime · runs the server",
     "The JavaScript runtime on the server. One Node.js process runs Next.js – pages, route handlers, Better Auth, Zod, the DAL and Drizzle with its database pool. The browser never runs this code.",
     ["package.json", ".nvmrc", ".env", "scripts/seed.mjs", "scripts/data-csv.mjs", "scripts/e2e-level1.mjs · e2e-level2.mjs · e2e-map.mjs"],
     [("npm run dev", "Development server with hot reload on <code>http://localhost:3000</code>"),
      ("npm run build · npm start", "Production build, then the production server"),
      ("npm run check", "TypeScript check + Vitest tests – must pass before every commit"),
      ("npm run db:push · db:seed", "Write the schema to the database · reference data and (with <code>--demo</code>) the fictional demo data"),
      ("npm run data:export · data:import", "Region data as CSV for spreadsheets – how another region sets up the platform: <code>docs/REPLICATION.md</code>"),
      ("node scripts/e2e-level1.mjs", "The four user scenarios and the negative tests against an own test instance"),
      ("node scripts/e2e-level2.mjs", "One acceptance and one negative test per Level 2 requirement L2-001 … L2-008 and L2-011, the circularity overview"),
      ("node scripts/e2e-map.mjs", "Requests on the map and volume aggregation (AT/NT-L2-010), public map pages")],
     ["Version: Node.js ≥ 20.9 (<code>.nvmrc</code>: 20); Node 24 works too.",
      "<code>pg</code> is loaded by Node at runtime, not bundled (<code>serverExternalPackages</code>).",
      "Modules marked <code>server-only</code> can only run here – never in the browser.",
      "Vitest stays on 4.x: version 5 breaks <code>npm install</code> with npm 10."]),
    ("c-app", "Next.js app", "station 1 · entry points",
     "One Next.js 16 project (App Router) serves pages and the API. Every URL is a folder in <code>src/app/</code>.",
     ["src/app/api/**/route.ts", "src/server/http.ts", "next.config.ts"],
     [("api(request, name, run)", "Frame of every route: origin check for writes, session, one error format with a request id"),
      ("readQuery · readJson · readId", "Validated query string, JSON body (size-limited) and numeric id"),
      ("GET /api/offers", "route.ts: <code>readQuery</code> → <code>searchOffers</code> → JSON"),
      ("/api/auth/[...all]", "Hands every <code>/api/auth/*</code> call to Better Auth (<code>toNextJsHandler</code>)")],
     ["Route handlers stay thin: no SQL and no field filtering – that is the DAL’s job.",
      "Writes need the app’s own <code>Origin</code> and a JSON body – a form on another website can send neither.",
      "Errors: 400 invalid · 401 not logged in · 403 not allowed · 404 unknown · 409 conflict · 422 rule broken."]),
    ("c-auth", "Better Auth", "station 2 · who is asking?",
     "Login library: creates accounts, checks passwords, sets the session cookie and keeps its data in its own <code>auth_*</code> tables.",
     ["src/server/auth.ts", "src/server/viewer.ts", "src/lib/auth-client.ts", "src/lib/auth-errors.ts"],
     [("auth", "Config: email + password, username plugin, password reset, Drizzle adapter, Next.js cookies"),
      ("getViewer(headers)", "Guest · member with the current state of the site · administrator"),
      ("authClient.*", "Browser: <code>signUp</code>, <code>signIn</code>, <code>signOut</code>, <code>requestPasswordReset</code>, <code>changePassword</code>"),
      ("authErrorText(error, locale)", "Error code → readable sentence in German or English")],
     ["<code>role</code> and <code>siteId</code> are set by the server only (<code>input: false</code>); an administrator exists only through the seed.",
      "Role and site status are read on every request – a verification takes effect immediately.",
      "Reset link: single use, 30 minutes, same answer for every address. Changing or resetting a password ends the other sessions.",
      "Login attempts are rate-limited (3 per 10&nbsp;s, shared)."]),
    ("c-zod", "Zod validation", "station 3 · is the input valid?",
     "Checks every input before it reaches the database. One schema gives both the check and the TypeScript type.",
     ["src/server/validation/common.ts", "src/server/validation/offers.ts", "src/server/validation/sites.ts", "src/server/validation/registration.ts", "src/server/validation/requests.ts"],
     [("offerInput · offerUpdate", "Body of an offer; a draft needs only a title. Fields the server sets are dropped"),
      ("offerSearchQuery", "Filters of list and map: scope, radius, type, form, origin, frequency, delivery, minimum quantity"),
      ("siteRegistration · siteProfile", "Site step of the registration · what a site may change itself"),
      ("requestInput · requestSearchQuery · responseInput", "Body of a request, the search over requests, a response with an optional own offer"),
      ("line() · paragraph()", "Text without control or invisible characters – two names never look alike while being different")],
     ["The offer form in the browser uses the same schemas – the server check is the one that counts.",
      "Unknown keys are dropped: a request cannot set owner, status, role or verification."]),
    ("c-dal", "Data Access Layer", "station 4 · may they?",
     "The only way to the data. Every function starts with the access rule and returns exactly the fields that viewer may see.",
     ["src/server/access.ts", "src/server/dal/offers.ts", "src/server/dal/offer-view.ts", "src/server/dal/sites.ts", "src/server/dal/enquiries.ts", "src/server/dal/map.ts", "src/server/dal/admin.ts", "src/server/dal/assessments.ts", "src/server/dal/requests.ts · request-view.ts", "src/server/dal/matches.ts"],
     [("requireSite · requireVerifiedSite · requireBrowse · requireAdmin", "Access rules as functions; a refusal becomes 401, 403 or 404"),
      ("searchOffers(viewer, query)", "Local park or radius with the same filters; only active offers of verified sites"),
      ("createOffer · updateOffer · publishOffer · closeOffer", "Owner from the session; ownership in every write; revision check"),
      ("offerCard() · offerDetail() · publicMap()", "Allow-lists: what a member sees, what the public sees"),
      ("createEnquiry · respondToEnquiry", "Private between two sites; limits counted under a lock"),
      ("createRequest · publishRequest · closeRequest", "Requests follow the offer lifecycle; closing names fulfilled or withdrawn"),
      ("createResponse · replyToResponse", "One response per site and request, one reply; only the two sites can read it"),
      ("listMatches · getMatch", "Matches of the own active listings, computed on every call, never stored"),
      ("saveAssessment · getImpactOverview", "Private assessments per site (feasibility, environment) · own circularity overview")],
     ["<code>import \"server-only\"</code>: using it in a client component fails the build.",
      "Another site’s offer or enquiry answers like a missing one (404).",
      "The street address of a site leaves the server only for its owner and the administrator."]),
    ("c-rule", "Domain rules", "pure functions",
     "Plain data and functions without a database: value lists, status flows and the rules of an offer. Used by server and browser alike.",
     ["src/server/domain/listing.ts", "src/server/domain/status.ts", "src/server/domain/publish.ts", "src/server/domain/attributes.ts", "src/server/domain/price.ts · delivery.ts · units.ts · geo.ts", "src/server/domain/request-rules.ts", "src/server/domain/matching.ts", "src/server/domain/negotiation.ts", "src/server/domain/feasibility.ts · environment.ts"],
     [("offerProblems(offer, catalogue, mode)", "What must be valid in a draft and complete before publishing"),
      ("applicableAttributes · attributeProblems", "Which technical fields apply to a form and whether the values are valid"),
      ("effectiveOfferStatus · offerFlow", "draft, active, expired (derived), closed"),
      ("RESPONSIBILITIES · payerOf · convertPrice", "Who loads, transports, unloads · who pays · €/t ↔ €/kg only within mass"),
      ("distanceKm(a, b)", "Straight line; unknown coordinates give unknown, never 0"),
      ("requestProblems(request, catalogue, mode)", "What must be valid in a request draft and complete before publishing"),
      ("evaluateMatch(request, offer, catalogue)", "Each criterion met, failed, unknown or processing → one of four results"),
      ("changedTerms · negotiationActions · countsAsVerifiedOutcome", "Terms a counterproposal changed · what each side may do now · which exchange is a verified outcome"),
      ("calculateFeasibility · calculateEnvironment", "Delivered cost, net proceeds, break-even · route comparison with reference displacement")],
     ["Database, API, tests and UI use the same values.",
      "Every rule has unit tests named after the test register (AT-L1-…, AT-L2-…, NT-…)."]),
    ("c-db", "Drizzle ORM + PostgreSQL", "station 5 · safe SQL",
     "Drizzle builds typed, parameterised SQL – no SQL injection. PostgreSQL 17 stores the data.",
     ["src/server/db/client.ts", "src/server/db/schema.ts", "src/server/db/auth-schema.ts", "drizzle.config.ts"],
     [("db", "Drizzle client over a <code>pg</code> pool (max 10 connections, one pool per process)"),
      ("schema.ts", "33 tables: companies, sites, parks, material catalogue, offers with parts and history, enquiries, requests with parts, history and responses, negotiations with revisions, exchanges with history, private assessments, emission factors, contracts and simulated payments with their audit trails, chain consents"),
      ("auth-schema.ts", "auth_users, auth_sessions, auth_accounts, auth_verifications"),
      ("db:push · db:seed · db:studio", "Write schema to the DB · seed reference and demo data · browse the data")],
     ["CHECK rules enforce the value lists, positive quantities and that a published offer is complete.",
      "The material catalogue is data: a new category needs rows, not a new table."]),
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
    ("0", "Accounts and sites", [
        ("POST", "/api/auth/sign-up/email", "c-auth", "everyone",
         "email, password, name, username, companyName, vatId, materialInterest",
         "user + session cookie · 400 with code (e.g. <code>INVALID_VAT_ID</code>) · <code>role</code> or <code>siteId</code> in the body are refused", "live"),
        ("POST", "/api/auth/sign-in/email · /username", "c-auth", "everyone", "email or username, password, rememberMe",
         "session cookie · too many tries → rate limit", "live"),
        ("POST", "/api/auth/request-password-reset", "c-auth", "everyone", "email, redirectTo",
         "always the same answer · the link is single-use and valid 30 minutes", "live"),
        ("POST", "/api/auth/reset-password · /change-password", "c-auth", "everyone · account", "token + newPassword · currentPassword + newPassword",
         "password changed, other sessions ended", "live"),
        ("POST", "/api/auth/sign-out", "c-auth", "account", "–", "session deleted", "live"),
        ("POST", "/api/registration/site", "c-dal", "account without a site", "industry, siteName, address, parkId?, contact, capabilities",
         "<code>{ siteId }</code> – site created as pending · 409 if the account already has one", "live"),
        ("GET · PUT", "/api/my/site", "c-dal", "own site", "profile: description, contact, capabilities, visibility",
         "own site with address and verification status · never changes status, address or company", "live"),
        ("GET", "/api/health", "c-db", "everyone", "–", "<code>{ ok: true, db: \"up\" }</code> · 503 when the DB is down", "live"),
    ]),
    ("1", "Offers of the own site", [
        ("GET · POST", "/api/my/offers", "c-dal", "own site (not declined)", "offer fields; only title is required",
         "list of own offers in every status · <code>{ id, revision }</code> of the new draft", "live"),
        ("GET · PUT · DELETE", "/api/my/offers/[id]", "c-dal", "owner", "offer fields + expectedRevision",
         "edit form data · 409 <code>STALE</code> with <code>currentRevision</code> · 422 with fields · delete only drafts", "live"),
        ("POST", "/api/my/offers/[id]/publish · /renew", "c-dal", "owner, verified site", "expectedRevision?",
         "<code>{ id, revision, expiresAt }</code> · 422 lists what is missing · 403 <code>NOT_VERIFIED</code>", "live"),
        ("POST", "/api/my/offers/[id]/close", "c-dal", "owner", "–", "<code>{ status: \"closed\" }</code> – safe to repeat", "live"),
        ("GET", "/api/my/enquiries", "c-dal", "own site", "–", "received and sent enquiries with the listing they belong to", "live"),
        ("POST", "/api/my/enquiries/[id]/response", "c-dal", "receiving site, verified", "response", "answered once · 409 if already answered", "live"),
    ]),
    ("2", "Discovery and contact", [
        ("GET", "/api/offers", "c-dal", "verified site · administrator",
         "scope (park | radius), radiusKm, parkId?, typeId?, formId?, origin?, frequency?, delivery?, minQuantityKg?, sort?, limit?",
         "<code>{ scope, park, offers[], total, withoutLocation, needsArea }</code> – each offer with <code>distanceKm</code> (null = unknown) and <code>urgent</code>", "live"),
        ("GET", "/api/offers/[id]", "c-dal", "verified site · owner", "id",
         "full detail · <code>{ unavailable: true }</code> once closed or expired · 404 for another site’s draft", "live"),
        ("POST", "/api/offers/[id]/enquiries", "c-dal", "verified site", "topic, message",
         "<code>{ id, ref }</code> · 409 own or unavailable offer · 429 above 5 per offer or 30 per day", "live"),
        ("GET", "/api/sites · /api/sites/[id]", "c-dal", "verified site · administrator", "q?, industry?, capability?, parkId?",
         "directory and profile – park and city, never the street; contact only if the site shows it", "live"),
        ("GET", "/api/map", "c-dal", "verified site · administrator", "same query as /api/offers",
         "parks, sites (position rounded to ~100 m) and the offers of that search", "live"),
        ("GET · POST", "/api/my/saved-searches", "c-dal", "own site · saving: verified site", "name, query (query string of /offers)",
         "the site’s saved searches · <code>{ id }</code> · 422 <code>TOO_MANY</code> above 20 per site", "live"),
        ("DELETE", "/api/my/saved-searches/[id]", "c-dal", "own site", "–", "<code>{ id }</code> – its notices go with it · 404 for another site’s search", "live"),
        ("GET", "/api/my/notifications", "c-dal", "own site", "–", "<code>{ unread, items[] }</code> – newest 50 with offer and matching search", "live"),
        ("POST", "/api/my/notifications/read", "c-dal", "own site", "ids? (none = all)", "<code>{ updated }</code> – ids of other sites change nothing", "live"),
        ("GET", "/api/catalogue", "c-dal", "everyone", "–", "categories, types, forms, units, attribute definitions, parks", "live"),
    ]),
    ("3", "Public and administration", [
        ("GET", "/api/public/map", "c-dal", "everyone", "none – parameters are ignored",
         "park areas, publicly named sites, categories of the region (from 3 listed sites on), simulated pathways", "live"),
        ("GET", "/api/admin/sites", "c-dal", "administrator", "status? (default pending), before?",
         "<code>{ sites[], counts, nextBefore }</code> with address, duplicate hint and history", "live"),
        ("POST", "/api/admin/sites/[id]/verification", "c-dal", "administrator", "status, note, latitude?, longitude?",
         "decision recorded with reviewer, time and history · declining needs a note", "live"),
        ("POST", "/api/admin/categories/[id]", "c-dal", "administrator", "enabled", "category switched on or off", "live"),
    ]),
    ("4", "Material requests and matching (Level 2)", [
        ("GET · POST", "/api/my/requests", "c-dal", "own site (not declined)", "request fields; only title is required",
         "own requests in every status · <code>{ id, revision }</code> of the new draft · 429 above 50 drafts", "live"),
        ("GET · PUT · DELETE", "/api/my/requests/[id]", "c-dal", "owner", "request fields + expectedRevision",
         "edit form data · 409 <code>STALE</code> with <code>currentRevision</code> · 422 with fields · delete only drafts", "live"),
        ("POST", "/api/my/requests/[id]/publish · /renew", "c-dal", "owner, verified site", "expectedRevision?",
         "<code>{ id, revision, expiresAt }</code> · 422 lists what is missing · 403 <code>NOT_VERIFIED</code>", "live"),
        ("POST", "/api/my/requests/[id]/close", "c-dal", "owner", "reason (fulfilled | withdrawn)",
         "<code>{ status: \"closed\" }</code> – closing records no exchange", "live"),
        ("GET", "/api/requests", "c-dal", "verified site · administrator", "scope (park | radius), radiusKm, typeId?, formId?, frequency?, sort?",
         "<code>{ scope, park, requests[], total, withoutLocation, needsArea }</code> – own requests left out", "live"),
        ("GET", "/api/requests/[id]", "c-dal", "verified site · administrator · owner", "id",
         "full request · only “no longer open” once closed or expired · 404 for another site’s draft", "live"),
        ("GET · POST", "/api/requests/[id]/responses", "c-dal", "verified site", "message, offerId?",
         "responses the viewer may read · once per site (409) · 422 <code>NOT_OWN_OFFER</code> · 429 above 30 per day", "live"),
        ("GET · POST", "/api/my/responses · /[id]/reply", "c-dal", "own site · requester", "reply",
         "received and sent responses, older request versions marked · one reply (409 if answered)", "live"),
        ("GET", "/api/matches", "c-dal", "verified site", "–",
         "per own active listing up to 20 candidates, best first; the rest and incompatible pairs only counted", "live"),
        ("GET", "/api/matches/[requestId]/[offerId]", "c-dal", "verified site, owner of one side", "requestId, offerId",
         "every criterion with its outcome, the result, preparation steps and possible processors", "live"),
    ]),
    ("5", "Negotiations and exchanges (Level 2)", [
        ("GET · POST", "/api/my/negotiations", "c-dal", "own site · verified site", "offerId, requestId?, terms, note?, validityDays",
         "incoming and outgoing negotiations · <code>{ id, ref }</code> · 409 <code>ALREADY_NEGOTIATING</code> · 429 above 20 per day", "live"),
        ("GET", "/api/my/negotiations/[id]", "c-dal", "the two sites", "id",
         "every revision with the terms it changed, the actions the viewer may take · 404 for anyone else", "live"),
        ("POST", "/api/my/negotiations/[id]/revisions", "c-dal", "counterpart (either site after expiry)", "expectedRevision, terms, note?, validityDays",
         "<code>{ id, revision }</code> · 409 <code>STALE</code> · <code>NOT_YOUR_TURN</code> · <code>NEGOTIATION_CLOSED</code>", "live"),
        ("POST", "/api/my/negotiations/[id]/accept · /decline · /withdraw", "c-dal", "counterpart · author", "expectedRevision",
         "agreed (terms locked), declined or withdrawn · 409 <code>PROPOSAL_EXPIRED</code> for an expired proposal", "live"),
        ("POST", "/api/my/negotiations/[id]/exchange", "c-dal", "the two sites, verified", "plannedDate, planNote?",
         "<code>{ id, ref }</code> · 409 <code>NOT_AGREED</code> · <code>EXCHANGE_EXISTS</code>", "live"),
        ("GET · PUT", "/api/my/exchanges · /[id]", "c-dal", "the two sites", "expectedRevision, plannedDate, planNote?",
         "exchanges with counts – simulated completions apart from verified ones · move the date", "live"),
        ("POST", "/api/my/exchanges/[id]/complete · /cancel", "c-dal", "receiving site · either site", "receivedQuantity, receivedUnitKey, receivedOn, qualityResult · reason",
         "completed or cancelled (final) · 403 <code>NOT_RECEIVER</code> · cancelling records no delivery", "live"),
    ]),
    ("6", "Level 2 – feasibility and impact", [
        ("PUT", "/api/my/assessments", "c-dal", "verified site, one side of the pair", "type, subject, expectedRevision, inputs",
         "<code>{ id, revision, status, result }</code> · private to the own site · 409 <code>STALE</code> · 422 <code>FREIGHT_ALREADY_INCLUDED</code> · <code>FACTOR_MISMATCH</code> · <code>UNIT_NOT_MASS</code>", "live"),
        ("POST", "/api/my/assessments/[id]/approve", "c-dal", "owning site", "expectedRevision",
         "released for the own overview · 422 <code>INCOMPLETE</code> without a comparative result", "live"),
        ("GET", "/api/my/impact", "c-dal", "own site", "–", "exchanges (realised apart from simulated, <code>countsAsVerifiedOutcome()</code>) and released assessments, demo records summed apart", "live"),
        ("GET", "/api/impact-factors", "c-dal", "everyone", "–", "factors with unit, version, geography, boundary, source and <code>sourceUrl</code> – four sourced, the rest example values", "live"),
    ]),
    ("7", "Level 2 – contract, simulated payment, chain benefit", [
        ("POST", "/api/my/negotiations/[id]/contract", "c-dal", "the two sites, verified", "–",
         "<code>{ id, ref }</code> from the accepted revision · 409 <code>NOT_AGREED</code> · <code>CONTRACT_EXISTS</code>", "live"),
        ("GET", "/api/my/contracts/[id]", "c-dal", "the two sites", "id",
         "snapshot, fingerprint, <code>intact</code>, signatures (who, when), execution, history · 404 for anyone else", "live"),
        ("POST", "/api/my/contracts/[id]/sign · /void", "c-dal", "the two sites, verified", "expectedRevision, snapshotHash, confirm · reason",
         "signed once per site · 409 <code>SNAPSHOT_CHANGED</code> · <code>SNAPSHOT_DAMAGED</code> · <code>ALREADY_SIGNED</code> · <code>CONTRACT_CLOSED</code>", "live"),
        ("GET · POST", "/api/my/exchanges/[id]/payments", "c-dal", "the two sites · payer", "idempotencyKey",
         "amount due under the signed contract and the payment · same key = same payment · 409 <code>CONTRACT_NOT_SIGNED</code> · <code>PAYMENT_EXISTS</code> · 403 <code>NOT_PAYER</code>", "live"),
        ("POST", "/api/my/payments/[id]/checkout · /capture · /cancel · /refund", "c-dal", "payer · either site · payer · payee", "outcome · idempotencyKey · reason",
         "simulated checkout (signed confirmation) · capture after delivery (409 <code>NOT_DELIVERED</code>) · cancel · refund", "live"),
        ("POST", "/api/payments/webhook", "c-dal", "payment provider (HMAC signature)", "KW-Signature header, event JSON",
         "authorised or failed once per event id · 401 <code>INVALID_SIGNATURE</code> · 409 <code>AMOUNT_MISMATCH</code>", "live"),
        ("GET · POST", "/api/my/negotiations/[id]/chain-consent", "c-dal", "the two sites (verified to write)", "consent, assessmentRevision, termsRevision",
         "both releases and the combined chain benefit · 409 <code>NO_ASSESSMENT</code> · <code>STALE</code> · <code>STALE_TERMS</code>", "live"),
    ]),
]


def api_section():
    n_live = sum(r[6] == "live" for _, _, rs in API_GROUPS for r in rs)
    n_plan = sum(r[6] == "planned" for _, _, rs in API_GROUPS for r in rs)
    n_prop = sum(r[6] == "proposed" for _, _, rs in API_GROUPS for r in rs)
    out = ['<div class="conv">'
           '<div class="card"><p class="k">Base</p><p>Same address as the app (<code>/api/…</code>), JSON in and out.</p></div>'
           '<div class="card"><p class="k">Login</p><p>The session cookie is sent automatically on the same site – no token handling.</p></div>'
           '<div class="card"><p class="k">Errors</p><p><code>{ error, requestId, fields? }</code> – 400 invalid · 401 · 403 · 404 · 409 conflict · 422 rule broken · 503 database down.</p></div>'
           '<div class="card"><p class="k">Roles</p><p>The viewer comes from the session. A field that is missing in a response is not allowed for that viewer.</p></div>'
           '</div>']
    out.append('<ul class="stlegend">' + "".join(
        f'<li class="a-{k}"><i>{ic}</i>{t}</li>' for k, (ic, t) in API_STATE.items()) +
        f'<li class="note">{n_live} live · {n_plan} planned for the rest of Level 2 (docs/FEATURES.md) · {n_prop} proposals.</li></ul>')
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
    fns = [
        ("getViewer(headers)", '<span class="chip c-auth">server/viewer.ts</span>', "Guest, member with the current state of the site, or administrator", "pages, API routes"),
        ("platformPage(need, path)", '<span class="chip c-app">app/(platform)/gate.tsx</span>', "Page access: redirect to login or site step, a notice, or the viewer", "every platform page"),
        ("api(request, name, run)", '<span class="chip c-app">server/http.ts</span>', "Route frame: origin check, session, structured errors with a request id", "every /api route"),
        ("requireVerifiedSite(viewer)", '<span class="chip c-dal">server/access.ts</span>', "Access rules as functions (+ <code>requireSite</code>, <code>requireBrowse</code>, <code>requireAdmin</code>)", "every DAL function"),
        ("searchOffers(viewer, query)", '<span class="chip c-dal">server/dal/offers.ts</span>', "Own park or radius, same filters, distance, sorted", "/offers, /map, GET /api/offers"),
        ("getOffer · listMyOffers · createOffer · updateOffer · publishOffer · closeOffer", '<span class="chip c-dal">server/dal/offers.ts</span>', "One offer, own offers, and every change of an own offer", "offer pages, /api/my/offers"),
        ("listSavedSearches · createSavedSearch · deleteSavedSearch · listNotifications · markNotificationsRead · notifySavedSearches", '<span class="chip c-dal">server/dal/alerts.ts</span>', "Saved searches and notices of the own site; the check when an offer is published", "/offers, /notifications, header bell"),
        ("createEnquiry · listEnquiries · respondToEnquiry", '<span class="chip c-dal">server/dal/enquiries.ts</span>', "Contact about one offer, private between two sites", "offer detail, dashboard"),
        ("registerSite · getMySite · listSites · getSiteProfile", '<span class="chip c-dal">server/dal/sites.ts</span>', "Site step of the registration, own profile, directory", "/register/site, /account, /companies"),
        ("memberMap · publicMap", '<span class="chip c-dal">server/dal/map.ts</span>', "Map data for members · allow-listed public projection", "/map, /regional-map"),
        ("searchRequests · getRequest · listMyRequests", '<span class="chip c-dal">server/dal/requests.ts</span>', "Open requests in the own park or a radius, one request, own requests in every status", "/requests, /my-requests"),
        ("createRequest · updateRequest · publishRequest · renewRequest · closeRequest · deleteRequestDraft", '<span class="chip c-dal">server/dal/requests.ts</span>', "Every change of an own request, with revision check", "request form, /my-requests"),
        ("createResponse · listResponses · replyToResponse", '<span class="chip c-dal">server/dal/requests.ts</span>', "One response per site and request, one reply, private between the two sites", "/requests/[id], /my-requests"),
        ("listMatches · getMatch · ownOffersForRequest · ownRequestsForOffer", '<span class="chip c-dal">server/dal/matches.ts</span>', "Candidates of the own active listings · one comparison with preparation steps and possible processors", "/matches, compatibility on /requests/[id] and /offers/[id]"),
        ("getNegotiationStart · startNegotiation · listNegotiations · getNegotiation", '<span class="chip c-dal">server/dal/negotiations.ts</span>', "Who negotiates with whom (from offer and request ownership), the first proposal, the own negotiations, one negotiation with every revision", "/negotiations, match and response pages"),
        ("counterPropose · acceptProposal · endNegotiation", '<span class="chip c-dal">server/dal/negotiations.ts</span>', "Every change under a row lock with revision check: counter, accept, decline, withdraw", "/negotiations/[id]"),
        ("planExchange · listExchanges · getExchange · updateExchange · completeExchange · cancelExchange", '<span class="chip c-dal">server/dal/exchanges.ts</span>', "Exchange of an agreed negotiation, its plan, receipt and quality (receiving site only), cancellation", "/exchanges, /negotiations/[id], dashboard"),
        ("getCatalogue · listParks", '<span class="chip c-dal">server/dal/catalogue.ts</span>', "Material categories, types, forms, units, attribute definitions, parks", "forms, filters, reference data"),
        ("offerProblems(offer, catalogue, mode, today)", '<span class="chip c-rule">server/domain/publish.ts</span>', "Problems per field: draft rules or everything needed to publish", "server + offer form"),
        ("requestProblems(request, catalogue, mode, today)", '<span class="chip c-rule">server/domain/request-rules.ts</span>', "Problems per field of a request: draft rules or everything needed to publish", "server + request form"),
        ("evaluateMatch(request, offer, catalogue)", '<span class="chip c-rule">server/domain/matching.ts</span>', "Criterion by criterion → one of four results, no score", "dal/matches.ts"),
        ("termProblems · changedTerms · negotiationActions · exchangeActions", '<span class="chip c-rule">server/domain/negotiation.ts</span>', "Rules of a proposal, the terms a revision changed, what each side may do now", "dal/negotiations.ts, dal/exchanges.ts, pages"),
        ("calculateFeasibility · calculateEnvironment", '<span class="chip c-rule">server/domain/feasibility.ts · environment.ts</span>', "Delivered cost and net proceeds, break-even only for a positive contribution · route comparison, transport-only apart", "dal/assessments.ts"),
        ("offerInput · offerSearchQuery", '<span class="chip c-zod">server/validation/offers.ts</span>', "Zod schemas + TypeScript types of an offer and of the search", "API routes, offer form"),
        ("requestInput · requestSearchQuery · responseInput", '<span class="chip c-zod">server/validation/requests.ts</span>', "Zod schemas of a request, the request search and a response", "API routes, request form"),
        ("negotiationStart · counterProposal · exchangeCompletion", '<span class="chip c-zod">server/validation/negotiations.ts</span>', "Zod schemas of a proposal, a decision and the steps of an exchange", "API routes, proposal and exchange forms"),
        ("assessmentSave · assessmentApproval", '<span class="chip c-zod">server/validation/assessments.ts</span>', "Zod schemas of a feasibility or environmental assessment and its release", "API routes, assessment forms"),
        ("makeFormatters(locale, t, units)", '<span class="chip c-fe">components/offers/format.ts</span>', "Quantity, price, date and distance written the same everywhere", "cards, detail, preview"),
        ("apiRequest · apiErrorText", '<span class="chip c-fe">lib/api-client.ts</span>', "Call <code>/api/*</code> from a client component; errors as a sentence in DE/EN", "all forms"),
        ("authClient · authErrorText", '<span class="chip c-fe">lib/auth-client.ts · auth-errors.ts</span>', "Sign-up, login, logout, password reset in the browser", "auth forms"),
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
    H.append('<header class="hero"><p class="eyebrow">KreiswertS · architecture · Level 1 + Level 2 complete · as of 2026-11-27</p>'
             '<h1>How the platform works – and how to build on it</h1>'
             '<p class="lead">One Next.js project holds the pages and the API of the material marketplace: offers (Level 1), requests and explained matching (Level 2, part 1), negotiations and exchanges (Level 2, part 2). Every request walks '
             'the same five stations on the server before it touches the database. This page shows the layers, the features, the request path, '
             'the API, the server functions, the database and the tools – everything you need to add a page or a feature.</p>'
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
             '<li><a href="#s9">Status flows</a></li><li><a href="#s10">Matching</a></li><li><a href="#s11">Tools</a></li><li><a href="#s12">New feature</a></li>'
             '</ul></nav></header>')

    # 1 overview
    H.append('<section aria-labelledby="s1">' + h2("01", "layers", "The big picture", "s1"))
    H.append('<p class="intro">Four layers, top to bottom. The browser only talks to the Next.js app; the app only reaches data '
             'through the server logic in <code>src/server/</code>.</p>')
    H.append(f'<figure><div class="scroll">{overview()}</div>'
             '<figcaption>Steps 2–5 are the same for pages and API routes. The solid indigo box is where the platform decides what a guest, '
             'a site or the administrator may do and see.</figcaption></figure>')
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
             '<code>docs/FRONTEND.md</code> and the code as of 2026-11-27. Level 1 and Level 2 are built completely, including contracts, the simulated payment, sourced emission factors and the combined chain benefit.</p>')
    H.append(feature_section() + '</section>')

    # 3 components
    H.append('<section aria-labelledby="s3">' + h2("03", "box", "Components in detail", "s3"))
    H.append('<p class="intro">Each software part: what it does, where it lives, its functions and the rules it enforces. '
             'Colours match the colour key at the top.</p>')
    H.append(components_section() + '</section>')

    # 4 request
    H.append('<section aria-labelledby="s4">' + h2("04", "route", "One request, five stations", "s4"))
    H.append('<p class="intro">The reference example is <code>src/app/api/offers/route.ts</code> – all five stations in a few lines. '
             'Every endpoint follows the same order.</p>')
    H.append(f'<figure><div class="scroll">{request()}</div></figure>')
    H.append('<div class="roles">'
             '<div class="card"><h3>Guest · no cookie</h3><p>Sees the public pages and the public projection only.</p>'
             '<ul class="chips"><li>park areas</li><li>named sites</li><li>categories</li><li>simulated pathways</li></ul></div>'
             '<div class="card"><h3>Site, pending or declined</h3><p>Sees and edits what is its own. Publishing, searching and contacting wait for the verification.</p>'
             '<ul class="chips"><li>own profile</li><li>own drafts</li><li>own offers</li></ul></div>'
             '<div class="card"><h3>Site, verified</h3><p>Publishes offers and requests, searches, contacts and responds to other sites.</p>'
             '<ul class="chips"><li>offers</li><li>requests</li><li>matches</li><li>distance</li><li>map</li><li>directory</li>'
             '<li class="plus">enquiries</li><li class="plus">responses</li><li class="plus">supplier contact, if shown</li></ul></div>'
             '<div class="card"><h3>Administrator</h3><p>Verifies sites and maintains reference data. Reads listings, never acts as a site.</p>'
             '<ul class="chips"><li>verification</li><li>reference data</li><li class="plus">addresses of sites</li></ul></div>'
             '</div></section>')

    # 3 ways
    H.append('<section aria-labelledby="s5">' + h2("05", "plug", "Getting data into a page", "s5"))
    H.append('<p class="intro">Rule of thumb: reading (lists, details) → server component. Interactive (form, map, live filter) → '
             'a small client component that calls the API.</p>')
    H.append('<div class="ways">'
             '<div class="card"><p class="k">A · Server component (default)</p>'
             '<div class="mini"><span class="c-app">page.tsx</span><b><i>→</i><span class="c-auth">getViewer()</span></b><b><i>→</i><span class="c-dal">DAL function</span></b><b><i>→</i><span class="c-db">DB</span></b></div>'
             '<p>Rendered on the server: no loading state, the login cookie is read automatically. Filters come from the URL.</p>'
             + code('// src/app/(platform)/offers/page.tsx\nconst page = await platformPage("browse", "/offers");\nif (page.blocked) return page.blocked;\nconst result = await searchOffers(page.viewer, query);') +
             '</div>'
             '<div class="card"><p class="k">B · Client component</p>'
             '<div class="mini"><span class="c-fe">"use client"</span><b><i>→</i><span class="c-app">fetch /api/…</span></b><b><i>→</i><span class="c-app">route</span></b><b><i>→</i><span class="c-dal">DAL</span></b></div>'
             '<p>For interactive parts (forms, buttons). Login and sign-up use <code>authClient</code>, which calls <code>/api/auth/*</code>.</p>'
             + code('"use client";\nconst result = await apiRequest(\n  "POST", "/api/my/offers", body);\nif (!result.ok) showProblems(\n  result.error.fields);') +
             '</div>'
             '<div class="card no"><p class="k">✕ Never</p>'
             '<p><b>Import <code>@/server/db/*</code> in a page or component.</b> It skips login, validation and the access rules.</p>'
             '<p>Server code inside a <code>"use client"</code> file fails the build – use <code>fetch</code> there.</p>'
             '</div></div></section>')

    # 6 API
    H.append('<section aria-labelledby="s6">' + h2("06", "api", "API by feature", "s6"))
    H.append('<p class="intro">All endpoints grouped by feature, with who may call them, what goes in and what comes back. '
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
    k = kind_counts()
    total, auth = sum(k.values()), k.get("login", 0)
    H.append('<p class="intro">' + L(
        f"{total - auth} platform tables plus {auth} login tables. Many of them are small on purpose: history, catalogue and "
        "link tables keep every change traceable and let the database itself check what is allowed. "
        "A physical site (<code>sites</code>) is the centre of the data.",
        f"{total - auth} Plattform-Tabellen plus {auth} Anmelde-Tabellen. Viele davon sind bewusst klein: Verlaufs-, Katalog- und "
        "Zuordnungs-Tabellen halten jede Änderung nachvollziehbar und lassen die Datenbank selbst prüfen, was erlaubt ist. "
        "Ein physischer Standort (<code>sites</code>) ist der Mittelpunkt der Daten.") + '</p>')
    cards = [("main", "main records", "One table per thing the platform handles: site, offer, request, negotiation, contract, payment."),
             ("history", "history tables", "Every change stays traceable (X-04). Rows are only added, so contracts and payments stay provable."),
             ("ref", "reference tables", "Catalogue, units, parks and emission factors are data: a new material needs no new table."),
             ("detail+link", "details and links", "Several values per record or allowed pairs; foreign keys keep them inside the catalogue (X-02)."),
             ("login", "login tables", "Required as they are by Better Auth, not designed by the project."),
             ("demo", "demo table", "The five illustrative cases A–E, always simulated.")]
    H.append('<div class="tkinds">' + "".join(
        f'<div class="kpi"><b>{sum(k.get(x, 0) for x in key.split("+"))}</b><span>{label}</span><p>{text}</p></div>'
        for key, label, text in cards if sum(k.get(x, 0) for x in key.split("+"))) + '</div>')
    H.append(f'<figure><div class="scroll">{tables_overview()}</div>'
             '<figcaption><b>HISTORY</b> only ever gains rows · <b>LINK</b> allowed pairs between two tables · '
             '<b>DETAIL</b> several values of one record · <b>REFERENCE</b> catalogue and lookup data, filled by '
             '<code>npm run db:seed</code> · <b>DEMO</b> simulated example data · no tag: main record. '
             'The list comes from the schema files on every build: <code>schema.ts</code> · <code>auth-schema.ts</code>.</figcaption></figure>')
    H.append('<div class="card tfewer"><h3>Could it be fewer tables?</h3>'
             '<p>Hardly. One shared history table with a JSON column would replace all history tables, but it loses the foreign keys and '
             'the typed columns – the database could check less, and contracts and payments could no longer be proven field by field. '
             'Link tables cannot become array columns for the same reason. The only real candidate is <code>demo_cases</code>: '
             'five fixed texts that could live in the code.</p></div>')
    H.append('<h3 class="tsub">Main relationships</h3>')
    H.append('<p class="intro">The material catalogue is data, so a new category needs no new table. The diagram shows the columns of the '
             'tables that carry most of the relationships.</p>')
    H.append(f'<figure><div class="scroll">{database()}</div>'
             '<figcaption><b>PK</b> primary key · <b>FK</b> foreign key, the arrow points to the table it references · '
             '<b>UQ</b> unique. The schema lives in <code>src/server/db/schema.ts</code>; <code>npm run db:push</code> writes it to the database, '
             '<code>npm run db:seed</code> fills the reference data.</figcaption></figure></section>')

    # 7 status
    H.append('<section aria-labelledby="s9">' + h2("09", "flow", "Status flows", "s9"))
    H.append('<p class="intro">Status values and allowed changes live once in <code>src/server/domain/status.ts</code>. '
             'Database, API, tests and UI all use the same values; <code>canTransition()</code> checks every change.</p>')
    H.append(f'<figure><div class="scroll">{status()}</div>'
             '<figcaption>Inner frame = final status. Closing an offer records no exchange. Requests follow the same offer flow; a closed request names fulfilled or withdrawn. Counterproposals keep a negotiation open; an expired proposal can no longer be accepted.</figcaption></figure></section>')

    # matching
    H.append('<section aria-labelledby="s10">' + h2("10", "match", "Explained matching: four results, no score", "s10"))
    H.append('<p class="intro"><code>evaluateMatch()</code> in <code>src/server/domain/matching.ts</code> compares one request with one offer, '
             'criterion by criterion. Each criterion is met, failed, unknown or needs processing; the checks below run in this order and the first '
             'that applies sets the result. Matches are not stored – an edit on either side changes the result at once.</p>')
    H.append('<div class="rules four">'
             '<div class="card"><span class="badge no">✕</span><p><b>Incompatible</b>A hard requirement failed. Lists only count these pairs.</p></div>'
             '<div class="card"><span class="badge">2</span><p><b>Processing required</b>Nothing failed, but a step is needed – sorting, grinding or regranulation; the steps are named.</p></div>'
             '<div class="card"><span class="badge">3</span><p><b>Conditional</b>Nothing failed, no step, but a criterion is unknown – e.g. weaker evidence or free text.</p></div>'
             '<div class="card"><span class="badge ok">✓</span><p><b>Compatible on declared data</b>Every hard requirement is met by what both sites declared.</p></div>'
             '</div>')
    H.append('<div class="rules">'
             '<div class="card"><span class="badge zd">H</span><p><b>Hard criteria</b>Category, material type, form, origin, quantity, timing, '
             'evidence and sample, technical criteria marked required.</p></div>'
             '<div class="card"><span class="badge zd">P</span><p><b>Preferences never change the result</b>Recurring supply, price ceiling and delivery '
             'are shown next to it.</p></div>'
             '<div class="card"><span class="badge zd">?</span><p><b>Unknown is never failed</b>Missing data or free text cannot prove a mismatch – '
             'people review it.</p></div>'
             '</div></section>')

    # tools
    H.append('<section aria-labelledby="s11">' + h2("11", "tool", "Tools and commands", "s11"))
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
                 "npm run db:push           # write the schema\nnpm run db:seed           # reference data\nnpm run db:seed -- --demo # + fictional demo data\nnpm run db:studio         # browse the data") + '</div>'
             '<div class="card"><h3>Before every commit</h3>' + code(
                 "npm run check             # TypeScript + Vitest\nnpm run build             # production build") + '</div>'
             '</div></section>')

    # 9 new feature
    H.append('<section aria-labelledby="s12">' + h2("12", "plus", "Adding a feature", "s12"))
    H.append('<ol class="steps">'
             '<li><b>Plan it</b><p>Row + short section in <code>docs/FEATURES.md</code>: what, data, logic, open points.</p></li>'
             '<li><b>Rules + data</b><p>Has a status flow → add it to <code>status.ts</code> with a test. Needs tables → <code>schema.ts</code>, then <code>npm run db:push</code>.</p></li>'
             '<li><b>Define the response type</b><p>Like <code>OfferCard</code> / <code>OfferDetail</code>: an allow-list built on the server. The frontend renders exactly that type.</p></li>'
             '<li><b>Build the five stations</b><div class="mini"><span class="c-app">Route</span><b><i>→</i><span class="c-auth">Auth</span></b><b><i>→</i><span class="c-zod">Zod</span></b><b><i>→</i><span class="c-dal">DAL</span></b><b><i>→</i><span class="c-db">Drizzle</span></b></div><p>Then add the endpoint to <code>docs/FRONTEND.md</code>.</p></li>'
             '</ol>')
    H.append('</section>')
    H.append('<footer><p>Sources: <code>README.md</code>, <code>docs/FRONTEND.md</code>, <code>docs/FEATURES.md</code> and the code in '
             '<code>src/</code> as of 2026-11-27. Prototype with fictional demo data only. When the code changes, update this page.</p></footer>')
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
