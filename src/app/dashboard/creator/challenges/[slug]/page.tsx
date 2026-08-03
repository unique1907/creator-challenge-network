import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreatorChallengeDetailPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCreatorChallengeDetail, getCreatorWalletSummary, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} | Creator Challenge Network`,
    robots: { index: false, follow: false },
  };
}

function creatorSignUpPath(returnTo: string) {
  const params = new URLSearchParams({ role: "creator", next: returnTo });
  return `/auth/sign-up?${params.toString()}`;
}

export default async function CreatorChallengeRoute({ params }: PageProps) {
  const { slug } = await params;
  const returnTo = `/dashboard/creator/challenges/${encodeURIComponent(slug)}`;
  const session = await measureCreatorPerformance("challenge-detail", "session", () => getCreatorSession());
  if (!session) redirect(creatorSignUpPath(returnTo));
  const [challenge, wallet] = await Promise.all([
    measureCreatorPerformance("challenge-detail", "challenge", () => getCreatorChallengeDetail(decodeURIComponent(slug), session)),
    measureCreatorPerformance("challenge-detail", "wallet", () => getCreatorWalletSummary(session)),
  ]);
  if (!challenge) notFound();

  return <CreatorChallengeDetailPage session={session} challenge={challenge} wallet={wallet} appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""} />;
}
