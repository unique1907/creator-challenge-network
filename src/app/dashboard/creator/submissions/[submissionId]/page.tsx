import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorAuthGate, CreatorSubmissionDetailPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCreatorSubmissionDetail, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

type PageProps = {
  params: Promise<{ submissionId: string }>;
};

export const metadata: Metadata = {
  title: "Submission | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorSubmissionDetailRoute({ params }: PageProps) {
  const session = await measureCreatorPerformance("submission-detail", "session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const { submissionId } = await params;
  const submission = await measureCreatorPerformance("submission-detail", "submission", () => getCreatorSubmissionDetail(submissionId, session));
  if (!submission) notFound();

  return <CreatorSubmissionDetailPage session={session} submission={submission} />;
}
