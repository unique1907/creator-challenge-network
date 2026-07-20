import { NextResponse } from "next/server";
import { clearStoredWallet } from "@/services/circle/wallet-spike-store.server";
import { listWallets } from "@/services/circle/user-controlled-wallets.server";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const wallet = await listWallets({
      ccnAccountId: body.ccnAccountId,
      authProvider: body.authProvider,
      userToken: body.userToken,
    });
    return NextResponse.json({ wallet });
  } catch (error) {
    return safeRouteError(error);
  }
}

export async function DELETE(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      internalUserId?: string;
    };
    if (body.internalUserId) {
      await clearStoredWallet(body.internalUserId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeRouteError(error);
  }
}
