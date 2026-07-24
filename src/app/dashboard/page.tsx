import type { Metadata } from "next";
import { BrandDashboard } from "@/features/dashboard/components/brand-dashboard";
import { listCreateChallengeDrafts } from "@/services/create-challenge/create-challenge-store.server";

export const metadata: Metadata = {
  title: "Dashboard | Creator Challenge Network",
  description: "Brand workspace for CCN challenge drafts and funding status.",
};

export default async function DashboardPage() {
  const drafts = await listCreateChallengeDrafts();
  return <BrandDashboard drafts={drafts} />;
}
