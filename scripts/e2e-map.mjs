#!/usr/bin/env node
// End-to-end acceptance run of the interactive map: requests on the industrial map and feedstock volume
// aggregation (AT-L2-010, NT-L2-010), plus the public projections behind the start page and the regional map.
//
// Never run it against the working database: it expects a freshly seeded demo database and changes it.
//
//   export DATABASE_URL=postgres://…/kreiswerts_e2e  DEMO_PASSWORD=…  DEMO_ADMIN_PASSWORD=…  BETTER_AUTH_URL=http://localhost:3100
//   npx drizzle-kit push --force && node scripts/seed.mjs --reset-demo
//   npm run build && npx next start -H 127.0.0.1 -p 3100 > server.log 2>&1 &
//   node scripts/e2e-map.mjs --base http://localhost:3100
//
// ponytail: the client and check helpers repeat the head of e2e-level2.mjs instead of a shared module – that file
// is being extended in parallel; merge both into scripts/e2e/common.mjs once neither is in flux.
import pg from "pg";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const BASE = arg("base", "http://localhost:3100");
const PASSWORD = process.env.DEMO_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL ?? "";

if (!PASSWORD) throw new Error("DEMO_PASSWORD is missing (the password the demo logins were seeded with)");
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
}

let authRequests = 0;
/** Better Auth allows 3 login requests per 10 s for all clients together. */
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

