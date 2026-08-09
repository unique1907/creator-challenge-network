import "server-only";

import { resolveAccountImageUrl } from "@/services/media/brand-media.server";
import type { CcnAccount } from "@/types/creator-foundation";

const RESERVED_PLATFORM_BRAND_NAMES = new Set([
  "ccn creator challenge network",
  "creator challenge network",
]);

export function normalizeBrandCompanyName(value: string | null | undefined) {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!text) return null;
  if (RESERVED_PLATFORM_BRAND_NAMES.has(text.toLowerCase())) return null;
  return text;
}

export function resolveBrandAccountIdentity(account: Pick<CcnAccount, "avatar_image_key" | "brand_name">) {
  const avatarImageKey = account.avatar_image_key ?? null;
  return {
    avatarImageKey,
    avatarImageUrl: resolveAccountImageUrl(avatarImageKey),
    brandName: normalizeBrandCompanyName(account.brand_name),
  };
}
