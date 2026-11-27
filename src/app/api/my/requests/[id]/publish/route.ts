import { api, readId, readJson } from "@/server/http";
import { publishRequest } from "@/server/dal/requests";
import { requestAction } from "@/server/validation/requests";

/** POST /api/my/requests/[id]/publish – publish a draft (verified site, complete request); sets the expiry date. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/requests/[id]/publish", async ({ viewer }) => {
    const { expectedRevision } = await readJson(request, requestAction, 1024);
    return publishRequest(viewer, await readId(params), expectedRevision);
  });
}
