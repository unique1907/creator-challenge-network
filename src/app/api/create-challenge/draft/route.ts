import { NextResponse } from "next/server";
import {
  createNewCreateChallengeDraft,
  DraftNotFoundError,
  getCreateChallengeDraftStrict,
  listCreateChallengeDrafts,
  saveCreateChallengeDraft,
  StoreCorruptionError,
  validateCreateChallengeDraft,
} from "@/services/create-challenge/create-challenge-store.server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import type { CreateChallengeDraftState, CreateChallengeStepId } from "@/types/create-challenge";

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
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  return NextResponse.json(
    { error: { message: error instanceof Error ? error.message : "Create Challenge request failed." } },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("list") === "1") {
      return NextResponse.json({ drafts: await listCreateChallengeDrafts() });
    }
    if (url.searchParams.get("new") === "1") {
      return NextResponse.json({ draft: await createNewCreateChallengeDraft() });
    }
    const draftId = url.searchParams.get("draftId");
    if (!draftId) {
      return NextResponse.json(
        { error: { message: "draftId is required unless new=1 or list=1 is provided." } },
        { status: 400 },
      );
    }
    return NextResponse.json({
      draft: await getCreateChallengeDraftStrict(draftId),
    });
  } catch (error) {
    return safeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draft: CreateChallengeDraftState;
      draftId?: string;
      step?: CreateChallengeStepId;
    };
    const draftId = body.draftId || body.draft?.challenge?.id;
    if (!draftId) {
      return NextResponse.json({ error: { message: "draftId is required to save a draft." } }, { status: 400 });
    }
    const draft = await saveCreateChallengeDraft(body.draft, draftId);
    const validation = body.step
      ? validateCreateChallengeDraft(draft, body.step)
      : null;
    return NextResponse.json({ draft, validation });
  } catch (error) {
    return safeRouteError(error);
  }
}
