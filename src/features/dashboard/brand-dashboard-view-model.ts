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
  businessProblem: string;
  hasBusinessProblem: boolean;
  goalLabel: string;
  hasGoal: boolean;
  expectedOutcomeLabel: string;
  hasExpectedOutcome: boolean;
  rewardLabel: string;
  fundingStatusLabel: string;
  deadlineLabel: string;
  solutionsLabel: string;
  solutionCount: number;
  currentPhaseLabel: string;
  requiredActionLabel: string;
  requiredActionDescription: string;
  briefIncomplete: boolean;
  briefMissingFields: string[];
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

export type BrandDashboardPriority = {
  label: string;
  detail: string;
  href: string;
  ctaLabel: string;
  tone: BrandDashboardCampaignRow["statusTone"];
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
  priorities: BrandDashboardPriority[];
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
  { id: "basics", label: "Business problem details" },
  { id: "prize-pool", label: "Prize and winners" },
  { id: "review-rules", label: "Dates and rules" },
  { id: "funding", label: "Secure prize pool" },
  { id: "publish", label: "Open for solutions" },
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
  if (!compact) return "Problem draft ref pending";
  return `Problem draft ...${compact.slice(-4).toUpperCase()}`;
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
  if (!isMeaningfulTitle(draft.title)) return "Describe the business problem before opening it for solutions.";
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
      return "No business challenges";
    case "draft":
      return "Problem Draft";
    case "funding":
      return "Funding";
    case "ready-to-publish":
      return "Open for Solutions";
    case "review":
      return "Evaluation";
    case "winner-ready":
      return "Selection";
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
      return { label: "Describe Your Business Problem", href: "/create-challenge?new=1", primary: true };
    case "draft":
      return { label: "Continue Problem Draft", href: draftId ? campaignHref(draftId) : "/dashboard", primary: true };
    case "funding":
      return { label: "Complete Funding", href: draftId ? campaignHref(draftId, "funding") : "/dashboard", primary: true };
    case "ready-to-publish":
      return { label: "Open Business Challenge", href: draftId ? campaignHref(draftId) : "/dashboard", primary: true };
    case "review":
      return { label: "Evaluate Solutions", href: draftId ? campaignHref(draftId, "review") : "/dashboard", primary: true };
    case "winner-ready":
      return { label: "Select Solution", href: draftId ? campaignHref(draftId, "review") : "/dashboard", primary: true };
    case "settlement":
      return { label: "Complete Payout", href: draftId ? campaignHref(draftId, "settlement") : "/dashboard", primary: true };
    case "completed":
      return { label: "View Outcome Report", href: draftId ? campaignHref(draftId, "activity-feed") : "/dashboard", primary: true };
  }
}

function titleForState(state: BrandDashboardLifecycleState) {
  switch (state) {
    case "empty":
      return "Describe Your Business Problem";
    case "draft":
      return "Continue defining the business problem";
    case "funding":
      return "Fund your business challenge";
    case "ready-to-publish":
      return "Open your business challenge";
    case "review":
      return "Evaluate solutions";
    case "winner-ready":
      return "Select the best solution";
    case "settlement":
      return "Approve payout";
    case "completed":
      return "View selected outcome";
  }
}

