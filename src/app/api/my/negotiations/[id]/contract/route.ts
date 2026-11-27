import { api, readId } from "@/server/http";
import { contractSummaryFor, createContract } from "@/server/dal/contracts";
import { getNegotiation } from "@/server/dal/negotiations";

/** GET /api/my/negotiations/[id]/contract – the live contract of the negotiation (null when there is none). */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/my/negotiations/[id]/contract", async ({ viewer }) => {
    const negotiation = await getNegotiation(viewer, await readId(params)); // 404 outside the pair
    return { contract: await contractSummaryFor(viewer, negotiation.id) };
  });
}

/** POST /api/my/negotiations/[id]/contract – create the contract from the accepted revision (409 NOT_AGREED, CONTRACT_EXISTS). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/negotiations/[id]/contract", async ({ viewer }) => createContract(viewer, await readId(params)));
}
