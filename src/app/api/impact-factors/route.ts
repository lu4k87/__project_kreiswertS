import { api } from "@/server/http";
import { listFactors } from "@/server/dal/assessments";

/** GET /api/impact-factors – emission factors with unit, version, geography, boundary and source (reference data). */
export function GET(request: Request) {
  return api(request, "GET /api/impact-factors", async () => ({ factors: await listFactors() }), { anonymous: true });
}
