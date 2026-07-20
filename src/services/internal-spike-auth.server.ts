import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SPIKE_ACCESS_COOKIE = "ccn_internal_spike_access";

function hashAccessKey(value: string) {
  return createHash("sha256").update(`ccn-spike:${value}`).digest("hex");
}

export function isSpikeConfigured() {
  return Boolean(process.env.INTERNAL_SPIKE_ACCESS_KEY);
}

export function isSpikeAllowedInEnvironment() {
  return process.env.NODE_ENV === "development";
}

export function validateSpikeAccessKey(value: unknown) {
  const configured = process.env.INTERNAL_SPIKE_ACCESS_KEY;
  if (!configured || typeof value !== "string" || value.length < 8) {
    return false;
  }

  const expected = Buffer.from(hashAccessKey(configured));
  const received = Buffer.from(hashAccessKey(value));
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export async function getSpikeAccessCookieValue() {
  const configured = process.env.INTERNAL_SPIKE_ACCESS_KEY;
  if (!configured) {
    return "";
  }
  return hashAccessKey(configured);
}

export async function hasSpikeAccess() {
  if (!isSpikeConfigured() || !isSpikeAllowedInEnvironment()) {
    return false;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SPIKE_ACCESS_COOKIE)?.value;
  const expected = await getSpikeAccessCookieValue();

  if (!cookieValue || !expected) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(cookieValue);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
