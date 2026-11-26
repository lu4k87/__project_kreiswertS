import { api } from "@/server/http";
import { listEnquiries } from "@/server/dal/enquiries";

/** GET /api/my/enquiries – enquiries the own site received and sent. */
export function GET(request: Request) {
  return api(request, "GET /api/my/enquiries", async ({ viewer }) => ({ enquiries: await listEnquiries(viewer) }));
}
