import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const ACTIVE_ESCROW = "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D";
export const FUNDED_CHAIN_CHALLENGE_ID = "0xc71562ffa5142a1e1d071cd8107b59591901cd993787b19397c1d8ceba7d294b";
const createStorePath = path.join(root, ".local", "create-challenge-flow.json");
const submissionStorePath = path.join(root, ".local", "internal-submissions-spike.json");
const walletStorePath = path.join(root, ".local", "internal-wallet-spike-store.json");
const fixtureLockPath = path.join(root, ".local", "checkpoint3-canonical-fixture.lock");
const FIXTURE_LOCK_TIMEOUT_MS = 120_000;
const FIXTURE_LOCK_STALE_MS = 5 * 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireFixtureLock() {
  const startedAt = Date.now();
  while (true) {
    try {
      fs.mkdirSync(fixtureLockPath, { recursive: false });
      fs.writeFileSync(
        path.join(fixtureLockPath, "owner.json"),
        `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }, null, 2)}\n`,
        "utf8",
      );
      return () => fs.rmSync(fixtureLockPath, { recursive: true, force: true });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const ageMs = Date.now() - fs.statSync(fixtureLockPath).mtimeMs;
      if (ageMs > FIXTURE_LOCK_STALE_MS) {
        fs.rmSync(fixtureLockPath, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - startedAt > FIXTURE_LOCK_TIMEOUT_MS) {
        throw new Error("Timed out waiting for checkpoint3 canonical fixture lock.");
      }
      await sleep(500);
    }
  }
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return structuredClone(fallback);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function bytes32(seed) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

function addressFromSeed(seed) {
  return `0x${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`;
}

function localDateTime(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

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

function persistenceMode() {
  loadEnvFile();
  return process.env.CCN_LIFECYCLE_PERSISTENCE === "supabase" ? "supabase" : "filesystem";
}

function supabaseClient() {
  loadEnvFile();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase fixture setup requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function makeDraft({ draftId, slug, title, challengeId, fundingIntentId, live }) {
  const now = new Date().toISOString();
  const transactionHash = bytes32(`checkpoint3-canonical-fixture-tx:${draftId}`);
  return {
    challenge: {
      id: draftId,
      challengeId,
      title,
      slug,
      brandName: "CCN Checkpoint 3 Demo",
      category: "Motion Design",
      market: "Arc Testnet",
      summary: "Deterministic canonical fixture for Checkpoint 3 validation.",
      description: "This isolated fixture proves public challenge resolution and creator submission without creating Circle or blockchain operations.",
      primaryDeliverable: "30-second motion concept",
      supportingDeliverables: [],
      referenceLinks: [],
      attachments: [],
      deadline: "",
      usageRightsAcknowledged: true,
      isSmokeTest: true,
    },
    prizePool: {
      totalAmount: 1,
      currency: "test USDC",
      winnerCount: 1,
      distributionMode: "custom",
      prizeDistribution: [{ place: "1st", amount: 1, currency: "test USDC" }],
      platformFee: 0.1,
      estimatedGas: 0,
      totalRequired: 1.1,
      prizePoolUnits: "1000000",
      distributionUnits: ["1000000"],
      platformFeeUnits: "100000",
      totalRequiredUnits: "1100000",
      allocatedUnits: "1000000",
      remainingUnits: "0",
    },
    reviewRules: {
      blindReview: true,
      anonymousSubmission: true,
      aiAllowed: false,
      allowedFormats: ["MP4", "MOV", "PDF", "PNG", "JPG", "Link"],
      usageRights: "Checkpoint 3 validation usage rights only.",
      submissionDeadline: localDateTime(7),
      reviewDeadline: localDateTime(14),
      judgingCriteria: ["Concept quality", "Brand fit"],
      creatorAcknowledgement: true,
      cancellationAcknowledgement: true,
    },
    funding: {
      network: "ARC-TESTNET",
      walletId: "checkpoint3-fixture-payment-wallet",
      walletAddress: "0x0000000000000000000000000000000000000001",
      availableBalance: 0,
      fundingStatus: live ? "funded" : "not-started",
      escrowStatus: live ? "verified" : "not-created",
      transactionId: live ? `checkpoint3-fixture-circle-tx-${draftId}` : "",
      transactionHash: live ? transactionHash : "",
      approvalTransactionId: "",
      approvalTransactionHash: "",
      fundingIntentId,
      eventVerified: live,
      lastBalanceRefreshAt: now,
    },
    deployment: {
      status: live ? "live" : "draft",
      currentStep: live ? "publish" : "basics",
      errorMessage: "",
      challengeId,
      publicationStatus: live ? "live" : "draft",
    },
    updatedAt: now,
  };
}

function makeVerification({ draft }) {
  return {
    txHash: draft.funding.transactionHash,
    circleTransactionId: draft.funding.transactionId,
    circleChallengeId: `checkpoint3-fixture-circle-challenge-${draft.challenge.id}`,
    draftId: draft.challenge.id,
    challengeId: draft.challenge.challengeId,
    fundingIntentId: draft.funding.fundingIntentId,
    walletId: draft.funding.walletId,
    ccnAccountId: "ccn-test-email-001",
    eventType: "ChallengeFunded",
    blockNumber: null,
    verifiedAt: new Date().toISOString(),
    receiptStatus: "success",
    receiptVerified: true,
    eventVerified: true,
    challengeVerified: true,
    sponsorVerified: true,
    amountVerified: true,
  };
}

function makeFundingRecord(draft) {
  return {
    ccnAccountId: "ccn-test-email-001",
    walletId: draft.funding.walletId,
    draftId: draft.challenge.id,
    challengeId: draft.challenge.challengeId,
    fundingIntentId: draft.funding.fundingIntentId,
    preflightStatus: "CHECKED",
    approvalStatus: "APPROVED",
    fundingStatus: "FUNDED_VERIFIED",
    fundingVerified: true,
    eventVerified: true,
    published: true,
    updatedAt: new Date().toISOString(),
  };
}

function makeFixtureIdentity(suiteName, suffix) {
  const supabaseUserId = randomUUID();
  const accountId = randomUUID();
  return {
    accountId,
    walletAddress: addressFromSeed(`checkpoint3-creator-wallet:${suiteName}:${suffix}`),
    walletId: `checkpoint3-fixture-creator-wallet-${suffix}`,
    mappingKey: `${accountId}:CREATOR:PAYOUT`,
    supabaseUserId,
    circleUserId: `checkpoint3-fixture-creator-circle-user-${suffix}`,
    walletIdempotencyKey: `${accountId}:CREATOR_PAYOUT`,
    authEmail: `checkpoint3-creator-${suffix}@example.invalid`,
  };
}

function makeWalletMapping(identity) {
  const now = new Date().toISOString();
  return {
    ccnAccountId: identity.accountId,
    role: "CREATOR",
    purpose: "PAYOUT",
    circleUserId: identity.circleUserId,
    walletId: identity.walletId,
    walletAddress: identity.walletAddress,
    blockchain: "ARC-TESTNET",
    accountType: "SCA",
    walletState: "live",
    createdAt: now,
    updatedAt: now,
  };
}

function assertNoForeignSupabaseConflict(rows, label) {
  const foreign = rows.find((row) => {
    const draftId = row.draft_id ?? row.draftId ?? "";
    const title = row.title ?? row.submission_state?.title ?? "";
    return !String(draftId).startsWith("checkpoint3-") && !String(title).startsWith("Checkpoint 3");
  });
  if (foreign) {
    throw new Error(`Refusing to overwrite unrelated Supabase ${label} fixture data.`);
  }
}

async function deleteSupabaseFixtureRows(supabase, fixture) {
  await supabase.from("ccn_submission_finalize_keys").delete().like("finalize_key", `${fixture.identity.accountId}:${fixture.liveDraft.challenge.challengeId.toLowerCase()}:checkpoint3-%`);
  await supabase.from("ccn_creator_submissions").delete().eq("challenge_id", fixture.liveDraft.challenge.challengeId).eq("creator_account_id", fixture.identity.accountId);
  await supabase.from("ccn_onchain_verifications").delete().eq("draft_id", fixture.liveDraft.challenge.id);
  await supabase.from("ccn_challenge_funding_records").delete().eq("draft_id", fixture.liveDraft.challenge.id);
  await supabase.from("ccn_challenge_drafts").delete().eq("draft_id", fixture.blockedDraft.challenge.id);
  await supabase.from("ccn_challenge_drafts").delete().eq("draft_id", fixture.liveDraft.challenge.id);
}

async function deleteSupabaseIdentityRows(supabase, fixture, { deleteAuthUser = false } = {}) {
  await supabase.from("ccn_wallet_mappings").delete().eq("mapping_key", fixture.identity.mappingKey);
  await supabase.from("wallets").delete().eq("account_id", fixture.identity.accountId).eq("scope", "CREATOR_PAYOUT");
  await supabase.from("circle_users").delete().eq("account_id", fixture.identity.accountId);
  await supabase.from("accounts").delete().eq("account_id", fixture.identity.accountId);
  if (deleteAuthUser) {
    const deleted = await supabase.auth.admin.deleteUser(fixture.identity.supabaseUserId);
    if (deleted.error) throw deleted.error;
  }
}

async function setupSupabaseFixture(fixture) {
  const supabase = supabaseClient();

  const existingDrafts = await supabase
    .from("ccn_challenge_drafts")
    .select("draft_id,title")
    .in("draft_id", [fixture.liveDraft.challenge.id, fixture.blockedDraft.challenge.id]);
  if (existingDrafts.error) throw existingDrafts.error;
  assertNoForeignSupabaseConflict(existingDrafts.data ?? [], "draft");

  const existingSubmissions = await supabase
    .from("ccn_creator_submissions")
    .select("submission_id,submission_state")
    .eq("challenge_id", fixture.liveDraft.challenge.challengeId)
    .eq("creator_account_id", fixture.identity.accountId);
  if (existingSubmissions.error) throw existingSubmissions.error;
  assertNoForeignSupabaseConflict(existingSubmissions.data ?? [], "submission");

  const existingMapping = await supabase
    .from("ccn_wallet_mappings")
    .select("*")
    .eq("mapping_key", fixture.identity.mappingKey)
    .maybeSingle();
  if (existingMapping.error) throw existingMapping.error;

  const existingAccount = await supabase
    .from("accounts")
    .select("*")
    .eq("account_id", fixture.identity.accountId)
    .maybeSingle();
  if (existingAccount.error) throw existingAccount.error;

  const existingCircleUser = await supabase
    .from("circle_users")
    .select("*")
    .eq("account_id", fixture.identity.accountId)
    .maybeSingle();
  if (existingCircleUser.error) throw existingCircleUser.error;

  const existingCreatorWallet = await supabase
    .from("wallets")
    .select("*")
    .eq("account_id", fixture.identity.accountId)
    .eq("scope", "CREATOR_PAYOUT")
    .maybeSingle();
  if (existingCreatorWallet.error) throw existingCreatorWallet.error;

  await deleteSupabaseFixtureRows(supabase, fixture);

  let createdAuthUser = false;
  try {
  const existingAuthUser = await supabase.auth.admin.getUserById(fixture.identity.supabaseUserId);
  if (!existingAuthUser.data?.user) {
    const created = await supabase.auth.admin.createUser({
      id: fixture.identity.supabaseUserId,
      email: fixture.identity.authEmail,
      email_confirm: true,
      user_metadata: { ccn_fixture: "checkpoint3-canonical-submission", ccn_fixture_account_id: fixture.identity.accountId },
    });
    if (created.error) throw created.error;
    createdAuthUser = true;
  }

  let result;

  result = await supabase.from("accounts").upsert({
    account_id: fixture.identity.accountId,
    supabase_user_id: fixture.identity.supabaseUserId,
    is_brand: false,
    is_creator: true,
    primary_email: fixture.identity.authEmail,
    status: "ACTIVE",
    deleted_at: null,
  }, { onConflict: "account_id" });
  if (result.error) throw result.error;

  result = await supabase.from("circle_users").upsert({
    account_id: fixture.identity.accountId,
    circle_user_id: fixture.identity.circleUserId,
  }, { onConflict: "account_id" }).select("circle_user_row_id").single();
  if (result.error) throw result.error;
  const circleUserRowId = result.data.circle_user_row_id;

  result = await supabase.from("wallets").upsert({
    account_id: fixture.identity.accountId,
    circle_user_row_id: circleUserRowId,
    scope: "CREATOR_PAYOUT",
    circle_wallet_id: fixture.identity.walletId,
    wallet_address: fixture.identity.walletAddress,
    blockchain: "ARC-TESTNET",
    status: "ACTIVE",
    idempotency_key: fixture.identity.walletIdempotencyKey,
  }, { onConflict: "account_id,scope" });
  if (result.error) throw result.error;

  const drafts = [fixture.liveDraft, fixture.blockedDraft].map((draft) => ({
    draft_id: draft.challenge.id,
    challenge_id: draft.challenge.challengeId,
    funding_intent_id: draft.funding.fundingIntentId,
    slug: draft.challenge.slug,
    title: draft.challenge.title,
    brand_name: draft.challenge.brandName,
    publication_status: draft.deployment.publicationStatus,
    funding_status: draft.funding.fundingStatus,
    escrow_status: draft.funding.escrowStatus,
    event_verified: draft.funding.eventVerified,
    draft_state: draft,
    updated_at: draft.updatedAt,
  }));
  result = await supabase.from("ccn_challenge_drafts").insert(drafts);
  if (result.error) throw result.error;

  const record = makeFundingRecord(fixture.liveDraft);
  result = await supabase.from("ccn_challenge_funding_records").insert({
    record_key: `checkpoint3:${fixture.liveDraft.challenge.id}`,
    ccn_account_id: record.ccnAccountId,
    wallet_id: record.walletId,
    draft_id: record.draftId,
    challenge_id: record.challengeId,
    funding_intent_id: record.fundingIntentId,
    funding_verified: true,
    event_verified: true,
    published: true,
    record_state: record,
    updated_at: record.updatedAt,
  });
  if (result.error) throw result.error;

  const verification = makeVerification({ draft: fixture.liveDraft });
  result = await supabase.from("ccn_onchain_verifications").insert({
    tx_hash: verification.txHash,
    circle_transaction_id: verification.circleTransactionId,
    circle_challenge_id: verification.circleChallengeId,
    draft_id: verification.draftId,
    challenge_id: verification.challengeId,
    funding_intent_id: verification.fundingIntentId,
    event_type: verification.eventType,
    receipt_verified: true,
    event_verified: true,
    challenge_verified: true,
    verification_state: verification,
    verified_at: verification.verifiedAt,
  });
  if (result.error) throw result.error;

  result = await supabase.from("ccn_wallet_mappings").upsert({
    mapping_key: fixture.identity.mappingKey,
    ccn_account_id: fixture.identity.accountId,
    role: "CREATOR",
    purpose: "PAYOUT",
    circle_user_id: fixture.identity.circleUserId,
    wallet_id: fixture.identity.walletId,
    wallet_address: fixture.identity.walletAddress,
    blockchain: "ARC-TESTNET",
    account_type: "SCA",
    wallet_state: "live",
    mapping_state: makeWalletMapping(fixture.identity),
    updated_at: new Date().toISOString(),
  }, { onConflict: "mapping_key" });
  if (result.error) throw result.error;
  } catch (error) {
    await deleteSupabaseFixtureRows(supabase, fixture).catch(() => undefined);
    await deleteSupabaseIdentityRows(supabase, fixture, { deleteAuthUser: createdAuthUser }).catch(() => undefined);
    throw error;
  }

  return async () => {
    await deleteSupabaseFixtureRows(supabase, fixture);

    if (existingMapping.data) {
      const restore = await supabase.from("ccn_wallet_mappings").upsert(existingMapping.data, { onConflict: "mapping_key" });
      if (restore.error) throw restore.error;
    } else {
      const remove = await supabase.from("ccn_wallet_mappings").delete().eq("mapping_key", fixture.identity.mappingKey);
      if (remove.error) throw remove.error;
    }

    if (existingCreatorWallet.data) {
      const restoreWallet = await supabase.from("wallets").upsert(existingCreatorWallet.data, { onConflict: "wallet_row_id" });
      if (restoreWallet.error) throw restoreWallet.error;
    } else {
      const removeWallet = await supabase.from("wallets").delete().eq("account_id", fixture.identity.accountId).eq("scope", "CREATOR_PAYOUT");
      if (removeWallet.error) throw removeWallet.error;
    }

    if (existingCircleUser.data) {
      const restoreCircleUser = await supabase.from("circle_users").upsert(existingCircleUser.data, { onConflict: "circle_user_row_id" });
      if (restoreCircleUser.error) throw restoreCircleUser.error;
    } else {
      const removeCircleUser = await supabase.from("circle_users").delete().eq("account_id", fixture.identity.accountId);
      if (removeCircleUser.error) throw removeCircleUser.error;
    }

    if (existingAccount.data) {
      const restoreAccount = await supabase.from("accounts").upsert(existingAccount.data, { onConflict: "account_id" });
      if (restoreAccount.error) throw restoreAccount.error;
    } else {
      const removeAccount = await supabase.from("accounts").delete().eq("account_id", fixture.identity.accountId);
      if (removeAccount.error) throw removeAccount.error;
    }

    if (createdAuthUser) {
      const deleteAuthUser = await supabase.auth.admin.deleteUser(fixture.identity.supabaseUserId);
      if (deleteAuthUser.error) throw deleteAuthUser.error;
    }

    const remaining = await supabase
      .from("ccn_challenge_drafts")
      .select("draft_id", { count: "exact", head: true })
      .in("draft_id", [fixture.liveDraft.challenge.id, fixture.blockedDraft.challenge.id]);
    if (remaining.error) throw remaining.error;
    if ((remaining.count ?? 0) !== 0) throw new Error("Supabase canonical fixture cleanup failed.");

    const [remainingAccount, remainingCircleUser, remainingWallet, remainingMapping, remainingSubmissions] = await Promise.all([
      supabase.from("accounts").select("account_id", { count: "exact", head: true }).eq("account_id", fixture.identity.accountId),
      supabase.from("circle_users").select("account_id", { count: "exact", head: true }).eq("account_id", fixture.identity.accountId),
      supabase.from("wallets").select("account_id", { count: "exact", head: true }).eq("account_id", fixture.identity.accountId),
      supabase.from("ccn_wallet_mappings").select("mapping_key", { count: "exact", head: true }).eq("mapping_key", fixture.identity.mappingKey),
      supabase.from("ccn_creator_submissions").select("submission_id", { count: "exact", head: true }).eq("creator_account_id", fixture.identity.accountId),
    ]);
    for (const result of [remainingAccount, remainingCircleUser, remainingWallet, remainingMapping, remainingSubmissions]) {
      if (result.error) throw result.error;
      if ((result.count ?? 0) !== 0) throw new Error("Supabase canonical fixture identity cleanup failed.");
    }
  };
}

function setupFilesystemFixture(fixture) {
  const createStore = readJsonFile(createStorePath, {
    version: 3,
    revision: 0,
    drafts: {},
    fundingRecords: {},
    approvalAttempts: {},
    fundingAttempts: {},
    winnerFinalizationAttempts: {},
    onChainVerificationsByTxHash: {},
  });
  const submissionStore = readJsonFile(submissionStorePath, { submissions: [], finalizeKeys: {} });
  const walletStore = readJsonFile(walletStorePath, {
    wallets: {},
    scopedWallets: {},
    migrations: {},
    quarantinedLegacyMappings: {},
  });
  const snapshot = structuredClone({ createStore, submissionStore, walletStore });

  createStore.drafts = createStore.drafts ?? {};
  createStore.fundingRecords = createStore.fundingRecords ?? {};
  createStore.onChainVerificationsByTxHash = createStore.onChainVerificationsByTxHash ?? {};
  delete createStore.drafts[fixture.liveDraft.challenge.id];
  delete createStore.drafts[fixture.blockedDraft.challenge.id];
  createStore.drafts[fixture.liveDraft.challenge.id] = fixture.liveDraft;
  createStore.drafts[fixture.blockedDraft.challenge.id] = fixture.blockedDraft;
  createStore.fundingRecords[`checkpoint3:${fixture.liveDraft.challenge.id}`] = makeFundingRecord(fixture.liveDraft);
  const verification = makeVerification({ draft: fixture.liveDraft });
  createStore.onChainVerificationsByTxHash[verification.txHash] = verification;
  createStore.revision = (createStore.revision ?? 0) + 1;

  submissionStore.submissions = (submissionStore.submissions ?? []).filter(
    (submission) =>
      submission.challengeId?.toLowerCase() !== fixture.liveDraft.challenge.challengeId.toLowerCase() ||
      submission.creatorAccountId !== fixture.identity.accountId,
  );
  for (const key of Object.keys(submissionStore.finalizeKeys ?? {})) {
    if (key.startsWith(`${fixture.identity.accountId}:${fixture.liveDraft.challenge.challengeId.toLowerCase()}:`)) {
      delete submissionStore.finalizeKeys[key];
    }
  }

  walletStore.scopedWallets = walletStore.scopedWallets ?? {};
  walletStore.scopedWallets[fixture.identity.mappingKey] = makeWalletMapping(fixture.identity);

  writeJsonFile(createStorePath, createStore);
  writeJsonFile(submissionStorePath, submissionStore);
  writeJsonFile(walletStorePath, walletStore);

  return async () => {
    writeJsonFile(createStorePath, snapshot.createStore);
    writeJsonFile(submissionStorePath, snapshot.submissionStore);
    writeJsonFile(walletStorePath, snapshot.walletStore);
  };
}

export async function setupCanonicalFixture(suiteName) {
  const releaseFixtureLock = await acquireFixtureLock();
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const identity = makeFixtureIdentity(suiteName, suffix);
  const liveDraftId = `checkpoint3-draft-${suiteName}-${suffix}`;
  const blockedDraftId = `checkpoint3-draft-${suiteName}-blocked-${suffix}`;
  const fixture = {
    mode: persistenceMode(),
    identity,
    liveDraft: makeDraft({
      draftId: liveDraftId,
      slug: `checkpoint3-${suiteName}-${suffix}`,
      title: `Checkpoint 3 ${suiteName.toUpperCase()} Canonical Fixture`,
      challengeId: FUNDED_CHAIN_CHALLENGE_ID,
      fundingIntentId: `checkpoint3-${suiteName}-funding-${suffix}`,
      live: true,
    }),
    blockedDraft: makeDraft({
      draftId: blockedDraftId,
      slug: `checkpoint3-${suiteName}-blocked-${suffix}`,
      title: `Checkpoint 3 ${suiteName.toUpperCase()} Blocked Fixture`,
      challengeId: bytes32(`checkpoint3-blocked:${suiteName}:${suffix}`),
      fundingIntentId: `checkpoint3-${suiteName}-blocked-funding-${suffix}`,
      live: false,
    }),
  };

  let cleanup;
  try {
    cleanup = fixture.mode === "supabase"
      ? await setupSupabaseFixture(fixture)
      : setupFilesystemFixture(fixture);
  } catch (error) {
    releaseFixtureLock();
    throw error;
  }

  return {
    ...fixture,
    creatorAccountId: fixture.identity.accountId,
    creatorWallet: fixture.identity.walletAddress,
    activeEscrow: ACTIVE_ESCROW,
    cleanup: async () => {
      try {
        await cleanup();
      } finally {
        releaseFixtureLock();
      }
    },
  };
}
