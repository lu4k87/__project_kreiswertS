// Demo build: same export as src/server/db/client.ts, but PostgreSQL runs in-process (PGlite) from the seeded dump.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import * as schema from "@/server/db/schema";
import * as authSchema from "@/server/db/auth-schema";

const client = new PGlite({ loadDataDir: new Blob([readFileSync("demo/demo-db.tar.gz")]) });
export const db = drizzle(client, { schema: { ...schema, ...authSchema } });
