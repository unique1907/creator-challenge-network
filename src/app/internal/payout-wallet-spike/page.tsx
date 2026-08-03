import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WalletSpikeAccessForm } from "@/features/wallet-spike/components/wallet-spike-access-form";
import { PayoutWalletSpikeClient } from "@/features/payout-wallet-spike/components/payout-wallet-spike-client";
import {
  hasSpikeAccess,
  isSpikeAllowedInEnvironment,
  isSpikeConfigured,
} from "@/services/internal-spike-auth.server";

export const metadata: Metadata = {
  title: "Internal Payout Wallet Spike | Creator Challenge Network",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InternalPayoutWalletSpikePage() {
  if (!isSpikeAllowedInEnvironment()) {
    notFound();
  }

  const configured = isSpikeConfigured();
  const authorized = await hasSpikeAccess();

  if (!authorized) {
    return <WalletSpikeAccessForm configured={configured} />;
  }

  return (
    <PayoutWalletSpikeClient
      appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""}
      configured={
        configured &&
        Boolean(process.env.CIRCLE_API_KEY) &&
        Boolean(process.env.CCN_PAYOUT_ACCOUNT_ID)
      }
    />
  );
}
