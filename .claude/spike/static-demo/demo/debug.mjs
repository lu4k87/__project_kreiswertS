import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
const ORIGIN = "http://127.0.0.1:4312", BASE = "/web_kreiswerts/app";
const context = await chromium.launchPersistentContext(mkdtempSync("/private/tmp/claude-501/kw-demo-"), { channel: "chrome", headless: true });
try {
  context.on("serviceworker", (worker) => worker.on("console", (m) => console.log("SW console:", m.type(), m.text().slice(0, 1200))));
  const page = await context.newPage();
  let navigations = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame() && ++navigations <= 6) console.log("navigated:", frame.url().replace(ORIGIN, "")); });
  page.on("console", (m) => console.log("page console:", m.type(), m.text().slice(0, 700)));
  page.on("pageerror", (e) => console.log("pageerror:", String(e.stack ?? e).slice(0, 700)));
  page.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url().replace(ORIGIN, "")); });
  await page.goto(`${ORIGIN}${BASE}/${process.argv[2] ?? ""}`).catch((e) => console.log("goto:", String(e).split("\n")[0]));
  await page.waitForTimeout(Number(process.argv[3] ?? 8000));
  console.log("navigations:", navigations, "| url:", page.url().replace(ORIGIN, ""));
  console.log("body:", (await page.locator("body").innerText().catch((e) => String(e).split("\n")[0])).slice(0, 700).replace(/\n+/g, " ⏎ "));
} finally { await context.close(); }
