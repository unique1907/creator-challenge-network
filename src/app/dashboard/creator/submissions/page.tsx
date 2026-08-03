import type { Metadata } from "next";
import { CreatorAuthGate, CreatorSubmissionsPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { listCreatorSubmissionItems, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "My Submissions | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorSubmissionsRoute() {
  const session = await measureCreatorPerformance("submissions", "session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const submissions = await measureCreatorPerformance("submissions", "submissions", () => listCreatorSubmissionItems(session));
  return <CreatorSubmissionsPage session={session} submissions={submissions} />;
}
