import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ChallengeDetail,
  challenges,
  getChallengeBySlug,
} from "@/features/challenges";

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
  const challenge = getChallengeBySlug(slug);

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
  const challenge = getChallengeBySlug(slug);

  if (!challenge) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <ChallengeDetail challenge={challenge} />
    </main>
  );
}
