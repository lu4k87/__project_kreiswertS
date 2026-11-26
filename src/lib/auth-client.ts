// Better Auth in the browser: calls /api/auth/* on the same address (session via cookie).
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins";
import type { auth } from "@/server/auth";

// Server not reachable (offline, server stopped): fetch rejects and the calling form would stay locked in its
// "busy" state without a message. Answer 503 instead → callers get `{ error }` like for any other failure.
export const fetchOrUnavailable: typeof fetch = (...args) =>
  fetch(...args).catch(() => new Response(null, { status: 503 }));

// inferAdditionalFields: types only (companyName, vatId, materialInterest on sign-up); no server code reaches the browser.
export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: fetchOrUnavailable },
  plugins: [usernameClient(), inferAdditionalFields<typeof auth>()],
});
