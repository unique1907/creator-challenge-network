import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/services/supabase/admin.server";

export const CCN_MEDIA_BUCKET = "ccn-media";

export type MediaKind = "avatar" | "brand-logo" | "campaign-cover";

export type CampaignMedia = {
  imageKey: string | null;
  imageUrl: string | null;
  alt: string;
  fallback: "cover" | "deterministic";
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const IDENTITY_MAX_BYTES = 3 * 1024 * 1024;

export class BrandMediaError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(input: { message: string; status?: number; code: string }) {
    super(input.message);
    this.name = "BrandMediaError";
    this.status = input.status ?? 400;
    this.code = input.code;
  }
}

function extensionForType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  throw new BrandMediaError({ message: "Unsupported image type.", code: "UNSUPPORTED_IMAGE_TYPE" });
}

function hasValidMagicBytes(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (type === "image/webp") {
    const header = new TextDecoder().decode(bytes.slice(0, 12));
    return header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
  }
  return false;
}

function pathFor(input: { kind: MediaKind; accountId: string; draftId?: string; contentType: string }) {
  const extension = extensionForType(input.contentType);
  const fileId = randomUUID();
  if (input.kind === "campaign-cover") {
    if (!input.draftId) throw new BrandMediaError({ message: "Draft ID is required.", code: "DRAFT_REQUIRED" });
    return `campaigns/${input.draftId}/cover/${fileId}.${extension}`;
  }
  if (input.kind === "brand-logo") return `accounts/${input.accountId}/brand-logo/${fileId}.${extension}`;
  return `accounts/${input.accountId}/avatar/${fileId}.${extension}`;
}

export async function validateImageFile(input: { file: File; kind: MediaKind }) {
  const maxBytes = input.kind === "campaign-cover" ? COVER_MAX_BYTES : IDENTITY_MAX_BYTES;
  if (!ACCEPTED_IMAGE_TYPES.has(input.file.type)) {
    throw new BrandMediaError({
      message: "Use a JPG, PNG or WebP image.",
      status: 400,
      code: "UNSUPPORTED_IMAGE_TYPE",
    });
  }
  if (input.file.size <= 0) {
    throw new BrandMediaError({ message: "Choose a non-empty image.", status: 400, code: "EMPTY_IMAGE" });
  }
  if (input.file.size > maxBytes) {
    throw new BrandMediaError({
      message: input.kind === "campaign-cover" ? "Campaign cover must be 5 MB or smaller." : "Image must be 3 MB or smaller.",
      status: 400,
      code: "IMAGE_TOO_LARGE",
    });
  }
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (!hasValidMagicBytes(bytes, input.file.type)) {
    throw new BrandMediaError({
      message: "Uploaded image content does not match the declared image type.",
      status: 400,
      code: "IMAGE_CONTENT_MISMATCH",
    });
  }
  return bytes;
}

export async function uploadBrandMedia(input: {
  file: File;
  kind: MediaKind;
  accountId: string;
  draftId?: string;
}) {
  const bytes = await validateImageFile({ file: input.file, kind: input.kind });
  const objectKey = pathFor({
    kind: input.kind,
    accountId: input.accountId,
    draftId: input.draftId,
    contentType: input.file.type,
  });
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(CCN_MEDIA_BUCKET).upload(objectKey, bytes, {
    contentType: input.file.type,
    upsert: false,
  });
  if (error) {
    throw new BrandMediaError({ message: "Image upload failed safely.", status: 502, code: "UPLOAD_FAILED" });
  }
  return {
    objectKey,
    publicUrl: publicMediaUrl(objectKey),
  };
}

export async function removeBrandMedia(objectKey: string | null | undefined) {
  if (!objectKey) return;
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(CCN_MEDIA_BUCKET).remove([objectKey]);
}

export function publicMediaUrl(objectKey: string | null | undefined) {
  if (!objectKey) return null;
  const supabase = createSupabaseAdminClient();
  const { data } = supabase.storage.from(CCN_MEDIA_BUCKET).getPublicUrl(objectKey);
  return data.publicUrl;
}

export function resolveCampaignCover(input: {
  coverImageKey?: string | null;
  coverImageAlt?: string | null;
  title?: string | null;
  category?: string | null;
}): CampaignMedia {
  const imageUrl = publicMediaUrl(input.coverImageKey);
  return {
    imageKey: input.coverImageKey ?? null,
    imageUrl,
    alt: input.coverImageAlt?.trim() || `${input.title?.trim() || "Campaign"} cover image`,
    fallback: imageUrl ? "cover" : "deterministic",
  };
}

export function resolveAccountImageUrl(imageKey: string | null | undefined) {
  return publicMediaUrl(imageKey);
}
