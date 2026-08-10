"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { getPublicSiteOrigin } from "@/config/site-url";
import { createSupabaseBrowserClient } from "@/services/supabase/browser";

export type AuthIntentRole = "brand" | "creator";

type AccountSnapshot = {
  isBrand?: boolean;
  isCreator?: boolean;
  brandOnboardingComplete?: boolean;
};

type CurrentAccountResponse = {
  account?: AccountSnapshot;
  error?: {
    message?: string;
    code?: string;
  };
};

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

const secondaryEmailLinkEnabled = process.env.NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED === "true";

function authErrorFingerprint(error: unknown) {
  const parts = [];
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  } else {
    parts.push(String(error ?? ""));
  }
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; status?: unknown; error_code?: unknown };
    parts.push(String(candidate.code ?? ""), String(candidate.status ?? ""), String(candidate.error_code ?? ""));
  }
  return parts.join(" ").toLowerCase();
}

function safeAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = authErrorFingerprint(error);
  if (lower.includes("unsupported provider") || lower.includes("provider is not enabled")) {
    return "This sign-in option is not available right now.";
  }
  if (lower.includes("registered as a creator") || lower.includes("registered as a brand")) {
    return message;
  }
  if (lower.includes("session") || lower.includes("authentication_required")) {
    return "Your session could not be created. Please try logging in again.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("email rate limit") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("email_rate_limit_exceeded") ||
    lower.includes("429")
  ) {
    return "Please wait before requesting another email.";
  }
  if (lower.includes("password")) {
    return "Email or password is incorrect.";
  }
  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
    return "Confirm your email before logging in.";
  }
  if (lower.includes("invalid") || lower.includes("credentials") || lower.includes("login")) {
    return "Email or password is incorrect.";
  }
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "This email already has an account. Log in or reset your password.";
  }
  if (lower.includes("weak") || lower.includes("at least")) {
    return "Choose a stronger password.";
  }
  if (lower.includes("token") || lower.includes("otp") || lower.includes("expired")) {
    return lower.includes("expired")
      ? "That email link expired. Request a new one."
      : "That email link could not be verified. Check the email and try again.";
  }
  return "Authentication could not be completed. Try again.";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function safeRole(role?: AuthIntentRole | null) {
  return role === "brand" || role === "creator" ? role : null;
}

function safeNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) return "/dashboard";
  return nextPath;
}

