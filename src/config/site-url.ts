export const DEFAULT_PUBLIC_SITE_URL = "https://creator-challenge-network.vercel.app";

function normalizeSiteOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an http or https URL.");
  }
  return url.origin;
}

function isLoopbackOrigin(origin: string) {
  const hostname = new URL(origin).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getPublicSiteOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return normalizeSiteOrigin(window.location.origin);
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return normalizeSiteOrigin(configured || DEFAULT_PUBLIC_SITE_URL);
}

export function getRequestRedirectOrigin(requestUrl: string) {
  const requestOrigin = new URL(requestUrl).origin;
  if (isLoopbackOrigin(requestOrigin)) return requestOrigin;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return configured ? normalizeSiteOrigin(configured) : requestOrigin;
}
