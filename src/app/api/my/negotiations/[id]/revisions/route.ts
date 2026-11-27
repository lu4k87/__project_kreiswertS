import { api, readId, readJson } from "@/server/http";
import { counterPropose } from "@/server/dal/negotiations";
import { counterProposal } from "@/server/validation/negotiations";

/** POST /api/my/negotiations/[id]/revisions – counterproposal (or a fresh proposal after expiry); earlier revisions stay. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/negotiations/[id]/revisions", async ({ viewer }) => counterPropose(viewer, await readId(params), await readJson(request, counterProposal)));
}
