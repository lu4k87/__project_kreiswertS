// Station 2 – Authentifizierung: Better Auth (Login per E-Mail oder Benutzername + Passwort, Session-Cookie).
// Better Auth legt eigene Tabellen an (auth_*), siehe src/server/db/auth-schema.ts.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins/username";
import { db } from "./db/client";
import * as authSchema from "./db/auth-schema";
import {
  companyNameSchema,
  materialInterestSchema,
  passwordSchema,
  REGISTRATION_ERROR,
  registrationError,
  vatIdSchema,
} from "./validation/registration";

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
    // Registrierung: Firmenfelder sind Pflicht, Passwort braucht Zahl + Großbuchstabe (src/server/validation/registration.ts).
    // Passwort ändern/zurücksetzen: dieselbe Passwortregel wie bei der Registrierung.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const code = registrationError(ctx.body);
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
  // Login per Benutzername oder E-Mail; Benutzername: 3–30 Zeichen aus a–z, 0–9, _ und . (Standard des Plugins).
  // displayUsername aus: ungeprüfter Freitext, die Seiten brauchen ihn nicht (Security-Review 2026-11-25).
  plugins: [username({ displayUsername: false }), nextCookies()],
  // Verrät ohne Login, ob ein Benutzername existiert; das UI nutzt den Endpunkt nicht.
  disabledPaths: ["/is-username-available"],
});
