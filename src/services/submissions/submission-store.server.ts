import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createSupabaseAdminClient } from "@/services/supabase/admin.server";
import type {
  BlindReviewEntry,
  Submission,
  SubmissionDraftInput,
} from "@/types/submission";

const STORE_PATH = join(process.cwd(), ".local", "internal-submissions-spike.json");
const IS_MANAGED_PRODUCTION =
  process.env.VERCEL_ENV === "production" ||
  process.env.CCN_DEPLOYMENT_ENV === "production";
const SUBMISSION_PERSISTENCE_ADAPTER =
  process.env.CCN_LIFECYCLE_PERSISTENCE ??
  (IS_MANAGED_PRODUCTION ? "supabase" : "filesystem");
const CREATOR_ACCOUNT_ID = "ccn-test-creator-001";
const MAX_TITLE_LENGTH = 90;
const MAX_DESCRIPTION_LENGTH = 1_200;
export const MAX_SUBMISSIONS_PER_CHALLENGE = 100;
export const MAX_SUBMISSION_VERSIONS = 3;

type Store = {
  submissions: Submission[];
  finalizeKeys: Record<string, string>;
};

const emptyStore: Store = {
  submissions: [],
  finalizeKeys: {},
};

async function readStore(): Promise<Store> {
  assertPersistenceAdapter();
  if (SUBMISSION_PERSISTENCE_ADAPTER === "supabase") return readSupabaseStore();
  try {
    return JSON.parse(await readFile(STORE_PATH, "utf8")) as Store;
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: Store) {
  assertPersistenceAdapter();
  if (SUBMISSION_PERSISTENCE_ADAPTER === "supabase") {
    await writeSupabaseStore(store);
    return;
  }
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function assertPersistenceAdapter() {
  if (SUBMISSION_PERSISTENCE_ADAPTER !== "filesystem" && SUBMISSION_PERSISTENCE_ADAPTER !== "supabase") {
    throw new Error("CCN_LIFECYCLE_PERSISTENCE must be either filesystem or supabase.");
  }
  if (IS_MANAGED_PRODUCTION && SUBMISSION_PERSISTENCE_ADAPTER !== "supabase") {
    throw new Error("Production submission persistence must use Supabase/Postgres. Set CCN_LIFECYCLE_PERSISTENCE=supabase.");
  }
}

async function readSupabaseStore(): Promise<Store> {
  const supabase = createSupabaseAdminClient();
  const [submissions, finalizeKeys] = await Promise.all([
    supabase.from("ccn_creator_submissions").select("submission_state"),
    supabase.from("ccn_submission_finalize_keys").select("finalize_key,submission_id"),
  ]);
  if (submissions.error) throw submissions.error;
  if (finalizeKeys.error) throw finalizeKeys.error;
  return {
    submissions: (submissions.data ?? []).map((row) => row.submission_state as Submission),
    finalizeKeys: Object.fromEntries(
      (finalizeKeys.data ?? []).map((row) => [row.finalize_key, row.submission_id]),
    ),
  };
}

async function writeSupabaseStore(store: Store) {
  const supabase = createSupabaseAdminClient();
  const submissionRows = store.submissions.map((submission) => ({
    submission_id: submission.id,
    challenge_id: submission.challengeId,
    creator_account_id: submission.creatorAccountId,
    creator_wallet_address: submission.creatorWalletAddress,
    anonymous_entry_code: submission.anonymousEntryCode,
    title: submission.title,
    status: submission.status,
    version: submission.version ?? 1,
    submitted_at: submission.submittedAt ?? null,
    updated_at: submission.updatedAt,
    submission_state: submission,
  }));
  if (submissionRows.length) {
    const { error } = await supabase
      .from("ccn_creator_submissions")
      .upsert(submissionRows, { onConflict: "submission_id" });
    if (error) throw error;
  }

  const keyRows = Object.entries(store.finalizeKeys).map(([finalizeKey, submissionId]) => ({
    finalize_key: finalizeKey,
    submission_id: submissionId,
  }));
  if (keyRows.length) {
    const { error } = await supabase
      .from("ccn_submission_finalize_keys")
      .upsert(keyRows, { onConflict: "finalize_key" });
    if (error) throw error;
  }
}

function assertHex32(value: string): asserts value is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("Invalid challenge ID.");
  }
}

function assertAddress(value: string): asserts value is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error("Creator wallet address is invalid.");
  }
}

function normalizeUrl(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`${label} must be an http or https URL.`);
    }
    return url.toString();
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
}

function normalizeLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  value
    .filter((item) => typeof item === "string" && item.trim())
    .slice(0, 3)
    .forEach((item, index) => unique.add(normalizeUrl(item, index === 0 ? "Optional supporting link" : `Optional supporting link ${index + 1}`)));
  return Array.from(unique);
}

