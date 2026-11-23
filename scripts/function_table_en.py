"""English content for scripts/build_function_table.py (same rows, numbers and order as the German version).

Page paths and code names stay as in the app; only the text is translated.
"""
OUT_NAME = "Functions_KreiswertS_EN.docx"
TITLE = "KreiswertS – Platform Functions"
INTRO = ("Status 23 Nov 2026 · existing, planned and new functions, grouped by area. "
         "Page paths are suggestions; the frontend team defines the pages based on Figma.")

HEAD = ["No", "Function", "What it does", "Where in the app", "Where in the code", "Status", "Reference", "Answers questions"]
HEAD_NOT = ["No", "Function", "What it does", "Where it would go later", "Reason", "Answers questions"]
HEAD_LEGEND = ["Status", "Meaning"]

LEGEND = [
    ("done", "exists in the code"),
    ("planned", "already in docs/FUNKTIONEN.md"),
    ("new · stage 1", "fits into the prototype by 10 Jan 2027"),
    ("new · stage 2", "afterwards or if time allows"),
]

GROUPS = [
    ("A · Account & Access", [
        (1, "Sign up, log in, account", "A company creates an account with e-mail and password, logs in and out. The account page shows who is logged in.", "Pages `/registrieren`, `/login`, `/konto` (test pages so far)", "`server/auth.ts`, `/api/auth/*`", "done", "–"),
        (2, "Company approval", "A new account starts as “pending”. Only after a check can it see prices and contacts and post listings → protection against fake accounts.", "Notice after sign-up, banner in `/konto` “awaiting review”", "`server/viewer.ts`, column `account_status`", "new · stage 1", "Sfridoo, Orbio"),
        (3, "Delete account + data export", "A company deletes its account or downloads all data stored about it. Mandatory once real data is in the system.", "`/konto` → section “Data & account”", "Better Auth `deleteUser`, export in the Data Access Layer", "new · stage 2", "own proposal"),
    ]),
    ("B · Companies", [
        (4, "Company profile", "A page per company: name, industry, location, what it offers and needs. Contact details for members only.", "Page `/firmen/[id]`, edit under `/konto/firma`", "`GET`/`PATCH /api/sites/:id`, new `dal/sites.ts`", "new · stage 1", "Cyrkl, proposal"),
        (5, "Company directory", "List of all companies in the region, also without a current listing, filterable by industry and town. Proposal: at least 10 companies.", "Page `/firmen`", "`GET /api/sites`", "new · stage 1", "Cyrkl"),
        (42, "My partners + follow companies", "A company bookmarks companies and sees them separately as buyers, suppliers and saved. New listings and changes of partners appear as a notice.", "`/konto/partner`: 3 lists, button “Follow” in the company profile", "New table `follows` (DB question), `GET /api/partners`", "new · stage 2", "question catalogue"),
    ]),
    ("C · Listings (Offer + Demand)", [
        (6, "Browse offers", "List of plastic offers. Guest: title, material, quantity, town · member: also price, description, contact.", "Start page or `/angebote`, detail `/angebote/[id]`", "`GET /api/offers`, `dal/offer-view.ts`", "done", "–"),
        (7, "Post an offer", "A member creates a new offer, edits it or withdraws it.", "Form `/inserat/neu`, “My listings” under `/konto/inserate`", "`POST`/`PATCH /api/offers`, `validation/offers.ts`", "new · stage 1", "all"),
        (8, "Post a demand", "A company posts what it is looking for: material, quantity, period, maximum price. No matching without demand.", "Same form, toggle “I offer / I need”", "New table for demand (DB question), `/api/requests`", "planned", "Cyrkl, plasticker, IHK"),
        (9, "Material passport", "The listing describes the plastic precisely: form (regrind, pellets, film, bales), colour, purity, origin, data sheet → the buyer sees without asking whether they can process it.", "Form section “Material”, detail page block “Material passport”", "Columns in `offers` + demand, Zod schema", "new · stage 1", "plasticker, Excess Materials Exchange"),
        (10, "Recurring material stream", "One-off or ongoing, e.g. “500 kg per month”. Ongoing quantities can be planned → long-term cooperation.", "Form field “one-off / weekly / monthly”, label “recurring” in the list", "Column `frequency`", "new · stage 1", "SHAREBOX"),
        (11, "By-product or waste", "The supplier states whether the material is legally a by-product or waste, for waste with the waste code → the buyer sees whether they may accept it.", "Choice in the form, note on the detail page (no legal advice)", "2 columns in `offers`", "new · stage 1", "Sfridoo, empto"),
        (12, "Listing expires", "Draft, active, reserved, closed or expired. Without renewal it expires after e.g. 60 days → no outdated entries.", "`/konto/inserate`: status per listing, button “renew”", "New flow in `domain/status.ts` + test", "new · stage 1", "own proposal"),
        (13, "Visibility per listing", "Public, members only, or anonymous until a request is accepted → competitors don't see where which residues occur.", "Choice in the form, detail page “company hidden”", "Column `visibility`, rule in `dal/offer-view.ts`", "new · stage 2", "Rheaply"),
        (41, "Deadline in the listing", "The supplier states by when the material must be gone, e.g. “pick up by 15 Jan”. Urgent listings are marked and can be sorted by deadline.", "Form field “available until”, label “urgent” in list and map", "Column `available_until` in `offers`, sorting in `dal/offers.ts`", "new · stage 1", "question catalogue"),
        (43, "Listing statistics", "Shows per listing how often it was viewed, saved and requested → the company sees whether its listing gets attention.", "`/konto/inserate`: figures per listing", "Counters per listing (DB question), requests from `agreements`", "new · stage 2", "question catalogue"),
    ]),
    ("D · Search & Discovery", [
        (14, "Map", "Companies and offers as points on a map; a click opens the company or offer.", "Top of the start page, full page `/karte`", "`sites.latitude`/`longitude`, data via `/api/sites`", "planned", "proposal"),
        (15, "Search by distance", "Only results within a radius, e.g. 10 km from your own site.", "Filter bar above list and map", "`maxDistanceKm` + `near`, Haversine in `dal/offers.ts`", "planned", "Cyrkl"),
        (16, "More search filters", "Narrow down further by form, colour, quantity from–to, maximum price, date posted.", "Filter bar, button “More filters”", "Zod schema + `dal/offers.ts`", "new · stage 1", "Cyrkl, plasticker"),
        (17, "Matches with reasons", "The platform suggests matching offer-demand pairs and says why: “material fits · 7 km · quantity sufficient”.", "Detail page block “Matches”, overview `/konto/treffer`", "Function `matchReasons()` in `domain/`, `GET /api/matches`", "planned", "Sfridoo, Orbio"),
        (18, "Map with connection lines", "Lines between companies whose offer and demand match; 3 worked example scenarios as clearly labelled demo data.", "Map: layer “Connections” can be switched on, choice “Scenario 1–3”", "`GET /api/network/links`, uses no. 17", "new · stage 1", "proposal"),
        (19, "Saved search + in-app notice", "Save a search, e.g. “PE film within 10 km” → notice as soon as something matching is posted.", "Button “Save search” in the filter bar, bell in the header", "Tables `alerts` + `notifications`, check when an offer is created", "planned", "Rheaply"),
        (20, "E-mail for saved search", "The notice from no. 19 also by e-mail.", "`/konto` → “Notifications” on/off", "Mail delivery, builds on `notifications`", "new · stage 2", "Rheaply"),
    ]),
    ("E · Cooperation", [
        (21, "Fixed workflow", "Requested → negotiation → agreed → in progress → completed, plus rejected and cancelled; invalid jumps are blocked.", "Status bar in the cooperation detail", "`domain/status.ts`", "done (rules only)", "–"),
        (22, "Request with message", "An interested company requests an offer, with desired quantity and a short message.", "Button “Request” on the offer detail page → dialog", "`POST /api/agreements`, first entry in `agreement_events`", "new · stage 1", "Rheaply, Orbio"),
        (23, "Manage cooperation", "Both sides see all ongoing cooperations, negotiate via counter-offer, confirm the agreement; every step with date in the history.", "`/konto/kooperationen`: list + detail with timeline, buttons “Accept / Reject / Counter-offer / Confirm”", "`PATCH /api/agreements/:id`, check with `canTransition`, `agreement_events`", "planned", "cirplus, empto"),
        (24, "Request a sample", "Request a small material sample before agreeing; request and result in the history.", "Button in the cooperation detail, only until agreement", "Event `sample_requested`", "new · stage 2", "cirplus, Orbio"),
        (25, "Pickup date + handover proof", "Agree on a date; after pickup both confirm the actual quantity → proof and basis for no. 28.", "Cooperation detail, section “Pickup”", "`pickup_date` (DB question), `actualQuantityKg`, confirmation fields", "new · stage 2", "Resourcify"),
        (26, "Material tracking (containers)", "Path of a batch: collected → sorted → processed → delivered → reused.", "Cooperation detail, timeline of the batch", "Tables `containers` + `container_events`", "planned (provision only)", "cirplus"),
        (44, "Documents + payment status", "Store contract, delivery note, invoice and test certificate with the cooperation. Mark payment manually as open or paid – no payment processing.", "Cooperation detail, section “Documents”", "Table `agreement_documents` + file storage (DB question), column `payment_status`", "new · stage 2", "question catalogue"),
        (45, "Report a problem", "Report delay, transport damage or wrong quality on the cooperation; report and resolution appear in the history.", "Button “Report a problem” in the cooperation detail", "Event `issue_reported` in `agreement_events`", "new · stage 2", "question catalogue"),
    ]),
    ("F · Analytics & Impact", [
        (27, "Network overview", "Key figures for the region: active offers and demands, material without a buyer, most-requested materials. For the town and economic development.", "Public page `/uebersicht`: KPI tiles + ranking", "`GET /api/network/stats` (queries only)", "planned", "SYNERGie"),
        (28, "Impact", "Reused kilograms, avoided disposal, CO₂ saved, per year.", "`/uebersicht`, section “Impact” with year selection", "`GET /api/impact`, counts completed cooperations only", "planned", "Rheaply, Excess Materials Exchange"),
        (29, "Impact report per company", "A company downloads its annual report: kilograms, CO₂, number of cooperations – for its own sustainability report.", "`/konto/wirkung`, button “As CSV/PDF”", "`GET /api/impact?siteId=&year=`", "new · stage 2", "Rheaply"),
        (30, "Savings calculator", "A visitor enters material and quantity → estimate: disposal costs saved, possible revenue, CO₂ avoided. Incentive to join.", "Public page `/rechner`, link from the start page", "Pure function in `domain/`, CO₂ factor from `materials`", "new · stage 2", "Cyrkl"),
    ]),
    ("G · Operations & Administration", [
        (31, "Health check", "Reports whether server and database are running.", "No page", "`GET /api/health`", "done", "–"),
        (32, "Admin area", "For the operators: approve and block accounts (no. 2), maintain the material catalogue, remove inappropriate listings.", "Area `/admin`, admin role only", "Role `admin`, routes `/api/admin/*`", "new · stage 2", "SYNERGie, Sfridoo"),
        (33, "Bilingual DE/EN", "Interface switchable between German and English.", "Language switch in the header", "API returns codes, the frontend translates the texts", "new · stage 2", "own proposal"),
        (34, "Import/export + manual", "Read companies and materials from a spreadsheet and export them → another region sets up the platform with its own data.", "No page (script), manual in `docs/`", "Script in `scripts/`", "new · stage 2", "proposal"),
        (46, "Guide page", "Short explainer: legal duties of both sides, by-product or waste, how a cooperation works – with links to the sources, no legal advice.", "Public page `/leitfaden`, link in the footer", "Static page (frontend), no backend", "new · stage 1", "question catalogue"),
    ]),
]

