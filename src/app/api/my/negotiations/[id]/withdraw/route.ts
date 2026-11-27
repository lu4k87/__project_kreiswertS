import { api, readId, readJson } from "@/server/http";
import { endNegotiation } from "@/server/dal/negotiations";
import { negotiationDecision } from "@/server/validation/negotiations";

/** POST /api/my/negotiations/[id]/withdraw – the author withdraws the pending proposal (either party after expiry). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/negotiations/[id]/withdraw", async ({ viewer }) => {
    const id = await readId(params);
    const { expectedRevision } = await readJson(request, negotiationDecision);
    return endNegotiation(viewer, id, expectedRevision, "withdraw");
  });
}
