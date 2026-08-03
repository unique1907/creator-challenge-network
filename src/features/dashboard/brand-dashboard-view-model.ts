import type { CreateChallengeDraftSummary } from "@/services/create-challenge/create-challenge-store.server";
import { resolveCampaignCover, type CampaignMedia } from "@/services/media/brand-media.server";
import type { CreateChallengeStepId } from "@/types/create-challenge";

export type BrandDashboardLifecycleState =
  | "empty"
  | "draft"
  | "funding"
  | "ready-to-publish"
  | "review"
  | "winner-ready"
  | "settlement"
  | "completed";

export type BrandDashboardAction = {
  label: string;
  href: string;
  primary: boolean;
};

export type BrandDashboardJourneyStep = {
  id: "draft" | "funding" | "published" | "review" | "winner" | "settlement";
  label: string;
  status: "complete" | "current" | "future";
};

export type BrandDashboardCampaignRow = {
  draftId: string;
  title: string;
  description: string;
  brandName: string;
  identityToken: string;
  isUnnamedDraft: boolean;
  status: BrandDashboardLifecycleState;
  statusLabel: string;
  statusTone: "blue" | "green" | "amber" | "violet" | "slate";
  updatedLabel: string;
  updatedAt: string;
  metadataLine: string;
  lifecycleContext: string;
  nextStep: string;
  href: string;
  actionLabel: string;
  visualTone: "violet" | "red" | "amber" | "blue" | "slate";
  media: CampaignMedia;
  progressLabel?: string;
  progressPercent?: number;
};

export type BrandDashboardActivity = {
  label: string;
  detail: string;
  href: string;
  actionLabel: string;
  at: string;
  tone: "blue" | "green" | "amber" | "violet";
};

export type BrandDashboardNotification = {
  id: string;
  title: string;
  campaignName: string;
  metadata?: string;
  ctaLabel?: string;
  unread?: boolean;
  statusLabel: "Needs action" | "Recent";
  href: string;
  tone: BrandDashboardCampaignRow["statusTone"];
};

export type BrandDashboardSubmissionNotification = {
  draftId: string;
  campaignName: string;
  anonymousEntryCode: string;
  creatorDisplayName?: string | null;
  submittedAt: string;
};

export type BrandDashboardWalletAction = {
  label: string;
  detail: string;
  available: boolean;
  href?: string;
};

export type BrandDashboardViewModel = {
  workspace: "Brand Workspace";
  brandDisplayName: string | null;
  primaryAction: BrandDashboardAction;
  primaryMessage: string;
  primaryTitle: string;
  campaignHealth: string;
  primaryCampaign: BrandDashboardCampaignRow | null;
  journeySteps: BrandDashboardJourneyStep[];
  campaignRows: BrandDashboardCampaignRow[];
  recentActivity: BrandDashboardActivity[];
  notifications: BrandDashboardNotification[];
  walletQuickActions: BrandDashboardWalletAction[];
  sponsorVisible: boolean;
};

type BrandDashboardBuildOptions = {
  brandDisplayName?: string | null;
  submissionNotifications?: BrandDashboardSubmissionNotification[];
  campaignLimit?: number | null;
};

const journeyOrder: BrandDashboardJourneyStep["id"][] = ["draft", "funding", "published", "review", "winner", "settlement"];

const referenceTones: BrandDashboardCampaignRow["visualTone"][] = ["violet", "red", "amber", "blue"];

const technicalNamePatterns = [
  /^unique\d+$/i,
  /^user[-_\d]+$/i,
  /^account[-_\d]+$/i,
  /^ccn[-_]/i,
  /^development[-_]/i,
  /^0x[a-f0-9]{6,}$/i,
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
];

const unnamedTitlePatterns = [/^untitled\s+(challenge|draft|campaign)$/i, /^new\s+(challenge|draft|campaign)$/i];

const setupSteps: Array<{ id: CreateChallengeStepId; label: string }> = [
  { id: "basics", label: "Campaign details" },
  { id: "prize-pool", label: "Prize and winners" },
  { id: "review-rules", label: "Dates and rules" },
  { id: "funding", label: "Secure prize pool" },
  { id: "publish", label: "Publish" },
];

function campaignHref(draftId: string, anchor?: string) {
  return `/dashboard/challenges/${encodeURIComponent(draftId)}${anchor ? `#${anchor}` : ""}`;
}

