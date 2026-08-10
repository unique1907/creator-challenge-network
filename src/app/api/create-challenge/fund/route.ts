import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";
import { requireDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import { getCreateChallengePaymentOverview } from "@/services/create-challenge/brand-payment-account.server";
import { createProductFundingChallenge } from "@/services/create-challenge/create-challenge-funding.server";
import { assertCreateChallengeDraftOwner } from "@/services/create-challenge/create-challenge-store.server";

type FundingDiagnosticCode =
  | "FUNDING_PERSISTENCE_FAILED"
  | "FUNDING_WALLET_RESOLUTION_FAILED"
  | "FUNDING_ARC_READ_FAILED"
  | "FUNDING_CIRCLE_REQUEST_FAILED"
  | "FUNDING_UNKNOWN_SERVER_ERROR";

function safeString(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/Bearer\s+[A-Za-z0-9:._-]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt-redacted]")
    .replace(/(api[_-]?key|secret|token|pin|password)=?[A-Za-z0-9:._-]+/gi, "$1=[redacted]")
    .slice(0, 180);
}

function errorRecord(error: unknown) {
  return error && typeof error === "object" ? error as Record<string, unknown> : {};
}

function safeErrorCode(error: unknown) {
  const record = errorRecord(error);
  const code = record.code ?? record.statusCode ?? record.status;
  return typeof code === "string" || typeof code === "number" ? String(code).slice(0, 80) : undefined;
}

function safeStatus(error: unknown) {
  const record = errorRecord(error);
  const status = record.status ?? record.statusCode;
  return typeof status === "number" && Number.isFinite(status) ? status : undefined;
}

function classifyFundingException(error: unknown): FundingDiagnosticCode {
  const record = errorRecord(error);
  const name = safeString(record.name) ?? (error instanceof Error ? error.name : "");
  const message = safeString(record.message) ?? (error instanceof Error ? safeString(error.message) : "");
  const code = safeErrorCode(error) ?? "";
  const joined = [name, message, code].join(" ").toLowerCase();

  if (/pgrst|postgres|supabase|duplicate key|violates|constraint|23505|42p|42703/.test(joined)) {
    return "FUNDING_PERSISTENCE_FAILED";
  }
  if (/wallet|payment account/.test(joined)) return "FUNDING_WALLET_RESOLUTION_FAILED";
  if (/arc|rpc|eth_|fetch failed|econn|etimedout|abort/.test(joined)) return "FUNDING_ARC_READ_FAILED";
  if (/circle|contractexecution|payment provider/.test(joined)) return "FUNDING_CIRCLE_REQUEST_FAILED";
  return "FUNDING_UNKNOWN_SERVER_ERROR";
}

function logFundingDiagnostic(input: { error: unknown; draftId?: string }) {
  const record = errorRecord(input.error);
  const diagnostic = {
    event: "create_challenge_funding_failed",
    draftId: input.draftId,
    challengeId: undefined,
    errorName: safeString(record.constructor?.name) ?? (input.error instanceof Error ? input.error.name : typeof input.error),
    errorMessage: safeString(record.message) ?? (input.error instanceof Error ? safeString(input.error.message) : undefined),
    code: safeErrorCode(input.error),
    status: safeStatus(input.error),
    operation: classifyFundingException(input.error),
    timestamp: new Date().toISOString(),
  };
  console.error("[ccn-create-challenge-fund]", JSON.stringify(diagnostic));
}

function safeRouteError(error: unknown, input: { draftId?: string } = {}) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  if (error instanceof CcnAuthError) return authErrorResponse(error);
  const code = classifyFundingException(error);
  logFundingDiagnostic({ error, draftId: input.draftId });
  return NextResponse.json({ error: { message: "Funding request failed.", code } }, { status: 400 });
}

export async function POST(request: Request) {
  let draftId: string | undefined;
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const body = (await request.json()) as Record<string, unknown>;
    draftId = requireDraftId(body.draftId);
    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    const funding = await createProductFundingChallenge(body.userToken, draftId, { ccnAccountId: context.ccnAccountId });
    return NextResponse.json({
      funding,
      paymentOverview: await getCreateChallengePaymentOverview(draftId, undefined, { ccnAccountId: context.ccnAccountId }),
    });
  } catch (error) {
    return safeRouteError(error, { draftId });
  }
}
