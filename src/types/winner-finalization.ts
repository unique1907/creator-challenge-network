export type WinnerFinalizationAuthority = "BRAND" | "JURY";

export type WinnerFinalizationState =
  | "READY_FOR_FINAL_SELECTION"
  | "APPROVAL_CREATION_IN_PROGRESS"
  | "APPROVAL_CREATED_RECONCILIATION_REQUIRED"
  | "ACTION_REQUIRED"
  | "FINALIZATION_IN_PROGRESS"
  | "TRANSACTION_SUBMITTED"
  | "RECONCILIATION_REQUIRED"
  | "PAYOUT_CONFIRMED"
  | "FINALIZATION_FAILED"
  | "ALREADY_FINALIZED";

export type WinnerFinalizationCandidate = {
  entryId: string;
  creatorAccountId: string;
  creatorWalletAddress: `0x${string}`;
  challengeId: `0x${string}`;
  reviewable: boolean;
};

export type WinnerFinalizationSelection = WinnerFinalizationCandidate & {
  rank: 1 | 2 | 3;
  payoutAmountUnits: string;
};

export type WinnerFinalizationSummary = {
  label: "Confirm Winners and Release Payment";
  state: WinnerFinalizationState;
  authority: WinnerFinalizationAuthority;
  challengeId: `0x${string}`;
  escrowContractAddress: `0x${string}`;
  winnerWalletAddresses: `0x${string}`[];
  payoutAmounts: string[];
  totalPrizePool: string;
  platformFee: string;
  treasuryRecipient: `0x${string}`;
  totalTransactionEffect: string;
  irreversible: true;
};

export type WinnerFinalizationRecord = WinnerFinalizationSummary & {
  draftId: string;
  lockId: string;
  circleChallengeId?: string;
  circleTransactionId?: string | null;
  circleTransactionState?: string;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  receiptStatus?: "success";
  payoutConfirmedAt?: string;
  reconciliationSource?: "circle" | "blockchain-first";
  finalContractStatus?: string;
  finalizedAt?: string;
  errorMessage?: string;
  userToken?: string;
  encryptionKey?: string;
  reconciliation?: {
    receiptVerified: boolean;
    eventVerified: boolean;
    challengeVerified: boolean;
    winnersVerified: boolean;
    amountsVerified: boolean;
    feeVerified: boolean;
    treasuryVerified: boolean;
  };
};
