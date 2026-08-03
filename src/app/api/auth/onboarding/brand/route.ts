import { NextResponse } from "next/server";
import {
  completeBrandOnboarding,
  CreatorFoundationError,
} from "@/services/creator-foundation/creator-foundation.server";
import { createSupabaseServerClient } from "@/services/supabase/server";

function safeError(error: unknown) {
  if (error instanceof CreatorFoundationError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { message: "Brand onboarding request failed safely." } },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      displayName?: unknown;
      brandName?: unknown;
    };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) {
      return NextResponse.json(
        { error: { message: "Sign in is required.", code: "AUTHENTICATION_REQUIRED" } },
        { status: 401 },
      );
    }
    const account = await completeBrandOnboarding(data.user, {
      displayName: body.displayName,
      brandName: body.brandName,
    });
    return NextResponse.json({ account, redirectTo: "/dashboard" });
  } catch (error) {
    return safeError(error);
  }
}
