// Static demo: same export as src/server/db/client.ts, but PostgreSQL runs inside the browser (PGlite, in the service
// worker). The seeded dump is loaded once; after that the data lives in IndexedDB and survives worker restarts.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import * as authSchema from "@/server/db/auth-schema";

type Demo = { base: string; fetch: typeof fetch; dbVersion: string; filesVersion: string; reset?: () => Promise<void>; flush?: () => Promise<void> };
type State = { version: string; store: string };

const demo = (globalThis as unknown as { __DEMO__: Demo }).__DEMO__;
const STORE_PREFIX = "kreiswerts-demo-";
const stateKey = `${demo.base}/demo-files/state`;
const stateCache = () => caches.open("kreiswerts-demo-state");

async function readState(): Promise<State | null> {
  const stored = await (await stateCache()).match(stateKey);
  return stored ? ((await stored.json()) as State) : null;
}
const writeState = async (state: State) => (await stateCache()).put(stateKey, Response.json(state));
const clearState = async () => (await stateCache()).delete(stateKey);

/** Best effort and never awaited: the browser deletes a store only after its last connection closed. */
function dropStoresExcept(keep: string | null) {
  void indexedDB.databases?.().then((list) => {
    for (const { name } of list) if (name?.startsWith(`/pglite/${STORE_PREFIX}`) && name !== `/pglite/${keep}`) indexedDB.deleteDatabase(name);
  });
}

/** Database files: from the cache the start page filled, otherwise from the host (and into the cache). */
async function file(name: string): Promise<Response> {
  const url = `${demo.base}/demo-files/${name}`;
  const cache = await caches.open(`kreiswerts-demo-files-${demo.filesVersion}`);
  const cached = await cache.match(url);
  if (cached) return cached;
  const response = await demo.fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await cache.put(url, response.clone());
  return response;
}
const compiled = (name: string) => file(name).then((response) => response.arrayBuffer()).then((bytes) => WebAssembly.compile(bytes));

async function start(store: string, fromDump: boolean): Promise<PGlite> {
  const [pgliteWasmModule, initdbWasmModule, fsBundle, loadDataDir] = await Promise.all([
    compiled("pglite.wasm"),
    compiled("initdb.wasm"),
    file("pglite.data").then((response) => response.blob()),
    fromDump ? file("demo-db.tar.gz").then((response) => response.blob()) : undefined,
  ]);
  // relaxedDurability: a query does not wait until IndexedDB has the change (that took seconds per page);
  // the worker stays alive until it is written (flush below, called for every request in sw/entry.js).
  return PGlite.create({ dataDir: `idb://${store}`, relaxedDurability: true, pgliteWasmModule, initdbWasmModule, fsBundle, loadDataDir });
}
const hasTables = (client: PGlite) =>
  client.query<{ found: string | null }>("select to_regclass('public.sites') as found").then((result) => result.rows[0]?.found != null);

let opening: Promise<PGlite> | undefined;
const open = () =>
  (opening ??= (async () => {
    const state = await readState();
    const newStore = `${STORE_PREFIX}${Date.now().toString(36)}`;
    if (state?.version === demo.dbVersion) {
      const client = await start(state.store, false);
      if (await hasTables(client)) return client;
      await client.close().catch(() => {}); // the browser cleared the store but kept the note → start over
    }
    const client = await start(newStore, true);
    await writeState({ version: demo.dbVersion, store: newStore });
    dropStoresExcept(newStore);
    return client;
  })().catch((error) => {
    opening = undefined; // the next request tries again (e.g. the host was not reachable)
    throw error;
  }));

/** "Reset demo": the next request loads the seeded dump into a new store. */
demo.reset = async () => {
  const client = await opening?.catch(() => undefined);
  opening = undefined;
  await clearState();
  await client?.close().catch(() => {});
};

/** Resolves when everything written so far is stored in IndexedDB. */
demo.flush = async () => {
  await (await opening?.catch(() => undefined))?.syncToFs();
};

// drizzle needs the client synchronously, the files arrive later → forward the calls it makes.
const lazy = new Proxy({} as PGlite, {
  get: (_, key) => (...args: unknown[]) => open().then((client) => (client as unknown as Record<PropertyKey, (...a: unknown[]) => unknown>)[key](...args)),
});
export const db = drizzle(lazy, { schema: { ...schema, ...authSchema } });
