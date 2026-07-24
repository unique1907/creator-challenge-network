import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { demoCreateChallengeDraft } from "@/features/create-challenge/data/demo-draft";
import type {
  CreateChallengeDraftState,
  CreateChallengeStepId,
  CreateChallengeValidation,
} from "@/types/create-challenge";
import {
  calculatePrizePool,
  formatUsdcUnits,
  normalizePrizePool,
  parseUsdcUnits,
} from "@/utils/create-challenge-finance";

// Local JSON persistence is for the hackathon/dev spike only. Vercel/production must use a real database.
const LOCAL_USER_HOME = process.env.USERPROFILE ?? process.env.HOME ?? "C:\\Users\\TB";
export const CREATE_CHALLENGE_STORE_PATH =
  process.env.CCN_CREATE_CHALLENGE_STORE_PATH ??
  join(LOCAL_USER_HOME, "Desktop", "creator-challenge-network", ".local", "create-challenge-flow.json");
let storePathLogged = false;
export const CREATE_CHALLENGE_BRAND_ACCOUNT_ID = "ccn-test-email-001";
export const CREATE_CHALLENGE_ESCROW_CONTRACT =
  "0x571470097882848441f8d7FD3D0A37B1b726eBF6";
export const CREATE_CHALLENGE_USDC_CONTRACT =
  "0x3600000000000000000000000000000000000000";

type Store = {
  version?: number;
  revision?: number;
  activeDraftId?: string;
  drafts?: Record<string, CreateChallengeDraftState>;
  fundingRecords?: Record<string, FundingRecordScope>;
  approvalAttempts?: Record<string, ApprovalAttemptRecord[]>;
  fundingAttempts?: Record<string, FundingAttemptRecord[]>;
  onChainVerificationsByTxHash?: Record<string, OnChainVerificationRecord>;
  draft?: CreateChallengeDraftState;
};

const STORE_VERSION = 1;
const STORE_WRITE_RETRIES = 3;
const STORE_BACKUP_KEEP = 8;
const CREATE_CHALLENGE_BACKUP_DIR = join(dirname(CREATE_CHALLENGE_STORE_PATH), "backups");
const CREATE_CHALLENGE_LAST_KNOWN_GOOD_PATH = join(CREATE_CHALLENGE_BACKUP_DIR, "last-known-good.json");
let storeWriteQueue = Promise.resolve();

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
  blockNumber: number | null;
  verifiedAt: string;
  receiptStatus?: "success";
  receiptVerified?: boolean;
  eventVerified?: boolean;
  challengeVerified?: boolean;
  sponsorVerified?: boolean;
  amountVerified?: boolean;
  orphaned?: boolean;
};

export type CreateChallengeDraftSummary = {
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
  title: string;
  brandName: string;
  currentStep: CreateChallengeStepId;
  publicationStatus: CreateChallengeDraftState["deployment"]["publicationStatus"];
  fundingStatus: CreateChallengeDraftState["funding"]["fundingStatus"];
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
  const id = draft.challenge.id ?? randomUUID();
  const challengeId = draft.challenge.challengeId ?? bytes32(id);
  const prizePool = normalizePrizePool(draft.prizePool);

  return {
    ...draft,
    challenge: {
      ...draft.challenge,
      id,
      slug: draft.challenge.slug ?? slugify(draft.challenge.title),
      challengeId,
    },
    prizePool,
    funding: {
      ...draft.funding,
      fundingIntentId: draft.funding.fundingIntentId || randomUUID(),
    },
    deployment: {
      ...draft.deployment,
      challengeId,
    },
    updatedAt: new Date().toISOString(),
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

function fundingRecordFromDraft(draft: CreateChallengeDraftState): FundingRecordScope {
  const normalized = withDerivedValues(draft);
  return {
    ccnAccountId: CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
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

function withFundingRecord(store: Store, draft: CreateChallengeDraftState): Store {
  const record = fundingRecordFromDraft(draft);
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
    storePath: CREATE_CHALLENGE_STORE_PATH,
    persistence: "local-json-dev-only",
    productionWarning: "Use a durable database on Vercel/production.",
  });
}

function withRuntimeIndexes(store: Store): Store {
  return {
    ...store,
    fundingRecords: store.fundingRecords ?? {},
    approvalAttempts: store.approvalAttempts ?? {},
    fundingAttempts: store.fundingAttempts ?? {},
    onChainVerificationsByTxHash: store.onChainVerificationsByTxHash ?? {},
  };
}

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
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
    fundingRecords: {},
    approvalAttempts: {},
    fundingAttempts: {},
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

  for (const key of ["drafts", "fundingRecords", "approvalAttempts", "fundingAttempts", "onChainVerificationsByTxHash"]) {
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
    fundingRecords: input.fundingRecords ?? {},
    approvalAttempts: input.approvalAttempts ?? {},
    fundingAttempts: input.fundingAttempts ?? {},
    onChainVerificationsByTxHash: input.onChainVerificationsByTxHash ?? {},
  });
  Object.values(drafts).forEach((draft) => {
    normalized = withFundingRecord(normalized, draft);
  });
  return normalized;
}

