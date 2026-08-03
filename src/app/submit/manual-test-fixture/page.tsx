import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManualCreatorFixtureClient } from "@/features/creator-submission-spike/components/manual-creator-fixture-client";
import {
  getManualCreatorFixtureMeta,
  isManualCreatorFixtureEnabled,
} from "@/services/submissions/manual-creator-fixture.server";

export const metadata: Metadata = {
  title: "Development manual test fixture | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default function ManualTestFixturePage() {
  if (!isManualCreatorFixtureEnabled()) notFound();
  const fixture = getManualCreatorFixtureMeta();
  return <ManualCreatorFixtureClient fixture={fixture} />;
}
