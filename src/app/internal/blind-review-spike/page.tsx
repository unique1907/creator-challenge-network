import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlindReviewSpikeClient } from "@/features/blind-review-spike/components/blind-review-spike-client";
import { WalletSpikeAccessForm } from "@/features/wallet-spike/components/wallet-spike-access-form";
import {
  hasSpikeAccess,
  isSpikeAllowedInEnvironment,
  isSpikeConfigured,
} from "@/services/internal-spike-auth.server";

export const metadata: Metadata = {
  title: "Internal Blind Review Spike | Creator Challenge Network",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InternalBlindReviewSpikePage() {
  if (!isSpikeAllowedInEnvironment()) {
    notFound();
  }

  const configured = isSpikeConfigured();
  const authorized = await hasSpikeAccess();

  if (!authorized) {
    return <WalletSpikeAccessForm configured={configured} />;
  }

  return <BlindReviewSpikeClient />;
}
