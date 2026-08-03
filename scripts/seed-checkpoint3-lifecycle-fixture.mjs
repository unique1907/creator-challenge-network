import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed the Checkpoint 3 lifecycle fixture.");
}

function bytes32(seed) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

const now = new Date();
const draftId = "checkpoint3-lifecycle-fixture";
const challengeId = bytes32(draftId);
const fundingIntentId = "checkpoint3-lifecycle-fixture-funding-intent";
const submissionDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
const reviewDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

const draftState = {
  challenge: {
    id: draftId,
    challengeId,
    title: "Checkpoint 3 Lifecycle Fixture",
    slug: "checkpoint3-lifecycle-fixture",
    brandName: "CCN Demo",
    category: "Motion Design",
    market: "Testnet",
    summary: "Development-only deterministic lifecycle persistence fixture.",
    description: "This unfunded fixture verifies durable draft persistence without creating blockchain, Circle, funding, payout, or publish state.",
    referenceLinks: [],
    attachments: [],
    primaryDeliverable: "Submission form persistence proof",
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
    allowedFormats: ["Video", "Image", "Link"],
    usageRights: "Demo usage rights only.",
    submissionDeadline,
    reviewDeadline,
    judgingCriteria: ["Concept quality"],
    creatorAcknowledgement: true,
    cancellationAcknowledgement: true,
  },
  funding: {
    network: "ARC-TESTNET",
    walletId: "",
    walletAddress: "",
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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.from("ccn_challenge_drafts").upsert({
  draft_id: draftId,
  challenge_id: challengeId,
  funding_intent_id: fundingIntentId,
  slug: draftState.challenge.slug,
  title: draftState.challenge.title,
  brand_name: draftState.challenge.brandName,
  publication_status: "draft",
  funding_status: "not-started",
  escrow_status: "not-created",
  event_verified: false,
  draft_state: draftState,
  updated_at: draftState.updatedAt,
}, { onConflict: "draft_id" });

if (error) throw error;

console.log(JSON.stringify({
  result: "Checkpoint 3 lifecycle fixture seeded",
  draftId,
  challengeId,
  fundingIntentId,
  financialState: "unfunded",
  circleOperationCreated: false,
  blockchainTransactionCreated: false,
}, null, 2));
