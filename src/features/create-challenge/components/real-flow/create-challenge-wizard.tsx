"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { CCNLogo } from "@/components/ui/ccn-logo";
import { FormLabel } from "@/components/ui/form-label";
import type { CreateChallengeDeadlinePolicy } from "@/config/create-challenge-deadline-policy";
import { createChallengeSteps, demoCreateChallengeDraft } from "@/features/create-challenge/data/demo-draft";
import { createChallengeTraceId, logCreateChallengeTrace, type CreateChallengeTraceSource } from "@/utils/create-challenge-payment-trace";
import { CREATE_CHALLENGE_BALANCE_TTL_MS } from "@/config/create-challenge-payment";
import type {
  CreateChallengeDraftState,
  CreateChallengeLaunchReadiness,
  CreateChallengePaymentProgressItem,
  CreateChallengePaymentState,
  CreateChallengeStepId,
  CreateChallengeValidation,
  PrizeDistributionMode,
} from "@/types/create-challenge";
import type {
  EscrowPreflightSnapshot,
  EscrowTransactionSnapshot,
  EscrowTransactionStage,
} from "@/types/escrow-funding-spike";
import type { SpikeAppSession } from "@/types/wallet-spike";
import {
  calculatePrizePool,
  formatUsdcUnits,
  normalizePrizePool,
  parseUsdcUnits,
} from "@/utils/create-challenge-finance";
import { localDateInputPart, localInputToCanonicalIso, localTimeInputPart } from "@/utils/challenge-deadlines";
import { validateCreateChallengeLaunchReadiness } from "@/utils/create-challenge-launch-readiness";

type PaymentErrorScope = "PAYMENT_OVERVIEW" | "WALLET_SETUP" | "APPROVAL" | "FUNDING" | "RECONCILE" | "PUBLISH";
type PaymentErrorSeverity = "NON_BLOCKING" | "BLOCKING";

type SafeError = {
  message: string;
  status?: number;
  code?: string | number;
  endpoint?: string;
  scope?: PaymentErrorScope;
  severity?: PaymentErrorSeverity;
  requestId?: string;
  occurredAt?: string;
};

type CampaignCoverView = {
  imageKey: string | null;
  imageUrl: string | null;
  alt: string;
};

type DraftResponse = {
  draft: CreateChallengeDraftState;
  validation?: CreateChallengeValidation | null;
  deadlinePolicy?: CreateChallengeDeadlinePolicy;
  launchReadiness?: CreateChallengeLaunchReadiness;
  cover?: CampaignCoverView | null;
};

type CampaignCoverResponse = {
  draft: CreateChallengeDraftState;
  deadlinePolicy?: CreateChallengeDeadlinePolicy;
  launchReadiness?: CreateChallengeLaunchReadiness;
  cover: CampaignCoverView & { imageKey: string };
};

type PaymentOverviewResponse = {
  paymentState: CreateChallengePaymentState;
  progress: CreateChallengePaymentProgressItem[];
  availableActions: string[];
  paymentAccount: PaymentAccountSnapshot;
  safeMessage: string;
  balance: { units: string; display: string; readAt: string; source: string };
  diagnostics?: {
    escrowContractAddress?: `0x${string}`;
  };
};

type PreflightResponse = EscrowPreflightSnapshot & {
  display: Record<string, string>;
  paymentOverview?: PaymentOverviewResponse;
};

type PaymentAccountSnapshot = {
  accountStatus: "READY" | "BALANCE_UNAVAILABLE" | "ERROR";
  walletId: string;
  circleUserId: string;
  walletAddressMasked: string;
  walletAddress: `0x${string}`;
  walletState: string;
  network: "ARC-TESTNET";
  chainId: number;
  balanceUnits: string;
  balanceDisplay: string;
  balanceReadAt: string;
  canAfford: boolean | null;
  totalRequiredUnits: string;
  totalRequiredDisplay: string;
  remainingAfterFundingUnits: string;
  remainingAfterFundingDisplay: string;
  nextState:
    | "ACCOUNT_READY"
    | "BALANCE_READY"
    | "INSUFFICIENT_BALANCE"
    | "ERROR";
  safeMessage: string;
  explorerUrl: string;
};

type BalanceSnapshot = {
  walletAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  chainId: number;
  balanceUnits: string;
  balanceDisplay: string;
  verifiedAt: string;
};

const ARC_TESTNET_USDC_TOKEN = "0x3600000000000000000000000000000000000000" as const;
type PaymentWalletCardAccount = Pick<
  PaymentAccountSnapshot,
  | "walletAddress"
  | "walletAddressMasked"
  | "walletState"
  | "balanceDisplay"
  | "explorerUrl"
>;

type FundingVerificationResponse = {
  verified: boolean;
  eventVerified: boolean;
  isFunded: boolean;
  links: Record<string, string | null>;
};

type PaymentStateResponse = {
  paymentOverview?: PaymentOverviewResponse;
};

type PaymentWalletInitializeResponse = {
  initialized: {
    alreadyMapped: boolean;
    challengeId?: string;
    wallet?: {
      walletId?: string;
      walletAddress?: string;
      walletState?: string;
    };
  };
};

type ApprovalRecoveryResponse = {
  attempts: Array<{
    sequence: number;
    circleChallengeId: string;
    circleStatus: string;
    circleTransactionId?: string;
    transactionHash?: string;
  }>;
  allowance: string;
  requiredAllowance: string;
  canonicalAttempt: {
    circleChallengeId: string;
    circleStatus: string;
    circleTransactionId?: string;
    transactionHash?: string;
  } | null;
  restoredState: "APPROVAL_PENDING" | "APPROVED" | "READY_FOR_APPROVAL" | "START_AGAIN";
};

const OTHER_BUSINESS_DOMAIN_OPTION = "Other";
const CUSTOM_BUSINESS_DOMAIN_PLACEHOLDER = "e.g. Payments, Fintech, Developer Tools, AI Infrastructure";
const categories = [
  "Brand Awareness",
  "Customer Growth",
  "Customer Retention",
  "Retail Experience",
  "Go-to-Market",
  "Product Launch",
  "Market Expansion",
  "Community Growth",
  "Customer Experience",
  "Operations",
  OTHER_BUSINESS_DOMAIN_OPTION,
];

function isPredefinedBusinessDomain(value: string) {
  return categories.includes(value);
}

function selectedBusinessDomainOption(value: string) {
  return isPredefinedBusinessDomain(value) ? value : OTHER_BUSINESS_DOMAIN_OPTION;
}

function customBusinessDomainValue(value: string) {
  return value && !isPredefinedBusinessDomain(value) ? value : "";
}

function businessDomainFromCustomValue(value: string) {
  return value.trim() ? value : OTHER_BUSINESS_DOMAIN_OPTION;
}

function mask(value?: string | null) {
  if (!value) return "Not available";
  if (value.length <= 12) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function nextStep(step: CreateChallengeStepId): CreateChallengeStepId {
  const index = createChallengeSteps.findIndex((item) => item.id === step);
  return createChallengeSteps[Math.min(index + 1, createChallengeSteps.length - 1)].id;
}

function previousStep(step: CreateChallengeStepId): CreateChallengeStepId {
  const index = createChallengeSteps.findIndex((item) => item.id === step);
  return createChallengeSteps[Math.max(index - 1, 0)].id;
}

function fundingIsVerified(draft: CreateChallengeDraftState) {
  return (
    draft.deployment.publicationStatus === "ready-to-publish" ||
    draft.deployment.publicationStatus === "live"
  );
}

function fundingActionStatus(draft: CreateChallengeDraftState) {
  if (
    draft.deployment.currentStep !== "funding" &&
    draft.deployment.currentStep !== "publish"
  ) {
    return draft.challenge.title || draft.challenge.brandName
      ? "Draft saved"
      : "Draft in progress";
  }
  if (draft.deployment.publicationStatus === "live") return "Challenge live";
  if (fundingIsVerified(draft)) return "Prize pool secured";
  if (draft.funding.fundingStatus === "funded") return "Your payment was detected. We are verifying it on Arc.";
  switch (draft.funding.fundingStatus) {
    case "approval-pending":
      return "Waiting for payment approval";
    case "approved":
      return "Approval confirmed. Secure the prize pool next.";
    case "funding-pending":
      return "Securing prize pool on Arc";
    case "ready":
      return "Draft ready for funding";
    default:
      return "Draft ready for funding";
  }
}

function publishStepHeaderStatus(draft: CreateChallengeDraftState, fallback: string, readiness?: CreateChallengeLaunchReadiness | null) {
  if (draft.deployment.publicationStatus === "live") return "Challenge live";
  if (fundingIsVerified(draft) && readiness && !readiness.valid) return "Publish needs attention";
  if (draft.deployment.publicationStatus === "ready-to-publish") return "Ready to publish";
  return fallback;
}

function tracePublishClick(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ccn-publish-click]", { event, ...details });
}

type PaymentState = CreateChallengePaymentState;

type PaymentProgressItem = CreateChallengePaymentProgressItem;

type FastPublishPipelineState =
  | "ready_for_approval"
  | "approval_challenge_ready"
  | "approval_user_action_required"
  | "approval_pending"
  | "approval_confirmed"
  | "funding_preparing"
  | "funding_challenge_ready"
  | "funding_user_action_required"
  | "funding_pending"
  | "funding_verifying"
  | "funding_confirmed"
  | "publishing"
  | "live"
  | "recoverable_error"
  | "blocked";

type PipelineTimingName =
  | "approval_challenge_creation"
  | "pin_callback_to_approval_confirmation"
  | "funding_challenge_creation"
  | "pin_callback_to_tx_hash"
  | "tx_hash_to_verified_funding"
  | "funding_verified_to_live";

const PIPELINE_POLL_DELAYS_MS = [1_000, 1_500, 2_500, 3_500, 5_000] as const;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function traceFastPublishPipeline(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ccn-fast-publish-pipeline]", { event, ...details });
}

function recordPipelineTiming(name: PipelineTimingName, startedAt: number, details: Record<string, unknown> = {}) {
  traceFastPublishPipeline("timing", {
    name,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    ...details,
  });
}

function deriveFastPublishPipelineState(
  state: PaymentState,
  draft?: CreateChallengeDraftState | null,
  approval?: EscrowTransactionSnapshot | null,
  funding?: EscrowTransactionSnapshot | null,
  error?: SafeError | null,
  pending = false,
): FastPublishPipelineState {
  if (draft?.deployment.publicationStatus === "live" || state === "PUBLISHED") return "live";
  if (error?.severity === "BLOCKING" || state === "FATAL_ERROR" || state === "INSUFFICIENT_BALANCE") return "blocked";
  if (error || state === "RECOVERABLE_ERROR") return "recoverable_error";
  if (state === "FUNDED_VERIFIED") return pending ? "publishing" : "funding_confirmed";
  if (state === "RECONCILING") return "funding_verifying";
  if (state === "FUNDING_PENDING") {
    if (funding?.transactionHash || draft?.funding.transactionHash) return "funding_verifying";
    return "funding_pending";
  }
  if (state === "APPROVED") return pending ? "funding_preparing" : "approval_confirmed";
  if (state === "APPROVAL_PENDING") {
    if (approval?.transactionHash || draft?.funding.approvalTransactionHash) return "approval_pending";
    return approval?.challengeId || draft?.funding.approvalTransactionId ? "approval_challenge_ready" : "approval_user_action_required";
  }
  if (state === "BALANCE_LOADING" || state === "ACCOUNT_LOADING") return "ready_for_approval";
  return "ready_for_approval";
}

function paymentProgressItems(
  state: PaymentState,
  draft?: CreateChallengeDraftState | null,
  approval?: EscrowTransactionSnapshot | null,
  funding?: EscrowTransactionSnapshot | null,
  error?: SafeError | null,
  pending = false,
): PaymentProgressItem[] {
  const pipelineState = deriveFastPublishPipelineState(state, draft, approval, funding, error, pending);
  const steps = [
    {
      label: "Preparing approval",
      description: "Checking Business Challenge details and wallet approval.",
      technology: "Payment check",
    },
    {
      label: "Waiting for Approval PIN",
      description: "Waiting for your wallet approval.",
      technology: "Circle Hosted Wallet",
    },
    {
      label: "Approval submitted",
      description: "Your approval was submitted and is being confirmed.",
      technology: "Circle transaction",
    },
    {
      label: "Approval confirmed",
      description: "The approved test USDC amount is ready for the Prize Pool.",
      technology: "Approved USDC amount",
    },
    {
      label: "Preparing prize funding",
      description: "Preparing the prize pool transaction.",
      technology: "Prize Pool funding details",
    },
    {
      label: "Waiting for Funding PIN",
      description: "Waiting for your funding approval.",
      technology: "Circle Hosted Wallet",
    },
    {
      label: "Funding transaction submitted",
      description: "Submitting your prize pool transaction.",
      technology: "Circle transaction",
    },
    {
      label: "Waiting for blockchain confirmation",
      description: "Waiting for blockchain confirmation. This usually takes 30-90 seconds.",
      technology: "Arc Testnet",
    },
    {
      label: "Funding verified",
      description: "Receipt and payout transaction evidence are verified.",
      technology: "Arc verification",
    },
    {
      label: "Publishing challenge",
      description: "Publishing your challenge for creators.",
      technology: "Publishing",
    },
    {
      label: "Challenge live",
      description: "Your challenge is now available for creators.",
      technology: "Public challenge",
    },
  ];
  const indexByState: Record<FastPublishPipelineState, number> = {
    ready_for_approval: 0,
    approval_challenge_ready: 1,
    approval_user_action_required: 1,
    approval_pending: 2,
    approval_confirmed: 4,
    funding_preparing: 4,
    funding_challenge_ready: 5,
    funding_user_action_required: 5,
    funding_pending: 6,
    funding_verifying: 7,
    funding_confirmed: 9,
    publishing: 9,
    live: 10,
    recoverable_error: 0,
    blocked: 0,
  };
  const publishNeedsAttention = pipelineState === "recoverable_error" && Boolean(draft && fundingIsVerified(draft));
  const activeIndex = publishNeedsAttention ? 9 : indexByState[pipelineState];
  const failed = pipelineState === "recoverable_error" || pipelineState === "blocked";
  const doneThrough = pipelineState === "live" ? steps.length : activeIndex;

  return steps.map((step, index) => {
    if (index < doneThrough) return { ...step, status: "done" };
    if (index === activeIndex) {
      if (failed) {
        return {
          ...step,
          label: publishNeedsAttention ? "Publish needs attention" : pipelineState === "blocked" ? "Blocked" : "Retry required",
          description: error?.message ?? step.description,
          status: "warning",
        };
      }
      return { ...step, status: "active" };
    }
    return { ...step, status: "pending" };
  });
}

async function requestJson<T>(url: string, body?: unknown, signal?: AbortSignal, trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; draftId?: string; currentStep?: string }): Promise<T> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(trace ? { "x-ccn-request-id": trace.requestId, "x-ccn-trigger-source": trace.triggerSource } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: SafeError;
  };
  if (trace) {
    logCreateChallengeTrace({
      requestId: trace.requestId,
      route: url,
      draftId: trace.draftId,
      currentStep: trace.currentStep,
      triggerSource: trace.triggerSource,
      completedAt: new Date().toISOString(),
      success: response.ok,
      status: response.status,
      attemptedErrorUpdate: !response.ok,
    });
  }
  if (!response.ok) {
    throw { ...(payload.error ?? { message: "Request failed safely." }), requestId: trace?.requestId };
  }
  return payload as T;
}

const initialDraftRequests = new Map<string, Promise<DraftResponse>>();

function requestInitialDraft(url: string, cacheRequest: boolean) {
  if (!cacheRequest) return requestJson<DraftResponse>(url);
  const existing = initialDraftRequests.get(url);
  if (existing) return existing;
  const request = requestJson<DraftResponse>(url).finally(() => {
    initialDraftRequests.delete(url);
  });
  initialDraftRequests.set(url, request);
  return request;
}

function isRecentBalanceSnapshot(snapshot: BalanceSnapshot | null): snapshot is BalanceSnapshot {
  return Boolean(
    snapshot?.verifiedAt &&
      Date.now() - new Date(snapshot.verifiedAt).getTime() <= CREATE_CHALLENGE_BALANCE_TTL_MS,
  );
}

function overviewFromSnapshot(
  overview: PaymentOverviewResponse,
  snapshot: BalanceSnapshot,
): PaymentOverviewResponse {
  return {
    ...overview,
    paymentState: "READY_FOR_APPROVAL",
    progress: paymentProgressItems("READY_FOR_APPROVAL"),
    availableActions: ["APPROVE"],
    safeMessage: "",
    balance: {
      units: snapshot.balanceUnits,
      display: snapshot.balanceDisplay,
      readAt: snapshot.verifiedAt,
      source: "official-usdc-balance",
    },
    paymentAccount: {
      ...overview.paymentAccount,
      accountStatus: "READY",
      balanceUnits: snapshot.balanceUnits,
      balanceDisplay: snapshot.balanceDisplay,
      balanceReadAt: snapshot.verifiedAt,
      safeMessage: "",
    },
  };
}

