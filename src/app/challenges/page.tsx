import type { Metadata } from "next";
import { ChallengesPage, challenges } from "@/features/challenges";
import { getAllPublicChallenges } from "@/services/create-challenge/published-challenge.server";

export const metadata: Metadata = {
  title: "Challenges | Creator Challenge Network",
  description:
    "Browse funded creative competitions with USDC rewards secured on Arc.",
};

export default async function Page() {
  const publicChallenges = await getAllPublicChallenges(challenges);
  return <ChallengesPage challenges={publicChallenges} />;
}
