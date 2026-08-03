"use client";

import { useEffect, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { getPublicSiteOrigin } from "@/config/site-url";
import { createSupabaseBrowserClient } from "@/services/supabase/browser";

export type AuthIntentRole = "brand" | "creator";

const oauthProviders = [
  {
    id: "google",
    label: "Continue with Google",
    enabled: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
  },
  {
    id: "github",
    label: "Continue with GitHub",
    enabled: process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED === "true",
  },
] as const;

const emailOtpEnabled = process.env.NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED === "true";

function safeAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("unsupported provider") || lower.includes("provider is not enabled")) {
    return "OAuth provider is not currently available.";
  }
  if (lower.includes("rate limit") || lower.includes("too many") || lower.includes("email rate limit")) {
    return "Please wait before requesting another email.";
  }
  if (lower.includes("token") || lower.includes("otp") || lower.includes("expired") || lower.includes("invalid")) {
    return lower.includes("expired")
      ? "That sign-in email expired. Request a new one."
      : "That sign-in email could not be verified. Check the email and try again.";
  }
  return "We could not complete email sign-in. Try again.";
}

function safeRole(role?: AuthIntentRole | null) {
  return role === "brand" || role === "creator" ? role : null;
}

function safeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) return "/dashboard";
  return nextPath;
}

function buildCallbackPath(input: { nextPath?: string; roleIntent?: AuthIntentRole | null }) {
  const params = new URLSearchParams({ next: safeNextPath(input.nextPath) });
  const role = safeRole(input.roleIntent);
  if (role) params.set("role", role);
  return `/auth/callback?${params.toString()}`;
}

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) return "your email";
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safePostAuthDestination(input: {
  account?: {
    isBrand?: boolean;
    isCreator?: boolean;
    brandOnboardingComplete?: boolean;
  };
  roleIntent?: AuthIntentRole | null;
  nextPath?: string;
}) {
  const next = safeNextPath(input.nextPath);
  const isBrand = input.account?.isBrand === true;
  const isCreator = input.account?.isCreator === true;
  if (input.nextPath) {
    if (next.startsWith("/dashboard/creator") && isCreator) return next;
    if ((next === "/dashboard" || next.startsWith("/dashboard/")) && isBrand) return next;
    if (next.startsWith("/challenges") && (isBrand || isCreator)) return next;
  }
  if (input.roleIntent === "creator") {
    if (isCreator) return "/dashboard/creator";
    return "/auth/onboarding/creator";
  }
  if (input.roleIntent === "brand") {
    if (isBrand && input.account?.brandOnboardingComplete !== false) return "/dashboard";
    return "/auth/onboarding/brand";
  }
  if (isBrand) return "/dashboard";
  if (isCreator) return "/dashboard/creator";
  return "/auth/sign-up?setup=1";
}

