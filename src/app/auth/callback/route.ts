import { NextResponse } from "next/server";
import { getRequestRedirectOrigin } from "@/config/site-url";
import { resolveOrCreateCcnAccount } from "@/services/creator-foundation/creator-foundation.server";
import { createSupabaseServerClient } from "@/services/supabase/server";

type IntentRole = "brand" | "creator";

function safePath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function safeRole(value: string | null): IntentRole | null {
  return value === "brand" || value === "creator" ? value : null;
}

function safeCallbackType(value: string | null) {
  return value === "recovery" ? value : null;
}

function setupPath(role: IntentRole | null) {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  params.set("setup", "1");
  return `/auth/sign-up?${params.toString()}`;
}

function creatorOnboardingPath(next?: string | null) {
  const params = new URLSearchParams();
  if (next?.startsWith("/dashboard/creator")) params.set("next", next);
  const query = params.toString();
  return query ? `/auth/onboarding/creator?${query}` : "/auth/onboarding/creator";
}

function roleConflictPath(existingRole: IntentRole) {
  const params = new URLSearchParams();
  params.set("roleConflict", existingRole);
  return `/auth/sign-up?${params.toString()}`;
}

function traceCallback(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ccn-auth-callback]", { event, ...details });
}

function exchangeFailureCategory(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("expired")) return "expired";
  if (message.includes("invalid") || message.includes("token") || message.includes("code")) return "invalid-code";
  return "exchange-failed";
}

function brandOnboardingComplete(account: { is_brand: boolean; display_name?: string | null; brand_name?: string | null; brand_onboarding_completed_at?: string | null }) {
  return Boolean(
    account.is_brand &&
      account.display_name?.trim() &&
      account.brand_name?.trim() &&
      account.brand_onboarding_completed_at,
  );
}

function workspaceForAccount(input: {
  isBrand: boolean;
  isCreator: boolean;
  roleIntent: IntentRole | null;
  next: string | null;
}) {
  const next = input.next;
  if (next) {
    if (next.startsWith("/dashboard/creator") && input.isCreator) return next;
    if ((next === "/dashboard" || next.startsWith("/dashboard/")) && input.isBrand) return next;
  }

  if (input.roleIntent === "creator") {
    if (input.isBrand) return roleConflictPath("brand");
    if (input.isCreator) return "/dashboard/creator";
    return creatorOnboardingPath(input.next);
  }
  if (input.roleIntent === "brand") {
    if (input.isCreator) return roleConflictPath("creator");
    if (input.isBrand) return input.next ?? "/dashboard";
    return "/auth/onboarding/brand";
  }

  if (input.isBrand) return "/dashboard";
  if (input.isCreator) return "/dashboard/creator";
  return setupPath(null);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectOrigin = getRequestRedirectOrigin(request.url);
  const code = url.searchParams.get("code");
  const next = safePath(url.searchParams.get("next"));
  const roleIntent = safeRole(url.searchParams.get("role"));
  const callbackType = safeCallbackType(url.searchParams.get("type"));
  traceCallback("reached", {
    codePresent: Boolean(code),
    nextPresent: Boolean(next),
    roleIntent: roleIntent ?? "none",
    callbackType: callbackType ?? "auth",
  });

  try {
    const supabase = await createSupabaseServerClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        traceCallback("exchange-failure", { category: exchangeFailureCategory(error) });
        throw error;
      }
      traceCallback("exchange-success", { category: "ok" });
    } else {
      traceCallback("exchange-skipped", { category: "missing-code" });
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      traceCallback("session-failure", { category: "get-user-error" });
      throw error;
    }
    traceCallback("session-check", { sessionPresent: Boolean(data.user) });
    if (!data.user) throw new Error("Auth session was not created.");

    if (callbackType === "recovery") {
      const destination = next === "/auth/update-password" ? next : "/auth/update-password";
      traceCallback("final-redirect", { destination, callbackType });
      return NextResponse.redirect(new URL(destination, redirectOrigin));
    }

    const account = await resolveOrCreateCcnAccount(data.user);
    if (roleIntent === "brand" && !account.is_creator && !brandOnboardingComplete(account)) {
      traceCallback("final-redirect", { destination: "/auth/onboarding/brand" });
      return NextResponse.redirect(new URL("/auth/onboarding/brand", redirectOrigin));
    }

    const destination = workspaceForAccount({
      isBrand: account.is_brand === true,
      isCreator: account.is_creator === true,
      roleIntent,
      next,
    });

    traceCallback("final-redirect", { destination });
    return NextResponse.redirect(new URL(destination, redirectOrigin));
  } catch (error) {
    const category = exchangeFailureCategory(error);
    traceCallback("callback-error", { category });
    const params = new URLSearchParams({ error: category === "expired" ? "callback_expired" : "callback" });
    if (callbackType === "recovery") {
      return NextResponse.redirect(new URL(`/auth/update-password?${params.toString()}`, redirectOrigin));
    }
    return NextResponse.redirect(new URL(`/auth/sign-in?${params.toString()}`, redirectOrigin));
  }
}