NOT_NOW = ("H · Deliberately not in the prototype", [
    (35, "Payment + transport brokerage", "Pay and book a haulier directly via the platform.", "Cooperation detail", "High effort; cirplus offered this and has ceased operations"),
    (36, "Auctions, commission", "Material goes to the highest bidder, the platform earns a share.", "Offer detail", "Proposal: not an operational marketplace"),
    (37, "AI listing suggestions, learning matching", "AI pre-fills listings and learns from deals which pairs fit.", "Form, no. 17", "Needs a lot of real data"),
    (38, "Price index", "Typical prices per plastic type over time.", "`/uebersicht`", "Only meaningful with many listings"),
    (39, "Lab, certificates", "Material testing and quality labels by the platform.", "Material passport (no. 9)", "Outside the project's scope"),
    (40, "Company ratings", "Stars or comments after a cooperation.", "Company profile (no. 4)", "Sensitive in a small regional network"),
])

INTRO2 = ("Column “Answers questions”: comparison with the team's question catalogue of 23 Nov 2026 "
          "(A1–A49 = offerer, B1–B45 = buyer). Nos. 41–46 are new and result from this comparison.")
COMPARE_TITLE = "Comparison with the question catalogue"
COMPARE_INTRO = ("The question catalogue contains 94 questions: 49 from the offerer's view (A) and 45 from the buyer's view (B). "
                 "Each question is assigned to the function that answers it.")