export function AuthActions({
  roleIntent = null,
  nextPath,
}: {
  mode?: "sign-in" | "sign-up";
  roleIntent?: AuthIntentRole | null;
  nextPath?: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "link" | "otp">("email");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const visibleOauthProviders = oauthProviders.filter((provider) => provider.enabled);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmitEmail = validEmail(normalizedEmail) && pending === null;
  const canVerifyOtp = otp.length === 6 && pending === null;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestEmailCode(inputEmail = normalizedEmail) {
    if (!validEmail(inputEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending("email");
    setError("");
    setStatus("");
    try {
      const origin = getPublicSiteOrigin();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: inputEmail,
        options: { emailRedirectTo: `${origin}${buildCallbackPath({ nextPath, roleIntent })}` },
      });
      if (signInError) throw signInError;
      setSentEmail(inputEmail);
      setOtp("");
      setCooldown(60);
      if (emailOtpEnabled) {
        setStep("otp");
        setStatus("We sent a 6-digit code to your email.");
      } else {
        setStep("link");
        setStatus("Secure sign-in link sent.");
      }
    } catch (caught) {
      setError(safeAuthError(caught));
    } finally {
      setPending(null);
    }
  }

  async function verifyEmailCode() {
    if (!sentEmail || otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setPending("otp");
    setError("");
    setStatus("");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: sentEmail,
        token: otp,
        type: "email",
      });
      if (verifyError) throw verifyError;

      const response = await fetch("/api/account/current", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Account resolution failed.");
      const body = await response.json() as {
        account?: {
          isBrand?: boolean;
          isCreator?: boolean;
          brandOnboardingComplete?: boolean;
        };
      };
      window.location.assign(safePostAuthDestination({ account: body.account, roleIntent, nextPath }));
    } catch (caught) {
      setError(safeAuthError(caught));
    } finally {
      setPending(null);
    }
  }

  function updateOtp(value: string) {
    setOtp(value.replace(/\D/g, "").slice(0, 6));
  }

  async function signInWithOAuth(provider: "google" | "github") {
    const providerConfig = oauthProviders.find((item) => item.id === provider);
    if (!providerConfig?.enabled) {
      setError("OAuth provider is not currently available.");
      return;
    }

    setPending(provider);
    setError("");
    setStatus("");
    try {
      const origin = getPublicSiteOrigin();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}${buildCallbackPath({ nextPath, roleIntent })}` },
      });
      if (signInError) throw signInError;
    } catch (caught) {
      setError(safeAuthError(caught));
      setPending(null);
    }
  }

  return (
    <div className="mt-7 space-y-4">
      {step === "email" ? (
        <>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            <FormLabel required>Email</FormLabel>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              aria-required="true"
              autoComplete="email"
              placeholder="you@example.com"
              className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
              aria-invalid={Boolean(error && !validEmail(normalizedEmail))}
            />
          </label>
          <button
            type="button"
            onClick={() => void requestEmailCode()}
            disabled={!canSubmitEmail}
            className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "email" ? "Sending..." : "Continue with Email"}
          </button>
        </>
      ) : step === "otp" ? (
        <div className="space-y-4" aria-live="polite">
          <div>
            <h2 className="text-2xl font-semibold text-white">Enter your verification code</h2>
            <p className="mt-2 text-sm text-slate-300">We sent a 6-digit code to {maskEmail(sentEmail)}.</p>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            <FormLabel required>Verification code</FormLabel>
            <input
              value={otp}
              onChange={(event) => updateOtp(event.target.value)}
              required
              aria-required="true"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              aria-invalid={Boolean(error)}
              placeholder="000000"
              className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-center text-2xl font-semibold tracking-[0.35em] text-white outline-none transition focus:border-cyan-300/60"
            />
          </label>
          <button
            type="button"
            onClick={() => void verifyEmailCode()}
            disabled={!canVerifyOtp}
            className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "otp" ? "Verifying..." : "Verify and continue"}
          </button>
          <div className="flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void requestEmailCode(sentEmail)}
              disabled={pending !== null || cooldown > 0}
              className="rounded-md text-blue-300 transition hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError("");
                setStatus("");
              }}
              className="rounded-md text-slate-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              Change email
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4" aria-live="polite">
          <div>
            <h2 className="text-2xl font-semibold text-white">Check your email</h2>
            <p className="mt-2 text-sm text-slate-300">
              We sent a secure sign-in link to {maskEmail(sentEmail)}. Open the link to continue to CCN.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void requestEmailCode(sentEmail)}
              disabled={pending !== null || cooldown > 0}
              className="rounded-md text-blue-300 transition hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cooldown > 0 ? `Resend link in ${cooldown}s` : "Resend link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError("");
                setStatus("");
              }}
              className="rounded-md text-slate-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              Change email
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-md text-slate-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              Back
            </button>
          </div>
        </div>
      )}
      {step === "email" && visibleOauthProviders.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleOauthProviders.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => void signInWithOAuth(provider.id)}
              disabled={pending !== null}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === provider.id ? "Redirecting..." : provider.label}
            </button>
          ))}
        </div>
      ) : null}
      {status ? <p className="text-sm text-emerald-200" role="status">{status}</p> : null}
      {error ? <p className="text-sm text-rose-200" role="alert">{error}</p> : null}
    </div>
  );
}
