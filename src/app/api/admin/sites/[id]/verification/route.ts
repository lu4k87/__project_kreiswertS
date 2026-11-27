import { api, readId, readJson } from "@/server/http";
import { decideVerification } from "@/server/dal/admin";
import { verificationDecision } from "@/server/validation/sites";

/** POST /api/admin/sites/[id]/verification – verify, decline or reset a site (administrator). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/admin/sites/[id]/verification", async ({ viewer }) =>
    decideVerification(viewer, await readId(params), await readJson(request, verificationDecision, 8 * 1024)),
  );
}
