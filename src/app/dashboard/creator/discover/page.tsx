import type { Metadata } from "next";
import { CreatorAuthGate, CreatorDiscoverPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { listCreatorDiscoverableChallenges, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "Discover Challenges | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CreatorDiscoverRouteProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function CreatorDiscoverRoute({ searchParams }: CreatorDiscoverRouteProps) {
  const session = await measureCreatorPerformance("discover", "session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim() : "";
  const challenges = await measureCreatorPerformance("discover", "challenges", () => listCreatorDiscoverableChallenges(session, query));
  return <CreatorDiscoverPage session={session} challenges={challenges} />;
}