function paymentStateHeaderStatus(state: PaymentState) {
  switch (state) {
    case "NOT_STARTED":
      return "Payment account not checked";
    case "ACCOUNT_LOADING":
    case "BALANCE_LOADING":
      return "Checking payment account";
    case "BALANCE_READY":
    case "READY_FOR_APPROVAL":
      return "Approval required";
    case "INSUFFICIENT_BALANCE":
      return "Insufficient balance";
    case "RECOVERABLE_ERROR":
      return "Payment check needs retry";
    case "FATAL_ERROR":
      return "Payment check unavailable";
    case "APPROVAL_PENDING":
      return "Waiting for payment approval";
    case "APPROVED":
      return "Payment confirmed";
    case "FUNDING_PENDING":
      return "Securing prize pool";
    case "RECONCILING":
      return "Verifying payment";
    case "FUNDED_VERIFIED":
      return "Prize pool secured";
    case "PUBLISHED":
      return "Challenge live";
    default:
      return "Payment status unavailable";
  }
}

function paymentOverviewStatus(
  overview: PaymentOverviewResponse,
  draft: CreateChallengeDraftState,
) {
  switch (overview.paymentState) {
    case "ACCOUNT_LOADING":
    case "BALANCE_LOADING":
      return "Checking payment account...";
    case "BALANCE_READY":
    case "READY_FOR_APPROVAL":
      return "Payment account ready. Balance verified.";
    case "INSUFFICIENT_BALANCE":
      return "Available test USDC is below the total required amount.";
    case "RECOVERABLE_ERROR":
      return overview.safeMessage || "Unable to refresh balance. Please try again.";
    case "FATAL_ERROR":
      return overview.safeMessage || "Payment account verification failed.";
    case "APPROVAL_PENDING":
      return "Waiting for payment approval";
    case "APPROVED":
      return "Approval confirmed. Secure the prize pool next.";
    case "FUNDING_PENDING":
      return "Securing prize pool on Arc";
    case "RECONCILING":
      return "Your payment was detected. We are verifying it on Arc.";
    case "FUNDED_VERIFIED":
      return "Prize pool secured";
    case "PUBLISHED":
      return "Challenge live";
    default:
      return fundingActionStatus(draft);
  }
}

function paymentAccountFromPreflight(
  preflight: PreflightResponse,
  draft: CreateChallengeDraftState,
): PaymentAccountSnapshot {
  const canAfford = BigInt(preflight.balances.brandUsdc) >= BigInt(draft.prizePool.totalRequiredUnits);
  const walletAddress = preflight.balanceSource.address as `0x${string}`;

  return {
    accountStatus: "READY",
    walletId: preflight.wallet.walletId,
    circleUserId: "",
    walletAddress,
    walletAddressMasked: mask(walletAddress),
    walletState: preflight.wallet.state === "LIVE" ? "Ready" : preflight.wallet.state,
    network: "ARC-TESTNET",
    chainId: preflight.balanceSource.chainId,
    balanceUnits: preflight.balances.brandUsdc,
    balanceDisplay: `${preflight.display.brandUsdc} test USDC`,
    balanceReadAt: preflight.balanceSource.timestamp,
    canAfford,
    totalRequiredUnits: draft.prizePool.totalRequiredUnits,
    totalRequiredDisplay: `${formatUsdcUnits(draft.prizePool.totalRequiredUnits)} test USDC`,
    remainingAfterFundingUnits:
      BigInt(preflight.balances.brandUsdc) > BigInt(draft.prizePool.totalRequiredUnits)
        ? (BigInt(preflight.balances.brandUsdc) - BigInt(draft.prizePool.totalRequiredUnits)).toString()
        : "0",
    remainingAfterFundingDisplay:
      BigInt(preflight.balances.brandUsdc) > BigInt(draft.prizePool.totalRequiredUnits)
        ? `${formatUsdcUnits(BigInt(preflight.balances.brandUsdc) - BigInt(draft.prizePool.totalRequiredUnits))} test USDC`
        : "0 test USDC",
    nextState: canAfford ? "BALANCE_READY" : "INSUFFICIENT_BALANCE",
    safeMessage: "",
    explorerUrl: `https://testnet.arcscan.app/address/${walletAddress}`,
  };
}

type CreateChallengeEntryMode = "new" | "smoke" | "existing" | "idle";

function cloneDraftTemplate() {
  return JSON.parse(JSON.stringify(demoCreateChallengeDraft)) as CreateChallengeDraftState;
}

function immediateDraftForEntry(entryMode: CreateChallengeEntryMode) {
  if (entryMode !== "new" && entryMode !== "smoke") return null;
  const draft = cloneDraftTemplate();
  return {
    ...draft,
    challenge: {
      ...draft.challenge,
      isSmokeTest: entryMode === "smoke" ? true : draft.challenge.isSmokeTest,
    },
    deployment: {
      ...draft.deployment,
      currentStep: "basics" as const,
    },
  };
}

function mergeInitializedDraft(current: CreateChallengeDraftState | null, initialized: CreateChallengeDraftState) {
  if (!current || current.challenge.id) return initialized;
  return {
    ...initialized,
    challenge: {
      ...initialized.challenge,
      title: current.challenge.title,
      brandName: current.challenge.brandName,
      category: current.challenge.category,
      market: current.challenge.market,
      summary: current.challenge.summary,
      description: current.challenge.description,
      coverImageKey: current.challenge.coverImageKey,
      coverImageAlt: current.challenge.coverImageAlt,
      coverImageUpdatedAt: current.challenge.coverImageUpdatedAt,
      primaryDeliverable: current.challenge.primaryDeliverable,
      supportingDeliverables: current.challenge.supportingDeliverables,
      referenceLinks: current.challenge.referenceLinks,
      attachments: current.challenge.attachments,
      deadline: current.challenge.deadline,
      usageRightsAcknowledged: current.challenge.usageRightsAcknowledged,
    },
    prizePool: current.prizePool,
    reviewRules: initialized.challenge.isSmokeTest ? initialized.reviewRules : current.reviewRules,
    deployment: {
      ...initialized.deployment,
      currentStep: current.deployment.currentStep,
    },
  };
}

function draftFormSignature(draft: CreateChallengeDraftState, step: CreateChallengeStepId) {
  return JSON.stringify({
    challenge: draft.challenge,
    prizePool: draft.prizePool,
    reviewRules: draft.reviewRules,
    currentStep: step,
  });
}

