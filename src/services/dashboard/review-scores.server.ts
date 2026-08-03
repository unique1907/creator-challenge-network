import "server-only";

import { createSupabaseAdminClient } from "@/services/supabase/admin.server";
import type { SubmissionReviewRecord } from "@/types/review";

function normalizeScore(value: unknown, label: string) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 100) {
    throw new Error(`${label} must be a score from 0 to 100.`);
  }
  return Math.round(numberValue);
}

function normalizeNotes(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 1200);
}

function parseReviewState(value: unknown): Pick<SubmissionReviewRecord, "creativity" | "brandFit" | "execution" | "status"> {
  if (typeof value !== "number") {
    return { creativity: null, brandFit: null, execution: null, status: "NOT_STARTED" };
  }
  return {
    creativity: value,
    brandFit: value,
    execution: value,
    status: "COMPLETED",
  };
}

export async function listSubmissionReviewScores(challengeId: string): Promise<SubmissionReviewRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ccn_review_scores")
    .select("challenge_id,submission_id,score,notes,updated_at")
    .eq("challenge_id", challengeId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    challengeId: row.challenge_id,
    submissionId: row.submission_id,
    ...parseReviewState(row.score),
    notes: typeof row.notes === "string" ? row.notes : "",
    updatedAt: row.updated_at ?? null,
  }));
}

export async function saveSubmissionReviewScore(input: {
  challengeId: string;
  submissionId: string;
  reviewerAccountId: string;
  creativity: unknown;
  brandFit: unknown;
  execution: unknown;
  notes: unknown;
}) {
  const creativity = normalizeScore(input.creativity, "Creativity");
  const brandFit = normalizeScore(input.brandFit, "Brand Fit");
  const execution = normalizeScore(input.execution, "Execution");
  const notes = normalizeNotes(input.notes);
  const score = Math.round((creativity + brandFit + execution) / 3);
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ccn_review_scores")
    .upsert({
      challenge_id: input.challengeId,
      submission_id: input.submissionId,
      reviewer_account_id: input.reviewerAccountId,
      score,
      notes,
      updated_at: now,
    }, { onConflict: "challenge_id,submission_id,reviewer_account_id" });

  if (error) throw error;

  return {
    challengeId: input.challengeId,
    submissionId: input.submissionId,
    creativity,
    brandFit,
    execution,
    notes,
    status: "COMPLETED",
    updatedAt: now,
  } satisfies SubmissionReviewRecord;
}