function buildCallbackPath(input: { nextPath?: string | null; roleIntent?: AuthIntentRole | null; type?: "recovery" }) {
  const params = new URLSearchParams();
  const next = input.nextPath ? safeNextPath(input.nextPath) : null;
  const role = safeRole(input.roleIntent);
  if (next) params.set("next", next);
  if (role) params.set("role", role);
  if (input.type) params.set("type", input.type);
  const query = params.toString();
  return query ? `/auth/callback?${query}` : "/auth/callback";
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

function passwordIssues(value: string) {
  const issues = [];
  if (value.length < 8) issues.push("at least 8 characters");
  if (!/[A-Z]/.test(value)) issues.push("one uppercase letter");
  if (!/[a-z]/.test(value)) issues.push("one lowercase letter");
  if (!/\d/.test(value)) issues.push("one number");
  return issues;
}

function passwordIsValid(value: string) {
  return passwordIssues(value).length === 0;
}

function setupPath(role: AuthIntentRole | null) {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  params.set("setup", "1");
  return `/auth/sign-up?${params.toString()}`;
}

function roleConflictPath(existingRole: AuthIntentRole) {
  const params = new URLSearchParams({ roleConflict: existingRole });
  return `/auth/sign-up?${params.toString()}`;
}

function postAuthDestination(input: {
  account?: AccountSnapshot;
  roleIntent?: AuthIntentRole | null;
  nextPath?: string | null;
}) {
  const next = input.nextPath ? safeNextPath(input.nextPath) : null;
  const roleIntent = safeRole(input.roleIntent);
  const isBrand = input.account?.isBrand === true;
  const isCreator = input.account?.isCreator === true;

  if (roleIntent === "brand" && isCreator && !isBrand) return roleConflictPath("creator");
  if (roleIntent === "creator" && isBrand && !isCreator) return roleConflictPath("brand");

  if (next) {
    if (next.startsWith("/dashboard/creator") && isCreator) return next;
    if ((next === "/dashboard" || next.startsWith("/dashboard/")) && isBrand) return next;
    if (next.startsWith("/challenges") && (isBrand || isCreator)) return next;
  }

  if (isBrand) return input.account?.brandOnboardingComplete === false ? "/auth/onboarding/brand" : "/dashboard";
  if (isCreator) return "/dashboard/creator";
  if (roleIntent === "brand") return "/auth/onboarding/brand";
  if (roleIntent === "creator") return "/auth/onboarding/creator";
  return setupPath(null);
}

async function currentAccount(options: { requireAuthenticated?: boolean } = {}) {
  const response = await fetch("/api/account/current", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as CurrentAccountResponse;
  if (!response.ok) {
    if (response.status === 401 && !options.requireAuthenticated) return null;
    const accountError = new Error(body.error?.message ?? "Account resolution failed.");
    Object.assign(accountError, { code: body.error?.code, status: response.status });
    throw accountError;
  }
  return body.account ?? null;
}

export function AuthActions({
  mode = "sign-in",
  roleIntent = null,
  nextPath,
  surface = "dark",
  showCreateAccountLink = true,
}: {
  mode?: "sign-in" | "sign-up";
  roleIntent?: AuthIntentRole | null;
  nextPath?: string | null;
  surface?: "dark" | "light";
  showCreateAccountLink?: boolean;
}) {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const passwordAuthInFlightRef = useRef(false);
  const visibleOauthProviders = oauthProviders.filter((provider) => provider.enabled);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedRole = safeRole(roleIntent);
  const issues = passwordIssues(password);
  const canLogIn = validEmail(normalizedEmail) && password.length > 0 && pending === null;
  const canSignUp =
    validEmail(normalizedEmail) &&
    passwordIsValid(password) &&
    password === confirmPassword &&
    normalizedRole !== null &&
    pending === null;
  const isLightSurface = surface === "light";
  const labelClassName = isLightSurface
    ? "grid gap-2 text-sm font-semibold text-slate-700"
    : "grid gap-2 text-sm font-semibold text-slate-200";
  const formLabelClassName = isLightSurface ? "text-slate-700" : "";
  const inputClassName = isLightSurface
    ? "rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-400"
    : "rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60";
  const helperPanelClassName = isLightSurface
    ? "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
    : "rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300";
  const errorClassName = isLightSurface
    ? "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
    : "rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100";
  const statusClassName = isLightSurface ? "text-sm text-emerald-700" : "text-sm text-emerald-200";
  const secondaryToggleClassName = isLightSurface
    ? "text-sm font-semibold text-slate-700 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-200"
    : "text-sm font-semibold text-slate-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200";
  const secondaryButtonClassName = isLightSurface
    ? "mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    : "mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60";
  const authLinkClassName = isLightSurface
    ? "text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-cyan-200"
    : "text-blue-300 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-cyan-200";

  async function resolveCurrentAccountAfterLogin() {
    let lastError: unknown = null;
    for (const waitMs of [0, 150, 400]) {
      if (waitMs) await delay(waitMs);
      try {
        return await currentAccount({ requireAuthenticated: true });
      } catch (caught) {
        lastError = caught;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Account resolution failed.");
  }

  async function finishPasswordAuth(accountHint?: AccountSnapshot | null) {
    const account = accountHint ?? await resolveCurrentAccountAfterLogin();
    window.location.assign(postAuthDestination({ account: account ?? undefined, roleIntent: normalizedRole, nextPath }));
  }

  async function signInWithPassword() {
    if (!validEmail(normalizedEmail) || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (passwordAuthInFlightRef.current) return;
    passwordAuthInFlightRef.current = true;
    setPending("password-login");
    setError("");
    setStatus("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) throw signInError;
      if (!data.session || !data.user) {
        throw new Error("Password login did not create a Supabase session.");
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error("Browser session was not saved after password login.");
      }
      await finishPasswordAuth();
    } catch (caught) {
      setError(safeAuthError(caught));
    } finally {
      passwordAuthInFlightRef.current = false;
      setPending(null);
    }
  }

  async function signUpWithPassword() {
    if (!normalizedRole) {
      setError("Choose Brand or Creator.");
      return;
    }
    if (!validEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!passwordIsValid(password)) {
      setError(`Password must include ${issues.join(", ")}.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (passwordAuthInFlightRef.current) return;
    passwordAuthInFlightRef.current = true;

    setPending("password-signup");
    setError("");
    setStatus("");
    try {
      const origin = getPublicSiteOrigin();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${origin}${buildCallbackPath({
            nextPath: normalizedRole === "creator" ? "/auth/onboarding/creator" : "/auth/onboarding/brand",
            roleIntent: normalizedRole,
          })}`,
          data: {
            ccn_role_intent: normalizedRole,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          throw new Error("Browser session was not saved after account creation.");
        }
        await finishPasswordAuth();
        return;
      }

      setSentEmail(normalizedEmail);
      setStatus(`Confirm your email at ${maskEmail(normalizedEmail)}, then log in with your password.`);
    } catch (caught) {
      setError(safeAuthError(caught));
    } finally {
      passwordAuthInFlightRef.current = false;
      setPending(null);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending !== null || passwordAuthInFlightRef.current) return;
    if (mode === "sign-in") {
      await signInWithPassword();
      return;
    }
    await signUpWithPassword();
  }

  async function requestSecondaryEmailLink() {
    if (!validEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending("email-link");
    setError("");
    setStatus("");
    try {
      const origin = getPublicSiteOrigin();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: `${origin}${buildCallbackPath({ nextPath, roleIntent })}` },
      });
      if (signInError) throw signInError;
      setSentEmail(normalizedEmail);
      setStatus(`Email link sent to ${maskEmail(normalizedEmail)}.`);
    } catch (caught) {
      setError(safeAuthError(caught));
    } finally {
      setPending(null);
    }
  }

  async function signInWithOAuth(provider: "google" | "github") {
    const providerConfig = oauthProviders.find((item) => item.id === provider);
    if (!providerConfig?.enabled) {
      setError("This sign-in option is not available right now.");
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
      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <label className={labelClassName}>
          <FormLabel required className={formLabelClassName}>Email</FormLabel>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            aria-required="true"
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClassName}
            aria-invalid={Boolean(error && !validEmail(normalizedEmail))}
          />
        </label>
        <label className={labelClassName}>
          <FormLabel required className={formLabelClassName}>Password</FormLabel>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            aria-required="true"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            className={inputClassName}
          />
        </label>
        {mode === "sign-up" ? (
          <>
            <label className={labelClassName}>
              <FormLabel required className={formLabelClassName}>Confirm password</FormLabel>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                required
                aria-required="true"
                autoComplete="new-password"
                className={inputClassName}
              />
            </label>
            <div className={helperPanelClassName}>
              Password requirements: at least 8 characters, one uppercase letter, one lowercase letter, and one number.
            </div>
          </>
        ) : null}
        <button
          type="submit"
          disabled={mode === "sign-in" ? !canLogIn : !canSignUp}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "password-login" ? "Logging in..." : pending === "password-signup" ? "Creating..." : mode === "sign-in" ? "Log in" : "Create account"}
        </button>
      </form>
      {error ? (
        <p className={errorClassName} role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
      {status ? <p className={statusClassName} role="status" aria-live="polite">{status}</p> : null}
      {mode === "sign-in" ? (
        <div className="flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
          <Link href="/auth/forgot-password" className={authLinkClassName}>
            Forgot password?
          </Link>
          {showCreateAccountLink ? (
            <Link href={`/auth/sign-up${normalizedRole ? `?role=${normalizedRole}` : ""}`} className={authLinkClassName}>
              Create account
            </Link>
          ) : null}
        </div>
      ) : null}
      {secondaryEmailLinkEnabled && mode === "sign-in" ? (
        <div className={helperPanelClassName.replace("px-4 py-3", "p-4")}>
          <button
            type="button"
            onClick={() => setSecondaryOpen((value) => !value)}
            className={secondaryToggleClassName}
          >
            Other sign-in options
          </button>
          {secondaryOpen ? (
            <button
              type="button"
              onClick={() => void requestSecondaryEmailLink()}
              disabled={pending !== null || !validEmail(normalizedEmail)}
              className={secondaryButtonClassName}
            >
              {pending === "email-link" ? "Sending..." : "Email me a sign-in link"}
            </button>
          ) : null}
        </div>
      ) : null}
      {visibleOauthProviders.length ? (
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
      {sentEmail && !status ? <p className="sr-only">Email sent to {sentEmail}</p> : null}
    </div>
  );
}
