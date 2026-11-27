import { api, readId, readJson } from "@/server/http";
import { voidContract } from "@/server/dal/contracts";
import { contractVoid } from "@/server/validation/contracts";

/** POST /api/my/contracts/[id]/void – either site voids the contract while a signature is missing, with a reason. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/contracts/[id]/void", async ({ viewer }) => voidContract(viewer, await readId(params), await readJson(request, contractVoid)));
}
