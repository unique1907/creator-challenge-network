import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  EscrowFundingIntent,
  EscrowFundingStatus,
} from "@/types/escrow-funding-spike";

const STORE_PATH = join(
  process.cwd(),
  ".local",
  "internal-escrow-funding-spike.json",
);

const CHALLENGE_LOGICAL_ID = "ccn-sprint-4d-top1-001";
const CHALLENGE_ID =
  "0xa314abd00d17d4f0bad27d9824fc9c47af8bc6082f79240773bf28a4b0f17b88";
const ESCROW_CONTRACT_ADDRESS =
  "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D";
const USDC_CONTRACT_ADDRESS = "0x3600000000000000000000000000000000000000";
const PRIZE_AMOUNT = "10000000";
const PLATFORM_FEE = "100000";
const TOTAL_REQUIRED = "10100000";

type Store = {
  intent?: EscrowFundingIntent;
};

function futureUnixSeconds(daysFromNow: number) {
  return Math.floor(Date.now() / 1000) + daysFromNow * 24 * 60 * 60;
}

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(STORE_PATH, "utf8")) as Store;
  } catch {
    return {};
  }
}

async function writeStore(store: Store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getEscrowFundingIntent() {
  const store = await readStore();
  if (store.intent) {
    return store.intent;
  }

  const now = new Date().toISOString();
  const intent: EscrowFundingIntent = {
    ccnAccountId: "ccn-test-email-001",
    authProvider: "email",
    challengeLogicalId: CHALLENGE_LOGICAL_ID,
    challengeId: CHALLENGE_ID,
    fundingIntentId: randomUUID(),
    approvalIdempotencyKey: randomUUID(),
    fundingIdempotencyKey: randomUUID(),
    escrowContractAddress: ESCROW_CONTRACT_ADDRESS,
    usdcContractAddress: USDC_CONTRACT_ADDRESS,
    prizeAmount: PRIZE_AMOUNT,
    platformFee: PLATFORM_FEE,
    totalRequired: TOTAL_REQUIRED,
    submissionDeadline: futureUnixSeconds(3),
    reviewDeadline: futureUnixSeconds(5),
    status: "READY_FOR_FUNDING",
    createdAt: now,
    updatedAt: now,
  };

  await writeStore({ intent });
  return intent;
}

export async function updateEscrowFundingIntent(
  changes: Partial<EscrowFundingIntent> & { status?: EscrowFundingStatus },
) {
  const current = await getEscrowFundingIntent();
  const updated: EscrowFundingIntent = {
    ...current,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  await writeStore({ intent: updated });
  return updated;
}
