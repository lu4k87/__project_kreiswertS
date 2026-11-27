import { api, readId, readJson } from "@/server/http";
import { approveAssessment } from "@/server/dal/assessments";
import { assessmentApproval } from "@/server/validation/assessments";

type Context = { params: Promise<{ id: string }> };

/** POST /api/my/assessments/[id]/approve – release an own environmental result for the circularity overview. */
export function POST(request: Request, { params }: Context) {
  return api(request, "POST /api/my/assessments/[id]/approve", async ({ viewer }) => {
    const id = await readId(params);
    const { expectedRevision } = await readJson(request, assessmentApproval);
    return approveAssessment(viewer, id, expectedRevision);
  });
}
