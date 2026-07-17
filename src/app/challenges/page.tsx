import type { Metadata } from "next";
import { ChallengesPage, challenges } from "@/features/challenges";

export const metadata: Metadata = {
  title: "Challenges | Creator Challenge Network",
  description:
    "Browse funded creative competitions with USDC rewards secured on Arc.",
};

export default function Page() {
  return <ChallengesPage challenges={challenges} />;
}
