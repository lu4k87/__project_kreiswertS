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
  emailAndPassword: {
    enabled: true,
    // Password recovery (L1-002, D02): single-use link, valid for 30 minutes; the endpoint answers the same for
    // every address. Resetting ends all sessions of the account.
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    // ponytail: no mail provider in the prototype → the link goes to the server log instead of an inbox.
    // Replace this function with the mail call before real use; the token must then never be logged.
    sendResetPassword: async ({ url }) => {
      console.info("[password reset] no mail provider configured – link for the account owner:", printable(url));
    },
  },
  user: {
    modelName: "auth_users",
    additionalFields: {
      // The member's site (sites.id); set by the backend, never by the browser. One account per site (unique).
      siteId: { type: "number", required: false, input: false, fieldName: "site_id" },
      // "member" or "admin". input: false → no request can set it; an administrator exists only through the seed.
      role: { type: "string", required: false, input: false, defaultValue: "member" },
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
        const session = await getSessionFromCtx(ctx);
        if (!session) throw APIError.from("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "Unauthorized" });
        const code = profileError(ctx.body);
        if (code) throw APIError.from("BAD_REQUEST", { code, message: code });
        // Company name and VAT ID identify the company the site was registered (and verified) for: once the account
        // has a site they are fixed – otherwise a verified account could rename itself into another company.
        const user = session.user as { siteId?: number | null };
        if (user.siteId != null && (ctx.body?.companyName !== undefined || ctx.body?.vatId !== undefined)) {
          throw APIError.from("BAD_REQUEST", { code: "FIELD_NOT_ALLOWED", message: "FIELD_NOT_ALLOWED" });
        }
      }
      if (
        (ctx.path === "/change-password" || ctx.path === "/reset-password") &&
        !passwordSchema.safeParse(ctx.body?.newPassword).success
      ) {
        throw APIError.from("BAD_REQUEST", { code: REGISTRATION_ERROR.password, message: REGISTRATION_ERROR.password });
      }
      // Changing the password always ends the other sessions of the account, whatever the request says:
      // a session someone else got hold of must not survive the change (a reset does the same).
      if (ctx.path === "/change-password") {
        return { context: { ...ctx, body: { ...ctx.body, revokeOtherSessions: true } } };
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
  // immutableUsername: the login name is fixed after sign-up – a logged-in account cannot probe which names exist
  // by trying to rename itself.
  plugins: [username({ displayUsername: false, immutableUsername: true }), nextCookies()],
  // Reveals without login whether a username exists; the UI does not use the endpoint.
  disabledPaths: ["/is-username-available"],
});