function normalizeInput(input: SubmissionDraftInput) {
  if (typeof input.title !== "string" || !input.title.trim()) {
    throw new Error("Project title is required.");
  }
  if (typeof input.description !== "string" || !input.description.trim()) {
    throw new Error("Description is required.");
  }

  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Project title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  return {
    title,
    description,
    primaryAssetUrl: normalizeUrl(input.primaryAssetUrl, "Main project link"),
    supportingLinks: normalizeLinks(input.supportingLinks),
    assets: [],
  };
}

function challengeSubmissionCount(store: Store, challengeId: string) {
  return store.submissions.filter(
    (submission) =>
      submission.challengeId.toLowerCase() === challengeId.toLowerCase() &&
      (submission.status === "DRAFT" || submission.status === "SUBMITTED"),
  ).length;
}

function activeSubmission(store: Store, challengeId: string, creatorAccountId: string) {
  return (
    store.submissions.find(
      (submission) =>
        submission.challengeId.toLowerCase() === challengeId.toLowerCase() &&
        submission.creatorAccountId === creatorAccountId &&
        (submission.status === "DRAFT" || submission.status === "SUBMITTED"),
    ) ?? null
  );
}

function makeEntryCode(existingCodes: Set<string>) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = `ENTRY-${randomInt(0, 10_000).toString().padStart(4, "0")}`;
    if (!existingCodes.has(value)) return value;
  }
  throw new Error("Could not generate a unique anonymous entry code.");
}

export async function getCreatorSubmissionStatus(input: {
  challengeId: string;
  creatorAccountId?: string;
}) {
  assertHex32(input.challengeId);
  const store = await readStore();
  return activeSubmission(
    store,
    input.challengeId,
    input.creatorAccountId ?? CREATOR_ACCOUNT_ID,
  );
}