async function readStore(): Promise<Store> {
  logStorePathOnce();
  const exists = await fileExists(CREATE_CHALLENGE_STORE_PATH);
  if (!exists) return emptyStore();

  try {
    const raw = await readFile(CREATE_CHALLENGE_STORE_PATH, "utf8");
    return normalizeStoreInMemory(validateStoreShape(JSON.parse(raw)));
  } catch (error) {
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
  logStorePathOnce();
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

export async function listCreateChallengeDrafts() {
  const store = await normalizeStore();
  return Object.values(store.drafts ?? {})
    .map((draft) => {
      const normalized = withDerivedValues(draft);
      return {
        draftId: normalized.challenge.id ?? "",
        challengeId: normalized.challenge.challengeId ?? "",
        fundingIntentId: normalized.funding.fundingIntentId,
        title: normalized.challenge.title || "Untitled challenge",
        brandName: normalized.challenge.brandName || "Brand not set",
        currentStep: normalized.deployment.currentStep,
        publicationStatus: normalized.deployment.publicationStatus,
        fundingStatus: normalized.funding.fundingStatus,
        updatedAt: normalized.updatedAt ?? "",
      } satisfies CreateChallengeDraftSummary;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createNewCreateChallengeDraft() {
  const draft = createCleanDraft();
  const draftId = draft.challenge.id ?? randomUUID();
  await updateStore((store) => withFundingRecord({
    ...store,
    activeDraftId: draftId,
    drafts: {
      ...(store.drafts ?? {}),
      [draftId]: draft,
    },
  }, draft));
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

export async function findOnChainVerificationForDraft(input: { draftId: string; challengeId: string; fundingIntentId: string }) {
  const store = await normalizeStore();
  return Object.values(store.onChainVerificationsByTxHash ?? {}).find(
    (record) =>
      record.draftId === input.draftId &&
      record.challengeId.toLowerCase() === input.challengeId.toLowerCase() &&
      record.fundingIntentId === input.fundingIntentId,
  ) ?? null;
}

export async function saveCreateChallengeDraft(
  draft: CreateChallengeDraftState,
  draftId?: string,
) {
  const targetDraftId = draftId || draft.challenge.id;
  if (!targetDraftId) throw new DraftNotFoundError("missing-draft-id");
  let normalized!: CreateChallengeDraftState;
  await updateStore((store) => {
    const current = store.drafts?.[targetDraftId];
    if (!current) throw new DraftNotFoundError(targetDraftId);
    normalized = withDerivedValues({
      ...current,
      ...draft,
      challenge: {
        ...current.challenge,
        ...draft.challenge,
        slug: draft.challenge.title
          ? slugify(draft.challenge.title)
          : current.challenge.slug,
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
    return withFundingRecord({
      ...store,
      activeDraftId: targetDraftId,
      drafts: {
        ...(store.drafts ?? {}),
        [targetDraftId]: normalized,
      },
    }, normalized);
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

export async function patchCreateChallengeDraft(
  patch: Partial<CreateChallengeDraftState>,
  draftId?: string,
) {
  if (!draftId) throw new DraftNotFoundError("missing-draft-id");
  let updated!: CreateChallengeDraftState;
  await updateStore((store) => {
    const current = store.drafts?.[draftId];
    if (!current) throw new DraftNotFoundError(draftId);
    updated = withDerivedValues({
      ...current,
      ...patch,
      challenge: { ...current.challenge, ...patch.challenge },
      prizePool: { ...current.prizePool, ...patch.prizePool },
      reviewRules: { ...current.reviewRules, ...patch.reviewRules },
      funding: { ...current.funding, ...patch.funding },
      deployment: { ...current.deployment, ...patch.deployment },
    });
    return withFundingRecord({
      ...store,
      activeDraftId: draftId,
      drafts: {
        ...(store.drafts ?? {}),
        [draftId]: updated,
      },
    }, updated);
  });
  return updated;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function unixFromLocal(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

export function validateCreateChallengeDraft(
  draft: CreateChallengeDraftState,
  step: CreateChallengeStepId,
): CreateChallengeValidation {
  const errors: string[] = [];

  if (step === "basics") {
    if (draft.challenge.title.trim().length < 5 || draft.challenge.title.length > 100) {
      errors.push("Challenge title must be 5-100 characters.");
    }
    if (!draft.challenge.brandName.trim()) errors.push("Brand name is required.");
    if (!draft.challenge.category.trim()) errors.push("Category is required.");
    if (!draft.challenge.summary.trim() || draft.challenge.summary.length > 240) {
      errors.push("Short summary is required and must be 240 characters or less.");
    }
    if (draft.challenge.description.trim().length < 50) {
      errors.push("Full creative brief must be at least 50 characters.");
    }
    if (!draft.challenge.primaryDeliverable.trim()) {
      errors.push("Primary deliverable is required.");
    }
    if (!draft.challenge.usageRightsAcknowledged) {
      errors.push("Usage-rights acknowledgement is required.");
    }
    draft.challenge.referenceLinks.filter(Boolean).forEach((url) => {
      if (!isValidUrl(url)) errors.push(`Invalid reference URL: ${url}`);
    });
  }

  if (step === "prize-pool") {
    const math = calculatePrizePool({
      totalAmount: draft.prizePool.totalAmount,
      winnerCount: draft.prizePool.winnerCount,
      distributionMode: draft.prizePool.distributionMode,
      prizeDistribution: draft.prizePool.prizeDistribution,
    });
    errors.push(...math.errors);
    const balanceUnits = parseUsdcUnits(draft.funding.availableBalance || 0).units;
    if (balanceUnits > BigInt(0) && BigInt(math.totalRequiredUnits) > balanceUnits) {
      errors.push("Total required exceeds the available test USDC balance.");
    }
  }

  if (step === "review-rules") {
    const submissionDeadline = unixFromLocal(draft.reviewRules.submissionDeadline);
    const reviewDeadline = unixFromLocal(draft.reviewRules.reviewDeadline);
    const now = Math.floor(Date.now() / 1000);
    if (!submissionDeadline || submissionDeadline < now + 24 * 60 * 60) {
      errors.push("Submission date and time must be at least 24 hours from now.");
    }
    if (!reviewDeadline || reviewDeadline < submissionDeadline + 24 * 60 * 60) {
      errors.push("Review date and time must be at least 24 hours after submissions close.");
    }
    if (!draft.reviewRules.judgingCriteria.some((item) => item.trim())) {
      errors.push("At least one judging criterion is required.");
    }
    if (!draft.reviewRules.blindReview) errors.push("Blind review is required in MVP.");
    if (!draft.reviewRules.creatorAcknowledgement) {
      errors.push("Creator acknowledgement is required.");
    }
    if (!draft.reviewRules.cancellationAcknowledgement) {
      errors.push("Brand cancellation acknowledgement is required.");
    }
  }

  return { step, valid: errors.length === 0, errors };
}

export function getFundingIntentFromDraft(
  draft: CreateChallengeDraftState,
): FundingIntentSnapshot {
  const normalized = withDerivedValues(draft);
  return {
    ccnAccountId: CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
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
    submissionDeadline: unixFromLocal(normalized.reviewRules.submissionDeadline),
    reviewDeadline: unixFromLocal(normalized.reviewRules.reviewDeadline),
    winnerCount: normalized.prizePool.winnerCount,
    prizeDistribution: normalized.prizePool.distributionUnits,
  };
}

export function formatTestUsdc(units: string) {
  return Number(formatUsdcUnits(units)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}
