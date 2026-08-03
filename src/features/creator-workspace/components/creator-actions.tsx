"use client";

import { useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { FormLabel } from "@/components/ui/form-label";

export function CreatorSignInAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/creator/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ccnAccountId: "ccn-test-creator-001" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Creator sign-in failed.");
      }
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Creator sign-in failed.");
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={pending}
        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Continue as Demo Creator"}
      </button>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}

type SubmissionFormProps = {
  draftId: string;
  initialTitle: string;
  initialDescription: string;
  initialPrimaryAssetUrl: string;
  initialSupportingLinks: string[];
  isSubmitted: boolean;
};

type CreatorPayoutWalletSetupProps = {
  appId: string;
  available: boolean;
  returnTo?: string;
};

type CreatorOnboardingResponse = {
  onboarding: {
    wallet: {
      walletAddress: string | null;
      scope: "CREATOR_PAYOUT";
      status: "PENDING" | "ACTIVE" | "FAILED";
      blockchain: "ARC-TESTNET";
    };
    circleChallengeId?: string;
    circleSession?: {
      userToken: string;
      encryptionKey: string;
    };
    recoveryRequired?: boolean;
  };
};

type CreatorWalletStatusResponse = {
  wallet: CreatorOnboardingResponse["onboarding"]["wallet"] | null;
};

async function requestJson(pathname: string, body: Record<string, unknown>) {
  const response = await fetch(pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Request failed.");
  }
  return data;
}

async function postJson<T>(pathname: string) {
  const response = await fetch(pathname, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Request failed.");
  }
  return data as T;
}

async function getJson<T>(pathname: string) {
  const response = await fetch(pathname);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Request failed.");
  }
  return data as T;
}

function completeCreatorWalletSetup(returnTo?: string) {
  if (returnTo?.startsWith("/dashboard/creator") && !returnTo.startsWith("//")) {
    window.location.assign(returnTo);
    return;
  }
  window.location.reload();
}

export function CreatorPayoutWalletSetup({ appId, available, returnTo }: CreatorPayoutWalletSetupProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(available ? "Payout wallet ready." : "Set up your payout wallet before submitting.");
  const [error, setError] = useState("");

  async function loadSdk() {
    if (!appId) throw new Error("Circle app is not configured.");
    const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
    return new CircleSdk({ appSettings: { appId } }) as W3SSdk;
  }

  async function refreshOnboarding() {
    const data = await getJson<CreatorWalletStatusResponse>("/api/creator/onboarding");
    if (data.wallet?.status === "ACTIVE" && data.wallet.walletAddress) {
      setStatus("Payout wallet verified. Reloading workspace...");
      completeCreatorWalletSetup(returnTo);
      return;
    }
    setStatus("Wallet setup is still waiting for Circle confirmation.");
  }

  async function recoverOnboarding() {
    const data = await postJson<CreatorOnboardingResponse>("/api/creator/onboarding");
    if (data.onboarding.wallet.status === "ACTIVE" && data.onboarding.wallet.walletAddress) {
      setStatus("Payout wallet verified. Reloading workspace...");
      completeCreatorWalletSetup(returnTo);
      return;
    }
    setStatus("Wallet setup is still waiting for Circle confirmation.");
  }

  async function setupWallet() {
    setPending(true);
    setError("");
    try {
      if (!appId) throw new Error("Circle app is not configured.");
      const data = await postJson<CreatorOnboardingResponse>("/api/creator/onboarding");
      if (data.onboarding.wallet.status === "ACTIVE" && data.onboarding.wallet.walletAddress) {
        setStatus("Payout wallet verified. Reloading workspace...");
        completeCreatorWalletSetup(returnTo);
        return;
      }
      if (!data.onboarding.circleChallengeId || !data.onboarding.circleSession) {
        setStatus("Wallet setup is pending. Check status after completing Circle approval.");
        setPending(false);
        return;
      }
      const sdk = await loadSdk();
      sdk.setAuthentication({
        userToken: data.onboarding.circleSession.userToken,
        encryptionKey: data.onboarding.circleSession.encryptionKey,
      });
      setStatus("Opening Circle Hosted Wallet setup...");
      sdk.execute(data.onboarding.circleChallengeId, (challengeError) => {
        if (challengeError) {
          setError(challengeError.message ?? "Circle wallet setup was not completed.");
          setStatus("Payout wallet setup needs attention.");
          setPending(false);
          return;
        }
        setStatus("Circle approval complete. Verifying payout wallet...");
        void recoverOnboarding().finally(() => setPending(false));
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Payout wallet setup failed.");
      setPending(false);
    }
  }

  if (available) return null;

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5 text-sm text-slate-300">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Payout wallet required</p>
      <p className="mt-2 text-white">Set up your Creator payout wallet before saving or finalizing a submission.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void setupWallet()}
          disabled={pending}
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Setting up..." : "Set up payout wallet"}
        </button>
        <button
          type="button"
          onClick={() => void refreshOnboarding().catch((error) => setError(error instanceof Error ? error.message : "Wallet status check failed."))}
          disabled={pending}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Check status
        </button>
      </div>
      <p className="mt-3 text-slate-400">{status}</p>
      {error ? <p className="mt-3 text-rose-200">{error}</p> : null}
    </div>
  );
}

