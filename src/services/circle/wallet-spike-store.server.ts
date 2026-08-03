import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createSupabaseAdminClient } from "@/services/supabase/admin.server";
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
const IS_MANAGED_PRODUCTION =
  process.env.VERCEL_ENV === "production" ||
  process.env.CCN_DEPLOYMENT_ENV === "production";
const WALLET_MAPPING_PERSISTENCE_ADAPTER =
  process.env.CCN_LIFECYCLE_PERSISTENCE ??
  (IS_MANAGED_PRODUCTION ? "supabase" : "filesystem");

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
  assertPersistenceAdapter();
  if (WALLET_MAPPING_PERSISTENCE_ADAPTER === "supabase") return readSupabaseStore();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw) as Partial<SpikeStore>);
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: SpikeStore) {
  assertPersistenceAdapter();
  if (WALLET_MAPPING_PERSISTENCE_ADAPTER === "supabase") {
    await writeSupabaseStore(store);
    return;
  }
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(normalizeStore(store), null, 2), "utf8");
}

function assertPersistenceAdapter() {
  if (WALLET_MAPPING_PERSISTENCE_ADAPTER !== "filesystem" && WALLET_MAPPING_PERSISTENCE_ADAPTER !== "supabase") {
    throw new Error("CCN_LIFECYCLE_PERSISTENCE must be either filesystem or supabase.");
  }
  if (IS_MANAGED_PRODUCTION && WALLET_MAPPING_PERSISTENCE_ADAPTER !== "supabase") {
    throw new Error("Production wallet mapping persistence must use Supabase/Postgres. Set CCN_LIFECYCLE_PERSISTENCE=supabase.");
  }
}

async function readSupabaseStore(): Promise<SpikeStore> {
  const supabase = createSupabaseAdminClient();
  const [legacy, scoped] = await Promise.all([
    supabase.from("ccn_legacy_wallet_records").select("internal_user_id,wallet_state"),
    supabase.from("ccn_wallet_mappings").select("mapping_key,mapping_state"),
  ]);
  if (legacy.error) throw legacy.error;
  if (scoped.error) throw scoped.error;
  return normalizeStore({
    wallets: Object.fromEntries(
      (legacy.data ?? []).map((row) => [row.internal_user_id, row.wallet_state as SpikeWalletRecord]),
    ),
    scopedWallets: Object.fromEntries(
      (scoped.data ?? []).map((row) => [row.mapping_key, row.mapping_state as ScopedWalletMapping]),
    ),
    migrations: {},
    quarantinedLegacyMappings: {},
  });
}

async function writeSupabaseStore(store: SpikeStore) {
  const normalized = normalizeStore(store);
  const supabase = createSupabaseAdminClient();
  const legacyRows = Object.entries(normalized.wallets).map(([internalUserId, wallet]) => ({
    internal_user_id: internalUserId,
    wallet_state: wallet,
    updated_at: new Date().toISOString(),
  }));
  if (legacyRows.length) {
    const { error } = await supabase.from("ccn_legacy_wallet_records").upsert(legacyRows, { onConflict: "internal_user_id" });
    if (error) throw error;
  }

  const scopedRows = Object.entries(normalized.scopedWallets).map(([mappingKey, mapping]) => ({
    mapping_key: mappingKey,
    ccn_account_id: mapping.ccnAccountId,
    role: mapping.role,
    purpose: mapping.purpose,
    circle_user_id: mapping.circleUserId,
    wallet_id: mapping.walletId,
    wallet_address: mapping.walletAddress,
    blockchain: mapping.blockchain,
    account_type: mapping.accountType,
    wallet_state: mapping.walletState,
    mapping_state: mapping,
    updated_at: mapping.updatedAt ?? new Date().toISOString(),
  }));
  if (scopedRows.length) {
    const { error } = await supabase.from("ccn_wallet_mappings").upsert(scopedRows, { onConflict: "mapping_key" });
    if (error) throw error;
  }
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

export async function listStoredWalletMappings() {
  const store = await readStore();
  return {
    wallets: Object.values(store.wallets),
    scopedWallets: Object.values(store.scopedWallets),
  };
}
