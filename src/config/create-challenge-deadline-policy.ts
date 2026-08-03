export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const PRODUCTION_DEADLINE_WINDOW_SECONDS = 86_400;
export const SHORT_SMOKE_DEADLINE_WINDOW_SECONDS = 900;
export const PRODUCTION_DEADLINE_WINDOW_MINUTES = 1_440;
export const SHORT_SMOKE_DEADLINE_WINDOW_MINUTES = 15;

export type CreateChallengeDeadlinePolicyMode = "production" | "smoke";

export type CreateChallengeDeadlinePolicy = {
  mode: CreateChallengeDeadlinePolicyMode;
  minimumSubmissionLeadMinutes: number;
  minimumReviewGapMinutes: number;
  reason: string;
};

type PolicyEnv = Record<string, string | undefined>;

export function getCreateChallengeDeadlinePolicy(input: {
  env?: PolicyEnv;
  runtimeBlockchain?: "ARC-TESTNET" | string;
  chainId?: number;
  isSmokeTestChallenge?: boolean;
} = {}): CreateChallengeDeadlinePolicy {
  const env = input.env ?? process.env;
  const smokeEnabled =
    env.NODE_ENV !== "production" &&
    env.VERCEL_ENV !== "production" &&
    env.CCN_DEPLOYMENT_ENV !== "production" &&
    (
    env.CCN_ENABLE_SHORT_SMOKE_WINDOWS === "true" ||
      env.CCN_SMOKE_TEST_MODE === "true"
    );

  if (!smokeEnabled) {
    return {
      mode: "production",
      minimumSubmissionLeadMinutes: PRODUCTION_DEADLINE_WINDOW_MINUTES,
      minimumReviewGapMinutes: PRODUCTION_DEADLINE_WINDOW_MINUTES,
      reason: "Production deadline policy enforced.",
    };
  }

  return {
    mode: "smoke",
    minimumSubmissionLeadMinutes: SHORT_SMOKE_DEADLINE_WINDOW_MINUTES,
    minimumReviewGapMinutes: SHORT_SMOKE_DEADLINE_WINDOW_MINUTES,
    reason: "Development smoke deadline policy enabled by server configuration.",
  };
}

function describeWindow(seconds: number) {
  if (seconds % 86_400 === 0) return `${seconds / 86_400} day${seconds === 86_400 ? "" : "s"}`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hour${seconds === 3_600 ? "" : "s"}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `${seconds} seconds`;
}

export function validateCreateChallengeDeadlines(input: {
  submissionDeadline: number;
  reviewDeadline: number;
  nowSeconds?: number;
  isSmokeTestChallenge?: boolean;
  env?: PolicyEnv;
  runtimeBlockchain?: "ARC-TESTNET" | string;
  chainId?: number;
  policy?: CreateChallengeDeadlinePolicy;
}) {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const policy = input.policy;
  if (!policy) {
    const env = input.env ?? process.env;
    const isDevelopment =
      env.NODE_ENV !== "production" &&
      env.VERCEL_ENV !== "production" &&
      env.CCN_DEPLOYMENT_ENV !== "production";
    if (isDevelopment) {
      throw new Error("Create Challenge deadline validation requires an explicit server-resolved deadline policy.");
    }
  }
  const resolvedPolicy = policy ?? getCreateChallengeDeadlinePolicy({ env: input.env });
  const minimumSubmissionLeadSeconds = resolvedPolicy.minimumSubmissionLeadMinutes * 60;
  const minimumReviewGapSeconds = resolvedPolicy.minimumReviewGapMinutes * 60;
  const errors: string[] = [];

  if (!input.submissionDeadline || input.submissionDeadline <= nowSeconds) {
    errors.push("Submission date and time must be in the future.");
  } else if (input.submissionDeadline < nowSeconds + minimumSubmissionLeadSeconds) {
    errors.push(`Submission date and time must be at least ${describeWindow(minimumSubmissionLeadSeconds)} from now.`);
  }

  if (!input.reviewDeadline || input.reviewDeadline <= input.submissionDeadline) {
    errors.push("Review date and time must be after submissions close.");
  } else if (input.reviewDeadline < input.submissionDeadline + minimumReviewGapSeconds) {
    errors.push(`Review date and time must be at least ${describeWindow(minimumReviewGapSeconds)} after submissions close.`);
  }

  return { policy: resolvedPolicy, errors };
}

export function logCreateChallengeDeadlinePolicy(route: string, policy: CreateChallengeDeadlinePolicy) {
  if (process.env.NODE_ENV === "production") return;
  console.info(
    `[deadline-policy] route=${route} mode=${policy.mode} submissionLeadMinutes=${policy.minimumSubmissionLeadMinutes} reviewGapMinutes=${policy.minimumReviewGapMinutes}`,
  );
}
