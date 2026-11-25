// Better Auth im Browser: ruft /api/auth/* auf derselben Adresse auf (Session per Cookie).
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins";
import type { auth } from "@/server/auth";

// inferAdditionalFields: types only (companyName, vatId, materialInterest on sign-up); no server code reaches the browser.
export const authClient = createAuthClient({ plugins: [usernameClient(), inferAdditionalFields<typeof auth>()] });
