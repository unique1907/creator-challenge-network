export type EscrowFundingStatus =
  | "READY_FOR_FUNDING"
  | "APPROVAL_PENDING"
  | "APPROVED"
  | "FUNDING_PENDING"
  | "FUNDED"
  | "LIVE";

export type EscrowFundingIntent = {
  ccnAccountId: string;
  authProvider: "email";
  challengeLogicalId: string;
  challengeId: `0x${string}`;
  fundingIntentId: string;
  approvalIdempotencyKey: string;
  fundingIdempotencyKey: string;
  escrowContractAddress: `0x${string}`;
  usdcContractAddress: `0x${string}`;
  brandWalletAddress?: `0x${string}`;
  brandWalletId?: string;
  prizeAmount: string;
  platformFee: string;
  totalRequired: string;
  submissionDeadline: number;
  reviewDeadline: number;
  status: EscrowFundingStatus;
  approvalChallengeId?: string;
  approvalTransactionId?: string;
  approvalTransactionHash?: `0x${string}`;
  fundingChallengeId?: string;
  fundingTransactionId?: string;
  fundingTransactionHash?: `0x${string}`;
  fundingBlockNumber?: string;
  createdAt: string;
  updatedAt: string;
};

export type EscrowPreflightSnapshot = {
  chainId: number;
  wallet: {
    walletId: string;
    walletAddress: `0x${string}`;
    blockchain: "ARC-TESTNET";
    accountType: "SCA";
    state: string;
  };
  challengeId: `0x${string}`;
  fundingIntentId: string;
  status: EscrowFundingStatus;
  amounts: {
    prizeAmount: string;
    platformFee: string;
    totalRequired: string;
  };
  deadlines: {
    submissionDeadline: number;
    reviewDeadline: number;
  };
  balances: {
    brandUsdc: string;
    brandNativeWei: string;
    escrowUsdc: string;
  };
  balanceSource: {
    address: `0x${string}`;
    source: string;
    timestamp: string;
    network: "ARC-TESTNET";
    chainId: number;
  };
  escrow: {
    address: `0x${string}`;
    bytecodeExists: boolean;
    usdc: `0x${string}`;
    paused: boolean;
    isFunded: boolean;
    totalLockedPrizePools: string;
    totalLockedPlatformFees: string;
    totalLockedLiabilities: string;
  };
  allowance: string;
  ready: boolean;
  blockers: string[];
};

export type EscrowTransactionStage = "approval" | "funding";

export type EscrowTransactionSnapshot = {
  stage: EscrowTransactionStage;
  challengeId?: string;
  transactionId?: string;
  transactionHash?: `0x${string}`;
  state?: string;
};

export type EscrowFundingVerification = {
  walletBalance: string;
  approvalTx: `0x${string}` | null;
  fundingTx: `0x${string}` | null;
  receipt: { status?: string; blockNumber?: string; transactionHash?: `0x${string}` } | null;
  challengeFundedEvent: { transactionHash: `0x${string}`; blockNumber: string; logIndex: string } | null;
  blockNumber: string | null;
  challengeVerified: boolean;
  isFunded: boolean;
  challenge: {
    sponsor: `0x${string}`;
    prizePool: string;
    platformFee: string;
    submissionDeadline: number;
    reviewDeadline: number;
    winnerCount: number;
    status: number;
  };
  distribution: string[];
  balances: {
    brandUsdc: string;
    escrowUsdc: string;
  };
  allowance: string;
  totals: {
    totalLockedPrizePools: string;
    totalLockedPlatformFees: string;
    totalLockedLiabilities: string;
  };
  eventVerified: boolean;
  duplicateSimulation: {
    rejected: boolean;
    reason: string;
  };
};
