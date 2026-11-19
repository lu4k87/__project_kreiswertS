// Station 2 – Authentifizierung: Better Auth (Login per E-Mail + Passwort, Session-Cookie).
// Better Auth legt eigene Tabellen an (auth_*), siehe src/server/db/auth-schema.ts.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db/client";
import * as authSchema from "./db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true },
  user: {
    modelName: "auth_users",
    additionalFields: {
      // Standort des Mitglieds (sites.id); wird vom Backend gesetzt, nie vom Browser.
      siteId: { type: "number", required: false, input: false, fieldName: "site_id" },
    },
  },
  session: { modelName: "auth_sessions" },
  account: { modelName: "auth_accounts" },
  verification: { modelName: "auth_verifications" },
  plugins: [nextCookies()],
});
