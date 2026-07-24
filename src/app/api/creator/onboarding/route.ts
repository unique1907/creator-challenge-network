import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import {
  CreatorFoundationError,
  startCreatorOnboarding,
} from "@/services/creator-foundation/creator-foundation.server";
import { createSupabaseServerClient } from "@/services/supabase/server";

function safeError(error: unknown) {
  if (error instanceof CreatorFoundationError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code } },
      { status: error.status },
    );
  }
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  return NextResponse.json(
    { error: { message: "Creator onboarding request failed safely." } },
    { status: 400 },
  );
}

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return NextResponse.json({ onboarding: await startCreatorOnboarding(data.user) });
  } catch (error) {
    return safeError(error);
  }
}
