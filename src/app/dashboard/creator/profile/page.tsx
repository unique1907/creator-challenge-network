import type { Metadata } from "next";
import { CreatorAuthGate, CreatorProfilePage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCreatorProfileSummary, getCreatorWalletSummary, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "Creator Profile | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorProfileRoute() {
  const session = await measureCreatorPerformance("overview", "profile-session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const [wallet, profile] = await Promise.all([
    measureCreatorPerformance("wallet", "profile-wallet", () => getCreatorWalletSummary(session)),
    measureCreatorPerformance("overview", "profile-record", () => getCreatorProfileSummary(session)),
  ]);
  return <CreatorProfilePage session={session} wallet={wallet} profile={profile} />;
}