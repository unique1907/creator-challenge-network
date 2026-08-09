import type { CreateChallengeDraftSummary } from "@/services/create-challenge/create-challenge-store.server";
import { classifyChallengeLifecycle } from "@/services/create-challenge/public-challenge-eligibility";
import { resolveCampaignCover, type CampaignMedia } from "@/services/media/brand-media.server";
import type { CreateChallengeStepId } from "@/types/create-challenge";
import { parseChallengeDeadline } from "@/utils/challenge-deadlines";

export type BrandDashboardLifecycleState =
  | "empty"
  | "draft"
  | "funding"
  | "ready-to-publish"
  | "review"
  | "closed-no-submissions"
  | "closed-not-enough-submissions"
  | "winner-ready"
  | "settlement"
  | "completed";

export type BrandDashboardSimplifiedBucket =
  | "Drafts"
  | "Active"
  | "Needs Action"
  | "Closed"
  | "Completed";

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
  bucket: BrandDashboardSimplifiedBucket;
  statusLabel: string;
  statusTone: "blue" | "green" | "amber" | "violet" | "slate";
  updatedLabel: string;
  updatedAt: string;
  publishedAt: string | null;
  submissionDeadline: string;
  reviewDeadline: string;
  completedAt: string | null;
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
  key: string;
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
  allCampaignRows: BrandDashboardCampaignRow[];
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
const reservedPlatformBrandNames = new Set(["ccn creator challenge network", "creator challenge network"]);

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
  if (reservedPlatformBrandNames.has(text.toLowerCase())) return false;
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

function displayCampaignDescription(draft: CreateChallengeDraftSummary, solutionCount = 0) {
  if (!isMeaningfulTitle(draft.title)) return "Describe the business problem before opening it for solutions.";
  return contextForState(lifecycleStateFromDraft(draft, solutionCount));
}

function identityTokenForDraft(draft: CreateChallengeDraftSummary) {
  if (isMeaningfulTitle(draft.title)) return displayCampaignTitle(draft).slice(0, 1).toUpperCase();
  return "D";
}

export function lifecycleStateFromDraft(draft: CreateChallengeDraftSummary, solutionCount = 0): BrandDashboardLifecycleState {
  const classification = classifyChallengeLifecycle({
    publicationStatus: draft.publicationStatus,
    fundingStatus: draft.fundingStatus,
    escrowStatus: draft.escrowStatus,
    eventVerified: draft.eventVerified,
    fundingTransactionHash: draft.transactionHash,
    slug: draft.slug,
    submissionDeadline: draft.submissionDeadline,
    submittedCount: solutionCount,
    winnerFinalizationState: draft.winnerFinalizationState,
    winnerFinalizedAt: draft.winnerFinalizedAt,
    payoutConfirmedAt: draft.payoutConfirmedAt,
  });

  if (classification.lifecycle === "completed") return "completed";
  if (classification.lifecycle === "settlement") return "settlement";
  if (classification.lifecycle === "selection") return "winner-ready";
  if (classification.lifecycle === "review") return "review";
  if (classification.lifecycle === "closed-no-submissions") return "closed-no-submissions";
  if (classification.lifecycle === "closed-not-enough-submissions") return "closed-not-enough-submissions";
  if (classification.lifecycle === "live") return "ready-to-publish";
  if (draft.publicationStatus === "ready-to-publish") return "ready-to-publish";
  if (draft.fundingStatus === "funded" || draft.fundingStatus === "live" || draft.escrowStatus === "verified") return "ready-to-publish";
  if (
    draft.fundingStatus === "approval-pending" ||
    draft.fundingStatus === "approved" ||
    draft.fundingStatus === "funding-pending"
  ) {
    return "funding";
  }
  return "draft";
}

export function simplifiedBucketFromDraft(
  draft: CreateChallengeDraftSummary,
  state: BrandDashboardLifecycleState,
): BrandDashboardSimplifiedBucket {
  if (state === "completed") return "Completed";
  if (state === "closed-no-submissions" || state === "closed-not-enough-submissions") return "Closed";
  if (state === "review" || state === "winner-ready" || state === "settlement") return "Needs Action";
  if (draft.publicationStatus === "live" && (draft.fundingStatus === "funded" || draft.fundingStatus === "live")) return "Active";
  if (state === "funding" || state === "ready-to-publish") return "Needs Action";
  return "Drafts";
}

