import { api, readId } from "@/server/http";
import { getRequest } from "@/server/dal/requests";

/** GET /api/requests/[id] – one request: full for verified members and the owner, "unavailable" once closed or expired. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/requests/[id]", async ({ viewer }) => getRequest(viewer, await readId(params)));
}
