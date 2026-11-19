// Better Auth: /api/auth/sign-up/email, /api/auth/sign-in/email, /api/auth/sign-out, /api/auth/get-session …
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

export const { GET, POST } = toNextJsHandler(auth);
