// Runs before any server code: Node globals, and headers the browser normally hides from scripts.
import { Buffer } from "buffer";

const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
globalThis.__DEMO_BASE__ = BASE;
globalThis.Buffer ??= Buffer;
globalThis.global ??= globalThis;
globalThis.setImmediate ??= (fn, ...args) => setTimeout(fn, 0, ...args);
globalThis.clearImmediate ??= (id) => clearTimeout(id);
globalThis.process = {
  env: {
    NODE_ENV: "production",
    DATABASE_URL: "pglite://browser",
    // Public on purpose: every visitor has a private database in the own browser, there is nothing to protect.
    BETTER_AUTH_SECRET: "kreiswerts-static-demo-public-not-a-secret-0001",
    BETTER_AUTH_URL: `${self.location.origin}${BASE}/api/auth`,
  },
  versions: {}, version: "", platform: "browser", argv: [], pid: 1,
  cwd: () => "/", nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
  emitWarning: () => {}, on: () => {}, once: () => {}, off: () => {}, hrtime: Object.assign(() => [0, 0], { bigint: () => 0n }),
  memoryUsage: () => ({ rss: 0, heapUsed: 0, heapTotal: 0 }), uptime: () => performance.now() / 1000,
};

// The Fetch standard drops Cookie/Origin from script-made requests and Set-Cookie from script-made responses.
// The server code in this worker needs both, so headers of objects created here are kept in a side table.
const NativeRequest = self.Request, NativeResponse = self.Response, NativeHeaders = self.Headers;
const nativeRequestHeaders = Object.getOwnPropertyDescriptor(NativeRequest.prototype, "headers").get;
const nativeResponseHeaders = Object.getOwnPropertyDescriptor(NativeResponse.prototype, "headers").get;
const HIDDEN_REQUEST_HEADERS = ["cookie", "origin", "host", "referer", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"];
const full = new WeakMap();
const copy = (init) => new NativeHeaders(init ?? undefined);

function requestHeaders(request, input, init) {
  const headers = copy(nativeRequestHeaders.call(request));
  const source = init?.headers != null ? copy(init.headers) : input instanceof NativeRequest ? input.headers : null;
  for (const name of HIDDEN_REQUEST_HEADERS) {
    const value = source?.get(name);
    if (value != null) headers.set(name, value);
  }
  return headers;
}
function responseHeaders(response, init) {
  const headers = copy(nativeResponseHeaders.call(response));
  if (init?.headers != null) for (const cookie of copy(init.headers).getSetCookie()) headers.append("set-cookie", cookie);
  return headers;
}
const patchClone = (Native) => {
  const clone = Native.prototype.clone;
  Native.prototype.clone = function () {
    const twin = clone.call(this);
    if (full.has(this)) full.set(twin, copy(full.get(this)));
    return twin;
  };
};
Object.defineProperty(NativeRequest.prototype, "headers", { configurable: true, get() { return full.get(this) ?? nativeRequestHeaders.call(this); } });
Object.defineProperty(NativeResponse.prototype, "headers", { configurable: true, get() { return full.get(this) ?? nativeResponseHeaders.call(this); } });
patchClone(NativeRequest);
patchClone(NativeResponse);
self.Request = new Proxy(NativeRequest, {
  construct(target, args, newTarget) {
    const request = Reflect.construct(target, args, newTarget);
    full.set(request, requestHeaders(request, args[0], args[1]));
    return request;
  },
});
const nativeJson = NativeResponse.json.bind(NativeResponse);
self.Response = new Proxy(NativeResponse, {
  construct(target, args, newTarget) {
    const response = Reflect.construct(target, args, newTarget);
    full.set(response, responseHeaders(response, args[1]));
    return response;
  },
  get(target, key) {
    if (key === "json") return (data, init) => { const response = nativeJson(data, init); full.set(response, responseHeaders(response, init)); return response; };
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
export { BASE, NativeResponse };
