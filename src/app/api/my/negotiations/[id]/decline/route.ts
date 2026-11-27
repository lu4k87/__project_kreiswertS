import { api, readId, readJson } from "@/server/http";
import { endNegotiation } from "@/server/dal/negotiations";
import { negotiationDecision } from "@/server/validation/negotiations";

/** POST /api/my/negotiations/[id]/decline – the counterpart declines the current revision and ends the negotiation. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/negotiations/[id]/decline", async ({ viewer }) => {
    const id = await readId(params);
    const { expectedRevision } = await readJson(request, negotiationDecision);
    return endNegotiation(viewer, id, expectedRevision, "decline");
  });
}
