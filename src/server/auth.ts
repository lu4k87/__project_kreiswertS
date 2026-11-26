// Station 2 – Authentifizierung: Better Auth (Login per E-Mail oder Benutzername + Passwort, Session-Cookie).
// Better Auth legt eigene Tabellen an (auth_*), siehe src/server/db/auth-schema.ts.
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins/username";
import { db } from "./db/client";
import * as authSchema from "./db/auth-schema";
import { withoutQueryDetails } from "./db/errors";
import {
  companyNameSchema,
  materialInterestSchema,
  passwordSchema,
  profileError,
  REGISTRATION_ERROR,
  registrationError,
  vatIdSchema,
} from "./validation/registration";

/** Text fürs Log ohne Steuerzeichen (Zeilenumbruch, Terminal-Sequenzen) und gekürzt: Better Auth loggt auch Werte aus der Anfrage. */
function printable(value: unknown): unknown {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 500) : value;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true },
  user: {
    modelName: "auth_users",
    additionalFields: {
      // Standort des Mitglieds (sites.id); wird vom Backend gesetzt, nie vom Browser.
      siteId: { type: "number", required: false, input: false, fieldName: "site_id" },
      // Firmendaten aus der Registrierung. In der DB nullable (ältere Konten), Pflicht prüft der Hook unten.
      companyName: {
        type: "string",
        required: false,
        fieldName: "company_name",
        validator: { input: companyNameSchema },
      },
      vatId: { type: "string", required: false, fieldName: "vat_id", validator: { input: vatIdSchema } },
      materialInterest: {
        type: "string",
        required: false,
        fieldName: "material_interest",
        validator: { input: materialInterestSchema },
      },
    },
  },
  session: { modelName: "auth_sessions" },
  account: { modelName: "auth_accounts" },
  verification: { modelName: "auth_verifications" },
  hooks: {
    // Registrierung: Firmenfelder, Benutzername und Name (1–100 Zeichen) sind Pflicht, Passwort braucht Zahl + Großbuchstabe;
    // ein Profilbild nimmt der Server nicht an (src/server/validation/registration.ts).
    // Passwort ändern/zurücksetzen: dieselbe Passwortregel wie bei der Registrierung.
    // Profil ändern: mitgeschickter Benutzername und Name müssen gültig sein, Profilbild wie oben.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const code = registrationError(ctx.body);
        if (code) throw APIError.from("BAD_REQUEST", { code, message: code });
      }
      if (ctx.path === "/update-user") {
        const code = profileError(ctx.body);
        if (code) throw APIError.from("BAD_REQUEST", { code, message: code });
      }
      if (
        (ctx.path === "/change-password" || ctx.path === "/reset-password") &&
        !passwordSchema.safeParse(ctx.body?.newPassword).success
      ) {
        throw APIError.from("BAD_REQUEST", { code: REGISTRATION_ERROR.password, message: REGISTRATION_ERROR.password });
      }
    }),
  },
  // Schutz gegen Passwort-Raten: höchstens 3 Login-/Registrier-Anfragen je 10 s (Standard von Better Auth).
  // Ausdrücklich an, sonst gilt das Limit nur im Produktionsmodus und fehlt unter `next dev`.
  rateLimit: { enabled: true },
  advanced: {
    // Kein Header zählt als Client-Adresse: X-Forwarded-For kann jeder Browser selbst setzen (Next.js reicht den Wert
    // ungeprüft durch) und damit je Anfrage einen frischen Zähler bekommen. Folge: alle Clients teilen sich einen Zähler
    // je Pfad. Hinter einem Reverse-Proxy hier den Header eintragen, den der Proxy selbst überschreibt (z. B. "x-real-ip") –
    // und den Port von Next.js nur für den Proxy erreichbar machen, sonst setzt ein Client den Header wieder selbst.
    ipAddress: { ipAddressHeaders: [] },
  },
  // Datenbank-Fehler ohne Abfrage und Parameter loggen – dort stünde z. B. das Session-Token. Zwei Stellen schreiben sonst mit:
  // der Logger von Better Auth (hier gefiltert) und der Router darunter, der unbehandelte Fehler direkt per console.error
  // ausgibt. `throw` reicht sie stattdessen an den Route Handler weiter (src/app/api/auth/[...all]/route.ts), der sie kürzt.
  logger: {
    // Die Meldung ist ein eigenes Argument, nie der erste: nur dort gälte ein „%s“ aus einer Anfrage als Platzhalter.
    log: (level, message, ...args) =>
      console[level]("[Better Auth]", ...[message, ...args].map((part) => printable(withoutQueryDetails(part)))),
  },
  onAPIError: { throw: true },
  // Login per Benutzername oder E-Mail; Benutzername: 3–30 Zeichen aus a–z, 0–9, _ und . (Standard des Plugins).
  // displayUsername aus: ungeprüfter Freitext, die Seiten brauchen ihn nicht (Security-Review 2026-11-25).
  plugins: [username({ displayUsername: false }), nextCookies()],
  // Verrät ohne Login, ob ein Benutzername existiert; das UI nutzt den Endpunkt nicht.
  disabledPaths: ["/is-username-available"],
});
