import { api } from "@/server/http";
import { publicMap } from "@/server/dal/map";

/**
 * GET /api/public/map – public projection for everyone: park areas, publicly listed sites, general categories and
 * simulated pathways. Takes no parameters and reads no session: whatever a request contains, the answer is the same.
 */
export function GET(request: Request) {
  return api(request, "GET /api/public/map", () => publicMap(), { anonymous: true });
}
