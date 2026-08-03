"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { ScopedWalletMapping } from "@/types/wallet-spike";

type SafeError = {
  message: string;
  status?: number;
  code?: string | number;
  endpoint?: string;
};

type PayoutSession = {
  ccnAccountId: string;
  circleUserId: string;
  userToken: string;
  encryptionKey: string;
};

function mask(value?: string | null) {
  if (!value) return "Not available";
  if (value.length <= 12) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: SafeError;
  };
  if (!response.ok) {
    throw payload.error ?? { message: "Payout wallet request failed." };
  }
  return payload as T;
}

export function PayoutWalletSpikeClient({
  appId,
  configured,
}: {
  appId: string;
  configured: boolean;
}) {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [session, setSession] = useState<PayoutSession | null>(null);
  const [wallet, setWallet] = useState<ScopedWalletMapping | null>(null);
  const [status, setStatus] = useState("Ready to create dedicated payout wallet.");
  const [error, setError] = useState<SafeError | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootSdk() {
      if (!appId) return;
      const { W3SSdk: CircleSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new CircleSdk({ appSettings: { appId } });
      if (active) sdkRef.current = sdk;
    }

    void bootSdk().catch(() => {
      setError({ message: "Failed to initialize Circle challenge SDK." });
    });
    return () => {
      active = false;
    };
  }, [appId]);

  const masked = useMemo(() => ({
    accountId: mask(session?.ccnAccountId ?? wallet?.ccnAccountId),
    circleUserId: mask(session?.circleUserId ?? wallet?.circleUserId),
    walletId: mask(wallet?.walletId),
  }), [session, wallet]);

  function showError(errorValue: unknown) {
    const safe =
      typeof errorValue === "object" && errorValue && "message" in errorValue
        ? errorValue as SafeError
        : { message: "Payout wallet request failed safely." };
    setError(safe);
    setStatus("Request failed safely.");
  }

  async function createSession() {
    setPending(true);
    setError(null);
    try {
      const data = await postJson<PayoutSession>("/api/internal/circle/payout/session");
      setSession(data);
      setStatus("Configured payout operator session created.");
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function refreshStatus() {
    if (!session) return;
    setPending(true);
    setError(null);
    try {
      const data = await postJson<{
        wallet: ScopedWalletMapping | null;
        mapped: boolean;
        candidateCount?: number;
      }>("/api/internal/circle/payout/wallet/status", {
        userToken: session.userToken,
      });
      setWallet(data.wallet);
      setStatus(
        data.wallet
          ? "Dedicated BRAND:PAYOUT wallet mapping verified."
          : `No unique new payout wallet available yet. Candidates: ${data.candidateCount ?? 0}.`,
      );
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  async function initializeWallet() {
    if (!session || !sdkRef.current) return;
    setPending(true);
    setError(null);
    try {
      sdkRef.current.setAuthentication({
        userToken: session.userToken,
        encryptionKey: session.encryptionKey,
      });
      const data = await postJson<{
        alreadyMapped?: boolean;
        challengeId?: string;
        wallet?: ScopedWalletMapping;
      }>("/api/internal/circle/payout/wallet/initialize", {
        userToken: session.userToken,
      });

      if (data.alreadyMapped && data.wallet) {
        setWallet(data.wallet);
        setStatus("Existing dedicated payout wallet mapping loaded.");
        return;
      }
      if (!data.challengeId) {
        throw { message: "Circle did not return a payout wallet challenge ID." };
      }
      setStatus("Executing Circle hosted payout wallet initialization...");
      sdkRef.current.execute(data.challengeId, (challengeError) => {
        if (challengeError) {
          setError({
            message: challengeError.message ?? "Circle wallet challenge failed.",
            code: challengeError.code,
          });
          setStatus("Payout wallet challenge failed.");
          return;
        }
        setStatus("Circle approval complete. Verifying new payout wallet...");
        void refreshStatus();
      });
    } catch (requestError) {
      showError(requestError);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-10 text-white sm:px-8 lg:px-10">
      <section className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
          Internal payout wallet spike
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Dedicated CCN payout wallet
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Creates only the configured operator&apos;s BRAND:PAYOUT
          User-Controlled wallet on Arc Testnet. No payout or role-grant
          transaction is submitted here.
        </p>

        {!configured ? (
          <div className="mt-6 rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Missing required internal payout wallet configuration.
          </div>
        ) : null}

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.04] p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={createSession}
              disabled={!configured || pending}
              className="h-11 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create payout session
            </button>
            <button
              type="button"
              onClick={initializeWallet}
              disabled={!session || pending}
              className="h-11 rounded-md bg-emerald-400 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Initialize payout wallet
            </button>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={!session || pending}
              className="h-11 rounded-md border border-white/15 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Verify payout wallet
            </button>
          </div>

          <div className="mt-5 rounded-md border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
            Status: {status}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info label="Payout account" value={masked.accountId} />
            <Info label="Circle user" value={masked.circleUserId} />
            <Info label="Wallet ID" value={masked.walletId} />
            <Info label="Wallet address" value={wallet?.walletAddress ?? "Not available"} />
            <Info label="Role" value={wallet?.role ?? "BRAND"} />
            <Info label="Purpose" value={wallet?.purpose ?? "PAYOUT"} />
            <Info label="Blockchain" value={wallet?.blockchain ?? "ARC-TESTNET"} />
            <Info label="Account type" value={wallet?.accountType ?? "SCA"} />
            <Info label="Wallet state" value={wallet?.walletState ?? "Not verified"} />
          </div>

          {error ? (
            <div className="mt-5 rounded-md border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100">
              <p className="font-bold">Safe error</p>
              <p className="mt-2">{error.message}</p>
              {error.status ? <p>HTTP Status: {error.status}</p> : null}
              {error.code ? <p>Circle Code: {error.code}</p> : null}
              {error.endpoint ? <p>Endpoint: {error.endpoint}</p> : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-sm font-bold text-white">
        {value}
      </p>
    </div>
  );
}
