export type SpikeWalletRecord = {
  internalUserId: string;
  circleUserId: string;
  ccnAccountId: string;
  authProvider: "google" | "apple" | "email";
  walletId: string;
  walletAddress: string;
  blockchain: "ARC-TESTNET";
  accountType: "SCA";
  creationStatus:
    | "not-started"
    | "app-authenticated"
    | "initializing"
    | "challenge-created"
    | "live"
    | "failed";
  createDate: string;
  updateDate: string;
};

export type SpikeAppSession = {
  internalUserId: string;
  ccnAccountId: string;
  authProvider: "google" | "apple" | "email";
  circleUserId: string;
  userToken: string;
  encryptionKey: string;
};

export type SpikeSessionSnapshot = {
  authorized: boolean;
  appConfigured: boolean;
  wallet: SpikeWalletRecord | null;
};

export type SpikeTokenBalance = {
  amount: string;
  blockchain: "ARC-TESTNET";
  decimals: number;
  isNative: boolean;
  name: string;
  symbol: string;
  tokenAddress: string;
  tokenContractVerified: boolean;
  updateDate: string;
};

export type SpikeBalanceSnapshot = {
  officialUsdcContractAddress: "0x3600000000000000000000000000000000000000";
  officialFaucetUrl: "https://faucet-v2.circle.com/";
  explorerUrl: string;
  lastRefreshAt: string;
  testUsdcBalance: SpikeTokenBalance | null;
  tokenBalances: SpikeTokenBalance[];
};

export type SafeCircleError = {
  message: string;
  status?: number;
  code?: string | number;
  endpoint?: string;
};

export type WalletRole = "BRAND" | "CREATOR";

export type WalletPurpose = "PAYMENT" | "PAYOUT";

export type ScopedWalletMapping = {
  ccnAccountId: string;
  role: WalletRole;
  purpose: WalletPurpose;
  circleUserId: string;
  walletId: string;
  walletAddress: string;
  blockchain: "ARC-TESTNET";
  accountType: "SCA" | "EOA" | "MSCA";
  walletState: string;
  createdAt: string;
  updatedAt: string;
};