SUMMARY_HEAD = ["Result", "Count", "Questions"]
SUMMARY_LABELS = ["Answered by functions in groups A–G", "Answered only by group H (not in the prototype)",
                  "No platform function (decision inside the company)"]
OPEN_TITLE = "Questions without a function in the prototype"
OPEN_HEAD = ["Question", "Wording", "Assessment"]
QUESTION_NOTES = {
    "A1": ("Why do I want to dispose of my waste?", "The company's motivation → material for the problem statement, not a function."),
    "A2": ("What will happen if I do not dispose of my waste?", "The company's motivation → material for the problem statement, not a function."),
    "A10": ("How can I ensure that the payment reaches my bank account as soon as possible?", "Payment processing (no. 35) is not in the prototype; no. 44 only shows whether it has been paid."),
    "A12": ("Do I want other partners for waste disposal?", "The company's decision; the company directory (no. 5) shows the options."),
    "A19": ("How can I reduce the waste in my production line?", "Waste prevention is consulting, outside the platform (Cyrkl offers this as a consulting service)."),
    "A31": ("How can I find out what price other companies are willing to pay for my waste?", "Price index (no. 38) and auctions (no. 36) are not in the prototype; requests and counter-offers (no. 23) show the willingness to pay."),
    "A36": ("How can I find a suitable transportation provider?", "Transport brokerage (no. 35) is not in the prototype; no. 25 records who picks up."),
    "A40": ("Which payment methods are available?", "Payment happens outside the platform (no. 35 not in the prototype)."),
    "A41": ("How can I minimise the financial risk of selling my waste?", "Payment protection (no. 35) is missing; the prototype reduces the risk only through approval (no. 2) and proofs (nos. 25, 44)."),
    "B2": ("How can I see the current price trends for the materials I need?", "A price index (no. 38) is only meaningful with many listings."),
    "B17": ("How can I determine whether I need to source my materials externally at all?", "The company's decision; the savings calculator (no. 30) helps with the assessment."),
    "B29": ("How can I determine whether a supplier's asking price is reasonable?", "Price index (no. 38) is not in the prototype; prices of several offers can be compared (nos. 6, 16)."),
}
SOURCES_TITLE = "Sources"
SOURCES_INTRO = "All links checked on 23 Nov 2026 (reachable)."
SOURCES_HEAD = ["Source", "Link"]
SOURCE_LABELS = ["Cyrkl – marketplace", "Cyrkl – case study (Circle Economy)", "Sfridoo – how it works", "Orbio – EU circular economy platform",
                 "plasticker – raw materials exchange (German)", "plastship – material search", "cirplus – liquidation notice", "cirplus – final report DBU (German)",
                 "IHK recycling exchange (German)", "Rheaply – features", "Excess Materials Exchange – profile", "SHAREBOX / SYNERGie – EU project (CORDIS)",
                 "Resourcify – KfW report (German)", "empto – Handwerksblatt (German)", "Study “Digital Platforms for Industrial Symbiosis” (2022)",
                 "Guidance on by-product status, NRW (German)", "German Circular Economy Act § 4 by-products (German)"]
