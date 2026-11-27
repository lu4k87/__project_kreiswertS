#!/usr/bin/env node
// End-to-end acceptance run of Level 1 against a running test instance: the four user scenarios
// (CONTENT/KreiswertS_User_Scenarios.pdf) plus the negative tests of the test register that need a real server.
//
// Never run it against the working database: it expects a freshly seeded demo database and changes it.
//
//   export DATABASE_URL=postgres://…/kreiswerts_e2e  DEMO_PASSWORD=…  DEMO_ADMIN_PASSWORD=…  BETTER_AUTH_URL=http://localhost:3100
//   npx drizzle-kit push --force && node scripts/seed.mjs --reset-demo
//   npm run build && npx next start -H 127.0.0.1 -p 3100 > server.log 2>&1 &
//   node scripts/e2e-level1.mjs --base http://localhost:3100 --log server.log
//
// Better Auth allows 3 login or sign-up requests per 10 s for all clients together → the script pauses in between.
import { readFileSync } from "node:fs";
import pg from "pg";
import { SITES } from "./seed/demo.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const BASE = arg("base", "http://localhost:3100");
const LOG = arg("log", null);
const PASSWORD = process.env.DEMO_PASSWORD;
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL ?? "";

if (!PASSWORD || !ADMIN_PASSWORD) throw new Error("DEMO_PASSWORD and DEMO_ADMIN_PASSWORD are missing (the passwords the demo logins were seeded with)");
// The run writes through the API and moves a date directly in the database. It refuses everything that is not
// provably the test instance: the database name must end in _e2e, the server must not be the dev server, and
// (checked at the first login) the server at --base must write into exactly this database.
const target = URL.canParse(DATABASE_URL) ? new URL(DATABASE_URL) : null;
if (!target?.pathname.endsWith("_e2e")) throw new Error("DATABASE_URL must name a database ending in _e2e");
if (new URL(BASE).port === "3000") throw new Error("--base points at port 3000 (the dev server with the working database)");
const db = new pg.Client({ connectionString: DATABASE_URL });

let passed = 0;
const failures = [];
function check(name, condition, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` – ${detail}` : ""}`);
  console.log(`${condition ? "ok  " : "FAIL"} ${name}${!condition && detail ? ` – ${detail}` : ""}`);
}
const section = (title) => console.log(`\n── ${title}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One browser: keeps its cookies and sends the Origin header like a page of the app would. */
class Client {
  cookies = new Map();
  constructor(label) {
    this.label = label;
  }
  async request(method, path, body, headers = {}) {
    const send = { cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...headers };
    if (method !== "GET" && !("origin" in headers)) send.origin = BASE;
    if (body !== undefined && !("content-type" in headers)) send["content-type"] = "application/json";
    for (const key of Object.keys(send)) if (send[key] === null || send[key] === "") delete send[key];
    const response = await fetch(BASE + path, { method, headers: send, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), redirect: "manual" });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [key, ...value] = pair.split("=");
      if (/max-age=0/i.test(cookie)) this.cookies.delete(key);
      else this.cookies.set(key, value.join("="));
    }
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: response.status, json, text };
  }
  get = (path) => this.request("GET", path);
  post = (path, body = {}, headers) => this.request("POST", path, body, headers);
  put = (path, body) => this.request("PUT", path, body);
  delete = (path) => this.request("DELETE", path, {});
}

let authRequests = 0;
/** Keeps below the login limit: after every 3 login/sign-up requests wait until the 10 s window is over. */
async function paced() {
  if (authRequests > 0 && authRequests % 3 === 0) {
    console.log("    (waiting 11 s: login rate limit)");
    await sleep(11_000);
  }
  authRequests += 1;
}

async function login(username, password = PASSWORD) {
  const client = new Client(username);
  await paced();
  const result = await client.post("/api/auth/sign-in/username", { username, password });
  if (result.status !== 200) throw new Error(`login ${username} failed: HTTP ${result.status} ${result.text.slice(0, 200)}`);
  return client;
}

const friday = (() => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + ((5 - date.getUTCDay() + 7) % 7 || 7));
  return date.toISOString().slice(0, 10);
})();
const today = new Date().toISOString().slice(0, 10);

