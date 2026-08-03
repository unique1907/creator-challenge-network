"use client";

import { useState } from "react";
import { FormLabel } from "@/components/ui/form-label";

type BrandOnboardingFormProps = {
  initialDisplayName: string;
  initialBrandName: string;
  email?: string;
};

export function BrandOnboardingForm({ initialDisplayName, initialBrandName, email }: BrandOnboardingFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [brandName, setBrandName] = useState(initialBrandName);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const canSubmit = displayName.trim().length >= 2 && brandName.trim().length >= 2 && !pending;

  async function submit() {
    if (!canSubmit) {
      setError("Display name and company / brand name are required.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/onboarding/brand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          displayName,
          brandName,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        redirectTo?: string;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Brand onboarding could not be completed.");
      window.location.assign(payload.redirectTo ?? "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Brand onboarding could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-7 space-y-5">
      {email ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <FormLabel readOnly className="text-xs text-slate-400">Account email</FormLabel>
          </p>
          <p className="mt-1 break-all text-sm font-semibold text-slate-100">{email}</p>
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        <FormLabel required>Display name</FormLabel>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={120}
          autoComplete="name"
          required
          aria-required="true"
          className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        <FormLabel required>Company / Brand name</FormLabel>
        <input
          value={brandName}
          onChange={(event) => setBrandName(event.target.value)}
          maxLength={120}
          autoComplete="organization"
          required
          aria-required="true"
          className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60"
        />
      </label>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Enter Brand Workspace"}
      </button>
      {error ? <p className="text-sm text-rose-200" role="alert">{error}</p> : null}
    </div>
  );
}
