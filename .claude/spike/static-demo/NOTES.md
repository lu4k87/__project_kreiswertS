# Static demo – proof of concept (2026-11-28, chat mk-dev-87)

Goal: run the unchanged app on a plain static host (GitHub Pages) with demo logins and demo data.
Result: works. Test `demo/test.mjs` in the installed Chrome against `demo/serve.mjs` (plain file server): 13/13 steps green –
start, login as `site_a`, nine platform pages, client-side navigation, `/api/*`. Built from commit `0ca3ee1`.

## How it works

| Part | File | What it does |
|---|---|---|
| Build | `vite.config.ts` | vinext (Next.js API on Vite) builds the app; a small plugin swaps only `src/server/db/client.ts` |
| Database | `demo/make-db.mjs` | PGlite (PostgreSQL as WASM): schema via `drizzle-kit generate`, data via the unchanged `scripts/seed.mjs --demo` through `pglite-socket`, saved as `demo/demo-db.tar.gz` |
| Database client | `demo/db-client.browser.ts` | same `db` export, PGlite inside the service worker, files fetched from `_demo/` |
| Server in the browser | `demo/sw/entry.js` | service worker: hands page and `/api/*` requests to `dist/server/index.js`, one request at a time |
| Node replacements | `demo/sw/globals.js`, `demo/sw/shims/` | `process`, `Buffer`, `node:crypto` (noble), `async_hooks`, `fs`, `path`, … |
| Bundle | `demo/build.mjs` | `vite build` → esbuild bundles the worker → `demo/out/<base path>/` |
| Start page | `demo/boot.html` | registers the worker, then opens the app |

Run (in a copy with the packages below installed, `"type": "module"` in package.json or a `vite.config.mts`):
`node demo/make-db.mjs && node demo/build.mjs && node demo/serve.mjs & node demo/test.mjs`

Packages added (dev): vinext 1.4.7, vite ^8.4, @vitejs/plugin-rsc ^0.5.39, @vitejs/plugin-react ^6.3, react-server-dom-webpack ^19.3.1,
@electric-sql/pglite ^0.6.1, @electric-sql/pglite-socket ^0.3.1, buffer ^6, playwright-core (test only). esbuild, pathe and
@noble/hashes are already there as dependencies of others – declare them when they are imported directly.
`next.config.ts` needs one line: `basePath: process.env.DEMO_BASE_PATH || undefined` (see `next.config.ts.diff`).

## Things that cost time (keep)

- **Cookies:** the Fetch standard drops `Cookie`/`Origin` from script-made requests and `Set-Cookie` from script-made responses.
  `globals.js` keeps the full headers in a side table (Proxy around `Request`/`Response`); `entry.js` stores cookies with the
  Cookie Store API (path = base path) and adds them to each request. Needs `cookieStore` in service workers
  (Chrome/Edge, Safari 18.4+, Firefox 140+) – `boot.html` says so otherwise.
- **AsyncLocalStorage:** no browser equivalent. The replacement is only correct because `entry.js` answers one request at a time
  and reads the response body to the end inside that queue (rendering continues while streaming). Do not remove the queue.
- **PGlite 0.6 options:** `pgliteWasmModule` + `initdbWasmModule` + `fsBundle` – with the old name `wasmModule` it silently fetches
  next to `sw.js`, gets 404 and hangs.
- **React:** the server bundle contains React's Node build; it asks for `stream`, `util`, `react-dom`, `react-dom/static` through
  `createRequire` → `shims/module.js` hands them out.
- **Paths:** client code calls `/api/*` and some images at the site root (no base path) → the worker maps both under the base path.
  vinext writes hashed assets to `dist/client/<base path>/_next`, public files to `dist/client/` → `build.mjs` merges them.
- **Headless test:** service workers fail in Playwright's default context ("Failed to access storage") → `launchPersistentContext`.
  An uncaught error leaves Chrome running and the shell hanging → always close in `finally`.

## Open (not built yet)

1. **Data is lost when the browser stops the worker** (about 30 s idle): PGlite runs in memory. Use `dataDir: "idb://…"`, load the
   dump only on first start, add "reset demo". Until then the session cookie outlives the session row → looks like a logout.
2. `(i)` notice in the header, demo logins on the login page, registration off – only for the demo build (e.g. `process.env.DEMO_STATIC`).
3. Writes are untested (create an offer, negotiate, sign, simulated payment, admin verification, logout, switch login).
   Better Auth allows 3 logins per 10 s on one shared counter – switching demo logins quickly hits it.
4. Deep link on first visit: no worker yet → the host answers 404. The portfolio's root `404.html` has to send paths under
   `/web_kreiswerts/app/` to the start page with `?next=` (`boot.html` reads it).
5. Size: `demo/out` 30 MB, first visit about 12 MB compressed (dump 4.7 · pglite.wasm 3.4 · pglite.data 1.9 · sw.js 1.6, minify is on
   by default). The dump is mostly the empty PostgreSQL data directory – shipping SQL instead may be smaller but starts slower.
6. Temporary `console.log` lines in `entry.js` (stall watchdog) and `db-client.browser.ts`.
7. Never bundle real secrets: the worker's `process.env` is public (`globals.js`). vinext loads `.env*` at build time – build with
   an empty environment and grep the output for the values of `.env` / `.env.demo` before publishing.
