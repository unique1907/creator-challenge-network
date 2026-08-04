import type { CreateChallengeDraftState, ReviewRules } from "@/types/create-challenge";

const LEGACY_FLOATING_TIMEZONE_OFFSET_MINUTES = 180;

type DeadlineName = "submissionDeadline" | "reviewDeadline";

export type ChallengeDeadlineIssue =
  | "missing-submission-deadline"
  | "missing-review-deadline"
  | "malformed-submission-deadline"
  | "malformed-review-deadline"
  | "invalid-deadline-order";

export type ChallengeDeadlineReadiness =
  | "missing"
  | "malformed"
  | "invalid-order"
  | "submission-open"
  | "review-not-reached"
  | "ready";

export type NormalizedChallengeDeadlines = {
  submissionDeadlineIso: string | null;
  reviewDeadlineIso: string | null;
  submissionDeadlineUnix: number;
  reviewDeadlineUnix: number;
  readiness: ChallengeDeadlineReadiness;
  issues: ChallengeDeadlineIssue[];
};

type DeadlineAliases = Partial<Record<DeadlineName | `${DeadlineName}Utc`, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function parseLegacyFloatingLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return utcMs - LEGACY_FLOATING_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
}

export function parseChallengeDeadline(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return {
      iso: new Date(value * 1000).toISOString(),
      unix: Math.floor(value),
    };
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const parsedMs = hasExplicitTimezone ? Date.parse(trimmed) : parseLegacyFloatingLocal(trimmed);
  if (!Number.isFinite(parsedMs)) return null;
  return {
    iso: new Date(parsedMs).toISOString(),
    unix: Math.floor(parsedMs / 1000),
  };
}

function deadlineValue(reviewRules: ReviewRules | DeadlineAliases, name: DeadlineName) {
  return firstString(
    reviewRules[name],
    (reviewRules as DeadlineAliases)[`${name}Utc`],
  );
}

export function normalizeChallengeDeadlines(
  reviewRules: ReviewRules | DeadlineAliases,
  input: { nowSeconds?: number } = {},
): NormalizedChallengeDeadlines {
  const rawSubmissionDeadline = deadlineValue(reviewRules, "submissionDeadline");
  const rawReviewDeadline = deadlineValue(reviewRules, "reviewDeadline");
  const submission = parseChallengeDeadline(rawSubmissionDeadline);
  const review = parseChallengeDeadline(rawReviewDeadline);
  const issues: ChallengeDeadlineIssue[] = [];

  if (!rawSubmissionDeadline) issues.push("missing-submission-deadline");
  else if (!submission) issues.push("malformed-submission-deadline");

  if (!rawReviewDeadline) issues.push("missing-review-deadline");
  else if (!review) issues.push("malformed-review-deadline");

  if (submission && review && review.unix <= submission.unix) {
    issues.push("invalid-deadline-order");
  }

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  let readiness: ChallengeDeadlineReadiness = "ready";
  if (issues.some((issue) => issue.startsWith("missing"))) readiness = "missing";
  else if (issues.some((issue) => issue.startsWith("malformed"))) readiness = "malformed";
  else if (issues.includes("invalid-deadline-order")) readiness = "invalid-order";
  else if (submission && nowSeconds < submission.unix) readiness = "submission-open";
  else if (review && nowSeconds <= review.unix) readiness = "review-not-reached";

  return {
    submissionDeadlineIso: submission?.iso ?? null,
    reviewDeadlineIso: review?.iso ?? null,
    submissionDeadlineUnix: submission?.unix ?? 0,
    reviewDeadlineUnix: review?.unix ?? 0,
    readiness,
    issues,
  };
}

export function canonicalizeReviewRulesDeadlines<T extends ReviewRules>(reviewRules: T): T {
  const normalized = normalizeChallengeDeadlines(reviewRules);
  if (!normalized.submissionDeadlineIso && !normalized.reviewDeadlineIso) return reviewRules;
  return {
    ...reviewRules,
    submissionDeadline: normalized.submissionDeadlineIso ?? reviewRules.submissionDeadline,
    reviewDeadline: normalized.reviewDeadlineIso ?? reviewRules.reviewDeadline,
  };
}

export function canonicalizeDraftDeadlines<T extends CreateChallengeDraftState>(draft: T): T {
  if (!isRecord(draft.reviewRules)) return draft;
  return {
    ...draft,
    reviewRules: canonicalizeReviewRulesDeadlines(draft.reviewRules),
  };
}

export function deadlineUnixSecondsFromDraft(draft: CreateChallengeDraftState) {
  const normalized = normalizeChallengeDeadlines(draft.reviewRules);
  return {
    submissionDeadline: normalized.submissionDeadlineUnix,
    reviewDeadline: normalized.reviewDeadlineUnix,
  };
}

export function localDateInputPart(value: string) {
  const parsed = parseChallengeDeadline(value);
  if (!parsed) return value ? value.slice(0, 10) : "";
  const date = new Date(parsed.iso);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localTimeInputPart(value: string) {
  const parsed = parseChallengeDeadline(value);
  if (!parsed) return value.includes("T") ? value.slice(11, 16) : "";
  const date = new Date(parsed.iso);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localInputToCanonicalIso(date: string, time: string) {
  if (!date && !time) return "";
  const dateValue = date || localDateInputPart(new Date().toISOString());
  const timeValue = time || "09:00";
  const parsed = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(parsed.getTime())) return `${dateValue}T${timeValue}`;
  return parsed.toISOString();
}
