import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/services/supabase/server";
import { CreatorFoundationError, updateBrandCompany } from "@/services/creator-foundation/creator-foundation.server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: { message: "Sign in is required." } }, { status: 401 });
    return NextResponse.json({
      account: await updateBrandCompany(data.user, {
        brandName: body.brandName,
        brandLogoImageKey: body.brandLogoImageKey,
        websiteUrl: body.websiteUrl,
        companyDescription: body.companyDescription,
        linkedinUrl: body.linkedinUrl,
        instagramUrl: body.instagramUrl,
        xUrl: body.xUrl,
      }),
    });
  } catch (error) {
    if (error instanceof CreatorFoundationError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    return NextResponse.json({ error: { message: "Company settings update failed safely." } }, { status: 500 });
  }
}
