// Detects database errors, even when wrapped (Better Auth attaches the DB error as `cause`).
// Caution: matches EVERY failed query (also unique violation, missing column, timeout), not only "unreachable".
// Use only for read paths that fall back to the fewest rights; in write paths check the Postgres code (cause.code).
import { DrizzleQueryError } from "drizzle-orm";

export function isDatabaseError(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (current instanceof DrizzleQueryError) return true;
  }
  return false;
}

// Deliberately broader than isDatabaseError() for the log: anything carrying query + parameters counts.
function carriesQuery(error: Error): boolean {
  return error instanceof DrizzleQueryError || ("query" in error && "params" in error);
}

function findQueryError(error: unknown): Error | null {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (carriesQuery(current)) return current;
  }
  return null;
}

/**
 * Summary of a database error for the server log: only code + message of the cause, e.g. "[ECONNREFUSED] connect …".
 * Drizzle's own message contains query and parameters – that is where e.g. the session token appears.
 */
export function describeDatabaseError(error: unknown): string {
  const cause: unknown = findQueryError(error)?.cause;
  if (!(cause instanceof Error)) return "Datenbankfehler (Ursache unbekannt)";
  const code = "code" in cause && typeof cause.code === "string" ? `[${cause.code}] ` : "";
  return `Datenbankfehler: ${code}${cause.message.slice(0, 200)}`;
}

/** For loggers: database error → summary; text from "Failed query" on (query + parameters follow) is cut off. */
export function withoutQueryDetails(value: unknown): unknown {
  if (typeof value === "string") {
    const start = value.indexOf("Failed query");
    return start === -1 ? value : `${value.slice(0, start)}Datenbankfehler (Abfrage ausgeblendet)`;
  }
  return findQueryError(value) ? describeDatabaseError(value) : value;
}
