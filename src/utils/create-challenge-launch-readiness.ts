import { validateCreateChallengeDeadlines, type CreateChallengeDeadlinePolicy } from "@/config/create-challenge-deadline-policy";
import type {
  CreateChallengeDraftState,
  CreateChallengeLaunchReadiness,
  CreateChallengeLaunchReadinessItem,
  CreateChallengeStepId,
  CreateChallengeValidation,
} from "@/types/create-challenge";
import { deadlineUnixSecondsFromDraft, parseChallengeDeadline } from "@/utils/challenge-deadlines";
import { calculatePrizePool, parseUsdcUnits } from "@/utils/create-challenge-finance";

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function unixFromLocal(value: string) {
  return parseChallengeDeadline(value)?.unix ?? 0;
}

export function validateCreateChallengeStep(
  draft: CreateChallengeDraftState,
  step: CreateChallengeStepId,
  options: { deadlinePolicy?: CreateChallengeDeadlinePolicy } = {},
): CreateChallengeValidation {
  const errors: string[] = [];

  if (step === "basics") {
    if (draft.challenge.title.trim().length < 5 || draft.challenge.title.length > 100) {
      errors.push("Challenge title must be 5-100 characters.");
    }
    if (!draft.challenge.brandName.trim()) errors.push("Brand name is required.");
    const businessDomain = draft.challenge.category.trim();
    if (!businessDomain) errors.push("Challenge Category is required.");
    if (businessDomain.toLowerCase() === "other") {
      errors.push("Specify category is required when Challenge Category is Other.");
    }
    if (!draft.challenge.summary.trim() || draft.challenge.summary.length > 240) {
      errors.push("Business problem summary is required and must be 240 characters or less.");
    }
    if (draft.challenge.description.trim().length < 10) {
      errors.push("Expected Outcome must be at least 10 characters.");
    }
    if (!draft.challenge.usageRightsAcknowledged) {
      errors.push("Usage-rights acknowledgement is required.");
    }
    draft.challenge.referenceLinks.filter(Boolean).forEach((url) => {
      if (!isValidUrl(url)) errors.push(`Invalid reference URL: ${url}`);
    });
  }

  if (step === "prize-pool") {
    const math = calculatePrizePool({
      totalAmount: draft.prizePool.totalAmount,
      winnerCount: draft.prizePool.winnerCount,
      distributionMode: draft.prizePool.distributionMode,
      prizeDistribution: draft.prizePool.prizeDistribution,
    });
    errors.push(...math.errors);
    const balanceUnits = parseUsdcUnits(draft.funding.availableBalance || 0).units;
    if (balanceUnits > BigInt(0) && BigInt(math.totalRequiredUnits) > balanceUnits) {
      errors.push("Total required exceeds the available test USDC balance.");
    }
  }

  if (step === "review-rules") {
    const { submissionDeadline, reviewDeadline } = deadlineUnixSecondsFromDraft(draft);
    const now = Math.floor(Date.now() / 1000);
    const deadlineValidation = validateCreateChallengeDeadlines({
      submissionDeadline,
      reviewDeadline,
      nowSeconds: now,
      isSmokeTestChallenge: draft.challenge.isSmokeTest === true,
      policy: options.deadlinePolicy,
    });
    errors.push(...deadlineValidation.errors);
    if (!draft.reviewRules.judgingCriteria.some((item) => item.trim())) {
      errors.push("At least one judging criterion is required.");
    }
    if (!draft.reviewRules.blindReview) errors.push("Blind review is required in MVP.");
    if (!draft.reviewRules.creatorAcknowledgement) {
      errors.push("Creator acknowledgement is required.");
    }
    if (!draft.reviewRules.cancellationAcknowledgement) {
      errors.push("Brand cancellation acknowledgement is required.");
    }
  }

  return { step, valid: errors.length === 0, errors };
}

function readyItem(id: string, label: string, step: CreateChallengeStepId): CreateChallengeLaunchReadinessItem {
  return {
    id,
    label,
    step,
    status: "ready",
    message: "Ready",
  };
}

function missingItem(
  id: string,
  label: string,
  step: CreateChallengeStepId,
  message: string,
): CreateChallengeLaunchReadinessItem {
  return {
    id,
    label,
    step,
    status: "missing",
    message,
  };
}

function correctionItem(
  id: string,
  label: string,
  step: CreateChallengeStepId,
  message: string,
): CreateChallengeLaunchReadinessItem {
  return {
    id,
    label,
    step,
    status: "needs_correction",
    message,
  };
}

function firstError(errors: string[], fallback: string) {
  return errors.at(0) ?? fallback;
}

export function validateCreateChallengeLaunchReadiness(
  draft: CreateChallengeDraftState,
  options: { deadlinePolicy?: CreateChallengeDeadlinePolicy } = {},
): CreateChallengeLaunchReadiness {
  const basics = validateCreateChallengeStep(draft, "basics", options);
  const prize = validateCreateChallengeStep(draft, "prize-pool", options);
  const rules = validateCreateChallengeStep(draft, "review-rules", options);
  const items: CreateChallengeLaunchReadinessItem[] = [];

  items.push(
    basics.valid
      ? readyItem("campaign-content", "Business challenge content", "basics")
      : correctionItem("campaign-content", "Business challenge content", "basics", firstError(basics.errors, "Complete business challenge content before launch.")),
  );

  items.push(
    draft.challenge.coverImageKey?.trim()
      ? readyItem("campaign-cover", "Business Challenge Cover", "basics")
      : missingItem("campaign-cover", "Business Challenge Cover", "basics", "Add a business challenge cover before publishing."),
  );

  items.push(
    prize.valid
      ? readyItem("prize-winners", "Prize and winners", "prize-pool")
      : correctionItem("prize-winners", "Prize and winners", "prize-pool", firstError(prize.errors, "Complete prize and winner configuration.")),
  );

  const hasAllowedFormats = draft.reviewRules.allowedFormats.length > 0;
  const hasCriteria = draft.reviewRules.judgingCriteria.some((item) => item.trim());
  const rulesMessage = !hasAllowedFormats
    ? "Select at least one allowed submission type."
    : !hasCriteria
      ? "Add at least one judging criterion."
      : firstError(rules.errors, "Complete dates, review rules and acknowledgements.");

  items.push(
    rules.valid && hasAllowedFormats
      ? readyItem("dates-rules", "Dates and rules", "review-rules")
      : correctionItem("dates-rules", "Dates and rules", "review-rules", rulesMessage),
  );

  const errors = items
    .filter((item) => item.status !== "ready")
    .map((item) => item.message);

  return {
    valid: errors.length === 0,
    items,
    errors,
  };
}
