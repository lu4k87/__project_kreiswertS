import { api, readJson } from "@/server/http";
import { saveAssessment } from "@/server/dal/assessments";
import { assessmentSave } from "@/server/validation/assessments";

/**
 * PUT /api/my/assessments – create or replace the own private assessment of a match (feasibility, environmental)
 * or of a negotiation (feasibility). `expectedRevision`: null to create, otherwise the revision the page showed.
 */
export function PUT(request: Request) {
  return api(request, "PUT /api/my/assessments", async ({ viewer }) => saveAssessment(viewer, await readJson(request, assessmentSave)));
}
