import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublishedCreateChallengeDraftBySlug } from "@/services/create-challenge/published-challenge.server";

type SubmitPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: SubmitPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await getPublishedCreateChallengeDraftBySlug(slug);
  if (!resolved) {
    return {
      title: "Submit your work | Creator Challenge Network",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `Submit your work | ${resolved.challenge.title}`,
    robots: { index: false, follow: false },
  };
}

export default async function SubmitPage({ params }: SubmitPageProps) {
  const { slug } = await params;
  const resolved = await getPublishedCreateChallengeDraftBySlug(slug);
  if (!resolved) notFound();

  redirect(`/dashboard/creator/challenges/${encodeURIComponent(resolved.challenge.slug)}`);
}
