import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

type ConnectCallback = Parameters<Pool["connect"]>[0];

/**
 * Pool, der DATABASE_URL erst beim ersten Verbindungsaufbau verlangt: `next build` lädt dieses Modul, braucht aber keine
 * Datenbank. Ohne die Prüfung nähme pg still seine Standardwerte (localhost, Nutzer des Betriebssystems).
 * Es zählt die Adresse vom Erzeugen, nicht die Umgebungsvariable von jetzt: ein ohne Adresse erzeugter Pool verbindet nie.
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
    connectionTimeoutMillis: 5_000, // Datenbank weg → Fehler nach 5 s statt endlos warten
    statement_timeout: 10_000, // der Server bricht eine Abfrage nach 10 s ab
    query_timeout: 15_000, // Notbremse im Client, falls der Server gar nicht mehr antwortet
  });
  // Ohne Listener beendet ein Fehler auf einer ruhenden Verbindung (DB-Neustart, gekappte Verbindung) den Prozess.
  pool.on("error", (error) => console.error("PostgreSQL: ruhende Verbindung verloren –", error.message));
  return pool;
}

// Ein Pool je Prozess; Next.js lädt Module im Dev-Modus neu → Pool am globalThis halten. Einen Pool ohne Adresse nicht:
// sonst bliebe er bestehen, nachdem DATABASE_URL in .env nachgetragen wurde.
const globalForDb = globalThis as unknown as { pgPool?: Pool };
const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production" && process.env.DATABASE_URL) globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema: { ...schema, ...authSchema } });
