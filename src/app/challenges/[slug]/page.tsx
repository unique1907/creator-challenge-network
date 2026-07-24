import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ChallengeDetail,
  challenges,
  getChallengeBySlug,
} from "@/features/challenges";
import { getPublishedCreateChallenge } from "@/services/create-challenge/published-challenge.server";

type ChallengePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return challenges.map((challenge) => ({ slug: challenge.slug }));
}

export async function generateMetadata({
  params,
}: ChallengePageProps): Promise<Metadata> {
  const { slug } = await params;
  const published = await getPublishedCreateChallenge();
  const challenge =
    getChallengeBySlug(slug) ??
    (published?.slug === slug ? published : undefined);

  if (!challenge) {
    return {
      title: "Challenge not found | Creator Challenge Network",
    };
  }

  return {
    title: `${challenge.title} | Creator Challenge Network`,
    description: `${challenge.brand} is funding ${challenge.rewardUsdc} USDC for ${challenge.category}.`,
  };
}

export default async function Page({ params }: ChallengePageProps) {
  const { slug } = await params;
  const published = await getPublishedCreateChallenge();
  const challenge =
    getChallengeBySlug(slug) ??
    (published?.slug === slug ? published : undefined);

  if (!challenge) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <ChallengeDetail challenge={challenge} />
    </main>
  );
}