function preserveEditableDraftState(
  serverDraft: CreateChallengeDraftState,
  clientDraft: CreateChallengeDraftState,
  targetStep: CreateChallengeStepId,
): CreateChallengeDraftState {
  return {
    ...serverDraft,
    challenge: {
      ...serverDraft.challenge,
      title: clientDraft.challenge.title,
      brandName: clientDraft.challenge.brandName,
      category: clientDraft.challenge.category,
      market: clientDraft.challenge.market,
      summary: clientDraft.challenge.summary,
      description: clientDraft.challenge.description,
      coverImageKey: clientDraft.challenge.coverImageKey || serverDraft.challenge.coverImageKey,
      coverImageAlt: clientDraft.challenge.coverImageAlt ?? serverDraft.challenge.coverImageAlt,
      coverImageUpdatedAt: clientDraft.challenge.coverImageUpdatedAt ?? serverDraft.challenge.coverImageUpdatedAt,
      primaryDeliverable: clientDraft.challenge.primaryDeliverable,
      supportingDeliverables: clientDraft.challenge.supportingDeliverables,
      referenceLinks: clientDraft.challenge.referenceLinks,
      attachments: clientDraft.challenge.attachments,
      deadline: clientDraft.challenge.deadline,
      usageRightsAcknowledged: clientDraft.challenge.usageRightsAcknowledged,
      isSmokeTest: serverDraft.challenge.isSmokeTest,
      slug: serverDraft.challenge.slug,
      slugReservedForTitle: serverDraft.challenge.slugReservedForTitle,
    },
    prizePool: clientDraft.prizePool,
    reviewRules: clientDraft.reviewRules,
    deployment: {
      ...serverDraft.deployment,
      currentStep: targetStep,
    },
  };
}
export function CreateChallengeWizard({
  appId,
  entryMode = "idle",
  initialDeadlinePolicy,
}: {
  appId: string;
  entryMode?: CreateChallengeEntryMode;
  initialDeadlinePolicy?: CreateChallengeDeadlinePolicy;
}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [draft, setDraft] = useState<CreateChallengeDraftState | null>(() => immediateDraftForEntry(entryMode));
  const [draftId, setDraftId] = useState<string>("");
  const [step, setStep] = useState<CreateChallengeStepId>("basics");
  const [session, setSession] = useState<SpikeAppSession | null>(null);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccountSnapshot | null>(null);
  const [paymentOverview, setPaymentOverview] = useState<PaymentOverviewResponse | null>(null);
  const [paymentAccountPending, setPaymentAccountPending] = useState(false);
  const [paymentAccountError, setPaymentAccountError] = useState<SafeError | null>(null);
  const [balanceNotice, setBalanceNotice] = useState<string | null>(null);
  const [approval, setApproval] = useState<EscrowTransactionSnapshot | null>(null);
  const [funding, setFunding] = useState<EscrowTransactionSnapshot | null>(null);
  const [publication, setPublication] = useState<{ published: boolean; links: Record<string, string | null> } | null>(null);
  const [validation, setValidation] = useState<CreateChallengeValidation | null>(null);
  const [deadlinePolicy, setDeadlinePolicy] = useState<CreateChallengeDeadlinePolicy | null>(initialDeadlinePolicy ?? null);
  const [launchReadiness, setLaunchReadiness] = useState<CreateChallengeLaunchReadiness | null>(() => {
    const initial = immediateDraftForEntry(entryMode);
    return initial ? validateCreateChallengeLaunchReadiness(initial, initialDeadlinePolicy ? { deadlinePolicy: initialDeadlinePolicy } : undefined) : null;
  });
  const [campaignCover, setCampaignCover] = useState<CampaignCoverView | null>(null);
  const [status, setStatus] = useState(entryMode === "new" || entryMode === "smoke" ? "Preparing draft..." : "Loading saved draft...");
  const [error, setError] = useState<SafeError | null>(null);
  const [pending, setPending] = useState(entryMode === "new" || entryMode === "smoke");
  const [dirty, setDirty] = useState(false);
  const lastBalanceSnapshotRef = useRef<BalanceSnapshot | null>(null);
  const balanceRequestRef = useRef(0);
  const balanceAbortRef = useRef<AbortController | null>(null);
  const prizeBalanceReadDraftsRef = useRef(new Set<string>());
  const fundingBalanceReadDraftsRef = useRef(new Set<string>());
  const pipelineActionRef = useRef<string | null>(null);
  const pipelineResumeKeysRef = useRef(new Set<string>());
  const latestDraftSignatureRef = useRef<string | null>(draft ? draftFormSignature(draft, step) : null);

  function draftUrl(targetDraftId = draftId) {
    if (!targetDraftId) throw new Error("draftId is required for this draft request.");
    return `/api/create-challenge/draft?draftId=${encodeURIComponent(targetDraftId)}`;
  }

  function scopedBody(body: Record<string, unknown> = {}) {
    const bodyDraftId = typeof body.draftId === "string" ? body.draftId : null;
    return { ...body, draftId: bodyDraftId ?? draft?.challenge.id ?? draftId };
  }

  const launchReadinessForDraft = useCallback((
    targetDraft: CreateChallengeDraftState,
    policy: CreateChallengeDeadlinePolicy | null | undefined = deadlinePolicy,
  ) => {
    return validateCreateChallengeLaunchReadiness(targetDraft, policy ? { deadlinePolicy: policy } : undefined);
  }, [deadlinePolicy]);

  useEffect(() => {
    let active = true;
    document.body.classList.add("ccn-app-shell");
    const params = new URLSearchParams(window.location.search);
    const selectedDraftId = params.get("draftId");
    const shouldCreateNew = params.get("new") === "1";
    const shouldCreateSmoke = params.get("mode") === "smoke";
    if (!shouldCreateNew && !shouldCreateSmoke && !selectedDraftId) {
      queueMicrotask(() => {
        if (active) setStatus("Choose Continue Problem Draft or New Business Challenge to begin.");
      });
      return () => {
        active = false;
        document.body.classList.remove("ccn-app-shell");
      };
    }
    const initialUrl = shouldCreateSmoke
      ? "/api/create-challenge/draft?mode=smoke"
      : shouldCreateNew
      ? "/api/create-challenge/draft?new=1"
      : `/api/create-challenge/draft?draftId=${encodeURIComponent(selectedDraftId ?? "")}`;
    const rendersImmediateShell = shouldCreateNew || shouldCreateSmoke;
    void requestInitialDraft(initialUrl, rendersImmediateShell)
      .then((payload) => {
        if (!active) return;
        setDeadlinePolicy(payload.deadlinePolicy ?? null);
        setDraft((current) => rendersImmediateShell ? payload.draft : mergeInitializedDraft(current, payload.draft));
        setDraftId(payload.draft.challenge.id ?? "");
        setLaunchReadiness(
          payload.launchReadiness ??
            validateCreateChallengeLaunchReadiness(
              payload.draft,
              payload.deadlinePolicy ? { deadlinePolicy: payload.deadlinePolicy } : undefined,
            ),
        );
        setCampaignCover(payload.cover ?? null);
        if (payload.draft.challenge.id) {
          window.history.replaceState(
            null,
            "",
            `/create-challenge?draftId=${encodeURIComponent(payload.draft.challenge.id)}`,
          );
        }
        if (
          payload.draft.deployment.currentStep === "publish" &&
          !fundingIsVerified(payload.draft)
        ) {
          setStep("funding");
          setStatus("Complete funding before publishing this challenge.");
          return;
        }
        if (!rendersImmediateShell) {
          setStep(payload.draft.deployment.currentStep);
        }
        setStatus(fundingActionStatus(payload.draft));
      })
      .catch(showError)
      .finally(() => {
        if (active && rendersImmediateShell) setPending(false);
      });
    return () => {
      active = false;
      document.body.classList.remove("ccn-app-shell");
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function bootSdk() {
      if (!appId) return;
      const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new CircleSdk({ appSettings: { appId } });
      if (active) sdkRef.current = sdk;
    }
    void bootSdk().catch(() => {
      setError({ message: "Failed to initialize the payment confirmation window." });
    });
    return () => {
      active = false;
    };
  }, [appId]);

  useEffect(() => {
    if (!draft?.funding.walletAddress || !draft.funding.lastBalanceRefreshAt) return;
    if (lastBalanceSnapshotRef.current?.verifiedAt === draft.funding.lastBalanceRefreshAt) return;
    const parsed = parseUsdcUnits(draft.funding.availableBalance || 0);
    lastBalanceSnapshotRef.current = {
      walletAddress: draft.funding.walletAddress as `0x${string}`,
      tokenAddress: ARC_TESTNET_USDC_TOKEN,
      chainId: 5_042_002,
      balanceUnits: parsed.units.toString(),
      balanceDisplay: `${formatUsdcUnits(parsed.units)} test USDC`,
      verifiedAt: draft.funding.lastBalanceRefreshAt,
    };
  }, [draft?.funding.availableBalance, draft?.funding.lastBalanceRefreshAt, draft?.funding.walletAddress]);


  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    latestDraftSignatureRef.current = draft ? draftFormSignature(draft, step) : null;
  }, [draft, step]);

  useEffect(() => {
    if (!dirty || !draft?.challenge.id || pending) return;
    if (step === "funding" || step === "publish") return;
    const autosaveDraft = {
      ...draft,
      deployment: { ...draft.deployment, currentStep: step },
    };
    const autosaveSignature = draftFormSignature(autosaveDraft, step);
    const timer = window.setTimeout(() => {
      void requestJson<DraftResponse>("/api/create-challenge/draft", {
        draftId: autosaveDraft.challenge.id,
        draft: autosaveDraft,
      }).then((payload) => {
        if (latestDraftSignatureRef.current !== autosaveSignature) return;
        setDraftId(payload.draft.challenge.id ?? "");
        setCampaignCover(payload.cover ?? null);
        setDeadlinePolicy(payload.deadlinePolicy ?? deadlinePolicy);
        setLaunchReadiness(payload.launchReadiness ?? launchReadinessForDraft(autosaveDraft, payload.deadlinePolicy ?? deadlinePolicy));
        setDirty(false);
        setStatus("Draft autosaved");
      }).catch(() => {
        if (latestDraftSignatureRef.current === autosaveSignature) {
          setStatus("Draft autosave is temporarily unavailable. Your changes are still on this page.");
        }
      });
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [deadlinePolicy, dirty, draft, launchReadinessForDraft, pending, step]);

  const fundingState: PaymentState = paymentOverview?.paymentState ?? "NOT_STARTED";
  const fundingSteps = paymentProgressItems(fundingState, draft, approval, funding, error, pending);
  const prizeMath = draft
    ? calculatePrizePool({
        totalAmount: draft.prizePool.totalAmount,
        winnerCount: draft.prizePool.winnerCount,
        distributionMode: draft.prizePool.distributionMode,
        prizeDistribution: draft.prizePool.prizeDistribution,
      })
    : null;
  const prizeStepHasMismatch =
    step === "prize-pool" &&
    (!prizeMath || prizeMath.errors.length > 0 || prizeMath.remainingUnits !== "0");
  const prizeStepHasInsufficientBalance =
    step === "prize-pool" &&
    Boolean(
      prizeMath &&
        paymentAccount?.accountStatus === "READY" &&
        BigInt(paymentAccount.balanceUnits) < BigInt(prizeMath.totalRequiredUnits),
    );
  const currentLaunchReadiness = launchReadiness ?? (draft ? launchReadinessForDraft(draft) : null);
  const statusHeader =
    step === "funding"
      ? paymentStateHeaderStatus(fundingState)
      : step === "publish" && draft
        ? publishStepHeaderStatus(draft, status, currentLaunchReadiness)
        : status;
  const draftInitializationPending = Boolean(draft && !draft.challenge.id);
  const draftReadyForActions = Boolean(draft?.challenge.id ?? draftId);
  const blockingError: SafeError | null = error;

  function focusLaunchReadinessItem(itemId?: string) {
    window.setTimeout(() => {
      const selector = itemId === "campaign-cover"
        ? "#campaign-cover-field button"
        : "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])";
      document.querySelector<HTMLElement>(selector)?.focus();
    }, 0);
  }

  function fixLaunchReadiness(itemId?: string) {
    const item = currentLaunchReadiness?.items.find((candidate) => candidate.id === itemId)
      ?? currentLaunchReadiness?.items.find((candidate) => candidate.status !== "ready");
    if (!item) return;
    setStep(item.step);
    updateDraft((current) => ({
      ...current,
      deployment: { ...current.deployment, currentStep: item.step },
    }));
    setStatus(item.message);
    focusLaunchReadinessItem(item.id);
  }

  function fieldSelectorForValidationError(message: string) {
    const lower = message.toLowerCase();
    if (lower.includes("title")) return "#challenge-title";
    if (lower.includes("brand name")) return "#brand-name";
    if (lower.includes("specify category")) return "#challenge-category-other";
    if (lower.includes("category") || lower.includes("business domain")) return "#challenge-category";
    if (lower.includes("short summary") || lower.includes("business problem")) return "#challenge-summary";
    if (lower.includes("creative brief") || lower.includes("expected outcome")) return "#challenge-description";
    if (lower.includes("primary deliverable")) return "#challenge-description";
    if (lower.includes("usage-rights")) return "#usage-rights-acknowledgement";
    if (lower.includes("reference url")) return "#reference-links";
    if (lower.includes("prize") || lower.includes("amount")) return "input[inputmode='decimal']";
    if (lower.includes("submission date")) return "input[type='date']";
    if (lower.includes("review date")) return "input[type='date']";
    if (lower.includes("criterion")) return "#judging-criterion-input";
    if (lower.includes("creator acknowledgement")) return "#creator-acknowledgement";
    if (lower.includes("cancellation")) return "#cancellation-acknowledgement";
    return "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])";
  }

  function focusValidationError(message: string) {
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(fieldSelectorForValidationError(message));
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus();
    }, 0);
  }

  function requireLaunchReadinessBeforePin() {
    const readiness = draft ? launchReadinessForDraft(draft) : currentLaunchReadiness;
    setLaunchReadiness(readiness ?? null);
    if (readiness?.valid) return true;
    const first = readiness?.items.find((item) => item.status !== "ready");
    setStatus(first?.message ?? "Complete required Business Challenge details before launch.");
    setError({
      message: first?.message ?? "Complete required Business Challenge details before launch.",
      code: first?.id === "campaign-cover" ? "CAMPAIGN_COVER_REQUIRED" : "CAMPAIGN_LAUNCH_REQUIREMENTS_INCOMPLETE",
      scope: "PUBLISH",
      severity: "BLOCKING",
    });
    if (first) fixLaunchReadiness(first.id);
    return false;
  }

  useEffect(() => {
    if (!draft?.challenge.id || step !== "funding" || pending || error) return;
    const challengeId = funding?.challengeId ?? draft.funding.fundingChallengeId;
    const resumeKey = draft.challenge.id + ":" + fundingState + ":" + draft.deployment.publicationStatus + ":" + (challengeId ?? "none");
    if (pipelineResumeKeysRef.current.has(resumeKey)) return;
    if (fundingState === "APPROVED") {
      pipelineResumeKeysRef.current.add(resumeKey);
      queueMicrotask(() => {
        setStatus("Approval confirmed. Preparing prize pool funding...");
        void fund();
      });
      return;
    }
    if (fundingState === "FUNDING_PENDING" && challengeId) {
      pipelineResumeKeysRef.current.add(resumeKey);
      queueMicrotask(() => {
        void continueFastPublishPipeline("funding", challengeId);
      });
      return;
    }
    if (fundingState === "FUNDED_VERIFIED" && draft.deployment.publicationStatus !== "live") {
      pipelineResumeKeysRef.current.add(resumeKey);
      queueMicrotask(() => {
        const readiness = launchReadinessForDraft(draft);
        setLaunchReadiness(readiness);
        if (!readiness.valid) {
          setStep("publish");
          setStatus("Funding verified. Publish needs attention before the public challenge can go live.");
          setError({
            message: readiness.errors[0] ?? "Complete required Business Challenge details before publishing.",
            code: readiness.items.find((item) => item.status !== "ready")?.id === "campaign-cover"
              ? "CAMPAIGN_COVER_REQUIRED"
              : "CAMPAIGN_LAUNCH_REQUIREMENTS_INCOMPLETE",
            scope: "PUBLISH",
            severity: "NON_BLOCKING",
          });
          return;
        }
        setStatus("Funding verified. Publishing challenge...");
        void publish(draft.challenge.id, "auto");
      });
    }
    // The resume key makes these actions idempotent; unstable handler identities must not retrigger them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.challenge.id, draft?.deployment.publicationStatus, draft?.funding.fundingChallengeId, error, funding?.challengeId, fundingState, pending, step]);

  function showError(errorValue: unknown, scope?: PaymentErrorScope) {
    const safe =
      typeof errorValue === "object" && errorValue && "message" in errorValue
        ? (errorValue as SafeError)
        : { message: "Create Challenge request failed safely." };
    pipelineActionRef.current = null;
    setError({ ...safe, scope: safe.scope ?? scope });
    setStatus("Stopped on safe error.");
  }

  const applyPaymentOverview = useCallback((overview: PaymentOverviewResponse, currentDraft: CreateChallengeDraftState) => {
    if (overview.paymentAccount.accountStatus === "READY" && overview.balance.readAt) {
      lastBalanceSnapshotRef.current = {
        walletAddress: overview.paymentAccount.walletAddress,
        tokenAddress: ARC_TESTNET_USDC_TOKEN,
        chainId: overview.paymentAccount.chainId,
        balanceUnits: overview.balance.units,
        balanceDisplay: overview.balance.display,
        verifiedAt: overview.balance.readAt,
      };
      setBalanceNotice(null);
      setPaymentOverview(overview);
      setPaymentAccount(overview.paymentAccount);
      setPaymentAccountError(null);
      setStatus(paymentOverviewStatus(overview, currentDraft));
      setError(null);
      return;
    }

    const snapshot = lastBalanceSnapshotRef.current;
    if (overview.paymentState === "RECOVERABLE_ERROR" && isRecentBalanceSnapshot(snapshot)) {
      const stableOverview = overviewFromSnapshot(overview, snapshot);
      setBalanceNotice("Balance refresh is temporarily unavailable. Showing the latest verified balance.");
      setPaymentOverview(stableOverview);
      setPaymentAccount(stableOverview.paymentAccount);
      setPaymentAccountError(null);
      setStatus(paymentOverviewStatus(stableOverview, currentDraft));
      setError(null);
      return;
    }

    setBalanceNotice(null);
    setPaymentOverview(overview);
    setPaymentAccount(overview.paymentAccount);
    setPaymentAccountError(
      overview.paymentState === "RECOVERABLE_ERROR"
        ? { message: "Balance temporarily unavailable" }
        : null,
    );
    setStatus(paymentOverviewStatus(overview, currentDraft));
    if (overview.paymentState === "FATAL_ERROR") {
      setError({ message: overview.safeMessage || "Payment account verification failed." });
      return;
    }
    setError(null);
  }, []);

  function updateDraft(change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) {
    setDraft((current) => {
      if (!current) return current;
      setDirty(true);
      setValidation(null);
      const updated = change(current);
      setLaunchReadiness(launchReadinessForDraft(updated));
      return updated;
    });
  }

  const loadPaymentAccount = useCallback(async (triggerSource: CreateChallengeTraceSource = "explicit-click") => {
    if (!draft?.challenge.id) return null;
    balanceAbortRef.current?.abort();
    const sequenceId = balanceRequestRef.current + 1;
    balanceRequestRef.current = sequenceId;
    const requestId = createChallengeTraceId("payment-overview");
    const controller = new AbortController();
    balanceAbortRef.current = controller;
    logCreateChallengeTrace({
      requestId,
      route: "/api/create-challenge/payment-overview",
      functionName: "loadPaymentAccount",
      draftId: draft.challenge.id,
      currentStep: step,
      triggerSource,
      startedAt: new Date().toISOString(),
      attemptedErrorUpdate: false,
    });
    setPaymentAccountPending(true);
    setPaymentAccountError(null);
    try {
      const payload = await requestJson<{ paymentOverview: PaymentOverviewResponse }>(
        `/api/create-challenge/payment-overview?draftId=${encodeURIComponent(draft.challenge.id)}`,
        undefined,
        controller.signal,
        { requestId, triggerSource, draftId: draft.challenge.id, currentStep: step },
      );
      if (sequenceId !== balanceRequestRef.current) {
        logCreateChallengeTrace({ requestId, route: "/api/create-challenge/payment-overview", functionName: "loadPaymentAccount", draftId: draft.challenge.id, currentStep: step, triggerSource, accepted: false, stale: true, attemptedErrorUpdate: false });
        return paymentAccount;
      }
      logCreateChallengeTrace({ requestId, route: "/api/create-challenge/payment-overview", functionName: "loadPaymentAccount", draftId: draft.challenge.id, currentStep: step, triggerSource, accepted: true, stale: false, attemptedErrorUpdate: false });
      applyPaymentOverview(payload.paymentOverview, draft);
      return payload.paymentOverview.paymentAccount;
    } catch (requestError) {
      if (sequenceId !== balanceRequestRef.current || controller.signal.aborted) {
        logCreateChallengeTrace({ requestId, route: "/api/create-challenge/payment-overview", functionName: "loadPaymentAccount", draftId: draft.challenge.id, currentStep: step, triggerSource, accepted: false, stale: true, attemptedErrorUpdate: false });
        return paymentAccount;
      }
      const snapshot = lastBalanceSnapshotRef.current;
      if (isRecentBalanceSnapshot(snapshot) && paymentAccount) {
        logCreateChallengeTrace({ requestId, route: "/api/create-challenge/payment-overview", functionName: "loadPaymentAccount", draftId: draft.challenge.id, currentStep: step, triggerSource, accepted: false, stale: false, attemptedErrorUpdate: false, message: "kept fresh snapshot after failed refresh" });
        setBalanceNotice("Balance refresh is temporarily unavailable. Showing the latest verified balance.");
        setPaymentAccountError(null);
        setError(null);
        return paymentAccount;
      }
      const safe =
        typeof requestError === "object" && requestError && "message" in requestError
          ? (requestError as SafeError)
          : { message: "Balance temporarily unavailable" };
      logCreateChallengeTrace({ requestId, route: "/api/create-challenge/payment-overview", functionName: "loadPaymentAccount", draftId: draft.challenge.id, currentStep: step, triggerSource, accepted: true, stale: false, attemptedErrorUpdate: true });
      setPaymentAccountError({ message: safe.message || "Balance temporarily unavailable" });
      setBalanceNotice(null);
      return null;
    } finally {
      if (sequenceId === balanceRequestRef.current) {
        setPaymentAccountPending(false);
      }
    }
  }, [applyPaymentOverview, draft, paymentAccount, step]);

  useEffect(() => {
    const currentDraftId = draft?.challenge.id;
    if (!currentDraftId || step !== "prize-pool") return;
    if (paymentAccountPending || prizeBalanceReadDraftsRef.current.has(currentDraftId)) return;
    prizeBalanceReadDraftsRef.current.add(currentDraftId);
    void loadPaymentAccount("step-enter");
  }, [draft?.challenge.id, loadPaymentAccount, paymentAccountPending, step]);

  useEffect(() => {
    const currentDraftId = draft?.challenge.id;
    if (!currentDraftId || step !== "funding") return;
    if (paymentAccountPending || fundingBalanceReadDraftsRef.current.has(currentDraftId)) return;
    if (isRecentBalanceSnapshot(lastBalanceSnapshotRef.current)) return;
    fundingBalanceReadDraftsRef.current.add(currentDraftId);
    void loadPaymentAccount("step-enter");
  }, [draft?.challenge.id, loadPaymentAccount, paymentAccountPending, step]);

  async function saveDraft(targetStep = step) {
    if (!draft) return null;
    setPending(true);
    setError(null);
    const submittedDraft = {
      ...draft,
      deployment: { ...draft.deployment, currentStep: targetStep },
    };
    try {
      const payload = await requestJson<DraftResponse>("/api/create-challenge/draft", {
        draftId: draft.challenge.id ?? draftId,
        draft: submittedDraft,
        step: targetStep,
      });
      const preservedDraft = preserveEditableDraftState(payload.draft, submittedDraft, targetStep);
      setDraft(preservedDraft);
      setDraftId(payload.draft.challenge.id ?? "");
      setCampaignCover(payload.cover ?? null);
      setDeadlinePolicy(payload.deadlinePolicy ?? deadlinePolicy);
      setLaunchReadiness(payload.launchReadiness ?? launchReadinessForDraft(preservedDraft, payload.deadlinePolicy ?? deadlinePolicy));
      setStep(targetStep);
      setValidation(payload.validation ?? null);
      setDirty(false);
      setStatus(fundingActionStatus(preservedDraft));
      return { ...payload, draft: preservedDraft };
    } catch (requestError) {
      showError(requestError, "RECONCILE");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function continueStep() {
    if (step === "funding") {
      if (!draft || !fundingIsVerified(draft)) {
        setStatus("Complete funding before publishing this challenge.");
        setStep("funding");
        return;
      }
      setStep("publish");
      return;
    }

    const saved = await saveDraft(step);
    if (!saved) return;
    if (saved.validation && !saved.validation.valid) {
      focusValidationError(saved.validation.errors[0] ?? "");
    }
    if (!saved?.validation || saved.validation.valid) {
      const targetStep = nextStep(step);
      if (targetStep === "publish" && !fundingIsVerified(saved.draft)) {
        setStep("funding");
        setStatus("Complete funding before publishing this challenge.");
        return;
      }
      setStep(targetStep);
      const steppedDraft = {
        ...saved.draft,
        deployment: { ...saved.draft.deployment, currentStep: targetStep },
      };
      setDraft(steppedDraft);
      setLaunchReadiness(launchReadinessForDraft(steppedDraft));
    }
  }

  function navigateToStep(targetStep: CreateChallengeStepId) {
    if (targetStep === "publish" && draft && !fundingIsVerified(draft)) {
      setStep("funding");
      setStatus("Complete funding before publishing this challenge.");
      return;
    }
    setStep(targetStep);
    updateDraft((current) => ({
      ...current,
      deployment: { ...current.deployment, currentStep: targetStep },
    }));
  }

  async function ensureSession() {
    if (session) return session;
    const appSession = await requestJson<SpikeAppSession>("/api/create-challenge/session", {});
    setSession(appSession);
    return appSession;
  }

  async function runPreflight() {
    setPending(true);
    setError(null);
    try {
      const saved = await saveDraft("funding");
      const activeDraft = saved?.draft ?? draft;
      if (!activeDraft) return;
      const appSession = await ensureSession();
      const payload = await requestJson<{ preflight: PreflightResponse }>(
        "/api/create-challenge/preflight",
        { ...scopedBody({ userToken: appSession.userToken }), draftId: activeDraft.challenge.id },
      );
      setPreflight(payload.preflight);
      if (payload.preflight.paymentOverview) {
        applyPaymentOverview(payload.preflight.paymentOverview, activeDraft);
      } else {
        setPaymentAccount(paymentAccountFromPreflight(payload.preflight, activeDraft));
        setPaymentAccountError(null);
        setError(null);
      }
      const refreshed = await requestJson<DraftResponse>(draftUrl(activeDraft.challenge.id));
      setDraft(refreshed.draft);
      setCampaignCover(refreshed.cover ?? null);
      setDeadlinePolicy(refreshed.deadlinePolicy ?? deadlinePolicy);
      setLaunchReadiness(refreshed.launchReadiness ?? launchReadinessForDraft(refreshed.draft, refreshed.deadlinePolicy ?? deadlinePolicy));
      if (!payload.preflight.paymentOverview) {
        setStatus(
          payload.preflight.ready
            ? fundingActionStatus(refreshed.draft)
            : "Payment account check found blockers.",
        );
      }
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function executeCircleChallenge(challengeId: string, stage: EscrowTransactionStage) {
    const appSession = await ensureSession();
    if (!sdkRef.current) throw { message: "Payment confirmation SDK is not ready." };
    sdkRef.current.setAuthentication({
      userToken: appSession.userToken,
      encryptionKey: appSession.encryptionKey,
    });
    setStatus(`${stage === "approval" ? "Payment" : "Prize pool"} confirmation opened.`);
    sdkRef.current.execute(challengeId, (challengeError) => {
      if (challengeError) {
        setError({
          message: challengeError.message ?? "Payment confirmation failed.",
          code: challengeError.code,
        });
        return;
      }
      setStatus("Confirmation completed. Continuing launch pipeline...");
      void continueFastPublishPipeline(stage, challengeId);
    });
  }

  async function initializePaymentWallet() {
    setPending(true);
    setError(null);
    setPaymentAccountError(null);
    setBalanceNotice(null);
    try {
      const appSession = await ensureSession();
      const payload = await requestJson<PaymentWalletInitializeResponse>(
        "/api/create-challenge/payment-wallet/initialize",
        { userToken: appSession.userToken },
      );
      if (payload.initialized.alreadyMapped) {
        setStatus("Payment wallet is already ready.");
        await loadPaymentAccount("retry");
        return;
      }
      if (!payload.initialized.challengeId) throw { message: "Payment wallet setup was not returned." };
      if (!sdkRef.current) throw { message: "Payment wallet setup window is not ready." };
      sdkRef.current.setAuthentication({
        userToken: appSession.userToken,
        encryptionKey: appSession.encryptionKey,
      });
      setStatus("Payment wallet setup opened.");
      sdkRef.current.execute(payload.initialized.challengeId, (challengeError) => {
        if (challengeError) {
          setError({
            message: challengeError.message ?? "Payment wallet setup failed.",
            code: challengeError.code,
            scope: "WALLET_SETUP",
            severity: "BLOCKING",
          });
          return;
        }
        setStatus("Payment wallet setup completed. Resolving payment account...");
        void loadPaymentAccount("retry");
      });
    } catch (requestError) {
      showError(requestError, "WALLET_SETUP");
    } finally {
      setPending(false);
    }
  }

  async function approve() {
    const startedAt = performance.now();
    if (!requireLaunchReadinessBeforePin()) return;
    setPending(true);
    setError(null);
    try {
      if (!isRecentBalanceSnapshot(lastBalanceSnapshotRef.current)) {
        const freshAccount = await loadPaymentAccount("approval-precheck");
        if (!freshAccount || freshAccount.accountStatus !== "READY") {
          setBalanceNotice("Balance refresh is temporarily unavailable. Showing the latest verified balance.");
          setStatus("Refresh balance before confirming payment.");
          return;
        }
      }
      const appSession = await ensureSession();
      const payload = await requestJson<{ approval: { alreadyApproved?: boolean; alreadyPending?: boolean; challengeId?: string } }>(
        "/api/create-challenge/approve",
        scopedBody({ userToken: appSession.userToken }),
      );
      if (payload.approval.alreadyApproved) {
        setStatus("Exact approval already confirmed.");
        await runPreflight();
        return;
      }
      if (payload.approval.alreadyPending) {
        setStatus("Continuing the existing payment approval.");
      }
      if (!payload.approval.challengeId) throw { message: "Payment confirmation was not returned." };
      recordPipelineTiming("approval_challenge_creation", startedAt, { draftId: draft?.challenge.id });
      await executeCircleChallenge(payload.approval.challengeId, "approval");
    } catch (requestError) {
      showError(requestError, "APPROVAL");
    } finally {
      setPending(false);
    }
  }

  async function fund() {
    const startedAt = performance.now();
    if (!requireLaunchReadinessBeforePin()) return;
    setPending(true);
    setError(null);
    try {
      const appSession = await ensureSession();
      const payload = await requestJson<{ funding: { challengeId?: string } } & PaymentStateResponse>(
        "/api/create-challenge/fund",
        scopedBody({ userToken: appSession.userToken }),
      );
      if (payload.paymentOverview && draft) {
        applyPaymentOverview(payload.paymentOverview, draft);
      }
      if (!payload.funding.challengeId) throw { message: "Prize pool confirmation was not returned." };
      recordPipelineTiming("funding_challenge_creation", startedAt, { draftId: draft?.challenge.id });
      await executeCircleChallenge(payload.funding.challengeId, "funding");
    } catch (requestError) {
      showError(requestError, "FUNDING");
    } finally {
      setPending(false);
    }
  }

  async function reconcile(stage: EscrowTransactionStage, challengeId?: string) {
    setPending(true);
    setError(null);
    try {
      const appSession = await ensureSession();
      const targetChallengeId =
        challengeId ??
        (stage === "approval" ? approval?.challengeId : funding?.challengeId);
      if (!targetChallengeId) throw { message: "No existing confirmation challenge to reconcile." };
      const activeDraftId = draft?.challenge.id ?? draftId;
      const payload = await requestJson<{ result: EscrowTransactionSnapshot } & PaymentStateResponse>(
        "/api/create-challenge/reconcile",
        scopedBody({ userToken: appSession.userToken, stage, challengeId: targetChallengeId, draftId: activeDraftId }),
      );
      if (stage === "approval") setApproval(payload.result);
      if (stage === "funding") setFunding(payload.result);
      const refreshed = await requestJson<DraftResponse>(draftUrl(activeDraftId));
      setDraft(refreshed.draft);
      setCampaignCover(refreshed.cover ?? null);
      setDeadlinePolicy(refreshed.deadlinePolicy ?? deadlinePolicy);
      setLaunchReadiness(refreshed.launchReadiness ?? launchReadinessForDraft(refreshed.draft, refreshed.deadlinePolicy ?? deadlinePolicy));
      if (payload.paymentOverview) {
        applyPaymentOverview(payload.paymentOverview, refreshed.draft);
      }
      if (payload.result.state === "RESTORED_FROM_CHAIN") {
        setStatus("We couldn't find the previous payment request. We checked the on-chain status and safely restored this step.");
        return { payload, draft: refreshed.draft };
      }
      setStatus(fundingActionStatus(refreshed.draft));
      return { payload, draft: refreshed.draft };
    } catch (requestError) {
      showError(requestError, "RECONCILE");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function continueFastPublishPipeline(stage: EscrowTransactionStage, challengeId: string) {
    const pipelineKey = stage + ":" + challengeId;
    if (pipelineActionRef.current === pipelineKey) return;
    pipelineActionRef.current = pipelineKey;
    const startedAt = performance.now();
    try {
      for (let attempt = 0; attempt <= PIPELINE_POLL_DELAYS_MS.length; attempt += 1) {
        const result = await reconcile(stage, challengeId);
        if (!result) return;
        const overviewState = result.payload.paymentOverview?.paymentState;
        const refreshedDraft = result.draft;
        if (stage === "approval" && (overviewState === "APPROVED" || refreshedDraft?.funding.fundingStatus === "approved")) {
          recordPipelineTiming("pin_callback_to_approval_confirmation", startedAt, { attempts: attempt + 1, draftId: refreshedDraft?.challenge.id });
          setStatus("Approval confirmed. Opening prize pool funding confirmation...");
          await fund();
          return;
        }
        if (stage === "funding" && refreshedDraft?.funding.transactionHash) {
          recordPipelineTiming("pin_callback_to_tx_hash", startedAt, { attempts: attempt + 1, draftId: refreshedDraft.challenge.id });
        }
        if (stage === "funding" && refreshedDraft && fundingIsVerified(refreshedDraft)) {
          recordPipelineTiming("tx_hash_to_verified_funding", startedAt, { attempts: attempt + 1, draftId: refreshedDraft.challenge.id });
          const readiness = launchReadinessForDraft(refreshedDraft);
          setLaunchReadiness(readiness);
          if (!readiness.valid) {
            setStep("publish");
            setStatus("Funding verified. Publish needs attention before the public challenge can go live.");
            setError({
              message: readiness.errors[0] ?? "Complete required Business Challenge details before publishing.",
              code: readiness.items.find((item) => item.status !== "ready")?.id === "campaign-cover"
                ? "CAMPAIGN_COVER_REQUIRED"
                : "CAMPAIGN_LAUNCH_REQUIREMENTS_INCOMPLETE",
              scope: "PUBLISH",
              severity: "NON_BLOCKING",
            });
            return;
          }
          setStatus("Funding verified. Publishing challenge...");
          await publish(refreshedDraft.challenge.id, "auto");
          return;
        }
        const delay = PIPELINE_POLL_DELAYS_MS[attempt];
        if (delay === undefined) break;
        setStatus(stage === "approval" ? "Confirming approval automatically..." : "Recovering funding transaction automatically...");
        await sleep(delay);
      }
      setStatus(stage === "approval"
        ? "Approval is still processing. You can safely refresh or retry status recovery."
        : "Funding is still processing. You can safely refresh or retry status recovery.");
    } catch (requestError) {
      showError(requestError, stage === "approval" ? "APPROVAL" : "FUNDING");
    } finally {
      if (pipelineActionRef.current === pipelineKey) pipelineActionRef.current = null;
    }
  }

  async function recoverApproval() {
    setPending(true);
    setError(null);
    try {
      const appSession = await ensureSession();
      const payload = await requestJson<{ recovery: ApprovalRecoveryResponse } & PaymentStateResponse>(
        "/api/create-challenge/approval-recovery",
        scopedBody({ userToken: appSession.userToken }),
      );
      const canonical = payload.recovery.canonicalAttempt;
      if (canonical?.circleChallengeId) {
        setApproval({
          stage: "approval",
          challengeId: canonical.circleChallengeId,
          transactionId: canonical.circleTransactionId,
          transactionHash: canonical.transactionHash as `0x${string}` | undefined,
          state: payload.recovery.restoredState,
        });
      }
      const refreshed = await requestJson<DraftResponse>(draftUrl(draft?.challenge.id));
      setDraft(refreshed.draft);
      setCampaignCover(refreshed.cover ?? null);
      setDeadlinePolicy(refreshed.deadlinePolicy ?? deadlinePolicy);
      setLaunchReadiness(refreshed.launchReadiness ?? launchReadinessForDraft(refreshed.draft, refreshed.deadlinePolicy ?? deadlinePolicy));
      if (payload.paymentOverview) {
        applyPaymentOverview(payload.paymentOverview, refreshed.draft);
      }
      setStatus(
        payload.recovery.restoredState === "APPROVED"
          ? "Approval confirmed."
          : payload.recovery.restoredState === "APPROVAL_PENDING"
            ? "Your approval is still processing."
            : payload.recovery.restoredState === "START_AGAIN"
              ? "Previous approval attempts expired or failed."
              : "Payment approval is ready.",
      );
    } catch (requestError) {
      showError(requestError, "RECONCILE");
    } finally {
      setPending(false);
    }
  }

  async function publish(targetDraftId = draft?.challenge.id ?? draftId, trigger: "manual" | "auto" = "manual") {
    const startedAt = performance.now();
    tracePublishClick("publish-entered", {
      draftId: targetDraftId,
      trigger,
      publicationStatus: draft?.deployment.publicationStatus,
      fundingStatus: draft?.funding.fundingStatus,
      pending,
    });
    setPending(true);
    setError(null);
    try {
      const appSession = await ensureSession();
      tracePublishClick("request-start", {
        draftId: targetDraftId,
        endpoint: "/api/create-challenge/publish",
      });
      const payload = await requestJson<{ publication: { published: boolean; links: Record<string, string | null> } }>(
        "/api/create-challenge/publish",
        scopedBody({ userToken: appSession.userToken, draftId: targetDraftId }),
      );
      tracePublishClick("response-received", {
        draftId: targetDraftId,
        published: payload.publication.published,
      });
      if (payload.publication.published !== true) {
        throw {
          message: "Prize pool verification is not complete yet.",
          code: "PRIZE_POOL_NOT_VERIFIED",
          scope: "PUBLISH",
        };
      }
      setPublication(payload.publication);
      const refreshed = await requestJson<DraftResponse>(draftUrl(targetDraftId));
      setDraft(refreshed.draft);
      setCampaignCover(refreshed.cover ?? null);
      setDeadlinePolicy(refreshed.deadlinePolicy ?? deadlinePolicy);
      setLaunchReadiness(refreshed.launchReadiness ?? launchReadinessForDraft(refreshed.draft, refreshed.deadlinePolicy ?? deadlinePolicy));
      recordPipelineTiming("funding_verified_to_live", startedAt, { draftId: targetDraftId, trigger });
      setStatus("Challenge Published. The prize pool is secured and submissions are open.");
    } catch (requestError) {
      tracePublishClick("catch", {
        draftId: targetDraftId,
        message: requestError && typeof requestError === "object" && "message" in requestError
          ? String((requestError as SafeError).message)
          : "Publish request failed.",
      });
      showError(requestError, "PUBLISH");
    } finally {
      tracePublishClick("finally", {
        draftId: targetDraftId,
      });
      setPending(false);
    }
  }

  async function verifyFunding() {
    setPending(true);
    setError(null);
    try {
      const appSession = await ensureSession();
      const payload = await requestJson<{ verification: FundingVerificationResponse }>(
        "/api/create-challenge/verify",
        scopedBody({ userToken: appSession.userToken }),
      );
      setPublication({
        published: false,
        links: payload.verification.links,
      });
      const refreshed = await requestJson<DraftResponse>(draftUrl(draft?.challenge.id));
      setDraft(refreshed.draft);
      setCampaignCover(refreshed.cover ?? null);
      setDeadlinePolicy(refreshed.deadlinePolicy ?? deadlinePolicy);
      setLaunchReadiness(refreshed.launchReadiness ?? launchReadinessForDraft(refreshed.draft, refreshed.deadlinePolicy ?? deadlinePolicy));
      setStatus(
        payload.verification.verified
          ? "Prize pool secured"
          : "Prize pool verification is not complete yet.",
      );
      return refreshed.draft;
    } catch (requestError) {
      showError(requestError, "RECONCILE");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function continueToPublishAfterVerification() {
    const verifiedDraft = await verifyFunding();
    if (!verifiedDraft || !fundingIsVerified(verifiedDraft)) {
      setStatus("This challenge has not been funded yet.");
      setStep("funding");
      return;
    }
    setStep("publish");
    const publishDraft: CreateChallengeDraftState = {
      ...verifiedDraft,
      deployment: { ...verifiedDraft.deployment, currentStep: "publish" },
    };
    setDraft(publishDraft);
    setLaunchReadiness(launchReadinessForDraft(publishDraft));
  }

  async function startNewTestDraft() {
    if (dirty && !window.confirm("You already have a draft in progress.\n\nStart New Business Challenge")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = await requestJson<DraftResponse>("/api/create-challenge/draft?new=1");
      setDraft(payload.draft);
      setDraftId(payload.draft.challenge.id ?? "");
      setCampaignCover(payload.cover ?? null);
      setDeadlinePolicy(payload.deadlinePolicy ?? deadlinePolicy);
      setLaunchReadiness(payload.launchReadiness ?? launchReadinessForDraft(payload.draft, payload.deadlinePolicy ?? deadlinePolicy));
      setStep("basics");
      setPreflight(null);
      setPaymentAccount(null);
      setPaymentOverview(null);
      setPaymentAccountError(null);
      setBalanceNotice(null);
      lastBalanceSnapshotRef.current = null;
      prizeBalanceReadDraftsRef.current.clear();
      fundingBalanceReadDraftsRef.current.clear();
      setApproval(null);
      setFunding(null);
      setPublication(null);
      setValidation(null);
      setDirty(false);
      setStatus("Draft in progress");
      if (payload.draft.challenge.id) {
        window.history.replaceState(
          null,
          "",
          `/create-challenge?draftId=${encodeURIComponent(payload.draft.challenge.id)}`,
        );
      }
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  if (!draft) {
    return (
      <main className="min-h-screen bg-[#030a1f] px-4 py-5 text-white">
        <div className="mx-auto max-w-5xl rounded-md border border-white/10 bg-white/[0.03] p-2.5">
          <p className="text-[12px] text-slate-300">{statusHeader}</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Start a Business Challenge</h1>
          <p className="mt-1.5 text-[12px] font-black text-cyan-100">Discover the World&apos;s Best Ideas.</p>
          <p className="mt-0.5 text-[12px] text-slate-200">Turn business problems into winning solutions.</p>
          <p className="mt-1.5 text-base font-semibold text-white">What business problem are you trying to solve?</p>
          <p className="mt-1 max-w-2xl text-[12px] leading-4 text-slate-300">Launch a business challenge, receive solutions from a global network of AI-augmented creators, and reward the best outcome.</p>
          <p className="mt-1 max-w-2xl text-[12px] leading-4 text-slate-300">Describe the outcome you need - not just the asset you expect.</p>
          <p className="mt-1 text-[11px] text-cyan-100">Example: &quot;We opened our first coffee shop, but customer traffic is below expectations.&quot;</p>
          <button type="button" onClick={startNewTestDraft} disabled={pending || draftInitializationPending} className="mt-2.5 rounded-md bg-emerald-400 px-3 py-1.5 text-[12px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
            Start a Business Challenge
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030a1f] text-white">
      <header className="border-b border-white/10 bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:px-5 lg:px-6">
          <Link href="/dashboard" className="rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200">
            <CCNLogo size="md" priority />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-200">
              {statusHeader}
            </span>
            <button
              type="button"
              onClick={() => void startNewTestDraft()}
              disabled={pending || draftInitializationPending}
              className="rounded-md border border-cyan-200/40 px-3 py-1.5 text-[12px] font-bold text-cyan-100 disabled:opacity-50"
            >
              New Business Challenge
            </button>
            <Link
              href="/dashboard"
              className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] font-bold text-slate-200 transition hover:bg-white/10"
            >
              Exit to Dashboard
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-2.5 px-3 py-3 sm:px-4 lg:grid-cols-[240px_1fr] lg:px-5">
        <aside className="h-fit rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-200">
            Start a Business Challenge
          </p>
          <div className="mt-2 space-y-1">
            {createChallengeSteps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToStep(item.id)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
                  step === item.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] font-bold">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[12px] font-bold">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-3 text-slate-400">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 shadow-lg shadow-slate-950/30">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-200">
                Brand flow
              </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight">
                {step === "basics" ? "Start a Business Challenge" : createChallengeSteps.find((item) => item.id === step)?.label}
              </h1>
              {step === "basics" ? (
                <div className="mt-1 max-w-3xl text-[12px] leading-4 text-slate-300">
                  <p className="text-[13px] font-semibold text-white">What business problem are you trying to solve?</p>
                  <p className="mt-1">Launch a business challenge, receive solutions from a global network of AI-augmented creators, and reward the best outcome.</p>
                  <p className="mt-1">Describe the outcome you need - not just the asset you expect.</p>
                  <p className="mt-1 text-cyan-100">Example: &quot;We opened our first coffee shop, but customer traffic is below expectations.&quot;</p>
                </div>
              ) : null}
            </div>
            <p className="text-[10px] font-bold text-slate-400">Draft ID: {mask(draft.challenge.id)}</p>
          </div>

          <div className="mt-2 rounded-md border border-white/10 bg-slate-950/60 p-2 text-[11px] text-slate-200">
            Status: {statusHeader}
          </div>

          {validation?.errors.length ? (
            <div className="mt-2 rounded-md border border-amber-300/30 bg-amber-400/10 p-2.5 text-[12px] text-amber-100">
              <p className="font-bold">Please fix before continuing</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {validation.errors.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => focusValidationError(item)}
                      className="text-left underline decoration-amber-100/40 underline-offset-4"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {blockingError ? (
            <div className="mt-2 rounded-md border border-red-300/30 bg-red-400/10 p-2.5 text-[12px] text-red-100">
              <p className="font-bold">Safe error</p>
              <p className="mt-1">{blockingError.message}</p>
              {blockingError.status || blockingError.code || blockingError.endpoint ? (
                <details className="mt-2 rounded-md border border-red-200/20 bg-slate-950/50 p-2 text-[11px] text-red-100">
                  <summary className="cursor-pointer font-bold">Technical details</summary>
                  {blockingError.status ? <p className="mt-2">HTTP Status: {blockingError.status}</p> : null}
                  {blockingError.code ? <p>Payment provider error. Technical code: {blockingError.code}</p> : null}
                  {blockingError.endpoint ? <p>Endpoint: {blockingError.endpoint}</p> : null}
                </details>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2.5">
            {step === "basics" ? (
              <BasicsStep
                draft={draft}
                cover={campaignCover}
                updateDraft={updateDraft}
                onCoverChange={setCampaignCover}
              />
            ) : null}
            {step === "prize-pool" ? (
              <PrizeStep
                draft={draft}
                updateDraft={updateDraft}
                paymentAccount={paymentAccount}
                paymentAccountPending={paymentAccountPending}
                paymentAccountError={paymentAccountError}
                balanceNotice={balanceNotice}
                onRetryPaymentAccount={() => loadPaymentAccount("retry")}
                onInitializePaymentWallet={initializePaymentWallet}
              />
            ) : null}
            {step === "review-rules" ? <RulesStep draft={draft} deadlinePolicy={deadlinePolicy} updateDraft={updateDraft} /> : null}
            {step === "funding" ? (
              <FundingStep
                draft={draft}
                launchReadiness={currentLaunchReadiness}
                preflight={preflight}
                paymentOverview={paymentOverview}
                paymentAccount={paymentAccount}
                paymentAccountPending={paymentAccountPending}
                paymentAccountError={paymentAccountError}
                paymentError={error}
                balanceNotice={balanceNotice}
                circleUserId={session?.circleUserId ?? ""}
                funding={funding}
                steps={fundingSteps}
                paymentState={fundingState}
                pending={pending}
                onPreflight={runPreflight}
                onInitializePaymentWallet={initializePaymentWallet}
                onApprove={approve}
                onRecoverApproval={recoverApproval}
                onFund={fund}
                onVerify={verifyFunding}
                onReconcile={reconcile}
                onContinueToPublish={continueToPublishAfterVerification}
                onFixLaunchReadiness={fixLaunchReadiness}
              />
            ) : null}
            {step === "publish" ? (
              <PublishStep
                draft={draft}
                deadlinePolicy={deadlinePolicy}
                launchReadiness={currentLaunchReadiness}
                publication={publication}
                onBack={() => setStep("funding")}
                onPublish={publish}
                onFixLaunchReadiness={fixLaunchReadiness}
                pending={pending}
              />
            ) : null}
          </div>

          {step !== "publish" ? (
          <div className="mt-2.5 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-2.5">
            <button
              type="button"
              onClick={() => setStep(previousStep(step))}
              disabled={
                step === "basics" ||
                pending ||
                draft.funding.fundingStatus === "approval-pending" ||
                draft.funding.fundingStatus === "funding-pending"
              }
              className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={
                  pending ||
                  !draftReadyForActions ||
                  draft.funding.fundingStatus === "approval-pending" ||
                  draft.funding.fundingStatus === "funding-pending" ||
                  fundingIsVerified(draft)
                }
                className="rounded-md border border-cyan-200/40 px-3 py-1.5 text-[12px] font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Draft
              </button>
              {step !== "funding" ? (
                <button
                  type="button"
                  onClick={() => void continueStep()}
                  disabled={pending || !draftReadyForActions || prizeStepHasMismatch || prizeStepHasInsufficientBalance}
                  className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              ) : null}
            </div>
          </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function TextInput({ id, label, value, onChange, placeholder, required = false, optional = false, readOnly = false }: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <FormLabel required={required} optional={optional} readOnly={readOnly}>{label}</FormLabel>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required ? "true" : undefined}
        readOnly={readOnly}
        className="mt-1 h-8 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none transition focus:border-cyan-200 read-only:cursor-not-allowed read-only:text-slate-300"
      />
    </label>
  );
}

function DecimalInput({ label, value, onChange, readOnly = false, required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <FormLabel required={required} readOnly={readOnly}>{label}</FormLabel>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-required={required ? "true" : undefined}
        className="mt-1 h-8 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none transition focus:border-cyan-200 read-only:cursor-not-allowed read-only:text-slate-300"
      />
    </label>
  );
}

function TextArea({ id, label, value, onChange, rows = 2, maxLength, placeholder, required = false, optional = false }: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <FormLabel required={required} optional={optional}>{label}</FormLabel>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        aria-required={required ? "true" : undefined}
        className="mt-1 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-[12px] leading-4 text-white outline-none transition focus:border-cyan-200"
      />
    </label>
  );
}

const COVER_ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const COVER_MAX_BYTES = 5 * 1024 * 1024;

function CampaignCoverField({
  draft,
  cover,
  updateDraft,
  onCoverChange,
}: {
  draft: CreateChallengeDraftState;
  cover: CampaignCoverView | null;
  updateDraft: (change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) => void;
  onCoverChange: (cover: CampaignCoverView | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draftInitializationPending = !draft.challenge.id;
  const hasCover = Boolean(draft.challenge.coverImageKey?.trim());
  const displayCoverUrl = previewUrl ?? cover?.imageUrl ?? null;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function validateFile(file: File) {
    if (!COVER_ACCEPTED_TYPES.has(file.type)) return "Use a JPG, PNG or WebP image.";
    if (file.size > COVER_MAX_BYTES) return "Business challenge cover must be 5 MB or smaller.";
    if (file.size <= 0) return "Choose a non-empty image.";
    return null;
  }

  async function upload(file: File) {
    const validationError = validateFile(file);
    setSelectedFileName(file.name);
    setMessage(null);
    setError(validationError);
    if (validationError) return;
    const nextPreview = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(nextPreview);
    setPending(true);
    try {
      if (!draft.challenge.id) {
        throw new Error("Save the draft before uploading a business challenge cover.");
      }
      const form = new FormData();
      form.set("draftId", draft.challenge.id);
      form.set("file", file);
      form.set("alt", `${draft.challenge.title || "Business challenge"} cover image`);
      const response = await fetch("/api/create-challenge/media/cover", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<CampaignCoverResponse> & { error?: { message?: string } };
      if (!response.ok || !payload.draft || !payload.cover?.imageKey) {
        throw new Error(payload.error?.message ?? "Business challenge cover upload failed safely.");
      }
      if (payload.draft.challenge.coverImageKey !== payload.cover.imageKey) {
        throw new Error("Business challenge cover persistence could not be verified.");
      }
      updateDraft(() => payload.draft as CreateChallengeDraftState);
      onCoverChange(payload.cover);
      setMessage("Business challenge cover saved.");
      setError(null);
    } catch (errorValue) {
      setError(
        errorValue instanceof Error
          ? `${errorValue.message} Your preview and filename are preserved; re-select the file if the browser requires it.`
          : "Business challenge cover upload failed safely. Your preview and filename are preserved; re-select the file if the browser requires it.",
      );
    } finally {
      setPending(false);
    }
  }

  async function removeCover() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      if (!draft.challenge.id) {
        throw new Error("Save the draft before removing a business challenge cover.");
      }
      const response = await fetch(`/api/create-challenge/media/cover?draftId=${encodeURIComponent(draft.challenge.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<DraftResponse> & { error?: { message?: string } };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error?.message ?? "Business challenge cover removal failed safely.");
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setSelectedFileName(null);
      updateDraft(() => payload.draft as CreateChallengeDraftState);
      onCoverChange(null);
      setMessage("Business challenge cover removed.");
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Business challenge cover removal failed safely.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="campaign-cover-field" className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <FormLabel>Business Challenge Cover</FormLabel>
            <span className="text-[10px] font-semibold text-slate-400">Optional while drafting - Required before publish</span>
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
            JPG, PNG or WebP. Optional while drafting, required before publish.
          </p>
        </div>
        {hasCover ? (
          <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
            Saved
          </span>
        ) : (
          <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">
            Required before publish
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending || draftInitializationPending}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className="mt-2 flex min-h-20 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-cyan-200/30 bg-slate-950/45 text-center text-[12px] font-bold text-cyan-100 transition hover:border-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {displayCoverUrl ? (
          <img src={displayCoverUrl} alt="Business challenge cover preview" className="h-full max-h-28 w-full object-cover" />
        ) : (
          <span>{pending ? "Uploading cover..." : hasCover ? "Replace business challenge cover" : "Drop image here or choose cover"}</span>
        )}
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending || draftInitializationPending}
          className="rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {hasCover ? "Replace cover" : "Choose cover"}
        </button>
        {hasCover ? (
          <button
            type="button"
            onClick={() => void removeCover()}
            disabled={pending || draftInitializationPending}
            className="rounded-md border border-rose-300/30 px-3 py-2 text-xs font-bold text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </div>
      {selectedFileName ? (
        <p className="mt-3 text-xs font-semibold text-slate-300">
          Selected file: <span className="text-white">{selectedFileName}</span>
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm font-bold text-emerald-100">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-bold text-rose-100">{error}</p> : null}
    </section>
  );
}

function categoryExamples(category: string) {
  const examples: Record<string, { title: string; summary: string; outcome: string }> = {
    "Brand Awareness": {
      title: "Increase brand recognition in a new market",
      summary: "Target customers do not recognize our brand when comparing alternatives.",
      outcome: "Increase unaided brand recall among Gen Z customers by 25%.",
    },
    "Customer Growth": {
      title: "Increase weekday customer traffic",
      summary: "Weekday traffic is below target after our first location launch.",
      outcome: "Increase weekday customer traffic by 40%.",
    },
    "Customer Retention": {
      title: "Reduce subscriber churn after month one",
      summary: "New customers are not returning after their first purchase cycle.",
      outcome: "Improve second-month retention by 20%.",
    },
    "Retail Experience": {
      title: "Improve in-store product discovery",
      summary: "Shoppers cannot quickly find the right product for their needs.",
      outcome: "Increase assisted product discovery conversions by 30%.",
    },
    "Go-to-Market": {
      title: "Clarify launch positioning for a new offer",
      summary: "Prospects do not understand why the new offer is different.",
      outcome: "Improve launch-page conversion by 15%.",
    },
    "Product Launch": {
      title: "Drive adoption for a new product feature",
      summary: "Customers are not activating a feature that solves an important workflow problem.",
      outcome: "Increase first-week feature activation by 35%.",
    },
    "Market Expansion": {
      title: "Enter a new regional market",
      summary: "Our current message is not resonating with customers in the target region.",
      outcome: "Generate qualified demand in the new region within 60 days.",
    },
    "Community Growth": {
      title: "Grow a high-value customer community",
      summary: "Customers are not participating in community programs after signup.",
      outcome: "Increase active community participation by 30%.",
    },
    "Customer Experience": {
      title: "Reduce support friction for new customers",
      summary: "New customers need too much help before reaching value.",
      outcome: "Reduce onboarding-related support tickets by 25%.",
    },
    Operations: {
      title: "Improve service handoff reliability",
      summary: "Operational handoffs are creating delays and inconsistent customer follow-up.",
      outcome: "Reduce handoff-related delays by 30%.",
    },
  };
  return examples[category] ?? {
    title: "Customer Traffic Growth Challenge",
    summary: "A measurable business problem is preventing the team from reaching its growth target.",
    outcome: "Increase weekday customer traffic by 40%.",
  };
}

function BasicsStep({ draft, cover, updateDraft, onCoverChange }: {
  draft: CreateChallengeDraftState;
  cover: CampaignCoverView | null;
  updateDraft: (change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) => void;
  onCoverChange: (cover: CampaignCoverView | null) => void;
}) {
  const selectedBusinessDomain = selectedBusinessDomainOption(draft.challenge.category);
  const customBusinessDomain = customBusinessDomainValue(draft.challenge.category);
  const examples = categoryExamples(draft.challenge.category);
  return (
    <div className="grid gap-2.5">
      <TextInput id="challenge-title" label="Business challenge title" required value={draft.challenge.title} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, title: value } }))} placeholder={examples.title} />
      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-[12px]">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Public URL</p>
        <p className="mt-1 break-all font-mono text-slate-200">
          ccn.io/challenges/{draft.challenge.slug || "reserved-after-title"}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">Reserved automatically. Business challenge titles do not need to be unique.</p>
      </div>
      <label className="block">
        <FormLabel required>Challenge Category</FormLabel>
        <select
          id="challenge-category"
          value={selectedBusinessDomain}
          onChange={(event) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, category: event.target.value } }))}
          required
          aria-required="true"
          className="mt-1 h-8 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none focus:border-cyan-200"
        >
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
      </label>
      {selectedBusinessDomain === OTHER_BUSINESS_DOMAIN_OPTION ? (
        <TextInput
          id="challenge-category-other"
          label="Specify category"
          required
          value={customBusinessDomain}
          onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, category: businessDomainFromCustomValue(value) } }))}
          placeholder={CUSTOM_BUSINESS_DOMAIN_PLACEHOLDER}
        />
      ) : null}
      <TextArea id="challenge-summary" label="Business problem summary" required value={draft.challenge.summary} maxLength={240} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, summary: value } }))} placeholder={examples.summary} />
      <TextInput id="challenge-description" label="Expected Outcome" required value={draft.challenge.description} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, description: value } }))} placeholder={examples.outcome} />
      <p className="-mt-1.5 text-[10px] leading-4 text-slate-400">
        Describe the business result you want to achieve.
      </p>
      <CampaignCoverField draft={draft} cover={cover} updateDraft={updateDraft} onCoverChange={onCoverChange} />
      <TextInput id="brand-name" label="Brand" required value={draft.challenge.brandName} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, brandName: value } }))} placeholder="Auto-filled from Company Settings" />
      <details className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
        <summary className="cursor-pointer text-[12px] font-bold text-slate-200">Advanced Details</summary>
        <div className="mt-2 grid gap-2.5">
          <TextInput id="supporting-deliverables" label="Supporting assets" optional value={draft.challenge.supportingDeliverables.join(", ")} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, supportingDeliverables: value.split(",").map((item) => item.trim()).filter(Boolean) } }))} placeholder="research findings, customer interviews, market analysis, operational notes, reference materials" />
          <TextInput id="reference-links" label="Reference links" optional value={draft.challenge.referenceLinks.join(", ")} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, referenceLinks: value.split(",").map((item) => item.trim()).filter(Boolean) } }))} placeholder="https://example.com/inspiration" />
        </div>
      </details>
      <label className="flex gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-[12px] text-slate-200">
        <input
          id="usage-rights-acknowledgement"
          type="checkbox"
          checked={draft.challenge.usageRightsAcknowledged}
          onChange={(event) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, usageRightsAcknowledged: event.target.checked } }))}
          className="mt-1"
        />
        <span>I understand that only the selected solution receives the reward and transfers the predefined usage rights.</span>
      </label>
    </div>
  );
}

function PrizeStep({ draft, updateDraft, paymentAccount, paymentAccountPending, paymentAccountError, balanceNotice, onRetryPaymentAccount, onInitializePaymentWallet }: {
  draft: CreateChallengeDraftState;
  updateDraft: (change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) => void;
  paymentAccount: PaymentAccountSnapshot | null;
  paymentAccountPending: boolean;
  paymentAccountError: SafeError | null;
  balanceNotice: string | null;
  onRetryPaymentAccount: () => Promise<PaymentAccountSnapshot | null>;
  onInitializePaymentWallet: () => void;
}) {
  const math = calculatePrizePool({
    totalAmount: draft.prizePool.totalAmount,
    winnerCount: draft.prizePool.winnerCount,
    distributionMode: draft.prizePool.distributionMode,
    prizeDistribution: draft.prizePool.prizeDistribution,
  });
  const mode = draft.prizePool.distributionMode;
  const allocated = formatUsdcUnits(math.allocatedUnits);
  const remaining = formatUsdcUnits(math.remainingUnits);
  const hasInsufficientBalance =
    paymentAccount?.accountStatus === "READY" &&
    BigInt(paymentAccount.balanceUnits) < BigInt(math.totalRequiredUnits);

  function updatePrizePool(change: Parameters<typeof normalizePrizePool>[0]) {
    updateDraft((current) => ({
      ...current,
      prizePool: normalizePrizePool(change),
    }));
  }

  function updateTotal(value: string) {
    const totalAmount = Number(value.replace(",", "."));
    updatePrizePool({
      ...draft.prizePool,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    });
  }

  function updateWinnerCount(winnerCount: 1 | 3) {
    updatePrizePool({
      ...draft.prizePool,
      winnerCount,
      distributionMode: winnerCount === 1 ? "recommended" : "recommended",
    });
  }

  function updateDistributionMode(distributionMode: PrizeDistributionMode) {
    updatePrizePool({
      ...draft.prizePool,
      distributionMode,
    });
  }

  function updateDistribution(index: number, amount: number) {
    updateDraft((current) => {
      const next = [...current.prizePool.prizeDistribution];
      next[index] = { ...next[index], amount };
      return {
        ...current,
        prizePool: normalizePrizePool({
          ...current.prizePool,
          distributionMode: "custom",
          prizeDistribution: next,
        }),
      };
    });
  }

  function updateDistributionText(index: number, value: string) {
    const amount = Number(value.replace(",", "."));
    updateDistribution(index, Number.isFinite(amount) ? amount : 0);
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2 md:grid-cols-2">
        {([1, 3] as const).map((winnerCount) => (
          <button
            key={winnerCount}
            type="button"
            onClick={() => updateWinnerCount(winnerCount)}
            className={`rounded-md border p-2 text-left transition ${draft.prizePool.winnerCount === winnerCount ? "border-cyan-200 bg-cyan-200/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
          >
            <span className="text-[13px] font-bold">Top {winnerCount}</span>
            <span className="mt-0.5 block text-[11px] text-slate-300">
              {winnerCount === 1 ? "One winner receives the full prize pool." : "Three winners share the prize pool."}
            </span>
          </button>
        ))}
      </div>
      <DecimalInput
        label="Total prize pool in test USDC"
        required
        value={String(draft.prizePool.totalAmount)}
        onChange={updateTotal}
      />
      <PaymentWalletCard
        account={paymentAccount}
        pending={paymentAccountPending}
        unavailable={Boolean(paymentAccountError)}
        onInitialize={onInitializePaymentWallet}
      />

      {draft.prizePool.winnerCount === 3 ? (
        <div>
          <p><FormLabel required>Distribution</FormLabel></p>
          <div className="mt-1.5 grid gap-2 md:grid-cols-3">
            {([
              ["recommended", "Recommended 60 / 30 / 10"],
              ["equal", "Equal split"],
              ["custom", "Custom amounts"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => updateDistributionMode(value)}
                className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] font-bold transition ${
                  mode === value
                    ? "border-cyan-200 bg-cyan-200/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "custom" ? (
            <p className="mt-1 text-[11px] text-cyan-100">
              You can now edit each reward amount.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2">
        {draft.prizePool.winnerCount === 1 ? (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
            <p className="text-[12px] font-bold text-white">
              Winner receives: {formatUsdcUnits(math.distributionUnits[0] ?? "0")} test USDC
            </p>
          </div>
        ) : (
          draft.prizePool.prizeDistribution.map((prize, index) => (
            <label key={prize.place} className="grid gap-1.5 rounded-md border border-white/10 bg-white/[0.03] p-2 sm:grid-cols-[1fr_132px] sm:items-center">
              <FormLabel required readOnly={mode !== "custom"} className="text-white">{prize.place} place</FormLabel>
              <input
                type="text"
                inputMode="decimal"
                value={String(prize.amount)}
                readOnly={mode !== "custom"}
                onChange={(event) => updateDistributionText(index, event.target.value)}
                required
                aria-required="true"
                className="h-8 rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none focus:border-cyan-200 read-only:cursor-not-allowed read-only:text-slate-300"
              />
            </label>
          ))
        )}
      </div>
      <div className="grid gap-1.5 md:grid-cols-4">
        <Info label="Allocated" value={`${allocated} test USDC`} readOnly />
        <Info label="Remaining" value={`${remaining} test USDC`} readOnly />
        <Info label="Platform fee" value={`${formatUsdcUnits(math.platformFeeUnits)} test USDC`} readOnly />
        <Info label="Total required" value={`${formatUsdcUnits(math.totalRequiredUnits)} test USDC`} readOnly />
      </div>
      {balanceNotice ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300/30 bg-amber-400/10 p-2 text-[12px] text-amber-100">
          <span>{balanceNotice}</span>
          <button
            type="button"
            onClick={() => void onRetryPaymentAccount()}
            disabled={paymentAccountPending}
            className="rounded-md border border-amber-100/40 px-3 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh Balance
          </button>
        </div>
      ) : null}
      {!balanceNotice && (paymentAccount?.accountStatus === "BALANCE_UNAVAILABLE" || paymentAccountError) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300/30 bg-amber-400/10 p-2 text-[12px] text-amber-100">
          <span>Balance temporarily unavailable</span>
          <button
            type="button"
            onClick={() => void onRetryPaymentAccount()}
            disabled={paymentAccountPending}
            className="rounded-md border border-amber-100/40 px-3 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh Balance
          </button>
        </div>
      ) : null}
      {hasInsufficientBalance ? (
        <div className="rounded-md border border-rose-300/30 bg-rose-400/10 p-2 text-[12px] text-rose-100">
          <p className="font-bold">Insufficient test USDC</p>
          <p className="mt-1">
            Required: {formatUsdcUnits(math.totalRequiredUnits)} test USDC. Available: {paymentAccount.balanceDisplay}.
          </p>
        </div>
      ) : null}
      {math.errors.length ? (
        <div className="rounded-md border border-amber-300/30 bg-amber-400/10 p-2 text-[12px] text-amber-100">
          <p className="font-bold">Prize pool needs attention</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {math.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const allowedFormatOptions = ["MP4", "MOV", "PDF", "PNG", "JPG", "URL"];

function datePart(value: string) {
  return localDateInputPart(value);
}

function timePart(value: string) {
  return localTimeInputPart(value);
}

function combineLocalDateTime(date: string, time: string) {
  return localInputToCanonicalIso(date, time);
}

function DateTimePicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
      <legend className="px-1">
        <FormLabel required>{label}</FormLabel>
      </legend>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <FormLabel required className="text-xs uppercase tracking-wide text-slate-400">Date</FormLabel>
          <input
            type="date"
            value={datePart(value)}
            onChange={(event) => onChange(combineLocalDateTime(event.target.value, timePart(value)))}
            onInput={(event) => onChange(combineLocalDateTime(event.currentTarget.value, timePart(value)))}
            onClick={(event) => event.currentTarget.showPicker?.()}
            required
            aria-required="true"
            className="mt-1 h-8 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none focus:border-cyan-200"
          />
        </label>
        <label className="block">
          <FormLabel required className="text-xs uppercase tracking-wide text-slate-400">Time</FormLabel>
          <input
            type="time"
            value={timePart(value)}
            onChange={(event) => onChange(combineLocalDateTime(datePart(value), event.target.value))}
            onInput={(event) => onChange(combineLocalDateTime(datePart(value), event.currentTarget.value))}
            onClick={(event) => event.currentTarget.showPicker?.()}
            required
            aria-required="true"
            className="mt-1 h-8 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none focus:border-cyan-200"
          />
        </label>
      </div>
    </fieldset>
  );
}

function RulesStep({ draft, deadlinePolicy, updateDraft }: {
  draft: CreateChallengeDraftState;
  deadlinePolicy: CreateChallengeDeadlinePolicy | null;
  updateDraft: (change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) => void;
}) {
  const [criterion, setCriterion] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const criteria = draft.reviewRules.judgingCriteria.filter(Boolean);
  const minSubmissionLeadMinutes = deadlinePolicy?.minimumSubmissionLeadMinutes ?? 15;
  const minReviewGapMinutes = deadlinePolicy?.minimumReviewGapMinutes ?? 15;
  const smokeScheduleEnabled = deadlinePolicy?.mode === "smoke";

  function addCriterion() {
    const next = criterion.trim();
    if (!next || criteria.length >= 8) return;
    updateDraft((current) => ({
      ...current,
      reviewRules: {
        ...current.reviewRules,
        judgingCriteria: [...criteria, next],
      },
    }));
    setCriterion("");
  }

  function removeCriterion(index: number) {
    updateDraft((current) => ({
      ...current,
      reviewRules: {
        ...current.reviewRules,
        judgingCriteria: criteria.filter((_, itemIndex) => itemIndex !== index),
      },
    }));
  }

  function toggleFormat(format: string) {
    updateDraft((current) => {
      const hasFormat = current.reviewRules.allowedFormats.includes(format);
      return {
        ...current,
        reviewRules: {
          ...current.reviewRules,
          allowedFormats: hasFormat
            ? current.reviewRules.allowedFormats.filter((item) => item !== format)
            : [...current.reviewRules.allowedFormats, format],
        },
      };
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-2 text-[12px] text-emerald-50">
        Blind review is required for MVP. Brands see anonymous entries during review.
      </div>
            {smokeScheduleEnabled ? (
        <div className="rounded-md border border-cyan-200/30 bg-cyan-300/10 p-2 text-[12px] text-cyan-50">
          <p className="font-bold">Smoke schedule active</p>
          <p className="mt-1 text-cyan-100">
            Smoke schedule active - Submission lead: {minSubmissionLeadMinutes} minutes - Review gap: {minReviewGapMinutes} minutes
          </p>
          <div className="mt-1.5 grid gap-1.5 font-mono text-[10px] text-cyan-100 sm:grid-cols-2">
            <span>Submission UTC: {draft.reviewRules.submissionDeadline ? new Date(draft.reviewRules.submissionDeadline).toISOString() : "Not set"}</span>
            <span>Review UTC: {draft.reviewRules.reviewDeadline ? new Date(draft.reviewRules.reviewDeadline).toISOString() : "Not set"}</span>
          </div>
        </div>
      ) : null}<div className="grid gap-2.5 md:grid-cols-2">
        <DateTimePicker label="Submission" value={draft.reviewRules.submissionDeadline} onChange={(value) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, submissionDeadline: value } }))} />
        <DateTimePicker label="Review" value={draft.reviewRules.reviewDeadline} onChange={(value) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, reviewDeadline: value } }))} />
      </div>
      <p className="text-[12px] text-slate-300">Local timezone: {timezone}</p>

      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
        <p>
          <FormLabel required>Judging criteria</FormLabel>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {criteria.map((item, index) => (
            <button
              key={`${item}-${index}`}
              type="button"
              onClick={() => removeCriterion(index)}
              className="rounded-full border border-cyan-200/30 bg-cyan-200/10 px-2 py-0.5 text-[11px] font-bold text-cyan-50"
            >
              {item} x
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id="judging-criterion-input"
            value={criterion}
            onChange={(event) => setCriterion(event.target.value)}
            maxLength={60}
            placeholder="Creative fit"
            aria-required="true"
            className="h-8 min-w-56 flex-1 rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none focus:border-cyan-200"
          />
          <button
            type="button"
            onClick={addCriterion}
            className="rounded-md border border-cyan-200/40 px-2.5 py-1.5 text-[12px] font-bold text-cyan-100"
          >
            Add criterion
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">At least one criterion is required. Maximum 8.</p>
      </div>

      <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
        <p>
          <FormLabel required>Allowed submission types</FormLabel>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allowedFormatOptions.map((format) => (
            <label key={format} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[12px] font-bold text-slate-200">
              <input
                type="checkbox"
                checked={draft.reviewRules.allowedFormats.includes(format)}
                onChange={() => toggleFormat(format)}
              />
              {format}
            </label>
          ))}
        </div>
      </div>
      <TextArea label="Usage rights summary" required value={draft.reviewRules.usageRights} onChange={(value) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, usageRights: value } }))} />
      <label className="flex gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-[12px] text-slate-200">
        <input id="creator-acknowledgement" type="checkbox" checked={draft.reviewRules.creatorAcknowledgement} onChange={(event) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, creatorAcknowledgement: event.target.checked } }))} />
        <span>Creators must acknowledge that submitted work is complete and ready for review.</span>
      </label>
      <label className="flex gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-[12px] text-slate-200">
        <input id="cancellation-acknowledgement" type="checkbox" checked={draft.reviewRules.cancellationAcknowledgement} onChange={(event) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, cancellationAcknowledgement: event.target.checked } }))} />
        <span>I understand that once submissions exist, the Brand cannot unilaterally cancel and refund.</span>
      </label>
    </div>
  );
}

function readinessTone(status: "ready" | "missing" | "needs_correction") {
  if (status === "ready") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "missing") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return "border-rose-300/30 bg-rose-400/10 text-rose-100";
}

function readinessLabel(status: "ready" | "missing" | "needs_correction") {
  if (status === "ready") return "Ready";
  if (status === "missing") return "Missing";
  return "Needs correction";
}

function LaunchReadinessSummary({
  readiness,
  draft,
  paymentState,
  paymentAccount,
  includePayment,
  onFixItem,
}: {
  readiness: CreateChallengeLaunchReadiness | null;
  draft?: CreateChallengeDraftState | null;
  paymentState?: PaymentState;
  paymentAccount?: PaymentAccountSnapshot | null;
  includePayment?: boolean;
  onFixItem: (itemId?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const baseItems = readiness?.items ?? [];
  const paymentAccountReady = Boolean(paymentAccount?.accountStatus === "READY" || draft?.funding.walletAddress);
  const balanceReady = Boolean(
    paymentState === "READY_FOR_APPROVAL" ||
      paymentState === "APPROVED" ||
      paymentState === "FUNDING_PENDING" ||
      paymentState === "RECONCILING" ||
      paymentState === "FUNDED_VERIFIED" ||
      paymentState === "PUBLISHED" ||
      draft?.funding.fundingStatus === "approved" ||
      draft?.funding.fundingStatus === "funding-pending" ||
      draft?.funding.fundingStatus === "funded" ||
      draft?.funding.fundingStatus === "live" ||
      (draft && fundingIsVerified(draft))
  );
  const paymentItems = includePayment
    ? [
        {
          id: "payment-account",
          label: "Payment account",
          step: "funding" as const,
          status: paymentAccountReady ? "ready" as const : "missing" as const,
          message: paymentAccountReady ? "Ready" : "Check your payment account before launch.",
        },
        {
          id: "balance",
          label: "Balance",
          step: "funding" as const,
          status: balanceReady ? "ready" as const : "needs_correction" as const,
          message: balanceReady ? "Ready" : "Verify available test USDC before launch.",
        },
      ]
    : [];
  const items = [...baseItems, ...paymentItems];
  const ready = items.length > 0 && items.every((item) => item.status === "ready");
  const open = !ready || expanded;
  const panelId = "launch-readiness-details";

  return (
    <section className="rounded-md border border-white/10 bg-slate-950/60 p-3 text-[13px] text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">Launch readiness</p>
          <p className="mt-1 text-sm text-slate-300">
            {ready ? "All requirements ready" : "Fix required fields before the first PIN."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
            className="rounded-md border border-white/15 px-3 py-2 text-xs font-bold text-slate-100"
          >
            {open ? "Hide details" : "View details"}
          </button>
          {!ready ? (
          <button
            type="button"
            onClick={() => onFixItem()}
            className="rounded-md border border-amber-100/40 px-3 py-2 text-xs font-bold text-amber-100"
          >
            Fix required fields
          </button>
          ) : null}
        </div>
      </div>
      <div id={panelId} hidden={!open} className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => item.status === "ready" ? undefined : onFixItem(item.id)}
            className={`rounded-md border p-3 text-left ${readinessTone(item.status)} ${item.status === "ready" ? "cursor-default" : "transition hover:bg-white/10"}`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-bold">{item.label}</span>
              <span className="text-xs font-bold">{readinessLabel(item.status)}</span>
            </span>
            <span className="mt-2 block text-xs leading-5 opacity-90">{item.message}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReviewBeforeLaunchSummary({ draft, totalRequired, brandPaymentWallet }: {
  draft: CreateChallengeDraftState;
  totalRequired: string;
  brandPaymentWallet?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = "review-before-launch-details";

  return (
    <section className="rounded-md border border-white/10 bg-slate-950/60 p-2.5 text-[12px] text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-200">Review before launch</p>
          <p className="mt-0.5 text-[12px] text-slate-300">Business challenge, prize, dates, cover and wallet</p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
          className="rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-slate-100"
        >
          {expanded ? "Hide summary" : "View summary"}
        </button>
      </div>
      <div id={panelId} hidden={!expanded} className="mt-2 grid gap-1.5 md:grid-cols-2">
        <Info label="Campaign" value={draft.challenge.title || "Untitled challenge"} />
        <Info label="Brand" value={draft.challenge.brandName || "Not set"} />
        <Info label="Prize pool" value={draft.prizePool.totalAmount.toLocaleString() + " test USDC"} />
        <Info label="Platform fee" value={draft.prizePool.platformFee.toLocaleString() + " test USDC"} />
        <Info label="Total required" value={totalRequired} />
        <Info label="Cover" value={draft.challenge.coverImageKey ? "Ready" : "Required before publish"} />
        <Info label="Wallet" value={brandPaymentWallet ? mask(brandPaymentWallet) : "Payment wallet pending"} />
        <Info label="Submission deadline" value={draft.reviewRules.submissionDeadline || "Not set"} />
        <Info label="Review deadline" value={draft.reviewRules.reviewDeadline || "Not set"} />
      </div>
    </section>
  );
}

function PaymentProgressPanel({ steps, prominent = false }: { steps: PaymentProgressItem[]; prominent?: boolean }) {
  const activeProgressStep = steps.find((item) => item.status === "active" || item.status === "warning") ?? steps.at(0);
  const live = activeProgressStep?.label === "Challenge live";
  const showWaitingNotice = Boolean(prominent && activeProgressStep && activeProgressStep.status !== "pending" && !live);

  return (
    <aside className={`h-fit rounded-xl border border-white/10 bg-white/[0.03] p-2.5 ${prominent ? "border-cyan-200/30 bg-cyan-300/[0.07]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={prominent ? "text-base font-bold text-white" : "text-[12px] font-bold text-white"}>
            {prominent ? "Launch in progress" : "Launch progress"}
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-300">
            {prominent
              ? "Please keep this page open while we complete the launch. Approval, funding and Arc verification may take a few minutes."
              : "Approval, funding, verification and publish."}
          </p>
          {prominent ? (
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              You can safely refresh this page. We will resume from the latest verified step.
            </p>
          ) : null}
        </div>
        {activeProgressStep?.status === "active" ? (
          <span className="mt-1 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-200/30 border-t-cyan-200 motion-reduce:animate-none" aria-label="Processing" />
        ) : null}
      </div>
      {activeProgressStep ? (
        <div className={`mt-2 rounded-md border p-2 ${activeProgressStep.status === "warning" ? "border-amber-300/30 bg-amber-400/10" : activeProgressStep.status === "done" ? "border-emerald-300/25 bg-emerald-300/10" : "border-cyan-300/25 bg-cyan-300/10"}`}>
          <p className={prominent ? "text-[13px] font-bold text-white" : "text-[12px] font-bold text-white"}>{activeProgressStep.label}</p>
          {activeProgressStep.technology ? (
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">{activeProgressStep.technology}</p>
          ) : null}
          {activeProgressStep.description ? (
            <p className="mt-1 text-[11px] leading-4 text-slate-200">{activeProgressStep.description}</p>
          ) : null}
          {showWaitingNotice ? (
            <p className="mt-2 rounded-md border border-white/10 bg-slate-950/60 p-2 text-[10px] leading-4 text-slate-300">
              Please wait - your transaction is still processing. Do not refresh repeatedly, submit another transaction, or close the wallet approval before completion.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 space-y-1.5">
        {steps.map((item) => {
          const statusLabel = item.status === "done" ? "Completed" : item.status === "active" ? "Current" : item.status === "warning" ? "Needs attention" : "Upcoming";
          return (
            <div key={`${item.label}-${item.status}`} className="flex items-start gap-2 text-[12px] transition-colors">
              <span
                className={
                  item.status === "done"
                    ? "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-[10px] font-bold text-slate-950"
                    : item.status === "active"
                      ? "mt-1 h-4 w-4 shrink-0 animate-pulse rounded-full border-2 border-cyan-200 bg-cyan-300/40 motion-reduce:animate-none"
                      : item.status === "warning"
                        ? "mt-1 h-4 w-4 shrink-0 rounded-full bg-amber-300"
                        : "mt-1 h-4 w-4 shrink-0 rounded-full bg-white/20"
                }
                aria-hidden="true"
              >
                {item.status === "done" ? <>&#10003;</> : null}
              </span>
              <span>
                <span className={item.status === "pending" ? "block text-slate-400" : "block font-bold text-white"}>{item.label}</span>
                <span className="mt-0.5 block text-[10px] font-bold text-slate-500">{statusLabel}</span>
                {item.status === "active" || item.status === "warning" ? (
                  <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">{item.description}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

type BrandFundingStage =
  | "approval"
  | "funding"
  | "confirmation"
  | "publish"
  | "live"
  | "failed";

type BrandFundingTone = "neutral" | "processing" | "warning" | "success" | "danger";

type BrandFundingPresentation = {
  stage: BrandFundingStage;
  headline: string;
  message: string;
  guidance: string;
  tone: BrandFundingTone;
  currentAction: string;
  autoExpandTechnicalDetails: boolean;
};

function deriveBrandFundingPresentation(
  state: PaymentState,
  draft: CreateChallengeDraftState,
  error: SafeError | null,
  pending: boolean,
): BrandFundingPresentation {
  if (draft.deployment.publicationStatus === "live" || state === "PUBLISHED") {
    return {
      stage: "live",
      headline: "Challenge is live",
      message: "The prize pool is secured and creators can now submit.",
      guidance: "You can view the public challenge or return to the dashboard.",
      tone: "success",
      currentAction: "View Challenge",
      autoExpandTechnicalDetails: false,
    };
  }
  if (state === "FATAL_ERROR" || state === "INSUFFICIENT_BALANCE") {
    return {
      stage: "failed",
      headline: "Funding failed",
      message: error?.message ?? "We could not confirm the payment account for this launch.",
      guidance: "Your challenge has not been published. Resolve the issue and retry only the failed step.",
      tone: "danger",
      currentAction: state === "INSUFFICIENT_BALANCE" ? "Check Again" : "Try Again",
      autoExpandTechnicalDetails: true,
    };
  }
  if (state === "RECOVERABLE_ERROR") {
    return {
      stage: "failed",
      headline: "Action required",
      message: error?.message ?? "We need to refresh the current payment state before continuing.",
      guidance: "Completed steps are preserved. Use the next action below to recover safely.",
      tone: "warning",
      currentAction: "Try Again",
      autoExpandTechnicalDetails: true,
    };
  }
  if (state === "FUNDED_VERIFIED") {
    return {
      stage: "publish",
      headline: pending ? "Publishing your challenge" : "Funding complete",
      message: pending
        ? "Your prize pool is secured. We are publishing the challenge for creators."
        : "Your prize pool is secured in escrow and ready to publish.",
      guidance: "Please keep this page open while the final publish step completes.",
      tone: "success",
      currentAction: pending ? "Publishing challenge" : "Continue to Publish",
      autoExpandTechnicalDetails: false,
    };
  }
  if (state === "RECONCILING") {
    return {
      stage: "confirmation",
      headline: "Confirming on Arc",
      message: "Your prize pool transaction was detected and is being verified on Arc.",
      guidance: "This usually takes 30-90 seconds. We will resume from the latest verified step if you refresh.",
      tone: "processing",
      currentAction: "Waiting for confirmation",
      autoExpandTechnicalDetails: false,
    };
  }
  if (state === "FUNDING_PENDING") {
    return {
      stage: "funding",
      headline: "Funding in progress",
      message: "Your prize pool is being secured on Arc.",
      guidance: "This usually takes less than a minute. Please keep this page open while we confirm the transaction.",
      tone: "processing",
      currentAction: "Waiting for funding",
      autoExpandTechnicalDetails: false,
    };
  }
  if (state === "APPROVAL_PENDING") {
    return {
      stage: "approval",
      headline: "Approval required",
      message: "Approve the exact test USDC amount from your Brand payment wallet.",
      guidance: "After approval, CCN will continue with the prize funding step.",
      tone: "warning",
      currentAction: "Enter Approval PIN",
      autoExpandTechnicalDetails: false,
    };
  }
  if (state === "APPROVED") {
    return {
      stage: "funding",
      headline: "Funding in progress",
      message: "Your approval is confirmed. The next step secures the prize pool for this challenge.",
      guidance: "Continue with funding when you are ready.",
      tone: "processing",
      currentAction: "Enter Funding PIN",
      autoExpandTechnicalDetails: false,
    };
  }
  if (state === "BALANCE_LOADING" || state === "ACCOUNT_LOADING") {
    return {
      stage: "approval",
      headline: "Preparing your prize pool",
      message: "We are checking the Brand payment account before launch.",
      guidance: "This confirms the available test USDC balance before any approval is requested.",
      tone: "processing",
      currentAction: "Checking payment account",
      autoExpandTechnicalDetails: false,
    };
  }
  if (state === "READY_FOR_APPROVAL" || state === "BALANCE_READY" || state === "NOT_STARTED") {
    return {
      stage: "approval",
      headline: "Preparing your prize pool",
      message: "Confirm the Brand payment account and prize details before launch.",
      guidance: "No funds move until you approve the wallet action.",
      tone: "neutral",
      currentAction: state === "READY_FOR_APPROVAL" ? "Review and fund Prize Pool" : "Check wallet balance",
      autoExpandTechnicalDetails: false,
    };
  }
  return {
    stage: "approval",
    headline: "Preparing your prize pool",
    message: "Confirm the Brand payment account and prize details before launch.",
    guidance: "No funds move until you approve the wallet action.",
    tone: "neutral",
    currentAction: "Check wallet balance",
    autoExpandTechnicalDetails: false,
  };
}

function brandFundingStageIndex(stage: BrandFundingStage) {
  const stages: BrandFundingStage[] = ["approval", "funding", "confirmation", "publish", "live"];
  const index = stages.indexOf(stage);
  return index === -1 ? 0 : index;
}

function BrandFundingStatusCard({ presentation, state }: {
  presentation: BrandFundingPresentation;
  state: PaymentState;
}) {
  const toneClass =
    presentation.tone === "success"
      ? "border-emerald-300/30 bg-emerald-300/10"
      : presentation.tone === "danger"
        ? "border-rose-300/30 bg-rose-400/10"
        : presentation.tone === "warning"
          ? "border-amber-300/30 bg-amber-400/10"
          : presentation.tone === "processing"
            ? "border-cyan-300/30 bg-cyan-400/10"
            : "border-white/10 bg-white/[0.03]";
  return (
    <section className={`rounded-xl border p-2.5 ${toneClass}`} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-100">{presentation.currentAction}</p>
          <h2 className="mt-1 text-base font-bold text-white">{presentation.headline}</h2>
          <p className="mt-1 text-[11px] leading-4 text-slate-200">{presentation.message}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-300">{presentation.guidance}</p>
        </div>
        {presentation.tone === "processing" ? (
          <span className="mt-1 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-200/30 border-t-cyan-200 motion-reduce:animate-none" aria-label="Processing" />
        ) : (
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-0.5 text-[10px] font-bold text-slate-200">
            {paymentStateHeaderStatus(state)}
          </span>
        )}
      </div>
    </section>
  );
}

function BrandFundingPhaseSummary({ presentation }: {
  presentation: BrandFundingPresentation;
}) {
  const phases: Array<{ stage: BrandFundingStage; label: string }> = [
    { stage: "approval", label: "Approval" },
    { stage: "funding", label: "Funding" },
    { stage: "confirmation", label: "Confirmation" },
    { stage: "publish", label: "Publish" },
    { stage: "live", label: "Live" },
  ];
  const activeIndex = brandFundingStageIndex(presentation.stage);
  const blocked = presentation.stage === "failed";
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold text-white">Launch progress</p>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-400">A simplified view of approval, funding, verification and publish.</p>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{Math.min(activeIndex + 1, phases.length)} of {phases.length}</p>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
        {phases.map(({ stage, label }, index) => {
          const done = !blocked && index < activeIndex;
          const active = blocked ? index === 0 : index === activeIndex;
          return (
            <div
              key={stage}
              className={`rounded-md border p-2 text-[11px] ${
                done
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                  : active
                    ? blocked
                      ? "border-amber-300/30 bg-amber-400/10 text-amber-50"
                      : "border-cyan-300/30 bg-cyan-400/10 text-cyan-50"
                    : "border-white/10 bg-slate-950/40 text-slate-400"
              }`}
            >
              <span className="block text-[9px] font-bold uppercase tracking-wide">{done ? "Done" : active ? "Now" : "Next"}</span>
              <span className="mt-0.5 block font-bold">{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FundingStep({ draft, launchReadiness, preflight, paymentOverview, paymentAccount, paymentAccountPending, paymentAccountError, paymentError, balanceNotice, circleUserId, funding, steps, paymentState, pending, onPreflight, onInitializePaymentWallet, onApprove, onRecoverApproval, onFund, onVerify, onReconcile, onContinueToPublish, onFixLaunchReadiness }: {
  draft: CreateChallengeDraftState;
  launchReadiness: CreateChallengeLaunchReadiness | null;
  preflight: PreflightResponse | null;
  paymentOverview: PaymentOverviewResponse | null;
  paymentAccount: PaymentAccountSnapshot | null;
  paymentAccountPending: boolean;
  paymentAccountError: SafeError | null;
  paymentError: SafeError | null;
  balanceNotice: string | null;
  circleUserId: string;
  funding: EscrowTransactionSnapshot | null;
  steps: PaymentProgressItem[];
  paymentState: PaymentState;
  pending: boolean;
  onPreflight: () => void;
  onInitializePaymentWallet: () => void;
  onApprove: () => void;
  onRecoverApproval: () => void;
  onFund: () => void;
  onVerify: () => void;
  onReconcile: (stage: EscrowTransactionStage, challengeId?: string) => void;
  onContinueToPublish: () => void;
  onFixLaunchReadiness: (itemId?: string) => void;
}) {
  const approvalPending = draft.funding.fundingStatus === "approval-pending";
  const draftInitializationPending = !draft.challenge.id;
  const fundingPending = draft.funding.fundingStatus === "funding-pending";
  const verified = fundingIsVerified(draft);
  const hasPreflight = Boolean(preflight);
  const hasReadyPreflight = Boolean(preflight?.ready);
  const approved =
    (hasReadyPreflight && draft.funding.fundingStatus === "approved") ||
    Boolean(hasReadyPreflight && preflight && BigInt(preflight.allowance) >= BigInt(preflight.amounts.totalRequired));
  const funded = Boolean(draft.funding.transactionHash);
  const detectedPaymentNeedsVerification = draft.funding.fundingStatus === "funded" && !verified;
  const fundingTransactionExists = Boolean(funding?.challengeId || draft.funding.fundingChallengeId || draft.funding.transactionId || draft.funding.transactionHash);
  const launchReady = Boolean(launchReadiness?.valid);
  void detectedPaymentNeedsVerification;
  void fundingPending;
  void funded;
  void approvalPending;
  void approved;
  void hasPreflight;
  void hasReadyPreflight;
  const availableBalance = paymentAccountPending && !paymentAccount
    ? "Checking balance..."
    : paymentAccount?.accountStatus === "READY"
      ? paymentAccount.balanceDisplay
      : paymentAccount?.accountStatus === "BALANCE_UNAVAILABLE" || paymentAccountError
        ? "Balance unavailable"
        : "Checking balance...";
  const totalRequired = `${formatUsdcUnits(draft.prizePool.totalRequiredUnits)} test USDC`;
  const remainingBalance = paymentAccount?.accountStatus === "READY"
    ? `${formatUsdcUnits(
        BigInt(paymentAccount.balanceUnits) > BigInt(draft.prizePool.totalRequiredUnits)
          ? BigInt(paymentAccount.balanceUnits) - BigInt(draft.prizePool.totalRequiredUnits)
          : BigInt(0),
      )} test USDC`
    : "Checking balance...";
  const brandPaymentWallet = paymentAccount?.walletAddress ?? preflight?.balanceSource.address ?? draft.funding.walletAddress;
  const balanceTimestamp = paymentAccount?.balanceReadAt ?? preflight?.balanceSource.timestamp ?? draft.funding.lastBalanceRefreshAt;
  const balanceSource = paymentAccount?.walletAddress
    ? "Canonical Brand payment wallet"
    : preflight?.balanceSource.source ?? "Checking balance";
  const balanceNetwork = paymentAccount?.network ?? preflight?.balanceSource.network ?? "ARC-TESTNET";
  const balanceChainId = paymentAccount?.chainId ?? preflight?.balanceSource.chainId ?? 5_042_002;
  const runtimeEscrowAddress =
    paymentOverview?.diagnostics?.escrowContractAddress ??
    preflight?.paymentOverview?.diagnostics?.escrowContractAddress ??
    preflight?.escrow.address;
  const showDiagnostic = process.env.NODE_ENV !== "production";
  const hasBalanceProblem = paymentState === "RECOVERABLE_ERROR" || (paymentState === "BALANCE_LOADING" && Boolean(paymentAccount?.safeMessage || paymentAccountError));
  const missingBalance = paymentAccount?.accountStatus === "READY"
    ? BigInt(draft.prizePool.totalRequiredUnits) > BigInt(paymentAccount.balanceUnits)
      ? `${formatUsdcUnits(BigInt(draft.prizePool.totalRequiredUnits) - BigInt(paymentAccount.balanceUnits))} test USDC`
      : "0 test USDC"
    : "";
  const launchPipelineActive = Boolean(
    (pending && paymentState === "READY_FOR_APPROVAL") ||
      paymentState === "APPROVAL_PENDING" ||
      paymentState === "APPROVED" ||
      paymentState === "FUNDING_PENDING" ||
      paymentState === "RECONCILING" ||
      paymentState === "FUNDED_VERIFIED" ||
      paymentState === "PUBLISHED",
  );
  const brandPresentation = deriveBrandFundingPresentation(
    paymentState,
    draft,
    paymentError ?? paymentAccountError,
    pending,
  );

  return (
    <div className="max-w-[760px] space-y-2.5">
      <section className="space-y-2.5">
        <h2 className="text-base font-bold">Fund Prize Pool</h2>
        <BrandFundingStatusCard presentation={brandPresentation} state={paymentState} />
        <BrandFundingPhaseSummary presentation={brandPresentation} />
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <p className="text-[12px] font-bold text-white">Next action</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(paymentState === "NOT_STARTED" || paymentState === "ACCOUNT_LOADING") ? (
              <button type="button" onClick={onPreflight} disabled={pending || draftInitializationPending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50">Check wallet balance</button>
            ) : null}
            {paymentState === "BALANCE_LOADING" && !hasBalanceProblem ? (
              <button type="button" disabled className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-[12px] font-bold opacity-60">Checking payment account...</button>
            ) : null}
            {hasBalanceProblem ? (
              <button type="button" onClick={onPreflight} disabled={pending || draftInitializationPending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50">Try Again</button>
            ) : null}
            {paymentState === "INSUFFICIENT_BALANCE" ? (
              <button type="button" onClick={onPreflight} disabled={pending || draftInitializationPending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50">Check Again</button>
            ) : null}
            {paymentState === "READY_FOR_APPROVAL" ? (
              launchReady ? (
                <button type="button" onClick={onApprove} disabled={pending || draftInitializationPending} className="rounded-md bg-emerald-400 px-3 py-1.5 text-[12px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Review and fund Prize Pool {totalRequired}</button>
              ) : (
                <button type="button" onClick={() => onFixLaunchReadiness()} disabled={pending || draftInitializationPending} className="rounded-md border border-amber-100/40 px-3 py-1.5 text-[12px] font-bold text-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Fix required fields</button>
              )
            ) : null}
            {paymentState === "APPROVAL_PENDING" ? (
              <span className="rounded-md border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-[12px] font-bold text-amber-100">Waiting for payment approval</span>
            ) : null}
            {paymentState === "APPROVAL_PENDING" ? (
              <button type="button" onClick={onRecoverApproval} disabled={pending || draftInitializationPending} className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50">Check Approval Status</button>
            ) : null}
            {paymentState === "APPROVED" ? (
              <button type="button" onClick={onFund} disabled={pending || draftInitializationPending} className="rounded-md bg-cyan-300 px-3 py-1.5 text-[12px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Fund Prize Pool</button>
            ) : null}
            {paymentState === "FUNDING_PENDING" ? (
              <span className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-[12px] font-bold text-cyan-100">Securing prize pool on Arc</span>
            ) : null}
            {paymentState === "RECONCILING" ? (
              <button type="button" onClick={onVerify} disabled={pending || draftInitializationPending} className="rounded-md bg-emerald-300 px-3 py-1.5 text-[12px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Verify funding</button>
            ) : null}
            {paymentState === "FUNDED_VERIFIED" ? (
              <button type="button" onClick={onContinueToPublish} disabled={pending || draftInitializationPending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50">Continue to Publish</button>
            ) : null}
            {fundingTransactionExists && paymentState === "FUNDING_PENDING" ? (
              <button type="button" onClick={() => onReconcile("funding", funding?.challengeId ?? draft.funding.fundingChallengeId)} disabled={(!funding?.challengeId && !draft.funding.fundingChallengeId) || pending} className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50">Check prize pool status</button>
            ) : null}
          </div>
        </section>
        <details className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-[12px] text-slate-300">
          <summary className="cursor-pointer font-bold text-white">Funding details</summary>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <Info label="Prize pool" value={`${draft.prizePool.totalAmount.toLocaleString()} test USDC`} />
            <Info label="Platform fee" value={`${draft.prizePool.platformFee.toLocaleString()} test USDC`} />
            <Info label="Total required" value={totalRequired} />
            <Info label="Available balance" value={availableBalance} />
            <Info label="Estimated balance after funding" value={remainingBalance} />
            <Info label="Network fee handling" value="Paid separately in test USDC" />
            <Info label="Network" value="Arc Testnet" />
            <Info label="Payment account" value={paymentAccount?.accountStatus === "READY" ? "Ready" : paymentAccountPending ? "Checking" : "Needs attention"} />
            <Info label="Funding status" value={verified ? "Secured" : paymentStateHeaderStatus(paymentState)} />
            <Info label="Publish status" value={draft.deployment.publicationStatus === "live" ? "Live" : "Not live yet"} />
          </div>
        </details>
        {(paymentState === "NOT_STARTED" || paymentState === "ACCOUNT_LOADING") ? (
          <p className="text-[12px] leading-4 text-slate-300">
            Check your payment account to confirm the available test USDC balance.
          </p>
        ) : null}
        {paymentState === "BALANCE_LOADING" && !hasBalanceProblem ? (
          <p className="rounded-md border border-cyan-300/20 bg-cyan-400/10 p-2 text-[12px] font-bold text-cyan-50">
            Checking balance...
          </p>
        ) : null}
        {balanceNotice ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300/30 bg-amber-400/10 p-2 text-[12px] font-bold text-amber-100">
            <span>{balanceNotice}</span>
            <button type="button" onClick={onPreflight} disabled={pending || draftInitializationPending} className="rounded-md border border-amber-100/40 px-3 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">Refresh Balance</button>
          </div>
        ) : null}
        {!balanceNotice && hasBalanceProblem ? (
          <p className="rounded-md border border-rose-300/30 bg-rose-400/10 p-2 text-[12px] font-bold text-rose-100">
            Balance temporarily unavailable
          </p>
        ) : null}
        {paymentState === "INSUFFICIENT_BALANCE" ? (
          <div className="rounded-md border border-rose-300/30 bg-rose-400/10 p-2 text-[12px] text-rose-100">
            <p className="font-bold">Insufficient test USDC</p>
            <p className="mt-1">Required: {totalRequired}</p>
            <p>Available: {availableBalance}</p>
            <p>Missing: {missingBalance}</p>
          </div>
        ) : null}
        {paymentState === "READY_FOR_APPROVAL" ? (
          <div className="grid gap-1 text-[12px] font-bold text-emerald-100">
            <p>Payment account ready &#10003;</p>
            <p>Balance verified &#10003;</p>
          </div>
        ) : null}
        <LaunchReadinessSummary
          readiness={launchReadiness}
          draft={draft}
          paymentState={paymentState}
          paymentAccount={paymentAccount}
          includePayment
          onFixItem={onFixLaunchReadiness}
        />
        <ReviewBeforeLaunchSummary draft={draft} totalRequired={totalRequired} brandPaymentWallet={brandPaymentWallet} />
        <p className="rounded-md border border-cyan-300/20 bg-cyan-400/10 p-2 text-[12px] leading-4 text-cyan-50">
          Protected funds are locked for this challenge and can only be paid to selected winners or safely returned by the configured challenge rules.
        </p>
        <details
          open={brandPresentation.autoExpandTechnicalDetails || undefined}
          className="rounded-md border border-white/10 bg-slate-950/60 p-2.5 text-[12px] text-slate-300"
        >
          <summary className="cursor-pointer font-bold text-white">Technical details</summary>
          <div className="mt-2 space-y-2">
            <PaymentProgressPanel steps={steps} prominent={launchPipelineActive} />
            <PaymentWalletCard
              account={paymentAccount}
              pending={paymentAccountPending}
              unavailable={Boolean(paymentAccountError)}
              onInitialize={onInitializePaymentWallet}
            />
            <div className="grid gap-1.5">
            <p>Brand payment wallet: <span className="break-all font-mono text-white">{brandPaymentWallet || "Not checked"}</span></p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(brandPaymentWallet ?? "")}
              disabled={!brandPaymentWallet}
              className="w-fit rounded-md border border-cyan-200/30 px-3 py-1 text-xs font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy Address
            </button>
            <p>Wallet ID: {mask(preflight?.wallet.walletId ?? draft.funding.walletId)}</p>
            <p>Circle user: {mask(circleUserId)}</p>
            <p>Current balance source: {balanceSource}</p>
            <p>Balance timestamp: {balanceTimestamp || "Not checked"}</p>
            <p>Network: {balanceNetwork}</p>
            <p>Chain ID: {balanceChainId}</p>
            <p>USDC: 0x3600...0000</p>
            <p>Escrow: {runtimeEscrowAddress ? mask(runtimeEscrowAddress) : "Not checked"}</p>
            <p>Challenge ID: {mask(draft.deployment.challengeId)}</p>
            <p>Approval tx: {mask(draft.funding.approvalTransactionHash)}</p>
            <p>Funding tx: {mask(draft.funding.transactionHash)}</p>
            {paymentError ? (
              <p>Error: <span className="text-amber-100">{paymentError.message}</span></p>
            ) : null}
            </div>
          </div>
        </details>
        {showDiagnostic ? (
          <details className="rounded-md border border-amber-300/20 bg-amber-400/10 p-2.5 text-[12px] text-amber-50">
            <summary className="cursor-pointer font-bold">Technical funding details</summary>
            <div className="mt-2 grid gap-1.5">
              <p>Current draft: {mask(draft.challenge.id)}</p>
              <p>Current challenge: {mask(draft.challenge.challengeId ?? draft.deployment.challengeId)}</p>
              <p>Current funding intent: {mask(draft.funding.fundingIntentId)}</p>
              <p>Loaded funding-record scope: draft-local:{mask(draft.challenge.id)}:{mask(draft.challenge.challengeId ?? draft.deployment.challengeId)}:{mask(draft.funding.fundingIntentId)}</p>
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function PublishStep({ draft, deadlinePolicy, launchReadiness, publication, onBack, onPublish, onFixLaunchReadiness, pending }: {
  draft: CreateChallengeDraftState;
  deadlinePolicy: CreateChallengeDeadlinePolicy | null;
  launchReadiness: CreateChallengeLaunchReadiness | null;
  publication: { published: boolean; links: Record<string, string | null> } | null;
  onBack: () => void;
  onPublish: () => void;
  onFixLaunchReadiness: (itemId?: string) => void;
  pending: boolean;
}) {
  const live = draft.deployment.publicationStatus === "live";
  const hasCover = Boolean(draft.challenge.coverImageKey?.trim());
  const readiness = launchReadiness ?? validateCreateChallengeLaunchReadiness(draft, deadlinePolicy ? { deadlinePolicy } : undefined);
  const ready = fundingIsVerified(draft) && readiness.valid;
  const firstBlocker = readiness.items.find((item) => item.status !== "ready");
  const statusValue = live ? "LIVE" : ready ? "Ready to publish" : "Needs Business Challenge details";
  function handlePublishClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    tracePublishClick("button-click", {
      draftId: draft.challenge.id,
      publicationStatus: draft.deployment.publicationStatus,
      fundingStatus: draft.funding.fundingStatus,
      ready,
      pending,
      disabled: pending || !ready,
      onPublishType: typeof onPublish,
    });
    if (pending) return;
    if (!ready) {
      onFixLaunchReadiness(firstBlocker?.id);
      return;
    }
    onPublish();
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
        <h2 className="text-lg font-bold">
          {live ? "Challenge published successfully" : "Prize Pool Secured"}
        </h2>
        <p className="mt-1 text-[12px] leading-4 text-slate-300">
          {live
            ? "Your prize pool is secured and the challenge is now open for submissions."
            : ready
              ? "Funding verified. The prize pool is secured and you can publish this challenge now."
              : "Funding verified. Complete the required campaign details before publishing."}
        </p>
        <div className="mt-2 grid gap-1.5 md:grid-cols-2">
          <Info label="Challenge title" value={draft.challenge.title || "Untitled"} />
          <Info label="Status" value={statusValue} />
          <Info label="Prize pool" value={`${draft.prizePool.totalAmount.toLocaleString()} test USDC`} />
          <Info label="Winner model" value={`Top ${draft.prizePool.winnerCount}`} />
          <Info label="Submission deadline" value={draft.reviewRules.submissionDeadline || "Not set"} />
          <Info label="Prize Pool verified" value={fundingIsVerified(draft) ? "Yes" : "Pending"} />
          <Info label="Business Challenge Cover" value={hasCover ? "Ready" : "Required before publish"} />
        </div>
      </section>
      {!live ? (
        <LaunchReadinessSummary
          readiness={readiness}
          draft={draft}
          onFixItem={onFixLaunchReadiness}
        />
      ) : null}
      <div className="flex flex-wrap gap-3">
        {!live ? (
          <>
            <button type="button" onClick={onBack} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold">Back</button>
            {ready ? (
              <button
                type="button"
                data-testid="publish-challenge-button"
                data-ready="true"
                data-pending={pending ? "true" : "false"}
                onClick={handlePublishClick}
                disabled={pending}
                className="relative z-10 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
              >
                Retry Publish
              </button>
            ) : (
              <button
                type="button"
                data-testid="publish-challenge-button"
                data-ready="false"
                data-pending={pending ? "true" : "false"}
                onClick={handlePublishClick}
                disabled={pending}
                className="relative z-10 rounded-md border border-amber-100/40 px-3 py-1.5 text-[12px] font-bold text-amber-100 disabled:opacity-50"
              >
                Fix Business Challenge details
              </button>
            )}
          </>
        ) : (
          <>
            <Link href={`/challenges/${draft.challenge.slug ?? "new-challenge"}`} className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] font-bold">View Public Challenge</Link>
            <Link href="/dashboard" className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] font-bold">Go to Dashboard</Link>
            <Link href="/create-challenge?new=1" prefetch className="rounded-md border border-cyan-200/40 px-3 py-1.5 text-[12px] font-bold text-cyan-100">Create Another Challenge</Link>
          </>
        )}
      </div>
      {publication?.links.funding ? <a href={publication.links.funding} target="_blank" rel="noreferrer" className="block text-[12px] font-bold text-cyan-200">View transaction</a> : null}
      {publication?.links.contract ? <a href={publication.links.contract} target="_blank" rel="noreferrer" className="block text-[12px] font-bold text-cyan-200">View Arc contract</a> : null}
    </div>
  );
}

function PaymentWalletCard({ account, pending, unavailable, onInitialize }: {
  account: PaymentWalletCardAccount | null;
  pending: boolean;
  unavailable: boolean;
  onInitialize?: () => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy Address");
  const showUnavailable = unavailable && !account;
  const walletLabel = showUnavailable
    ? "Payment wallet unavailable"
    : account?.walletAddressMasked ?? (pending ? "Resolving payment wallet..." : "Payment wallet unavailable");
  const balanceLabel = showUnavailable
    ? "Balance unavailable"
    : account?.balanceDisplay ?? (pending ? "Checking..." : "Balance unavailable");
  const statusLabel = showUnavailable
    ? "Unavailable"
    : account?.walletState ?? (pending ? "Checking..." : "Unavailable");

  async function copyAddress() {
    if (!account?.walletAddress) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(account.walletAddress);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = account.walletAddress;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("Clipboard fallback failed.");
      }
      setCopyLabel("Address copied");
    } catch {
      setCopyLabel("Could not copy address");
    } finally {
      window.setTimeout(() => setCopyLabel("Copy Address"), 2000);
    }
  }

  return (
    <section className="rounded-md border border-cyan-200/20 bg-cyan-200/[0.06] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">Payment Wallet</p>
      <p className="mt-1 break-all font-mono text-[12px] font-bold text-white">{walletLabel}</p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        <Info label="Available Balance" value={balanceLabel} />
        <Info label="Wallet Status" value={statusLabel} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {!account && onInitialize ? (
          <button
            type="button"
            onClick={onInitialize}
            disabled={pending}
            className="rounded-md border border-cyan-200/30 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Set up payment wallet
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void copyAddress()}
          disabled={!account?.walletAddress}
          className="rounded-md border border-cyan-200/30 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copyLabel}
        </button>
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-cyan-200/30 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100"
        >
          Add Test USDC
        </a>
        {account?.explorerUrl ? (
          <a
            href={account.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-cyan-200/30 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100"
          >
            View on Arcscan
          </a>
        ) : null}
      </div>
    </section>
  );
}

function Info({ label, value, readOnly = false }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        <FormLabel readOnly={readOnly} className="text-[9px] text-slate-400">{label}</FormLabel>
      </p>
      <p className="mt-0.5 break-words text-[11px] font-bold text-white">{value}</p>
    </div>
  );
}
