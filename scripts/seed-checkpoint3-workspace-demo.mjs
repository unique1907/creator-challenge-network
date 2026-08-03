import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv.includes("--cleanup") ? "cleanup" : "seed";

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

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const now = new Date();
const draftId = "checkpoint3-workspace-spotify-demo";
const challengeId = "0xc71562ffa5142a1e1d071cd8107b59591901cd993787b19397c1d8ceba7d294b";
const fundingIntentId = "checkpoint3-workspace-spotify-demo-funding-intent";
const slug = "spotify-motion-campaign";
const escrowContract = "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D";
const fundingTx = "0xb0840e9dcd4509c054e7397641df04d82318838f034e2c8f5355dd1495e5e249";
const circleFundingTransactionId = "88eff2d6-59dc-5fd1-bf50-af8ce3c74b1f";
const circleFundingChallengeId = "checkpoint3-workspace-demo-circle-funding-challenge";
const walletId = "checkpoint3-workspace-demo-payment-wallet";
const walletAddress = "0xb1e2700290381396bc2a85bb6c286ead5e80a5dd";
const ccnAccountId = "ccn-test-email-001";
const scopeKey = [ccnAccountId, walletId, draftId, challengeId, fundingIntentId].join(":");
const fundingRecordKey = `${ccnAccountId}:${walletId}:${draftId}:${challengeId}:${fundingIntentId}`;

