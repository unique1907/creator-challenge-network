"use client";

import { useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { getPublicSiteOrigin } from "@/config/site-url";
import { createSupabaseBrowserClient } from "@/services/supabase/browser";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeResetError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Please wait before requesting another reset email.";
  }
  return "Password reset could not be requested. Try again.";
}

export function ForgotPasswordForm() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function submit() {
    if (!validEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    setError("");
    setStatus("");
    try {
      const origin = getPublicSiteOrigin();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${origin}/auth/callback?type=recovery&next=${encodeURIComponent("/auth/update-password")}`,
      });
      if (resetError) throw resetError;
      setStatus("Password reset email sent. Open the link once, then set a new password.");
    } catch (caught) {
      setError(safeResetError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-7 space-y-4">
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
        />
      </label>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={pending || !validEmail(normalizedEmail)}
        className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send reset email"}
      </button>
      {status ? <p className="text-sm text-emerald-200" role="status">{status}</p> : null}
      {error ? <p className="text-sm text-rose-200" role="alert">{error}</p> : null}
    </div>
  );
}
