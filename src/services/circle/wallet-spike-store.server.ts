import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SpikeWalletRecord } from "@/types/wallet-spike";

type SpikeStore = {
  wallets: Record<string, SpikeWalletRecord>;
};

const STORE_PATH = join(
  process.cwd(),
  ".local",
  "internal-wallet-spike-store.json",
);

const emptyStore: SpikeStore = {
  wallets: {},
};

async function readStore(): Promise<SpikeStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as SpikeStore;
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: SpikeStore) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getStoredWallet(internalUserId: string) {
  const store = await readStore();
  return store.wallets[internalUserId] ?? null;
}

export async function upsertStoredWallet(record: SpikeWalletRecord) {
  const store = await readStore();
  store.wallets[record.internalUserId] = record;
  await writeStore(store);
  return record;
}

export async function clearStoredWallet(internalUserId: string) {
  const store = await readStore();
  delete store.wallets[internalUserId];
  await writeStore(store);
}
