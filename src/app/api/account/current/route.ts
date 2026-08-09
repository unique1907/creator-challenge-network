import { NextResponse } from "next/server";
import {
  CreatorFoundationError,
  getSafeCurrentAccount,
} from "@/services/creator-foundation/creator-foundation.server";
import { createSupabaseServerClient } from "@/services/supabase/server";

function isMissingAuthSessionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return candidate.name === "AuthSessionMissingError" || candidate.message === "Auth session missing!";
}

function authRequiredResponse() {
  return NextResponse.json(
    { error: { message: "Sign in is required.", code: "AUTHENTICATION_REQUIRED" } },
    { status: 401 },
  );
}

function safeError(error: unknown) {
  if (isMissingAuthSessionError(error)) {
    return authRequiredResponse();
  }
  if (error instanceof CreatorFoundationError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { message: "Current account request failed safely." } },
    { status: 400 },
  );
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) {
      return authRequiredResponse();
    }
    return NextResponse.json({ account: await getSafeCurrentAccount(data.user) });
  } catch (error) {
    return safeError(error);
  }
}
