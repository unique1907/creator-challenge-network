import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import {
  ARC_TESTNET_CHAIN_ID,
  type CreateChallengeDeadlinePolicy,
  getCreateChallengeDeadlinePolicy,
} from "@/config/create-challenge-deadline-policy";
import { demoCreateChallengeDraft } from "@/features/create-challenge/data/demo-draft";
import { createSupabaseAdminClient } from "@/services/supabase/admin.server";
import type {
  CreateChallengeDraftState,
  CreateChallengeStepId,
  CreateChallengeValidation,
} from "@/types/create-challenge";
import type { WinnerFinalizationState } from "@/types/winner-finalization";
import { canonicalizeDraftDeadlines, deadlineUnixSecondsFromDraft } from "@/utils/challenge-deadlines";
import {
  formatUsdcUnits,
  normalizePrizePool,
} from "@/utils/create-challenge-finance";
import { validateCreateChallengeStep } from "@/utils/create-challenge-launch-readiness";

// Local JSON persistence is for the hackathon/dev spike only. Vercel/production must use a real database.
const LOCAL_USER_HOME = process.env.USERPROFILE ?? process.env.HOME ?? "C:\\Users\\TB";
export const CREATE_CHALLENGE_STORE_PATH =
  process.env.CCN_CREATE_CHALLENGE_STORE_PATH ??
  join(LOCAL_USER_HOME, "Desktop", "creator-challenge-network", ".local", "create-challenge-flow.json");
let storePathLogged = false;
export const CREATE_CHALLENGE_BRAND_ACCOUNT_ID = "ccn-test-email-001";
export const CREATE_CHALLENGE_ESCROW_CONTRACT =
  "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D";
export const CREATE_CHALLENGE_USDC_CONTRACT =
  "0x3600000000000000000000000000000000000000";

type Store = {
  version?: number;
  revision?: number;
  activeDraftId?: string;
  drafts?: Record<string, CreateChallengeDraftState>;
  publicSlugReservations?: Record<string, PublicSlugReservation>;
  fundingRecords?: Record<string, FundingRecordScope>;
  approvalAttempts?: Record<string, ApprovalAttemptRecord[]>;
  fundingAttempts?: Record<string, FundingAttemptRecord[]>;
  winnerFinalizationAttempts?: Record<string, WinnerFinalizationAttemptRecord>;
  onChainVerificationsByTxHash?: Record<string, OnChainVerificationRecord>;
  draft?: CreateChallengeDraftState;
};

type PublicSlugReservation = {
  slug: string;
  draftId: string;
  titleBasis: string;
  updatedAt: string;
};

const STORE_VERSION = 1;
const IS_MANAGED_PRODUCTION =
  process.env.VERCEL_ENV === "production" ||
  process.env.CCN_DEPLOYMENT_ENV === "production";
const LIFECYCLE_PERSISTENCE_ADAPTER =
  process.env.CCN_LIFECYCLE_PERSISTENCE ??
  (IS_MANAGED_PRODUCTION ? "supabase" : "filesystem");
const STORE_WRITE_RETRIES = 3;
const STORE_BACKUP_KEEP = 8;
const CREATE_CHALLENGE_BACKUP_DIR = join(dirname(CREATE_CHALLENGE_STORE_PATH), "backups");
const CREATE_CHALLENGE_LAST_KNOWN_GOOD_PATH = join(CREATE_CHALLENGE_BACKUP_DIR, "last-known-good.json");
let storeWriteQueue = Promise.resolve();

async function filesystem() {
  return import("node:fs/promises");
}

export class StoreCorruptionError extends Error {
  readonly path: string;
  readonly size: number | null;

  constructor(input: { path: string; size: number | null; cause: unknown }) {
    super("Create Challenge local store is corrupt or unreadable. Restore from a backup before continuing.");
    this.name = "StoreCorruptionError";
    this.path = input.path;
    this.size = input.size;
    this.cause = input.cause;
  }
}

export class PublicSlugReservationError extends Error {
  readonly code = "PUBLIC_SLUG_RESERVATION_FAILED";

  constructor(message = "We couldn't reserve a public URL. Please try again.") {
    super(message);
  }
}

export class DraftNotFoundError extends Error {
  readonly draftId: string;

  constructor(draftId: string) {
    super(`Create Challenge draft not found: ${draftId}`);
    this.name = "DraftNotFoundError";
    this.draftId = draftId;
  }
}

export class StoreConflictError extends Error {
  constructor() {
    super("Create Challenge local store changed while saving. Please retry.");
    this.name = "StoreConflictError";
  }
}

export type FundingRecordScope = {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  preflightStatus: "NOT_CHECKED" | "CHECKED";
  approvalStatus: "NOT_STARTED" | "PENDING" | "APPROVED";
  fundingStatus: "NOT_STARTED" | "PENDING" | "FUNDED_VERIFIED";
  fundingVerified: boolean;
  eventVerified: boolean;
  published: boolean;
  updatedAt: string;
};

export type ApprovalAttemptStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "APPROVED";

