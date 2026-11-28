// Drives the built static demo (demo/out, served by demo/serve.mjs) in the installed Chrome: start, demo logins, pages,
// writes, switching accounts, administrator, restart of the service worker, reset, deep link without a worker.
// Usage: npm run demo:serve &  npm run demo:test   (exit code 1 when a step fails)
import { chromium } from "playwright-core";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ADMIN_PASSWORD, BASE, PORT, SITE_PASSWORD } from "./config.mjs";

const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOTS = "demo/shots";
mkdirSync(SHOTS, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), "kreiswerts-demo-"));
// Service workers need a persistent profile ("Failed to access storage" in Playwright's default context).
const browser = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true, viewport: { width: 1440, height: 900 } });
let failed = 0;
try {
  const page = await browser.newPage();
  const problems = [], expected = new Set();
  page.on("console", (message) => { if (message.type() === "error" && !/Failed to load resource/.test(message.text())) problems.push(`console: ${message.text().slice(0, 300)}`); });
  page.on("pageerror", (error) => problems.push(`pageerror: ${String(error).slice(0, 300)}`));
  page.on("response", (response) => { const line = `HTTP ${response.status()} ${response.url().replace(ORIGIN, "")}`; if (response.status() >= 400 && !expected.has(line)) problems.push(line); });

  const step = async (name, run) => {
    const started = Date.now();
    try { const info = await run(); console.log(`✅ ${name} · ${Date.now() - started} ms${info ? ` · ${info}` : ""}`); }
    catch (error) { failed++; console.log(`❌ ${name} · ${String(error).split("\n")[0].slice(0, 400)}`); await page.screenshot({ path: `${SHOTS}/fail-${name.replace(/\W+/g, "-").slice(0, 60)}.png` }).catch(() => {}); }
  };
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const settle = () => page.waitForLoadState("networkidle");
  const open = async (route) => { const response = await page.goto(`${ORIGIN}${BASE}${route}`); await settle(); return response; };
  /** Calls the app's API like its client components do (site root, JSON, session cookie added by the worker). */
  const api = (method, route, body, allow = []) => {
    for (const status of allow) expected.add(`HTTP ${status} ${route}`).add(`HTTP ${status} ${BASE}${route}`);
    return page.evaluate(async ([method, route, body]) => {
      const response = await fetch(route, { method, headers: method === "GET" ? undefined : { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
      return { status: response.status, json: await response.json().catch(() => null) };
    }, [method, route, body]);
  };
  // Better Auth allows 3 logins per 10 s on one shared counter (AGENTS.md §5) → wait before every fourth.
  let logins = 0;
  const logIn = async (name, password) => {
    if (logins && logins % 3 === 0) await page.waitForTimeout(11_000);
    logins++;
    await open("/login");
    await page.fill("#identifier", name);
    await page.fill("#password", password);
    await Promise.all([page.waitForURL(/\/dashboard/, { timeout: 60_000 }), page.click('button[type="submit"]')]);
    await settle();
  };
  const logOut = async () => {
    const button = page.getByRole("button", { name: /^(Abmelden|Log out)$/ });
    if (!(await button.isVisible())) await page.getByRole("button", { name: /^(Kontomenü|Account menu)/ }).click(); // it sits in the account menu
    await button.click();
    await page.waitForURL(`${ORIGIN}${BASE}`, { timeout: 30_000 }).catch(() => page.waitForURL(`${ORIGIN}${BASE}/`, { timeout: 5_000 }));
    await settle();
    check((await api("GET", "/api/my/offers", undefined, [401])).status === 401, "still logged in after logging out");
  };
  const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const TITLE = "Demo-Test HDPE-Abschnitte";
  let offerId, negotiationId;

  await step("start: start page with progress → service worker → home", async () => {
    await page.goto(`${ORIGIN}${BASE}/`);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller && !document.getElementById("bar"), null, { timeout: 90_000 });
    await settle();
    await page.screenshot({ path: `${SHOTS}/1-home.png` });
    return `title "${await page.title()}"`;
  });
  await step("registration is switched off (page and API)", async () => {
    await open("/register");
    check(page.url().includes("/login"), `/register opened ${page.url()}`);
    const signUp = await api("POST", "/api/auth/sign-up/email", { email: "new@kreiswerts.example", password: "Neu-Kreiswert-2026", name: "Neu" }, [403]);
    check(signUp.status === 403, `sign-up answered ${signUp.status}`);
  });
  await step("login as site_a", async () => {
    await logIn("site_a", SITE_PASSWORD);
    await page.screenshot({ path: `${SHOTS}/2-dashboard.png` });
    return `h1 "${await page.locator("h1").first().innerText()}"`;
  });
  for (const route of ["offers", "requests", "map", "companies", "my-offers", "my-requests", "matches", "negotiations", "exchanges", "impact", "notifications", "account"]) {
    await step(`page /${route}`, async () => {
      const response = await open(`/${route}`);
      check(response.status() === 200, `HTTP ${response.status()}`);
      return `h1 "${(await page.locator("h1").first().innerText()).slice(0, 60)}"`;
    });
  }
  await step("client-side navigation via menu link", async () => {
    await open("/dashboard");
    await page.locator(`a[href="${BASE}/offers"]`).first().click();
    await page.waitForURL(/\/offers$/);
  });
  await step("site_a creates and publishes an offer", async () => {
    const catalogue = (await api("GET", "/api/catalogue")).json;
    const plastics = catalogue.categories.find((category) => category.key === "plastics");
    const pick = (list, key) => list.find((entry) => entry.categoryId === plastics.id && entry.key === key).id;
    const created = await api("POST", "/api/my/offers", {
      title: TITLE, description: "300 kg sortierte Abschnitte aus der Produktion.", categoryId: plastics.id, typeId: pick(catalogue.types, "hdpe"), formId: pick(catalogue.forms, "sheet"),
      origin: "pre_consumer", legalStatus: "by_product", quantity: 300, unitKey: "kg", frequency: "one_time", availableFrom: inDays(0), collectionUntil: inDays(5),
      priceMode: "quotation", deliveryOptions: [{ term: "fca", namedPlace: "Werk A, Kamp-Lintfort" }], evidenceStatus: "self_declared", sampleAvailable: "yes",
    });
    check(created.status === 200 && Number.isInteger(created.json?.id), `create answered ${created.status} ${JSON.stringify(created.json).slice(0, 200)}`);
    offerId = created.json.id;
    check((await api("POST", `/api/my/offers/${offerId}/publish`, {})).status === 200, "publish failed");
    await open("/my-offers");
    check((await page.content()).includes(TITLE), "the new offer is not listed under My offers");
    return `offer ${offerId}`;
  });
  await step("data and login survive a restart of the service worker", async () => {
    const cdp = await browser.newCDPSession(page);
    await cdp.send("ServiceWorker.enable");
    await cdp.send("ServiceWorker.stopAllWorkers");
    await open("/my-offers");
    check(page.url().endsWith("/my-offers"), `after the restart the page is ${page.url()} (logged out?)`);
    check((await page.content()).includes(TITLE), "the offer is gone after the restart");
    logins = 0; // the login counter lives in the worker's memory
  });
  await step("log out, site_b proposes terms for the offer", async () => {
    await logOut();
    await logIn("site_b", SITE_PASSWORD);
    const started = await api("POST", "/api/my/negotiations", { offerId, requestId: null, note: "Erster Vorschlag", terms: {
      quantity: 200, unitKey: "kg", paymentDirection: "requester_pays", priceAmount: 120, priceUnitKey: "t", vatBasis: "net", deliveryTerm: "fca", namedPlace: "Werk A, Kamp-Lintfort",
      transportOrganiser: "requester", freightAmount: 80, freightCostStatus: "estimated", freightPayer: "shared", offererSharePercent: 50, deliveryFrom: inDays(2), deliveryUntil: inDays(20), technicalConditions: "Sortenrein",
    } });
    check(started.status === 200 && Number.isInteger(started.json?.id), `proposal answered ${started.status} ${JSON.stringify(started.json).slice(0, 200)}`);
    negotiationId = started.json.id;
    check((await open(`/negotiations/${negotiationId}`)).status() === 200, "negotiation page failed");
    return `negotiation ${negotiationId}`;
  });
  await step("switch back to site_a, accept the proposal", async () => {
    await logOut();
    await logIn("site_a", SITE_PASSWORD);
    const accepted = await api("POST", `/api/my/negotiations/${negotiationId}/accept`, { expectedRevision: 1 });
    check(accepted.status === 200, `accept answered ${accepted.status} ${JSON.stringify(accepted.json).slice(0, 200)}`);
    const status = (await api("GET", `/api/my/negotiations/${negotiationId}`)).json?.status;
    check(status === "agreed", `negotiation status is ${status}`);
  });
  await step("administrator verifies the pending site", async () => {
    await logOut();
    await logIn("admin_demo", ADMIN_PASSWORD);
    check((await open("/admin/verification")).status() === 200, "verification page failed");
    await page.screenshot({ path: `${SHOTS}/3-admin.png` });
    const pending = (await api("GET", "/api/admin/sites?status=pending")).json.sites[0];
    check(pending, "no pending site in the seeded data");
    check((await api("POST", `/api/admin/sites/${pending.id}/verification`, { status: "verified" })).status === 200, "verification failed");
    return `site ${pending.id} verified`;
  });
  await step("reset: logged out, seeded data again", async () => {
    check((await api("POST", "/api/demo/reset", {})).status === 204, "reset failed");
    check((await api("GET", "/api/my/offers", undefined, [401])).status === 401, "still logged in after the reset");
    await logIn("site_a", SITE_PASSWORD);
    const offers = (await api("GET", "/api/my/offers")).json.offers;
    check(!offers.some((offer) => offer.title === TITLE), "the offer created before the reset is still there");
    return `${offers.length} seeded offers of site_a`;
  });
  await step("deep link in a browser without the worker → start page → that page", async () => {
    const fresh = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "kreiswerts-demo-")), { channel: "chrome", headless: true });
    try {
      const visitor = await fresh.newPage();
      await visitor.goto(`${ORIGIN}${BASE}/regional-map?from=link`);
      await visitor.waitForFunction((base) => !!navigator.serviceWorker.controller && location.pathname === `${base}/regional-map` && location.search === "?from=link" && !document.getElementById("bar"), BASE, { timeout: 90_000 });
    } finally { await fresh.close(); }
  });

  console.log(problems.length ? `\nproblems (${problems.length}):\n- ${[...new Set(problems)].slice(0, 25).join("\n- ")}` : "\nno console errors, no unexpected HTTP ≥ 400");
  if (problems.length) failed++;
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} failed` : "\nall steps passed");
process.exit(failed ? 1 : 0);
