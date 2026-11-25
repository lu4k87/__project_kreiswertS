// Erkennt Datenbank-Fehler, auch wenn sie verpackt sind (Better Auth hängt den DB-Fehler als `cause` an).
import { DrizzleQueryError } from "drizzle-orm";

export function isDatabaseError(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (current instanceof DrizzleQueryError) return true;
  }
  return false;
}
