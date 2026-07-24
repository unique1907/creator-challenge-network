import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  ScopedWalletMapping,
  SpikeWalletRecord,
  WalletPurpose,
  WalletRole,
} from "@/types/wallet-spike";

type MigrationMarker = {
  legacyInternalUserId: string;
  scopedKey: string;
  migratedAt: string;
};

type QuarantinedLegacyMapping = {
  legacyInternalUserId: string;
  reason: string;
  ccnAccountId?: string;
  attemptedRole?: WalletRole;
  attemptedPurpose?: WalletPurpose;
  quarantinedAt: string;
};

type SpikeStore = {
  wallets: Record<string, SpikeWalletRecord>;
  scopedWallets: Record<string, ScopedWalletMapping>;
  migrations: Record<string, MigrationMarker>;
  quarantinedLegacyMappings: Record<string, QuarantinedLegacyMapping>;
};

const STORE_PATH = join(
  process.cwd(),
  ".local",
  "internal-wallet-spike-store.json",
);

const emptyStore: SpikeStore = {
  wallets: {},
  scopedWallets: {},
  migrations: {},
  quarantinedLegacyMappings: {},
};

function normalizeStore(input: Partial<SpikeStore> | null | undefined): SpikeStore {
  return {
    wallets: input?.wallets ?? {},
    scopedWallets: input?.scopedWallets ?? {},
    migrations: input?.migrations ?? {},
    quarantinedLegacyMappings: input?.quarantinedLegacyMappings ?? {},
  };
}

async function readStore(): Promise<SpikeStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw) as Partial<SpikeStore>);
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: SpikeStore) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(normalizeStore(store), null, 2), "utf8");
}

export function buildWalletMappingKey(input: {
  ccnAccountId: string;
  role: WalletRole;
  purpose: WalletPurpose;
}) {
  return [input.ccnAccountId, input.role, input.purpose].join(":");
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

export async function getScopedStoredWallet(input: {
  ccnAccountId: string;
  role: WalletRole;
  purpose: WalletPurpose;
}) {
  const store = await readStore();
  return store.scopedWallets[buildWalletMappingKey(input)] ?? null;
}

export async function upsertScopedStoredWallet(mapping: ScopedWalletMapping) {
  const store = await readStore();
  const key = buildWalletMappingKey(mapping);
  store.scopedWallets[key] = {
    ...mapping,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.scopedWallets[key];
}

export async function migrateLegacyStoredWallet(input: {
  legacyInternalUserId: string;
  ccnAccountId: string;
  role: WalletRole;
  purpose: WalletPurpose;
  expectedWalletAddress?: string;
  verifiedWallet: {
    circleUserId: string;
    walletId: string;
    walletAddress: string;
    blockchain: "ARC-TESTNET";
    accountType: "SCA" | "EOA" | "MSCA";
    walletState: string;
    createdAt?: string;
    updatedAt?: string;
  };
}) {
  const store = await readStore();
  const key = buildWalletMappingKey(input);
  const existing = store.scopedWallets[key];
  if (existing) return { migrated: false, mapping: existing, reason: "SCOPED_MAPPING_EXISTS" as const };

  const legacy = store.wallets[input.legacyInternalUserId];
  if (!legacy) return { migrated: false, mapping: null, reason: "NO_LEGACY_MAPPING" as const };

  const quarantine = (reason: string) => {
    store.quarantinedLegacyMappings[input.legacyInternalUserId] = {
      legacyInternalUserId: input.legacyInternalUserId,
      reason,
      ccnAccountId: legacy.ccnAccountId,
      attemptedRole: input.role,
      attemptedPurpose: input.purpose,
      quarantinedAt: new Date().toISOString(),
    };
    return writeStore(store).then(() => ({
      migrated: false,
      mapping: null,
      reason: "AMBIGUOUS_LEGACY_WALLET_MAPPING" as const,
    }));
  };

  if (legacy.ccnAccountId !== input.ccnAccountId) {
    return quarantine("Legacy CCN account does not match scoped account.");
  }
  if (input.expectedWalletAddress && legacy.walletAddress.toLowerCase() !== input.expectedWalletAddress.toLowerCase()) {
    return quarantine("Legacy wallet address does not match expected scoped wallet.");
  }
  if (legacy.walletAddress.toLowerCase() !== input.verifiedWallet.walletAddress.toLowerCase()) {
    return quarantine("Legacy wallet address does not match Circle verified wallet.");
  }
  if (legacy.walletId !== input.verifiedWallet.walletId) {
    return quarantine("Legacy wallet ID does not match Circle verified wallet.");
  }

  const now = new Date().toISOString();
  const mapping: ScopedWalletMapping = {
    ccnAccountId: input.ccnAccountId,
    role: input.role,
    purpose: input.purpose,
    circleUserId: input.verifiedWallet.circleUserId,
    walletId: input.verifiedWallet.walletId,
    walletAddress: input.verifiedWallet.walletAddress,
    blockchain: input.verifiedWallet.blockchain,
    accountType: input.verifiedWallet.accountType,
    walletState: input.verifiedWallet.walletState,
    createdAt: input.verifiedWallet.createdAt ?? legacy.createDate ?? now,
    updatedAt: input.verifiedWallet.updatedAt ?? now,
  };
  store.scopedWallets[key] = mapping;
  store.migrations[key] = {
    legacyInternalUserId: input.legacyInternalUserId,
    scopedKey: key,
    migratedAt: now,
  };
  await writeStore(store);
  return { migrated: true, mapping, reason: "MIGRATED" as const };
}

export async function listWalletMappingDiagnostics() {
  const store = await readStore();
  return {
    legacyCount: Object.keys(store.wallets).length,
    scopedCount: Object.keys(store.scopedWallets).length,
    migrationCount: Object.keys(store.migrations).length,
    ambiguousCount: Object.keys(store.quarantinedLegacyMappings).length,
  };
}
