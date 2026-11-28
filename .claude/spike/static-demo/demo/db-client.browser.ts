// Static demo: same export as src/server/db/client.ts, but PostgreSQL runs inside the browser (PGlite) from the seeded dump.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import * as authSchema from "@/server/db/auth-schema";

const base = (globalThis as unknown as { __DEMO_BASE__: string }).__DEMO_BASE__;
const file = (name: string) => fetch(`${base}/_demo/${name}`).then((response) => {
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response;
});

let opening: Promise<PGlite> | undefined;
const open = () =>
  (opening ??= (async () => {
    const compiled = (name: string) => file(name).then((response) => response.arrayBuffer()).then((bytes) => WebAssembly.compile(bytes));
    const [pgliteWasmModule, initdbWasmModule, fsBundle, dump] = await Promise.all([
      compiled("pglite.wasm"),
      compiled("initdb.wasm"),
      file("pglite.data").then((response) => response.blob()),
      file("demo-db.tar.gz").then((response) => response.blob()),
    ]);
    console.log("[demo] database files loaded", dump.size);
    const client = await PGlite.create({ pgliteWasmModule, initdbWasmModule, fsBundle, loadDataDir: dump });
    console.log("[demo] database ready");
    return client;
  })());

// drizzle needs the client synchronously, the files arrive later → forward the calls it makes.
const lazy = new Proxy({} as PGlite, {
  get: (_, key) => (...args: unknown[]) => open().then((client) => (client as unknown as Record<PropertyKey, (...a: unknown[]) => unknown>)[key](...args)),
});
export const db = drizzle(lazy, { schema: { ...schema, ...authSchema } });
