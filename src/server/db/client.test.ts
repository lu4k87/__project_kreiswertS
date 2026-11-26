import { sql } from "drizzle-orm";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeDatabaseError, isDatabaseError } from "./errors";

vi.mock("server-only", () => ({}));

const globalForDb = globalThis as unknown as { pgPool?: Pool };
const UNREACHABLE = "postgres://nobody:nothing@127.0.0.1:1/none";

async function loadClient(databaseUrl: string) {
  vi.resetModules();
  delete globalForDb.pgPool;
  vi.stubEnv("DATABASE_URL", databaseUrl);
  return (await import("./client")).db;
}

afterEach(async () => {
  await globalForDb.pgPool?.end();
  delete globalForDb.pgPool;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("database client", () => {
  it("loads without DATABASE_URL (next build) and names the missing variable on first use", async () => {
    const db = await loadClient("");
    const error = await db.execute(sql`select 1`).catch((reason: unknown) => reason);
    expect(isDatabaseError(error)).toBe(true);
    expect(describeDatabaseError(error)).toContain("DATABASE_URL fehlt");
    await expect(db.$client.connect()).rejects.toThrow("DATABASE_URL fehlt");
  });

  it("never connects with the defaults of pg when DATABASE_URL is added after the pool was created (next dev)", async () => {
    const db = await loadClient("");
    expect(globalForDb.pgPool).toBeUndefined(); // not kept across module reloads
    vi.stubEnv("DATABASE_URL", UNREACHABLE);
    await expect(db.$client.connect()).rejects.toThrow("DATABASE_URL fehlt");
  });

  it("sets the timeouts: connect 5 s, statement 10 s, query 15 s", async () => {
    const db = await loadClient(UNREACHABLE);
    const options = (db.$client as unknown as { options: Record<string, unknown> }).options;
    expect(options).toMatchObject({
      connectionString: UNREACHABLE,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      query_timeout: 15_000,
    });
    expect(globalForDb.pgPool).toBe(db.$client); // one pool per process in next dev
  });

  it("survives an error on an idle connection (no uncaught exception)", async () => {
    const db = await loadClient(UNREACHABLE);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => db.$client.emit("error", new Error("terminating connection"))).not.toThrow();
    expect(log).toHaveBeenCalledWith("PostgreSQL: ruhende Verbindung verloren –", "terminating connection");
  });
});