function meaningfulText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function isMeaningfulTitle(value: string | null | undefined) {
  const text = meaningfulText(value);
  if (!text) return false;
  return !unnamedTitlePatterns.some((pattern) => pattern.test(text));
}

function isMeaningfulBrandName(value: string | null | undefined) {
  const text = meaningfulText(value);
  if (!text) return false;
  return !/^brand\s+not\s+set$/i.test(text);
}

function isMeaningfulPersonName(value: string | null | undefined) {
  const text = meaningfulText(value);
  if (!text) return false;
  if (technicalNamePatterns.some((pattern) => pattern.test(text))) return false;
  if (text.includes("@")) return false;
  return true;
}

export function resolveBrandDashboardGreetingName(input: {
  brandName?: string | null;
  displayName?: string | null;
}) {
  const displayName = meaningfulText(input.displayName);
  if (displayName && isMeaningfulPersonName(displayName)) return displayName.split(/\s+/)[0] ?? displayName;
  return null;
}

function updatedLabel(updatedAt: string) {
  if (!updatedAt) return "Updated recently";
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return `Updated ${date.toLocaleDateString()}`;
}

function relativeSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function draftReference(draftId: string) {
  const compact = draftId.replace(/[^a-z0-9]/gi, "");
  if (!compact) return "Draft ref pending";
  return `Draft ...${compact.slice(-4).toUpperCase()}`;
}

function setupProgress(step: CreateChallengeStepId) {
  const index = setupSteps.findIndex((item) => item.id === step);
  const safeIndex = index >= 0 ? index : 0;
  return `Step ${safeIndex + 1} of ${setupSteps.length}`;
}

function nextSetupStep(step: CreateChallengeStepId) {
  const index = setupSteps.findIndex((item) => item.id === step);
  if (index < 0) return setupSteps[0].label;
  return setupSteps[Math.min(index + 1, setupSteps.length - 1)]?.label ?? setupSteps[setupSteps.length - 1].label;
}

function displayCampaignTitle(draft: CreateChallengeDraftSummary) {
  return isMeaningfulTitle(draft.title) ? draft.title.trim() : "Untitled draft";
}

function displayCampaignDescription(draft: CreateChallengeDraftSummary) {
  if (!isMeaningfulTitle(draft.title)) return "Complete campaign details to name and publish it.";
  return contextForState(lifecycleStateFromDraft(draft));
}

function identityTokenForDraft(draft: CreateChallengeDraftSummary) {
  if (isMeaningfulTitle(draft.title)) return displayCampaignTitle(draft).slice(0, 1).toUpperCase();
  return "D";
}

export function lifecycleStateFromDraft(draft: CreateChallengeDraftSummary): BrandDashboardLifecycleState {
  if (draft.publicationStatus === "ready-to-publish") return "ready-to-publish";
  if (draft.publicationStatus === "live") return "review";
  if (draft.fundingStatus === "funded" || draft.fundingStatus === "live") return "ready-to-publish";
  if (
    draft.fundingStatus === "approval-pending" ||
    draft.fundingStatus === "approved" ||
    draft.fundingStatus === "funding-pending"
  ) {
    return "funding";
  }
  return "draft";
}

function journeyState(state: BrandDashboardLifecycleState): BrandDashboardJourneyStep["id"] {
  if (state === "empty") return "draft";
  if (state === "ready-to-publish") return "published";
  if (state === "review") return "review";
  if (state === "winner-ready") return "winner";
  if (state === "completed") return "settlement";
  if (state === "settlement") return "settlement";
  return state;
}

function stateLabel(state: BrandDashboardLifecycleState) {
  switch (state) {
    case "empty":
      return "No campaigns";
    case "draft":
      return "Draft";
    case "funding":
      return "Funding";
    case "ready-to-publish":
      return "Published";
    case "review":
      return "Live";
    case "winner-ready":
      return "Winner";
    case "settlement":
      return "Settlement";
    case "completed":
      return "Completed";
  }
}

function statusTone(state: BrandDashboardLifecycleState): BrandDashboardCampaignRow["statusTone"] {
  if (state === "review" || state === "completed") return "green";
  if (state === "funding") return "amber";
  if (state === "winner-ready" || state === "settlement") return "violet";
  if (state === "draft") return "blue";
  return "slate";
}

