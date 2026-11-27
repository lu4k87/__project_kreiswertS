import { api, readId, readJson } from "@/server/http";
import { acceptProposal } from "@/server/dal/negotiations";
import { negotiationDecision } from "@/server/validation/negotiations";

/** POST /api/my/negotiations/[id]/accept – the counterpart accepts the current pending revision; its terms are then locked. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/negotiations/[id]/accept", async ({ viewer }) => {
    const id = await readId(params);
    const { expectedRevision } = await readJson(request, negotiationDecision);
    return acceptProposal(viewer, id, expectedRevision);
  });
}