async function main() {
  await db.connect();
  const sessions = async () => (await db.query("select count(*)::int as n from auth_sessions")).rows[0].n;
  const sessionsBefore = await sessions();
  const a = await login("site_a");
  if ((await sessions()) <= sessionsBefore) throw new Error("the server at --base does not write to the database of DATABASE_URL – nothing was changed");
  const guest = new Client("guest");

  section("Reference data");
  const catalogue = (await guest.get("/api/catalogue")).json;
  const plastics = catalogue.categories.find((category) => category.key === "plastics");
  const metals = catalogue.categories.find((category) => category.key === "metals");
  const typeId = (key, category = plastics) => catalogue.types.find((type) => type.categoryId === category.id && type.key === key).id;
  const formId = (key, category = plastics) => catalogue.forms.find((form) => form.categoryId === category.id && form.key === key).id;
  check("catalogue: plastics enabled, metals configured but disabled (X-06)", plastics.enabled === true && metals.enabled === false);
  check("catalogue: metals has its own attributes without a new table (AT-L1-006)", catalogue.attributes.some((a) => a.categoryId === metals.id && a.key === "alloy"));

  section("Guests (NT-L1-002, AT-L1-020)");
  for (const path of ["/api/offers", "/api/my/offers", "/api/my/site", "/api/my/enquiries", "/api/map", "/api/sites", "/api/admin/sites", "/api/offers/1"]) {
    check(`guest GET ${path} → 401`, (await guest.get(path)).status === 401);
  }
  const publicMap = await guest.get("/api/public/map?include=contact,address,quantity&scope=all");
  check("public map answers without login", publicMap.status === 200 && publicMap.json.parks.length >= 3);
  const publicText = publicMap.text;
  const privateMarkers = ["@", "contact", "street", "Musterstraße", "Beispielweg", "postal", "quantity", "price", "+49", "51.5131", "6.5672", "vat"];
  const leaked = privateMarkers.filter((marker) => publicText.toLowerCase().includes(marker.toLowerCase()));
  check("public map contains no contact, address, quantity, price or site coordinates (NT-L1-020)", leaked.length === 0, `found: ${leaked.join(", ")}`);
  check("public pathways are all labelled simulated (AT-L1-020)", publicMap.json.pathways.length === 5 && publicMap.json.pathways.every((p) => p.simulated === true));
  check("review: categories are published for the region as a whole, never per park or site", publicMap.json.categories.map((c) => c.key).join() === "plastics" && publicMap.json.parks.every((park) => !("categories" in park)));

  section("Logins");
  const b = await login("site_b");
  const c = await login("site_c");

  section("Pages");
  const pageStatus = async (client, paths) => Promise.all(paths.map(async (path) => `${path} ${(await client.get(path)).status}`));
  const publicPages = ["/", "/about", "/regional-map", "/help", "/login", "/register"];
  check("public pages render for a guest", (await pageStatus(guest, publicPages)).every((line) => line.endsWith(" 200")), (await pageStatus(guest, publicPages)).join(", "));
  const guarded = ["/dashboard", "/offers", "/my-offers", "/my-offers/new", "/map", "/companies", "/account", "/admin/verification", "/admin/reference-data"];
  check("platform pages send a guest to the login (NT-L1-002)", (await pageStatus(guest, guarded)).every((line) => line.endsWith(" 307")), (await pageStatus(guest, guarded)).join(", "));
  const memberPages = ["/dashboard", "/offers", "/offers?scope=radius&radiusKm=25", "/my-offers", "/my-offers/new", "/map", "/companies", "/account", "/admin/verification"];
  check("platform pages render for a verified site (the admin page as a refusal)", (await pageStatus(a, memberPages)).every((line) => line.endsWith(" 200")), (await pageStatus(a, memberPages)).join(", "));

  section("Scenario 1 – Site A offers a batch for collection");
  const hdpeOffcuts = {
    title: "HDPE-Plattenabschnitte, sortiert",
    description: "300 kg sortierte Abschnitte aus der Produktion. Abholung bis Freitag.",
    categoryId: plastics.id,
    typeId: typeId("hdpe"),
    formId: formId("sheet"),
    origin: "pre_consumer",
    legalStatus: "by_product",
    quantity: 300,
    unitKey: "kg",
    frequency: "one_time",
    availableFrom: today,
    collectionUntil: friday,
    priceMode: "quotation",
    deliveryOptions: [{ term: "exw", namedPlace: "Werk A, Kamp-Lintfort" }, { term: "fca", namedPlace: "Werk A, Kamp-Lintfort" }],
    evidenceStatus: "self_declared",
    sampleAvailable: "yes",
  };
  const created = await a.post("/api/my/offers", { ...hdpeOffcuts, siteId: 2, status: "active", provenance: "self_declared", revision: 99 });
  const offerA = created.json?.id;
  check("A saves a draft", created.status === 200 && Number.isInteger(offerA), created.text.slice(0, 200));
  const ownDraft = (await a.get(`/api/my/offers/${offerA}`)).json;
  check("owner, status and revision come from the server, not from the body (X-01)", ownDraft.status === "draft" && ownDraft.revision === 1);
  check("a draft is not discoverable", !(await b.get("/api/offers?scope=radius&radiusKm=100")).json.offers.some((offer) => offer.id === offerA));
  check("another site cannot open someone else's draft", (await b.get(`/api/offers/${offerA}`)).status === 404);
  const published = await a.post(`/api/my/offers/${offerA}/publish`, {});
  check("A publishes the offer (AT-L1-005)", published.status === 200 && Boolean(published.json.expiresAt), published.text.slice(0, 200));
  const detailForB = (await b.get(`/api/offers/${offerA}`)).json;
  check("a receiver sees quantity and collection window before contacting", detailForB.quantity === 300 && detailForB.unitKey === "kg" && detailForB.collectionUntil === friday);
  check("quotation shows no number – never 0 (AT-L1-008)", detailForB.priceMode === "quotation" && detailForB.priceAmount === null);
  check("the demo site's listing keeps its synthetic label (AT-L1-021)", detailForB.provenance === "synthetic");
  check("the detail never carries the street address", !JSON.stringify(detailForB).includes("Musterstraße"));

  section("Scenario 2 – Site B finds feedstock beyond its park");
  const filters = `typeId=${typeId("hdpe")}&formId=${formId("sheet")}&delivery=collection`;
  const local = (await b.get(`/api/offers?scope=park&${filters}`)).json;
  check("local search: exactly the 80 kg batch in B's own park (AT-L1-013)", local.offers.length === 1 && local.offers[0].quantity === 80 && local.park?.name.includes("Genend"), JSON.stringify(local.offers.map((o) => [o.title, o.quantity])));
  const wider = (await b.get(`/api/offers?scope=radius&radiusKm=10&${filters}`)).json;
  const foundA = wider.offers.find((offer) => offer.id === offerA);
  check("wider search with the same filters finds A's 300 kg offer (AT-L1-014)", Boolean(foundA) && wider.offers.every((offer) => offer.type.key === "hdpe" && offer.form.key === "sheet"));
  check("with its straight-line distance from Site B", foundA?.distanceKm > 5 && foundA?.distanceKm < 6, `distance ${foundA?.distanceKm}`);
  check("sorted by distance, nearest first", wider.offers.every((offer, index) => index === 0 || (wider.offers[index - 1].distanceKm ?? Infinity) <= (offer.distanceKm ?? Infinity)));
  check("the card tells a one-off collection batch apart (AT-L1-015)", foundA?.frequency === "one_time" && foundA?.deliveryTerms.join() === "exw,fca");
  check("delivered-only filter omits the collection-only batch (AT-L1-009)", !(await b.get(`/api/offers?scope=radius&radiusKm=10&typeId=${typeId("hdpe")}&delivery=delivered`)).json.offers.some((offer) => offer.id === offerA));
  const localC = (await c.get(`/api/offers?scope=park&${filters}`)).json;
  check("zero local results is a valid answer (Site C's park)", localC.offers.length === 0 && localC.needsArea === false);
  check("… and widening from zero works with the same filters", (await c.get(`/api/offers?scope=radius&radiusKm=25&${filters}`)).json.offers.length === 2);
  const none = await c.get(`/api/offers?scope=radius&radiusKm=25&typeId=${typeId("pvc")}&formId=${formId("regrind")}`);
  check("zero wider matches is a valid answer too (AT-L1-014)", none.status === 200 && none.json.offers.length === 0 && none.json.total === 0);
  check("two branches in different parks get different local results (AT-L1-013)", JSON.stringify((await a.get("/api/offers?scope=park")).json.offers.map((o) => o.id)) !== JSON.stringify(local.offers.map((o) => o.id)));
  const mapB = (await b.get(`/api/map?scope=radius&radiusKm=10&${filters}`)).json;
  check("map and list return the same offers for the same filters (AT-L1-019)", JSON.stringify(mapB.search.offers.map((o) => o.id)) === JSON.stringify(wider.offers.map((o) => o.id)));
  check("the map places A's offer at Site A", mapB.sites.some((site) => site.offerIds.includes(offerA) && site.name === "Werk A"));
  const enquiry = await b.post(`/api/offers/${offerA}/enquiries`, { topic: "collection", message: "Sind noch Metalleinsätze enthalten? Ist eine Abholung am Freitag möglich?" });
  check("B contacts A with the batch reference (AT-L1-017)", enquiry.status === 200 && enquiry.json.ref === `KW-${String(offerA).padStart(6, "0")}`, enquiry.text.slice(0, 200));
  const afterEnquiry = (await a.get(`/api/my/offers/${offerA}`)).json;
  check("the enquiry leaves stock and status unchanged", afterEnquiry.status === "active" && afterEnquiry.input.quantity === 300 && afterEnquiry.revision === 2);
  const inboxA = (await a.get("/api/my/enquiries")).json.enquiries;
  check("A receives the enquiry for the right offer", inboxA.length === 1 && inboxA[0].direction === "received" && inboxA[0].offer.id === offerA);
  check("a third site cannot read the enquiry (NT-L1-017)", (await c.get("/api/my/enquiries")).json.enquiries.length === 0);
  check("A cannot enquire about its own offer", (await a.post(`/api/offers/${offerA}/enquiries`, { topic: "other", message: "Test an mich selbst, nicht erlaubt." })).status === 409);

  section("Scenario 3 – Site B offers processed plastic for recurring supply");
  const regrind = {
    title: "HDPE-Mahlgut aus Produktionsabschnitten",
    description: "Mahlgut aus sortenreinen Abschnitten, gleichbleibende Qualität, monatliche Lieferung möglich.",
    categoryId: plastics.id,
    typeId: typeId("hdpe"),
    formId: formId("regrind"),
    origin: "pre_consumer",
    legalStatus: "by_product",
    quantity: 500,
    unitKey: "kg",
    minLot: 250,
    frequency: "recurring",
    recurrencePeriod: "monthly",
    recurrenceQuantity: 500,
    availableFrom: today,
    priceMode: "fixed",
    priceAmount: 400,
    priceUnitKey: "t",
    vatBasis: "net",
    deliveryOptions: [{ term: "fca", namedPlace: "Standort B, Moers" }, { term: "dap", namedPlace: "Kamp-Lintfort und Umgebung" }],
    deliveryPricing: "quotation",
    maxDeliveryDistanceKm: 100,
    packaging: "big_bags",
    loadingEquipment: "forklift",
    evidenceStatus: "self_declared",
    datasheetAvailable: true,
    sampleAvailable: "yes",
    attributes: { particle_size: { valueMin: 3, valueMax: 6 }, contamination: { valueMin: 1, comparator: "lt" } },
  };
  const offerB = (await b.post("/api/my/offers", regrind)).json?.id;
  check("B, who also sources, creates an offer with the same account (AT-L1-004)", Number.isInteger(offerB));
  const sheetOnRegrind = await b.put(`/api/my/offers/${offerB}`, { ...regrind, expectedRevision: 1, attributes: { thickness: { valueMin: 3, valueMax: 6 } } });
  check("a sheet attribute is rejected for regrind (NT-L1-006)", sheetOnRegrind.status === 422 && sheetOnRegrind.json.fields.some((f) => f.field === "attributes.thickness" && f.code === "NOT_APPLICABLE"), sheetOnRegrind.text.slice(0, 200));
  check("B publishes", (await b.post(`/api/my/offers/${offerB}/publish`, {})).status === 200);
  const regrindForC = (await c.get(`/api/offers/${offerB}`)).json;
  check("current stock and expected monthly output are separate (AT-L1-007)", regrindForC.quantity === 500 && regrindForC.recurrenceQuantity === 500 && regrindForC.recurrencePeriod === "monthly");
  check("€400/t stays as entered, the requester pays (AT-L1-008)", regrindForC.priceAmount === 400 && regrindForC.priceUnitKey === "t" && regrindForC.payer === "requester");
  const edited = await b.put(`/api/my/offers/${offerB}`, { ...regrind, quantity: 350, expectedRevision: 2 });
  check("B lowers the stock to 350 kg (AT-L1-011)", edited.status === 200 && edited.json.revision === 3, edited.text.slice(0, 200));
  const found = (await c.get(`/api/offers?scope=radius&radiusKm=25&formId=${formId("regrind")}&typeId=${typeId("hdpe")}&frequency=recurring`)).json.offers;
  check("discovery shows the new stock; the expected output did not change it", found.length === 1 && found[0].quantity === 350 && found[0].recurrenceQuantity === 500);
  const stale = await b.put(`/api/my/offers/${offerB}`, { ...regrind, quantity: 500, expectedRevision: 2 });
  check("a stale edit is rejected with the current revision (NT-L1-011)", stale.status === 409 && stale.json.currentRevision === 3, stale.text.slice(0, 200));
  check("… and cannot silently restore the old quantity", (await b.get(`/api/my/offers/${offerB}`)).json.input.quantity === 350);
  check("a minimum lot above the stock is refused (NT-L1-007)", (await b.put(`/api/my/offers/${offerB}`, { ...regrind, quantity: 200, expectedRevision: 3 })).status === 422);

  section("Scenario 4 – Site C assesses the recurring supply");
  const evaluated = (await c.get(`/api/offers/${offerB}`)).json;
  check("stated particle size is there, melt flow rate stays unknown (AT-L1-016)", evaluated.attributes.particle_size?.valueMax === 6 && evaluated.attributes.melt_flow_rate === undefined);
  check("verified site and self-declared material are separate statuses (NT-L1-016)", evaluated.supplier.verified === true && evaluated.evidenceStatus === "self_declared");
  check("a sample on enquiry is visible without implying a test (AT-L1-010)", evaluated.sampleAvailable === "yes" && evaluated.datasheetAvailable === true && evaluated.datasheetAccess === "on_enquiry");
  const ask = await c.post(`/api/offers/${offerB}/enquiries`, { topic: "sample", message: "Bitte Datenblatt mit Schmelzflussrate oder ein Muster sowie ein Angebot frei Haus." });
  check("C asks for a datasheet or sample and a delivered quote", ask.status === 200);
  const reply = await b.post(`/api/my/enquiries/${ask.json.id}/response`, { response: "Ein Muster von 5 kg ist möglich. Messwerte zur Schmelzflussrate liegen nicht vor." });
  check("B answers the enquiry", reply.status === 200, reply.text.slice(0, 200));
  check("an enquiry is answered once", (await b.post(`/api/my/enquiries/${ask.json.id}/response`, { response: "Zweite Antwort" })).status === 409);
  check("A cannot answer an enquiry addressed to B", (await a.post(`/api/my/enquiries/${ask.json.id}/response`, { response: "Fremde Antwort" })).status === 404);
  const sentC = (await c.get("/api/my/enquiries")).json.enquiries;
  check("C reads the answer; the journey ends without a demand record", sentC.length === 1 && sentC[0].direction === "sent" && sentC[0].response.includes("Muster"));

  section("Review 2026-11-26 – limits and locks under parallel requests");
  const batchD = local.offers[0].id;
  const flood = await Promise.all(Array.from({ length: 12 }, (_, i) => c.post(`/api/offers/${batchD}/enquiries`, { topic: "other", message: `Parallele Anfrage Nummer ${i + 1} zum selben Angebot.` })));
  const stored = (await db.query("select count(*)::int as n from enquiries where offer_id = $1", [batchD])).rows[0].n;
  check("12 parallel enquiries cannot pass the limit of 5 per offer and day", stored === 5 && flood.filter((r) => r.status === 200).length === 5 && flood.filter((r) => r.status === 429).length === 7, `stored ${stored}, statuses ${flood.map((r) => r.status).join(",")}`);
  let bypassed = 0;
  for (let round = 0; round < 6; round += 1) {
    const draft = (await b.post("/api/my/offers", regrind)).json.id;
    // publish and, at the same moment, a thinned-out edit aimed at the revision the publish will produce
    await Promise.all([b.post(`/api/my/offers/${draft}/publish`, {}), b.put(`/api/my/offers/${draft}`, { title: "Ausgedünnt", expectedRevision: 2 })]);
    const after = (await b.get(`/api/my/offers/${draft}`)).json;
    if (after.status === "active" && (after.input.description === null || after.input.deliveryOptions.length === 0)) bypassed += 1;
    if (after.status === "active") await b.post(`/api/my/offers/${draft}/close`, {});
    else await b.delete(`/api/my/offers/${draft}`);
  }
  check("an edit racing a publish never leaves an active offer that skipped the publish rules", bypassed === 0, `${bypassed} of 6 rounds`);
  check("publish with a revision that is not the current one is refused", await (async () => {
    const draft = (await b.post("/api/my/offers", regrind)).json.id;
    const ahead = await b.post(`/api/my/offers/${draft}/publish`, { expectedRevision: 2 });
    await b.delete(`/api/my/offers/${draft}`);
    return ahead.status === 409 && ahead.json.reason === "STALE";
  })());

  section("Scenario 1, step 3 – Site A closes the batch (L1-012)");
  const closed = await a.post(`/api/my/offers/${offerA}/close`, {});
  check("A closes the offer", closed.status === 200 && closed.json.status === "closed");
  const again = await a.post(`/api/my/offers/${offerA}/close`, {});
  check("closing twice is safe (NT-L1-012)", again.status === 200 && again.json.revision === closed.json.revision);
  check("search omits the closed batch (AT-L1-012)", !(await b.get(`/api/offers?scope=radius&radiusKm=100`)).json.offers.some((offer) => offer.id === offerA));
  const savedUrl = (await b.get(`/api/offers/${offerA}`)).json;
  check("the saved detail URL shows unavailable and nothing else", savedUrl.unavailable === true && savedUrl.status === "closed" && savedUrl.quantity === undefined);
  check("a closed listing takes no new enquiry (NT-L1-017)", (await b.post(`/api/offers/${offerA}/enquiries`, { topic: "other", message: "Ist die Charge doch noch verfügbar?" })).status === 409);
  check("it stays under My offers", (await a.get("/api/my/offers")).json.offers.some((offer) => offer.id === offerA && offer.status === "closed"));
  check("a closed listing cannot be edited or published again", (await a.put(`/api/my/offers/${offerA}`, { ...hdpeOffcuts, expectedRevision: closed.json.revision })).status === 409 && (await a.post(`/api/my/offers/${offerA}/publish`, {})).status === 409);

  section("Ownership (NT-L1-004, X-01)");
  check("A cannot read B's offer through the owner endpoint", (await a.get(`/api/my/offers/${offerB}`)).status === 404);
  check("A cannot edit B's offer", (await a.put(`/api/my/offers/${offerB}`, { ...regrind, quantity: 1, expectedRevision: 3 })).status === 404);
  check("A cannot close, publish or delete B's offer", (await a.post(`/api/my/offers/${offerB}/close`, {})).status === 404 && (await a.post(`/api/my/offers/${offerB}/renew`, {})).status === 404 && (await a.delete(`/api/my/offers/${offerB}`)).status === 404);
  check("B's offer is untouched", (await b.get(`/api/my/offers/${offerB}`)).json.input.quantity === 350);
  check("My offers lists only the own site's records", (await a.get("/api/my/offers")).json.offers.every((offer) => offer.site.name === "Werk A"));
  check("a member cannot verify a site (AT-L1-003)", (await a.post("/api/admin/sites/1/verification", { status: "verified" })).status === 403 && (await a.get("/api/admin/sites")).status === 403);
  check("a member cannot switch a category", (await a.post(`/api/admin/categories/${metals.id}`, { enabled: true })).status === 403);
  check("the profile update cannot change the verification status", (await a.put("/api/my/site", { description: "Neu", contactName: "Kontakt Werk A", contactEmail: "site-a@kreiswerts.example", contactPhone: null, capabilities: ["cutting"], contactVisible: false, publicListed: true, verificationStatus: "declined", streetAddress: "Hack 1" })).status === 200 && (await a.get("/api/my/site")).json.verificationStatus === "verified" && (await a.get("/api/my/site")).json.streetAddress === "Musterstraße 1");
  const hiddenContact = (await b.get("/api/sites/" + (await a.get("/api/my/site")).json.id)).json.site;
  check("a site that hides its contact shares none with other members (NT-L1-018)", hiddenContact.contact === null && !JSON.stringify(hiddenContact).includes("Musterstraße"));

  section("Validation and request forgery (NT-L1-005, X-02, X-08)");
  const negative = await a.post("/api/my/offers", { ...hdpeOffcuts, quantity: -5 });
  check("negative quantity → 400 with the field", negative.status === 400 && negative.json.fields.some((f) => f.field === "quantity"), negative.text.slice(0, 200));
  const badUnit = await a.post("/api/my/offers", { ...hdpeOffcuts, unitKey: "m3" });
  check("unit not permitted for plastics → 422", badUnit.status === 422 && badUnit.json.fields[0].code === "UNIT_NOT_PERMITTED");
  const incomplete = (await a.post("/api/my/offers", { title: "Unvollständiger Entwurf" })).json.id;
  const refuse = await a.post(`/api/my/offers/${incomplete}/publish`, {});
  check("an incomplete draft never becomes active", refuse.status === 422 && refuse.json.fields.length > 5 && (await a.get(`/api/my/offers/${incomplete}`)).json.status === "draft");
  check("errors carry a request id and no internals", typeof refuse.json.requestId === "string" && !/select |insert |stack|node_modules/i.test(refuse.text));
  const fcaWithoutPlace = (await a.post("/api/my/offers", { ...hdpeOffcuts, deliveryOptions: [{ term: "fca" }] })).json.id;
  const noPlace = await a.post(`/api/my/offers/${fcaWithoutPlace}/publish`, {});
  check("formal FCA without a named place is rejected (NT-L1-009)", noPlace.status === 422 && noPlace.json.fields.some((f) => f.code === "NAMED_PLACE_REQUIRED"));
  check("a draft can be deleted, a published listing cannot", (await a.delete(`/api/my/offers/${incomplete}`)).status === 200 && (await a.delete(`/api/my/offers/${fcaWithoutPlace}`)).status === 200 && (await b.delete(`/api/my/offers/${offerB}`)).status === 409);
  check("write without Origin header → 403", (await a.post("/api/my/offers", hdpeOffcuts, { origin: null })).status === 403);
  check("write from another origin → 403", (await a.post("/api/my/offers", hdpeOffcuts, { origin: "https://evil.example" })).status === 403);
  check("write as a plain form body → 415", (await a.request("POST", "/api/my/offers", JSON.stringify(hdpeOffcuts), { "content-type": "text/plain" })).status === 415);
  check("malformed JSON → 400", (await a.request("POST", "/api/my/offers", "{not json")).status === 400);
  check("oversized body → 413", (await a.post("/api/my/offers", { ...hdpeOffcuts, description: "x".repeat(70_000) })).status === 413);
  check("unknown id formats answer 404, not 500", (await a.get("/api/offers/abc")).status === 404 && (await a.get("/api/offers/999999999")).status === 404 && (await a.get("/api/sites/-1")).status === 404);

  section("Verification gate (L1-003, D03)");
  const e = await login("site_e");
  check("a pending site reads its own profile", (await e.get("/api/my/site")).json.verificationStatus === "pending");
  const draftE = (await e.post("/api/my/offers", { ...hdpeOffcuts, deliveryOptions: [{ term: "exw", namedPlace: "Standort E, Duisburg" }] })).json?.id;
  check("a pending site may save a draft", Number.isInteger(draftE));
  check("a pending site cannot publish (NT-L1-003)", (await e.post(`/api/my/offers/${draftE}/publish`, {})).json.error === "NOT_VERIFIED");
  check("a pending site cannot browse offers, map or directory", (await e.get("/api/offers")).status === 403 && (await e.get("/api/map")).status === 403 && (await e.get("/api/sites")).status === 403 && (await e.get(`/api/offers/${offerB}`)).status === 403);
  check("a pending site cannot enquire", (await e.post(`/api/offers/${offerB}/enquiries`, { topic: "other", message: "Anfrage von einem ungeprüften Standort." })).status === 403);
  check("a pending site is not in the directory", !(await a.get("/api/sites")).json.sites.some((site) => site.name === "Standort E"));

  check("a site's demo password does not open the administrator login", (await (async () => { await paced(); return new Client("x").post("/api/auth/sign-in/username", { username: "admin_demo", password: PASSWORD }); })()).status === 401);
  const admin = await login("admin_demo", ADMIN_PASSWORD);
  const reviewList = (await admin.get("/api/admin/sites")).json;
  const review = reviewList.sites;
  const siteE = review.find((site) => site.name === "Standort E");
  check("the review list opens with the sites that are waiting, and counts every status", review.every((site) => site.status === "pending") && Boolean(siteE) && reviewList.counts.pending === 1 && reviewList.counts.verified === SITES.filter((site) => site.status === "verified").length, JSON.stringify(reviewList.counts));
  check("declining needs a note", (await admin.post(`/api/admin/sites/${siteE.id}/verification`, { status: "declined" })).status === 409);
  const verify = await admin.post(`/api/admin/sites/${siteE.id}/verification`, { status: "verified", note: "Fiktiver Standort, im Test geprüft.", latitude: 51.4192, longitude: 6.6834 });
  check("the administrator verifies Site E and enters its position", verify.status === 200, verify.text.slice(0, 200));
  const verifiedList = (await admin.get("/api/admin/sites?status=verified")).json;
  check("reviewer, time and audit trail are recorded (X-04)", verifiedList.sites.find((site) => site.id === siteE.id).history[0]?.to === "verified" && verifiedList.sites.every((site) => site.status === "verified"));
  check("the verification takes effect with the next request: E publishes", (await e.post(`/api/my/offers/${draftE}/publish`, {})).status === 200);
  check("verifying the site did not change the evidence of the material", (await a.get(`/api/offers/${draftE}`)).json.evidenceStatus === "self_declared");
  await admin.post(`/api/admin/sites/${siteE.id}/verification`, { status: "pending", note: "Erneute Prüfung im Test." });
  check("review: a site set back to pending cannot change its published offer", (await e.put(`/api/my/offers/${draftE}`, { ...hdpeOffcuts, deliveryOptions: [{ term: "exw", namedPlace: "Standort E, Duisburg" }], quantity: 1, expectedRevision: 2 })).json.error === "NOT_VERIFIED");
  check("… and its offer is out of discovery while the site is not verified", !(await a.get("/api/offers?scope=radius&radiusKm=100")).json.offers.some((offer) => offer.id === draftE) && (await a.get(`/api/offers/${draftE}`)).status === 404);
  check("… until it is verified again", (await admin.post(`/api/admin/sites/${siteE.id}/verification`, { status: "verified", note: "Fiktiver Standort, im Test geprüft." })).status === 200 && (await a.get(`/api/offers/${draftE}`)).status === 200);
  check("the administrator cannot create or publish offers", (await admin.post("/api/my/offers", hdpeOffcuts)).status === 403);
  check("the administrator can read listings but not enquire", (await admin.get("/api/offers")).status === 200 && (await admin.post(`/api/offers/${offerB}/enquiries`, { topic: "other", message: "Anfrage der Administration." })).status === 403);
  const off = await admin.post(`/api/admin/categories/${plastics.id}`, { enabled: false });
  const blocked = (await b.post("/api/my/offers", regrind)).json.id;
  check("a disabled category cannot be published (NT-L1-006)", off.status === 200 && (await b.post(`/api/my/offers/${blocked}/publish`, {})).json.fields?.some((f) => f.code === "CATEGORY_DISABLED"));
  check("… and is enabled again", (await admin.post(`/api/admin/categories/${plastics.id}`, { enabled: true })).json.enabled === true && (await b.delete(`/api/my/offers/${blocked}`)).status === 200);

  section("Registration: company → site → account (L1-001)");
  const fresh = new Client("new");
  const stamp = Date.now().toString(36);
  await paced();
  const signUp = await fresh.post("/api/auth/sign-up/email", {
    name: `neu_${stamp}`, username: `neu_${stamp}`, email: `neu-${stamp}@kreiswerts.example`, password: PASSWORD,
    companyName: "Musterplast Fertigung GmbH (fiktiv)", vatId: "DE000000001", materialInterest: "plastics", role: "admin", siteId: 1,
  });
  check("sign-up cannot set role or site – the fields are refused or dropped", signUp.status === 200 ? (await fresh.get("/api/admin/sites")).status === 403 : signUp.status === 400, `HTTP ${signUp.status}`);
  if (signUp.status !== 200) {
    await paced();
    const retry = await fresh.post("/api/auth/sign-up/email", { name: `neu_${stamp}`, username: `neu_${stamp}`, email: `neu-${stamp}@kreiswerts.example`, password: PASSWORD, companyName: "Musterplast Fertigung GmbH (fiktiv)", vatId: "DE000000001", materialInterest: "plastics" });
    check("sign-up without the forbidden fields works", retry.status === 200, retry.text.slice(0, 200));
  }
  check("an account without a site can only finish the registration", (await fresh.get("/api/my/offers")).json.error === "NO_SITE" && (await fresh.get("/api/offers")).json.error === "NO_SITE");
  const park = catalogue.parks.find((entry) => entry.name.includes("Nord-Kamperbruch"));
  const siteBody = { industry: "manufacturing", siteName: "Werk A (zweite Anmeldung)", streetAddress: "Musterstr. 1", postalCode: "47475", city: "Kamp-Lintfort", parkId: park.id, contactName: "Neue Person", contactPhone: null, capabilities: [], verificationStatus: "verified" };
  const registered = await fresh.post("/api/registration/site", siteBody);
  check("the site step creates a pending site", registered.status === 200 && (await fresh.get("/api/my/site")).json.verificationStatus === "pending", registered.text.slice(0, 200));
  check("review: the answer does not reveal whether the address is already registered", JSON.stringify(Object.keys(registered.json)) === '["siteId"]');
  check("one account, one site: a second site step is refused", (await fresh.post("/api/registration/site", siteBody)).status === 409);
  const flagged = (await admin.get("/api/admin/sites")).json.sites.find((site) => site.id === registered.json.siteId);
  check("the administrator sees the duplicate claim; no second active owner exists (NT-L1-001)", flagged.duplicateOf?.name === "Werk A" && flagged.status === "pending" && flagged.claimedCompanyName === "Musterplast Fertigung GmbH (fiktiv)");
  check("review: a pending claim on a VAT ID does not list the company's other sites", (await fresh.get(`/api/sites/${registered.json.siteId}`)).json.site.otherSites.length === 0);
  check("review: company name and VAT ID are fixed once the account has a site", (await fresh.post("/api/auth/update-user", { companyName: "Andere Firma GmbH" })).status === 400 && (await fresh.post("/api/auth/update-user", { vatId: "DE000000002" })).status === 400);
  const rename = await a.post("/api/auth/update-user", { username: "site_b" });
  check("review: the login name cannot be changed (no probing of names that exist)", rename.status === 400 && rename.json?.code !== "USERNAME_IS_ALREADY_TAKEN", `${rename.status} ${rename.json?.code}`);
  const draftOfFresh = (await fresh.post("/api/my/offers", { title: "Entwurf vor der Ablehnung" })).json.id;
  await admin.post(`/api/admin/sites/${registered.json.siteId}/verification`, { status: "declined", note: "Dublette von Werk A." });
  check("review: a declined site can neither create, change nor delete drafts", (await fresh.post("/api/my/offers", { title: "Neuer Entwurf" })).json.error === "NOT_VERIFIED" && (await fresh.put(`/api/my/offers/${draftOfFresh}`, { title: "Geändert", expectedRevision: 1 })).json.error === "NOT_VERIFIED" && (await fresh.delete(`/api/my/offers/${draftOfFresh}`)).json.error === "NOT_VERIFIED" && (await fresh.get("/api/my/offers")).json.offers.length === 1);
  const profile = { description: "x", contactName: "Neue Person", contactEmail: "neu@kreiswerts.example", contactPhone: null, capabilities: [], contactVisible: true, publicListed: true };
  check("review: a declined site reads the reason but cannot change its profile", (await fresh.put("/api/my/site", profile)).json.error === "NOT_VERIFIED" && (await fresh.get("/api/my/site")).json.verificationNote === "Dublette von Werk A.");

  // Company squatting: the first registration names the company row, the first VERIFIED site decides the name.
  const signUp2 = async (name, companyName) => {
    const client = new Client(name);
    await paced();
    const result = await client.post("/api/auth/sign-up/email", { name, username: name, email: `${name.replace("_", "-")}@kreiswerts.example`, password: PASSWORD, companyName, vatId: "DE999999990", materialInterest: "plastics" });
    if (result.status !== 200) throw new Error(`sign-up ${name} failed: ${result.status} ${result.text.slice(0, 200)}`);
    return client;
  };
  const squatter = await signUp2(`sq_${stamp}`, "Falscher Name GmbH");
  await squatter.post("/api/registration/site", { ...siteBody, siteName: "Briefkasten", streetAddress: "Irgendwo 1" });
  const real = await signUp2(`re_${stamp}`, "Echte Firma GmbH (fiktiv)");
  const realSite = (await real.post("/api/registration/site", { ...siteBody, siteName: "Hauptwerk", streetAddress: "Werkstraße 7" })).json.siteId;
  check("review: an unverified claim names the company only until a site is verified", (await real.get("/api/my/site")).json.companyName === "Falscher Name GmbH");
  await admin.post(`/api/admin/sites/${realSite}/verification`, { status: "verified", note: "Fiktiver Standort, im Test geprüft." });
  check("review: the first verified site decides how the company is called for everyone", (await b.get("/api/sites?q=Hauptwerk")).json.sites[0]?.companyName === "Echte Firma GmbH (fiktiv)" && (await b.get("/api/sites?q=Falscher")).json.sites.length === 0);
  const ownOnly = (await fresh.get("/api/my/offers")).json.offers;
  check("the new branch shares the company, with its own listings only (AT-L1-001)", flagged.companyName === "Musterplast Fertigung GmbH (fiktiv)" && ownOnly.length === 1 && ownOnly[0].id === draftOfFresh);
  check("the directory lists branches as separate sites (AT-L1-018)", (await b.get("/api/sites?q=Musterplast")).json.sites.map((site) => site.name).sort().join() === "Werk A,Werk D");
  const profileD = (await b.get(`/api/sites/${(await b.get("/api/sites?q=Werk D")).json.sites[0].id}`)).json;
  check("a branch profile lists only that branch's offers", profileD.offers.length === 2 && profileD.offers.every((offer) => offer.site.name === "Werk D") && profileD.site.otherSites.some((site) => site.name === "Werk A"));

  section("Password recovery and logout (L1-002)");
  const known = await guest.post("/api/auth/request-password-reset", { email: "site-e@kreiswerts.example", redirectTo: "/reset-password" });
  const unknown = await guest.post("/api/auth/request-password-reset", { email: "niemand@kreiswerts.example", redirectTo: "/reset-password" });
  check("the recovery answer is the same for a known and an unknown address", known.status === 200 && unknown.status === 200 && known.text === unknown.text, `${known.status} ${unknown.status}`);
  if (LOG) {
    await sleep(500);
    const links = [...readFileSync(LOG, "utf8").matchAll(/reset-password\/([A-Za-z0-9_-]+)/g)];
    const token = links.at(-1)?.[1];
    check("without a mail provider exactly one link reached the server log", links.length === 1 && Boolean(token));
    // the link itself: opening it leads to the page for a new password, with the token in the address
    const link = await guest.request("GET", `/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent("/reset-password")}`);
    check("the logged link leads to the reset page of this app", link.status === 302 || link.status === 307, `HTTP ${link.status}`);
    check("the reset page answers", (await guest.get(`/reset-password?token=${token}`)).status === 200 && (await guest.get("/forgot-password")).status === 200);
    const newPassword = `${PASSWORD}-Neu9`;
    check("a weak new password is refused", (await guest.post("/api/auth/reset-password", { newPassword: "kurz", token })).status === 400);
    check("the token resets the password", (await guest.post("/api/auth/reset-password", { newPassword, token })).status === 200);
    check("a consumed token cannot be used again (AT-L1-002)", (await guest.post("/api/auth/reset-password", { newPassword: `${newPassword}x`, token })).status === 400);
    check("the reset ended the existing session of the account", (await e.get("/api/my/site")).status === 401);
    const relogged = await login("site_e", newPassword);
    check("login works with the new password", (await relogged.get("/api/my/site")).status === 200);
  }
  const d1 = await login("site_d");
  const d2 = await login("site_d");
  await paced(); // /change-password shares the strict login limit
  const changed = await d1.post("/api/auth/change-password", { currentPassword: PASSWORD, newPassword: `${PASSWORD}-D8`, revokeOtherSessions: false });
  check("review: changing the password ends the other sessions, whatever the request asks for", changed.status === 200 && (await d2.get("/api/my/site")).status === 401, `HTTP ${changed.status}`);
  await c.post("/api/auth/sign-out", {});
  check("logout invalidates the session (NT-L1-002)", (await c.get("/api/my/offers")).status === 401);

  {
    section("Expiry (L1-007, D05) – the date is moved in the test database");
    await db.query("update offers set expires_at = now() - interval '1 day' where id = $1", [offerB]);
    check("after the expiry date the offer leaves discovery (AT-L1-007)", !(await a.get("/api/offers?scope=radius&radiusKm=100")).json.offers.some((offer) => offer.id === offerB));
    check("its detail shows unavailable to others, expired to the owner", (await a.get(`/api/offers/${offerB}`)).json.status === "expired" && (await b.get("/api/my/offers")).json.offers.find((offer) => offer.id === offerB).status === "expired");
    check("an expired listing takes no enquiry", (await a.post(`/api/offers/${offerB}/enquiries`, { topic: "other", message: "Ist das Mahlgut noch verfügbar?" })).status === 409);
    check("renewing validates again and makes it discoverable", (await b.post(`/api/my/offers/${offerB}/renew`, {})).status === 200 && (await a.get("/api/offers?scope=radius&radiusKm=100")).json.offers.some((offer) => offer.id === offerB));
    const counts = (await db.query("select (select count(*)::int from enquiries where offer_id = any($2)) as enquiries, (select count(*)::int from offer_revisions where offer_id = $1) as revisions", [offerB, [offerA, offerB]])).rows[0];
    check("history: every saved state of the offer is retrievable (X-04)", counts.revisions === 4, `revisions ${counts.revisions}`);
    check("the scenarios left exactly their two enquiries – contacting created nothing else", counts.enquiries === 2, `enquiries ${counts.enquiries}`);
    const cases = (await db.query("select count(*)::int as n from demo_cases")).rows[0].n;
    check("the five cases A–E are still there, untouched by search, enquiry and close (NT-L1-021)", cases === 5);
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  FAIL ${failure}`);
}

main()
  .catch((error) => {
    console.error("\nRun aborted:", error);
    failures.push("run aborted");
  })
  .finally(async () => {
    await db.end().catch(() => {});
    process.exit(failures.length === 0 ? 0 : 1);
  });
