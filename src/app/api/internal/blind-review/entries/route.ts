import { NextResponse } from "next/server";
import {
  listCanonicalBlindReviewEntries,
} from "@/services/submissions/canonical-challenge-lifecycle.server";
import {
  assertBlindReviewProjectionIsAnonymous,
} from "@/services/submissions/submission-store.server";
import { requireSpikeAccess, safeRouteError } from "../../circle/_utils";

export async function GET(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const url = new URL(request.url);
    const { entries, challenge } = await listCanonicalBlindReviewEntries({
      draftId: url.searchParams.get("draftId") ?? "",
    });
    const anonymousProjection = assertBlindReviewProjectionIsAnonymous(entries);
    if (!anonymousProjection) {
      return NextResponse.json(
        { error: { message: "Blind review projection contains identity fields." } },
        { status: 500 },
      );
    }
    return NextResponse.json({
      entries,
      fieldList: entries[0] ? Object.keys(entries[0]) : [],
      identityLeakTest: "PASSED",
      challenge,
    });
  } catch (error) {
    return safeRouteError(error);
  }
}