export type ApprovalAttemptRecord = {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  purpose: "APPROVAL";
  sequence: number;
  idempotencyKey: string;
  circleChallengeId: string;
  circleStatus: ApprovalAttemptStatus;
  circleType?: string;
  circleTransactionId?: string;
  transactionHash?: string;
  errorCode?: string | number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type FundingAttemptStatus = ApprovalAttemptStatus;

export type FundingAttemptRecord = {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  purpose: "FUNDING";
  sequence: number;
  idempotencyKey: string;
  circleChallengeId: string;
  circleStatus: FundingAttemptStatus;
  circleType?: string;
  circleTransactionId?: string;
  transactionHash?: string;
  errorCode?: string | number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type OnChainVerificationRecord = {
  txHash: string;
  circleTransactionId: string;
  circleChallengeId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  walletId: string;
  ccnAccountId: string;
  eventType: "ChallengeFunded" | "ChallengePayout" | "ChallengeRefund";
  eventName?: "ChallengeFunded" | "WinnersPaid" | "ChallengeRefunded";
  runtimeContractAddress?: string;
  blockNumber: number | null;
  verifiedAt: string;
  receiptStatus?: "success";
  receiptVerified?: boolean;
  eventVerified?: boolean;
  challengeVerified?: boolean;
  sponsorVerified?: boolean;
  amountVerified?: boolean;
  submissionDeadline?: number;
  reviewDeadline?: number;
  winnersVerified?: boolean;
  feeVerified?: boolean;
  treasuryVerified?: boolean;
  finalContractStatus?: string;
  winnerWalletAddresses?: string[];
  payoutAmounts?: string[];
  platformFee?: string;
  treasuryRecipient?: string;
  orphaned?: boolean;
};

export type WinnerFinalizationAttemptRecord = {
  ccnAccountId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  lockId: string;
  idempotencyKey: string;
  operationKey?: string;
  operationOwnerToken?: string;
  approvalCreationStartedAt?: string;
  approvalCreatedAt?: string;
  state: WinnerFinalizationState;
  selectedWinnerEntryIds: string[];
  winnerWalletAddresses: string[];
  payoutWalletId?: string;
  payoutWalletAddress?: string;
  circleStatus?: string;
  circleChallengeId?: string;
  circleTransactionId?: string;
  transactionHash?: string;
  blockNumber?: number;
  receiptStatus?: "success";
  payoutConfirmedAt?: string;
  reconciliationSource?: "circle" | "blockchain-first";
  finalContractStatus?: string;
  lastCheckedAt?: string;
  reconciliation?: {
    receiptVerified?: boolean;
    eventVerified?: boolean;
    challengeVerified?: boolean;
    winnersVerified?: boolean;
    amountsVerified?: boolean;
    feeVerified?: boolean;
    treasuryVerified?: boolean;
  };
  finalizedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateChallengeDraftSummary = {
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  title: string;
  slug: string;
  brandName: string;
  currentStep: CreateChallengeStepId;
  category: string;
  coverImageKey: string | null;
  coverImageAlt: string | null;
  coverImageUpdatedAt: string | null;
  publicationStatus: CreateChallengeDraftState["deployment"]["publicationStatus"];
  fundingStatus: CreateChallengeDraftState["funding"]["fundingStatus"];
  escrowStatus: CreateChallengeDraftState["funding"]["escrowStatus"];
  eventVerified: boolean;
  transactionHash: string;
  winnerCount: 1 | 3;
  submissionDeadline: string;
  reviewDeadline: string;
  winnerFinalizationState: WinnerFinalizationState | null;
  winnerFinalizedAt: string | null;
  payoutConfirmedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type FundingIntentSnapshot = {
  ccnAccountId: string;
  challengeLogicalId: string;
  challengeId: `0x${string}`;
  fundingIntentId: string;
  approvalIdempotencyKey: string;
  fundingIdempotencyKey: string;
  escrowContractAddress: `0x${string}`;
  usdcContractAddress: `0x${string}`;
  prizeAmount: string;
  platformFee: string;
  totalRequired: string;
  submissionDeadline: number;
  reviewDeadline: number;
  winnerCount: 1 | 3;
  prizeDistribution: string[];
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return slug || "new-challenge";
}

function shouldReservePublicSlug(title: string) {
  const normalized = title.trim().toLowerCase();
  return normalized.length >= 3 && normalized !== "untitled draft" && normalized !== "untitled challenge";
}

function slugCandidate(base: string, offset: number) {
  if (offset === 0) return base;
  const suffix = `-${offset + 1}`;
  return `${base.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
}

function bytes32(seed: string): `0x${string}` {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

export function stableUuid(scope: string, seed: string) {
  const digest = createHash("sha256")
    .update(`ccn-create-challenge:${scope}:${seed}`)
    .digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

function withDerivedValues(
  draft: CreateChallengeDraftState,
): CreateChallengeDraftState {
  const canonicalDraft = canonicalizeDraftDeadlines(draft);
  const id = canonicalDraft.challenge.id ?? randomUUID();
  const challengeId = canonicalDraft.challenge.challengeId ?? bytes32(id);
  const prizePool = normalizePrizePool(canonicalDraft.prizePool);

  return {
    ...canonicalDraft,
    challenge: {
      ...canonicalDraft.challenge,
      id,
      slug: canonicalDraft.challenge.slug ?? slugify(canonicalDraft.challenge.title),
      challengeId,
    },
    prizePool,
    funding: {
      ...canonicalDraft.funding,
      fundingIntentId: canonicalDraft.funding.fundingIntentId || randomUUID(),
    },
    deployment: {
      ...canonicalDraft.deployment,
      challengeId,
    },
    updatedAt: new Date().toISOString(),
  };
}

function reservePublicSlugInStore(store: Store, draft: CreateChallengeDraftState) {
  const draftId = draft.challenge.id;
  if (!draftId || draft.deployment.publicationStatus === "live" || !shouldReservePublicSlug(draft.challenge.title)) {
    return { store, slug: draft.challenge.slug ?? slugify(draft.challenge.title), titleBasis: draft.challenge.slugReservedForTitle };
  }

  const titleBasis = slugify(draft.challenge.title);
  const existing = Object.values(store.publicSlugReservations ?? {}).find((reservation) => reservation.draftId === draftId);
  if (existing?.titleBasis === titleBasis) {
    return { store, slug: existing.slug, titleBasis };
  }

  const reservations = Object.fromEntries(
    Object.entries(store.publicSlugReservations ?? {}).filter(([, reservation]) => reservation.draftId !== draftId),
  );
  const occupied = new Set(Object.keys(reservations));
  for (const candidate of Object.values(store.drafts ?? {})) {
    if (candidate.challenge.id === draftId) continue;
    if (candidate.deployment.publicationStatus === "live" && candidate.challenge.slug) {
      occupied.add(candidate.challenge.slug);
    }
  }

  for (let offset = 0; offset < 500; offset += 1) {
    const slug = slugCandidate(titleBasis, offset);
    if (occupied.has(slug)) continue;
    const updatedAt = new Date().toISOString();
    return {
      store: {
        ...store,
        publicSlugReservations: {
          ...reservations,
          [slug]: { slug, draftId, titleBasis, updatedAt },
        },
      },
      slug,
      titleBasis,
    };
  }

  throw new PublicSlugReservationError();
}

function supabaseErrorCode(error: unknown) {
  return isRecord(error) && typeof error.code === "string" ? error.code : "";
}

async function reservePublicSlugInSupabase(draft: CreateChallengeDraftState) {
  const draftId = draft.challenge.id;
  if (!draftId || draft.deployment.publicationStatus === "live" || !shouldReservePublicSlug(draft.challenge.title)) {
    return { slug: draft.challenge.slug ?? slugify(draft.challenge.title), titleBasis: draft.challenge.slugReservedForTitle };
  }

  const supabase = createSupabaseAdminClient();
  const titleBasis = slugify(draft.challenge.title);
  const existing = await supabase
    .from("ccn_public_slug_reservations")
    .select("slug,title_basis")
    .eq("draft_id", draftId)
    .maybeSingle();
  if (existing.error) throw new PublicSlugReservationError();
  if (existing.data?.title_basis === titleBasis) {
    return { slug: existing.data.slug as string, titleBasis };
  }

  if (existing.data) {
    const removed = await supabase.from("ccn_public_slug_reservations").delete().eq("draft_id", draftId);
    if (removed.error) throw new PublicSlugReservationError();
  }

  for (let offset = 0; offset < 500; offset += 1) {
    const slug = slugCandidate(titleBasis, offset);
    const inserted = await supabase.from("ccn_public_slug_reservations").insert({
      slug,
      draft_id: draftId,
      title_basis: titleBasis,
    });
    if (!inserted.error) return { slug, titleBasis };
    if (supabaseErrorCode(inserted.error) !== "23505") throw new PublicSlugReservationError();

    const current = await supabase
      .from("ccn_public_slug_reservations")
      .select("slug,title_basis")
      .eq("draft_id", draftId)
      .maybeSingle();
    if (!current.error && current.data?.title_basis === titleBasis) {
      return { slug: current.data.slug as string, titleBasis };
    }
  }

  throw new PublicSlugReservationError();
}

async function reservePublicSlug(store: Store, draft: CreateChallengeDraftState) {
  if (LIFECYCLE_PERSISTENCE_ADAPTER === "supabase") {
    const reservation = await reservePublicSlugInSupabase(draft);
    return {
      store,
      draft: {
        ...draft,
        challenge: {
          ...draft.challenge,
          slug: reservation.slug,
          slugReservedForTitle: reservation.titleBasis,
        },
      },
    };
  }

  const reservation = reservePublicSlugInStore(store, draft);
  return {
    store: reservation.store,
    draft: {
      ...draft,
      challenge: {
        ...draft.challenge,
        slug: reservation.slug,
        slugReservedForTitle: reservation.titleBasis,
      },
    },
  };
}

function cleanTransactionState(
  draft: CreateChallengeDraftState,
  resetStep = true,
): CreateChallengeDraftState {
  return {
    ...draft,
    funding: {
      ...draft.funding,
      walletId: "",
      walletAddress: "",
      availableBalance: 0,
      approvalTransactionId: "",
      approvalTransactionHash: "",
      transactionId: "",
      transactionHash: "",
      fundingBlockNumber: undefined,
      fundingLogIndex: undefined,
      eventVerified: false,
      fundingStatus: "not-started",
      escrowStatus: "not-created",
      lastBalanceRefreshAt: "",
    },
    deployment: {
      ...draft.deployment,
      status: "draft",
      currentStep: resetStep ? "basics" : draft.deployment.currentStep,
      errorMessage: "",
      publicationStatus: "draft",
    },
  };
}

function withInitialBrandName(draft: CreateChallengeDraftState, brandName?: string | null) {
  const cleanBrandName = brandName?.trim();
  if (!cleanBrandName || draft.challenge.brandName.trim()) return draft;
  return {
    ...draft,
    challenge: {
      ...draft.challenge,
      brandName: cleanBrandName,
    },
  };
}

function createCleanDraft() {
  const draftId = randomUUID();
  return withDerivedValues(
    cleanTransactionState({
      ...demoCreateChallengeDraft,
      challenge: {
        ...demoCreateChallengeDraft.challenge,
        id: draftId,
        challengeId: bytes32(draftId),
        slug: "new-challenge",
      },
      funding: {
        ...demoCreateChallengeDraft.funding,
        fundingIntentId: randomUUID(),
      },
      deployment: {
        ...demoCreateChallengeDraft.deployment,
        challengeId: bytes32(draftId),
      },
    }),
  );
}

function toServerLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createCleanSmokeTestDraft() {
  const policy = getCreateChallengeDeadlinePolicy({
    runtimeBlockchain: "ARC-TESTNET",
    chainId: ARC_TESTNET_CHAIN_ID,
    isSmokeTestChallenge: true,
  });
  if (policy.mode !== "smoke") {
    throw new Error("Arc Testnet smoke challenge mode is not enabled.");
  }

  const nowMs = Date.now();
  const inputPrecisionBufferMs = 60_000;
  const submissionDeadline = new Date(nowMs + policy.minimumSubmissionLeadMinutes * 60 * 1000 + inputPrecisionBufferMs);
  const reviewDeadline = new Date(submissionDeadline.getTime() + policy.minimumReviewGapMinutes * 60 * 1000 + inputPrecisionBufferMs);
  const draft = createCleanDraft();
  return withDerivedValues({
    ...draft,
    challenge: {
      ...draft.challenge,
      isSmokeTest: true,
    },
    reviewRules: {
      ...draft.reviewRules,
      submissionDeadline: toServerLocalDateTimeInput(submissionDeadline),
      reviewDeadline: toServerLocalDateTimeInput(reviewDeadline),
    },
  });
}

export function fundingRecordKey(input: {
  ccnAccountId: string;
  walletId?: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  return [
    input.ccnAccountId,
    input.walletId || "unassigned",
    input.draftId,
    input.challengeId,
    input.fundingIntentId,
  ].join(":");
}

export function approvalAttemptScopeKey(input: {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  return [
    input.ccnAccountId,
    input.walletId,
    input.draftId,
    input.challengeId,
    input.fundingIntentId,
    "APPROVAL",
  ].join(":");
}

export function fundingAttemptScopeKey(input: {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  return [
    input.ccnAccountId,
    input.walletId,
    input.draftId,
    input.challengeId,
    input.fundingIntentId,
    "FUNDING",
  ].join(":");
}

export function winnerFinalizationAttemptScopeKey(input: {
  ccnAccountId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  return [
    input.ccnAccountId,
    input.draftId,
    input.challengeId.toLowerCase(),
    input.fundingIntentId,
    "WINNER_FINALIZATION",
  ].join(":");
}

function fundingRecordFromDraft(
  draft: CreateChallengeDraftState,
  ccnAccountId = CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
): FundingRecordScope {
  const normalized = withDerivedValues(draft);
  return {
    ccnAccountId,
    walletId: normalized.funding.walletId || "unassigned",
    draftId: normalized.challenge.id ?? "",
    challengeId: normalized.challenge.challengeId ?? normalized.deployment.challengeId,
    fundingIntentId: normalized.funding.fundingIntentId,
    preflightStatus: normalized.funding.lastBalanceRefreshAt ? "CHECKED" : "NOT_CHECKED",
    approvalStatus:
      normalized.funding.fundingStatus === "approved" ? "APPROVED" :
      normalized.funding.fundingStatus === "approval-pending" ? "PENDING" :
      "NOT_STARTED",
    fundingStatus:
      normalized.deployment.publicationStatus === "ready-to-publish" ||
      normalized.deployment.publicationStatus === "live"
        ? "FUNDED_VERIFIED"
        : normalized.funding.fundingStatus === "funding-pending"
          ? "PENDING"
          : "NOT_STARTED",
    fundingVerified: normalized.deployment.publicationStatus === "ready-to-publish" || normalized.deployment.publicationStatus === "live",
    eventVerified: normalized.deployment.publicationStatus === "ready-to-publish" || normalized.deployment.publicationStatus === "live",
    published: normalized.deployment.publicationStatus === "live",
    updatedAt: new Date().toISOString(),
  };
}

function withFundingRecord(
  store: Store,
  draft: CreateChallengeDraftState,
  ccnAccountId = CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
): Store {
  const record = fundingRecordFromDraft(draft, ccnAccountId);
  const key = fundingRecordKey(record);
  return {
    ...store,
    fundingRecords: {
      ...(store.fundingRecords ?? {}),
      [key]: record,
    },
  };
}

function sanitizeStoredDraft(draft: CreateChallengeDraftState) {
  const normalized = withDerivedValues(draft);
  const hasTransactionReference = Boolean(
    normalized.funding.approvalTransactionId ||
      normalized.funding.approvalTransactionHash ||
      normalized.funding.transactionId ||
      normalized.funding.transactionHash,
  );
  const transactionMatchesCurrentScope =
    normalized.funding.fundingStatus === "approval-pending" ||
    normalized.funding.fundingStatus === "funding-pending" ||
    normalized.funding.fundingStatus === "approved" ||
    normalized.funding.fundingStatus === "funded" ||
    normalized.funding.fundingStatus === "live";

  if (hasTransactionReference && !transactionMatchesCurrentScope) {
    return cleanTransactionState(normalized, false);
  }

  return normalized;
}

function logStorePathOnce() {
  if (storePathLogged) return;
  storePathLogged = true;
  console.info("[ccn-create-challenge-store]", {
    storePath: LIFECYCLE_PERSISTENCE_ADAPTER === "filesystem" ? CREATE_CHALLENGE_STORE_PATH : undefined,
    persistence: LIFECYCLE_PERSISTENCE_ADAPTER,
    productionWarning:
      LIFECYCLE_PERSISTENCE_ADAPTER === "filesystem"
        ? "Filesystem persistence is for local deterministic tests and explicit local development only."
        : undefined,
  });
}

function assertPersistenceAdapter() {
  if (LIFECYCLE_PERSISTENCE_ADAPTER !== "filesystem" && LIFECYCLE_PERSISTENCE_ADAPTER !== "supabase") {
    throw new Error("CCN_LIFECYCLE_PERSISTENCE must be either filesystem or supabase.");
  }
  if (IS_MANAGED_PRODUCTION && LIFECYCLE_PERSISTENCE_ADAPTER !== "supabase") {
    throw new Error("Production lifecycle persistence must use Supabase/Postgres. Set CCN_LIFECYCLE_PERSISTENCE=supabase.");
  }
}

function withRuntimeIndexes(store: Store): Store {
  return {
    ...store,
    fundingRecords: store.fundingRecords ?? {},
    approvalAttempts: store.approvalAttempts ?? {},
    fundingAttempts: store.fundingAttempts ?? {},
    winnerFinalizationAttempts: store.winnerFinalizationAttempts ?? {},
    onChainVerificationsByTxHash: store.onChainVerificationsByTxHash ?? {},
  };
}

async function fileExists(path: string) {
  try {
    await (await filesystem()).access(path);
    return true;
  } catch {
    return false;
  }
}

function emptyStore(): Store {
  return {
    version: STORE_VERSION,
    revision: 0,
    activeDraftId: undefined,
    drafts: {},
    publicSlugReservations: {},
    fundingRecords: {},
    approvalAttempts: {},
    fundingAttempts: {},
    winnerFinalizationAttempts: {},
    onChainVerificationsByTxHash: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validateStoreShape(value: unknown): Store {
  if (!isRecord(value)) {
    throw new Error("Store root must be an object.");
  }

  const activeDraftId = value.activeDraftId;
  if (typeof activeDraftId !== "undefined" && activeDraftId !== null && typeof activeDraftId !== "string") {
    throw new Error("activeDraftId must be a string or null.");
  }

  for (const key of ["drafts", "publicSlugReservations", "fundingRecords", "approvalAttempts", "fundingAttempts", "winnerFinalizationAttempts", "onChainVerificationsByTxHash"]) {
    const item = value[key];
    if (typeof item !== "undefined" && !isRecord(item)) {
      throw new Error(`${key} must be an object when present.`);
    }
  }

  if (typeof value.version !== "undefined" && typeof value.version !== "number") {
    throw new Error("version must be a number when present.");
  }
  if (typeof value.revision !== "undefined" && typeof value.revision !== "number") {
    throw new Error("revision must be a number when present.");
  }

  return value as Store;
}

function normalizeStoreInMemory(input: Store): Store {
  const drafts = { ...(input.drafts ?? {}) };
  let activeDraftId = input.activeDraftId;

  if (input.draft) {
    const migrated = sanitizeStoredDraft(input.draft);
    const draftId = migrated.challenge.id ?? randomUUID();
    if (!drafts[draftId]) drafts[draftId] = migrated;
    activeDraftId = activeDraftId ?? draftId;
  }

  if (activeDraftId && !drafts[activeDraftId]) {
    activeDraftId = undefined;
  }

  let normalized: Store = withRuntimeIndexes({
    version: input.version ?? STORE_VERSION,
    revision: input.revision ?? 0,
    activeDraftId,
    drafts,
    publicSlugReservations: input.publicSlugReservations ?? {},
    fundingRecords: input.fundingRecords ?? {},
    approvalAttempts: input.approvalAttempts ?? {},
    fundingAttempts: input.fundingAttempts ?? {},
    winnerFinalizationAttempts: input.winnerFinalizationAttempts ?? {},
    onChainVerificationsByTxHash: input.onChainVerificationsByTxHash ?? {},
  });
  Object.values(drafts).forEach((draft) => {
    normalized = withFundingRecord(normalized, draft);
  });
  return normalized;
}

async function readStore(): Promise<Store> {
  assertPersistenceAdapter();
  logStorePathOnce();
  if (LIFECYCLE_PERSISTENCE_ADAPTER === "supabase") return readSupabaseStore();
  const exists = await fileExists(CREATE_CHALLENGE_STORE_PATH);
  if (!exists) return emptyStore();

  try {
    const { readFile } = await filesystem();
    const raw = await readFile(CREATE_CHALLENGE_STORE_PATH, "utf8");
    return normalizeStoreInMemory(validateStoreShape(JSON.parse(raw)));
  } catch (error) {
    const { stat } = await filesystem();
    const info = await stat(CREATE_CHALLENGE_STORE_PATH).catch(() => null);
    console.error("[ccn-create-challenge-store]", {
      storePath: CREATE_CHALLENGE_STORE_PATH,
      size: info?.size ?? null,
      message: "Local store read/parse failed. Refusing to overwrite the store.",
    });
    throw new StoreCorruptionError({
      path: CREATE_CHALLENGE_STORE_PATH,
      size: info?.size ?? null,
      cause: error,
    });
  }
}

async function backupCurrentStore() {
  if (!(await fileExists(CREATE_CHALLENGE_STORE_PATH))) return;
  const { copyFile, mkdir, readdir, rm } = await filesystem();
  await mkdir(CREATE_CHALLENGE_BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await copyFile(CREATE_CHALLENGE_STORE_PATH, CREATE_CHALLENGE_LAST_KNOWN_GOOD_PATH);
  await copyFile(
    CREATE_CHALLENGE_STORE_PATH,
    join(CREATE_CHALLENGE_BACKUP_DIR, `create-challenge-flow-${timestamp}.json`),
  );

  const backups = await readdir(CREATE_CHALLENGE_BACKUP_DIR).then(
    (items) => items.filter((item) => /^create-challenge-flow-\d{4}/.test(item)).sort(),
    () => [],
  );
  const removable = backups.slice(0, Math.max(0, backups.length - STORE_BACKUP_KEEP));
  await Promise.all(removable.map((name) => rm(join(CREATE_CHALLENGE_BACKUP_DIR, name), { force: true })));
}

async function atomicWriteStore(store: Store) {
  assertPersistenceAdapter();
  logStorePathOnce();
  if (LIFECYCLE_PERSISTENCE_ADAPTER === "supabase") {
    await writeSupabaseStore(store);
    return;
  }
  const { mkdir, open, readFile, rename, rm } = await filesystem();
  await mkdir(dirname(CREATE_CHALLENGE_STORE_PATH), { recursive: true });
  await backupCurrentStore();

  const tempPath = join(
    dirname(CREATE_CHALLENGE_STORE_PATH),
    `.create-challenge-flow.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );
  const payload = JSON.stringify(store, null, 2);
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(tempPath, "w");
    await handle.writeFile(payload, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    validateStoreShape(JSON.parse(await readFile(tempPath, "utf8")));
    await rename(tempPath, CREATE_CHALLENGE_STORE_PATH);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function readSupabaseStore(): Promise<Store> {
  const supabase = createSupabaseAdminClient();
  const [
    drafts,
    fundingRecords,
    approvalAttempts,
    fundingAttempts,
    winnerAttempts,
    verifications,
  ] = await Promise.all([
    supabase.from("ccn_challenge_drafts").select("draft_id,updated_at,draft_state"),
    supabase.from("ccn_challenge_funding_records").select("record_key,record_state"),
    supabase.from("ccn_wallet_approval_attempts").select("scope_key,attempt_state"),
    supabase.from("ccn_funding_attempts").select("scope_key,attempt_state"),
    supabase.from("ccn_winner_finalization_attempts").select("scope_key,attempt_state"),
    supabase.from("ccn_onchain_verifications").select("tx_hash,verification_state"),
  ]);

  for (const result of [drafts, fundingRecords, approvalAttempts, fundingAttempts, winnerAttempts, verifications]) {
    if (result.error) throw result.error;
  }

  const store: Store = emptyStore();
  for (const row of drafts.data ?? []) {
    const draft = row.draft_state as CreateChallengeDraftState;
    store.drafts![row.draft_id] =
      draft.deployment?.publicationStatus === "live" && !draft.deployment.publishedAt && row.updated_at
        ? {
            ...draft,
            deployment: {
              ...draft.deployment,
              publishedAt: row.updated_at as string,
            },
          }
        : draft;
  }
  for (const row of fundingRecords.data ?? []) {
    store.fundingRecords![row.record_key] = row.record_state as FundingRecordScope;
  }
  for (const row of approvalAttempts.data ?? []) {
    const attempt = row.attempt_state as ApprovalAttemptRecord;
    const current = store.approvalAttempts![row.scope_key] ?? [];
    store.approvalAttempts![row.scope_key] = [...current, attempt].sort((a, b) => a.sequence - b.sequence);
  }
  for (const row of fundingAttempts.data ?? []) {
    const attempt = row.attempt_state as FundingAttemptRecord;
    const current = store.fundingAttempts![row.scope_key] ?? [];
    store.fundingAttempts![row.scope_key] = [...current, attempt].sort((a, b) => a.sequence - b.sequence);
  }
  for (const row of winnerAttempts.data ?? []) {
    store.winnerFinalizationAttempts![row.scope_key] = row.attempt_state as WinnerFinalizationAttemptRecord;
  }
  for (const row of verifications.data ?? []) {
    store.onChainVerificationsByTxHash![row.tx_hash] = row.verification_state as OnChainVerificationRecord;
  }

  return normalizeStoreInMemory(store);
}

function nonEmptyPersistenceValue(value: string | undefined | null) {
  return typeof value === "string" && value.trim() ? value : null;
}

async function writeSupabaseStore(store: Store) {
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeStoreInMemory(store);
  const drafts = Object.entries(normalized.drafts ?? {}).map(([draftId, draft]) => ({
    draft_id: draftId,
    challenge_id: draft.challenge.challengeId,
    funding_intent_id: draft.funding.fundingIntentId,
    slug: draft.challenge.slug,
    title: draft.challenge.title,
    brand_name: draft.challenge.brandName,
    cover_image_key: draft.challenge.coverImageKey ?? null,
    cover_image_alt: draft.challenge.coverImageAlt ?? null,
    cover_image_updated_at: draft.challenge.coverImageUpdatedAt ?? null,
    publication_status: draft.deployment.publicationStatus,
    funding_status: draft.funding.fundingStatus,
    escrow_status: draft.funding.escrowStatus,
    event_verified: draft.funding.eventVerified,
    draft_state: draft,
    updated_at: draft.updatedAt ?? new Date().toISOString(),
  }));
  const fundingRows = Object.entries(normalized.fundingRecords ?? {}).map(([recordKey, record]) => ({
    record_key: recordKey,
    ccn_account_id: record.ccnAccountId,
    wallet_id: record.walletId,
    draft_id: record.draftId,
    challenge_id: record.challengeId,
    funding_intent_id: record.fundingIntentId,
    funding_verified: record.fundingVerified,
    event_verified: record.eventVerified,
    published: record.published,
    record_state: record,
    updated_at: record.updatedAt,
  }));
  const approvalRows = Object.entries(normalized.approvalAttempts ?? {}).flatMap(([scopeKey, attempts]) =>
    attempts.map((attempt) => ({
      scope_key: scopeKey,
      circle_challenge_id: nonEmptyPersistenceValue(attempt.circleChallengeId),
      sequence: attempt.sequence,
      ccn_account_id: attempt.ccnAccountId,
      wallet_id: attempt.walletId,
      draft_id: attempt.draftId,
      challenge_id: attempt.challengeId,
      funding_intent_id: attempt.fundingIntentId,
      circle_status: attempt.circleStatus,
      circle_transaction_id: nonEmptyPersistenceValue(attempt.circleTransactionId),
      transaction_hash: nonEmptyPersistenceValue(attempt.transactionHash),
      idempotency_key: attempt.idempotencyKey,
      attempt_state: attempt,
      updated_at: attempt.updatedAt,
    })),
  );
  const fundingAttemptRows = Object.entries(normalized.fundingAttempts ?? {}).flatMap(([scopeKey, attempts]) =>
    attempts.map((attempt) => ({
      scope_key: scopeKey,
      circle_challenge_id: nonEmptyPersistenceValue(attempt.circleChallengeId),
      sequence: attempt.sequence,
      ccn_account_id: attempt.ccnAccountId,
      wallet_id: attempt.walletId,
      draft_id: attempt.draftId,
      challenge_id: attempt.challengeId,
      funding_intent_id: attempt.fundingIntentId,
      circle_status: attempt.circleStatus,
      circle_transaction_id: nonEmptyPersistenceValue(attempt.circleTransactionId),
      transaction_hash: nonEmptyPersistenceValue(attempt.transactionHash),
      idempotency_key: attempt.idempotencyKey,
      attempt_state: attempt,
      updated_at: attempt.updatedAt,
    })),
  );
  const winnerRows = Object.entries(normalized.winnerFinalizationAttempts ?? {}).map(([scopeKey, attempt]) => ({
    scope_key: scopeKey,
    ccn_account_id: attempt.ccnAccountId,
    draft_id: attempt.draftId,
    challenge_id: attempt.challengeId,
    funding_intent_id: attempt.fundingIntentId,
    state: attempt.state,
    circle_challenge_id: nonEmptyPersistenceValue(attempt.circleChallengeId),
    circle_transaction_id: nonEmptyPersistenceValue(attempt.circleTransactionId),
    transaction_hash: nonEmptyPersistenceValue(attempt.transactionHash),
    idempotency_key: attempt.idempotencyKey,
    attempt_state: attempt,
    updated_at: attempt.updatedAt,
  }));
  const verificationRows = Object.entries(normalized.onChainVerificationsByTxHash ?? {}).map(([txHash, record]) => ({
    tx_hash: txHash,
    circle_transaction_id: record.circleTransactionId,
    circle_challenge_id: record.circleChallengeId,
    draft_id: record.draftId,
    challenge_id: record.challengeId,
    funding_intent_id: record.fundingIntentId,
    event_type: record.eventType,
    receipt_verified: record.receiptVerified ?? false,
    event_verified: record.eventVerified ?? false,
    challenge_verified: record.challengeVerified ?? false,
    verification_state: record,
    verified_at: record.verifiedAt,
  }));

  if (drafts.length) {
    const { error } = await supabase.from("ccn_challenge_drafts").upsert(drafts, { onConflict: "draft_id" });
    if (error) throw error;
  }
  if (fundingRows.length) {
    const { error } = await supabase.from("ccn_challenge_funding_records").upsert(fundingRows, { onConflict: "record_key" });
    if (error) throw error;
  }
  if (approvalRows.length) {
    const { error } = await supabase.from("ccn_wallet_approval_attempts").upsert(approvalRows, { onConflict: "scope_key,circle_challenge_id" });
    if (error) throw error;
  }
  if (fundingAttemptRows.length) {
    const { error } = await supabase.from("ccn_funding_attempts").upsert(fundingAttemptRows, { onConflict: "scope_key,circle_challenge_id" });
    if (error) throw error;
  }
  if (winnerRows.length) {
    const { error } = await supabase.from("ccn_winner_finalization_attempts").upsert(winnerRows, { onConflict: "scope_key" });
    if (error) throw error;
  }
  if (verificationRows.length) {
    const { error } = await supabase.from("ccn_onchain_verifications").upsert(verificationRows, { onConflict: "tx_hash" });
    if (error) throw error;
  }
}

async function writeStore(store: Store, expectedRevision: number) {
  const latest = await readStore();
  if ((latest.revision ?? 0) !== expectedRevision) {
    throw new StoreConflictError();
  }
  await atomicWriteStore(normalizeStoreInMemory({
    ...store,
    version: STORE_VERSION,
    revision: expectedRevision + 1,
  }));
}

async function updateStore(mutator: (store: Store) => Store | Promise<Store>) {
  const run = async () => {
    for (let attempt = 0; attempt < STORE_WRITE_RETRIES; attempt += 1) {
      const current = await readStore();
      const revision = current.revision ?? 0;
      const next = await mutator(current);
      try {
        await writeStore(next, revision);
        return normalizeStoreInMemory({ ...next, revision: revision + 1, version: STORE_VERSION });
      } catch (error) {
        if (error instanceof StoreConflictError && attempt < STORE_WRITE_RETRIES - 1) continue;
        throw error;
      }
    }
    throw new StoreConflictError();
  };
  const result = storeWriteQueue.then(run, run);
  storeWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function normalizeStore() {
  return readStore();
}

function winnerAttemptForDraft(store: Store, input: { draftId: string; challengeId: string; fundingIntentId: string }) {
  return Object.values(store.winnerFinalizationAttempts ?? {}).find((attempt) =>
    attempt.draftId === input.draftId &&
    attempt.challengeId.toLowerCase() === input.challengeId.toLowerCase() &&
    attempt.fundingIntentId === input.fundingIntentId
  ) ?? null;
}

export async function listCreateChallengeDrafts(input: { ccnAccountId?: string } = {}) {
  const store = await normalizeStore();
  const allowedDraftIds = input.ccnAccountId
    ? new Set(
        Object.values(store.fundingRecords ?? {})
          .filter((record) => record.ccnAccountId === input.ccnAccountId)
          .map((record) => record.draftId),
      )
    : null;
  return Object.values(store.drafts ?? {})
    .filter((draft) => !allowedDraftIds || allowedDraftIds.has(draft.challenge.id ?? ""))
    .map((draft) => {
      const normalized = withDerivedValues(draft);
      const draftId = normalized.challenge.id ?? "";
      const challengeId = normalized.challenge.challengeId ?? "";
      const fundingIntentId = normalized.funding.fundingIntentId;
      const winnerAttempt = winnerAttemptForDraft(store, { draftId, challengeId, fundingIntentId });
      return {
        draftId,
        challengeId,
        fundingIntentId,
        title: normalized.challenge.title || "Untitled challenge",
        slug: normalized.challenge.slug ?? "",
        brandName: normalized.challenge.brandName || "Brand not set",
        currentStep: normalized.deployment.currentStep,
        category: normalized.challenge.category || "Creative",
        coverImageKey: normalized.challenge.coverImageKey ?? null,
        coverImageAlt: normalized.challenge.coverImageAlt ?? null,
        coverImageUpdatedAt: normalized.challenge.coverImageUpdatedAt ?? null,
        publicationStatus: normalized.deployment.publicationStatus,
        fundingStatus: normalized.funding.fundingStatus,
        escrowStatus: normalized.funding.escrowStatus,
        eventVerified: normalized.funding.eventVerified ?? false,
        transactionHash: normalized.funding.transactionHash,
        winnerCount: normalized.prizePool.winnerCount,
        submissionDeadline: normalized.reviewRules.submissionDeadline,
        reviewDeadline: normalized.reviewRules.reviewDeadline,
        winnerFinalizationState: winnerAttempt?.state ?? null,
        winnerFinalizedAt: winnerAttempt?.finalizedAt ?? null,
        payoutConfirmedAt: winnerAttempt?.payoutConfirmedAt ?? null,
        publishedAt: normalized.deployment.publishedAt ?? null,
        updatedAt: normalized.updatedAt ?? "",
      } satisfies CreateChallengeDraftSummary;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listCreateChallengeDraftStates(input: { ccnAccountId?: string } = {}) {
  const store = await normalizeStore();
  const allowedDraftIds = input.ccnAccountId
    ? new Set(
        Object.values(store.fundingRecords ?? {})
          .filter((record) => record.ccnAccountId === input.ccnAccountId)
          .map((record) => record.draftId),
      )
    : null;

  return Object.values(store.drafts ?? {})
    .map((draft) => sanitizeStoredDraft(draft))
    .filter((draft) => !allowedDraftIds || allowedDraftIds.has(draft.challenge.id ?? ""))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export async function createNewCreateChallengeDraft(input: { ccnAccountId?: string; brandName?: string | null } = {}) {
  const draft = withInitialBrandName(createCleanDraft(), input.brandName);
  const draftId = draft.challenge.id ?? randomUUID();
  await updateStore((store) => withFundingRecord({
    ...store,
    activeDraftId: draftId,
    drafts: {
      ...(store.drafts ?? {}),
      [draftId]: draft,
    },
  }, draft, input.ccnAccountId));
  return draft;
}

export async function createNewSmokeTestCreateChallengeDraft(input: { ccnAccountId?: string; brandName?: string | null } = {}) {
  const draft = withInitialBrandName(createCleanSmokeTestDraft(), input.brandName);
  const draftId = draft.challenge.id ?? randomUUID();
  await updateStore((store) => withFundingRecord({
    ...store,
    activeDraftId: draftId,
    drafts: {
      ...(store.drafts ?? {}),
      [draftId]: draft,
    },
  }, draft, input.ccnAccountId));
  return draft;
}

export async function getCreateChallengeDraft(draftId?: string) {
  const store = await normalizeStore();
  if (!draftId) {
    throw new DraftNotFoundError("missing-draft-id");
  }
  const draft = store.drafts?.[draftId];
  if (!draft) throw new DraftNotFoundError(draftId);
  return sanitizeStoredDraft(draft);
}

export async function getCreateChallengeDraftStrict(draftId: string) {
  if (!draftId) throw new Error("draftId is required.");
  return getCreateChallengeDraft(draftId);
}

export async function assertCreateChallengeDraftOwner(draftId: string, ccnAccountId: string) {
  const store = await normalizeStore();
  const owned = Object.values(store.fundingRecords ?? {}).some(
    (record) => record.draftId === draftId && record.ccnAccountId === ccnAccountId,
  );
  if (!owned) throw new DraftNotFoundError(draftId);
}

export async function getCreateChallengeDraftOwnerAccountId(draftId: string) {
  const store = await normalizeStore();
  const record = Object.values(store.fundingRecords ?? {}).find((item) => item.draftId === draftId);
  return record?.ccnAccountId ?? null;
}

export async function getCreateChallengeDraftForAccount(draftId: string, ccnAccountId: string) {
  await assertCreateChallengeDraftOwner(draftId, ccnAccountId);
  return getCreateChallengeDraftStrict(draftId);
}

export async function ensureCreateChallengeDraftPublicSlugReservation(
  draftId: string,
  input: { ccnAccountId?: string } = {},
) {
  if (input.ccnAccountId) await assertCreateChallengeDraftOwner(draftId, input.ccnAccountId);
  let normalized!: CreateChallengeDraftState;
  await updateStore(async (store) => {
    const current = store.drafts?.[draftId];
    if (!current) throw new DraftNotFoundError(draftId);
    const reservation = await reservePublicSlug(store, withDerivedValues(current));
    normalized = reservation.draft;
    return {
      ...reservation.store,
      drafts: {
        ...(reservation.store.drafts ?? {}),
        [draftId]: normalized,
      },
    };
  });
  return normalized;
}

export async function upsertOnChainVerification(record: OnChainVerificationRecord) {
  await updateStore((store) => ({
    ...store,
    onChainVerificationsByTxHash: {
      ...(store.onChainVerificationsByTxHash ?? {}),
      [record.txHash]: { ...record, verifiedAt: record.verifiedAt || new Date().toISOString() },
    },
  }));
  return record;
}

export async function upsertLifecycleEvent(input: {
  draftId: string;
  challengeId: string;
  eventType: string;
  eventState: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const eventId = stableUuid("lifecycle-event", [
    input.draftId,
    input.challengeId.toLowerCase(),
    input.eventType,
  ].join("|"));

  if (LIFECYCLE_PERSISTENCE_ADAPTER !== "supabase") {
    return {
      eventId,
      draftId: input.draftId,
      challengeId: input.challengeId,
      eventType: input.eventType,
      createdAt: now,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("ccn_lifecycle_events").upsert({
    event_id: eventId,
    draft_id: input.draftId,
    challenge_id: input.challengeId,
    event_type: input.eventType,
    metadata: {
      ...input.eventState,
      idempotencyKey: eventId,
    },
    created_at: now,
  }, { onConflict: "event_id" });
  if (error) throw error;

  return {
    eventId,
    draftId: input.draftId,
    challengeId: input.challengeId,
    eventType: input.eventType,
    createdAt: now,
  };
}

export async function findOnChainVerificationForDraft(input: { draftId: string; challengeId: string; fundingIntentId: string }) {
  const store = await normalizeStore();
  return Object.values(store.onChainVerificationsByTxHash ?? {}).find(
    (record) =>
      record.draftId === input.draftId &&
      record.challengeId.toLowerCase() === input.challengeId.toLowerCase() &&
      record.fundingIntentId === input.fundingIntentId,
  ) ?? null;
}

export async function listOnChainVerificationsForDraft(input: {
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  const store = await normalizeStore();
  return Object.values(store.onChainVerificationsByTxHash ?? {})
    .filter(
      (record) =>
        record.draftId === input.draftId &&
        record.challengeId.toLowerCase() === input.challengeId.toLowerCase() &&
        record.fundingIntentId === input.fundingIntentId,
    )
    .sort((a, b) => (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? ""));
}

export async function saveCreateChallengeDraft(
  draft: CreateChallengeDraftState,
  draftId?: string,
  input: { ccnAccountId?: string } = {},
) {
  const targetDraftId = draftId || draft.challenge.id;
  if (!targetDraftId) throw new DraftNotFoundError("missing-draft-id");
  let normalized!: CreateChallengeDraftState;
  await updateStore(async (store) => {
    const current = store.drafts?.[targetDraftId];
    if (!current) throw new DraftNotFoundError(targetDraftId);
    const preserveExistingCover = Boolean(current.challenge.coverImageKey) && !draft.challenge.coverImageKey;
    const merged = withDerivedValues({
      ...current,
      ...draft,
      challenge: {
        ...current.challenge,
        ...draft.challenge,
        ...(preserveExistingCover
          ? {
              coverImageKey: current.challenge.coverImageKey,
              coverImageAlt: current.challenge.coverImageAlt,
              coverImageUpdatedAt: current.challenge.coverImageUpdatedAt,
            }
          : {}),
        isSmokeTest: current.challenge.isSmokeTest,
        slug: current.deployment.publicationStatus === "live"
          ? current.challenge.slug
          : draft.challenge.slug ?? current.challenge.slug,
      },
      prizePool: {
        ...current.prizePool,
        ...draft.prizePool,
        winnerCount: draft.prizePool.winnerCount,
      },
      reviewRules: { ...current.reviewRules, ...draft.reviewRules },
      funding: { ...current.funding, ...draft.funding },
      deployment: { ...current.deployment, ...draft.deployment },
    });
    const reservation = await reservePublicSlug(store, merged);
    normalized = reservation.draft;
    return withFundingRecord({
      ...reservation.store,
      activeDraftId: targetDraftId,
      drafts: {
        ...(reservation.store.drafts ?? {}),
        [targetDraftId]: normalized,
      },
    }, normalized, input.ccnAccountId);
  });
  return normalized;
}

export async function listApprovalAttemptsForScope(input: {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  const store = await normalizeStore();
  const key = approvalAttemptScopeKey(input);
  return [...(store.approvalAttempts?.[key] ?? [])].sort((a, b) => a.sequence - b.sequence);
}

export async function upsertApprovalAttemptForScope(input: {
  scope: {
    ccnAccountId: string;
    walletId: string;
    draftId: string;
    challengeId: string;
    fundingIntentId: string;
  };
  attempt: Omit<ApprovalAttemptRecord, "sequence" | "createdAt" | "updatedAt"> & Partial<Pick<ApprovalAttemptRecord, "sequence" | "createdAt" | "updatedAt">>;
}) {
  const key = approvalAttemptScopeKey(input.scope);
  const now = new Date().toISOString();
  let next!: ApprovalAttemptRecord;
  await updateStore((store) => {
    const current = [...(store.approvalAttempts?.[key] ?? [])];
    const index = current.findIndex((item) => item.circleChallengeId === input.attempt.circleChallengeId);
    const existing = index >= 0 ? current[index] : null;
    next = {
      ...input.attempt,
      sequence: existing?.sequence ?? input.attempt.sequence ?? current.length + 1,
      createdAt: existing?.createdAt ?? input.attempt.createdAt ?? now,
      updatedAt: now,
    };
    if (index >= 0) current[index] = { ...existing, ...next };
    else current.push(next);
    return {
      ...store,
      approvalAttempts: {
        ...(store.approvalAttempts ?? {}),
        [key]: current.sort((a, b) => a.sequence - b.sequence),
      },
    };
  });
  return next;
}

export async function listFundingAttemptsForScope(input: {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  const store = await normalizeStore();
  const key = fundingAttemptScopeKey(input);
  return [...(store.fundingAttempts?.[key] ?? [])].sort((a, b) => a.sequence - b.sequence);
}

export async function upsertFundingAttemptForScope(input: {
  scope: {
    ccnAccountId: string;
    walletId: string;
    draftId: string;
    challengeId: string;
    fundingIntentId: string;
  };
  attempt: Omit<FundingAttemptRecord, "sequence" | "createdAt" | "updatedAt"> & Partial<Pick<FundingAttemptRecord, "sequence" | "createdAt" | "updatedAt">>;
}) {
  const key = fundingAttemptScopeKey(input.scope);
  const now = new Date().toISOString();
  let next!: FundingAttemptRecord;
  await updateStore((store) => {
    const current = [...(store.fundingAttempts?.[key] ?? [])];
    const index = current.findIndex((item) => item.circleChallengeId === input.attempt.circleChallengeId);
    const existing = index >= 0 ? current[index] : null;
    next = {
      ...input.attempt,
      sequence: existing?.sequence ?? input.attempt.sequence ?? current.length + 1,
      createdAt: existing?.createdAt ?? input.attempt.createdAt ?? now,
      updatedAt: now,
    };
    if (index >= 0) current[index] = { ...existing, ...next };
    else current.push(next);
    return {
      ...store,
      fundingAttempts: {
        ...(store.fundingAttempts ?? {}),
        [key]: current.sort((a, b) => a.sequence - b.sequence),
      },
    };
  });
  return next;
}

export async function getWinnerFinalizationAttemptForScope(input: {
  ccnAccountId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  const store = await normalizeStore();
  return store.winnerFinalizationAttempts?.[winnerFinalizationAttemptScopeKey(input)] ?? null;
}

export async function listWinnerFinalizationAttempts() {
  const store = await normalizeStore();
  return Object.values(store.winnerFinalizationAttempts ?? {})
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function acquireWinnerFinalizationAttemptLock(input: {
  ccnAccountId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  selectedWinnerEntryIds: string[];
  winnerWalletAddresses: string[];
}) {
  const key = winnerFinalizationAttemptScopeKey(input);
  const now = new Date().toISOString();
  let next!: WinnerFinalizationAttemptRecord;
  await updateStore((store) => {
    const existing = store.winnerFinalizationAttempts?.[key];
    if (
      existing?.state === "FINALIZATION_IN_PROGRESS" ||
      existing?.state === "APPROVAL_CREATION_IN_PROGRESS" ||
      existing?.state === "TRANSACTION_SUBMITTED" ||
      existing?.state === "PAYOUT_CONFIRMED" ||
      existing?.state === "ALREADY_FINALIZED"
    ) {
      throw new StoreConflictError();
    }

    next = {
      ...existing,
      ccnAccountId: input.ccnAccountId,
      draftId: input.draftId,
      challengeId: input.challengeId,
      fundingIntentId: input.fundingIntentId,
      lockId: existing?.lockId ?? stableUuid("winner-finalization-lock", key),
      idempotencyKey: existing?.idempotencyKey ?? stableUuid("winner-payout", key),
      operationOwnerToken: randomUUID(),
      state: "FINALIZATION_IN_PROGRESS",
      selectedWinnerEntryIds: input.selectedWinnerEntryIds,
      winnerWalletAddresses: input.winnerWalletAddresses,
      errorMessage: undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    return {
      ...store,
      winnerFinalizationAttempts: {
        ...(store.winnerFinalizationAttempts ?? {}),
        [key]: next,
      },
    };
  });
  return next;
}

export async function patchWinnerFinalizationAttempt(input: {
  scope: {
    ccnAccountId: string;
    draftId: string;
    challengeId: string;
    fundingIntentId: string;
  };
  patch: Partial<Pick<
    WinnerFinalizationAttemptRecord,
    "state" | "payoutWalletId" | "payoutWalletAddress" | "circleStatus" | "circleChallengeId" | "circleTransactionId" | "transactionHash" | "blockNumber" | "receiptStatus" | "payoutConfirmedAt" | "reconciliationSource" | "finalContractStatus" | "lastCheckedAt" | "reconciliation" | "finalizedAt" | "errorMessage"
  >>;
}) {
  const key = winnerFinalizationAttemptScopeKey(input.scope);
  const now = new Date().toISOString();
  let updated: WinnerFinalizationAttemptRecord | null = null;
  await updateStore((store) => {
    const existing = store.winnerFinalizationAttempts?.[key];
    if (!existing) return store;

    updated = {
      ...existing,
      ...input.patch,
      updatedAt: now,
    };

    return {
      ...store,
      winnerFinalizationAttempts: {
        ...(store.winnerFinalizationAttempts ?? {}),
        [key]: updated,
      },
    };
  });
  return updated;
}

export async function patchWinnerFinalizationAttemptForOwner(input: {
  scope: {
    ccnAccountId: string;
    draftId: string;
    challengeId: string;
    fundingIntentId: string;
  };
  ownerToken: string;
  patch: Partial<Pick<
    WinnerFinalizationAttemptRecord,
    "state" | "payoutWalletId" | "payoutWalletAddress" | "circleStatus" | "circleChallengeId" | "circleTransactionId" | "transactionHash" | "blockNumber" | "receiptStatus" | "payoutConfirmedAt" | "reconciliationSource" | "finalContractStatus" | "lastCheckedAt" | "reconciliation" | "finalizedAt" | "errorMessage" | "operationKey" | "operationOwnerToken" | "approvalCreationStartedAt" | "approvalCreatedAt"
  >>;
}) {
  const key = winnerFinalizationAttemptScopeKey(input.scope);
  const now = new Date().toISOString();
  let updated: WinnerFinalizationAttemptRecord | null = null;
  await updateStore((store) => {
    const existing = store.winnerFinalizationAttempts?.[key];
    if (!existing || existing.operationOwnerToken !== input.ownerToken) {
      throw new StoreConflictError();
    }

    updated = {
      ...existing,
      ...input.patch,
      updatedAt: now,
    };

    return {
      ...store,
      winnerFinalizationAttempts: {
        ...(store.winnerFinalizationAttempts ?? {}),
        [key]: updated,
      },
    };
  });
  return updated;
}

export async function patchCreateChallengeDraft(
  patch: Partial<CreateChallengeDraftState>,
  draftId?: string,
  input: { ccnAccountId?: string } = {},
) {
  if (!draftId) throw new DraftNotFoundError("missing-draft-id");
  let updated!: CreateChallengeDraftState;
  await updateStore(async (store) => {
    const current = store.drafts?.[draftId];
    if (!current) throw new DraftNotFoundError(draftId);
    const merged = withDerivedValues({
      ...current,
      ...patch,
      challenge: { ...current.challenge, ...patch.challenge },
      prizePool: { ...current.prizePool, ...patch.prizePool },
      reviewRules: { ...current.reviewRules, ...patch.reviewRules },
      funding: { ...current.funding, ...patch.funding },
      deployment: { ...current.deployment, ...patch.deployment },
    });
    const reservation = await reservePublicSlug(store, merged);
    updated = reservation.draft;
    return withFundingRecord({
      ...reservation.store,
      activeDraftId: draftId,
      drafts: {
        ...(reservation.store.drafts ?? {}),
        [draftId]: updated,
      },
    }, updated, input.ccnAccountId);
  });
  return updated;
}

export function validateCreateChallengeDraft(
  draft: CreateChallengeDraftState,
  step: CreateChallengeStepId,
  options: { deadlinePolicy?: CreateChallengeDeadlinePolicy } = {},
): CreateChallengeValidation {
  return validateCreateChallengeStep(draft, step, options);
}

export function getFundingIntentFromDraft(
  draft: CreateChallengeDraftState,
  input: { ccnAccountId?: string } = {},
): FundingIntentSnapshot {
  const normalized = withDerivedValues(draft);
  const deadlines = deadlineUnixSecondsFromDraft(normalized);
  return {
    ccnAccountId: input.ccnAccountId ?? CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
    challengeLogicalId: normalized.challenge.id ?? "",
    challengeId:
      normalized.challenge.challengeId ??
      (normalized.deployment.challengeId as `0x${string}`),
    fundingIntentId: normalized.funding.fundingIntentId,
    approvalIdempotencyKey: stableUuid(
      "approval",
      normalized.funding.fundingIntentId,
    ),
    fundingIdempotencyKey: stableUuid(
      "funding",
      normalized.funding.fundingIntentId,
    ),
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    usdcContractAddress: CREATE_CHALLENGE_USDC_CONTRACT,
    prizeAmount: normalized.prizePool.prizePoolUnits,
    platformFee: normalized.prizePool.platformFeeUnits,
    totalRequired: normalized.prizePool.totalRequiredUnits,
    submissionDeadline: deadlines.submissionDeadline,
    reviewDeadline: deadlines.reviewDeadline,
    winnerCount: normalized.prizePool.winnerCount,
    prizeDistribution: normalized.prizePool.distributionUnits,
  };
}

export function formatTestUsdc(units: string) {
  return Number(formatUsdcUnits(units)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}
