import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorSubmissionSpikeClient } from "@/features/creator-submission-spike/components/creator-submission-spike-client";
import { WalletSpikeAccessForm } from "@/features/wallet-spike/components/wallet-spike-access-form";
import {
  hasSpikeAccess,
  isSpikeAllowedInEnvironment,
  isSpikeConfigured,
} from "@/services/internal-spike-auth.server";
import { listPublishedCreateChallenges, getPublishedCreateChallengeDraftBySlug } from "@/services/create-challenge/published-challenge.server";

export const metadata: Metadata = {
  title: "Internal Creator Submission Demo | Creator Challenge Network",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InternalCreatorSubmissionSpikePage() {
  if (!isSpikeAllowedInEnvironment()) {
    notFound();
  }

  const configured = isSpikeConfigured();
  const authorized = await hasSpikeAccess();

  if (!authorized) {
    return <WalletSpikeAccessForm configured={configured} />;
  }

  const [published] = await listPublishedCreateChallenges();
  if (!published) notFound();
  const resolved = await getPublishedCreateChallengeDraftBySlug(published.slug);
  if (!resolved) notFound();

  return (
    <CreatorSubmissionSpikeClient
      draftId={resolved.draftId}
      challengeTitle={resolved.challenge.title}
      challengeSlug={resolved.challenge.slug}
    />
  );
}
