import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL fehlt – .env aus .env.example anlegen");

// Ein Pool je Prozess; Next.js lädt Module im Dev-Modus neu → Pool am globalThis halten.
const globalForDb = globalThis as unknown as { pgPool?: Pool };
const pool = globalForDb.pgPool ?? new Pool({ connectionString: url, max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema: { ...schema, ...authSchema } });
