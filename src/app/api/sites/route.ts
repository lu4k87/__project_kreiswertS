import { api, readQuery } from "@/server/http";
import { listSites } from "@/server/dal/sites";
import { siteDirectoryQuery } from "@/server/validation/sites";

/** GET /api/sites?q=&industry=&capability=&parkId= – company directory (verified members). */
export function GET(request: Request) {
  return api(request, "GET /api/sites", async ({ viewer }) => ({ sites: await listSites(viewer, readQuery(request, siteDirectoryQuery)) }));
}