export function CreatorSubmissionForm(props: SubmissionFormProps) {
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription);
  const [primaryAssetUrl, setPrimaryAssetUrl] = useState(props.initialPrimaryAssetUrl);
  const [supportingLinks, setSupportingLinks] = useState(props.initialSupportingLinks.join("\n"));
  const [status, setStatus] = useState(props.isSubmitted ? "Submitted entries are immutable." : "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"save" | "finalize" | null>(null);

  const body = {
    draftId: props.draftId,
    title,
    description,
    primaryAssetUrl,
    supportingLinks: supportingLinks
      .split(/\r?\n/)
      .map((link) => link.trim())
      .filter(Boolean),
  };

  async function saveDraft() {
    setPending("save");
    setError("");
    try {
      await requestJson("/api/creator/submissions/draft", body);
      setStatus("Draft saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Draft save failed.");
    } finally {
      setPending(null);
    }
  }

  async function finalize() {
    setPending("finalize");
    setError("");
    try {
      await requestJson("/api/creator/submissions/draft", body);
      await requestJson("/api/creator/submissions/finalize", {
        draftId: props.draftId,
        idempotencyKey: `creator-workspace-${props.draftId}-${Date.now()}`,
      });
      setStatus("Submission finalized.");
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Creator submission</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Submit completed work</h2>
        </div>
        {props.isSubmitted ? (
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            Immutable
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          <FormLabel required>Submission title</FormLabel>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={props.isSubmitted}
            required
            aria-required="true"
            className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          <FormLabel required>Concept summary</FormLabel>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={props.isSubmitted}
            required
            aria-required="true"
            rows={5}
            className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          <FormLabel required>Main project link</FormLabel>
          <input
            value={primaryAssetUrl}
            onChange={(event) => setPrimaryAssetUrl(event.target.value)}
            disabled={props.isSubmitted}
            required
            aria-required="true"
            className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          <FormLabel optional>Supporting links</FormLabel>
          <textarea
            value={supportingLinks}
            onChange={(event) => setSupportingLinks(event.target.value)}
            disabled={props.isSubmitted}
            rows={3}
            className="rounded-xl border border-white/10 bg-[#050916] px-4 py-3 text-white outline-none transition focus:border-cyan-300/60 disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void saveDraft()}
          disabled={props.isSubmitted || pending !== null}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "save" ? "Saving..." : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => void finalize()}
          disabled={props.isSubmitted || pending !== null}
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "finalize" ? "Submitting..." : "Finalize Submission"}
        </button>
      </div>
      {status ? <p className="mt-3 text-sm text-emerald-200">{status}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}