function actionForState(state: BrandDashboardLifecycleState, draftId?: string): BrandDashboardAction {
  switch (state) {
    case "empty":
      return { label: "Create your first challenge", href: "/create-challenge?new=1", primary: true };
    case "draft":
      return { label: "Continue Draft", href: draftId ? campaignHref(draftId) : "/dashboard", primary: true };
    case "funding":
      return { label: "Complete Funding", href: draftId ? campaignHref(draftId, "funding") : "/dashboard", primary: true };
    case "ready-to-publish":
      return { label: "Publish Campaign", href: draftId ? campaignHref(draftId) : "/dashboard", primary: true };
    case "review":
      return { label: "Open Blind Review", href: draftId ? campaignHref(draftId, "review") : "/dashboard", primary: true };
    case "winner-ready":
      return { label: "Select Winner", href: draftId ? campaignHref(draftId, "review") : "/dashboard", primary: true };
    case "settlement":
      return { label: "Complete Payout", href: draftId ? campaignHref(draftId, "settlement") : "/dashboard", primary: true };
    case "completed":
      return { label: "View Report", href: draftId ? campaignHref(draftId, "activity-feed") : "/dashboard", primary: true };
  }
}

function titleForState(state: BrandDashboardLifecycleState) {
  switch (state) {
    case "empty":
      return "Create your first challenge";
    case "draft":
      return "Continue building your campaign";
    case "funding":
      return "Fund your campaign";
    case "ready-to-publish":
      return "Publish your campaign";
    case "review":
      return "Review submissions";
    case "winner-ready":
      return "Finalize your winner";
    case "settlement":
      return "Approve payout";
    case "completed":
      return "View completed campaign";
  }
}

function contextForState(state: BrandDashboardLifecycleState) {
  switch (state) {
    case "draft":
      return "Complete campaign details";
    case "funding":
      return "Funding requires attention";
    case "ready-to-publish":
      return "Escrow verified";
    case "review":
      return "Ready for review";
    case "winner-ready":
      return "Winner selection ready";
    case "settlement":
      return "Payout requires approval";
    case "completed":
      return "Settled";
    default:
      return "Start the workflow";
  }
}

function progressForState(state: BrandDashboardLifecycleState) {
  switch (state) {
    case "draft":
      return { label: "Lifecycle", percent: 50 };
    case "funding":
      return { label: "Lifecycle", percent: 60 };
    case "ready-to-publish":
      return { label: "Lifecycle", percent: 70 };
    case "review":
      return { label: "Lifecycle", percent: 80 };
    case "winner-ready":
      return { label: "Lifecycle", percent: 88 };
    case "settlement":
      return { label: "Lifecycle", percent: 92 };
    case "completed":
      return { label: "Lifecycle", percent: 100 };
    default:
      return { label: "Lifecycle", percent: 0 };
  }
}

function campaignRows(drafts: CreateChallengeDraftSummary[]): BrandDashboardCampaignRow[] {
  return drafts.map((draft, index) => {
    const status = lifecycleStateFromDraft(draft);
    const action = actionForState(status, draft.draftId);
    const progress = progressForState(status);
    const isUnnamedDraft = !isMeaningfulTitle(draft.title);
    const title = displayCampaignTitle(draft);
    const description = displayCampaignDescription(draft);
    const updated = updatedLabel(draft.updatedAt);
    const setup = setupProgress(draft.currentStep);
    const metadataLine = isUnnamedDraft
      ? `${updated} - ${setup} - ${draftReference(draft.draftId)}`
      : `${updated}${isMeaningfulBrandName(draft.brandName) ? ` - ${draft.brandName.trim()}` : ""}`;
    return {
      draftId: draft.draftId,
      title,
      description,
      brandName: draft.brandName || "Brand not set",
      identityToken: identityTokenForDraft(draft),
      isUnnamedDraft,
      status,
      statusLabel: stateLabel(status),
      statusTone: statusTone(status),
      updatedLabel: updated,
      updatedAt: draft.updatedAt,
      metadataLine,
      lifecycleContext: contextForState(status),
      nextStep: isUnnamedDraft && status === "draft" ? `Next: ${nextSetupStep(draft.currentStep)}` : contextForState(status),
      href: action.href,
      actionLabel: action.label,
      visualTone: referenceTones[index % referenceTones.length],
      media: resolveCampaignCover({
        coverImageKey: draft.coverImageKey,
        coverImageAlt: draft.coverImageAlt,
        title,
        category: draft.category,
      }),
      progressLabel: progress.label,
      progressPercent: progress.percent,
    };
  });
}

