import "server-only";

import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";

export function requireDraftId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  throw new CircleSpikeError({
    message: "draftId is required for this Create Challenge payment request.",
    status: 400,
  });
}

export function requireSearchDraftId(searchParams: URLSearchParams): string {
  return requireDraftId(searchParams.get("draftId"));
}
