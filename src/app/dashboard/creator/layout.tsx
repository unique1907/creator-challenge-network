import type { Metadata } from "next";
import { CreatorAuthGate, CreatorWorkspaceShell } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCreatorNotificationPreview, getCreatorProfileSummary, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "Creator Workspace | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await measureCreatorPerformance("overview", "shell-session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const [notifications, profile] = await Promise.all([
    measureCreatorPerformance("overview", "shell-notifications", () => getCreatorNotificationPreview(session)),
    measureCreatorPerformance("overview", "shell-profile", () => getCreatorProfileSummary(session)),
  ]);

  return <CreatorWorkspaceShell session={session} profile={profile} notifications={notifications}>{children}</CreatorWorkspaceShell>;
}
