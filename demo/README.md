# Static demo

The unchanged app, running entirely in the visitor's browser, for a plain static host (GitHub Pages:
<https://lu4k87.github.io/web_kreiswerts/app/>). No server, no shared data: every visitor gets a private copy of the
fictional demo data. Only demo logins work; registration is switched off.

```bash
npm run demo:db      # schema + scripts/seed.mjs --demo into PGlite → demo/demo-db.tar.gz
npm run demo:build   # vinext build + service worker → demo/out/web_kreiswerts/app/
npm run demo:serve   # plain file server on http://127.0.0.1:4312 (behaves like GitHub Pages)
npm run demo:test    # drives the built demo in the installed Chrome (needs demo:serve running)
```

## How it works

| Part | File | What it does |
|---|---|---|
| Settings | `config.mjs` | base path, port, the public demo passwords, the public auth secret |
| Build | `vite.config.mts` | vinext (the Next.js API on Vite) builds the app; a small plugin swaps only `src/server/db/client.ts` |
| Database | `make-db.mjs` | PGlite (PostgreSQL as WASM): schema via `drizzle-kit generate`, data via the unchanged `scripts/seed.mjs --demo` through `pglite-socket` |
| Database client | `db-client.browser.ts` | same `db` export; PGlite inside the service worker, stored in IndexedDB, seeded dump loaded once |
| Server in the browser | `sw/entry.js` | service worker: hands page and `/api/*` requests to the app's server code, one request at a time |
| Node replacements | `sw/globals.js`, `sw/shims/` | `process`, `Buffer`, `node:crypto` (noble), `async_hooks`, `fs`, `path`, … |
| Bundle | `build.mjs` | `vite build` → esbuild bundles the worker → `demo/out/<base path>/`; refuses to finish if a value of `.env*` appears in the output |
| Start page | `boot.html` | downloads the database files with a progress bar, registers the worker, opens the app (`?next=` for deep links) |
| Test | `test.mjs`, `serve.mjs` | 25 steps: start, notice, logins, pages, an offer, a refused cross-site write, a negotiation, administrator, worker restart, reset, deep link |

In the app itself the demo is one flag, `DEMO_STATIC` in `src/lib/demo.ts` (`NEXT_PUBLIC_DEMO_*`, set only by `build.mjs`).
What it switches on:

| Element | File | Behaviour |
|---|---|---|
| Notice | `src/components/layout/demo-notice.tsx` | dialog "real app / this demo" with reset, state (commit, date) and a link to the architecture page; opens by itself on every page load, always light and in English (a stored German switches back), later also through the round (i) button of the public header or the entry in the account menu of the platform header (that row has no room for a button) |
| Demo logins | `src/components/auth/demo-logins.tsx` | list above the login form, one click logs in; the list itself is `DEMO_LOGINS` in `src/lib/demo.ts` |
| Registration off | `site-header.tsx`, `login-form.tsx`, `src/app/register/**` | no register button, a sentence instead of the link, the pages redirect to the login |
| Texts | `src/i18n/demo.ts` | German + English |

## Publish (GitHub Pages)

The built files live only in the pages repository (`lu4k87.github.io/web_kreiswerts/app/`, user decision 2026-11-28);
`ai_dev_workflow_global/bin/publish_pages.py` keeps that folder on every run (`demo: app` in `config/projects.yaml`), scans
it, adds the deep-link rule to `404.html` and the "Live demo" button to the project card.

1. Build from a clean, committed state – the notice shows commit and date of `HEAD`: `git worktree add --detach <tmp> HEAD`,
   clone `node_modules` into it (`cp -Rc`; a symlink makes the local-path check stop the build), `npm run demo:db && npm run demo:build`.
2. `npm run demo:serve` + `npm run demo:test` in that worktree.
3. Replace `web_kreiswerts/app/` in the pages checkout with `demo/out/web_kreiswerts/app/`, commit only that path, push.
4. Live check: `DEMO_ORIGIN=https://lu4k87.github.io node demo/test.mjs`.

