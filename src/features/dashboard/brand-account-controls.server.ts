import "server-only";

import { getBrandDashboardSubmissionNotifications } from "@/features/dashboard/brand-dashboard-data.server";
import { buildBrandDashboardViewModel } from "@/features/dashboard/brand-dashboard-view-model";
import type { BrandAccountControlsProps } from "@/features/dashboard/components/brand-workspace-navigation";
import type { AuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { listCreateChallengeDrafts } from "@/services/create-challenge/create-challenge-store.server";

export async function getBrandAccountControlData(context: AuthenticatedCcnContext): Promise<BrandAccountControlsProps> {
  const drafts = await listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId });
  const submissionNotifications = await getBrandDashboardSubmissionNotifications(drafts);
  const viewModel = buildBrandDashboardViewModel(drafts, { campaignLimit: null, submissionNotifications });

  return {
    displayName: context.displayName || "Brand Account",
    brandName: context.brandName ?? null,
    email: context.email,
    workspaceLabel: "Brand Workspace",
    creatorAccess: context.creatorAccess,
    avatarImageUrl: context.avatarImageUrl,
    notifications: viewModel.notifications,
  };
}
