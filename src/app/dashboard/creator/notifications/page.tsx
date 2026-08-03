import type { Metadata } from "next";
import { CreatorAuthGate, CreatorNotificationsPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCreatorWorkspaceOverview, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "Creator Notifications | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorNotificationsRoute() {
  const session = await measureCreatorPerformance("overview", "notifications-session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const overview = await measureCreatorPerformance("overview", "notifications", () => getCreatorWorkspaceOverview(session));
  return <CreatorNotificationsPage session={session} notifications={overview.notifications} />;
}