function campaignSortScore(row: BrandDashboardCampaignRow, submissionDraftIds: Set<string>) {
  if (submissionDraftIds.has(row.draftId)) return 0;
  if (row.status === "review") return 10;
  if (row.status === "winner-ready") return 20;
  if (row.status === "funding") return 30;
  if (row.status === "ready-to-publish") return 35;
  if (row.status === "settlement") return 40;
  if (row.status === "completed") return 50;
  if (row.status === "draft" && !row.isUnnamedDraft) return 60;
  if (row.status === "draft") return 90;
  return 100;
}

function submissionRecencyByDraft(items: BrandDashboardSubmissionNotification[]) {
  const recency = new Map<string, number>();
  for (const item of items) {
    const submittedAt = new Date(item.submittedAt).getTime();
    if (!item.draftId || Number.isNaN(submittedAt)) continue;
    const current = recency.get(item.draftId) ?? 0;
    if (submittedAt > current) recency.set(item.draftId, submittedAt);
  }
  return recency;
}

function compareRowsByPriority(submissionDraftIds: Set<string>, submissionRecency: Map<string, number>) {
  return (left: BrandDashboardCampaignRow, right: BrandDashboardCampaignRow) => {
    const leftScore = campaignSortScore(left, submissionDraftIds);
    const rightScore = campaignSortScore(right, submissionDraftIds);
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftSubmissionAt = submissionRecency.get(left.draftId) ?? 0;
    const rightSubmissionAt = submissionRecency.get(right.draftId) ?? 0;
    if (leftSubmissionAt !== rightSubmissionAt) {
      return rightSubmissionAt - leftSubmissionAt;
    }
    const leftUpdated = new Date(left.updatedAt).getTime();
    const rightUpdated = new Date(right.updatedAt).getTime();
    if (!Number.isNaN(leftUpdated) && !Number.isNaN(rightUpdated) && rightUpdated !== leftUpdated) {
      return rightUpdated - leftUpdated;
    }
    if (left.isUnnamedDraft !== right.isUnnamedDraft) return left.isUnnamedDraft ? 1 : -1;
    return left.title.localeCompare(right.title);
  };
}

function firstByPriority(rows: BrandDashboardCampaignRow[], submissionDraftIds: Set<string>, submissionRecency: Map<string, number>) {
  return [...rows].sort(compareRowsByPriority(submissionDraftIds, submissionRecency))[0] ?? null;
}

function journeySteps(state: BrandDashboardLifecycleState): BrandDashboardJourneyStep[] {
  const current = journeyState(state);
  const currentIndex = journeyOrder.indexOf(current);
  const labels: Record<BrandDashboardJourneyStep["id"], string> = {
    draft: "Draft",
    funding: "Funding",
    published: "Published",
    review: "Review",
    winner: "Winner",
    settlement: "Settlement",
  };
  return journeyOrder.map((id, index) => ({
    id,
    label: labels[id],
    status: index < currentIndex ? "complete" : index === currentIndex ? "current" : "future",
  }));
}

function activityForRows(rows: BrandDashboardCampaignRow[]): BrandDashboardActivity[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.status}:${row.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3).map((row) => ({
    label: row.lifecycleContext,
    detail: row.title,
    href: row.href,
    actionLabel: row.actionLabel,
    at: row.updatedLabel,
    tone: row.statusTone === "slate" ? "blue" : row.statusTone,
  }));
}

function notificationForRow(row: BrandDashboardCampaignRow): BrandDashboardNotification | null {
  if (row.status === "draft") {
    return { id: `draft:${row.draftId}:completion`, title: "Draft needs completion", campaignName: row.title, statusLabel: "Needs action", href: row.href, tone: row.statusTone };
  }
  if (row.status === "funding") {
    return { id: `funding:${row.draftId}:required`, title: "Funding required", campaignName: row.title, statusLabel: "Needs action", href: row.href, tone: row.statusTone };
  }
  if (row.status === "review") {
    return { id: `review:${row.draftId}:submissions`, title: "Submissions awaiting review", campaignName: row.title, statusLabel: "Needs action", href: campaignHref(row.draftId, "review"), tone: row.statusTone };
  }
  if (row.status === "winner-ready") {
    return { id: `winner:${row.draftId}:ready`, title: "Winner ready", campaignName: row.title, statusLabel: "Needs action", href: campaignHref(row.draftId, "review"), tone: row.statusTone };
  }
  if (row.status === "settlement") {
    return { id: `settlement:${row.draftId}:approval`, title: "Payout approval required", campaignName: row.title, statusLabel: "Needs action", href: campaignHref(row.draftId, "settlement"), tone: row.statusTone };
  }
  if (row.status === "completed") {
    return { id: `completed:${row.draftId}:settled`, title: "Settlement completed", campaignName: row.title, statusLabel: "Recent", href: campaignHref(row.draftId, "settlement"), tone: row.statusTone };
  }
  return null;
}

