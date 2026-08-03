import { NextResponse } from "next/server";
import { getCreateChallengeDeadlinePolicy } from "@/config/create-challenge-deadline-policy";
import { requireInternalDevelopmentRoute } from "@/app/api/internal/circle/_utils";

export async function GET() {
  const guard = requireInternalDevelopmentRoute();
  if (guard) return guard;

  const policy = getCreateChallengeDeadlinePolicy();
  return NextResponse.json({
    mode: policy.mode,
    minimumSubmissionLeadMinutes: policy.minimumSubmissionLeadMinutes,
    minimumReviewGapMinutes: policy.minimumReviewGapMinutes,
  });
}
