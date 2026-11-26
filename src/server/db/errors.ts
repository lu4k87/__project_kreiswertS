// Erkennt Datenbank-Fehler, auch wenn sie verpackt sind (Better Auth hängt den DB-Fehler als `cause` an).
// Achtung: trifft JEDE fehlgeschlagene Abfrage (auch Unique-Verletzung, fehlende Spalte, Timeout), nicht nur „nicht erreichbar“.
// Nur für Lesepfade nutzen, die auf die wenigsten Rechte zurückfallen; in Schreibpfaden den Postgres-Code (cause.code) prüfen.
import { DrizzleQueryError } from "drizzle-orm";

export function isDatabaseError(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (current instanceof DrizzleQueryError) return true;
  }
  return false;
}

// Fürs Log bewusst weiter gefasst als isDatabaseError(): alles, was Abfrage + Parameter mitführt, zählt.
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
 * Kurzfassung eines Datenbank-Fehlers fürs Server-Log: nur Code + Meldung der Ursache, z. B. „[ECONNREFUSED] connect …“.
 * Die Meldung von Drizzle selbst enthält Abfrage und Parameter – dort steht z. B. das Session-Token.
 */
export function describeDatabaseError(error: unknown): string {
  const cause: unknown = findQueryError(error)?.cause;
  if (!(cause instanceof Error)) return "Datenbankfehler (Ursache unbekannt)";
  const code = "code" in cause && typeof cause.code === "string" ? `[${cause.code}] ` : "";
  return `Datenbankfehler: ${code}${cause.message.slice(0, 200)}`;
}

/** Für Logger: Datenbank-Fehler → Kurzfassung; Text ab „Failed query“ (danach folgen Abfrage + Parameter) wird abgeschnitten. */
export function withoutQueryDetails(value: unknown): unknown {
  if (typeof value === "string") {
    const start = value.indexOf("Failed query");
    return start === -1 ? value : `${value.slice(0, start)}Datenbankfehler (Abfrage ausgeblendet)`;
  }
  return findQueryError(value) ? describeDatabaseError(value) : value;
}