export async function listCreatorSubmissions(creatorAccountId: string) {
  const store = await readStore();
  return store.submissions
    .filter((submission) => submission.creatorAccountId === creatorAccountId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCreatorSubmissionById(input: {
  submissionId: string;
  creatorAccountId: string;
}) {
  const store = await readStore();
  return (
    store.submissions.find(
      (submission) =>
        submission.id === input.submissionId &&
        submission.creatorAccountId === input.creatorAccountId,
    ) ?? null
  );
}

export async function countSubmittedEntriesForChallenge(challengeId: string) {
  assertHex32(challengeId);
  const store = await readStore();
  return store.submissions.filter(
    (submission) =>
      submission.challengeId.toLowerCase() === challengeId.toLowerCase() &&
      submission.status === "SUBMITTED",
  ).length;
}

export async function saveCreatorDraft(input: {
  challengeId: string;
  creatorAccountId?: string;
  creatorWalletAddress: string;
  draft: SubmissionDraftInput;
}) {
  assertHex32(input.challengeId);
  assertAddress(input.creatorWalletAddress);
  const creatorAccountId = input.creatorAccountId ?? CREATOR_ACCOUNT_ID;
  const normalized = normalizeInput(input.draft);
  const store = await readStore();
  const current = activeSubmission(store, input.challengeId, creatorAccountId);
  const now = new Date().toISOString();

  if (current?.status === "SUBMITTED") {
    throw new Error("Submitted entries are immutable in Sprint 5A.");
  }

  if (current) {
    const nextVersion = (current.version ?? 1) + 1;
    if (nextVersion > MAX_SUBMISSION_VERSIONS) {
      throw new Error("A submission can have at most three saved versions.");
    }
    Object.assign(current, normalized, {
      creatorWalletAddress: input.creatorWalletAddress,
      version: nextVersion,
      updatedAt: now,
    });
    await writeStore(store);
    return current;
  }

  if (challengeSubmissionCount(store, input.challengeId) >= MAX_SUBMISSIONS_PER_CHALLENGE) {
    throw new Error("Challenge submission limit has been reached.");
  }

  const submission: Submission = {
    id: randomUUID(),
    challengeId: input.challengeId,
    creatorAccountId,
    creatorWalletAddress: input.creatorWalletAddress,
    anonymousEntryCode: makeEntryCode(
      new Set(store.submissions.map((item) => item.anonymousEntryCode)),
    ),
    ...normalized,
    status: "DRAFT",
    version: 1,
    updatedAt: now,
  };

  store.submissions.push(submission);
  await writeStore(store);
  return submission;
}

export async function finalizeCreatorSubmission(input: {
  challengeId: string;
  creatorAccountId?: string;
  idempotencyKey: unknown;
}) {
  assertHex32(input.challengeId);
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8) {
    throw new Error("Finalize idempotency key is required.");
  }

  const creatorAccountId = input.creatorAccountId ?? CREATOR_ACCOUNT_ID;
  const store = await readStore();
  const key = `${creatorAccountId}:${input.challengeId.toLowerCase()}:${input.idempotencyKey}`;
  const existingId = store.finalizeKeys[key];
  const existing = existingId
    ? store.submissions.find((submission) => submission.id === existingId)
    : null;
  if (existing) return existing;

  const current = activeSubmission(store, input.challengeId, creatorAccountId);
  if (!current) {
    throw new Error("Create a draft before finalizing a submission.");
  }
  if (current.status === "SUBMITTED") {
    store.finalizeKeys[key] = current.id;
    await writeStore(store);
    return current;
  }

  const now = new Date().toISOString();
  current.status = "SUBMITTED";
  current.submittedAt = now;
  current.updatedAt = now;
  store.finalizeKeys[key] = current.id;
  await writeStore(store);
  return current;
}

export async function listBlindReviewEntries(challengeId: string) {
  assertHex32(challengeId);
  const store = await readStore();
  return store.submissions
    .filter(
      (submission) =>
        submission.challengeId.toLowerCase() === challengeId.toLowerCase() &&
        submission.status === "SUBMITTED",
    )
    .map(
      (submission): BlindReviewEntry => ({
        blindEntryId: submission.id,
        anonymousEntryCode: submission.anonymousEntryCode,
        title: submission.title,
        description: submission.description,
        primaryAssetUrl: submission.primaryAssetUrl,
        supportingLinks: submission.supportingLinks,
        assets: submission.assets ?? [],
        submittedAt: submission.submittedAt ?? submission.updatedAt,
        status: "SUBMITTED",
      }),
    );
}

async function resolveCreatorDisplayNames(creatorAccountIds: string[]) {
  const ids = Array.from(new Set(creatorAccountIds.filter(Boolean)));
  if (!ids.length) return new Map<string, string | null>();
  if (SUBMISSION_PERSISTENCE_ADAPTER !== "supabase") return new Map<string, string | null>();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id,display_name")
    .in("id", ids);
  if (error) return new Map<string, string | null>();
  return new Map((data ?? []).map((row) => [String(row.id), typeof row.display_name === "string" ? row.display_name : null]));
}

export async function listSubmissionNotificationEntries(challengeId: string) {
  assertHex32(challengeId);
  const store = await readStore();
  const submissions = store.submissions
    .filter(
      (submission) =>
        submission.challengeId.toLowerCase() === challengeId.toLowerCase() &&
        submission.status === "SUBMITTED",
    )
    .sort((left, right) => (right.submittedAt ?? right.updatedAt).localeCompare(left.submittedAt ?? left.updatedAt));
  const displayNames = await resolveCreatorDisplayNames(submissions.map((submission) => submission.creatorAccountId));

  return submissions.map((submission) => ({
    submissionId: submission.id,
    anonymousEntryCode: submission.anonymousEntryCode,
    submittedAt: submission.submittedAt ?? submission.updatedAt,
    creatorDisplayName: displayNames.get(submission.creatorAccountId) ?? null,
  }));
}

export function assertBlindReviewProjectionIsAnonymous(entries: BlindReviewEntry[]) {
  const forbidden = [
    "creatorAccountId",
    "creatorWalletAddress",
    "creatorEmail",
    "creatorDisplayName",
    "circleUserId",
    "walletId",
  ];
  const serialized = JSON.stringify(entries);
  return !forbidden.some((field) => serialized.includes(`"${field}"`));
}


export async function resolveSubmittedSelections(input: {
  challengeId: string;
  blindEntryIds: string[];
}) {
  assertHex32(input.challengeId);
  if (!Array.isArray(input.blindEntryIds) || input.blindEntryIds.length === 0) {
    throw new Error("At least one blind-review entry must be selected.");
  }
  const uniqueIds = Array.from(new Set(input.blindEntryIds));
  if (uniqueIds.length !== input.blindEntryIds.length) {
    throw new Error("Duplicate blind-review selections are not allowed.");
  }
  const store = await readStore();
  const submitted = store.submissions.filter(
    (submission) =>
      submission.challengeId.toLowerCase() === input.challengeId.toLowerCase() &&
      submission.status === "SUBMITTED" &&
      uniqueIds.includes(submission.id),
  );
  if (submitted.length !== uniqueIds.length) {
    throw new Error("Selected blind-review entry was not found for this challenge.");
  }
  return uniqueIds.map((id) => submitted.find((submission) => submission.id === id)!);
}
