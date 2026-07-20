import type { Metadata } from "next";
import { CreateChallengeSuccessPlaceholder } from "@/features/create-challenge";

export const metadata: Metadata = {
  title: "Challenge Created | Creator Challenge Network",
  description:
    "Reserved success state for the future CCN Create Challenge flow.",
};

export default function CreateChallengeSuccessPage() {
  return <CreateChallengeSuccessPlaceholder />;
}
