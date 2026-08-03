import type { Metadata } from "next";
import { CreatorAuthGate, CreatorRewardsPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { listCreatorRewards, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "Creator Rewards | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorRewardsRoute() {
  const session = await measureCreatorPerformance("rewards", "session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const rewards = await measureCreatorPerformance("rewards", "rewards", () => listCreatorRewards(session));
  return <CreatorRewardsPage session={session} rewards={rewards} />;
}
