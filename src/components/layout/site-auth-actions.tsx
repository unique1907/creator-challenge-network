"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicAuthState } from "@/types/public-auth";

type SessionState =
  | "loading"
  | "brand"
  | "creator"
  | "brand-incomplete"
  | "creator-incomplete"
  | "anonymous";

type CurrentAccountResponse = {
  account?: {
    isBrand?: boolean;
    isCreator?: boolean;
    primaryRole?: "brand" | "creator" | null;
    brandOnboardingComplete?: boolean;
  };
};

function sessionStateFromPublicAuth(authState: PublicAuthState): SessionState {
  if (authState.kind === "brand") return authState.onboardingComplete ? "brand" : "brand-incomplete";
  if (authState.kind === "creator") return authState.onboardingComplete ? "creator" : "creator-incomplete";
  return "anonymous";
}

function sessionStateFromAccount(account: CurrentAccountResponse["account"]): SessionState {
  if (account?.primaryRole === "brand") return account.brandOnboardingComplete === false ? "brand-incomplete" : "brand";
  if (account?.primaryRole === "creator") return "creator";
  if (account?.isBrand && !account.isCreator) return account.brandOnboardingComplete === false ? "brand-incomplete" : "brand";
  if (account?.isCreator && !account.isBrand) return "creator";
  return "anonymous";
}

function actionForSession(sessionState: SessionState) {
  if (sessionState === "creator") return { href: "/dashboard/creator", label: "Creator Workspace" };
  if (sessionState === "brand") return { href: "/dashboard", label: "Brand Workspace" };
  if (sessionState === "creator-incomplete") {
    return { href: "/auth/onboarding/creator?next=%2Fdashboard%2Fcreator", label: "Continue Creator Setup" };
  }
  if (sessionState === "brand-incomplete") return { href: "/auth/onboarding/brand", label: "Continue Brand Setup" };
  return null;
}

export function SiteAuthActions({
  mobile = false,
  variant = "primary",
  initialAuthState,
}: {
  mobile?: boolean;
  variant?: "nav" | "primary";
  initialAuthState?: PublicAuthState;
}) {
  const [sessionState, setSessionState] = useState<SessionState>(
    initialAuthState ? sessionStateFromPublicAuth(initialAuthState) : "loading",
  );

  useEffect(() => {
    if (initialAuthState) return;
    let mounted = true;
    void fetch("/api/account/current", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      if (!mounted) return;
      if (response.status === 401) {
        setSessionState("anonymous");
        return;
      }
      if (!response.ok) {
        setSessionState("anonymous");
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as CurrentAccountResponse;
      setSessionState(sessionStateFromAccount(payload.account));
    }).catch(() => {
      if (mounted) setSessionState("anonymous");
    });
    return () => {
      mounted = false;
    };
  }, [initialAuthState]);

  const authenticatedAction = actionForSession(sessionState);
  if (authenticatedAction) {
    if (variant === "nav") return null;
    return (
      <Link
        href={authenticatedAction.href}
        className={mobile ? "mt-2 flex h-11 items-center justify-center rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-200" : "hidden h-12 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-950/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200 lg:inline-flex"}
      >
        {authenticatedAction.label}
      </Link>
    );
  }

  if (sessionState === "loading") {
    if (variant === "nav") return <span aria-hidden="true" className="h-9 w-14" />;
    return <div aria-hidden="true" className={mobile ? "mt-2 h-11" : "hidden h-12 w-24 lg:block"} />;
  }

  if (variant === "nav") {
    return (
      <Link
        href="/auth/sign-in"
        className={mobile ? "block rounded-md px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200" : "rounded-md px-1 py-2 text-sm font-semibold text-white transition hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200"}
      >
        Log In
      </Link>
    );
  }

  return (
    <Link
      href="/auth/sign-up"
      className={mobile ? "mt-2 flex h-11 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-200" : "hidden h-12 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-950/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200 lg:inline-flex"}
    >
      Sign Up
    </Link>
  );
}
