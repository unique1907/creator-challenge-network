export type ReviewCriterionKey = "creativity" | "brandFit" | "execution";

export type SubmissionReviewStatus = "NOT_STARTED" | "COMPLETED";

export type SubmissionReviewRecord = {
  challengeId: string;
  submissionId: string;
  creativity: number | null;
  brandFit: number | null;
  execution: number | null;
  notes: string;
  status: SubmissionReviewStatus;
  updatedAt: string | null;
};
