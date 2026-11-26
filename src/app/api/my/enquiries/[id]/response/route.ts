import { api, readId, readJson } from "@/server/http";
import { respondToEnquiry } from "@/server/dal/enquiries";
import { enquiryResponseInput } from "@/server/validation/offers";

/** POST /api/my/enquiries/[id]/response – the supplier answers a received enquiry once. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/enquiries/[id]/response", async ({ viewer }) => {
    const { response } = await readJson(request, enquiryResponseInput, 8 * 1024);
    return respondToEnquiry(viewer, await readId(params), response);
  });
}
