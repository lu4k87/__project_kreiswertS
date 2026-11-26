import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

type ConnectCallback = Parameters<Pool["connect"]>[0];

/**
 * Pool that requires DATABASE_URL only on the first connection: `next build` loads this module but needs no
 * database. Without the check pg would silently use its defaults (localhost, operating system user).
 * The address at creation counts, not the current environment variable: a pool created without an address never connects.
 */
class AppPool extends Pool {
  constructor(
    private readonly url: string | undefined,
    config: PoolConfig,
  ) {
    super({ ...config, connectionString: url });
  }

  connect(): Promise<PoolClient>;
  connect(callback: ConnectCallback): void;
  connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    if (this.url) return callback ? super.connect(callback) : super.connect();
    const error = new Error("DATABASE_URL fehlt – .env aus .env.example anlegen");
    if (!callback) return Promise.reject(error);
    callback(error, undefined, () => {});
  }
}

function createPool(): Pool {
  const pool = new AppPool(process.env.DATABASE_URL, {
    max: 10,
    connectionTimeoutMillis: 5_000, // database gone → error after 5 s instead of waiting forever
    statement_timeout: 10_000, // the server cancels a query after 10 s
    query_timeout: 15_000, // emergency brake in the client in case the server stops answering
  });
  // Without a listener, an error on an idle connection (DB restart, dropped connection) ends the process.
  pool.on("error", (error) => console.error("PostgreSQL: ruhende Verbindung verloren –", error.message));
  return pool;
}

// One pool per process; Next.js reloads modules in dev mode → keep the pool on globalThis. Not a pool without an address:
// it would otherwise remain after DATABASE_URL was added to .env.
const globalForDb = globalThis as unknown as { pgPool?: Pool };
const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production" && process.env.DATABASE_URL) globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema: { ...schema, ...authSchema } });
