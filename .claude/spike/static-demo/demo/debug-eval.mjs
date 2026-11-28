// Evaluates sw.js in a plain worker to read the exception a failed service worker registration hides.
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
const ORIGIN = "http://127.0.0.1:4312", BASE = "/web_kreiswerts/app";
const context = await chromium.launchPersistentContext(mkdtempSync("/private/tmp/claude-501/kw-demo-"), { channel: "chrome", headless: true });
const page = await context.newPage();
await page.goto(`${ORIGIN}${BASE}/_demo/`).catch(() => {});
console.log(await page.evaluate(({ ORIGIN, BASE }) => new Promise((resolve) => {
  const source = `self.registration = { scope: "${ORIGIN}${BASE}/" }; self.skipWaiting = () => {}; self.clients = { claim() {} };
    try { importScripts("${ORIGIN}${BASE}/sw.js"); postMessage("evaluated without error"); } catch (error) { postMessage(String(error && error.stack || error)); }`;
  const worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
  worker.onmessage = (event) => resolve(event.data);
  worker.onerror = (event) => resolve(`onerror: ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`);
}), { ORIGIN, BASE }));
await context.close();
