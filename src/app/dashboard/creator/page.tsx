import type { Metadata } from "next";
import { CreatorAuthGate, CreatorOverviewPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCreatorWorkspaceOverview, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "Creator Workspace | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorDashboardPage() {
  const session = await measureCreatorPerformance("overview", "session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const overview = await measureCreatorPerformance("overview", "overview", () => getCreatorWorkspaceOverview(session));
  return <CreatorOverviewPage overview={overview} />;
}
