import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EscrowFundingSpikeClient } from "@/features/escrow-funding-spike/components/escrow-funding-spike-client";
import { WalletSpikeAccessForm } from "@/features/wallet-spike/components/wallet-spike-access-form";
import {
  hasSpikeAccess,
  isSpikeAllowedInEnvironment,
  isSpikeConfigured,
} from "@/services/internal-spike-auth.server";

export const metadata: Metadata = {
  title: "Internal Escrow Funding Spike | Creator Challenge Network",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InternalEscrowFundingSpikePage() {
  if (!isSpikeAllowedInEnvironment()) {
    notFound();
  }

  const configured = isSpikeConfigured();
  const authorized = await hasSpikeAccess();

  if (!authorized) {
    return <WalletSpikeAccessForm configured={configured} />;
  }

  return (
    <EscrowFundingSpikeClient
      appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""}
      configured={configured && Boolean(process.env.CIRCLE_API_KEY)}
    />
  );
}
