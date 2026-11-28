// Service worker of the static demo: the app's server code answers the page's requests inside the browser.
import { BASE, NativeResponse, nativeFetch } from "./globals.js";
import * as server from "../../dist/server/index.js";
import { resetAsyncContext } from "./shims/async_hooks.js";

const entry = server.default;
const handler = typeof entry === "function" ? entry : (request, ctx) => entry.fetch(request, process.env, ctx);
const STATIC_FILES = new Set(__STATIC_FILES__);
const isStatic = (path) => path.startsWith("/_next/static/") || path.startsWith("/demo-files/") || STATIC_FILES.has(path);
// GitHub Pages (Jekyll) does not publish files and folders whose name starts with "_" → build.mjs stores them as "u_…".
const published = (path) => path.replace(/\/_/g, "/u_");
// File of the static host under another path. The copy has no URL of its own, so relative imports inside a script
// keep resolving against the path the page asked for.
const fromHost = (path) => nativeFetch(BASE + path).then((file) => new NativeResponse(file.body, { status: file.status, statusText: file.statusText, headers: file.headers }));

// One request at a time: the in-browser AsyncLocalStorage replacement relies on it (shims/async_hooks.js).
// A request that never finishes must not block the following ones → it fails after REQUEST_TIMEOUT.
const REQUEST_TIMEOUT = 60_000;
let queue = Promise.resolve();
const oneAtATime = (task) => {
  const run = queue.then(() => {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("request timed out")), REQUEST_TIMEOUT); });
    return Promise.race([task(), timeout]).finally(() => clearTimeout(timer));
  });
  queue = run.catch(() => {});
  return run;
};
const json = (status, data) => new NativeResponse(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

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
  // read to the end inside the queue: rendering continues while streaming
  const body = !noBody && response.body ? await response.arrayBuffer() : null;
  await storeCookies(response.headers);
  event.waitUntil(globalThis.__DEMO__.flush().catch(() => {})); // keeps the worker alive until IndexedDB has the changes
  const out = new Headers(response.headers);
  out.delete("set-cookie");
  return new NativeResponse(body, { status: response.status, statusText: response.statusText, headers: out });
}

/** "Reset demo": log out (cookies of this app) and load the seeded data again on the next request. */
async function reset() {
  await globalThis.__DEMO__.reset();
  for (const { name } of await cookieStore.getAll()) await cookieStore.delete({ name, path: `${BASE}/` });
  return new NativeResponse(null, { status: 204 });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const current = `kreiswerts-demo-files-${globalThis.__DEMO__.filesVersion}`;
      for (const name of await caches.keys()) if (name.startsWith("kreiswerts-demo-files-") && name !== current) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Client code calls /api/* on the site root (no base path there) → same handler.
  if (url.pathname.startsWith("/api/")) url.pathname = BASE + url.pathname;
  // Public files referenced without the base path (plain <img src="/images/…">) live under it on the static host.
  if (STATIC_FILES.has(url.pathname)) return event.respondWith(fromHost(url.pathname));
  if (!url.pathname.startsWith(`${BASE}/`) && url.pathname !== BASE) return;
  const path = url.pathname.slice(BASE.length);
  if (isStatic(path)) return path.includes("/_") ? event.respondWith(fromHost(published(path))) : undefined;
  const fail = (error) => {
    console.error("[demo]", request.method, path, error);
    return new NativeResponse("The demo could not answer this request. Reload the page, or reset the demo from the (i) notice in the header.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  };
  if (request.method === "POST" && path === "/api/demo/reset") return event.respondWith(oneAtATime(reset).catch(fail));
  // Registration is switched off in the demo: visitors use the demo logins.
  if (request.method === "POST" && path.startsWith("/api/auth/sign-up")) return event.respondWith(json(403, { code: "DEMO_SIGN_UP_OFF", message: "Registration is switched off in the static demo" }));
  event.respondWith(oneAtATime(() => answer(event, url)).catch(fail));
});
