import { NextResponse } from "next/server";
import { getRequestRedirectOrigin } from "@/config/site-url";
import { clearCreatorSession } from "@/services/creator-session.server";
import { createSupabaseServerClient } from "@/services/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearCreatorSession();
  return NextResponse.redirect(new URL("/auth/sign-in", getRequestRedirectOrigin(request.url)), { status: 303 });
}
