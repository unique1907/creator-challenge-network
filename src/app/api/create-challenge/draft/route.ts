import { NextResponse } from "next/server";
import {
  ARC_TESTNET_CHAIN_ID,
  getCreateChallengeDeadlinePolicy,
  logCreateChallengeDeadlinePolicy,
} from "@/config/create-challenge-deadline-policy";
import {
  assertCreateChallengeDraftOwner,
  createNewCreateChallengeDraft,
  createNewSmokeTestCreateChallengeDraft,
  DraftNotFoundError,
  getCreateChallengeDraftForAccount,
  listCreateChallengeDrafts,
  PublicSlugReservationError,
  saveCreateChallengeDraft,
  StoreCorruptionError,
  validateCreateChallengeDraft,
} from "@/services/create-challenge/create-challenge-store.server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { resolveCampaignCover } from "@/services/media/brand-media.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";
import type { CreateChallengeDraftState, CreateChallengeStepId, CreateChallengeValidation } from "@/types/create-challenge";
import { validateCreateChallengeLaunchReadiness } from "@/utils/create-challenge-launch-readiness";

function createDraftPayload(draft: CreateChallengeDraftState, validation?: CreateChallengeValidation | null) {
  const deadlinePolicy = getCreateChallengeDeadlinePolicy({
    runtimeBlockchain: "ARC-TESTNET",
    chainId: ARC_TESTNET_CHAIN_ID,
    isSmokeTestChallenge: draft.challenge.isSmokeTest === true,
  });
  if (process.env.NODE_ENV !== "production") {
    logCreateChallengeDeadlinePolicy("/api/create-challenge/draft", deadlinePolicy);
  }
  return {
    draft,
    validation: validation ?? null,
    deadlinePolicy,
    launchReadiness: validateCreateChallengeLaunchReadiness(draft, { deadlinePolicy }),
    cover: resolveCampaignCover({
      coverImageKey: draft.challenge.coverImageKey,
      coverImageAlt: draft.challenge.coverImageAlt,
      title: draft.challenge.title,
      category: draft.challenge.category,
    }),
  };
}
function safeRouteError(error: unknown) {
  if (error instanceof DraftNotFoundError) {
    return NextResponse.json({ error: { message: error.message } }, { status: 404 });
  }
  if (error instanceof StoreCorruptionError) {
    return NextResponse.json(
      { error: { message: "Create Challenge local store needs manual recovery before continuing." } },
      { status: 503 },
    );
  }
  if (error instanceof PublicSlugReservationError) {
    return NextResponse.json(
      { error: { message: "We couldn't reserve a public URL. Please try again.", code: error.code } },
      { status: 409 },
    );
  }
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  if (error instanceof CcnAuthError) {
    return authErrorResponse(error);
  }
  return NextResponse.json(
    { error: { message: error instanceof Error ? error.message : "Create Challenge request failed." } },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const url = new URL(request.url);
    if (url.searchParams.get("list") === "1") {
      return NextResponse.json({ drafts: await listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId }) });
    }
    if (url.searchParams.get("new") === "1") {
      return NextResponse.json(createDraftPayload(await createNewCreateChallengeDraft({
        ccnAccountId: context.ccnAccountId,
        brandName: context.brandName ?? context.displayName,
      })));
    }
    if (url.searchParams.get("mode") === "smoke") {
      return NextResponse.json(createDraftPayload(await createNewSmokeTestCreateChallengeDraft({
        ccnAccountId: context.ccnAccountId,
        brandName: context.brandName ?? context.displayName,
      })));
    }
    const draftId = url.searchParams.get("draftId");
    if (!draftId) {
      return NextResponse.json(
        { error: { message: "draftId is required unless new=1 or list=1 is provided." } },
        { status: 400 },
      );
    }
    return NextResponse.json(createDraftPayload(await getCreateChallengeDraftForAccount(draftId, context.ccnAccountId)));
  } catch (error) {
    return safeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const body = (await request.json()) as {
      draft: CreateChallengeDraftState;
      draftId?: string;
      step?: CreateChallengeStepId;
    };
    const draftId = body.draftId || body.draft?.challenge?.id;
    if (!draftId) {
      return NextResponse.json({ error: { message: "draftId is required to save a draft." } }, { status: 400 });
    }
    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    const draft = await saveCreateChallengeDraft(body.draft, draftId, { ccnAccountId: context.ccnAccountId });
    const deadlinePolicy = getCreateChallengeDeadlinePolicy({
      runtimeBlockchain: "ARC-TESTNET",
      chainId: ARC_TESTNET_CHAIN_ID,
      isSmokeTestChallenge: draft.challenge.isSmokeTest === true,
    });
    const validation = body.step
      ? validateCreateChallengeDraft(draft, body.step, { deadlinePolicy })
      : null;
    return NextResponse.json(createDraftPayload(draft, validation));
  } catch (error) {
    return safeRouteError(error);
  }
}
