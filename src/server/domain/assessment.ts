// Private assessments of a match or negotiation (L2-007, L2-008): value lists and the subject key. Pure.

/** feasibility = economic comparison (L2-007), environmental = route comparison (L2-008). */
export const ASSESSMENT_KINDS = ["feasibility", "environmental"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

/** draft = private working state; approved = released by the owner for its own circularity overview (PG-27). */
export const ASSESSMENT_STATUSES = ["draft", "approved"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export type AssessmentSubject = { kind: "match"; requestId: number; offerId: number } | { kind: "negotiation"; negotiationId: number };

/** One assessment per site, kind and subject. */
export function subjectKey(subject: AssessmentSubject): string {
  return subject.kind === "match" ? `match:${subject.requestId}:${subject.offerId}` : `negotiation:${subject.negotiationId}`;
}