function submissionNotifications(items: BrandDashboardSubmissionNotification[]): BrandDashboardNotification[] {
  return items
    .filter((item) => item.draftId && item.anonymousEntryCode)
    .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
    .map((item) => {
      const creatorName = isMeaningfulPersonName(item.creatorDisplayName) ? item.creatorDisplayName?.trim() : null;
      return {
        id: `submission:${item.draftId}:${item.anonymousEntryCode}`,
        title: `${creatorName ?? "A creator"} submitted work for`,
        campaignName: item.campaignName,
        metadata: `${item.anonymousEntryCode} • ${relativeSubmittedAt(item.submittedAt)}`,
        ctaLabel: "Open Blind Review",
        unread: true,
        statusLabel: "Needs action" as const,
        href: campaignHref(item.draftId, "review"),
        tone: "green" as const,
      };
    });
}

function notificationsForRows(rows: BrandDashboardCampaignRow[], submissions: BrandDashboardSubmissionNotification[]) {
  return [
    ...submissionNotifications(submissions),
    ...rows
    .map(notificationForRow)
    .filter((item): item is BrandDashboardNotification => Boolean(item)),
  ]
    .slice(0, 5);
}

export function buildBrandDashboardViewModel(
  drafts: CreateChallengeDraftSummary[],
  identity: BrandDashboardBuildOptions = {},
): BrandDashboardViewModel {
  const submissionDraftIds = new Set((identity.submissionNotifications ?? []).map((item) => item.draftId));
  const submissionRecency = submissionRecencyByDraft(identity.submissionNotifications ?? []);
  const sortedRows = campaignRows(drafts).sort(compareRowsByPriority(submissionDraftIds, submissionRecency));
  const rows = typeof identity.campaignLimit === "number"
    ? sortedRows.slice(0, identity.campaignLimit)
    : identity.campaignLimit === null
      ? sortedRows
      : sortedRows.slice(0, 6);
  const focus = firstByPriority(sortedRows, submissionDraftIds, submissionRecency);
  const primaryState = focus?.status ?? "empty";
  const primaryAction = actionForState(primaryState, focus?.draftId);
  const brandDisplayName = isMeaningfulBrandName(identity.brandDisplayName)
    ? identity.brandDisplayName?.trim() ?? null
    : rows.find((row) => isMeaningfulBrandName(row.brandName))?.brandName.trim() ?? null;

  return {
    workspace: "Brand Workspace",
    brandDisplayName,
    primaryAction,
    primaryMessage: "Here's what's happening with your campaigns today.",
    primaryTitle: submissionDraftIds.has(focus?.draftId ?? "") ? "New submission received" : titleForState(primaryState),
    campaignHealth: focus ? contextForState(primaryState) : "No campaigns yet",
    primaryCampaign: focus,
    journeySteps: journeySteps(primaryState),
    campaignRows: rows,
    recentActivity: activityForRows(rows),
    notifications: notificationsForRows(rows, identity.submissionNotifications ?? []),
    walletQuickActions: [
      addFundsAction(sortedRows),
      { label: "View Transactions", detail: "Open campaign payment evidence", available: true, href: "/dashboard/payments" },
      { label: "Payment Accounts", detail: "View Brand PAYMENT wallet", available: true, href: "/dashboard/wallet" },
    ],
    sponsorVisible: true,
  };
}

function addFundsAction(rows: BrandDashboardCampaignRow[]): BrandDashboardWalletAction {
  const fundable = rows.filter((row) => row.status === "funding");
  if (fundable.length === 1) {
    return {
      label: "Add Funds",
      detail: `Fund ${fundable[0]?.title ?? "campaign"}`,
      available: true,
      href: campaignHref(fundable[0]!.draftId, "funding"),
    };
  }
  if (fundable.length > 1) {
    return {
      label: "Add Funds",
      detail: "Choose a campaign to fund",
      available: true,
      href: "/dashboard/campaigns?filter=funding",
    };
  }
  return {
    label: "Add Funds",
    detail: "No campaigns need funding",
    available: false,
  };
}
