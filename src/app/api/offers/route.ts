// Example of the path of a request: all 5 stations in one place (api() bundles stations 1–2 and the error answers).
import { api, readQuery } from "@/server/http";
import { offerSearchQuery } from "@/server/validation/offers";
import { searchOffers } from "@/server/dal/offers";

// 1 Entry point: Next.js Route Handler  GET /api/offers?scope=park|radius&radiusKm=&typeId=&formId=…
export function GET(request: Request) {
  return api(request, "GET /api/offers", async ({ viewer }) => {
    // 2 Better Auth → viewer (inside api())
    const query = readQuery(request, offerSearchQuery); // 3 Zod
    return searchOffers(viewer, query); // 4 Data Access Layer (verified members only) → 5 Drizzle
  });
}
