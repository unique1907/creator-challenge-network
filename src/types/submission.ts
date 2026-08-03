export type SubmissionAssetType = "FILE" | "LINK";

export type SubmissionAsset = {
  id: string;
  type: SubmissionAssetType;
  displayName: string;
  originalFilename?: string;
  mimeType?: string;
  extension?: string;
  fileSize?: number;
  storageKey?: string;
  reviewUrl?: string;
  linkUrl?: string;
  checksum?: string;
  order: number;
  primary: boolean;
  createdAt: string;
};

export type SubmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "WITHDRAWN"
  | "SHORTLISTED"
  | "WINNER"
  | "REJECTED";

export type Submission = {
  id: string;
  challengeId: `0x${string}`;
  creatorAccountId: string;
  creatorWalletAddress: `0x${string}`;
  anonymousEntryCode: string;
  title: string;
  description: string;
  primaryAssetUrl: string;
  supportingLinks: string[];
  assets: SubmissionAsset[];
  status: SubmissionStatus;
  version?: number;
  submittedAt?: string;
  updatedAt: string;
};

export type SubmissionDraftInput = {
  title: unknown;
  description: unknown;
  primaryAssetUrl: unknown;
  supportingLinks: unknown;
  assets?: unknown;
};

export type BlindReviewEntry = {
  blindEntryId: string;
  anonymousEntryCode: string;
  title: string;
  description: string;
  primaryAssetUrl: string;
  supportingLinks: string[];
  assets: SubmissionAsset[];
  submittedAt: string;
  status: "SUBMITTED";
};

export type FundedChallengeRead = {
  challengeId: `0x${string}`;
  bytecodeExists: boolean;
  isFunded: boolean;
  sponsorMatchesBrand: boolean;
  prizePool: string;
  platformFee: string;
  winnerCount: number;
  prizeDistribution: string[];
  submissionDeadline: number;
  reviewDeadline: number;
  acceptsSubmissions: boolean;
  paused: boolean;
  draftId?: string;
  fundingIntentId?: string;
  publicationStatus?: string;
  escrowContractAddress?: `0x${string}`;
  verified: boolean;
  blockers: string[];
};
