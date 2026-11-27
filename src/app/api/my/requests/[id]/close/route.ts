import { api, readId, readJson } from "@/server/http";
import { closeRequest } from "@/server/dal/requests";
import { requestClose } from "@/server/validation/requests";

/** POST /api/my/requests/[id]/close – `{ reason: "fulfilled" | "withdrawn" }`; closing a closed request answers the same. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/requests/[id]/close", async ({ viewer }) => {
    const { reason } = await readJson(request, requestClose, 1024);
    return closeRequest(viewer, await readId(params), reason);
  });
}
