"use client";

import Link from "next/link";
import { useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { createSupabaseBrowserClient } from "@/services/supabase/browser";

function passwordIssues(value: string) {
  const issues = [];
  if (value.length < 8) issues.push("at least 8 characters");
  if (!/[A-Z]/.test(value)) issues.push("one uppercase letter");
  if (!/[a-z]/.test(value)) issues.push("one lowercase letter");
  if (!/\d/.test(value)) issues.push("one number");
  return issues;
}

function safeUpdateError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("session") || message.includes("token") || message.includes("expired")) {
    return "This reset link is expired or invalid. Request a new password reset.";
  }
  if (message.includes("weak") || message.includes("password")) {
    return "Choose a stronger password.";
  }
  return "Password could not be updated. Request a new reset link and try again.";
}

export function UpdatePasswordForm() {
  const supabase = createSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const issues = passwordIssues(password);
  const valid = issues.length === 0 && password === confirmPassword;

  async function submit() {
    if (issues.length) {
      setError(`Password must include ${issues.join(", ")}.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    setStatus("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Recovery session missing.");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmPassword("");
      setStatus("Password updated. Log in with your new password.");
    } catch (caught) {
      setError(safeUpdateError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-7 space-y-4">
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        <FormLabel required>New password</FormLabel>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          aria-required="true"
          autoComplete="new-password"
          className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        <FormLabel required>Confirm password</FormLabel>
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          required
          aria-required="true"
          autoComplete="new-password"
          className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
        />
      </label>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        Password requirements: at least 8 characters, one uppercase letter, one lowercase letter, and one number.
      </div>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={pending || !valid}
        className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Updating..." : "Update password"}
      </button>
      {status ? (
        <p className="text-sm text-emerald-200" role="status">
          {status} <Link href="/auth/sign-in" className="font-semibold text-blue-300 hover:text-blue-200">Log in</Link>
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-200" role="alert">{error}</p> : null}
    </div>
  );
}
