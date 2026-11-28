// Drives the built static demo in the installed Chrome: start, login, pages, a write, reload.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const ORIGIN = `http://127.0.0.1:${process.env.PORT ?? 4312}`, BASE = "/web_kreiswerts/app";
mkdirSync("demo/shots", { recursive: true });
import { mkdtempSync } from "node:fs";
const browser = await chromium.launchPersistentContext(mkdtempSync("/private/tmp/claude-501/kw-demo-"), { channel: "chrome", headless: true, viewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const problems = [];
page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text().slice(0, 300)}`); });
page.on("pageerror", (error) => problems.push(`pageerror: ${String(error).slice(0, 300)}`));
page.on("response", (response) => { if (response.status() >= 400) problems.push(`HTTP ${response.status()} ${response.url().replace(ORIGIN, "")}`); });
const step = async (name, run) => {
  const started = Date.now();
  try { const info = await run(); console.log(`✅ ${name} · ${Date.now() - started} ms${info ? ` · ${info}` : ""}`); }
  catch (error) { console.log(`❌ ${name} · ${String(error).split("\n")[0].slice(0, 400)}`); await page.screenshot({ path: `demo/shots/fail-${name.replace(/\W+/g, "-")}.png` }).catch(() => {}); }
};
await step("start (boot page → service worker → home)", async () => {
  await page.goto(`${ORIGIN}${BASE}/`);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller && !document.getElementById("status"), null, { timeout: 60000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "demo/shots/1-home.png" });
  return `title "${await page.title()}"`;
});
await step("login as site_a", async () => {
  await page.goto(`${ORIGIN}${BASE}/login`);
  await page.fill("#identifier", "site_a");
  await page.fill("#password", "Demo-Kreiswert-2026");
  await Promise.all([page.waitForURL(/dashboard/, { timeout: 60000 }), page.click('button[type="submit"]')]);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "demo/shots/2-dashboard.png" });
  return `url ${page.url().replace(ORIGIN, "")} · h1 "${await page.locator("h1").first().innerText()}"`;
});
for (const route of ["offers", "map", "my-offers", "matches", "negotiations", "impact", "companies", "account", "exchanges"]) {
  await step(`page /${route}`, async () => {
    const response = await page.goto(`${ORIGIN}${BASE}/${route}`);
    await page.waitForLoadState("networkidle");
    if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`);
    if (route === "offers" || route === "map") await page.screenshot({ path: `demo/shots/3-${route}.png` });
    return `h1 "${(await page.locator("h1").first().innerText()).slice(0, 60)}" · ${(await page.content()).length} B`;
  });
}
await step("client-side navigation via menu link", async () => {
  await page.goto(`${ORIGIN}${BASE}/dashboard`);
  await page.locator(`a[href="${BASE}/offers"]`).first().click();
  await page.waitForURL(/\/offers$/);
  return page.url().replace(ORIGIN, "");
});
await step("API through the worker", async () => {
  const data = await page.evaluate(() => fetch("/api/my/negotiations").then((response) => response.json()));
  return `${data.negotiations?.length} negotiations`;
});
console.log(problems.length ? `\nproblems (${problems.length}):\n- ${[...new Set(problems)].slice(0, 25).join("\n- ")}` : "\nno console errors, no HTTP ≥ 400");
await browser.close();