function localDateTime(daysFromNow) {
  return new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function isoMinutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

function makeSubmission(index) {
  const creator = `ccn-demo-creator-${String(index).padStart(3, "0")}`;
  const submittedAt = isoMinutesAgo(180 - index * 9);
  return {
    id: `checkpoint3-workspace-demo-submission-${index}`,
    challengeId,
    creatorAccountId: creator,
    creatorWalletAddress: `0x${String(index).repeat(40).slice(0, 40)}`,
    anonymousEntryCode: `ANON-SPOTIFY-${String(index).padStart(3, "0")}`,
    title: [
      "Pulse Loop Launch Film",
      "Sonic Identity Motion Board",
      "Wrapped Countdown Concept",
      "Creator Spotlight Reel",
      "Playlist Drop Motion System",
      "Artist Moment Teaser",
      "Premium Social Cutdown",
      "Stage Light Product Reveal",
    ][index - 1],
    description: "Anonymous demo submission for visual QA of the Brand Campaign Workspace review-ready state.",
    primaryAssetUrl: `https://example.com/spotify-motion-demo-${index}`,
    supportingLinks: [`https://example.com/spotify-motion-demo-${index}/process`],
    assets: [],
    status: "SUBMITTED",
    version: 1,
    submittedAt,
    updatedAt: submittedAt,
  };
}

const submissionDeadline = localDateTime(-1);
const reviewDeadline = localDateTime(7);
const updatedAt = isoMinutesAgo(12);

const draftState = {
  challenge: {
    id: draftId,
    challengeId,
    title: "Spotify Motion Campaign",
    slug,
    brandName: "Spotify Demo",
    category: "Motion Design",
    market: "Arc Testnet",
    summary: "Create a 30-second motion concept for a new Spotify product moment.",
    description:
      "Spotify Demo is reviewing anonymous creator submissions for a premium motion campaign. This deterministic fixture uses existing verified Arc Testnet funding evidence and does not create any new Circle or blockchain operation.",
    primaryDeliverable: "30-second motion concept",
    supportingDeliverables: ["Storyboard", "Style frames", "Motion rationale"],
    referenceLinks: ["https://spotify.design"],
    attachments: [],
    deadline: submissionDeadline,
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
    usageRights: "Winner transfers predefined campaign usage rights for demo evaluation only.",
    submissionDeadline,
    reviewDeadline,
    judgingCriteria: ["Motion craft", "Brand fit", "Narrative clarity", "Social adaptability"],
    creatorAcknowledgement: true,
    cancellationAcknowledgement: true,
  },
  funding: {
    network: "ARC-TESTNET",
    walletId,
    walletAddress,
    availableBalance: 0,
    fundingStatus: "funded",
    escrowStatus: "verified",
    transactionId: circleFundingTransactionId,
    transactionHash: fundingTx,
    approvalTransactionId: "checkpoint3-workspace-demo-approval",
    approvalTransactionHash: "",
    fundingIntentId,
    eventVerified: true,
    lastBalanceRefreshAt: updatedAt,
  },
  deployment: {
    status: "live",
    currentStep: "publish",
    errorMessage: "",
    challengeId,
    publicationStatus: "live",
  },
  updatedAt,
};

const fundingRecord = {
  ccnAccountId,
  walletId,
  draftId,
  challengeId,
  fundingIntentId,
  preflightStatus: "CHECKED",
  approvalStatus: "APPROVED",
  fundingStatus: "FUNDED_VERIFIED",
  fundingVerified: true,
  eventVerified: true,
  published: true,
  updatedAt,
};

const approvalAttempt = {
  ccnAccountId,
  walletId,
  draftId,
  challengeId,
  fundingIntentId,
  purpose: "APPROVAL",
  sequence: 1,
  idempotencyKey: "checkpoint3-workspace-demo-approval-key",
  circleChallengeId: "checkpoint3-workspace-demo-circle-approval-challenge",
  circleStatus: "APPROVED",
  circleTransactionId: "checkpoint3-workspace-demo-approval-transaction",
  transactionHash: "",
  createdAt: isoMinutesAgo(70),
  updatedAt: isoMinutesAgo(68),
};

const fundingAttempt = {
  ccnAccountId,
  walletId,
  draftId,
  challengeId,
  fundingIntentId,
  purpose: "FUNDING",
  sequence: 1,
  idempotencyKey: "checkpoint3-workspace-demo-funding-key",
  circleChallengeId: circleFundingChallengeId,
  circleStatus: "COMPLETE",
  circleTransactionId: circleFundingTransactionId,
  transactionHash: fundingTx,
  createdAt: isoMinutesAgo(64),
  updatedAt: isoMinutesAgo(61),
};

const verification = {
  txHash: fundingTx,
  circleTransactionId: circleFundingTransactionId,
  circleChallengeId: circleFundingChallengeId,
  draftId,
  challengeId,
  fundingIntentId,
  walletId,
  ccnAccountId,
  eventType: "ChallengeFunded",
  blockNumber: 53646524,
  verifiedAt: isoMinutesAgo(60),
  receiptStatus: "success",
  receiptVerified: true,
  eventVerified: true,
  challengeVerified: true,
  sponsorVerified: true,
  amountVerified: true,
};

async function cleanup() {
  await supabase.from("ccn_submission_finalize_keys").delete().like("finalize_key", `checkpoint3-workspace-demo:%`);
  await supabase.from("ccn_creator_submissions").delete().eq("challenge_id", challengeId).like("submission_id", "checkpoint3-workspace-demo-%");
  await supabase.from("ccn_lifecycle_events").delete().eq("draft_id", draftId);
  await supabase.from("ccn_onchain_verifications").delete().eq("draft_id", draftId);
  await supabase.from("ccn_funding_attempts").delete().eq("draft_id", draftId);
  await supabase.from("ccn_wallet_approval_attempts").delete().eq("draft_id", draftId);
  await supabase.from("ccn_challenge_funding_records").delete().eq("draft_id", draftId);
  await supabase.from("ccn_challenge_drafts").delete().eq("draft_id", draftId);

  const remaining = await supabase
    .from("ccn_challenge_drafts")
    .select("draft_id", { count: "exact", head: true })
    .eq("draft_id", draftId);
  if (remaining.error) throw remaining.error;
  if ((remaining.count ?? 0) !== 0) throw new Error("Workspace demo cleanup failed.");

  return { result: "Checkpoint 3 workspace demo fixture cleaned", draftId };
}

async function seed() {
  await cleanup();

  let result = await supabase.from("ccn_challenge_drafts").insert({
    draft_id: draftId,
    challenge_id: challengeId,
    funding_intent_id: fundingIntentId,
    slug,
    title: draftState.challenge.title,
    brand_name: draftState.challenge.brandName,
    publication_status: "live",
    funding_status: "funded",
    escrow_status: "verified",
    event_verified: true,
    draft_state: draftState,
    updated_at: updatedAt,
  });
  if (result.error) throw result.error;

  result = await supabase.from("ccn_challenge_funding_records").insert({
    record_key: fundingRecordKey,
    ccn_account_id: ccnAccountId,
    wallet_id: walletId,
    draft_id: draftId,
    challenge_id: challengeId,
    funding_intent_id: fundingIntentId,
    funding_verified: true,
    event_verified: true,
    published: true,
    record_state: fundingRecord,
    updated_at: updatedAt,
  });
  if (result.error) throw result.error;

  result = await supabase.from("ccn_wallet_approval_attempts").insert({
    scope_key: scopeKey,
    circle_challenge_id: approvalAttempt.circleChallengeId,
    sequence: 1,
    ccn_account_id: ccnAccountId,
    wallet_id: walletId,
    draft_id: draftId,
    challenge_id: challengeId,
    funding_intent_id: fundingIntentId,
    circle_status: approvalAttempt.circleStatus,
    circle_transaction_id: approvalAttempt.circleTransactionId,
    transaction_hash: null,
    idempotency_key: approvalAttempt.idempotencyKey,
    attempt_state: approvalAttempt,
    updated_at: approvalAttempt.updatedAt,
  });
  if (result.error) throw result.error;

  result = await supabase.from("ccn_funding_attempts").insert({
    scope_key: scopeKey,
    circle_challenge_id: fundingAttempt.circleChallengeId,
    sequence: 1,
    ccn_account_id: ccnAccountId,
    wallet_id: walletId,
    draft_id: draftId,
    challenge_id: challengeId,
    funding_intent_id: fundingIntentId,
    circle_status: fundingAttempt.circleStatus,
    circle_transaction_id: fundingAttempt.circleTransactionId,
    transaction_hash: fundingAttempt.transactionHash,
    idempotency_key: fundingAttempt.idempotencyKey,
    attempt_state: fundingAttempt,
    updated_at: fundingAttempt.updatedAt,
  });
  if (result.error) throw result.error;

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

  const submissions = Array.from({ length: 8 }, (_, index) => makeSubmission(index + 1));
  result = await supabase.from("ccn_creator_submissions").insert(submissions.map((submission) => ({
    submission_id: submission.id,
    challenge_id: submission.challengeId,
    creator_account_id: submission.creatorAccountId,
    creator_wallet_address: submission.creatorWalletAddress,
    anonymous_entry_code: submission.anonymousEntryCode,
    title: submission.title,
    status: submission.status,
    version: submission.version,
    submitted_at: submission.submittedAt,
    updated_at: submission.updatedAt,
    submission_state: submission,
  })));
  if (result.error) throw result.error;

  result = await supabase.from("ccn_lifecycle_events").insert([
    { draft_id: draftId, challenge_id: challengeId, event_type: "campaign_created", actor: "SYSTEM", metadata: { label: "Campaign created" }, created_at: isoMinutesAgo(90) },
    { draft_id: draftId, challenge_id: challengeId, event_type: "funding_confirmed", actor: "SYSTEM", metadata: { txHash: fundingTx }, created_at: isoMinutesAgo(60) },
    { draft_id: draftId, challenge_id: challengeId, event_type: "published", actor: "SYSTEM", metadata: { slug }, created_at: isoMinutesAgo(45) },
    { draft_id: draftId, challenge_id: challengeId, event_type: "submission_received", actor: "CREATOR", metadata: { count: submissions.length }, created_at: isoMinutesAgo(20) },
  ]);
  if (result.error) throw result.error;

  return {
    result: "Checkpoint 3 workspace demo fixture seeded",
    draftId,
    route: `/dashboard/challenges/${draftId}`,
    challengeId,
    slug,
    submissions: submissions.length,
    lifecycle: "review-ready",
    runtimeContract: escrowContract,
    fundingTransaction: fundingTx,
    circleOperationCreated: false,
    blockchainTransactionCreated: false,
  };
}

const output = command === "cleanup" ? await cleanup() : await seed();
console.log(JSON.stringify(output, null, 2));
