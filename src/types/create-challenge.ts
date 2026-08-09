export type CreateChallengeStepId =
  | "basics"
  | "prize-pool"
  | "review-rules"
  | "funding"
  | "publish";

export type CreateChallengeStep = {
  id: CreateChallengeStepId;
  label: string;
  description: string;
};

export type ChallengeDraft = {
  id?: string;
  slug?: string;
  challengeId?: `0x${string}`;
  title: string;
  brandName: string;
  category: string;
  market: string;
  summary: string;
  description: string;
  coverImageKey?: string | null;
  coverImageAlt?: string | null;
  coverImageUpdatedAt?: string | null;
  primaryDeliverable: string;
  supportingDeliverables: string[];
  referenceLinks: string[];
  attachments: string[];
  deadline: string;
  usageRightsAcknowledged: boolean;
  isSmokeTest?: boolean;
  slugReservedForTitle?: string;
};

export type PrizeDistribution = {
  place: string;
  amount: number;
  currency: "test USDC";
};

export type PrizeDistributionMode = "recommended" | "equal" | "custom";

export type PrizePool = {
  totalAmount: number;
  currency: "test USDC";
  winnerCount: 1 | 3;
  distributionMode: PrizeDistributionMode;
  prizeDistribution: PrizeDistribution[];
  platformFee: number;
  estimatedGas: number;
  totalRequired: number;
  prizePoolUnits: string;
  distributionUnits: string[];
  platformFeeUnits: string;
  totalRequiredUnits: string;
  allocatedUnits: string;
  remainingUnits: string;
};

export type ReviewRules = {
  blindReview: boolean;
  anonymousSubmission: boolean;
  aiAllowed: boolean;
  allowedFormats: string[];
  usageRights: string;
  submissionDeadline: string;
  reviewDeadline: string;
  judgingCriteria: string[];
  creatorAcknowledgement: boolean;
  cancellationAcknowledgement: boolean;
};

export type FundingState = {
  network: "Arc Testnet";
  walletId: string;
  walletAddress: string;
  availableBalance: number;
  fundingStatus:
    | "not-started"
    | "ready"
    | "approval-pending"
    | "approved"
    | "funding-pending"
    | "funded"
    | "live";
  escrowStatus: "not-created" | "pending" | "locked" | "verified";
  transactionId: string;
  transactionHash: string;
  fundingChallengeId?: string;
  fundingBlockNumber?: string;
  fundingLogIndex?: string;
  eventVerified?: boolean;
  approvalTransactionId: string;
  approvalTransactionHash: string;
  fundingIntentId: string;
  lastBalanceRefreshAt: string;
};

export type DeploymentState = {
  status: "draft" | "ready" | "deploying" | "success" | "error";
  currentStep: CreateChallengeStepId;
  errorMessage: string;
  challengeId: string;
  publicationStatus: "draft" | "ready-to-publish" | "live";
  publishedAt?: string;
};

export type CreateChallengeDraftState = {
  challenge: ChallengeDraft;
  prizePool: PrizePool;
  reviewRules: ReviewRules;
  funding: FundingState;
  deployment: DeploymentState;
  updatedAt?: string;
};

export type CreateChallengeValidation = {
  step: CreateChallengeStepId;
  valid: boolean;
  errors: string[];
};

export type CreateChallengeReadinessStatus = "ready" | "missing" | "needs_correction";

export type CreateChallengeLaunchReadinessItem = {
  id: string;
  label: string;
  step: CreateChallengeStepId;
  status: CreateChallengeReadinessStatus;
  message: string;
};

export type CreateChallengeLaunchReadiness = {
  valid: boolean;
  items: CreateChallengeLaunchReadinessItem[];
  errors: string[];
};

export type CreateChallengePaymentState =
  | "NOT_STARTED"
  | "ACCOUNT_LOADING"
  | "BALANCE_LOADING"
  | "BALANCE_READY"
  | "INSUFFICIENT_BALANCE"
  | "READY_FOR_APPROVAL"
  | "APPROVAL_PENDING"
  | "APPROVED"
  | "FUNDING_PENDING"
  | "RECONCILING"
  | "FUNDED_VERIFIED"
  | "PUBLISHED"
  | "RECOVERABLE_ERROR"
  | "FATAL_ERROR";

export type CreateChallengePaymentProgressItem = {
  label: string;
  status: "done" | "active" | "pending" | "warning";
  description?: string;
  technology?: string;
};
