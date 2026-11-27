import { api, readId, readJson } from "@/server/http";
import { createResponse, listResponses } from "@/server/dal/requests";
import { responseInput } from "@/server/validation/requests";

type Context = { params: Promise<{ id: string }> };

/** GET /api/requests/[id]/responses – the owner gets every response, a responder only its own. */
export function GET(request: Request, { params }: Context) {
  return api(request, "GET /api/requests/[id]/responses", async ({ viewer }) => ({ responses: await listResponses(viewer, await readId(params)) }));
}

/** POST /api/requests/[id]/responses – respond to an open request (verified sites, once per site). */
export function POST(request: Request, { params }: Context) {
  return api(request, "POST /api/requests/[id]/responses", async ({ viewer }) =>
    createResponse(viewer, await readId(params), await readJson(request, responseInput, 8 * 1024)),
  );
}
