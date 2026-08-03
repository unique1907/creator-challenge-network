import { NextResponse } from "next/server";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { BrandMediaError, uploadBrandMedia } from "@/services/media/brand-media.server";

function creatorAvatarDiagnosticsEnabled() {
  return process.env.NODE_ENV === "development" || process.env.CCN_CREATOR_PROFILE_DIAGNOSTICS === "true";
}

function shortSafeId(value: string | null | undefined) {
  if (!value) return "missing";
  if (value.length <= 12) return "present";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function errorResponse(error: unknown) {
  if (error instanceof BrandMediaError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  return NextResponse.json({ error: { message: "Creator identity image request failed safely." } }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedCcnContext({ workspace: "creator" });
    if (!context?.creatorAccess) {
      return NextResponse.json({ error: { message: "Creator workspace access is required." } }, { status: 403 });
    }

    const form = await request.formData();
    const type = String(form.get("type") ?? "");
    const file = form.get("file");

    if (type !== "avatar") {
      return NextResponse.json({ error: { message: "Creator avatar image type is required." } }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { message: "Choose an image." } }, { status: 400 });
    }

    const uploaded = await uploadBrandMedia({
      file,
      kind: "avatar",
      accountId: context.ccnAccountId,
    });

    if (creatorAvatarDiagnosticsEnabled()) {
      console.info("[creator-avatar-upload]", {
        accountId: shortSafeId(context.ccnAccountId),
        uploaded: true,
        profileReferenceUpdated: false,
      });
    }

    return NextResponse.json({
      image: {
        imageKey: uploaded.objectKey,
        imageUrl: uploaded.publicUrl,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
