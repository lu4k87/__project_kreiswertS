#!/usr/bin/env node
// End-to-end acceptance run of functions no. 41 (deadline in the listing), 46 (guide page) and 19 (saved search +
// in-app notice) of CONTENT/Functions_KreiswertS_EN.docx against a running test instance: acceptance and negative
// tests per function.
//
// Never run it against the working database: it expects a freshly seeded demo database and changes it.
//
//   export DATABASE_URL=postgres://…/kreiswerts_e2e  DEMO_PASSWORD=…  BETTER_AUTH_URL=http://localhost:3100
//   npx drizzle-kit push --force && node scripts/seed.mjs --reset-demo
//   npm run build && npx next start -H 127.0.0.1 -p 3100 > server.log 2>&1 &
//   node scripts/e2e-functions.mjs --base http://localhost:3100
//
// Better Auth allows 3 login or sign-up requests per 10 s for all clients together → the script pauses in between.
import pg from "pg";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const BASE = arg("base", "http://localhost:3100");
const PASSWORD = process.env.DEMO_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL ?? "";

if (!PASSWORD) throw new Error("DEMO_PASSWORD is missing (the password the demo logins were seeded with)");
// Refuse everything that is not provably the test instance (same guards as the Level 1 and 2 runs).
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
  async request(method, path, body) {
    const headers = { cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ") };
    if (method !== "GET") headers.origin = BASE;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (!headers.cookie) delete headers.cookie;
    const response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
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
  post = (path, body = {}) => this.request("POST", path, body);
  delete = (path) => this.request("DELETE", path, {});
}

let authRequests = 0;
async function login(username) {
  if (authRequests > 0 && authRequests % 3 === 0) {
    console.log("    (waiting 11 s: login rate limit)");
    await sleep(11_000);
  }
  authRequests += 1;
  const client = new Client();
  const result = await client.post("/api/auth/sign-in/username", { username, password: PASSWORD });
  if (result.status !== 200) throw new Error(`login ${username} failed: HTTP ${result.status} ${result.text.slice(0, 200)}`);
  return client;
}

/** Calendar day in Germany, `days` from now – the server's "today" (src/server/domain/dates.ts). */
function day(days = 0) {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function main() {
  await db.connect();
  const sessions = async () => (await db.query("select count(*)::int as n from auth_sessions")).rows[0].n;
  const sessionsBefore = await sessions();
  const b = await login("site_b");
  if ((await sessions()) <= sessionsBefore) throw new Error("the server at --base does not write to the database of DATABASE_URL – nothing was changed");
  const guest = new Client();
  const c = await login("site_c");
  const d = await login("site_d"); // same park as B (Genend)
  const e = await login("site_e"); // pending verification

  const catalogue = (await guest.get("/api/catalogue")).json;
  const plastics = catalogue.categories.find((category) => category.key === "plastics");
  const typeId = (key) => catalogue.types.find((type) => type.categoryId === plastics.id && type.key === key).id;
  const formId = (key) => catalogue.forms.find((form) => form.categoryId === plastics.id && form.key === key).id;
  const offerBody = (title, extra = {}) => ({
    title,
    description: "Saubere Abschnitte aus der Produktion, sortenrein.",
    categoryId: plastics.id,
    typeId: typeId("hdpe"),
    formId: formId("sheet"),
    origin: "pre_consumer",
    legalStatus: "by_product",
    quantity: 120,
    unitKey: "kg",
    frequency: "one_time",
    availableFrom: day(0),
    priceMode: "quotation",
    deliveryOptions: [{ term: "exw", namedPlace: "Werk D" }],
    evidenceStatus: "self_declared",
    sampleAvailable: "yes",
    ...extra,
  });
  /** Draft + publish; returns the id and the publish answer. */
  async function publish(client, body) {
    const created = await client.post("/api/my/offers", body);
    if (created.status !== 200) return { id: null, created, published: null };
    return { id: created.json.id, created, published: await client.post(`/api/my/offers/${created.json.id}/publish`, {}) };
  }

  section("No. 41 – deadline in the listing");
  const soon = await publish(d, offerBody("HDPE-Abschnitte, Abholung diese Woche (Testlauf)", { collectionUntil: day(3) }));
  const later = await publish(d, offerBody("HDPE-Abschnitte, Abholung nächsten Monat (Testlauf)", { collectionUntil: day(30) }));
  check("D publishes two offers with a collection deadline", soon.published?.status === 200 && later.published?.status === 200, `${soon.published?.text.slice(0, 150)} ${later.published?.text.slice(0, 150)}`);
  const byDeadline = (await b.get("/api/offers?scope=park&sort=deadline")).json;
  const cards = byDeadline.offers;
  const soonCard = cards.find((offer) => offer.id === soon.id);
  const laterCard = cards.find((offer) => offer.id === later.id);
  check("acceptance: deadline in 3 days is labelled urgent", soonCard?.urgent === true, JSON.stringify(soonCard?.collectionUntil));
  check("negative: deadline in 30 days is not urgent", laterCard?.urgent === false);
  check("negative: an offer without deadline is never urgent", cards.filter((offer) => offer.collectionUntil === null).every((offer) => offer.urgent === false));
  const deadlines = cards.map((offer) => offer.collectionUntil ?? "9999-12-31");
  check("sort=deadline: earliest deadline first, listings without one last", deadlines.every((value, index) => index === 0 || deadlines[index - 1] <= value) && cards.indexOf(soonCard) < cards.indexOf(laterCard), deadlines.join(","));
  check("negative: an unknown sort order is refused (HTTP 400)", (await b.get("/api/offers?scope=park&sort=urgentest")).status === 400);
  const past = await d.post("/api/my/offers", offerBody("HDPE-Abschnitte mit verstrichener Frist (Testlauf)", { availableFrom: day(-10), collectionUntil: day(-1) }));
  const pastPublish = await d.post(`/api/my/offers/${past.json?.id}/publish`, {});
  check("negative: a deadline in the past cannot be published (422 DATE_PAST)", pastPublish.status === 422 && pastPublish.text.includes("DATE_PAST"), pastPublish.text.slice(0, 200));
  const mapSearch = (await b.get("/api/map?scope=park&sort=deadline")).json;
  check("the map uses the same cards with the label", mapSearch.search.offers.find((offer) => offer.id === soon.id)?.urgent === true);
  const offersPage = await b.get("/offers?scope=park&sort=deadline");
  check("the offers page shows the label “Dringend” and the sort option", offersPage.status === 200 && offersPage.text.includes("Dringend") && offersPage.text.includes("Früheste Frist zuerst"));

  section("No. 46 – guide page");
  const guide = await guest.get("/guide");
  check("acceptance: /guide is public and states that it is no legal advice", guide.status === 200 && guide.text.includes("Keine Rechtsberatung"));
  check("it explains by-product vs. waste with the sources KrWG §§ 4–6 and PPWR", ["Nebenprodukt oder Abfall?", "gesetze-im-internet.de/krwg/__4.html", "gesetze-im-internet.de/krwg/__6.html", "eur-lex.europa.eu/eli/reg/2025/40"].every((text) => guide.text.includes(text)));
  check("duties of both sides and the course of a cooperation are there", ["Pflichten beider Seiten", "Abgebendes Unternehmen", "Aufnehmendes Unternehmen", "Ablauf einer Kooperation"].every((text) => guide.text.includes(text)));
  const english = new Client();
  english.cookies.set("locale", "en");
  check("English version with the language switch", (await english.get("/guide")).text.includes("No legal advice"));
  check("the footer links to the guide (public and platform pages)", (await guest.get("/")).text.includes('href="/guide"') && offersPage.text.includes('href="/guide"'));
  check("negative: an unknown sub-page of the guide is 404", (await guest.get("/guide/xyz")).status === 404);

  section("No. 19 – saved search + in-app notice");
  for (const [method, path] of [["GET", "/api/my/notifications"], ["GET", "/api/my/saved-searches"], ["POST", "/api/my/saved-searches"], ["POST", "/api/my/notifications/read"]]) {
    // a well-formed body: the refusal must come from the missing login, not from the validation
    const body = method === "GET" ? undefined : path.endsWith("/read") ? {} : { name: "Gast-Suche", query: "scope=park" };
    check(`negative: guest ${method} ${path} → 401`, (await guest.request(method, path, body)).status === 401);
  }
  check("negative: /notifications sends a guest to the login", (await guest.get("/notifications")).status === 307);
  const query = `scope=park&typeId=${typeId("hdpe")}&formId=${formId("sheet")}&sort=deadline`;
  const pending = await e.post("/api/my/saved-searches", { name: "HDPE-Platten im Park", query });
  check("negative: a site that is not verified cannot save a search (403)", pending.status === 403 && pending.json?.error === "NOT_VERIFIED", pending.text.slice(0, 150));
  check("negative: an empty name is refused (400)", (await b.post("/api/my/saved-searches", { name: " ", query })).status === 400);
  check("negative: a filter the search does not know is refused (400)", (await b.post("/api/my/saved-searches", { name: "Kaputt", query: "scope=everywhere" })).status === 400);
  const saved = await b.post("/api/my/saved-searches", { name: "HDPE-Platten im Park", query });
  check("acceptance: B saves the search “HDPE sheet in my park”", saved.status === 200 && Number.isInteger(saved.json?.id), saved.text.slice(0, 150));
  const stored = (await b.get("/api/my/saved-searches")).json.searches.find((search) => search.id === saved.json?.id);
  check("stored are the filters without sort order or page size", stored?.filters.typeId === typeId("hdpe") && stored?.filters.scope === "park" && !("sort" in stored.filters) && !("limit" in stored.filters));
  const otherPark = await c.post("/api/my/saved-searches", { name: "HDPE-Platten bei C", query }); // C is in another park
  const own = await d.post("/api/my/saved-searches", { name: "Eigene HDPE-Platten", query }); // D is the supplier itself
  check("C and D save the same filters", otherPark.status === 200 && own.status === 200);
  const overlapping = await b.post("/api/my/saved-searches", { name: "HDPE im Umkreis 10 km", query: `scope=radius&radiusKm=10&typeId=${typeId("hdpe")}` });
  check("B saves a second, overlapping search", overlapping.status === 200);
  check("offers published before the search raise no notice", (await b.get("/api/my/notifications")).json.items.length === 0);

  const unread = async (client) => (await client.get("/api/my/notifications")).json;
  const match = await publish(d, offerBody("HDPE-Platten, neue Charge (Testlauf)"));
  check("D publishes a matching offer", match.published?.status === 200);
  const forB = await unread(b);
  check("acceptance: B gets exactly one unread notice for it – once, although two searches match", forB.unread === 1 && forB.items.length === 1 && forB.items[0].offer.id === match.id && forB.items[0].search.name === "HDPE-Platten im Park", JSON.stringify(forB).slice(0, 300));
  check("negative: C (other park) gets no notice", (await unread(c)).items.length === 0);
  check("negative: D gets no notice for its own offer", (await unread(d)).items.length === 0);
  const other = await publish(d, offerBody("PVC-Mahlgut (Testlauf)", { typeId: typeId("pvc"), formId: formId("regrind") }));
  check("negative: a non-matching offer raises no notice", other.published?.status === 200 && (await unread(b)).items.length === 1);
  check("the bell in the header shows 1 unread", (await b.get("/dashboard")).text.includes('aria-label="Hinweise: 1 ungelesene Hinweise"'));
  check("negative: C's bell shows no number", (await c.get("/dashboard")).text.includes('aria-label="Hinweise"'));
  const bell = await b.get("/notifications");
  check("the notifications page lists the notice and the saved search", bell.status === 200 && bell.text.includes("HDPE-Platten, neue Charge (Testlauf)") && bell.text.includes("HDPE-Platten im Park"));

  section("No. 19 – access per site");
  const noticeId = forB.items[0]?.id;
  check("negative: C cannot mark B's notice as read", (await c.post("/api/my/notifications/read", { ids: [noticeId] })).json?.updated === 0 && (await unread(b)).unread === 1);
  check("negative: C cannot delete B's saved search (looks unknown: 404)", (await c.delete(`/api/my/saved-searches/${saved.json?.id}`)).status === 404);
  check("negative: C never sees B's searches", !(await c.get("/api/my/saved-searches")).json.searches.some((search) => search.id === saved.json?.id));
  const read = await b.post("/api/my/notifications/read", { ids: [noticeId] });
  check("acceptance: B marks the notice as read → 0 unread", read.json?.updated === 1 && (await unread(b)).unread === 0);
  check("… and the bell shows no number any more", (await b.get("/dashboard")).text.includes('aria-label="Hinweise"'));
  await d.post(`/api/my/offers/${match.id}/close`, {});
  const afterClose = await unread(b);
  check("a closed offer stays in the list, labelled, without a link", afterClose.items[0]?.offer.status === "closed");

  section("No. 19 – limit and delete");
  const extra = [];
  for (let index = 3; index <= 20; index += 1) extra.push(await b.post("/api/my/saved-searches", { name: `Suche ${index}`, query: `scope=radius&radiusKm=10&typeId=${typeId("hdpe")}` }));
  check("a site can save up to 20 searches", extra.every((result) => result.status === 200));
  const tooMany = await b.post("/api/my/saved-searches", { name: "Suche 21", query });
  check("negative: the 21st is refused (422 TOO_MANY)", tooMany.status === 422 && tooMany.text.includes("TOO_MANY"), tooMany.text.slice(0, 150));
  const removed = await b.delete(`/api/my/saved-searches/${saved.json?.id}`);
  check("B deletes its search; its notices go with it", removed.status === 200 && (await unread(b)).items.length === 0);
  check("negative: deleting it twice is 404", (await b.delete(`/api/my/saved-searches/${saved.json?.id}`)).status === 404);
}

main()
  .catch((error) => {
    failures.push(`aborted: ${error.message}`);
    console.error(error);
  })
  .finally(async () => {
    await db.end().catch(() => {});
    console.log(`\n${passed} passed, ${failures.length} failed`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exit(failures.length > 0 ? 1 : 0);
  });
