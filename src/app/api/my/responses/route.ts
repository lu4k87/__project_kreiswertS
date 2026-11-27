import { api } from "@/server/http";
import { listResponses } from "@/server/dal/requests";

/** GET /api/my/responses – responses received for the own requests and those the own site sent. */
export function GET(request: Request) {
  return api(request, "GET /api/my/responses", async ({ viewer }) => ({ responses: await listResponses(viewer) }));
}
