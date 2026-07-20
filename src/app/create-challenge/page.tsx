import type { Metadata } from "next";
import { CreateChallengePlaceholder } from "@/features/create-challenge";

export const metadata: Metadata = {
  title: "Create Challenge | Creator Challenge Network",
  description:
    "Foundation shell for creating funded creative competitions on CCN.",
};

export default function CreateChallengePage() {
  return <CreateChallengePlaceholder />;
}
