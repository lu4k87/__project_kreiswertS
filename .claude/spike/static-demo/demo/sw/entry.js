// Service worker of the static demo: the app's server code answers the page's requests inside the browser.
import { BASE, NativeResponse } from "./globals.js";
import * as server from "../../dist/server/index.js";
import { resetAsyncContext } from "./shims/async_hooks.js";

const entry = server.default;
const handler = typeof entry === "function" ? entry : (request, ctx) => entry.fetch(request, process.env, ctx);
const STATIC_FILES = new Set(__STATIC_FILES__);
const isStatic = (path) => path.startsWith("/_next/static/") || path.startsWith("/_demo/") || STATIC_FILES.has(path);

// One request at a time: the in-browser AsyncLocalStorage replacement relies on it.
let queue = Promise.resolve();
const oneAtATime = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

function parseSetCookie(line) {
  const [pair, ...attributes] = line.split(";").map((part) => part.trim());
  const cut = pair.indexOf("=");
  const cookie = { name: pair.slice(0, cut), value: pair.slice(cut + 1), expires: null };
  for (const attribute of attributes) {
    const [key, value = ""] = attribute.split("=");
    if (key.toLowerCase() === "max-age") cookie.expires = Date.now() + Number(value) * 1000;
    else if (key.toLowerCase() === "expires" && cookie.expires === null) cookie.expires = Date.parse(value);
  }
  return cookie;
}
async function storeCookies(headers) {
  for (const line of headers.getSetCookie()) {
    const { name, value, expires } = parseSetCookie(line);
    const path = `${BASE}/`;
    if (expires !== null && expires <= Date.now()) await cookieStore.delete({ name, path });
    else await cookieStore.set({ name, value, path, expires, sameSite: "lax" });
  }
}

async function answer(event, url) {
  const { request } = event;
  resetAsyncContext();
  const headers = new Headers(request.headers);
  const cookies = await cookieStore.getAll();
  if (cookies.length) headers.set("cookie", cookies.map(({ name, value }) => `${name}=${value}`).join("; "));
  headers.set("host", url.host);
  headers.set("origin", url.origin);
  headers.set("sec-fetch-site", "same-origin");
  headers.set("sec-fetch-mode", request.mode);
  if (request.destination) headers.set("sec-fetch-dest", request.destination);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const serverRequest = new Request(url, { method: request.method, headers, body: hasBody ? await request.arrayBuffer() : undefined, redirect: "manual" });
  const response = await handler(serverRequest, { waitUntil: (promise) => event.waitUntil(promise) });
  const noBody = response.status === 204 || response.status === 304 || (response.status >= 300 && response.status < 400);
  let body = null; // read to the end inside the queue: rendering continues while streaming
  if (!noBody && response.body) {
    const reader = response.body.getReader(), chunks = [];
    for (let total = 0; ; ) {
      const next = await Promise.race([reader.read(), new Promise((resolve) => setTimeout(() => resolve("stalled"), 6000))]);
      if (next === "stalled") { console.log("[demo] body stalled after", total, "bytes; tail:", new TextDecoder().decode(chunks.at(-1) ?? new Uint8Array()).slice(-300)); break; }
      if (next.done) break;
      chunks.push(next.value); total += next.value.byteLength;
    }
    body = await new Blob(chunks).arrayBuffer();
  }
  await storeCookies(response.headers);
  const out = new Headers(response.headers);
  out.delete("set-cookie");
  return new NativeResponse(body, { status: response.status, statusText: response.statusText, headers: out });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Client code calls /api/* on the site root (no base path there) → same handler.
  if (url.pathname.startsWith("/api/")) url.pathname = BASE + url.pathname;
  // Public files referenced without the base path (plain <img src="/images/…">) live under it on the static host.
  if (STATIC_FILES.has(url.pathname)) return event.respondWith(fetch(BASE + url.pathname));
  if (!url.pathname.startsWith(`${BASE}/`) && url.pathname !== BASE) return;
  if (isStatic(url.pathname.slice(BASE.length))) return;
  event.respondWith(
    oneAtATime(() => answer(event, url)).catch((error) => {
      console.error("[demo]", event.request.method, url.pathname, error);
      return new NativeResponse(`Demo server error: ${error?.stack ?? error}`, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    }),
  );
});
