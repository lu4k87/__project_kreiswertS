import { api, readJson } from "@/server/http";
import { createRequest, listMyRequests } from "@/server/dal/requests";
import { requestInput } from "@/server/validation/requests";

/** GET /api/my/requests – all requests of the own site, every status, with the number of responses. */
export function GET(request: Request) {
  return api(request, "GET /api/my/requests", async ({ viewer }) => ({ requests: await listMyRequests(viewer) }));
}

/** POST /api/my/requests – save a new draft request; the owner is the site of the session. */
export function POST(request: Request) {
  return api(request, "POST /api/my/requests", async ({ viewer }) => createRequest(viewer, await readJson(request, requestInput)));
}
