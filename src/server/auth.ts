// Station 2 – authentication: Better Auth (login via e-mail or username + password, session cookie).
// Better Auth legt eigene Tabellen an (auth_*), siehe src/server/db/auth-schema.ts.
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
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

/** Text for the log without control characters (line breaks, terminal sequences) and shortened: Better Auth also logs values from the request. */
function printable(value: unknown): unknown {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").slice(0, 500) : value;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true },
  user: {
    modelName: "auth_users",
    additionalFields: {
      // The member's site (sites.id); set by the backend, never by the browser.
      siteId: { type: "number", required: false, input: false, fieldName: "site_id" },
      // Company data from sign-up. Nullable in the DB (older accounts); the hook below enforces them.
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
    // Sign-up: company fields, username and name (1–100 characters) are required, the password needs a digit + capital letter;
    // the server does not accept a profile image (src/server/validation/registration.ts).
    // Change/reset password: the same password rule as on sign-up.
    // Update profile: a username and name sent along must be valid, profile image as above.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const code = registrationError(ctx.body);
        if (code) throw APIError.from("BAD_REQUEST", { code, message: code });
      }
      if (ctx.path === "/update-user") {
        // Session first: this hook runs before the username plugin, which would otherwise tell a visitor without a
        // login whether a username exists ("already taken" instead of 401) – the endpoint itself checks the session last.
        if (!(await getSessionFromCtx(ctx))) {
          throw APIError.from("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "Unauthorized" });
        }
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
  // Protection against password guessing: at most 3 login/sign-up requests per 10 s (Better Auth default).
  // Enabled explicitly, otherwise the limit applies only in production mode and is missing under `next dev`.
  rateLimit: { enabled: true },
  advanced: {
    // No header counts as the client address: any browser can set X-Forwarded-For itself (Next.js passes the value through
    // unchecked) and so get a fresh counter per request. Consequence: all clients share one counter
    // per path. Behind a reverse proxy, enter the header here that the proxy itself overwrites (e.g. "x-real-ip") –
    // and make the Next.js port reachable for the proxy only, otherwise a client sets the header itself again.
    ipAddress: { ipAddressHeaders: [] },
  },
  // Log database errors without query and parameters – they would contain e.g. the session token. Two places log otherwise:
  // the Better Auth logger (filtered here) and the router below it, which prints unhandled errors directly via console.error.
  // `throw` passes them on to the route handler instead (src/app/api/auth/[...all]/route.ts), which shortens them.
  logger: {
    // The message is a separate argument, never the first: only there would a "%s" from a request count as a placeholder.
    log: (level, message, ...args) =>
      console[level]("[Better Auth]", ...[message, ...args].map((part) => printable(withoutQueryDetails(part)))),
  },
  onAPIError: { throw: true },
  // Login via username or e-mail; username: 3–30 characters from a–z, 0–9, _ and . (plugin default).
  // displayUsername off: unchecked free text, the pages do not need it (security review 2026-11-25).
  plugins: [username({ displayUsername: false }), nextCookies()],
  // Reveals without login whether a username exists; the UI does not use the endpoint.
  disabledPaths: ["/is-username-available"],
});
