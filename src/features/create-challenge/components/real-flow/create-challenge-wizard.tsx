"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { createChallengeSteps } from "@/features/create-challenge/data/demo-draft";
import { createChallengeTraceId, logCreateChallengeTrace, type CreateChallengeTraceSource } from "@/utils/create-challenge-payment-trace";
import { CREATE_CHALLENGE_BALANCE_TTL_MS } from "@/config/create-challenge-payment";
import type {
  CreateChallengeDraftState,
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

type PaymentErrorScope = "PAYMENT_OVERVIEW" | "APPROVAL" | "FUNDING" | "RECONCILE" | "PUBLISH";
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

type DraftResponse = {
  draft: CreateChallengeDraftState;
  validation?: CreateChallengeValidation | null;
};

type PaymentOverviewResponse = {
  paymentState: CreateChallengePaymentState;
  progress: CreateChallengePaymentProgressItem[];
  availableActions: string[];
  paymentAccount: PaymentAccountSnapshot;
  safeMessage: string;
  balance: { units: string; display: string; readAt: string; source: string };
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

const categories = [
  "Motion Design",
  "Graphic Design",
  "Video",
  "Photography",
  "Music & Audio",
  "Product Design",
  "Other",
];

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

function publishStepHeaderStatus(draft: CreateChallengeDraftState, fallback: string) {
  if (draft.deployment.publicationStatus === "live") return "Challenge live";
  if (draft.deployment.publicationStatus === "ready-to-publish") return "Ready to publish";
  return fallback;
}

function tracePublishClick(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ccn-publish-click]", { event, ...details });
}

type PaymentState = CreateChallengePaymentState;

type PaymentProgressItem = CreateChallengePaymentProgressItem;

function paymentProgressItems(state: PaymentState): PaymentProgressItem[] {
  const labels = [
    "Payment account ready",
    state === "BALANCE_LOADING" ? "Checking balance" : "Balance verified",
    "Approval required",
    "Approval confirmed",
    "Securing prize pool",
    "Funding confirmed",
    "Ready to publish",
  ];
  const doneByState: Record<PaymentState, number> = {
    NOT_STARTED: 0,
    ACCOUNT_LOADING: 0,
    BALANCE_LOADING: 1,
    BALANCE_READY: 2,
    INSUFFICIENT_BALANCE: 2,
    READY_FOR_APPROVAL: 2,
    APPROVAL_PENDING: 2,
    APPROVED: 4,
    FUNDING_PENDING: 4,
    RECONCILING: 5,
    FUNDED_VERIFIED: 7,
    PUBLISHED: 7,
    RECOVERABLE_ERROR: 1,
    FATAL_ERROR: 0,
  };
  const activeByState: Partial<Record<PaymentState, number>> = {
    NOT_STARTED: 0,
    ACCOUNT_LOADING: 0,
    BALANCE_LOADING: 1,
    BALANCE_READY: 2,
    INSUFFICIENT_BALANCE: 2,
    READY_FOR_APPROVAL: 2,
    APPROVAL_PENDING: 2,
    APPROVED: 4,
    FUNDING_PENDING: 4,
    RECONCILING: 5,
    RECOVERABLE_ERROR: 1,
    FATAL_ERROR: 0,
  };
  const doneCount = doneByState[state];
  const activeIndex = activeByState[state];

  return labels.map((label, index) => {
    if (state === "INSUFFICIENT_BALANCE" && index === 2) return { label: "Insufficient balance", status: "warning" };
    if (state === "RECOVERABLE_ERROR" && index === 1) return { label: "Balance unavailable", status: "warning" };
    if (index < doneCount) return { label, status: "done" };
    if (index === activeIndex) return { label, status: "active" };
    return { label, status: "pending" };
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

export function CreateChallengeWizard({ appId }: { appId: string }) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [draft, setDraft] = useState<CreateChallengeDraftState | null>(null);
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
  const [status, setStatus] = useState("Loading saved draft...");
  const [error, setError] = useState<SafeError | null>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastBalanceSnapshotRef = useRef<BalanceSnapshot | null>(null);
  const balanceRequestRef = useRef(0);
  const balanceAbortRef = useRef<AbortController | null>(null);
  const prizeBalanceReadDraftsRef = useRef(new Set<string>());
  const fundingBalanceReadDraftsRef = useRef(new Set<string>());

  function draftUrl(targetDraftId = draftId) {
    if (!targetDraftId) throw new Error("draftId is required for this draft request.");
    return `/api/create-challenge/draft?draftId=${encodeURIComponent(targetDraftId)}`;
  }

  function scopedBody(body: Record<string, unknown> = {}) {
    return { ...body, draftId: draft?.challenge.id ?? draftId };
  }

  useEffect(() => {
    let active = true;
    document.body.classList.add("ccn-app-shell");
    const params = new URLSearchParams(window.location.search);
    const selectedDraftId = params.get("draftId");
    const shouldCreateNew = params.get("new") === "1";
    if (!shouldCreateNew && !selectedDraftId) {
      queueMicrotask(() => {
        if (active) setStatus("Choose Continue Draft or Start New Challenge to begin.");
      });
      return () => {
        active = false;
        document.body.classList.remove("ccn-app-shell");
      };
    }
    const initialUrl = shouldCreateNew
      ? "/api/create-challenge/draft?new=1"
      : `/api/create-challenge/draft?draftId=${encodeURIComponent(selectedDraftId ?? "")}`;
    void requestJson<DraftResponse>(initialUrl)
      .then((payload) => {
        if (!active) return;
        setDraft(payload.draft);
        setDraftId(payload.draft.challenge.id ?? "");
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
        setStep(payload.draft.deployment.currentStep);
        setStatus(fundingActionStatus(payload.draft));
      })
      .catch(showError);
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

  const fundingState: PaymentState = paymentOverview?.paymentState ?? "NOT_STARTED";
  const fundingSteps = paymentOverview?.progress ?? paymentProgressItems(fundingState);
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
  const statusHeader =
    step === "funding"
      ? paymentStateHeaderStatus(fundingState)
      : step === "publish" && draft
        ? publishStepHeaderStatus(draft, status)
        : status;
  const blockingError: SafeError | null = error;

  function showError(errorValue: unknown, scope?: PaymentErrorScope) {
    const safe =
      typeof errorValue === "object" && errorValue && "message" in errorValue
        ? (errorValue as SafeError)
        : { message: "Create Challenge request failed safely." };
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
      return change(current);
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
    try {
      const payload = await requestJson<DraftResponse>("/api/create-challenge/draft", {
        draftId: draft.challenge.id ?? draftId,
        draft: {
          ...draft,
          deployment: { ...draft.deployment, currentStep: targetStep },
        },
        step: targetStep,
      });
      setDraft(payload.draft);
      setDraftId(payload.draft.challenge.id ?? "");
      setStep(targetStep);
      setValidation(payload.validation ?? null);
      setDirty(false);
      setStatus(fundingActionStatus(payload.draft));
      return payload;
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
    if (!saved?.validation || saved.validation.valid) {
      const targetStep = nextStep(step);
      if (targetStep === "publish" && !fundingIsVerified(saved.draft)) {
        setStep("funding");
        setStatus("Complete funding before publishing this challenge.");
        return;
      }
      setStep(targetStep);
      if (draft) {
        setDraft({
          ...draft,
          deployment: { ...draft.deployment, currentStep: targetStep },
        });
      }
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
      setStatus("Confirmation completed. Reconciling transaction...");
      void reconcile(stage, challengeId);
    });
  }

  async function approve() {
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
      await executeCircleChallenge(payload.approval.challengeId, "approval");
    } catch (requestError) {
      showError(requestError, "APPROVAL");
    } finally {
      setPending(false);
    }
  }

  async function fund() {
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
      const payload = await requestJson<{ result: EscrowTransactionSnapshot } & PaymentStateResponse>(
        "/api/create-challenge/reconcile",
        scopedBody({ userToken: appSession.userToken, stage, challengeId: targetChallengeId }),
      );
      if (stage === "approval") setApproval(payload.result);
      if (stage === "funding") setFunding(payload.result);
      const refreshed = await requestJson<DraftResponse>(draftUrl(draft?.challenge.id));
      setDraft(refreshed.draft);
      if (payload.paymentOverview) {
        applyPaymentOverview(payload.paymentOverview, refreshed.draft);
      }
      if (payload.result.state === "RESTORED_FROM_CHAIN") {
        setStatus("We couldn't find the previous payment request. We checked the on-chain status and safely restored this step.");
        return;
      }
      setStatus(fundingActionStatus(refreshed.draft));
    } catch (requestError) {
      showError(requestError, "RECONCILE");
    } finally {
      setPending(false);
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

  async function publish() {
    tracePublishClick("publish-entered", {
      draftId: draft?.challenge.id,
      publicationStatus: draft?.deployment.publicationStatus,
      fundingStatus: draft?.funding.fundingStatus,
      pending,
    });
    setPending(true);
    setError(null);
    try {
      const appSession = await ensureSession();
      tracePublishClick("request-start", {
        draftId: draft?.challenge.id,
        endpoint: "/api/create-challenge/publish",
      });
      const payload = await requestJson<{ publication: { published: boolean; links: Record<string, string | null> } }>(
        "/api/create-challenge/publish",
        scopedBody({ userToken: appSession.userToken }),
      );
      tracePublishClick("response-received", {
        draftId: draft?.challenge.id,
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
      const refreshed = await requestJson<DraftResponse>(draftUrl(draft?.challenge.id));
      setDraft(refreshed.draft);
      setStatus("Challenge Published. The prize pool is secured and submissions are open.");
    } catch (requestError) {
      tracePublishClick("catch", {
        draftId: draft?.challenge.id,
        message: requestError && typeof requestError === "object" && "message" in requestError
          ? String((requestError as SafeError).message)
          : "Publish request failed.",
      });
      showError(requestError, "PUBLISH");
    } finally {
      tracePublishClick("finally", {
        draftId: draft?.challenge.id,
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
    setDraft({
      ...verifiedDraft,
      deployment: { ...verifiedDraft.deployment, currentStep: "publish" },
    });
  }

  async function startNewTestDraft() {
    if (dirty && !window.confirm("You already have a draft in progress.\n\nStart New Challenge")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = await requestJson<DraftResponse>("/api/create-challenge/draft?new=1");
      setDraft(payload.draft);
      setDraftId(payload.draft.challenge.id ?? "");
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
      <main className="min-h-screen bg-[#030a1f] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-md border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-slate-300">{statusHeader}</p>
          <button type="button" onClick={startNewTestDraft} disabled={pending} className="mt-4 rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
            Start New Challenge
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030a1f] text-white">
      <header className="border-b border-white/10 bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8 lg:px-10">
          <Link href="/dashboard" className="rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200">
            <Image
              src="/brand/ccn-logo.png"
              alt="Creator Challenge Network"
              width={134}
              height={42}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200">
              {statusHeader}
            </span>
            <button
              type="button"
              onClick={() => void startNewTestDraft()}
              disabled={pending}
              className="rounded-md border border-cyan-200/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-50"
            >
              Start New Test Draft
            </button>
            <Link
              href="/dashboard"
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
            >
              Exit to Dashboard
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 sm:px-8 lg:grid-cols-[300px_1fr] lg:px-10">
        <aside className="h-fit rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
            Create Challenge
          </p>
          <div className="mt-4 space-y-2">
            {createChallengeSteps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToStep(item.id)}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
                  step === item.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-bold">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-200">
                Brand flow
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                {createChallengeSteps.find((item) => item.id === step)?.label}
              </h1>
            </div>
            <p className="text-xs font-bold text-slate-400">Draft ID: {mask(draft.challenge.id)}</p>
          </div>

          <div className="mt-6 rounded-md border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
            Status: {statusHeader}
          </div>

          {validation?.errors.length ? (
            <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p className="font-bold">Please fix before continuing</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validation.errors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {blockingError ? (
            <div className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
              <p className="font-bold">Safe error</p>
              <p className="mt-2">{blockingError.message}</p>
              {blockingError.status || blockingError.code || blockingError.endpoint ? (
                <details className="mt-3 rounded-md border border-red-200/20 bg-slate-950/50 p-3 text-xs text-red-100">
                  <summary className="cursor-pointer font-bold">Technical details</summary>
                  {blockingError.status ? <p className="mt-2">HTTP Status: {blockingError.status}</p> : null}
                  {blockingError.code ? <p>Circle Code: {blockingError.code}</p> : null}
                  {blockingError.endpoint ? <p>Endpoint: {blockingError.endpoint}</p> : null}
                </details>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8">
            {step === "basics" ? <BasicsStep draft={draft} updateDraft={updateDraft} /> : null}
            {step === "prize-pool" ? (
              <PrizeStep
                draft={draft}
                updateDraft={updateDraft}
                paymentAccount={paymentAccount}
                paymentAccountPending={paymentAccountPending}
                paymentAccountError={paymentAccountError}
                balanceNotice={balanceNotice}
                onRetryPaymentAccount={() => loadPaymentAccount("retry")}
              />
            ) : null}
            {step === "review-rules" ? <RulesStep draft={draft} updateDraft={updateDraft} /> : null}
            {step === "funding" ? (
              <FundingStep
                draft={draft}
                preflight={preflight}
                paymentAccount={paymentAccount}
                paymentAccountPending={paymentAccountPending}
                paymentAccountError={paymentAccountError}
                balanceNotice={balanceNotice}
                circleUserId={session?.circleUserId ?? ""}
                funding={funding}
                steps={fundingSteps}
                paymentState={fundingState}
                pending={pending}
                onPreflight={runPreflight}
                onApprove={approve}
                onRecoverApproval={recoverApproval}
                onFund={fund}
                onVerify={verifyFunding}
                onReconcile={reconcile}
                onContinueToPublish={continueToPublishAfterVerification}
              />
            ) : null}
            {step === "publish" ? (
              <PublishStep
                draft={draft}
                publication={publication}
                onBack={() => setStep("funding")}
                onPublish={publish}
                pending={pending}
              />
            ) : null}
          </div>

          {step !== "publish" ? (
          <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={() => setStep(previousStep(step))}
              disabled={
                step === "basics" ||
                pending ||
                draft.funding.fundingStatus === "approval-pending" ||
                draft.funding.fundingStatus === "funding-pending"
              }
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={
                  pending ||
                  draft.funding.fundingStatus === "approval-pending" ||
                  draft.funding.fundingStatus === "funding-pending" ||
                  fundingIsVerified(draft)
                }
                className="rounded-md border border-cyan-200/40 px-4 py-2 text-sm font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Draft
              </button>
              {step !== "funding" ? (
                <button
                  type="button"
                  onClick={() => void continueStep()}
                  disabled={pending || prizeStepHasMismatch || prizeStepHasInsufficientBalance}
                  className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
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

function TextInput({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-cyan-200"
      />
    </label>
  );
}

function DecimalInput({ label, value, onChange, readOnly = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-200">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-cyan-200 read-only:cursor-not-allowed read-only:text-slate-300"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4, maxLength }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-200">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        className="mt-2 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-cyan-200"
      />
    </label>
  );
}

function BasicsStep({ draft, updateDraft }: {
  draft: CreateChallengeDraftState;
  updateDraft: (change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput label="Challenge title" value={draft.challenge.title} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, title: value } }))} />
        <TextInput label="Brand or organization name" value={draft.challenge.brandName} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, brandName: value } }))} />
      </div>
      <label className="block">
        <span className="text-sm font-bold text-slate-200">Category</span>
        <select
          value={draft.challenge.category}
          onChange={(event) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, category: event.target.value } }))}
          className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none focus:border-cyan-200"
        >
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
      </label>
      <TextArea label="Short summary" value={draft.challenge.summary} maxLength={240} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, summary: value } }))} />
      <TextArea label="Full creative brief" rows={7} value={draft.challenge.description} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, description: value } }))} />
      <TextInput label="Primary deliverable" value={draft.challenge.primaryDeliverable} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, primaryDeliverable: value } }))} />
      <TextInput label="Supporting deliverables, optional" value={draft.challenge.supportingDeliverables.join(", ")} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, supportingDeliverables: value.split(",").map((item) => item.trim()).filter(Boolean) } }))} placeholder="15s cutdown, source file, style frames" />
      <TextInput label="Reference links, optional" value={draft.challenge.referenceLinks.join(", ")} onChange={(value) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, referenceLinks: value.split(",").map((item) => item.trim()).filter(Boolean) } }))} placeholder="https://..." />
      <label className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={draft.challenge.usageRightsAcknowledged}
          onChange={(event) => updateDraft((current) => ({ ...current, challenge: { ...current.challenge, usageRightsAcknowledged: event.target.checked } }))}
          className="mt-1"
        />
        <span>I understand that only the winning submission receives the reward and transfers the predefined usage rights.</span>
      </label>
    </div>
  );
}

