// Better Auth im Browser: ruft /api/auth/* auf derselben Adresse auf (Session per Cookie).
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
