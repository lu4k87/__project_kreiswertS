import { api, readId, readJson } from "@/server/http";
import { signContract } from "@/server/dal/contracts";
import { contractSign } from "@/server/validation/contracts";

/** POST /api/my/contracts/[id]/sign – the site signs the snapshot whose hash the page showed (409 SNAPSHOT_CHANGED otherwise). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/contracts/[id]/sign", async ({ viewer }) => signContract(viewer, await readId(params), await readJson(request, contractSign)));
}
