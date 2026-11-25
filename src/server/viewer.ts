import "server-only";
import { auth } from "./auth";
import { isDatabaseError } from "./db/errors";

/** Wer fragt? Gast (ohne Cookie) oder Mitglied (mit Session-Cookie). */
export type Viewer =
  | { role: "guest" }
  | { role: "member"; userId: string; siteId: number | null };

export async function getViewer(headers: Headers): Promise<Viewer> {
  const session = await auth.api.getSession({ headers });
  if (!session) return { role: "guest" };
  return { role: "member", userId: session.user.id, siteId: session.user.siteId ?? null };
}

/**
 * Für Seiten: Ist die Datenbank nicht erreichbar, lässt sich die Session nicht lesen → Seite wie für einen Gast zeigen
 * (wenigste Rechte) statt Absturzseite. API-Routen nehmen getViewer() und antworten selbst mit 503.
 */
export async function getViewerOrGuest(headers: Headers): Promise<Viewer> {
  try {
    return await getViewer(headers);
  } catch (error) {
    if (!isDatabaseError(error)) throw error; // Programmfehler bleibt ein Fehler
    // Ohne Fehlerobjekt: dessen Meldung enthält die Abfrage samt Session-Token; Better Auth loggt den Fehler bereits.
    console.error("Session nicht lesbar: Datenbank nicht erreichbar → Seite wie für einen Gast");
    return { role: "guest" };
  }
}
