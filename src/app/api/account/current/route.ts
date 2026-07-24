import { NextResponse } from "next/server";
import {
  CreatorFoundationError,
  getSafeCurrentAccount,
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
    { error: { message: "Current account request failed safely." } },
    { status: 400 },
  );
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return NextResponse.json({ account: await getSafeCurrentAccount(data.user) });
  } catch (error) {
    return safeError(error);
  }
}