function PrizeStep({ draft, updateDraft, paymentAccount, paymentAccountPending, paymentAccountError, balanceNotice, onRetryPaymentAccount }: {
  draft: CreateChallengeDraftState;
  updateDraft: (change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) => void;
  paymentAccount: PaymentAccountSnapshot | null;
  paymentAccountPending: boolean;
  paymentAccountError: SafeError | null;
  balanceNotice: string | null;
  onRetryPaymentAccount: () => Promise<PaymentAccountSnapshot | null>;
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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {([1, 3] as const).map((winnerCount) => (
          <button
            key={winnerCount}
            type="button"
            onClick={() => updateWinnerCount(winnerCount)}
            className={`rounded-md border p-4 text-left transition ${draft.prizePool.winnerCount === winnerCount ? "border-cyan-200 bg-cyan-200/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
          >
            <span className="text-lg font-bold">Top {winnerCount}</span>
            <span className="mt-1 block text-sm text-slate-300">
              {winnerCount === 1 ? "One winner receives the full prize pool." : "Three winners share the prize pool."}
            </span>
          </button>
        ))}
      </div>
      <DecimalInput
        label="Total prize pool in test USDC"
        value={String(draft.prizePool.totalAmount)}
        onChange={updateTotal}
      />
      <PaymentWalletCard
        account={paymentAccount}
        pending={paymentAccountPending}
        unavailable={Boolean(paymentAccountError)}
      />

      {draft.prizePool.winnerCount === 3 ? (
        <div>
          <p className="text-sm font-bold text-slate-200">Distribution</p>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {([
              ["recommended", "Recommended 60 / 30 / 10"],
              ["equal", "Equal split"],
              ["custom", "Custom amounts"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => updateDistributionMode(value)}
                className={`rounded-md border px-4 py-3 text-left text-sm font-bold transition ${
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
            <p className="mt-3 text-sm text-cyan-100">
              You can now edit each reward amount.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3">
        {draft.prizePool.winnerCount === 1 ? (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-bold text-white">
              Winner receives: {formatUsdcUnits(math.distributionUnits[0] ?? "0")} test USDC
            </p>
          </div>
        ) : (
          draft.prizePool.prizeDistribution.map((prize, index) => (
            <label key={prize.place} className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[1fr_180px] sm:items-center">
              <span className="font-bold text-white">{prize.place} place</span>
              <input
                type="text"
                inputMode="decimal"
                value={String(prize.amount)}
                readOnly={mode !== "custom"}
                onChange={(event) => updateDistributionText(index, event.target.value)}
                className="h-10 rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none focus:border-cyan-200 read-only:cursor-not-allowed read-only:text-slate-300"
              />
            </label>
          ))
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Info label="Allocated" value={`${allocated} test USDC`} />
        <Info label="Remaining" value={`${remaining} test USDC`} />
        <Info label="Platform fee" value={`${formatUsdcUnits(math.platformFeeUnits)} test USDC`} />
        <Info label="Total required" value={`${formatUsdcUnits(math.totalRequiredUnits)} test USDC`} />
      </div>
      {balanceNotice ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
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
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
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
        <div className="rounded-md border border-rose-300/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          <p className="font-bold">Insufficient test USDC</p>
          <p className="mt-2">
            Required: {formatUsdcUnits(math.totalRequiredUnits)} test USDC. Available: {paymentAccount.balanceDisplay}.
          </p>
        </div>
      ) : null}
      {math.errors.length ? (
        <div className="rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-bold">Prize pool needs attention</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
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
  return value ? value.slice(0, 10) : "";
}

function timePart(value: string) {
  return value.includes("T") ? value.slice(11, 16) : "";
}

function combineLocalDateTime(date: string, time: string) {
  if (!date && !time) return "";
  return `${date || datePart(new Date().toISOString())}T${time || "09:00"}`;
}

function DateTimePicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <legend className="px-1 text-sm font-bold text-slate-200">{label}</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Date</span>
          <input
            type="date"
            value={datePart(value)}
            onChange={(event) => onChange(combineLocalDateTime(event.target.value, timePart(value)))}
            onInput={(event) => onChange(combineLocalDateTime(event.currentTarget.value, timePart(value)))}
            onClick={(event) => event.currentTarget.showPicker?.()}
            className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none focus:border-cyan-200"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Time</span>
          <input
            type="time"
            value={timePart(value)}
            onChange={(event) => onChange(combineLocalDateTime(datePart(value), event.target.value))}
            onInput={(event) => onChange(combineLocalDateTime(datePart(value), event.currentTarget.value))}
            onClick={(event) => event.currentTarget.showPicker?.()}
            className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none focus:border-cyan-200"
          />
        </label>
      </div>
    </fieldset>
  );
}

function RulesStep({ draft, updateDraft }: {
  draft: CreateChallengeDraftState;
  updateDraft: (change: (current: CreateChallengeDraftState) => CreateChallengeDraftState) => void;
}) {
  const [criterion, setCriterion] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const criteria = draft.reviewRules.judgingCriteria.filter(Boolean);

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
    <div className="space-y-5">
      <div className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
        Blind review is required for MVP. Brands see anonymous entries during review.
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <DateTimePicker label="Submission" value={draft.reviewRules.submissionDeadline} onChange={(value) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, submissionDeadline: value } }))} />
        <DateTimePicker label="Review" value={draft.reviewRules.reviewDeadline} onChange={(value) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, reviewDeadline: value } }))} />
      </div>
      <p className="text-sm text-slate-300">Local timezone: {timezone}</p>

      <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-bold text-slate-200">Judging criteria</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {criteria.map((item, index) => (
            <button
              key={`${item}-${index}`}
              type="button"
              onClick={() => removeCriterion(index)}
              className="rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-sm font-bold text-cyan-50"
            >
              {item} x
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            value={criterion}
            onChange={(event) => setCriterion(event.target.value)}
            maxLength={60}
            placeholder="Creative fit"
            className="h-11 min-w-64 flex-1 rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none focus:border-cyan-200"
          />
          <button
            type="button"
            onClick={addCriterion}
            className="rounded-md border border-cyan-200/40 px-4 py-2 text-sm font-bold text-cyan-100"
          >
            Add criterion
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">At least one criterion is required. Maximum 8.</p>
      </div>

      <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-bold text-slate-200">Allowed submission types</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {allowedFormatOptions.map((format) => (
            <label key={format} className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-bold text-slate-200">
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
      <TextArea label="Usage rights summary" value={draft.reviewRules.usageRights} onChange={(value) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, usageRights: value } }))} />
      <label className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
        <input type="checkbox" checked={draft.reviewRules.creatorAcknowledgement} onChange={(event) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, creatorAcknowledgement: event.target.checked } }))} />
        <span>Creators must acknowledge that submitted work is complete and ready for review.</span>
      </label>
      <label className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
        <input type="checkbox" checked={draft.reviewRules.cancellationAcknowledgement} onChange={(event) => updateDraft((current) => ({ ...current, reviewRules: { ...current.reviewRules, cancellationAcknowledgement: event.target.checked } }))} />
        <span>I understand that once submissions exist, the Brand cannot unilaterally cancel and refund.</span>
      </label>
    </div>
  );
}