async function main() {
  await db.connect();
  const sessions = async () => (await db.query("select count(*)::int as n from auth_sessions")).rows[0].n;
  const before = await sessions();
  const b = await login("site_b");
  if ((await sessions()) <= before) throw new Error("the server at --base does not write to the database of DATABASE_URL – nothing was changed");
  const a = await login("site_a");
  const c = await login("site_c");
  const d = await login("site_d");
  const guest = new Client();

  const catalogue = (await guest.get("/api/catalogue")).json;
  const plastics = catalogue.categories.find((category) => category.key === "plastics");
  const typeId = (key) => catalogue.types.find((type) => type.categoryId === plastics.id && type.key === key).id;
  const formId = (key) => catalogue.forms.find((form) => form.categoryId === plastics.id && form.key === key).id;
  const today = new Date().toISOString().slice(0, 10);

  /** Creates and publishes a regrind batch; returns its id. */
  async function publish(client, place, patch) {
    const created = await client.post("/api/my/offers", {
      title: `Mahlgut ${patch.type.toUpperCase()} (Testlauf ${place})`,
      description: "Sortenreines Mahlgut aus der eigenen Produktion, trocken gelagert, für den Kartentest.",
      categoryId: plastics.id,
      typeId: typeId(patch.type),
      formId: formId("regrind"),
      origin: "pre_consumer",
      legalStatus: "by_product",
      quantity: patch.quantity,
      unitKey: "kg",
      frequency: patch.recurring ? "recurring" : "one_time",
      ...(patch.recurring ? { recurrencePeriod: "monthly", recurrenceQuantity: patch.recurring } : {}),
      availableFrom: today,
      priceMode: "quotation",
      deliveryOptions: [{ term: "exw", namedPlace: place }],
      evidenceStatus: "self_declared",
      sampleAvailable: "yes",
    });
    if (created.status !== 200) throw new Error(`offer at ${place} not created: HTTP ${created.status} ${created.text.slice(0, 300)}`);
    const published = await client.post(`/api/my/offers/${created.json.id}/publish`, {});
    if (published.status !== 200) throw new Error(`offer at ${place} not published: HTTP ${published.status} ${published.text.slice(0, 300)}`);
    return created.json.id;
  }

  section("Access");
  check("guest GET /api/map → 401", (await guest.get("/api/map")).status === 401);
  const home = await guest.get("/");
  check("start page with the map answers for a guest", home.status === 200);
  check("… and hands the map no street address or contact of a site", !/Musterstraße|Beispielweg|@demo\.|"street"|"email"/.test(home.text));
  check("regional map page answers for a guest", (await guest.get("/regional-map")).status === 200);
  check("industrial map page answers for a verified site", (await b.get("/map")).status === 200);

  section("Requests on the industrial map (Level 2)");
  const wide = (await b.get("/api/map?scope=radius&radiusKm=25")).json;
  const ownRequestIds = (await b.get("/api/my/requests")).json.requests.map((request) => request.id);
  check("the map carries the open requests of the area", wide.requests.total > 0 && wide.requests.requests.length > 0);
  check("… never the viewer's own requests", wide.requests.requests.every((request) => !ownRequestIds.includes(request.id)));
  check("… and every request sits at its site on the map", wide.requests.requests.every((request) => wide.sites.some((site) => site.requestIds.includes(request.id))));
  const ppOnly = (await b.get(`/api/map?scope=radius&radiusKm=25&typeId=${typeId("pp")}`)).json;
  check("a PP filter keeps only PP requests on the map", ppOnly.requests.requests.every((request) => request.types.some((type) => type.key === "pp")));

  section("Feedstock volume aggregation (L2-010)");
  const seeded = wide.aggregation.groups.find((group) => group.typeId === typeId("hdpe") && group.formId === formId("sheet"));
  check("demo data: the two HDPE sheet batches form a group of 280 kg", seeded?.currentKg === 280 && seeded.offerIds.length === 2, JSON.stringify(seeded));

  const regrind = `/api/map?scope=radius&radiusKm=25&formId=${formId("regrind")}`;
  const groupOf = async (type) => (await b.get(regrind)).json.aggregation.groups.find((group) => group.typeId === typeId(type));
  const small = await publish(a, "Werk A", { type: "ldpe", quantity: 200 });
  const large = await publish(d, "Werk D", { type: "ldpe", quantity: 400 });
  const pp = await publish(c, "Werk C", { type: "pp", quantity: 300 });
  const ldpe = await groupOf("ldpe");
  check("two compatible batches of 200 kg and 400 kg show 600 kg (AT-L2-010)", ldpe?.currentKg === 600 && ldpe.offerIds.includes(small) && ldpe.offerIds.includes(large), JSON.stringify(ldpe));
  check("the incompatible PP batch stays out of the LDPE group (AT-L2-010)", !ldpe?.offerIds.includes(pp) && (await groupOf("pp"))?.offerIds.includes(pp));
  check("each offer counts once and the group names both sites", ldpe?.offerIds.length === new Set(ldpe?.offerIds).size && ldpe?.siteIds.length === 2);

  const closed = await a.post(`/api/my/offers/${small}/close`, {});
  check("closing one batch reduces the total to 400 kg (AT-L2-010)", closed.status === 200 && (await groupOf("ldpe"))?.currentKg === 400);

  const recurring = await publish(c, "Werk C", { type: "ldpe", quantity: 100, recurring: 1000 });
  const withRecurring = await groupOf("ldpe");
  check("recurring supply is not added to the current stock (NT-L2-010)", withRecurring?.currentKg === 500 && withRecurring.recurringKg.monthly === 1000 && withRecurring.offerIds.includes(recurring), JSON.stringify(withRecurring));

  await db.query("update offers set expires_at = now() - interval '1 day' where id = $1", [large]);
  const afterExpiry = await groupOf("ldpe");
  check("an expired batch drops out of the group (NT-L2-010)", afterExpiry?.currentKg === 100 && !afterExpiry.offerIds.includes(large), JSON.stringify(afterExpiry));
  check("a closed batch stays out (NT-L2-010)", !afterExpiry?.offerIds.includes(small));

  const mixed = (await b.get("/api/map?scope=radius&radiusKm=25")).json.aggregation;
  check("mixed material is never grouped (D19)", mixed.groups.every((group) => group.typeId !== typeId("mixed")) && mixed.excluded > 0);

  await db.end();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.map((failure) => `  - ${failure}`).join("\n"));
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error);
  await db.end().catch(() => {});
  process.exit(1);
});
