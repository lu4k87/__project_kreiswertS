import { api, readId } from "@/server/http";
import { getContract } from "@/server/dal/contracts";

/** GET /api/my/contracts/[id] – snapshot, signatures, execution and history (404 outside the pair). */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/my/contracts/[id]", async ({ viewer }) => getContract(viewer, await readId(params)));
}
