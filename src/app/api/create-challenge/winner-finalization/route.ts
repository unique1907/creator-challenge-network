import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";
import { assertCreateChallengeDraftOwner } from "@/services/create-challenge/create-challenge-store.server";
import { requireDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import {
  createWinnerPayoutApproval,
  finalizeWinnerSelection,
  getWinnerPayoutStatusForFinalizedAttempt,
  prepareWinnerFinalization,
  reconcileFinalizedWinnerPayout,
  requestWinnerFinalization,
} from "@/services/create-challenge/winner-finalization.server";
import { resolveCanonicalWinnerSelection } from "@/services/submissions/canonical-challenge-lifecycle.server";
import type {
  WinnerFinalizationAuthority,
  WinnerFinalizationSelection,
} from "@/types/winner-finalization";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  if (error instanceof CcnAuthError) return authErrorResponse(error);
  return NextResponse.json({ error: { message: "Winner finalization request failed." } }, { status: 400 });
}

function parseAuthority(value: unknown): WinnerFinalizationAuthority {
  if (value === "BRAND" || value === "JURY") return value;
  throw new CircleSpikeError({ message: "Finalization authority must be BRAND or JURY.", status: 400 });
}

async function parseWinners(
  body: Record<string, unknown>,
  draftId: string,
): Promise<WinnerFinalizationSelection[]> {
  if (typeof body.selectedWinners !== "undefined") {
    throw new CircleSpikeError({
      message: "Client-supplied winner wallet payloads are not accepted. Use selectedBlindEntryIds.",
      status: 400,
    });
  }
  return resolveCanonicalWinnerSelection({
    draftId,
    selectedBlindEntryIds: body.selectedBlindEntryIds,
  });
}

function assertNoClientAuthorityOverrides(body: Record<string, unknown>) {
  const forbidden = [
    "payoutWalletId",
    "payoutWalletAddress",
    "contractAddress",
    "escrowContractAddress",
    "treasuryRecipient",
    "transactionId",
    "transactionHash",
    "circleTransactionId",
    "payoutAmounts",
  ];
  const found = forbidden.find((key) => typeof body[key] !== "undefined");
  if (found) {
    throw new CircleSpikeError({
      message: `Client-supplied payout authority field is not accepted: ${found}.`,
      status: 400,
    });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const body = (await request.json()) as Record<string, unknown>;
    const draftId = requireDraftId(body.draftId);
    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    const authority = parseAuthority(body.authority);

    if (body.mode === "prepare") {
      const selectedWinners = await parseWinners(body, draftId);
      assertNoClientAuthorityOverrides(body);
      return NextResponse.json(await prepareWinnerFinalization({
        draftId,
        authority,
        selectedWinners,
      }));
    }

    if (body.mode === "finalize-selection") {
      const selectedWinners = await parseWinners(body, draftId);
      assertNoClientAuthorityOverrides(body);
      return NextResponse.json(await finalizeWinnerSelection({
        draftId,
        authority,
        selectedWinners,
      }));
    }

    if (body.mode === "create-approval") {
      const selectedWinners = await parseWinners(body, draftId);
      assertNoClientAuthorityOverrides(body);
      return NextResponse.json(await createWinnerPayoutApproval({
        draftId,
        authority,
        selectedWinners,
      }));
    }

    if (body.mode === "status") {
      assertNoClientAuthorityOverrides(body);
      return NextResponse.json(await getWinnerPayoutStatusForFinalizedAttempt({
        draftId,
        authority,
      }));
    }

    if (body.mode === "reconcile") {
      assertNoClientAuthorityOverrides({
        ...body,
        transactionHash: undefined,
      });
      return NextResponse.json(await reconcileFinalizedWinnerPayout({
        draftId,
        authority,
        transactionHash: typeof body.transactionHash === "string" ? body.transactionHash : undefined,
      }));
    }

    const selectedWinners = await parseWinners(body, draftId);
    assertNoClientAuthorityOverrides(body);
    return NextResponse.json(await requestWinnerFinalization({
      draftId,
      authority,
      selectedWinners,
    }));
  } catch (error) {
    return safeRouteError(error);
  }
}