function FundingStep({ draft, preflight, paymentAccount, paymentAccountPending, paymentAccountError, balanceNotice, circleUserId, funding, steps, paymentState, pending, onPreflight, onApprove, onRecoverApproval, onFund, onVerify, onReconcile, onContinueToPublish }: {
  draft: CreateChallengeDraftState;
  preflight: PreflightResponse | null;
  paymentAccount: PaymentAccountSnapshot | null;
  paymentAccountPending: boolean;
  paymentAccountError: SafeError | null;
  balanceNotice: string | null;
  circleUserId: string;
  funding: EscrowTransactionSnapshot | null;
  steps: PaymentProgressItem[];
  paymentState: PaymentState;
  pending: boolean;
  onPreflight: () => void;
  onApprove: () => void;
  onRecoverApproval: () => void;
  onFund: () => void;
  onVerify: () => void;
  onReconcile: (stage: EscrowTransactionStage, challengeId?: string) => void;
  onContinueToPublish: () => void;
}) {
  const approvalPending = draft.funding.fundingStatus === "approval-pending";
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
  const showDiagnostic = process.env.NODE_ENV !== "production";
  const hasBalanceProblem = paymentState === "RECOVERABLE_ERROR" || (paymentState === "BALANCE_LOADING" && Boolean(paymentAccount?.safeMessage || paymentAccountError));
  const missingBalance = paymentAccount?.accountStatus === "READY"
    ? BigInt(draft.prizePool.totalRequiredUnits) > BigInt(paymentAccount.balanceUnits)
      ? `${formatUsdcUnits(BigInt(draft.prizePool.totalRequiredUnits) - BigInt(paymentAccount.balanceUnits))} test USDC`
      : "0 test USDC"
    : "";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <h2 className="text-2xl font-bold">Secure Your Prize Pool</h2>
        <PaymentWalletCard
          account={paymentAccount}
          pending={paymentAccountPending}
          unavailable={Boolean(paymentAccountError)}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Info label="Prize pool" value={`${draft.prizePool.totalAmount.toLocaleString()} test USDC`} />
          <Info label="Platform fee" value={`${draft.prizePool.platformFee.toLocaleString()} test USDC`} />
          <Info label="Total required" value={totalRequired} />
          <Info label="Available balance" value={availableBalance} />
          <Info label="Remaining after funding" value={remainingBalance} />
          <Info label="Network fee" value="Paid separately in test USDC" />
          <Info label="Network" value="Arc Testnet" />
        </div>
        {(paymentState === "NOT_STARTED" || paymentState === "ACCOUNT_LOADING") ? (
          <p className="text-sm leading-6 text-slate-300">
            Check your payment account to confirm the available test USDC balance.
          </p>
        ) : null}
        {paymentState === "BALANCE_LOADING" && !hasBalanceProblem ? (
          <p className="rounded-md border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm font-bold text-cyan-50">
            Checking balance...
          </p>
        ) : null}
        {balanceNotice ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
            <span>{balanceNotice}</span>
            <button type="button" onClick={onPreflight} disabled={pending} className="rounded-md border border-amber-100/40 px-3 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">Refresh Balance</button>
          </div>
        ) : null}
        {!balanceNotice && hasBalanceProblem ? (
          <p className="rounded-md border border-rose-300/30 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">
            Balance temporarily unavailable
          </p>
        ) : null}
        {paymentState === "INSUFFICIENT_BALANCE" ? (
          <div className="rounded-md border border-rose-300/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            <p className="font-bold">Insufficient test USDC</p>
            <p className="mt-2">Required: {totalRequired}</p>
            <p>Available: {availableBalance}</p>
            <p>Missing: {missingBalance}</p>
          </div>
        ) : null}
        {paymentState === "READY_FOR_APPROVAL" ? (
          <div className="grid gap-2 text-sm font-bold text-emerald-100">
            <p>Payment account ready &#10003;</p>
            <p>Balance verified &#10003;</p>
          </div>
        ) : null}
        <p className="rounded-md border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
          Protected funds are locked for this challenge and can only be paid to selected winners or safely returned by the configured challenge rules.
        </p>
        <div className="flex flex-wrap gap-3">
          {(paymentState === "NOT_STARTED" || paymentState === "ACCOUNT_LOADING") ? (
            <button type="button" onClick={onPreflight} disabled={pending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Check Payment Account</button>
          ) : null}
          {paymentState === "BALANCE_LOADING" && !hasBalanceProblem ? (
            <button type="button" disabled className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-bold opacity-60">Checking payment account...</button>
          ) : null}
          {hasBalanceProblem ? (
            <button type="button" onClick={onPreflight} disabled={pending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Try Again</button>
          ) : null}
          {paymentState === "INSUFFICIENT_BALANCE" ? (
            <button type="button" onClick={onPreflight} disabled={pending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Check Again</button>
          ) : null}
          {paymentState === "READY_FOR_APPROVAL" ? (
            <button type="button" onClick={onApprove} disabled={pending} className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Review and Approve {totalRequired}</button>
          ) : null}
          {paymentState === "APPROVAL_PENDING" ? (
            <span className="rounded-md border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-100">Waiting for payment approval</span>
          ) : null}
          {paymentState === "APPROVAL_PENDING" ? (
            <button type="button" onClick={onRecoverApproval} disabled={pending} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Check Approval Status</button>
          ) : null}
          {paymentState === "APPROVED" ? (
            <button type="button" onClick={onFund} disabled={pending} className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Secure Prize Pool</button>
          ) : null}
          {paymentState === "FUNDING_PENDING" ? (
            <span className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100">Securing prize pool on Arc</span>
          ) : null}
          {paymentState === "RECONCILING" ? (
            <button type="button" onClick={onVerify} disabled={pending} className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Verify funding</button>
          ) : null}
          {paymentState === "FUNDED_VERIFIED" ? (
            <button type="button" onClick={onContinueToPublish} disabled={pending} className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Continue to Publish</button>
          ) : null}
          {fundingTransactionExists && paymentState === "FUNDING_PENDING" ? (
            <button type="button" onClick={() => onReconcile("funding", funding?.challengeId ?? draft.funding.fundingChallengeId)} disabled={(!funding?.challengeId && !draft.funding.fundingChallengeId) || pending} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Check prize pool status</button>
          ) : null}
        </div>
        <details className="rounded-md border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
          <summary className="cursor-pointer font-bold text-white">Technical details</summary>
          <div className="mt-3 grid gap-2">
            <p>Brand payment wallet: <span className="break-all font-mono text-white">{brandPaymentWallet || "Not checked"}</span></p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(brandPaymentWallet)}
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
            <p>Escrow: 0x5714...eBF6</p>
            <p>Challenge ID: {mask(draft.deployment.challengeId)}</p>
            <p>Approval tx: {mask(draft.funding.approvalTransactionHash)}</p>
            <p>Funding tx: {mask(draft.funding.transactionHash)}</p>
          </div>
        </details>
        {showDiagnostic ? (
          <details className="rounded-md border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
            <summary className="cursor-pointer font-bold">Development funding scope</summary>
            <div className="mt-3 grid gap-2">
              <p>Current draft: {mask(draft.challenge.id)}</p>
              <p>Current challenge: {mask(draft.challenge.challengeId ?? draft.deployment.challengeId)}</p>
              <p>Current funding intent: {mask(draft.funding.fundingIntentId)}</p>
              <p>Loaded funding-record scope: draft-local:{mask(draft.challenge.id)}:{mask(draft.challenge.challengeId ?? draft.deployment.challengeId)}:{mask(draft.funding.fundingIntentId)}</p>
            </div>
          </details>
        ) : null}
      </section>
      <aside className="h-fit rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-bold text-white">Payment progress</p>
        <div className="mt-4 space-y-3">
          {steps.map((item) => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <span
                className={
                  item.status === "done"
                    ? "h-2.5 w-2.5 rounded-full bg-emerald-300"
                    : item.status === "active"
                      ? "h-2.5 w-2.5 rounded-full bg-cyan-300"
                      : item.status === "warning"
                        ? "h-2.5 w-2.5 rounded-full bg-amber-300"
                        : "h-2.5 w-2.5 rounded-full bg-white/20"
                }
              />
              <span className={item.status === "pending" ? "text-slate-400" : "text-white"}>{item.label}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function PublishStep({ draft, publication, onBack, onPublish, pending }: {
  draft: CreateChallengeDraftState;
  publication: { published: boolean; links: Record<string, string | null> } | null;
  onBack: () => void;
  onPublish: () => void;
  pending: boolean;
}) {
  const live = draft.deployment.publicationStatus === "live";
  const ready = fundingIsVerified(draft);
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
    if (pending || !ready) return;
    onPublish();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-2xl font-bold">
          {live ? "Challenge Published" : "Prize Pool Secured"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {live
            ? "Your prize pool is secured and the challenge is now open for submissions."
            : "Funding verified. The prize pool is secured and you can publish this challenge now."}
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Info label="Challenge title" value={draft.challenge.title || "Untitled"} />
          <Info label="Status" value={live ? "LIVE" : "Ready to publish"} />
          <Info label="Prize pool" value={`${draft.prizePool.totalAmount.toLocaleString()} test USDC`} />
          <Info label="Winner model" value={`Top ${draft.prizePool.winnerCount}`} />
          <Info label="Submission deadline" value={draft.reviewRules.submissionDeadline || "Not set"} />
          <Info label="Escrow verified" value={ready ? "Yes" : "Pending"} />
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        {!live ? (
          <>
            <button type="button" onClick={onBack} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold">Back</button>
            <button
              type="button"
              data-testid="publish-challenge-button"
              data-ready={ready ? "true" : "false"}
              data-pending={pending ? "true" : "false"}
              onClick={handlePublishClick}
              disabled={pending || !ready}
              className="relative z-10 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2 text-sm font-bold disabled:opacity-50"
            >
              Publish Challenge
            </button>
          </>
        ) : (
          <>
            <Link href={`/challenges/${draft.challenge.slug ?? "new-challenge"}`} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold">View Challenge</Link>
            <Link href="/dashboard" className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold">Back to Dashboard</Link>
          </>
        )}
      </div>
      {publication?.links.funding ? <a href={publication.links.funding} target="_blank" rel="noreferrer" className="block text-sm font-bold text-cyan-200">View transaction</a> : null}
      {publication?.links.contract ? <a href={publication.links.contract} target="_blank" rel="noreferrer" className="block text-sm font-bold text-cyan-200">Contract link</a> : null}
    </div>
  );
}

function PaymentWalletCard({ account, pending, unavailable }: {
  account: PaymentWalletCardAccount | null;
  pending: boolean;
  unavailable: boolean;
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
    <section className="rounded-md border border-cyan-200/20 bg-cyan-200/[0.06] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Payment Wallet</p>
      <p className="mt-2 break-all font-mono text-sm font-bold text-white">{walletLabel}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info label="Available Balance" value={balanceLabel} />
        <Info label="Wallet Status" value={statusLabel} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void copyAddress()}
          disabled={!account?.walletAddress}
          className="rounded-md border border-cyan-200/30 px-3 py-2 text-xs font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copyLabel}
        </button>
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-cyan-200/30 px-3 py-2 text-xs font-bold text-cyan-100"
        >
          Add Test USDC
        </a>
        {account?.explorerUrl ? (
          <a
            href={account.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-cyan-200/30 px-3 py-2 text-xs font-bold text-cyan-100"
          >
            View on Arcscan
          </a>
        ) : null}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-white">{value}</p>
    </div>
  );
}