function journeyState(state: BrandDashboardLifecycleState): BrandDashboardJourneyStep["id"] {
  if (state === "empty") return "draft";
  if (state === "ready-to-publish") return "published";
  if (state === "review") return "review";
  if (state === "closed-no-submissions" || state === "closed-not-enough-submissions") return "review";
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
    case "closed-no-submissions":
      return "Closed - No Submissions";
    case "closed-not-enough-submissions":
      return "Closed — Not Enough Submissions";
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
  if (state === "closed-no-submissions" || state === "closed-not-enough-submissions") return "slate";
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
    case "closed-no-submissions":
      return { label: "Review Closed Challenge", href: draftId ? campaignHref(draftId) : "/dashboard", primary: true };
    case "closed-not-enough-submissions":
      return { label: "View Closed Challenge", href: draftId ? campaignHref(draftId) : "/dashboard", primary: false };
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
    case "closed-no-submissions":
      return "Review closed challenge";
    case "closed-not-enough-submissions":
      return "Closed - not enough submissions";
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
      return "Solutions ready for evaluation";
    case "closed-no-submissions":
      return "Closed without Solution Proposals";
    case "closed-not-enough-submissions":
      return "Closed with too few eligible Solution Proposals";
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
    case "closed-no-submissions":
      return { label: "Lifecycle", percent: 80 };
    case "closed-not-enough-submissions":
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
    case "closed-no-submissions":
      return "Submission window closed without receiving Solution Proposals.";
    case "closed-not-enough-submissions":
      return "This Business Challenge received fewer eligible Solution Proposals than the configured Winner count.";
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

function deadlineLabel(value: string) {
  const parsed = parseChallengeDeadline(value);
  return parsed?.iso.slice(0, 10) ?? "—";
}

function campaignRows(drafts: CreateChallengeDraftSummary[], solutionCounts = new Map<string, number>()): BrandDashboardCampaignRow[] {
  return drafts.map((draft, index) => {
    const solutionCount = solutionCounts.get(draft.draftId) ?? 0;
    const status = lifecycleStateFromDraft(draft, solutionCount);
    const bucket = simplifiedBucketFromDraft(draft, status);
    const action = actionForState(status, draft.draftId);
    const progress = progressForState(status);
    const isUnnamedDraft = !isMeaningfulTitle(draft.title);
    const title = displayCampaignTitle(draft);
    const description = displayCampaignDescription(draft, solutionCount);
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
      bucket,
      statusLabel: stateLabel(status),
      statusTone: statusTone(status),
      updatedLabel: updated,
      updatedAt: draft.updatedAt,
      publishedAt: draft.publishedAt,
      submissionDeadline: draft.submissionDeadline,
      reviewDeadline: draft.reviewDeadline,
      completedAt: draft.payoutConfirmedAt ?? draft.winnerFinalizedAt,
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
      rewardLabel: `Top ${draft.winnerCount}`,
      fundingStatusLabel: fundingStatusLabel(draft),
      deadlineLabel: deadlineLabel(draft.submissionDeadline),
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

function isHeroActionable(row: BrandDashboardCampaignRow) {
  return row.status !== "completed" && row.status !== "closed-no-submissions" && row.status !== "closed-not-enough-submissions";
}

function timestamp(value?: string | null) {
  if (!value) return Number.NaN;
  const parsed = parseChallengeDeadline(value);
  const date = parsed ? new Date(parsed.iso) : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

function compareAscNullLast(left: number, right: number) {
  const leftValid = Number.isFinite(left);
  const rightValid = Number.isFinite(right);
  if (leftValid && rightValid && left !== right) return left - right;
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  return 0;
}

function compareDescNullLast(left: number, right: number) {
  const leftValid = Number.isFinite(left);
  const rightValid = Number.isFinite(right);
  if (leftValid && rightValid && left !== right) return right - left;
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  return 0;
}

function brandBucketPriority(bucket: BrandDashboardSimplifiedBucket) {
  if (bucket === "Needs Action") return 0;
  if (bucket === "Active") return 1;
  if (bucket === "Drafts") return 2;
  if (bucket === "Closed") return 3;
  return 4;
}

function compareRowsWithinBucket(left: BrandDashboardCampaignRow, right: BrandDashboardCampaignRow) {
  if (left.bucket === "Active" && right.bucket === "Active") {
    const byDeadline = compareAscNullLast(timestamp(left.submissionDeadline), timestamp(right.submissionDeadline));
    if (byDeadline) return byDeadline;
  } else if (left.bucket === "Needs Action" && right.bucket === "Needs Action") {
    const byStatus =
      left.status === "review" && right.status !== "review"
        ? -1
        : right.status === "review" && left.status !== "review"
          ? 1
          : 0;
    if (left.status === "review" && right.status === "review") {
      const byReviewDeadline = compareAscNullLast(timestamp(left.reviewDeadline), timestamp(right.reviewDeadline));
      if (byReviewDeadline) return byReviewDeadline;
    }
    if (byStatus) return byStatus;
  } else if (left.bucket === "Drafts" && right.bucket === "Drafts") {
    const byUpdated = compareDescNullLast(timestamp(left.updatedAt), timestamp(right.updatedAt));
    if (byUpdated) return byUpdated;
  } else if (left.bucket === "Completed" && right.bucket === "Completed") {
    const byCompleted = compareDescNullLast(timestamp(left.completedAt), timestamp(right.completedAt));
    if (byCompleted) return byCompleted;
  }

  const byUpdated = compareDescNullLast(timestamp(left.updatedAt), timestamp(right.updatedAt));
  if (byUpdated) return byUpdated;
  if (left.isUnnamedDraft !== right.isUnnamedDraft) return left.isUnnamedDraft ? 1 : -1;
  return left.title.localeCompare(right.title);
}

export function compareBrandDashboardRows(left: BrandDashboardCampaignRow, right: BrandDashboardCampaignRow) {
  const leftPriority = brandBucketPriority(left.bucket);
  const rightPriority = brandBucketPriority(right.bucket);
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  return compareRowsWithinBucket(left, right);
}

function firstByPriority(rows: BrandDashboardCampaignRow[]) {
  return [...rows].filter(isHeroActionable).sort(compareBrandDashboardRows)[0] ?? null;
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
  const solutionRows = rows.filter((row) => row.status === "review" && row.solutionCount > 0);
  const solutionTotal = solutionRows.reduce((total, row) => total + row.solutionCount, 0);
  const activities: BrandDashboardActivity[] = [];

  if (solutionTotal > 0) {
    const latest = [...solutionRows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    activities.push({
      key: `solutions:${solutionRows.map((row) => row.draftId).sort().join(",")}`,
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
    if (!["funding", "ready-to-publish", "closed-no-submissions", "closed-not-enough-submissions", "winner-ready", "settlement", "completed", "draft"].includes(row.status)) continue;
    activities.push({
      key: `draft:${row.draftId}:${row.status}`,
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
  if (row.status === "closed-no-submissions" || row.status === "closed-not-enough-submissions") {
    return { id: `closed:${row.draftId}:not-actionable`, title: row.statusLabel, campaignName: row.title, statusLabel: "Recent", href: row.href, tone: row.statusTone };
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
  const actionableSubmissionDraftIds = new Set(
    rows
      .filter((row) => row.status === "review")
      .map((row) => row.draftId),
  );
  return [
    ...submissionNotifications(submissions.filter((item) => actionableSubmissionDraftIds.has(item.draftId))),
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
  const sourceRows = campaignRows(drafts, solutionCountsByDraft(submissions));
  const sortedRows = [...sourceRows].sort(compareBrandDashboardRows);
  const dashboardSummaryRows = [...sourceRows].sort(compareBrandDashboardRows);
  const rows = typeof identity.campaignLimit === "number"
    ? dashboardSummaryRows.slice(0, identity.campaignLimit)
    : identity.campaignLimit === null
      ? sortedRows
      : dashboardSummaryRows.slice(0, 6);
  const focus = firstByPriority(sortedRows);
  const primaryState = focus?.status ?? "empty";
  const primaryAction = actionForState(primaryState, focus?.draftId);
  const brandDisplayName = isMeaningfulBrandName(identity.brandDisplayName)
    ? identity.brandDisplayName?.trim() ?? null
    : null;

  return {
    workspace: "Brand Workspace",
    brandDisplayName,
    primaryAction,
    primaryMessage: "Turn your next business problem into a globally sourced solution.",
    primaryTitle: focus?.solutionCount ? "New solution received" : titleForState(primaryState),
    campaignHealth: focus ? contextForState(primaryState) : "No business challenges yet",
    primaryCampaign: focus,
    journeySteps: journeySteps(primaryState),
    allCampaignRows: sortedRows,
    campaignRows: rows,
    recentActivity: activityForRows(rows),
    notifications: notificationsForRows(rows, submissions),
    priorities: prioritiesForRows(sortedRows),
    walletQuickActions: [
      addFundsAction(sortedRows),
      { label: "Payments", detail: "Funding and settlement", available: true, href: "/dashboard/payments" },
      { label: "Wallet", detail: "Testnet balance", available: true, href: "/dashboard/wallet" },
    ],
    sponsorVisible: true,
  };
}

function addFundsAction(rows: BrandDashboardCampaignRow[]): BrandDashboardWalletAction {
  const fundable = rows.filter((row) => row.status === "funding");
  if (fundable.length === 1) {
    return {
      label: "Fund",
      detail: fundable[0]?.title ?? "Business challenge",
      available: true,
      href: campaignHref(fundable[0]!.draftId, "funding"),
    };
  }
  if (fundable.length > 1) {
    return {
      label: "Fund",
      detail: "Choose a challenge",
      available: true,
      href: "/dashboard/campaigns?filter=funding",
    };
  }
  return {
    label: "Fund",
    detail: "No funding needed",
    available: false,
  };
}
