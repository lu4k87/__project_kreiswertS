import { api, readId, readJson } from "@/server/http";
import { createEnquiry } from "@/server/dal/enquiries";
import { enquiryInput } from "@/server/validation/offers";

/** POST /api/offers/[id]/enquiries – contact the supplier about this offer (verified sites only). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/offers/[id]/enquiries", async ({ viewer }) =>
    createEnquiry(viewer, await readId(params), await readJson(request, enquiryInput, 8 * 1024)),
  );
}
