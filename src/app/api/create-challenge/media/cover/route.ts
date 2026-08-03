import { NextResponse } from "next/server";
import {
  ARC_TESTNET_CHAIN_ID,
  getCreateChallengeDeadlinePolicy,
  logCreateChallengeDeadlinePolicy,
} from "@/config/create-challenge-deadline-policy";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import {
  assertCreateChallengeDraftOwner,
  getCreateChallengeDraft,
  patchCreateChallengeDraft,
} from "@/services/create-challenge/create-challenge-store.server";
import { BrandMediaError, removeBrandMedia, uploadBrandMedia } from "@/services/media/brand-media.server";
import { validateCreateChallengeLaunchReadiness } from "@/utils/create-challenge-launch-readiness";

function deadlinePolicyForDraft(draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>) {
  return getCreateChallengeDeadlinePolicy({
    runtimeBlockchain: "ARC-TESTNET",
    chainId: ARC_TESTNET_CHAIN_ID,
    isSmokeTestChallenge: draft.challenge.isSmokeTest === true,
  });
}

function mediaError(error: unknown) {
  if (error instanceof BrandMediaError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  return NextResponse.json({ error: { message: "Campaign cover request failed safely." } }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedCcnContext({ workspace: "brand" });
    if (!context?.brandAccess) {
      return NextResponse.json({ error: { message: "Brand workspace access is required." } }, { status: 403 });
    }
    const form = await request.formData();
    const draftId = String(form.get("draftId") ?? "");
    const file = form.get("file");
    const alt = String(form.get("alt") ?? "").trim();
    if (!draftId) return NextResponse.json({ error: { message: "Draft ID is required." } }, { status: 400 });
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { message: "Choose a campaign cover image." } }, { status: 400 });
    }
    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    const draft = await getCreateChallengeDraft(draftId);
    const previousKey = draft.challenge.coverImageKey ?? null;
    const uploaded = await uploadBrandMedia({
      file,
      kind: "campaign-cover",
      accountId: context.ccnAccountId,
      draftId,
    });
    const persisted = await patchCreateChallengeDraft({
      challenge: {
        coverImageKey: uploaded.objectKey,
        coverImageAlt: alt || `${draft.challenge.title || "Campaign"} cover image`,
      } as never,
    }, draftId, { ccnAccountId: context.ccnAccountId });
    if (persisted.challenge.coverImageKey !== uploaded.objectKey) {
      await removeBrandMedia(uploaded.objectKey).catch(() => undefined);
      return NextResponse.json({ error: { message: "Campaign cover persistence could not be verified." } }, { status: 503 });
    }
    const updated = await patchCreateChallengeDraft({
      challenge: {
        coverImageUpdatedAt: new Date().toISOString(),
      } as never,
    }, draftId, { ccnAccountId: context.ccnAccountId });
    if (updated.challenge.coverImageKey !== uploaded.objectKey) {
      await removeBrandMedia(uploaded.objectKey).catch(() => undefined);
      return NextResponse.json({ error: { message: "Campaign cover persistence could not be verified." } }, { status: 503 });
    }
    if (previousKey && previousKey !== uploaded.objectKey) {
      await removeBrandMedia(previousKey).catch(() => undefined);
    }
    const deadlinePolicy = deadlinePolicyForDraft(updated);
    logCreateChallengeDeadlinePolicy("/api/create-challenge/media/cover", deadlinePolicy);
    return NextResponse.json({
      draft: updated,
      deadlinePolicy,
      launchReadiness: validateCreateChallengeLaunchReadiness(updated, { deadlinePolicy }),
      cover: {
        imageKey: uploaded.objectKey,
        imageUrl: uploaded.publicUrl,
        alt: updated.challenge.coverImageAlt,
      },
    });
  } catch (error) {
    return mediaError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getAuthenticatedCcnContext({ workspace: "brand" });
    if (!context?.brandAccess) {
      return NextResponse.json({ error: { message: "Brand workspace access is required." } }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get("draftId") ?? "";
    if (!draftId) return NextResponse.json({ error: { message: "Draft ID is required." } }, { status: 400 });
    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    const draft = await getCreateChallengeDraft(draftId);
    if (draft.deployment.publicationStatus === "live") {
      return NextResponse.json({ error: { message: "Published campaign covers cannot be removed from this workflow." } }, { status: 400 });
    }
    const previousKey = draft.challenge.coverImageKey ?? null;
    const updated = await patchCreateChallengeDraft({
      challenge: {
        coverImageKey: null,
        coverImageAlt: null,
        coverImageUpdatedAt: new Date().toISOString(),
      } as never,
    }, draftId, { ccnAccountId: context.ccnAccountId });
    await removeBrandMedia(previousKey).catch(() => undefined);
    const deadlinePolicy = deadlinePolicyForDraft(updated);
    logCreateChallengeDeadlinePolicy("/api/create-challenge/media/cover", deadlinePolicy);
    return NextResponse.json({
      draft: updated,
      deadlinePolicy,
      launchReadiness: validateCreateChallengeLaunchReadiness(updated, { deadlinePolicy }),
      cover: null,
    });
  } catch (error) {
    return mediaError(error);
  }
}
