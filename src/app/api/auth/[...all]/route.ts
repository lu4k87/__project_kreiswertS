// Better Auth: /api/auth/sign-up/email, /api/auth/sign-in/email, /api/auth/sign-out, /api/auth/get-session …
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
import { withBodyLimit } from "@/server/body-limit";
import { withoutQueryDetails } from "@/server/db/errors";

type Handler = (request: Request) => Promise<Response>;

/**
 * Fehler, die Better Auth nicht selbst beantwortet, kommen hier an (onAPIError.throw in src/server/auth.ts).
 * Datenbank-Fehler stehen nur als Kurzfassung im Log: das Fehlerobjekt enthält Abfrage und Parameter, z. B. das Session-Token.
 */
function withSafeErrorLog(handler: Handler): Handler {
  return async (request) => {
    // Pfad ohne das Token aus /reset-password/<Token> (Link aus der Passwort-Mail) – das gehört nicht ins Log.
    const path = new URL(request.url).pathname.replace(/(\/reset-password\/)[^/]+/, "$1***");
    const route = `${request.method} ${path}`;
    try {
      const response = await handler(request);
      // "Auth-Route:" steht vorn: nur das erste Argument gilt als Formatstring, ein „%c“ aus dem Pfad wirkt so nicht.
      if (response.status >= 500) console.error("Auth-Route:", `${route} → HTTP ${response.status}`);
      return response;
    } catch (error) {
      const summary = withoutQueryDetails(error);
      if (summary === error) throw error; // Programmfehler bleibt ein 500 mit Stacktrace im Server-Log
      console.error("Auth-Route:", `${route}:`, summary);
      return new Response(null, { status: 500 });
    }
  };
}

const handlers = toNextJsHandler(auth);

export const GET = withSafeErrorLog(handlers.GET);
// Anmelde-Daten sind klein → mehr als 16 KB liest der Server gar nicht erst ein (HTTP 413).
export const POST = withBodyLimit(withSafeErrorLog(handlers.POST), 16 * 1024);
