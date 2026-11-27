import { api } from "@/server/http";
import { getImpactOverview } from "@/server/dal/assessments";
import { listChainBenefits } from "@/server/dal/chain";

/**
 * GET /api/my/impact – the own circularity overview: exchanges (verified apart from simulated), approved results and
 * the combined chain benefits both sites released.
 */
export function GET(request: Request) {
  return api(request, "GET /api/my/impact", async ({ viewer }) => {
    const [overview, chain] = await Promise.all([getImpactOverview(viewer), listChainBenefits(viewer)]);
    return { ...overview, chain };
  });
}