function contextForState(state: BrandDashboardLifecycleState) {
  switch (state) {
    case "draft":
      return "Complete business problem details";
    case "funding":
      return "Funding requires attention";
    case "ready-to-publish":
      return "Escrow verified";
    case "review":
      return "Ready for evaluation";
    case "winner-ready":
      return "Solution selection ready";
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

function solutionCountsByDraft(items: BrandDashboardSubmissionNotification[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.draftId || !item.anonymousEntryCode) continue;
    counts.set(item.draftId, (counts.get(item.draftId) ?? 0) + 1);
  }
  return counts;
}

function pluralize(count: number, singular: string, plural = singular + "s") {
  return `${count} ${count === 1 ? singular : plural}`;
}

function businessProblemForDraft(_draft: CreateChallengeDraftSummary) {
  void _draft;
  return "—";
}

function requiredActionDescription(state: BrandDashboardLifecycleState) {
  switch (state) {
    case "draft":
      return "Complete the business problem brief before opening it for solutions.";
    case "funding":
      return "Complete funding so the challenge can open for solutions.";
    case "ready-to-publish":
      return "Open the funded challenge for solution proposals.";
    case "review":
      return "Review solution proposals and select the strongest approach.";
    case "winner-ready":
      return "Confirm the selected solution and prepare settlement.";
    case "settlement":
      return "Complete payout approval for the selected solution.";
    case "completed":
      return "Review the completed outcome record.";
    default:
      return "Choose the next business challenge action.";
  }
}

function fundingStatusLabel(draft: CreateChallengeDraftSummary) {
  switch (draft.fundingStatus) {
    case "funded":
    case "live":
      return "Funded";
    case "approval-pending":
      return "Approval pending";
    case "approved":
      return "Approved, funding pending";
    case "funding-pending":
      return "Funding pending";
    default:
      return "Funding not started";
  }
}

function campaignRows(drafts: CreateChallengeDraftSummary[], solutionCounts = new Map<string, number>()): BrandDashboardCampaignRow[] {
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
    const solutionCount = solutionCounts.get(draft.draftId) ?? 0;
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
      businessProblem: businessProblemForDraft(draft),
      hasBusinessProblem: false,
      goalLabel: "—",
      hasGoal: false,
      expectedOutcomeLabel: "—",
      hasExpectedOutcome: false,
      rewardLabel: "—",
      fundingStatusLabel: fundingStatusLabel(draft),
      deadlineLabel: "—",
      solutionsLabel: pluralize(solutionCount, "solution"),
      solutionCount,
      currentPhaseLabel: stateLabel(status),
      requiredActionLabel: action.label,
      requiredActionDescription: requiredActionDescription(status),
      briefIncomplete: true,
      briefMissingFields: ["problem summary", "goal", "expected outcome", "deadline"],
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
    draft: "Problem Draft",
    funding: "Funding",
    published: "Open for Solutions",
    review: "Evaluation",
    winner: "Selection",
    settlement: "Settlement",
  };
  return journeyOrder.map((id, index) => ({
    id,
    label: labels[id],
    status: index < currentIndex ? "complete" : index === currentIndex ? "current" : "future",
  }));
}

function activityForRows(rows: BrandDashboardCampaignRow[]): BrandDashboardActivity[] {
  const solutionRows = rows.filter((row) => row.solutionCount > 0);
  const solutionTotal = solutionRows.reduce((total, row) => total + row.solutionCount, 0);
  const activities: BrandDashboardActivity[] = [];

  if (solutionTotal > 0) {
    const latest = [...solutionRows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    activities.push({
      label: pluralize(solutionTotal, "new solution"),
      detail: `Across ${pluralize(solutionRows.length, "business challenge")}`,
      href: latest?.href ?? "/dashboard/campaigns?filter=open-for-solutions",
      actionLabel: "Evaluate Solutions",
      at: latest?.updatedLabel ?? "Updated recently",
      tone: "green",
    });
  }

  for (const row of rows) {
    if (activities.length >= 3) break;
    if (row.solutionCount > 0) continue;
    if (!["funding", "ready-to-publish", "winner-ready", "settlement", "completed", "draft"].includes(row.status)) continue;
    activities.push({
      label: row.status === "completed" ? "Settlement completed" : row.requiredActionLabel,
      detail: row.title,
      href: row.href,
      actionLabel: row.actionLabel,
      at: row.updatedLabel,
      tone: row.statusTone === "slate" ? "blue" : row.statusTone,
    });
  }

  return activities;
}

function notificationForRow(row: BrandDashboardCampaignRow): BrandDashboardNotification | null {
  if (row.status === "draft") {
    return { id: `draft:${row.draftId}:completion`, title: "Problem draft needs completion", campaignName: row.title, statusLabel: "Needs action", href: row.href, tone: row.statusTone };
  }
  if (row.status === "funding") {
    return { id: `funding:${row.draftId}:required`, title: "Funding required", campaignName: row.title, statusLabel: "Needs action", href: row.href, tone: row.statusTone };
  }
  if (row.status === "review") {
    return { id: `review:${row.draftId}:submissions`, title: "Solutions awaiting evaluation", campaignName: row.title, statusLabel: "Needs action", href: campaignHref(row.draftId, "review"), tone: row.statusTone };
  }
  if (row.status === "winner-ready") {
    return { id: `winner:${row.draftId}:ready`, title: "Selected solution ready", campaignName: row.title, statusLabel: "Needs action", href: campaignHref(row.draftId, "review"), tone: row.statusTone };
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
        title: `${creatorName ?? "A creator"} shared a solution for`,
        campaignName: item.campaignName,
        metadata: `${item.anonymousEntryCode} - ${relativeSubmittedAt(item.submittedAt)}`,
        ctaLabel: "Evaluate Solutions",
        unread: true,
        statusLabel: "Needs action" as const,
        href: campaignHref(item.draftId, "review"),
        tone: "green" as const,
      };
    });
}

