import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/services/supabase/server";
import { CreatorFoundationError, updateBrandProfile } from "@/services/creator-foundation/creator-foundation.server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: { message: "Sign in is required." } }, { status: 401 });
    return NextResponse.json({
      account: await updateBrandProfile(data.user, {
        displayName: body.displayName,
        avatarImageKey: body.avatarImageKey,
      }),
    });
  } catch (error) {
    if (error instanceof CreatorFoundationError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    return NextResponse.json({ error: { message: "Profile update failed safely." } }, { status: 500 });
  }
}
