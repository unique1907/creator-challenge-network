import type { Metadata } from "next";
import { CreateChallengeWizard } from "@/features/create-challenge";

export const metadata: Metadata = {
  title: "Create Challenge | Creator Challenge Network",
  description:
    "Create a funded creative competition with test USDC secured on Arc Testnet.",
};

export default function CreateChallengePage() {
  return (
    <CreateChallengeWizard
      appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""}
    />
  );
}
