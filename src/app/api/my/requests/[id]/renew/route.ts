import { api, readId, readJson } from "@/server/http";
import { renewRequest } from "@/server/dal/requests";
import { requestAction } from "@/server/validation/requests";

/** POST /api/my/requests/[id]/renew – validate again and keep the request open for another period. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/requests/[id]/renew", async ({ viewer }) => {
    const { expectedRevision } = await readJson(request, requestAction, 1024);
    return renewRequest(viewer, await readId(params), expectedRevision);
  });
}
