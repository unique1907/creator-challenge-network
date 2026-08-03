import "server-only";

import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { getCreatorPayoutWalletStatus } from "@/services/creator-foundation/creator-foundation.server";
import type { PublicAuthState } from "@/types/public-auth";

export async function getLandingAuthState(): Promise<PublicAuthState> {
  const context = await getAuthenticatedCcnContext({ allowTestContext: false }).catch(() => null);
  if (!context) return { kind: "anonymous" };

  if (context.brandAccess) {
    return {
      kind: "brand",
      onboardingComplete: context.brandOnboardingComplete,
    };
  }

  if (context.creatorAccess) {
    const wallet = await getCreatorPayoutWalletStatus(context.ccnAccountId).catch(() => null);
    return {
      kind: "creator",
      onboardingComplete: Boolean(
        wallet?.scope === "CREATOR_PAYOUT" &&
          wallet.status === "ACTIVE" &&
          wallet.blockchain === "ARC-TESTNET",
      ),
    };
  }

  return { kind: "anonymous" };
}
