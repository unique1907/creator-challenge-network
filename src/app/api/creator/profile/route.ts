import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/services/supabase/server";
import {
  CreatorFoundationError,
  getCreatorProfileIdentity,
  getSafeCurrentAccount,
  logCreatorProfileRuntime,
  updateCreatorProfile,
} from "@/services/creator-foundation/creator-foundation.server";

function safeError(error: unknown, fallback = "Creator profile request failed safely.") {
  if (error instanceof CreatorFoundationError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  return NextResponse.json({ error: { message: fallback } }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: { message: "Sign in is required." } }, { status: 401 });
    const account = await getSafeCurrentAccount(data.user);
    return NextResponse.json({ profile: await getCreatorProfileIdentity(account.accountId) });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      logCreatorProfileRuntime({
        authUser: null,
        accountId: null,
        profileAccountId: null,
        profileAuthUserId: null,
        operation: "resolve",
        affected: 0,
        result: "failure",
        reason: "supabase-session-missing",
      });
      return NextResponse.json(
        { error: { message: "Sign in is required.", code: "AUTHENTICATION_REQUIRED" } },
        { status: 401 },
      );
    }
    return NextResponse.json({
      profile: await updateCreatorProfile(data.user, {
        displayName: body.displayName,
        username: body.username,
        country: body.country,
        avatarImageKey: body.avatarImageKey,
      }),
    });
  } catch (error) {
    return safeError(error, "Creator profile update failed safely.");
  }
}