Taking the demo offline later needs an `sw.js` that unregisters itself before the folder goes.

## Things that cost time (keep)

- **Secrets:** everything in the worker is public, including `process.env` (`sw/globals.js`). `build.mjs` builds with an
  empty environment, `vite.config.mts` reads no `.env` file, and the demo passwords are their own (`config.mjs`), never
  the ones from `.env.demo`.
- **Build in a copy:** vinext writes `next-env.d.ts` and `.next/types/routes.d.ts` into the folder it builds in. In
  the repository those are Next's files – overwriting them breaks `npm run check` for everyone. `build.mjs` therefore
  copies the sources to a temporary folder (node_modules linked) and builds there; only `demo/out/` is written here.
- **Local paths:** Vite names the modules of the linked `node_modules` by their real path – with the user name of
  the build machine. `build.mjs` shortens those names before bundling, drops `.vite/` and stops if the home folder
  still appears in the output.
- **Writes from other websites:** the worker tells the app that every request is same-origin (it has to, the browser
  hides those headers). That is only true for subrequests, so `entry.js` refuses every navigation that is not a GET.
- **Cookies:** the Fetch standard drops `Cookie`/`Origin` from script-made requests and `Set-Cookie` from script-made
  responses. `globals.js` keeps the full headers in a side table (Proxy around `Request`/`Response`); `entry.js` stores
  cookies with the Cookie Store API (path = base path) and adds them to each request. Needs `cookieStore` in service
  workers (Chrome/Edge, Safari 18.4+, Firefox 140+) – `boot.html` says so otherwise.
- **AsyncLocalStorage:** no browser equivalent. The replacement is only correct because `entry.js` answers one request
  at a time and reads the response body to the end inside that queue. Do not remove the queue.
- **fetch inside the worker:** the app's server code replaces `fetch` (request cache). Files of the static host are
  fetched with the browser's own (`nativeFetch`), and a file served under another path is handed over as a new
  `Response` – a response that keeps its URL breaks the relative imports of scripts.
- **GitHub Pages leaves out `_…`:** Jekyll publishes no file or folder starting with an underscore (`_next`,
  `_buildManifest.js`). `build.mjs` renames them to `u_…`, the worker maps the requests; `serve.mjs` refuses `_…` too,
  so the test catches a missed one.
- **Persistence:** PGlite runs on `idb://…` with `relaxedDurability`; `entry.js` keeps the worker alive until the
  changes are written (`event.waitUntil(flush)`). Without `relaxedDurability` every page took seconds. A new dump
  (other hash) or "reset" starts a new store and drops the old one.
- **PGlite 0.6 options:** `pgliteWasmModule` + `initdbWasmModule` + `fsBundle` – with the old name `wasmModule` it
  silently fetches next to `sw.js`, gets 404 and hangs.
- **React:** the server bundle contains React's Node build; it asks for `stream`, `util`, `react-dom`,
  `react-dom/static` through `createRequire` → `sw/shims/module.js` hands them out.
- **Paths:** client code calls `/api/*` and some images at the site root (no base path) → the worker maps both under
  the base path. vinext writes hashed assets to `dist/client/<base path>/_next`, public files to `dist/client/` →
  `build.mjs` merges them.
- **Login limit:** Better Auth allows 3 logins per 10 s on one shared counter; it lives in the worker's memory. The
  test waits before every fourth login.
- **Headless test:** service workers fail in Playwright's default context ("Failed to access storage") →
  `launchPersistentContext`; the browser is always closed in `finally`.

## Limits

- First visit downloads about 12 MB compressed (PostgreSQL as WASM + the seeded data).
- No e-mail (password reset links would go to a server log that does not exist here); payments are simulated as in the app.
- Data lives in this browser only; clearing site data or "reset" brings back the seeded state.
