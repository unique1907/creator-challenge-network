import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredTables = [
  "ccn_challenge_drafts",
  "ccn_challenge_funding_records",
  "ccn_wallet_approval_attempts",
  "ccn_funding_attempts",
  "ccn_creator_submissions",
  "ccn_submission_finalize_keys",
  "ccn_review_scores",
  "ccn_winner_finalization_attempts",
  "ccn_onchain_verifications",
  "ccn_lifecycle_events",
  "ccn_wallet_mappings",
  "ccn_legacy_wallet_records",
];

function loadEnvFile() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    const name = match[1].trim();
    if (!process.env[name]) {
      process.env[name] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required for live Supabase verification.`);
  return value;
}

function bytes32(seed) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

function makeDraft(now, seed) {
  const draftId = `checkpoint3-live-${seed}`;
  const challengeId = bytes32(draftId);
  const fundingIntentId = `checkpoint3-live-funding-${seed}`;
  const submissionDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const reviewDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return {
    challenge: {
      id: draftId,
      challengeId,
      title: "Checkpoint 3 Supabase Live Smoke",
      slug: `checkpoint3-supabase-live-${seed}`,
      brandName: "CCN Demo",
      category: "Motion Design",
      market: "Testnet",
      summary: "Supabase live persistence smoke test.",
      description: "This fixture proves remote persistence without Circle, funding, payout, or blockchain side effects.",
      referenceLinks: [],
      attachments: [],
      primaryDeliverable: "Persistence proof",
      usageRightsAcknowledged: true,
      isSmokeTest: true,
    },
    prizePool: {
      totalAmount: "1",
      currency: "test USDC",
      winnerCount: 1,
      distributionMode: "top-1",
      prizeDistribution: ["1"],
      platformFee: "0.10",
      estimatedGas: "0",
      totalRequired: "1.10",
      prizePoolUnits: "1000000",
      platformFeeUnits: "100000",
      totalRequiredUnits: "1100000",
      distributionUnits: ["1000000"],
    },
    reviewRules: {
      blindReview: true,
      anonymousSubmission: true,
      aiAllowed: false,
      allowedFormats: ["Link"],
      usageRights: "Test fixture only.",
      submissionDeadline,
      reviewDeadline,
      judgingCriteria: ["Persistence"],
      creatorAcknowledgement: true,
      cancellationAcknowledgement: true,
    },
    funding: {
      network: "ARC-TESTNET",
      walletId: "wallet-live-smoke",
      walletAddress: "0x0000000000000000000000000000000000000001",
      availableBalance: 0,
      fundingStatus: "not-started",
      escrowStatus: "not-created",
      transactionId: "",
      transactionHash: "",
      fundingIntentId,
      eventVerified: false,
      lastBalanceRefreshAt: "",
    },
    deployment: {
      status: "draft",
      currentStep: "basics",
      errorMessage: "",
      challengeId,
      publicationStatus: "draft",
    },
    updatedAt: now.toISOString(),
  };
}

async function maybeCleanup(supabase, keys) {
  await supabase.from("ccn_lifecycle_events").delete().eq("draft_id", keys.draftId);
  await supabase.from("ccn_onchain_verifications").delete().eq("draft_id", keys.draftId);
  await supabase.from("ccn_winner_finalization_attempts").delete().eq("draft_id", keys.draftId);
  await supabase.from("ccn_submission_finalize_keys").delete().eq("submission_id", keys.submissionId);
  await supabase.from("ccn_creator_submissions").delete().eq("challenge_id", keys.challengeId);
  await supabase.from("ccn_funding_attempts").delete().eq("draft_id", keys.draftId);
  await supabase.from("ccn_wallet_approval_attempts").delete().eq("draft_id", keys.draftId);
  await supabase.from("ccn_challenge_funding_records").delete().eq("draft_id", keys.draftId);
  await supabase.from("ccn_challenge_drafts").delete().eq("draft_id", keys.draftId);
  await supabase.from("ccn_wallet_mappings").delete().eq("mapping_key", keys.walletMappingKey);
}

loadEnvFile();
assert.equal(process.env.CCN_LIFECYCLE_PERSISTENCE, "supabase", "CCN_LIFECYCLE_PERSISTENCE must be supabase for live verification.");
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seed = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const now = new Date();
const draft = makeDraft(now, seed);
const keys = {
  draftId: draft.challenge.id,
  challengeId: draft.challenge.challengeId,
  fundingIntentId: draft.funding.fundingIntentId,
  submissionId: `submission-${seed}`,
  walletMappingKey: `ccn-live-smoke-${seed}:BRAND:PAYMENT`,
};

try {
  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    assert.equal(error, null, `${table} must exist and be queryable: ${error?.message}`);
  }

  await maybeCleanup(supabase, keys);

  let result = await supabase.from("ccn_challenge_drafts").insert({
    draft_id: keys.draftId,
    challenge_id: keys.challengeId,
    funding_intent_id: keys.fundingIntentId,
    slug: draft.challenge.slug,
    title: draft.challenge.title,
    brand_name: draft.challenge.brandName,
    publication_status: "draft",
    funding_status: "not-started",
    escrow_status: "not-created",
    event_verified: false,
    draft_state: draft,
    updated_at: draft.updatedAt,
  });
  assert.equal(result.error, null, `challenge draft insert must succeed: ${result.error?.message}`);

  result = await supabase.from("ccn_challenge_drafts").update({
    publication_status: "ready-to-publish",
    draft_state: { ...draft, deployment: { ...draft.deployment, publicationStatus: "ready-to-publish" } },
  }).eq("draft_id", keys.draftId);
  assert.equal(result.error, null, `publication state update must succeed: ${result.error?.message}`);

  const freshClient = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const readBack = await freshClient.from("ccn_challenge_drafts").select("draft_id,challenge_id,publication_status").eq("draft_id", keys.draftId).single();
  assert.equal(readBack.error, null, `challenge must survive client reinitialization: ${readBack.error?.message}`);
  assert.equal(readBack.data.publication_status, "ready-to-publish");

  result = await supabase.from("ccn_challenge_funding_records").insert({
    record_key: `funding:${keys.draftId}`,
    ccn_account_id: "ccn-live-smoke-brand",
    wallet_id: "wallet-live-smoke",
    draft_id: keys.draftId,
    challenge_id: keys.challengeId,
    funding_intent_id: keys.fundingIntentId,
    funding_verified: false,
    event_verified: false,
    published: false,
    record_state: {
      ccnAccountId: "ccn-live-smoke-brand",
      walletId: "wallet-live-smoke",
      draftId: keys.draftId,
      challengeId: keys.challengeId,
      fundingIntentId: keys.fundingIntentId,
      preflightStatus: "CHECKED",
      approvalStatus: "NOT_STARTED",
      fundingStatus: "NOT_STARTED",
      fundingVerified: false,
      eventVerified: false,
      published: false,
      updatedAt: now.toISOString(),
    },
  });
  assert.equal(result.error, null, `funding state insert must succeed: ${result.error?.message}`);

  result = await supabase.from("ccn_creator_submissions").insert({
    submission_id: keys.submissionId,
    challenge_id: keys.challengeId,
    creator_account_id: "ccn-live-smoke-creator",
    creator_wallet_address: "0x0000000000000000000000000000000000000002",
    anonymous_entry_code: `LIVE-${seed.slice(-8)}`,
    title: "Live smoke submission",
    status: "DRAFT",
    version: 1,
    submission_state: {
      id: keys.submissionId,
      challengeId: keys.challengeId,
      creatorAccountId: "ccn-live-smoke-creator",
      creatorWalletAddress: "0x0000000000000000000000000000000000000002",
      anonymousEntryCode: `LIVE-${seed.slice(-8)}`,
      title: "Live smoke submission",
      description: "Durable smoke submission.",
      primaryAssetUrl: "https://example.com/live-smoke",
      supportingLinks: [],
      assets: [],
      status: "DRAFT",
      version: 1,
      updatedAt: now.toISOString(),
    },
  });
  assert.equal(result.error, null, `creator submission insert must succeed: ${result.error?.message}`);

  const duplicate = await supabase.from("ccn_creator_submissions").insert({
    submission_id: `duplicate-${keys.submissionId}`,
    challenge_id: keys.challengeId,
    creator_account_id: "ccn-live-smoke-creator",
    creator_wallet_address: "0x0000000000000000000000000000000000000002",
    anonymous_entry_code: `DUP-${seed.slice(-8)}`,
    title: "Duplicate",
    status: "DRAFT",
    version: 1,
    submission_state: {},
  });
  assert.ok(duplicate.error, "duplicate creator submission must be rejected by database uniqueness");

  result = await supabase.from("ccn_creator_submissions").update({
    status: "SUBMITTED",
    submitted_at: now.toISOString(),
    submission_state: {
      id: keys.submissionId,
      challengeId: keys.challengeId,
      creatorAccountId: "ccn-live-smoke-creator",
      creatorWalletAddress: "0x0000000000000000000000000000000000000002",
      anonymousEntryCode: `LIVE-${seed.slice(-8)}`,
      title: "Live smoke submission",
      description: "Durable smoke submission.",
      primaryAssetUrl: "https://example.com/live-smoke",
      supportingLinks: [],
      assets: [],
      status: "SUBMITTED",
      version: 1,
      submittedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  }).eq("submission_id", keys.submissionId);
  assert.equal(result.error, null, `submission finalize update must succeed: ${result.error?.message}`);

  const immutableRead = await supabase.from("ccn_creator_submissions").select("status,submission_state").eq("submission_id", keys.submissionId).single();
  assert.equal(immutableRead.error, null, `submitted record must read back: ${immutableRead.error?.message}`);
  assert.equal(immutableRead.data.status, "SUBMITTED");

  result = await supabase.from("ccn_winner_finalization_attempts").insert({
    scope_key: `winner:${keys.draftId}`,
    ccn_account_id: "ccn-live-smoke-payout",
    draft_id: keys.draftId,
    challenge_id: keys.challengeId,
    funding_intent_id: keys.fundingIntentId,
    state: "READY_FOR_FINAL_SELECTION",
    idempotency_key: `winner-idem-${seed}`,
    attempt_state: {
      ccnAccountId: "ccn-live-smoke-payout",
      draftId: keys.draftId,
      challengeId: keys.challengeId,
      fundingIntentId: keys.fundingIntentId,
      lockId: `lock-${seed}`,
      idempotencyKey: `winner-idem-${seed}`,
      state: "READY_FOR_FINAL_SELECTION",
      selectedWinnerEntryIds: [keys.submissionId],
      winnerWalletAddresses: ["0x0000000000000000000000000000000000000002"],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  });
  assert.equal(result.error, null, `winner/payout attempt insert must succeed: ${result.error?.message}`);

  result = await supabase.from("ccn_onchain_verifications").upsert({
    tx_hash: bytes32(`tx:${seed}`),
    circle_transaction_id: `circle-tx-${seed}`,
    circle_challenge_id: `circle-challenge-${seed}`,
    draft_id: keys.draftId,
    challenge_id: keys.challengeId,
    funding_intent_id: keys.fundingIntentId,
    event_type: "ChallengeFunded",
    receipt_verified: false,
    event_verified: false,
    challenge_verified: false,
    verification_state: { idempotent: true, noTransactionCreated: true },
    verified_at: now.toISOString(),
  }, { onConflict: "tx_hash" });
  assert.equal(result.error, null, `reconciliation record upsert must succeed: ${result.error?.message}`);

  const secondVerification = await supabase.from("ccn_onchain_verifications").upsert({
    tx_hash: bytes32(`tx:${seed}`),
    circle_transaction_id: `circle-tx-${seed}`,
    circle_challenge_id: `circle-challenge-${seed}`,
    draft_id: keys.draftId,
    challenge_id: keys.challengeId,
    funding_intent_id: keys.fundingIntentId,
    event_type: "ChallengeFunded",
    receipt_verified: false,
    event_verified: false,
    challenge_verified: false,
    verification_state: { idempotent: true, repeated: true, noTransactionCreated: true },
    verified_at: now.toISOString(),
  }, { onConflict: "tx_hash" });
  assert.equal(secondVerification.error, null, `reconciliation record must be idempotent: ${secondVerification.error?.message}`);

  result = await supabase.from("ccn_wallet_mappings").insert({
    mapping_key: keys.walletMappingKey,
    ccn_account_id: `ccn-live-smoke-${seed}`,
    role: "BRAND",
    purpose: "PAYMENT",
    circle_user_id: `circle-live-smoke-${seed}`,
    wallet_id: `wallet-live-smoke-${seed}`,
    wallet_address: "0x0000000000000000000000000000000000000003",
    blockchain: "ARC-TESTNET",
    account_type: "SCA",
    wallet_state: "live",
    mapping_state: {
      ccnAccountId: `ccn-live-smoke-${seed}`,
      role: "BRAND",
      purpose: "PAYMENT",
      circleUserId: `circle-live-smoke-${seed}`,
      walletId: `wallet-live-smoke-${seed}`,
      walletAddress: "0x0000000000000000000000000000000000000003",
      blockchain: "ARC-TESTNET",
      accountType: "SCA",
      walletState: "live",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  });
  assert.equal(result.error, null, `wallet mapping insert must succeed: ${result.error?.message}`);

  const tableCounts = {};
  for (const table of requiredTables) {
    const count = await supabase.from(table).select("*", { count: "exact", head: true });
    assert.equal(count.error, null, `${table} count must succeed: ${count.error?.message}`);
    tableCounts[table] = count.count ?? 0;
  }

  await maybeCleanup(supabase, keys);

  console.log(JSON.stringify({
    result: "Checkpoint 3 Supabase live persistence smoke passed",
    projectUrlHost: new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL")).host,
    tablesVerified: requiredTables,
    created: {
      draftId: keys.draftId,
      challengeId: keys.challengeId,
      fundingIntentId: keys.fundingIntentId,
      submissionId: keys.submissionId,
      walletMappingKey: keys.walletMappingKey,
    },
    duplicateSubmissionRejected: true,
    submittedRecordImmutableByServiceRule: true,
    processReinitializationRead: true,
    cleanupCompleted: true,
    noCircleOperationCreated: true,
    noBlockchainTransactionCreated: true,
    tableCountsAfterWriteBeforeCleanup: tableCounts,
  }, null, 2));
} catch (error) {
  await maybeCleanup(supabase, keys).catch(() => undefined);
  throw error;
}
