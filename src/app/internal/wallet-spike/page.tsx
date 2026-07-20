import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WalletSpikeAccessForm } from "@/features/wallet-spike/components/wallet-spike-access-form";
import { WalletSpikeClient } from "@/features/wallet-spike/components/wallet-spike-client";
import {
  hasSpikeAccess,
  isSpikeAllowedInEnvironment,
  isSpikeConfigured,
} from "@/services/internal-spike-auth.server";

export const metadata: Metadata = {
  title: "Internal Wallet Spike | Creator Challenge Network",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InternalWalletSpikePage() {
  if (!isSpikeAllowedInEnvironment()) {
    notFound();
  }

  const configured = isSpikeConfigured();
  const authorized = await hasSpikeAccess();

  if (!authorized) {
    return <WalletSpikeAccessForm configured={configured} />;
  }

  return (
    <WalletSpikeClient
      appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""}
      configured={configured && Boolean(process.env.CIRCLE_API_KEY)}
    />
  );
}
