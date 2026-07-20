export type CreateChallengeStepId =
  | "basics"
  | "prize-pool"
  | "review-rules"
  | "funding"
  | "deploy";

export type CreateChallengeStep = {
  id: CreateChallengeStepId;
  label: string;
  description: string;
};

export type ChallengeDraft = {
  title: string;
  brandName: string;
  category: string;
  market: string;
  description: string;
  referenceLinks: string[];
  attachments: string[];
  deadline: string;
};

export type PrizeDistribution = {
  place: string;
  amount: number;
  currency: "test USDC";
};

export type PrizePool = {
  totalAmount: number;
  currency: "test USDC";
  winnerCount: number;
  prizeDistribution: PrizeDistribution[];
  platformFee: number;
  estimatedGas: number;
  totalRequired: number;
};

export type ReviewRules = {
  blindReview: boolean;
  anonymousSubmission: boolean;
  aiAllowed: boolean;
  allowedFormats: string[];
  usageRights: string;
};

export type FundingState = {
  network: "Arc Testnet";
  walletId: string;
  walletAddress: string;
  availableBalance: number;
  fundingStatus: "demo-ready" | "not-started" | "pending" | "funded";
  escrowStatus: "demo-only" | "not-created" | "pending" | "locked";
  transactionId: string;
  transactionHash: string;
};

export type DeploymentState = {
  status: "draft" | "ready" | "deploying" | "success" | "error";
  currentStep: CreateChallengeStepId;
  errorMessage: string;
  challengeId: string;
};

export type CreateChallengeDraftState = {
  challenge: ChallengeDraft;
  prizePool: PrizePool;
  reviewRules: ReviewRules;
  funding: FundingState;
  deployment: DeploymentState;
};
