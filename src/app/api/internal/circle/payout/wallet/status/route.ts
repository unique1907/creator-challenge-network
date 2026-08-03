import { NextResponse } from "next/server";
import { requireSpikeAccess, safeRouteError } from "@/app/api/internal/circle/_utils";
import {
  USER_WALLET_ACCOUNT_TYPE,
  USER_WALLET_BLOCKCHAIN,
  circleFetch,
} from "@/services/circle/user-controlled-wallets.server";
import {
  getScopedStoredWallet,
  listStoredWalletMappings,
  upsertScopedStoredWallet,
} from "@/services/circle/wallet-spike-store.server";

type WalletResponse = {
  id: string;
  address: string;
  blockchain: string;
  accountType?: string;
  state?: string;
  createDate?: string;
  updateDate?: string;
  userId?: string;
};

type WalletListResponse = {
  wallets?: WalletResponse[];
};

function payoutAccountId() {
  const value = process.env.CCN_PAYOUT_ACCOUNT_ID;
  if (!value || !/^[A-Za-z0-9._:-]{5,50}$/.test(value)) {
    throw new Error("CCN_PAYOUT_ACCOUNT_ID is not configured.");
  }
  return value;
}

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ccnAccountId = payoutAccountId();
    const existing = await getScopedStoredWallet({
      ccnAccountId,
      role: "BRAND",
      purpose: "PAYOUT",
    });
    if (existing) {
      return NextResponse.json({ wallet: existing, mapped: true });
    }

    const mappings = await listStoredWalletMappings();
    const existingWalletIds = new Set([
      ...mappings.wallets.map((wallet) => wallet.walletId),
      ...mappings.scopedWallets.map((wallet) => wallet.walletId),
    ]);
    const data = await circleFetch<WalletListResponse>({
      endpoint: "/v1/w3s/wallets",
      method: "GET",
      userToken: String(body.userToken ?? ""),
    });
    const candidates = (data.wallets ?? []).filter((wallet) =>
      wallet.id &&
      wallet.address &&
      wallet.blockchain === USER_WALLET_BLOCKCHAIN &&
      wallet.accountType === USER_WALLET_ACCOUNT_TYPE &&
      wallet.state === "LIVE" &&
      !existingWalletIds.has(wallet.id)
    );

    if (candidates.length !== 1) {
      return NextResponse.json({
        wallet: null,
        mapped: false,
        candidateCount: candidates.length,
      });
    }

    const wallet = candidates[0];
    const now = new Date().toISOString();
    const mapping = await upsertScopedStoredWallet({
      ccnAccountId,
      role: "BRAND",
      purpose: "PAYOUT",
      circleUserId: wallet.userId ?? ccnAccountId,
      walletId: wallet.id,
      walletAddress: wallet.address,
      blockchain: USER_WALLET_BLOCKCHAIN,
      accountType: USER_WALLET_ACCOUNT_TYPE,
      walletState: "live",
      createdAt: wallet.createDate ?? now,
      updatedAt: wallet.updateDate ?? now,
    });

    return NextResponse.json({ wallet: mapping, mapped: true });
  } catch (error) {
    return safeRouteError(error);
  }
}
