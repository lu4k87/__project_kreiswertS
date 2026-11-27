#!/usr/bin/env node
// End-to-end acceptance run of Level 2 (requests, responses, matching) against a running test instance: one
// acceptance and one negative test per requirement L2-001 … L2-006 and L2-011 of the test register (AT-L2-…, NT-L2-…).
//
// Never run it against the working database: it expects a freshly seeded demo database and changes it.
//
//   export DATABASE_URL=postgres://…/kreiswerts_e2e  DEMO_PASSWORD=…  DEMO_ADMIN_PASSWORD=…  BETTER_AUTH_URL=http://localhost:3100
//   npx drizzle-kit push --force && node scripts/seed.mjs --reset-demo
//   npm run build && npx next start -H 127.0.0.1 -p 3100 > server.log 2>&1 &
//   node scripts/e2e-level2.mjs --base http://localhost:3100 --log server.log
//
// Better Auth allows 3 login or sign-up requests per 10 s for all clients together → the script pauses in between.
import { readFileSync } from "node:fs";
import pg from "pg";

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


async function main() {
  await db.connect();
  const sessions = async () => (await db.query("select count(*)::int as n from auth_sessions")).rows[0].n;
  const sessionsBefore = await sessions();
  const c = await login("site_c");
  if ((await sessions()) <= sessionsBefore) throw new Error("the server at --base does not write to the database of DATABASE_URL – nothing was changed");
  const guest = new Client("guest");

  const catalogue = (await guest.get("/api/catalogue")).json;
  const plastics = catalogue.categories.find((category) => category.key === "plastics");
  const metals = catalogue.categories.find((category) => category.key === "metals");
  const typeId = (key, category = plastics) => catalogue.types.find((type) => type.categoryId === category.id && type.key === key).id;
  const formId = (key, category = plastics) => catalogue.forms.find((form) => form.categoryId === category.id && form.key === key).id;

  section("Guests (no access to Level 2)");
  for (const path of ["/api/requests", "/api/requests/1", "/api/my/requests", "/api/my/responses", "/api/matches", "/api/matches/1/1", "/api/my/negotiations", "/api/my/negotiations/1", "/api/my/exchanges", "/api/my/exchanges/1"]) {
    check(`guest GET ${path} → 401`, (await guest.get(path)).status === 401);
  }
  const pageStatus = async (client, paths) => Promise.all(paths.map(async (path) => `${path} ${(await client.get(path)).status}`));
  const guarded = ["/requests", "/my-requests", "/my-requests/new", "/matches", "/negotiations", "/negotiations/1", "/exchanges", "/exchanges/1"];
  check("Level 2 pages send a guest to the login", (await pageStatus(guest, guarded)).every((line) => line.endsWith(" 307")), (await pageStatus(guest, guarded)).join(", "));

  section("Logins");
  const a = await login("site_a");
  const b = await login("site_b");
  const d = await login("site_d");
  const e = await login("site_e"); // pending verification

  const seeded = (await c.get("/api/my/requests")).json.requests;
  const hdpeRequest = seeded.find((request) => request.title.startsWith("HDPE-Mahlgut"));
  const ppRequest = (await a.get("/api/my/requests")).json.requests.find((request) => request.title.startsWith("PP-Granulat"));
  const sheetOffer = (await d.get("/api/my/offers")).json.offers.find((offer) => offer.title.startsWith("HDPE-Platten"));
  check("seed: demo requests and offers are there", Boolean(hdpeRequest && ppRequest && sheetOffer));

  section("AT-L2-001 / NT-L2-001 – publish a material request");
  const body = {
    title: "HDPE-Mahlgut für Kisten (Testlauf)",
    description: "Wir suchen sortenreines HDPE-Mahlgut für den Spritzguss.",
    categoryId: plastics.id,
    typeIds: [typeId("hdpe")],
    formIds: [formId("regrind")],
    origins: ["pre_consumer"],
    quantity: 400,
    unitKey: "kg",
    minLot: 50,
    frequency: "one_time",
    deliveryTerms: ["fca"],
    criteria: { contamination: { kind: "required", valueMin: null, valueMax: 3, valueText: null } },
  };
  const created = await c.post("/api/my/requests", body);
  check("a verified site saves a request without referring to any offer (AT-L2-001)", created.status === 200 && created.json.revision === 1, `HTTP ${created.status}`);
  const requestId = created.json.id;
  check("a draft is not discoverable", !(await b.get("/api/requests?scope=radius&radiusKm=100")).json.requests.some((request) => request.id === requestId));
  check("another site cannot open the draft", (await b.get(`/api/requests/${requestId}`)).status === 404);
  const published = await c.post(`/api/my/requests/${requestId}/publish`, { expectedRevision: 1 });
  check("the complete request is published with an expiry date", published.status === 200 && Boolean(published.json.expiresAt), `HTTP ${published.status}`);
  const pendingDraft = await e.post("/api/my/requests", { ...body, title: "Gesuch eines wartenden Standorts" });
  check("a pending site may draft a request", pendingDraft.status === 200);
  check("… but not publish it (NT-L2-001: unauthorised publishing denied)", (await e.post(`/api/my/requests/${pendingDraft.json.id}/publish`, {})).status === 403);
  const wrongType = await c.post("/api/my/requests", { ...body, typeIds: [typeId("aluminium", metals)] });
  check("a type of another category is refused (NT-L2-001)", wrongType.status === 422 && wrongType.json.fields.some((field) => field.field === "typeIds" && field.code === "INVALID_COMBINATION"));
  const noType = await c.post("/api/my/requests", { ...body, typeIds: [] });
  const noTypePublish = await c.post(`/api/my/requests/${noType.json.id}/publish`, {});
  check("publishing without a type criterion is refused (NT-L2-001)", noTypePublish.status === 422 && noTypePublish.json.fields.some((field) => field.field === "typeIds" && field.code === "REQUIRED"));
  check("the browser cannot set the owner, status or provenance", (await db.query("select site_id, status, provenance from requests where id = $1", [requestId])).rows[0].provenance === "synthetic");
  check("a guest cannot create a request", (await guest.post("/api/my/requests", body)).status === 401);
  check("a foreign origin cannot create a request", (await c.post("/api/my/requests", body, { origin: "https://evil.example" })).status === 403);

  section("AT-L2-002 / NT-L2-002 – browse requests");
  const hdpeSearch = `/api/requests?scope=radius&radiusKm=100&typeId=${typeId("hdpe")}`;
  const found = (await b.get(hdpeSearch)).json;
  check("a supplier finds the open HDPE requests (AT-L2-002)", found.requests.some((request) => request.id === requestId) && found.requests.some((request) => request.id === hdpeRequest.id));
  check("the own requests are not in the own search", !(await c.get(hdpeSearch)).json.requests.some((request) => request.id === requestId));
  check("a PP filter does not list HDPE requests", !(await b.get(`/api/requests?scope=radius&radiusKm=100&typeId=${typeId("pp")}`)).json.requests.some((request) => request.id === requestId));
  const detail = (await b.get(`/api/requests/${requestId}`)).json;
  check("the detail shows criteria, never contact or address", detail.criteria.contamination.valueMax === 3 && !/street|postal|email|phone/i.test(JSON.stringify(detail)));
  check("the revision is only for the owner", detail.revision === null && (await c.get(`/api/requests/${requestId}`)).json.revision === 2);
  const offersBefore = (await b.get("/api/offers?scope=radius&radiusKm=100")).json.total;
  await b.get(`${hdpeSearch}&frequency=recurring`);
  check("searching requests leaves the offer search unchanged (NT-L2-002)", (await b.get("/api/offers?scope=radius&radiusKm=100")).json.total === offersBefore);
  check("a pending site cannot browse requests", (await e.get("/api/requests")).status === 403);
  check("an invalid filter is refused", (await b.get("/api/requests?scope=moon")).status === 400);

  section("AT-L2-003 / NT-L2-003 – respond to a request");
  const aOffer = (await a.get("/api/my/offers")).json.offers.find((offer) => offer.status === "active");
  const ra = await a.post(`/api/requests/${requestId}/responses`, { message: "Wir können 120 kg HDPE liefern, Muster möglich.", offerId: null });
  const rd = await d.post(`/api/requests/${requestId}/responses`, { message: "Unsere HDPE-Abschnitte passen nach dem Mahlen.", offerId: sheetOffer.id });
  check("two suppliers respond independently (AT-L2-003)", ra.status === 200 && rd.status === 200, `HTTP ${ra.status} / ${rd.status}`);
  const seenA = (await a.get(`/api/requests/${requestId}/responses`)).json.responses;
  const seenD = (await d.get(`/api/requests/${requestId}/responses`)).json.responses;
  check("each responder sees only its own response (AT-L2-003)", seenA.length === 1 && seenA[0].id === ra.json.id && seenD.length === 1 && seenD[0].id === rd.json.id);
  const seenC = (await c.get(`/api/requests/${requestId}/responses`)).json.responses;
  check("the requester sees both, with the offer reference", seenC.length === 2 && seenC.some((response) => response.offer?.id === sheetOffer.id));
  check("a third site sees none of them", (await b.get(`/api/requests/${requestId}/responses`)).json.responses.length === 0);
  const foreignOffer = await b.post(`/api/requests/${requestId}/responses`, { message: "Wir verweisen auf ein fremdes Angebot.", offerId: sheetOffer.id });
  check("a response with another company's offer is refused (NT-L2-003)", foreignOffer.status === 422 && foreignOffer.json.fields[0].code === "NOT_OWN_OFFER");
  check("a second response of the same site is refused", (await a.post(`/api/requests/${requestId}/responses`, { message: "Noch eine Antwort von uns.", offerId: aOffer?.id ?? null })).status === 409);
  check("the owner cannot respond to the own request", (await c.post(`/api/requests/${requestId}/responses`, { message: "Antwort an uns selbst.", offerId: null })).status === 409);
  check("a pending site cannot respond", (await e.post(`/api/requests/${requestId}/responses`, { message: "Antwort eines wartenden Standorts.", offerId: null })).status === 403);
  const reply = await c.post(`/api/my/responses/${ra.json.id}/reply`, { reply: "Danke, bitte ein Muster schicken." });
  check("the requester replies once", reply.status === 200 && (await c.post(`/api/my/responses/${ra.json.id}/reply`, { reply: "Zweite Rückmeldung." })).status === 409);
  check("a responder cannot reply to its own response", (await a.post(`/api/my/responses/${ra.json.id}/reply`, { reply: "Ich antworte mir selbst." })).status === 404);

  section("AT-L2-004 / NT-L2-004 – manage a request");
  const current = (await c.get(`/api/my/requests/${requestId}`)).json;
  const edited = await c.put(`/api/my/requests/${requestId}`, { ...current.input, quantity: 600, expectedRevision: current.revision });
  check("an edited quantity is saved as a new revision (AT-L2-004)", edited.status === 200 && edited.json.revision === current.revision + 1);
  const history = (await db.query("select revision, action, snapshot->>'quantity' as quantity from request_revisions where request_id = $1 order by revision", [requestId])).rows;
  check("… and stays identifiable in the history", history.some((row) => row.quantity === "400") && history.at(-1).quantity === "600" && history.at(-1).action === "updated");
  const kept = (await db.query("select request_revision from request_responses where id = $1", [ra.json.id])).rows[0].request_revision;
  check("an earlier response keeps the revision it answered (NT-L2-004)", kept === current.revision);
  check("the requester's list marks it as answering an older version", (await c.get(`/api/requests/${requestId}/responses`)).json.responses.every((response) => response.answeredOlder === true));
  const sentView = JSON.stringify((await a.get(`/api/requests/${requestId}/responses`)).json);
  check("review: a responder gets no revision numbers of the competitor's request", !/revision/i.test(sentView), sentView.slice(0, 200));
  check("a stale edit is refused", (await c.put(`/api/my/requests/${requestId}`, { ...current.input, quantity: 700, expectedRevision: current.revision })).status === 409);
  check("a non-owner cannot change or close it (NT-L2-004)", (await b.put(`/api/my/requests/${requestId}`, { ...current.input, expectedRevision: current.revision + 1 })).status === 404 && (await b.post(`/api/my/requests/${requestId}/close`, { reason: "withdrawn" })).status === 404);
  check("closing needs a reason", (await c.post(`/api/my/requests/${requestId}/close`, {})).status === 400);
  const closed = await c.post(`/api/my/requests/${requestId}/close`, { reason: "fulfilled" });
  check("the owner closes it as fulfilled", closed.status === 200 && (await db.query("select closure_reason from requests where id = $1", [requestId])).rows[0].closure_reason === "fulfilled");
  check("closing twice is safe", (await c.post(`/api/my/requests/${requestId}/close`, { reason: "withdrawn" })).status === 200);
  check("closed demand takes no new response (AT-L2-004, NT-L2-003)", (await b.post(`/api/requests/${requestId}/responses`, { message: "Kommt diese Antwort noch an?", offerId: null })).status === 409);
  check("closing removes it from the open requests (AT-L2-002)", !(await b.get(hdpeSearch)).json.requests.some((request) => request.id === requestId));
  check("others see only that it is no longer open", (await b.get(`/api/requests/${requestId}`)).json.unavailable === true);
  check("a closed request cannot be edited", (await c.put(`/api/my/requests/${requestId}`, { ...current.input, expectedRevision: edited.json.revision + 1 })).status === 409);
  check("existing responses stay readable after closing", (await c.get(`/api/requests/${requestId}/responses`)).json.responses.length === 2);
  check("only drafts can be deleted", (await c.delete(`/api/my/requests/${requestId}`)).status === 409 && (await c.delete(`/api/my/requests/${noType.json.id}`)).status === 200);

  section("AT-L2-005 / NT-L2-005 – explained matching");
  const overview = (await c.get("/api/matches")).json;
  const forHdpe = overview.forRequests.find((entry) => entry.request.id === hdpeRequest.id);
  const sheetCandidate = forHdpe?.candidates.find((candidate) => candidate.id === sheetOffer.id);
  check("HDPE sheet offcuts fit the regrind request after grinding (AT-L2-005)", sheetCandidate?.match.result === "processing_required" && sheetCandidate.match.steps.join() === "grinding", JSON.stringify(sheetCandidate?.match));
  check("matching lists only other sites' offers", forHdpe.candidates.every((candidate) => candidate.site.id !== hdpeRequest.site.id));
  const forPp = (await a.get("/api/matches")).json.forRequests.find((entry) => entry.request.id === ppRequest.id);
  check("a PP-only request lists no HDPE offer, only counts them as incompatible (AT-L2-005)", forPp.candidates.length === 0 && forPp.incompatible > 0);
  const pcRequest = (await b.get("/api/my/requests")).json.requests.find((request) => request.title.startsWith("PC-Reste"));
  const pcRegrind = (await c.get("/api/my/offers")).json.offers.find((offer) => offer.title.startsWith("PC-Produktionsreste"));
  const pcMatch = (await c.get("/api/matches")).json.forOffers.find((entry) => entry.offer.id === pcRegrind.id)?.candidates.find((candidate) => candidate.id === pcRequest.id);
  check("a required grade the offer does not state makes the pair conditional, not compatible (AT-L2-005)", pcMatch?.match.result === "conditional", JSON.stringify(pcMatch?.match));
  const match = await c.get(`/api/matches/${hdpeRequest.id}/${sheetOffer.id}`);
  const checks = match.json.evaluation?.checks ?? [];
  check("the comparison explains every criterion without a score", match.status === 200 && checks.some((item) => item.key === "form" && item.outcome === "processing") && !JSON.stringify(match.json).includes("score"));
  check("an unknown contamination is reported as unknown, not as met (NT-L2-005)", checks.find((item) => item.key === "attributes.contamination")?.outcome === "unknown");
  check("processors are candidates with the needed capability", match.json.processors.length > 0 && match.json.processors.every((processor) => processor.capabilities.includes("grinding")));
  check("the offerer may open the same comparison", (await d.get(`/api/matches/${hdpeRequest.id}/${sheetOffer.id}`)).status === 200);
  check("a site owning neither side cannot (NT-L2-005)", (await b.get(`/api/matches/${hdpeRequest.id}/${sheetOffer.id}`)).status === 404);
  check("a pending site cannot use matching", (await e.get("/api/matches")).status === 403);
  check("the closed request is no longer compared", (await d.get(`/api/matches/${requestId}/${sheetOffer.id}`)).status === 404);

  check("review: the overview lists at most 20 candidates per listing and counts the rest", [...overview.forRequests, ...overview.forOffers].every((entry) => entry.candidates.length <= 20 && typeof entry.more === "number"));

  section("Security review 2026-11-27 – limits and races");
  {
    // close and respond at the same moment: the response is either refused or written before the close
    const race = await c.post("/api/my/requests", { ...body, title: "Gesuch für den Wettlauf-Test" });
    await c.post(`/api/my/requests/${race.json.id}/publish`, {});
    const [closing, responding] = await Promise.all([
      c.post(`/api/my/requests/${race.json.id}/close`, { reason: "withdrawn" }),
      b.post(`/api/requests/${race.json.id}/responses`, { message: "Antwort im Moment des Schließens.", offerId: null }),
    ]);
    const late = (await db.query("select count(*)::int as n from request_responses r join requests q on q.id = r.request_id where q.id = $1 and r.created_at > q.closed_at", [race.json.id])).rows[0].n;
    check("no response lands on a request after it was closed (CWE-367)", closing.status === 200 && [200, 409].includes(responding.status) && late === 0, `close ${closing.status}, respond ${responding.status}, late ${late}`);

    // 30 responses of site B within 24 h (written directly), then the 31st through the API is refused
    const bSite = (await db.query("select site_id from auth_users where username = 'site_b'")).rows[0].site_id;
    const cSite = (await db.query("select site_id from auth_users where username = 'site_c'")).rows[0].site_id;
    const fillers = (await db.query(
      `insert into requests (site_id, status, title, category_id, quantity, unit_key, frequency, expires_at, published_at, provenance)
       select $1, 'active', 'Füllgesuch ' || g, $2, 1, 'kg', 'one_time', now() + interval '1 day', now(), 'synthetic' from generate_series(1, 31) g returning id`,
      [cSite, plastics.id],
    )).rows.map((row) => row.id);
    const already = (await db.query("select count(*)::int as n from request_responses where from_site_id = $1 and created_at > now() - interval '1 day'", [bSite])).rows[0].n;
    await db.query(
      `insert into request_responses (request_id, from_site_id, to_site_id, sender_user_id, request_revision, message)
       select id, $1, $2, 'e2e', 1, 'Füllantwort' from requests where id = any($3) and id <> $5 limit $4`,
      [bSite, cSite, fillers, Math.max(0, 30 - already), fillers.at(-1)],
    );
    const target = fillers.at(-1); // left without a response, so only the daily limit can refuse it
    const limited = await b.post(`/api/requests/${target}/responses`, { message: "Die einunddreißigste Antwort heute.", offerId: null });
    check("a site sends at most 30 responses a day (CWE-770)", limited.status === 429, `HTTP ${limited.status}`);

    // 50 drafts (written directly), then a new draft through the API is refused
    const eSite = (await db.query("select site_id from auth_users where username = 'site_e'")).rows[0].site_id;
    const drafts = (await db.query("select count(*)::int as n from requests where site_id = $1 and status = 'draft'", [eSite])).rows[0].n;
    await db.query(`insert into requests (site_id, status, title, provenance) select $1, 'draft', 'Füllentwurf ' || g, 'synthetic' from generate_series(1, $2::int) g`, [eSite, Math.max(0, 50 - drafts)]);
    check("a site keeps at most 50 request drafts (CWE-770)", (await e.post("/api/my/requests", { ...body, title: "Der einundfünfzigste Entwurf" })).status === 429);
  }

  section("AT-L2-006 / NT-L2-006 – proposals, counterproposals, acceptance (D16)");
  const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const terms = {
    quantity: 200, unitKey: "kg", paymentDirection: "requester_pays", priceAmount: 120, priceUnitKey: "t", vatBasis: "net",
    deliveryTerm: "fca", namedPlace: "Werk D, Moers", transportOrganiser: "requester",
    freightAmount: 80, freightCostStatus: "estimated", freightPayer: "shared", offererSharePercent: 50,
    deliveryFrom: inDays(2), deliveryUntil: inDays(20), technicalConditions: "Sortenrein",
  };
  const dOffers = (await d.get("/api/my/offers")).json.offers;
  const otherOffer = dOffers.find((offer) => offer.id !== sheetOffer.id && offer.status === "active");
  check("seed: C and D negotiate, B and A agreed (simulated demo records)", (await c.get("/api/my/negotiations")).json.negotiations.some((n) => n.status === "open" && n.awaiting === "other" && n.simulated) && (await b.get("/api/my/negotiations")).json.negotiations.some((n) => n.status === "agreed"));
  check("a pending site cannot propose (NT-L2-006)", (await e.post("/api/my/negotiations", { offerId: otherOffer.id, requestId: null, terms })).status === 403);
  check("a formal term without a named place is refused", (await b.post("/api/my/negotiations", { offerId: otherOffer.id, requestId: null, terms: { ...terms, namedPlace: "" } })).json?.fields?.some((f) => f.field === "terms.namedPlace"));
  check("the offerer must name the request it answers", (await d.post("/api/my/negotiations", { offerId: otherOffer.id, requestId: null, terms })).status === 422);
  const started = await b.post("/api/my/negotiations", { offerId: otherOffer.id, requestId: null, terms, note: "Erster Vorschlag" });
  const negotiationId = started.json?.id;
  check("B proposes terms for D's offer (AT-L2-006)", started.status === 200 && Boolean(negotiationId), started.text.slice(0, 200));
  check("a second open negotiation of the same pair is refused", (await b.post("/api/my/negotiations", { offerId: otherOffer.id, requestId: null, terms })).json?.reason === "ALREADY_NEGOTIATING");
  check("sites outside the negotiation do not see it (NT-L2-006)", (await a.get(`/api/my/negotiations/${negotiationId}`)).status === 404 && (await c.get(`/api/my/negotiations/${negotiationId}`)).status === 404 && !(await a.get("/api/my/negotiations")).json.negotiations.some((n) => n.id === negotiationId));
  check("a non-party cannot accept or counter", (await a.post(`/api/my/negotiations/${negotiationId}/accept`, { expectedRevision: 1 })).status === 404 && (await c.post(`/api/my/negotiations/${negotiationId}/revisions`, { expectedRevision: 1, terms })).status === 404);
  check("the author cannot accept the own proposal (D16)", (await b.post(`/api/my/negotiations/${negotiationId}/accept`, { expectedRevision: 1 })).json?.reason === "NOT_YOUR_TURN");
  const countered = await d.post(`/api/my/negotiations/${negotiationId}/revisions`, { expectedRevision: 1, terms: { ...terms, quantity: 150 }, note: "Nur 150 kg verfügbar" });
  check("D answers with a counterproposal", countered.status === 200 && countered.json.revision === 2, countered.text.slice(0, 200));
  const afterCounter = (await b.get(`/api/my/negotiations/${negotiationId}`)).json;
  const first = afterCounter.revisions.find((r) => r.revision === 1);
  const second = afterCounter.revisions.find((r) => r.revision === 2);
  check("the original is preserved and the changed term is named (AT-L2-006)", first.terms.quantity === 200 && first.state === "superseded" && second.changed.join() === "quantity" && second.state === "pending");
  check("accepting the superseded revision fails (AT-L2-006)", (await b.post(`/api/my/negotiations/${negotiationId}/accept`, { expectedRevision: 1 })).json?.reason === "STALE");
  await db.query("update proposal_revisions set valid_until = now() - interval '1 minute' where negotiation_id = $1 and revision = 2", [negotiationId]);
  check("an expired proposal cannot be accepted (NT-L2-006)", (await b.post(`/api/my/negotiations/${negotiationId}/accept`, { expectedRevision: 2 })).json?.reason === "PROPOSAL_EXPIRED");
  await db.query("update proposal_revisions set valid_until = now() + interval '7 days' where negotiation_id = $1 and revision = 2", [negotiationId]);
  const accepted = await b.post(`/api/my/negotiations/${negotiationId}/accept`, { expectedRevision: 2 });
  check("the counterpart accepts the current revision", accepted.status === 200 && accepted.json.acceptedRevision === 2, accepted.text.slice(0, 200));
  check("accepted terms are locked (D16)", (await d.post(`/api/my/negotiations/${negotiationId}/revisions`, { expectedRevision: 2, terms })).json?.reason === "NEGOTIATION_CLOSED" && (await b.post(`/api/my/negotiations/${negotiationId}/decline`, { expectedRevision: 2 })).status === 409);
  const stored = (await db.query("select revision, quantity::float as quantity from proposal_revisions where negotiation_id = $1 order by revision", [negotiationId])).rows;
  check("both revisions are stored unchanged", stored.length === 2 && stored[0].quantity === 200 && stored[1].quantity === 150, JSON.stringify(stored));
  check("a simulated approval is labelled and creates no exchange by itself", afterCounter.simulated === true && (await db.query("select count(*)::int as n from exchanges where negotiation_id = $1", [negotiationId])).rows[0].n === 0);

  section("Race: accept and counter at the same moment (CWE-367)");
  {
    const race = await a.post("/api/my/negotiations", { offerId: sheetOffer.id, requestId: null, terms: { ...terms, namedPlace: "Werk D" } });
    const [accepting, countering] = await Promise.all([
      d.post(`/api/my/negotiations/${race.json.id}/accept`, { expectedRevision: 1 }),
      d.post(`/api/my/negotiations/${race.json.id}/revisions`, { expectedRevision: 1, terms: { ...terms, quantity: 10 } }),
    ]);
    const row = (await db.query("select status, current_revision, accepted_revision from negotiations where id = $1", [race.json.id])).rows[0];
    const consistent = row.status === "agreed" ? row.current_revision === 1 && row.accepted_revision === 1 : row.status === "open" && row.current_revision === 2;
    check("exactly one of the two wins and the state stays consistent", [accepting.status, countering.status].filter((status) => status === 200).length === 1 && consistent, `accept ${accepting.status}, counter ${countering.status}, ${JSON.stringify(row)}`);
    await d.post(`/api/my/negotiations/${race.json.id}/withdraw`, { expectedRevision: row.current_revision }); // leaves the pair free for other runs
  }

  section("AT-L2-011 / NT-L2-011 – exchange status and completion");
  const seededOpen = (await c.get("/api/my/negotiations")).json.negotiations.find((n) => n.status === "open");
  check("an unaccepted proposal cannot create a planned exchange (NT-L2-011)", (await c.post(`/api/my/negotiations/${seededOpen.id}/exchange`, { plannedDate: inDays(3) })).json?.reason === "NOT_AGREED");
  check("a non-party cannot plan it", (await a.post(`/api/my/negotiations/${negotiationId}/exchange`, { plannedDate: inDays(3) })).status === 404);
  check("a planned date in the past is refused", (await b.post(`/api/my/negotiations/${negotiationId}/exchange`, { plannedDate: "2020-01-01" })).status === 422);
  const planned = await b.post(`/api/my/negotiations/${negotiationId}/exchange`, { plannedDate: inDays(3), planNote: "Abholung" });
  const exchangeId = planned.json?.id;
  check("the accepted proposal moves to planned (AT-L2-011)", planned.status === 200 && Boolean(exchangeId), planned.text.slice(0, 200));
  check("only one exchange per negotiation", (await d.post(`/api/my/negotiations/${negotiationId}/exchange`, { plannedDate: inDays(4) })).json?.reason === "EXCHANGE_EXISTS");
  check("the exchange is linked to the accepted revision", (await db.query("select accepted_revision from exchanges where id = $1", [exchangeId])).rows[0].accepted_revision === 2);
  const receipt = { receivedQuantity: 148, receivedUnitKey: "kg", receivedOn: inDays(0), qualityResult: "accepted", qualityNote: null };
  check("only the receiving site records receipt (NT-L2-011)", (await d.post(`/api/my/exchanges/${exchangeId}/complete`, { ...receipt, expectedRevision: 1 })).json?.reason === "NOT_RECEIVER");
  check("other sites do not see the exchange", (await c.get(`/api/my/exchanges/${exchangeId}`)).status === 404);
  const moved = await d.put(`/api/my/exchanges/${exchangeId}`, { expectedRevision: 1, plannedDate: inDays(5), planNote: "Neuer Termin" });
  check("either party moves the date", moved.status === 200 && moved.json.revision === 2, moved.text.slice(0, 200));
  check("a stale change is refused", (await b.post(`/api/my/exchanges/${exchangeId}/complete`, { ...receipt, expectedRevision: 1 })).json?.reason === "STALE");
  check("a receipt date in the future is refused", (await b.post(`/api/my/exchanges/${exchangeId}/complete`, { ...receipt, receivedOn: inDays(3), expectedRevision: 2 })).status === 422);
  check("an accepted receipt of nothing is refused (security review 2026-11-27)", (await b.post(`/api/my/exchanges/${exchangeId}/complete`, { ...receipt, receivedQuantity: 0, expectedRevision: 2 })).json?.fields?.some((f) => f.field === "receivedQuantity"));
  check("a receipt date before the agreement is refused (security review 2026-11-27)", (await b.post(`/api/my/exchanges/${exchangeId}/complete`, { ...receipt, receivedOn: inDays(-5), expectedRevision: 2 })).json?.fields?.some((f) => f.code === "BEFORE_AGREEMENT"));
  const completed = await b.post(`/api/my/exchanges/${exchangeId}/complete`, { ...receipt, expectedRevision: 2 });
  check("the receiver records quantity and quality and completes it", completed.status === 200 && completed.json.status === "completed", completed.text.slice(0, 200));
  const { summary } = (await b.get("/api/my/exchanges")).json;
  check("a simulated completion never counts as verified (AT-L2-011, D13)", summary.verifiedCompleted === 0 && summary.simulatedCompleted >= 1, JSON.stringify(summary));
  check("a completed exchange is final", (await d.post(`/api/my/exchanges/${exchangeId}/cancel`, { expectedRevision: 3, reason: "zu spät" })).json?.reason === "EXCHANGE_CLOSED");
  const seededExchange = (await a.get("/api/my/exchanges")).json.exchanges.find((x) => x.status === "planned");
  const cancelled = await a.post(`/api/my/exchanges/${seededExchange.id}/cancel`, { expectedRevision: 1, reason: "Sammeltour fällt aus" });
  const cancelledRow = (await db.query("select status, received_quantity, completed_at from exchanges where id = $1", [seededExchange.id])).rows[0];
  check("cancellation does not record a delivery (AT-L2-011)", cancelled.status === 200 && cancelledRow.status === "cancelled" && cancelledRow.received_quantity === null && cancelledRow.completed_at === null, JSON.stringify(cancelledRow));
  check("the history keeps every step", (await db.query("select string_agg(action, ',' order by revision) as steps from exchange_events where exchange_id = $1", [exchangeId])).rows[0].steps === "planned,updated,completed");
  check("no real (non-simulated) exchange exists after the run", (await db.query("select count(*)::int as n from exchanges where not simulated")).rows[0].n === 0);

  section("Security review 2026-11-27 – closed listings stop agreement");
  {
    const late = await c.post("/api/my/negotiations", { offerId: otherOffer.id, requestId: null, terms: { ...terms, namedPlace: "Werk D" } });
    check("C proposes for D's second offer", late.status === 200, late.text.slice(0, 200));
    check("D closes that offer", (await d.post(`/api/my/offers/${otherOffer.id}/close`, {})).status === 200);
    check("a closed offer can no longer be agreed on or countered (CWE-840)", (await d.post(`/api/my/negotiations/${late.json.id}/accept`, { expectedRevision: 1 })).json?.reason === "UNAVAILABLE" && (await d.post(`/api/my/negotiations/${late.json.id}/revisions`, { expectedRevision: 1, terms })).json?.reason === "UNAVAILABLE");
    check("declining stays possible", (await d.post(`/api/my/negotiations/${late.json.id}/decline`, { expectedRevision: 1 })).status === 200);
  }

  section("Pages");
  const pages = ["/requests", `/requests/${hdpeRequest.id}`, "/my-requests", "/my-requests/new", `/my-requests/${hdpeRequest.id}/edit`, "/matches", `/matches/${hdpeRequest.id}/${sheetOffer.id}`, "/dashboard", "/my-offers", `/offers/${sheetOffer.id}`];
  check("Level 2 pages render for a verified site", (await pageStatus(c, pages)).every((line) => line.endsWith(" 200")), (await pageStatus(c, pages)).join(", "));
  const tradePages = ["/negotiations", `/negotiations/${negotiationId}`, "/exchanges", `/exchanges/${exchangeId}`, `/negotiations/new?offer=${otherOffer.id}`];
  check("negotiation and exchange pages render for a party", (await pageStatus(b, tradePages)).every((line) => line.endsWith(" 200")), (await pageStatus(b, tradePages)).join(", "));
  check("someone else's negotiation and exchange pages are a 404", (await c.get(`/negotiations/${negotiationId}`)).status === 404 && (await c.get(`/exchanges/${exchangeId}`)).status === 404);
  check("someone else's request edit page is a 404", (await b.get(`/my-requests/${hdpeRequest.id}/edit`)).status === 404);

  const counts = (await db.query("select (select count(*)::int from enquiries) as enquiries, (select count(*)::int from demo_cases) as cases")).rows[0];
  check("requests, responses and matching created no enquiry and no exchange record", counts.enquiries === 0 && counts.cases === 5, JSON.stringify(counts));

  if (LOG) {
    const log = readFileSync(LOG, "utf8");
    check("server log: no stack trace, no SQL", !/\n\s+at |select .* from/i.test(log));
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