function prioritiesForRows(rows: BrandDashboardCampaignRow[]): BrandDashboardPriority[] {
  const priorities: BrandDashboardPriority[] = [];
  const evaluationRows = rows.filter((row) => row.status === "review" && row.solutionCount > 0);
  const solutionTotal = evaluationRows.reduce((total, row) => total + row.solutionCount, 0);
  if (solutionTotal > 0) {
    priorities.push({
      label: `${pluralize(solutionTotal, "solution")} waiting for evaluation`,
      detail: `Across ${pluralize(evaluationRows.length, "business challenge")}`,
      href: evaluationRows[0]?.href ?? "/dashboard/campaigns?filter=open-for-solutions",
      ctaLabel: "Evaluate",
      tone: "green",
    });
  }

  const fundingRows = rows.filter((row) => row.status === "funding");
  if (fundingRows.length > 0) {
    priorities.push({
      label: `Funding required for ${pluralize(fundingRows.length, "draft")}`,
      detail: fundingRows.length === 1 ? fundingRows[0]?.title ?? "Business challenge" : "Complete funding to go live",
      href: fundingRows.length === 1 ? fundingRows[0]!.href : "/dashboard/campaigns?filter=funding",
      ctaLabel: "Fund",
      tone: "amber",
    });
  }

  const openRows = rows.filter((row) => row.status === "ready-to-publish");
  if (openRows.length > 0) {
    priorities.push({
      label: `${pluralize(openRows.length, "challenge")} ready to open`,
      detail: "Escrow verified and waiting for launch",
      href: openRows[0]?.href ?? "/dashboard/campaigns?filter=open-for-solutions",
      ctaLabel: "Open",
      tone: "blue",
    });
  }

  const settlementRows = rows.filter((row) => row.status === "settlement" || row.status === "winner-ready");
  if (settlementRows.length > 0) {
    priorities.push({
      label: `${pluralize(settlementRows.length, "selection")} needs settlement`,
      detail: "Confirm the selected solution path",
      href: settlementRows[0]?.href ?? "/dashboard/campaigns?filter=selection",
      ctaLabel: "Review",
      tone: "violet",
    });
  }

  const draftRows = rows.filter((row) => row.status === "draft");
  if (priorities.length === 0 && draftRows.length > 0) {
    priorities.push({
      label: `${pluralize(draftRows.length, "brief")} incomplete`,
      detail: "Add goal, expected outcome and deadline",
      href: draftRows[0]?.href ?? "/dashboard/campaigns?filter=problem-draft",
      ctaLabel: "Continue",
      tone: "blue",
    });
  }

  if (priorities.length > 0) return priorities.slice(0, 3);
  return [{ label: "No urgent actions right now", detail: "Active business challenges are up to date.", href: "/dashboard/campaigns", ctaLabel: "View all", tone: "slate" }];
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
  const submissions = identity.submissionNotifications ?? [];
  const submissionDraftIds = new Set(submissions.map((item) => item.draftId));
  const submissionRecency = submissionRecencyByDraft(submissions);
  const sortedRows = campaignRows(drafts, solutionCountsByDraft(submissions)).sort(compareRowsByPriority(submissionDraftIds, submissionRecency));
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
    primaryMessage: "Turn your next business problem into a globally sourced solution.",
    primaryTitle: submissionDraftIds.has(focus?.draftId ?? "") ? "New solution received" : titleForState(primaryState),
    campaignHealth: focus ? contextForState(primaryState) : "No campaigns yet",
    primaryCampaign: focus,
    journeySteps: journeySteps(primaryState),
    campaignRows: rows,
    recentActivity: activityForRows(rows),
    notifications: notificationsForRows(rows, submissions),
    priorities: prioritiesForRows(sortedRows),
    walletQuickActions: [
      addFundsAction(sortedRows),
      { label: "Transactions", detail: "Payment evidence", available: true, href: "/dashboard/payments" },
      { label: "Payment Account", detail: "Brand wallet", available: true, href: "/dashboard/wallet" },
    ],
    sponsorVisible: true,
  };
}

function addFundsAction(rows: BrandDashboardCampaignRow[]): BrandDashboardWalletAction {
  const fundable = rows.filter((row) => row.status === "funding");
  if (fundable.length === 1) {
    return {
      label: "Add funds",
      detail: fundable[0]?.title ?? "Business challenge",
      available: true,
      href: campaignHref(fundable[0]!.draftId, "funding"),
    };
  }
  if (fundable.length > 1) {
    return {
      label: "Add funds",
      detail: "Choose a challenge",
      available: true,
      href: "/dashboard/campaigns?filter=funding",
    };
  }
  return {
    label: "Add funds",
    detail: "No funding needed",
    available: false,
  };
}
