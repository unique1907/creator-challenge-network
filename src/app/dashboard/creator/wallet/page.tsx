import type { Metadata } from "next";
import { CreatorAuthGate, CreatorWalletPage } from "@/features/creator-workspace/components/creator-workspace";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCreatorWalletSummary, measureCreatorPerformance } from "@/services/creator-workspace/creator-workspace.server";

export const metadata: Metadata = {
  title: "Creator Wallet | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CreatorWalletRoute() {
  const session = await measureCreatorPerformance("wallet", "session", () => getCreatorSession());
  if (!session) return <CreatorAuthGate />;

  const wallet = await measureCreatorPerformance("wallet", "wallet", () => getCreatorWalletSummary(session));
  return <CreatorWalletPage session={session} wallet={wallet} appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""} />;
}
