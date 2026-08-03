import "server-only";

import {
  USER_WALLET_ACCOUNT_TYPE,
  USER_WALLET_BLOCKCHAIN,
} from "@/services/circle/user-controlled-wallets.server";
import { getVerifiedCreatorPayoutWallet } from "@/services/creator-foundation/creator-foundation.server";

export const CREATOR_PAYOUT_ACCOUNT_ID = "ccn-test-creator-001";

export async function getVerifiedCreatorPayoutMapping(
  ccnAccountId = CREATOR_PAYOUT_ACCOUNT_ID,
) {
  return getVerifiedCreatorPayoutWallet(ccnAccountId);
}

export async function getCreatorPayoutAccount(
  ccnAccountId = CREATOR_PAYOUT_ACCOUNT_ID,
) {
  const wallet = await getVerifiedCreatorPayoutWallet(ccnAccountId);

  if (wallet.blockchain !== USER_WALLET_BLOCKCHAIN || wallet.accountType !== USER_WALLET_ACCOUNT_TYPE) {
    throw new Error("Creator payout wallet is not an Arc Testnet SCA wallet.");
  }

  return {
    ccnAccountId,
    walletId: wallet.walletId,
    walletAddress: wallet.walletAddress,
    blockchain: wallet.blockchain,
    accountType: wallet.accountType,
    walletState: wallet.walletState,
  };
}
