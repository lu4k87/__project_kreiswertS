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
