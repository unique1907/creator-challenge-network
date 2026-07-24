import type { User } from "@supabase/supabase-js";

export type AccountStatus = "ACTIVE" | "DEACTIVATED";
export type WalletScope = "BRAND_PAYMENT" | "CREATOR_PAYOUT";
export type WalletStatus = "PENDING" | "ACTIVE" | "FAILED";
export type AuditActor = "USER" | "SERVICE" | "SYSTEM";

export type CcnAccount = {
  account_id: string;
  supabase_user_id: string;
  is_brand: boolean;
  is_creator: boolean;
  primary_email: string;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CircleUserRow = {
  circle_user_row_id: string;
  account_id: string;
  circle_user_id: string;
  created_at: string;
};

export type WalletRow = {
  wallet_row_id: string;
  account_id: string;
  circle_user_row_id: string;
  scope: WalletScope;
  circle_wallet_id: string | null;
  wallet_address: string | null;
  blockchain: string;
  status: WalletStatus;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

export type CreatorProfile = {
  account_id: string;
  display_name: string | null;
  username: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
};

export type SafeAccountDto = {
  accountId: string;
  isBrand: boolean;
  isCreator: boolean;
  primaryEmail: string;
  status: AccountStatus;
};

export type SafeWalletDto = {
  walletAddress: string | null;
  scope: WalletScope;
  status: WalletStatus;
  blockchain: "ARC-TESTNET";
};

export type CreatorOnboardingResult = {
  account: SafeAccountDto;
  profile: CreatorProfile;
  wallet: SafeWalletDto;
  circleChallengeId?: string;
  recoveryRequired?: boolean;
};

export type VerifiedSupabaseUser = User & {
  email: string;
};
