// Better Auth: /api/auth/sign-up/email, /api/auth/sign-in/email, /api/auth/sign-out, /api/auth/get-session …
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
import { withBodyLimit } from "@/server/body-limit";
import { withoutQueryDetails } from "@/server/db/errors";

type Handler = (request: Request) => Promise<Response>;

/**
 * Errors that Better Auth does not answer itself arrive here (onAPIError.throw in src/server/auth.ts).
 * Database errors appear in the log only as a summary: the error object contains query and parameters, e.g. the session token.
 */
function withSafeErrorLog(handler: Handler): Handler {
  return async (request) => {
    // Path without the token from /reset-password/<token> (link from the password e-mail) – it does not belong in the log.
    const path = new URL(request.url).pathname.replace(/(\/reset-password\/)[^/]+/, "$1***");
    const route = `${request.method} ${path}`;
    try {
      const response = await handler(request);
      // "Auth-Route:" comes first: only the first argument counts as a format string, so a "%c" from the path has no effect.
      if (response.status >= 500) console.error("Auth-Route:", `${route} → HTTP ${response.status}`);
      return response;
    } catch (error) {
      const summary = withoutQueryDetails(error);
      if (summary === error) throw error; // a programming error stays a 500 with stack trace in the server log
      console.error("Auth-Route:", `${route}:`, summary);
      return new Response(null, { status: 500 });
    }
  };
}

const handlers = toNextJsHandler(auth);

export const GET = withSafeErrorLog(handlers.GET);
// Login data is small → the server does not even read more than 16 KB (HTTP 413).
export const POST = withBodyLimit(withSafeErrorLog(handlers.POST), 16 * 1024);
